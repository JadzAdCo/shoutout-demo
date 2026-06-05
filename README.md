# Jadz AdCo ShoutOut Demo v2

Pages:
- `index.html` - Client portal
- `admin.html` - Admin approval queue
- `display.html` - Clean Xibo display URL

Example URLs:
- Client: `https://jadzadco.github.io/shoutout-demo/?club=club-a`
- Admin: `https://jadzadco.github.io/shoutout-demo/admin.html?club=club-a`
- Xibo Webpage Widget: `https://jadzadco.github.io/shoutout-demo/display.html?club=club-a`

Admin demo password: `admin123`

This free static demo uses browser localStorage. It is good for demoing the UI/flow in one browser/device. For real multi-device dynamic operation, use Firebase/Supabase free tier, Cloudflare Pages + KV/D1, or Azure Static Web Apps + Functions.

**Version 2 Changes**

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

**Version 3 Changes**

5. Upload/replace:
- index.html
- app.js
- styles.css

Keep:
- firebase-config.js
- admin.html
- display.html
- seed.html

New patron flow:
1. Login
2. Club discovery
3. Template selection
4. ShoutOut editor with preview
5. Confirmation / reference number


