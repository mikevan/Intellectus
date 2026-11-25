from __future__ import annotations

import codecs
import dataclasses
import datetime as dt
import difflib
import fnmatch
import hashlib
import json
import os
import sqlite3
import tempfile
import zlib
from pathlib import Path
from typing import Iterable, Iterator


MAX_INLINE_NEW_FILE_BYTES = 256 * 1024
MAX_INLINE_CHECKPOINT_BYTES = 5 * 1024 * 1024
FULL_SNAPSHOT_INTERVAL = 10
DEFAULT_IGNORED_DIRS = {
    ".git",
    ".keepsafe",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "dist",
    "build",
    "__pycache__",
}
DEFAULT_IGNORED_FILES = {".DS_Store"}
READ_CHUNK_SIZE = 1024 * 1024


@dataclasses.dataclass(frozen=True)
class CheckpointRecord:
    checkpoint_id: str
    name: str
    created_at: str
    kind: str
    file_count: int
    changed_count: int
    base_checkpoint_id: str | None
    path: str


@dataclasses.dataclass(frozen=True)
class CheckpointResult:
    summary: str
    path: str


@dataclasses.dataclass(frozen=True)
class IgnoreRule:
    base_dir: Path
    pattern: str
    negated: bool
    directory_only: bool
    anchored: bool


@dataclasses.dataclass(frozen=True)
class FileScanResult:
    path: Path
    relative_path: str
    size: int
    content_hash: str


def create_checkpoint(root: Path, name: str) -> CheckpointResult:
    store = CheckpointStore(root)
    return store.create_checkpoint(name)


def list_checkpoints(root: Path) -> list[CheckpointRecord]:
    store = CheckpointStore(root)
    return store.list_checkpoints()


def restore_checkpoint(root: Path, checkpoint_id: str) -> None:
    store = CheckpointStore(root)
    store.restore_checkpoint(checkpoint_id)


def compare_checkpoints(root: Path, left_checkpoint_id: str, right_checkpoint_id: str) -> str:
    store = CheckpointStore(root)
    return store.compare_checkpoints(left_checkpoint_id, right_checkpoint_id)


def add_gitignore_entry(root: Path, pattern: str, directory: bool = False) -> str:
    store = CheckpointStore(root)
    return store.add_gitignore_entry(pattern=pattern, directory=directory)


def rebuild_keepsafe(root: Path) -> str:
    store = CheckpointStore(root)
    return store.rebuild()


