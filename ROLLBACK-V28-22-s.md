# Rollback Guide: FLOQR ShoutOut v28.22-s Stable

Release package:

```text
shoutoutwepp,vers-28.22-s-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.22-s
```

## What v28.22-s Means

`-s` means stable release.

This is the known-good baseline after confirming Google, Microsoft, Facebook, and SMS authentication all work.

Use this stable package as the rollback target before continuing with later fix (`-f`) or new-feature (`-nf`) releases.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

## Code Rollback To Stable

Preferred rollback:

1. Revert the later GitHub commit that introduced the problem.
2. Upload this stable package if needed.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.22-s-rollback-test
```

Manual rollback:

1. Extract `shoutoutwepp,vers-28.22-s-full-package.zip`.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback to v28.22-s stable package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-22-s.ps1 -StablePackagePath "C:\path\to\shoutoutwepp,vers-28.22-s-full-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.22-s.
