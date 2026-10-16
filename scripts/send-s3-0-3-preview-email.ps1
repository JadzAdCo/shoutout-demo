$ErrorActionPreference = "Stop"
$note = @'
FLOQR s3.0.3 (stable) — test now. This email is the tracker.

What shipped
- Every satellite page inherits the FLOQR session via floqr-session-shell.js: Work Calendar iframe, BartR, Guest List, Mingl, RydR, role request, services, promoter admin, payment return, supRstar.
- No Google-only gate while My Profile is already signed in. Embedded panels do not auto-popup Google.
- Payment return and private supRstar preview restore session instead of calling signInWithPopup on signed-out.
- Inbox “New shift needs your confirmation” still lands on Work Calendar. Tick / Select all / Approve selected. The link does not confirm.

Accounts (temp QA only — not Zebbies, not Heist/GAIA)
- Service member: temp_busboy_1@floqr-demo.com → Work Calendar
- Club Admin: temp_clubadmin_1@floqr-demo.com → Aurelia (temp-democlub-1)

Xibo URLs (stable, location only — no ?v= or ?screen=)
- https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1
- https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.0.3"
  v = "s3.0.3"
  note = $note
  links = @(
    @{ label = "Patron Search s3.0.3"; url = "https://jadzadco.github.io/shoutout-demo/?v=s3.0.3&start=search" },
    @{ label = "My Profile Work Calendar"; url = "https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=s3.0.3&tab=work-calendar" },
    @{ label = "BartR"; url = "https://jadzadco.github.io/shoutout-demo/commerce.html?v=s3.0.3&from=search" },
    @{ label = "Guest List"; url = "https://jadzadco.github.io/shoutout-demo/guest-list.html?v=s3.0.3" },
    @{ label = "Mingl Chat"; url = "https://jadzadco.github.io/shoutout-demo/mingl-chat.html?v=s3.0.3&from=portal" },
    @{ label = "RydR Pickup"; url = "https://jadzadco.github.io/shoutout-demo/pickup.html?v=s3.0.3" },
    @{ label = "Role request"; url = "https://jadzadco.github.io/shoutout-demo/role-request.html?v=s3.0.3" },
    @{ label = "supRstar"; url = "https://jadzadco.github.io/shoutout-demo/suprstr-search.html?v=s3.0.3&from=search" },
    @{ label = "Aurelia display.html (Xibo, no screen query)"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1" },
    @{ label = "Master Admin"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=s3.0.3" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
