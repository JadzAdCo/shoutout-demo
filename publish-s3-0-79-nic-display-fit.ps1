[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-79-nic-display-fit"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "floqr-nav.js",
  "floqr-i18n.js",
  "master-admin.html",
  "master-admin-app.js",
  "floqai-help-repository.js",
  "display-app.js",
  "display.css",
  "display.html",
  "display2.html",
  "shared-data.js",
  "admin.html",
  "christine-text-fit-demo.html",
  "functions/display-text-fit.test.js",
  "functions/auth-entry-ui.test.js",
  ".cursor/rules/design-notes-display-screens.mdc",
  ".cursor/rules/design-notes-master-admin-nav.mdc",
  ".cursor/rules/screen-datapoints.mdc"
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
    & $git commit -m "feat: NIC back, SendGrid help cleanup, P1.56 screens, Christine text fit (s3.0.79)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.79 NIC/display fit to main"
