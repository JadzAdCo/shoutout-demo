[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-20-floqai-sos2fa"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "admin.css",
  "admin.html",
  "floqai-help-repository.js",
  "floqr-nav.js",
  "help-attach.js",
  "index.html",
  "intent-search.js",
  "master-admin.html",
  "patron-portal.html",
  "scheduling.html",
  "staff-worksheet.html",
  ".cursor/rules/floqai-audience-security.mdc",
  ".cursor/rules/floqai-help-repository.mdc",
  "functions/sos2fa-core.js",
  "functions/sos2fa-core.test.js",
  "functions/sos2fa-functions.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $src)) { throw "Missing source: $rel" }
  Copy-Item $src $dst -Force
}

Push-Location $stage
try {
  $name = (& $git config user.name 2>$null)
  if ([string]::IsNullOrWhiteSpace(($name -join ""))) {
    & $git config user.name "JadzAdCo"
  }
  $email = (& $git config user.email 2>$null)
  if ([string]::IsNullOrWhiteSpace(($email -join ""))) {
    & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  }
  & $git add -- $files
  & $git diff --cached --stat
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Publish FLOQR s3.0.20: FloqAi audience gates and SOS2FA Privilege Admin Access"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.20 FloqAi audiences + SOS2FA UI (deploy requestSos2faCode separately)"
