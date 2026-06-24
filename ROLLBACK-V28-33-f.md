# Rollback - FLOQR Welcome Copy Fix v28.33-f

Use this if the v28.33-f welcome copy fix needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.33-f-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.32-f-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.33-f does not add a new database migration. If you ran the included v28.31-f `clubLocations` rebrand migration and need to undo that data change, use the backup JSON that the migration tool downloaded before applying writes.

To restore exact previous `clubLocations` values:

1. Open the migration page:

```text
https://jadzadco.github.io/shoutout-demo/migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html?v=28.33-f
```

2. Sign in with an approved admin email.
3. Under `Rollback From Backup`, choose the downloaded JSON backup.
4. Click `Apply Rollback JSON`.

This restores the affected `clubLocations/{id}` documents from the backup.

## Firestore Rules rollback

No new Firestore Rules change is included in v28.33-f. If rolling back v28.30-f rules too, publish:

```text
firestore-rules-before-v28-29-nf.txt
```

## Storage rollback

No Storage Rules change is included in v28.33-f.

## Test after rollback

1. Open the app with the previous package version query string.
2. Confirm the welcome page description behaves as it did before v28.33-f.
3. Confirm ShoutOut search, template selection, and submission still work.
