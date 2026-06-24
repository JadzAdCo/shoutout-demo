# Rollback Guide: FLOQR ShoutOut v28.11

Release package:

```text
jadz-shoutout-v28-11-template-preview-cleanup-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11
```

## What v28.11 Changed

- Updated ShoutOut template styling and display previews.
- Traditional Black & White now uses a tighter full-sign marquee-board direction.
- Removed display preview brand/header text and footer line.
- Added clearly labeled image/video placeholder templates.
- Added 50/50 media/text display layout.
- Added searchable template selection.
- Set Traditional Black & White as the default template.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore schema changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.11.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.10.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.11 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-11.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.11.

If live testing created test ShoutOuts, guest list requests, or uploaded media:

1. Delete only the specific test Firestore records you created.
2. Delete only matching test media under:

```text
shoutouts/{uid}/...
```

Do not delete production records or shared configuration documents.
