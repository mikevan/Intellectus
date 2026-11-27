"""Verify frozen greeting hypotheses on fresh observations and the existing TS port."""
import hashlib
import json
from pathlib import Path
import runpy
import subprocess
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
ORIGINAL = HERE.parent
PYTHON = ROOT / "HelloWorlds/python/helloworld/greet.py"
CONTROL = ORIGINAL / "control.py"
TYPESCRIPT = ROOT / "HelloWorlds/react-vitest/src/greet.ts"
DRIVER = """import {readFileSync} from 'node:fs';
import {hello} from './HelloWorlds/react-vitest/src/greet.ts';
const cases = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(cases.map(args => hello(...args))));"""


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def predict(subject, args):
    name = "World" if not args or (subject == "A" and args[0] == "") else args[0]
    return f"Hello, {name}!"


def main():
    start = time.monotonic()
    freeze = read(HERE / "Frozen-Inputs.json")
    for relative, checksum in freeze["files"].items():
        if digest(ROOT / relative) != checksum:
            raise ValueError(f"Frozen artifact changed: {relative}")
    fresh = read(HERE / "Fresh-Inputs.json")
    old = read(ORIGINAL / "oracle.json")
    old_args = {tuple(row["args"]) for partition in old.values() for row in partition}
    if any(tuple(args) in old_args for args in fresh):
        raise ValueError("Fresh input was previously disclosed")
    controls = [[], [""]]
    cases = fresh + controls
    predictions = [{target: predict(target, args) for target in ("A", "B")} for args in cases]
    python = runpy.run_path(str(PYTHON))["hello"]
    control = runpy.run_path(str(CONTROL))["hello"]
    result = subprocess.run(["node", "--experimental-strip-types", "--input-type=module",
                             "-e", DRIVER], cwd=ROOT, input=json.dumps(cases), text=True,
                            encoding="utf-8", capture_output=True, check=True, timeout=15)
    third = json.loads(result.stdout)
    if len(third) != len(cases):
        raise ValueError("Third implementation returned an incorrect number of rows")
    observations = []
    for i, (args, claimed, ts) in enumerate(zip(cases, predictions, third)):
        observations.append({"partition": "fresh" if i < len(fresh) else "reused-control",
                             "arguments": args, "predicted": claimed,
                             "observed": {"A": python(*args), "B": control(*args), "C": ts}})
    metrics = {}
    for partition in ("fresh", "reused-control"):
        rows = [row for row in observations if row["partition"] == partition]
        metrics[partition] = {
            f"{target}_vs_{hypothesis}": sum(row["observed"][target]
                                             == row["predicted"][hypothesis] for row in rows)
            for target, hypothesis in (("A", "A"), ("B", "B"), ("C", "A"), ("C", "B"))
        } | {"cases": len(rows)}
    with (HERE / "verification.json").open("x", encoding="utf-8") as file:
        json.dump({"metrics": metrics, "observations": observations,
                   "elapsed_seconds": time.monotonic() - start}, file, indent=2,
                  ensure_ascii=False)
        file.write("\n")
    print(json.dumps(metrics))


if __name__ == "__main__":
    main()
