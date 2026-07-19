[CmdletBinding()]
param(
  [string]$FirebaseProject = "shoutoutdemo-5b402"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"

$packageRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $packageRoot ".publish-v29-08-2"))
$packagePrefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $stagingRoot.StartsWith($packagePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the v29-08 package."
}

$releaseFiles = @(
  "admin-app.js",
  "admin.html",
  "display-app.js",
  "display.css",
  "display.html",
  "index.html",
  "patron-app.js",
  "payment-service.js",
  "shared-data.js",
  "styles.css",
  "README.md",
  "DEPLOYMENT-V29-08.md",
  "XIBO-ZEBBIES-FOOTBALL-SETUP.md",
  "functions/commerce-functions.js",
  "functions/commerce-invariants.test.js",
  "functions/index.js",
  "functions/package.json",
  "functions/package-lock.json",
  "functions/stripe-connect-core.js",
  "functions/stripe-connect-core.test.js"
)

foreach ($relativePath in $releaseFiles) {
  $sourcePath = Join-Path $packageRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Required release file is missing: $relativePath"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not available in this PowerShell session. Install Git for Windows, reopen PowerShell, and rerun this script."
}
if (-not (Get-Command firebase.cmd -ErrorAction SilentlyContinue)) {
  throw "Firebase CLI is not available in this PowerShell session."
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

Write-Host "Cloning the live GitHub Pages repository..."
& git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stagingRoot
if ($LASTEXITCODE -ne 0) { throw "GitHub clone failed." }

foreach ($relativePath in $releaseFiles) {
  $sourcePath = Join-Path $packageRoot $relativePath
  $destinationPath = Join-Path $stagingRoot $relativePath
  $destinationDirectory = Split-Path -Parent $destinationPath
  if (-not (Test-Path -LiteralPath $destinationDirectory)) {
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  }
  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

Push-Location $stagingRoot
try {
  $gitUserName = (& git config user.name 2>$null)
  if ([string]::IsNullOrWhiteSpace(($gitUserName -join ""))) {
    & git config user.name "JadzAdCo"
  }
  $gitUserEmail = (& git config user.email 2>$null)
  if ([string]::IsNullOrWhiteSpace(($gitUserEmail -join ""))) {
    & git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  }

  & git add -- $releaseFiles
  if ($LASTEXITCODE -ne 0) { throw "Git staging failed." }

  & git --no-pager diff --cached --check
  if ($LASTEXITCODE -ne 0) { throw "Git found whitespace or patch errors." }

  & git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "GitHub already contains the approved v29.08.2 release files."
  } else {
    & git commit -m "Publish FLOQR v29.08.2 ShoutOut display and 10-minute reset"
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed. Complete the Git Credential Manager sign-in if prompted, then rerun the script." }
  }
}
finally {
  Pop-Location
}

Write-Host "Deploying only the approved ShoutOut expiry scheduler..."
Push-Location $packageRoot
try {
  $env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"
  & firebase.cmd deploy --only "functions:expireLiveShoutouts" --project $FirebaseProject
  if ($LASTEXITCODE -ne 0) { throw "Firebase scheduler deployment failed." }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

Write-Host "FLOQR v29.08.2 publication completed."
Write-Host "Patron portal: https://jadzadco.github.io/shoutout-demo/?v=29.08.2"
Write-Host "Zebbies Xibo: https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=29.08.2"
