# Polyglot 1.0.21 Phase 7, authoritative Windows verification.
#
# Governance-record persistence, the M17b join, and the Governance History
# viewers. It establishes current facts about this tree; it repeats no claim
# from Phase 6's run.
#
# Read-only with respect to git. No commit, tag, push, checkout, reset,
# clean, restore, or any other git mutation. No packaging, no install, no
# release.ps1, no version bump. The only files written are the ordinary build
# and test outputs each package already produces.
#
# On fail-closed behaviour. $ErrorActionPreference = 'Stop' does NOT make a
# nonzero exit from a native executable terminate the script under Windows
# PowerShell 5.1. So every external command whose result contributes to the
# proof checks $LASTEXITCODE itself: node and npm in section A, each
# package's own tsc, every npm step through Step and StepArgs, and every
# read-only git call through GitRead.
#
# On counts. The staging counts are reference evidence and are NOT pass
# conditions. Nothing here requires a particular number. Success is that each
# command exited cleanly with no failing test. The actual Windows counts are
# printed for the record, and two specific observations are surfaced at the
# end because they are the ones the container could not make.

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

function Disqualify($message) {
  Write-Host ''
  Write-Host 'FAILED: Windows qualification' -ForegroundColor Red
  Write-Host $message -ForegroundColor Red
  Write-Host 'Stopping here. A Windows verification that did not run the Windows-only tests has not verified them.' -ForegroundColor Red
  exit 1
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

# Read-only git, and the only way this script calls git. It fails the
# verification when git itself exits nonzero, so a missing repository or an
# unreadable object is reported rather than silently producing an empty
# answer that reads as agreement.
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
# A. Environment
# ---------------------------------------------------------------------------

Section 'A. Environment'
# node and npm are external commands and their versions are part of the
# recorded baseline, so they fail closed like everything else. PowerShell's
# own version is not an external command and needs no check.
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0) { Fail 'A. node --version' $LASTEXITCODE }
$npmVersion = & npm --version
if ($LASTEXITCODE -ne 0) { Fail 'A. npm --version' $LASTEXITCODE }
Write-Host "node   $nodeVersion"
Write-Host "npm    $npmVersion"
Write-Host "PowerShell $($PSVersionTable.PSVersion)"
Write-Host "workspace $root"
if (-not (Test-Path $root)) { Write-Host 'The workspace path does not exist.' -ForegroundColor Red; exit 1 }
Set-Location $root

Section 'A2. Pinned TypeScript compiler per package'
# From each package's own installed compiler, never from npx, so the record
# says which compiler actually typechecked the tree.
foreach ($p in 'complexity','Witness','DeepTest','UntangleIt') {
  $tsc = Join-Path $root "$p\node_modules\typescript\bin\tsc"
  if (-not (Test-Path $tsc)) { Write-Host "$p has no local typescript. Stopping." -ForegroundColor Red; exit 1 }
  $v = & node $tsc --version
  if ($LASTEXITCODE -ne 0) { Fail "A2. $p tsc --version" $LASTEXITCODE }
  Write-Host ("{0,-11} tsc {1}" -f $p, $v)
}

# ---------------------------------------------------------------------------
# B. Release integrity, read only
# ---------------------------------------------------------------------------

Section 'B. Versions, which must all still be 1.0.19'
foreach ($p in $packages) {
  $v = (Get-Content (Join-Path $root "$p\package.json") -Raw | ConvertFrom-Json).version
  Write-Host ("{0,-13} {1}" -f $p, $v)
  if ($v -ne '1.0.19') { Write-Host 'Version moved. Phase 7 bumps nothing. Stopping.' -ForegroundColor Red; exit 1 }
}

Section 'B2. Git HEADs before, read only'
$headsBefore = @{}
foreach ($p in $packages) {
  $h = GitRead (Join-Path $root $p) @('rev-parse','HEAD') "B2. $p rev-parse HEAD"
  $headsBefore[$p] = "$h".Trim()
  Write-Host ("{0,-13} {1}" -f $p, $headsBefore[$p].Substring(0,7))
}

# ---------------------------------------------------------------------------
# C. Presence gate
#
# A verification that passes against a tree the work never reached is worse
# than no verification, because it reads as proof. These are the ten files
# Phase 7 created.
# ---------------------------------------------------------------------------

Section 'C. Phase 7 files present?'
$added = @(
  'Witness\src\governance\store.ts',
  'Witness\test\store.test.ts',
  'DeepTest\src\governance.ts',
  'DeepTest\src\ui\governanceView.ts',
  'DeepTest\test\governance-persistence.test.ts',
  'DeepTest\test\store-integrity.test.ts',
  'UntangleIt\src\governance.ts',
  'UntangleIt\src\ui\governanceView.ts',
  'UntangleIt\test\governance-persistence.test.ts',
  'UntangleIt\test\store-integrity.test.ts')
