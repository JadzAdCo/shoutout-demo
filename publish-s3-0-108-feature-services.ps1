[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-108-feature-services"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  ".github/workflows/functions-ci.yml",
  ".github/workflows/promote-test-to-main.yml",
  ".github/workflows/sync-main-into-test.yml",
  "README.md",
  "ai-diagnostics-service.js",
  "beta-invite.html",
  "beta-invite-app.js",
  "commerce.html",
  "firestore.rules",
  "floqai-help-repository.js",
  "floqr-feature-services.js",
  "floqr-i18n-help.js",
  "floqr-i18n.js",
  "floqr-nav.js",
  "functions/commerce-functions.js",
  "functions/feature-services-core.js",
  "functions/feature-services-core.test.js",
  "functions/feature-services-functions.js",
  "functions/i18n-coverage.test.js",
  "functions/index.js",
  "functions/package.json",
  "functions/place-i18n.test.js",
  "index.html",
  "master-admin-app.js",
  "master-admin.html",
  "master-feature-services.js",
  "mingl-chat.html",
  "mingl-gist.html",
  "patron-app.js",
  "patron-portal-app.js",
  "patron-portal.html",
  "pickup.html",
  "rydr.html",
  "scripts/_help-en.json",
  "sos2fa.js",
  "styles.css",
  "suprstar-preview.html",
  "suprstr-search.html"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  if (!(Test-Path $src)) { throw "Missing $rel" }
  $dst = Join-Path $stage $rel
  $dstDir = Split-Path $dst -Parent
  if (!(Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

# Every local script/style referenced by a published page must exist on the staged tree
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
    & $git commit -m "feat: Features & Services flags, beta testers, audit chain, test branch workflows; in-app ad loading splash (s3.0.108)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.108 Features & Services to main"
