# Rollback v28.88

Package: `shoutoutwepp,vers-28.88-mingl-grammar-profile-datapoints-full-package.zip`

## What Changed

- Added editable Language Settings for `My Word List` and `My Personal Corrections`.
- Updated `Fix Grammar` so Gemini is tried first, and the only browser fallback is the patron's saved correction pairs plus protected word preservation.
- Added `Height` as a profile datapoint for signup, profile editing, public profile preview, privacy selection, and Mingl matching/search.
- Added Mingl chat background consent metadata support.
- Moved Mingl help/rules into Patron Portal > Help.
- Added Master Admin > Club Admin URLs for direct club admin/display links.
- Fixed stale default display text so each location's own ShoutOut default is used instead of a Zebbies fallback.

## Rollback Steps

1. Re-upload the previous stable package files from `shoutoutwepp,vers-28.87-mingl-chat-diagnostics-full-package.zip`.
2. Publish the previous `firestore.rules` and `storage.rules` from that package in Firebase Console if rules were changed.
3. Clear browser cache or open the app with the prior version query string:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.87-mingl-chat-diagnostics
```

## Data Notes

- v28.88 adds optional user fields only:
  - `users/{uid}.height`
  - `users/{uid}.languageSettings.personalDictionary`
  - `users/{uid}.languageSettings.personalCorrections`
- These fields are non-destructive. Rolling back the web files leaves the data in Firestore, but older pages will ignore it.
- To fully remove v28.88 data, delete those optional fields from affected `users/{uid}` documents.
