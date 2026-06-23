# Rollback Guide: Jadz AdCo ShoutOut v28.19-f

Release package:

```text
shoutoutwepp,vers-28.19-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.19-f
```

## What v28.19-f Changed

- Left-aligned the Screen 2 `Or` divider before `Throw a ShoutOut`.
- Added device/context detection for mobile, tablet, desktop, touch, operating system, orientation, viewport, and browser language.
- Simplified template selection to show the search input and default Traditional Black & White template first.
- Made template search contextual/fuzzy.
- Made template tap/click/keyboard selection open the editor directly.
- Hid the old selected-template / continue panel.
- Made editor media upload fields appear only for templates that support media.
- Prevented text-only templates from carrying stale media fields during submission.
- Bumped active cache-busting links and scripts to `v=28.19-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.19-f.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.18-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.18-f.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.19-f to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-19-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.19-f.
