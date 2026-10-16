# s3.1.26 security follow-up: commit the last design-note edits (single admin spelling bans.don) and push the workspace branch.
# s3.1.26 code is already on main (9ab4266 + 52a8225) and deployed; main also carries s3.1.27 / s3.1.28.
# Do NOT rerun publish-s3-1-26-security.ps1: it would copy s3.1.26 files over main's newer s3.1.27 / s3.1.28 versions.
# .cursor/rules/*.mdc are workspace-only (not served by Pages), so no Pages publish is needed.
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

$files = @(
  ".cursor/rules/design-notes-data-classification.mdc",
  ".cursor/rules/design-notes-feature-services.mdc"
)

# Unrelated uncommitted work that must stay out of this commit.
$keepOut = @("admin-scheduling.js", "functions/mail-log.js", "functions/receipt-delivery.test.js",
  "functions/display-security-functions.js", "display-suprstr.js", "suprstr-webrtc.js", "firebase-config.js", "floqr-logger.js")

$staged = @(git diff --cached --name-only)
$stray = $staged | Where-Object { $files -notcontains $_ }
if ($stray) { throw "Index already has unrelated staged files: $($stray -join ', '). Unstage them first." }

git add -- $files
if ($LASTEXITCODE -ne 0) { throw "git add failed" }
$staged = @(git diff --cached --name-only)
foreach ($f in $keepOut) { if ($staged -contains $f) { throw "$f must not be committed" } }
if (-not $staged.Count) { Write-Host "Nothing to commit (design notes already committed)."; exit 0 }
git diff --cached --stat

git commit -m "docs: s3.1.26 admin email lists unified - single Master Admin spelling bans.don@gmail.com"
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
$sha = (git rev-parse HEAD).Trim()

git -c credential.helper= -c credential.helper=manager push origin HEAD:workspace/v29-08
if ($LASTEXITCODE -ne 0) { throw "git push failed" }
Write-Host "Committed and pushed $sha to origin/workspace/v29-08 (no Pages publish needed)."
