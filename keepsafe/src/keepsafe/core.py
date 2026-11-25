from __future__ import annotations

import dataclasses
import datetime as dt
import difflib
import fnmatch
import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable


DEFAULT_IGNORED_DIRS = {".git", ".keepsafe"}


@dataclasses.dataclass(frozen=True)
class CheckpointRecord:
    checkpoint_id: str
    name: str
    created_at: str
    kind: str
    file_count: int
    changed_count: int
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
    original: str

    def matches(self, candidate: Path, is_dir: bool) -> bool:
        try:
            relative_to_base = candidate.relative_to(self.base_dir)
        except ValueError:
            return False

        candidate_text = relative_to_base.as_posix() or candidate.name

        if self.anchored or "/" in self.pattern:
            if fnmatch.fnmatchcase(candidate_text, self.pattern):
                return True
            return False

        parts = candidate_text.split("/")
        if any(fnmatch.fnmatchcase(part, self.pattern) for part in parts):
            return True
        return False


def create_checkpoint(root: Path, name: str) -> CheckpointResult:
    root = root.resolve()
    KeepSafe_dir = ensure_KeepSafe_dir(root)
    checkpoints_dir = KeepSafe_dir / "checkpoints"
    checkpoints_dir.mkdir(parents=True, exist_ok=True)

    index = load_index(KeepSafe_dir)
    current_state = collect_workspace_state(root)
    checkpoint_id = build_checkpoint_id(index, name)
    checkpoint_dir = checkpoints_dir / checkpoint_id
    checkpoint_dir.mkdir(parents=True, exist_ok=False)

    previous_state = load_previous_state(index, KeepSafe_dir)
    created_at = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    if previous_state is None:
        kind = "snapshot"
        human_text = render_snapshot_text(checkpoint_id, name, created_at, current_state)
        changed_count = len(current_state)
    else:
        kind = "delta"
        human_text, changed_count = render_changes_text(
            checkpoint_id,
            name,
            created_at,
            previous_state,
            current_state,
        )

    state_payload = {
        "checkpoint_id": checkpoint_id,
        "name": name,
        "created_at": created_at,
        "kind": kind,
        "files": current_state,
    }

    metadata = {
        "checkpoint_id": checkpoint_id,
        "name": name,
        "created_at": created_at,
        "kind": kind,
        "file_count": len(current_state),
        "changed_count": changed_count,
    }

    write_text_file(checkpoint_dir / "checkpoint.txt", human_text)
    write_json_file(checkpoint_dir / "state.json", state_payload)
    write_json_file(checkpoint_dir / "metadata.json", metadata)

    index["checkpoints"].append(metadata | {"path": str(checkpoint_dir.relative_to(root))})
    write_json_file(KeepSafe_dir / "index.json", index)

    label = "snapshot" if kind == "snapshot" else "diff"
    summary = f"Created {label} checkpoint {checkpoint_id} ({len(current_state)} files, {changed_count} changes)"
    return CheckpointResult(summary=summary, path=str(checkpoint_dir))


def list_checkpoints(root: Path) -> list[CheckpointRecord]:
    KeepSafe_dir = root.resolve() / ".keepsafe"
    index = load_index(KeepSafe_dir)
    records: list[CheckpointRecord] = []
    for item in index["checkpoints"]:
        records.append(
            CheckpointRecord(
                checkpoint_id=item["checkpoint_id"],
                name=item["name"],
                created_at=item["created_at"],
                kind=item["kind"],
                file_count=item["file_count"],
                changed_count=item["changed_count"],
                path=item["path"],
            )
        )
    return records


def restore_checkpoint(root: Path, checkpoint_id: str) -> None:
    root = root.resolve()
    checkpoint_dir = root / ".keepsafe" / "checkpoints" / checkpoint_id
    state_path = checkpoint_dir / "state.json"
    if not state_path.exists():
        raise FileNotFoundError(f"Checkpoint {checkpoint_id} does not exist")

    state = read_json_file(state_path)
    files: dict[str, str] = state["files"]
    tracked_paths = {root / relative_path for relative_path in files}

    for relative_path, content in files.items():
        target = root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        write_text_file(target, content)

    for path in sorted(find_tracked_files(root) - tracked_paths, reverse=True):
        if path.exists() and path.is_file():
            path.unlink()


def load_previous_state(index: dict, KeepSafe_dir: Path) -> dict[str, str] | None:
    checkpoints = index.get("checkpoints", [])
    if not checkpoints:
        return None
    previous_path = KeepSafe_dir.parent / checkpoints[-1]["path"] / "state.json"
    if not previous_path.exists():
        return None
    previous_state = read_json_file(previous_path)
    return previous_state["files"]


def ensure_KeepSafe_dir(root: Path) -> Path:
    KeepSafe_dir = root / ".keepsafe"
    KeepSafe_dir.mkdir(parents=True, exist_ok=True)
    (KeepSafe_dir / "checkpoints").mkdir(parents=True, exist_ok=True)
    return KeepSafe_dir


