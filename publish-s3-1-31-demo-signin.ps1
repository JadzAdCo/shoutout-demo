[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-31-demo-signin"
$git = "C:\Program Files\Git\cmd\git.exe"
# New files are copied from the commit. Files other work also touches (index.html, patron-app.js, floqr-i18n.js,
# floqai-help-repository.js, functions/package.json, floqai-content-classes.json, i18n-coverage.test.js) get the
# anchored edits from scripts/apply-s3-1-31-demo-signin-edits.js on main's own copy, never a whole-file copy.
$copy = @(
  "demo-signin.html",
  "demo-signin.js",
  "functions/ai-discovery-functions.js",
  "functions/demo-signin-core.js",
  "functions/demo-signin.test.js",
  "scripts/apply-s3-1-31-demo-signin-edits.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

foreach ($asset in "floqr-reason-prompt.js", "floqr-reason-prompt.css") {
  if (!(Test-Path (Join-Path $stage $asset))) { throw "main has no $asset yet: publish s3.1.30 first (demo-signin.html asks the reason with FLOQRReasonPrompt)" }
}

function Get-RefText([string]$ref, [string]$rel) {
  $t = & $git -C $root show "${ref}:$rel" 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return (($t -join "`n") -replace "`r", "").TrimEnd()
}
$ErrorActionPreference = "Continue"
$rel = "functions/ai-discovery-functions.js"
$mainText = ((Get-Content (Join-Path $stage $rel) -Raw -Encoding UTF8) -replace "`r", "").TrimEnd()
$known = @((Get-RefText "${Commit}~1" $rel), (Get-RefText $Commit $rel))
$ErrorActionPreference = "Stop"
if ($known -notcontains $mainText) { throw "$rel on main differs from the workspace parent of $Commit; merge by hand" }

$tar = Join-Path $root ".publish-s3-1-31.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/apply-s3-1-31-demo-signin-edits.js") $stage
if ($LASTEXITCODE -ne 0) { throw "Anchored s3.1.31 edits did not apply on main" }
$files = $copy + @("index.html", "patron-app.js", "floqr-i18n.js", "floqai-help-repository.js", "functions/package.json", "functions/floqai-content-classes.json", "functions/i18n-coverage.test.js")

Push-Location $stage
try {
  $missing = @()
  foreach ($page in "demo-signin.html", "index.html") {
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
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: s3.1.31 Master Admin demo sign-in code (SOS2FA + reason + chained audit) and Welcome 'I already have a code'"
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

Write-Host "Published s3.1.31 to main"
