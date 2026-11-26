[CmdletBinding()]
param([string]$EvidencePath)
$ErrorActionPreference='Stop'
if(-not $EvidencePath){
 $EvidencePath=(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '..\..\..\ArchitectureRepository\evidence\phase-I') -Filter 'live-*-deliberation-*.json' -File | Sort-Object LastWriteTime -Descending|Select-Object -First 1).FullName
}
if(-not $EvidencePath){throw 'No deliberation record found.'}
$r=Get-Content -LiteralPath $EvidencePath -Raw|ConvertFrom-Json
function Equation($candidate){
 if($null -eq $candidate){return '(no mathematical claim)'}
 $parts=@([string]$candidate.intercept)
 for($i=0;$i -lt @($candidate.coefficients).Count;$i++){
  $coef=[string]$candidate.coefficients[$i];$parts+=("$coef*x"+($i+1))
 }
 ($parts -join ' + ')
}
function Show-Claim($a){
 Write-Host ("  {0}: {1}" -f $a.role,$a.status)
 if($a.original.hypothesis){Write-Host ("    Hypothesis: {0}" -f $a.original.hypothesis)}
 Write-Host ("    Candidate: {0}" -f (Equation $a.original.candidate))
 if($a.counterexample){Write-Host ("    Counterexample: ({0}) predicted {1}; observed {2}" -f ($a.counterexample.input -join ', '),$a.counterexample.predicted,$a.counterexample.observed)}
 if($a.original.revisionOf){Write-Host ("    Revises: {0}" -f $a.original.revisionOf)}
 if($a.reason){Write-Host ("    Reason: {0}" -f $a.reason)}
}
Write-Host "Evidence: $EvidencePath"
Write-Host 'INITIAL OBSERVATIONS'
foreach($o in $r.result.initial.result.initial|Where-Object role -eq 'behavioral'|ForEach-Object {$_.body.inputs}){Write-Host ("  ({0}) => {1}" -f ($o.input -join ', '),$o.outcome.value)}
Write-Host 'STRUCTURAL EVIDENCE'
foreach($s in $r.result.initial.result.initial|Where-Object role -eq 'structural'){
 Write-Host ("  Encoder: {0}; coverage: {1}" -f $s.body.view.encoder,$s.body.view.status)
 foreach($x in $s.body.view.executables){Write-Host ("  Function {0}: {1}" -f $x.name,($x.ir.body.kind -join ', '))}
 foreach($l in $s.body.view.limitations){Write-Host "  Limitation: $l"}
}
Write-Host 'INITIAL CLAIM ASSESSMENTS'
foreach($a in $r.result.initial.deliberation.results){Show-Claim $a}
foreach($round in $r.result.rounds){Write-Host "REVISION ROUND $($round.round)";foreach($a in $round.checked.results){Show-Claim $a}}
Write-Host 'FINAL OUTCOME'
Write-Host "  Operational gate: $($r.livePassed)"
Write-Host "  Verified consensus: $($r.result.status)"
Write-Host "  Outstanding contradictions: $(@($r.result.unresolvedContradictions).Count)"
Write-Host '  This reports recorded claims and checks, not private model reasoning.'
