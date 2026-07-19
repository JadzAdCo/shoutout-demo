# FLOQR Rollback - v28.87 Mingl Chat Diagnostics

Use this only if the v28.87 Mingl Chat composer/read-receipt changes or Master Admin Diagnostics rerun button causes a confirmed regression.

1. Restore the previous package files from the last known-good full ZIP.
2. Restore `patron-app.js`, `patron-portal-app.js`, `styles.css`, `ai-diagnostics-service.js`, and `master-admin.html` from v28.86 if you need the prior Mingl Chat or Diagnostics behavior.
3. If the deployed v28.87 Firestore rules cause a confirmed regression, restore the previous `firestore.rules`. Storage rules were not changed in this package.
4. Rerun Master Admin > Diagnostics > Run Diagnostics and Run Rules Smoke Test.
5. This rollback does not delete user profile data, Mingl requests, Mingl chats, ShoutOut records, media, diagnostics reports, or Firestore/Storage content.
