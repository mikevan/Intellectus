$ErrorActionPreference = 'Stop'
$root = 'C:\workspace\MikeVans_AI_Development_Toolkit'
function Step($label, $dir, $cmd) {
  Write-Host ''
  Write-Host "===== $label =====" -ForegroundColor Cyan
  Push-Location $dir
  & npm run $cmd
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Write-Host "FAILED: $label (exit $code)" -ForegroundColor Red; exit $code }
}
Write-Host '===== environment =====' -ForegroundColor Cyan
node --version; npm --version; Write-Host "PowerShell $($PSVersionTable.PSVersion)"
Write-Host ''
Write-Host '===== Phase 5 files present? =====' -ForegroundColor Cyan
$added = @(
 'Witness\src\governance\additive.ts','Witness\src\governance\anchor.ts',
 'Witness\src\governance\verification.ts','Witness\src\governance\syntax\typescript.ts',
 'Witness\test\additive.test.ts','Witness\test\attempt.test.ts','Witness\test\support\constraints.ts',
 'DeepTest\src\agent\testPath.ts','DeepTest\src\agent\packets.ts','DeepTest\src\agent\syntax.ts',
 'DeepTest\src\agent\attempt.ts','DeepTest\src\agent\authorize.ts',
 'DeepTest\src\decisions\existingTests.ts','DeepTest\src\decisions\verification.ts',
 'DeepTest\src\languages\python\testStructure.ts',
 'UntangleIt\src\agent\packets.ts','UntangleIt\src\agent\attempt.ts',
 'UntangleIt\src\agent\authorize.ts','UntangleIt\src\verification.ts')
$missing = $added | Where-Object { -not (Test-Path (Join-Path $root $_)) }
$stale = @('DeepTest\src\copilot.ts','UntangleIt\src\copilot.ts','UntangleIt\src\report\brief.ts') |
  Where-Object { Test-Path (Join-Path $root $_) }
if ($missing) { Write-Host 'Phase 5 is NOT on this tree. Missing:' -ForegroundColor Red; $missing; exit 1 }
if ($stale)   { Write-Host 'Files Phase 5 deletes are still here:' -ForegroundColor Red; $stale; exit 1 }
Write-Host 'Phase 5 files are present and the deleted ones are gone.' -ForegroundColor Green
Step 'complexity: typecheck' "$root\complexity" 'check'
Step 'complexity: tests'     "$root\complexity" 'test'
Step 'complexity: build'     "$root\complexity" 'build'
Step 'Witness: typecheck'    "$root\Witness" 'check'
Step 'Witness: tests'        "$root\Witness" 'test'
Step 'Witness: build'        "$root\Witness" 'build'
Step 'DeepTest: typecheck'   "$root\DeepTest" 'check'
Step 'DeepTest: tests'       "$root\DeepTest" 'test'
Step 'DeepTest: build'       "$root\DeepTest" 'build'
Step 'UntangleIt: typecheck' "$root\UntangleIt" 'check'
Step 'UntangleIt: tests'     "$root\UntangleIt" 'test'
Step 'UntangleIt: build'     "$root\UntangleIt" 'build'
Write-Host ''
Write-Host '===== git, read only =====' -ForegroundColor Cyan
foreach ($p in 'complexity','Witness','DeepTest','UntangleIt') {
  Write-Host "-- $p"
  git -C "$root\$p" rev-parse --short HEAD
  git -C "$root\$p" status --short
}
Write-Host ''
Write-Host 'ALL GREEN. Nothing was committed, tagged, or pushed.' -ForegroundColor Green
