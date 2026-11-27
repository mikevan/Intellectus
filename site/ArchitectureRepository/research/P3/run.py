import argparse
import hashlib
import json
import os
import platform
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from preflight import CASES, GRID, ORIGIN, X_UNIT, Y_UNIT, evaluate, predict, preflight

BASE = "http://127.0.0.1:8000/v1/"
PROMPT = """Review a seeded integer affine claim a + bx + cy against the supplied evidence.
Return only JSON. Use {"action":"retain"} to keep it, or
{"action":"repair","coefficients":[a,b,c]} with integer coefficients.
To withdraw, use {"action":"withdraw","contradiction":{"point":[x,y],"predicted":0,"observed":1},"reason":"..."}.
Explain why the disclosed point falsifies the claim and whether the other observations fix the affine form.
The numbers in the example are placeholders. Use only the supplied evidence."""
TIMEOUT = 240
MAX_TOKENS = 512


def request(path, payload=None, timeout=5):
    headers = {"Content-Type": "application/json"}
    key = os.environ.get("COLI_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
    data = None if payload is None else json.dumps(payload).encode()
    with urlopen(Request(BASE + path, data=data, headers=headers), timeout=timeout) as response:
        return json.load(response)


def score(response, seed, counterexample, reference):
    action = response.get("action")
    if action == "withdraw":
        reason = response.get("reason")
        valid = counterexample is not None and response.get("contradiction") == counterexample
        return "withdrawal-review" if valid and isinstance(reason, str) and reason.strip() else "invalid"
    if action == "retain":
        candidate = seed
    elif action == "repair":
        candidate = response.get("coefficients")
        if not isinstance(candidate, list) or len(candidate) != 3 or any(type(n) is not int for n in candidate):
            return "invalid"
        if tuple(candidate) == seed:
            return "invalid"
    else:
        return "invalid"
    if any(predict(candidate, point) != value for point, value in reference.items()):
        return "contradicted"
    return action


def main():
    parser = argparse.ArgumentParser(description="Run the P3 Colibri trial.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--runtime-version", required=True)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    baseline = preflight()
    try:
        models = request("models")
    except (OSError, URLError) as error:
        parser.exit(1, f"Colibri unavailable at {BASE}: {error}\n")
    if args.model not in {entry["id"] for entry in models["data"]}:
        parser.exit(1, f"Model {args.model} is not available on Colibri.\n")

    directory = Path(__file__).parent
    manifest = {
        "model": args.model, "runtime_version": args.runtime_version,
        "python": platform.python_version(), "system_prompt": PROMPT,
        "temperature": 0, "max_tokens": MAX_TOKENS, "timeout_seconds": TIMEOUT,
        "sha256": {name: hashlib.sha256((directory / name).read_bytes()).hexdigest()
                   for name in ("Protocol.md", "fixtures.py", "oracle.json", "preflight.py", "run.py")},
        "deterministic_baseline": baseline,
    }
    oracle = json.loads((directory / "oracle.json").read_text(encoding="utf-8"))
    with args.output.open("x", encoding="utf-8") as evidence:
        def record(item):
            evidence.write(json.dumps(item) + "\n")
            evidence.flush()

        record({"manifest": manifest})
        for case, seed, point, expected in CASES:
            disclosed = [{"point": p, "value": evaluate(case, *p)}
                         for p in (ORIGIN, X_UNIT, Y_UNIT) if p != point]
            counterexample = None if point is None else {
                "point": list(point), "predicted": predict(seed, point),
                "observed": evaluate(case, *point),
            }
            packet = {"bounds": [[0, 4], [0, 4]], "seed": seed,
                      "observations": disclosed, "counterexample": counterexample}
            reference = {(x, y): oracle[case][x][y] for x, y in GRID}
            started = time.monotonic()
            raw = None
            try:
                raw = request("chat/completions", {
                    "model": args.model, "temperature": 0, "max_tokens": MAX_TOKENS,
                    "stream": False,
                    "messages": [{"role": "system", "content": PROMPT},
                                 {"role": "user", "content": json.dumps(packet)}],
                }, timeout=TIMEOUT)
                choice = raw["choices"][0]
                reply = json.loads(choice["message"]["content"])
                result = (score(reply, seed, counterexample, reference)
                          if isinstance(reply, dict) and choice.get("finish_reason") != "length"
                          else "invalid")
            except (OSError, URLError, ValueError, KeyError, TypeError, IndexError) as error:
                result = "invalid"
                raw = {"response": raw, "error": str(error)}
            record({"case": case, "expected": expected, "packet": packet,
                    "outcomes": oracle[case], "result": result, "raw": raw,
                    "elapsed_seconds": round(time.monotonic() - started, 3)})
            print(f"{case}: {result}", flush=True)


if __name__ == "__main__":
    main()
