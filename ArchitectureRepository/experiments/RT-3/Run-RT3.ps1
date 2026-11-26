param([Parameter(Mandatory=$true)][string]$Run)
$ErrorActionPreference='Stop'
$d=$PSScriptRoot
$k='C:\workspace\Intellectus-RT-2\karaf\apache-karaf-4.4.13'
$repo='C:\workspace\Intellectus-RT-2\build\features.xml'
$out=Join-Path $d $Run
New-Item -ItemType Directory -Path $out -ErrorAction Stop|Out-Null
$env:JAVA_HOME='C:\Program Files\Java\jdk-17.0.20.1'
$env:JAVA_OPTS="-Drt2.root=$d -Drt2.out=$out"
$env:KARAF_DATA=Join-Path $out 'karaf-data'
$env:KARAF_LOG=Join-Path $out 'karaf-log'
$env:KARAF_ETC=Join-Path $out 'etc'
Copy-Item (Join-Path $d 'etc') $env:KARAF_ETC -Recurse
New-Item -ItemType Directory -Path $env:KARAF_DATA,$env:KARAF_LOG -Force|Out-Null
$env:KARAF_BASE=$k
$env:KARAF_HOME=$k
$commands=@(
 "feature:repo-add '$(([uri]$repo).AbsoluteUri)'",
 'feature:install rt2-core',
 'rt2:adapters none',
 'feature:install rt2-python',
 'rt2:adapters python',
 'rt2:encode python original.py semantic-1',
 'feature:stop rt2-python',
 'rt2:adapters none',
 'rt2:recall semantic-1',
 'feature:install rt2-typescript',
 'rt2:adapters typescript',
 'rt2:express typescript semantic-1 generated.ts',
 'rt2:encode typescript generated.ts semantic-2',
 'feature:stop rt2-typescript',
 'rt2:adapters none',
 'rt2:recall semantic-2',
 'feature:start rt2-python',
 'rt2:adapters python',
 'rt2:express python semantic-2 reconstructed.py',
 'rt2:encode python reconstructed.py semantic-3',
 'shutdown -f'
 )
$commands|Set-Content "$out\commands.gogo" -Encoding ascii
$commands | & "$k\bin\karaf.bat" 2>&1 | Tee-Object "$out\karaf-console.log"
