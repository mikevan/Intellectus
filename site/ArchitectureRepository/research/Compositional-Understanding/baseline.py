"""Generate and test exact cross-activity predictions from visible transitions."""
import json
import sys
from itertools import combinations


def discover(workflows):
    """Use only visible workflows. Steps and observation fields are opaque IDs."""
    predictions = []
    for left, right in combinations(workflows[0]["order"], 2):
        eligible = [
            run["steps"] for run in workflows
            if left in run["steps"] and right in run["steps"]
            and run["order"].index(left) < run["order"].index(right)
        ]
        if len(eligible) < 2:
            continue
        for source_field in eligible[0][left]:
            for target_field in eligible[0][right]:
                if not all(source_field in steps[left] and target_field in steps[right]
                           for steps in eligible):
                    continue
                pairs = [(steps[left][source_field], steps[right][target_field])
                         for steps in eligible]
                # Require variation to exclude coincidences involving fixed values.
                if all(a == b for a, b in pairs) and any(a != pairs[0][0] for a, _ in pairs):
                    predictions.append(["equality", left, source_field, right, target_field])
    # A controlled omission is marked by the investigator when all other inputs match.
    for intervention in workflows:
        control_id = intervention.get("matched_control")
        if control_id is None:
            continue
        control = next(run for run in workflows if run["id"] == control_id)
        omitted = intervention["omitted"]
        if omitted in intervention["steps"] or omitted not in control["steps"]:
            raise ValueError("Invalid omission pair")
        for step in control["order"][control["order"].index(omitted) + 1:]:
            before = control["steps"][step]
            after = intervention["steps"].get(step, {})
            for field in before.keys() & after.keys():
                if before[field] != after[field]:
                    predictions.append(["omission-effect", omitted, step, field])
    return sorted({tuple(prediction) for prediction in predictions})


if __name__ == "__main__":
    print(json.dumps(discover(json.load(sys.stdin)), indent=2))

