[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-108"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "floqr-temp-qa-showcase.js",
  "shared-data.js",
  "club-profile.html",
  "club-profile-app.js",
  "admin.html",
  "admin-scheduling.js",
  "index.html",
  "patron-portal.html",
  "patron-portal-app.js",
  "master-admin.html",
  "master-admin-app.js",
  "ai-diagnostics-service.js",
  "display.html",
  "guest-list.html",
  "temp-qa-images-preview.html",
  "images/temp-qa"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  $dst = Join-Path $stage $f
  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  if (Test-Path $src -PathType Container) {
    Copy-Item $src $dst -Recurse -Force
  } else {
    Copy-Item $src $dst -Force
  }
}
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "QA temp clubs: photoreal photos + full shared datapoints (v29.09.108)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.108 Pages"
