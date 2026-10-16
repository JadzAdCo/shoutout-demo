[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [Parameter(Mandatory = $true)][string]$FixCommit,
  [string]$Base = "9cf20ea",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-43-venue-shoutout-link"
$git = "C:\Program Files\Git\cmd\git.exe"
# Code files go to main as hunks ($Base..$FixCommit, git apply fails loudly if main drifted) - never whole-file copies,
# so patron-app.js on main keeps every hunk that is not part of this fix. New files are copied whole from $Commit.
# floqr-i18n.js gets its one key via scripts/patch-direct-shoutout-i18n.js; asset re-stamp, APP_V,
# functions/package.json (version + new test) and README via scripts/bump-s3-1-43.js on main's own copies.
# mail-log.js / display-security-functions.js / display-floqcast.js / floqcast-webrtc.js / admin-scheduling.js are untouched.
$patched = @("admin-app.js", "ai-assistant-ui.js", "club-embed.css", "club-embed.html", "club-embed.js", "club-profile-app.js",
  "entity-management.js", "floqr-nav.js", "patron-app.js")
$new = @("functions/venue-shoutout-deeplink.test.js", "scripts/patch-direct-shoutout-i18n.js", "scripts/bump-s3-1-43.js")

if (Test-Path $stage) { cmd /c "rmdir /s /q `"$stage`"" }
if (Test-Path $stage) { throw "Could not clear $stage" }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

if ((Get-Content (Join-Path $stage "floqr-nav.js") -Raw) -notmatch 'const APP_V = "s3\.1\.42";') { throw "main is no longer on s3.1.42 - take the next free s3.1.x" }
foreach ($f in $new) { if (Test-Path (Join-Path $stage $f)) { throw "$f already on main (merge by hand)" } }

$patch = Join-Path $root ".publish-s3-1-43.patch"
& $git -C $root diff --binary "--output=$patch" $Base $FixCommit -- $patched
if ($LASTEXITCODE -ne 0) { throw "git diff $Base..$FixCommit failed" }
Push-Location $stage
try {
  & $git apply --check --ignore-whitespace $patch
  if ($LASTEXITCODE -ne 0) { throw "main drifted - patch does not apply (merge by hand)" }
  & $git apply --ignore-whitespace $patch
  if ($LASTEXITCODE -ne 0) { throw "git apply failed" }
} finally { Pop-Location }
Remove-Item $patch -Force

$tar = Join-Path $root ".publish-s3-1-43.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $new
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $new) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/patch-direct-shoutout-i18n.js") $stage
if ($LASTEXITCODE -ne 0) { throw "i18n key did not apply on main" }
$coverageTest = Join-Path $stage "functions/i18n-coverage.test.js"
$coverageSrc = [IO.File]::ReadAllText($coverageTest)
if ($coverageSrc -notmatch 'assert\.equal\(chrome\.enKeys, 963\);') { throw "main i18n-coverage.test.js is not at 963 en keys (merge by hand)" }
[IO.File]::WriteAllText($coverageTest, $coverageSrc.Replace('assert.equal(chrome.enKeys, 963);', 'assert.equal(chrome.enKeys, 964);'))
node (Join-Path $stage "scripts/bump-s3-1-43.js") $stage
if ($LASTEXITCODE -ne 0) { throw "s3.1.43 bump did not apply on main" }

Push-Location $stage
try {
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&](v|screen)=') { throw "${page}: Xibo URL must not carry ?v= / ?screen=" }
  }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'shoutoutLink\(') { throw "FLOQRNav.shoutoutLink missing on main" }
  if ((Get-Content patron-app.js -Raw) -notmatch 'async function openDirectVenueShoutout') { throw "patron-app.js direct venue entry missing on main" }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'const APP_V = "s3\.1\.43";') { throw "APP_V not bumped on main" }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  node scripts/build-floqai-content-classes.js --check
  if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes drifted on staged main tree" }
  & $git diff --ignore-cr-at-eol --stat | Select-Object -Last 1
  & $git diff --name-only -- functions | Where-Object { $_ -notmatch '\.test\.js$|package\.json$' }
} finally { Pop-Location }

Push-Location (Join-Path $stage "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed on staged main tree" }
  cmd /c "npm test > ..\..\.publish-s3-1-43-npm.txt 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content (Join-Path $root ".publish-s3-1-43-npm.txt") -Tail 9
  if ($testExit -ne 0) { throw "npm test failed on staged main tree (see .publish-s3-1-43-npm.txt)" }
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
    & $git commit -m "fix: s3.1.43 club/event page Throw a ShoutOut - venue ad splash then straight to template selection"
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

Write-Host "Published s3.1.43 to main"
