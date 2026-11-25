# Polyglot 1.0.21 Phase 9, authoritative Windows verification.
#
# The deterministic release governance test. It establishes current facts
# about this tree; it repeats no claim from the Phase 7 or Phase 8 runs.
#
# Read-only with respect to git. No commit, tag, push, checkout, reset,
# clean, restore, or any other git mutation. No packaging, no install, no
# version bump, no source modification, nothing under .keepsafe. The only
# files written are the ordinary build and test outputs each package already
# produces, plus the JSON reports in $env:TEMP.
#
# release.ps1 IS run here, twice with -GovernanceOnly and twice expecting a
# parameter-guard rejection. -GovernanceOnly performs no writes and stops
# before Phase 0, and this script proves that rather than assuming it: no
# mirror is written, no version moves, no VSIX changes.
#
# On fail-closed behaviour. $ErrorActionPreference = 'Stop' does NOT make a
# nonzero exit from a native executable terminate the script under Windows
# PowerShell 5.1. So every external command whose result contributes to the
# proof checks $LASTEXITCODE itself.
#
# On running release.ps1 in a CHILD PowerShell PROCESS. Three reasons, and
# each one is a defect avoided rather than a preference.
#
#   1. release.ps1 fails by THROWING. A throw caught in this process would be
#      indistinguishable from any other terminating error, so an expected
#      rejection would be recorded as a verification failure and a correct
#      product would be reported as broken.
#   2. release.ps1 ends -GovernanceOnly with `exit 0`. In this process that
#      would terminate THIS script at the first release check, and everything
#      after it would silently never run.
#   3. A child process turns both a throw and an exit into one ordinary exit
#      code, so $LASTEXITCODE means something again.
#
# On what an expected failure has to prove. A nonzero exit is not enough: a
# typo in a path also exits nonzero. Each expected rejection therefore names
# the boundary it must have reached and the boundary it must NOT have passed,
# read from release.ps1's own output. A rejection that happened somewhere
# else is a verification failure, not a pass.
#
# On counts. Nothing here requires a particular number. Success is that each
# command exited as specified, that every named test executed and passed, and
# that both browser gates and the runner-dependent tests passed on their own.

$ErrorActionPreference = 'Stop'

# The toolkit root is where THIS script sits, not a path typed in here.
#
# There is a live disagreement about that path. The Phase 7 and Phase 8
# verifiers use C:\workspace\MikeVans_AI_Development_Toolkit, and
# release.ps1 assigns C:\workspace\MikeVan's AI Development Toolkit. One of
# them is stale. Hardcoding either would mean verifying a tree nobody is
# releasing, or releasing a tree nobody is verifying, so this script resolves
# its own location and section A2 below reports the disagreement instead of
# picking a side.
$root = Split-Path -Parent $PSCommandPath
if ([string]::IsNullOrWhiteSpace($root)) {
  Write-Host 'FAILED: this script could not resolve its own location, so it cannot know which toolkit it is verifying.' -ForegroundColor Red
  exit 1
}
$packages = @('complexity', 'Witness', 'DeepTest', 'UntangleIt', 'MADTPackage')
$gate = "$root\MADTPackage"
$releaseScript = "$gate\scripts\release.ps1"
$redRoot = "$gate\test\fixtures\root-red"

