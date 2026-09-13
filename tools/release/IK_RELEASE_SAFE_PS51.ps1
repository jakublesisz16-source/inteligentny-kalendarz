# Release pipeline version: 1.0.3
param(
    [ValidateSet('PrepareBaseline', 'PublishPackage')]
    [string]$Mode = 'PrepareBaseline',
    [string]$RepoDir = 'D:\Projekty\inteligentny-kalendarz-publish',
    [string]$OutputDir = "$env:USERPROFILE\Downloads",
    [string]$PackageZip = '',
    [string]$ReleaseManifest = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:GIT_PAGER = 'cat'
$env:PAGER = 'cat'

$ExpectedOrigin = 'https://github.com/jakublesisz16-source/inteligentny-kalendarz.git'
$RepositoryName = 'jakublesisz16-source/inteligentny-kalendarz'
$GitUserName = 'jakublesisz16-source'
$GitUserEmail = '312649679+jakublesisz16-source@users.noreply.github.com'

$PrivateFixtureTests = @(
    'src/tests/receipt-ocr-b029a-benchmark.test.ts',
    'src/tests/receipt-ocr-dev4a-gate1-fix2-candidate-safety.test.ts',
    'src/tests/receipt-ocr-dev4a-gate1-recovery1-value-column.test.ts',
    'src/tests/receipt-ocr-dev4a-gate2-ab-validation.test.ts',
    'src/tests/receipt-ocr-dev4a-gate3-production-selector.test.ts',
    'src/tests/receipt-ocr-dev4b-fix1-structured-geometry-selection.test.ts',
    'src/tests/receipt-ocr-dev4b-fix2-local-numeric-verification.test.ts'
)

function Fail([string]$Message) {
    Write-Host "`nFAIL: $Message" -ForegroundColor Red
    exit 1
}

function Pass([string]$Message) {
    Write-Host "$Message" -ForegroundColor Green
}

function Info([string]$Message) {
    Write-Host "$Message" -ForegroundColor Cyan
}

function Invoke-GitCapture([string[]]$GitArgs) {
    # Windows PowerShell 5.1 converts native stderr redirected with 2>&1 into
    # NativeCommandError records. Git writes normal progress (for example fetch)
    # to stderr even when it exits with code 0. Temporarily use Continue so the
    # real native exit code, not the stderr stream, decides success/failure.
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $out = @(& git -C $RepoDir @GitArgs 2>&1)
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    $lines = @($out | ForEach-Object { $_.ToString() })
    $text = (($lines -join [Environment]::NewLine).Trim())
    return [PSCustomObject]@{
        ExitCode = $code
        Text = $text
    }
}

function Invoke-GitText([string[]]$GitArgs) {
    $result = Invoke-GitCapture $GitArgs
    if ($result.ExitCode -ne 0) {
        Fail "git $($GitArgs -join ' ') failed (exit $($result.ExitCode)). $($result.Text)"
    }
    return $result.Text
}

function Invoke-External([string]$Exe, [string[]]$ArgumentList, [string]$WorkingDirectory) {
    # Do not use the parameter name $Args here. $args is a PowerShell automatic
    # variable and, on Windows PowerShell 5.1, using it as a formal parameter can
    # leave the external invocation with an empty argument list. For `node` that
    # silently opens the interactive REPL instead of running the requested script.
    $effectiveArgs = @($ArgumentList | ForEach-Object { [string]$_ })
    if (($Exe -in @('node', 'npm', 'npx')) -and $effectiveArgs.Count -eq 0) {
        Fail "Refusing to invoke $Exe without arguments."
    }

    Push-Location $WorkingDirectory
    try {
        & $Exe @effectiveArgs
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            Fail "$Exe $($effectiveArgs -join ' ') failed (exit $code)."
        }
    }
    finally {
        Pop-Location
    }
}

function Ensure-Tools {
    foreach ($tool in @('git', 'node', 'npm', 'npx')) {
        $cmd = Get-Command $tool -ErrorAction SilentlyContinue
        if (-not $cmd) { Fail "Required tool not found in PATH: $tool" }
    }
}

