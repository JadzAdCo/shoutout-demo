[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:GCM_INTERACTIVE = "always"
$env:GIT_TERMINAL_PROMPT = "1"

$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = [IO.Path]::GetFullPath((Join-Path $packageRoot ".publish-v29-09-68"))
$packagePrefix = $packageRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $stagingRoot.StartsWith($packagePrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the release package."
}

$releaseFiles = @(
  "payment-service.js",
  "suprstr-search.js",
  "suprstr-search.html",
  "suprstar-preview.js",
  "suprstar-preview.html",
  "payment-return-app.js",
  "payment-return.html"
)

foreach ($relativePath in $releaseFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $relativePath) -PathType Leaf)) {
    throw "Required file is missing: $relativePath"
  }
}

$gitCandidates = @(
  (Join-Path $packageRoot ".tools\portablegit\node_modules\portablegit\out\cmd\git.exe"),
  (Get-Command git.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
  "C:\Program Files\Git\cmd\git.exe",
  "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -Unique

$gitExecutable = $gitCandidates | Where-Object {
  $execPath = (& $_ --exec-path 2>$null | Select-Object -First 1)
  $execPath -and (Test-Path -LiteralPath (Join-Path $execPath "git-remote-https.exe"))
} | Select-Object -First 1
if (-not $gitExecutable) { throw "No HTTPS-capable Git installation was found." }

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }

Write-Host "Cloning the current GitHub Pages release..."
& $gitExecutable clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stagingRoot
if ($LASTEXITCODE -ne 0) { throw "GitHub clone failed." }

foreach ($relativePath in $releaseFiles) {
  $sourcePath = Join-Path $packageRoot $relativePath
  $destinationPath = Join-Path $stagingRoot $relativePath
  $destinationDirectory = Split-Path -Parent $destinationPath
  if (-not (Test-Path -LiteralPath $destinationDirectory)) { New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null }
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

Push-Location $stagingRoot
try {
  & $gitExecutable config user.name "JadzAdCo"
  & $gitExecutable config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $gitExecutable add -- $releaseFiles
  if ($LASTEXITCODE -ne 0) { throw "Git staging failed." }
  & $gitExecutable diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "supRstar popup fix is already live - no changes to commit."
  } else {
    & $gitExecutable commit -m "Fix supRstar popup billing: sync open before await, popup telemetry (v29.09.68)"
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }
    & $gitExecutable -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed." }
  }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
Write-Host "FLOQR v29.09.68 supRstar popup fix published."
Write-Host "Test URL: https://jadzadco.github.io/shoutout-demo/suprstr-search.html?v=29.09.68"
