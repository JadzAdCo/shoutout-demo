# Rollback Guide: Jadz AdCo ShoutOut v28.27-f

Release package:

```text
shoutoutwepp,vers-28.27-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.27-f
```

## What v28.27-f Changed

- Added `storage.rules` for Firebase Storage profile media uploads.
- Allowed signed-in users to upload only to their own `profileMedia/{uid}/images/...` and `profileMedia/{uid}/videos/...` folders.
- Kept public read access for saved public profile gallery media.
- Preserved ShoutOut media upload rules under `shoutouts/{uid}/...`.
- Improved `storage/unauthorized` upload error text in the patron portal.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules or index changes.

Firebase Storage Rules must be published separately from the web app upload.

Storage paths covered:

```text
profileMedia/{uid}/images/...
profileMedia/{uid}/videos/...
shoutouts/{uid}/...
```

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.27-f.
2. Or upload the previous known-good v28.26-f package or stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.26-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.27-f
```

## Storage Rules Rollback

If you publish the v28.27-f `storage.rules` and need to roll it back:

1. Open Firebase Console.
2. Go to Storage > Rules.
3. Use rules history, or paste the previous known-good Storage Rules.
4. Publish the previous rules.

## Database / Storage Cleanup

No database migration rollback is required.

Optional cleanup:

1. Delete test files under `profileMedia/{uid}/...`.
2. Remove test `profileMediaSlots` entries from `users/{uid}` only if desired.