function Ensure-PublishRepo {
    if (-not (Test-Path -LiteralPath $RepoDir)) {
        $parent = Split-Path -Parent $RepoDir
        if (-not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        Info "Cloning separate PUBLIC publication repository..."
        & git clone $ExpectedOrigin $RepoDir
        if ($LASTEXITCODE -ne 0) { Fail 'git clone failed.' }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $RepoDir '.git'))) {
        Fail "Publication path is not a Git repository: $RepoDir"
    }

    $origin = Invoke-GitText @('remote', 'get-url', 'origin')
    if ($origin.Trim() -ne $ExpectedOrigin) {
        Fail "Unexpected Git origin. Expected '$ExpectedOrigin', got '$origin'."
    }

    # Repository-local only. Never touches global Git identity/settings.
    Invoke-GitText @('config', '--local', 'user.name', $GitUserName) | Out-Null
    Invoke-GitText @('config', '--local', 'user.email', $GitUserEmail) | Out-Null
    Invoke-GitText @('config', '--local', 'core.autocrlf', 'false') | Out-Null
    Invoke-GitText @('config', '--local', 'core.safecrlf', 'false') | Out-Null
}

function Refresh-Main {
    Info 'Refreshing origin/main...'
    Invoke-GitText @('fetch', '--prune', 'origin', 'main') | Out-Null
    return (Invoke-GitText @('rev-parse', 'origin/main')).Trim()
}

function New-TempDir([string]$Prefix) {
    $name = $Prefix + '_' + [Guid]::NewGuid().ToString('N')
    $path = Join-Path ([IO.Path]::GetTempPath()) $name
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    return $path
}

function Assert-SafeZip([string]$ZipPath) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName.Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            if ($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or ($name.Split('/') -contains '..')) {
                Fail "Unsafe ZIP entry: $name"
            }
        }
    }
    finally {
        $archive.Dispose()
    }
}

function Expand-SafeZip([string]$ZipPath, [string]$Destination) {
    Assert-SafeZip $ZipPath
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Destination)
}

function New-ZipFromDirectory([string]$Source, [string]$Destination) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $Source,
        $Destination,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )
}

function Get-RelativeFileList([string]$Root) {
    $rootResolved = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\') + '\'
    $items = Get-ChildItem -LiteralPath $Root -Recurse -File -Force
    $result = @()
    foreach ($item in $items) {
        $full = $item.FullName
        if (-not $full.StartsWith($rootResolved, [StringComparison]::OrdinalIgnoreCase)) {
            Fail "Path escaped expected root: $full"
        }
        $result += $full.Substring($rootResolved.Length).Replace('\', '/')
    }
    return @($result | Sort-Object)
}

function Assert-ShaManifest([string]$Root) {
    $manifestRel = 'SHA256SUMS.txt'
    $manifest = Join-Path $Root $manifestRel
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
        Fail "$manifestRel missing from PUBLIC package."
    }

    $expectedFiles = @(Get-RelativeFileList $Root | Where-Object { $_ -ne $manifestRel })
    $manifestFiles = @()
    $hashes = @{}

    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $manifest) {
        $lineNumber++
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }

        if ($line -notmatch '^([0-9A-Fa-f]{64})\s+(.+)$') {
            Fail "$manifestRel has an invalid entry at line $lineNumber."
        }

        $expectedHash = $Matches[1].ToLowerInvariant()
        $rel = $Matches[2].Trim().Replace('\', '/')
        if ([string]::IsNullOrWhiteSpace($rel) -or $rel.StartsWith('/') -or $rel -match '^[A-Za-z]:' -or ($rel.Split('/') -contains '..')) {
            Fail "$manifestRel contains an unsafe path at line $lineNumber."
        }
        if ($rel -eq $manifestRel) {
            Fail "$manifestRel must not hash itself."
        }
        if ($hashes.ContainsKey($rel)) {
            Fail "$manifestRel contains a duplicate path: $rel"
        }

        $hashes.Add($rel, $expectedHash)
        $manifestFiles += $rel
    }

    Assert-EqualSets $manifestFiles $expectedFiles "$manifestRel file set"

    foreach ($rel in $manifestFiles) {
        $full = Join-Path $Root ($rel.Replace('/', '\'))
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            Fail "$manifestRel references a missing file: $rel"
        }
        $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $full).Hash.ToLowerInvariant()
        if ($actualHash -ne $hashes[$rel]) {
            Fail "$manifestRel hash mismatch: $rel"
        }
    }

    Pass "$manifestRel integrity: PASS ($($manifestFiles.Count) files)"
}

