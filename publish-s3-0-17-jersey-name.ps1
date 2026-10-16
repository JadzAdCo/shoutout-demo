[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-17-jersey-name"
$git = "C:\Program Files\Git\cmd\git.exe"

# Pages-only: soccer photo-kit name/number CSS. Do not copy unpublished WebRTC files.
$files = @(
  "display.css",
  "display.html",
  "display2.html"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  Copy-Item (Join-Path $root $rel) (Join-Path $stage $rel) -Force
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
    & $git commit -m "Raise soccer jersey names off the number and tighten 10 tracking (display.css s3.0.17)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published display.css s3.0.17 Pages (jersey name/number only; Functions not deployed)"
