# FLOQR v29.09.12 — Messaging packs + marketing campaigns

## Use condition (service patrons)

Each **$10** pack:

| | |
|---|---|
| Twilio / Meta delivery budget | **$7.00** |
| FloqR platform profit | **$3.00** |
| SMS allotment | **466** messages @ ≈ $0.015 all-in US SMS |
| WhatsApp allotment | **233** messages @ ≈ $0.030 Twilio + Meta marketing |

When the balance hits **0**, buy another **$10 SMS** or **$10 WhatsApp** messaging bundle before sending more campaign traffic.

- First **SMS Notification Services** checkout (`smsNotifications`) enables ops SMS **and** grants 466 SMS credits.
- First **WhatsApp Notification Services** checkout (`whatsappNotifications`) enables WhatsApp **and** grants 233 WhatsApp credits.
- Top-ups: `smsMessageBundle` / `whatsappMessageBundle` (same economics).

## Test links (GitHub Pages)

- Club Admin Advertising (credits + campaigns):  
  https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=29.09.12#panelAdvertising  
  (open **Advertising** tab after sign-in)
- Notifications (ops + $10 SMS/WA enablement):  
  https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=29.09.12  
  → **Notifications** tab
- Payment return:  
  https://jadzadco.github.io/shoutout-demo/payment-return.html

## Functions deployed

- `createFloqrCheckoutSession` — new order types above
- `getClubMessagingCredits`
- `saveClubMarketingCampaign`
- `sendClubMarketingCampaign`
- Existing ops messaging unchanged

## Manual test plan

1. Sign in as Club Admin for a location.
2. Advertising → confirm use-condition copy and 0 balances.
3. Buy SMS $10 (Stripe test) → after return, balance ≈ 466; Notifications SMS enabled.
4. Buy WhatsApp $10 → balance ≈ 233.
5. Pick industry template, set background URL, save draft.
6. Enter test E.164 phone → Send test → balance decrements by 1 (or dry-run if Twilio secrets missing).
7. Exhaust credits (or set low) → send fails with buy-bundle message; buy bundle and retry.

## DJ / Mixcloud on BartR (same ship)

- Seller: `patron-portal.html?tab=bartr` — playlist curation, Mixcloud show, consultation, merch, cleared download + rights cert
- Shop: `commerce.html` — Mixcloud embed + playlist links
- Policy: `DJ-BARTR-MIXCLOUD.md`
