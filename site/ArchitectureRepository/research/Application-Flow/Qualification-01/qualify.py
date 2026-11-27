"""Run the frozen observation-only Hello World qualification."""
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import time
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RESEARCH = HERE.parent / "Ontology-Reconstruction"
SKILL = HERE / "Frozen-Skill.md"
SOURCE = ROOT / "HelloWorlds/python/helloworld/greet.py"
CONTROL = HERE / "control.py"
MODEL = "intellectus-qwen36"
BASE = "http://127.0.0.1:8000/v1/"
TOKEN_BUDGET = 1536


def save(name, value):
    with (HERE / name).open("x", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
        file.write("\n")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe():
    spec = json.loads((HERE / "oracle.json").read_text(encoding="utf-8"))
    subjects = [runpy.run_path(str(source))["hello"] for source in (SOURCE, CONTROL)]
    observed = {}
    for partition, cases in spec.items():
        observed[partition] = []
        for case in cases:
            actual = [test(*case["args"]) for test in subjects]
            if actual != case["expected"]:
                raise ValueError(f"Oracle mismatch on {partition}: {case['args']!r}")
            observed[partition].append({"arguments": case["args"],
                                       "results": dict(zip(("A", "B"), actual))})
    return observed


def request(endpoint, payload=None):
    headers = {"Content-Type": "application/json"}
    if key := os.environ.get("COLI_API_KEY"):
        headers["Authorization"] = "Bearer " + key
    return urlopen(Request(BASE + endpoint, headers=headers,
                          data=None if payload is None else json.dumps(payload).encode()),
                   timeout=600 if payload else 5)


def infer(packet, manifest, number):
    system = SKILL.read_text(encoding="utf-8").split("---", 2)[2].strip()
    payload = {"model": MODEL, "temperature": 0, "stream": True,
               "stream_options": {"include_usage": True}, "max_tokens": TOKEN_BUDGET,
               "messages": [{"role": "system", "content": system},
                            {"role": "user", "content": json.dumps(packet)}]}
    result = {"manifest": manifest, "request": payload, "chunks": 0,
              "finish_reason": None, "complete": False, "usage": None}
    started = time.monotonic()
    text = []
    target = HERE / f"replicate-{number:02d}.json"
    with target.open("x", encoding="utf-8") as file:
        try:
            with request("chat/completions", payload) as response:
                result["response_headers_seconds"] = time.monotonic() - started
                for line in response:
                    if not line.startswith(b"data:"):
                        continue
                    data = line[5:].strip()
                    if data == b"[DONE]":
                        result["complete"] = True
                        break
                    event = json.loads(data)
                    if event.get("error"):
                        raise ValueError(event["error"])
                    result["usage"] = event.get("usage") or result["usage"]
                    result["response_model"] = event.get("model", result.get("response_model"))
                    for choice in event.get("choices", []):
                        result["finish_reason"] = choice.get("finish_reason") or result["finish_reason"]
                        content = choice.get("delta", {}).get("content")
                        if isinstance(content, str) and content:
                            result["chunks"] += 1
                            text.append(content)
        except (OSError, ValueError) as error:
            result["error"] = str(error)
        finally:
            result["elapsed_seconds"] = time.monotonic() - started
            result["response"] = "".join(text)
            json.dump(result, file, indent=2)
            file.write("\n")
    print(f"Replicate {number}: {result['finish_reason']}, {result['elapsed_seconds']:.1f}s", flush=True)


def main():
    original = RESEARCH / "colibri-semantic-ontology/SKILL.md"
    if sha(SKILL) != sha(original):
        raise ValueError("Frozen skill differs from the approved version")
    observed = probe()
    print("Deterministic checks passed on 18 subject executions.", flush=True)
    if "--verify-only" in sys.argv:
        return
    with request("models") as models:
        if MODEL not in {item["id"] for item in json.load(models)["data"]}:
            raise ValueError("Expected Colibri model unavailable")
    packet = {"scope": "One optional text argument. Observe the returned text only.",
              "observations": observed["discovery"],
              "task": ("Investigate these observations using the supplied methodology. "
                       "Record initial hypotheses, the scope of any prediction, "
                       "and observations that could distinguish competing explanations.")}
    manifest = {"sha256": {file.name: sha(file) for file in
                           (SKILL, SOURCE, CONTROL, HERE / "oracle.json",
                            HERE / "Protocol.md", Path(__file__))},
                "model": MODEL, "endpoint": BASE, "runtime": "Colibri v2.1.0",
                "sampling": {"temperature": 0, "max_tokens": TOKEN_BUDGET},
                "checkpoint_reference": "../../P3/run-01-provenance.json",
                "checkpoint_note": "Existing running checkpoint, with prior fingerprints referenced.",
                "python": sys.version.split()[0],
                "base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"],
                                                      cwd=ROOT, text=True).strip()}
    save("baseline.json", {"manifest": manifest, "discovery": packet,
                           "withheld": observed["withheld"],
                           "predictions": [], "oracle_agreement": 18})
    print("Frozen inputs saved. Starting two independent requests.", flush=True)
    for number in (1, 2):
        infer(packet, manifest, number)


if __name__ == "__main__":
    main()
