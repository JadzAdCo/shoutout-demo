# FLOQR v29.09.10 Deployment

## Release scope

- **Club SMS / WhatsApp ops messaging** (additive): pending ShoutOut alerts, daily club auth codes, test send, inbound APPROVE/REJECT webhook
- Paid SMS `$10` checkout path in `admin-rep-extension` / `commerce-functions` **unchanged**
- FloqAi Search preview page banner clarified (`floqai-search.html`)
- Firestore rules: `clubDailyAuthCodes`, `clubMessageDeliveries`, `clubMessageInbound`
- Cache-bust: `admin-rep-extension.js?v=29.09.10`

## FloqAi preview URL

Local / package preview (not production Search default):

`https://jadzadco.github.io/shoutout-demo/floqai-search.html?v=29.09.10-floqai1`

Or open `./floqai-search.html` from the package.

## Messaging secrets (Firebase Functions)

Set these with Secret Manager before live Twilio delivery (missing secrets → dry-run + `clubMessageDeliveries` logs):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` (E.164 SMS from)
- `TWILIO_WHATSAPP_FROM` (WhatsApp-enabled from, `whatsapp:+E164` or E.164)
- `CLUB_AUTH_CODE_PEPPER` (pepper for daily club auth code hashes)

Optional env: `FLOQR_PUBLIC_ORIGIN` (default `https://jadzadco.github.io/shoutout-demo`), `FLOQR_MASTER_ADMIN_EMAILS` (same default as commerce-functions).

Twilio inbound webhook URL (after functions deploy):

`https://us-central1-<project>.cloudfunctions.net/messagingInboundWebhook`

## Verification (local)

```powershell
npm.cmd test --prefix .\functions
```

## Deploy (when ready — not part of this change set)

```powershell
firebase.cmd deploy --only functions:getClubDailyAuthCode,functions:sendClubTestMessage,functions:onShoutoutCreatedNotifyClub,functions:rotateClubDailyAuthCodes,functions:messagingInboundWebhook,firestore:rules --project shoutoutdemo-5b402
# Then publish static package (admin + floqai-search) to GitHub Pages
```

Do **not** omit commerce functions when redeploying the whole `functions` bundle; messaging is additive.
