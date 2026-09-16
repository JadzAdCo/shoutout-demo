[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-77-twilio-logs"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "admin-marketing.js",
  "master-admin.html",
  "master-admin-app.js",
  "master-twilio-logging.js",
  "marketing-templates.js",
  "floqai-help-repository.js",
  "firestore.rules",
  "firestore.indexes.json",
  "functions/twilio-log.js",
  "functions/twilio-log.test.js",
  "functions/twilio-debugger-webhook.js",
  "functions/marketing-campaign-functions.js",
  "functions/messaging-functions.js",
  "functions/package.json",
  "functions/index.js"
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

# Keep CI suite green: do not add unpublished ad-campaign contract test.
$pkgPath = Join-Path $stage "functions\package.json"
if (Test-Path $pkgPath) {
  $pkg = Get-Content $pkgPath -Raw
  if ($pkg -notmatch 'twilio-log\.test\.js') {
    $pkg = $pkg -replace 'mail-log\.test\.js', 'mail-log.test.js twilio-log.test.js'
  }
  $pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js nfl-jersey-dual\.test\.js"', ' shoutout-compliance.test.js"'
  $pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js"', ' shoutout-compliance.test.js"'
  [IO.File]::WriteAllText($pkgPath, $pkg)
}

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: Twilio Master Admin tab, club SMS/WhatsApp logs, marketing send fix (s3.0.77)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published Twilio logging s3.0.77 to main"
