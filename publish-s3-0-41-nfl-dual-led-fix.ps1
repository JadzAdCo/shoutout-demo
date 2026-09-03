[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-41-nfl-dual-led-fix"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "display.css",
  "display.html",
  "display2.html",
  "display-app.js",
  "index.html",
  "patron-app.js",
  "README.md"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $src)) { Write-Host "Skip missing $rel"; continue }
  Copy-Item $src $dst -Force
}
Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "s3.0.41: NFL dual LED fix — solid black frame 2, FloqR card, nflJersey checkout caps"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
    & $git log -1 --format="%H"
  } else {
    Write-Host "No Pages file changes to publish"
  }
} finally { Pop-Location }
Write-Host "Published s3.0.41 Pages"
