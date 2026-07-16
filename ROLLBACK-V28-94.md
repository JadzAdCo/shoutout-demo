# FLOQR Rollback - v28.94 Mingl Chat Consent Actions

Rollback target:

- Restore the previous tested package ZIP before `v28.94-mingl-chat-consent-actions`.
- Re-publish the previous package `firestore.rules` and `storage.rules` in Firebase Console.

What this release changed:

- Added a visible shared-background consent card in Mingl Chat with `Approve Background` and `Keep Mine Private`.
- Changed composer emoji shortcuts to render as actual emoji symbols.
- Added sent-message commands: `Unsend`, `AutoFix`, `Edit`, `Bounce`, `Explode`, `Scroll`, and `Disappear`.
- Added Mingl Chat text animation classes for bounce, explode, scroll, and disappear behavior.
- Retracts the composer action popout after a command runs or picker opens.
- Updated Firestore rules so the background-consent system message and sender-owned message action metadata are allowed.

Rollback steps:

1. Upload the previous full package contents to the GitHub Pages repo root.
2. Publish the previous package `firestore.rules`.
3. Publish the previous package `storage.rules`.
4. Hard refresh the app with the previous package cache-bust value.
5. Run Master Admin diagnostics and the Firebase rules smoke test.

This rollback does not delete user profile data, Mingl chats, chat media, ShoutOuts, guest lists, inbox messages, or Firebase Auth users.
