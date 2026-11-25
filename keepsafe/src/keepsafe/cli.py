from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from .checkpointing import (
    add_gitignore_entry,
    compare_checkpoints,
    create_checkpoint,
    list_checkpoints,
    rebuild_keepsafe,
    restore_checkpoint,
)


def build_parser(prog: str = "keepsafe") -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog=prog, description="Local checkpoint versioning")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Workspace root to version. Defaults to the current directory.",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    checkpoint_parser = subparsers.add_parser("checkpoint", help="Create a new checkpoint")
    checkpoint_parser.add_argument("name", help="Checkpoint name")
    checkpoint_parser.set_defaults(handler=handle_checkpoint)

    quick_parser = subparsers.add_parser("quick", help="Create a quick checkpoint")
    quick_parser.set_defaults(handler=handle_quick)

    create_parser = subparsers.add_parser("create", help="Create a checkpoint")
    create_parser.add_argument("name", nargs="?", help="Checkpoint name")
    create_parser.set_defaults(handler=handle_create)

    list_parser = subparsers.add_parser("list", help="List created checkpoints")
    list_parser.set_defaults(handler=handle_list)

    restore_parser = subparsers.add_parser("restore", help="Restore a checkpoint")
    restore_parser.add_argument("checkpoint_id", nargs="?", help="Checkpoint id to restore, or 'last'")
    restore_parser.set_defaults(handler=handle_restore)

    diff_parser = subparsers.add_parser("diff", help="Compare two checkpoints")
    diff_parser.add_argument("left_checkpoint_id", nargs="?", help="Older checkpoint id")
    diff_parser.add_argument("right_checkpoint_id", nargs="?", help="Newer checkpoint id")
    diff_parser.set_defaults(handler=handle_diff)

    rebuild_parser = subparsers.add_parser("rebuild", help="Rebuild KeepSafe metadata to the current format")
    rebuild_parser.set_defaults(handler=handle_rebuild)

    ignore_parser = subparsers.add_parser("ignore", help="Manage .gitignore patterns")
    ignore_subparsers = ignore_parser.add_subparsers(dest="ignore_command", required=True)
    ignore_add_parser = ignore_subparsers.add_parser("add", help="Add a .gitignore pattern")
    ignore_add_parser.add_argument("pattern", nargs="?", help="Pattern to add (gitignore wildcard syntax)")
    ignore_add_parser.add_argument(
        "--directory",
        action="store_true",
        help="Treat the pattern as a directory and ensure it ends with '/'.",
    )
    ignore_add_parser.set_defaults(handler=handle_ignore_add)

    add_parser = subparsers.add_parser("add", help="Add workspace configuration")
    add_subparsers = add_parser.add_subparsers(dest="add_command", required=True)
    add_ignore_parser = add_subparsers.add_parser("ignore", help="Add a .gitignore pattern")
    add_ignore_parser.add_argument("pattern", nargs="?", help="Pattern to add (gitignore wildcard syntax)")
    add_ignore_parser.add_argument(
        "--directory",
        action="store_true",
        help="Treat the pattern as a directory and ensure it ends with '/'.",
    )
    add_ignore_parser.set_defaults(handler=handle_ignore_add)

    return parser


def main() -> None:
    parser = build_parser(Path(sys.argv[0]).stem or "keepsafe")
    args = parser.parse_args()

    root = args.root.resolve()
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.error("Unknown command")

    try:
        handler(root, args)
    except ValueError as error:
        parser.error(str(error))


def handle_checkpoint(root: Path, args: argparse.Namespace) -> None:
    result = create_checkpoint(root, args.name)
    print(result.summary)
    print(result.path)


def handle_quick(root: Path, args: argparse.Namespace) -> None:
    del args
    now = dt.datetime.utcnow().replace(microsecond=0)
    stamp = now.strftime("%Y%m%d-%H%M%S")
    result = create_checkpoint(root, f"quick-{stamp}")
    print(result.summary)
    print(result.path)


def handle_create(root: Path, args: argparse.Namespace) -> None:
    name = args.name or prompt_for_value("Checkpoint name: ", "Checkpoint name is required.")
    result = create_checkpoint(root, name)
    print(result.summary)
    print(result.path)


def handle_list(root: Path, args: argparse.Namespace) -> None:
    del args
    checkpoints = list_checkpoints(root)
    if not checkpoints:
        print("No checkpoints found.")
        return

    for checkpoint in checkpoints:
        print(f"{checkpoint.checkpoint_id}\t{checkpoint.name}\t{checkpoint.created_at}")


def handle_restore(root: Path, args: argparse.Namespace) -> None:
    checkpoints = list_checkpoints(root)
    if not checkpoints:
        print("No checkpoints found.")
        return

    checkpoint_id = args.checkpoint_id
    if checkpoint_id == "last":
        checkpoint_id = checkpoints[-1].checkpoint_id
    elif not checkpoint_id:
        checkpoint_id = prompt_for_checkpoint(checkpoints, "Select checkpoint to restore")

    restore_checkpoint(root, checkpoint_id)
    print(f"Restored checkpoint {checkpoint_id}")


def handle_diff(root: Path, args: argparse.Namespace) -> None:
    checkpoints = list_checkpoints(root)
    if not checkpoints:
        print("No checkpoints found.")
        return

    left_checkpoint_id = args.left_checkpoint_id
    right_checkpoint_id = args.right_checkpoint_id

    if not left_checkpoint_id:
        left_checkpoint_id = prompt_for_checkpoint(checkpoints, "Select older checkpoint")

    if not right_checkpoint_id:
        right_checkpoint_id = prompt_for_checkpoint(
            checkpoints,
            "Select newer checkpoint",
            excluded_ids={left_checkpoint_id},
        )

    print(compare_checkpoints(root, left_checkpoint_id, right_checkpoint_id), end="")


def handle_rebuild(root: Path, args: argparse.Namespace) -> None:
    del args
    print(rebuild_keepsafe(root))


def handle_ignore_add(root: Path, args: argparse.Namespace) -> None:
    pattern = args.pattern or prompt_for_value("Pattern to add: ", "Pattern is required.")
    message = add_gitignore_entry(root, pattern, directory=args.directory)
    print(message)


def prompt_for_value(prompt: str, error_message: str) -> str:
    try:
        value = input(prompt).strip()
    except EOFError as error:
        raise ValueError(error_message) from error

    if not value:
        raise ValueError(error_message)
    return value


def prompt_for_checkpoint(
    checkpoints: list[Checkpoint],
    prompt: str,
    excluded_ids: set[str] | None = None,
) -> str:
    excluded_ids = excluded_ids or set()
    available = [checkpoint for checkpoint in checkpoints if checkpoint.checkpoint_id not in excluded_ids]
    if not available:
        raise ValueError("No checkpoint choices available")

    print(prompt)
    for index, checkpoint in enumerate(available, start=1):
        print(f"{index}. {checkpoint.checkpoint_id}\t{checkpoint.name}\t{checkpoint.created_at}")

    while True:
        choice = prompt_for_value("Select checkpoint number or id: ", "A checkpoint selection is required.")
        if choice.isdigit():
            index = int(choice) - 1
            if 0 <= index < len(available):
                return available[index].checkpoint_id

        for checkpoint in available:
            if checkpoint.checkpoint_id == choice:
                return checkpoint.checkpoint_id

        print("Invalid selection.")
