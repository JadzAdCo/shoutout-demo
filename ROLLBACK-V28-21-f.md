# Rollback Guide: Jadz AdCo ShoutOut v28.21-f

Release package:

```text
shoutoutwepp,vers-28.21-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.21-f
```

## What v28.21-f Changed

- Preserved emojis and special characters in Classic Black & White preview/display text.
- Changed board cleanup to remove only control characters instead of stripping symbols.
- Changed Classic Black & White wrapping/sizing to count visible Unicode characters better.
- Added emoji-capable display font fallbacks.
- Bumped active cache-busting links and scripts to `v=28.21-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.21-f.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.20-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.20-f.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.21-f to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-21-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.21-f.
