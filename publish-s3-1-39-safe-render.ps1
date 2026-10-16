[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [string]$Base = "3a9001e",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-39-safe-render"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies from $Commit: new files, plus modified files whose main copy must equal $Base (drift check, v= values
# ignored). Asset re-stamp, APP_V, functions/package.json (version + new test) and README run on main's own copies via
# scripts/bump-s3-1-39.js. display-floqcast.js / floqcast-webrtc.js / mail-log.js / display-security-functions.js /
# admin-scheduling.js are never copied.
$new = @(
  "floqr-safe-render.js",
  "functions/display-safe-render.test.js",
  "scripts/bump-s3-1-39.js"
)
$modified = @(
  "display-app.js", "floqr-template-preview.js", "admin-app.js", "patron-app.js", "firestore.rules",
  "display.html", "display2.html", "index.html", "admin.html"
)
$copy = $new + $modified
function Normalize([string]$text) {
  (($text -replace "`r`n", "`n") -replace '([?&])v=[^"''&\s#<>`]*', '$1v=X').TrimEnd("`n")
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$drift = @()
foreach ($f in $modified) {
  $expected = Normalize ((& $git -C $root show "${Base}:$f") -join "`n")
  $onMain = Normalize (Get-Content (Join-Path $stage $f) -Raw -Encoding UTF8)
  if ($expected -ne $onMain) { $drift += $f }
}
foreach ($f in $new) { if (Test-Path (Join-Path $stage $f)) { $drift += "$f (already on main)" } }
if ($drift.Count) { throw "main drifted for: $($drift -join ', ') (merge by hand)" }

$tar = Join-Path $root ".publish-s3-1-39.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/bump-s3-1-39.js") $stage
if ($LASTEXITCODE -ne 0) { throw "s3.1.39 bump did not apply on main" }

Push-Location $stage
try {
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&](v|screen)=') { throw "${page}: Xibo URL must not carry ?v= / ?screen=" }
  }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'const APP_V = "s3\.1\.39";') { throw "APP_V not bumped on main" }
  $unguarded = Get-ChildItem -Filter *.html | Where-Object {
    $html = Get-Content $_.FullName -Raw
    ($html -match 'src="\./(display-app|admin-app)\.js') -and ($html -notmatch 'src="\./floqr-safe-render\.js')
  }
  if ($unguarded) { throw "Pages load display-app/admin-app without floqr-safe-render.js: $($unguarded.Name -join ', ')" }
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
  cmd /c "npm test > ..\..\.publish-s3-1-39-npm.txt 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content (Join-Path $root ".publish-s3-1-39-npm.txt") -Tail 9
  if ($testExit -ne 0) { throw "npm test failed on staged main tree (see .publish-s3-1-39-npm.txt)" }
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
    & $git commit -m "fix: s3.1.39 safe render on LED boards (XSS in Football Intro preview + patron render fields)"
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

Write-Host "Published s3.1.39 to main"
