# FLOQR Rollback - v28.83 Mobile Mingl Inbox and Device Layouts

Use this only if the v28.83 package causes a user-facing issue after upload.

## Direct Code Rollback

1. Re-upload the previous known-good package files to the GitHub Pages repo root.
2. Hard-refresh the app with the previous package query string.
3. Firestore rules do not need to change for this rollback unless you also roll back before `v28.82-mingl-request-chat-rules`.

## Data Safety

This rollback does not delete user profile data, public datapoint choices, Mingl requests, Mingl chat history, ShoutOut records, guest lists, Bata planning data, Firebase Auth users, Firebase Storage media, or diagnostics history.

## v28.83 Files Most Likely To Roll Back

- `index.html`
- `patron-app.js`
- `patron-portal.html`
- `patron-portal-app.js`
- `styles.css`
- `ai-diagnostics-service.js`
- `master-admin.html`
- `README.md`

## Verification After Rollback

Run Master Admin > Diagnostics > Package Install Diagnostics and use the manual feature checklist to confirm Mingl, FLOQR Inbox, My Privacy, and mobile/tablet/PC layouts still behave as expected.
