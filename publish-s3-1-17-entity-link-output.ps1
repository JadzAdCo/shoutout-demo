[CmdletBinding()] param([Parameter(Mandatory = $true)][string]$Commit)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-17-entity-links"
$git = "C:\Program Files\Git\cmd\git.exe"
# floqr-temp-qa-showcase.js is NOT copied whole (workspace copy holds unpublished DonPapi stills).
# scripts/apply-s3-1-17-showcase-gallery.js rewrites main's copy and fails if any expected line is missing.
$files = @(
  ".cursor/rules/design-notes-contact-links.mdc",
  ".cursor/rules/design-notes-master-admin-entity-mgmt.mdc",
  "README.md",
  "admin.css",
  "admin.html",
  "ai-diagnostics-service.js",
  "club-profile-app.js",
  "club-profile.html",
  "display.html",
  "display2.html",
  "entity-management.js",
  "floqr-nav.js",
  "functions/entity-link-output.test.js",
  "functions/package.json",
  "guest-list.html",
  "images/temp-qa/busboy-papis-clubtech-64x48.jpg",
  "images/temp-qa/club-aurelia-vip-maya-busboy-64x48.jpg",
  "images/temp-qa/club-aurelia-vip-maya-guests.jpg",
  "index.html",
  "master-admin.html",
  "patron-portal.html",
  "role-request.html",
  "scripts/apply-s3-1-17-showcase-gallery.js",
  "styles.css",
  "template-tags.html"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$tar = Join-Path $root ".publish-s3-1-17.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($rel in $files) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }
node (Join-Path $stage "scripts/apply-s3-1-17-showcase-gallery.js") (Join-Path $stage "floqr-temp-qa-showcase.js")
if ($LASTEXITCODE -ne 0) { throw "Gallery swap did not apply to main's floqr-temp-qa-showcase.js" }
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
    & $git commit -m "feat: s3.1.17 Entity Management copyable venue links + Xibo Diag, tel/mailto no underline, Papi's ClubTech photos"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.1.17 to main"
