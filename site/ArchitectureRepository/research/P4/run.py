"""Prepare or collect the paired P4 responses."""
import argparse
import hashlib
import json
import random
import time
from pathlib import Path
from urllib.request import Request, urlopen
import os

from preflight import main as preflight

ROOT = Path(__file__).parent
BASE = "http://127.0.0.1:8000/v1/"
PROMPT = """Explain the computation's domain meaning only when the evidence supports it.
Reply with one JSON object and no extra text.
If supported, reply with action "claim" and fields entity, unit, meaning,
applicability, and evidence (a list of document IDs).
Otherwise reply with action "abstain" and fields reason and evidence.
If documents conflict or contradict observations, identify the conflict or give the observed witness.
Use only the supplied materials."""
SEED = 404
MAX_TOKENS = 512
TIMEOUT = 240


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def packets(cases):
    orders = []
    for context, seed in ((False, SEED), (True, SEED + 1)):
        order = cases.copy()
        random.Random(seed).shuffle(order)
        orders.extend((case, context) for case in order)
    for case, context in orders:
        packet = {"code": case["code"], "observations": case["observed"]}
        if context:
            packet["documents"] = case["documents"]
        yield {"case": case["id"], "with_context": context, "packet": packet}


def request(path, payload=None, timeout=5):
    key = os.environ.get("COLI_API_KEY")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    body = None if payload is None else json.dumps(payload).encode()
    with urlopen(Request(BASE + path, data=body, headers=headers), timeout=timeout) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pilot", action="store_true")
    parser.add_argument("--review", type=Path)
    parser.add_argument("--provenance", type=Path)
    parser.add_argument("--model")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    preflight()
    cases = json.loads((ROOT / "fixtures.json").read_text(encoding="utf-8"))
    plan = list(packets(cases))
    if not args.output:
        print(f"Prepared {len(plan)} model requests. No inference performed.")
        return
    if not (args.provenance and args.model and (args.pilot or args.review)):
        parser.error("Live mode requires provenance, model, and either --review or --pilot.")
    if args.pilot and args.review:
        parser.error("Select either a pilot or a reviewed run.")
    names = ("fixtures.json", "oracle.json", "Protocol.md", "Scoring-Rubric.md", "preflight.py", "run.py")
    hashes = {name: digest(ROOT / name) for name in names}
    review = None
    if args.review:
        review = json.loads(args.review.read_text(encoding="utf-8"))
        if (review.get("approved") is not True or not review.get("reviewer")
                or review.get("sha256") != hashes):
            parser.error("Independent review must approve these exact artifact hashes.")
    provenance = json.loads(args.provenance.read_text(encoding="utf-8"))
    if provenance.get("modelId") != args.model:
        parser.error("The provenance model ID differs from the requested model.")
    if args.model not in {entry["id"] for entry in request("models")["data"]}:
        parser.error("The requested model is not listed by Colibri.")
    with args.output.open("x", encoding="utf-8") as evidence:
        def record(item):
            evidence.write(json.dumps(item) + "\n")
            evidence.flush()

        record({"manifest": {"sha256": hashes, "pilot": args.pilot, "review": review, "provenance": provenance,
                             "model": args.model, "prompt": PROMPT, "order": [
                                 [item["case"], item["with_context"]] for item in plan],
                             "temperature": 0, "max_tokens": MAX_TOKENS,
                             "timeout_seconds": TIMEOUT}})
        print(f"Starting {len(plan)} model requests (pilot={args.pilot})", flush=True)
        for item in plan:
            started = time.monotonic()
            try:
                response = request("chat/completions", {
                    "model": args.model, "temperature": 0, "max_tokens": MAX_TOKENS,
                    "stream": False, "messages": [{"role": "system", "content": PROMPT},
                        {"role": "user", "content": json.dumps(item["packet"])}],
                }, timeout=TIMEOUT)
            except (OSError, ValueError) as error:
                response = {"error": str(error)}
            record({**item, "response": response, "elapsed_seconds": time.monotonic() - started})
            print(f"Recorded {item['case']} (context={item['with_context']})", flush=True)


if __name__ == "__main__":
    main()
