import json
from itertools import product
from pathlib import Path

from fixtures import evaluate


GRID = tuple(product(range(5), repeat=2))
ORIGIN, X_UNIT, Y_UNIT = (0, 0), (1, 0), (0, 1)
CASES = (
    ("01", (7, 2, -2), X_UNIT, "repair"),
    ("02", (2, 1, 1), (4, 4), "withdraw"),
    ("03", (4, -2, 1), None, "retain"),
    ("04", (-3, 2, 3), Y_UNIT, "repair"),
    ("05", (6, 2, -1), (4, 0), "withdraw"),
    ("06", (-5, 0, 3), None, "retain"),
    ("07", (4, -2, 3), X_UNIT, "repair"),
    ("08", (-1, -1, 3), (0, 4), "withdraw"),
    ("09", (2, 4, -2), None, "retain"),
    ("10", (6, 4, 1), Y_UNIT, "repair"),
    ("11", (8, -2, 0), (3, 4), "withdraw"),
    ("12", (9, 0, 0), None, "retain"),
)


def predict(coefficients, point):
    intercept, x_coefficient, y_coefficient = coefficients
    x, y = point
    return intercept + x_coefficient*x + y_coefficient*y


def deterministic(seed, disclosed):
    intercept = disclosed[ORIGIN]
    fitted = (intercept, disclosed[X_UNIT] - intercept, disclosed[Y_UNIT] - intercept)
    if any(predict(fitted, point) != value for point, value in disclosed.items()):
        return "withdraw", None
    return ("retain" if fitted == seed else "repair"), fitted


def require(condition, case, message):
    if not condition:
        raise ValueError(f"Case {case}: {message}")


def preflight():
    oracle = json.loads(Path(__file__).with_name("oracle.json").read_text(encoding="utf-8"))
    results = []
    for case, seed, counterexample, expected in CASES:
        observed = {point: evaluate(case, *point) for point in GRID}
        reference = {(x, y): oracle[case][x][y] for x, y in GRID}
        require(observed == reference, case, "fixture and oracle disagree")
        initial = {point: observed[point] for point in (ORIGIN, X_UNIT, Y_UNIT)
                   if point != counterexample}
        require(all(predict(seed, point) == value for point, value in initial.items()),
                case, "seed contradicts initial observations")
        disclosed = initial.copy()
        if counterexample is not None:
            value = observed[counterexample]
            require(predict(seed, counterexample) != value, case, "invalid counterexample")
            disclosed[counterexample] = value
        held_out = {point: value for point, value in reference.items() if point not in disclosed}
        require(bool(held_out), case, "no held-out inputs")
        action, candidate = deterministic(seed, disclosed)
        require(action == expected, case, "unexpected deterministic disposition")
        if candidate is not None:
            require(all(predict(candidate, point) == value for point, value in reference.items()),
                    case, "candidate disagrees with independent verification")
        results.append({"case": case, "deterministic": action, "held_out": len(held_out)})
    return results


if __name__ == "__main__":
    cases = preflight()
    print(json.dumps({"status": "preflight-pass", "oracle_checks": len(cases)*len(GRID),
                      "cases": cases}, indent=2))
