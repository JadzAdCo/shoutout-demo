[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-101"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "admin.css",
  "admin-scheduling.js",
  "styles.css",
  "help-attach.js",
  "helper-popouts.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "floqr-i18n.js",
  "index.html",
  "patron-portal.html",
  "patron-portal-app.js",
  "translation-policy.html",
  "scheduling.html",
  "scheduling-portal.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  $dst = Join-Path $stage $f
  $dstDir = Split-Path $dst -Parent
  if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
  Copy-Item $src $dst -Force
}
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Club Admin people×days schedule grid + Dutch first-use i18n (v29.09.101)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.101 Pages"
