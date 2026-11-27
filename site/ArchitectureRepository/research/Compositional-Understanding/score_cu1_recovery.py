"""Score CU-1 predictions against sealed observations."""
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent / "CU-1-Run-01"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def canonical(prediction):
    a, b, op, c, d = prediction
    if op not in ("eq", "ne") or a == c:
        raise ValueError("Prediction requires distinct steps and eq or ne")
    return op, tuple(sorted(((a, b), (c, d))))


def supported_prediction(prediction, run):
    op, ((left, field), (right, target)) = prediction
    same = run["steps"][left][field] == run["steps"][right][target]
    return same == (op == "eq")


def assess(scope, predictions, visible, heldout):
    if not scope or not scope <= {"X", "Y"} or len(predictions) < 2:
        return "unsupported"
    observed = [(mode, run) for mode, run in visible + heldout if mode in scope]
    hidden = [(mode, run) for mode, run in heldout if mode in scope]
    if len(observed) < 2 or not hidden:
        return "unsupported"
    try:
        matches = [supported_prediction(prediction, run)
                   for _, run in observed for prediction in predictions]
    except KeyError:
        return "unsupported"
    return "verified" if all(matches) else "contradicted"


def baseline_predictions(raw, key):
    return {canonical([a, b, "eq", c, d]) for kind, a, b, c, d in
            (item for item in raw[key] if item[0] == "equality")}


def implied(prediction, known):
    op, (left, right) = prediction
    if op != "eq":
        return False
    reached = {left}
    while True:
        expanded = reached | {endpoint for _, pair in known if reached.intersection(pair)
                              for endpoint in pair}
        if expanded == reached:
            return right in reached
        reached = expanded


def supported_in_scope(prediction, scope, observations):
    try:
        return all(supported_prediction(prediction, run)
                   for mode, run in observations if mode in scope)
    except KeyError:
        return False


def score_repeat(folder):
    baseline = read(folder / "Baseline.json")
    packet = json.loads(read(folder / "Request.json")["messages"][1]["content"])
    visible = [(run["condition"], run) for run in packet["observations"]]
    checked = read(folder / "HeldoutChecks.json")
    heldout = [(mode, run) for mode, run, _ in checked]
    oracle_pass = all(all(checks.values()) for _, _, checks in checked)
    known_all = baseline_predictions(baseline, "all")
    known_x = known_all | baseline_predictions(baseline, "X")
    baseline_groups = [(frozenset(("X", "Y")), known_all), (frozenset(("X",)), known_x)]
    baseline_verified = {
        (tuple(sorted(scope)), prediction)
        for scope, predictions in baseline_groups
        for prediction in predictions
        if assess(scope, {prediction, *(
            other for other in predictions
            if other != prediction and other[1][1] != prediction[1][1]
            and supported_in_scope(other, scope, visible + heldout)
        )}, visible, heldout) == "verified"
    } if oracle_pass else set()
    response = read(folder / "Response.json")
    parsed = False
    model_verified = set()
    novel = set()
    counts = Counter()
    try:
        claims = json.loads(response["text"])["claims"]
        if not isinstance(claims, list) or len(claims) > 3:
            raise ValueError("Expected up to three claims")
        parsed = True
        for claim in claims:
            try:
                scope = frozenset(claim["scope"])
                raw = claim["predictions"]
                predictions = {canonical(item) for item in raw}
                targets = {(item[3], item[4]) for item in raw}
                ids = {run["id"] for mode, run in visible if mode in scope}
                valid = (len(targets) >= 2 and claim["evidence"]
                         and set(claim["evidence"]) <= ids
                         and claim["description"] and claim["falsifier"])
                status = (assess(scope, predictions, visible, heldout)
                          if valid and oracle_pass else "unsupported")
            except (KeyError, ValueError, TypeError):
                status = "unsupported"
            counts[status] += 1
            if status == "verified":
                key = tuple(sorted(scope)), tuple(sorted(predictions))
                model_verified.add(key)
                known = known_x if scope == {"X"} else known_all
                if any(not implied(prediction, known) for prediction in predictions):
                    novel.add(key)
    except (ValueError, KeyError, TypeError):
        pass
    return baseline_verified, model_verified, novel, {
        "oracle_pass": oracle_pass, "baseline_verified_predicates": len(baseline_verified),
        "baseline_omission_candidates": sum(item[0] == "omission-effect" for item in baseline["all"]),
        "model_claims": dict(counts), "structured_output": parsed,
        "finish_reason": response["finish_reason"], "done": response["done"],
        "usage": response["usage"], "inference_seconds": response["seconds"],
        "acquisition_seconds": sum(read(path)["seconds"] for partition in ("Visible", "Withheld")
                                   for path in (folder / partition).glob("*.json")),
        "error": response.get("error"),
    }


def repeated(sets):
    return sum(count >= 2 for count in Counter(key for keys in sets for key in keys).values())


if __name__ == "__main__":
    summary = {}
    for subject in ("KeepSafe", "MVS"):
        results = [score_repeat(HERE / subject / str(number)) for number in (1, 2, 3)]
        baseline, model, novel, details = zip(*results)
        summary[subject] = {
            "H1_deterministic": bool(repeated(baseline)),
            "H1_AI": bool(repeated(model)),
            "H2_incremental_AI": bool(repeated(novel)),
            "repeats": details,
        }
    with (HERE / "Scores.json").open("x", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)
    print(json.dumps(summary, indent=2))


