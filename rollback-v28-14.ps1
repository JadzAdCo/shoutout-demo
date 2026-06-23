param(
  [Parameter(Mandatory=$true)]
  [string]$PreviousPackagePath,

  [Parameter(Mandatory=$false)]
  [string]$OutputPath = ".\rollback-upload"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $PreviousPackagePath)) {
  throw "Previous package ZIP not found: $PreviousPackagePath"
}

$resolvedPackage = Resolve-Path -LiteralPath $PreviousPackagePath
$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)

if (Test-Path -LiteralPath $resolvedOutput) {
  throw "Output path already exists. Choose a new folder or delete it manually first: $resolvedOutput"
}

New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $resolvedOutput -Force

Write-Host "Rollback upload folder prepared:"
Write-Host $resolvedOutput
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Upload the contents of this folder to the GitHub repo root."
Write-Host "2. Replace existing files."
Write-Host "3. Commit: Rollback from v28.14 to previous package"
Write-Host "4. Test with a cache-busting URL, for example:"
Write-Host "   https://jadzadco.github.io/shoutout-demo/?v=28.13-rollback-test"
