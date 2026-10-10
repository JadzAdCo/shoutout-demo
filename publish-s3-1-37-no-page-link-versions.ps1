[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [string]$Base = "0e5c52a",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-37-no-page-link-versions"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies from $Commit: new files, plus modified files whose main copy must equal $Base (drift check, page-link
# v= values ignored). profile-access-guard.js is checked against main's own s3.1.36 copy (1330bdf), which it now carries.
# Everything else is done on main's own copies by scripts/bump-s3-1-37.js: every HTML page loses page-link v= and gets
# every asset tag re-stamped, every served script (incl. main-only ones) loses page-link v=, APP_V / package / README bump.
$new = @(
  "scripts/bump-s3-1-37.js",
  "scripts/strip-page-link-versions.js"
)
$modified = @(
  "ad-submit-app.js", "admin-app.js", "admin-rep-extension.js", "ai-assistant-ui.js", "ai-diagnostics-service.js",
  "club-profile-app.js", "entity-management.js", "floqai-help-repository.js", "floqai-search.html", "floqr-canonical.js",
  "floqr-nav.js", "floqr-session-shell.js", "guest-list-app.js", "intent-search.js", "master-ad-management.js",
  "master-admin-app.js", "master-admin.html", "master-services-extension.js", "mingl-gist-app.js", "mobile-test-checklist.js",
  "onboard-dc-venues.html", "patron-app.js", "patron-portal-app.js", "payment-return-app.js", "profile-access-guard.js",
  "services-app.js", "suprstar-preview.js", "suprstr-search.js",
  "functions/ad-functions.js", "functions/feature-services-functions.js", "functions/messaging-functions.js",
  "functions/receipt-delivery.js", "functions/scheduling-core.js", "functions/scheduling-functions.js",
  "functions/ad-campaigns-business.test.js", "functions/app-logging.test.js", "functions/app-version-sync.test.js",
  "functions/auth-entry-ui.test.js", "functions/demo-signin.test.js", "functions/feature-links-reason-prompt.test.js",
  "functions/feature-services-core.test.js", "functions/floqai-page.test.js", "functions/floqr-geo-search.test.js",
  "functions/floqr-venue-query.test.js", "functions/nfl-jersey-dual.test.js", "functions/place-i18n.test.js",
  "functions/privacy-compliance.test.js", "functions/session-hint-hero-help.test.js", "functions/shoutout-compliance.test.js",
  "functions/sos2fa-master-admin.test.js", "functions/welcome-signin-layout.test.js"
)
$baseFor = @{ "profile-access-guard.js" = "1330bdf" }
$copy = $new + $modified
function Normalize([string]$text) {
  (($text -replace "`r`n", "`n") -replace '([?&])v=[^"''&\s#<>`]*', '$1v=X').TrimEnd("`n")
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$drift = @()
foreach ($f in $modified) {
  $from = if ($baseFor.ContainsKey($f)) { $baseFor[$f] } else { $Base }
  $expected = Normalize ((& $git -C $root show "${from}:$f") -join "`n")
  $onMain = Normalize (Get-Content (Join-Path $stage $f) -Raw -Encoding UTF8)
  if ($expected -ne $onMain) { $drift += "$f (vs $from)" }
}
if ($drift.Count) { throw "main drifted for: $($drift -join ', ') (merge by hand)" }

$tar = Join-Path $root ".publish-s3-1-37.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/bump-s3-1-37.js") $stage
if ($LASTEXITCODE -ne 0) { throw "s3.1.37 bump did not apply on main" }

Push-Location $stage
try {
  $missing = @()
  foreach ($page in Get-ChildItem -Filter *.html -File | ForEach-Object Name) {
    $html = Get-Content $page -Raw
    [regex]::Matches($html, '(?:src|href)="\./([^"?#]+\.(?:js|css))\?v=') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object {
      if (!(Test-Path $_)) { $missing += "$page -> $_" }
    }
  }
  if ($missing.Count) { Write-Warning "Cache-busted assets missing on main (pre-existing references): $($missing -join ', ')" }
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&]v=') { throw "${page}: Xibo URL must not carry ?v=" }
  }
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
  cmd /c "npm test > ..\..\.publish-s3-1-37-npm.txt 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content (Join-Path $root ".publish-s3-1-37-npm.txt") -Tail 9
  if ($testExit -ne 0) { throw "npm test failed on staged main tree (see .publish-s3-1-37-npm.txt)" }
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
    & $git commit -m "fix: s3.1.37 page links never carry ?v= (owner decision Oct 10 2026); only asset tags are cache-busted"
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

Write-Host "Published s3.1.37 to main"
