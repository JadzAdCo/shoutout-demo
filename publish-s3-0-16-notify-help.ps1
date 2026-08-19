[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-16"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "floqai-help-repository.js",
  "floqr-nav.js",
  "index.html",
  "intent-search.js",
  "master-admin.html",
  "patron-portal.html"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  Copy-Item (Join-Path $root $rel) (Join-Path $stage $rel) -Force
}

Push-Location $stage
try {
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Publish FLOQR s3.0.16: General Notifications copy in help ? and FloqAi"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.16 Pages"
