[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-12"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "ai-diagnostics-service.js",
  "display.html",
  "display2.html",
  "floqr-nav.js",
  "index.html",
  "master-admin.html",
  "shared-data.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

Push-Location $stage
try {
  & $git add -- $files
  & $git diff --cached --stat
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Publish FLOQR s3.0.12: Cameroon jersey test at Zebbies and LIMA Twist"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.12 Pages"
