# Functions deploy from the source of truth: a clean git archive of origin/main (never the workspace tree).
# Refuses to run unless origin/workspace/v29-08 carries exactly main's functions/ + rules (scripts/check-functions-sync.js).
# Default list = the exports s3.1.33 rolled back (startSuprstrLive, approveSuprstarRequest; deployed from workspace 51a730a,
# which lacked main's supRstar resume / venue live duration) plus the delete-shift exports s3.1.37 missed (link v=).
param(
  [string[]]$Functions = @("startSuprstrLive", "approveSuprstarRequest", "deleteScheduleShift", "deleteScheduleShifts"),
  [string]$WorkspaceRef = "origin/workspace/v29-08",
  [int]$BatchSize = 40
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

$deferred = "emailFloqrPreviewLinks", "emailV290914TestLinks", "emailFloqrThreeDayTestPlan", "emailMobileTestChecklist"
$blocked = $Functions | Where-Object { $_ -in $deferred }
if ($blocked) { throw "Deferred open-relay mailer in the deploy list: $($blocked -join ', ')" }

git fetch -q origin main workspace/v29-08
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
node scripts/check-functions-sync.js --workspace $WorkspaceRef --main origin/main --no-fetch
if ($LASTEXITCODE -ne 0) { throw "Workspace functions/ is not in sync with main - sync and push before deploying" }
$commit = (git rev-parse --short origin/main).Trim()

$export = Join-Path $env:TEMP "floqr-deploy-reconcile"
if (Test-Path $export) { Remove-Item $export -Recurse -Force }
New-Item -ItemType Directory -Path $export | Out-Null
$tar = Join-Path $env:TEMP "floqr-deploy-reconcile.tar"
git archive --format=tar -o $tar $commit
if ($LASTEXITCODE -ne 0) { throw "git archive $commit failed" }
tar -xf $tar -C $export
if ($LASTEXITCODE -ne 0) { throw "extract failed" }
Remove-Item $tar -Force

Push-Location (Join-Path $export "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed in the export" }
  cmd /c "npm test > npm-test.log 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content npm-test.log -Tail 8
  if ($testExit -ne 0) { throw "npm test failed in the origin/main export ($commit)" }
} finally { Pop-Location; $ErrorActionPreference = "Stop" }

$env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
$pending = @($Functions)
Push-Location $export
try {
  for ($i = 0; $i -lt $pending.Count; $i += $BatchSize) {
    $batch = $pending[$i..([Math]::Min($i + $BatchSize, $pending.Count) - 1)]
    for ($attempt = 1; $attempt -le 3; $attempt++) {
      $only = ($batch | ForEach-Object { "functions:$_" }) -join ","
      firebase deploy --only $only --project shoutoutdemo-5b402 --non-interactive
      if ($LASTEXITCODE -eq 0) { break }
      if ($attempt -eq 3) { throw "firebase deploy failed 3 times for: $($batch -join ', ')" }
      Write-Warning "Deploy attempt $attempt failed (quota?); retrying in 70 s"
      Start-Sleep -Seconds 70
    }
  }
} finally { Pop-Location }
Write-Host "Deployed $($Functions.Count) functions from origin/main $commit."