# The host this script is running under, so the child runs the same one.
$psHost = if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh' } else { 'powershell.exe' }

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
# This reads the runner's own report. It re-implements no policy: what a test
# asserts is decided in the test, and this establishes only whether a named
# test executed and what its status was.
# $script is the package's own npm script: 'test' for the four packages,
# 'test:governance' for MADTPackage, which has no 'test'. $file may be empty,
# in which case the whole suite runs; an empty string passed through to the
# runner as an argument is not the same thing and would break it.
function QualificationResults($label, $dir, $script, $file, $reportPath) {
  if (Test-Path $reportPath) { Remove-Item $reportPath -Force }
  Section $label
  Push-Location $dir
  if ([string]::IsNullOrWhiteSpace($file)) {
    & npm run $script -- --reporter=json "--outputFile=$reportPath"
  } else {
    & npm run $script -- --reporter=json "--outputFile=$reportPath" $file
  }
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
# The names are the runner's own `fullName`, which joins the suite title and
# the test title with a single SPACE. Not ' > '. Writing them with ' > ' makes
# every lookup a NOT FOUND, which would disqualify a correct tree, so these
# were taken from real reports rather than transcribed by hand.
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
# release.ps1 in a child process. See the header for why.
#
# Returns the exit code and the whole combined output, so the caller can
# establish WHERE a run stopped and not merely that it stopped.
# ---------------------------------------------------------------------------
function InvokeRelease($releaseArgs) {
  $childArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $releaseScript) + $releaseArgs

  # **Why this helper intentionally treats the child's stderr as captured data.**
  #
  # The child is EXPECTED to fail in three of the four release checks, and a
  # failing release.ps1 reports that on stderr. Merging stderr into this
  # pipeline with 2>&1 turns each line into an ErrorRecord, and under
  # $ErrorActionPreference = 'Stop' processing one of those raises a
  # terminating NativeCommandError that aborts the capture. That destroyed the
  # very observation C2 exists to make: the verifier stopped while trying to
  # watch an intentional failure, and recorded neither the exit code nor the
  # markers. release.ps1 warns about this same trap where it refuses to
  # redirect git's stderr.
  #
  # So here, and only here, the child's stderr is data to record rather than a
  # condition to stop on. It is still captured, still returned, and still
  # required by RequireRejection to contain the markers that prove where the
  # child stopped. Nothing is suppressed and no error becomes a pass.
  $global:LASTEXITCODE = $null
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'

  try {
    $text = & $psHost @childArgs 2>&1 | Out-String
    $code = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previous
  }

  # A child that never started sets no exit code. That is a launch failure,
  # not an expected rejection, and it must not read as one.
  if ($null -eq $code) {
    throw "The child PowerShell ($psHost) did not run, so nothing can be established about release.ps1."
  }

  return @{ Code = $code; Output = $text }
}

# The markers this verification reads out of release.ps1's own output. Each
# one is a line the script already prints or throws; none is added for this.
$PREFLIGHT_MARKER = 'MADTPackage: governance dependency preflight'
$GATE_MARKER = 'MADTPackage: release governance gate'
$GATE_FAILED_MARKER = 'FAILED: MADTPackage: release governance gate'
$STOPPED_MARKER = 'Stopping before Phase 0'
$PHASE0_MARKER = 'library: mirror'
$FIXTURE_GUARD = '-GovernanceFixtureRoot is only accepted with -GovernanceOnly'
$INTENT_GUARD = '-GovernanceOnly is verification only'

# Establishes that a release invocation was REJECTED, at the intended
# boundary and no other.
#
#   the command succeeded              -> FAIL, and the loudest kind
#   it failed, having reached $reached -> PASS
#   it failed without reaching it      -> FAIL, the wrong failure
#   it got past $mustNotReach          -> FAIL, it went too far
function RequireRejection($label, $releaseArgs, $reached, $mustNotReach, $why) {
  Section $label
  $run = InvokeRelease $releaseArgs
  if ($run.Code -eq 0) {
    Write-Host $run.Output
    Disqualify "$label SUCCEEDED. $why"
  }
  foreach ($marker in $reached) {
    if ($run.Output -notlike "*$marker*") {
      Write-Host $run.Output
      Disqualify "$label failed with exit $($run.Code), but its output never shows `"$marker`". It failed somewhere earlier than the boundary this check is about, so it establishes nothing about that boundary."
    }
  }
  foreach ($marker in $mustNotReach) {
    if ($run.Output -like "*$marker*") {
      Write-Host $run.Output
      Disqualify "$label failed, but its output shows `"$marker`", so it ran past the point it should have stopped at."
    }
  }
  Write-Host "  rejected at the intended boundary (exit $($run.Code))." -ForegroundColor Green
}

function ToolkitVersions {
  $out = @()
  foreach ($name in $packages) {
    $v = (Get-Content "$root\$name\package.json" -Raw | ConvertFrom-Json).version
    $out += "$name=$v"
  }
  return $out | Sort-Object
}

function VsixFingerprints {
  Get-ChildItem -Path $root -Recurse -Filter *.vsix -ErrorAction SilentlyContinue |
    ForEach-Object { "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)" } | Sort-Object
}

