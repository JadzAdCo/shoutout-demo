# FLOQR v29.09.8 Deployment

## Release scope

- **BartR** shared marketplace frontend + US seller backend in My Profile
- Contextual Back navigation (`floqr-nav.js`)
- Post-deploy standards doc + Diagnostics package `v29.09.8`
- Unified cache-bust `?v=29.09.8` on active pages
- FloqR MoR for BartR checkout (commerce functions)
- Help / action-feedback dismiss consistency; profile status on interactive pages

## Verification (local)

```powershell
npm.cmd test --prefix .\functions
```

## Deploy

```powershell
firebase.cmd deploy --only functions,firestore,storage --project shoutoutdemo-5b402
# Then publish static package to GitHub Pages main (staging copy / push)
```

## Live review URLs

- Search: `https://jadzadco.github.io/shoutout-demo/?v=29.09.8&start=search`
- BartR: `https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.8&from=search`
- Profile: `https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=29.09.8`
- Master Admin Diagnostics: `https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.8`
- Checklist: `STANDARD-AFTER-DEPLOYMENT.md` in package

After Pages updates, hard-refresh with `?v=29.09.8`.
