$ErrorActionPreference = "Stop"
$base = "https://jadzadco.github.io/shoutout-demo"
$note = @'
FLOQR s3.1.13 (stable) — test now. This email is the tracker (includes s3.1.11 and s3.1.12).

What shipped in s3.1.13 (Club Admin -> Employee / Worker Network)
- The worker list shows only people linked to the club you have open (staff elected or approved there, the club's admins, staff affiliated with it). Before, it showed everyone with a staff role at any club.
- Summary counts and Role Groups follow the same list.
- Elect Patron for Role: type 2+ letters, the matching patrons appear, tap Select on the right person, pick the role, tap Elect Selected Patron Role, then confirm "Elect {name} as {role} for {club}?". Cancel saves nothing. Before, it silently took the first match.
- People who were only elected (never made CSR) no longer appear as customer service representatives.
- Panel text in all 11 languages, plus a ? help on the panel heading.

How to test (hard refresh)
1. Open Club Admin for Aurelia (link below) -> Employee / Worker Network. Only Aurelia-linked people should be listed (no temp staff from other temp clubs).
2. In Elect Patron for Role type part of a demo waitress name, tap Select, choose Waiter / Waitress / Bottle Girl, tap Elect, confirm. The person then appears in the list.
3. Try Elect with nothing selected: the button stays disabled.

Still in this build: s3.1.12 Tengo muchos dolares timeline + HEIST over WASHINGTON DC slide; s3.1.11 template Preview, venue template tags, 96x48-only Tengo / Football Intro.

Pages SHA 9891e0d (workspace f19034c). Functions CI, Pages build and main->test sync green. No Functions or rules deploy needed for s3.1.13 (Club Admin page, i18n, help only).
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.1.13"
  v = "s3.1.13"
  note = $note
  links = @(
    @{ label = "Club Admin Aurelia (Employee / Worker Network)"; url = "$base/admin.html?v=s3.1.13&location=temp-democlub-1" },
    @{ label = "Club Admin Heist"; url = "$base/admin.html?v=s3.1.13&location=heist-washington-dc" },
    @{ label = "Search s3.1.13"; url = "$base/?v=s3.1.13&start=search" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
