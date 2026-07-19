# FLOQR v29.09.9 Deployment

## Release scope

- **BartR** Search tile label **Trade by BartR**; transparent overlay hero mark on commerce
- **Ask FloqR** intent Search (`?start=intent`) — Patron Status card + FloqR logo + plain-language wish box
- **RydR** mobility landing + approved mark (#4 car/text × #7 black/yellow road); Robotaxi → Pickup simulation
- Diagnostics package + cache-bust **29.09.9**
- Wordlist: RydR + Ask FloqR

## Verification (local)

```powershell
npm.cmd test --prefix .\functions
```

## Deploy

```powershell
# 1) Commit + push workspace/v29-08
# 2) Publish static tree to GitHub Pages branch main (staging clone)
# Firebase: no functions/rules changes required for this package
```

## Live review URLs

- Classic Search: `https://jadzadco.github.io/shoutout-demo/?v=29.09.9&start=search`
- Ask FloqR: `https://jadzadco.github.io/shoutout-demo/?v=29.09.9&start=intent`
- BartR: `https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.9&from=search`
- RydR: `https://jadzadco.github.io/shoutout-demo/rydr.html?v=29.09.9&from=search`
- Diagnostics: `https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.9`

After Pages updates, hard-refresh with `?v=29.09.9`. Follow `STANDARD-AFTER-DEPLOYMENT.md`.
