param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectPath = ".",

  [switch]$SkipBenchmarks
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) {
  Write-Host "FAILED: $Message" -ForegroundColor Red
  throw $Message
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @()
  )

  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $FilePath @Arguments
  $Code = $LASTEXITCODE
  if ($Code -ne 0) {
    Fail "$Label failed with exit code $Code. Later gates were not executed."
  }
}

$Project = (Resolve-Path -LiteralPath $ProjectPath).Path
$PackageJsonPath = Join-Path $Project "package.json"
if (-not (Test-Path -LiteralPath $PackageJsonPath -PathType Leaf)) {
  Fail "package.json not found. Pass -ProjectPath pointing to the project root."
}

Set-Location -LiteralPath $Project
$Package = Get-Content -LiteralPath $PackageJsonPath -Raw | ConvertFrom-Json
$AppVersion = [string]$Package.version
if ($AppVersion -notmatch '^\d+\.\d+\.\d+(?:-rc\.\d+)?$') {
  Fail "Unsupported version format '$AppVersion'. Expected X.Y.Z or X.Y.Z-rc.N."
}

$LogPath = Join-Path $Project ("FINAL_RELEASE_VALIDATION_{0}_{1}.log" -f ($AppVersion -replace '[^0-9A-Za-z.-]', '_'), (Get-Date -Format "yyyyMMdd_HHmmss"))
Start-Transcript -LiteralPath $LogPath -Force | Out-Null