def load_index(KeepSafe_dir: Path) -> dict:
    index_path = KeepSafe_dir / "index.json"
    if index_path.exists():
        return read_json_file(index_path)
    return {"version": 1, "checkpoints": []}


def build_checkpoint_id(index: dict, name: str) -> str:
    sequence = len(index.get("checkpoints", [])) + 1
    slug = slugify(name)
    return f"{sequence:04d}-{slug}"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "checkpoint"


def render_snapshot_text(checkpoint_id: str, name: str, created_at: str, state: dict[str, str]) -> str:
    lines = [
        f"Checkpoint: {checkpoint_id}",
        f"Name: {name}",
        f"Created: {created_at}",
        f"Mode: snapshot",
        f"Files: {len(state)}",
        "",
    ]
    for relative_path in sorted(state):
        lines.append(f"--- {relative_path} ---")
        lines.append(state[relative_path])
        if not state[relative_path].endswith("\n"):
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_changes_text(
    checkpoint_id: str,
    name: str,
    created_at: str,
    previous_state: dict[str, str],
    current_state: dict[str, str],
) -> tuple[str, int]:
    previous_paths = set(previous_state)
    current_paths = set(current_state)

    added = sorted(current_paths - previous_paths)
    deleted = sorted(previous_paths - current_paths)
    modified = sorted(path for path in current_paths & previous_paths if previous_state[path] != current_state[path])

    lines = [
        f"Checkpoint: {checkpoint_id}",
        f"Name: {name}",
        f"Created: {created_at}",
        f"Mode: diff",
        f"Added: {len(added)}",
        f"Deleted: {len(deleted)}",
        f"Modified: {len(modified)}",
        "",
    ]

    for relative_path in added:
        lines.append(f"A {relative_path}")
        lines.append(current_state[relative_path])
        if not current_state[relative_path].endswith("\n"):
            lines.append("")

    for relative_path in deleted:
        lines.append(f"D {relative_path}")

    for relative_path in modified:
        lines.append(f"M {relative_path}")
        diff = difflib.unified_diff(
            previous_state[relative_path].splitlines(keepends=True),
            current_state[relative_path].splitlines(keepends=True),
            fromfile=f"a/{relative_path}",
            tofile=f"b/{relative_path}",
        )
        lines.extend(line.rstrip("\n") for line in diff)
        lines.append("")

    human_text = "\n".join(lines).rstrip() + "\n"
    changed_count = len(added) + len(deleted) + len(modified)
    return human_text, changed_count


def collect_workspace_state(root: Path) -> dict[str, str]:
    state: dict[str, str] = {}
    rules = load_root_rules(root)
    for path in walk_files(root, rules):
        relative_path = path.relative_to(root).as_posix()
        state[relative_path] = read_text_file(path)
    return state


def find_tracked_files(root: Path) -> set[Path]:
    rules = load_root_rules(root)
    return set(walk_files(root, rules))


def walk_files(root: Path, rules: list[IgnoreRule], current_dir: Path | None = None) -> Iterable[Path]:
    current_dir = root if current_dir is None else current_dir
    entries = sorted(current_dir.iterdir(), key=lambda item: item.name.lower())
    local_rules = rules + load_gitignore_rules(current_dir, root)

    for entry in entries:
        if entry.name == ".keepsafe":
            continue

        relative_path = entry.relative_to(root)
        if should_ignore(root, relative_path, entry.is_dir(), local_rules):
            continue

        if entry.is_dir():
            yield from walk_files(root, local_rules, entry)
            continue

        if is_text_file(entry):
            yield entry


def load_root_rules(root: Path) -> list[IgnoreRule]:
    return load_gitignore_rules(root, root)


@lru_cache(maxsize=None)
def load_gitignore_rules(directory: Path, root: Path) -> list[IgnoreRule]:
    gitignore_path = directory / ".gitignore"
    if not gitignore_path.exists():
        return []

    rules: list[IgnoreRule] = []
    for raw_line in read_text_file(gitignore_path).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("\\#") or line.startswith("\\!"):
            line = line[1:]

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
                original=raw_line,
            )
        )
    return rules


def should_ignore(root: Path, relative_path: Path, is_dir: bool, rules: list[IgnoreRule]) -> bool:
    candidate = root / relative_path
    ignored = False
    for rule in rules:
        if rule.matches(candidate, is_dir):
            ignored = not rule.negated
    if is_dir and relative_path.name in DEFAULT_IGNORED_DIRS:
        return True
    return ignored


def is_text_file(path: Path) -> bool:
    try:
        data = path.read_bytes()
    except OSError:
        return False
    if b"\x00" in data:
        return False
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def read_text_file(path: Path) -> str:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return handle.read()


def write_text_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write(content)


def write_json_file(path: Path, payload: dict) -> None:
    write_text_file(path, json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n")


def read_json_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return json.load(handle)
