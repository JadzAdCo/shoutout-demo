# FLOQR Rollback - v29.07

This rollback returns FLOQR to the previous v29.06 full package.

1. Upload the v29.06 full package to the web root.
2. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.06`.
3. Redeploy the v29.06 Firestore rules and v29.06 Cloud Functions export if exact behavior and diagnostic marker alignment are required.
4. In Stripe, disable the v29.07 `stripeFloqrWebhook` endpoint if v29.06 is restored permanently. Do not delete Stripe payment or invoice history.
5. Rerun Package Install Diagnostics and the Firebase Rules Smoke Test.

Rollback does not delete v29.07 data in `serviceOrders`, `commerceProducts`, `entityFollows`, `audienceCampaigns`, `pickupRequests`, `clubRolePolicies`, `clubRoleActivity`, `clubNotificationSettings`, `workerAssociationRequests`, or `clubAdminNotifications`. v29.06 ignores those collections. Structured address, Genre, Commerce, taxi pickup address, REP, and supporting-team fields also remain in existing documents.

Do not remove Stripe secrets until any paid test or production Checkout sessions have been reconciled. Pickup records are simulation-only and can be retained for prototype analytics or separately archived.
