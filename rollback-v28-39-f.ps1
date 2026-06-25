param(
  [string]$RepoRoot = ".",
  [string]$PreviousPackage = "shoutoutwepp,vers-28.38-f-full-package.zip"
)

Write-Host "FLOQR v28.39-f rollback helper" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Previous package to restore: $PreviousPackage"
Write-Host ""
Write-Host "Recommended code rollback:"
Write-Host "1. Re-upload or restore files from $PreviousPackage to the GitHub Pages repo root."
Write-Host "2. Commit the rollback."
Write-Host ""
Write-Host "Database rollback: none required for v28.39-f."
Write-Host "Firestore Rules rollback: none required for v28.39-f."
Write-Host "Storage Rules rollback: none required for v28.39-f."
