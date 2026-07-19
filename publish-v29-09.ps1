[CmdletBinding()]
param(
  [string]$FirebaseProject = "shoutoutdemo-5b402"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$env:GIT_PAGER = "cat"
$env:PAGER = "cat"
$env:GCM_INTERACTIVE = "always"
$env:GIT_TERMINAL_PROMPT = "1"
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true"

$packageRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $packageRoot ".publish-v29-09-0"))
$packagePrefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $stagingRoot.StartsWith($packagePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the v29-08 package."
}

$releaseFiles = @(
  "admin.html",
  "ai-template-studio.js",
  "commerce.html",
  "display-app.js",
  "display.css",
  "display.html",
  "firestore.rules",
  "index.html",
  "master-admin-app.js",
  "master-admin.html",
  "patron-app.js",
  "patron-portal.html",
  "payment-service.js",
  "pickup.html",
  "services.html",
  "shared-data.js",
  "styles.css",
  "DEPLOYMENT-V29-09.md",
  "functions/firestore-rules.test.js",
  "functions/auth-entry-ui.test.js",
  "functions/payment-service.test.js",
  "functions/recommendation-library.test.js",
  "functions/package.json",
  "functions/package-lock.json"
)

foreach ($relativePath in $releaseFiles) {
  $sourcePath = Join-Path $packageRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Required release file is missing: $relativePath"
  }
}

function Find-GitWithHttpsSupport {
  $candidates = @(
    (Join-Path $PSScriptRoot ".tools\portablegit\node_modules\portablegit\out\cmd\git.exe"),
    (Get-Command git.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    $execPath = (& $candidate --exec-path 2>$null | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($execPath)) { continue }
    if ((Test-Path -LiteralPath (Join-Path $execPath "git-remote-https.exe")) -or
        (Test-Path -LiteralPath (Join-Path $execPath "git-remote-http.exe"))) {
      return $candidate
    }
  }
  return $null
}

$gitExecutable = Find-GitWithHttpsSupport
if ([string]::IsNullOrWhiteSpace($gitExecutable)) {
  throw "A complete Git for Windows installation is required. Install it from https://git-scm.com/download/win, close and reopen PowerShell, then rerun this script. The Codex-bundled minimal Git does not include HTTPS publishing support."
}
if (-not (Get-Command firebase.cmd -ErrorAction SilentlyContinue)) {
  throw "Firebase CLI is not available in this PowerShell session."
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

Write-Host "Cloning the live GitHub Pages repository..."
& $gitExecutable clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stagingRoot
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
  $gitUserName = (& $gitExecutable config user.name 2>$null)
  if ([string]::IsNullOrWhiteSpace(($gitUserName -join ""))) {
    & $gitExecutable config user.name "JadzAdCo"
  }
  $gitUserEmail = (& $gitExecutable config user.email 2>$null)
  if ([string]::IsNullOrWhiteSpace(($gitUserEmail -join ""))) {
    & $gitExecutable config user.email "290611448+JadzAdCo@users.noreply.github.com"
  }

  & $gitExecutable add -- $releaseFiles
  if ($LASTEXITCODE -ne 0) { throw "Git staging failed." }

  & $gitExecutable --no-pager diff --cached --check
  if ($LASTEXITCODE -ne 0) { throw "Git found whitespace or patch errors." }

  & $gitExecutable diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "GitHub already contains the v29.09.2 release files."
  } else {
    & $gitExecutable commit -m "Publish FLOQR v29.09.2 checkout hotfix"
    if ($LASTEXITCODE -ne 0) { throw "Git commit failed." }
    & $gitExecutable -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "GitHub push failed. Complete Git Credential Manager sign-in if prompted, then rerun the script." }
  }
}
finally {
  Pop-Location
}

Write-Host "Deploying recommendation moderation Firestore rules..."
Push-Location $packageRoot
try {
  & firebase.cmd deploy --only firestore --project $FirebaseProject
  if ($LASTEXITCODE -ne 0) { throw "Firebase Firestore rules deployment failed." }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

Write-Host "FLOQR v29.09.2 publication completed."
Write-Host "Patron app: https://jadzadco.github.io/shoutout-demo/?v=29.09.2"
Write-Host "Master Admin: https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.2"
Write-Host "Zebbies Xibo: https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=29.09.2"
