$ErrorActionPreference = "Stop"
$base = "https://jadzadco.github.io/shoutout-demo"
$note = @'
FLOQR s3.1.14 (stable) — test now. This email is the tracker (includes s3.1.13).

What shipped in s3.1.14 (Club Admin -> Employee / Worker Network)
- Pending Worker Requests is now the first card in the panel.
- Approve works. Before, it silently did nothing (the save to the worker's profile was refused). The club link is saved first, then the worker gets an Inbox message.
- Repeated requests from the same person for the same role show as one row ("3 requests"). Approve or Reject closes all of them at once.
- "Saving…" / "Approved" / "Could not save" now shows inside the card.
- One request per venue: a worker who already sent a request to a club gets "You already sent a request to {club}" and nothing is saved. Profile datapoints: hasMadeElectionRequest (0|1) and electedRequestMadeTo (venue names). When the flag is 0 the list is not checked.

How to test (hard refresh)
1. Open Club Admin for Aurelia (link below) -> Employee / Worker Network. Pending Worker Requests is the top card; duplicates show as one row.
2. Tap Approve. The card says Approved, the row disappears, the person appears in the worker list.
3. As a patron, My Profile -> Services & Service Members (or Role Request): request a role at a club, then request again at the same club. The second try errors out and names the club.

Pages SHA 7d4a898 (workspace ed323e3). Functions CI, Pages build and main->test sync green. No Functions or rules deploy needed for s3.1.14.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.1.14"
  v = "s3.1.14"
  note = $note
  links = @(
    @{ label = "Club Admin Aurelia (Employee / Worker Network)"; url = "$base/admin.html?v=s3.1.14&location=temp-democlub-1" },
    @{ label = "My Profile (request a role)"; url = "$base/patron-portal.html?v=s3.1.14" },
    @{ label = "Role Request"; url = "$base/role-request.html?v=s3.1.14" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
