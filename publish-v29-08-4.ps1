[CmdletBinding()]
param(
  [string]$FirebaseProject = "shoutoutdemo-5b402"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"

$packageRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $packageRoot ".publish-v29-08-4"))
$packagePrefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $stagingRoot.StartsWith($packagePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the v29-08 package."
}

$releaseFiles = @(
  "admin-app.js",
  "admin.html",
  "ai-service.js",
  "display-app.js",
  "display.css",
  "display.html",
  "firestore.rules",
  "index.html",
  "master-admin-app.js",
  "master-admin.html",
  "patron-app.js",
  "patron-portal-app.js",
  "patron-portal.html",
  "shared-data.js",
  "styles.css",
  "TEXT-LIMITS-V29-08-4.md",
  "functions/ai-discovery-functions.js",
  "functions/commerce-functions.js",
  "functions/commerce-invariants.test.js",
  "functions/firestore-rules.test.js",
  "functions/index.js",
  "functions/package.json",
  "functions/package-lock.json"
)

foreach ($relativePath in $releaseFiles) {
  $sourcePath = Join-Path $packageRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Required release file is missing: $relativePath"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not available in this PowerShell session."
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
    Write-Host "GitHub already contains the v29.08.4 text-layout release files."
  } else {
    & git commit -m "Publish FLOQR v29.08.4 display-aware text limits"
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed. Complete Git Credential Manager sign-in if prompted, then rerun the script." }
  }
}
finally {
  Pop-Location
}

Write-Host "Deploying reviewed text rules and the two affected Functions..."
Push-Location $packageRoot
try {
  & firebase.cmd deploy --only "firestore,functions:aiSuggestShoutOut,functions:createFloqrCheckoutSession" --project $FirebaseProject
  if ($LASTEXITCODE -ne 0) { throw "Firebase text-layout deployment failed." }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

Write-Host "FLOQR v29.08.4 publication completed."
Write-Host "Patron app: https://jadzadco.github.io/shoutout-demo/?v=29.08.4"
Write-Host "Zebbies Xibo: https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=29.08.4"
