# FLOQR Rollback - v28.82 Mingl Privacy Media

Use this only if the v28.82 package causes a user-facing issue after upload.

## Direct Code Rollback

1. Re-upload the previous known-good package files to the GitHub Pages repo root.
2. Hard-refresh the app with the previous package query string.
3. Republish the previous `firestore.rules` only if you need to remove the v28.82 Mingl edit/audit rules.

## Data Safety

This rollback does not delete user profile data, Mingl connections, chat history, ShoutOut records, guest lists, Bata planning data, Firebase Auth users, Firebase Storage media, or diagnostics history.

## v28.82 Files Most Likely To Roll Back

- `patron-app.js`
- `patron-portal.html`
- `patron-portal-app.js`
- `floqr-action-feedback.js`
- `styles.css`
- `firestore.rules`
- `ai-diagnostics-service.js`
- `master-admin.html`
- `README.md`

## Verification After Rollback

Run Master Admin > Diagnostics > Package Install Diagnostics and Run Rules Smoke Test after publishing the rollback files/rules.
