# FLOQR Stripe Integration Plan

## Business description

FLOQR is a nightlife discovery, engagement, services, and commerce platform connecting patrons with clubs and nightlife professionals. It sells one-time digital ShoutOuts, paid targeted guest-list and campaign distribution, notification services, and physical or licensed-digital marketplace goods. FLOQR also facilitates payouts to participating clubs and sellers. Paid non-default ShoutOuts allocate 60% to FLOQR and 40% to the club. Robotaxi Pickup is a no-charge simulation and is not a Stripe product.

## Recommended Stripe architecture

| FLOQR product | Stripe integration | Funds model |
| --- | --- | --- |
| Picture/video ShoutOut | Stripe-hosted Checkout Session | Destination charge when an approved club recipient account is active; 60% application fee to FLOQR and 40% destination transfer |
| Targeted guest-list/campaign distribution | Stripe-hosted Checkout Session | Platform payment; no connected-account transfer |
| SMS notification service | Stripe-hosted Checkout Session | Platform payment; no connected-account transfer |
| Single-seller physical or digital commerce | Stripe-hosted Checkout Session | Destination charge if FLOQR is merchant of record; the marketplace fee percentage must be approved before launch |
| Future multi-seller cart | Checkout plus separate charges and transfers | Transfer each seller's share after payment; retain the platform fee through transfer math, not `application_fee_amount` |
| Robotaxi Pickup simulation | No Stripe integration | No charge and no dispatch |

Use dynamic payment methods configured in the Stripe Dashboard. Do not pass `payment_method_types`; this lets eligible customers see Apple Pay, cards, and other supported methods without code changes.

## Connect onboarding

1. Replace manually entered `acct_...` values with server-created Accounts v2 recipient accounts.
2. Use `dashboard: "express"`, platform fee/loss responsibility appropriate for a destination-charge marketplace, and request only the recipient `stripe_transfers` capability.
3. Use Stripe-hosted or embedded account onboarding rather than collecting identity or bank information in FLOQR.
4. Add the Connect notification banner, account management, payments, disputes, and payouts components to seller/club settings.
5. Store the connected account ID only from the trusted backend. Store capability status and re-check it before creating a destination charge.
6. Do not permit a client to write or replace a connected account ID directly.

## Checkout and order lifecycle

1. Authenticate the patron with Firebase before checkout.
2. Resolve all prices, seller/club identity, inventory, revenue shares, and eligibility on the server.
3. Create an immutable `serviceOrders` snapshot and then create a Checkout Session using a deterministic idempotency key.
4. Redirect only to the fixed FLOQR production origin or the explicitly enabled local emulator.
5. Treat signed webhooks as the source of truth. The browser return page is status-only and must never mark an order paid.
6. Fulfill with deterministic document IDs so webhook retries cannot duplicate ShoutOuts or campaigns.
7. Track processing, paid, failed, expired, refunded, disputed, and fulfillment states separately.
8. Reserve finite inventory before payment or place a short hold on it; release the hold when a Checkout Session expires.

## Webhooks

