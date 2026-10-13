[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [string]$Base = "29b69a0",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-41-identity-loop"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies from $Commit: new files, plus modified files whose main copy must equal $Base (drift check, v= values
# ignored). patron-app.js gets only this release's hunks ($Base..$Commit diff), never a whole-file copy. Asset re-stamp,
# APP_V, functions/package.json (version + new test) and README run on main's own copies via scripts/bump-s3-1-41.js.
# display-suprstr.js / suprstr-webrtc.js / mail-log.js / display-security-functions.js / admin-scheduling.js are never copied.
$new = @(
  "floqr-identity-card.js",
  "functions/identity-card.test.js",
  "scripts/bump-s3-1-41.js"
)
$modified = @(
  "display-app.js", "display.css", "display.html", "display2.html", "floqr-frame-loop.js", "floqr-board-fit.js",
  "index.html", "shared-data.js",
  "functions/commerce-invariants.test.js", "functions/display-safe-render.test.js", "functions/nfl-jersey-dual.test.js"
)
$copy = $new + $modified
function Normalize([string]$text) {
  (($text -replace "`r`n", "`n") -replace '([?&])v=[^"''&\s#<>`]*', '$1v=X').TrimEnd("`n")
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$drift = @()
foreach ($f in $modified + "patron-app.js") {
  $expected = Normalize ((& $git -C $root show "${Base}:$f") -join "`n")
  $onMain = Normalize (Get-Content (Join-Path $stage $f) -Raw -Encoding UTF8)
  if ($expected -ne $onMain) { $drift += $f }
}
foreach ($f in $new) { if (Test-Path (Join-Path $stage $f)) { $drift += "$f (already on main)" } }
if ($drift.Count) { throw "main drifted for: $($drift -join ', ') (merge by hand)" }

$tar = Join-Path $root ".publish-s3-1-41.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

$patch = Join-Path $root ".publish-s3-1-41-patron.patch"
cmd /c "`"$git`" -C `"$root`" diff --binary $Base $Commit -- patron-app.js > `"$patch`""
if ($LASTEXITCODE -ne 0 -or (Get-Item $patch).Length -eq 0) { throw "patron-app.js diff $Base..$Commit is empty" }
& $git -C $stage apply --cached $patch
if ($LASTEXITCODE -ne 0) { throw "patron-app.js hunks did not apply on main" }
& $git -C $stage checkout -- patron-app.js
Remove-Item $patch -Force

node (Join-Path $stage "scripts/bump-s3-1-41.js") $stage
if ($LASTEXITCODE -ne 0) { throw "s3.1.41 bump did not apply on main" }

Push-Location $stage
try {
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&](v|screen)=') { throw "${page}: Xibo URL must not carry ?v= / ?screen=" }
    if ((Get-Content $page -Raw) -notmatch 'floqr-identity-card\.js\?v=s3\.1\.41') { throw "${page}: floqr-identity-card.js not loaded / re-stamped" }
  }
  if ((Get-Content patron-app.js -Raw) -notmatch 'function floqrCardAttributionFields') { throw "patron-app.js composer fields missing on main" }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'const APP_V = "s3\.1\.41";') { throw "APP_V not bumped on main" }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  node scripts/build-floqai-content-classes.js --check
  if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes drifted on staged main tree" }
  & $git diff --ignore-cr-at-eol --stat | Select-Object -Last 1
  & $git diff --name-only -- functions | Where-Object { $_ -notmatch '\.test\.js$' }
} finally { Pop-Location }

Push-Location (Join-Path $stage "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed on staged main tree" }
  cmd /c "npm test > ..\..\.publish-s3-1-41-npm.txt 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content (Join-Path $root ".publish-s3-1-41-npm.txt") -Tail 9
  if ($testExit -ne 0) { throw "npm test failed on staged main tree (see .publish-s3-1-41-npm.txt)" }
} finally { Pop-Location; $ErrorActionPreference = "Stop" }

if ($DryRun) { Write-Host "Dry run OK - nothing pushed. Stage: $stage"; return }

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -u
  & $git add -- $new
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: s3.1.41 FloqR identity card loop - PRESENTED BY FloqMedia then FROM @handle, never hidden"
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

Write-Host "Published s3.1.41 to main"
