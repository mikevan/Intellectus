[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OsgiJar)
$ErrorActionPreference='Stop'
$OsgiJar=(Resolve-Path -LiteralPath $OsgiJar).Path
$root=$PSScriptRoot
$build=Join-Path $root ('build-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $build | Out-Null
function Compile([string]$kind,[string]$cp) {
    $out=Join-Path $build $kind
    New-Item -ItemType Directory -Path $out | Out-Null
    $java=@(Get-ChildItem (Join-Path $root "java\$kind") -Recurse -Filter '*.java' | ForEach-Object FullName)
    if($cp){javac -encoding UTF-8 -cp $cp -d $out @java}else{javac -encoding UTF-8 -d $out @java}
    if($LASTEXITCODE -ne 0){throw "javac failed: $kind"}
    return $out
}
function Bundle([string]$id,[string]$classes,[string[]]$headers){
    $mf=Join-Path $build "$id.mf"
    $jarFile=Join-Path $build "$id.jar"
    @('Manifest-Version: 1.0','Bundle-ManifestVersion: 2',"Bundle-SymbolicName: $id",'Bundle-Version: 0.1.0','Bundle-RequiredExecutionEnvironment: JavaSE-17') + $headers + @('') | Set-Content -LiteralPath $mf -Encoding ascii
    jar --create --file $jarFile --manifest $mf -C $classes .
    if($LASTEXITCODE -ne 0){throw "jar failed: $id"}
    return $jarFile
}
$api=Compile 'api' ''
$apiJar=Bundle 'intellectus.api' $api @('Export-Package: com.intellectus.api;version="0.1.0"')
$cp=$apiJar+[IO.Path]::PathSeparator+$OsgiJar
$provider=Compile 'provider' $cp
$probe=Compile 'probe' $cp
$python=Bundle 'intellectus.linguistic.python' $provider @('Bundle-Activator: com.intellectus.provider.Activator','Import-Package: com.intellectus.api,org.osgi.framework','Intellectus-Language: python')
$typescript=Bundle 'intellectus.linguistic.typescript' $provider @('Bundle-Activator: com.intellectus.provider.Activator','Import-Package: com.intellectus.api,org.osgi.framework','Intellectus-Language: typescript')
$probeJar=Bundle 'intellectus.probe' $probe @('Bundle-Activator: com.intellectus.probe.Activator','Import-Package: com.intellectus.api,org.osgi.framework')
function Uri([string]$path){[Security.SecurityElement]::Escape(([uri]$path).AbsoluteUri)}
$xml=@"
<?xml version="1.0" encoding="UTF-8"?>
<features name="intellectus-prototype" xmlns="http://karaf.apache.org/xmlns/features/v1.4.0">
  <feature name="intellectus-core" version="0.1.0">
    <bundle>$(Uri $apiJar)</bundle>
    <bundle>$(Uri $probeJar)</bundle>
  </feature>
  <feature name="intellectus-python" version="0.1.0">
    <feature version="0.1.0">intellectus-core</feature>
    <bundle>$(Uri $python)</bundle>
  </feature>
  <feature name="intellectus-typescript" version="0.1.0">
    <feature version="0.1.0">intellectus-core</feature>
    <bundle>$(Uri $typescript)</bundle>
  </feature>
</features>
"@
$features=Join-Path $build 'features.xml'
[IO.File]::WriteAllText($features,$xml,(New-Object System.Text.UTF8Encoding($false)))
[xml](Get-Content -LiteralPath $features -Raw)|Out-Null
Write-Host "Features repository URI: $(([uri]$features).AbsoluteUri)"

