# Rollback - FLOQR Master Patron Diagnostic v28.40-nf

Use this if the v28.40-nf Master Patron Diagnostic feature needs to be rolled back.

## Code rollback

1. Revert the GitHub commit that uploaded `shoutoutwepp,vers-28.40-nf-full-package.zip`, or re-upload the previous known-good package.
2. Recommended previous package:

```text
shoutoutwepp,vers-28.39-f-full-package.zip
```

3. Stable fallback package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

## Database rollback

v28.40-nf does not add or require a database migration.

## Firestore Rules rollback

No Firestore Rules change is included in v28.40-nf.

## Storage rollback

No Storage Rules change is included in v28.40-nf.
