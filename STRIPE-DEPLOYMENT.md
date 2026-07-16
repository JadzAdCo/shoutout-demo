# FLOQR Stripe Test-Mode Deployment

This workflow configures Stripe without placing an API key in source code. Start in Stripe test mode or a Stripe Sandbox. Do not use live keys until the launch gates in `STRIPE-INTEGRATION-PLAN.md` pass.

## 1. Open the application root

In PowerShell:

```powershell
Set-Location "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08"
```

## 2. Install the locked Functions dependencies

```powershell
npm.cmd install --prefix .\functions
```

The package includes Stripe Node SDK 22.3.1 and targets the Node.js 22 Firebase runtime.

## 3. Log in and confirm the Firebase project

```powershell
firebase.cmd login
firebase.cmd projects:list
```

Confirm that `shoutoutdemo-5b402` belongs to the intended FLOQR environment.

## 4. Create Stripe secrets

Create a least-privilege restricted test key in Stripe Workbench/API keys. Grant only the permissions the Checkout and Connect integration actually uses. Enter it interactively here; do not paste it into a command, file, chat, browser JavaScript, or Firestore:

```powershell
firebase.cmd functions:secrets:set STRIPE_SECRET_KEY --project shoutoutdemo-5b402
```

In Stripe Workbench > Webhooks, create an endpoint for:

```text
https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/stripeFloqrWebhook
```

Subscribe it to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
```

Copy the endpoint signing secret into Firebase's interactive prompt:

```powershell
firebase.cmd functions:secrets:set STRIPE_WEBHOOK_SECRET --project shoutoutdemo-5b402
```

## 5. Run focused tests

```powershell
npm.cmd test --prefix .\functions
```

Install Java, then compile the rules in the Firestore emulator before deployment:

```powershell
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
firebase.cmd emulators:exec --only firestore "npm.cmd test --prefix .\functions" --project shoutoutdemo-5b402
```

## 6. Deploy the hardened Firestore rules and Stripe Functions

```powershell
firebase.cmd deploy --only firestore:rules,functions:createFloqrConnectOnboardingLink,functions:getFloqrConnectStatus,functions:createFloqrCheckoutSession,functions:stripeFloqrWebhook --project shoutoutdemo-5b402
```

No Stripe key is used by or required for the Robotaxi Pickup simulation.

## 7. Verify

```powershell
firebase.cmd functions:list --project shoutoutdemo-5b402
firebase.cmd functions:log --only createFloqrConnectOnboardingLink,getFloqrConnectStatus,createFloqrCheckoutSession,stripeFloqrWebhook --project shoutoutdemo-5b402
```

Run a small test-mode purchase. Confirm that:

1. Checkout is hosted on Stripe.
2. Apple Pay appears only on an eligible configured device; cards remain available.
3. Returning to FLOQR initially shows processing if the webhook has not arrived.
4. The signed webhook changes the order to paid and creates exactly one fulfillment record.
5. Re-sending the same Stripe test event does not duplicate fulfillment.
6. A club or seller with incomplete onboarding cannot open paid Checkout.
7. A signed-in browser cannot write `stripeConnectAccounts`, `stripeWebhookEvents`, or payment-state fields on `serviceOrders`.
8. A Commerce Checkout holds inventory once, commits it after payment, and restores it after Session expiration or asynchronous payment failure.
9. Refund/dispute fixtures update the order and require explicit transfer-reversal review when a connected recipient was paid.

## 8. Connect and policy launch gates

Use the new FLOQR "Start Stripe payout onboarding" button for clubs and members. Previously typed `acct_...` values are not trusted or migrated automatically. Keep all Connect and marketplace payout testing in Stripe test mode until the refund/transfer-reversal policy and authenticated action, tax registrations, and the ordinary-Commerce marketplace fee policy are complete.
