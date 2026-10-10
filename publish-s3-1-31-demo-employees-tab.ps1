[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-31-demo-employees-tab"
$git = "C:\Program Files\Git\cmd\git.exe"
# New/owned files are copied from the commit. Files other work also touches (master-admin.html, master-admin-app.js,
# sos2fa.js, floqr-i18n.js, floqai-help-repository.js, three version-pin tests, i18n-coverage.test.js) get the anchored
# edits from scripts/apply-s3-1-31-demo-employees-tab.js on main's own copy, never a whole-file copy.
$copy = @(
  "master-demo-employees.js",
  "master-demo-employees.css",
  "demo-signin.html",
  "functions/demo-signin.test.js",
  "scripts/apply-s3-1-31-demo-employees-tab.js"
)
$shared = @(
  "master-admin.html", "master-admin-app.js", "sos2fa.js", "floqr-i18n.js", "floqai-help-repository.js",
  "functions/i18n-coverage.test.js", "functions/sos2fa-master-admin.test.js", "functions/master-admin-claim-ui.test.js",
  "functions/master-admin-audit-hero-help.test.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
if (!(Test-Path (Join-Path $stage "functions/demo-signin-core.js"))) { throw "main has no s3.1.31 demo sign-in code yet: run publish-s3-1-31-demo-signin.ps1 first" }

$tar = Join-Path $root ".publish-s3-1-31-tab.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/apply-s3-1-31-demo-employees-tab.js") $stage
if ($LASTEXITCODE -ne 0) { throw "Anchored s3.1.31 tab edits did not apply on main" }

Push-Location $stage
try {
  if (Test-Path "demo-signin.js") { & $git rm -q -- demo-signin.js }
  $missing = @()
  foreach ($page in "master-admin.html", "demo-signin.html") {
    $html = Get-Content $page -Raw
    [regex]::Matches($html, '(?:src|href)="\./([^"?#]+\.(?:js|css))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | ForEach-Object {
      if (!(Test-Path $_)) { $missing += "$page -> $_" }
    }
  }
  if ($missing.Count) { throw "Missing referenced assets on main: $($missing -join ', ')" }
  foreach ($page in "display.html", "display2.html") {
    if ((Get-Content $page -Raw) -match 'display2?\.html\?location=[^"''\s<>]*[?&]v=') { throw "${page}: Xibo URL must not carry ?v=" }
  }
  node scripts/i18n-coverage-report.js | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0) { throw "i18n coverage failed on staged main tree" }
  node scripts/build-floqai-content-classes.js --check
  if ($LASTEXITCODE -ne 0) { throw "FloqAi content classes drifted on staged main tree" }
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
  & $git add -- ($copy + $shared)
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: s3.1.31 Master Admin Entity Management tab 'Demo Svc / Emp Mgmt' for demo employee sign-in codes"
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

Write-Host "Published s3.1.31 Demo Svc / Emp Mgmt tab to main"
