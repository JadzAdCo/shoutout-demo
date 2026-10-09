[CmdletBinding()] param([Parameter(Mandatory = $true)][string]$Commit)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-24-rules-stages-2-3"
$git = "C:\Program Files\Git\cmd\git.exe"
# design-notes-data-classification.mdc stays workspace-only (security findings).
$files = @(
  "README.md",
  "admin-app.js",
  "admin.html",
  "ai-diagnostics-service.js",
  "club-embed.html",
  "club-profile.html",
  "display.html",
  "display2.html",
  "firestore.rules",
  "floqai-search.html",
  "floqai.html",
  "floqr-access-notice.js",
  "floqr-data-classification.js",
  "floqr-i18n.js",
  "floqr-nav.js",
  "functions/data-classification-core.js",
  "functions/i18n-coverage.test.js",
  "functions/index.js",
  "functions/package.json",
  "functions/rules-tightening-stage-2-3.test.js",
  "functions/shoutout-stories-core.js",
  "functions/shoutout-stories-functions.js",
  "functions/staff-marketing-consent.test.js",
  "guest-list.html",
  "index.html",
  "master-admin-app.js",
  "master-admin.html",
  "mingl-chat-app.js",
  "mingl-chat.html",
  "mingl-gist-app.js",
  "mingl-gist.html",
  "patron-app.js",
  "patron-portal-app.js",
  "patron-portal.html",
  "promoter-admin-app.js",
  "promoter-admin.html",
  "role-request.html",
  "scripts/add-access-notice-i18n.js",
  "scripts/bump-s3-1-24.js",
  "services.html",
  "template-tags.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$tar = Join-Path $root ".publish-s3-1-24.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($rel in $files) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }

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
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  node scripts/build-floqai-content-classes.js --check
  if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes stale on staged main tree" }
  node scripts/sync-data-classification-client.js --check
  if ($LASTEXITCODE -ne 0) { throw "Client classification module out of sync on staged main tree" }
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
    & $git commit -m "fix: s3.1.24 rules Stages 2-3 - club-scoped loaders, access notice, Mingl Gist stories callable, Inbox/messages query fix"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.24 to main"
