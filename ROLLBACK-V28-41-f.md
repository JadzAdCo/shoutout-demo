# Rollback - FLOQR Migration Root Fallback v28.41-f

Use this if the v28.41-f migration root fallback needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.41-f-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.40-nf-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.41-f does not add or require a database migration. It only adds root-level copies of the existing migration page and script.

## Firestore Rules rollback

No Firestore Rules change is included in v28.41-f.

## Storage rollback

No Storage Rules change is included in v28.41-f.
