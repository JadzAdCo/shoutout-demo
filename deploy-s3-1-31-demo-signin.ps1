# s3.1.31 demo sign-in code: deploy only the callables this change touches, from a clean git archive of the commit
# (never the dirty working tree). getFloqAiAccess reads functions/floqai-content-classes.json, which gained the
# help-master-demo-signin entry, so it ships too. Afterwards an unauthenticated call must be refused.
param([Parameter(Mandatory = $true)][string]$Commit)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

$only = "functions:issueDemoSignInCode,functions:requestEmailOtp,functions:verifyEmailOtp,functions:getFloqAiAccess"
$export = Join-Path $env:TEMP "floqr-deploy-s3-1-31"
if (Test-Path $export) { Remove-Item $export -Recurse -Force }
New-Item -ItemType Directory -Path $export | Out-Null
$tar = Join-Path $env:TEMP "floqr-deploy-s3-1-31.tar"
git archive --format=tar -o $tar $Commit
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $export
Remove-Item $tar -Force

Push-Location (Join-Path $export "functions")
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed in the export" }
} finally { Pop-Location }

$env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
Push-Location $export
try {
  firebase deploy --only $only --project shoutoutdemo-5b402 --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed" }
} finally { Pop-Location }

$url = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/issueDemoSignInCode"
$refused = $null
try {
  $res = Invoke-WebRequest -Uri $url -Method Post -ContentType "application/json" -Body '{"data":{"email":"temp_waitress_1@floqr-demo.com","reason":"unauthenticated probe"}}' -UseBasicParsing
  $refused = "NOT REFUSED (HTTP $($res.StatusCode)): $($res.Content)"
} catch {
  $refused = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
}
if ($refused -notmatch "UNAUTHENTICATED") { throw "Unauthenticated probe: $refused" }
Write-Host "Unauthenticated call refused: $refused"
Write-Host "Deployed $only from $Commit."
