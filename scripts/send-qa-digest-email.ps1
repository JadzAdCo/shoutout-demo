$ErrorActionPreference = "Stop"
$note = @'
FLOQR QA digest — photoreal photos + full shared datapoints (v29.09.108)

This is the updated test email. v29.09.106 used SVG placeholders. This drop wires photoreal PNGs into shared club + people datapoints and Firestore.

Accounts (do not use Zebbies)
- Club Admin: temp_clubadmin_N@floqr-demo.com → temp-democlub-N
- TEST: Sign in temp_clubadmin_1@floqr-demo.com → admin.html (no ?location=) → Aurelia Command Center, not Zebbies.

Club Public Profile (shared datapoints)
- Identity: brand, tagline, description, type, categories, cuisine
- Location/contact: address, phone, email, website, menu, reservations, contact URL
- Socials: Instagram, Facebook, X, TikTok, FloqR handle
- Nightlife: genres, DJs/artists, promoters, amenities, age, dress, FLOQR services
- Hours: Sun–Sat grid + Labor Day (2026-09-07) special hours 21:00–02:00
- People: featured DJs, staff (waitress/waiter/bottle/admin), promotion group
- Media: PNG logo, hero, VIP + entrance gallery
TEST: club-profile.html?location=temp-democlub-1 (and 2) → logo, hero, gallery, DJ/staff/bottle photos, hours grid, Labor Day row.

Scheduling avatars
TEST: admin.html?location=temp-democlub-1#panelScheduling → worker photos from Firestore public profiles.

Public people profiles
- temp_dj_1 = Jordan Vee, temp_bottle_1 = Sienna Vale, temp_waitress_1 = Priya Shah
TEST: Sign in as temp_dj_1 / temp_bottle_1 → patron-portal.html → My Profile public preview + gallery slots.

Brands 1–10
Aurelia, Volt Room, Nectar, Panthera, Luna Fold, Facet, After Koi, Strike, Orchid Frequency, Northstar.

Pages: v29.09.108 on main. Firestore re-seeded for temp-democlub-* and temp_*@floqr-demo.com only.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "29.09.108"
  v = "29.09.108"
  note = $note
  links = @(
    @{ label = "Aurelia club profile (photos + hours grid)"; url = "https://jadzadco.github.io/shoutout-demo/club-profile.html?location=temp-democlub-1&v=29.09.108" },
    @{ label = "Volt Room club profile"; url = "https://jadzadco.github.io/shoutout-demo/club-profile.html?location=temp-democlub-2&v=29.09.108" },
    @{ label = "Temp Club Admin 1 Command Center"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=29.09.108" },
    @{ label = "Scheduling grid avatars (Aurelia)"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?location=temp-democlub-1&v=29.09.108#panelScheduling" },
    @{ label = "Patron public profile (sign in as temp_dj_1)"; url = "https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=29.09.108" },
    @{ label = "Photoreal image sheet"; url = "https://jadzadco.github.io/shoutout-demo/temp-qa-images-preview.html?v=29.09.108" },
    @{ label = "Master Admin Discovery"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.108" },
    @{ label = "Ask FloqR / FloqAi"; url = "https://jadzadco.github.io/shoutout-demo/?v=29.09.108&start=intent" },
    @{ label = "Aurelia display board"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1&screen=led-64x32" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
