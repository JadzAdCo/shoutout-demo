param(
  [string]$RepoRoot = ".",
  [string]$PreviousPackage = "shoutoutwepp,vers-28.28-nf-full-package.zip"
)

Write-Host "FLOQR v28.29-nf rollback helper" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Previous package to restore: $PreviousPackage"
Write-Host ""
Write-Host "Recommended rollback:"
Write-Host "1. Re-upload or restore files from $PreviousPackage to the GitHub Pages repo root."
Write-Host "2. Commit the rollback."
Write-Host "3. Test the previous version URL."
Write-Host ""
Write-Host "No Firebase config, Storage Rules, or database migration rollback is required for v28.29-nf."
Write-Host "Optional cleanup: delete only test docs from minglConnections, chatRooms, and chatMessages."