class CheckpointStore:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.keepsafe_dir = self.root / ".keepsafe"
        self.checkpoints_dir = self.keepsafe_dir / "checkpoints"
        self.blobs_dir = self.keepsafe_dir / "blobs"
        self.db_path = self.keepsafe_dir / "index.sqlite3"

        self.keepsafe_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoints_dir.mkdir(parents=True, exist_ok=True)
        self.blobs_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def create_checkpoint(self, name: str) -> CheckpointResult:
        created_at = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        with self._connect() as conn:
            latest = self._latest_checkpoint(conn)
            sequence = 1 if latest is None else latest["sequence"] + 1
            checkpoint_id = f"{sequence:04d}-{slugify(name)}"
            checkpoint_dir = self.checkpoints_dir / checkpoint_id
            checkpoint_dir.mkdir(parents=True, exist_ok=False)

            entries_path = checkpoint_dir / "entries.jsonl"
            manifest_path = checkpoint_dir / "checkpoint.txt"
            metadata_path = checkpoint_dir / "manifest.json"

            conn.execute("BEGIN")
            conn.execute("DROP TABLE IF EXISTS temp.current_scan")
            conn.execute("CREATE TEMP TABLE current_scan (path TEXT PRIMARY KEY)")

            added_count = 0
            modified_count = 0
            deleted_count = 0
            tracked_count = 0
            inline_budget = InlineBudget(MAX_INLINE_CHECKPOINT_BYTES)
            is_full_snapshot = latest is None or sequence % FULL_SNAPSHOT_INTERVAL == 0

            with (
                entries_path.open("w", encoding="utf-8", newline="\n") as entries_file,
                manifest_path.open("w", encoding="utf-8", newline="\n") as manifest_file,
            ):
                manifest_file.write(f"Checkpoint: {checkpoint_id}\n")
                manifest_file.write(f"Name: {name}\n")
                manifest_file.write(f"Created: {created_at}\n")
                manifest_file.write(f"Mode: {'snapshot' if is_full_snapshot else 'delta'}\n")
                if latest is not None:
                    manifest_file.write(f"Base: {latest['checkpoint_id']}\n")
                manifest_file.write("\n")

                for scan in scan_text_files(self.root):
                    conn.execute("INSERT OR IGNORE INTO current_scan(path) VALUES (?)", (scan.relative_path,))
                    previous = conn.execute(
                        "SELECT blob_id, content_hash FROM file_state WHERE path = ?",
                        (scan.relative_path,),
                    ).fetchone()

                    if is_full_snapshot:
                        added_count += 1
                        blob_id, inline_text = self._store_file_blob(scan.path, allow_inline=inline_budget)
                        entry = {
                            "op": "add",
                            "path": scan.relative_path,
                            "blob_id": blob_id,
                            "content_hash": scan.content_hash,
                            "size": scan.size,
                        }
                        if inline_text is not None:
                            entry["text"] = inline_text
                        write_json_line(entries_file, entry)
                        self._write_manifest_entry(manifest_file, entry)
                        conn.execute(
                            "INSERT OR REPLACE INTO file_state(path, blob_id, content_hash, size, checkpoint_id) VALUES (?, ?, ?, ?, ?)",
                            (scan.relative_path, blob_id, scan.content_hash, scan.size, checkpoint_id),
                        )
                        continue

                    if previous is None:
                        added_count += 1
                        blob_id, inline_text = self._store_file_blob(scan.path, allow_inline=inline_budget)
                        entry = {
                            "op": "add",
                            "path": scan.relative_path,
                            "blob_id": blob_id,
                            "content_hash": scan.content_hash,
                            "size": scan.size,
                        }
                        if inline_text is not None:
                            entry["text"] = inline_text
                        write_json_line(entries_file, entry)
                        self._write_manifest_entry(manifest_file, entry)
                        conn.execute(
                            "INSERT OR REPLACE INTO file_state(path, blob_id, content_hash, size, checkpoint_id) VALUES (?, ?, ?, ?, ?)",
                            (scan.relative_path, blob_id, scan.content_hash, scan.size, checkpoint_id),
                        )
                        continue

                    if previous["content_hash"] != scan.content_hash:
                        modified_count += 1
                        blob_id, _ = self._store_file_blob(scan.path, allow_inline=None)
                        entry = {
                            "op": "modify",
                            "path": scan.relative_path,
                            "blob_id": blob_id,
                            "content_hash": scan.content_hash,
                            "size": scan.size,
                        }
                        write_json_line(entries_file, entry)
                        self._write_manifest_entry(manifest_file, entry)
                        conn.execute(
                            "INSERT OR REPLACE INTO file_state(path, blob_id, content_hash, size, checkpoint_id) VALUES (?, ?, ?, ?, ?)",
                            (scan.relative_path, blob_id, scan.content_hash, scan.size, checkpoint_id),
                        )

                deleted_rows = conn.execute(
                    "SELECT path FROM file_state WHERE path NOT IN (SELECT path FROM current_scan) ORDER BY path"
                ).fetchall()

                if not is_full_snapshot:
                    for row in deleted_rows:
                        deleted_count += 1
                        entry = {"op": "delete", "path": row["path"]}
                        write_json_line(entries_file, entry)
                        self._write_manifest_entry(manifest_file, entry)

                if deleted_rows:
                    conn.execute("DELETE FROM file_state WHERE path NOT IN (SELECT path FROM current_scan)")

                tracked_count = conn.execute("SELECT COUNT(*) AS count FROM file_state").fetchone()["count"]

            kind = "snapshot" if is_full_snapshot else "delta"
            changed_count = added_count + modified_count + deleted_count
            conn.execute(
                "INSERT INTO checkpoints(checkpoint_id, sequence, name, created_at, kind, file_count, changed_count, base_checkpoint_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    checkpoint_id,
                    sequence,
                    name,
                    created_at,
                    kind,
                    tracked_count,
                    changed_count,
                    None if latest is None else latest["checkpoint_id"],
                ),
            )
            conn.commit()

            metadata = {
                "checkpoint_id": checkpoint_id,
                "sequence": sequence,
                "name": name,
                "created_at": created_at,
                "kind": kind,
                "file_count": tracked_count,
                "changed_count": changed_count,
                "base_checkpoint_id": None if latest is None else latest["checkpoint_id"],
                "path": str(checkpoint_dir.relative_to(self.root)),
            }
            write_json_file(metadata_path, metadata)

            summary = (
                f"Created {'snapshot' if kind == 'snapshot' else 'delta'} checkpoint {checkpoint_id} "
                f"({tracked_count} tracked files, {changed_count} changes)"
            )
            return CheckpointResult(summary=summary, path=str(checkpoint_dir))

    def list_checkpoints(self) -> list[CheckpointRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT checkpoint_id, name, created_at, kind, file_count, changed_count, base_checkpoint_id, sequence FROM checkpoints ORDER BY sequence"
            ).fetchall()
        return [
            CheckpointRecord(
                checkpoint_id=row["checkpoint_id"],
                name=row["name"],
                created_at=row["created_at"],
                kind=row["kind"],
                file_count=row["file_count"],
                changed_count=row["changed_count"],
                base_checkpoint_id=row["base_checkpoint_id"],
                path=f".keepsafe/checkpoints/{row['checkpoint_id']}",
            )
            for row in rows
        ]

    def restore_checkpoint(self, checkpoint_id: str) -> None:
        target_rows = self._materialize_checkpoint_rows(checkpoint_id)
        current_tracked = [row["path"] for row in self._tracked_file_rows()]
        target_lookup = {row["path"] for row in target_rows}

        for tracked_path in current_tracked:
            path = self.root / tracked_path
            if path.exists() and tracked_path not in target_lookup:
                remove_path(path)

        for row in target_rows:
            destination = self.root / row["path"]
            if destination.exists() and destination.is_dir():
                remove_path(destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            raw_bytes = read_blob_bytes(self._blob_path(row["blob_id"]))
            destination.write_bytes(raw_bytes)

    def compare_checkpoints(self, left_checkpoint_id: str, right_checkpoint_id: str) -> str:
        left_rows = self._materialize_checkpoint_rows(left_checkpoint_id)
        right_rows = self._materialize_checkpoint_rows(right_checkpoint_id)

        left_map = {row["path"]: row["blob_id"] for row in left_rows}
        right_map = {row["path"]: row["blob_id"] for row in right_rows}

        left_paths = set(left_map)
        right_paths = set(right_map)
        added = sorted(right_paths - left_paths)
        deleted = sorted(left_paths - right_paths)
        modified = sorted(path for path in left_paths & right_paths if left_map[path] != right_map[path])

        lines = [
            f"Compare: {left_checkpoint_id} -> {right_checkpoint_id}",
            f"Added: {len(added)}",
            f"Deleted: {len(deleted)}",
            f"Modified: {len(modified)}",
            "",
        ]

        for path in added:
            lines.append(f"A {path}")
        for path in deleted:
            lines.append(f"D {path}")
        for path in modified:
            lines.append(f"M {path}")
            left_text = read_blob_bytes(self._blob_path(left_map[path])).decode("utf-8")
            right_text = read_blob_bytes(self._blob_path(right_map[path])).decode("utf-8")
            lines.extend(
                line.rstrip("\n")
                for line in difflib.unified_diff(
                    left_text.splitlines(keepends=True),
                    right_text.splitlines(keepends=True),
                    fromfile=f"a/{path}",
                    tofile=f"b/{path}",
                )
            )
            lines.append("")

        return "\n".join(lines).rstrip() + "\n"

    def add_gitignore_entry(self, pattern: str, directory: bool = False) -> str:
        normalized = pattern.strip()
        if not normalized:
            raise ValueError("Ignore pattern cannot be empty")

        normalized = normalize_ignore_pattern(self.root, normalized, directory=directory)
        if directory and not normalized.endswith("/"):
            normalized = f"{normalized}/"

        gitignore_path = self.root / ".gitignore"
        existing_lines: list[str] = []
        if gitignore_path.exists():
            existing_lines = read_text_text(gitignore_path).splitlines()

        if normalized in {line.strip() for line in existing_lines}:
            return f"Pattern already exists in {gitignore_path}"

        if existing_lines and existing_lines[-1].strip():
            existing_lines.append("")
        existing_lines.append(normalized)

        content = "\n".join(existing_lines).rstrip("\n") + "\n"
        with gitignore_path.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)

        return f"Added ignore pattern '{normalized}' to {gitignore_path}"

    def rebuild(self) -> str:
        legacy_index_path = self.keepsafe_dir / "index.json"
        if legacy_index_path.exists():
            migrated = self._rebuild_from_legacy_index(legacy_index_path)
            return f"Rebuilt KeepSafe metadata from legacy format ({migrated} checkpoints migrated)."

        rebuilt = self._rebuild_from_current_logs()
        return f"Rebuilt KeepSafe metadata from checkpoint logs ({rebuilt} checkpoints indexed)."

    def _rebuild_from_legacy_index(self, legacy_index_path: Path) -> int:
        payload = read_json_file(legacy_index_path)
        legacy_items = payload.get("checkpoints", [])
        if not legacy_items:
            self._reset_metadata_tables()
            return 0

        self._reset_metadata_tables()

        previous_state: dict[str, str] = {}
        migrated = 0

        with self._connect() as conn:
            conn.execute("BEGIN")
            for sequence, item in enumerate(legacy_items, start=1):
                checkpoint_id = item.get("checkpoint_id") or f"{sequence:04d}-checkpoint"
                checkpoint_dir = self.root / item.get("path", f".keepsafe/checkpoints/{checkpoint_id}")
                state_path = checkpoint_dir / "state.json"
                if not state_path.exists():
                    continue

                state_payload = read_json_file(state_path)
                current_state = state_payload.get("files", {})
                if not isinstance(current_state, dict):
                    continue

                name = state_payload.get("name") or item.get("name") or checkpoint_id
                created_at = state_payload.get("created_at") or item.get("created_at") or dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
                kind = "snapshot" if sequence == 1 or sequence % FULL_SNAPSHOT_INTERVAL == 0 else "delta"

                entries_path = checkpoint_dir / "entries.jsonl"
                checkpoint_txt_path = checkpoint_dir / "checkpoint.txt"
                manifest_path = checkpoint_dir / "manifest.json"
                checkpoint_dir.mkdir(parents=True, exist_ok=True)

                added_count = 0
                modified_count = 0
                deleted_count = 0
                inline_budget = InlineBudget(MAX_INLINE_CHECKPOINT_BYTES)

                with (
                    entries_path.open("w", encoding="utf-8", newline="\n") as entries_file,
                    checkpoint_txt_path.open("w", encoding="utf-8", newline="\n") as manifest_file,
                ):
                    manifest_file.write(f"Checkpoint: {checkpoint_id}\n")
                    manifest_file.write(f"Name: {name}\n")
                    manifest_file.write(f"Created: {created_at}\n")
                    manifest_file.write(f"Mode: {kind}\n")
                    if sequence > 1:
                        manifest_file.write(f"Base: {legacy_items[sequence - 2].get('checkpoint_id', f'{sequence - 1:04d}-checkpoint')}\n")
                    manifest_file.write("\n")

                    if kind == "snapshot":
                        for path in sorted(current_state):
                            text = normalize_legacy_text(current_state[path])
                            blob_id = self._store_text_blob(text)
                            entry = {
                                "op": "add",
                                "path": path,
                                "blob_id": blob_id,
                                "content_hash": sha256_text(text),
                                "size": len(text.encode("utf-8")),
                            }
                            text_size = entry["size"]
                            if text_size <= MAX_INLINE_NEW_FILE_BYTES and inline_budget.remaining >= text_size:
                                entry["text"] = text
                                inline_budget.consume(text_size)
                            write_json_line(entries_file, entry)
                            self._write_manifest_entry(manifest_file, entry)
                            added_count += 1
                    else:
                        previous_paths = set(previous_state)
                        current_paths = set(current_state)

                        for path in sorted(current_paths - previous_paths):
                            text = normalize_legacy_text(current_state[path])
                            blob_id = self._store_text_blob(text)
                            entry = {
                                "op": "add",
                                "path": path,
                                "blob_id": blob_id,
                                "content_hash": sha256_text(text),
                                "size": len(text.encode("utf-8")),
                            }
                            text_size = entry["size"]
                            if text_size <= MAX_INLINE_NEW_FILE_BYTES and inline_budget.remaining >= text_size:
                                entry["text"] = text
                                inline_budget.consume(text_size)
                            write_json_line(entries_file, entry)
                            self._write_manifest_entry(manifest_file, entry)
                            added_count += 1

                        for path in sorted(previous_paths - current_paths):
                            entry = {"op": "delete", "path": path}
                            write_json_line(entries_file, entry)
                            self._write_manifest_entry(manifest_file, entry)
                            deleted_count += 1

                        for path in sorted(previous_paths & current_paths):
                            prev_text = normalize_legacy_text(previous_state[path])
                            curr_text = normalize_legacy_text(current_state[path])
                            if prev_text == curr_text:
                                continue
                            blob_id = self._store_text_blob(curr_text)
                            entry = {
                                "op": "modify",
                                "path": path,
                                "blob_id": blob_id,
                                "content_hash": sha256_text(curr_text),
                                "size": len(curr_text.encode("utf-8")),
                            }
                            write_json_line(entries_file, entry)
                            self._write_manifest_entry(manifest_file, entry)
                            modified_count += 1

                changed_count = added_count + modified_count + deleted_count
                file_count = len(current_state)
                base_checkpoint_id = None if sequence == 1 else legacy_items[sequence - 2].get("checkpoint_id", f"{sequence - 1:04d}-checkpoint")

                manifest_payload = {
                    "checkpoint_id": checkpoint_id,
                    "sequence": sequence,
                    "name": name,
                    "created_at": created_at,
                    "kind": kind,
                    "file_count": file_count,
                    "changed_count": changed_count,
                    "base_checkpoint_id": base_checkpoint_id,
                    "path": str(checkpoint_dir.relative_to(self.root)),
                }
                write_json_file(manifest_path, manifest_payload)

                conn.execute(
                    "INSERT OR REPLACE INTO checkpoints(checkpoint_id, sequence, name, created_at, kind, file_count, changed_count, base_checkpoint_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        checkpoint_id,
                        sequence,
                        name,
                        created_at,
                        kind,
                        file_count,
                        changed_count,
                        base_checkpoint_id,
                    ),
                )

                for path, text_value in current_state.items():
                    text = normalize_legacy_text(text_value)
                    conn.execute(
                        "INSERT OR REPLACE INTO file_state(path, blob_id, content_hash, size, checkpoint_id) VALUES (?, ?, ?, ?, ?)",
                        (
                            path,
                            sha256_text(text),
                            sha256_text(text),
                            len(text.encode("utf-8")),
                            checkpoint_id,
                        ),
                    )

                previous_state = {key: normalize_legacy_text(value) for key, value in current_state.items()}
                migrated += 1

            conn.commit()

        return migrated

    def _rebuild_from_current_logs(self) -> int:
        self._reset_metadata_tables()
        checkpoint_dirs = [path for path in sorted(self.checkpoints_dir.iterdir()) if path.is_dir()]
        rebuilt = 0

        with self._connect() as conn:
            conn.execute("BEGIN")
            conn.execute("DELETE FROM file_state")

            for sequence, checkpoint_dir in enumerate(checkpoint_dirs, start=1):
                checkpoint_id = checkpoint_dir.name
                manifest_path = checkpoint_dir / "manifest.json"
                entries_path = checkpoint_dir / "entries.jsonl"

                if not entries_path.exists():
                    continue

                manifest_payload = read_json_file(manifest_path) if manifest_path.exists() else {}
                name = manifest_payload.get("name", checkpoint_id)
                created_at = manifest_payload.get("created_at", dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z")
                kind = manifest_payload.get("kind", "snapshot" if sequence == 1 else "delta")
                base_checkpoint_id = None if sequence == 1 else checkpoint_dirs[sequence - 2].name

                changed_count = 0
                with entries_path.open("r", encoding="utf-8") as entries_file:
                    for raw_line in entries_file:
                        line = raw_line.strip()
                        if not line:
                            continue
                        entry = json.loads(line)
                        changed_count += 1
                        op = entry.get("op")
                        path = entry.get("path")
                        if op in {"add", "modify"}:
                            blob_id = entry["blob_id"]
                            content_hash = entry.get("content_hash", blob_id)
                            size = entry.get("size", len(read_blob_bytes(self._blob_path(blob_id))))
                            conn.execute(
                                "INSERT OR REPLACE INTO file_state(path, blob_id, content_hash, size, checkpoint_id) VALUES (?, ?, ?, ?, ?)",
                                (path, blob_id, content_hash, size, checkpoint_id),
                            )
                        elif op == "delete":
                            conn.execute("DELETE FROM file_state WHERE path = ?", (path,))

                file_count = conn.execute("SELECT COUNT(*) AS count FROM file_state").fetchone()["count"]
                conn.execute(
                    "INSERT OR REPLACE INTO checkpoints(checkpoint_id, sequence, name, created_at, kind, file_count, changed_count, base_checkpoint_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        checkpoint_id,
                        sequence,
                        name,
                        created_at,
                        kind,
                        file_count,
                        changed_count,
                        base_checkpoint_id,
                    ),
                )
                rebuilt += 1

            conn.commit()

        return rebuilt

    def _reset_metadata_tables(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM checkpoints")
            conn.execute("DELETE FROM file_state")
            conn.commit()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS checkpoints (
                    checkpoint_id TEXT PRIMARY KEY,
                    sequence INTEGER NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    file_count INTEGER NOT NULL,
                    changed_count INTEGER NOT NULL,
                    base_checkpoint_id TEXT
                );

                CREATE TABLE IF NOT EXISTS file_state (
                    path TEXT PRIMARY KEY,
                    blob_id TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    checkpoint_id TEXT NOT NULL
                );
                """
            )
            conn.commit()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

    def _latest_checkpoint(self, conn: sqlite3.Connection) -> sqlite3.Row | None:
        return conn.execute(
            "SELECT checkpoint_id, sequence FROM checkpoints ORDER BY sequence DESC LIMIT 1"
        ).fetchone()

    def _tracked_file_rows(self) -> list[sqlite3.Row]:
        with self._connect() as conn:
            return conn.execute("SELECT path FROM file_state ORDER BY path").fetchall()

    def _materialize_checkpoint_rows(self, checkpoint_id: str) -> list[sqlite3.Row]:
        with self._connect() as conn:
            target = conn.execute(
                "SELECT sequence FROM checkpoints WHERE checkpoint_id = ?",
                (checkpoint_id,),
            ).fetchone()
            if target is None:
                raise FileNotFoundError(f"Checkpoint {checkpoint_id} does not exist")

            snapshot = conn.execute(
                "SELECT checkpoint_id, sequence FROM checkpoints WHERE sequence <= ? AND kind = 'snapshot' ORDER BY sequence DESC LIMIT 1",
                (target["sequence"],),
            ).fetchone()
            if snapshot is None:
                raise FileNotFoundError(f"No snapshot available to resolve checkpoint {checkpoint_id}")

            conn.execute("DROP TABLE IF EXISTS target_state")
            conn.execute("CREATE TEMP TABLE target_state (path TEXT PRIMARY KEY, blob_id TEXT NOT NULL)")

            checkpoints = conn.execute(
                "SELECT checkpoint_id FROM checkpoints WHERE sequence BETWEEN ? AND ? ORDER BY sequence",
                (snapshot["sequence"], target["sequence"]),
            ).fetchall()
            for checkpoint_row in checkpoints:
                entries_path = self.checkpoints_dir / checkpoint_row["checkpoint_id"] / "entries.jsonl"
                if not entries_path.exists():
                    continue
                with entries_path.open("r", encoding="utf-8") as entries_file:
                    for line in entries_file:
                        if not line.strip():
                            continue
                        entry = json.loads(line)
                        op = entry["op"]
                        path = entry["path"]
                        if op in {"add", "modify"}:
                            conn.execute(
                                "INSERT OR REPLACE INTO target_state(path, blob_id) VALUES (?, ?)",
                                (path, entry["blob_id"]),
                            )
                        elif op == "delete":
                            conn.execute("DELETE FROM target_state WHERE path = ?", (path,))

            return conn.execute("SELECT path, blob_id FROM target_state ORDER BY path").fetchall()

    def _blob_path(self, blob_id: str) -> Path:
        return self.blobs_dir / blob_id[:2] / f"{blob_id[2:]}.blob"

    def _store_file_blob(
        self,
        path: Path,
        allow_inline: InlineBudget | None,
    ) -> tuple[str, str | None]:
        size = path.stat().st_size
        blob_id = sha256_file(path)
        blob_path = self._blob_path(blob_id)
        blob_path.parent.mkdir(parents=True, exist_ok=True)

        if not blob_path.exists():
            tmp_handle = tempfile.NamedTemporaryFile(delete=False, dir=str(blob_path.parent), prefix=".tmp-", suffix=".blob")
            tmp_path = Path(tmp_handle.name)
            compressor = zlib.compressobj(level=6)
            try:
                with path.open("rb") as source, tmp_handle:
                    while True:
                        chunk = source.read(READ_CHUNK_SIZE)
                        if not chunk:
                            break
                        tmp_handle.write(compressor.compress(chunk))
                    tmp_handle.write(compressor.flush())
                if blob_path.exists():
                    tmp_path.unlink(missing_ok=True)
                else:
                    tmp_path.replace(blob_path)
            except Exception:
                tmp_path.unlink(missing_ok=True)
                raise

        inline_text = None
        if allow_inline is not None and size <= MAX_INLINE_NEW_FILE_BYTES and allow_inline.remaining >= size:
            inline_text = read_text_text(path)
            allow_inline.consume(size)

        return blob_id, inline_text

    def _store_text_blob(self, text: str) -> str:
        raw_bytes = text.encode("utf-8")
        blob_id = hashlib.sha256(raw_bytes).hexdigest()
        blob_path = self._blob_path(blob_id)
        blob_path.parent.mkdir(parents=True, exist_ok=True)
        if not blob_path.exists():
            compressed = zlib.compress(raw_bytes, level=6)
            blob_path.write_bytes(compressed)
        return blob_id

    def _write_manifest_entry(self, manifest_file, entry: dict) -> None:
        op = entry["op"]
        path = entry["path"]
        if op == "add":
            manifest_file.write(f"A {path}\n")
            text = entry.get("text")
            if text is not None:
                manifest_file.write(f"--- {path} ---\n")
                manifest_file.write(text)
                if not text.endswith("\n"):
                    manifest_file.write("\n")
            else:
                manifest_file.write(f"[blob {entry['blob_id']} size={entry['size']}]\n")
            manifest_file.write("\n")
            return

        if op == "modify":
            manifest_file.write(f"M {path} [blob {entry['blob_id']} size={entry['size']}]\n\n")
            return

        if op == "delete":
            manifest_file.write(f"D {path}\n\n")


@dataclasses.dataclass(frozen=True)
class InlineBudget:
    remaining: int

    def consume(self, amount: int) -> None:
        object.__setattr__(self, "remaining", self.remaining - amount)


def scan_text_files(root: Path) -> Iterator[FileScanResult]:
    yield from _walk_text_files(root, root, [])


def _walk_text_files(root: Path, current_dir: Path, inherited_rules: list[IgnoreRule]) -> Iterator[FileScanResult]:
    rules = inherited_rules + load_gitignore_rules(current_dir)
    try:
        entries = sorted(current_dir.iterdir(), key=lambda item: item.name.lower())
    except OSError:
        return

    for entry in entries:
        if entry.name in DEFAULT_IGNORED_DIRS or entry.name in DEFAULT_IGNORED_FILES:
            continue

        relative_path = entry.relative_to(root).as_posix()
        if should_ignore(entry, current_dir, root, rules):
            continue

        if entry.is_dir():
            yield from _walk_text_files(root, entry, rules)
            continue

        if not entry.is_file():
            continue

        scan = scan_file(entry)
        if scan is None:
            continue
        yield FileScanResult(path=entry, relative_path=relative_path, size=scan.size, content_hash=scan.content_hash)


def scan_file(path: Path) -> FileScanResult | None:
    try:
        size = path.stat().st_size
    except OSError:
        return None

    hasher = hashlib.sha256()
    decoder = codecs.getincrementaldecoder("utf-8")()
    try:
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(READ_CHUNK_SIZE)
                if not chunk:
                    break
                if b"\x00" in chunk:
                    return None
                hasher.update(chunk)
                decoder.decode(chunk)
            decoder.decode(b"", final=True)
    except UnicodeDecodeError:
        return None
    except OSError:
        return None

    return FileScanResult(path=path, relative_path="", size=size, content_hash=hasher.hexdigest())


def should_ignore(entry: Path, current_dir: Path, root: Path, rules: list[IgnoreRule]) -> bool:
    ignored = False
    candidate = entry.resolve()
    for rule in rules:
        if rule_matches(rule, candidate, current_dir, root, entry.is_dir()):
            ignored = not rule.negated
    return ignored


def rule_matches(rule: IgnoreRule, candidate: Path, current_dir: Path, root: Path, is_dir: bool) -> bool:
    try:
        relative = candidate.relative_to(rule.base_dir)
    except ValueError:
        return False

    pattern = rule.pattern
    candidate_text = relative.as_posix()
    if rule.directory_only and not is_dir:
        return False

    if rule.anchored or "/" in pattern:
        return fnmatch.fnmatchcase(candidate_text, pattern)

    parts = candidate_text.split("/")
    return any(fnmatch.fnmatchcase(part, pattern) for part in parts)


@dataclasses.dataclass(frozen=True)
class GitIgnorePattern:
    pass


@dataclasses.dataclass(frozen=True)
class FileContent:
    size: int
    content_hash: str


def load_gitignore_rules(directory: Path) -> list[IgnoreRule]:
    gitignore_path = directory / ".gitignore"
    if not gitignore_path.exists():
        return []

    rules: list[IgnoreRule] = []
    for raw_line in read_text_text(gitignore_path).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        negated = line.startswith("!")
        if negated:
            line = line[1:]

        anchored = line.startswith("/")
        if anchored:
            line = line[1:]

        directory_only = line.endswith("/")
        if directory_only:
            line = line[:-1]

        if not line:
            continue

        rules.append(
            IgnoreRule(
                base_dir=directory,
                pattern=line,
                negated=negated,
                directory_only=directory_only,
                anchored=anchored,
            )
        )
    return rules


def read_text_text(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return handle.read()


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(READ_CHUNK_SIZE)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def read_blob_bytes(path: Path) -> bytes:
    with path.open("rb") as handle:
        return zlib.decompress(handle.read())


def write_json_line(handle, payload: dict) -> None:
    handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    handle.write("\n")


def write_json_file(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False, sort_keys=True)
        handle.write("\n")


def read_json_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return json.load(handle)


def remove_path(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        for child in sorted(path.iterdir(), reverse=True):
            remove_path(child)
        try:
            path.rmdir()
        except OSError:
            pass
        return

    try:
        path.unlink()
    except FileNotFoundError:
        pass


def slugify(value: str) -> str:
    slug = [char.lower() if char.isalnum() else "-" for char in value.strip()]
    result = "".join(slug).strip("-")
    while "--" in result:
        result = result.replace("--", "-")
    return result or "checkpoint"


def normalize_ignore_pattern(root: Path, pattern: str, directory: bool) -> str:
    normalized = pattern.strip().replace("\\", "/")
    if not normalized:
        return normalized

    explicit_relative = normalized.startswith("./")
    if explicit_relative:
        normalized = normalized[2:]

    wildcard_chars = {"*", "?", "[", "]", "!"}
    has_wildcards = any(char in normalized for char in wildcard_chars)
    if has_wildcards:
        return normalized

    candidate = root / normalized
    try:
        resolved = candidate.resolve()
    except OSError:
        resolved = candidate

    try:
        relative = resolved.relative_to(root.resolve())
    except ValueError:
        return normalized

    if relative.parts:
        anchored = "/" + relative.as_posix().rstrip("/")
        if directory:
            return anchored + "/"
        if explicit_relative or resolved.exists():
            return anchored

    return normalized


def normalize_legacy_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    return str(value)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
