# Polyglot 1.0.21 Phase 8, authoritative Windows verification.
#
# The global kill switch and the deterministic-only standing test. It
# establishes current facts about this tree; it repeats no claim from Phase
# 7's run.
#
# Read-only with respect to git. No commit, tag, push, checkout, reset,
# clean, restore, or any other git mutation. No packaging, no install, no
# release.ps1, no version bump, no source modification. Nothing under
# _phase8-experiments is touched, because E4, E5 and E6 are evidence until
# they reach the constitution, and nothing under .keepsafe is touched at
# all. The only files written are the ordinary build and test outputs each
# package already produces, plus two JSON reports in $env:TEMP.
#
# On fail-closed behaviour. $ErrorActionPreference = 'Stop' does NOT make a
# nonzero exit from a native executable terminate the script under Windows
# PowerShell 5.1. So every external command whose result contributes to the
# proof checks $LASTEXITCODE itself: node and npm in section A, each
# package's own tsc, every npm step through Step and StepArgs, the two
# qualification runs, and every read-only git call through GitRead.
#
# On counts. Nothing here requires a particular number. Success is that each
# command exited cleanly with no failing test, that the named Windows-only
# tests executed and passed, and that both browser gates passed on their own.
#
# On DeepTest\out. The staging tree and this tree differ in
# out\src\languages\typescript\coverage.js. That is generated output, out\ is
# ignored, and its TypeScript source is byte-identical. The build below
# regenerates it. It is not a pre-verification condition and nothing here
# checks it.

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
  Write-Host 'Stopping here. A Windows verification that did not run the tests it names has not verified them.' -ForegroundColor Red
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

# Runs one test file through the runner's JSON reporter and returns every
# assertion result in it.
#
# This reads the runner's own report. It re-implements no policy: what a
# test asserts is decided in the test, and this establishes only whether a
# named test executed and what its status was.
function QualificationResults($label, $dir, $file, $reportPath) {
  if (Test-Path $reportPath) { Remove-Item $reportPath -Force }
  Push-Location $dir
  & npm run test -- --reporter=json "--outputFile=$reportPath" $file
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail $label $code }
  if (-not (Test-Path $reportPath)) {
    Disqualify "$label produced no JSON report, so it could not be established whether its tests executed."
  }
  $report = Get-Content $reportPath -Raw | ConvertFrom-Json
  $results = @()
  foreach ($tr in $report.testResults) { foreach ($a in $tr.assertionResults) { $results += $a } }
  if ($results.Count -eq 0) {
    Disqualify "$label produced a report with no test results, so nothing could be established from it."
  }
  return $results
}

