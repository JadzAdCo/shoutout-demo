[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-29-inbox-jersey"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "floqr-i18n.js",
  "patron-portal.html",
  "patron-portal-app.js",
  "display-app.js",
  "display.css",
  "display.html",
  "shared-data.js",
  "jersey-catalog.js",
  "index.html",
  "patron-app.js",
  "floqr-nav.js",
  "images/soccer/soccer-germany-back-with-country.png",
  "README.md",
  ".cursor/rules/floqr-translation.mdc"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $src)) {
    Write-Host "Skip missing $rel"
    continue
  }
  Copy-Item $src $dst -Force
}
Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "s3.0.29: localize FloqR Inbox panel bodies; soccer jersey 8-char names, number centering, Germany kit"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
    & $git log -1 --format="%H"
  } else {
    Write-Host "No Pages changes to commit"
    & $git log -1 --oneline
    & $git log -1 --format="%H"
  }
} finally { Pop-Location }
Write-Host "Published s3.0.29 Pages"
