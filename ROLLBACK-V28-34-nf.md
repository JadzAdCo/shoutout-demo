# Rollback - FLOQR Internal Messaging + CSR v28.34-nf

Use this if the v28.34-nf Internal Messaging + CSR needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.34-nf-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.33-f-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.34-nf does not add a required database migration, but test CSR designations may create documents in `clubEmployeeDesignations` and add `designatedCSRLocations` values to test user profiles.

To remove test CSR data:

1. Delete only test documents from `clubEmployeeDesignations`.
2. Remove only test `designatedCSRLocations` values from test users.

If you ran the included v28.31-f `clubLocations` rebrand migration and need to undo that data change, use the backup JSON that the migration tool downloaded before applying writes.

To restore exact previous `clubLocations` values:

1. Open the migration page:

```text
https://jadzadco.github.io/shoutout-demo/migrations/firestore-rebrand-jadz-to-floqr-v28.31-f.html?v=28.34-nf
```

2. Sign in with an approved admin email.
3. Under `Rollback From Backup`, choose the downloaded JSON backup.
4. Click `Apply Rollback JSON`.

This restores the affected `clubLocations/{id}` documents from the backup.

## Firestore Rules rollback

v28.34-nf adds a `clubEmployeeDesignations` rules block. To roll back only this feature, publish:

```text
firestore-rules-before-v28-34-nf.txt
```

If rolling back v28.30-f rules too, publish:

```text
firestore-rules-before-v28-29-nf.txt
```

## Storage rollback

No Storage Rules change is included in v28.34-nf.

## Test after rollback

1. Open the app with the previous package version query string.
2. Confirm the message composer, CSR designation page, and Mingl matching behave as they did before v28.34-nf.
3. Confirm ShoutOut search, template selection, and submission still work.
