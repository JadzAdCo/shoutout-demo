# FLOQR Rollback - v28.80 Location Template AI

Use this only if the v28.80 package causes a visible regression after upload.

Direct rollback:

1. Re-upload the previous known-good full package to the GitHub Pages repo root.
2. Hard-refresh the app with the previous package query string.
3. In Master Admin > Diagnostics, run Package Install Diagnostics and the Firebase Rules Smoke Test.
4. Confirm ShoutOut creation, media upload, Mingl, Bata scaffolding, guest lists, display rendering, and admin approval still work.

What v28.80 changed:

- Added location-aware club/event ranking helpers and cache-busted app assets.
- Removed the fictitious Heist Houston static seed/listing path and added Firestore cleanup markers.
- Enabled Gemini-ready ShoutOut copy help through Firebase Functions with curated fallback.
- Added a media remove control and kept mobile previews contained.
- Added package diagnostics for these changes.

This rollback does not remove user profile data, Firebase Auth users, ShoutOut history, Mingl records, Bata planning data, guest lists, uploaded media, or audit logs.
