param(
  [string]$RepoRoot = ".",
  [string]$PreviousPackage = "shoutoutwepp,vers-28.33-f-full-package.zip"
)

Write-Host "FLOQR v28.34-nf rollback helper" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Previous package to restore: $PreviousPackage"
Write-Host ""
Write-Host "Recommended code rollback:"
Write-Host "1. Re-upload or restore files from $PreviousPackage to the GitHub Pages repo root."
Write-Host "2. Commit the rollback."
Write-Host ""
Write-Host "Database rollback:"
Write-Host "v28.34-nf does not add a required migration."
Write-Host "If you created test CSR designations, delete only test documents from clubEmployeeDesignations."
Write-Host "Also remove only test designatedCSRLocations values from test user documents."
Write-Host "If you ran the included v28.31-f clubLocations migration and need to undo it:"
Write-Host "1. Open migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html."
Write-Host "2. Sign in as admin."
Write-Host "3. Select the rollback JSON downloaded before migration."
Write-Host "4. Click Apply Rollback JSON."
Write-Host ""
Write-Host "Firestore Rules rollback:"
Write-Host "Publish firestore-rules-before-v28-34-nf.txt or remove the clubEmployeeDesignations block."
Write-Host "No Storage Rules rollback is required for v28.34-nf."
