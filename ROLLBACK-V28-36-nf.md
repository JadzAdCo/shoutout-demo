# Rollback - FLOQR Mingl/Workers + ShoutOut Diagnostic v28.36-nf

Use this if the v28.36-nf Mingl/Workers + ShoutOut Diagnostic package needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.36-nf-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.35-nf-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.36-nf does not require a database migration.

If test worker/CSR data was created while testing:

1. Delete only test documents from `clubEmployeeDesignations`.
2. Remove only test `designatedCSRLocations`, `requestedClubLocationId`, or `requestedClubLocationIds` values from test users.

If you ran the included v28.31-f `clubLocations` rebrand migration and need to undo that data change, use the backup JSON that the migration tool downloaded before applying writes.

## Firestore Rules rollback

v28.36-nf does not add a new Firestore Rules block beyond the existing consolidated rules. If you need to remove the CSR rules introduced earlier, publish:

```text
firestore-rules-before-v28-34-nf.txt
```

If rolling back the Mingl rules too, publish:

```text
firestore-rules-before-v28-29-nf.txt
```

## Storage rollback

No Storage Rules change is included in v28.36-nf.

## Test after rollback

1. Open the app with the previous package version query string.
2. Confirm Mingl layout, Club Admin worker pages, authentication flow, and Patron Portal ShoutOut behavior return to the previous package behavior.
3. Confirm ShoutOut search, template selection, and submission still work.
