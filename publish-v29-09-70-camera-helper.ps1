[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"

$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = Join-Path $packageRoot ".publish-v29-09-70"
$gitExe = "C:\Program Files\Git\cmd\git.exe"

$releaseFiles = @(
  "suprstar-preview.html",
  "suprstar-preview.js"
)

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
& $gitExe clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stagingRoot
if ($LASTEXITCODE -ne 0) { throw "GitHub clone failed." }

foreach ($relativePath in $releaseFiles) {
  Copy-Item (Join-Path $packageRoot $relativePath) (Join-Path $stagingRoot $relativePath) -Force
}

Push-Location $stagingRoot
try {
  & $gitExe config user.name "JadzAdCo"
  & $gitExe config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $gitExe add -- $releaseFiles
  & $gitExe diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $gitExe commit -m "Fix supRstar preview camera helper load (v29.09.70)"
    & $gitExe -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed." }
  }
}
finally {
  Pop-Location
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}

Write-Host "Published v29.09.70 camera helper hotfix."
