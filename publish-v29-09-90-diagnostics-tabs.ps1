[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-90"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "master-admin.html","master-admin-app.js","master-display-security.js",
  "master-diagnostics-panels.js","admin.css","styles.css",
  "display-error.html","display-error-app.js","floqr-logger.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
foreach ($f in $files) { Copy-Item (Join-Path $root $f) (Join-Path $stage $f) -Force }
Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Diagnostics tab group: nest logging/archives/manual tests + Xibo load-error page (v29.09.90)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.90"
