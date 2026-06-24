# Rollback Guide: FLOQR ShoutOut v28.13

Release package:

```text
jadz-shoutout-v28-13-navigation-role-request-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13
```

## What v28.13 Changed

- Added Back navigation to the patron workflow, patron portal, and role request page.
- Removed the role request link from the public search/ShoutOut workflow.
- Kept Club Admin / DJ / Promoter access requests only in the patron portal.
- Fixed the role request form script so it matches the current form fields.
- Preserved the v28.12 avatar dropdown white-link styling.
- Changed frontend code and documentation only.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

The role request form continues writing to existing role request/profile collections. No migration is required.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.13.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.12.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.13 to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-13.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.13.
