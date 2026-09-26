$ErrorActionPreference = "Stop"
$note = @'
FLOQR s3.0.101 (stable) — test Ad Campaign Mgmt now.

What shipped
- Master Admin → Ad Campaign Mgmt: Preview creative works on pending and live cards (flyer or sandboxed HTML).
- Raw JSON targeting editors removed. Use plain match tags, optional category rows, and optional required match groups — FLOQR serializes the structured rules.
- Friendlier page copy + FloqAi / ? help for operators.

How to test
1. Hard-refresh master-admin.html?v=s3.0.101&tab=adCampaignManagement (SOS2FA as needed).
2. Pending card → Preview creative → flyer/HTML appears; Hide preview clears it.
3. Live / packaged pool → Preview creative on a demo (e.g. Lima DC / Cuisine Bantu).
4. Edit match tags with commas; add a category row; Save targeting — no JSON textareas.
5. Confirm Save note: local browser override for packaged demos (does not rewrite Firestore docs).

Pages-only (no Functions deploy required for this UX). Preview package marker s3.0.101.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.0.101"
  v = "s3.0.101"
  note = $note
  links = @(
    @{ label = "Master Admin Ad Campaign Mgmt"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=s3.0.101&tab=adCampaignManagement" },
    @{ label = "Patron Search"; url = "https://jadzadco.github.io/shoutout-demo/?v=s3.0.101&start=search" },
    @{ label = "My Profile Ad Campaigns"; url = "https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=s3.0.101&tab=ad-campaigns" },
    @{ label = "Club Admin"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=s3.0.101&location=temp-democlub-1" },
    @{ label = "Aurelia display.html (Xibo, no ?v=)"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1" },
    @{ label = "Aurelia display2.html (Xibo, no ?v=)"; url = "https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
