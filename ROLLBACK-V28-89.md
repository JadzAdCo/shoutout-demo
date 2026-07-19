# FLOQR Rollback - v28.89 Mingl Chat Height and Template Tags

This rollback does not delete user profile data, ShoutOuts, Mingl records, chat rooms, messages, media, guest lists, or live display documents.

## Roll Back Web App Files

1. Re-upload the previous stable package files from `shoutoutwepp,vers-28.88-mingl-grammar-profile-datapoints-full-package.zip`.
2. Do not upload `node_modules`.
3. Open the previous cache-busted URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.88-mingl-grammar-profile-datapoints
```

## Roll Back Firebase Rules

If the v28.89 rules were published and you need to return to the previous rule labels, publish the `firestore.rules` and `storage.rules` from the v28.88 package.

## What This Reverses

- Single-chat routing from public Mingl into Patron Portal chat.
- Mingl chat plus-button picture composer changes.
- Height `heightUnit` selection logic.
- Club admin `Reset Display to Club Default`.
- Official template `tags` search expansion.
- v28.89 diagnostics, README, and rule header labels.
