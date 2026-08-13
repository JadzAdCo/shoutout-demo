[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$src = "C:\Users\Don\.cursor\projects\c-Users-Don-Documents-Codex-2026-06-22-so-work-v29-08\assets"
$dst = Join-Path $PSScriptRoot "..\images\temp-qa"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$map = @{
  "temp-club-1-icon.png"="club-1-logo.png"
  "temp-club-2-icon.png"="club-2-logo.png"
  "temp-club-3-icon.png"="club-3-logo.png"
  "temp-club-4-icon.png"="club-4-logo.png"
  "temp-club-5-icon.png"="club-5-logo.png"
  "temp-club-6-icon.png"="club-6-logo.png"
  "temp-club-7-icon.png"="club-7-logo.png"
  "temp-club-8-icon.png"="club-8-logo.png"
  "temp-club-9-icon.png"="club-9-logo.png"
  "temp-club-10-icon.png"="club-10-logo.png"
  "temp-club-1-venue.png"="club-1-venue.png"
  "temp-club-rooftop.png"="club-rooftop.png"
  "temp-club-speakeasy.png"="club-speakeasy.png"
  "temp-club-1-gallery-a.png"="club-gallery-vip.png"
  "temp-club-1-gallery-b.png"="club-gallery-entrance.png"
  "temp-promo-1-icon.png"="promo-collective-logo.png"
  "temp-dj-1.png"="dj-jordan.png"
  "temp-dj-2.png"="dj-maya.png"
  "temp-dj-3.png"="dj-rico.png"
  "temp-waitress-1.png"="staff-priya.png"
  "temp-waiter-1.png"="staff-luis.png"
  "temp-bottle-girl-1.png"="staff-sienna.png"
  "temp-hostess-2.png"="staff-amara.png"
  "temp-promoter-1.png"="staff-nia.png"
  "temp-admin-1.png"="staff-marcus.png"
}
foreach ($k in $map.Keys) {
  $from = Join-Path $src $k
  if (-not (Test-Path $from)) { throw "Missing $from" }
  Copy-Item $from (Join-Path $dst $map[$k]) -Force
}
Write-Host ("copied {0} pngs" -f $map.Count)
