# s3.1.37 Functions deploy: page links never carry ?v= (owner decision Oct 10 2026).
# Production Functions are deployed from main (s3.1.26 record: 131 Functions from a clean git archive of main), and main
# carries Functions code the workspace branch does not, so this archives the published main commit, not the workspace.
# Deploys exactly the exports whose notification / return links changed. Never the deferred open-relay mailers
# (emailFloqrPreviewLinks, emailV290914TestLinks, emailFloqrThreeDayTestPlan, emailMobileTestChecklist):
# functions/ai-discovery-functions.js is unchanged and not deployed.
param([string]$Commit = "9e7a3e7")
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

git fetch -q origin main
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }
git merge-base --is-ancestor $Commit origin/main
if ($LASTEXITCODE -ne 0) { throw "$Commit is not on origin/main" }

$changed = @(git diff --name-only "$Commit~1" $Commit -- functions | Where-Object { $_ -notmatch '\.test\.js$' -and $_ -ne "functions/package.json" })
$expected = @(
  "functions/ad-functions.js", "functions/demo-seed-functions.js", "functions/feature-services-functions.js",
  "functions/messaging-functions.js", "functions/receipt-delivery.js", "functions/scheduling-core.js",
  "functions/scheduling-functions.js"
)
$extra = $changed | Where-Object { $_ -notin $expected }
if ($extra) { throw "Unexpected Functions source changed in ${Commit}: $($extra -join ', ') - rebuild the function list" }
if ($changed -contains "functions/ai-discovery-functions.js") { throw "ai-discovery-functions.js changed - deferred mailers must not ship" }

$functions = @(
  # scheduling-core shiftApproveUrl / scheduleMessageVars, scheduling-functions manager link
  "createScheduleShift", "updateScheduleShift", "publishScheduleShifts", "respondToScheduleShift", "respondToScheduleShifts",
  # messaging-functions previewUrlForShoutout; inbound webhook -> ad intake link
  "onShoutoutCreatedNotifyClub", "messagingInboundWebhook",
  # ad-functions notification, Stripe return, ad-submit and ad-invoice links
  "createAdCampaign", "startAdCampaignCheckout", "approveAdCampaign", "rejectAdCampaign", "adIntakeWebhook",
  "startAdIntakeCheckout", "confirmAdIntakePayment", "onAdInvoiceCreated",
  # commerce paths into fulfillAdOrder / deliverFinalPaidShoutoutReceipt (receipt-delivery link)
  "confirmFloqrCheckoutSession", "stripeFloqrWebhook", "sendTestPaidShoutoutReceipt",
  # feature-services beta invite link
  "createBetaInvite",
  # demo-seed manifest admin link
  "seedTempDemoPack"
)
$deferred = "emailFloqrPreviewLinks", "emailV290914TestLinks", "emailFloqrThreeDayTestPlan", "emailMobileTestChecklist"
if ($functions | Where-Object { $_ -in $deferred }) { throw "Deferred open-relay mailer in the deploy list" }
$only = ($functions | ForEach-Object { "functions:$_" }) -join ","

$export = Join-Path $env:TEMP "floqr-deploy-s3-1-37"
if (Test-Path $export) { Remove-Item $export -Recurse -Force }
New-Item -ItemType Directory -Path $export | Out-Null
$tar = Join-Path $env:TEMP "floqr-deploy-s3-1-37.tar"
git archive --format=tar -o $tar $Commit
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }
tar -xf $tar -C $export
if ($LASTEXITCODE -ne 0) { throw "extract failed" }
Remove-Item $tar -Force

$env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
Push-Location (Join-Path $export "functions")
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} finally { Pop-Location }
Push-Location $export
try {
  firebase deploy --only $only --project shoutoutdemo-5b402 --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed" }
} finally { Pop-Location }
Write-Host "Deployed $($functions.Count) functions from $Commit."
