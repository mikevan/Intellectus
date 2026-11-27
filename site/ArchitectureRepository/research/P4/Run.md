# Run the P4 context pilots

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

Match the recorded Colibri configuration. From the P4 directory, run the dry run first. It should take **under 10 seconds** and report 12 cases, 60 behavioral checks, and 24 planned requests. The recorded pilots took about **13 minutes for Pilot 01** and **27 minutes for Pilot 02**. Use a fresh output file for whichever variant you want to repeat.

~~~sh
cd site/ArchitectureRepository/research/P4
python -B run.py
python -B run.py --pilot --provenance ../P3/run-01-provenance.json --model intellectus-qwen36 --output pilot-replay-01.jsonl
python -B -c 'import json,run; run.PROMPT=json.loads(open("pilot-02.jsonl",encoding="utf-8").readline())["manifest"]["prompt"]; run.main()' --pilot --provenance ../P3/run-01-provenance.json --model intellectus-qwen36 --output pilot-replay-02.jsonl
~~~

Pilot 02 reloads the exact prompt from its preserved manifest. Score with the [rubric](Scoring-Rubric.md) and report supported claims, abstentions, and unsupported claims separately. Compare with [Pilot 01](Pilot-01-Findings.md) and [Pilot 02](Pilot-02-Findings.md). A formal run additionally requires approved independent review of the exact artifact hashes. The two pilots do not establish formal qualification.
