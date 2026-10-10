[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-32-otp-redaction"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies: new files, plus modified files whose main copy must equal the parent commit (drift check).
# Everything else (every page's floqr-nav.js?v=, master-admin.html, functions/package.json version + test list,
# README CURRENT PACKAGE) gets the anchored edits from scripts/bump-s3-1-32.js on main's own copy.
$new = @(
  "functions/secret-redaction.js",
  "functions/mail-log-redaction.test.js",
  "functions/app-version-sync.test.js",
  "scripts/bump-s3-1-32.js"
)
$modified = @("floqr-nav.js", "master-mail-logging.js", "functions/mail-log.js")
$copy = $new + $modified

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$drift = @()
foreach ($f in $modified) {
  $parent = (& $git -C $root show "${Commit}^:$f") -join "`n"
  $onMain = ((Get-Content (Join-Path $stage $f) -Raw -Encoding UTF8) -replace "`r`n", "`n").TrimEnd("`n")
  if ($parent.TrimEnd("`n") -ne $onMain) { $drift += $f }
}
if ($drift.Count) { throw "main drifted from ${Commit}^ for: $($drift -join ', ') (merge by hand)" }

$tar = Join-Path $root ".publish-s3-1-32.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/bump-s3-1-32.js") $stage
if ($LASTEXITCODE -ne 0) { throw "Anchored s3.1.32 bump did not apply on main" }

Push-Location $stage
try {
  $missing = @()
  foreach ($page in "master-admin.html", "index.html", "admin.html") {
    $html = Get-Content $page -Raw
    [regex]::Matches($html, '(?:src|href)="\./([^"?#]+\.(?:js|css))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object {
      if (!(Test-Path $_)) { $missing += "$page -> $_" }
    }
  }
  if ($missing.Count) { throw "Missing referenced assets on main: $($missing -join ', ')" }
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&]v=') { throw "${page}: Xibo URL must not carry ?v=" }
  }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  node scripts/build-floqai-content-classes.js --check
  if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes drifted on staged main tree" }
  & $git diff --ignore-cr-at-eol --stat
} finally { Pop-Location }

Push-Location (Join-Path $stage "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed on staged main tree" }
  cmd /c "npm test 2>&1" | Select-Object -Last 9
  if ($LASTEXITCODE -ne 0) { throw "npm test failed on staged main tree" }
} finally { Pop-Location; $ErrorActionPreference = "Stop" }

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -u
  & $git add -- $new
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: s3.1.32 FLOQRNav.appVersion tracks the package; system mail logs never store sign-in / SOS2FA codes"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) {
      & $git fetch --depth 20 origin main
      & $git rebase origin/main
      if ($LASTEXITCODE -ne 0) { & $git rebase --abort; throw "Pages push rejected and rebase conflicted; rerun the script" }
      & $git -c credential.helper= -c credential.helper=manager push origin main
      if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.32 to main"
