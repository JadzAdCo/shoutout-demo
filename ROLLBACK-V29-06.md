# FLOQR Rollback - v29.06

This rollback returns FLOQR to the previous v29.05 full package.

1. Upload `ShoutOut-wepApp.v29.05.zip` to the web root.
2. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.05`.
3. Redeploy the v29.05 Firestore and Storage rules if exact diagnostic marker alignment is required.
4. Rerun Package Install Diagnostics and the Firebase Rules Smoke Test.

Rollback does not delete `clubTemplateVariants`, the optional `patronTemplateBackgroundEditingEnabled` club setting, or the optional club-media trim/filter/order fields. v29.05 ignores those new records and fields. Existing patron backgrounds and uploaded club media remain intact.
