[CmdletBinding()] param()
$ErrorActionPreference = "Stop"
$src = "C:\Users\Don\.cursor\projects\c-Users-Don-Documents-Codex-2026-06-22-so-work-v29-08\assets"
$dst = Join-Path $PSScriptRoot "..\images\temp-qa"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$sameName = @(
  "club-aurelia-dual-led.png",
  "club-aurelia-vip-shoutout.png",
  "club-aurelia-vip-shoutout-led.png",
  "club-aurelia-portrait-birthday.png",
  "staff-priya-floor.png",
  "staff-priya-vip.png",
  "staff-luis-table.png",
  "staff-barman.png",
  "staff-barman-pour.png",
  "staff-sienna-sparkler.png",
  "staff-amara-door.png",
  "dj-jordan-booth.png",
  "dj-maya-booth.png",
  "dj-rico-booth.png",
  "staff-nia-door.png",
  "staff-marcus-ops.png"
)
$copied = 0
foreach ($name in $sameName) {
  $from = Join-Path $src $name
  if (-not (Test-Path $from)) { throw "Missing $from" }
  Copy-Item $from (Join-Path $dst $name) -Force
  $copied += 1
}
Write-Host ("copied {0} follow-up pngs" -f $copied)