function MirrorFingerprints {
  $out = @()
  foreach ($d in @("$root\DeepTest\docs", "$root\UntangleIt\docs", "$root\complexity\docs", "$root\Witness\docs")) {
    if (-not (Test-Path $d)) { continue }
    foreach ($f in Get-ChildItem -Path $d -Recurse -Filter *.md -ErrorAction SilentlyContinue) {
      $out += "$($f.FullName)|$((Get-FileHash $f.FullName -Algorithm SHA256).Hash)"
    }
  }
  if (Test-Path "$root\MADTPackage\ROADMAP.md") {
    $out += "$root\MADTPackage\ROADMAP.md|$((Get-FileHash "$root\MADTPackage\ROADMAP.md" -Algorithm SHA256).Hash)"
  }
  return $out | Sort-Object
}

Write-Host 'Polyglot 1.0.21 Phase 9, authoritative Windows verification' -ForegroundColor Green
Write-Host "Toolkit: $root"
Write-Host "PowerShell: $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition)); child runs: $psHost"
Write-Host 'Nothing here commits, tags, pushes, packages, installs, or bumps a version.'

# ---------------------------------------------------------------------------
# A. The tree is the one this verification is about
# ---------------------------------------------------------------------------
Section 'A1. Every package and the Phase 9 files are present'
foreach ($name in $packages) {
  if (-not (Test-Path "$root\$name\package.json")) { Disqualify "Missing package: $root\$name" }
}
foreach ($required in @(
  "$gate\test\governance.test.ts",
  "$gate\test\controls.test.ts",
  "$gate\test\releaseScript.test.ts",
  "$gate\test\program.ts",
  "$gate\test\invariants\releaseScript.ts",
  "$redRoot\DeepTest\src\ui\reportPanel.ts",
  $releaseScript,
  "$root\DeepTest\src\agent\explainInteraction.ts",
  "$root\UntangleIt\src\agent\explainInteraction.ts"
)) {
  if (-not (Test-Path $required)) { Disqualify "Missing Phase 9 file: $required" }
}
Write-Host 'Present.' -ForegroundColor Green

Section 'A2. release.ps1 derives its root, and does not name one'
# The contract this replaced. release.ps1 used to assign an absolute path,
# and the one it named was the path the workspace had already moved away
# from, so a release would have acted on a tree nobody verifies. The fix is
# not a better constant: it is that there is no constant. The script resolves
# the root from its own location, which is what the governance gate already
# does from MADTPackage\test, so a workspace that moves takes the release
# script with it.
#
# This checks the contract, not a value. An absolute path reappearing in the
# assignment fails whatever path it names, including this one.
$releaseText = Get-Content $releaseScript -Raw
$rootLine = ($releaseText -split "`n" | Where-Object { $_ -match '^\s*\$root\s*=' } | Select-Object -First 1)
if (-not $rootLine) {
  Disqualify 'release.ps1 does not assign $root at the top level, so which tree it would act on cannot be established.'
}
$assignment = ($rootLine -replace '^\s*\$root\s*=\s*', '').Trim()
Write-Host "  release.ps1 says: `$root = $assignment"
if ($assignment -match '[A-Za-z]:\\') {
  Disqualify @"
release.ps1 names an absolute toolkit root again:

  $assignment

The root is derived from `$PSScriptRoot, never typed in. A named path breaks
the moment the workspace moves, and the workspace has already moved once,
for a reason the product itself recommends to customers.
"@
}
if ($assignment -notmatch '\$PSScriptRoot') {
  Disqualify "release.ps1's `$root is `"$assignment`", which does not derive from `$PSScriptRoot. It must resolve the toolkit from where the script sits."
}
if ($releaseText -notmatch "MADTPackage\\library") {
  Disqualify 'release.ps1 derives a root but never proves the derived location is a toolkit. A silently wrong root is worse than a wrong typed one.'
}
Write-Host 'Derived, guarded, and no absolute root named.' -ForegroundColor Green

Section 'A3. MADTPackage governance dependencies are installed'
foreach ($needed in @("$gate\node_modules\typescript", "$gate\node_modules\@projectrevivesolutions\witness")) {
  if (-not (Test-Path $needed)) {
    Disqualify "Missing: $needed. Run npm ci in Witness, then in MADTPackage. release.ps1 installs nothing and neither does this."
  }
}
Write-Host 'Installed.' -ForegroundColor Green

