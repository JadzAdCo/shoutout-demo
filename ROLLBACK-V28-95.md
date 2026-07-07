# FLOQR Rollback - v28.95 Mingl Chat Popout Consent

Rollback target:

- Restore the previous tested package ZIP before `v28.95-mingl-chat-popout-consent`.
- Re-publish the previous package `firestore.rules` and `storage.rules` in Firebase Console.

What this release changed:

- Opens selected Mingl Chat conversations as a focused popout instead of a separate panel below the chat list on mobile.
- Adds a close button to the selected chat popout.
- Stops auto-opening the first chat room before the patron selects a conversation.
- Removes the extra embedded Mingl Chat frame from the main Mingl page.
- Adds clearer shared-background consent wording and visible `Approve Background` / `Keep Mine Private` instructions.

Rollback steps:

1. Upload the previous full package contents to the GitHub Pages repo root.
2. Publish the previous package `firestore.rules`.
3. Publish the previous package `storage.rules`.
4. Hard refresh the app with the previous package cache-bust value.
5. Run Master Admin diagnostics and the Firebase rules smoke test.

This rollback does not delete user profile data, Mingl chats, chat media, ShoutOuts, guest lists, inbox messages, or Firebase Auth users.
