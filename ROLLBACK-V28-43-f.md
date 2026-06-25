# Rollback - FLOQR Upload-Friendly History Package v28.43-f

Use this if the v28.43-f upload-friendly history package needs to be rolled back.

## App rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.43-f-full-package.zip`, or re-upload the previous known-good package.
2. Previous package:

```text
shoutoutwepp,vers-28.42-f-full-package.zip
```

## Database rollback

v28.43-f does not add or require a database migration. It only changes how old README and rollback files are bundled in the release package.

## Firestore Rules rollback

No Firestore Rules change is included in v28.43-f.

## Storage Rules rollback

No Storage Rules change is included in v28.43-f.
