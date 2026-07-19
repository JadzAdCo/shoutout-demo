# FLOQR Rollback - v29.07.1

This rollback returns FLOQR to the previous v29.07 full package.

1. Upload the preserved v29.07 full package to the web root.
2. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.07`.
3. Rerun Package Install Diagnostics and the Firebase Rules Smoke Test.

No Firestore rule, Cloud Function, or collection rollback is required. Templates saved in v29.07.1 may retain `maxSubCharacters`, `mainTextSizePercent`, `subTextSizePercent`, `defaultMain`, and `defaultSub`; v29.07 ignores fields it does not use. New ShoutOut records may retain snapshot copies of those fields and remain readable by v29.07.
