[CmdletBinding()] param([Parameter(Mandatory = $true)][string]$Commit, [switch]$AllowDrift)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-26-security"
$git = "C:\Program Files\Git\cmd\git.exe"
# functions/suprstr-functions.js and functions/package.json differ on main: patched in place below, never overwritten.
$files = @(
  ".github/workflows/rules-emulator-tests.yml",
  "README.md",
  "admin.html",
  "ai-diagnostics-service.js",
  "ai-index-service.js",
  "club-embed.html",
  "club-profile.html",
  "commerce.html",
  "firestore.rules",
  "floqai-search.html",
  "floqai.html",
  "floqr-blocks.js",
  "floqr-nav.js",
  "functions/admin-trust.js",
  "functions/ai-discovery-functions.js",
  "functions/commerce-functions.js",
  "functions/display-security-functions.js",
  "functions/feature-services-functions.js",
  "functions/otp-attempts.js",
  "functions/rules-tightening.test.js",
  "functions/scheduling-functions.js",
  "functions/security-phase0.test.js",
  "functions/security-phase1-rules.test.js",
  "functions/seed-and-storage-lockdown.test.js",
  "functions/sos2fa-functions.js",
  "guest-list.html",
  "index.html",
  "master-admin.html",
  "mingl-chat.html",
  "mingl-gist.html",
  "patron-app.js",
  "patron-portal-app.js",
  "patron-portal.html",
  "promoter-admin.html",
  "role-request.html",
  "rules-tests/firestore-messages.test.js",
  "rules-tests/firestore-mingl-chat.test.js",
  "rules-tests/firestore-mingl-connections.test.js",
  "rules-tests/firestore-suprstr-aiindex-display.test.js",
  "rules-tests/firestore-users.test.js",
  "rules-tests/helpers.js",
  "rules-tests/package-lock.json",
  "rules-tests/package.json",
  "rules-tests/storage-mingl.test.js",
  "scripts/add-security-phase1-tests.js",
  "scripts/bump-s3-1-26.js",
  "scripts/patch-main-suprstr-session-email.js",
  "scripts/run-rules-emulator-tests.ps1",
  "services.html",
  "storage.rules",
  "template-tags.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

# Drift check: main must still match the workspace parent for every file we overwrite.
$drift = @()
$ErrorActionPreference = "Continue"
foreach ($rel in $files) {
  $onMain = Join-Path $stage $rel
  $before = & $git -C $root show "${Commit}~1:$rel" 2>$null
  $hadBefore = $LASTEXITCODE -eq 0
  if (!(Test-Path $onMain)) { if ($hadBefore) { $drift += "$rel (missing on main)" }; continue }
  if (!$hadBefore) { $drift += "$rel (on main, new in workspace)"; continue }
  $mainText = ((Get-Content $onMain -Raw -Encoding UTF8) -replace "`r`n", "`n").TrimEnd()
  $parentText = (($before -join "`n") -replace "`r`n", "`n").TrimEnd()
  if ($mainText -ne $parentText) { $drift += "$rel (main differs from ${Commit}~1)" }
}
$ErrorActionPreference = "Stop"
if ($drift.Count) {
  Write-Host "Drift:`n  $($drift -join "`n  ")"
  if (!$AllowDrift) { throw "main drifted from the workspace parent; review, then rerun with -AllowDrift" }
}

$tar = Join-Path $root ".publish-s3-1-26.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($rel in $files) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }

# main's functions/package.json carries its own test list; patch version + tests in place.
$pkg = Join-Path $stage "functions/package.json"
$pkgText = [IO.File]::ReadAllText($pkg)
if ($pkgText -notmatch '"version": "3\.1\.2[56]"') { throw "Unexpected functions/package.json version on main" }
[IO.File]::WriteAllText($pkg, ($pkgText -replace '"version": "3\.1\.25"', '"version": "3.1.26"'), (New-Object Text.UTF8Encoding($false)))
node (Join-Path $stage "scripts/add-security-phase1-tests.js")
if ($LASTEXITCODE -ne 0) { throw "Could not register security tests on main" }
node (Join-Path $stage "scripts/patch-main-suprstr-session-email.js")
if ($LASTEXITCODE -ne 0) { throw "Could not patch suprstr-functions.js on main" }
$files += "functions/package.json", "functions/suprstr-functions.js"

Push-Location $stage
try {
  $missing = @()
  foreach ($rel in ($files | Where-Object { $_ -like "*.html" })) {
    $html = Get-Content $rel -Raw
    [regex]::Matches($html, '(?:src|href)="\./([^"?#]+\.(?:js|css))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object {
      if (!(Test-Path $_)) { $missing += "$rel -> $_" }
    }
  }
  if ($missing.Count) { throw "Missing referenced assets on main: $($missing -join ', ')" }
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"'']*[?&]v=') { throw "$page: Xibo URL must not carry ?v=" }
  }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
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
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: s3.1.26 security phase 0 + 1 - server-only admin trust, OTP lockout, Mingl/messages/aiIndex/supRstar rules, Mingl media members"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.26 to main"
