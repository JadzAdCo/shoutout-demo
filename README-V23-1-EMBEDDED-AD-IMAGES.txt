FLOQR ShoutOut v23.1 Embedded Ad Images Fix

Fix:
- Splash ad images are embedded directly in patron-app.js as SVG data URIs.
- This avoids missing /ads folder upload issues in GitHub Pages.

Upload/replace all files in this ZIP.

Test:
https://jadzadco.github.io/shoutout-demo/?v=23.1

No Firestore/rules changes required.
