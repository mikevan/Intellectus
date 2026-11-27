"""Render the completed CU-1 score record as a research report."""
import json
from pathlib import Path

RUN = Path(__file__).resolve().parent / "CU-1-Run-01"
scores = json.loads((RUN / "Scores.json").read_text(encoding="utf-8"))
lines = [
    "# CU-1 initial condition", "",
    "The experiment tested whether relationships spanning computational activities "
    "could predict outcomes across fresh workflows (H1), and whether Colibri added "
    "a verified relationship beyond the deterministic baseline (H2). KeepSafe and "
    "MVS were investigated independently using three repeats each.", "",
    "## Results", "",
    "| Subject | H1 deterministic | H1 Colibri | H2 incremental Colibri |",
    "| --- | --- | --- | --- |",
]

def outcome(value):
    return "Met" if value else "Not met"

for subject, result in scores.items():
    results = [outcome(result[key]) for key in ("H1_deterministic", "H1_AI", "H2_incremental_AI")]
    lines.append(f"| {subject} | {' | '.join(results)} |")

lines += ["", "## Repeat-level evidence", "",
          "| Subject / repeat | Oracle | Verified baseline predicates | Omission candidates | "
          "Colibri claims (V/U/C) | Structured output | Finish | Inference (s) | Tokens |",
          "| --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: |"]
for subject, result in scores.items():
    for number, item in enumerate(result["repeats"], 1):
        claims = "/".join(str(item["model_claims"].get(key, 0))
                          for key in ("verified", "unsupported", "contradicted"))
        usage = (item["usage"] or {}).get("total_tokens", "unavailable")
        lines.append(f"| [{subject} {number}]({subject}/{number}/) | "
                     f"{outcome(item['oracle_pass'])} | {item['baseline_verified_predicates']} | "
                     f"{item['baseline_omission_candidates']} | {claims} | "
                     f"{outcome(item['structured_output'])} | {item['finish_reason']} | "
                     f"{item['inference_seconds']:.1f} | {usage} |")

lines += ["", "V = verified, U = unsupported, C = contradicted. Baseline counts are "
          "predicate counts, which include equivalent observations at different activity "
          "boundaries. Omission effects are candidates. They are reported separately.", "",
          "## Scientific conclusions", ""]
for subject, result in scores.items():
    ok = all(item["oracle_pass"] for item in result["repeats"])
    baseline = result["H1_deterministic"]
    ai = result["H1_AI"]
    lines.append(f"- **{subject}.** The deterministic threshold was {outcome(baseline).lower()}. "
                 f"The Colibri H1 threshold was {outcome(ai).lower()}. "
                 f"All oracle checks passed across repeats: {ok}.")
h1 = [subject for subject, result in scores.items() if result["H1_deterministic"] or result["H1_AI"]]
h2 = [subject for subject, result in scores.items() if result["H2_incremental_AI"]]
lines += [
    f"- **Compositional relationships (H1).** Subjects meeting the acceptance criterion: "
    f"{', '.join(h1) or 'none'}.",
    f"- **Incremental Colibri contribution (H2).** Subjects meeting the acceptance criterion: "
    f"{', '.join(h2) or 'none'}.",
    "", "## Scope and limitations", "",
    "The checked workflow variations bound the conclusions. Exact equality and inequality "
    "predicates sample a narrow class of compositional claims. The baseline uses aligned "
    "observations and matched omissions. The Colibri arm uses a compact structured response "
    "protocol and exact normalized repeat matching. Variation in how a prediction is encoded "
    "can therefore affect repeat matching. Scope and novelty are evaluated on the available "
    "observable obligations. The experiment did not qualify end-to-end emergent capabilities "
    "or inferred purpose. Model identity is the serving alias recorded by the freeze.",
    "", "See the [freeze manifest](Freeze.json) and [complete scores](Scores.json). The "
    "repeat directories contain acquisition records, visible discovery requests, raw SSE "
    "streams, assembled responses and held-out checks.",
]
(RUN / "Findings.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

