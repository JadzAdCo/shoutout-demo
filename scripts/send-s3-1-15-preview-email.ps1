$ErrorActionPreference = "Stop"
$base = "https://jadzadco.github.io/shoutout-demo"
$note = @'
FLOQR s3.1.15 (stable) — test now. This email is the tracker (includes s3.1.14).

What shipped in s3.1.15 (Club Admin -> Employee / Worker Network)
- Pending Worker Requests shows one row per request. The merged "3 requests" row is gone: a worker cannot send a second request to the same venue (hasMadeElectionRequest + electedRequestMadeTo), so there is nothing to merge.
- Old repeat requests from before the rule were cleaned up: Priya Shah's extra Aurelia and Zebbies Garden rows were closed as duplicates, and Priya and Ale now carry both datapoints, so they cannot request those clubs again.

How to test (hard refresh)
1. Club Admin Aurelia (link below) -> Employee / Worker Network. Pending Worker Requests lists Priya Shah once and Ale once, with no "requests" count.
2. Approve or Reject one row: that row disappears and the status line in the card confirms it.
3. As a worker who already requested Aurelia, try to request Aurelia again: the form refuses and names Aurelia.

Pages SHA 449ff2e (workspace e404ec9). Functions CI, Pages build and main->test sync green. No Functions or rules deploy needed.
'@

$body = @{
  to = "bans.don@gmail.com"
  package = "s3.1.15"
  v = "s3.1.15"
  note = $note
  links = @(
    @{ label = "Club Admin Aurelia (Employee / Worker Network)"; url = "$base/admin.html?v=s3.1.15&location=temp-democlub-1" },
    @{ label = "Club Admin Zebbies Garden"; url = "$base/admin.html?v=s3.1.15&location=zebbies-garden-washington-dc" },
    @{ label = "My Profile (request a role)"; url = "$base/patron-portal.html?v=s3.1.15" }
  )
} | ConvertTo-Json -Depth 5

$resp = Invoke-RestMethod -Method Post -Uri "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/emailFloqrPreviewLinks" -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$resp | ConvertTo-Json -Depth 5
