param(
  [string]$PreviousPackage = "outputs\shoutoutwepp,vers-28.41-f-full-package.zip"
)

Write-Host "FLOQR v28.42-f rollback helper" -ForegroundColor Cyan
Write-Host "This fix only changed root-level migration page paths." -ForegroundColor Yellow
Write-Host "Re-upload the previous package to GitHub Pages if rollback is required:"
Write-Host $PreviousPackage -ForegroundColor Green
Write-Host ""
Write-Host "Database rollback: none required for v28.42-f."
Write-Host "Firestore Rules rollback: none required for v28.42-f."
Write-Host "Storage Rules rollback: none required for v28.42-f."
