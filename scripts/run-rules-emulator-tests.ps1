# Runs rules-tests/ (Firestore + Storage security rules) against the local Firebase emulators.
# Project id demo-floqr-rules never touches production. Requires Node 20+ and Java 21.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/run-rules-emulator-tests.ps1 [-JavaHome C:\path\to\jdk21]
param(
  [string]$JavaHome = $env:JAVA_HOME
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $JavaHome -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
  $portable = Join-Path $env:USERPROFILE "tools\jdk21"
  if (Test-Path (Join-Path $portable "bin\java.exe")) { $JavaHome = $portable }
}
if ($JavaHome) {
  $env:JAVA_HOME = $JavaHome
  $env:Path = (Join-Path $JavaHome "bin") + [IO.Path]::PathSeparator + $env:Path
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java 21 is required for the Firebase emulators. Install a JDK or pass -JavaHome."
}

if (-not (Test-Path (Join-Path $repoRoot "rules-tests\node_modules"))) {
  npm --prefix rules-tests ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

npx --yes firebase-tools@15 emulators:exec --only firestore,storage --project demo-floqr-rules "npm --prefix rules-tests test"
exit $LASTEXITCODE
