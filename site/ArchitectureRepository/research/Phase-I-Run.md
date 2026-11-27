# Run Phase I live committee trials

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

Build Understanding and confirm Colibri advertises the intended model. The recorded alias was intellectus-qwen36. The exact Phase I checkpoint byte identity and launch settings remain unconfirmed. A new run with the current setup is a reproduction attempt. Use fresh output filenames and retain failed outputs. Budget **roughly 3–8 minutes for one variant** on a comparable host. The concise historical run recorded about 130 seconds of cumulative inference.

~~~sh
node Understanding/research/knowledge/live-committee.mjs . intellectus-qwen36 phase-i-committee-replay.json
node Understanding/research/knowledge/live-deliberation.mjs . intellectus-qwen36 phase-i-deliberation-replay.json
node Understanding/research/knowledge/live-typed-deliberation.mjs . intellectus-qwen36 phase-i-typed-replay.json
node Understanding/research/knowledge/live-concise-deliberation.mjs . intellectus-qwen36 phase-i-concise-replay.json
~~~

Choose the variant that corresponds to the recorded run. Compare typed response status, verified claims, counterexamples, and revisions with the [Phase I findings](Phase-I-Live-Deliberation-Findings.md). Operational qualification and model correction are distinct outcomes.
