# Rollback Guide: Jadz AdCo ShoutOut v28.24-f

Release package:

```text
shoutoutwepp,vers-28.24-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.24-f
```

## What v28.24-f Changed

- Changed SMS OTP button text from `Continue using SMS OTP` to `Continue with SMS OTP`.
- No Firebase, Firestore, Storage, or behavior changes.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.24-f.
2. Or upload the previous v28.23-nf package or stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.23-nf-rollback-test
```

Manual rollback:

1. Extract the previous known-good package.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.24-f
```

## Database / Storage Rollback

No database rollback is required for v28.24-f.
