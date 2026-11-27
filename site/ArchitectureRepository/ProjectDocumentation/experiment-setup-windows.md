# Experiment environment setup on Windows 10/11

Use PowerShell on 64-bit Windows. Install [Git for Windows](https://git-scm.com/install/windows), [Python 3.10 or newer](https://www.python.org/downloads/windows/), [Node.js 22 and npm](https://nodejs.org/en/download), and a [JDK 17](https://adoptium.net/installation/). In the Python installer, enable the option to put Python on PATH. Use a JDK distribution that includes javac and jar. Open a new PowerShell window after installation.

## 1. Check the tools and build the modules

The historical RT-2 through RT-4 verifier expects the checkout at C:\workspace-Intellectus. Use the existing checkout if you have one. Otherwise clone into that path. Node 22 needs to accept the TypeScript stripping flag.

~~~powershell
git --version
python --version
node --version
npm.cmd --version
node --experimental-strip-types -e 'console.log("TypeScript stripping available")'
java -version
javac -version
jar --version

# Run the clone only if the checkout does not already exist.
git clone https://github.com/mikevan/Intellectus.git C:\workspace-Intellectus
Set-Location C:\workspace-Intellectus
git rev-parse HEAD
foreach ($module in @('Understanding','complexity')) {
    npm.cmd --prefix $module ci
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed for $module." }
    npm.cmd --prefix $module run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed for $module." }
}
~~~

## 2. Install and check Apache Karaf

Download the [Apache Karaf 4.4.13 binary ZIP and SHA-512 checksum](https://karaf.apache.org/download.html). Save both to Downloads. Set JAVA_HOME to the installed JDK 17 directory. Change the example path to match your installation.

~~~powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\your-jdk-17-directory'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
javac -version
$zip = Join-Path $env:USERPROFILE 'Downloads\apache-karaf-4.4.13.zip'
$sum = Get-Content -Raw -LiteralPath "$zip.sha512"
if ($sum -notmatch '\b[a-fA-F0-9]{128}\b' -or (Get-FileHash -LiteralPath $zip -Algorithm SHA512).Hash -ne $Matches[0]) {
    throw 'Karaf archive checksum mismatch.'
}
$tools = Join-Path $env:LOCALAPPDATA 'Intellectus\tools'
Expand-Archive -LiteralPath $zip -DestinationPath $tools
$env:KARAF_HOME = Join-Path $tools 'apache-karaf-4.4.13'
& "$env:KARAF_HOME\bin\karaf.bat"
~~~

In the Karaf shell run shell:info, confirm Karaf 4.4.13 and Java 17, then enter shutdown -f. Run the stock distribution on a trusted development machine. This check confirms the base runtime. The historical OSGi trials also require their own bundles and configuration, described in their run instructions.

## 3. Install and check Colibri

Follow the [Colibri Windows guide](colibri-windows.md) to install the runtime and checkpoint, start the local endpoint, and send a smoke-test request. Return to the [experiment run instructions](experiment-runs.md) and choose your trial.
