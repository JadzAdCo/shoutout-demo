param(
  [string]$RepoRoot = ".",
  [string]$PreviousPackage = "shoutoutwepp,vers-28.35-nf-full-package.zip"
)

Write-Host "FLOQR v28.36-nf rollback helper" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot"
Write-Host "Previous package to restore: $PreviousPackage"
Write-Host ""
Write-Host "Recommended code rollback:"
Write-Host "1. Re-upload or restore files from $PreviousPackage to the GitHub Pages repo root."
Write-Host "2. Commit the rollback."
Write-Host ""
Write-Host "Database rollback:"
Write-Host "v28.36-nf does not add a required migration."
Write-Host "If you created test worker or CSR data, delete only test documents from clubEmployeeDesignations."
Write-Host "Also remove only test designatedCSRLocations/requestedClubLocationIds values from test user documents."
Write-Host ""
Write-Host "Firestore Rules rollback:"
Write-Host "No new v28.36-nf rules block was added. To roll back older CSR rules, publish firestore-rules-before-v28-34-nf.txt."
Write-Host "No Storage Rules rollback is required for v28.36-nf."