function Assert-EqualSets([string[]]$Actual, [string[]]$Expected, [string]$Label) {
    $actualNorm = @($Actual | Sort-Object -Unique)
    $expectedNorm = @($Expected | Sort-Object -Unique)
    $diff = Compare-Object -ReferenceObject $expectedNorm -DifferenceObject $actualNorm
    if ($diff) {
        Write-Host "`n$Label mismatch:" -ForegroundColor Yellow
        $diff | ForEach-Object { Write-Host ("  {0} {1}" -f $_.SideIndicator, $_.InputObject) }
        Fail $Label
    }
}

function Assert-PublicPackage([string]$PackageRoot, [string]$Version) {
    $packageJson = Join-Path $PackageRoot 'package.json'
    $versionTs = Join-Path $PackageRoot 'src\core\version.ts'
    $buildInfo = Join-Path $PackageRoot 'BUILD_INFO.json'
    $gate = Join-Path $PackageRoot 'scripts\public-package-gate.mjs'

    foreach ($required in @($packageJson, $versionTs, $gate)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            Fail "Required PUBLIC package file missing: $required"
        }
    }

    $pkg = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
    if ([string]$pkg.version -ne $Version) {
        Fail "package.json version is '$($pkg.version)', expected '$Version'."
    }

    $versionText = Get-Content -LiteralPath $versionTs -Raw
    $escapedVersion = [Regex]::Escape($Version)
    if ($versionText -notmatch "(?m)^export const APP_VERSION = '$escapedVersion';\r?$") {
        Fail "src/core/version.ts does not declare APP_VERSION '$Version'."
    }

    if (Test-Path -LiteralPath $buildInfo -PathType Leaf) {
        $bi = Get-Content -LiteralPath $buildInfo -Raw | ConvertFrom-Json
        if ([string]$bi.appVersion -ne $Version) {
            Fail "BUILD_INFO.json appVersion is '$($bi.appVersion)', expected '$Version'."
        }
    }

    Assert-ShaManifest $PackageRoot

    Invoke-External -Exe 'node' -ArgumentList @('scripts/public-package-gate.mjs', $PackageRoot) -WorkingDirectory $PackageRoot
    Pass 'PUBLIC package gate: PASS'
}

