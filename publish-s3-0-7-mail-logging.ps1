[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-7-mail-logging"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "admin.css",
  "ai-diagnostics-service.js",
  "floqai-help-repository.js",
  "floqr-nav.js",
  "firestore.indexes.json",
  "firestore.rules",
  "index.html",
  "intent-search.js",
  "master-admin.html",
  "master-admin-app.js",
  "master-mail-logging.js",
  "functions/index.js",
  "functions/package.json",
  "functions/mail-log.js",
  "functions/mail-log-functions.js",
  "functions/mail-log.test.js",
  "functions/ai-discovery-functions.js",
  "functions/messaging-functions.js",
  "functions/sos2fa-functions.js",
  "functions/receipt-delivery.js",
  "functions/display-security-functions.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

Push-Location $stage
try {
  & $git add -- $files
  & $git diff --cached --stat
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git -c user.name="JadzAdCo" -c user.email="290611448+JadzAdCo@users.noreply.github.com" commit -m "Publish FLOQR s3.0.7: Mail Logging for system emails with TLS 1.3"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.7 Mail Logging to GitHub Pages"
