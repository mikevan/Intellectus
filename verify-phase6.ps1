# Polyglot 1.0.21 Phase 6, authoritative Windows verification.
#
# Read-only with respect to git. No commit, tag, push, checkout, reset, clean,
# restore, or any other git mutation. No packaging, no install, no release.ps1,
# no version bump. The only files written are the ordinary build and test
# outputs each package already produces.
#
# It starts from the top and proves the whole live tree, not just Phase 6.
# It stops on the first real failure and prints it rather than carrying on.
#
# On fail-closed behaviour. $ErrorActionPreference = 'Stop' does NOT make a
# nonzero exit from a native executable terminate the script under Windows
# PowerShell 5.1. So every external command whose result contributes to the
# proof checks $LASTEXITCODE itself: the npm steps through Step and StepArgs,
# and every read-only git call through GitRead. A git command that fails is a
# failed verification, not a blank line in the output.

$ErrorActionPreference = 'Stop'
$root = 'C:\workspace\MikeVans_AI_Development_Toolkit'
$packages = @('complexity','Witness','DeepTest','UntangleIt','MADTPackage')

function Section($label) {
  Write-Host ''
  Write-Host "===== $label =====" -ForegroundColor Cyan
}

function Fail($label, $code) {
  Write-Host ''
  Write-Host "FAILED: $label (exit $code)" -ForegroundColor Red
  Write-Host 'Stopping here. The failure above is the first real one; nothing after it ran.' -ForegroundColor Red
  exit $code
}

function Step($label, $dir, $script) {
  Section $label
  Push-Location $dir
  & npm run $script
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail $label $code }
}

function StepArgs($label, $dir, $script, $rest) {
  Section $label
  Push-Location $dir
  & npm run $script -- $rest
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail $label $code }
}

# Read-only git, and the only way this script calls git. It returns the
# output and fails the verification when git itself exits nonzero, so a
# missing repository, an unreadable object, or a broken index is reported
# rather than silently producing an empty answer that reads as agreement.
function GitRead($dir, $gitArgs, $label) {
  $out = & git -C $dir @gitArgs 2>&1
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host ''
    Write-Host "FAILED: $label (git exit $code)" -ForegroundColor Red
    $out
    Write-Host 'Stopping here. A git read that does not succeed proves nothing.' -ForegroundColor Red
    exit $code
  }
  return $out
}

# ---------------------------------------------------------------------------
# 1. Environment and read-only baseline
# ---------------------------------------------------------------------------

Section '1. Environment'
# node and npm are external commands and their versions are part of the
# recorded baseline, so they fail closed like everything else: capture the
# output, check the exit code immediately, print only after it succeeded.
# PowerShell's own version is not an external command and needs no check.
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0) { Fail '1. node --version' $LASTEXITCODE }
$npmVersion = & npm --version
if ($LASTEXITCODE -ne 0) { Fail '1. npm --version' $LASTEXITCODE }
Write-Host "node   $nodeVersion"
Write-Host "npm    $npmVersion"
Write-Host "PowerShell $($PSVersionTable.PSVersion)"
Write-Host "workspace $root"
if (-not (Test-Path $root)) { Write-Host 'The workspace path does not exist.' -ForegroundColor Red; exit 1 }
Set-Location $root

Section '1b. Pinned TypeScript compiler per package'
# Printed from each package's own installed compiler, never from npx, so the
# record says which compiler actually typechecked the tree.
foreach ($p in 'complexity','Witness','DeepTest','UntangleIt') {
  $tsc = Join-Path $root "$p\node_modules\typescript\bin\tsc"
  if (-not (Test-Path $tsc)) { Write-Host "$p has no local typescript. Stopping." -ForegroundColor Red; exit 1 }
  $v = & node $tsc --version
  if ($LASTEXITCODE -ne 0) { Fail "1b. $p tsc --version" $LASTEXITCODE }
  Write-Host ("{0,-11} tsc {1}" -f $p, $v)
}

Section '1c. Versions, which must all still be 1.0.19'
foreach ($p in $packages) {
  $v = (Get-Content (Join-Path $root "$p\package.json") -Raw | ConvertFrom-Json).version
  Write-Host ("{0,-13} {1}" -f $p, $v)
  if ($v -ne '1.0.19') { Write-Host 'Version moved. Phase 6 bumps nothing. Stopping.' -ForegroundColor Red; exit 1 }
}

Section '1d. Git HEADs before, read only'
$headsBefore = @{}
foreach ($p in $packages) {
  $h = GitRead (Join-Path $root $p) @('rev-parse','HEAD') "1d. $p rev-parse HEAD"
  $headsBefore[$p] = "$h".Trim()
  Write-Host ("{0,-13} {1}" -f $p, $headsBefore[$p].Substring(0,7))
}

# ---------------------------------------------------------------------------
# 2. Phase 6 is actually on this tree
#
# The Phase 5 lesson: a verification that passes against a tree the work never
# reached is worse than no verification, because it reads as proof. These are
# the 17 files Phase 6 created. If any is missing, this tree is not the one
# that was transferred.
# ---------------------------------------------------------------------------

