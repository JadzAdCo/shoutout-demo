[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-86-template-profile-i18n"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "index.html",
  "patron-app.js",
  "patron-portal.html",
  "patron-portal-app.js",
  "floqai-search.js",
  "floqr-i18n.js",
  "floqr-i18n-help.js",
  "floqai-help-repository.js",
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
  "scripts/_help-en.json",
  "scripts/_help-fr.json",
  "scripts/_help-de.json",
  "scripts/_help-es.json",
  "scripts/_help-nl.json",
  "scripts/_help-ru.json",
  "scripts/_help-it.json",
  "scripts/_help-pt.json",
  "scripts/_help-el.json",
  "scripts/_help-pl.json",
  "scripts/_help-ar.json"
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
    & $git commit -m "feat: localize template select FloqAi and profile summary fields (s3.0.86)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.86 template/profile i18n to main"
