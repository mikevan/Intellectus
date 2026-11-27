# Run the P1/P2 deterministic pilot

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

Use Python on PATH and Node 22. Estimate **under 10 seconds**. Use a fresh output filename.

~~~sh
node Understanding/research/knowledge/run-pilot.mjs p1-p2-replay-01.json
~~~

Expect pilot-pass and 60 verification cases. Four equivalent subjects share an identity, and the two controls stay distinct. The late-boundary control contradicts the initial candidate at (4, 1). Compare with the [P1/P2 findings](P1-P2-Pilot-Findings.md).
