# Rollback Guide: FLOQR ShoutOut v28.14

Release package:

```text
jadz-shoutout-v28-14-classic-black-white-board-layout-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14
```

## What v28.14 Changed

- Updated Classic Black & White text rendering to use three physical board rows.
- Keeps text inside the white center board.
- Auto-breaks birthday-style text into rows such as `HAPPY / BIRTHDAY / D`.
- Added guide rails/grooves and subtle cut-out letter shadow.
- Changed frontend display rendering and CSS only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.14.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.13.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.14 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-14.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.14.
