# Rollback - FLOQR Product Logo Hierarchy Fix v28.38-f

Use this if the v28.38-f product logo hierarchy fix needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.38-f-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.37-f-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.38-f does not add or require a database migration.

## Firestore Rules rollback

No Firestore Rules change is included in v28.38-f.

## Storage rollback

No Storage Rules change is included in v28.38-f.