# ---------------------------------------------------------------------------
# B. The gate against the real tree, then its load-bearing rows by name
# ---------------------------------------------------------------------------
$governanceReport = Join-Path $env:TEMP 'phase9-governance.json'
$govResults = QualificationResults 'B1. The release governance gate, against the real toolkit' $gate 'test:governance' '' $governanceReport

Section 'B2. The Windows-authoritative rows M to P executed and passed'
# The PowerShell parser is a .NET type, so in a container these report
# not-run. A green exit code there looks identical to a green exit code here.
# This is the difference.
RequireExecutedAndPassed $govResults @(
  'rows M to P: release.ps1 cannot reach Phase 0 before a green gate the release script this proof is about exists',
  'rows M to P: release.ps1 cannot reach Phase 0 before a green gate the six landmarks are in order, and the shape is one this proof models'
) 'These rows can only run where a PowerShell parser exists, which is why Windows is the only place they are authoritative. A skip here is a verification failure.'

Section 'B3. The load-bearing container rows executed and passed, by name'
RequireExecutedAndPassed $govResults @(
  'row G: no send without a redeemable capability (rule 49) the governed middle redeems before it sends',
  "row H: registry completeness DeepTest's production specs are registered, valid and reachable",
  "row H: registry completeness UntangleIt's production specs are registered, valid and reachable",
  'row L: no model-derived source change is applied the live write and proposal surface is exactly what was approved'
) 'A row that silently skipped would leave the gate green while proving nothing.'

Section 'B3a. The remaining A to L rows executed and passed, by name'
# **Why this exists.** B1 establishes three things and no more: the gate
# exited zero, it wrote a report, and that report holds at least one result.
# It never checks that any particular row is IN the report. So until this
# section, rows A to F, I, J and K were carried by the closing summary line
# alone, which is hard-coded prose and is computed from nothing. A row that
# was skipped, renamed, or never wired into the suite would have left the
# gate green and the summary still claiming it passed. That is not a theory:
# rows M to P reported green for weeks without ever executing, which is why
# B2 exists. This is the same check for every row B2 and B3 did not name.
#
# Rows A to F and Q have no separate identities to name. The suite proves
# the transport primitives as one boundary per package, so the three names
# below ARE rows A to F, once for each inspected package. Row Q rides the
# same three identities. The governance tests were not changed to split
# them.
RequireExecutedAndPassed $govResults @(
  'rows A to F and Q: the protected transport primitives DeepTest holds the transport boundary',
  'rows A to F and Q: the protected transport primitives UntangleIt holds the transport boundary',
  'rows A to F and Q: the protected transport primitives Witness holds the transport boundary',
  "row I: the agentic entry points, derived from the sinks DeepTest's entry points are all attributable",
  "row I: the agentic entry points, derived from the sinks UntangleIt's entry points are all attributable",
  'row J: the kill switch cannot be walked around DeepTest gates every agentic path',
  'row J: the kill switch cannot be walked around UntangleIt gates every agentic path',
  'row K: governance persistence DeepTest records what it governs, in one store, in the right order',
  'row K: governance persistence UntangleIt records what it governs, in one store, in the right order',
  'row K: governance persistence Witness records what it governs, in one store, in the right order'
) 'A row that silently skipped would leave the gate green while proving nothing.'

Section 'B4. The negative controls behaved as specified'
# A control that only ever passes is worth as much as one that only ever
# fires, so both directions are named: the eight that must turn the gate red
# and the three misclassifications that must not.
$controlResults = QualificationResults 'B4. Negative control qualification run' $gate 'test:governance' 'test/controls.test.ts' (Join-Path $env:TEMP 'phase9-controls.json')
RequireExecutedAndPassed $controlResults @(
  'must fail: the transport boundary a model send outside the adapter',
  'must fail: the transport boundary the same API through a renamed namespace import',
  'must fail: the transport boundary availability detection turned into selection',
  'must fail: the transport boundary the deleted clipboard hand-off returning',
  'must fail: the transport boundary a chat command that sends for the person',
  'must fail: the transport boundary an unresolvable command id on an agent path fails closed',
  'must fail: the transport boundary a model type constructed outside the adapter',
  'must fail: the transport boundary the deleted local hand-off returning',
  'must fail: source application an editor apply primitive anywhere in production',
  'must fail: source application a new synchronous node:fs writer outside the equality set',
  'must fail: source application the asynchronous node:fs writeFile a *Sync-shaped list misses',
  'must fail: source application the second family: a VS Code workspace filesystem write',
  'must fail: source application an open whose mode cannot be resolved fails closed',
  'must not fail: the three misclassifications this plan made RegExp.exec is not process execution',
  'must not fail: the three misclassifications this plan made a property named writeFile on an unrelated object is not node:fs',
  'must not fail: the three misclassifications this plan made a property named lm on an unrelated object is not vscode.lm'
) 'A control that did not run has established nothing about the gate.'

