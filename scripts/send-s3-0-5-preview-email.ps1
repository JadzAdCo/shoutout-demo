$ErrorActionPreference = "Stop"
$note = @'
FLOQR s3.0.5 (stable) — test now. This email is the tracker.

What shipped
- Language Settings report box (AI Grammar, Correction Mode, tone, emoji, word list, draft privacy) now translates with App language. Raw camelCase values are gone.
- Production pages (Search, My Profile, Club Admin, Master Admin, BartR, Guest List, Mingl, RydR, Work Calendar, services, promoter, scheduling, club profile, supRstar, payment return) load floqr-i18n and translate chrome.
- Profile status menu (My Profile and Settings, Inbox, Mingl Chat, BartR, RydR, FloqAi, Sign out) follows App language.
- From Club Admin / Master Admin, those patron links open in a NEW TAB. An in-app notice says: "A new tab / new window is opening. The admin portal will stay open on this browser session. Please hold." Sign out stays on this tab.

How to test
1. Hard-refresh patron-portal.html?v=s3.0.5&tab=language — set Français — the report box under Save must be French.
2. Club Admin admin.html?v=s3.0.5&location=temp-democlub-1 — open the top-right profile pill. Labels should be French if App language is Français.
3. Click My Profile and Settings / FloqAi / RydR — a hold popout appears, a new tab opens, Venue Command Center stays on this tab.

Accounts (temp QA — not Zebbies)
- Club Admin: temp_clubadmin_1@floqr-demo.com → Aurelia (temp-democlub-1)

Xibo URLs (stable, location only — no ?v= or ?screen=)
- https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1
- https://jadzadco.github.io/shoutout-demo/display2.html?location=temp-democlub-1

Pages SHA bda8e70. Functions CI green. No Functions deploy (Pages-only).
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.0.5"
  v = "s3.0.5"
  note = $note
  links = @(
    @{ label = "Patron Search s3.0.5"; url = "https://jadzadco.github.io/shoutout-demo/?v=s3.0.5&start=search" },
    @{ label = "Language Settings report (hard refresh)"; url = "https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=s3.0.5&tab=language" },
    @{ label = "Club Admin Aurelia (profile menu new-tab + hold notice)"; url = "https://jadzadco.github.io/shoutout-demo/admin.html?v=s3.0.5&location=temp-democlub-1" },
    @{ label = "Master Admin"; url = "https://jadzadco.github.io/shoutout-demo/master-admin.html?v=s3.0.5" },
    @{ label = "BartR"; url = "https://jadzadco.github.io/shoutout-demo/commerce.html?v=s3.0.5&from=search" },
    @{ label = "Mingl Chat"; url = "https://jadzadco.github.io/shoutout-demo/mingl-chat.html?v=s3.0.5&from=portal" },
    @{ label = "RydR Pickup"; url = "https://jadzadco.github.io/shoutout-demo/pickup.html?v=s3.0.5" },
    @{ label = "Aurelia display.html (Xibo, no screen query)"; url = "https://jadzadco.github.io/shoutout-demo/display.html?location=temp-democlub-1" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json" -Body $body
$resp | ConvertTo-Json -Depth 5
