[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$log = Join-Path $root ".deploy-s3-1-11-rules-checkout.log"
$export = Join-Path $env:TEMP "floqr-deploy-s3-1-11"
$git = "C:\Program Files\Git\cmd\git.exe"
function Log($m) { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

Set-Content -Path $log -Value "deploy s3.1.11 firestore:rules + createFloqrCheckoutSession"
try {
  $commit = "8fa3560"
  Log "export commit $commit"
  if (Test-Path $export) { Remove-Item $export -Recurse -Force }
  New-Item -ItemType Directory -Path $export | Out-Null
  $tar = Join-Path $env:TEMP "floqr-deploy-s3-1-11.tar"
  & $git -C $root archive --format=tar -o $tar $commit
  if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
  tar -xf $tar -C $export
  Remove-Item $tar -Force
  foreach ($rel in @("firebase.json", "firestore.rules", "functions/index.js", "functions/commerce-functions.js")) {
    if (!(Test-Path (Join-Path $export $rel))) { throw "export missing $rel" }
  }
  if (!(Select-String -Path (Join-Path $export "firestore.rules") -Pattern 'venueTemplateRoles' -Quiet)) { throw "export lacks template RBAC rules" }
  if (!(Select-String -Path (Join-Path $export "functions/commerce-functions.js") -Pattern 'LED_96X48_ONLY_TEMPLATE_IDS' -Quiet)) { throw "export lacks 96x48 checkout lock" }
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
    $out = cmd /c "firebase deploy --only firestore:rules --project shoutoutdemo-5b402 --non-interactive 2>&1"
    $code = $LASTEXITCODE
    $out | Select-Object -Last 12 | ForEach-Object { Log $_ }
    if ($code -ne 0) { throw "rules deploy exit $code" }
    Log "RULES OK"
    $env:FUNCTIONS_DISCOVERY_TIMEOUT = "90"
    $out = cmd /c "firebase deploy --only functions:createFloqrCheckoutSession --project shoutoutdemo-5b402 --non-interactive 2>&1"
    $code = $LASTEXITCODE
    $out | Select-Object -Last 25 | ForEach-Object { Log $_ }
    if ($code -ne 0) { throw "functions deploy exit $code" }
  } finally { Pop-Location }
  Log "DEPLOY OK"
} catch {
  Log ("FAILED: " + $_.Exception.Message)
  exit 1
}
