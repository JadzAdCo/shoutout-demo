$ErrorActionPreference = "Stop"
$base = "https://jadzadco.github.io/shoutout-demo"
$note = @'
FLOQR s3.1.12 (stable) — test now. This email is the tracker (includes s3.1.11).

What shipped in s3.1.12 (Tengo muchos dolares)
- The name / @handle and the typed line sit higher and are 15% bigger.
- Every loop: words for 5 seconds, then the vault blows open and the $100 bills splash behind the text for 10 seconds, then the closing slide (8 seconds), then it repeats. The splash now shows on the first run.
- Closing slide: only the HEIST logo, with WASHINGTON DC under it, centered horizontally and vertically. The separate "HEIST DC" word is gone.

Still in this build from s3.1.11
- Preview button on every template card; venue template tags with Administer Templates / Manage Templates roles; Tengo muchos dolares and Football Intro on 96x48 boards only; Zebbies All-Stars renamed Football Intro.

How to test (hard refresh)
1. Board preview (no Firestore, plays the full loop): open the "Tengo board preview" link below and watch 25 seconds.
2. Search at Heist Washington DC, pick Tengo muchos dolares, press Preview.
3. Live: approve a Tengo ShoutOut at Heist and watch the 96x48 board through one full loop.

Xibo URLs (stable, location only — no ?v= or ?screen=)
- https://jadzadco.github.io/shoutout-demo/display.html?location=heist-washington-dc

Pages SHA 39eefbe (workspace 5671977). Functions CI, Pages build and main->test sync green. No Functions or rules deploy needed for s3.1.12 (display, CSS, data, help only).
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.1.12"
  v = "s3.1.12"
  note = $note
  links = @(
    @{ label = "Tengo board preview (96x48, full loop)"; url = "$base/display.html?location=heist-washington-dc&template=heistVaultDollars&main=%40FloqrStar&screen=led-96x48&preview=1" },
    @{ label = "Search s3.1.12 (template Preview)"; url = "$base/?v=s3.1.12&start=search" },
    @{ label = "Club Admin Heist"; url = "$base/admin.html?v=s3.1.12&location=heist-washington-dc" },
    @{ label = "Heist display.html (Xibo, location only)"; url = "$base/display.html?location=heist-washington-dc" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
