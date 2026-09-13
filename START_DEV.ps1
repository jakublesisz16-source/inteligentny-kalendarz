$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json'))) {
    throw 'package.json not found in checkpoint directory.'
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
    Write-Host 'Installing dependencies with npm ci...'
    & npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& npm run dev -- --host 0.0.0.0 --port 5174
exit $LASTEXITCODE
