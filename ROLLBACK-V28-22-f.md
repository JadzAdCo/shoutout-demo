# Rollback Guide: Jadz AdCo ShoutOut v28.22-f

Release package:

```text
shoutoutwepp,vers-28.22-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.22-f
```

## What v28.22-f Changed

- Microsoft sign-in now tries popup first.
- Microsoft sign-in falls back to full-page redirect if popup is blocked, closed, or cancelled.
- Patron, Club Admin, Master Admin, and Auth Debug now process redirect results.
- Microsoft auth error messages are clearer for common Firebase/Microsoft configuration failures.
- Bumped active cache-busting links and scripts to `v=28.22-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

If Microsoft still fails after this package, check Firebase Authentication and Microsoft Entra/Azure App Registration settings:

- Firebase Authentication > Sign-in method > Microsoft is enabled.
- Firebase Authentication > Settings > Authorized domains includes `jadzadco.github.io`.
- Microsoft App Registration has Firebase's Microsoft OAuth redirect URI configured.
- Microsoft Client ID and Client Secret in Firebase are current and correct.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.22-f.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.21-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.21-f.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.22-f to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-22-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.22-f.
