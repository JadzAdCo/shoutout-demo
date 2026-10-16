$ErrorActionPreference = "Stop"
$base = "https://jadzadco.github.io/shoutout-demo"
$note = @'
FLOQR s3.1.11 (stable) — test now. This email is the tracker.

What shipped
- Tengo muchos dólares: the typed line is bigger and now reads "Tengo muchos dólares... I just did a heist!"
- Tengo muchos dólares (both versions) and Football Intro play on 96x48 boards only. Checkout forces 96x48 for them.
- "Zebbies All-Stars" is renamed "Football Intro" everywhere (board headline "{CLUB} FOOTBALL INTRO"). Searching "zebbies all stars" still finds it.
- Every template card has a Preview button: sample words and pictures by template type, and size buttons only for sizes the template supports.
- Venue template tags with two new REP permissions: Administer Templates (read, write, delete) and Manage Templates (read, write; can add tags, cannot remove). Club Admin opens "Manage template tags"; staff get an Inbox link when a role is granted.

How to test (hard refresh)
1. Search at Heist Washington DC. Pick Tengo muchos dólares, press Preview. Only 96x48 is offered; the typed line reads "...I just did a heist!".
2. Zebbies Garden DC: the football template is named Football Intro. Preview shows the four player cards and "ZEBBIES FOOTBALL INTRO".
3. Press Preview on a few other cards (Happy Birthday photo, Traditional Black and White, a soccer jersey).
4. Club Admin (Heist) > Customize a Template > Manage template tags. Add a tag such as "vault", then search "vault" in the patron template picker.
5. Club Admin > REP: tick Administer Templates or Manage Templates for a staff member, Save. The staff member gets an Inbox row "Open template tags". A Manage Templates holder can add a tag but cannot remove one.

Xibo URLs (stable, location only — no ?v= or ?screen=)
- https://jadzadco.github.io/shoutout-demo/display.html?location=heist-washington-dc
- https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc

Pages SHA 854cf64 (workspace 8fa3560). Functions CI, Pages build and main->test sync green. Deployed: Firestore rules (template roles + tags) and createFloqrCheckoutSession (96x48 lock).
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.1.11"
  v = "s3.1.11"
  note = $note
  links = @(
    @{ label = "Search s3.1.11 (template Preview)"; url = "$base/?v=s3.1.11&start=search" },
    @{ label = "Club Admin Heist (Manage template tags, REP roles)"; url = "$base/admin.html?v=s3.1.11&location=heist-washington-dc" },
    @{ label = "Template tags page (Heist)"; url = "$base/template-tags.html?v=s3.1.11&location=heist-washington-dc" },
    @{ label = "Club Admin Zebbies (Football Intro)"; url = "$base/admin.html?v=s3.1.11&location=zebbies-garden-washington-dc" },
    @{ label = "Heist display.html (Xibo, location only)"; url = "$base/display.html?location=heist-washington-dc" },
    @{ label = "Zebbies display.html (Xibo, location only)"; url = "$base/display.html?location=zebbies-garden-washington-dc" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