# ---------------------------------------------------------------------------
# C. Release control: one green path, three rejections
# ---------------------------------------------------------------------------
Section 'C1. release.ps1 -GovernanceOnly passes the gate and stops before Phase 0'
$vsixBefore = VsixFingerprints
$versionsBefore = ToolkitVersions
$mirrorsBefore = MirrorFingerprints

$green = InvokeRelease @('-GovernanceOnly')
if ($green.Code -ne 0) {
  Write-Host $green.Output
  Fail 'C1. release.ps1 -GovernanceOnly' $green.Code
}
foreach ($marker in @($PREFLIGHT_MARKER, $GATE_MARKER, $STOPPED_MARKER)) {
  if ($green.Output -notlike "*$marker*") {
    Write-Host $green.Output
    Disqualify "C1 exited 0 but its output never shows `"$marker`", so it cannot be established that the gate ran at all."
  }
}
if ($green.Output -like "*$PHASE0_MARKER*") {
  Write-Host $green.Output
  Disqualify 'C1 reached the Phase 0 mirror loop. -GovernanceOnly must stop before it.'
}
if (Compare-Object $vsixBefore (VsixFingerprints)) { Disqualify 'C1 changed a VSIX.' }
if (Compare-Object $versionsBefore (ToolkitVersions)) { Disqualify 'C1 moved a package version.' }
if (Compare-Object $mirrorsBefore (MirrorFingerprints)) { Disqualify 'C1 rewrote a mirrored document.' }
Write-Host 'Gate ran, script stopped before Phase 0, and nothing was mirrored, versioned, built, packaged, installed, committed, or tagged.' -ForegroundColor Green

RequireRejection 'C2. the red fixture root reaches the real gate and the gate rejects it' `
  @('-GovernanceOnly', '-GovernanceFixtureRoot', $redRoot) `
  @($PREFLIGHT_MARKER, $GATE_MARKER, $GATE_FAILED_MARKER) `
  @($STOPPED_MARKER, $PHASE0_MARKER) `
  'That root carries one known violation, a model send outside the transport adapter. A release that passes it is a release gate that proves nothing.'

RequireRejection 'C3. a fixture root without -GovernanceOnly is refused by the parameter guard' `
  @('-GovernanceFixtureRoot', $redRoot) `
  @($FIXTURE_GUARD) `
  @($PREFLIGHT_MARKER, $GATE_MARKER, $PHASE0_MARKER) `
  'A normal release always inspects the real toolkit and has no parameter that can change that.'

RequireRejection 'C4. -GovernanceOnly with release intent is refused by the parameter guard' `
  @('-GovernanceOnly', '-Commit', '-Version', '1.0.19', '-Subject', 'not a release') `
  @($INTENT_GUARD) `
  @($PREFLIGHT_MARKER, $GATE_MARKER, $PHASE0_MARKER) `
  'A command that looks like a release must not succeed after doing only verification.'

# ---------------------------------------------------------------------------
# D. The package suites, and the gates that a green suite does not establish
# ---------------------------------------------------------------------------
Step 'D1. complexity: tests' "$root\complexity" 'test'
Step 'D2. Witness: tests' "$root\Witness" 'test'
Step 'D3. DeepTest: tests' "$root\DeepTest" 'test'
Step 'D4. UntangleIt: tests' "$root\UntangleIt" 'test'

# The runner-dependent DeepTest tests skip themselves when the interpreter has
# no coverage and pytest. The suite still passes and the total count is not a
# safe proxy, because it moves whenever a test is added. So they are named and
# their status is read from the runner's own report. This is additional
# evidence, not a substitute: D3 above stays exactly as it is.
Section 'D5. DeepTest runner-dependent tests must execute on Windows'
$pyResults = QualificationResults 'D5. DeepTest python-adapter qualification run' "$root\DeepTest" 'test' 'test/python-adapter.test.ts' (Join-Path $env:TEMP 'deeptest-python-qualification.json')
RequireExecutedAndPassed $pyResults @(
  'end to end on the fixture: coverage.py contexts through the engine',
  'end to end: a project whose addopts turn on pytest-cov still runs its tests',
  'end to end: a pytest usage error is reported as a failed run, never as 0 passed'
) 'Python with coverage and pytest must be available for this to be a Windows verification.'

# Both browser gates, each established on its own rather than inferred from
# the file's exit code or from each other. Neither can launch Chrome in the
# Linux container, so a failure HERE is a real verification failure and is not
# that limitation.
Section 'D6. Browser gates, each established by name'
$gateResults = QualificationResults 'D6. Browser gate qualification run' "$root\UntangleIt" 'test' 'test/gate-browser.test.ts' (Join-Path $env:TEMP 'untangleit-browser-qualification.json')
RequireExecutedAndPassed $gateResults @(
  'Angular Karma: a recorded run reaches the page and comes back',
  'Playwright component tests: a boundary inside the page is recorded'
) 'A browser gate that did not run has not been verified on Windows.'

# The finding.explain fix, named. The suites above already ran these; this
# establishes that they executed rather than that a file was green.
Section 'D7. The finding.explain fix, established by name in both products'
$dtExplain = QualificationResults 'D7. DeepTest explain-interaction qualification run' "$root\DeepTest" 'test' 'test/explain-interaction.test.ts' (Join-Path $env:TEMP 'deeptest-explain.json')
RequireExecutedAndPassed $dtExplain @(
  'a run that stopped before the tests started explains as a failure',
  'a run whose cause was never established still explains as a failure',
  'a measured finding explains as a finding, not as a failure',
  'the finding path therefore receives the finding validator set, including V-response-shape',
  'and the failure path keeps its own, narrower set',
  'both explanations stay explanations: neither proposes and neither needs authorization'
) 'The fix is the reason row H is green; a skipped test would leave both green and prove neither.'

$uiExplain = QualificationResults 'D7. UntangleIt explain-interaction qualification run' "$root\UntangleIt" 'test' 'test/explain-interaction.test.ts' (Join-Path $env:TEMP 'untangleit-explain.json')
RequireExecutedAndPassed $uiExplain @(
  'the finding packet this product really builds exists',
  'a run whose cause was never established explains as a failure',
  'a measured finding explains as a finding, not as a failure',
  'the finding path therefore receives the finding validator set, including V-response-shape',
  'and the failure path keeps its own, narrower set',
  'both explanations stay explanations: neither proposes and neither needs authorization'
) 'The fix is the reason row H is green; a skipped test would leave both green and prove neither.'

# ---------------------------------------------------------------------------
# E. Versions and git, both read-only
# ---------------------------------------------------------------------------
Section 'E1. Every package is still 1.0.19'
foreach ($pair in ToolkitVersions) {
  Write-Host "  $pair"
  if ($pair -notmatch '=1\.0\.19$') { Disqualify "$pair. Phase 9 bumps nothing." }
}
Write-Host 'Unchanged.' -ForegroundColor Green

Section 'E2. HEADs and working trees, read only'
foreach ($name in $packages) {
  $dir = "$root\$name"
  $head = (GitRead $dir @('rev-parse', 'HEAD') "$name HEAD") -join ''
  $branch = (GitRead $dir @('rev-parse', '--abbrev-ref', 'HEAD') "$name branch") -join ''
  $dirty = GitRead $dir @('status', '--porcelain') "$name status"
  Write-Host ("  {0,-12} {1} on {2}" -f $name, $head.Substring(0, 12), $branch)
  if ($dirty) {
    Write-Host '    uncommitted, which is expected until Michael commits Phase 9:' -ForegroundColor Yellow
    foreach ($line in $dirty) { Write-Host "      $line" -ForegroundColor Yellow }
  }
}

Write-Host ''
Write-Host 'Phase 9 verification PASSED.' -ForegroundColor Green
Write-Host 'Rows A to L and rows M to P all executed and passed on Windows. The negative controls behaved as specified in both directions. release.ps1 passed the real gate and stopped before Phase 0, and all three rejections happened at the boundary they were supposed to.'
Write-Host 'Nothing was committed, tagged, pushed, packaged, installed, or version-bumped.'
exit 0