Section '2. Phase 6 files present?'
$added = @(
  'Witness\src\governance\finding.ts',
  'Witness\test\finding.test.ts',
  'Witness\test\runner-absent.test.ts',
  'Witness\test\failure-explain-validators.test.ts',
  'Witness\test\polyglot-class.test.ts',
  'DeepTest\src\agent\findings.ts',
  'DeepTest\src\agent\findingOffers.ts',
  'DeepTest\src\agent\problems.ts',
  'DeepTest\test\findings.test.ts',
  'DeepTest\test\finding-surface.test.ts',
  'DeepTest\test\governed-problem-surface.test.ts',
  'DeepTest\test\polyglot-hole.test.ts',
  'UntangleIt\src\agent\findings.ts',
  'UntangleIt\src\agent\findingOffers.ts',
  'UntangleIt\test\findings.test.ts',
  'UntangleIt\test\finding-surface.test.ts',
  'UntangleIt\test\unclassified-refusal.test.ts')
$missing = $added | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
  Write-Host 'Phase 6 is NOT on this tree. Missing:' -ForegroundColor Red
  $missing
  exit 1
}
Write-Host 'All 17 Phase 6 files are present.' -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3 to 6. The four packages, top to bottom
# ---------------------------------------------------------------------------

Step '3. complexity: typecheck' "$root\complexity" 'check'
Step '3. complexity: tests'     "$root\complexity" 'test'
Step '3. complexity: build'     "$root\complexity" 'build'

# Witness's full suite carries the Phase 6 coverage: polyglot-class (M6
# classification), runner-absent (runner identity absent), finding (the five
# finding conditions), failure-explain-validators (the effective-validator
# proof).
Step '4. Witness: typecheck' "$root\Witness" 'check'
Step '4. Witness: tests'     "$root\Witness" 'test'
Step '4. Witness: build'     "$root\Witness" 'build'

# DeepTest's full suite carries M6 wiring and fall-through (polyglot-hole),
# M5's unclassified refusals (polyglot-hole), M12's governed problem surface
# (governed-problem-surface), finding construction (findings), the finding
# user surface (finding-surface), and the agent boundary controls
# (agent-boundaries, agent-governance). It also runs the runner-dependent
# tests that the container skips.
Step '5. DeepTest: typecheck' "$root\DeepTest" 'check'
Step '5. DeepTest: tests'     "$root\DeepTest" 'test'
Step '5. DeepTest: build'     "$root\DeepTest" 'build'

# UntangleIt's `check` runs the package's own pinned tsc through npm, not npx,
# so the compiler is the 5.9.3 printed in section 1b.
Step '6. UntangleIt: typecheck' "$root\UntangleIt" 'check'
Step '6. UntangleIt: tests'     "$root\UntangleIt" 'test'
Step '6. UntangleIt: build'     "$root\UntangleIt" 'build'

# ---------------------------------------------------------------------------
# 7. The browser gates, named and run again on their own
#
# Both live in UntangleIt\test\gate-browser.test.ts and already ran inside the
# suite above. They are run again by themselves so the result is unambiguous
# in the output rather than buried in a file list. The Angular Karma gate
# cannot launch Chrome in the Linux container and is green on Windows; a
# failure HERE is a real verification failure and is not the container
# limitation.
# ---------------------------------------------------------------------------

StepArgs '7. Browser gates: Angular Karma and Playwright component tests' "$root\UntangleIt" 'test' 'test/gate-browser.test.ts'

# ---------------------------------------------------------------------------
# 8. Post-run integrity, read only
# ---------------------------------------------------------------------------

Section '8. Git HEADs after, read only'
$moved = @()
foreach ($p in $packages) {
  $h = "$(GitRead (Join-Path $root $p) @('rev-parse','HEAD') "8. $p rev-parse HEAD")".Trim()
  Write-Host ("{0,-13} {1}" -f $p, $h.Substring(0,7))
  if ($h -ne $headsBefore[$p]) { $moved += $p }
}
if ($moved.Count -gt 0) {
  Write-Host ("A HEAD moved during verification: {0}. That should be impossible here." -f ($moved -join ', ')) -ForegroundColor Red
  exit 1
}
Write-Host 'No HEAD moved during this verification.' -ForegroundColor Green

Section '8b. Working trees, read only'
# Reported, not judged and not touched. Build output and uncommitted Phase 6
# work are expected to show here.
foreach ($p in $packages) {
  Write-Host "-- $p"
  GitRead (Join-Path $root $p) @('status','--short') "8b. $p status --short"
}

Section '8c. Tags at HEAD, read only'
# `tag --points-at` lists tags. It creates none.
foreach ($p in $packages) {
  $t = GitRead (Join-Path $root $p) @('tag','--points-at','HEAD') "8c. $p tag --points-at HEAD"
  if ($t) { Write-Host ("{0,-13} tags at HEAD: {1}" -f $p, (($t | ForEach-Object { "$_".Trim() }) -join ', ')) }
  else    { Write-Host ("{0,-13} no tag at HEAD" -f $p) }
}

Write-Host ''
Write-Host 'ALL GREEN.' -ForegroundColor Green
Write-Host 'What this run establishes, and only this:' -ForegroundColor Green
Write-Host '  - no HEAD moved between the start and the end of this run;' -ForegroundColor Green
Write-Host '  - every package version is still 1.0.19;' -ForegroundColor Green
Write-Host '  - this verification performed no commit, tag, push, package, install, release, or version-bump operation.' -ForegroundColor Green
Write-Host 'Phase 6 is verified on this tree once these counts are recorded. It is not closed until that record exists.' -ForegroundColor Green
