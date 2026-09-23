[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-88-translation-overrides"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "master-admin.html",
  "master-admin-app.js",
  "master-admin-translation-overrides.js",
  "floqr-i18n.js",
  "floqr-i18n-help.js",
  "firestore.rules",
  "functions/i18n-coverage.test.js",
  "scripts/build-i18n-chrome.js",
  "scripts/build-i18n-help-packs.js",
  "scripts/_chrome-en.json",
  "scripts/_chrome-fr.json",
  "scripts/_chrome-de.json",
  "scripts/_chrome-es.json",
  "scripts/_chrome-nl.json",
  "scripts/_chrome-ru.json",
  "scripts/_chrome-it.json",
  "scripts/_chrome-pt.json",
  "scripts/_chrome-el.json",
  "scripts/_chrome-pl.json",
  "scripts/_chrome-ar.json",
  ".cursor/rules/design-notes-translation-overrides.mdc"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (!(Test-Path $src)) {
    Write-Host "Skip missing $rel"
    continue
  }
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
    & $git commit -m "feat: Master Admin Translation Overrides for German and Arabic (s3.0.88)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.88 translation overrides to main"
