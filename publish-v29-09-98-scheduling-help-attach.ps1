[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-98"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "help-attach.js",
  "helper-popouts.js",
  "floqr-identity.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "admin-scheduling.js",
  "scheduling-portal.js",
  "scheduling.html",
  "admin.html",
  "master-admin.html",
  "styles.css",
  "admin.css",
  "docs/FLOQR-STAFF-SCHEDULING.md"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
New-Item -ItemType Directory -Force -Path (Join-Path $stage "docs") | Out-Null
foreach ($f in $files) {
  $src = Join-Path $root $f
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
    & $git commit -m "Staff Scheduling paid-this-month gate + FLOQRHelpAttach for ? help (v29.09.98)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.98 Pages"
