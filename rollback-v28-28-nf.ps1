param(
  [Parameter(Mandatory=$true)]
  [string]$PreviousPackagePath,

  [Parameter(Mandatory=$true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $PreviousPackagePath)) {
  throw "Previous package not found: $PreviousPackagePath"
}

if (Test-Path $OutputPath) {
  throw "Output path already exists. Choose an empty/new folder: $OutputPath"
}

New-Item -ItemType Directory -Path $OutputPath | Out-Null
Expand-Archive -LiteralPath $PreviousPackagePath -DestinationPath $OutputPath -Force

Write-Host "Rollback upload folder prepared:"
Write-Host "  $OutputPath"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Upload the contents of this folder to the GitHub repo root."
Write-Host "2. Replace existing files."
Write-Host "3. Commit: Rollback from v28.28-nf FLOQR rebrand"
Write-Host "4. Test:"
Write-Host "   https://jadzadco.github.io/shoutout-demo/?v=28.27-f-rollback-test"
