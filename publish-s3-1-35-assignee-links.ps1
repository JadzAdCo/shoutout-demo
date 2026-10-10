[CmdletBinding()] param(
  [Parameter(Mandatory = $true)][string]$Commit
)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-1-35-assignee-links"
$git = "C:\Program Files\Git\cmd\git.exe"
# Whole-file copies: new files, plus modified files whose main copy must equal the parent commit (drift check).
# Everything else (floqr-nav.js APP_V, every page's floqr-nav.js?v=, static hub links, changed-script ?v= stamps,
# functions/package.json version + test list, README CURRENT PACKAGE) gets the anchored edits from
# scripts/bump-s3-1-35.js on main's own copy.
$new = @(
  "scheduling-assignee-picker.js",
  "functions/scheduling-assignee-picker.test.js",
  "scripts/bump-s3-1-35.js"
)
$modified = @(
  "scheduling.html",
  "staff-worksheet.html",
  "scheduling-portal.js",
  "worker-confirm.js",
  "assignment-card.js",
  "floqr-i18n.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "functions/app-version-sync.test.js",
  "functions/i18n-coverage.test.js",
  "functions/demo-signin.test.js"
)
$copy = $new + $modified
$stampPattern = "(floqr-nav|floqai-help-repository|intent-search|assignment-card|worker-confirm|scheduling-portal|scheduling-assignee-picker|floqr-i18n)\.js\?v=[^`"'&\s]+"
$hubPattern = "(\./(?:floqai|scheduling|patron-portal|admin|master-admin)\.html\?(?:[^`"'\s#<>]*?(?:&amp;|&))?v=)[^`"'&\s#<>]+"
function Normalize([string]$text) {
  (($text -replace "`r`n", "`n") -replace $stampPattern, '$1.js?v=X') -replace $hubPattern, '$1X' -replace 'searchParams\.set\("v", "[^"]+"\)', 'searchParams.set("v", "X")'
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 -b main "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }

$drift = @()
foreach ($f in $modified) {
  $parent = Normalize ((& $git -C $root show "${Commit}^:$f") -join "`n")
  $onMain = Normalize (Get-Content (Join-Path $stage $f) -Raw -Encoding UTF8)
  if ($parent.TrimEnd("`n") -ne $onMain.TrimEnd("`n")) { $drift += $f }
}
if ($drift.Count) { throw "main drifted from ${Commit}^ for: $($drift -join ', ') (merge by hand)" }

$tar = Join-Path $root ".publish-s3-1-35.tar"
& $git -C $root archive --format=tar -o $tar $Commit -- $copy
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $stage
if ($LASTEXITCODE -ne 0) { throw "Extract failed" }
Remove-Item $tar -Force
foreach ($f in $copy) { if (!(Test-Path (Join-Path $stage $f))) { throw "Missing $f" } }

node (Join-Path $stage "scripts/bump-s3-1-35.js") $stage
if ($LASTEXITCODE -ne 0) { throw "Anchored s3.1.35 bump did not apply on main" }

Push-Location $stage
try {
  $missing = @()
  foreach ($page in "scheduling.html", "staff-worksheet.html", "floqai.html", "master-admin.html", "index.html", "admin.html") {
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
  & $git add -u
  & $git add -- $new
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "fix: s3.1.35 FloqAi links always carry the current package; Staff Scheduling Assign to name picker, fully translated"
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

Write-Host "Published s3.1.35 to main"
