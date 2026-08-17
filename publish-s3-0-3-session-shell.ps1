[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$stage = Join-Path $root ".publish-s3-0-3"
$git = "C:\Program Files\Git\cmd\git.exe"

$files = @(
  "README.md",
  "ai-diagnostics-service.js",
  "commerce-app.js",
  "commerce.html",
  "floqr-session-shell.js",
  "functions/ai-discovery-functions.js",
  "functions/auth-entry-ui.test.js",
  "functions/discovery-crawl.test.js",
  "functions/scheduling-core.js",
  "guest-list-app.js",
  "guest-list.html",
  "master-admin.html",
  "mingl-chat-app.js",
  "mingl-chat.html",
  "mingl-gist-app.js",
  "mingl-gist.html",
  "patron-portal-app.js",
  "patron-portal.html",
  "payment-return-app.js",
  "payment-return.html",
  "pickup-app.js",
  "pickup.html",
  "promoter-admin-app.js",
  "promoter-admin.html",
  "role-request-app.js",
  "role-request.html",
  "scheduling-portal.js",
  "scheduling.html",
  "services-app.js",
  "services.html",
  "staff-worksheet.html",
  "staff-worksheet.js",
  "suprstar-preview.html",
  "suprstar-preview.js",
  "suprstr-search.html",
  "suprstr-search.js",
  ".cursor/rules/satellite-session-auth.mdc",
  ".cursor/rules/notify-inbox-ctas.mdc"
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
    & $git -c user.name="JadzAdCo" -c user.email="290611448+JadzAdCo@users.noreply.github.com" commit -m "Publish FLOQR s3.0.3: all satellite pages inherit FLOQR session"
    & $git -c credential.helper= -c credential.helper=manager push origin main
    if ($LASTEXITCODE -ne 0) { throw "Pages push to main failed" }
    & $git log -1 --oneline
  } else {
    Write-Host "No Pages changes to publish"
  }
} finally { Pop-Location }

Write-Host "Published s3.0.3 Pages"
