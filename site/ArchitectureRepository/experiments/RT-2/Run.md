# Run RT-2

We assume you already set up your test environment as described in the [experiment environment setup guide](https://mikevan.github.io/Intellectus/experiment-setup.html). Run the commands from the Intellectus checkout root unless stated otherwise.

## Verify the archived run on Windows

Use the checkout at C:\workspace-Intellectus, with Node 22, Python, and built Understanding and Complexity. This re-executes the behavioral checks and uses the preserved Karaf lifecycle evidence. Estimate **under a minute** after setup. Work from a copy because the verifier writes result files.

~~~powershell
$experiment = 'site/ArchitectureRepository/experiments/RT-2'
$replay = Join-Path (Get-Location) 'rt2-archive-replay-01'
if (Test-Path -LiteralPath $replay) { throw 'Choose a fresh replay directory.' }
Copy-Item -LiteralPath (Join-Path $experiment 'run-03') -Destination $replay -Recurse
node "$experiment/verify.mjs" $replay
if ($LASTEXITCODE -ne 0) { throw 'RT-2 verification failed.' }
~~~

Inspect the new results.json and compare with the [RT-2 report](RT-2-Experiment-Report.md). Expect 202 cases per implementation, three negative controls, and the comparison between original and optimized fingerprints.

## Re-run the Karaf lifecycle from scratch

The archived PowerShell launcher requires Java 17 and Karaf 4.4.13, plus historical experiment inputs absent from the public tree. Recover the original java/api, java/provider, java/store, and java/probe source trees or their original compiled bundles and features.xml. The launcher also embeds the historical JDK path and expects the Karaf archive under the experiment's karaf directory. Once recovered, use a separate runnable copy, point the launcher to those exact inputs, and give it a fresh run name. Then invoke verify.mjs for that run. Retain the new commands, Karaf console log, generated artifacts, and results. An archive verification does not re-exercise the live OSGi registry.

From the recovered experiment copy, use these commands once the historical dependencies and paths have been restored.

~~~powershell
.\Run-RT2.ps1 -Run lifecycle-replay-01
node .\verify.mjs lifecycle-replay-01
~~~
