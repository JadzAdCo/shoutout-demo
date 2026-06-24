# Rollback Guide: FLOQR ShoutOut v28.23-nf

Release package:

```text
shoutoutwepp,vers-28.23-nf-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.23-nf
```

## What v28.23-nf Changed

- Added the `Continue using SMS OTP` button to the login screen.
- Changed SMS prompt text to `Or use One Time Password (OTP) via SMS`.
- Hid the SMS OTP phone form until the SMS OTP button is selected.
- Added a country code dropdown and separate phone number input.
- Combined selected country code and local number before calling Firebase SMS authentication.
- Kept `v28.22-s` as the stable rollback baseline.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required.

Existing Firebase SMS Authentication and reCAPTCHA configuration are reused.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.23-nf.
2. Or upload the stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.22-s-rollback-test
```

Manual rollback:

1. Extract `shoutoutwepp,vers-28.22-s-full-package.zip`.
2. Upload the stable package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.23-nf to v28.22-s stable
```

Helper-script rollback prep:

```powershell
.\rollback-v28-23-nf.ps1 -StablePackagePath "C:\path\to\shoutoutwepp,vers-28.22-s-full-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script only prepares a folder for upload. It does not modify GitHub, Firestore, or Storage.

## Database / Storage Rollback

No database rollback is required for v28.23-nf.
