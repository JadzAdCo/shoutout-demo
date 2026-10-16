[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [string]$ExpectedMainAppV = "s3.1.43",
  [switch]$DryRun
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-44-floqcast"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies from $Commit (floqCast rename + s3.1.44 bump already applied there).
# Fail if main is not still on $ExpectedMainAppV. Never touch admin-scheduling.js.
# patron-app.js / club-profile-app.js / club-embed.js are not in this set (s3.1.43 stays on main).

$copy = @(
  "README.md",
  "admin-app.js",
  "admin.html",
  "ai-diagnostics-service.js",
  "auth-debug.html",
  "bartr.html",
  "beta-invite.html",
  "club-embed.html",
  "club-profile.html",
  "commerce.html",
  "demo-signin.html",
  "deploy-reconcile.ps1",
  "display-app.js",
  "display-floqcast.js",
  "display.css",
  "display.html",
  "display2.html",
  "entity-management.js",
  "feature-gates.js",
  "firestore.rules",
  "floqai-help-repository.js",
  "floqai.html",
  "floqcast-preview.html",
  "floqcast-preview.js",
  "floqcast-search.css",
  "floqcast-search.html",
  "floqcast-search.js",
  "floqcast-webrtc.js",
  "floqr-data-classification.js",
  "floqr-feature-services.js",
  "floqr-i18n-help.js",
  "floqr-i18n.js",
  "floqr-nav.js",
  "functions/app-version-sync.test.js",
  "functions/auth-entry-ui.test.js",
  "functions/commerce-functions.js",
  "functions/data-classification-core.js",
  "functions/display-security-functions.js",
  "functions/feature-gate-functions.js",
  "functions/feature-links-reason-prompt.test.js",
  "functions/feature-services-core.js",
  "functions/feature-services-core.test.js",
  "functions/feature-services-functions.js",
  "functions/floqai-content-classes.json",
  "functions/floqcast-functions.js",
  "functions/floqcast-webrtc-reliability.test.js",
  "functions/heist-template-availability.test.js",
  "functions/index.js",
  "functions/package.json",
  "functions/rules-tightening.test.js",
  "functions/security-phase1-rules.test.js",
  "global-profile-status.js",
  "guest-list.html",
  "index.html",
  "intent-search.js",
  "jersey-preview-all.html",
  "master-admin-app.js",
  "master-admin.html",
  "master-data-classification.js",
  "master-display-security.js",
  "mingl-chat.html",
  "mingl-gist.html",
  "mobile-test-checklist.html",
  "nfl-eagles-silhouette-preview.html",
  "nfl-floqr-qa-64x32.html",
  "nfl-scammerville-local-qa.html",
  "nfl-scammerville-screenshot.html",
  "nfl-shot-64x32-text.html",
  "nfl-shot-64x48-jersey.html",
  "nfl-shot-96x48.html",
  "onboard-dc-venues.html",
  "patron-portal.html",
  "payment-return-app.js",
  "payment-return.html",
  "pickup.html",
  "privacy.html",
  "promoter-admin.html",
  "role-profiles.html",
  "role-request.html",
  "rules-tests/firestore-floqcast-aiindex-display.test.js",
  "rydr.html",
  "schedule-embed.html",
  "scheduling.html",
  "scripts/bump-s3-1-44.js",
  "scripts/rename-suprstr-to-floqcast.js",
  "scripts/_help-en.json",
  "scripts/_help-ar.json",
  "scripts/_help-de.json",
  "scripts/_help-el.json",
  "scripts/_help-es.json",
  "scripts/_help-fr.json",
  "scripts/_help-it.json",
  "scripts/_help-nl.json",
  "scripts/_help-pl.json",
  "scripts/_help-pt.json",
  "scripts/_help-ru.json",
  "scripts/_chrome-en.json",
  "scripts/_chrome-ar.json",
  "scripts/_chrome-de.json",
  "scripts/_chrome-el.json",
  "scripts/_chrome-es.json",
  "scripts/_chrome-fr.json",
  "scripts/_chrome-it.json",
  "scripts/_chrome-nl.json",
  "scripts/_chrome-pl.json",
  "scripts/_chrome-pt.json",
  "scripts/_chrome-ru.json",
  "seed-v29-09-14.html",
  "seed.html",
  "services.html",
  "staff-worksheet.html",
  "suprstar-preview.html",
  "suprstr-search.html",
  "template-tags.html",
  "translation-policy.html",
  "ad-campaign-preview-v28.99.html",
  "ad-invoice.html",
  "ad-submit.html",
  "firestore-rebrand-jadz-to-floqr-v28.31-f.html",
  ".cursor/rules/floqcast.mdc",
  ".cursor/rules/suprstr.mdc",
  ".cursor/rules/design-notes-feature-services.mdc",
  ".cursor/rules/satellite-session-auth.mdc",
  ".cursor/rules/post-deploy-qc.mdc",
  ".cursor/rules/floqr-translation.mdc",
  ".cursor/rules/floqai-help-repository.mdc"
)

$remove = @(
  "display-suprstr.js",
  "suprstr-search.js",
  "suprstr-search.css",
  "suprstar-preview.js",
  "suprstr-webrtc.js",
  "functions/suprstr-functions.js",
  "functions/suprstr-webrtc-reliability.test.js",
  "rules-tests/firestore-suprstr-aiindex-display.test.js"
)

if (Test-Path $stage) { cmd /c "rmdir /s /q `"$stage`"" }
if (Test-Path $stage) { throw "Could not clear $stage" }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$nav = Get-Content (Join-Path $stage "floqr-nav.js") -Raw
if ($nav -notmatch [regex]::Escape("const APP_V = `"$ExpectedMainAppV`";")) {
  throw "main is no longer on $ExpectedMainAppV - take the next free s3.1.x (refusing publish)"
}
if ($nav -notmatch 'shoutoutLink\(') { throw "main missing FLOQRNav.shoutoutLink (s3.1.43) - refuse" }
if (Test-Path (Join-Path $stage "admin-scheduling.js")) {
  # never overwrite; not in $copy
}

$tar = Join-Path $root ".publish-s3-1-44.tar"
if (Test-Path $tar) { Remove-Item $tar -Force }
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force

foreach ($f in $copy) {
  if (!(Test-Path (Join-Path $stage $f))) { throw "Missing after extract: $f" }
}
foreach ($f in $remove) {
  $p = Join-Path $stage $f
  if (Test-Path $p) {
    Remove-Item $p -Force
    Write-Host "removed $f"
  }
}

# Re-stamp every HTML asset tag on main (pages not in the rename set still had s3.1.43).
node (Join-Path $stage "scripts/bump-s3-1-44.js") $stage
if ($LASTEXITCODE -ne 0) { throw "s3.1.44 bump did not apply on main" }

# Legacy popout page still on main: point assets at floqCast modules (not in rename commit).
$popout = Join-Path $stage "suprstar-live-popout.html"
if (Test-Path $popout) {
  $pop = Get-Content $popout -Raw
  $pop2 = $pop.Replace("suprstr-search.css", "floqcast-search.css").Replace("suprstr-webrtc.js", "floqcast-webrtc.js").Replace("suprstar-preview.js", "floqcast-preview.js")
  if ($pop2 -ne $pop) {
    [IO.File]::WriteAllText($popout, $pop2)
    Write-Host "patched suprstar-live-popout.html asset paths"
  }
}

Push-Location $stage
try {
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&](v|screen)=') {
      throw "${page}: Xibo URL must not carry ?v= / ?screen="
    }
  }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'const APP_V = "s3\.1\.44";') { throw "APP_V not s3.1.44 on staged main" }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'shoutoutLink\(') { throw "shoutoutLink lost after floqCast overlay" }
  if ((Get-Content floqr-nav.js -Raw) -notmatch 'floqcastHome') { throw "floqcastHome missing on floqr-nav.js" }
  if ((Get-Content functions\package.json -Raw) -notmatch '"version": "3\.1\.44"') { throw "functions package version not 3.1.44" }
  if ((Get-Content README.md -Raw) -notmatch 'CURRENT PACKAGE: FLOQR ShoutOut s3\.1\.44') { throw "README not s3.1.44" }
  if ((Get-Content functions\floqcast-functions.js -Raw) -notmatch 'exports\.createSuprstarRequest\s*=\s*exports\.createFloqCastRequest') {
    throw "legacy callable aliases missing"
  }
  if ((Get-Content functions\feature-services-core.js -Raw) -notmatch 'key:\s*"floqCast"') { throw "feature catalog missing floqCast" }
  if ((Get-Content functions\feature-services-core.js -Raw) -notmatch 'supRstar:\s*"floqCast"') { throw "FEATURE_KEY_ALIASES missing" }
  if ((Get-Content suprstr-search.html -Raw) -notmatch 'floqcast-search\.html') { throw "suprstr-search.html stub missing redirect" }
  if ((Get-Content suprstar-preview.html -Raw) -notmatch 'floqcast-preview\.html') { throw "suprstar-preview.html stub missing redirect" }
  if ((Get-Content display2.html -Raw) -notmatch 'display-floqcast\.js') { throw "display2.html must load display-floqcast.js" }
  if (Test-Path "functions\suprstr-functions.js") { throw "old functions/suprstr-functions.js still present" }
  if (Test-Path "display-suprstr.js") { throw "old display-suprstr.js still present" }
  if ((Get-Content admin-scheduling.js -Raw -ErrorAction SilentlyContinue) -match 'floqCast') {
    # admin-scheduling is exempt from edits; ignore if somehow present
  }

  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  if (Test-Path scripts/build-floqai-content-classes.js) {
    node scripts/build-floqai-content-classes.js --check
    if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes drifted on staged main tree" }
  }
  & $git diff --ignore-cr-at-eol --stat | Select-Object -Last 3
} finally { Pop-Location }

Push-Location (Join-Path $stage "functions")
$ErrorActionPreference = "Continue"
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed on staged main tree" }
  cmd /c "npm test > ..\..\.publish-s3-1-44-npm.txt 2>&1"
  $testExit = $LASTEXITCODE
  Get-Content (Join-Path $root ".publish-s3-1-44-npm.txt") -Tail 12
  if ($testExit -ne 0) { throw "npm test failed on staged main tree (see .publish-s3-1-44-npm.txt)" }
} finally { Pop-Location; $ErrorActionPreference = "Stop" }

if ($DryRun) { Write-Host "Dry run OK - nothing pushed. Stage: $stage"; return }

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -A
  # Ensure removed legacy sources are staged (ignore pathspecs already gone)
  foreach ($f in $remove) {
    & $git add -u -- $f 2>$null | Out-Null
    $global:LASTEXITCODE = 0
  }
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: s3.1.44 rename supRstar to floqCast (product pages, feature key, callables + aliases)"
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

Write-Host "Published s3.1.44 floqCast to main"
