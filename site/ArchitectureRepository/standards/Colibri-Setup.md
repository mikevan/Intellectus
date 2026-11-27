# Colibri setup on Windows

See the [shared setup guide](../ProjectDocumentation/colibri-setup.md) for installation, versions, and provenance. From PowerShell, set both paths to your extracted runtime and verified checkpoint. The model ID shown is the one used by the P3 and P4 runners.

~~~powershell
$launcher = 'C:\path\to\colibri-v2.1.0\coli.cmd'
$modelDir = 'C:\path\to\qwen36-35b'
& $launcher serve --model $modelDir --host 127.0.0.1 --port 8000 --model-id intellectus-qwen36
~~~

Leave that window open. From a second PowerShell session, check for the expected model ID.

~~~powershell
(Invoke-RestMethod 'http://127.0.0.1:8000/v1/models').data |
    Select-Object -ExpandProperty id
~~~

An installation created with Colibri's setup flow may store the model directory in %LOCALAPPDATA%\colibri\setup.json. The Intellectus research host used that configuration. Adjust the launcher and model paths for your installation. If the local server requires an API key, supply the configured key through COLI_API_KEY for the experiment runner and include the appropriate authorization header in the readiness check.
