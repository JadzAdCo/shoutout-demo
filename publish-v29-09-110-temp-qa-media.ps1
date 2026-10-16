[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-110"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "floqr-temp-qa-showcase.js",
  "shared-data.js",
  "club-profile.html",
  "club-profile-app.js",
  "admin.html",
  "index.html",
  "patron-portal.html",
  "master-admin.html",
  "display.html",
  "guest-list.html",
  "temp-qa-images-preview.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}
$pngSrc = Join-Path $root "images\temp-qa"
$pngDst = Join-Path $stage "images\temp-qa"
New-Item -ItemType Directory -Force -Path $pngDst | Out-Null
Get-ChildItem $pngSrc -File -Filter "*.png" | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $pngDst $_.Name) -Force
}
$nested = Join-Path $pngDst "temp-qa"
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  if (Test-Path $nested) { & $git rm -r --ignore-unmatch -- "images/temp-qa/temp-qa" }
  & $git add -- $files
  & $git add -- "images/temp-qa/*.png"
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Fix temp-qa PNG paths; max public-profile media + VIP/portrait LED scenes (v29.09.110)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.110 Pages"
