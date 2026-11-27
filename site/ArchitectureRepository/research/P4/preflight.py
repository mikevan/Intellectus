import json
from pathlib import Path

ROOT = Path(__file__).parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def compute(form, x, y):
    match form:
        case "difference": return max(0, x - y)
        case "cap": return min(x, y)
        case "threshold": return int(x >= y)
        case "allocation": return x * y // 100
    raise ValueError(f"Unknown calculation: {form}")


def main():
    cases = json.loads((ROOT / "fixtures.json").read_text(encoding="utf-8"))
    oracle = json.loads((ROOT / "oracle.json").read_text(encoding="utf-8"))
    require(len(cases) == len(oracle) == 12, "Expected twelve cases")
    require({case["id"] for case in cases} == set(oracle), "Case IDs do not match oracle")
    behavior = {}
    outcomes = {}
    checks = 0
    for case in cases:
        case_id, form = case["id"], case["form"]
        shape = (case["code"], case["observed"], case["held_out"])
        require(behavior.setdefault(form, shape) == shape, f"{case_id}: behavior differs within form")
        observed, held_out = case["observed"], case["held_out"]
        require(bool(held_out) and not ({tuple(row[:2]) for row in observed}
                                       & {tuple(row[:2]) for row in held_out}),
                f"{case_id}: held-out input leaks into observations")
        for x, y, expected in observed + held_out:
            require(compute(form, x, y) == expected, f"{case_id}: bad evidence at {(x, y)}")
            checks += 1
        reference = oracle[case_id]
        require(reference["evidence"] == [doc["id"] for doc in case["documents"]],
                f"{case_id}: evidence IDs differ")
        outcomes.setdefault(form, []).append(reference["action"])
        if reference.get("kind") == "contradiction":
            require(reference["reason_or_witness"] in observed, f"{case_id}: missing witness")
    require(len(outcomes) == 4 and all(sorted(actions) == ["abstain", "claim", "claim"]
                                       for actions in outcomes.values()), "Wrong case balance")
    print(f"P4 preflight passed: {len(cases)} cases, {checks} behavioral checks")


if __name__ == "__main__":
    main()