$missing = $added | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
  Write-Host 'Phase 7 is NOT on this tree. Missing:' -ForegroundColor Red
  $missing
  exit 1
}
Write-Host 'All 10 Phase 7 files are present.' -ForegroundColor Green

# ---------------------------------------------------------------------------
# D. Whole-tree verification
#
# The full package suites, not a Phase 7 smoke test. The Phase 7 persistence,
# corruption, ordering, M17b, privacy, lifecycle and viewer tests are inside
# these suites, which is where they belong: a separate run of only the new
# tests would prove the new tests and nothing about what they sit beside.
# ---------------------------------------------------------------------------

Step 'D1. complexity: typecheck' "$root\complexity" 'check'
Step 'D1. complexity: tests'     "$root\complexity" 'test'
Step 'D1. complexity: build'     "$root\complexity" 'build'

# Witness carries the governance store: the four JSONL ending and corruption
# cases, the privacy markers, duplicate rejection, the interactionId
# consistency check, the missing-record path, idempotence, conflict, and the
# durability ordering at the persistence seam.
Step 'D2. Witness: typecheck' "$root\Witness" 'check'
Step 'D2. Witness: tests'     "$root\Witness" 'test'
Step 'D2. Witness: build'     "$root\Witness" 'build'

# DeepTest carries the step 0 corrupt-store regression, the M17b write order,
# the WORK_DIR_KEEP lifecycle protection, the local-only ignore policy and the
# Governance History viewer. It also runs the tests the container skips.
Step 'D3. DeepTest: typecheck' "$root\DeepTest" 'check'
Step 'D3. DeepTest: tests'     "$root\DeepTest" 'test'
Step 'D3. DeepTest: build'     "$root\DeepTest" 'build'

# ---------------------------------------------------------------------------
# D3b. The Windows qualification for DeepTest's runner-dependent tests
#
# The full suite above already ran these. It cannot, on its own, prove they
# EXECUTED: `test.skipIf(!hasPython)` skips them silently when the
# interpreter has no `coverage` and `pytest`, the suite still passes, and the
# total count is not a safe proxy because it moves whenever a test is added.
#
# So the three are named and their status is read mechanically from the
# runner's own JSON report. This is additional evidence, not a substitute:
# the full suite above stays exactly as it is, and this runs after it.
#
# Four outcomes, and they are four. Executed and passed is the only one that
# qualifies. Skipped fails. Failed fails. Not found in the report fails,
# because a qualification that cannot find what it was looking for has
# established nothing.
# ---------------------------------------------------------------------------

Section 'D3b. Windows qualification: DeepTest runner-dependent tests must execute'
$qualFile = Join-Path $env:TEMP 'deeptest-python-qualification.json'
if (Test-Path $qualFile) { Remove-Item $qualFile -Force }
Push-Location "$root\DeepTest"
& npm run test -- --reporter=json "--outputFile=$qualFile" test/python-adapter.test.ts
$qualCode = $LASTEXITCODE
Pop-Location
if ($qualCode -ne 0) { Fail 'D3b. DeepTest python-adapter qualification run' $qualCode }
if (-not (Test-Path $qualFile)) {
  Disqualify 'The qualification run produced no JSON report, so it could not be established whether the three Windows-only tests executed.'
}

$report = Get-Content $qualFile -Raw | ConvertFrom-Json
$results = @()
foreach ($tr in $report.testResults) { foreach ($a in $tr.assertionResults) { $results += $a } }
if ($results.Count -eq 0) {
  Disqualify 'The qualification report contained no test results, so nothing could be established about the three Windows-only tests.'
}

# The three tests DeepTest skips when the interpreter has no coverage and
# pytest. Named exactly, from test/python-adapter.test.ts.
$mustRun = @(
  'end to end on the fixture: coverage.py contexts through the engine',
  'end to end: a project whose addopts turn on pytest-cov still runs its tests',
  'end to end: a pytest usage error is reported as a failed run, never as 0 passed')