try {
  Write-Host "INTELIGENTNY KALENDARZ - COMPLETE LOCAL PRE-PUBLICATION GATE" -ForegroundColor Green
  Write-Host "Version: $AppVersion"
  Write-Host "Project: $Project"
  Write-Host "Log:     $LogPath"

  $Node = (Get-Command node.exe -ErrorAction Stop).Source
  $Npm  = (Get-Command npm.cmd  -ErrorAction Stop).Source

  Write-Host "`n=== HOST TOOLCHAIN ===" -ForegroundColor Cyan
  $NodeVersion = (& $Node --version).Trim()
  if ($LASTEXITCODE -ne 0) { Fail "node --version failed" }
  $NpmVersion = (& $Npm --version).Trim()
  if ($LASTEXITCODE -ne 0) { Fail "npm --version failed" }
  Write-Host "Node: $NodeVersion"
  Write-Host "npm:  $NpmVersion"

  $NodeMajor = [int](($NodeVersion.TrimStart('v')).Split('.')[0])
  if ($NodeMajor -lt 22) {
    Fail "Node 22 or newer is required for this local validation; current major is $NodeMajor."
  }
  if ($NodeMajor -ne 22) {
    Write-Host "WARNING: Local validation is running on Node $NodeMajor. GitHub Pages CI uses Node 22, so exact CI parity will be verified later by GitHub Actions." -ForegroundColor Yellow
  }

  Write-Host "`n=== VERSION METADATA ===" -ForegroundColor Cyan
  $VersionText = Get-Content -LiteralPath ".\src\core\version.ts" -Raw
  if ($VersionText -notmatch "APP_VERSION = '([^']+)'") { Fail "APP_VERSION not found in src/core/version.ts" }
  if ($Matches[1] -ne $AppVersion) { Fail "package.json version '$AppVersion' differs from APP_VERSION '$($Matches[1])'" }
  if ($VersionText.Contains('APP_BUILD') -or $VersionText.Contains('APP_STAGE')) { Fail "Obsolete APP_BUILD/APP_STAGE metadata returned to app version module" }
  if ($VersionText -notmatch 'DATABASE_SCHEMA_VERSION = (\d+)') { Fail "DATABASE_SCHEMA_VERSION not found" }
  $SchemaVersion = [int]$Matches[1]

  $BuildInfo = Get-Content -LiteralPath ".\BUILD_INFO.json" -Raw | ConvertFrom-Json
  if ($BuildInfo.appVersion -ne $AppVersion) { Fail "BUILD_INFO.json appVersion differs from package.json" }
  $ExpectedChannel = if ($AppVersion -match '-rc\.\d+$') { 'release-candidate' } else { 'stable' }
  if ($BuildInfo.channel -ne $ExpectedChannel) { Fail "BUILD_INFO.json channel '$($BuildInfo.channel)' should be '$ExpectedChannel'" }

  $SettingsView = Get-Content -LiteralPath ".\src\settings\SettingsView.tsx" -Raw
  foreach ($Forbidden in @('Co nowego', 'Roadmapa', 'APP_BUILD', 'APP_STAGE', 'RELEASE_NOTES', 'USER_ROADMAP')) {
    if ($SettingsView.Contains($Forbidden)) { Fail "Removed/technical Settings UI content returned: $Forbidden" }
  }
  if (Test-Path -LiteralPath ".\src\settings\releaseNotes.ts") { Fail "Dead src/settings/releaseNotes.ts returned" }
  if (Test-Path -LiteralPath ".\src\settings\roadmap.ts") { Fail "Dead src/settings/roadmap.ts returned" }
  Write-Host "Version $AppVersion / DB schema ${SchemaVersion}: PASS" -ForegroundColor Green

  Write-Host "`n=== ACTIVE TREE SHA-256 ===" -ForegroundColor Cyan
  $Manifest = ".\SHA256SUMS.txt"
  if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { Fail "SHA256SUMS.txt missing" }
  $ManifestLines = Get-Content -LiteralPath $Manifest | Where-Object { $_ -and -not $_.StartsWith('#') }
  $GeneratedManifestEntries = @($ManifestLines | Where-Object { $_ -match '\.tsbuildinfo$' })
  if ($GeneratedManifestEntries.Count -gt 0) {
    Fail "SHA256SUMS.txt contains generated *.tsbuildinfo files. They must be excluded from immutable integrity checks."
  }
  if ($ManifestLines.Count -lt 1) { Fail "SHA256SUMS.txt has no entries" }
  $Verified = 0
  foreach ($Line in $ManifestLines) {
    if ($Line -notmatch '^([0-9a-fA-F]{64})\s{2,}(.+)$') { Fail "Invalid SHA256SUMS.txt line: $Line" }
    $ExpectedHash = $Matches[1].ToLowerInvariant()
    $Relative = $Matches[2]
    $LocalRelative = $Relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
    $Path = Join-Path $Project $LocalRelative
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Fail "Manifest file missing: $Relative" }
    $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -ne $ExpectedHash) { Fail "SHA mismatch: $Relative`nExpected $ExpectedHash`nActual   $Actual" }
    $Verified++
  }
  Write-Host "SHA-256 manifest: PASS ($Verified files)" -ForegroundColor Green

  Write-Host "`n=== CLEAN INSTALL ===" -ForegroundColor Cyan
  if (Test-Path -LiteralPath ".\node_modules") { Remove-Item -LiteralPath ".\node_modules" -Recurse -Force }
  if (Test-Path -LiteralPath ".\dist") { Remove-Item -LiteralPath ".\dist" -Recurse -Force }
  Invoke-NativeChecked -Label "npm ci" -FilePath $Npm -Arguments @("ci", "--no-audit", "--no-fund")
  Invoke-NativeChecked -Label "Production dependency audit (HIGH/CRITICAL)" -FilePath $Npm -Arguments @("audit", "--omit=dev", "--audit-level=high")

  $Vitest = Join-Path $Project "node_modules\.bin\vitest.cmd"
  if (-not (Test-Path -LiteralPath $Vitest -PathType Leaf)) { Fail "vitest.cmd missing after npm ci" }

  Write-Host "`n=== CRITICAL FOCUSED TESTS ===" -ForegroundColor Cyan
  $CriticalTests = @(
    "src/tests/location-delete-transaction.test.ts",
    "src/tests/data-transfer.test.ts",
    "src/tests/storage-import.test.ts",
    "src/tests/storage-v035.test.ts",
    "src/tests/storage-v021.test.ts",
    "src/tests/nursing-week-matrix-adapter.test.ts",
    "src/tests/study-completeness.test.ts",
    "src/tests/xlsx-reader-date-normalization.test.ts",
    "src/tests/study.service.test.ts",
    "src/tests/study-preview-calendar.test.ts",
    "src/tests/import-review.test.ts",
    "src/tests/study-import-readability.test.ts",
    "src/tests/calendar-month-readability.test.ts",
    "src/tests/study-source-to-calendar.test.ts",
    "src/tests/study-corrections.test.ts",
    "src/tests/study-diff.test.ts",
    "src/tests/study-identity.test.ts",
    "src/tests/work-roster-adapter.test.ts",
    "src/tests/work-service.test.ts",
    "src/tests/work-summary.test.ts",
    "src/tests/branding-splash.test.ts",
    "src/tests/receipt-final-offline-static.test.ts",
    "src/tests/receipt-final-parser-freeze.test.ts",
    "src/tests/receipt-image-memory-safety.test.ts",
    "src/tests/github-only-finalization.test.ts",
    "src/tests/work-pdf-file-validation.test.ts"
  )
  foreach ($Test in $CriticalTests) {
    if (-not (Test-Path -LiteralPath $Test -PathType Leaf)) { Fail "Critical test missing: $Test" }
  }
  Invoke-NativeChecked -Label "Critical focused Vitest" -FilePath $Vitest -Arguments (@("run") + $CriticalTests)
  Invoke-NativeChecked -Label "FULL npm run check" -FilePath $Npm -Arguments @("run", "check")

  Write-Host "`n=== EXPLICIT POST-BUILD GATES ===" -ForegroundColor Cyan
  Invoke-NativeChecked -Label "Service worker gate" -FilePath $Node -Arguments @(".\scripts\service-worker-gate.mjs")
  Invoke-NativeChecked -Label "Release safety gate" -FilePath $Node -Arguments @(".\scripts\release-safety-gate.mjs")
  Invoke-NativeChecked -Label "Production audit" -FilePath $Node -Arguments @(".\scripts\production-audit.mjs")
  Invoke-NativeChecked -Label "Security release gate" -FilePath $Node -Arguments @(".\scripts\security-release-gate.mjs")

  Write-Host "`n=== DIST SANITY ===" -ForegroundColor Cyan
  foreach ($Required in @(
    ".\dist\index.html", ".\dist\service-worker.js", ".\dist\manifest.webmanifest",
    ".\dist\icon-192.png", ".\dist\icon-512.png", ".\dist\apple-touch-icon.png"
  )) {
    if (-not (Test-Path -LiteralPath $Required -PathType Leaf)) { Fail "Required production file missing: $Required" }
  }
  if (-not (Get-ChildItem -LiteralPath ".\dist\assets" -File -ErrorAction SilentlyContinue | Where-Object Extension -eq ".js")) { Fail "No production JS asset found in dist/assets" }
  if (-not (Get-ChildItem -LiteralPath ".\dist\assets" -File -ErrorAction SilentlyContinue | Where-Object Extension -eq ".css")) { Fail "No production CSS asset found in dist/assets" }
  if (Get-ChildItem -LiteralPath ".\dist" -Recurse -File -Filter "*.map" -ErrorAction SilentlyContinue) { Fail "Production source maps found in dist" }
  Write-Host "dist sanity: PASS" -ForegroundColor Green

  if (-not $SkipBenchmarks) {
    Invoke-NativeChecked -Label "Receipt baseline benchmark" -FilePath $Npm -Arguments @("run", "benchmark:receipts")
    Invoke-NativeChecked -Label "Receipt geometry benchmark" -FilePath $Npm -Arguments @("run", "benchmark:receipts:geometry")
    Invoke-NativeChecked -Label "Receipt Gate2 benchmark" -FilePath $Npm -Arguments @("run", "benchmark:receipts:gate2")

    $Gate2ResultPath = Join-Path $Project "_PRIVATE_HISTORY\benchmarks\dev4a\gate2\results\dev4a-gate2-results.json"
    if (-not (Test-Path -LiteralPath $Gate2ResultPath -PathType Leaf)) { Fail "Gate2 result JSON missing after benchmark" }
    $Gate2 = Get-Content -LiteralPath $Gate2ResultPath -Raw | ConvertFrom-Json
    if ($Gate2.decision -ne "LIVE_PASS") { Fail "Gate2 decision is $($Gate2.decision), expected LIVE_PASS" }
    if ($Gate2.productionGeometrySelected -ne $false) { Fail "Gate2 safety violation: productionGeometrySelected must remain false" }
    if ([int]$Gate2.coverage.capturedRequiredCases -ne [int]$Gate2.coverage.requiredCases) { Fail "Gate2 coverage incomplete" }
    if ([int]$Gate2.triggerCounts.FALSE_POSITIVE -ne 0 -or [int]$Gate2.triggerCounts.FALSE_NEGATIVE -ne 0) { Fail "Gate2 trigger FP/FN is not zero" }
    Write-Host "Receipt benchmarks: PASS" -ForegroundColor Green
  }
  else {
    Write-Host "Benchmarks skipped by -SkipBenchmarks. Do NOT treat this run as final publication approval." -ForegroundColor Yellow
  }

  Write-Host "`n=== PRIVATE PACKAGE WARNING ===" -ForegroundColor Yellow
  if (Test-Path -LiteralPath ".\_PRIVATE_HISTORY") {
    $PrivatePdfCount = @(Get-ChildItem -LiteralPath ".\_PRIVATE_HISTORY" -Recurse -File -Filter "*.pdf" -ErrorAction SilentlyContinue).Count
    Write-Host "This tree contains _PRIVATE_HISTORY and $PrivatePdfCount private PDF fixture(s)."
    Write-Host "Do not publish the PRIVATE tree directly to the public GitHub repository."
  }

  Write-Host "`n============================================================" -ForegroundColor Green
  Write-Host "AUTOMATED RELEASE GATE: PASS" -ForegroundColor Green
  Write-Host "Now run the manual browser/PWA checklist. Automated PASS alone is not publication approval." -ForegroundColor Yellow
  Write-Host "Log saved to: $LogPath"
  Write-Host "============================================================" -ForegroundColor Green
}
finally {
  try { Stop-Transcript | Out-Null } catch { }
}
