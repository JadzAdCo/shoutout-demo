[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-40-nfl-eagles-silhouette"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "display.css",
  "display.html",
  "display2.html",
  "display-app.js",
  "floqr-nav.js",
  "index.html",
  "jersey-catalog.js",
  "patron-app.js",
  "shared-data.js",
  "README.md",
  "images/nfl/nfl-scammerville-back-with-club.png",
  "images/nfl/nfl-49ers-back-with-club.png",
  "images/nfl/nfl-seahawks-back-with-club.png",
  "images/nfl/nfl-broncos-back-with-club.png",
  "images/nfl/nfl-rams-back-with-club.png",
  "images/nfl/nfl-patriots-back-with-club.png",
  "images/nfl/nfl-bills-back-with-club.png",
  "images/nfl/nfl-cowboys-back-with-club.png",
  "images/nfl/nfl-giants-back-with-club.png",
  "images/nfl/nfl-ravens-back-with-club.png",
  "images/nfl/nfl-commanders-back-with-club.png"
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
    & $git commit -m "s3.0.40: NFL Eagles-silhouette kits and dual shoutout layouts"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
    & $git log -1 --format="%H"
  }
} finally { Pop-Location }
Write-Host "Published s3.0.40 Pages"
