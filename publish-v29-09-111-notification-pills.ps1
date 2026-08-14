[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-111"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "admin.css",
  "admin-notifications.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "ai-diagnostics-service.js",
  "master-admin.html",
  "index.html",
  "payment-return-app.js",
  "payment-return.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}
$fnDir = Join-Path $stage "functions"
New-Item -ItemType Directory -Force -Path $fnDir | Out-Null
@(
  "functions/commerce-functions.js",
  "functions/messaging-functions.js",
  "functions/messaging-core.js",
  "functions/messaging-core.test.js",
  "functions/ai-discovery-functions.js",
  "functions/commerce-invariants.test.js"
) | ForEach-Object {
  $src = Join-Path $root $_
  if (-not (Test-Path $src)) { throw "Missing source file: $_" }
  Copy-Item $src (Join-Path $stage $_) -Force
}
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git add -- functions/commerce-functions.js functions/messaging-functions.js functions/messaging-core.js functions/messaging-core.test.js functions/ai-discovery-functions.js functions/commerce-invariants.test.js
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Compact SMS/WhatsApp notification pills; persist subscription webhook; clearer test alerts (v29.09.111)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.111 Pages"
