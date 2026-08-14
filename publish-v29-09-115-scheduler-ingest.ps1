[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-v29-09-115"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "admin.html",
  "admin.css",
  "admin-scheduling.js",
  "admin-app.js",
  "floqai-help-repository.js",
  "intent-search.js",
  "ai-diagnostics-service.js",
  "index.html",
  "floqai-search.css",
  "master-admin.html",
  "patron-portal.html",
  "patron-portal-app.js",
  "staff-worksheet.html",
  "staff-worksheet.js",
  "staff-week-grid.js",
  "schedule-embed.html",
  "schedule-embed.js"
)
$fnFiles = @(
  "functions/scheduling-functions.js",
  "functions/scheduling-core.js",
  "functions/scheduling-core.test.js",
  "functions/venue-ingest-core.js",
  "functions/venue-ingest-core.test.js",
  "functions/venue-ingest-functions.js",
  "functions/ai-discovery-functions.js"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}
$fnDir = Join-Path $stage "functions"
New-Item -ItemType Directory -Force -Path $fnDir | Out-Null
foreach ($f in $fnFiles) {
  $src = Join-Path $root $f
  if (-not (Test-Path $src)) { throw "Missing source file: $f" }
  Copy-Item $src (Join-Path $stage $f) -Force
}

$indexPath = Join-Path $stage "functions\index.js"
$index = Get-Content -LiteralPath $indexPath -Raw
if ($index -notmatch 'venue-ingest-functions') {
  if ($index -notmatch [regex]::Escape('...require("./scheduling-functions"),')) {
    throw "Could not patch functions/index.js — scheduling-functions export missing on live main."
  }
  $index = $index.Replace(
    '...require("./scheduling-functions"),',
    "...require(`"./scheduling-functions`"),`r`n  ...require(`"./venue-ingest-functions`"),"
  )
  Set-Content -LiteralPath $indexPath -Value $index -NoNewline
}

$pkgPath = Join-Path $stage "functions\package.json"
$pkgRaw = Get-Content -LiteralPath $pkgPath -Raw
if ($pkgRaw -notmatch 'venue-ingest-core\.test\.js') {
  if ($pkgRaw -match 'scheduling-core\.test\.js receipt-delivery\.test\.js') {
    $pkgRaw = $pkgRaw.Replace('scheduling-core.test.js receipt-delivery.test.js', 'scheduling-core.test.js venue-ingest-core.test.js receipt-delivery.test.js')
  } elseif ($pkgRaw -match 'messaging-core\.test\.js receipt-delivery\.test\.js') {
    $pkgRaw = $pkgRaw.Replace('messaging-core.test.js receipt-delivery.test.js', 'messaging-core.test.js scheduling-core.test.js venue-ingest-core.test.js receipt-delivery.test.js')
  } else {
    throw "Could not patch functions/package.json test script."
  }
  Set-Content -LiteralPath $pkgPath -Value $pkgRaw -NoNewline
}

Push-Location $stage
try {
  & $git config user.name "JadzAdCo"
  & $git config user.email "290611448+JadzAdCo@users.noreply.github.com"
  & $git add -- $files
  & $git add -- $fnFiles
  & $git add -- "functions/index.js" "functions/package.json"
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "Scheduler help, staff Work Sheet, and venue website ingest API (v29.09.115)"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location; if (Test-Path $stage) { Remove-Item $stage -Recurse -Force } }
Write-Host "Published v29.09.115 Pages"