# Establishes that every named test EXECUTED and PASSED.
#
# Four outcomes, and they are four. Executed and passed is the only one that
# qualifies. Skipped fails. Failed fails. Not found in the report fails,
# because a qualification that cannot find what it was looking for has
# established nothing.
function RequireExecutedAndPassed($results, $names, $why) {
  $problems = @()
  foreach ($name in $names) {
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
        $problems += "SKIPPED (status '$($h.status)'): `"$name`" did not execute on Windows. $why"
      }
    }
  }
  if ($problems.Count -gt 0) { Disqualify ($problems -join [Environment]::NewLine) }
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
  if ($v -ne '1.0.19') { Write-Host 'Version moved. Phase 8 bumps nothing. Stopping.' -ForegroundColor Red; exit 1 }
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
# than no verification, because it reads as proof. These are the eight files
# Phase 8 created, taken from the transfer manifest rather than guessed.
# ---------------------------------------------------------------------------

Section 'C. Phase 8 files present?'
$added = @(
  'DeepTest\src\agent\killswitch.ts',
  'DeepTest\src\agent\killswitchReader.ts',
  'DeepTest\src\agent\mayOffer.ts',
  'DeepTest\test\agents-disabled.test.ts',
  'UntangleIt\src\agent\killswitch.ts',
  'UntangleIt\src\agent\killswitchReader.ts',
  'UntangleIt\src\agent\mayOffer.ts',
  'UntangleIt\test\agents-disabled.test.ts')
$missing = $added | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
  Write-Host 'Phase 8 is NOT on this tree. Missing:' -ForegroundColor Red
  $missing
  exit 1
}
Write-Host 'All 8 Phase 8 files are present.' -ForegroundColor Green

Section 'C2. Both settings contributed, one per product'
# The platform refused a shared property id, so each product owns its own.
# This reads the manifests; it decides nothing the tests decide.
$settingOf = @{ 'DeepTest' = 'deeptest.polyglot.agents.enabled'; 'UntangleIt' = 'untangleit.polyglot.agents.enabled' }
foreach ($p in 'DeepTest','UntangleIt') {
  $manifest = Get-Content (Join-Path $root "$p\package.json") -Raw | ConvertFrom-Json
  $prop = $manifest.contributes.configuration.properties.($settingOf[$p])
  if (-not $prop) { Write-Host "$p does not contribute $($settingOf[$p]). Stopping." -ForegroundColor Red; exit 1 }
  if ($prop.type -ne 'boolean' -or $prop.default -ne $true -or $prop.scope -ne 'application') {
    Write-Host "$p contributes $($settingOf[$p]) with the wrong shape. Stopping." -ForegroundColor Red
    exit 1
  }
  Write-Host ("{0,-11} {1}  boolean, default true, scope application" -f $p, $settingOf[$p]) -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# D. Whole-tree verification
#
# The full package suites, not a Phase 8 smoke test. The Phase 8 kill-state
# matrix, the ordering proofs, the deterministic-output comparison and the
# command-availability checks are inside these suites, which is where they
# belong: a separate run of only the new tests would prove the new tests and
# nothing about what they sit beside.
# ---------------------------------------------------------------------------

Step 'D1. complexity: typecheck' "$root\complexity" 'check'
Step 'D1. complexity: tests'     "$root\complexity" 'test'
Step 'D1. complexity: build'     "$root\complexity" 'build'

# Witness is untouched by Phase 8 and runs as regression evidence. The switch
# is extension-side and the shared library never learns it exists.
Step 'D2. Witness: typecheck' "$root\Witness" 'check'
Step 'D2. Witness: tests'     "$root\Witness" 'test'
Step 'D2. Witness: build'     "$root\Witness" 'build'

# DeepTest carries its half of the kill switch, the two gated propose
# commands, the participant gate and the standing test. It also runs the
# tests the container skips.
Step 'D3. DeepTest: typecheck' "$root\DeepTest" 'check'
Step 'D3. DeepTest: tests'     "$root\DeepTest" 'test'
Step 'D3. DeepTest: build'     "$root\DeepTest" 'build'

# ---------------------------------------------------------------------------
# D3b. The Windows qualification for DeepTest's runner-dependent tests
#
# Retained from Phase 7 unchanged in purpose. The full suite above already
# ran these. It cannot, on its own, prove they EXECUTED:
# `test.skipIf(!hasPython)` skips them silently when the interpreter has no
# `coverage` and `pytest`, the suite still passes, and the total count is not
# a safe proxy because it moves whenever a test is added.
#
# So the three are named and their status is read mechanically from the
# runner's own JSON report. This is additional evidence, not a substitute:
# the full suite above stays exactly as it is, and this runs after it.
# ---------------------------------------------------------------------------

Section 'D3b. Windows qualification: DeepTest runner-dependent tests must execute'
$pyResults = QualificationResults 'D3b. DeepTest python-adapter qualification run' "$root\DeepTest" 'test/python-adapter.test.ts' (Join-Path $env:TEMP 'deeptest-python-qualification.json')
RequireExecutedAndPassed $pyResults @(
  'end to end on the fixture: coverage.py contexts through the engine',
  'end to end: a project whose addopts turn on pytest-cov still runs its tests',
  'end to end: a pytest usage error is reported as a failed run, never as 0 passed'
) 'Python with coverage and pytest must be available for this to be a Windows verification.'
Write-Host 'All three runner-dependent tests executed and passed on Windows.' -ForegroundColor Green

# UntangleIt's `check` runs the package's own pinned tsc through npm, not
# npx, so the compiler is the version printed in section A2.
Step 'D4. UntangleIt: typecheck' "$root\UntangleIt" 'check'
Step 'D4. UntangleIt: tests'     "$root\UntangleIt" 'test'
Step 'D4. UntangleIt: build'     "$root\UntangleIt" 'build'

# ---------------------------------------------------------------------------
# D5. The browser gates, each established by name
#
# Phase 7 ran the gate file and took its exit code. That is sound for a
# failure and weak for a pass: a gate that skipped would leave the file
# green. Both gates are therefore named and read from the runner's report,
# the same mechanism D3b uses, so neither result is inferred from the other
# or from a parent suite.
#
# The Angular Karma gate cannot launch Chrome in the Linux container. A
# failure HERE is a real verification failure and is not that limitation.
# ---------------------------------------------------------------------------

Section 'D5. Browser gates, each established by name'
$gateResults = QualificationResults 'D5. Browser gate qualification run' "$root\UntangleIt" 'test/gate-browser.test.ts' (Join-Path $env:TEMP 'untangleit-browser-qualification.json')
RequireExecutedAndPassed $gateResults @(
  'Angular Karma: a recorded run reaches the page and comes back',
  'Playwright component tests: a boundary inside the page is recorded'
) 'A browser gate that did not run has not been verified on Windows.'
Write-Host 'Both browser gates executed and passed on Windows, independently.' -ForegroundColor Green

# ---------------------------------------------------------------------------
# D6. The Phase 8 standing test, established by name
#
# The full suites above already ran it. This names the load-bearing
# assertions and reads their status from the runner's report, so a renamed,
# deleted or skipped standing test cannot leave this verification green.
#
# It re-implements none of the policy. What each test asserts is decided
# inside the test; this establishes only that the test executed and passed.
# ---------------------------------------------------------------------------

Section 'D6. Phase 8 standing test: DeepTest'
$dtStanding = QualificationResults 'D6. DeepTest agents-disabled qualification run' "$root\DeepTest" 'test/agents-disabled.test.ts' (Join-Path $env:TEMP 'deeptest-agents-disabled.json')
$matrixAndGates = @(
  'the effective state: both on',
  'the effective state: DeepTest off disables everything',
  'the effective state: UntangleIt off disables everything',
  'the effective state: both off',
  'the effective state: DeepTest alone, on',
  'the effective state: DeepTest alone, off',
  'the effective state: UntangleIt alone, on',
  'the effective state: UntangleIt alone, off',
  'the effective state: neither registered',
  'an explicit false from either installed product gates this product',
  'an unregistered key carrying a stale false is ignored, never obeyed',
  'the two key names are the contributed ones, and each product owns its namespace',
  'every layer asks the same conjunction',
  'no caller asks the editor directly any more',
  'the gate refuses without writing, taking a checkpoint or asking anything',
  'the participant checks the switch before it consumes the pending attempt',
  'a disabled turn sends nothing and names no single product setting',
  'the switch mutates no packet, constraint, validator or record',
  'the deterministic product does not import the switch',
  'a real deterministic measurement is identical with agents enabled and disabled',
  'every deterministic command is still contributed, and none of them is agentic')
RequireExecutedAndPassed $dtStanding ($matrixAndGates + @('both propose commands gate before any side effect')) 'The Phase 8 standing test must run on Windows for this to be a Phase 8 verification.'

Section 'D7. Phase 8 standing test: UntangleIt'
$uiStanding = QualificationResults 'D7. UntangleIt agents-disabled qualification run' "$root\UntangleIt" 'test/agents-disabled.test.ts' (Join-Path $env:TEMP 'untangleit-agents-disabled.json')
RequireExecutedAndPassed $uiStanding ($matrixAndGates + @('both untangle paths gate before any side effect')) 'The Phase 8 standing test must run on Windows for this to be a Phase 8 verification.'
Write-Host 'The effective kill state, the gate ordering and the deterministic-output comparison were established in both products.' -ForegroundColor Green

# ---------------------------------------------------------------------------
# E. What Windows adds
# ---------------------------------------------------------------------------

Section 'E. Windows-only observations'
Write-Host '  1. DeepTest runner-dependent tests: established mechanically in D3b.'
Write-Host '     The three tests the container skips were named, their status was read'
Write-Host '     from the runner`s own report, and this run could not have reached here'
Write-Host '     unless all three executed and passed.'
Write-Host ''
Write-Host '  2. UntangleIt Angular Karma: it fails in the container because Chrome'
Write-Host '     never launches there. Section D5 named it and read its status, so its'
Write-Host '     result is established rather than inferred from a file passing.'
Write-Host ''
Write-Host 'Counts are observations, not pass conditions. Nothing above required a number.' -ForegroundColor DarkGray
Write-Host 'If the Windows counts differ from staging while everything passes, report the difference rather than treating it as failure.' -ForegroundColor DarkGray

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
# Reported, not judged and not touched. Build output and the uncommitted
# Phase 1 to 8 work are expected to show here. Phase 8 is deliberately
# uncommitted, so a dirty tree is the correct state and not a finding.
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
Write-Host 'Phase 8 Windows verification PASSED.' -ForegroundColor Green
Write-Host 'What this run establishes, and only this:' -ForegroundColor Green
Write-Host '  - every required command succeeded, with no failing test;' -ForegroundColor Green
Write-Host '  - the three DeepTest runner-dependent tests executed on Windows and passed, checked by name rather than by count;' -ForegroundColor Green
Write-Host '  - both browser gates executed and passed on Windows, each established by name rather than inferred;' -ForegroundColor Green
Write-Host '  - the Phase 8 standing test executed and passed in both products, including the effective kill-state matrix, the unregistered-peer and stale-orphan cases, the gate ordering, and the deterministic-output comparison;' -ForegroundColor Green
Write-Host '  - no HEAD moved between the start and the end of this run;' -ForegroundColor Green
Write-Host '  - every package version is still 1.0.19;' -ForegroundColor Green
Write-Host '  - this verification performed no commit, tag, push, package, install, release, or version-bump operation.' -ForegroundColor Green
Write-Host ''
Write-Host 'Phase 8 implementation passed authoritative Windows verification. No HEAD moved and all package versions remain 1.0.19. Phase 8 remains uncommitted and unreleased pending documentation closure.' -ForegroundColor Green