$problems = @()
foreach ($name in $mustRun) {
  $hits = @($results | Where-Object { $_.title -eq $name -or $_.fullName -eq $name })
  if ($hits.Count -eq 0) {
    $problems += "NOT FOUND: `"$name`" is not in the qualification report. It may have been renamed, or the report shape may have changed."
    continue
  }
  foreach ($h in $hits) {
    if ($h.status -eq 'passed') {
      Write-Host ("  executed and passed: {0}" -f $name) -ForegroundColor Green
    } elseif ($h.status -eq 'failed') {
      $problems += "FAILED: `"$name`" ran and did not pass."
    } else {
      $problems += "SKIPPED (status '$($h.status)'): `"$name`" did not execute on Windows. Python with coverage and pytest must be available for this to be a Windows verification."
    }
  }
}
if ($problems.Count -gt 0) {
  Disqualify ($problems -join [Environment]::NewLine)
}
Write-Host 'All three runner-dependent tests executed and passed on Windows.' -ForegroundColor Green

# UntangleIt's `check` runs the package's own pinned tsc through npm, not
# npx, so the compiler is the 5.9.3 printed in section A2.
Step 'D4. UntangleIt: typecheck' "$root\UntangleIt" 'check'
Step 'D4. UntangleIt: tests'     "$root\UntangleIt" 'test'
Step 'D4. UntangleIt: build'     "$root\UntangleIt" 'build'

# Both gates already ran inside the suite above. They run again by themselves
# so the evidence is explicit rather than buried in a file list. The Angular
# Karma gate cannot launch Chrome in the Linux container; a failure HERE is a
# real verification failure and is not that limitation.
StepArgs 'D5. Browser gates: Angular Karma and Playwright component tests' "$root\UntangleIt" 'test' 'test/gate-browser.test.ts'

# ---------------------------------------------------------------------------
# E. The two observations the container could not make
#
# Counts are observations, not pass conditions, and nothing above required a
# number. These two are surfaced because they are what Windows adds.
# ---------------------------------------------------------------------------

Section 'E. Windows-only observations'
Write-Host '  1. DeepTest runner-dependent tests: established mechanically in D3b.'
Write-Host '     The three tests the container skips were named, their status was read'
Write-Host '     from the runner`s own report, and this run could not have reached here'
Write-Host '     unless all three executed and passed.'
Write-Host ''
Write-Host '  2. UntangleIt Angular Karma: it fails in the container because Chrome'
Write-Host '     never launches there. On Windows it must pass on its own merits.'
Write-Host '     Section D5 ran it by itself, so its result is unambiguous above.'
Write-Host ''
Write-Host 'Staging counts, for reference only and NOT a pass condition:' -ForegroundColor DarkGray
Write-Host '  complexity 104 | Witness 297 | DeepTest 397 passed + 3 skipped | UntangleIt 111 passed + 1 container-only failure' -ForegroundColor DarkGray
Write-Host 'If the Windows counts differ while everything passes, report the difference rather than treating it as failure.' -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# G. Final read-only integrity
# ---------------------------------------------------------------------------

Section 'G. Git HEADs after, read only'
$moved = @()
foreach ($p in $packages) {
  $h = "$(GitRead (Join-Path $root $p) @('rev-parse','HEAD') "G. $p rev-parse HEAD")".Trim()
  Write-Host ("{0,-13} {1}" -f $p, $h.Substring(0,7))
  if ($h -ne $headsBefore[$p]) { $moved += $p }
}
if ($moved.Count -gt 0) {
  Write-Host ("A HEAD moved during verification: {0}. That should be impossible here." -f ($moved -join ', ')) -ForegroundColor Red
  exit 1
}
Write-Host 'No HEAD moved during this verification.' -ForegroundColor Green

Section 'G2. Versions after, which must still be 1.0.19'
foreach ($p in $packages) {
  $v = (Get-Content (Join-Path $root "$p\package.json") -Raw | ConvertFrom-Json).version
  Write-Host ("{0,-13} {1}" -f $p, $v)
  if ($v -ne '1.0.19') { Write-Host 'A version moved during verification. Stopping.' -ForegroundColor Red; exit 1 }
}

Section 'G3. Working trees, read only'
# Reported, not judged and not touched. Build output and uncommitted Phase 1
# to 7 work are expected to show here.
foreach ($p in $packages) {
  Write-Host "-- $p"
  GitRead (Join-Path $root $p) @('status','--short') "G3. $p status --short"
}

Section 'G4. Tags at HEAD, read only'
# `tag --points-at` lists tags. It creates none.
foreach ($p in $packages) {
  $t = GitRead (Join-Path $root $p) @('tag','--points-at','HEAD') "G4. $p tag --points-at HEAD"
  if ($t) { Write-Host ("{0,-13} tags at HEAD: {1}" -f $p, (($t | ForEach-Object { "$_".Trim() }) -join ', ')) }
  else    { Write-Host ("{0,-13} no tag at HEAD" -f $p) }
}

# ---------------------------------------------------------------------------
# H. Final wording
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host 'Phase 7 Windows verification PASSED.' -ForegroundColor Green
Write-Host 'What this run establishes, and only this:' -ForegroundColor Green
Write-Host '  - every required command and both browser gates succeeded, with no failing test;' -ForegroundColor Green
Write-Host '  - the three DeepTest runner-dependent tests executed on Windows and passed, checked by name rather than by count;' -ForegroundColor Green
Write-Host '  - no HEAD moved between the start and the end of this run;' -ForegroundColor Green
Write-Host '  - every package version is still 1.0.19;' -ForegroundColor Green
Write-Host '  - this verification performed no commit, tag, push, package, install, release, or version-bump operation.' -ForegroundColor Green
Write-Host ''
Write-Host 'Phase 7 implementation passed authoritative Windows verification. No HEAD moved and all package versions remain 1.0.19. Phase 7 remains uncommitted and unreleased pending documentation closure.' -ForegroundColor Green