function Assert-PrivateFixturePolicy([string]$Root) {
    $testsRoot = Join-Path $Root 'src\tests'
    $found = @()
    if (Test-Path -LiteralPath $testsRoot) {
        $rootResolved = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\') + '\'
        foreach ($file in Get-ChildItem -LiteralPath $testsRoot -Recurse -File -Force) {
            if ($file.Name -notmatch '\.test\.(ts|tsx|js|mjs|cjs)$') { continue }
            $matches = Select-String -LiteralPath $file.FullName -SimpleMatch '_PRIVATE_HISTORY' -Quiet
            if ($matches) {
                $found += $file.FullName.Substring($rootResolved.Length).Replace('\', '/')
            }
        }
    }

    Assert-EqualSets $found $PrivateFixtureTests 'Private-fixture public-test policy'

    foreach ($workflowRel in @('.github/workflows/ci.yml', '.github/workflows/pages.yml')) {
        $workflow = Join-Path $Root ($workflowRel.Replace('/', '\'))
        if (-not (Test-Path -LiteralPath $workflow -PathType Leaf)) {
            Fail "Required workflow missing: $workflowRel"
        }
        $text = Get-Content -LiteralPath $workflow -Raw
        foreach ($test in $PrivateFixtureTests) {
            if ($text -notmatch [Regex]::Escape($test)) {
                Fail "$workflowRel is missing private-fixture exclusion: $test"
            }
        }
    }
    Pass 'Private-fixture test policy: PASS'
}

function Get-ManifestPath([string]$ZipPath) {
    if ($ReleaseManifest) { return $ReleaseManifest }
    $dir = Split-Path -Parent $ZipPath
    $name = [IO.Path]::GetFileNameWithoutExtension($ZipPath)
    return (Join-Path $dir ($name + '.release.json'))
}

function Prepare-Baseline {
    Ensure-PublishRepo
    $baseSha = Refresh-Main

    Info "Public base SHA: $baseSha"
    Invoke-GitText @('checkout', '--detach', $baseSha) | Out-Null
    Invoke-GitText @('reset', '--hard', $baseSha) | Out-Null
    Invoke-GitText @('clean', '-fdx') | Out-Null

    $pkgPath = Join-Path $RepoDir 'package.json'
    $pkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
    $version = [string]$pkg.version
    if ([string]::IsNullOrWhiteSpace($version)) { Fail 'Could not resolve package version.' }

    if (-not (Test-Path -LiteralPath $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    $temp = New-TempDir 'IK_PUBLIC_BASE'
    try {
        $rawZip = Join-Path $temp 'git-archive.zip'
        $extract = Join-Path $temp 'extract'
        New-Item -ItemType Directory -Path $extract -Force | Out-Null

        & git -C $RepoDir archive --format=zip --output=$rawZip $baseSha
        if ($LASTEXITCODE -ne 0) { Fail 'git archive failed.' }
        Expand-SafeZip $rawZip $extract

        Assert-PublicPackage $extract $version
        Assert-PrivateFixturePolicy $extract

        $short = $baseSha.Substring(0, 12)
        $zipName = "IK_${version}_PUBLIC_BASE_${short}.zip"
        $finalZip = Join-Path $OutputDir $zipName
        New-ZipFromDirectory $extract $finalZip
        $zipSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalZip).Hash.ToLowerInvariant()

        $after = Refresh-Main
        if ($after -ne $baseSha) {
            Remove-Item -LiteralPath $finalZip -Force -ErrorAction SilentlyContinue
            Fail "origin/main changed during baseline preparation: $baseSha -> $after. Run PrepareBaseline again."
        }

        $state = [ordered]@{
            schemaVersion = 1
            repository = $RepositoryName
            branch = 'main'
            baseSha = $baseSha
            version = $version
            baselineZip = $zipName
            baselineZipSha256 = $zipSha
            generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        }
        $statePath = Join-Path $OutputDir ("IK_${version}_PUBLIC_BASE_${short}.json")
        $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8

        Write-Host ''
        Pass 'PUBLIC BASELINE PREPARE: PASS'
        Write-Host "ZIP: $finalZip"
        Write-Host "SHA-256: $zipSha"
        Write-Host "BASE SHA: $baseSha"
        Write-Host "STATE: $statePath"
        Write-Host 'Upload the ZIP + JSON to ChatGPT before preparing the next PUBLIC patch.' -ForegroundColor Yellow
    }
    finally {
        Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Publish-Package {
    if ([string]::IsNullOrWhiteSpace($PackageZip)) {
        Fail 'PublishPackage requires -PackageZip.'
    }
    if (-not (Test-Path -LiteralPath $PackageZip -PathType Leaf)) {
        Fail "PUBLIC package ZIP not found: $PackageZip"
    }

    $manifestPath = Get-ManifestPath $PackageZip
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Fail "Release sidecar manifest not found: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ([int]$manifest.schemaVersion -ne 1) { Fail 'Unsupported release manifest schemaVersion.' }
    if ([string]$manifest.repository -ne $RepositoryName) { Fail 'Release manifest repository mismatch.' }

    $baseSha = [string]$manifest.expectedBaseSha
    $version = [string]$manifest.version
    $expectedZipSha = ([string]$manifest.packageSha256).ToLowerInvariant()
    $commitMessage = [string]$manifest.commitMessage
    $branchName = [string]$manifest.branchName
    $expectedChanged = @($manifest.expectedChangedFiles | ForEach-Object { [string]$_ })

    if ($baseSha -notmatch '^[0-9a-fA-F]{40}$') { Fail 'expectedBaseSha must be a full 40-character Git SHA.' }
    if ([string]::IsNullOrWhiteSpace($version)) { Fail 'Release manifest version is empty.' }
    if ($expectedZipSha -notmatch '^[0-9a-f]{64}$') { Fail 'packageSha256 must be a 64-character SHA-256.' }
    if ([string]::IsNullOrWhiteSpace($commitMessage)) { Fail 'commitMessage is empty.' }
    if ($branchName -notmatch '^release/[A-Za-z0-9._/-]+$') { Fail "Unsafe release branch name: $branchName" }
    $refCheck = Invoke-GitCapture @('check-ref-format', '--branch', $branchName)
    if ($refCheck.ExitCode -ne 0) { Fail "Invalid Git release branch name: $branchName" }
    if ($expectedChanged.Count -lt 1) { Fail 'expectedChangedFiles must contain at least one path.' }
    foreach ($rel in $expectedChanged) {
        $normalized = $rel.Replace('\', '/')
        if ([string]::IsNullOrWhiteSpace($normalized) -or $normalized.StartsWith('/') -or $normalized -match '^[A-Za-z]:' -or ($normalized.Split('/') -contains '..')) {
            Fail "Unsafe expectedChangedFiles path: $rel"
        }
    }

    $actualZipSha = (Get-FileHash -Algorithm SHA256 -LiteralPath $PackageZip).Hash.ToLowerInvariant()
    if ($actualZipSha -ne $expectedZipSha) {
        Fail "PUBLIC ZIP SHA-256 mismatch. Expected $expectedZipSha, got $actualZipSha."
    }
    Pass 'PUBLIC ZIP SHA-256: PASS'

    $temp = New-TempDir 'IK_PUBLIC_RELEASE'
    try {
        $extract = Join-Path $temp 'package'
        New-Item -ItemType Directory -Path $extract -Force | Out-Null
        Expand-SafeZip $PackageZip $extract
        if (-not (Test-Path -LiteralPath (Join-Path $extract 'package.json') -PathType Leaf)) {
            Fail 'PUBLIC ZIP must contain repository files at ZIP root (package.json missing at root).'
        }

        Assert-PublicPackage $extract $version
        Assert-PrivateFixturePolicy $extract

        Ensure-PublishRepo
        $remoteBase = Refresh-Main
        if ($remoteBase -ne $baseSha) {
            Fail "PUBLIC base moved. Package expects $baseSha, origin/main is $remoteBase. Rebase/rebuild the PUBLIC patch."
        }
        Pass 'Expected PUBLIC base: PASS'

        $remoteBranch = Invoke-GitText @('ls-remote', '--heads', 'origin', "refs/heads/$branchName")
        if (-not [string]::IsNullOrWhiteSpace($remoteBranch)) {
            Fail "Remote release branch already exists: $branchName"
        }

        Invoke-GitText @('checkout', '--detach', $baseSha) | Out-Null
        # Delete stale local branch only after confirming no same remote branch exists.
        $localBranches = Invoke-GitText @('branch', '--format=%(refname:short)')
        if (($localBranches -split "`r?`n") -contains $branchName) {
            Invoke-GitText @('branch', '-D', $branchName) | Out-Null
        }
        Invoke-GitText @('checkout', '-b', $branchName, $baseSha) | Out-Null
        Invoke-GitText @('reset', '--hard', $baseSha) | Out-Null
        Invoke-GitText @('clean', '-fdx') | Out-Null

        # Replace ONLY the separate PUBLIC worktree. PRIVATE folder is never referenced here.
        Invoke-GitText @('rm', '-r', '-f', '--ignore-unmatch', '.') | Out-Null
        Get-ChildItem -LiteralPath $extract -Force | Copy-Item -Destination $RepoDir -Recurse -Force
        Invoke-GitText @('add', '-A', '--', '.') | Out-Null

        $packageFiles = Get-RelativeFileList $extract
        $trackedText = Invoke-GitText @('ls-files')
        $trackedFiles = @()
        if (-not [string]::IsNullOrWhiteSpace($trackedText)) {
            $trackedFiles = @($trackedText -split "`r?`n" | Where-Object { $_ -ne '' })
        }
        Assert-EqualSets $trackedFiles $packageFiles 'Final PUBLIC tracked-file set'
        Pass "PUBLIC tracked-file set: PASS ($($trackedFiles.Count) files)"

        foreach ($rel in $packageFiles) {
            $full = Join-Path $RepoDir ($rel.Replace('/', '\'))
            $rawBlob = (Invoke-GitText @('hash-object', '--no-filters', '--', $full)).Trim()
            $stagedBlob = Invoke-GitText @('rev-parse', ":$rel")
            if ($rawBlob -ne $stagedBlob.Trim()) {
                Fail "Git blob parity mismatch for $rel (possible line-ending/filter transformation)."
            }
        }
        Pass "PUBLIC ZIP -> staged Git blob parity: PASS ($($packageFiles.Count) files)"

        $changedText = Invoke-GitText @('diff', '--cached', '--name-only', $baseSha)
        $changedFiles = @()
        if (-not [string]::IsNullOrWhiteSpace($changedText)) {
            $changedFiles = @($changedText -split "`r?`n" | Where-Object { $_ -ne '' })
        }
        Assert-EqualSets $changedFiles $expectedChanged 'Expected changed-file list'
        Pass "Expected changed-file list: PASS ($($changedFiles.Count) files)"

        $diffCheck = Invoke-GitCapture @('--no-pager', 'diff', '--cached', '--check')
        if ($diffCheck.ExitCode -ne 0) {
            if (-not [string]::IsNullOrWhiteSpace($diffCheck.Text)) { Write-Host $diffCheck.Text }
            Fail 'git diff --cached --check reported whitespace errors in the release diff.'
        }
        Pass 'Git whitespace check: PASS'

        Info 'Running local PUBLIC validation...'
        Invoke-External -Exe 'npm' -ArgumentList @('ci') -WorkingDirectory $RepoDir
        Invoke-External -Exe 'npm' -ArgumentList @('run', 'typecheck') -WorkingDirectory $RepoDir

        $vitestArgs = @('vitest', 'run')
        foreach ($test in $PrivateFixtureTests) {
            $vitestArgs += '--exclude'
            $vitestArgs += $test
        }
        Invoke-External -Exe 'npx' -ArgumentList $vitestArgs -WorkingDirectory $RepoDir
        Invoke-External -Exe 'npm' -ArgumentList @('run', 'build') -WorkingDirectory $RepoDir

        $unstaged = Invoke-GitText @('diff', '--name-only')
        if (-not [string]::IsNullOrWhiteSpace($unstaged)) {
            Write-Host $unstaged
            Fail 'Validation/build modified tracked source files. Release aborted.'
        }
        Pass 'Local PUBLIC typecheck/tests/build: PASS'

        Write-Host ''
        Info 'Release diff summary:'
        & git -C $RepoDir --no-pager diff --cached --stat $baseSha
        if ($LASTEXITCODE -ne 0) { Fail 'Could not render staged diff summary.' }

        # Recheck remote immediately before commit.
        $preCommitMain = Refresh-Main
        if ($preCommitMain -ne $baseSha) {
            Fail "origin/main changed before commit: $baseSha -> $preCommitMain"
        }

        Invoke-GitText @('commit', '-m', $commitMessage) | Out-Null
        $commitSha = (Invoke-GitText @('rev-parse', 'HEAD')).Trim()

        # Recheck remote again before push. Never force-push.
        $prePushMain = Refresh-Main
        if ($prePushMain -ne $baseSha) {
            Fail "origin/main changed before branch push: $baseSha -> $prePushMain. Local release commit kept at $commitSha; nothing was pushed."
        }

        & git -C $RepoDir push --set-upstream origin "HEAD:refs/heads/$branchName"
        if ($LASTEXITCODE -ne 0) { Fail 'Release branch push failed.' }

        Write-Host ''
        Pass 'PUBLIC RELEASE BRANCH PUSH: PASS'
        Write-Host "Branch: $branchName"
        Write-Host "Commit: $commitSha"
        Write-Host "Base: $baseSha"
        Write-Host "Version: $version"
        Write-Host "ZIP SHA-256: $actualZipSha"
        Write-Host 'NOT MERGED TO main. Next step: PR + CI review + explicit user approval.' -ForegroundColor Yellow
    }
    finally {
        Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host 'INTELIGENTNY KALENDARZ - SAFE UNIVERSAL RELEASE PIPELINE' -ForegroundColor Magenta
Write-Host "Mode: $Mode"
Write-Host "PUBLIC repo only: $RepoDir"
Write-Host 'PRIVATE folder D:\Projekty\inteligentny-kalendarz is never modified by this script.' -ForegroundColor Yellow
Write-Host ''

Ensure-Tools
switch ($Mode) {
    'PrepareBaseline' { Prepare-Baseline }
    'PublishPackage' { Publish-Package }
    default { Fail "Unknown mode: $Mode" }
}
