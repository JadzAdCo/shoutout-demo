# FLOQR v29.09.1 Deployment

## Release scope

- Adds 32 original, non-lyrical music-inspired ShoutOut recommendations in an unapproved seed queue.
- Adds a Master Admin **Unapproved Recommendations** tab with search, status filters, character counts, rights notes, and individual approve/reject actions.
- Makes only Master Admin-approved recommendations available to patrons.
- Marks patron-submitted recommendations as pending and review-required.
- Makes all 26 published templates background-editable while keeping each layout, text geometry, media regions, animation timing, and display limits locked.
- Ensures custom backgrounds are visible behind the Classic Black and White and Zebbies football layouts.
- Hardens Firestore so template writes and recommendation moderation require Master Admin access.

## Recommendation copyright policy

The seed queue stores original FLOQR wording only. Artist and track names are editorial inspiration metadata. No song lyric passages are stored. The Wizkid group is explicitly flagged for Master Admin source-attribution confirmation because the request referred to an "Ikebe" theme rather than a confirmed track title.

## Verification

Run from the package root:

```powershell
npm.cmd test --prefix .\functions
node --check .\shared-data.js
node --check .\patron-app.js
node --check .\master-admin-app.js
node --check .\display-app.js
firebase.cmd deploy --only firestore --project shoutoutdemo-5b402
```

## Live review URLs

- Patron app: `https://jadzadco.github.io/shoutout-demo/?v=29.09.1`
- Master Admin: `https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.1`
- Zebbies display: `https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=29.09.1`

After signing into Master Admin, open **Unapproved Recommendations**. Approval writes the reviewed record to `shoutoutRecommendations` with `status: approved`; patrons will see it in the approved/trending recommendation group on their next page load.
