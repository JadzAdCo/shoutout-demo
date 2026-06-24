# Rollback - FLOQR ShoutOut + Mingl v28.29-nf

Use this if the FLOQR/Mingl feature package needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.29-nf-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.28-nf-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Firebase rollback

- Firebase config: no change in v28.29-nf.
- Storage rules: no change in v28.29-nf.
- Firestore rules: no bundled rules change in v28.29-nf.
- Database migration: none required.

## Optional Firestore cleanup

If test Mingl data was created and should be removed, delete only test documents from:

```text
minglConnections
chatRooms
chatMessages
```

Do not delete production patron profiles, ShoutOuts, messages, or guest-list records.

## Test after rollback

1. Open the app with the previous package version query string.
2. Confirm sign-in still works.
3. Confirm ShoutOut search, template selection, submission, and system messages still work.
4. Confirm Patron Portal profile media still works with the existing signed-in-only Storage Rules.
