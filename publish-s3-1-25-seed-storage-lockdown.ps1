[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [Parameter(Mandatory = $true)][string]$PackageJsonCommit
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-25-seed-storage-lockdown"
$git = "C:\Program Files\Git\cmd\git.exe"
# design-notes-data-classification.mdc stays workspace-only (security findings).
# functions/package.json comes from $PackageJsonCommit so main only gains the new test, not other unpublished tests.
$files = @(
  "functions/bartr-seed-core.js",
  "functions/commerce-functions.js",
  "functions/seed-and-storage-lockdown.test.js",
  "seed-v29-09-14.html",
  "storage.rules"
)
$packageFiles = @("functions/package.json")
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$tar = Join-Path $root ".publish-s3-1-25-lockdown.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
& $git -C $root archive --format=tar -o $tar $PackageJsonCommit -- $packageFiles
if ($LASTEXITCODE -ne 0) { throw "git archive $PackageJsonCommit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract package.json failed" }
Remove-Item $tar -Force
$allFiles = $files + $packageFiles
foreach ($rel in $allFiles) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }

Push-Location $stage
try {
  $missing = @()
  foreach ($rel in ($files | Where-Object { $_ -like "*.html" })) {
    $html = Get-Content $rel -Raw
    [regex]::Matches($html, '(?:src|href)="\./([^"?#]+\.(?:js|css))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object {
      if (!(Test-Path $_)) { $missing += "$rel -> $_" }
    }
  }
  if ($missing.Count) { throw "Missing referenced assets on main: $($missing -join ', ')" }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  & $git diff --ignore-cr-at-eol --stat
} finally { Pop-Location }

Push-Location (Join-Path $stage "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed on staged main tree" }
  cmd /c "npm test 2>&1" | Select-Object -Last 9
  if ($LASTEXITCODE -ne 0) { throw "npm test failed on staged main tree" }
} finally { Pop-Location; $ErrorActionPreference = "Stop" }

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $allFiles
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix(security): lock down BartR seed (SOS2FA callable, missing-only) and clubMedia storage writes (club admin or Master Admin)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) {
      & $git -c credential.helper= -c credential.helper=manager pull --rebase --depth 50 origin main
      if ($LASTEXITCODE -ne 0) { throw "Rebase onto newer main failed" }
      & $git -c credential.helper= -c credential.helper=manager push origin main
      if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published seed + storage lockdown to main"
