param(
  [string]$RepoRoot = ".",
  [string]$PreviousPackage = "shoutoutwepp,vers-28.29-nf-full-package.zip"
)

Write-Host "FLOQR v28.30-f rollback helper" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Previous package to restore: $PreviousPackage"
Write-Host ""
Write-Host "Recommended rollback:"
Write-Host "1. Re-upload or restore files from $PreviousPackage to the GitHub Pages repo root."
Write-Host "2. In Firebase Console > Firestore Rules, publish firestore-rules-before-v28-29-nf.txt."
Write-Host "3. Commit the rollback."
Write-Host "4. Test the previous version URL."
Write-Host ""
Write-Host "No Storage Rules rollback is required for v28.30-f."
Write-Host "Optional cleanup: delete only test docs from minglConnections, chatRooms, and chatMessages."
