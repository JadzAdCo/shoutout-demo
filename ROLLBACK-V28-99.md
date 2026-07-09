# FLOQR Rollback - v28.99

Rollback target:

- Restore the previous tested package before v28.99.
- Re-publish the previous package `firestore.rules` and `storage.rules` only if you also published v28.99 rule headers and want the console labels to match the rollback package.

What v28.99 changed:

- Added targeted ad campaign registry and Master Admin ad campaign management.
- Added Cuisine Bantu, Puff Club, and Lima DC demo ad campaigns with media, copy, Canva references, target tags, campaign datapoints, and analytics metadata.
- Routed ShoutOut and club action splash ads through patron datapoint targeting.
- Fixed the ShoutOut landing logo to use `images/shoutout-logo.png`.
- Added manual diagnostics archive controls and crawl contact CSV/export controls.

Rollback steps:

1. Upload the previous full package ZIP to the GitHub Pages repo root.
2. Replace all files from the previous package, including `index.html`, admin pages, scripts, styles, and assets.
3. If Firebase rules were changed during this release, publish the previous package `firestore.rules` and `storage.rules`.
4. Hard refresh the live site with the previous package version query string.
5. Confirm Sign-In, ShoutOut flow, Mingl, Admin, Master Admin diagnostics, and display pages open.

Data note:

This rollback does not delete user profiles, ShoutOuts, Mingl chats, uploaded media, inbox messages, ad analytics records, or Firestore/Storage content. It only restores the web app files and optional Firebase rules text.
