"""Freeze and execute CU-1, retaining raw acquisition and SSE evidence."""
import base64
import hashlib
import importlib.metadata
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

from acquire import SOURCES, acquire
from baseline import discover
from oracle import evaluate

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent / "Application-Flow/Qualification-01/Frozen-Skill.md"
MODEL = "intellectus-qwen36"
CONFIG = {"model": MODEL, "temperature": 0, "max_tokens": 3072, "stream": True,
          "stream_options": {"include_usage": True}}
URL = "http://127.0.0.1:8000/v1/chat/completions"
STEPS = dict(zip(("init", "first", "first_list", "second", "before_list", "diff",
                  "restore", "after_list"), "ABCDEFGH"))
FIELDS = {"before_note": "p", "before_extra": "q", "after_note": "r",
          "after_extra": "s", "exit": "t", "metadata": "u", "history": "v"}
MODES = {"intact": "X", "omit": "Y", "unknown": "Z"}
PROMPT = """Use the frozen methodology to propose up to three relationships spanning
multiple activities. Focus on predictions within this subject. Steps and fields
are opaque identifiers. Justify scope and cite observed workflow IDs. Treat
purpose claims as exploratory. Return one compact JSON object with key claims.
Each claim has description, evidence (workflow IDs), falsifier, scope (a nonempty
list drawn from X and Y), and predictions (a list of [left_step, left_field,
operator, right_step, right_field] arrays). Operators are eq and ne. Use distinct
steps within each prediction, and include at least two distinct right-hand
observations per relationship. Select only fields that occur in every workflow
in the stated scope. Use evidence and report uncertainty. An empty claims list
is valid. Avoid markdown."""
RUN = HERE / "CU-1-Run-01"
PARITY_CASE = ("parity", "fixture start\n", "fixture end\n", "added\n", "intact")


