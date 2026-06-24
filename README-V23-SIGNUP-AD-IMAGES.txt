FLOQR ShoutOut v23 Sign-up + Ad Image Update

Upload/replace all files in this ZIP.

New changes:
1. Ad splash pages now include images using local SVG ad assets in /ads.
2. Screen 1 remains sign in/sign up.
3. After authentication, the app checks Firestore:
   users/{auth.uid}
4. If profileCompleted is missing or false, the patron sees a sign-up profile page.
5. Sign-up profile collects:
   - Username
   - Display name
   - Country
   - State / Region / Province
   - City
   - Age range
   - Favorite genres
   - Nightlife interests
   - Instagram handle (optional)
   - X handle (optional)
   - Analytics consent
   - Marketing consent
6. Existing users skip sign-up and continue to the main category screen.

Firestore changes:
Add/update rules for users collection:

match /users/{userId} {
  allow create, read, update: if request.auth != null && request.auth.uid == userId;
}

If using the demo rules from earlier, add the users block inside match /databases/{database}/documents.

Test:
https://jadzadco.github.io/shoutout-demo/?v=23
