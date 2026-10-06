[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-16-aurelia"
$git = "C:\Program Files\Git\cmd\git.exe"
# floqr-temp-qa-showcase.js is NOT copied whole: the workspace copy also holds unpublished DonPapi
# gallery stills whose images are not on main. Only the Aurelia rename patch is applied to main's copy.
$patch = Join-Path $root ".publish-s3-1-16-showcase.patch"
$files = @(
  ".cursor/rules/design-notes-employee-network.mdc",
  "README.md",
  "admin.html",
  "ai-diagnostics-service.js",
  "club-profile.html",
  "display.html",
  "display2.html",
  "floqr-nav.js",
  "functions/package.json",
  "functions/temp-qa-showcase.test.js",
  "guest-list.html",
  "index.html",
  "master-admin.html",
  "patron-portal.html",
  "role-request.html",
  "template-tags.html"
)
if (!(Test-Path $patch)) { throw "Missing $patch" }
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$commit = "230210c"
$tar = Join-Path $root ".publish-s3-1-16.tar"
& $git -C $root archive --format=tar -o $tar $commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($rel in $files) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }
& $git -C $stage apply -C1 $patch
if ($LASTEXITCODE -ne 0) { throw "Aurelia patch did not apply to main's floqr-temp-qa-showcase.js" }
$files += "floqr-temp-qa-showcase.js"

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
    & $git commit -m "feat: s3.1.16 Aurelia (Demo Club) moved to New York"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.16 to main"
