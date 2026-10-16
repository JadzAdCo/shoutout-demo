# s3.1.26 security deploy guard. s3.1.26 was deployed Oct 9 2026 (commit 3721e15 records it: 131 Functions from a clean
# git archive of main, Firestore + Storage rules released and verified). This script deploys again only if backend
# source changed after that record; otherwise it exits without touching production.
# Firestore live rules were re-verified equal to source on Oct 9 2026 12:55 (59,778 chars).
param([string]$DeployedAt = "3721e15")
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

$changed = @(git diff --name-only $DeployedAt HEAD -- functions firestore.rules storage.rules)
if ($LASTEXITCODE -ne 0) { throw "git diff failed" }
$backend = $changed | Where-Object { $_ -notmatch '\.test\.js$' -and $_ -ne "functions/package.json" }
$rules = $backend | Where-Object { $_ -in @("firestore.rules", "storage.rules") }
$fnSources = $backend | Where-Object { $_ -like "functions/*.js" }

if (-not $backend.Count) {
  Write-Host "Nothing to deploy: since $DeployedAt only tests / package test list changed ($($changed -join ', '))."
  exit 0
}

if ($fnSources.Count) {
  # A changed Functions module means every export bundled with it must be listed explicitly; review before deploying.
  throw "Functions source changed since ${DeployedAt}: $($fnSources -join ', '). Build the explicit function list for these modules (skip checkDisplayAccess unless display-security changed in the board path) and deploy deliberately."
}

$only = ($rules | ForEach-Object { if ($_ -eq "firestore.rules") { "firestore:rules" } else { "storage" } }) -join ","
$export = Join-Path $env:TEMP "floqr-deploy-s3-1-26"
if (Test-Path $export) { Remove-Item $export -Recurse -Force }
New-Item -ItemType Directory -Path $export | Out-Null
$tar = Join-Path $env:TEMP "floqr-deploy-s3-1-26.tar"
git archive --format=tar -o $tar HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
tar -xf $tar -C $export
Remove-Item $tar -Force
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
Push-Location $export
try {
  firebase deploy --only $only --project shoutoutdemo-5b402 --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed" }
} finally { Pop-Location }
Write-Host "Deployed $only from HEAD."
