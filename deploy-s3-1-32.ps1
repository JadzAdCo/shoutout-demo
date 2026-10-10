# s3.1.32 mail-log code redaction: deploy every function whose code path writes a systemMailLogs row
# (sendSystemMail / applyMailEvents), from a clean git archive of the commit (never the dirty working tree).
# Held back on purpose (open mail relay, owner decision): emailFloqrPreviewLinks, emailV290914TestLinks,
# emailFloqrThreeDayTestPlan, emailMobileTestChecklist.
param([Parameter(Mandatory = $true)][string]$Commit)
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
Set-Location $PSScriptRoot

$names = @(
  "requestSos2faCode",            # sos2fa-functions -> sendgridMailSos2fa
  "requestEmailOtp",              # ai-discovery-functions -> sendEmailOtp
  "sendFloqrPreviewLinksEmail",   # ai-discovery-functions -> sendgridMail
  "submitMobileTestResults",      # ai-discovery-functions -> sendgridMail
  "sendClubTestMessage",          # messaging-functions -> sendClubAlertEmail (body carries today's club code)
  "onScheduleNotifyQueued",       # messaging-functions -> sendSystemMail
  "sendgridMailEvents",           # mail-log-functions -> applyMailEvents
  "confirmFloqrCheckoutSession",  # commerce-functions -> finalizePaidOrder -> receipt-delivery
  "stripeFloqrWebhook",           # commerce-functions -> finalizePaidOrder -> receipt-delivery
  "sendTestPaidShoutoutReceipt",  # commerce-functions -> receipt-delivery
  "onAdInvoiceCreated"            # ad-functions -> receipt-delivery sendgridMailWithAttachment
)
$only = ($names | ForEach-Object { "functions:$_" }) -join ","
$export = Join-Path $env:TEMP "floqr-deploy-s3-1-32"
if (Test-Path $export) { Remove-Item $export -Recurse -Force }
New-Item -ItemType Directory -Path $export | Out-Null
$tar = Join-Path $env:TEMP "floqr-deploy-s3-1-32.tar"
git archive --format=tar -o $tar $Commit
if ($LASTEXITCODE -ne 0) { throw "git archive $Commit failed" }
tar -xf $tar -C $export
Remove-Item $tar -Force

Push-Location (Join-Path $export "functions")
try {
  cmd /c "npm ci --silent 2>nul"
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed in the export" }
  cmd /c "node --test mail-log-redaction.test.js mail-log.test.js 2>&1" | Select-Object -Last 3
  if ($LASTEXITCODE -ne 0) { throw "redaction tests failed in the export" }
} finally { Pop-Location }

$env:FUNCTIONS_DISCOVERY_TIMEOUT = "300"
Push-Location $export
try {
  firebase deploy --only $only --project shoutoutdemo-5b402 --non-interactive
  if ($LASTEXITCODE -ne 0) { throw "firebase deploy failed" }
} finally { Pop-Location }

$url = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/requestSos2faCode"
$refused = $null
try {
  $res = Invoke-WebRequest -Uri $url -Method Post -ContentType "application/json" -Body '{"data":{}}' -UseBasicParsing
  $refused = "NOT REFUSED (HTTP $($res.StatusCode)): $($res.Content)"
} catch {
  $refused = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
}
if ($refused -notmatch "UNAUTHENTICATED") { throw "Unauthenticated probe: $refused" }
Write-Host "Unauthenticated call refused: $refused"
Write-Host "Deployed $only from $Commit."
