[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-18-jersey-ru-ua"
$git = "C:\Program Files\Git\cmd\git.exe"

# Pages: Russia/Ukraine photo kits + photo-back name/number overlay (smaller, centered, nudged down).
$files = @(
  "display.css",
  "display.html",
  "display2.html",
  "display-app.js",
  "index.html",
  "jersey-catalog.js",
  "shared-data.js",
  "images/soccer/soccer-russia-back-with-country.png",
  "images/soccer/soccer-ukraine-back-with-country.png"
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
    & $git commit -m "Publish Russia/Ukraine soccer kits and tighten photo-jersey name/number overlay (s3.0.18)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.18 jersey Russia/Ukraine + overlay (Functions not deployed)"
