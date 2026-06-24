# Rollback Guide: FLOQR ShoutOut v28.28-nf

Release package:

```text
shoutoutwepp,vers-28.28-nf-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.28-nf
```

## What v28.28-nf Changed

- Rebranded visible app copy from `legacy brand` / `legacy brand` to `FLOQR`.
- Rebranded admin, patron, display, setup, and auth-debug visible labels.
- Rebranded location display brand strings from `x LEGACY BRAND` to `x FLOQR`.
- Rebranded visible media/ad slot labels to `FLOQR Media Slot`.
- Rebranded platform-fee/platform-share wording to `FLOQR`.
- Preserved technical deployment URLs, Firebase authorized-domain text, email domains, and internal function names.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules or index changes.

No new Storage Rules change beyond the v28.27-f consolidated signed-in profile media rules.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.28-nf.
2. Or upload the previous known-good v28.27-f package or stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.27-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.28-nf FLOQR rebrand
```

## Database / Storage Cleanup

No database or Storage cleanup is required for this rebrand.
