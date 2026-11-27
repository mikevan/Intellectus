# Set up Colibri for local inference on Windows

Colibri is used for live AI experiments, including Phase I, P3, and P4. P1/P2 and the deterministic preflight checks run without it.

## Install the runtime and model

For the recorded P3 and P4 setup, use the Windows x86-64 archive from [Colibri v2.1.0](https://github.com/JustVugg/colibri/releases/tag/v2.1.0). Verify the archive using the release checksums and extract it so that coli.cmd is available. Obtain the Qwen3.6-35B-A3B checkpoint from the repository named in the run provenance. Match the recorded file hashes before comparing results. See the [checkpoint and runtime provenance](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3/run-01-provenance.json) for the P3/P4 reference.

## Model and server settings

The recorded checkpoint was Qwen3.6-35B-A3B from Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64. The API model ID was intellectus-qwen36. An API model ID is a label. Use checkpoint hashes to identify the actual weights.

Run coli.cmd from the extracted runtime with the serve subcommand, the path to the model directory, host 127.0.0.1, port 8000, and the model ID required by the experiment. Use the [PowerShell commands](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/standards/Colibri-Setup.md) for startup and readiness checks.

## Check readiness and record provenance

Leave the server running and query the local models endpoint at http://127.0.0.1:8000/v1/models. Confirm that it advertises the expected model ID. A refused connection means the listener is unavailable. Check the server console for initialization or startup errors. If authentication is configured, use the local key without writing it to evidence or logs.

Record the runtime build, checkpoint revision or hashes, Python version, startup arguments, backend, context length, quantization, and effective cache and tuning settings. For timing comparisons, record the host CPU, GPU, and RAM. See the [Developer Guide](developer-guide.md) for the experiment commands and scoring instructions.
