# Rollback Guide: FLOQR ShoutOut v28.15

Release package:

```text
jadz-shoutout-v28-15-classic-board-preview-alignment-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15
```

## What v28.15 Changed

- Fixed Classic Black & White preview text positioning.
- Kept all visible Classic Black & White text inside the white board.
- Forced subtitle text into the same three-row board renderer.
- Reduced board text size for iframe/mobile preview safety.
- Changed frontend display rendering and CSS only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.15.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.14.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.15 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-15.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.15.
