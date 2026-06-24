# Rollback Guide: FLOQR ShoutOut v28.12

Release package:

```text
jadz-shoutout-v28-12-avatar-dropdown-link-color-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12
```

## What v28.12 Changed

- Fixed avatar/user dropdown links so they remain white across link states.
- Covered normal, link, visited, hover, active, and focus states.
- Changed frontend CSS only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore schema changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.12.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.11.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.12 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-12.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.12.
