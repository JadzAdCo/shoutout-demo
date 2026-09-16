[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-78-twilio-nav"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "master-admin.html",
  "master-admin-app.js",
  "master-twilio-logging.js",
  "master-mail-logging.js",
  "floqr-i18n.js",
  "floqr-i18n-help.js",
  "floqai-help-repository.js",
  "ai-diagnostics-service.js",
  "functions/mail-log.test.js",
  "functions/twilio-log.test.js",
  ".cursor/rules/design-notes-twilio-logging.mdc",
  "scripts/patch-twilio-logs-i18n.js",
  "scripts/build-i18n-help-packs.js",
  "scripts/_help-en.json",
  "scripts/_help-ru.json",
  "scripts/_help-nl.json",
  "scripts/_help-fr.json",
  "scripts/_help-de.json",
  "scripts/_help-es.json",
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
    & $git commit -m "fix: Twilio Compliance + SendGrid mail under Twilio; club messaging i18n (s3.0.78)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published Twilio nav/i18n s3.0.78 to main"
