# FLOQR Rollback - v28.90 Standalone Mingl Chat

This rollback does not delete user profile data, ShoutOuts, Mingl records, chat rooms, messages, media, guest lists, or live display documents.

## Roll Back Web App Files

1. Re-upload the previous package files from `shoutoutwepp,vers-28.89-mingl-chat-height-template-tags-full-package.zip`.
2. Do not upload `node_modules`.
3. Open the previous cache-busted URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.89-mingl-chat-height-template-tags
```

## Roll Back Firebase Rules

If v28.90 rules were published and you need to return to the previous rule labels, publish the `firestore.rules` and `storage.rules` from the v28.89 package.

## What This Reverses

- The standalone `mingl-chat.html` page.
- Main Mingl page and profile menu routing to standalone Mingl Chat.
- Redirects from old Patron Portal Mingl Chat tabs to the standalone chat page.
- v28.90 diagnostics, README, and rule header labels.
