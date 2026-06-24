# Rollback - FLOQR ShoutOut + Mingl v28.30-f

Use this if the consolidated Firestore rules or Mingl rule enforcement need to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.30-f-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.29-nf-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Firestore Rules rollback

To negate every Firestore rule added for Mingl:

1. Open Firebase Console.
2. Go to Firestore Database > Rules.
3. Replace the live rules with the contents of:

```text
firestore-rules-before-v28-29-nf.txt
```

4. Publish the rules.

This removes the added `minglConnections` rule block and restores the prior broad `chatRooms` / `chatMessages` behavior.

## Storage rollback

No Storage Rules change is included in v28.30-f. Keep the existing signed-in profile media Storage Rules unless rolling back storage separately.

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
