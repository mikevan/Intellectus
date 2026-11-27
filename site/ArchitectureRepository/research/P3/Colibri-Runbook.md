# Starting Colibri for P3 on Windows

## Runtime and model

The existing Windows installation is Colibri v2.1.0. Its setup configuration is at %LOCALAPPDATA%\colibri\setup.json. The configured model is Qwen3.6-35B-A3B (qwen36-35b), from Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64. On this host, the configured weights are in C:\workspace\colibri\models\qwen36-35b. The P3 API model ID is intellectus-qwen36. It is an alias and does not identify checkpoint bytes.

The Phase I evidence records that alias. The exact Phase I launcher and checkpoint revision remain unconfirmed. For P3, record the installed runtime version and resolved checkpoint revision or weight manifest before collecting formal evidence.

## Start the server

Run in PowerShell from C:\workspace-Intellectus and leave the process running:

~~~powershell
$colibriRoot = Join-Path $env:LOCALAPPDATA 'colibri'
$settings = Get-Content -Raw -LiteralPath (Join-Path $colibriRoot 'setup.json') | ConvertFrom-Json
$launcher = Join-Path $colibriRoot 'runtime/colibri-v2.1.0/coli.cmd'
& $launcher serve --model $settings.model_dir --host 127.0.0.1 --port 8000 --model-id intellectus-qwen36
~~~

From a second PowerShell session, check for the expected model ID:

~~~powershell
(Invoke-RestMethod 'http://127.0.0.1:8000/v1/models').data |
    Select-Object -ExpandProperty id
~~~

If the connection is refused, check the server console for initialization or a startup error. Successful tokenizer or checkpoint metadata loading can precede readiness. If authentication is configured, use the existing local key through COLI_API_KEY and keep it out of commands saved to history, run logs, and evidence.

## Record the effective configuration

- Record the Colibri build and the Python version, model repository and resolved revision, or checkpoint file hashes when the revision is unavailable.
- Save the startup command and record effective backend, context length, quantization, expert-cache settings, and any tuning profile shown in the startup log. Capture the host CPU/GPU and RAM when comparing timing.
- Keep the P3 runner settings fixed for comparisons. It sends one request per case with temperature 0, a 512-token response limit and a 240-second request timeout. Preserve the runner manifest and score withdrawals by reviewing their recorded explanations.
- A refused connection usually means the listener has not started. An unauthorized response means the local server requires its configured key. If the model list shows a different ID, check the server arguments and loaded checkpoint before running the trial.

## Preflight and trial

Run the deterministic preflight before inference:

~~~powershell
python -B site/ArchitectureRepository/research/P3/preflight.py
~~~

Freeze the run inputs and provenance according to Protocol.md before the formal trial. Use a fresh output file. The runner refuses to overwrite existing evidence and records withdrawals for review of their justification.

~~~powershell
python -B site/ArchitectureRepository/research/P3/run.py --model intellectus-qwen36 --runtime-version 2.1.0 --output site/ArchitectureRepository/research/P3/run-01.jsonl
~~~
