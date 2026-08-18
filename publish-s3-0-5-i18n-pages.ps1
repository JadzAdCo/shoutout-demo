[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-5-i18n-pages"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "admin.html",
  "bartr.html",
  "club-profile.html",
  "commerce.html",
  "floqai-search.html",
  "floqr-i18n.js",
  "floqr-nav.js",
  "global-profile-status.js",
  "guest-list.html",
  "index.html",
  "master-admin.html",
  "mingl-chat.html",
  "mingl-gist.html",
  "patron-portal-app.js",
  "patron-portal.html",
  "payment-return.html",
  "pickup.html",
  "promoter-admin.html",
  "role-profiles.html",
  "role-request.html",
  "rydr.html",
  "schedule-embed.html",
  "scheduling.html",
  "services.html",
  "staff-worksheet.html",
  "suprstar-preview.html",
  "suprstr-search.html",
  "translation-policy.html",
  "functions/auth-entry-ui.test.js"
)

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
& $git clone --depth 1 "https://github.com/JadzAdCo/shoutout-demo.git" $stage
if ($LASTEXITCODE -ne 0) { throw "Clone of shoutout-demo failed" }

foreach ($rel in $files) {
  $src = Join-Path $root $rel
  $dst = Join-Path $stage $rel
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $src $dst -Force
}

Push-Location $stage
try {
  & $git add -- $files
  & $git diff --cached --stat
  & $git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    & $git -c user.name="JadzAdCo" -c user.email="290611448+JadzAdCo@users.noreply.github.com" commit -m "Publish FLOQR s3.0.5: translate remaining chrome and open admin patron links in a new tab"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.5 i18n pages to GitHub Pages"
