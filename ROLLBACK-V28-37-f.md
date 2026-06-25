# Rollback - FLOQR Authentication + ShoutOut Landing Fix v28.37-f

Use this if the v28.37-f authentication or ShoutOut landing fix needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.37-f-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.36-nf-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.37-f does not add or require a database migration.

## Firestore Rules rollback

No Firestore Rules change is included in v28.37-f.

## Storage rollback

No Storage Rules change is included in v28.37-f.

## Test after rollback

1. Open the app with the previous package version query string.
2. Confirm Google and Microsoft authentication behave as they did before v28.37-f.
3. Confirm the ShoutOut landing page returns to the previous layout.
