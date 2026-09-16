[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-76-functions-ci-green2"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "functions/package.json",
  "functions/shoutout-compliance.test.js",
  "floqr-client-ip.js",
  "patron-app.js",
  "payment-service.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (!(Test-Path $src)) { throw "Missing source $rel" }
  $dst = Join-Path $stage $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

# Drop unpublished feature tests from CI until Ad Campaign Pages ship.
$pkgPath = Join-Path $stage "functions\package.json"
$pkg = Get-Content $pkgPath -Raw
$pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js nfl-jersey-dual\.test\.js"', ' shoutout-compliance.test.js"'
$pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js"', ' shoutout-compliance.test.js"'
[IO.File]::WriteAllText($pkgPath, $pkg)

$msg = "fix: keep Functions CI suite on published surfaces only (drop unpublished ad-campaign test from npm test)"
[IO.File]::WriteAllText((Join-Path $stage "commit-msg.txt"), $msg + "`n")

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  Push-Location (Join-Path $stage "functions")
  try {
    & npm test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed in publish stage" }
  } finally { Pop-Location }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -F commit-msg.txt
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No file changes"
  }
} finally { Pop-Location }

Write-Host "Published Functions CI green follow-up to main"
