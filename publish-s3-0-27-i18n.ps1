[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-27-i18n"
$git = "C:\Program Files\Git\cmd\git.exe"
$files = @(
  "floqr-i18n.js",
  "floqr-i18n-help.js",
  "floqai-help-repository.js",
  "help-attach.js",
  "index.html",
  "patron-portal.html",
  "admin.html",
  "staff-worksheet.html",
  "scheduling.html",
  "master-admin.html",
  "commerce.html",
  "guest-list.html",
  "mingl-chat.html",
  "mingl-gist.html",
  "pickup.html",
  "role-request.html",
  "services.html",
  "promoter-admin.html",
  "schedule-embed.html",
  "club-profile.html",
  "suprstr-search.html",
  "suprstar-preview.html",
  "payment-return.html",
  "rydr.html",
  "role-profiles.html",
  "bartr.html",
  "floqai-search.html",
  "translation-policy.html",
  "README.md",
  ".cursor/rules/floqr-translation.mdc"
)
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone failed" }
foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path $src)) {
    Write-Host "Skip missing $rel"
    continue
  }
  Copy-Item $src $dst -Force
}
Push-Location $stage
try {
  if ([string]::IsNullOrWhiteSpace((& $git config user.name 2>$null))) { & $git config user.name "JadzAdCo" }
  if ([string]::IsNullOrWhiteSpace((& $git config user.email 2>$null))) { & $git config user.email "290611448+JadzAdCo@users.noreply.github.com" }
  & $git add -- $files
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git commit -m "s3.0.27: full ru/nl/de/es chrome packs + patron/venueAdmin help locales"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push failed" }
    & $git log -1 --oneline
  }
} finally { Pop-Location }
Write-Host "Published s3.0.27 Pages"
