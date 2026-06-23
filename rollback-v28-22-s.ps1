param(
  [Parameter(Mandatory=$true)]
  [string]$StablePackagePath,

  [Parameter(Mandatory=$false)]
  [string]$OutputPath = ".\rollback-upload"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $StablePackagePath)) {
  throw "Stable package ZIP not found: $StablePackagePath"
}

$resolvedPackage = Resolve-Path -LiteralPath $StablePackagePath
$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)

if (Test-Path -LiteralPath $resolvedOutput) {
  throw "Output path already exists. Choose a new folder or delete it manually first: $resolvedOutput"
}

New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $resolvedOutput -Force

Write-Host "Stable rollback upload folder prepared:"
Write-Host $resolvedOutput
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Upload the contents of this folder to the GitHub repo root."
Write-Host "2. Replace existing files."
Write-Host "3. Commit: Rollback to v28.22-s stable package"
Write-Host "4. Test with a cache-busting URL, for example:"
Write-Host "   https://jadzadco.github.io/shoutout-demo/?v=28.22-s-rollback-test"
