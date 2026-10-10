# s3.1.34: redeploy only getFloqAiAccess so FloqAi can return the new "Staff Scheduling" help
# (help-scheduling-schedule-for). The server denies help ids missing from functions/floqai-content-classes.json,
# and the deployed copy predates that id. Deploys from a clean clone of main (422f5cd or later).
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".deploy-s3-1-34-floqai"
$git = "C:\Program Files\Git\cmd\git.exe"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
$classes = Get-Content (Join-Path $stage "functions/floqai-content-classes.json") -Raw
if ($classes -notmatch '"help-scheduling-schedule-for"') { throw "main does not have the s3.1.34 FloqAi manifest yet" }
Push-Location (Join-Path $stage "functions")
try {
  cmd /c "npm ci --silent"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} finally { Pop-Location }
Push-Location $stage
try {
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
  firebase deploy --only "functions:getFloqAiAccess" --project shoutoutdemo-5b402 --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
} finally { Pop-Location }
Write-Host "getFloqAiAccess redeployed with the s3.1.34 FloqAi manifest"
