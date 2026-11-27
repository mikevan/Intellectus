# Run RT-1

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

RT-1 uses Python, Node 22, and built Understanding and Complexity modules. Estimate **under a minute** for the round trip and oracle checks after the builds. The optional benchmark takes longer and measures the current host.

~~~sh
node IntellectusRuntime/roundtrip/roundtrip.mjs . rt1-replay-01
~~~

Choose a fresh output directory. If Python is not available as python, set INTELLECTUS_PYTHON to its executable. Inspect results.json, the generated TypeScript, reconstructed Python, and negative control in the output. Expect 40,004 checks per implementation and the documented negative difference. See the [experiment report](RT-1-Experiment-Report.md).
