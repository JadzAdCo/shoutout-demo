# Rollback Guide: FLOQR ShoutOut v28.20-f

Release package:

```text
shoutoutwepp,vers-28.20-f-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.20-f
```

## What v28.20-f Changed

- Removed default `STACY` from Traditional Black & White template data and thumbnail behavior.
- Replaced the second free-text message input with optional display attribution.
- Attribution can use display name, username, or Instagram handle.
- Classic board main message is capped at 36 characters.
- Classic board text auto-wraps and auto-sizes across three physical-style rows.
- Classic board letters were enlarged and kept bold.
- AI suggestions fill the main message only.
- Bumped active cache-busting links and scripts to `v=28.20-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

This release uses existing user profile fields already saved in `users/{uid}`: `displayName`, `username`, and `instagramHandle`.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.20-f.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.19-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.19-f.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.20-f to previous package
```

Helper-script rollback prep:

```powershell
.\rollback-v28-20-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.20-f.
