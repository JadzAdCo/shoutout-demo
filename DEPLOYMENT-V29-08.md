# FLOQR v29.08.2 deployment

The v29.08.2 patch adds the approved global Traditional Black and White layout, a fixed optional identity rail with burst-away animation, the `Enter ShoutOut Here` patron placeholder, and a ten-minute live window that returns every display to `USE SHOUTOUT @ [CLUB NAME]`. The browser timer performs the visible reset at ten minutes and `expireLiveShoutouts` performs the authoritative Firestore cleanup on the next one-minute scheduler run.

v29.08.1 also adds the Zebbies-only four-player American-football intro: four authorized image uploads, optional Gemini portrait treatment with original-image fallback, a responsive 20-second animation, server-enforced $30 Stripe Checkout pricing, and roster preservation through club approval into the live display. Xibo connected and low-bandwidth setup is documented in `XIBO-ZEBBIES-FOOTBALL-SETUP.md`.

This release moves Stripe Connect identity and onboarding to trusted backend bindings and Stripe Accounts v2. It also adds checkout inventory holds, transfer-capability gates, refund/dispute tracking, and stricter Firestore access controls.

Do not deploy this release in live mode until the marketplace merchant-of-record, ordinary Commerce commission, refund, dispute, and tax policies in `STRIPE-INTEGRATION-PLAN.md` are approved.

## Prerequisites

- Node.js version supported by Firebase Functions.
- Java installed for the Firebase Firestore emulator.
- Firebase CLI authenticated to the intended project.
- Stripe test-mode secret key stored as the `STRIPE_SECRET_KEY` Firebase secret. Prefer a restricted key with only the permissions used by this integration.
- Stripe webhook signing secret stored as `STRIPE_WEBHOOK_SECRET`.
- Test-mode webhook endpoint configured for:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.updated`
  - `charge.dispute.closed`

## Pre-deployment verification

From `functions`:

```powershell
npm.cmd ci
npm.cmd test
```

Run a real Firestore rules compile before deployment:

```powershell
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
firebase emulators:exec --only firestore "npm.cmd test"
```

The rules emulator step is mandatory because the package build environment did not have Java available.

## Deploy to the test project

Deploy the rules and Stripe functions together:

```powershell
firebase deploy --only firestore:rules,functions:getFloqrConnectStatus,functions:createFloqrConnectOnboardingLink,functions:createFloqrCheckoutSession,functions:stripeFloqrWebhook
```

Upload the static v29.08.2 application assets using the existing hosting procedure, then open the app with `?v=29.08.2` to bypass old caches.

Deploy the authoritative ten-minute expiry scheduler without redeploying the existing Stripe functions:

```powershell
firebase.cmd deploy --only "functions:expireLiveShoutouts" --project shoutoutdemo-5b402
```

The changed Stripe callable must be deployed before testing the football template:

```powershell
firebase.cmd deploy --only "functions:createFloqrCheckoutSession" --project shoutoutdemo-5b402
```

If optional Gemini portrait treatment has not previously been deployed, set `GEMINI_API_KEY` interactively and deploy the callable. The template still works with the original four photos when this function is unavailable.

```powershell
firebase.cmd functions:secrets:set GEMINI_API_KEY --project shoutoutdemo-5b402
firebase.cmd deploy --only "functions:aiEnhanceShoutOutMedia" --project shoutoutdemo-5b402
```

## Test-mode acceptance checks

1. A member can start hosted onboarding only for their own payout account.
2. A club financial administrator can start onboarding only for a club they manage.
3. The UI never asks for, displays, or accepts an `acct_...` value.
4. Checkout is rejected until `stripe_transfers` is active on the recipient account.
5. A successful paid ShoutOut routes 40% to the club and records the 60% FLOQR application fee.
6. Creating a Checkout Session reserves inventory; an expired or failed Session releases it exactly once; successful fulfillment commits it exactly once.
7. Refund and dispute webhook events update the matching service order and flag destination-payment recovery for manual review.
8. A buyer cannot read another buyer's service order or write payment status.
9. A seller cannot change another seller's product.
10. Webhook replay produces no duplicate fulfillment or inventory mutation.
11. At Zebbies, `Zebbies 4-Player Football Intro` requires four images and photo permission confirmation, opens a $30 Checkout Session, and returns a paid ShoutOut with `teamMembers.length == 4`.
12. Club approval copies all four members and `animationDurationSeconds: 20` into `liveContent/zebbies-garden-washington-dc`.

## Live-mode gate

Before switching secrets or webhooks to live mode, complete the open policy decisions and legacy connected-account migration in `STRIPE-INTEGRATION-PLAN.md`. Then repeat every acceptance check in a dedicated live-mode smoke-test account with low-value transactions.
