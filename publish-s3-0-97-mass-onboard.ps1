[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-97-mass-onboard"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "master-admin.html",
  "ai-discovery-service.js",
  "floqr-venue-datapoints.js",
  "README.md",
  "functions/ai-discovery-functions.js",
  "functions/venue-datapoint-extract.js",
  "functions/discovery-crawl.test.js",
  "functions/scripts/run-instant-crawl-local.js",
  ".cursor/rules/design-notes-ai-discovery-crawl.mdc"
)

# Patch README package line in-place before copy
$readme = Join-Path $root "README.md"
$txt = [IO.File]::ReadAllText($readme)
if ($txt -notmatch 's3\.0\.97') {
  $txt = $txt -replace 's3\.0\.96 \(stable\)', 's3.0.97 (stable)'
  $txt = $txt -replace '- s3\.0\.96:', "- s3.0.97: Mass onboard for ready discovery cards + readiness report; lineup/residents page follow for DJ/promoter hints.`r`n- s3.0.96:"
  [IO.File]::WriteAllText($readme, $txt)
}

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

Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "feat: mass onboard ready discovery cards + readiness report (s3.0.97)"
    if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --format="%H %s"
  } else {
    Write-Host "No file changes on main"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.97 mass onboard to main"
