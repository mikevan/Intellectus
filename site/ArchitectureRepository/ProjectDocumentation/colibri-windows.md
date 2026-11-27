# Set up Colibri on Windows 10/11

Start in a terminal with Git and Python 3.10 or later available. Use an SSD and budget at least 30 GB of free disk space for the roughly 23 GB checkpoint, runtime, and supporting files. Colibri's Qwen guide recommends about 30 GB of RAM for comfortable expert caching. Download time depends on the connection: 23 GB takes about 31 minutes at a sustained 100 Mbps before overhead. The deterministic Intellectus tests run without Colibri. [Qwen3.6 runtime requirements](https://github.com/JustVugg/colibri/blob/v2.1.0/docs/qwen36.md)

## 1. Check Python and download the runtime

Use 64-bit Windows on an x86-64 CPU supporting AVX2. In PowerShell, check that Python and Git are available. If either command is missing, install [Python for Windows](https://www.python.org/downloads/windows/) or [Git for Windows](https://git-scm.com/install/windows), reopen PowerShell, and check again.

~~~powershell
py -3 --version
git --version
~~~

From [Colibri v2.1.0](https://github.com/JustVugg/colibri/releases/tag/v2.1.0), save colibri-v2.1.0-windows-x86_64.zip and SHA256SUMS.txt to Downloads. Check the archive against the official checksums, then extract it. Keep the extracted files together.

~~~powershell
$zip = Join-Path $env:USERPROFILE 'Downloads\colibri-v2.1.0-windows-x86_64.zip'
$sums = Join-Path $env:USERPROFILE 'Downloads\SHA256SUMS.txt'
$expected = Get-Content -LiteralPath $sums | Where-Object { $_ -match 'colibri-v2\.1\.0-windows-x86_64\.zip$' }
if (-not $expected -or (Get-FileHash -LiteralPath $zip).Hash -ne ($expected -split '\s+')[0]) {
    throw 'Colibri archive checksum mismatch.'
}
$runtime = Join-Path $env:LOCALAPPDATA 'Colibri-Intellectus\v2.1.0'
Expand-Archive -LiteralPath $zip -DestinationPath $runtime
$launcher = (Get-ChildItem -LiteralPath $runtime -Recurse -Filter coli.cmd -File | Select-Object -First 1).FullName
if (-not $launcher) { throw 'coli.cmd is missing from the extracted archive.' }
& $launcher info
~~~

## 2. Download the Qwen checkpoint

Use a virtual environment for the download tool. The [model repository](https://huggingface.co/Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64) provides the complete int4 gs64 container, including tokenizer and configuration. Keep the model directory separate from the Intellectus Git checkout.

~~~powershell
$tools = Join-Path $env:LOCALAPPDATA 'Colibri-Intellectus\hf-tools'
$modelDir = Join-Path $env:LOCALAPPDATA 'Colibri-Intellectus\models\qwen36-35b'
py -3 -m venv $tools
& (Join-Path $tools 'Scripts\python.exe') -m pip install huggingface_hub
& (Join-Path $tools 'Scripts\hf.exe') download Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64 --local-dir $modelDir
~~~

If the download is interrupted, rerun the same download command with the same directory. When reproducing P3/P4, compare the downloaded files with the [recorded checkpoint hashes](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3/run-01-provenance.json). If a known immutable revision is available, add --revision followed by that revision to the download command. The recorded run used checkpoint hashes because its installer supplied only the main branch label.

## 3. Start the local server

Run the diagnostic first. Keep the server PowerShell window open during the experiment.

~~~powershell
& $launcher doctor --model $modelDir
& $launcher serve --model $modelDir --host 127.0.0.1 --port 8000 --model-id intellectus-qwen36
~~~

Open a second PowerShell window. The model list should include intellectus-qwen36. The second command sends one smoke-test request and prints the response. Allow a few minutes on CPU, especially for the first request.

~~~powershell
(Invoke-RestMethod 'http://127.0.0.1:8000/v1/models').data.id
$body = @{
    model = 'intellectus-qwen36'
    messages = @(@{ role = 'user'; content = 'Reply with READY.' })
    temperature = 0
    max_tokens = 32
    stream = $false
} | ConvertTo-Json -Depth 5
$response = Invoke-RestMethod 'http://127.0.0.1:8000/v1/chat/completions' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 240
$response.choices[0].message.content
~~~

## 4. Check Intellectus and troubleshoot

From the Intellectus checkout, verify the deterministic harnesses. Estimate under 10 seconds for these preflight commands once Python is installed.

~~~powershell
py -3 -B site/ArchitectureRepository/research/P3/preflight.py
py -3 -B site/ArchitectureRepository/research/P4/preflight.py
~~~

Expected results are 12 P3 cases and 300 oracle checks, then 12 P4 cases and 60 behavioral checks. Follow the [Developer Guide](developer-guide.md) for trial commands and scoring. Record the runtime build, model hashes, backend, context length, cache settings, and host hardware before comparing results.

- Connection refused: check the server window for startup errors and wait until the models request succeeds.
- Address already in use: run Get-NetTCPConnection -LocalPort 8000 -State Listen and identify the existing process before restarting or replacing anything. The experiment runners expect port 8000.
- Launcher or engine missing: keep the whole archive together and confirm Python is available as python on PATH for coli.cmd. Check that the archive and CPU architecture match.
- Model-load errors: run doctor again, check the tokenizer and model shards, and compare files against the recorded hashes.
- HTTP 401: if you configured COLI_API_KEY, pass the matching Authorization bearer header to test requests and make the key available to the runner's shell.
- Stop the foreground server with Ctrl+C when finished.
