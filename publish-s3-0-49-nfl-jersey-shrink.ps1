[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-49-nfl-jersey-shrink"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "display.css",
  "display-app.js",
  "display.html",
  "display2.html"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  Copy-Item $src $dst -Force
}

Set-Content -Path (Join-Path $stage "commit-msg.txt") -Value "s3.0.49: shrink Scammerville NFL jersey 10% and realign name and number" -Encoding utf8NoBOM

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

Write-Host "Published s3.0.49 Pages"
