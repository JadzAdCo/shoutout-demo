# FLOQR Rollback - v28.93 Mingl Chat Legacy Recovery

This rollback does not delete user profile data, ShoutOuts, Mingl records, chat rooms, chat messages, uploaded media, guest lists, or live display documents.

## Roll Back Web App Files

1. Re-upload the previous package files from `shoutoutwepp,vers-28.92-mingl-chat-legacy-actions-full-package.zip`.
2. Do not upload `node_modules`.
3. Open the previous cache-busted URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.92-mingl-chat-legacy-actions
```

## Roll Back Firebase Rules

If v28.93 rules were published and you need to return to the previous rule labels/behavior, publish the `firestore.rules` and `storage.rules` from the v28.92 package.

## What This Reverses

- Forced standalone Mingl Chat composer rebuild for old cached/partially uploaded markup.
- Legacy Mingl connection reads using `requestedBy` and `requestedTo`.
- Extra recovery path for older accepted Mingl chats that were not visible in the standalone Mingl Chat inbox.
- v28.93 diagnostics, README, package name, and rule header labels.
