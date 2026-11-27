"""Acquire one CU-1 workflow in an isolated workspace."""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SOURCES = {
    "KeepSafe": ROOT / "keepsafe" / "src",
    "MVS": Path("C:/workspace/MVS/mvs/src"),
}
WRAPPER = """
import json, os, sys
from pathlib import Path
source = Path(os.environ["PYTHONPATH"])
trace = set()
def profile(frame, event, arg):
    if event != "call":
        return
    try:
        callee = Path(frame.f_code.co_filename).relative_to(source).as_posix()
    except ValueError:
        return
    caller = frame.f_back
    trace.add((caller.f_code.co_name, callee, frame.f_code.co_name, frame.f_code.co_firstlineno))
if os.environ["CU1_INSTRUMENT"] == "1":
    sys.setprofile(profile)
try:
    if sys.argv[1] == "KeepSafe":
        from keepsafe.cli import main
    else:
        from mvs.cli import main
    sys.argv = [sys.argv[1], *sys.argv[2:]]
    main()
finally:
    sys.setprofile(None)
    Path(os.environ["CU1_TRACE"]).write_text(json.dumps(sorted(trace)), encoding="utf-8")
"""


def state(work):
    return {
        name: base64.b64encode((work / name).read_bytes()).decode("ascii")
        if (work / name).is_file() else None
        for name in ("note.txt", "extra.txt")
    }


def acquire(subject, case, unknown, instrument=True):
    case_id, first, second, extra, mode = case
    keepsafe = subject == "KeepSafe"
    base = ROOT / ".git" / "cu1-research"
    with tempfile.TemporaryDirectory(prefix="acquire-", dir=base) as location:
        parent = Path(location)
        work = parent / "workspace"
        work.mkdir()
        trace = parent / "trace.json"
        env = dict(os.environ, PYTHONPATH=str(SOURCES[subject]),
                   MVS_HOME=str(parent / "mvs-home"), CU1_TRACE=str(trace),
                   PYTHONUTF8="1", CU1_INSTRUMENT=str(int(instrument)))
        observations = {}

        def run(step, *args):
            before = state(work)
            if keepsafe:
                args = ("--root", str(work), *args)
            result = subprocess.run(
                [sys.executable, "-B", "-c", WRAPPER, subject, *args],
                cwd=work, env=env, capture_output=True, encoding="utf-8", timeout=30,
            )
            observations[step] = {
                "args": args, "exit": result.returncode, "stdout": result.stdout,
                "stderr": result.stderr, "before": before, "after": state(work),
                "metadata_present": (work / (".keepsafe" if keepsafe else ".mvs")).is_dir(),
                "trace": json.loads(trace.read_text(encoding="utf-8")),
            }
            if result.returncode and step != "restore":
                raise RuntimeError(f"{subject} {step}: {result.stderr}")
            return result.stdout

        def listing(step):
            return [line.split("\t", 1)[0] for line in run(step, "list").splitlines()
                    if "\t" in line]

        if not keepsafe:
            run("init", "init")
            if not (work / ".mvs" / "HEAD").is_file():
                raise RuntimeError("MVS did not initialize in the fixture")
        create = ("checkpoint",) if keepsafe else ("create", "checkpoint")
        (work / "note.txt").write_bytes(first.encode("utf-8"))
        run("first", *create, "first")
        initial, = listing("first_list")
        (work / "note.txt").write_bytes(second.encode("utf-8"))
        (work / "extra.txt").write_bytes(extra.encode("utf-8"))
        if mode != "omit":
            run("second", *create, "second")
        before = listing("before_list")
        if mode != "omit":
            latest, = [identifier for identifier in before if identifier != initial]
            run("diff", "diff", initial, latest)
        run("restore", "restore", unknown if mode == "unknown" else initial)
        after = listing("after_list")
        return {"subject": subject, "case": case_id, "history_before": before,
                "history_after": after, "steps": observations}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("subject", choices=SOURCES)
    parser.add_argument("--qualify", action="store_true", required=True)
    args = parser.parse_args()
    print(json.dumps(acquire(args.subject,
                             ("runner-smoke", "sample\n", "updated\n", "addition\n", "intact"),
                             None), indent=2))


