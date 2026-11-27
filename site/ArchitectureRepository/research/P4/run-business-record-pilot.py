"""Collect the four-case P4 business-record and source-quote pilot."""
import hashlib
import json
import time
from pathlib import Path

from run import BASE, MAX_TOKENS, ROOT, TIMEOUT, request

MODEL = "intellectus-qwen36"
CASES = (("C04", True), ("C02", True), ("C12", True), ("C07", False))
PROMPT = """Explain the computation's business meaning only when the supplied evidence supports it.
Return one JSON object and no extra text. The business record is the real-world item or record to which the rule applies. Name that record using the source wording or a close paraphrase.
For a supported claim, return action "claim", business_record, result_meaning, output_unit, applies_when, evidence (the supporting document IDs), and record_evidence (an object with document_id and quote). Copy the quote verbatim from the cited document. It must identify the business record. State the result and when it applies in their own fields.
If there is insufficient or contradictory evidence, return action "abstain", reason, and evidence. If a proposed rule contradicts an observation, identify the observed input and output that contradict it. Use only supplied evidence."""
OUTPUT = ROOT / "business-record-pilot-01.jsonl"


def main():
    fixtures = ROOT / "fixtures.json"
    case_by_id = {case["id"]: case for case in json.loads(fixtures.read_text(encoding="utf-8"))}
    if MODEL not in {item["id"] for item in request("models")["data"]}:
        raise SystemExit(f"{MODEL} is unavailable at {BASE}")
    sources = (fixtures, ROOT / "oracle.json", ROOT / "run.py", Path(__file__))
    with OUTPUT.open("x", encoding="utf-8") as evidence:
        def record(value):
            evidence.write(json.dumps(value) + "\n")
            evidence.flush()

        record({"manifest": {
            "pilot": True, "cases": CASES, "model": MODEL, "endpoint": BASE,
            "prompt": PROMPT, "temperature": 0, "max_tokens": MAX_TOKENS,
            "timeout_seconds": TIMEOUT,
            "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
        }})
        for case_id, with_context in CASES:
            case = case_by_id[case_id]
            packet = {"code": case["code"], "observations": case["observed"]}
            if with_context:
                packet["documents"] = case["documents"]
            start = time.monotonic()
            try:
                response = request("chat/completions", {
                    "model": MODEL, "temperature": 0, "max_tokens": MAX_TOKENS,
                    "stream": False, "messages": [{"role": "system", "content": PROMPT},
                        {"role": "user", "content": json.dumps(packet)}],
                }, timeout=TIMEOUT)
            except (OSError, ValueError) as error:
                response = {"error": str(error)}
            record({"case": case_id, "with_context": with_context, "packet": packet,
                    "response": response, "elapsed_seconds": time.monotonic() - start})
            print(f"Recorded {case_id}", flush=True)


if __name__ == "__main__":
    main()
