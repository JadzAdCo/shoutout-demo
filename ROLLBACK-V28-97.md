# FLOQR Rollback - v28.97 Mingl Requests Help Popout

Rollback target:

- Restore the previous tested package ZIP before `v28.97-mingl-requests-help-popout`.
- Re-publish the previous package `firestore.rules` and `storage.rules` in Firebase Console.

What this release changed:

- Reformatted Mingl Requests so patron name, request status, explanation, shared datapoints, and actions are visually separated.
- Help `?` popouts now close when the patron clicks elsewhere on the page.
- Opening one help `?` closes other open help popouts.

Rollback steps:

1. Upload the previous full package contents to the GitHub Pages repo root.
2. Publish the previous package `firestore.rules`.
3. Publish the previous package `storage.rules`.
4. Hard refresh the app with the previous package cache-bust value.
5. Run Master Admin diagnostics and the Firebase rules smoke test.

This rollback does not delete user profile data, Mingl chats, chat media, ShoutOuts, guest lists, inbox messages, or Firebase Auth users.