Subscribe the production endpoint to at least:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`
- relevant Accounts v2 requirement and capability update events after confirming the enabled event-destination schema in Stripe Workbench

Verify signatures against the raw request body with the official Stripe SDK. Record event IDs and processing state for idempotency, but do not persist full event payloads containing customer or payment data unless required.

## Keys and environments

- Use separate Stripe sandboxes/test mode and live mode.
- Prefer a restricted API key (`rk_...`) with only the permissions required for Checkout Sessions, PaymentIntents used by Checkout, refunds if enabled, and Connect resources used by the backend.
- Store the API key in Firebase Secret Manager under `STRIPE_SECRET_KEY`; the existing secret name can contain a restricted key.
- Store the endpoint signing secret under `STRIPE_WEBHOOK_SECRET`.
- Never place either value in `firebase-config.js`, browser JavaScript, Firestore, source control, logs, support tickets, or this document.
- Require strong Dashboard authentication and restrict access to the smallest operating team.

## Tax, shipping, refunds, and disputes

- Decide which legal entity is merchant of record for commerce before live launch.
- Add Stripe Tax registrations only for jurisdictions where the merchant is obligated to collect. After registrations are configured, enable `automatic_tax` on Checkout Sessions.
- Define shipping countries, rates, delivery expectations, digital-license terms, refund rules, chargeback responsibility, and seller negative-balance handling.
- Add refund and dispute webhook processing before accepting live payments.

## Existing implementation review

### Completed in the current hardening pass

- Added the official Stripe Node SDK `22.3.1` and pinned the API behavior to `2026-06-24.dahlia`.
- Removed hard-coded card-only `payment_method_types`, enabling Dashboard-controlled dynamic payment methods.
- Added Checkout Session idempotency keys and safe, customer-neutral error responses.
- Replaced custom webhook cryptography with Stripe SDK signature verification.
- Added webhook event claims and processing status, delayed-payment success/failure handling, expiration handling, deterministic fulfillment IDs, and retry-safe fulfillment markers.
- Restricted Checkout success/cancel redirects to the FLOQR production path or an explicitly running Firebase emulator.
- Confirmed no Stripe secret-like values are stored in the application source.
- Added authorization-checked Accounts v2 recipient-account creation and Stripe-hosted onboarding/account-update links.
- Added backend-only `stripeConnectAccounts` bindings; browser profiles and Commerce products no longer accept or carry `acct_...` values.
- Re-checks `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` immediately before every destination charge and blocks checkout unless it is `active`.
- Hardened Firestore access for products, orders, club financial bindings, webhook claims, connected-account bindings, and club-admin assignments.
- Changed patron order history to an owner-scoped Firestore query so restricted order rules remain query-compatible.
- Added focused unit tests for recipient configuration, binding IDs, capability readiness, and onboarding/update link selection.
- Added transactional Commerce inventory holds before Checkout, a 31-minute Session expiry, idempotent release on failed/expired payment, and commit-on-payment behavior.
- Added signed-webhook tracking for full/partial refunds and dispute creation/update/closure, with explicit destination-transfer reversal review state.

### Required before live payments

1. **P0 — Merchant-of-record decision:** confirm FLOQR as merchant of record for ordinary marketplace orders and document taxes, refunds, disputes, Stripe-fee responsibility, and the marketplace commission. Current ordinary-Commerce orders still allocate no FLOQR fee.
2. **P1 — Refund/dispute operations:** add the authenticated refund action only after policy approval, then perform destination-transfer reversals and customer/seller notifications. Webhook tracking and manual-review flags are implemented.
3. **P1 — Connected-account dashboard:** add Stripe's notification banner and account-management embedded components so clubs and sellers can continuously resolve new requirements; the current implementation provides hosted onboarding/update links and status refresh only.
4. **P1 — Existing account migration:** previously typed `acct_...` values are deliberately ignored. Re-onboard each test club/seller through FLOQR, or add a one-time audited backend migration after verifying account ownership.
5. **P2 — Dependency migration:** the production dependency audit reports nine moderate advisories in the older Firebase Admin/Functions dependency chain. Upgrade them in a separate tested migration; do not apply a forced major-version audit fix blindly.

## Test-mode acceptance checklist

1. Successful and cancelled ShoutOut, campaign, SMS, physical-product, and digital-license Checkout Sessions.
2. Card and Apple Pay on eligible devices, plus at least one delayed payment method if enabled.
3. Duplicate webhook delivery produces one fulfillment record and one inventory commitment.
4. Failed, delayed, and expired Checkout Sessions update the order without fulfillment.
5. Connected and unconnected club/seller behavior is explicit and never silently loses a promised payout.
6. 60/40 ShoutOut math reconciles to the Checkout Session, PaymentIntent, application fee, destination transfer, and internal ledger.
7. Unauthorized users cannot modify products they do not own, order totals, payment state, connected account IDs, fulfillment, tracking, or refunds.
8. No secret keys appear in deployed static assets, Firestore, logs, or repository history.
9. Stripe Workbench, Firebase logs, service-order records, and customer-facing status reconcile for every test order.
10. A user cannot create a club-admin assignment, overwrite an account binding, change payment status, or read another buyer's order from the browser.
11. An unstarted, pending, restricted, unsupported, closed, or mismatched recipient account cannot open a paid ShoutOut or Commerce Checkout Session.

## Launch gate

Remain in Stripe test mode until all P0 items pass, the webhook endpoint is healthy, Connect capability checks are active, policies are published, tax registrations are configured where required, and finance has reconciled representative end-to-end transactions.
