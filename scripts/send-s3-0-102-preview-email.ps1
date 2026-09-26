$ErrorActionPreference = "Stop"
$note = @'
FLOQR s3.0.102 (stable) — Ad Campaign Mgmt badge labels.

What shipped
- Card top-right no longer shows raw "preview · shoutout".
- Now: Status Demo (not live) · Shows on ShoutOut path (or Live / Inline package / Mingl Gist package).
- Legend under the title + ? / FloqAi help explain Status vs Shows on vs Preview creative.

How to test
1. Hard-refresh master-admin.html?v=s3.0.102&tab=adCampaignManagement
2. Open a packaged demo (Lima DC / Cuisine Bantu) — badge reads Status / Shows on, not preview · shoutout.
3. Hover badge or open Live / packaged pool ? help.

Pages-only. Functions deploy skipped.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.0.102"
  v = "s3.0.102"
  note = $note
  links = @(
    @{ label = "Master Admin Ad Campaign Mgmt"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=s3.0.102&tab=adCampaignManagement" },
    @{ label = "Patron Search"; url = "https://jadzadco.github.io/shoutout-demo/?v=s3.0.102&start=search" },
    @{ label = "Aurelia display.html (Xibo, no ?v=)"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
