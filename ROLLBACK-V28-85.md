# FLOQR Rollback - v28.85 ShoutOut Preview Confirmation Mingl Page

Use this note only to roll back the v28.85 package.

Rollback scope:
- Restore the previous v28.84 package files if the ShoutOut local media preview, confirmation splash, popout helper text, or separate Mingl Chat page causes a regression.
- This rollback does not delete user profile data, ShoutOut records, Mingl request records, chat history, Firebase Auth users, Firestore collections, or Storage objects.
- Firestore and Storage rules are unchanged by v28.85.

After rollback:
- Clear browser cache or use the prior package query string.
- Open Master Admin > Diagnostics and run package diagnostics plus the manual feature tests.
- Re-test ShoutOut media upload, Live Preview, ShoutOut confirmation, and Mingl Chat.
