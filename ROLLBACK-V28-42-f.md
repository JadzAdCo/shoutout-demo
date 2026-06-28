# Rollback - FLOQR Migration Root Path Fix v28.42-f

Use this if the v28.42-f migration root path fix needs to be rolled back.

## App rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.42-f-full-package.zip`, or re-upload the previous known-good package.
2. Previous package:

```text
shoutoutwepp,vers-28.41-f-full-package.zip
```

## Database rollback

v28.42-f does not add or require a database migration. It only fixes the root-level migration page paths.

## Firestore Rules rollback

No Firestore Rules change is included in v28.42-f.

## Storage Rules rollback

No Storage Rules change is included in v28.42-f.
