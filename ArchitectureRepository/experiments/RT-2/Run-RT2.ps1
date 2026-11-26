param([string]$Run='run-01',[switch]$SkipBuild)
$ErrorActionPreference='Stop'
$d=$PSScriptRoot
$k=Join-Path $d 'karaf\apache-karaf-4.4.13'
$b=Join-Path $d 'build'
New-Item -ItemType Directory -Path $b -Force | Out-Null
$osgi=Join-Path $k 'lib\boot\osgi.core-8.0.0.jar'
if(-not $SkipBuild){
foreach($part in @('api','provider','store','probe')){
 $target=Join-Path $b $part
 New-Item -ItemType Directory -Path $target -Force|Out-Null
 $files=@(Get-ChildItem "$d\java\$part" -Recurse -Filter '*.java'|ForEach-Object FullName)
 javac --release 17 -cp "$osgi;$b\api" -d $target @files
 if($LASTEXITCODE){throw "Compilation failed: $part"}
}
function Bundle($name,$part,$headers){
 $mf=Join-Path $b "$name.mf"
 @('Manifest-Version: 1.0','Bundle-ManifestVersion: 2',"Bundle-SymbolicName: $name",'Bundle-Version: 0.1.0')+$headers+@('')|Set-Content $mf -Encoding ascii
 & "C:\Program Files\Java\jdk-17.0.20.1\bin\jar.exe" --create --file "$b\$name.jar" --manifest $mf -C "$b\$part" .
 if($LASTEXITCODE){throw "jar failed: $name"}
}
Bundle 'IntellectusRT2API' api @('Export-Package: com.intellectus.rt2')
Bundle 'LinguisticPython' provider @('Bundle-Activator: com.intellectus.rt2.provider.Activator','Import-Package: com.intellectus.rt2,org.osgi.framework','Intellectus-Language: python')
Bundle 'LinguisticTypeScript' provider @('Bundle-Activator: com.intellectus.rt2.provider.Activator','Import-Package: com.intellectus.rt2,org.osgi.framework','Intellectus-Language: typescript')
Bundle 'Understanding' store @('Bundle-Activator: com.intellectus.rt2.store.Activator','Import-Package: com.intellectus.rt2,org.osgi.framework')
Bundle 'IntellectusRT2Probe' probe @('Bundle-Activator: com.intellectus.rt2.probe.Activator','Import-Package: com.intellectus.rt2,org.osgi.framework')
function Uri($name){ ([uri](Join-Path $b "$name.jar")).AbsoluteUri }
$repo=Join-Path $b 'features.xml'
@"
<?xml version="1.0" encoding="UTF-8"?>
<features name="rt2" xmlns="http://karaf.apache.org/xmlns/features/v1.4.0">
 <feature name="rt2-core" version="0.1.0"><bundle>$(Uri IntellectusRT2API)</bundle><bundle>$(Uri Understanding)</bundle><bundle>$(Uri IntellectusRT2Probe)</bundle></feature>
 <feature name="rt2-python" version="0.1.0"><feature>rt2-core</feature><bundle>$(Uri LinguisticPython)</bundle></feature>
 <feature name="rt2-typescript" version="0.1.0"><feature>rt2-core</feature><bundle>$(Uri LinguisticTypeScript)</bundle></feature>
</features>
"@|Set-Content $repo -Encoding ascii
}
$repo=Join-Path $b 'features.xml'
$out=Join-Path $d $Run
New-Item -ItemType Directory -Path $out -ErrorAction Stop|Out-Null
$env:JAVA_HOME='C:\Program Files\Java\jdk-17.0.20.1'
$env:JAVA_OPTS="-Drt2.root=$d -Drt2.out=$out"
$env:KARAF_DATA=Join-Path $out 'karaf-data'
$env:KARAF_LOG=Join-Path $out 'karaf-log'
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
 'rt2:optimize',
 'rt2:recall optimized',
 'feature:start rt2-python',
 'rt2:adapters python',
 'rt2:express python optimized improved.py',
 'rt2:encode python improved.py semantic-3',
 'shutdown -f'
 )
$commands|Set-Content "$out\commands.gogo" -Encoding ascii
$commands | & "$k\bin\karaf.bat" 2>&1 | Tee-Object "$out\karaf-console.log"



