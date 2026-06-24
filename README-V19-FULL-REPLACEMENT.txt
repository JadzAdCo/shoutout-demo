FLOQR ShoutOut v19 Full Replacement Package

Upload/replace every file in this ZIP at the GitHub repository root.
Keep your existing images folder:
- images/ShoutOut-logo.png

New app logic:
1. Patron logs in.
2. Main categories screen:
   - Events
   - Clubs
   - Lounges
   - Throw a ShoutOut
3. Clubs are now location-specific.
   Example:
   - heist-houston-tx
   - heist-washington-dc
   - shoko-barcelona-spain
   - chrystie-cannes-france
4. Search filters:
   - Country
   - State / Region / Province
   - City
   - Music genre
   - Search box also searches artists, DJs, activity dates, event day/time.

Firebase / Firestore changes:
1. Run seed.html after upload.
2. New collections created/updated:
   - clubLocations
   - events
   - templates
3. Existing collections still used:
   - shoutouts
   - liveContent
4. Old clubs collection is no longer required.
5. Admin and display now use location IDs.

Key URLs:
- Patron portal:
  https://jadzadco.github.io/shoutout-demo/

- Seed database:
  https://jadzadco.github.io/shoutout-demo/seed.html

- Zebbies Garden DC Patron QR:
  https://jadzadco.github.io/shoutout-demo/?location=zebbies-garden-washington-dc

- Zebbies Garden DC Admin:
  https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc

- Zebbies Garden DC Display:
  https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc

- Shôko Barcelona Patron:
  https://jadzadco.github.io/shoutout-demo/?location=shoko-barcelona-spain

- Chrystie Cannes Patron:
  https://jadzadco.github.io/shoutout-demo/?location=chrystie-cannes-france

Firestore security rules for demo:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clubLocations/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /events/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /templates/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /shoutouts/{id} {
      allow create: if request.auth != null;
      allow read, update, delete: if request.auth != null;
    }
    match /liveContent/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
