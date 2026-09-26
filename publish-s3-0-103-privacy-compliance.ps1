[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-103-privacy-compliance"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "privacy.html",
  "floqr-canonical.js",
  "floqr-privacy-prefs.js",
  "floqr-consent-mode.js",
  "floqr-i18n-help.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "ad-campaigns.js",
  "patron-portal.html",
  "patron-portal-app.js",
  "index.html",
  "master-admin.html",
  "ai-diagnostics-service.js",
  "firestore.rules",
  "README.md",
  "functions/index.js",
  "functions/privacy-dsar-functions.js",
  "functions/marketing-campaign-functions.js",
  "functions/privacy-compliance.test.js",
  "functions/ad-campaigns-business.test.js",
  "functions/i18n-coverage.test.js",
  "functions/package.json",
  "scripts/_help-en.json"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (!(Test-Path $src)) { throw "Missing $rel" }
  $dst = Join-Path $stage $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: Privacy Policy + DNS/GPC + DSAR callables (s3.0.103)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.103 privacy compliance to main"
