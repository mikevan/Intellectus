# Reproducing P3 on Windows

Follow the [shared Colibri setup](../../ProjectDocumentation/colibri-setup.md) and [PowerShell startup instructions](../../standards/Colibri-Setup.md) before running the live arm. Use the [Run 01 provenance](run-01-provenance.json) to match the checkpoint and runtime fingerprints.

Keep the P3 request settings fixed for comparisons. The runner sends one request per case at temperature 0 with a 512-token response limit and a 240-second timeout. Preserve the runner manifest and review withdrawal explanations against the rubric.

## Preflight and trial

Run the deterministic preflight before inference:

~~~powershell
python -B site/ArchitectureRepository/research/P3/preflight.py
~~~

Freeze the run inputs and provenance according to Protocol.md before the formal trial. Use a fresh output file. The runner refuses to overwrite existing evidence and records withdrawals for review of their justification.

~~~powershell
python -B site/ArchitectureRepository/research/P3/run.py --model intellectus-qwen36 --runtime-version 2.1.0 --output site/ArchitectureRepository/research/P3/run-01.jsonl
~~~
