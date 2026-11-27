# CU-1 environment qualification

On 2026-11-27, a project-local virtual environment at `.git/cu1-research/venv` passed `pip check`. Installed versions were CPython 3.14.2, pip 25.3 and pathspec 0.12.1. Create the environment with `python -m venv <environment>` and install `pathspec==0.12.1` with that environment's Python. Confirm exact versions again when sealing the run.

Both source trees were imported through PYTHONPATH with bytecode writes disabled. Smoke fixtures contained only a synthetic probe file. MVS_HOME pointed to a separate disposable directory. KeepSafe checkpoint and list returned exit 0 and listed 0001-smoke. MVS init, create checkpoint and list returned exit 0 and listed r1 with the smoke label. Both preserved the probe bytes. All five commands returned empty stderr. These checks qualify the Python runtime, dependency import, entry points and basic synthetic workspace writes. Formal workflow behavior and inference are outside this smoke result.

## Baseline preparation check

The baseline was executed in the qualified runtime on three synthetic transition records. Two intact workflows used different values and recovered one equality between an upstream field and a downstream result. Removing the upstream step changed the downstream result and produced one omission-effect candidate. An unrelated constant generated no claim. Both expected predictions matched exactly. This check used no CU-1 observations.

## Acquisition and oracle smoke check

Both subjects completed the separate `runner-smoke` workflow on 2026-11-27. Each passed all eight executable oracle checks. KeepSafe's restoration trace executed `checkpointing.py` and `cli.py` and contained no calls from `core.py`. MVS's restoration trace included `core.py`, `cli.py`, `model.py` and `errors.py`. These traces establish reachability for the smoke path. The formal paths still require their own traces and an instrumentation parity check.

The local model catalog reported `intellectus-qwen36`. This was an availability check. No inference request was sent.
