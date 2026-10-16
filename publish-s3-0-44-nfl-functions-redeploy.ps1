[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-44-nfl-functions-redeploy"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "display-app.js",
  "admin-app.js",
  "display.html",
  "display2.html",
  "admin.html"
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
    & $git commit -m "s3.0.44: NFL dual - trust catalog nflDualLayout; admin uses raw mainText for NFL"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages file changes"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.44 Pages"
Write-Host ""
Write-Host "--- NOW DEPLOYING FUNCTIONS ---"
Push-Location (Join-Path $root "functions")
try {
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = "120"
  & npx firebase-tools@latest deploy --only functions:createFloqrCheckoutSession,functions:confirmFloqrCheckoutSession --force 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Host "Functions deploy returned exit $LASTEXITCODE — check output above" }
} finally { Pop-Location }
