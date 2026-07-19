# FLOQR Rollback - v28.96 Mingl Main Chat Card Removal

Rollback target:

- Restore the previous tested package ZIP before `v28.96-mingl-main-chat-card-removal`.
- Re-publish the previous package `firestore.rules` and `storage.rules` in Firebase Console.

What this release changed:

- Removed the visible `Mingl Chat` card/frame from the main Mingl landing page.
- Kept Mingl Chat access through the top `Chat` shortcut and the dedicated `mingl-chat.html` page.
- Kept Mingl discovery/search and Mingl Requests visible on the main Mingl page.

Rollback steps:

1. Upload the previous full package contents to the GitHub Pages repo root.
2. Publish the previous package `firestore.rules`.
3. Publish the previous package `storage.rules`.
4. Hard refresh the app with the previous package cache-bust value.
5. Run Master Admin diagnostics and the Firebase rules smoke test.

This rollback does not delete user profile data, Mingl chats, chat media, ShoutOuts, guest lists, inbox messages, or Firebase Auth users.
