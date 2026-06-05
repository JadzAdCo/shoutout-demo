Upload these five files to the root of the GitHub Pages repository:
- index.html
- admin.html
- display.html
- app.js
- styles.css

Keep your existing firebase-config.js file in the same root folder.

URLs:
- User portal: https://jadzadco.github.io/shoutout-demo/?club=club-a
- Admin portal: https://jadzadco.github.io/shoutout-demo/admin.html?club=club-a
- Xibo display: https://jadzadco.github.io/shoutout-demo/display.html?club=club-a

Before testing:
1. Confirm app.js ADMIN_EMAILS contains your admin login email.
2. Confirm Firestore rules allow authenticated users to create/read shoutouts and write liveContent.
3. Confirm Firebase authorized domains includes jadzadco.github.io.
