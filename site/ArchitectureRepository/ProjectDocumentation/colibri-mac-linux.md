# Set up Colibri on macOS and Linux

Start in a terminal with Git and Python 3.10 or later available. Use an SSD and budget at least 30 GB of free disk space for the roughly 23 GB checkpoint, runtime, and supporting files. Colibri's Qwen guide recommends about 30 GB of RAM for comfortable expert caching. Download time depends on the connection: 23 GB takes about 31 minutes at a sustained 100 Mbps before overhead. The deterministic Intellectus tests run without Colibri. [Qwen3.6 runtime requirements](https://github.com/JustVugg/colibri/blob/v2.1.0/docs/qwen36.md)

## 1. Check your platform

In Terminal, check the OS, CPU architecture, Python, and Git. Use Python 3.10 or later. If Python or Git is missing, install it through your OS package manager or the [Python downloads page](https://www.python.org/downloads/). On Linux, install your distribution's Python venv package if python3 -m venv reports that ensurepip is unavailable.

~~~sh
uname -s
uname -m
python3 --version
git --version
~~~

The [v2.1.0 release](https://github.com/JustVugg/colibri/releases/tag/v2.1.0) publishes colibri-v2.1.0-linux-x86_64.tar.gz for Linux x86-64 with AVX2 and colibri-v2.1.0-macos-arm64.tar.gz for Apple Silicon. The macOS archive does not list Qwen3.6 among its included engines. Use the pinned source build below on macOS, including Intel Macs, or when the Linux release archive does not match your architecture.

## 2. Install the runtime

### Linux x86-64 with AVX2

Download the Linux archive and SHA256SUMS.txt from the release into your current directory. Verify the archive and extract it. Keep the runtime files together.

~~~sh
archive=colibri-v2.1.0-linux-x86_64.tar.gz
grep -E "[ *]$archive$" SHA256SUMS.txt | sha256sum -c - &&
    mkdir -p "$HOME/.local/opt/colibri-v2.1.0" &&
    tar -xzf "$archive" -C "$HOME/.local/opt/colibri-v2.1.0"
launcher=$(find "$HOME/.local/opt/colibri-v2.1.0" -type f -name coli -print -quit)
test -n "$launcher" && python3 "$launcher" info
~~~

### macOS or Linux source build

On macOS install the command-line developer tools with xcode-select --install and finish the installer. On Debian or Ubuntu install build-essential, git, python3 and python3-venv through apt if needed. Other Linux distributions should install their equivalent C compiler and make packages.

Build the Qwen3.6 engine from the v2.1.0 tag. This path uses the upstream default CPU build. If compilation fails on your platform, use the upstream build diagnostics and [Qwen3.6 build notes](https://github.com/JustVugg/colibri/blob/v2.1.0/docs/qwen36.md) before continuing.

~~~sh
mkdir -p "$HOME/.local/opt"
source_dir="$HOME/.local/opt/colibri-src-v2.1.0"
git clone --branch v2.1.0 --depth 1 https://github.com/JustVugg/colibri.git "$source_dir" &&
    make -C "$source_dir/c" qwen36
launcher="$source_dir/c/coli"
test -x "$source_dir/c/qwen36" && python3 "$launcher" info
~~~

## 3. Download the Qwen checkpoint

Install the Hugging Face CLI in a virtual environment. Keep the [Qwen3.6-35B-A3B int4 gs64 container](https://huggingface.co/Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64) outside the Intellectus Git checkout.

~~~sh
tools="$HOME/.local/opt/colibri-hf-tools"
model_dir="$HOME/.local/share/colibri-intellectus/models/qwen36-35b"
python3 -m venv "$tools"
"$tools/bin/python" -m pip install huggingface_hub
"$tools/bin/hf" download Kreuzzelg/qwen36-35b-a3b-colibri-i4-gs64 --local-dir "$model_dir"
~~~

If interrupted, rerun the download using the same directory. Before claiming reproduction, compare the checkpoint against the [recorded file hashes](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3/run-01-provenance.json). Use sha256sum on Linux or shasum -a 256 on macOS. If you have a confirmed immutable model revision, pass it through --revision.

## 4. Start and verify the server

Use the launcher set in step 2. Keep the terminal open during the experiment.

~~~sh
python3 "$launcher" doctor --model "$model_dir"
python3 "$launcher" serve --model "$model_dir" --host 127.0.0.1 --port 8000 --model-id intellectus-qwen36
~~~

From a second terminal, confirm the model list includes intellectus-qwen36. Then make a short inference request. Allow a few minutes on CPU, especially for the first request.

~~~sh
curl -fsS http://127.0.0.1:8000/v1/models
curl -fsS --max-time 240 http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"intellectus-qwen36","messages":[{"role":"user","content":"Reply with READY."}],"temperature":0,"max_tokens":32,"stream":false}'
~~~

## 5. Check Intellectus and troubleshoot

From the Intellectus checkout, run both deterministic preflights. Estimate under 10 seconds once Python is installed.

~~~sh
python3 -B site/ArchitectureRepository/research/P3/preflight.py
python3 -B site/ArchitectureRepository/research/P4/preflight.py
~~~

Expected results are 12 P3 cases and 300 oracle checks, then 12 P4 cases and 60 behavioral checks. Use the [Developer Guide](developer-guide.md) for live trials. Record the runtime build, checkpoint hashes, backend, context length, cache settings, and hardware. A CPU build on macOS or Linux may have different timing from the recorded Windows run.

- Connection refused: check the server terminal for startup errors and wait for the models request to succeed.
- Port 8000 in use: identify the listener with lsof -nP -iTCP:8000 -sTCP:LISTEN on macOS or ss -ltnp on Linux. The Intellectus runners expect port 8000.
- Bad CPU type or missing Qwen engine: use the correct archive or build the Qwen engine from the pinned source tag.
- HTTP 401: if you configured COLI_API_KEY, use the matching Authorization bearer header in the test request and export the key in the runner shell.
- Stop the foreground server with Ctrl+C when finished.
