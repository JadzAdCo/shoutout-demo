[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-112"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "admin-notifications.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "ai-diagnostics-service.js",
  "floqr-temp-qa-showcase.js",
  "temp-qa-images-preview.html",
  "master-admin.html",
  "index.html",
  "club-profile.html",
  "display.html",
  "patron-portal.html",
  "guest-list.html"
)
$pngs = @(
  "staff-imani.png", "staff-imani-floor.png", "staff-imani-vip.png",
  "staff-sofia.png", "staff-sofia-floor.png", "staff-sofia-vip.png",
  "staff-malik.png", "staff-malik-table.png",
  "staff-andre.png", "staff-jamal.png",
  "vip-donpapi-led-carry.png", "vip-donpapi-led-checking-in.png", "vip-donpapi-led-hbd.png"
)
$fnFiles = @(
  "functions/commerce-functions.js",
  "functions/messaging-functions.js",
  "functions/messaging-core.js",
  "functions/messaging-core.test.js",
  "functions/marketing-campaign-functions.js",
  "functions/receipt-delivery.js",
  "functions/ai-discovery-functions.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}
$imgDest = Join-Path $stage "images\temp-qa"
New-Item -ItemType Directory -Force -Path $imgDest | Out-Null
foreach ($png in $pngs) {
  $src = Join-Path $root "images\temp-qa\$png"
  if (-not (Test-Path $src)) { throw "Missing PNG: $png" }
  Copy-Item $src (Join-Path $imgDest $png) -Force
}
$fnDir = Join-Path $stage "functions"
New-Item -ItemType Directory -Force -Path $fnDir | Out-Null
foreach ($f in $fnFiles) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git add -- $fnFiles
  foreach ($png in $pngs) {
    & $git add -- "images/temp-qa/$png"
  }
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Fix Twilio quoted Account SID; unique diverse waitstaff; DonPapi LED-carry VIP shots (v29.09.112)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.112 Pages"
