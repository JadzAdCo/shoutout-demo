Upload/replace:
- index.html
- app.js
- styles.css

IMPORTANT:
For v16, firebase-config.js must NOT use export/import.
It must use:
window.firebaseConfig = { ... };

I included firebase-config.example.js. Do not upload it as-is unless you replace the placeholder values.
Instead, edit your existing firebase-config.js to match the window.firebaseConfig format.

Then open:
https://jadzadco.github.io/shoutout-demo/?v=16

Expected:
App loaded. Choose a sign-in option.
