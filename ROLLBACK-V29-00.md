# FLOQR Rollback - v29.00

Rollback target:

- Restore the previous tested package before v29.00.
- Re-publish the previous package `firestore.rules` and `storage.rules` only if you also published v29.00 rule headers and want Firebase Console comments to match the rollback package.

What v29.00 changed:

- Filtered diagnostic/demo Mingl Chat rooms from the patron-facing standalone Mingl Chat list.
- Reduced Mingl Chat startup delay by rendering direct participant rooms first and checking older Mingl connections after.
- Constrained the Mingl Chat command popout so it fits inside the selected chat window.
- Added Package Install Diagnostics archive controls, visible archive status, and CSV export.
- Updated README, cache-bust strings, and rules headers to v29.00.

Rollback steps:

1. Upload the previous full package ZIP to the GitHub Pages repo root.
2. Replace all files from the previous package, including HTML, scripts, styles, assets, README, and rollback note.
3. If Firebase rules were updated during this release, publish the previous package `firestore.rules` and `storage.rules`.
4. Hard refresh the live site with the previous package version query string.
5. Confirm Sign-In, ShoutOut flow, Mingl Chat, Master Admin Diagnostics, and display pages open.

Data note:

This rollback does not delete user profile data, Mingl chats, ShoutOuts, uploaded media, inbox messages, ad analytics history, or Firestore/Storage content. It only restores web app files and optional Firebase rules text.
