"""Compare probe selection and collect two controlled hypothesis-revision responses."""
import hashlib
import json
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent
ORIGINAL = HERE.parent
sys.path.insert(0, str(ORIGINAL))
import qualify

CONDITIONS = (
    ("concise", 1536,
     "Return only JSON with disposition, rule_for_A, rule_for_B, distinguishing_evidence, "
     "and unresolved. Use at most 220 words. Cite case IDs rather than copying observations."),
    ("larger-budget", 3072, "Use the output format specified by the frozen skill."),
)
HYPOTHESIS = (
    "If InputPresence is 'None', OutputTemplate is 'Hello, ' and NamePlaceholder is 'World!'. "
    "If InputPresence is 'Present', OutputTemplate is 'Hello, ' and NamePlaceholder is the "
    "input argument followed by '!'."
)
QUESTION = "What happens with empty string input?"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(name, value):
    with (HERE / name).open("x", encoding="utf-8") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


def hash_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def deterministic_candidates():
    yield ()
    yield ("",)
    yield (" ",)
    yield ("a",)


def compare_selection(initial, baseline, verified):
    text = initial["response"]
    if HYPOTHESIS not in text or QUESTION not in text:
        raise ValueError("Recorded hypothesis and probe did not match preserved response")
    first_question = text.split('"open_questions"', 1)[1].split('"question": "', 1)[1].split('"', 1)[0]
    if first_question != QUESTION:
        raise ValueError("Recorded probe is not the first explicit unresolved input")
    seen = {tuple(row["arguments"]) for row in baseline["discovery"]["observations"]}
    deterministic = next(args for args in deterministic_candidates() if args not in seen)
    outcomes = {tuple(row["arguments"]): row["results"] for row in verified["withheld"]}
    result = {}
    for name, selected in (("colibri", ("",)), ("boundary_generator", deterministic)):
        output = outcomes[selected]
        result[name] = {"selected": selected, "budget": 1, "outcomes": output,
                        "discriminates": output["A"] != output["B"]}
    return result


def collect(name, payload):
    started = time.monotonic()
    result = {"condition": name, "request": payload, "completed_stream": False,
              "finish_reason": None, "usage": None}
    fragments = []
    try:
        with qualify.request("chat/completions", payload) as response:
            for line in response:
                if not line.startswith(b"data:"):
                    continue
                value = line[5:].strip()
                if value == b"[DONE]":
                    result["completed_stream"] = True
                    break
                event = json.loads(value)
                if event.get("error"):
                    raise ValueError(event["error"])
                result["usage"] = event.get("usage") or result["usage"]
                result["response_model"] = event.get("model", result.get("response_model"))
                for choice in event.get("choices", []):
                    result["finish_reason"] = choice.get("finish_reason") or result["finish_reason"]
                    if content := choice.get("delta", {}).get("content"):
                        fragments.append(content)
    except (OSError, ValueError) as error:
        result["error"] = str(error)
    finally:
        result["response"] = "".join(fragments)
        result["elapsed_seconds"] = time.monotonic() - started
        try:
            result["json_object"] = isinstance(json.loads(result["response"]), dict)
        except ValueError:
            result["json_object"] = False
        save(name + ".json", result)
    print(f"{name}: {result['finish_reason']}, {result['elapsed_seconds']:.1f}s", flush=True)


def main():
    baseline = load(ORIGINAL / "baseline.json")
    initial = load(ORIGINAL / "replicate-01.json")
    skill_file = ORIGINAL / "Frozen-Skill.md"
    if hash_file(skill_file) != baseline["manifest"]["sha256"]["Frozen-Skill.md"]:
        raise ValueError("Frozen skill hash changed")
    verified = qualify.probe()
    if verified["withheld"] != baseline["withheld"]:
        raise ValueError("Withheld observations changed")
    selection = compare_selection(initial, baseline, verified)
    packet = {
        "scope": baseline["discovery"]["scope"],
        "prior_hypothesis": HYPOTHESIS,
        "prior_question": QUESTION,
        "observations": [
            {"id": f"D{i}", **row} for i, row in enumerate(verified["discovery"], 1)
        ] + [
            {"id": f"W{i}", **row} for i, row in enumerate(verified["withheld"], 1)
        ],
        "task": ("Reassess the prior hypothesis. Explain both subjects and distinguish their behavior "
                 "where the evidence warrants it. State the scope of your revised relationship, "
                 "cite the observations that changed it, and leave untested behavior unresolved."),
    }
    system = skill_file.read_text(encoding="utf-8").split("---", 2)[2].strip()
    requests = {
        name: {"model": qualify.MODEL, "temperature": 0, "stream": True,
               "stream_options": {"include_usage": True}, "max_tokens": tokens,
               "messages": [{"role": "system", "content": system + "\n\n" + format_note},
                            {"role": "user", "content": json.dumps(packet)}]}
        for name, tokens, format_note in CONDITIONS
    }
    save("frozen-inputs.json", {"sha256": {str(path.relative_to(ORIGINAL)): hash_file(path) for path in
         (skill_file, ORIGINAL / "baseline.json", ORIGINAL / "oracle.json", ORIGINAL / "replicate-01.json",
          ORIGINAL / "Findings.md", HERE / "Protocol.md", Path(__file__))},
         "endpoint": qualify.BASE, "checkpoint_reference": baseline["manifest"]["checkpoint_reference"],
         "requests": requests, "selection": selection})
    print("Verified all 18 observations. One-probe selection comparison saved.", flush=True)
    with qualify.request("models") as response:
        if qualify.MODEL not in {model["id"] for model in json.load(response)["data"]}:
            raise ValueError("Expected model is unavailable")
    for name, payload in requests.items():
        collect(name, payload)


if __name__ == "__main__":
    main()
