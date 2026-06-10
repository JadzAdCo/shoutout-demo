# Jadz AdCo ShoutOut v23.2 Login Text Update

## Deployment

Upload/replace **all files** in this ZIP at the GitHub repository root.

Keep your existing image folder if GitHub asks:

- `images/ShoutOut-logo.png`

Then test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=23.2
```

## Changes in v23.2

### 1. Landing Page Text Update

Changed the initial login status text from:

```text
Not signed in
```

to:

```text
Please Sign-In or Sign-Up:
```

### 2. Auth Status Text Update

Changed:

```text
App loaded. Choose a sign-in option.
```

to:

```text
Choose a sign-in/up option.
```

### 3. Removed "App loaded."

The user-facing login page no longer displays the technical phrase:

```text
App loaded.
```

### 4. Cleaner Signed-In Display

After a patron signs in, the lower login status line is cleared because the top-right profile menu already shows the signed-in user status.

### 5. Cache Busting Updated

Updated script references to:

```text
?v=23.2
```

so GitHub Pages is more likely to load the latest files.

## Current Major Features Preserved

- Google / Microsoft / Facebook login
- Phone OTP login
- First-time user profile completion page
- User profile storage in Firestore `users/{uid}`
- Instagram and X handle fields
- Analytics and marketing consent fields
- Main category page:
  - Events
  - Clubs
  - Beach Clubs
  - Lounges
  - Lounge-Clubs
  - ShoutOut
- 10-second sponsored splash ad screen
- Embedded ad images in `patron-app.js`
- Club action screen:
  - Reserve a Table
  - Join Guest List
  - Pay VIP Entry
  - Pay Event Entry
  - Pay Std. Entry
- Multi-location venue model using `clubLocations`
- Admin approval workflow
- Location-specific display pages
- Xibo-compatible display page

## Firestore Rules Reminder

For v23.x, Firestore should include at least:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow create, read, update:
        if request.auth != null
        && request.auth.uid == userId;
    }

    match /clubs/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }

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
      allow read, update, delete:
        if request.auth != null;
    }

    match /liveContent/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Seeding Reminder

If records have not been seeded or if venue/event data changes, run:

```text
https://jadzadco.github.io/shoutout-demo/seed.html?v=23.2
```

## Update Policy

Future update requests should return a complete downloadable package and an updated README.md summarizing the modifications.
