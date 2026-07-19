# FLOQR Rollback - v28.92 Mingl Chat Legacy and Actions

This rollback does not delete user profile data, ShoutOuts, Mingl records, chat rooms, chat messages, uploaded media, guest lists, or live display documents.

## Roll Back Web App Files

1. Re-upload the previous package files from `shoutoutwepp,vers-28.91-helper-popouts-mingl-requests-full-package.zip`.
2. Do not upload `node_modules`.
3. Open the previous cache-busted URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.91-helper-popouts-mingl-requests
```

## Roll Back Firebase Rules

If v28.92 rules were published and you need to return to the previous rule labels/behavior, publish the `firestore.rules` and `storage.rules` from the v28.91 package.

## What This Reverses

- Legacy Mingl chat room discovery/normalization from mutual Mingl connections.
- The nested Mingl Chat composer action menu.
- Mingl Chat picture/video upload support in the standalone chat page.
- Sent-message nested `Edit` and `Correct Grammar/Spelling` actions on the standalone chat page.
- v28.92 diagnostics, README, package name, and rule header labels.
