# FLOQR Rollback - v28.91 Helper Popouts and Mingl Requests

This rollback does not delete user profile data, ShoutOuts, Mingl records, chat rooms, messages, media, guest lists, or live display documents.

## Roll Back Web App Files

1. Re-upload the previous package files from `shoutoutwepp,vers-28.90-mingl-chat-standalone-full-package.zip`.
2. Do not upload `node_modules`.
3. Open the previous cache-busted URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.90-mingl-chat-standalone
```

## Roll Back Firebase Rules

If v28.91 rules were published and you need to return to the previous rule labels, publish the `firestore.rules` and `storage.rules` from the v28.90 package.

## What This Reverses

- Shared `helper-popouts.js` automatic `?` helper text popouts.
- Main Mingl page pending request list.
- v28.91 diagnostics, README, and rule header labels.
