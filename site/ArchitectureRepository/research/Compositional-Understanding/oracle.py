"""Check workflow obligations against acquisition records without importing an application."""
import base64
import json
import sys


def encoded(text):
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def evaluate(record, case):
    case_id, first, second, extra, mode = case
    steps = record["steps"]
    restore = steps["restore"]
    # KeepSafe restores tracked paths. In the omission case extra.txt was never tracked.
    succeeds = mode == "intact" or (mode == "omit" and record["subject"] == "KeepSafe")
    before = {"note.txt": encoded(second), "extra.txt": encoded(extra)}
    after = before if not succeeds else {
        "note.txt": encoded(first),
        "extra.txt": encoded(extra) if mode == "omit" else None,
    }
    history = record["history_before"]
    return {
        "case": record["case"] == case_id,
        "initial_bytes": steps["first"]["before"] == {
            "note.txt": encoded(first), "extra.txt": None},
        "history_count": len(set(history)) == (1 if mode == "omit" else 2),
        "history_preserved": history == record["history_after"],
        "comparison_observed": ("diff" in steps) == (mode != "omit"),
        "restore_status": (restore["exit"] == 0) == succeeds,
        "restore_input": restore["before"] == before,
        "restore_result": restore["after"] == after,
    }


if __name__ == "__main__":
    case = ("runner-smoke", "sample\n", "updated\n", "addition\n", "intact")
    checks = evaluate(json.load(sys.stdin), case)
    print(json.dumps(checks, indent=2))
    sys.exit(0 if all(checks.values()) else 1)

