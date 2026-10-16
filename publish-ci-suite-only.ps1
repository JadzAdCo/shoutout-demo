[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-ci-suite-only"
$git = "C:\Program Files\Git\cmd\git.exe"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

Copy-Item (Join-Path $root "functions\package.json") (Join-Path $stage "functions\package.json") -Force

# Ensure unpublished ad-campaign / nfl dual tests are not in the CI suite on main.
$pkgPath = Join-Path $stage "functions\package.json"
$pkg = Get-Content $pkgPath -Raw
$pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js nfl-jersey-dual\.test\.js"', ' shoutout-compliance.test.js"'
$pkg = $pkg -replace ' shoutout-compliance\.test\.js ad-campaigns-business\.test\.js"', ' shoutout-compliance.test.js"'
[IO.File]::WriteAllText($pkgPath, $pkg)

Push-Location (Join-Path $stage "functions")
try {
  & npm test
  if ($LASTEXITCODE -ne 0) { throw "npm test failed in publish stage" }
} finally { Pop-Location }

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- functions/package.json
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: exclude unpublished ad-campaign contract test from Functions CI suite"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "main push failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No file changes"
  }
} finally { Pop-Location }

Write-Host "Published Functions CI suite follow-up to main"
