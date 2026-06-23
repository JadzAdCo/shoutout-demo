# Rollback Guide: Jadz AdCo ShoutOut v28.17-f

Release package:

```text
shoutoutwepp,vers-28.17-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.17-f
```

## What v28.17-f Changed

- Removed duplicate generic Back button from patron workflow screens.
- Added/standardized page-specific Back buttons and workflow screen labels.
- Removed the bottom Messages / Chats / Notifications bar.
- Merged notifications into Messages.
- Consolidated the media upload/display pipeline fix and Classic Black & White board sizing refinement into one fix release.
- Enlarged the Classic Black & White white center board.
- Increased Classic Black & White text size and weight.
- Reduced excess red/black header space above the board.
- Changed frontend display CSS only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.17-f.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.16.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.17-f to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-17-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.17-f.
