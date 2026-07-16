# FLOQR v29.08 rollback

The previous application package is v29.07.1. Stripe v29.08 introduces backend-only Connect bindings and stricter Firestore rules, so a complete blind rollback to the old payment flow is unsafe after onboarding or payment records have been created.

## Preferred rollback

1. Disable new paid checkout entry points in the hosted application.
2. Restore the prior static v29.07.1 application assets if the regression is outside payments.
3. Keep the v29.08 Firestore rules and webhook handler deployed so Stripe bindings, webhook claims, service-order isolation, and inventory recovery remain protected.
4. Keep the v29.08 Connect status/onboarding functions unless the incident is specifically in onboarding.
5. Reconcile every open Checkout Session, held inventory reservation, refund, and dispute before deploying a replacement payment backend.

## If the Stripe functions must be rolled back

- Stop new payment creation first.
- Preserve `stripeConnectAccounts` and `stripeWebhookEvents`; do not expose either collection to browser clients.
- Allow the current webhook endpoint to process or reconcile all events already emitted for v29.08 Sessions.
- Export affected `serviceOrders` and `commerceProducts` before changing fulfillment or reservation code.
- Do not re-enable legacy browser-supplied `stripeConnectAccountId` values.

## Rules warning

Do not restore broader v29.07.1 Firestore rules once payment or Connect records exist. If a rule rollback is unavoidable, port the v29.08 protections for `stripeConnectAccounts`, `stripeWebhookEvents`, `serviceOrders`, `commerceProducts`, user role fields, and club Stripe fields into the replacement rules first, then compile them in the Firestore emulator.

## Recovery verification

After rollback, confirm that checkout is disabled or uses only a trusted server-side recipient, webhook signatures still verify, existing held inventory is reconciled, and users cannot read or modify another party's orders or payout identity.
