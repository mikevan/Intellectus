# Run P3 deliberative correction

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

With Colibri running, match the [recorded checkpoint and runtime](run-01-provenance.json) and use the [protocol](Protocol.md) to verify the case set and scoring. Run from the P3 directory. Preflight usually takes **under 10 seconds**. The recorded live requests took about **5 minutes for Run 01** and **12 minutes for Run 02**. Allow more time on a slower host. Run only the variant you want and choose a fresh output filename.

~~~sh
cd site/ArchitectureRepository/research/P3
python -B preflight.py
python -B run.py --model intellectus-qwen36 --runtime-version 2.1.0 --output replay-01.jsonl
python -B -c 'import json,run; run.PROMPT=json.loads(open("run-02.jsonl",encoding="utf-8").readline())["manifest"]["system_prompt"]; run.main()' --model intellectus-qwen36 --runtime-version 2.1.0 --output replay-02.jsonl
~~~

Preflight should report 12 cases and 300 oracle checks. Run 02 reloads its exact system prompt from the preserved manifest. Score repairs against the oracle, review withdrawal explanations against the disclosed contradiction, and compare retentions and failures with [Run 01](Run-01-Findings.md) and [Run 02](Run-02-Findings.md).
