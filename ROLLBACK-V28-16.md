# Rollback Guide: Jadz AdCo ShoutOut v28.16

Release package:

```text
jadz-shoutout-v28-16-media-upload-display-pipeline-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16
```

## What v28.16 Changed

- Fixed patron media upload submit flow.
- Saves media metadata to pending ShoutOut documents.
- Copies media metadata to `liveContent` during admin approval.
- Renders uploaded image/video media on `display.html`.
- Keeps placeholder only when no media URL exists.
- Changed frontend JavaScript only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.16.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.15.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.16 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-16.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for the code change.

If needed, manually clear `mediaUrl`, `mediaType`, `mediaFileName`, `mediaStoragePath`, and `mediaUploadedAt` from a specific `liveContent/{clubLocationId}` document.
