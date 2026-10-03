[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$log = Join-Path $root ".deploy-s3-1-7-expire-live-idle.log"
$export = Join-Path $env:TEMP "floqr-deploy-s3-1-7"
$git = "C:\Program Files\Git\cmd\git.exe"
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

Set-Content -Path $log -Value "deploy s3.1.7 expireLiveShoutouts"
try {
  $sha = (& $git -C $root rev-parse --short HEAD).Trim()
  Log "workspace HEAD $sha"
  if (Test-Path $export) { Remove-Item $export -Recurse -Force }
  New-Item -ItemType Directory -Path $export | Out-Null
  $tar = Join-Path $env:TEMP "floqr-deploy-s3-1-7.tar"
  & $git -C $root archive --format=tar -o $tar HEAD
  if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
  tar -xf $tar -C $export
  Remove-Item $tar -Force
  foreach ($rel in @("firebase.json", "functions/index.js", "functions/floqr-demo-accounts.js", "functions/commerce-functions.js")) {
    if (!(Test-Path (Join-Path $export $rel))) { throw "export missing $rel" }
  }
  if (!(Select-String -Path (Join-Path $export "functions/commerce-functions.js") -Pattern "function idleLiveContentAfterExpiry" -Quiet)) { throw "export lacks idle reset" }
  Log "export ok at $export"

  Push-Location (Join-Path $export "functions")
  try {
    cmd /c "npm ci --silent 2>nul"
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
    Log "npm ci ok"
    $load = cmd /c "node -e ""require('./index.js'); console.log('index loads')"" 2>&1"
    Log ("load check: " + (($load | Select-Object -Last 3) -join " | "))
    if ($LASTEXITCODE -ne 0) { throw "functions/index.js does not load" }
  } finally { Pop-Location }

  Push-Location $export
  try {
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = "90"
    $out = cmd /c "firebase deploy --only functions:expireLiveShoutouts --project shoutoutdemo-5b402 --non-interactive 2>&1"
    $code = $LASTEXITCODE
    $out | Select-Object -Last 25 | ForEach-Object { Log $_ }
    if ($code -ne 0) { throw "firebase deploy exit $code" }
  } finally { Pop-Location }
  Log "DEPLOY OK"
} catch {
  Log ("FAILED: " + $_.Exception.Message)
  exit 1
}
