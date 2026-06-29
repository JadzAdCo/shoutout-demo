# FLOQR Rollback - v28.79 Package Hygiene

Use this rollback note only for the v28.79 package-hygiene cleanup.

## What changed

- Removed obsolete historical `README-V...` fragments from the package root.
- Removed obsolete historical `ROLLBACK-V...` and `rollback-v...ps1` files from the package root.
- Kept the live `README.md`.
- Added this single current rollback note so future full packages do not carry old package-history files.

## Direct rollback

If this cleanup causes a packaging problem, restore the previous full package ZIP before v28.79:

```text
outputs/shoutoutwepp,vers-28.78-template-media-layout-full-package.zip
```

Then upload that ZIP contents to the GitHub Pages repo root.

## Notes

This rollback does not change Firebase Auth, Firestore rules, Storage rules, ShoutOut submission, Mingl, Bata scaffolding, Gemini functions, or any user data.
