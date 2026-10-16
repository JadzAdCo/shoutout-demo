$ErrorActionPreference = "Stop"
$note = @'
FLOQR s3.0.0 (stable) — test now. This email is the tracker.

What shipped
- Internal Calendar AssignmentCards: Draft purple, Pending amber, Confirmed green, Open/unfilled amber. Written status on every card. One card geometry. View More: Open → Draft → Pending → Confirmed, then start time.
- Website / ingest API: Confirmed only. status= query ignored. No Draft/Pending/Open, no private employee fields.
- Birthday-with-photo: 96x48 stays 3-line side-by-side. 64x48 and 64x32 loop photo then shoutout (~4s), FLOQR + handle on every frame.

Accounts (temp QA only — not Zebbies, not Heist/GAIA)
- Club Admin: temp_clubadmin_1@floqr-demo.com → Aurelia (temp-democlub-1)
- TEST Calendar: admin.html (no ?location=) → Scheduling. Create draft, publish pending, confirm, leave one slot open. Website widget must show Confirmed only.

Birthday LED
- Composer: Birthday + photo, pick 64x32 (composer preview only). Expect photo / text loop, identity rail every frame.
- 96x48 Xibo (display.html) stays side-by-side. Temp clubs: VenueSupports96x48=1, VenueSupports64x32=1, VenueSupports64x48=0. Do not put ?screen= or ?v= on the Xibo URL.

Xibo URLs (stable, location only)
- https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1
- https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.0.0"
  v = "s3.0.0"
  note = $note
  links = @(
    @{ label = "Patron Search s3.0.0"; url = "https://jadzadco.github.io/shoutout-demo/?v=s3.0.0&start=search" },
    @{ label = "Temp Club Admin 1 Command Center"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=s3.0.0" },
    @{ label = "Aurelia Scheduling Calendar"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=s3.0.0#panelScheduling" },
    @{ label = "Aurelia club profile"; url = "https://jadzadco.github.io/shoutout-demo/club-profile.html?location=temp-democlub-1&v=s3.0.0" },
    @{ label = "Patron portal (birthday composer)"; url = "https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=s3.0.0" },
    @{ label = "Aurelia display.html (Xibo, no screen query)"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1" },
    @{ label = "Aurelia display2.html (Xibo, no screen query)"; url = "https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1" },
    @{ label = "Public schedule embed"; url = "https://jadzadco.github.io/shoutout-demo/schedule-embed.html?v=s3.0.0" },
    @{ label = "Master Admin"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=s3.0.0" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
