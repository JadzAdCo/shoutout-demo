[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"

$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = Join-Path $packageRoot ".publish-v29-09-69"
$gitExe = "C:\Program Files\Git\cmd\git.exe"

$releaseFiles = @(
  "payment-service.js",
  "payment-return-app.js",
  "payment-return.html",
  "suprstar-preview.js",
  "suprstar-preview.html"
)

foreach ($relativePath in $releaseFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $relativePath) -PathType Leaf)) {
    throw "Required file is missing: $relativePath"
  }
}

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
    & $gitExe commit -m "Fix supRstar queue: confirm Stripe payment on return page (v29.09.69)"
    & $gitExe -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed." }
  }
}
finally {
  Pop-Location
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}

Write-Host "Published v29.09.69 frontend."
