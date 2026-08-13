$ErrorActionPreference = "Stop"
$note = @'
FLOQR QA digest — features since 2026-08-12 (through v29.09.106)

1) Club Admin affiliation (no Zebbies default)
- temp_clubadmin_N@floqr-demo.com maps to temp-democlub-N
- Unassigned admins get assignment-request gate (not Zebbies)
TEST: Sign in as temp_clubadmin_1@floqr-demo.com → admin.html (no ?location=) → should land on Temp Demo Club 1.

2) Staff Scheduling paid-this-month / Resubscribe (v29.09.98)
- Gate uses staffSchedulingPaid + paid-this-month; Resubscribe path when unpaid
TEST: Open Scheduling on temp-democlub-1; confirm paid venues unlock grid; unpaid shows Resubscribe.

3) People × days schedule grid + Dutch i18n (v29.09.101)
- Manual chips + Round Robin fill; draft/Publish; worker photo popout (SMS/profile)
- First-use browser language can select Nederlands
TEST: admin.html?location=temp-democlub-1 → Scheduling → place drafts → Publish. Switch UI language to Dutch once.

4) Venue hours calendar + holidays (v29.09.103)
- Weekly hours + period overrides on Club Public Profile
- Staff window = open−2h through close+1h; guest list open nights; holiday highlights
TEST: Club Public Profile → set hours → Scheduling headers show holiday/closed; guest list event date flags holidays.

5) AI crawl full venue datapoints (v29.09.104)
- Parses identity/contact/socials/nightlife/hoursStructured/media into review + approve → clubLocations
TEST: Master Admin → Discovery → run/paste crawl → confirm captured datapoint count + amenities/hours/socials fields.

6) Public profile hours week grid + holiday hours (v29.09.105)
- Sun–Sat 7×2 calendar grid with week caption (e.g. Sun 9 – Sat 15, Aug 2026)
- Upcoming holidays show open/close and call out special vs usual weekday
TEST: club-profile.html?location=temp-democlub-1 → Opening hours grid + holiday rows.

7) QA temp venue/employee profile cards (v29.09.106) — this email
- temp-democlub-1..10 now have logos, venue art, gallery, contact/socials, hoursStructured, featured DJ/staff/promoter cards with photos
- Profile cards include Temp DJ / Waitress / Waiter / Bottle / Promoter / Club Admin personas for each club
TEST: Open club-profile for temp-democlub-1 (and 2–3) → logo, hero, gallery, DJs, staff cards with images. Only QA temp_* / temp-democlub-* were enriched.

Accounts reminder
- Club Admin: temp_clubadmin_N@floqr-demo.com → temp-democlub-N
- Featured employee cards use temp_dj_N / temp_waitress_N / temp_waiter_N / temp_bottle_N / temp_promoter_N labels on the public profile (QA art)

Pages: v29.09.106 on main. Functions discovery deploy already live from v29.09.104.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "29.09.106"
  v = "29.09.106"
  note = $note
  links = @(
    @{ label = "Temp Club Admin Command Center"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=29.09.106" },
    @{ label = "Temp Demo Club 1 public profile"; url = "https://jadzadco.github.io/shoutout-demo/club-profile.html?location=temp-democlub-1&v=29.09.106" },
    @{ label = "Temp Demo Club 2 public profile"; url = "https://jadzadco.github.io/shoutout-demo/club-profile.html?location=temp-democlub-2&v=29.09.106" },
    @{ label = "Scheduling grid (temp-democlub-1)"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?location=temp-democlub-1&v=29.09.106#panelScheduling" },
    @{ label = "Venue hours on Club Public Profile"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?location=temp-democlub-1&v=29.09.106#clubVenueHoursCard" },
    @{ label = "Master Admin Discovery / AI crawl"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.106" },
    @{ label = "Staff Scheduling portal"; url = "https://jadzadco.github.io/shoutout-demo/scheduling.html?v=29.09.106" },
    @{ label = "Ask FloqR / FloqAi"; url = "https://jadzadco.github.io/shoutout-demo/?v=29.09.106&start=intent" },
    @{ label = "Temp Demo 1 display board"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1&screen=led-64x32" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