def write(path, data):
    with path.open("x", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def files():
    own = ["acquire.py", "run_cu1.py", "baseline.py", "oracle.py", "score_cu1.py", "fixtures.json",
           "CU-1-Protocol.md", "Evaluator-Preparation.md"]
    yield from ((name, HERE / name) for name in own)
    yield "frozen-skill", SKILL
    for subject, path in SOURCES.items():
        yield from ((f"{subject}/{source.relative_to(path).as_posix()}", source)
                    for source in sorted(path.rglob("*.py")))


def digests():
    return {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files()}


def parity():
    def comparable(record):
        for step in record["steps"].values():
            step.pop("trace")
            step["args"] = ["<workspace>" if "acquire-" in arg else arg for arg in step["args"]]
            step["stdout"] = re.sub(r"[^\n]*acquire-[^\n]*", "<workspace>", step["stdout"])
            step["stdout"] = re.sub(r"\d{4}-\d{2}-\d{2}T[0-9:+Z-]+", "<time>", step["stdout"])
        return record

    return {subject: comparable(acquire(subject, PARITY_CASE, None)) ==
            comparable(acquire(subject, PARITY_CASE, None, instrument=False))
            for subject in SOURCES}


def freeze():
    checks = parity()
    print(f"Instrumentation parity: {checks}", flush=True)
    if not all(checks.values()):
        raise RuntimeError("Instrumentation changed a normalized observable")
    RUN.mkdir()
    write(RUN / "Freeze.json", {
        "sha256": digests(), "parity": checks, "python": sys.version,
        "pathspec": importlib.metadata.version("pathspec"), "sse": CONFIG,
        "prompt": PROMPT, "endpoint": URL,
        "source_commits": {"KeepSafe": "414fd785fb18f42c188c2ff90ccf8c3015b35263",
                           "MVS": "176e4d345bd20031abffa42477fc2c8852464547"},
        "model_identity": "Server-reported model alias. Current weights were not fingerprinted.",
    })


def aligned(record):
    values = {}
    for step, observation in record["steps"].items():
        flat = {}
        for boundary in ("before", "after"):
            for path, name in (("note.txt", "note"), ("extra.txt", "extra")):
                value = observation[boundary][path]
                flat[FIELDS[boundary + "_" + name]] = (
                    base64.b64decode(value).decode("utf-8") if value is not None else None)
        flat.update(t=observation["exit"], u=observation["metadata_present"])
        if step.endswith("list"):
            flat["v"] = [line.split("\t", 1)[0] for line in observation["stdout"].splitlines()
                         if "\t" in line]
        values[STEPS[step]] = flat
    return {"id": record["case"], "order": list(values), "steps": values}


def observe(subject, cases, unknown, folder):
    folder.mkdir(exist_ok=True)
    records = []
    for case in cases:
        started = time.monotonic()
        record = acquire(subject, case, unknown)
        record["seconds"] = time.monotonic() - started
        write(folder / f"{case[0]}.json", record)
        records.append((MODES[case[4]], aligned(record), evaluate(record, case)))
    return records


def infer(packet, folder):
    system = SKILL.read_text(encoding="utf-8").split("---", 2)[2].strip()
    request = {**CONFIG, "messages": [{"role": "system", "content": system},
                                    {"role": "user", "content": json.dumps(packet)}]}
    write(folder / "Request.json", request)
    headers = {"Content-Type": "application/json"}
    if key := os.environ.get("COLI_API_KEY"):
        headers["Authorization"] = "Bearer " + key
    outcome = {"text": "", "done": False, "finish_reason": None, "usage": None}
    started = time.monotonic()
    with (folder / "Raw.sse").open("xb") as raw:
        try:
            with urlopen(Request(URL, headers=headers, data=json.dumps(request).encode()),
                         timeout=600) as response:
                for line in response:
                    raw.write(line)
                    raw.flush()
                    if not line.startswith(b"data:"):
                        continue
                    data = line[5:].strip()
                    if data == b"[DONE]":
                        outcome["done"] = True
                        break
                    event = json.loads(data)
                    if event.get("error"):
                        raise ValueError(event["error"])
                    outcome["usage"] = event.get("usage") or outcome["usage"]
                    for choice in event.get("choices", []):
                        outcome["finish_reason"] = choice.get("finish_reason") or outcome["finish_reason"]
                        outcome["text"] += choice.get("delta", {}).get("content") or ""
        except (OSError, ValueError) as error:
            outcome["error"] = str(error)
    outcome["seconds"] = time.monotonic() - started
    write(folder / "Response.json", outcome)
    print(f"{folder.parent.name}/{folder.name}: {outcome['finish_reason']} "
          f"after {outcome['seconds']:.1f}s", flush=True)
    return outcome


def execute():
    frozen = json.loads((RUN / "Freeze.json").read_text(encoding="utf-8"))
    if frozen["sha256"] != digests() or frozen["sse"] != CONFIG or frozen["prompt"] != PROMPT:
        raise RuntimeError("Frozen material changed")
    fixtures = json.loads((HERE / "fixtures.json").read_text(encoding="utf-8"))
    for subject in SOURCES:
        for repeat in range(1, fixtures["repeats"] + 1):
            folder = RUN / subject / str(repeat)
            folder.mkdir(parents=True)
            visible = observe(subject, fixtures["visible"], fixtures["unknown"][subject],
                              folder / "Visible")
            workflows = [run for _, run, _ in visible]
            workflows[2].update(matched_control=workflows[0]["id"], omitted=STEPS["second"])
            baseline = {"all": discover(workflows), "X": discover(workflows[:2])}
            write(folder / "Baseline.json", baseline)
            packet = {"instructions": PROMPT, "fields": FIELDS,
                      "conditions": {"X": "full observed sequence",
                                     "Y": "same sequence with step D omitted"},
                      "observations": [{"condition": mode, **run} for mode, run, _ in visible]}
            infer(packet, folder)
    for subject in SOURCES:
        for repeat in range(1, fixtures["repeats"] + 1):
            folder = RUN / subject / str(repeat)
            heldout = observe(subject, fixtures["withheld"], fixtures["unknown"][subject],
                              folder / "Withheld")
            write(folder / "HeldoutChecks.json", heldout)
            print(f"{subject}/{repeat} held-out checks: "
                  f"{[all(checks.values()) for _, _, checks in heldout]}", flush=True)


if __name__ == "__main__":
    {"freeze": freeze, "run": execute}[sys.argv[1]]()


