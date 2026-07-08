# FLOQR Rollback - v28.98

Rollback target:

- Restore the previous tested package ZIP before `v28.98`.
- Re-publish the previous package `firestore.rules` and `storage.rules` in Firebase Console.

What this release changed:

- Restored the visible Mingl Chat room list on `mingl-chat.html`.
- Kept the selected conversation as a popout that opens after a patron taps a chat.
- Archived passed Master Admin Feature Diagnostics behind a clickable `View Archived Passed Diagnostics` section while keeping Failed, Soft Fail, and TBI checks visible.

Rollback steps:

1. Upload the previous full package contents to the GitHub Pages repo root.
2. Publish the previous package `firestore.rules`.
3. Publish the previous package `storage.rules`.
4. Hard refresh the app with the previous package cache-bust value.
5. Run Master Admin diagnostics and the Firebase rules smoke test.

This rollback does not delete user profile data, Mingl chats, chat media, ShoutOuts, guest lists, inbox messages, or Firebase Auth users.
