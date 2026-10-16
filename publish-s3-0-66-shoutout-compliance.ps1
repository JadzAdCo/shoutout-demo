[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-66-shoutout-compliance"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "patron-portal.html",
  "patron-portal-app.js",
  "patron-app.js",
  "index.html",
  "admin-app.js",
  "admin.css",
  "shared-data.js",
  "master-admin.html",
  "master-admin-app.js",
  "master-admin-shoutouts.js",
  "floqr-i18n.js",
  "floqr-i18n-help.js",
  "floqai-help-repository.js",
  "scripts/_help-en.json",
  "firestore.rules",
  "functions/index.js",
  "functions/package.json",
  "functions/shoutout-compliance-functions.js",
  "functions/shoutout-compliance.test.js",
  "functions/recommendation-library.test.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

$msg = "s3.0.66: Master Admin ShoutOuts compliance log + patron Re-Use/Archive"
[IO.File]::WriteAllText((Join-Path $stage "commit-msg.txt"), $msg + "`n")

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -F commit-msg.txt
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages file changes"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.66 Master Admin ShoutOuts compliance + patron Archive/Re-Use"
