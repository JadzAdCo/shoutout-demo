[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-11-template-preview-rbac"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "README.md",
  "admin-app.js",
  "admin-rep-extension.js",
  "admin.html",
  "ai-diagnostics-service.js",
  "display-app.js",
  "display.css",
  "display.html",
  "display2.html",
  "firestore.rules",
  "floqai-help-repository.js",
  "floqr-i18n-help.js",
  "floqr-i18n.js",
  "floqr-nav.js",
  "floqr-template-preview.js",
  "floqr-template-tags.js",
  "functions/commerce-functions.js",
  "functions/commerce-invariants.test.js",
  "functions/football-intro-venues.test.js",
  "functions/heist-name-shoutout.test.js",
  "functions/i18n-coverage.test.js",
  "functions/package.json",
  "functions/template-discovery-idle.test.js",
  "functions/template-preview-tags.test.js",
  "images/template-preview/football-player-1.svg",
  "images/template-preview/football-player-2.svg",
  "images/template-preview/football-player-3.svg",
  "images/template-preview/football-player-4.svg",
  "images/template-preview/sample-birthday.jpg",
  "images/template-preview/sample-club-night.jpg",
  "images/template-preview/sample-romance.jpg",
  "index.html",
  "intent-search.js",
  "patron-app.js",
  "patron-portal-app.js",
  "scripts/_help-en.json",
  "shared-data.js",
  "styles.css",
  "template-tags-app.js",
  "template-tags.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$commit = "8fa3560"
$tar = Join-Path $root ".publish-s3-1-11.tar"
& $git -C $root archive --format=tar -o $tar $commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $commit failed" }
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
    & $git commit -m "feat: s3.1.11 template Preview, venue template tags (Administer/Manage Templates), 96x48-only Tengo + Football Intro rename"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.11 to main"
