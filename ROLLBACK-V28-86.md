# FLOQR Rollback - v28.86 Mingl Actions AI Recommendations

Use this only if the v28.86 Mingl message actions, chat media/background upload, or personalized ShoutOut recommendations need to be rolled back.

1. Restore the previous package files from the last known good ZIP.
2. Restore the previous `firestore.rules` and `storage.rules` only if the deployed v28.86 rules cause a confirmed regression.
3. Redeploy the GitHub Pages app.
4. Rerun Master Admin > Diagnostics > Run Rules Smoke Test and the v28.86 manual feature tests.

This rollback does not delete user profile data, ShoutOut history, Mingl chats, Bata planning data, guest lists, Firebase Auth users, Firestore records, or Storage media.
