[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit,
  [string[]]$Bases = @("6216d9a", "2f81de0", "85eab7e"),
  [switch]$AllowDrift
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-29-master-admin-ui"
$git = "C:\Program Files\Git\cmd\git.exe"
# functions/package.json differs on main: patched in place below, never overwritten.
$files = @(
  "README.md",
  "admin.css",
  "floqai-help-repository.js",
  "functions/feature-services-core.test.js",
  "functions/master-admin-audit-hero-help.test.js",
  "help-attach.js",
  "master-admin.html",
  "master-feature-services.js",
  "scripts/add-master-admin-audit-hero-test.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

function Get-RefText([string]$ref, [string]$rel) {
  $t = & $git -C $root show "${ref}:$rel" 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return (($t -join "`n") -replace "`r", "").TrimEnd()
}
$drift = @()
$ErrorActionPreference = "Continue"
foreach ($rel in $files) {
  $onMain = Join-Path $stage $rel
  $known = @($Bases + $Commit | ForEach-Object { Get-RefText $_ $rel })
  $inBase = $null -ne (Get-RefText $Bases[0] $rel)
  if (!(Test-Path $onMain)) { if ($inBase) { $drift += "$rel (missing on main)" }; continue }
  $mainText = ((Get-Content $onMain -Raw -Encoding UTF8) -replace "`r", "").TrimEnd()
  if ($known -notcontains $mainText) { $drift += "$rel (main differs from $($Bases -join '/') and $Commit)" }
}
$ErrorActionPreference = "Stop"
if ($drift.Count) {
  Write-Host "Drift:`n  $($drift -join "`n  ")"
  if (!$AllowDrift) { throw "main drifted from the workspace parent; review, then rerun with -AllowDrift" }
}

$tar = Join-Path $root ".publish-s3-1-29.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $files
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($rel in $files) { if (!(Test-Path (Join-Path $stage $rel))) { throw "Missing $rel" } }

node (Join-Path $stage "scripts/add-master-admin-audit-hero-test.js") $stage
if ($LASTEXITCODE -ne 0) { throw "Could not register the Master Admin audit/hero test on main" }
$files += "functions/package.json"

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
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: s3.1.29 Master Admin audit trail table + All Locations help (no orphan hero ?)"
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

Write-Host "Published s3.1.29 to main"
