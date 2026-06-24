# Rollback Guide: Jadz AdCo ShoutOut v28.26-f

Release package:

```text
shoutoutwepp,vers-28.26-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.26-f
```

## What v28.26-f Changed

- Added a visible ShoutOut modification/reference link inside new ShoutOut submission system messages.
- Stored `shoutoutId`, `referenceNumber`, `link`, and a `Modify ShoutOut:` line in future ShoutOut submission notifications.
- Made patron portal message bodies render safe clickable links after the envelope is opened.
- Changed public profile media upload to one-slot-at-a-time preview and save.
- Added a `Save This Slot` button to each profile media slot.
- Added public profile Image Gallery rendering for saved photos and short videos.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore indexes added or removed.

No Firestore rules are included in this package.

Future ShoutOut submission notification documents may include:

```text
shoutoutId
referenceNumber
link
body with Modify ShoutOut link
```

Profile media continues to use:

```text
users/{uid}.profileMediaSlots
profileMedia/{uid}/images/...
profileMedia/{uid}/videos/...
```

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.26-f.
2. Or upload the previous known-good v28.25-nf package or stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.25-nf-rollback-test
```

Manual rollback:

1. Extract the previous known-good package.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.26-f
```

## Database / Storage Rollback

No required database migration rollback.

Optional cleanup:

1. Leave notification link fields in place, or remove them from affected `inboxNotifications` documents if desired.
2. Delete uploaded files under `profileMedia/{uid}/...` only if storage cleanup is desired.
