
# Codex Handoff Brief — Jadz AdCo ShoutOut Demo Web App

Version represented by this handoff: **v28.8**  
Source package: `jadz-shoutout-v28-8-hardcoded-shoutout-button-fix.zip`  
Generated: 2026-06-23T03:26:40

---

## 1. Project overview

### What the app does

This is a prototype web app for **Jadz AdCo ShoutOut**, a nightlife / entertainment / DOOH product. Patrons can sign in, search/select nightlife venues, submit “ShoutOuts” for LED/Xibo display, join guest lists, upload media, and manage a patron portal. Club admins, promoters, DJs, and master admins have separate admin concepts/portals in progress.

Public deployment:

```text
https://jadzadco.github.io/shoutout-demo/
```

The app stores state in Firebase using Auth, Firestore, and Storage.

### Main user flows

1. Patron sign-in through `index.html`.
2. Category/venue selection from hardcoded data in `shared-data.js`.
3. Club service selection: Throw a ShoutOut, Reserve a Table, Join Guest List, Pay VIP Entry, Pay Event Entry, Pay Std. Entry.
4. ShoutOut submission: choose template, enter text/subtext, upload photo/video, preview, submit to Firestore.
5. Guest list submission via `guest-list.html?location=<clubLocationId>`.
6. Patron portal via `patron-portal.html`.
7. Role request via `role-request.html`.
8. Admin portals: `admin.html`, `master-admin.html`, `promoter-admin.html`.
9. Xibo HTML display via `display.html`.

### Current status

Works / partially works:
- Static GitHub Pages deployment model.
- Google Firebase Auth in patron flow.
- Firestore reads/writes using Firebase compat SDK.
- Guest list direct page.
- Patron portal and editable profile foundation.
- Role request page.
- Firebase Storage upload foundation.
- Media preview patch.
- v28.8 attempts to force ShoutOut button into club options screen.

Incomplete:
- Full chat.
- End-to-end encryption.
- True AI crawling/recommendation backend.
- Club Master Admin approval workflow.
- Full pending ShoutOut edit/cancel/duplicate.
- Production-grade security rules.
- Automated tests.

Broken/high risk:
- Club options screen did not show `Throw a ShoutOut` before v28.8.
- `patron-app.js` has accumulated many appended override patches.
- No build/test pipeline.
- Some routing depends on DOM text matching and global patching.
- Firestore rules are too permissive for production.

### Important product goals / constraints

- Never translate `ShoutOut`.
- All users start as Patron.
- Elevated roles requested from profile/role request: Club Admin, DJ, Promoter.
- Each club should have two Club Master Admins.
- Every club view must include `Throw a ShoutOut`.
- Club services should be location-specific.
- ShoutOut confirmations go to internal inbox, not conventional email.
- Xibo consumes HTML, so use normal HTML media rendering.

---

## 2. Tech stack

- Frontend framework: none.
- App type: static HTML/CSS/JavaScript.
- JavaScript style: browser IIFEs.
- Firebase SDK: `10.12.5` compat CDN scripts.
- Package manager: none / unknown.
- `package.json`: not present.
- Firebase: Auth, Firestore, Storage.
- Cloud Functions: none.
- Hosting: GitHub Pages.
- Emulator: none configured.

---

## 3. Repository and file structure

GitHub repo:

```text
https://github.com/jadzadco/shoutout-demo
```

Local folder path: unknown.

Current package file list:

```text
README-V19-FULL-REPLACEMENT.txt
README-V20-FULL-REPLACEMENT.txt
README-V22-FIXES.txt
README-V23-1-EMBEDDED-AD-IMAGES.txt
README-V23-SIGNUP-AD-IMAGES.txt
README.md
admin-app.js
admin.css
admin.html
ads/advertise-here.svg
ads/gran-coramino.svg
ads/gucci-fragrance.svg
ads/nike-airmax.svg
ads/teremana.svg
auth-debug.html
auth-debug.js
display-app.js
display.css
display.html
firebase-config.js
guest-list-app.js
guest-list.html
index.html
master-admin-app.js
master-admin.html
notification-center.js
patron-app.js
patron-portal-app.js
patron-portal.html
promoter-admin-app.js
promoter-admin.html
role-request-app.js
role-request.html
seed-app.js
seed.html
shared-data.js
styles.css
translation-policy.html
```

Key entry points:
- `index.html` / `patron-app.js`
- `shared-data.js`
- `guest-list.html` / `guest-list-app.js`
- `patron-portal.html` / `patron-portal-app.js`
- `admin.html` / `admin-app.js`
- `master-admin.html` / `master-admin-app.js`
- `promoter-admin.html` / `promoter-admin-app.js`
- `role-request.html` / `role-request-app.js`
- `display.html` / `display-app.js`
- `notification-center.js`
- `firebase-config.js`
- `styles.css`, `admin.css`, `display.css`

Environment variables currently: none.

Recommended future `.env`:
```text
VITE_FIREBASE_API_KEY=<FIREBASE_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=<FIREBASE_AUTH_DOMAIN>
VITE_FIREBASE_PROJECT_ID=<FIREBASE_PROJECT_ID>
VITE_FIREBASE_STORAGE_BUCKET=<FIREBASE_STORAGE_BUCKET>
VITE_FIREBASE_MESSAGING_SENDER_ID=<FIREBASE_MESSAGING_SENDER_ID>
VITE_FIREBASE_APP_ID=<FIREBASE_APP_ID>
VITE_FIREBASE_MEASUREMENT_ID=<FIREBASE_MEASUREMENT_ID>
```

---

## 4. Firebase and Firestore architecture

Firebase project:
```text
projectId: shoutoutdemo-5b402
storageBucket: shoutoutdemo-5b402.firebasestorage.app
```

Firestore collections known/expected:
```text
users
clubs
clubLocations
events
templates
shoutouts
liveContent
guestListRequests
messages
chatRooms
chatMessages
inboxNotifications
privacyConsents
friendRequests
friendships
notifications
roleRequests
patronRanks
approvedShoutOutLibrary
translationSettings
djProfiles
promoterProfiles
shoutoutRecommendations
shoutoutAudit
pendingAiEvents
pendingAiClubs
deviceLogs
promoterPayoutRules
promoterPayouts
```

Example `users/{uid}`:
```json
{
  "uid": "abc123",
  "email": "patron@example.com",
  "displayName": "Demo Patron",
  "firstName": "Demo",
  "lastName": "Patron",
  "fullName": "Demo Patron",
  "phone": "+15555550123",
  "city": "Washington",
  "country": "United States",
  "preferredLanguage": "en",
  "memberLevel": "Patron",
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

Example `clubLocations/{locationId}`:
```json
{
  "id": "zebbies-garden-washington-dc",
  "locationName": "Zebbies Garden DC",
  "city": "Washington",
  "state": "District of Columbia",
  "country": "United States",
  "category": "Club",
  "genres": ["Hip Hop", "Afro Beats", "EDM", "International"],
  "services": ["shoutout", "guestList", "vipReservation", "stdEntry"]
}
```

Example `shoutouts/{id}`:
```json
{
  "referenceNumber": "SO-2026-0001",
  "submittedByUid": "abc123",
  "submittedByEmail": "patron@example.com",
  "clubLocationId": "zebbies-garden-washington-dc",
  "locationName": "Zebbies Garden DC",
  "templateId": "classic-black-white",
  "mainText": "HAPPY BIRTHDAY STACY",
  "subText": "VIP TABLE 7",
  "mediaUrl": "https://firebasestorage.googleapis.com/...",
  "mediaType": "image",
  "status": "pending",
  "submittedAt": "<serverTimestamp>"
}
```

Example `guestListRequests/{id}`:
```json
{
  "type": "guestList",
  "status": "pending",
  "clubLocationId": "zebbies-garden-washington-dc",
  "locationName": "Zebbies Garden DC",
  "eventOrDay": "Friday",
  "promoterId": "zebbies-street-team",
  "promoterName": "Zebbies Street Team",
  "firstName": "Demo",
  "lastName": "Patron",
  "fullName": "Demo Patron",
  "legalNameConfirmed": true,
  "partySize": 3,
  "additionalGuests": [
    {"firstName": "Guest", "lastName": "One", "fullName": "Guest One"}
  ],
  "submittedByUid": "abc123",
  "submittedByEmail": "patron@example.com",
  "submittedAt": "<serverTimestamp>"
}
```

Example `roleRequests/{id}`:
```json
{
  "uid": "abc123",
  "email": "dj@example.com",
  "roleType": "dj",
  "publicName": "DJ Demo",
  "clubsOrEvents": "Zebbies Garden DC, Shoko Barcelona",
  "link": "https://instagram.com/djdemo",
  "status": "pending",
  "createdAt": "<serverTimestamp>"
}
```

Storage path:
```text
shoutouts/{userId}/{fileName}
```

Recommended Storage rules:
```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /shoutouts/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 30 * 1024 * 1024
        && (
          request.resource.contentType.matches('image/.*') ||
          request.resource.contentType.matches('video/.*')
        );
    }
  }
}
```

Known Firestore index needed from prior error:
```text
collection: shoutouts
fields:
  clubLocationId ASC
  status ASC
  submittedAt DESC
```

---

## 5. Code handoff

Important source files are included below. `firebase-config.js` is sanitized.


### `index.html`

```html
<!doctype html>
<html lang="en">
<head>
  <!-- Jadz AdCo ShoutOut Patron Portal v19 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>ShoutOut App</title>
  <link rel="stylesheet" href="./styles.css"/>
</head>
<body>

<div id="userMenu" class="user-menu">
  <button id="userMenuBtn" class="user-menu-btn" type="button" aria-label="User menu">
    <img id="userPhoto" class="user-photo hidden" alt="User profile"/>
    <span id="userInitials" class="user-initials">?</span>
    <span class="user-dots">⋮</span>
  </button>
  <div id="userDropdown" class="user-dropdown hidden">
    <div class="user-dropdown-row">
      <img id="dropdownUserPhoto" class="dropdown-user-photo hidden" alt="User profile"/>
      <div>
        <strong id="dropdownUserName">Not signed in</strong>
        <p id="dropdownUserEmail">Guest</p>
      </div>
    </div>
    <button id="dropdownSignOutBtn" class="ghost full" type="button">Sign out</button>
  </div>
</div>

<main class="app">
  <section id="landingPage" class="page active">
    <div class="login-wrap">
      <div class="login-card">
        <img src="./images/ShoutOut-logo.png" alt="ShoutOut" class="hero-logo"/>
        <h2>Welcome</h2>
        <p class="login-copy">Search and book entertainment and nightlife events or send a live ShoutOut to one of our ShoutOut displays.</p>
        <p id="signedInAs" class="status">Please Sign-In or Sign-Up:</p>

        <div id="signedInActions" class="hidden">
          <button id="continueBtn" class="primary full" type="button">Continue</button>
          <button id="logoutBtn1" class="ghost full" type="button">Sign out</button>
        </div>

        <div id="loginActions">
          <button id="googleLoginBtn" class="signin google" type="button">
            <span class="icon google-icon">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            </span>
            Continue with Google
          </button>
          <button id="microsoftLoginBtn" class="signin microsoft" type="button"><span class="icon ms-icon"><i></i><i></i><i></i><i></i></span>Continue with Microsoft</button>
          <button id="facebookLoginBtn" class="signin facebook" type="button"><span class="icon fb-icon">f</span>Continue with Facebook</button>

          <div class="divider"><span>or use phone</span></div>
          <div class="phone-row">
            <input id="phoneNumber" placeholder="Enter phone #" autocomplete="tel"/>
            <button id="sendOtpBtn" class="signin phone" type="button">Send OTP</button>
          </div>
          <div id="recaptcha-container"></div>
          <div id="phoneCodeBlock" class="hidden">
            <label class="compact-label">Verification code<input id="phoneCode" placeholder="123456" autocomplete="one-time-code"/></label>
            <button id="verifyOtpBtn" class="signin phone verify" type="button">Verify OTP</button>
          </div>
        </div>
        <p id="authStatus" class="status">Choose a sign-in/up option.</p>
        <p class="sub small"><a href="./?v=28.8">My Patron Portal</a></p>
      </div>
    </div>
  </section>


  <section id="signupProfilePage" class="page">
    <header class="topbar">
      <div>
        <p class="eyebrow">Complete Sign Up</p>
        <h1>Create your profile</h1>
        <p class="sub">Help personalize nightlife discovery, ShoutOuts, events, and future recommendations. Optional fields can be skipped.</p>
      </div>
    </header>

    <div class="card profile-card">
      <div class="profile-grid">
        <label>Username *
          <input id="profileUsername" maxlength="28" placeholder="Choose a username"/>
        </label>
        <label>Display name
          <input id="profileDisplayName" maxlength="60" placeholder="Your display name"/>
        </label>
        <label>Country
          <input id="profileCountry" placeholder="United States"/>
        </label>
        <label>State / Region / Province
          <input id="profileRegion" placeholder="District of Columbia"/>
        </label>
        <label>City
          <input id="profileCity" placeholder="Washington"/>
        </label>
        <label>Age range
          <select id="profileAgeRange">
            <option value="">Prefer not to say</option>
            <option value="18-20">18-20</option>
            <option value="21-24">21-24</option>
            <option value="25-34">25-34</option>
            <option value="35-44">35-44</option>
            <option value="45+">45+</option>
          </select>
        </label>
        <label>Favorite music genres
          <input id="profileGenres" placeholder="Hip Hop, Afro House, EDM"/>
        </label>
        <label>Nightlife interests
          <input id="profileInterests" placeholder="Clubs, Lounges, Beach Clubs, Events"/>
        </label>
        <label>Instagram handle (optional)
          <input id="profileInstagram" placeholder="@yourhandle"/>
        </label>
        <label>X handle (optional)
          <input id="profileX" placeholder="@yourhandle"/>
        </label>
      </div>

      <label class="consent-line">
        <input id="profileAnalyticsConsent" type="checkbox"/>
        I agree that Jadz AdCo may use my activity in aggregate analytics to improve recommendations, venue insights, and advertising performance.
      </label>

      <label class="consent-line">
        <input id="profileMarketingConsent" type="checkbox"/>
        I want to receive nightlife offers, event promotions, and venue recommendations.
      </label>

      <button id="saveProfileBtn" class="primary" type="button">Continue</button>
      <p id="profileStatus" class="status"></p>
    </div>
  </section>

  <section id="categoryPage" class="page">
    <header class="topbar">
      <div>
        <p class="eyebrow">Screen 2 — Main Categories</p>
        <p class="sub category-sentence">
          <strong>Search for</strong>
          <button id="eventsBtn" class="linklike" type="button">Events</button>,
          <button id="clubsBtn" class="linklike" type="button">Clubs</button>,
          <button id="beachClubsBtn" class="linklike" type="button">Beach Clubs</button>,
          <button id="loungesBtn" class="linklike" type="button">Lounges</button>, and
          <button id="loungeClubBtn" class="linklike" type="button">Lounge-Clubs</button>.
          <br/>
          <strong>Or throw a</strong>
          <button id="shoutoutBtn" class="linklike hot" type="button">ShoutOut</button>.
        </p>
      </div>
      <button id="logoutBtn2" type="button">Sign out</button>
    </header>

    <div class="category-grid compact-category-grid">
      <button id="eventsBtnCard" class="category-card" type="button">Events</button>
      <button id="clubsBtnCard" class="category-card" type="button">Clubs</button>
      <button id="beachClubsBtnCard" class="category-card" type="button">Beach Clubs</button>
      <button id="loungesBtnCard" class="category-card" type="button">Lounges</button>
      <button id="loungeClubBtnCard" class="category-card" type="button">Lounge-Clubs</button>
      <button id="shoutoutBtnCard" class="category-card hot" type="button">Throw a ShoutOut</button>
    </div>
  </section>

  <section id="clubActionsPage" class="page">
    <header class="topbar">
      <div>
        <button id="backToCategoriesFromActionsBtn" type="button">← Back to categories</button>
        <p class="eyebrow">Club Options</p>
        <h1>What would you like to do?</h1>
        <p class="sub">Choose a club action, then select the exact location.</p>
      </div>
      <button id="logoutBtnClubActions" type="button">Sign out</button>
    </header>
    <div class="category-grid">
      <button id="reserveTableBtn" class="category-card" type="button">Reserve a Table</button>
      <button id="joinGuestListBtn" class="category-card" type="button">Join Guest List</button>
      <button id="payVipEntryBtn" class="category-card hot" type="button">Pay VIP Entry</button>
      <button id="payEventEntryBtn" class="category-card" type="button">Pay Event Entry</button>
      <button id="payStdEntryBtn" class="category-card" type="button">Pay Std. Entry</button>
    </div>
  </section>


  <section id="adSplashPage" class="page">
    <div class="splash-wrap">
      <div class="splash-card">
        <p class="eyebrow">Sponsored</p>
        <div id="adImageSlot" class="ad-image-slot"></div>
        <h1 id="adTitle">Advertise Here</h1>
        <p id="adBody" class="sub">Your brand can own this moment before patrons browse nightlife.</p>
        <div id="adBadge" class="ad-badge">Jadz AdCo Media Slot</div>
        <p class="splash-countdown">Continuing in <span id="adCountdown">10</span> seconds...</p>
        <button id="skipAdBtn" class="ghost" type="button">Skip</button>
      </div>
    </div>
  </section>

  <section id="listingPage" class="page">
    <input type="hidden" id="listingType" value="clubs"/>
    <header class="topbar">
      <div>
        <button id="backToCategoriesBtn" type="button">← Back to categories</button>
        <p class="eyebrow">Search</p>
        <h1 id="listingTitle">Search Clubs</h1>
        <p id="listingIntro" class="sub">Search by country, state/region/province, city, genre, artist, or activity date.</p>
      </div>
      <button id="logoutBtn3" type="button">Sign out</button>
    </header>
    <div class="card">
      <input id="locationSearch" class="search" placeholder="Search location, city, genre, artist, event day..."/>
      <div class="filters">
        <label>Country<select id="countryFilter"><option value="">All countries</option></select></label>
        <label>State / Region / Province<select id="regionFilter"><option value="">All states / regions</option></select></label>
        <label>City<select id="cityFilter"><option value="">All cities</option></select></label>
        <label>Music genre<select id="genreFilter"><option value="">All genres</option></select></label>
      </div>
    </div>
    <div id="locationGrid" class="club-grid"></div>
  </section>

  <section id="templateSelectPage" class="page">
    <header class="topbar">
      <div>
        <button id="backToListingBtn" type="button">← Back to search</button>
        <p class="eyebrow">Screen 4 — Choose template</p>
        <h1 id="selectedClubTitle">Location</h1>
        <p id="selectedClubMeta" class="sub"></p>
      </div>
      <button id="logoutBtn4" type="button">Sign out</button>
    </header>
    <div class="template-layout">
      <div class="card"><h2>Available templates</h2><p class="sub small">Shared Jadz AdCo templates and location-specific templates appear here.</p><div id="templateGrid" class="template-grid"></div></div>
      <div class="card"><h2>Selected template</h2><div id="selectedTemplateSummary" class="selected-summary">Choose a template to continue.</div><button id="goToEditorBtn" class="primary" type="button">Continue to Editor</button></div>
    </div>
  </section>

  <section id="editorPage" class="page">
    <header class="topbar">
      <div><button id="backToTemplatesBtn" type="button">← Back to templates</button><p class="eyebrow">Screen 5 — Create ShoutOut</p><h1 id="editorClubTitle">Create your message</h1><p id="editorTemplateMeta" class="sub"></p></div>
      <button id="logoutBtn5" type="button">Sign out</button>
    </header>
    <div class="composer">
      <div class="card">
        <h2>Message</h2>
        <label>Main message<input id="mainText" maxlength="48" value="HAPPY BIRTHDAY MAYA!"/></label>
        <label>Sub message<input id="subText" maxlength="80" value="VIP Table 4 sends love"/></label>
        <label>Upload Photo<input id="shoutoutPhoto" type="file" accept="image/jpeg,image/png,image/webp"/></label>
        <input id="mediaUrl" type="hidden"/>
        <p id="uploadStatus" class="status"></p>
        <div class="button-row">
          <button id="aiSuggestBtn" type="button">AI Suggest ShoutOut</button>
          <button id="pastShoutoutsBtn" type="button">Use Past ShoutOut</button>
        </div>
        <div id="shoutoutSuggestionBox" class="selected-summary hidden"></div>
        <button id="submitShoutoutBtn" class="primary" type="button">Submit for Approval</button>
        <p id="submitStatus" class="status"></p>
      </div>
      <div class="card preview"><h2>Live Preview</h2><iframe id="previewFrame"></iframe></div>
    </div>
  </section>

  <section id="confirmationPage" class="page">
    <div class="confirmation card">
      <p class="eyebrow">Confirmation</p><h1>ShoutOut submitted</h1><p class="sub">Your message has been sent to the location approval queue.</p>
      <div class="receipt"><p><strong>Reference:</strong> <span id="confirmRef">—</span></p><p><strong>Location:</strong> <span id="confirmClub">—</span></p><p><strong>Template:</strong> <span id="confirmTemplate">—</span></p><p><strong>Status:</strong> Pending Location Approval</p></div>
      <div class="button-row"><button id="startAnotherBtn" class="primary" type="button">Create another ShoutOut</button><button id="chooseAnotherClubBtn" type="button">Choose another location</button><button id="logoutBtn6" type="button">Sign out</button></div>
    </div>
  </section>
<p class="sub small"><a href="./role-request.html?v=28.8">Request Club Admin / DJ / Promoter Access</a></p>
</main>

<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./patron-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body>
</html>

```

### `patron-app.js`

```javascript
/* patron-app.js v28.4 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const setStatus = value => setText("authStatus", value);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const unique = items => [...new Set(items.filter(Boolean))].sort();

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;

  let currentUser = null;
  let selectedLocationId = null;
  let selectedTemplate = "neon";
  let confirmationResult = null;
  let locations = {};
  let templates = {};
  let events = {};
  let pendingDirectLocation = qs("location", qs("club", ""));

  function locationId() { return (selectedLocationId || pendingDirectLocation || "zebbies-garden-washington-dc").toLowerCase(); }
  function getLocation(id = locationId()) { return locations[id] || window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"]; }
  function getTemplate(id = selectedTemplate) { return templates[id] || window.SHOUTOUT_TEMPLATES[id] || window.SHOUTOUT_TEMPLATES.neon; }
  function safeUser() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
  function showPage(id) { document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); byId(id)?.classList.add("active"); }
  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function getInitials(user) {
    const name = user?.displayName || user?.email || user?.phoneNumber || "Guest";
    return name.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join("") || "?";
  }

  function updateUserMenu(user) {
    const photoURL = user?.photoURL || "";
    const displayName = user?.displayName || user?.email || user?.phoneNumber || "Please Sign-In or Sign-Up:";
    const email = user?.email || user?.phoneNumber || "Guest";
    const userPhoto = byId("userPhoto");
    const dropdownPhoto = byId("dropdownUserPhoto");
    const initials = byId("userInitials");

    if (userPhoto) {
      userPhoto.src = photoURL || "";
      userPhoto.classList.toggle("hidden", !photoURL);
    }
    if (dropdownPhoto) {
      dropdownPhoto.src = photoURL || "";
      dropdownPhoto.classList.toggle("hidden", !photoURL);
    }
    if (initials) {
      initials.textContent = user ? getInitials(user) : "?";
      initials.classList.toggle("hidden", !!photoURL);
    }
    setText("dropdownUserName", displayName);
    setText("dropdownUserEmail", email);
  }

  function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    byId("userDropdown")?.classList.toggle("hidden");
  }

  function closeUserDropdownOnOutsideClick(event) {
    const menu = byId("userMenu");
    if (menu && !menu.contains(event.target)) byId("userDropdown")?.classList.add("hidden");
  }

  const AD_CONTENT = {
    "lounge-club": { title: "Gran Coramino Tequila", body: "A smooth premium tequila experience associated with Kevin Hart. Perfect for a Lounge-Club moment.", badge: "Sponsored Lounge-Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGRAN%20CORAMINO%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "clubs": { title: "Gucci Fragrances", body: "Luxury fragrance energy for a night out. Own the room before the first song drops.", badge: "Sponsored Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ffd45a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ff64d8%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ffd45a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGUCCI%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EFRAGRANCES%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "events": { title: "Nike Air Max", body: "Step into the night with Nike energy. Built for movement, style, and the next event.", badge: "Sponsored Event Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2362eaff%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ENIKE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EAIR%20MAX%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "lounges": { title: "Teremana Tequila", body: "Dwayne Johnson's tequila brand brings a premium toast to the lounge experience.", badge: "Sponsored Lounge Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23dfff5a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ETEREMANA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "beach-clubs": { title: "Advertise Here", body: "Beach club audiences are premium, social, and ready to discover your brand.", badge: "Beach Club Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "shoutout": { title: "Advertise Here", body: "Put your brand in front of patrons right before they create a live LED ShoutOut.", badge: "ShoutOut Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "default": { title: "Advertise Here", body: "Your brand can own this moment before patrons browse nightlife.", badge: "Jadz AdCo Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" }
  };

  let pendingCategoryAfterAd = null;
  let adTimer = null;

  function showAdSplash(type, nextFn) {
    pendingCategoryAfterAd = nextFn;
    const ad = AD_CONTENT[type] || AD_CONTENT.default;
    setText("adTitle", ad.title);
    setText("adBody", ad.body);
    setText("adBadge", ad.badge);
    const adImageSlot = byId("adImageSlot");
    if (adImageSlot) {
      adImageSlot.innerHTML = `<img src="${ad.image || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20Jadz%20AdCo%20Media%20Slot%3C/text%3E%0A%3C/svg%3E'}" alt="${ad.title} advertisement">`;
    }
    let remaining = 10;
    setText("adCountdown", String(remaining));
    showPage("adSplashPage");
    clearInterval(adTimer);
    adTimer = setInterval(() => {
      remaining -= 1;
      setText("adCountdown", String(Math.max(remaining, 0)));
      if (remaining <= 0) {
        clearInterval(adTimer);
        const fn = pendingCategoryAfterAd;
        pendingCategoryAfterAd = null;
        if (typeof fn === "function") fn();
      }
    }, 1000);
  }

  function skipAdSplash() {
    clearInterval(adTimer);
    const fn = pendingCategoryAfterAd;
    pendingCategoryAfterAd = null;
    if (typeof fn === "function") fn();
  }


  async function loadTemplates() {
    templates = {...window.SHOUTOUT_TEMPLATES};
    try { const snap = await db.collection("templates").get(); snap.forEach(doc => templates[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
  }
  async function loadLocations() {
    locations = {};
    try { const snap = await db.collection("clubLocations").where("active","==",true).orderBy("locationName","asc").get(); snap.forEach(doc => locations[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
    if (Object.keys(locations).length === 0) locations = {...window.SHOUTOUT_CLUB_LOCATIONS};
  }
  async function loadEvents() {
    events = {...(window.SHOUTOUT_EVENTS || {})};
    try { const snap = await db.collection("events").where("active","==",true).get(); snap.forEach(doc => events[doc.id] = {id:doc.id, ...doc.data()}); } catch(e) {}
  }
  async function loadLocationById(id) {
    if (locations[id]) return locations[id];
    try { const doc = await db.collection("clubLocations").doc(id).get(); if (doc.exists) { locations[id] = {id:doc.id, ...doc.data()}; return locations[id]; }} catch(e) {}
    return window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  }

  function updateLoginUI(user) {
    setText("signedInAs", user ? "" : "Please Sign-In or Sign-Up:");
    byId("signedInActions")?.classList.toggle("hidden", !user);
    byId("loginActions")?.classList.toggle("hidden", !!user);
    updateUserMenu(user);
  }

  
  async function getUserProfile() {
    if (!currentUser) return null;
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      return doc.exists ? doc.data() : null;
    } catch (e) {
      console.warn("Could not read user profile:", e.message);
      return null;
    }
  }

  function prefillSignupProfile() {
    if (!currentUser) return;
    const displayName = currentUser.displayName || "";
    const emailName = (currentUser.email || "").split("@")[0] || "";
    const cleanName = (displayName || emailName || "patron").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);

    if (byId("profileUsername") && !byId("profileUsername").value) byId("profileUsername").value = cleanName;
    if (byId("profileDisplayName") && !byId("profileDisplayName").value) byId("profileDisplayName").value = displayName;
  }

  function showSignupProfile() {
    prefillSignupProfile();
    showPage("signupProfilePage");
  }

  function splitCSV(value) {
    return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  async function saveProfile() {
    const status = byId("profileStatus");
    try {
      if (!currentUser) {
        status.textContent = "Please sign in first.";
        return;
      }

      const username = byId("profileUsername").value.trim();
      if (!username) {
        status.textContent = "Please choose a username.";
        return;
      }

      const profile = {
        uid: currentUser.uid,
        username,
        displayName: byId("profileDisplayName").value.trim() || currentUser.displayName || "",
        email: currentUser.email || "",
        phoneNumber: currentUser.phoneNumber || "",
        photoURL: currentUser.photoURL || "",
        providerIds: (currentUser.providerData || []).map(p => p.providerId),
        country: byId("profileCountry").value.trim(),
        region: byId("profileRegion").value.trim(),
        city: byId("profileCity").value.trim(),
        ageRange: byId("profileAgeRange").value,
        favoriteGenres: splitCSV(byId("profileGenres").value),
        nightlifeInterests: splitCSV(byId("profileInterests").value),
        instagramHandle: byId("profileInstagram").value.trim(),
        xHandle: byId("profileX").value.trim(),
        analyticsConsent: byId("profileAnalyticsConsent").checked,
        marketingConsent: byId("profileMarketingConsent").checked,
        referredByPromoterId: new URL(window.location.href).searchParams.get("promoter") || "",
        profileCompleted: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("users").doc(currentUser.uid).set({
        ...profile,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      status.textContent = "Profile saved.";
      await continueToMainCategories();
    } catch (e) {
      console.error(e);
      status.textContent = e.message;
    }
  }

  async function continueToMainCategories() {
    showPage("categoryPage");
    if (pendingDirectLocation) {
      openCategory("shoutout");
      setTimeout(() => selectLocationForShoutOut(pendingDirectLocation), 400);
    }
  }


  async function afterLogin() {
    await loadTemplates();
    await loadLocations();
    await loadEvents();

    const profile = await getUserProfile();
    if (!profile || !profile.profileCompleted) {
      showSignupProfile();
      return;
    }

    await continueToMainCategories();
  }

  async function loginGoogle() { try { setStatus("Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function loginFacebook() { try { setStatus("Opening Facebook sign-in..."); await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function loginMicrosoft() { try { const p = new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); setStatus("Opening Microsoft sign-in..."); await auth.signInWithPopup(p); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function logout() { await auth.signOut(); window.location.href = "./"; }

  function setupPhoneAuth() { if (!byId("recaptcha-container") || window.recaptchaVerifier) return; window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {size:"normal"}); }
  async function sendPhoneCode() {
    try {
      setupPhoneAuth();
      const phone = byId("phoneNumber").value.trim();
      if (!phone.startsWith("+")) { setStatus("Use international format, for example +12025550123."); return; }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      byId("phoneCodeBlock")?.classList.remove("hidden");
      setStatus("Code sent. Enter it below.");
    } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function verifyPhoneCode() { try { if (!confirmationResult) { setStatus("Send the OTP first."); return; } await confirmationResult.confirm(byId("phoneCode").value.trim()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }


  function openGuestListForSelectedLocation() {
    const id =
      selectedLocation?.id ||
      selectedClub?.id ||
      selectedClub?.locationId ||
      selectedClub?.clubLocationId ||
      new URL(window.location.href).searchParams.get("location") ||
      "";

    const url = new URL("./guest-list.html", window.location.href);
    if (id) url.searchParams.set("location", id);

    const promoter = new URL(window.location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);

    window.location.href = url.toString();
  }


  function openCategory(type) {
    showAdSplash(type, () => openCategoryAfterAd(type));
  }

  function openCategoryAfterAd(type) {
    if (type === "clubs" || type === "lounges" || type === "lounge-club" || type === "beach-clubs") {
      byId("clubActionsPage")?.setAttribute("data-category-type", type);
      showPage("clubActionsPage");
      return;
    }

    byId("listingType").value = type;
    byId("listingTitle").textContent =
      type === "events" ? "Search Events" :
      type === "shoutout" ? "Choose Location for ShoutOut" :
      type.startsWith("club-action:") ? type.replace("club-action:","").replaceAll("-"," ").replace(/\b\w/g, c => c.toUpperCase()) :
      "Search";
    byId("listingIntro").textContent =
      type === "shoutout" ? "Pick the exact location where your ShoutOut should appear." :
      type.startsWith("club-action:") ? "Select the exact venue/location for this action. Payment and booking integration will be connected later." :
      "Search by country, state/region/province, city, genre, artist, event day, or activity time.";
    showListing();
  }

  function populateFilters() {
    const country = byId("countryFilter"), region = byId("regionFilter"), city = byId("cityFilter"), genre = byId("genreFilter");
    if (!country) return;
    country.innerHTML = '<option value="">All countries</option>';
    region.innerHTML = '<option value="">All states / regions</option>';
    city.innerHTML = '<option value="">All cities</option>';
    genre.innerHTML = '<option value="">All genres</option>';
    const source = byId("listingType").value === "events" ? Object.values(events) : Object.values(locations);
    unique(source.map(x => x.country)).forEach(x => country.append(new Option(x,x)));
    unique(source.map(x => x.region)).forEach(x => region.append(new Option(x,x)));
    unique(source.map(x => x.city)).forEach(x => city.append(new Option(x,x)));
    unique(source.flatMap(x => x.genres || [])).forEach(x => genre.append(new Option(x,x)));
  }
  function bindFilters() {
    ["locationSearch","countryFilter","regionFilter","cityFilter","genreFilter"].forEach(id => {
      const el = byId(id);
      if (el && !el.dataset.bound) { el.addEventListener("input", renderGrid); el.addEventListener("change", renderGrid); el.dataset.bound = "1"; }
    });
  }
  function showListing() { showPage("listingPage"); populateFilters(); bindFilters(); renderGrid(); }

  function renderGrid() {
    const type = byId("listingType").value || "clubs";
    if (type === "events") return renderEventGrid();
    return renderLocationGrid();
  }

  function renderEventGrid() {
    const grid = byId("locationGrid");
    const s = (byId("locationSearch")?.value || "").toLowerCase();
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(events).filter(([id,e]) => {
      const hay = `${e.eventName} ${e.country} ${e.region} ${e.city} ${(e.genres||[]).join(" ")} ${(e.artists||[]).join(" ")} ${e.eventDay} ${e.eventTime} ${e.eventDate}`.toLowerCase();
      return (!s || hay.includes(s)) && (!country || e.country === country) && (!region || e.region === region) && (!city || e.city === city) && (!genre || (e.genres||[]).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching events found.</div>';
    matches.forEach(([id,e]) => {
      const loc = getLocation(e.locationId);
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(e.eventName)}</h3><p>${esc(loc.locationName || e.locationId)} • ${esc(e.city)}, ${esc(e.country)}</p></div><strong>${esc(e.eventDay || "")}</strong></div><p class="dj">${esc((e.genres||[]).join(" • "))}</p><div class="badge-row"><span>${esc(e.eventDate || "")}</span><span>${esc(e.eventTime || "")}</span>${(e.artists||[]).slice(0,2).map(a=>`<span>${esc(a)}</span>`).join("")}</div></div><button class="primary" type="button">Buy Ticket / ShoutOut</button>`;
      card.querySelector("button").addEventListener("click", () => {
        const msg = "Ticket checkout will be connected in the next payment integration. For now, you can throw a ShoutOut at this event location.";
        alert(msg);
        selectLocationForShoutOut(e.locationId);
      });
      grid.appendChild(card);
    });
  }

  function renderLocationGrid() {
    const grid = byId("locationGrid");
    const type = byId("listingType").value || "clubs";
    const s = (byId("locationSearch")?.value || "").toLowerCase();
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(locations).filter(([id,l]) => {
      const hay = `${l.brandName} ${l.locationName} ${l.country} ${l.region} ${l.city} ${l.locationLabel} ${(l.genres||[]).join(" ")} ${(l.artists||[]).join(" ")} ${(l.activityDates||[]).join(" ")}`.toLowerCase();
      const actionBase = byId("clubActionsPage")?.getAttribute("data-category-type") || "clubs";
      const effectiveType = type.startsWith("club-action:") ? actionBase : type;
      const typeOk =
        effectiveType === "lounges" ? (l.type === "lounge" || (l.categories||[]).includes("Lounges")) :
        effectiveType === "lounge-club" ? (l.type === "lounge-club" || (l.categories||[]).includes("Lounge-Club")) :
        effectiveType === "beach-clubs" ? (l.type === "beach-club" || (l.categories||[]).includes("Beach Clubs")) :
        effectiveType === "clubs" || effectiveType === "shoutout" ? (l.type === "club" || l.type === "lounge-club" || l.type === "beach-club" || (l.categories||[]).includes("Clubs")) :
        true;
      return typeOk && (!s || hay.includes(s)) && (!country || l.country === country) && (!region || l.region === region) && (!city || l.city === city) && (!genre || (l.genres||[]).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching results found.</div>';
    matches.forEach(([id,l]) => {
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(l.locationName)}</h3><p>${esc(l.locationLabel)}</p></div><strong>${esc(l.country)}</strong></div><p class="dj">${esc((l.genres||[]).join(" • "))}</p><div class="badge-row">${(l.activityDates||[]).slice(0,4).map(x => `<span>${esc(x)}</span>`).join("")}</div></div><button class="primary" type="button">${type === "shoutout" ? "Throw ShoutOut Here" : type.startsWith("club-action:") ? "Continue" : "Select"}</button>`;
      card.querySelector("button").addEventListener("click", () => selectLocationForShoutOut(id));
      grid.appendChild(card);
    });
  }

  async function selectLocationForShoutOut(id) {
    selectedLocationId = id;
    const loc = await loadLocationById(id);
    setText("selectedClubTitle", loc.locationName);
    setText("selectedClubMeta", `${loc.locationLabel} • ${(loc.genres||[]).join(" / ")}`);
    selectedTemplate = (loc.templates && loc.templates[0]) || "neon";
    renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage");
  }
  function showTemplateSelection(){ renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage"); }
  function renderTemplates() {
    const grid = byId("templateGrid"); if (!grid) return; grid.innerHTML = "";
    (getLocation().templates || ["neon"]).forEach(id => {
      const t = getTemplate(id), item = document.createElement("div");
      item.className = `template ${t.className || "neon"} ${t.id === selectedTemplate ? "selected" : ""}`;
      item.innerHTML = `<div class="name">${esc(t.name)}</div><div class="tag">${esc(t.scope || "Shared")} template</div>`;
      item.addEventListener("click", () => { selectedTemplate = t.id; renderTemplates(); updateTemplateSummary(); });
      grid.appendChild(item);
    });
  }
  function updateTemplateSummary() { const t = getTemplate(); byId("selectedTemplateSummary").innerHTML = `<h3>${esc(t.name)}</h3><p>${esc(t.scope || "Shared")} template selected.</p>`; }
  function displayUrl(payload, id=locationId()) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", id);
    if(payload){ url.searchParams.set("main",payload.mainText||""); url.searchParams.set("sub",payload.subText||""); url.searchParams.set("template",payload.template||"neon"); url.searchParams.set("media",payload.mediaUrl||""); }
    return url.href;
  }
  function goToEditor() { const l=getLocation(), t=getTemplate(); setText("editorClubTitle", l.locationName); setText("editorTemplateMeta", `${l.locationLabel} • Template: ${t.name}`); updatePreview(); showPage("editorPage"); }
  function updatePreview() {
    const frame=byId("previewFrame");
    if(frame) frame.src=displayUrl({mainText:byId("mainText")?.value.trim()||"SHOUTOUT!", subText:byId("subText")?.value.trim()||"", mediaUrl:byId("mediaUrl")?.value.trim()||"", template:selectedTemplate}, locationId());
  }

  async function uploadShoutoutPhoto(referenceNumber) {
    const file = byId("shoutoutPhoto")?.files?.[0];
    if (!file) return "";
    if (!storage) throw new Error("Firebase Storage is not initialized. Add firebase-storage-compat.js and enable Storage.");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG, and WEBP images are allowed.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8MB or smaller.");
    setText("uploadStatus", "Uploading photo...");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `shoutouts/${currentUser.uid}/${referenceNumber}-${Date.now()}-${safeName}`;
    const ref = storage.ref().child(path);
    const snap = await ref.put(file, { contentType: file.type, customMetadata: { uploadedBy: currentUser.uid, referenceNumber } });
    const url = await snap.ref.getDownloadURL();
    setText("uploadStatus", "Photo uploaded.");
    return url;
  }

  function applyAiSuggestion() {
    const pool = window.SHOUTOUT_AI_SUGGESTIONS || [];
    const item = pool[Math.floor(Math.random() * pool.length)] || {main:"SHOUTOUT!", sub:"VIP vibes tonight."};
    byId("mainText").value = item.main;
    byId("subText").value = item.sub;
    const box = byId("shoutoutSuggestionBox");
    if (box) { box.classList.remove("hidden"); box.innerHTML = `<strong>AI Suggestion</strong><p>${esc(item.main)} — ${esc(item.sub)}</p>`; }
    updatePreview();
  }

  async function loadPastShoutoutsForReuse() {
    const box = byId("shoutoutSuggestionBox");
    if (!box || !currentUser) return;
    box.classList.remove("hidden");
    box.innerHTML = "Loading past ShoutOuts...";
    try {
      const snap = await db.collection("shoutouts").where("submittedBy", "==", safeUser()).limit(10).get();
      const rows = [];
      snap.forEach(doc => rows.push({id:doc.id, ...doc.data()}));
      if (!rows.length) { box.innerHTML = "<p>No previous ShoutOuts found yet.</p>"; return; }
      box.innerHTML = rows.map((s,i)=>`<button type="button" class="reuse-shoutout" data-i="${i}">${esc(s.mainText||"ShoutOut")} — ${esc(s.subText||"")}</button>`).join("");
      box.querySelectorAll(".reuse-shoutout").forEach(btn => btn.addEventListener("click", () => {
        const s = rows[Number(btn.dataset.i)];
        byId("mainText").value = s.mainText || "";
        byId("subText").value = s.subText || "";
        if (s.mediaUrl) byId("mediaUrl").value = s.mediaUrl;
        updatePreview();
      }));
    } catch(e) { box.innerHTML = `<p>${esc(e.message)}</p>`; }
  }

  async function submitShoutout() {
    const status=byId("submitStatus");
    try {
      if(!currentUser){ status.textContent="Sign in first."; return; }
      if(!selectedLocationId){ status.textContent="Select a location first."; return; }
      const l=getLocation(), t=getTemplate();
      const referenceNumber = `SO-${Date.now().toString().slice(-7)}`;
      const uploadedMediaUrl = await uploadShoutoutPhoto(referenceNumber);
      const payload={ location:locationId(), club:locationId(), clubLocationId:locationId(), brandName:l.brandName, locationName:l.locationName, clubName:l.locationName, country:l.country, region:l.region, city:l.city, locationLabel:l.locationLabel, template:selectedTemplate, templateName:t.name, mainText:byId("mainText").value.trim()||"SHOUTOUT!", subText:byId("subText").value.trim()||"", mediaUrl:uploadedMediaUrl || byId("mediaUrl").value.trim(), status:"pending", editable:true, submittedByUid:currentUser.uid, submittedBy:safeUser(), submittedAt:firebase.firestore.FieldValue.serverTimestamp(), referenceNumber };
      const shoutoutRef = await db.collection("shoutouts").add(payload);
      await db.collection("shoutoutAudit").add({shoutoutId:shoutoutRef.id, action:"submitted", referenceNumber:payload.referenceNumber, actorUid:currentUser.uid, actorEmail:safeUser(), createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      try { await db.collection("shoutoutRecommendations").add({source:"submission", uid:currentUser.uid, template:payload.template, mainText:payload.mainText, subText:payload.subText, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
      if (window.createShoutOutSubmissionNotification) await window.createShoutOutSubmissionNotification(payload);
      setText("confirmRef",payload.referenceNumber); setText("confirmClub",l.locationName); setText("confirmTemplate",t.name); showPage("confirmationPage");
    } catch(e) { status.textContent=e.message; }
  }
  function startAnother(){ byId("mainText").value="HAPPY BIRTHDAY MAYA!"; byId("subText").value="VIP Table 4 sends love"; byId("mediaUrl").value=""; if(byId("shoutoutPhoto")) byId("shoutoutPhoto").value=""; showTemplateSelection(); }


  function ensureProfileMenuEnhancements(user) {
    const menus = [
      byId("profileMenu"),
      byId("userMenu"),
      document.querySelector(".profile-menu"),
      document.querySelector(".user-menu"),
      document.querySelector(".account-menu")
    ].filter(Boolean);

    const menu = menus[0];
    if (!menu || !user) return;

    if (!menu.querySelector("[data-patron-menu='portal']")) {
      const signOutButton = Array.from(menu.querySelectorAll("button")).find(b => String(b.textContent || "").toLowerCase().includes("sign out")) || null;

      const portalLink = document.createElement("a");
      portalLink.href = "./patron-portal.html?v=28.8";
      portalLink.textContent = "My Profile";
      portalLink.dataset.patronMenu = "portal";
      portalLink.className = "profile-menu-link";
      menu.insertBefore(portalLink, signOutButton);

      const level = document.createElement("div");
      level.textContent = "Member Level: Patron";
      level.dataset.patronMenu = "level";
      level.className = "profile-menu-line";
      menu.insertBefore(level, signOutButton);

      const messages = document.createElement("a");
      messages.href = "./patron-portal.html?tab=messages&v=28.8";
      messages.textContent = "Messages (0/0)";
      messages.dataset.patronMenu = "messages";
      messages.className = "profile-menu-link";
      menu.insertBefore(messages, signOutButton);

      const chats = document.createElement("a");
      chats.href = "./patron-portal.html?tab=chats&v=28.8";
      chats.textContent = "Chats (0/0)";
      chats.dataset.patronMenu = "chats";
      chats.className = "profile-menu-link";
      menu.insertBefore(chats, signOutButton);
    }

    updateProfileMenuCounts(user.uid);
  }

  async function updateProfileMenuCounts(uid) {
    try {
      const profileDoc = await db.collection("users").doc(uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      const levelEl = document.querySelector("[data-patron-menu='level']");
      if (levelEl) levelEl.textContent = `Member Level: ${profile.memberLevel || "Patron"}`;

      let totalMessages = 0, unreadMessages = 0, totalChats = 0, unreadChats = 0;

      try {
        const msgSnap = await db.collection("messages").where("recipientUid", "==", uid).limit(1000).get();
        totalMessages = msgSnap.size;
        msgSnap.forEach(d => { if (!d.data().read) unreadMessages += 1; });
      } catch(e) {}

      try {
        const chatSnap = await db.collection("chatRooms").where("participants", "array-contains", uid).limit(1000).get();
        totalChats = chatSnap.size;
        chatSnap.forEach(d => {
          const unread = d.data().unreadCounts && d.data().unreadCounts[uid] ? Number(d.data().unreadCounts[uid]) : 0;
          unreadChats += unread;
        });
      } catch(e) {}

      const msgEl = document.querySelector("[data-patron-menu='messages']");
      if (msgEl) msgEl.textContent = `Messages (${unreadMessages}/${totalMessages})`;

      const chatEl = document.querySelector("[data-patron-menu='chats']");
      if (chatEl) chatEl.textContent = `Chats (${unreadChats}/${totalChats})`;
    } catch(e) {
      console.warn("Could not update profile menu counts", e);
    }
  }


  document.addEventListener("DOMContentLoaded", function(){
    setStatus("Choose a sign-in/up option.");
    auth.onAuthStateChanged(async user => { currentUser=user; updateLoginUI(user); if(user) await afterLogin(); });
    bind("googleLoginBtn", loginGoogle); bind("facebookLoginBtn", loginFacebook); bind("microsoftLoginBtn", loginMicrosoft); bind("sendOtpBtn", sendPhoneCode); bind("verifyOtpBtn", verifyPhoneCode); bind("continueBtn", afterLogin);
    ["logoutBtn1","logoutBtn2","logoutBtn3","logoutBtn4","logoutBtn5","logoutBtn6","logoutBtnClubActions"].forEach(id => bind(id, logout));
    bind("eventsBtn", () => openCategory("events")); bind("clubsBtn", () => openCategory("clubs")); bind("loungesBtn", () => openCategory("lounges")); bind("loungeClubBtn", () => openCategory("lounge-club")); bind("beachClubsBtn", () => openCategory("beach-clubs")); bind("shoutoutBtn", () => openCategory("shoutout"));
    bind("eventsBtnCard", () => openCategory("events")); bind("clubsBtnCard", () => openCategory("clubs")); bind("loungesBtnCard", () => openCategory("lounges")); bind("loungeClubBtnCard", () => openCategory("lounge-club")); bind("beachClubsBtnCard", () => openCategory("beach-clubs")); bind("shoutoutBtnCard", () => openCategory("shoutout"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => openCategory("club-action:reserve-a-table"));
    bind("joinGuestListBtn", () => openCategory("club-action:join-guest-list"));
    bind("payVipEntryBtn", () => openCategory("club-action:pay-vip-entry"));
    bind("payEventEntryBtn", () => openCategory("club-action:pay-event-entry"));
    bind("payStdEntryBtn", () => openCategory("club-action:pay-std-entry"));
    bind("backToCategoriesBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => openCategoryAfterAd("club-action:reserve-a-table"));
    bind("joinGuestListBtn", () => openCategoryAfterAd("club-action:join-guest-list"));
    bind("payVipEntryBtn", () => openCategoryAfterAd("club-action:pay-vip-entry"));
    bind("payEventEntryBtn", () => openCategoryAfterAd("club-action:pay-event-entry"));
    bind("payStdEntryBtn", () => openCategoryAfterAd("club-action:pay-std-entry")); bind("backToListingBtn", () => showListing()); bind("backToTemplatesBtn", showTemplateSelection); bind("goToEditorBtn", goToEditor); bind("submitShoutoutBtn", submitShoutout); bind("aiSuggestBtn", applyAiSuggestion); bind("pastShoutoutsBtn", loadPastShoutoutsForReuse); bind("startAnotherBtn", startAnother); bind("chooseAnotherClubBtn", () => openCategory("shoutout"));
    bind("userMenuBtn", toggleUserDropdown);
    bind("dropdownSignOutBtn", logout);
    bind("skipAdBtn", skipAdSplash);
    bind("saveProfileBtn", saveProfile);
    document.addEventListener("click", closeUserDropdownOnOutsideClick);
    ["mainText","subText","mediaUrl"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
  });

  auth.onAuthStateChanged(user => {
    if (user) setTimeout(() => ensureProfileMenuEnhancements(user), 500);
  });

})();



/* v28.4 override: patron menu + guest-list routing */
(function(){
  function byId(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function initials(user){
    const n = user?.displayName || user?.email || "Patron";
    return n.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "P";
  }
  function selectedLocationId(){
    return window.selectedLocationId || window.locationId?.() || new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  }
  window.openGuestListForLocation = function(locationId){
    const url = new URL("./guest-list.html", location.href);
    url.searchParams.set("v","28.2");
    url.searchParams.set("location", locationId || selectedLocationId());
    const promoter = new URL(location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);
    location.href = url.toString();
  };

  async function counts(uid){
    const out = {tm:0, um:0, tc:0, uc:0};
    try{
      const db = firebase.firestore();
      const ms = await db.collection("messages").where("recipientUid","==",uid).limit(1000).get();
      out.tm = ms.size; ms.forEach(d => { if(!d.data().read) out.um++; });
    }catch(e){}
    try{
      const db = firebase.firestore();
      const cs = await db.collection("chatRooms").where("participants","array-contains",uid).limit(1000).get();
      out.tc = cs.size; cs.forEach(d => { out.uc += Number((d.data().unreadCounts || {})[uid] || 0); });
    }catch(e){}
    return out;
  }

  async function enhanceMenu(user){
    if(!user) return;
    const menu = byId("userDropdown") || byId("profileMenu") || byId("userMenu") || document.querySelector(".user-dropdown,.profile-menu,.user-menu,.account-menu");
    if(!menu) return;
    const c = await counts(user.uid);
    const photo = user.photoURL ? `<img class="menu-avatar" src="${esc(user.photoURL)}" alt="">` : `<span class="menu-avatar-fallback">${esc(initials(user))}</span>`;
    menu.innerHTML = `
      <div class="menu-user-row">${photo}<div><strong>${esc(user.displayName || user.email || "Patron")}</strong><p>${esc(user.email || user.phoneNumber || "")}</p></div></div>
      <a class="profile-menu-link" href="./patron-portal.html?v=28.8">My Profile</a>
      <div class="profile-menu-line">Member Level: Patron</div>
      <a class="profile-menu-link" href="./patron-portal.html?tab=messages&v=28.8">Messages (${c.um}/${c.tm})</a>
      <a class="profile-menu-link" href="./patron-portal.html?tab=chats&v=28.8">Chats (${c.uc}/${c.tc})</a>
      <button class="ghost full" type="button" onclick="logout()">Sign out</button>`;
  }

  document.addEventListener("click", function(e){
    const el = e.target.closest("button,a,[role='button']");
    if(!el) return;
    const text = String(el.textContent || el.getAttribute("aria-label") || "").toLowerCase();
    if(text.includes("guest list") || text.includes("join guest")){
      window.__jadzActionMode = "guest-list";
    }
    if(window.__jadzActionMode === "guest-list" && text.trim() === "continue"){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.openGuestListForLocation();
    }
  }, true);

  const waitAuth = setInterval(function(){
    try{
      if(window.firebase && firebase.auth){
        clearInterval(waitAuth);
        firebase.auth().onAuthStateChanged(user => {
          if(user) setTimeout(() => enhanceMenu(user), 350);
        });
      }
    }catch(e){}
  }, 250);
})();

/* v28.4 override: club service isolation + inbox notification */
(function(){
function qs(n){return new URL(location.href).searchParams.get(n)||"";}
function currentLoc(){return window.selectedLocationId||window.locationId?.()||qs("location")||qs("club")||"zebbies-garden-washington-dc";}
window.getEnabledServicesForLocation=function(id){return (window.SHOUTOUT_LOCATION_SERVICES||{})[id]||window.SHOUTOUT_DEFAULT_LOCATION_SERVICES||["shoutout","guestList"];};
window.openServiceForLocation=function(service,id){id=id||currentLoc();if(service==="guestList"){let u=new URL("./guest-list.html",location.href);u.searchParams.set("location",id);u.searchParams.set("v","28.3");let pr=qs("promoter");if(pr)u.searchParams.set("promoter",pr);location.href=u.toString();return;} if(service!=="shoutout"){alert(((window.SHOUTOUT_SERVICE_LABELS||{})[service]||service)+" is not yet enabled in this demo workflow.");}};
async function note(payload){try{let u=firebase.auth().currentUser;if(!u)return;await firebase.firestore().collection("inboxNotifications").add({recipientUid:u.uid,recipientEmail:u.email||"",read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),...payload});}catch(e){}}
window.createShoutOutSubmissionNotification=async function(s){await note({type:"shoutoutSubmitted",title:"ShoutOut Submitted",body:`Your ShoutOut was submitted for ${s.locationName||s.clubName||s.clubLocationId||"the selected venue"}.`,referenceNumber:s.referenceNumber||"",clubLocationId:s.clubLocationId||s.location||currentLoc(),status:s.status||"pending",link:"./patron-portal.html?tab=shoutouts&v=28.8"});};
document.addEventListener("click",function(e){let b=e.target.closest("[data-service]");if(b){e.preventDefault();e.stopPropagation();window.openServiceForLocation(b.dataset.service,currentLoc());return;}let el=e.target.closest("button,a,[role='button']");if(!el)return;let t=String(el.textContent||el.getAttribute("aria-label")||"").toLowerCase();if(t.includes("guest list")||t.includes("join guest"))window.__jadzActionMode="guest-list";if(window.__jadzActionMode==="guest-list"&&t.trim()==="continue"){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.openServiceForLocation("guestList",currentLoc());}},true);
})();

/* v28.5 media upload templates override */
(function(){
"use strict";
function byId(id){return document.getElementById(id);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function editorHost(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
function templateHost(){return byId("templateList")||byId("templatesList")||document.querySelector(".template-list");}
function ensureMediaEditor(){
 const host=editorHost(); if(!host||byId("shoutoutMediaUpload"))return;
 const box=document.createElement("div"); box.className="card"; box.innerHTML=`<h2>Photo / Video Upload</h2><p class="sub small">Upload image or short video from your phone.</p><label>Upload Image or Video<input id="shoutoutMediaUpload" type="file" accept="image/*,video/mp4,video/quicktime,video/webm"></label><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`; host.appendChild(box);
 byId("shoutoutMediaUpload").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0],prev=byId("shoutoutMediaPreview"); if(!f||!prev)return; const url=URL.createObjectURL(f); const isV=f.type.startsWith("video/"); prev.classList.remove("hidden"); prev.innerHTML=isV?`<video src="${url}" controls playsinline muted loop></video><p>${esc(f.name)}</p>`:`<img src="${url}" alt=""><p>${esc(f.name)}</p>`;});
}
async function uploadSelectedMedia(){
 const input=byId("shoutoutMediaUpload"), file=input&&input.files&&input.files[0]; if(!file)return {mediaUrl:"",mediaType:""};
 if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
 const user=firebase.auth().currentUser; if(!user)throw new Error("Sign in first.");
 const safeName=(Date.now()+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
 const ref=firebase.storage().ref().child(`shoutouts/${user.uid}/${safeName}`);
 await ref.put(file,{contentType:file.type}); const mediaUrl=await ref.getDownloadURL(); const mediaType=file.type.startsWith("video/")?"video":"image";
 byId("shoutoutMediaUrl").value=mediaUrl; byId("shoutoutMediaType").value=mediaType; return {mediaUrl,mediaType};
}
function ensureTemplates(){
 const host=templateHost(); if(!host||host.dataset.v285==="1")return; host.dataset.v285="1";
 const lib=window.SHOUTOUT_MEDIA_TEMPLATE_LIBRARY||{};
 const wrap=document.createElement("div"); wrap.className="media-template-grid";
 wrap.innerHTML=Object.values(lib).map(t=>`<button class="media-template-card" data-template-id="${esc(t.id)}" type="button"><div class="template-preview-board tpl-${esc(t.previewStyle)}">${t.supportsVideo?'<div class="video-placeholder">VIDEO</div>':''}${t.supportsImage?'<div class="photo-placeholder">PHOTO</div>':''}<div><strong>${esc(t.mainText||t.name)}</strong><span>${esc(t.subText||t.category)}</span></div></div><h3>${esc(t.name)}</h3><p class="sub small">${esc(t.description||"")}</p></button>`).join("");
 host.prepend(wrap);
 wrap.addEventListener("click",e=>{const c=e.target.closest("[data-template-id]"); if(!c)return; wrap.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected")); c.classList.add("selected"); window.selectedTemplate=c.dataset.templateId;});
}
function ensureSuggestions(){
 const host=editorHost(); if(!host||byId("aiSuggestionsBox"))return;
 const box=document.createElement("div"); box.id="aiSuggestionsBox"; box.className="card"; box.innerHTML=`<h2>ShoutOut Recommendations</h2><p class="sub small">Demo suggestions. Full AI backend comes later.</p><div id="aiSuggestionList"></div>`; host.appendChild(box);
 const samples=["Happy Birthday! VIP energy all night.","Big ShoutOut to the table making the night unforgettable.","Bottle service vibes. Celebrate loud.","Tonight belongs to the birthday star.","Luxury entrance. Big celebration. Bigger memories."];
 byId("aiSuggestionList").innerHTML=samples.map(s=>`<button type="button" class="ghost ai-suggestion">${esc(s)}</button>`).join("");
 byId("aiSuggestionList").onclick=e=>{const b=e.target.closest(".ai-suggestion"); if(!b)return; const inp=byId("mainText")||byId("shoutoutText")||document.querySelector("textarea"); if(inp)inp.value=b.textContent;};
}
window.jadzUploadSelectedShoutoutMedia=uploadSelectedMedia;
document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},1000);setInterval(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},2500);});
})();


/* v28.6 single media input and live preview fix */
(function(){
  "use strict";
  function byId(id){return document.getElementById(id);}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function findTextInput(){return byId("mainText")||byId("shoutoutText")||byId("messageText")||document.querySelector("textarea[name='mainText']")||document.querySelector("textarea")||document.querySelector("input[name='mainText']");}
  function findSubTextInput(){return byId("subText")||byId("shoutoutSubText")||document.querySelector("input[name='subText']")||document.querySelector("textarea[name='subText']");}
  function findEditor(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
  function removeDuplicateMediaInputs(){
    const fileInputs=Array.from(document.querySelectorAll("input[type='file']")).filter(i=>/image|photo|video|media|upload/i.test(((i.closest("label")||{}).textContent||"")+" "+(i.id||"")+" "+(i.name||"")));
    if(fileInputs.length<=1)return;
    let keep=byId("shoutoutMediaUpload")||fileInputs[0];
    keep.id="shoutoutMediaUpload";
    keep.accept="image/*,video/mp4,video/quicktime,video/webm";
    fileInputs.forEach(input=>{if(input!==keep){const wrap=input.closest("label")||input.parentElement;if(wrap)wrap.style.display="none";}});
  }
  function ensureSingleMediaUploader(){
    const editor=findEditor(); if(!editor)return;
    removeDuplicateMediaInputs();
    let input=byId("shoutoutMediaUpload");
    if(!input){
      const card=document.createElement("div");
      card.className="card";
      card.innerHTML=`<h2>Photo or Video</h2><p class="single-media-upload-note">Use one upload field only. Select either a photo or a short video.</p><label>Upload Photo or Video<input id="shoutoutMediaUpload" type="file" accept="image/*,video/mp4,video/quicktime,video/webm"></label><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`;
      editor.appendChild(card);
      input=byId("shoutoutMediaUpload");
    }
    input.accept="image/*,video/mp4,video/quicktime,video/webm";
    input.onchange=renderLiveMediaPreview;
  }
  function getCurrentText(){
    const main=findTextInput(), sub=findSubTextInput();
    return {mainText:main?main.value.trim():"", subText:sub?sub.value.trim():""};
  }
  function renderLiveMediaPreview(){
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!file||!preview)return;
    const url=URL.createObjectURL(file);
    const isVideo=file.type.startsWith("video/");
    const text=getCurrentText();
    preview.classList.remove("hidden");
    preview.innerHTML=`<div class="media-preview-stage">${isVideo?`<video src="${url}" autoplay muted loop playsinline controls></video>`:`<img src="${url}" alt="">`}<div class="media-preview-overlay"><strong>${esc(text.mainText||"YOUR SHOUTOUT")}</strong><span>${esc(text.subText||"LIVE ON THE DISPLAY")}</span></div></div><p class="sub small">${esc(file.name)} • ${isVideo?"Video":"Image"} preview</p>`;
  }
  function refreshPreviewText(){
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!preview||preview.classList.contains("hidden"))return;
    const text=getCurrentText();
    const strong=preview.querySelector(".media-preview-overlay strong");
    const span=preview.querySelector(".media-preview-overlay span");
    if(strong)strong.textContent=text.mainText||"YOUR SHOUTOUT";
    if(span)span.textContent=text.subText||"LIVE ON THE DISPLAY";
  }
  function patchAISuggestionButtons(){
    document.addEventListener("click",function(e){
      const btn=e.target.closest(".ai-suggestion,[data-ai-suggestion]");
      if(!btn)return;
      const input=findTextInput();
      if(input){
        input.value=btn.textContent.trim();
        input.dispatchEvent(new Event("input",{bubbles:true}));
        input.dispatchEvent(new Event("change",{bubbles:true}));
        refreshPreviewText();
      }
    },true);
  }
  function bindTextPreviewRefresh(){
    const main=findTextInput(), sub=findSubTextInput();
    if(main&&!main.dataset.v286Bound){main.dataset.v286Bound="1";main.addEventListener("input",refreshPreviewText);main.addEventListener("change",refreshPreviewText);}
    if(sub&&!sub.dataset.v286Bound){sub.dataset.v286Bound="1";sub.addEventListener("input",refreshPreviewText);sub.addEventListener("change",refreshPreviewText);}
  }
  async function uploadSingleSelectedMedia(){
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    if(!file)return {mediaUrl:"",mediaType:""};
    if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
    const user=firebase.auth().currentUser;
    if(!user)throw new Error("Please sign in before uploading media.");
    const safeName=(Date.now()+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
    const ref=firebase.storage().ref().child(`shoutouts/${user.uid}/${safeName}`);
    await ref.put(file,{contentType:file.type});
    const mediaUrl=await ref.getDownloadURL();
    const mediaType=file.type.startsWith("video/")?"video":"image";
    const mediaUrlInput=byId("shoutoutMediaUrl"), mediaTypeInput=byId("shoutoutMediaType");
    if(mediaUrlInput)mediaUrlInput.value=mediaUrl;
    if(mediaTypeInput)mediaTypeInput.value=mediaType;
    return {mediaUrl,mediaType};
  }
  window.jadzUploadSelectedShoutoutMedia=uploadSingleSelectedMedia;
  window.jadzRefreshShoutoutMediaPreview=refreshPreviewText;
  document.addEventListener("DOMContentLoaded",()=>{
    patchAISuggestionButtons();
    setInterval(()=>{ensureSingleMediaUploader();bindTextPreviewRefresh();removeDuplicateMediaInputs();},1000);
  });
})();


/* v28.7 ensure ShoutOut button appears on all club service screens */
(function(){
  "use strict";

  function goToShoutOut(){
    window.__jadzActionMode = "shoutout";

    const fns = ["showTemplateSelection", "goToTemplateSelection", "showTemplates", "openTemplateSelection"];
    for (const fn of fns) {
      if (typeof window[fn] === "function") {
        window[fn]();
        return;
      }
    }

    const page = document.getElementById("templatePage") || document.getElementById("screenTemplates");
    if (page) {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      page.classList.add("active");
    }
  }

  function ensureButton(){
    const text = Array.from(document.querySelectorAll("h1,h2,p,.eyebrow"))
      .map(x => (x.textContent || "").toLowerCase()).join(" ");

    if (!text.includes("club options") && !text.includes("what would you like to do")) return;

    const already = Array.from(document.querySelectorAll("button,a"))
      .some(x => (x.textContent || "").toLowerCase().includes("shoutout"));
    if (already) return;

    const serviceButtons = Array.from(document.querySelectorAll("button")).filter(b => {
      const t = (b.textContent || "").toLowerCase();
      return t.includes("reserve") || t.includes("guest list") || t.includes("vip") || t.includes("entry");
    });

    const host = serviceButtons[0] && serviceButtons[0].parentElement;
    if (!host) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary service-action";
    btn.dataset.service = "shoutout";
    btn.textContent = "Throw a ShoutOut";
    btn.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      goToShoutOut();
    };
    host.insertBefore(btn, host.firstChild);
  }

  document.addEventListener("DOMContentLoaded", function(){
    setInterval(ensureButton, 700);
  });
})();


/* v28.8 hardcoded club option ShoutOut insertion */
(function(){
  "use strict";

  function openShoutoutTemplates(){
    window.__jadzActionMode = "shoutout";

    const names = ["showTemplateSelection","goToTemplateSelection","showTemplates","openTemplateSelection"];
    for (const name of names) {
      try {
        if (typeof window[name] === "function") {
          window[name]();
          return;
        }
      } catch(e) {}
    }

    const templatePage =
      document.getElementById("templatePage") ||
      document.getElementById("screenTemplates") ||
      document.querySelector("[data-screen='templates']");

    if (templatePage) {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      templatePage.classList.add("active");
    }
  }

  function insertShoutOutButton(){
    const bodyText = (document.body && document.body.innerText || "").toLowerCase();
    if (!bodyText.includes("what would you like to do") && !bodyText.includes("club options")) return;

    const exists = Array.from(document.querySelectorAll("button,a")).some(el =>
      (el.textContent || "").toLowerCase().includes("throw a shoutout")
    );
    if (exists) return;

    const reserve = Array.from(document.querySelectorAll("button,a")).find(el =>
      (el.textContent || "").trim().toLowerCase() === "reserve a table"
    );
    const guest = Array.from(document.querySelectorAll("button,a")).find(el =>
      (el.textContent || "").toLowerCase().includes("join guest list")
    );

    const anchor = reserve || guest;
    if (!anchor || !anchor.parentElement) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "clubOptionShoutOutBtn";
    btn.className = "primary v28-8-shoutout-club-option";
    btn.textContent = "Throw a ShoutOut";
    btn.dataset.service = "shoutout";
    btn.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      openShoutoutTemplates();
    };

    anchor.parentElement.insertBefore(btn, anchor);
  }

  document.addEventListener("DOMContentLoaded", function(){
    insertShoutOutButton();
    setInterval(insertShoutOutButton, 300);
  });

  document.addEventListener("click", function(){
    setTimeout(insertShoutOutButton, 200);
    setTimeout(insertShoutOutButton, 700);
  }, true);
})();

```

### `shared-data.js`

```javascript
/*
  shared-data.js v19
  Truth source for demo categories, templates, club locations, and demo events.
  New model: club/location records are unique. A brand can have many locations.
*/
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

/*
  v25 Master Admin Security Policy
  Master admin must be explicitly listed, use an approved Jadz email domain,
  use a verified email identity, and sign in through Google or Microsoft.
  MFA must be enforced at Microsoft Entra ID / Google Workspace.
*/
window.SHOUTOUT_MASTER_ADMIN_ALLOWED_DOMAINS = [
  "jadzadco.com",
  "jadzholdings.com"
];

window.SHOUTOUT_MASTER_ADMIN_ALLOWED_PROVIDERS = [
  "google.com",
  "microsoft.com"
];

window.SHOUTOUT_MASTER_ADMIN_REQUIRE_VERIFIED_EMAIL = true;
window.SHOUTOUT_MASTER_ADMIN_REQUIRE_MFA_NOTICE = true;

window.SHOUTOUT_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];

window.SHOUTOUT_TEMPLATES = {
  neon: { id: "neon", name: "Neon ShoutOut", scope: "Shared", className: "neon" },
  birthday: { id: "birthday", name: "Birthday Glow", scope: "Shared", className: "neon" },
  vip: { id: "vip", name: "VIP Table", scope: "Shared", className: "gold" },
  bottle: { id: "bottle", name: "Bottle Service", scope: "Club", className: "fire" },
  gold: { id: "gold", name: "Gold Celebration", scope: "Shared", className: "gold" },
  ice: { id: "ice", name: "Ice Blue", scope: "Club", className: "ice" },
  fire: { id: "fire", name: "Fire Night", scope: "Club", className: "fire" },
  latin: { id: "latin", name: "Latin Night", scope: "Club", className: "gold" },
  hiphop: { id: "hiphop", name: "Hip Hop Night", scope: "Club", className: "fire" },
  afrohouse: { id: "afrohouse", name: "Afro House / Amapiano", scope: "Shared", className: "gold" },
  edm: { id: "edm", name: "EDM / House", scope: "Shared", className: "ice" }
};

window.SHOUTOUT_CLUB_LOCATIONS = {
  "zebbies-garden-washington-dc": {
    brandName:"Zebbies Garden", locationName:"Zebbies Garden DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"ZEBBIES GARDEN DC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ ZEBBIES DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","EDM","International"], artists:["DJ Nova"],
    activityStatus:"Active demo location",
    activityDates:["Monday Hip Hop","Wednesday EDM","Friday Afro Beats","Saturday International"],
    templates:["birthday","vip","bottle","neon"], active:true
  },
  "heist-washington-dc": {
    brandName:"Heist", locationName:"Heist Washington DC", type:"club",
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"HEIST DC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ HEIST DC", defaultSub:"",
    genres:["Hip Hop","Afro Beats","House"], artists:["Resident DJ"],
    activityStatus:"Demo location", activityDates:["Friday Hip Hop","Saturday House"],
    templates:["hiphop","bottle","birthday","fire"], active:true
  },
  "heist-houston-tx": {
    brandName:"Heist", locationName:"Heist Houston", type:"club",
    country:"United States", regionType:"State", region:"Texas", city:"Houston",
    locationLabel:"Houston, Texas, United States",
    brand:"HEIST HOUSTON x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ HEIST HOUSTON", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Amapiano","House"], artists:["DJ H-Town"],
    activityStatus:"Demo location", activityDates:["Monday Afro Beats","Friday Hip Hop","Saturday International"],
    templates:["hiphop","bottle","birthday","gold"], active:true
  },
  "shoko-barcelona-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona", type:"club",
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona, Catalonia, Spain",
    brand:"SHÔKO BARCELONA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ SHÔKO", defaultSub:"",
    genres:["Hip Hop","House","Reggaeton","R&B","Afro Beats"], artists:["Noriel","Resident DJs"],
    activityStatus:"Active official venue with ticketed events",
    activityDates:["Thursday 2026-06-11 Noriel","Weekly late-night club programming","Typical late-night schedule"],
    templates:["latin","hiphop","vip","neon"], active:true
  },
  "chrystie-cannes-france": {
    brandName:"Chrystie", locationName:"Chrystie Cannes", type:"club",
    country:"France", regionType:"Region", region:"Provence-Alpes-Côte d’Azur", city:"Cannes",
    locationLabel:"Cannes, Provence-Alpes-Côte d’Azur, France",
    brand:"CHRYSTIE CANNES x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ CHRYSTIE", defaultSub:"",
    genres:["House","Deep House","EDM","Cabaret"], artists:["Curated performances"],
    activityStatus:"Active seasonal/private club atmosphere",
    activityDates:["Friday 23:30-05:00","Saturday 23:30-05:00","Seasonal summer activity"],
    templates:["gold","vip","neon","birthday"], active:true
  },
  "cococure-london-uk": {
    brandName:"Cococure", locationName:"Cococure London", type:"lounge",
    country:"United Kingdom", regionType:"Region", region:"England", city:"London",
    locationLabel:"London, England, United Kingdom",
    brand:"COCOCURE LONDON x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ COCOCURE", defaultSub:"",
    genres:["Afrobeats","Amapiano","R&B","Hip Hop"], artists:["Curated DJs"],
    activityStatus:"Active London nightlife/food concept",
    activityDates:["Afrobeats / Bashment / Amapiano programming","R&B / Hip Hop programming"],
    templates:["afrohouse","hiphop","vip","gold"], active:true
  },
  "hi-ibiza-spain": {
    brandName:"Hï Ibiza", locationName:"Hï Ibiza", type:"club",
    country:"Spain", regionType:"Island", region:"Ibiza", city:"Ibiza",
    locationLabel:"Ibiza, Balearic Islands, Spain",
    brand:"HÏ IBIZA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ HÏ IBIZA", defaultSub:"",
    genres:["Afro House","House","EDM"], artists:["Black Coffee","Francis Mercier"],
    activityStatus:"Active major Ibiza venue",
    activityDates:["Seasonal Ibiza programming","Afro House / House residencies"],
    templates:["afrohouse","edm","vip","gold"], active:true
  },
  "pacha-ibiza-spain": {
    brandName:"Pacha", locationName:"Pacha Ibiza", type:"club",
    country:"Spain", regionType:"Island", region:"Ibiza", city:"Ibiza",
    locationLabel:"Ibiza, Balearic Islands, Spain",
    brand:"PACHA IBIZA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ PACHA IBIZA", defaultSub:"",
    genres:["House","Deep House","EDM"], artists:["International DJs"],
    activityStatus:"Active Ibiza club candidate",
    activityDates:["Seasonal Ibiza programming"],
    templates:["edm","gold","vip","neon"], active:true
  },
  "cavo-paradiso-mykonos-greece": {
    brandName:"Cavo Paradiso", locationName:"Cavo Paradiso Mykonos", type:"club",
    country:"Greece", regionType:"Island", region:"Mykonos", city:"Mykonos",
    locationLabel:"Mykonos, South Aegean, Greece",
    brand:"CAVO PARADISO x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ CAVO PARADISO", defaultSub:"",
    genres:["EDM","House","Tech House"], artists:["International DJs"],
    activityStatus:"Active open-air club",
    activityDates:["Seasonal DJ events"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "the-club-milan-italy": {
    brandName:"The Club", locationName:"The Club Milano", type:"club",
    country:"Italy", regionType:"Region", region:"Lombardy", city:"Milan",
    locationLabel:"Milan, Lombardy, Italy",
    brand:"THE CLUB MILANO x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ THE CLUB MILANO", defaultSub:"",
    genres:["Hip Hop","House","Commercial"], artists:["Resident DJs"],
    activityStatus:"Seed candidate",
    activityDates:["Weekly club programming"],
    templates:["hiphop","edm","vip","neon"], active:true
  },
  "miami-demo-fl": {
    brandName:"Miami Club Demo", locationName:"Miami Club Demo", type:"club",
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"MIAMI x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ MIAMI", defaultSub:"",
    genres:["Hip Hop","Afro House","EDM"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro House"],
    templates:["afrohouse","hiphop","vip","neon"], active:false
  },
  "atlanta-demo-ga": {
    brandName:"Atlanta Club Demo", locationName:"Atlanta Club Demo", type:"club",
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ ATLANTA", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Amapiano"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday Afro Beats"],
    templates:["hiphop","afrohouse","vip","fire"], active:false
  },
  "nyc-demo-ny": {
    brandName:"NYC Club Demo", locationName:"NYC Club Demo", type:"club",
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"NYC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ NYC", defaultSub:"",
    genres:["Hip Hop","House","Afro House"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Wednesday House","Friday Hip Hop"],
    templates:["hiphop","edm","vip","ice"], active:false
  },
  "la-demo-ca": {
    brandName:"LA Club Demo", locationName:"LA Club Demo", type:"club",
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"LA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ LA", defaultSub:"",
    genres:["Hip Hop","EDM","House"], artists:["Resident DJs"],
    activityStatus:"Demo market", activityDates:["Friday Hip Hop","Saturday EDM"],
    templates:["edm","hiphop","vip","gold"], active:false
  },
  "signature-club-washington-dc": {
    brandName:"Signature Club", locationName:"Signature Club DC", type:"lounge",
    categories:["Lounges","Lounge-Club","ShoutOut"],
    country:"United States", regionType:"District", region:"District of Columbia", city:"Washington",
    locationLabel:"Washington, District of Columbia, United States",
    brand:"SIGNATURE CLUB DC x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ SIGNATURE CLUB", defaultSub:"",
    genres:["Hip Hop","Afro Beats","R&B","Lounge"], artists:["Resident DJs"],
    activityStatus:"Lounge seed location",
    activityDates:["Friday Lounge Night","Saturday VIP Lounge"],
    templates:["vip","gold","birthday","neon"], active:true
  },
  "josephine-atlanta-ga": {
    brandName:"Josephine", locationName:"Josephine Lounge Club Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Lounges","Clubs","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"JOSEPHINE ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ JOSEPHINE", defaultSub:"",
    genres:["Hip Hop","R&B","Afro Beats","Open Format"], artists:["Resident DJs"],
    activityStatus:"Lounge-club seed location",
    activityDates:["Friday Hip Hop / Open Format","Saturday VIP Lounge Club"],
    templates:["hiphop","vip","gold","birthday"], active:true
  },
  "marquee-new-york-ny": {
    brandName:"Marquee", locationName:"Marquee New York", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"MARQUEE NEW YORK x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ MARQUEE", defaultSub:"",
    genres:["EDM","House","Open Format"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday DJ Night","Saturday EDM / House"],
    templates:["edm","vip","ice","neon"], active:true
  },
  "lavo-new-york-ny": {
    brandName:"LAVO", locationName:"LAVO New York", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"LAVO NEW YORK x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ LAVO", defaultSub:"",
    genres:["Hip Hop","Open Format","House"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Open Format","Saturday VIP Night"],
    templates:["vip","hiphop","gold","neon"], active:true
  },
  "nebula-new-york-ny": {
    brandName:"Nebula", locationName:"Nebula New York", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"New York", city:"New York",
    locationLabel:"New York, New York, United States",
    brand:"NEBULA NEW YORK x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ NEBULA", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Thursday Dance Night","Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "academy-los-angeles-ca": {
    brandName:"Academy LA", locationName:"Academy LA", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"ACADEMY LA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ ACADEMY LA", defaultSub:"",
    genres:["EDM","House","Tech House"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "exchange-la-ca": {
    brandName:"Exchange LA", locationName:"Exchange LA", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"EXCHANGE LA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ EXCHANGE LA", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday Dance"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "sound-nightclub-los-angeles-ca": {
    brandName:"Sound Nightclub", locationName:"Sound Nightclub Los Angeles", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"California", city:"Los Angeles",
    locationLabel:"Los Angeles, California, United States",
    brand:"SOUND NIGHTCLUB LA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ SOUND", defaultSub:"",
    genres:["House","Deep House","Tech House"], artists:["House DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday House","Saturday Deep House"],
    templates:["edm","gold","vip","neon"], active:true
  },
  "liv-miami-fl": {
    brandName:"LIV", locationName:"LIV Miami", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"LIV MIAMI x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ LIV", defaultSub:"",
    genres:["Hip Hop","EDM","Open Format"], artists:["Celebrity DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Hip Hop / Open Format","Saturday Celebrity Night"],
    templates:["hiphop","edm","vip","gold"], active:true
  },
  "club-space-miami-fl": {
    brandName:"Club Space", locationName:"Club Space Miami", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"CLUB SPACE MIAMI x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ CLUB SPACE", defaultSub:"",
    genres:["House","Deep House","Afro House","Techno"], artists:["International DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday House","Saturday Afterhours","Sunday Morning Sessions"],
    templates:["afrohouse","edm","vip","neon"], active:true
  },
  "e11even-miami-fl": {
    brandName:"E11EVEN", locationName:"E11EVEN Miami", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Florida", city:"Miami",
    locationLabel:"Miami, Florida, United States",
    brand:"E11EVEN MIAMI x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ E11EVEN", defaultSub:"",
    genres:["Hip Hop","EDM","Open Format"], artists:["Celebrity DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Late-night / 24-hour programming","Friday Open Format","Saturday VIP"],
    templates:["vip","hiphop","edm","gold"], active:true
  },
  "district-atlanta-ga": {
    brandName:"District", locationName:"District Atlanta", type:"club",
    categories:["Clubs","Events","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"DISTRICT ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ DISTRICT", defaultSub:"",
    genres:["EDM","House","Dance"], artists:["DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday EDM","Saturday House"],
    templates:["edm","ice","vip","neon"], active:true
  },
  "tongue-groove-atlanta-ga": {
    brandName:"Tongue & Groove", locationName:"Tongue & Groove Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"TONGUE & GROOVE ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ TONGUE & GROOVE", defaultSub:"",
    genres:["Hip Hop","Open Format","House"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Open Format","Saturday VIP Night"],
    templates:["hiphop","vip","gold","neon"], active:true
  },
  "reve-atlanta-ga": {
    brandName:"REVE", locationName:"REVE Atlanta", type:"lounge-club",
    categories:["Lounge-Club","Clubs","Lounges","ShoutOut"],
    country:"United States", regionType:"State", region:"Georgia", city:"Atlanta",
    locationLabel:"Atlanta, Georgia, United States",
    brand:"REVE ATLANTA x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ REVE", defaultSub:"",
    genres:["Hip Hop","Afro Beats","Open Format"], artists:["Resident DJs"],
    activityStatus:"Active nightlife seed location",
    activityDates:["Friday Hip Hop","Saturday Afro Beats / Open Format"],
    templates:["hiphop","afrohouse","vip","gold"], active:true
  },
  "shoko-barcelona-beach-club-spain": {
    brandName:"Shôko", locationName:"Shôko Barcelona Beach Club", type:"beach-club",
    categories:["Beach Clubs","Clubs","Events","ShoutOut"],
    country:"Spain", regionType:"Region", region:"Catalonia", city:"Barcelona",
    locationLabel:"Barcelona Beachfront, Catalonia, Spain",
    brand:"SHÔKO BEACH CLUB x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ SHÔKO BEACH", defaultSub:"",
    genres:["Hip Hop","House","Reggaeton","R&B","Afro Beats"], artists:["Noriel","Resident DJs"],
    activityStatus:"Beachfront club / nightlife venue",
    activityDates:["Beachfront dining + late-night club programming","Thursday Noriel event seed"],
    templates:["latin","hiphop","vip","neon"], active:true
  },
  "nammos-mykonos-greece": {
    brandName:"Nammos", locationName:"Nammos Mykonos", type:"beach-club",
    categories:["Beach Clubs","Lounges","Events","ShoutOut"],
    country:"Greece", regionType:"Island", region:"Mykonos", city:"Mykonos",
    locationLabel:"Mykonos, South Aegean, Greece",
    brand:"NAMMOS MYKONOS x JADZ ADCO",
    defaultMain:"USE SHOUT OUT @ NAMMOS", defaultSub:"",
    genres:["House","Deep House","Luxury Lounge"], artists:["Curated DJs"],
    activityStatus:"Beach club seed location",
    activityDates:["Seasonal beach club programming"],
    templates:["gold","vip","edm","neon"], active:true
  }

};

window.SHOUTOUT_EVENTS = {
  "shoko-noriel-2026-06-11": {
    eventName:"Noriel at Shôko Barcelona", locationId:"shoko-barcelona-spain",
    country:"Spain", region:"Catalonia", city:"Barcelona",
    genres:["Hip Hop","Reggaeton","Latin"], artists:["Noriel"],
    eventDate:"2026-06-11", eventDay:"Thursday", eventTime:"23:55-06:00", active:true
  },
  "chrystie-friday-night": {
    eventName:"Chrystie Cannes Friday Night", locationId:"chrystie-cannes-france",
    country:"France", region:"Provence-Alpes-Côte d’Azur", city:"Cannes",
    genres:["House","Deep House","Cabaret"], artists:["Curated performances"],
    eventDate:"Recurring Friday", eventDay:"Friday", eventTime:"23:30-05:00", active:true
  },
  "josephine-saturday-vip": {
    eventName:"Josephine Atlanta Saturday VIP", locationId:"josephine-atlanta-ga",
    country:"United States", region:"Georgia", city:"Atlanta",
    genres:["Hip Hop","R&B","Open Format"], artists:["Resident DJs"],
    eventDate:"Recurring Saturday", eventDay:"Saturday", eventTime:"22:00-03:00", active:true,
    ticketUrl:"#"
  },
  "shoko-beach-night": {
    eventName:"Shôko Barcelona Beach Night", locationId:"shoko-barcelona-beach-club-spain",
    country:"Spain", region:"Catalonia", city:"Barcelona",
    genres:["Hip Hop","House","Reggaeton"], artists:["Resident DJs"],
    eventDate:"Recurring Weekly", eventDay:"Thursday", eventTime:"23:55-06:00", active:true,
    ticketUrl:"#"
  },
  "club-space-saturday-afterhours": {
    eventName:"Club Space Miami Saturday Afterhours", locationId:"club-space-miami-fl",
    country:"United States", region:"Florida", city:"Miami",
    genres:["House","Deep House","Afro House"], artists:["International DJs"],
    eventDate:"Recurring Saturday", eventDay:"Saturday", eventTime:"23:00-Late", active:true,
    ticketUrl:"#"
  }

};

/*
  v25.1 Temporary Master Admin Exception.
  Keeps bans.don@gmail.com working while corporate master admin accounts are finalized.
  Remove this exception in production.
*/
window.SHOUTOUT_MASTER_ADMIN_TEMPORARY_EXCEPTION_EMAILS = [
  "bans.don@gmail.com"
];


/*
  v25.5 Master Admin Domain Policy

  During development, domain enforcement is disabled.
  Master Admin access is controlled by explicit email allow-list plus approved provider.
  Re-enable this in production after corporate-domain authentication is stable.
*/
window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS = false;


/* v26 promoter registry */
window.SHOUTOUT_PROMOTERS = {
  "jadz-demo-promotions": {
    id: "jadz-demo-promotions",
    name: "Jadz Demo Promotions",
    promoterGroup: "Jadz Demo Promotions",
    contactEmail: "promoters@jadzadco.com",
    active: true,
    locations: ["*"]
  },
  "zebbies-street-team": {
    id: "zebbies-street-team",
    name: "Zebbies Street Team",
    promoterGroup: "Zebbies Street Team",
    contactEmail: "promoters@zebbies.example",
    active: true,
    locations: ["zebbies-garden-washington-dc"]
  },
  "shoko-global-promotions": {
    id: "shoko-global-promotions",
    name: "Shôko Global Promotions",
    promoterGroup: "Shôko Global Promotions",
    contactEmail: "promoters@shoko.example",
    active: true,
    locations: ["shoko-barcelona-spain"]
  },
  "cannes-nightlife-group": {
    id: "cannes-nightlife-group",
    name: "Cannes Nightlife Group",
    promoterGroup: "Cannes Nightlife Group",
    contactEmail: "promoters@cannes.example",
    active: true,
    locations: ["christie-cannes-france"]
  }
};

window.SHOUTOUT_PROMOTER_ADMINS = {
  "bans.don@gmail.com": ["*"],
  "don.b@jadzholdings.com": ["*"]
};


/*
  v28 Localization / Translation Policy
  These product and brand terms must never be translated.
  Example: French should say "Envoyer un ShoutOut", not translate ShoutOut.
*/
window.SHOUTOUT_PROTECTED_TERMS = [
  "ShoutOut",
  "Jadz AdCo",
  "Jadz Holdings",
  "Superstar",
  "Big Baller",
  "Baller",
  "Diva",
  "Money Spender",
  "Bruv"
];

window.SHOUTOUT_TRANSLATION_EXAMPLES = {
  en: "Send a ShoutOut",
  fr: "Envoyer un ShoutOut",
  es: "Enviar un ShoutOut",
  it: "Invia un ShoutOut",
  de: "Einen ShoutOut senden",
  el: "Αποστολή ενός ShoutOut"
};

/* v28 Patron rank thresholds are displayed/configurable by Master Admin later. */
window.SHOUTOUT_PATRON_RANKS = [
  { id:"superstar", label:"Superstar", monthlySpend:30000, annualSpend:120000 },
  { id:"big-baller", label:"Big Baller", monthlySpend:20000, annualSpend:70000 },
  { id:"baller-diva", label:"Baller / Diva", monthlySpend:10000, annualSpend:50000 },
  { id:"money-spender", label:"Money Spender", monthlySpend:7500, annualSpend:30000 },
  { id:"bruv-diva", label:"Bruv / Diva", monthlySpend:5000, annualSpend:20000 }
];

/* v28.4 club/location service catalog */
window.SHOUTOUT_DEFAULT_LOCATION_SERVICES = ["shoutout","guestList"];
window.SHOUTOUT_LOCATION_SERVICES = {
  "zebbies-garden-washington-dc": ["shoutout","guestList","vipReservation","stdEntry"],
  "shoko-barcelona-spain": ["shoutout","guestList","vipReservation","ticketing"],
  "christie-cannes-france": ["shoutout","guestList","vipReservation","ticketing"],
  "abigail-washington-dc": ["shoutout","guestList","vipReservation"],
  "signature-lounge-washington-dc": ["shoutout","guestList","vipReservation"],
  "josephine-atlanta-ga": ["shoutout","guestList","vipReservation"]
};
window.SHOUTOUT_SERVICE_LABELS = {
  shoutout: "Throw a ShoutOut",
  guestList: "Join Guest List",
  vipReservation: "Reserve VIP / Table",
  stdEntry: "Pay Standard Entry",
  vipEntry: "Pay VIP Entry",
  ticketing: "Buy Ticket",
  bottleService: "Bottle Service",
  cabanaBooking: "Cabana Booking"
};
window.SHOUTOUT_STATUS_FLOW = ["draft","pending","approved","rejected","scheduled","displayed","archived"];


/* v28.4 enhanced templates, AI suggestions, and role request config */
Object.assign(window.SHOUTOUT_TEMPLATES, {
  blackwhite: { id:'blackwhite', name:'Classic Black & White', scope:'Shared', className:'classic-bw', category:'Classic' },
  summer: { id:'summer', name:'Summer Vibes', scope:'Shared', className:'summer', category:'Seasonal' },
  car: { id:'car', name:'Car Meet / Luxury Ride', scope:'Shared', className:'car', category:'Lifestyle' },
  champagne: { id:'champagne', name:'Champagne Celebration', scope:'Shared', className:'gold', category:'VIP' },
  beach: { id:'beach', name:'Beach Party', scope:'Shared', className:'summer', category:'Beach' },
  graduation: { id:'graduation', name:'Graduation Night', scope:'Shared', className:'classic-bw', category:'Milestone' },
  wedding: { id:'wedding', name:'Wedding Celebration', scope:'Shared', className:'gold', category:'Milestone' },
  sports: { id:'sports', name:'Sports Night', scope:'Shared', className:'fire', category:'Lifestyle' },
  luxury: { id:'luxury', name:'Luxury Gold', scope:'Shared', className:'gold', category:'VIP' },
  corporate: { id:'corporate', name:'Corporate Event', scope:'Shared', className:'classic-bw', category:'Business' }
});

window.SHOUTOUT_STANDARD_TEMPLATE_IDS = ['blackwhite','summer','car','champagne','beach','graduation','wedding','sports','luxury','corporate'];

Object.keys(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(id => {
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[id];
  loc.templates = Array.from(new Set([...(loc.templates || []), ...window.SHOUTOUT_STANDARD_TEMPLATE_IDS]));
});

window.SHOUTOUT_AI_SUGGESTIONS = [
  {category:'birthday', main:'HAPPY BIRTHDAY!', sub:'VIP vibes all night long.'},
  {category:'vip', main:'VIP TABLE IN THE BUILDING', sub:'Champagne ready. Lights up.'},
  {category:'summer', main:'SUMMER NIGHTS', sub:'Good people. Great music. Better memories.'},
  {category:'car', main:'LUXURY RIDE CREW', sub:'Pull up clean. Celebrate louder.'},
  {category:'classic', main:'TONIGHT IS YOUR NIGHT', sub:'Classic style. Big energy.'},
  {category:'love', main:'LOVE IS IN THE ROOM', sub:'Cheers to the perfect night.'},
  {category:'graduation', main:'CONGRATS GRAD!', sub:'The future starts tonight.'},
  {category:'afrobeats', main:'AFROBEATS ENERGY', sub:'From the table to the dance floor.'}
];

window.SHOUTOUT_ROLE_TYPES = {
  clubAdmin: 'Club Admin',
  clubMasterAdmin: 'Club Master Admin',
  dj: 'DJ',
  promoter: 'Promoter'
};

/* v28.5 media/video template library */
window.SHOUTOUT_MEDIA_TEMPLATE_LIBRARY = {
  "classic-black-white": {id:"classic-black-white", name:"Classic Black & White", category:"Classic", supportsImage:true, supportsVideo:false, previewStyle:"classic-board", mainText:"HAPPY BIRTHDAY", subText:"STACY", description:"Black words on a clean white classic board."},
  "ferrari-f8-vip": {id:"ferrari-f8-vip", name:"Ferrari F8 VIP", category:"Cars", supportsImage:true, supportsVideo:true, previewStyle:"ferrari", mainText:"VIP ARRIVAL", subText:"FERRARI NIGHT", description:"Red exotic-car inspired VIP theme."},
  "rolls-cullinan-vip": {id:"rolls-cullinan-vip", name:"Rolls-Royce Cullinan VIP", category:"Cars", supportsImage:true, supportsVideo:true, previewStyle:"rolls", mainText:"VIP EXPERIENCE", subText:"TABLE RESERVED", description:"Black-and-gold luxury SUV VIP theme."},
  "summer-vibes": {id:"summer-vibes", name:"Summer Vibes", category:"Seasonal", supportsImage:true, supportsVideo:true, previewStyle:"summer", mainText:"SUMMER VIBES", subText:"ALL NIGHT", description:"Beach and summer party theme."},
  "champagne-gold": {id:"champagne-gold", name:"Champagne Gold", category:"VIP", supportsImage:true, supportsVideo:true, previewStyle:"gold", mainText:"CHAMPAGNE", subText:"CELEBRATION", description:"Gold VIP celebration theme."},
  "neon-party": {id:"neon-party", name:"Neon Party", category:"Nightclub", supportsImage:true, supportsVideo:true, previewStyle:"neon", mainText:"SHOUTOUT", subText:"LIVE TONIGHT", description:"Neon nightclub theme."}
};
window.SHOUTOUT_UPLOAD_LIMITS = {imageBytes: 8*1024*1024, videoBytes: 30*1024*1024};


/* v28.7 force ShoutOut service for every club/location */
(function(){
  window.SHOUTOUT_SERVICE_LABELS = window.SHOUTOUT_SERVICE_LABELS || {};
  window.SHOUTOUT_SERVICE_LABELS.shoutout = "Throw a ShoutOut";

  window.SHOUTOUT_DEFAULT_LOCATION_SERVICES =
    Array.from(new Set(["shoutout", ...(window.SHOUTOUT_DEFAULT_LOCATION_SERVICES || ["guestList"])]));

  const services = window.SHOUTOUT_LOCATION_SERVICES || {};
  Object.keys(services).forEach(id => {
    if (!services[id].includes("shoutout")) services[id].unshift("shoutout");
  });
  window.SHOUTOUT_LOCATION_SERVICES = services;
})();

/* v28.8 service catalog shoutout force */
(function(){
  window.SHOUTOUT_SERVICE_LABELS = window.SHOUTOUT_SERVICE_LABELS || {};
  window.SHOUTOUT_SERVICE_LABELS.shoutout = "Throw a ShoutOut";
  window.SHOUTOUT_DEFAULT_LOCATION_SERVICES = Array.from(new Set(["shoutout", ...(window.SHOUTOUT_DEFAULT_LOCATION_SERVICES || [])]));
  if (window.SHOUTOUT_LOCATION_SERVICES) {
    Object.keys(window.SHOUTOUT_LOCATION_SERVICES).forEach(function(id){
      if (!window.SHOUTOUT_LOCATION_SERVICES[id].includes("shoutout")) {
        window.SHOUTOUT_LOCATION_SERVICES[id].unshift("shoutout");
      }
    });
  }
})();

```

### `firebase-config.js`

```javascript
/*
  firebase-config.js
  Firebase web config for Jadz AdCo ShoutOut demo.

  IMPORTANT:
  This file uses Firebase Compat syntax.
  Do not use: export const firebaseConfig = ...
*/
window.firebaseConfig = {
  apiKey: "<FIREBASE_API_KEY>",
  authDomain: "<FIREBASE_AUTH_DOMAIN>",
  projectId: "<FIREBASE_PROJECT_ID>",
  storageBucket: "<FIREBASE_STORAGE_BUCKET>",
  messagingSenderId: "<FIREBASE_MESSAGING_SENDER_ID>",
  appId: "<FIREBASE_APP_ID>",
  measurementId: "<FIREBASE_MEASUREMENT_ID>"
};

```

### `guest-list.html`

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Join Guest List</title><link rel="stylesheet" href="./styles.css"/><link rel="stylesheet" href="./admin.css"/></head>
<body><main class="app admin-shell"><section class="page active">
<header class="topbar"><div><p class="eyebrow">Guest List</p><h1>Join Guest List</h1><p class="sub">Enter legal names exactly as they appear on government-issued ID.</p><p id="guestSignedInAs" class="status">Not signed in</p><p id="guestStatus" class="status">Loading guest list app...</p></div></header>
<div id="guestLogin" class="card"><h2>Sign in first</h2><button id="guestGoogleLoginBtn" type="button">Continue with Google</button></div>
<div id="guestFormCard" class="card hidden"><h2>Guest List Request</h2><div class="profile-grid">
<label>Club / Location *<select id="guestLocation"></select></label>
<label>Event or Day *<select id="guestEventOrDay"><option value="">Select event/day</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option><option>Future Event</option></select></label>
<label>Promoter / Promoting Group *<select id="guestPromoter"></select></label>
<label>Legal First Name *<input id="guestFirstName"/></label><label>Legal Last Name *<input id="guestLastName"/></label>
<label>Phone Number<input id="guestPhone"/></label><label>Email<input id="guestEmail"/></label>
<label>Party Size *<input id="guestPartySize" type="number" min="1" max="50" value="1"/></label></div>
<label class="compact-label"><input id="legalNameConfirmed" type="checkbox"/> I confirm the legal first and last name entered match the government-issued ID that will be presented at entry.</label>
<h3>Additional Guests</h3><div id="additionalGuests"></div><button id="addGuestBtn" type="button">Add Guest</button>
<label>Notes<input id="guestNotes"/></label><button id="submitGuestListBtn" class="primary" type="button">Submit Guest List Request</button><button id="guestLogoutBtn" class="ghost" type="button">Sign out</button></div>
<div id="guestReceipt" class="card hidden"><h2>Guest list submitted</h2><div id="guestReceiptBody" class="report-block"></div></div>
</section></main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script><script src="./shared-data.js?v=28.8"></script><script src="./guest-list-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body></html>
```

### `guest-list-app.js`

```javascript
/* guest-list-app.js v28.4 */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const setText=(id,v)=>{const e=byId(id); if(e)e.textContent=v;};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const qs=n=>new URL(location.href).searchParams.get(n)||"";
if(!window.firebaseConfig){setText("guestStatus","firebase-config.js missing window.firebaseConfig.");return;}
firebase.initializeApp(window.firebaseConfig);
const auth=firebase.auth(), db=firebase.firestore();
const locations=window.SHOUTOUT_CLUB_LOCATIONS||{}, promoters=window.SHOUTOUT_PROMOTERS||{};
function bind(id,fn){byId(id)?.addEventListener("click",fn);}
async function loginGoogle(){try{setText("guestStatus","Opening Google sign-in...");await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());}catch(e){setText("guestStatus",`${e.code||"error"}: ${e.message}`);}}
async function logout(){await auth.signOut();location.href="./?v=28.8";}
function renderSelects(){
 const rl=qs("location"), rp=qs("promoter");
 byId("guestLocation").innerHTML=`<option value="">Select club/location</option>`+Object.entries(locations).map(([id,l])=>`<option value="${esc(id)}">${esc(l.locationName||l.name||id)}</option>`).join("");
 if(rl&&locations[rl])byId("guestLocation").value=rl;
 byId("guestPromoter").innerHTML=`<option value="">Select promoter/promoting group</option>`+Object.entries(promoters).filter(([id,p])=>p.active!==false).map(([id,p])=>`<option value="${esc(id)}">${esc(p.promoterGroup||p.name||id)}</option>`).join("");
 if(rp&&promoters[rp])byId("guestPromoter").value=rp;
}
async function loadProfile(u){try{const s=await db.collection("users").doc(u.uid).get();const p=s.exists?s.data():{};byId("guestFirstName").value=p.firstName||"";byId("guestLastName").value=p.lastName||"";byId("guestPhone").value=p.phone||u.phoneNumber||"";byId("guestEmail").value=p.email||u.email||"";if((!p.firstName||!p.lastName)&&u.displayName){const parts=u.displayName.trim().split(/\s+/);byId("guestFirstName").value=p.firstName||parts[0]||"";byId("guestLastName").value=p.lastName||parts.slice(1).join(" ")||"";}}catch(e){}}
function addGuestRow(){const w=document.createElement("div");w.className="profile-grid additional-guest-row";w.innerHTML=`<label>Guest First Name<input class="extraFirstName"/></label><label>Guest Last Name<input class="extraLastName"/></label><button type="button" class="ghost removeGuestBtn">Remove</button>`;w.querySelector(".removeGuestBtn").onclick=()=>w.remove();byId("additionalGuests").appendChild(w);}
function extras(){return Array.from(document.querySelectorAll(".additional-guest-row")).map(r=>{const f=r.querySelector(".extraFirstName").value.trim(),l=r.querySelector(".extraLastName").value.trim();return{firstName:f,lastName:l,fullName:`${f} ${l}`.trim()};}).filter(g=>g.firstName||g.lastName);}
async function submitGuestList(){
 try{
 const u=auth.currentUser;if(!u)return setText("guestStatus","Please sign in first.");
 const locationId=byId("guestLocation").value,eventOrDay=byId("guestEventOrDay").value,promoterId=byId("guestPromoter").value,firstName=byId("guestFirstName").value.trim(),lastName=byId("guestLastName").value.trim(),partySize=Number(byId("guestPartySize").value||1);
 if(!locationId)return setText("guestStatus","Please select a club/location.");
 if(!eventOrDay)return setText("guestStatus","Please select an event or day.");
 if(!promoterId)return setText("guestStatus","Promoter / promoting group is required.");
 if(!firstName||!lastName)return setText("guestStatus","Legal first name and legal last name are required.");
 if(!byId("legalNameConfirmed").checked)return setText("guestStatus","Please confirm your legal name matches your government-issued ID.");
 const loc=locations[locationId]||{},prom=promoters[promoterId]||{},additionalGuests=extras();
 const doc={type:"guestList",status:"pending",clubLocationId:locationId,locationName:loc.locationName||loc.name||locationId,eventOrDay,promoterId,promoterName:prom.promoterGroup||prom.name||promoterId,firstName,lastName,fullName:`${firstName} ${lastName}`.trim(),legalNameConfirmed:true,guestPhone:byId("guestPhone").value.trim(),guestEmail:byId("guestEmail").value.trim()||u.email||"",partySize,additionalGuests,notes:byId("guestNotes").value.trim(),submittedByUid:u.uid,submittedByEmail:u.email||"",submittedAt:firebase.firestore.FieldValue.serverTimestamp()};
 const ref=await db.collection("guestListRequests").add(doc);
 await db.collection("users").doc(u.uid).set({firstName,lastName,fullName:doc.fullName,phone:doc.guestPhone,email:doc.guestEmail,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
 byId("guestFormCard").classList.add("hidden");byId("guestReceipt").classList.remove("hidden");
 byId("guestReceiptBody").innerHTML=`<div class="report-table"><div><span>Reference</span><strong>${esc(ref.id)}</strong></div><div><span>Club</span><strong>${esc(doc.locationName)}</strong></div><div><span>Name</span><strong>${esc(doc.fullName)}</strong></div><div><span>Additional Guests</span><strong>${additionalGuests.length}</strong></div><div><span>Promoter</span><strong>${esc(doc.promoterName)}</strong></div><div><span>Status</span><strong>Pending</strong></div></div>`;
 setText("guestStatus","Guest list request submitted.");
 }catch(e){console.error(e);setText("guestStatus",`${e.code||"error"}: ${e.message}`);}
}
document.addEventListener("DOMContentLoaded",()=>{renderSelects();bind("guestGoogleLoginBtn",loginGoogle);bind("guestLogoutBtn",logout);bind("submitGuestListBtn",submitGuestList);bind("addGuestBtn",addGuestRow);auth.onAuthStateChanged(u=>{setText("guestSignedInAs",u?`Signed in as ${u.displayName||u.email||u.uid}`:"Not signed in");if(!u){byId("guestLogin").classList.remove("hidden");byId("guestFormCard").classList.add("hidden");setText("guestStatus","Please sign in to continue.");return;}byId("guestLogin").classList.add("hidden");byId("guestFormCard").classList.remove("hidden");setText("guestStatus","Guest list app loaded.");loadProfile(u);});});
})();
```

### `patron-portal.html`

```html
<!doctype html>
<html lang="en">
<head>
  <!-- Jadz AdCo Patron Portal v28 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>My Jadz AdCo Activity</title>
  <link rel="stylesheet" href="./styles.css"/>
  <link rel="stylesheet" href="./admin.css"/>
</head>
<body>
<main class="app admin-shell">
  <section class="page active">
    <header class="topbar">
      <div>
        <p class="eyebrow">Patron Portal</p>
        <h1>My Jadz AdCo Activity</h1>
        <p class="sub">Profile, member level, ShoutOuts, guest lists, messages, chats, and privacy.</p>
        <p id="portalSignedInAs" class="status">Not signed in</p>
        <p id="portalStatus" class="status">Loading patron portal...</p>
      </div>
    </header>

    <div id="portalLogin" class="card">
      <h2>Sign in</h2>
      <p class="sub">Sign in to view and update your patron profile.</p>
      <button id="portalGoogleLoginBtn" type="button">Continue with Google</button>
    </div>

    <div id="portalPanel" class="hidden">
      <div class="card account-status-card">
        <div>
          <p class="eyebrow">Account</p>
          <strong id="portalAccountName">—</strong>
          <p id="portalAccountEmail" class="sub small">—</p>
        </div>
        <button id="portalLogoutBtn" class="ghost" type="button">Sign out</button>
      </div>

      <nav class="admin-tabs">
        <button class="admin-tab active" data-panel="portalOverview" type="button">Overview</button>
        <button class="admin-tab" data-panel="portalProfile" type="button">Edit Profile</button>
        <button class="admin-tab" data-panel="portalShoutouts" type="button">My ShoutOuts</button>
        <button class="admin-tab" data-panel="portalGuestLists" type="button">My Guest Lists</button>
        <button class="admin-tab" data-panel="portalMessages" type="button">Messages</button>
        <button class="admin-tab" data-panel="portalChats" type="button">Chats</button>
        <button class="admin-tab" data-panel="portalPrivacy" type="button">Privacy / GDPR</button>
      </nav>

      <section id="portalOverview" class="admin-panel-section active">
        <div class="metric-grid">
          <div class="metric-card"><span>Member Level</span><strong id="metricMemberLevel">Patron</strong></div>
          <div class="metric-card"><span>Messages</span><strong id="metricMessages">0/0</strong></div>
          <div class="metric-card"><span>Chats</span><strong id="metricChats">0/0</strong></div>
          <div class="metric-card"><span>Member Since</span><strong id="metricMemberSince">—</strong></div>
        </div>
        <div class="card"><h2>Profile Summary</h2><div id="profileSummary" class="report-block"></div><p><a href="./role-request.html?v=28.8">Request Club Admin / DJ / Promoter Access</a></p></div>
      </section>

      <section id="portalProfile" class="admin-panel-section">
        <div class="card">
          <h2>Edit Profile</h2>
          <p class="sub small">Use legal first and last name for guest lists where ID checks are required.</p>
          <div class="profile-grid">
            <label>First Name <input id="editFirstName"/></label>
            <label>Last Name <input id="editLastName"/></label>
            <label>Display Name <input id="editDisplayName"/></label>
            <label>Phone Number <input id="editPhone"/></label>
            <label>City <input id="editCity"/></label>
            <label>Country <input id="editCountry"/></label>
            <label>Preferred Language
              <select id="editLanguage">
                <option value="">Select language</option>
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="es">Spanish</option>
                <option value="it">Italian</option>
                <option value="de">German</option>
                <option value="el">Greek</option>
              </select>
            </label>
            <label>Instagram Handle <input id="editInstagram"/></label>
            <label>X Handle <input id="editX"/></label>
          </div>
          <button id="saveProfileBtn" class="primary" type="button">Save Profile</button>
        </div>
      </section>

      <section id="portalShoutouts" class="admin-panel-section">
        <div class="card"><h2>My ShoutOuts</h2><div id="myShoutouts" class="report-block"></div></div>
      </section>

      <section id="portalGuestLists" class="admin-panel-section">
        <div class="card"><h2>My Guest Lists</h2><div id="myGuestLists" class="report-block"></div></div>
      </section>

      <section id="portalMessages" class="admin-panel-section">
        <div class="card" id="portalCompose">
          <h2>Send Message</h2>
          <div class="profile-grid">
            <label>Recipient Email<input id="composeRecipientEmail" placeholder="friend@example.com or club admin email"/></label>
            <label>Subject<input id="composeSubject" placeholder="Subject"/></label>
          </div>
          <label>Message<input id="composeBody" placeholder="Write your message..."/></label>
          <button id="sendMessageBtn" class="primary" type="button">Send Message</button>
        </div>
        <div class="card"><h2>Messages <span id="messageCountLabel">(0/0)</span></h2><div id="myMessages" class="report-block"></div></div>
      </section>

      <section id="portalChats" class="admin-panel-section">
        <div class="card"><h2>Chats <span id="chatCountLabel">(0/0)</span></h2><div id="myChats" class="report-block"></div></div>
      </section>

      <section id="portalPrivacy" class="admin-panel-section">
        <div class="card">
          <h2>Privacy / GDPR</h2>
          <div class="profile-grid">
            <label><input id="privacyMarketing" type="checkbox"/> Marketing consent</label>
            <label><input id="privacyAnalytics" type="checkbox"/> Analytics consent</label>
            <label><input id="privacySharing" type="checkbox"/> Third-party data sharing consent</label>
          </div>
          <button id="savePrivacyBtn" class="primary" type="button">Save Privacy Preferences</button>
          <button id="exportDataBtn" type="button">Download My Data JSON</button>
          <button id="deleteDataBtn" class="ghost" type="button">Request Data Delete</button>
          <div id="privacyReport" class="report-block"></div>
        </div>
      </section>
    </div>
  </section>
</main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./patron-portal-app.js?v=28.8"></script>
</body>
</html>

```

### `patron-portal-app.js`

```javascript
/* patron-portal-app.js v28 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmtDate = value => {
    if (!value) return "—";
    const d = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return isNaN(d) ? "—" : d.toLocaleDateString();
  };

  if (!window.firebaseConfig) { setText("portalStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let currentProfile = {};

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
      });
    });
    const tab = new URL(window.location.href).searchParams.get("tab");
    if (tab) {
      const map = {messages:"portalMessages", chats:"portalChats", profile:"portalProfile"};
      const btn = document.querySelector(`[data-panel='${map[tab] || ""}']`);
      if (btn) btn.click();
    }
  }

  async function loginGoogle() {
    try { setText("portalStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("portalStatus", `${e.code || "error"}: ${e.message}`); }
  }

  async function logout() { await auth.signOut(); window.location.href = "./?v=28.8"; }

  async function getCollectionSafe(name, filterFn, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) { return []; }
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  function fillProfileForm(profile, user) {
    byId("editFirstName").value = profile.firstName || "";
    byId("editLastName").value = profile.lastName || "";
    byId("editDisplayName").value = profile.displayName || user.displayName || "";
    byId("editPhone").value = profile.phone || user.phoneNumber || "";
    byId("editCity").value = profile.city || "";
    byId("editCountry").value = profile.country || "";
    byId("editLanguage").value = profile.preferredLanguage || "";
    byId("editInstagram").value = profile.instagramHandle || "";
    byId("editX").value = profile.xHandle || "";
    byId("privacyMarketing").checked = !!profile.marketingConsent;
    byId("privacyAnalytics").checked = !!profile.analyticsConsent;
    byId("privacySharing").checked = !!profile.dataSharingConsent;
  }

  async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;
    const updates = {
      firstName: byId("editFirstName").value.trim(),
      lastName: byId("editLastName").value.trim(),
      displayName: byId("editDisplayName").value.trim(),
      phone: byId("editPhone").value.trim(),
      city: byId("editCity").value.trim(),
      country: byId("editCountry").value.trim(),
      preferredLanguage: byId("editLanguage").value,
      instagramHandle: byId("editInstagram").value.trim(),
      xHandle: byId("editX").value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    updates.fullName = `${updates.firstName} ${updates.lastName}`.trim();
    await db.collection("users").doc(user.uid).set(updates, {merge:true});
    setText("portalStatus", "Profile updated.");
    await loadPortal(user);
  }

  async function savePrivacy() {
    const user = auth.currentUser;
    if (!user) return;
    const prefs = {
      marketingConsent: byId("privacyMarketing").checked,
      analyticsConsent: byId("privacyAnalytics").checked,
      dataSharingConsent: byId("privacySharing").checked,
      privacyUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("users").doc(user.uid).set(prefs, {merge:true});
    await db.collection("privacyConsents").add({uid:user.uid, email:user.email || "", ...prefs, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    setText("portalStatus", "Privacy preferences saved.");
    await loadPortal(user);
  }

  function downloadData() {
    const blob = new Blob([JSON.stringify(currentProfile, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jadz-patron-data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function requestDelete() {
    const user = auth.currentUser;
    if (!user || !confirm("Request deletion of your patron data?")) return;
    await db.collection("privacyConsents").add({type:"deleteRequest", uid:user.uid, email:user.email || "", requestedAt: firebase.firestore.FieldValue.serverTimestamp(), status:"pending"});
    setText("portalStatus", "Data delete request submitted.");
  }

  async function loadPortal(user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const profile = snap.exists ? snap.data() : {};
    currentProfile = {uid:user.uid, email:user.email || "", ...profile};

    if (!snap.exists) {
      await ref.set({displayName:user.displayName || "", email:user.email || "", photoURL:user.photoURL || "", memberLevel:"Patron", createdAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }

    fillProfileForm(profile, user);
    setText("portalAccountName", profile.displayName || user.displayName || user.email || "Patron");
    setText("portalAccountEmail", user.email || "");
    setText("metricMemberLevel", profile.memberLevel || "Patron");
    setText("metricMemberSince", fmtDate(profile.createdAt));

    const [shoutouts, guestLists, messages, chats] = await Promise.all([
      getCollectionSafe("shoutouts", x => x.submittedByUid === user.uid || x.submittedBy === user.email),
      getCollectionSafe("guestListRequests", x => x.submittedByUid === user.uid || x.guestEmail === user.email),
      getCollectionSafe("messages", x => x.recipientUid === user.uid || x.senderUid === user.uid || x.recipientEmail === user.email || x.senderEmail === user.email),
      getCollectionSafe("chatRooms", x => Array.isArray(x.participants) && x.participants.includes(user.uid))
    ]);

    const unreadMessages = messages.filter(x => (x.recipientUid === user.uid || x.recipientEmail === user.email) && !x.read).length;
    const unreadChats = chats.reduce((sum,x) => sum + Number(x.unreadCounts?.[user.uid] || 0), 0);

    setText("metricMessages", `${unreadMessages}/${messages.length}`);
    setText("metricChats", `${unreadChats}/${chats.length}`);
    setText("messageCountLabel", `(${unreadMessages}/${messages.length})`);
    setText("chatCountLabel", `(${unreadChats}/${chats.length})`);

    byId("profileSummary").innerHTML = simpleRows([
      ["Name", profile.fullName || profile.displayName || user.displayName || "—"],
      ["Email", user.email || "—"],
      ["City", profile.city || "—"],
      ["Country", profile.country || "—"],
      ["Preferred Language", profile.preferredLanguage || "—"],
      ["Member Level", profile.memberLevel || "Patron"]
    ]);

    byId("myShoutouts").innerHTML = shoutouts.length ? shoutouts.map(x => `<div class="queue-item"><strong>${esc(x.mainText || "ShoutOut")}</strong><p>${esc(x.locationName || x.clubName || "")} • ${esc(x.status || "pending")}</p><small>${esc(fmtDate(x.submittedAt))}</small></div>`).join("") : "<p class='sub'>No ShoutOuts yet.</p>";
    byId("myGuestLists").innerHTML = guestLists.length ? guestLists.map(x => `<div class="queue-item"><strong>${esc(x.locationName || x.clubLocationId || "Guest List")}</strong><p>${esc(x.eventOrDay || "")} • Party of ${esc(x.partySize || 1)} • ${esc(x.status || "pending")}</p><small>Promoter: ${esc(x.promoterName || x.promoterId || "")}</small></div>`).join("") : "<p class='sub'>No guest list requests yet.</p>";
    byId("myMessages").innerHTML = messages.length ? messages.map(x => `<div class="queue-item"><strong>${esc(x.subject || "Message")}</strong><p>${esc(x.body || x.preview || "")}</p><small>${esc(x.read ? "Read" : "Unread")}</small></div>`).join("") : "<p class='sub'>No messages yet.</p>";
    byId("myChats").innerHTML = chats.length ? chats.map(x => `<div class="queue-item"><strong>${esc(x.title || "Chat")}</strong><p>${esc(x.lastMessage || "")}</p><small>Unread: ${esc(x.unreadCounts?.[user.uid] || 0)}</small></div>`).join("") : "<p class='sub'>No chats yet.</p>";
    byId("privacyReport").innerHTML = simpleRows([["Marketing Consent", profile.marketingConsent ? "Yes" : "No"],["Analytics Consent", profile.analyticsConsent ? "Yes" : "No"],["Data Sharing Consent", profile.dataSharingConsent ? "Yes" : "No"]]);
  }


  async function sendPortalMessage() {
    const user = auth.currentUser;
    if (!user) return;
    const recipientEmail = byId("composeRecipientEmail")?.value.trim().toLowerCase();
    const subject = byId("composeSubject")?.value.trim() || "Message";
    const body = byId("composeBody")?.value.trim();
    if (!recipientEmail || !body) { setText("portalStatus", "Recipient email and message are required."); return; }
    await db.collection("messages").add({type:"patronMessage",senderUid:user.uid,senderEmail:user.email||"",recipientEmail,subject,body,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    setText("portalStatus", "Message sent.");
    byId("composeBody").value = "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    bind("portalGoogleLoginBtn", loginGoogle);
    bind("portalLogoutBtn", logout);
    bind("saveProfileBtn", saveProfile);
    bind("savePrivacyBtn", savePrivacy);
    bind("exportDataBtn", downloadData);
    bind("deleteDataBtn", requestDelete);
    bind("sendMessageBtn", sendPortalMessage);

    auth.onAuthStateChanged(user => {
      setText("portalSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      if (!user) {
        byId("portalLogin").classList.remove("hidden");
        byId("portalPanel").classList.add("hidden");
        setText("portalStatus", "Please sign in to continue.");
        return;
      }
      byId("portalLogin").classList.add("hidden");
      byId("portalPanel").classList.remove("hidden");
      setText("portalStatus", "Patron portal loaded.");
      loadPortal(user);
    });
  });
})();

```

### `admin.html`

```html
<!doctype html>
<html lang="en">
<head>
  <!-- Jadz AdCo ShoutOut Club Admin Portal v24 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jadz AdCo Club Admin</title>
  <link rel="stylesheet" href="./styles.css"/>
  <link rel="stylesheet" href="./admin.css"/>
</head>
<body>
<main id="adminPage" class="app admin-shell">
  <section class="page active">
    <header class="topbar admin-topbar">
      <div>
        <p class="eyebrow">Jadz AdCo Club Admin</p>
        <h1>Venue Command Center</h1>
        <p class="sub">Approve ShoutOuts, review venue performance, and reconcile account activity for this location.</p>
        <p id="adminSignedInAs" class="status">Not signed in</p>
        <p id="adminStatus" class="status">Loading admin app...</p>
      </div>
      <div class="card admin-club-card">
        <p class="eyebrow">Location View</p>
        <h2 id="clubName">Loading...</h2>
        <p class="sub small">Club admins only see the selected location.</p>
      </div>
    </header>

    <div id="adminLogin" class="card">
      <h2>Club admin sign-in</h2>
      <p class="sub">Sign in using an approved admin email. Master admins should use <strong>master-admin.html</strong>.</p>
      <p class="sub small"><strong>Sign-in note:</strong> Admin login uses the same popup configuration as the patron page. Use auth-debug.html if Microsoft still fails.</p>
      <div class="auth-grid">
        <button id="adminGoogleLoginBtn" type="button">Admin Google Login</button>
        <button id="adminMicrosoftLoginBtn" type="button">Admin Microsoft Login</button>
        <button id="adminFacebookLoginBtn" type="button">Admin Facebook Login</button>
      </div>
      <button id="adminLogoutBtn" class="ghost" type="button">Sign out / Switch account</button>
    </div>

    <div id="adminPanel" class="hidden">
      <nav class="admin-tabs">
        <button class="admin-tab active" data-panel="panelDashboard" type="button">Dashboard</button>
        <button class="admin-tab" data-panel="panelQueue" type="button">ShoutOut Queue</button>
        <button class="admin-tab" data-panel="panelAnalytics" type="button">Analytics</button>
        <button class="admin-tab" data-panel="panelAdvertising" type="button">Advertising</button>
        <button class="admin-tab" data-panel="panelGuestLists" type="button">Guest Lists / Promoters</button>
        <button class="admin-tab" data-panel="panelReconciliation" type="button">Account Reconciliation</button>
        <button class="admin-tab" data-panel="panelReports" type="button">Reports</button>
      </nav>

      <section id="panelDashboard" class="admin-panel-section active">
        <div class="metric-grid">
          <div class="metric-card"><span>Pending ShoutOuts</span><strong id="metricPending">0</strong></div>
          <div class="metric-card"><span>Live ShoutOut</span><strong id="metricLive">0</strong></div>
          <div class="metric-card"><span>Estimated ShoutOut Revenue</span><strong id="metricRevenue">$0</strong></div>
          <div class="metric-card"><span>Ad Impressions</span><strong id="metricAdImpressions">0</strong></div>
        </div>
        <div class="admin-grid">
          <div class="card">
            <h2>Venue Summary</h2>
            <div id="venueSummary" class="report-block"></div>
          </div>
          <div class="card">
            <h2>Currently Live</h2>
            <iframe id="liveFrame" class="admin-preview"></iframe>
            <p><a id="displayLink" target="_blank" href="#">Open Display Page</a></p>
          </div>
        </div>
      </section>

      <section id="panelQueue" class="admin-panel-section">
        <div class="card">
          <h2>Pending ShoutOut Queue</h2>
          <p class="sub small">Club admins see only this location's queue.</p>
          <div id="queueList"><p class="sub">Loading pending ShoutOuts...</p></div>
        </div>
      </section>

      <section id="panelAnalytics" class="admin-panel-section">
        <div class="admin-grid">
          <div class="card">
            <h2>Audience Analytics</h2>
            <div id="audienceReport" class="report-block"></div>
          </div>
          <div class="card">
            <h2>Music & Demand Intelligence</h2>
            <div id="musicReport" class="report-block"></div>
          </div>
        </div>
        <div class="card">
          <h2>Event / Reservation Funnel</h2>
          <div id="funnelReport" class="report-block"></div>
        </div>
      </section>

      <section id="panelAdvertising" class="admin-panel-section">
        <div class="admin-grid">
          <div class="card">
            <h2>Ad Performance</h2>
            <div id="adReport" class="report-block"></div>
          </div>
          <div class="card">
            <h2>Recommended Sponsor Categories</h2>
            <div id="sponsorReport" class="report-block"></div>
          </div>
        </div>
      </section>

      <section id="panelGuestLists" class="admin-panel-section">
        <div class="admin-grid">
          <div class="card"><h2>Guest List Requests</h2><div id="clubGuestListReport" class="report-block"></div></div>
          <div class="card"><h2>Promoter Performance</h2><div id="clubPromoterReport" class="report-block"></div></div>
        </div>
      </section>
      <section id="panelReconciliation" class="admin-panel-section">
        <div class="card">
          <h2>Account Reconciliation</h2>
          <p class="sub small">Prototype report for payouts, platform fees, ad revenue share, and ShoutOut activity.</p>
          <div id="reconciliationReport" class="report-block"></div>
        </div>
      </section>

      <section id="panelReports" class="admin-panel-section">
        <div class="card">
          <h2>Exportable Reports</h2>
          <div id="reportsList" class="report-block"></div>
        </div>
      </section>
    </div>
  </section>
</main>

<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./admin-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body>
</html>

```

### `admin-app.js`

```javascript
/* admin-app.js v24 - Club admin portal with analytics and reconciliation */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) { setText("adminStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const locationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  const loc = window.SHOUTOUT_CLUB_LOCATIONS?.[locationId] || { locationName: locationId, brand: locationId, genres: [], activityDates: [] };
  const MASTER_ADMIN_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_EMAILS || window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());
  const CLUB_ADMIN_EMAILS = (window.SHOUTOUT_ADMIN_EMAILS || []).map(x => x.toLowerCase());

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function adminAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");

    if (code === "auth/popup-closed-by-user") {
      return "Microsoft sign-in was interrupted before completion. This version uses redirect sign-in, but if you still see this, hard refresh and try again. Also verify Microsoft is enabled in Firebase Authentication.";
    }

    if (code === "auth/operation-not-allowed") {
      return "Microsoft sign-in is not enabled in Firebase Authentication. Go to Firebase Console > Authentication > Sign-in method > Microsoft and enable it.";
    }

    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Authentication. Add jadzadco.github.io and your Firebase hosting domains under Authentication > Settings > Authorized domains.";
    }

    if (code === "auth/account-exists-with-different-credential") {
      return "This email already exists with another sign-in method. Sign in with the original provider first, then link Microsoft later.";
    }

    if (code === "auth/invalid-credential" || code === "auth/invalid-oauth-client-id") {
      return "Microsoft OAuth configuration appears invalid. Verify Microsoft Client ID, Client Secret, and Firebase redirect URI in the Microsoft App Registration.";
    }

    return `${code}: ${message}`;
  }

  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }

  function isPopupIssue(e) {
    const code = e?.code || "";
    return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
  }

  async function signInWithPopupThenRedirect(provider, statusId, label) {
    try {
      setText(statusId, `Opening ${label} sign-in...`);
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (isPopupIssue(e)) {
        try {
          setText(statusId, `${label} popup was blocked or closed. Redirecting instead...`);
          await auth.signInWithRedirect(provider);
          return;
        } catch (redirectError) {
          setText(statusId, adminAuthErrorMessage ? adminAuthErrorMessage(redirectError) : `${redirectError.code || "error"}: ${redirectError.message}`);
          return;
        }
      }
      setText(statusId, adminAuthErrorMessage ? adminAuthErrorMessage(e) : `${e.code || "error"}: ${e.message}`);
    }
  }


  function displayUrl(item) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", locationId);
    if (item) {
      url.searchParams.set("main", item.mainText || "");
      url.searchParams.set("sub", item.subText || "");
      url.searchParams.set("template", item.template || "neon");
      url.searchParams.set("media", item.mediaUrl || "");
    }
    return url.href;
  }

  async function loginGoogle() {
    try {
      setText("adminStatus", "Opening Google sign-in...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginFacebook() {
    try {
      setText("adminStatus", "Opening Facebook sign-in...");
      await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider());
    } catch(e) {
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginMicrosoft() {
    try {
      const p = buildMicrosoftProvider();
      setText("adminStatus", "Opening Microsoft sign-in...");
      await auth.signInWithPopup(p);
    } catch(e) {
      setText("adminStatus", `${e.code || "error"}: ${e.message}`);
    }
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
      });
    });
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  function renderQueue() {
    const queueList = byId("queueList");
    queueList.innerHTML = "<p class='sub'>Loading pending ShoutOuts...</p>";

    db.collection("shoutouts")
      .where("clubLocationId","==",locationId)
      .where("status","==","pending")
      .onSnapshot(snapshot => {
        queueList.innerHTML = "";
        setText("metricPending", String(snapshot.size));

        if (snapshot.empty) {
          queueList.innerHTML = "<p class='sub'>No pending ShoutOuts yet.</p>";
          return;
        }

        const sortedDocs = snapshot.docs.slice().sort((a,b) => {
          const av = a.data().submittedAt?.toMillis ? a.data().submittedAt.toMillis() : 0;
          const bv = b.data().submittedAt?.toMillis ? b.data().submittedAt.toMillis() : 0;
          return bv - av;
        });

        sortedDocs.forEach(doc => {
          const item = doc.data();
          const div = document.createElement("div");
          div.className = "queue-item";
          div.innerHTML = `
            <strong>${esc(item.mainText || "")}</strong>
            <p>${esc(item.subText || "")}</p>
            <small>
              Location: ${esc(item.locationName || item.clubName || locationId)}
              • Template: ${esc(item.templateName || item.template || "neon")}
              • Ref: ${esc(item.referenceNumber || "")}
              • Submitted by: ${esc(item.submittedBy || "unknown")}
            </small>
            <div class="queue-actions">
              <button class="approve" type="button">Approve & Push Live</button>
              <button class="reject" type="button">Reject</button>
              <a class="buttonlike" target="_blank" href="${displayUrl(item)}">Preview</a>
            </div>`;
          div.querySelector(".approve").addEventListener("click", () => approve(doc.id, item));
          div.querySelector(".reject").addEventListener("click", () => reject(doc.id));
          queueList.appendChild(div);
        });
      }, e => { queueList.innerHTML = `<p class="status">${esc(e.message)}</p>`; });
  }


  async function createStatusNotification(item, status, title) {
    try {
      await db.collection("inboxNotifications").add({
        recipientUid: item.submittedByUid || "",
        recipientEmail: item.submittedBy || item.submittedByEmail || "",
        type: "shoutoutStatus",
        title: title || `ShoutOut ${status}`,
        body: `Your ShoutOut status is now ${status}.`,
        referenceNumber: item.referenceNumber || "",
        clubLocationId: item.clubLocationId || locationId,
        locationName: item.locationName || loc.locationName || locationId,
        status,
        read:false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        link:"./patron-portal.html?tab=shoutouts&v=28.8"
      });
    } catch(e) {}
  }
  async function auditShoutout(id, item, action) {
    try { await db.collection("shoutoutAudit").add({shoutoutId:id, action, clubLocationId:item.clubLocationId||locationId, referenceNumber:item.referenceNumber||"", actorUid:auth.currentUser?.uid||"", actorEmail:safeUser(auth.currentUser), createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
  }

  async function approve(id, item) {
    await db.collection("liveContent").doc(locationId).set({
      location: locationId,
      clubLocationId: locationId,
      locationName: item.locationName || loc.locationName,
      brandName: item.brandName || loc.brandName,
      template: item.template || "neon",
      templateName: item.templateName || "",
      mainText: item.mainText || "SHOUTOUT!",
      subText: item.subText || "",
      mediaUrl: item.mediaUrl || "",
      status: "approved",
      submittedBy: item.submittedBy || "unknown",
      approvedBy: safeUser(auth.currentUser),
      referenceNumber: item.referenceNumber || "",
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});

    await createStatusNotification(item,"approved","ShoutOut Approved");
    await auditShoutout(id,item,"approved");
    await createStatusNotification(item,"rejected","ShoutOut Rejected");
    await auditShoutout(id,item,"rejected");
    await db.collection("shoutouts").doc(id).delete();
    loadReports();
  }

  async function reject(id) {
    const snap = await db.collection("shoutouts").doc(id).get();
    const item = snap.exists ? snap.data() : {};
    await db.collection("shoutouts").doc(id).delete();
    loadReports();
  }

  async function getCollectionSafe(name, limit=500) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function loadReports() {
    const [users, shoutouts, liveDocs, events, guestLists] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("shoutouts"),
      getCollectionSafe("liveContent"),
      getCollectionSafe("events"),
      getCollectionSafe("guestListRequests")
    ]);

    const locationShoutouts = shoutouts.filter(x => (x.clubLocationId || x.location || x.club) === locationId);
    const locationEvents = events.filter(x => (x.locationId || x.clubLocationId || x.location) === locationId);
    const clubGuestLists = guestLists.filter(x => (x.clubLocationId || x.location) === locationId);
    const live = liveDocs.find(x => x.id === locationId);

    const estimatedShoutOutRevenue = locationShoutouts.length * 10;
    const adImpressions = Math.max(1250, locationShoutouts.length * 45 + 1250);
    const adClicks = Math.round(adImpressions * 0.035);

    setText("metricRevenue", money(estimatedShoutOutRevenue));
    setText("metricLive", live ? "1" : "0");
    setText("metricAdImpressions", adImpressions.toLocaleString());

    byId("venueSummary").innerHTML = simpleRows([
      ["Location", loc.locationName || locationId],
      ["City", loc.city || "—"],
      ["Region", loc.region || "—"],
      ["Country", loc.country || "—"],
      ["Genres", (loc.genres || []).join(", ") || "—"],
      ["Activity", (loc.activityDates || []).slice(0,3).join(" | ") || "—"]
    ]);

    const cities = {};
    users.forEach(u => { if (u.city) cities[u.city] = (cities[u.city] || 0) + 1; });
    const topCities = Object.entries(cities).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,n]) => `${c} (${n})`).join(", ") || "Not enough data yet";

    byId("audienceReport").innerHTML = simpleRows([
      ["Known patrons", users.length.toLocaleString()],
      ["Top patron cities", topCities],
      ["Marketing opt-ins", users.filter(u => u.marketingConsent).length.toLocaleString()],
      ["Analytics opt-ins", users.filter(u => u.analyticsConsent).length.toLocaleString()]
    ]);

    const genreCounts = {};
    users.forEach(u => (u.favoriteGenres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));
    (loc.genres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    const topGenres = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([g,n]) => `${g} (${n})`).join(", ") || "Not enough data yet";

    byId("musicReport").innerHTML = simpleRows([
      ["Top genres", topGenres],
      ["Venue genres", (loc.genres || []).join(", ") || "—"],
      ["Demand opportunity", "Compare searched genres to booked event genres"],
      ["Booking insight", "Use high-search genres to guide DJ/event bookings"]
    ]);

    byId("funnelReport").innerHTML = simpleRows([
      ["Events in system", locationEvents.length.toLocaleString()],
      ["Event views", "Placeholder until event click tracking is enabled"],
      ["Ticket clicks", "Placeholder until Ticketmaster/Eventbrite integration"],
      ["Reservation actions", "Reserve Table / VIP / Entry click tracking planned"]
    ]);

    byId("adReport").innerHTML = simpleRows([
      ["Estimated impressions", adImpressions.toLocaleString()],
      ["Estimated clicks", adClicks.toLocaleString()],
      ["Estimated CTR", `${((adClicks / adImpressions) * 100).toFixed(2)}%`],
      ["Best placements", "Splash screen, display wall, portable display"]
    ]);

    byId("sponsorReport").innerHTML = simpleRows([
      ["Alcohol / Spirits", "Tequila, champagne, cognac, vodka"],
      ["Fashion / Luxury", "Fragrance, designer apparel, watches"],
      ["Lifestyle", "Sneakers, travel, rideshare, beauty"],
      ["Local sponsors", "Restaurants, hookah lounges, promoters"]
    ]);

    const platformFee = Math.round(estimatedShoutOutRevenue * 0.20);
    const venueShare = estimatedShoutOutRevenue - platformFee;
    const adShare = Math.round(adImpressions / 1000 * 25);

    byId("reconciliationReport").innerHTML = simpleRows([
      ["Estimated ShoutOut gross", money(estimatedShoutOutRevenue)],
      ["Jadz platform fee estimate", money(platformFee)],
      ["Venue ShoutOut share estimate", money(venueShare)],
      ["Estimated local ad share", money(adShare)],
      ["Pending payout", money(venueShare + adShare)],
      ["Reconciliation status", "Prototype — connect Stripe/Square/PayPal later"]
    ]);


    const promoterCounts = {};
    clubGuestLists.forEach(x => {
      const key = x.promoterName || x.promoterId || "Unknown promoter";
      promoterCounts[key] = promoterCounts[key] || {requests:0, guests:0};
      promoterCounts[key].requests += 1;
      promoterCounts[key].guests += Number(x.totalGuestCount || x.partySize || 0);
    });

    if (byId("clubGuestListReport")) {
      byId("clubGuestListReport").innerHTML = clubGuestLists.length ? simpleRows([
        ["Total guest list requests", clubGuestLists.length.toLocaleString()],
        ["Total referred guests", clubGuestLists.reduce((s,x) => s + Number(x.totalGuestCount || x.partySize || 0), 0).toLocaleString()],
        ["Pending requests", clubGuestLists.filter(x => (x.status || "pending") === "pending").length.toLocaleString()]
      ]) : "<p class='sub'>No guest list requests yet.</p>";
    }

    if (byId("clubPromoterReport")) {
      const rows = Object.entries(promoterCounts)
        .sort((a,b) => b[1].requests - a[1].requests)
        .map(([promoter,v]) => [promoter, `${v.requests} requests / ${v.guests} guests`]);
      byId("clubPromoterReport").innerHTML = rows.length ? simpleRows(rows) : "<p class='sub'>No promoter guest-list data yet.</p>";
    }

    byId("reportsList").innerHTML = `
      <div class="report-list">
        <button type="button">Download Venue Summary CSV</button>
        <button type="button">Download ShoutOut Queue CSV</button>
        <button type="button">Download Ad Performance CSV</button>
        <button type="button">Download Reconciliation CSV</button>
      </div>
      <p class="sub small">CSV export buttons are placeholders for the next backend iteration.</p>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setText("clubName", loc.locationName || locationId);
    setText("adminStatus", "Admin app loaded. Sign in to continue.");
    byId("displayLink").href = `./display.html?location=${locationId}`;
    byId("liveFrame").src = `./display.html?location=${locationId}`;

    bind("adminGoogleLoginBtn", loginGoogle);
    bind("adminFacebookLoginBtn", loginFacebook);
    bind("adminMicrosoftLoginBtn", loginMicrosoft);
    bind("adminLogoutBtn", logout);

    auth.onAuthStateChanged(user => {
      const email = safeUser(user);
      setText("adminSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");

      if (!user) {
        byId("adminLogin").classList.remove("hidden");
        byId("adminPanel").classList.add("hidden");
        return;
      }

      if (!CLUB_ADMIN_EMAILS.includes(email) && !MASTER_ADMIN_EMAILS.includes(email)) {
        byId("adminLogin").classList.remove("hidden");
        byId("adminPanel").classList.add("hidden");
        setText("adminStatus", `Signed in as ${email}, but this email is not listed as an admin.`);
        return;
      }

      byId("adminLogin").classList.add("hidden");
      byId("adminPanel").classList.remove("hidden");
      setText("adminStatus", "Club admin verified.");
      renderQueue();
      loadReports();
    });
  });
})();

```

### `master-admin.html`

```html
<!doctype html>
<html lang="en">
<head>
  <!-- Jadz AdCo ShoutOut Master Admin Portal v24 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jadz AdCo Master Admin</title>
  <link rel="stylesheet" href="./styles.css"/>
  <link rel="stylesheet" href="./admin.css"/>
</head>
<body>
<main id="masterAdminPage" class="app admin-shell">
  <section class="page active">
    <header class="topbar admin-topbar">
      <div>
        <p class="eyebrow">Jadz AdCo Master Admin</p>
        <h1>Network Intelligence Center</h1>
        <p class="sub">Master admins can view all venues, all ShoutOut queues, all reports, advertiser data, reconciliation summaries, and network-level analytics.</p>
        <p id="masterSignedInAs" class="status">Not signed in</p>
        <p id="masterStatus" class="status">Loading master admin app...</p>
      </div>
      <div class="card admin-club-card">
        <p class="eyebrow">Network View</p>
        <h2>All Locations</h2>
        <p class="sub small">Jadz AdCo internal use only.</p>
      </div>
    </header>

    <div id="masterLogin" class="card">
      <h2>Master admin sign-in</h2>
      <p class="sub">Master admin access is controlled by <strong>SHOUTOUT_MASTER_ADMIN_EMAILS</strong>. Domain enforcement is disabled during development.</p>
      <p class="sub small"><strong>Sign-in note:</strong> Master Admin login uses the same popup configuration as the patron page for Google and Microsoft. Use auth-debug.html if Microsoft still fails.</p>
      <div class="auth-grid">
        <button id="masterGoogleLoginBtn" type="button">Master Google Login</button>
        <button id="masterMicrosoftLoginBtn" type="button">Master Microsoft Login</button>
      </div>
      <button id="masterLogoutBtn" class="ghost" type="button">Sign out / Switch account</button>
    </div>

    <div id="masterPanel" class="hidden">
      <div id="masterAccountStatusCard" class="card account-status-card">
        <div>
          <p class="eyebrow">Account Status</p>
          <strong id="masterPanelSignedInAs">Signed in</strong>
          <p id="masterPanelSecurityStatus" class="sub small">Security status pending...</p>
        </div>
        <button id="masterPanelLogoutBtn" class="ghost" type="button">Sign out</button>
      </div>
      <nav class="admin-tabs">
        <button class="admin-tab active" data-panel="networkDashboard" type="button">Network Dashboard</button>
        <button class="admin-tab" data-panel="allQueues" type="button">All ShoutOut Queues</button>
        <button class="admin-tab" data-panel="allReports" type="button">All Reports</button>
        <button class="admin-tab" data-panel="advertiserReports" type="button">Advertiser Reports</button>
        <button class="admin-tab" data-panel="promoterNetwork" type="button">Promoters</button>
        <button class="admin-tab" data-panel="networkReconciliation" type="button">Network Reconciliation</button>
        <button class="admin-tab" data-panel="partnerIntegrations" type="button">Ticketing Partners</button>
      </nav>

      <section id="networkDashboard" class="admin-panel-section active">
        <div class="metric-grid">
          <div class="metric-card"><span>Total Locations</span><strong id="netLocations">0</strong></div>
          <div class="metric-card"><span>Total Users</span><strong id="netUsers">0</strong></div>
          <div class="metric-card"><span>All Pending ShoutOuts</span><strong id="netPending">0</strong></div>
          <div class="metric-card"><span>Estimated Network Revenue</span><strong id="netRevenue">$0</strong></div>
        </div>
        <div class="admin-grid">
          <div class="card"><h2>Top Locations</h2><div id="topLocationsReport" class="report-block"></div></div>
          <div class="card"><h2>Audience Intelligence</h2><div id="networkAudienceReport" class="report-block"></div></div>
        </div>
      </section>

      <section id="allQueues" class="admin-panel-section">
        <div class="card">
          <h2>All Pending ShoutOut Queues</h2>
          <p class="sub small">Master admins see every location's queue.</p>
          <div id="allQueueList" class="report-block"></div>
        </div>
      </section>

      <section id="allReports" class="admin-panel-section">
        <div class="admin-grid">
          <div class="card"><h2>Music Demand</h2><div id="networkMusicReport" class="report-block"></div></div>
          <div class="card"><h2>Events / Ticketing</h2><div id="networkEventReport" class="report-block"></div></div>
        </div>
      </section>

      <section id="advertiserReports" class="admin-panel-section">
        <div class="card">
          <h2>Advertiser Intelligence</h2>
          <div id="networkAdReport" class="report-block"></div>
        </div>
      </section>

      <section id="promoterNetwork" class="admin-panel-section">
        <div class="card"><h2>Network Promoter Data</h2><div id="promoterNetworkReport" class="report-block"></div></div>
      </section>
      <section id="networkReconciliation" class="admin-panel-section">
        <div class="card">
          <h2>Network Account Reconciliation</h2>
          <div id="networkReconReport" class="report-block"></div>
        </div>
      </section>

      <section id="partnerIntegrations" class="admin-panel-section">
        <div class="card">
          <h2>Ticketing Partner Opportunities</h2>
          <div id="ticketPartnerReport" class="report-block"></div>
        </div>
      </section>
    </div>
  </section>
</main>

<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./master-admin-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body>
</html>

```

### `master-admin-app.js`

```javascript
/* master-admin-app.js v25.7
   Clean Master Admin app.
   Domain enforcement is disabled during development.
   Access is controlled by SHOUTOUT_MASTER_ADMIN_EMAILS + Google/Microsoft provider.
*/
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const safeUser = user => (user?.email || user?.phoneNumber || "unknown").toLowerCase();
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) {
    setText("masterStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  const MASTER_ADMIN_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_EMAILS || window.SHOUTOUT_ADMIN_EMAILS || []).map(x => String(x).toLowerCase());
  const ALLOWED_PROVIDERS = (window.SHOUTOUT_MASTER_ADMIN_ALLOWED_PROVIDERS || ["google.com", "microsoft.com"]).map(x => String(x).toLowerCase());
  const ENFORCE_DOMAINS = window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS === true;
  const ALLOWED_DOMAINS = (window.SHOUTOUT_MASTER_ADMIN_ALLOWED_DOMAINS || ["jadzadco.com", "jadzholdings.com"]).map(x => String(x).toLowerCase());
  const TEMPORARY_EXCEPTION_EMAILS = (window.SHOUTOUT_MASTER_ADMIN_TEMPORARY_EXCEPTION_EMAILS || []).map(x => String(x).toLowerCase());
  const REQUIRE_VERIFIED_EMAIL = window.SHOUTOUT_MASTER_ADMIN_REQUIRE_VERIFIED_EMAIL !== false;

  function bind(id, fn) {
    byId(id)?.addEventListener("click", fn);
  }

  function masterAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");

    if (code === "auth/popup-closed-by-user") {
      return "The sign-in popup was closed before completion. If this happens repeatedly, use Microsoft sign-in because it now uses full-page redirect, or retry Google and complete the popup flow.";
    }
    if (code === "auth/popup-blocked") {
      return "The browser blocked the sign-in popup. Allow popups for jadzadco.github.io and try again.";
    }
    if (code === "auth/operation-not-allowed") {
      return "This provider is not enabled in Firebase Authentication.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Authentication.";
    }
    if (code === "auth/account-exists-with-different-credential") {
      return "This email exists with another sign-in provider. Sign in with the original provider first.";
    }

    return `${code}: ${message}`;
  }

  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }

  async function loginGoogle() {
    try {
      setText("masterStatus", "Opening Google sign-in...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("masterStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function loginMicrosoft() {
    try {
      const p = buildMicrosoftProvider();
      setText("masterStatus", "Opening Microsoft sign-in...");
      await auth.signInWithPopup(p);
    } catch(e) {
      setText("masterStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function logout() {
    await auth.signOut();
    window.location.reload();
  }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
      });
    });
  }

  function getProviderIds(user) {
    return (user?.providerData || []).map(p => String(p.providerId || "").toLowerCase());
  }

  function getEmailDomain(email) {
    return String(email || "").toLowerCase().split("@")[1] || "";
  }

  function hasFirebaseMfaEnrollment(user) {
    try {
      return !!(user && user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length > 0);
    } catch {
      return false;
    }
  }

  function masterSecurityCheck(user) {
    if (!user) return { ok:false, reason:"Not signed in." };

    const email = safeUser(user);
    const domain = getEmailDomain(email);
    const providers = getProviderIds(user);

    if (!email || email === "unknown" || !email.includes("@")) {
      return { ok:false, reason:"Master Admin requires email-based Google or Microsoft sign-in." };
    }

    if (!MASTER_ADMIN_EMAILS.includes(email)) {
      return { ok:false, reason:`${email} is not listed in SHOUTOUT_MASTER_ADMIN_EMAILS.` };
    }

    const providerOk = providers.some(p => ALLOWED_PROVIDERS.includes(p));
    if (!providerOk) {
      return { ok:false, reason:`Master Admin must sign in with ${ALLOWED_PROVIDERS.join(" or ")}.` };
    }

    const isTemporaryException = TEMPORARY_EXCEPTION_EMAILS.includes(email);
    if (ENFORCE_DOMAINS && !ALLOWED_DOMAINS.includes(domain) && !isTemporaryException) {
      return { ok:false, reason:`Master Admin email must belong to ${ALLOWED_DOMAINS.join(" or ")}.` };
    }

    if (REQUIRE_VERIFIED_EMAIL && user.emailVerified === false) {
      return { ok:false, reason:"Master Admin email must be verified by the provider." };
    }

    const domainMessage = ENFORCE_DOMAINS
      ? `Domain enforcement enabled for ${ALLOWED_DOMAINS.join(" or ")}.`
      : "Domain enforcement disabled; explicit email allow-list is active.";

    const mfaMessage = hasFirebaseMfaEnrollment(user)
      ? "Firebase MFA enrollment detected."
      : "MFA should be enforced by the identity provider for production Master Admin accounts.";

    return { ok:true, reason:`Master admin verified. Providers: ${providers.join(", ")}. ${domainMessage} ${mfaMessage}` };
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  async function getCollectionSafe(name, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  function countBy(items, fn) {
    const out = {};
    items.forEach(item => {
      const key = fn(item);
      if (key) out[key] = (out[key] || 0) + 1;
    });
    return out;
  }

  function topList(counts, n=6) {
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v]) => `${k} (${v})`).join(", ") || "Not enough data yet";
  }

  async function loadNetworkReports() {
    const [users, shoutouts, liveDocs, locations, events, guestLists] = await Promise.all([
      getCollectionSafe("users"),
      getCollectionSafe("shoutouts"),
      getCollectionSafe("liveContent"),
      getCollectionSafe("clubLocations"),
      getCollectionSafe("events"),
      getCollectionSafe("guestListRequests")
    ]);

    const fallbackLocations = Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).map(([id, data]) => ({id, ...data}));
    const locationRows = locations.length ? locations : fallbackLocations;
    const pending = shoutouts.filter(x => (x.status || "pending") === "pending");
    const revenue = pending.length * 10 + liveDocs.length * 25;
    const impressions = Math.max(10000, locationRows.length * 1250 + pending.length * 50);
    const clicks = Math.round(impressions * 0.035);

    setText("netLocations", locationRows.length.toLocaleString());
    setText("netUsers", users.length.toLocaleString());
    setText("netPending", pending.length.toLocaleString());
    setText("netRevenue", money(revenue));

    const byLocation = countBy(pending, x => x.locationName || x.clubName || x.clubLocationId || x.location || "Unknown");
    byId("topLocationsReport").innerHTML = simpleRows([
      ["Top queue locations", topList(byLocation)],
      ["Live display docs", liveDocs.length.toLocaleString()],
      ["Seeded event records", events.length.toLocaleString()],
      ["Network status", "Prototype reporting live"]
    ]);

    const cityCounts = countBy(users, x => x.city);
    const genreCounts = {};
    users.forEach(u => (u.favoriteGenres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));
    locationRows.forEach(l => (l.genres || []).forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1));

    byId("networkAudienceReport").innerHTML = simpleRows([
      ["Known patrons", users.length.toLocaleString()],
      ["Top cities", topList(cityCounts)],
      ["Marketing opt-ins", users.filter(u => u.marketingConsent).length.toLocaleString()],
      ["Analytics opt-ins", users.filter(u => u.analyticsConsent).length.toLocaleString()]
    ]);

    byId("networkMusicReport").innerHTML = simpleRows([
      ["Top genres", topList(genreCounts, 8)],
      ["Booking insight", "Compare patron searched genres with actual event programming"],
      ["High-value trend", "Afro House, Hip Hop, Deep House, EDM, Amapiano"],
      ["Recommended report", "Demand gap: searched genre vs booked event genre"]
    ]);

    byId("networkEventReport").innerHTML = simpleRows([
      ["Internal event records", events.length.toLocaleString()],
      ["Ticketmaster Discovery API", "Recommended for event discovery"],
      ["Ticketmaster Partner API", "Restricted to official distribution relationships"],
      ["Eventbrite API", "Useful for event creation, management, attendee/order workflows"]
    ]);

    byId("networkAdReport").innerHTML = simpleRows([
      ["Estimated impressions", impressions.toLocaleString()],
      ["Estimated clicks", clicks.toLocaleString()],
      ["Estimated CTR", `${((clicks / impressions) * 100).toFixed(2)}%`],
      ["Top sponsor categories", "Spirits, fashion, fragrance, sneakers, luxury, rideshare"],
      ["Best media units", "Splash ads, LED display wall, portable displays, window displays"]
    ]);

    const gross = revenue + Math.round(impressions / 1000 * 25);
    const platformShare = Math.round(gross * 0.35);
    const venueShare = gross - platformShare;

    byId("networkReconReport").innerHTML = simpleRows([
      ["Estimated gross revenue", money(gross)],
      ["Estimated Jadz platform share", money(platformShare)],
      ["Estimated venue payouts", money(venueShare)],
      ["Locations requiring payout", locationRows.length.toLocaleString()],
      ["Reconciliation status", "Prototype — connect payment processor ledger later"]
    ]);

    byId("ticketPartnerReport").innerHTML = `
      ${simpleRows([
        ["Ticketmaster Discovery API", "Open developer API for event discovery and outbound ticket links"],
        ["Ticketmaster Affiliate / Distribution", "Apply for affiliate access and Impact publisher tracking"],
        ["Ticketmaster Partner API", "Restricted; requires official distribution relationship"],
        ["Eventbrite API", "Good candidate for event publishing, checkout customization, attendees, orders, webhooks"],
        ["Jadz near-term approach", "Start with outbound ticket links, then affiliate tracking, then direct checkout/reservation integrations"]
      ])}
      <p class="sub small">Use Events as a discovery layer first. Add affiliate tracking after program approval. Use Jadz-owned VIP/table reservations for higher-margin revenue.</p>`;


    if (byId("promoterNetworkReport")) {
      const promoterCounts = {};
      guestLists.forEach(x => {
        const key = x.promoterName || x.promoterId || "Unknown promoter";
        promoterCounts[key] = promoterCounts[key] || {requests:0, guests:0};
        promoterCounts[key].requests += 1;
        promoterCounts[key].guests += Number(x.partySize || 0);
      });
      const rows = Object.entries(promoterCounts)
        .sort((a,b) => b[1].requests - a[1].requests)
        .map(([promoter,v]) => [promoter, `${v.requests} guest list requests / ${v.guests} guests`]);
      byId("promoterNetworkReport").innerHTML = rows.length ? simpleRows(rows) : "<p class='sub'>No promoter referrals yet.</p>";
    }

    byId("allQueueList").innerHTML = pending.length ? pending.map(item => `
      <div class="queue-item">
        <strong>${esc(item.mainText || "Untitled ShoutOut")}</strong>
        <p>${esc(item.subText || "")}</p>
        <small>
          ${esc(item.locationName || item.clubName || item.clubLocationId || "Unknown location")}
          • ${esc(item.referenceNumber || "")}
          • ${esc(item.submittedBy || "unknown")}
        </small>
      </div>`).join("") : "<p class='sub'>No pending ShoutOuts across the network.</p>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setText("masterStatus", "Master admin app loaded. Sign in to continue.");

    bind("masterGoogleLoginBtn", loginGoogle);
    bind("masterMicrosoftLoginBtn", loginMicrosoft);
    bind("masterLogoutBtn", logout);
    bind("masterPanelLogoutBtn", logout);

    auth.onAuthStateChanged(user => {
      setText("masterSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");
      setText("masterPanelSignedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");

      if (!user) {
        byId("masterLogin").classList.remove("hidden");
        byId("masterPanel").classList.add("hidden");
        return;
      }

      const check = masterSecurityCheck(user);
      if (!check.ok) {
        byId("masterLogin").classList.remove("hidden");
        byId("masterPanel").classList.add("hidden");
        setText("masterStatus", `Access denied: ${check.reason}`);
        return;
      }

      byId("masterLogin").classList.add("hidden");
      byId("masterPanel").classList.remove("hidden");
      setText("masterStatus", check.reason);
      setText("masterPanelSecurityStatus", check.reason);
      loadNetworkReports();
    });
  });
})();

```

### `promoter-admin.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jadz Promoter Admin</title>
  <link rel="stylesheet" href="./styles.css"/>
  <link rel="stylesheet" href="./admin.css"/>
</head>
<body>
<main class="app admin-shell">
  <section class="page active">
    <header class="topbar">
      <div>
        <p class="eyebrow">Promoter Admin</p>
        <h1>Promoter Referral Dashboard</h1>
        <p class="sub">Track patron app signup referrals and guest list referrals by period and club.</p>
        <p id="promoterSignedInAs" class="status">Not signed in</p>
        <p id="promoterStatus" class="status">Loading promoter admin...</p>
      </div>
    </header>

    <div id="promoterLogin" class="card">
      <h2>Promoter sign-in</h2>
      <button id="promoterGoogleLoginBtn" type="button">Continue with Google</button>
    </div>

    <div id="promoterPanel" class="hidden">
      <div class="card account-status-card">
        <div>
          <p class="eyebrow">Account Status</p>
          <strong id="promoterPanelSignedInAs">Signed in</strong>
          <p id="promoterAccessSummary" class="sub small">Access pending...</p>
        </div>
        <button id="promoterLogoutBtn" class="ghost" type="button">Sign out</button>
      </div>

      <div class="card">
        <h2>Reporting Period</h2>
        <select id="periodFilter">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly" selected>Monthly</option>
          <option value="sixMonths">6 months</option>
          <option value="oneYear">1 year</option>
          <option value="twoYears">2 years</option>
          <option value="fiveYears">5 years</option>
        </select>
      </div>

      <div class="metric-grid">
        <div class="metric-card"><span>Patron Signup Referrals</span><strong id="metricSignupRefs">0</strong></div>
        <div class="metric-card"><span>Guest List Referrals</span><strong id="metricGuestRefs">0</strong></div>
        <div class="metric-card"><span>Total Guest Count</span><strong id="metricGuestCount">0</strong></div>
        <div class="metric-card"><span>Estimated Promoter Credit</span><strong id="metricPromoterCredit">$0</strong></div>
      </div>

      <div class="admin-grid">
        <div class="card"><h2>Guest List Referrals by Club</h2><div id="guestByClubReport" class="report-block"></div></div>
        <div class="card"><h2>Signup Referrals</h2><div id="signupReport" class="report-block"></div></div>
      </div>

      <div class="card"><h2>Recent Guest List Requests</h2><div id="recentGuestListReport" class="report-block"></div></div>
    </div>
  </section>
</main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./promoter-admin-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body>
</html>

```

### `promoter-admin-app.js`

```javascript
/* promoter-admin-app.js v26 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = value => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(value || 0);

  if (!window.firebaseConfig) { setText("promoterStatus", "firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const promoterAdmins = window.SHOUTOUT_PROMOTER_ADMINS || {};

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }
  async function loginGoogle() {
    try { setText("promoterStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("promoterStatus", `${e.code || "error"}: ${e.message}`); }
  }
  async function logout() { await auth.signOut(); window.location.reload(); }

  function getPeriodStart(period) {
    const d = new Date();
    const days = {daily:1, weekly:7, biweekly:14, monthly:30, sixMonths:183, oneYear:365, twoYears:730, fiveYears:1825}[period] || 30;
    d.setDate(d.getDate() - days);
    return d;
  }
  function toDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    return new Date(value);
  }
  function inPeriod(item, field, start) {
    const d = toDate(item[field]);
    return d && d >= start;
  }
  async function getCollectionSafe(name, limit=1000) {
    try { const snap = await db.collection(name).limit(limit).get(); return snap.docs.map(d => ({id:d.id, ...d.data()})); }
    catch(e) { console.warn(`Could not read ${name}:`, e.message); return []; }
  }
  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }
  function getAllowedPromoters(email) {
    return promoterAdmins[String(email || "").toLowerCase()] || [];
  }
  function isAllowed(allowed, promoterId) {
    return allowed.includes("*") || allowed.includes(promoterId);
  }

  async function loadReports() {
    const email = (auth.currentUser?.email || "").toLowerCase();
    const allowed = getAllowedPromoters(email);
    const start = getPeriodStart(byId("periodFilter").value);
    const [guestLists, users] = await Promise.all([getCollectionSafe("guestListRequests"), getCollectionSafe("users")]);

    const filteredGuests = guestLists.filter(x => isAllowed(allowed, x.promoterId)).filter(x => inPeriod(x, "submittedAt", start));
    const filteredUsers = users.filter(x => isAllowed(allowed, x.referredByPromoterId)).filter(x => inPeriod(x, "createdAt", start) || inPeriod(x, "updatedAt", start));

    const totalParty = filteredGuests.reduce((sum,x) => sum + Number(x.partySize || 0), 0);
    const estimatedCredit = filteredUsers.length * 2 + filteredGuests.length * 5;
    setText("metricSignupRefs", filteredUsers.length.toLocaleString());
    setText("metricGuestRefs", filteredGuests.length.toLocaleString());
    setText("metricGuestCount", totalParty.toLocaleString());
    setText("metricPromoterCredit", money(estimatedCredit));

    const byClub = {};
    filteredGuests.forEach(x => {
      const key = x.locationName || x.clubLocationId || "Unknown";
      byClub[key] = byClub[key] || {requests:0, guests:0};
      byClub[key].requests += 1;
      byClub[key].guests += Number(x.partySize || 0);
    });
    const clubRows = Object.entries(byClub).sort((a,b) => b[1].requests - a[1].requests).map(([club,v]) => [club, `${v.requests} requests / ${v.guests} guests`]);
    byId("guestByClubReport").innerHTML = clubRows.length ? simpleRows(clubRows) : "<p class='sub'>No guest list referrals for this period.</p>";
    byId("signupReport").innerHTML = simpleRows([
      ["Allowed promoter IDs", allowed.join(", ")],
      ["Signup referrals", filteredUsers.length.toLocaleString()],
      ["Guest list referrals", filteredGuests.length.toLocaleString()]
    ]);
    const recent = filteredGuests.sort((a,b) => (toDate(b.submittedAt)?.getTime() || 0) - (toDate(a.submittedAt)?.getTime() || 0)).slice(0, 20);
    byId("recentGuestListReport").innerHTML = recent.length ? recent.map(x => `
      <div class="queue-item"><strong>${esc(x.guestName || "Guest")}</strong>
      <p>${esc(x.locationName || x.clubLocationId)} • ${esc(x.eventOrDay)} • Party of ${esc(x.partySize || 1)}</p>
      <small>Promoter: ${esc(x.promoterName || x.promoterId)} • Status: ${esc(x.status || "pending")}</small></div>`).join("") : "<p class='sub'>No recent guest list requests.</p>";
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind("promoterGoogleLoginBtn", loginGoogle);
    bind("promoterLogoutBtn", logout);
    byId("periodFilter")?.addEventListener("change", loadReports);
    auth.onAuthStateChanged(user => {
      const email = (user?.email || "").toLowerCase();
      const allowed = getAllowedPromoters(email);
      setText("promoterSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      setText("promoterPanelSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      if (!user) {
        byId("promoterLogin").classList.remove("hidden");
        byId("promoterPanel").classList.add("hidden");
        setText("promoterStatus", "Sign in to continue.");
      } else if (!allowed.length) {
        byId("promoterLogin").classList.remove("hidden");
        byId("promoterPanel").classList.add("hidden");
        setText("promoterStatus", `${email} is not listed as a promoter admin.`);
      } else {
        byId("promoterLogin").classList.add("hidden");
        byId("promoterPanel").classList.remove("hidden");
        setText("promoterStatus", "Promoter admin verified.");
        setText("promoterAccessSummary", allowed.includes("*") ? "Access: all promoters." : `Access: ${allowed.join(", ")}`);
        loadReports();
      }
    });
  });
})();

```

### `role-request.html`

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Request Admin / DJ / Promoter Access</title><link rel="stylesheet" href="./styles.css"/><link rel="stylesheet" href="./admin.css"/></head><body><main class="app admin-shell"><section class="page active"><header class="topbar"><div><p class="eyebrow">Role Request</p><h1>Request additional access</h1><p class="sub">All users start as regular patrons. Request Club Admin, DJ, or Promoter access here.</p><p id="roleSignedInAs" class="status">Not signed in</p><p id="roleStatus" class="status">Loading...</p></div></header><div id="roleLogin" class="card"><button id="roleGoogleLoginBtn">Continue with Google</button></div><div id="roleForm" class="card hidden"><h2>Additional Access Request</h2><div class="profile-grid"><label>Request Type<select id="requestType"><option value="clubAdmin">Club Admin</option><option value="dj">DJ</option><option value="promoter">Promoter</option></select></label><label>Public / Company / DJ Name<input id="publicName" placeholder="DJ Nova, ABC Promotions, etc."/></label><label>Instagram<input id="instagram"/></label><label>Phone<input id="phone"/></label><label>Website / Link<input id="website"/></label></div><label>Select one or more clubs/events you work with<select id="relatedLocations" multiple size="8"></select></label><label>Notes<textarea id="roleNotes" placeholder="Explain your role, clubs, events, promoter company, residency, or admin relationship."></textarea></label><button id="submitRoleRequestBtn" class="primary">Submit Request</button><a href="./patron-portal.html?v=28.8">Back to My Profile</a></div></section></main><script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script><script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script><script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script><script src="./firebase-config.js?v=28.8"></script><script src="./shared-data.js?v=28.8"></script><script src="./role-request-app.js?v=28.8"></script></body></html>
```

### `role-request-app.js`

```javascript
/* role-request-app.js v28.5 */(function(){const byId=id=>document.getElementById(id),set=(id,v)=>{const e=byId(id);if(e)e.textContent=v;};firebase.initializeApp(window.firebaseConfig);const auth=firebase.auth(),db=firebase.firestore();byId("roleGoogleLoginBtn").onclick=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());byId("submitRoleRequestBtn").onclick=async()=>{const u=auth.currentUser;if(!u){set("roleStatus","Please sign in first.");return;}const roleType=byId("roleType").value,publicName=byId("rolePublicName").value.trim(),clubs=byId("roleClubs").value.trim(),link=byId("roleLink").value.trim();await db.collection("roleRequests").add({uid:u.uid,email:u.email||"",roleType,publicName,clubsOrEvents:clubs,link,status:"pending",createdAt:firebase.firestore.FieldValue.serverTimestamp()});if(roleType==="dj")await db.collection("djProfiles").doc(u.uid).set({uid:u.uid,email:u.email||"",publicName,clubsOrEvents:clubs,link,status:"pending",createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});if(roleType==="promoter")await db.collection("promoterProfiles").doc(u.uid).set({uid:u.uid,email:u.email||"",publicName,clubsOrEvents:clubs,link,status:"pending",createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});set("roleStatus","Request submitted for approval.");};auth.onAuthStateChanged(u=>set("roleStatus",u?`Signed in as ${u.email}`:"Please sign in."));})();
```

### `display.html`

```html
<!doctype html>
<html lang="en">
<head>
  <!-- Jadz AdCo ShoutOut Display Page v19. Use only with ?location=... -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jadz AdCo ShoutOut Display</title>
  <link rel="stylesheet" href="./display.css"/>
</head>
<body class="display">
  <main id="displayCanvas" class="display-canvas">
    <div id="displayBrand" class="brand">JADZ ADCO</div>
    <div class="display-center">
      <div id="mediaSlot" class="media-slot hidden"></div>
      <h1 id="displayMain">USE SHOUT OUT</h1>
      <h2 id="displaySub"></h2>
    </div>
    <div class="ticker">Live on Jadz AdCo • Approved content only</div>
  </main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./display-app.js?v=28.8"></script>
<script src="./notification-center.js?v=28.8"></script>
</body>
</html>

```

### `display-app.js`

```javascript
/* display-app.js v19 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  if (!window.firebaseConfig) { byId("displayMain").textContent = "CONFIG ERROR"; byId("displaySub").textContent = "firebase-config.js missing"; return; }
  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.firestore();
  const locationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[locationId] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  const templates = window.SHOUTOUT_TEMPLATES || {};

  function render(data) {
    const t = templates[data.template || "neon"] || templates.neon || {};
    const canvas = byId("displayCanvas");
    canvas.classList.remove("gold","ice","fire");
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
    byId("displayBrand").textContent = data.locationName ? `${data.locationName} x JADZ ADCO` : (loc.brand || "JADZ ADCO");
    byId("displayMain").textContent = data.mainText || loc.defaultMain || "USE SHOUT OUT";
    byId("displaySub").textContent = data.subText || "";
    const mediaSlot = byId("mediaSlot");
    if (data.mediaUrl) {
      mediaSlot.classList.remove("hidden");
      const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(data.mediaUrl);
      mediaSlot.innerHTML = isVideo ? `<video src="${esc(data.mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(data.mediaUrl)}" alt="ShoutOut media">`;
    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (qs("main","")) {
      render({ mainText: qs("main"), subText: qs("sub"), template: qs("template","neon"), mediaUrl: qs("media",""), locationName: loc.locationName });
      return;
    }
    db.collection("liveContent").doc(locationId).onSnapshot(doc => {
      render(doc.exists ? doc.data() : {locationName: loc.locationName, mainText: loc.defaultMain, subText: loc.defaultSub, template: "neon"});
    }, e => render({mainText:"DISPLAY ERROR", subText:e.message, template:"fire", locationName: loc.locationName}));
  });
})();

/* v28.5 media renderer for Xibo HTML */
(function(){
function byId(id){return document.getElementById(id);}
window.jadzRenderDisplayMedia=function(data){
 if(!data||!data.mediaUrl)return;
 let host=byId("mediaHost")||byId("displayMedia")||document.querySelector(".display-media");
 if(!host){host=document.createElement("div");host.id="mediaHost";host.className="display-media";document.body.appendChild(host);}
 host.innerHTML=data.mediaType==="video"?`<video src="${data.mediaUrl}" autoplay muted loop playsinline style="max-width:100%;max-height:80vh;border-radius:18px;"></video>`:`<img src="${data.mediaUrl}" alt="" style="max-width:100%;max-height:80vh;border-radius:18px;">`;
};
})();

```

### `notification-center.js`

```javascript
/* notification-center.js v28.4 */
(function(){
"use strict";
function byId(id){return document.getElementById(id);}
if(window.JADZ_NOTIFICATION_CENTER_LOADED)return;
window.JADZ_NOTIFICATION_CENTER_LOADED=true;
function shell(){if(byId("jadzGlobalStatusBar"))return;let b=document.createElement("div");b.id="jadzGlobalStatusBar";b.className="jadz-global-status-bar hidden";b.innerHTML='<a id="jadzInboxLink" href="./patron-portal.html?tab=messages&v=28.8">Messages (0/0)</a><a id="jadzChatsLink" href="./patron-portal.html?tab=chats&v=28.8">Chats (0/0)</a><a id="jadzNotificationsLink" href="./patron-portal.html?tab=messages&v=28.8">Notifications (0)</a>';document.body.appendChild(b);}
async function counts(u){let o={tm:0,um:0,tc:0,uc:0,un:0};if(!u||!window.firebase||!firebase.firestore)return o;let db=firebase.firestore();try{let s=await db.collection("messages").where("recipientUid","==",u.uid).limit(1000).get();o.tm=s.size;s.forEach(d=>{if(!d.data().read)o.um++;});}catch(e){}try{let s=await db.collection("chatRooms").where("participants","array-contains",u.uid).limit(1000).get();o.tc=s.size;s.forEach(d=>{o.uc+=Number((d.data().unreadCounts||{})[u.uid]||0);});}catch(e){}try{let s=await db.collection("inboxNotifications").where("recipientUid","==",u.uid).limit(1000).get();s.forEach(d=>{if(!d.data().read)o.un++;});}catch(e){}return o;}
async function update(u){shell();let b=byId("jadzGlobalStatusBar");if(!b)return;if(!u||location.pathname.endsWith("/patron-portal.html")){b.classList.add("hidden");return;}let c=await counts(u);b.classList.remove("hidden");byId("jadzInboxLink").textContent=`Messages (${c.um}/${c.tm})`;byId("jadzChatsLink").textContent=`Chats (${c.uc}/${c.tc})`;byId("jadzNotificationsLink").textContent=`Notifications (${c.un})`;}
document.addEventListener("DOMContentLoaded",()=>{shell();let w=setInterval(()=>{try{if(window.firebase&&firebase.auth){clearInterval(w);firebase.auth().onAuthStateChanged(u=>{update(u);if(u)setInterval(()=>update(u),60000);});}}catch(e){}},250);});
})();
```

### `styles.css`

```css
/* Jadz AdCo ShoutOut shared styles v19 */
:root{--line:rgba(255,255,255,.18);--text:#f4f6ff;--muted:#c9cee5;--accent:#62eaff;--hot:#ff64d8;--lime:#dfff5a}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;background:radial-gradient(circle at 20% 10%,#7a2cff55,transparent 34%),radial-gradient(circle at 80% 20%,#1373ff88,transparent 38%),linear-gradient(135deg,#14002e,#001766 75%,#111);color:var(--text)}
.app{max-width:1180px;margin:auto;padding:24px}.page{display:none;min-height:100vh}.page.active{display:block}.hidden{display:none!important}
.login-wrap{min-height:calc(100vh - 48px);display:grid;align-items:start;padding-top:28px;max-width:760px;margin:0 auto}.login-card,.card,.club-option,.notice{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.07));box-shadow:0 22px 70px rgba(0,0,0,.35);border-radius:30px;padding:26px;backdrop-filter:blur(14px)}
.login-card{text-align:center}.hero-logo{display:block;width:min(280px,72vw);max-height:180px;object-fit:contain;margin:8px auto 18px;border-radius:28px;filter:drop-shadow(0 0 10px #ff4fd8) drop-shadow(0 0 22px #62eaff)}.login-card h2{font-size:46px;margin:8px 0 6px}.login-copy{color:var(--muted);font-size:17px;line-height:1.45;margin:0 auto 12px;max-width:540px}.status{color:var(--lime);font-weight:900}
.signin,.full{width:100%;margin:10px 0;display:flex;align-items:center;justify-content:center;gap:12px;min-height:58px;padding:16px 18px;border-radius:18px;background:rgba(255,255,255,.12);border:1px solid var(--line);color:var(--text);font-weight:900;font-size:16px;cursor:pointer}.signin.google{background:#fff;color:#222}.signin.microsoft{background:#f7f7f7;color:#222}.signin.facebook,.phone-row .phone{background:#1877f2;color:#fff;border-color:#62eaff}.ghost{background:rgba(255,255,255,.08)}.primary{background:linear-gradient(90deg,var(--hot),var(--accent));color:#06101c;border:0}.icon{width:28px;height:28px;border-radius:8px;display:inline-grid;place-items:center}.google-icon svg{width:22px;height:22px;display:block}.fb-icon{font-family:Arial;font-size:28px;background:#1877f2;color:#fff}.ms-icon{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:transparent}.ms-icon i{display:block;width:12px;height:12px}.ms-icon i:nth-child(1){background:#f25022}.ms-icon i:nth-child(2){background:#7fba00}.ms-icon i:nth-child(3){background:#00a4ef}.ms-icon i:nth-child(4){background:#ffb900}
.divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-weight:800;margin:16px 0}.divider:before,.divider:after{content:"";height:1px;background:var(--line);flex:1}.phone-row{display:grid;grid-template-columns:1fr 190px;gap:12px;align-items:center;margin-top:10px}.phone-row input{margin-top:0;min-height:58px}
.topbar{display:flex;gap:24px;justify-content:space-between;margin-bottom:22px}.topbar h1,.confirmation h1{font-size:clamp(38px,6vw,88px);line-height:.9;letter-spacing:-.05em;margin:10px 0 18px;text-transform:uppercase}.eyebrow{color:var(--lime);font-weight:1000;letter-spacing:.12em;text-transform:uppercase}.sub{color:var(--muted);font-size:18px;max-width:760px}.small{font-size:14px}
.filters,.template-grid,.auth-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}button,.buttonlike{border:1px solid var(--line);background:rgba(255,255,255,.1);color:var(--text);padding:14px 18px;border-radius:14px;font-weight:900;cursor:pointer;text-decoration:none;display:inline-block}button:hover,.signin:hover{border-color:var(--accent);transform:translateY(-1px)}
label{display:block;margin:14px 0;color:var(--muted);font-weight:800}input,select{width:100%;margin-top:7px;padding:15px;border-radius:15px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--text);font-size:16px}select option{color:#111}.search{font-size:18px;margin-bottom:14px}
.category-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:22px}.category-card{min-height:150px;font-size:28px;border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.07));box-shadow:0 22px 70px rgba(0,0,0,.35)}.category-card.hot,.linklike.hot{background:linear-gradient(90deg,var(--hot),var(--accent));color:#06101c}.linklike{border:0;background:transparent;color:var(--accent);padding:0;font-size:inherit;text-decoration:underline;display:inline;font-weight:1000}.linklike:hover{transform:none}.category-sentence{font-size:22px;line-height:1.55}
.club-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;margin-top:18px}.club-option{min-height:260px;display:flex;flex-direction:column;justify-content:space-between}.club-option-head{display:flex;justify-content:space-between;gap:16px}.club-option h3{margin:0;font-size:28px}.club-option p{color:var(--muted)}.club-option strong{color:var(--lime);white-space:nowrap}.dj{font-weight:900}.notice{margin-bottom:18px;color:var(--lime);font-weight:900}.badge-row,.button-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}.badge-row span{border:1px solid var(--line);background:rgba(255,255,255,.11);padding:9px 13px;border-radius:999px;font-size:13px}
.composer,.template-layout{display:grid;grid-template-columns:1fr 1fr;gap:18px}.preview iframe{width:100%;height:390px;border:1px solid var(--line);border-radius:18px;background:#000}.template{min-height:150px;border-radius:18px;border:1px solid var(--line);padding:16px;cursor:pointer;overflow:hidden}.template.selected{outline:3px solid var(--accent)}.template .name{font-weight:900;font-size:20px}.template .tag{color:var(--muted);font-size:13px}.selected-summary,.receipt{min-height:120px;border:1px dashed var(--line);border-radius:18px;padding:18px;color:var(--muted);margin-bottom:18px;background:rgba(0,0,0,.15)}.template.neon{background:radial-gradient(circle at 20% 20%,#ff4fd8,transparent 35%),radial-gradient(circle at 80% 40%,#35d6ff,transparent 40%),#080a19}.template.gold{background:radial-gradient(circle at 30% 20%,#ffd45a,transparent 35%),#1f1304}.template.ice{background:radial-gradient(circle at 70% 40%,#b6f3ff,transparent 40%),#07162c}.template.fire{background:radial-gradient(circle at 50% 50%,#ff6a00,transparent 40%),#180404}.empty{grid-column:1/-1;padding:30px;text-align:center;border:1px dashed var(--line);border-radius:20px;color:var(--muted)}
@media(max-width:900px){.topbar,.composer,.template-layout{display:grid;grid-template-columns:1fr}.app{padding:16px}.login-wrap{padding-top:18px}.login-card{border-radius:24px}}@media(max-width:520px){.login-card,.card,.club-option,.notice{padding:18px;border-radius:22px}.filters{grid-template-columns:1fr}.club-option-head{display:block}.hero-logo{width:min(230px,68vw);max-height:150px;margin-top:2px}.login-card h2{font-size:42px}.phone-row{grid-template-columns:1fr 132px;gap:8px}.phone-row .phone{padding-left:10px;padding-right:10px;font-size:14px}}
.category-card:nth-child(5),.category-card:nth-child(6){min-height:135px}

/* v22 fixes: top-right profile, 10s ad splash, smaller standardized buttons */
.user-menu{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 10px)!important;right:12px!important;left:auto!important;z-index:99999!important;width:auto!important}
.user-menu-btn{width:auto!important;min-width:58px!important;height:42px!important;min-height:42px!important;padding:5px 8px!important;border-radius:18px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;background:rgba(31,22,69,.72)!important;border:1px solid rgba(255,255,255,.20)!important;backdrop-filter:blur(14px)!important}
.user-photo,.dropdown-user-photo{width:30px!important;height:30px!important;border-radius:999px!important;object-fit:cover!important}
.user-initials{width:30px!important;height:30px!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:linear-gradient(90deg,var(--hot),var(--accent))!important;color:#06101c!important;font-size:13px!important;font-weight:1000!important}
.user-dots{font-size:18px!important;line-height:1!important}
.user-dropdown{position:absolute!important;right:0!important;top:48px!important;width:278px!important;border:1px solid var(--line)!important;background:rgba(10,10,28,.96)!important;box-shadow:0 22px 70px rgba(0,0,0,.45)!important;border-radius:20px!important;padding:14px!important;backdrop-filter:blur(14px)!important}
.user-dropdown-row{display:flex!important;gap:12px!important;align-items:center!important;margin-bottom:12px!important}
.user-dropdown-row p{margin:3px 0 0!important;color:var(--muted)!important;font-size:13px!important;word-break:break-word!important}
.topbar > button[id^="logout"], #logoutBtnClubActions{display:none!important}
.category-grid,.compact-category-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important;gap:10px!important;margin-top:16px!important}
.category-card{min-height:54px!important;height:auto!important;font-size:15px!important;border-radius:14px!important;padding:10px 12px!important;line-height:1.1!important}
.linklike{font-size:inherit!important;padding:0!important;min-height:0!important;border-radius:0!important}
button,.buttonlike{min-height:38px;padding:9px 12px;border-radius:12px}
.signin,.full{min-height:52px;padding:13px 16px}
.splash-wrap{min-height:calc(100vh - 48px);display:grid;place-items:center}
.splash-card{width:min(760px,92vw);border:1px solid var(--line);background:radial-gradient(circle at 20% 20%,rgba(255,100,216,.26),transparent 35%),radial-gradient(circle at 80% 20%,rgba(98,234,255,.22),transparent 38%),linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.07));box-shadow:0 22px 70px rgba(0,0,0,.45);border-radius:30px;padding:28px;text-align:center;backdrop-filter:blur(16px)}
.splash-card h1{font-size:clamp(36px,7vw,86px);line-height:.9;letter-spacing:-.05em;margin:10px 0 18px;text-transform:uppercase}
.ad-badge{display:inline-block;margin-top:18px;padding:9px 14px;border:1px solid var(--line);border-radius:999px;color:var(--lime);font-weight:1000;background:rgba(0,0,0,.25)}
.splash-countdown{color:var(--muted);font-weight:900}
@media(max-width:520px){.app{padding-top:64px!important}.category-card{min-height:48px!important;font-size:14px!important;padding:9px 10px!important}.category-grid,.compact-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.user-dropdown{width:260px!important}}

/* v23 sign-up profile + ad images */
.profile-card{max-width:980px;margin:0 auto}
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.consent-line{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:16px;padding:14px;background:rgba(0,0,0,.16)}
.consent-line input{width:auto;margin-top:3px}
.ad-image-slot{width:min(520px,86vw);margin:0 auto 14px}
.ad-image-slot img{width:100%;height:auto;max-height:280px;object-fit:contain;border-radius:24px;border:1px solid var(--line);box-shadow:0 18px 50px rgba(0,0,0,.35)}
@media(max-width:520px){.profile-grid{grid-template-columns:1fr}.ad-image-slot img{max-height:210px}}

```

### `admin.css`

```css
/* Jadz AdCo ShoutOut admin styles v19 */
.admin-grid{display:grid;grid-template-columns:2fr 1fr;gap:18px}.admin-preview{width:100%;height:360px;border:1px solid var(--line);border-radius:18px;background:#000}.admin-club-card{min-width:280px}.queue-item{border:1px solid var(--line);border-radius:18px;padding:16px;margin:12px 0;background:rgba(0,0,0,.22)}.queue-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.approve{background:rgba(80,255,180,.25)}.reject{background:rgba(255,80,80,.25)}@media(max-width:900px){.admin-grid{grid-template-columns:1fr}.admin-preview{height:260px}}

/* v24 admin dashboards */
.admin-shell .topbar h1{max-width:900px}
.admin-tabs{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 22px}
.admin-tab{min-height:40px;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,.08)}
.admin-tab.active{background:linear-gradient(90deg,var(--hot),var(--accent));color:#06101c;border:0}
.admin-panel-section{display:none}
.admin-panel-section.active{display:block}
.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin:12px 0 18px}
.metric-card{border:1px solid var(--line);border-radius:22px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.15),rgba(255,255,255,.06));box-shadow:0 18px 50px rgba(0,0,0,.25)}
.metric-card span{display:block;color:var(--muted);font-weight:800;font-size:13px}
.metric-card strong{display:block;font-size:clamp(28px,4vw,46px);line-height:1;margin-top:8px;color:var(--lime)}
.report-block{color:var(--text)}
.report-table{display:grid;gap:10px}
.report-table div{display:flex;justify-content:space-between;gap:14px;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:rgba(0,0,0,.18)}
.report-table span{color:var(--muted);font-weight:800}
.report-table strong{text-align:right}
.report-list{display:flex;flex-wrap:wrap;gap:10px}
@media(max-width:720px){.report-table div{display:block}.report-table strong{display:block;text-align:left;margin-top:5px}.admin-tabs{gap:8px}.admin-tab{font-size:13px;padding:9px 11px}}

/* v25.1 account status card */
.account-status-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px}
.account-status-card strong{display:block;font-size:18px}
@media(max-width:720px){.account-status-card{display:block}.account-status-card button{margin-top:12px;width:100%}}

/* v26 promoter guest list additions */
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.profile-grid label{display:grid;gap:7px}.profile-grid input,.profile-grid select{width:100%}

/* v28 guest invitee rows */
.soft-card{background:rgba(255,255,255,.05);margin:16px 0;padding:16px;border:1px solid var(--line);border-radius:18px}
.invitee-row{align-items:end;border:1px solid var(--line);border-radius:16px;padding:12px;margin:10px 0;background:rgba(0,0,0,.12)}
.consent-line{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:16px;padding:14px;margin:16px 0;background:rgba(0,0,0,.16)}
.consent-line input{width:auto;margin-top:3px}

/* v28 patron portal menu */
.profile-menu-link,.profile-menu-line{display:block;padding:10px 12px;color:var(--text);font-weight:900;text-decoration:none}
.profile-menu-link:hover{text-decoration:underline}
.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.profile-grid label{display:grid;gap:7px}
.profile-grid input,.profile-grid select{width:100%}

/* v28.4 fixes */
.profile-menu-link,.profile-menu-line{display:block;padding:10px 12px;color:var(--text);font-weight:900;text-decoration:none}.profile-menu-link:hover{text-decoration:underline}.menu-user-row{display:flex;align-items:center;gap:12px;padding:10px 12px}.menu-user-row p{margin:3px 0 0;opacity:.8}.menu-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover}.menu-avatar-fallback{width:42px;height:42px;border-radius:50%;display:inline-grid;place-items:center;font-weight:900;background:linear-gradient(135deg,#ff4fd8,#5eeaff);color:#111}.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.profile-grid label{display:grid;gap:7px}.profile-grid input,.profile-grid select{width:100%}.additional-guest-row{margin:10px 0;padding:10px;border:1px solid rgba(255,255,255,.18);border-radius:18px}

/* v28.4 global notification center */
.jadz-global-status-bar{position:fixed;right:14px;bottom:14px;z-index:9999;display:flex;gap:8px;flex-wrap:wrap;background:rgba(7,10,25,.92);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 10px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.jadz-global-status-bar.hidden{display:none}
.jadz-global-status-bar a{color:#fff;text-decoration:none;font-weight:900;font-size:12px;padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.10)}
.service-action{min-width:160px}

/* v28.4 templates and role request */
.template.classic-bw,.classic-bw{background:linear-gradient(135deg,#fff,#111);color:#111;border:2px solid #fff}
.template.summer,.summer{background:linear-gradient(135deg,#00d4ff,#ffe66d,#ff7aa2);color:#101020}
.template.car,.car{background:linear-gradient(135deg,#111,#555,#d4af37);color:#fff}
.selected-summary.hidden{display:none}
.role-request-card{margin-top:18px}
.profile-grid textarea{width:100%;min-height:90px}

/* v28.5 media templates */
.media-template-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.media-template-card{border:1px solid rgba(255,255,255,.18);border-radius:24px;overflow:hidden;min-height:190px;background:#111;color:#fff;padding:18px;cursor:pointer}
.media-template-card.selected{outline:3px solid #5eeaff}
.template-preview-board{height:130px;border-radius:18px;display:grid;place-items:center;position:relative;overflow:hidden}
.template-preview-board .photo-placeholder{position:absolute;right:14px;top:14px;width:58px;height:58px;border:2px dashed rgba(255,255,255,.75);border-radius:12px;display:grid;place-items:center;font-size:10px;text-align:center;background:rgba(0,0,0,.2)}
.template-preview-board .video-placeholder{position:absolute;left:14px;top:14px;width:62px;height:42px;border:2px dashed rgba(255,255,255,.75);border-radius:10px;display:grid;place-items:center;font-size:10px;background:rgba(0,0,0,.2)}
.template-preview-board strong{font-size:25px;letter-spacing:2px;text-align:center}.template-preview-board span{display:block;font-size:15px;text-align:center}
.tpl-classic-board{background:#f8f8f8;color:#111;border:8px solid #111}.tpl-classic-board strong,.tpl-classic-board span{color:#111}
.tpl-ferrari{background:radial-gradient(circle at 30% 40%,#ff1e1e,transparent 35%),linear-gradient(135deg,#170000,#111 55%,#5d0000);border:2px solid #ff1e1e}
.tpl-rolls{background:radial-gradient(circle at 72% 24%,#d8b35a,transparent 25%),linear-gradient(135deg,#030303,#111,#3a2a08);border:2px solid #d8b35a}
.tpl-summer{background:linear-gradient(135deg,#00c6ff,#ffdf6b,#ff6bd6)}
.tpl-gold{background:radial-gradient(circle,#ffe18a,transparent 35%),linear-gradient(135deg,#1d1200,#6d4c0b,#110900)}
.tpl-neon{background:radial-gradient(circle at 20% 20%,#ff4fd8,transparent 35%),radial-gradient(circle at 80% 70%,#5eeaff,transparent 35%),#050719}
.media-preview-box{border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:12px;margin-top:12px}
.media-preview-box img,.media-preview-box video{max-width:100%;border-radius:16px;display:block}

/* v28.6 media preview fixes */
#shoutoutMediaPreview,#liveShoutoutPreview,.shoutout-live-preview{min-height:360px;border-radius:24px;overflow:hidden;position:relative;background:#050505}
#shoutoutMediaPreview img,#shoutoutMediaPreview video,#liveShoutoutPreview img,#liveShoutoutPreview video,.shoutout-live-preview img,.shoutout-live-preview video{width:100%;max-height:520px;object-fit:cover;border-radius:22px;display:block}
.media-preview-stage{position:relative;min-height:360px;background:#050505;border-radius:24px;overflow:hidden}
.media-preview-stage img,.media-preview-stage video{width:100%;min-height:360px;max-height:560px;object-fit:cover;display:block}
.media-preview-overlay{position:absolute;left:0;right:0;bottom:0;padding:24px 28px;background:linear-gradient(transparent,rgba(0,0,0,.82));color:#fff;text-align:center;text-shadow:0 4px 18px rgba(0,0,0,.85)}
.media-preview-overlay strong{display:block;font-size:clamp(30px,6vw,70px);line-height:.95;letter-spacing:2px;text-transform:uppercase}
.media-preview-overlay span{display:block;margin-top:10px;font-size:clamp(18px,3vw,34px);letter-spacing:1px;text-transform:uppercase}
.single-media-upload-note{font-size:12px;opacity:.8}

/* v28.8 shoutout club option force */
.v28-8-shoutout-club-option{
  display:inline-flex!important;
  align-items:center;
  justify-content:center;
  min-width:210px;
  margin-right:8px;
}

```

### `display.css`

```css
/* Jadz AdCo ShoutOut display styles v19 */
:root{--lime:#dfff5a}.hidden{display:none!important}body.display{margin:0;background:#000;color:white;font-family:Inter,Segoe UI,Arial,sans-serif;overflow:hidden}.display-canvas{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle at 25% 40%,rgba(255,79,216,.65),transparent 30%),radial-gradient(circle at 72% 35%,rgba(88,236,255,.7),transparent 35%),linear-gradient(135deg,#060510,#091d46 60%,#02030a);animation:pulse 6s ease-in-out infinite}.display-canvas.gold{background:radial-gradient(circle at 40% 35%,rgba(255,212,90,.8),transparent 35%),linear-gradient(135deg,#120b03,#312005,#070401)}.display-canvas.ice{background:radial-gradient(circle at 70% 35%,rgba(182,243,255,.8),transparent 35%),linear-gradient(135deg,#031529,#0d3e66,#020712)}.display-canvas.fire{background:radial-gradient(circle at 50% 45%,rgba(255,106,0,.8),transparent 35%),linear-gradient(135deg,#190202,#421006,#050202)}.brand{position:absolute;top:5%;left:4%;color:var(--lime);font-weight:1000;letter-spacing:.12em;font-size:clamp(18px,2vw,36px)}.display-center{width:min(1500px,92vw);padding:4vw}.display-center h1{font-size:clamp(64px,9vw,160px);line-height:.95;margin:16px 0;text-transform:uppercase;text-shadow:0 0 18px rgba(88,236,255,.9),0 0 60px rgba(255,79,216,.6)}.display-center h2{font-size:clamp(22px,3vw,56px);font-weight:700;color:#dbfbff;margin:0}.ticker{position:absolute;bottom:4%;left:0;right:0;color:rgba(255,255,255,.65);font-size:clamp(14px,1.6vw,28px)}.media-slot img,.media-slot video{max-width:min(520px,40vw);max-height:32vh;border-radius:24px;box-shadow:0 0 45px rgba(88,236,255,.35);object-fit:cover}@keyframes pulse{0%,100%{filter:saturate(1)}50%{filter:saturate(1.45) brightness(1.08)}}
```

### `seed.html`

```html
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Seed ShoutOut DB</title><link rel="stylesheet" href="./styles.css"/></head>
<body>
<main class="app">
  <section class="page active">
    <div class="card">
      <p class="eyebrow">Jadz AdCo Setup</p>
      <h1>Seed Location Database</h1>
      <p class="sub">Use once to create/update Firestore location, event, and template records.</p>
      <p id="seedStatus" class="status">Loading seed app...</p>
      <div class="auth-grid">
        <button id="seedGoogleLoginBtn" type="button">Google Login</button>
        <button id="seedMicrosoftLoginBtn" type="button">Microsoft Login</button>
        <button id="seedFacebookLoginBtn" type="button">Facebook Login</button>
      </div>
      <button id="seedBtn" class="primary" type="button">Create / Update Records</button>
      <button id="seedLogoutBtn" class="ghost" type="button">Sign out</button>
    </div>
  </section>
</main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./shared-data.js?v=28.8"></script>
<script src="./seed-app.js?v=28.8"></script>
</body>
</html>
```

### `seed-app.js`

```javascript
/* seed-app.js v19 */
(function(){
  const byId = id => document.getElementById(id);
  const setStatus = t => byId("seedStatus").textContent = t;
  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth(), db = firebase.firestore();
  const safeUser = u => (u?.email || "").toLowerCase();
  async function login(provider){ try{ await auth.signInWithPopup(provider); }catch(e){ setStatus(`${e.code || "error"}: ${e.message}`); } }
  async function seed(){
    const user = auth.currentUser;
    if (!user || !window.SHOUTOUT_ADMIN_EMAILS.includes(safeUser(user))) { setStatus("Sign in with an admin email first."); return; }
    setStatus("Seeding...");
    for (const [id,t] of Object.entries(window.SHOUTOUT_TEMPLATES)) await db.collection("templates").doc(id).set(t,{merge:true});
    for (const [id,c] of Object.entries(window.SHOUTOUT_CLUB_LOCATIONS)) await db.collection("clubLocations").doc(id).set(c,{merge:true});
    for (const [id,e] of Object.entries(window.SHOUTOUT_EVENTS)) await db.collection("events").doc(id).set(e,{merge:true});
    setStatus("Done. Templates, clubLocations, and events created/updated in Firestore.");
  }
  document.addEventListener("DOMContentLoaded",()=>{
    byId("seedGoogleLoginBtn").onclick = () => login(new firebase.auth.GoogleAuthProvider());
    byId("seedFacebookLoginBtn").onclick = () => login(new firebase.auth.FacebookAuthProvider());
    byId("seedMicrosoftLoginBtn").onclick = () => { const p=new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); login(p); };
    byId("seedBtn").onclick = seed;
    byId("seedLogoutBtn").onclick = () => auth.signOut();
    auth.onAuthStateChanged(u => setStatus(u ? `Signed in as ${u.displayName || u.email}` : "Not signed in"));
  });
})();

```

### `auth-debug.html`

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Jadz Auth Debug</title>
  <link rel="stylesheet" href="./styles.css"/>
  <link rel="stylesheet" href="./admin.css"/>
</head>
<body>
<main class="app admin-shell">
  <section class="page active">
    <header class="topbar">
      <div>
        <p class="eyebrow">Jadz AdCo Auth Debug</p>
        <h1>Authentication Test</h1>
        <p class="sub">This page tests Firebase sign-in only. It does not apply Master Admin or Club Admin role checks.</p>
        <p id="debugStatus" class="status">Loading auth debug...</p>
      </div>
    </header>
    <div class="card">
      <h2>Test Sign-In Providers</h2>
      <div class="auth-grid">
        <button id="debugGoogle" type="button">Google Popup Test</button>
        <button id="debugMicrosoft" type="button">Microsoft Popup Test</button>
        <button id="debugLogout" type="button">Sign out</button>
      </div>
      <div id="debugOutput" class="report-block"></div>
    </div>
  </section>
</main>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
<script src="./firebase-config.js?v=28.8"></script>
<script src="./auth-debug.js?v=28.8"></script>
</body>
</html>

```

### `auth-debug.js`

```javascript
/* auth-debug.js v25.9 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  if (!window.firebaseConfig) {
    setText("debugStatus", "firebase-config.js missing window.firebaseConfig.");
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();

  function render(user) {
    const out = byId("debugOutput");
    if (!user) {
      out.innerHTML = "<p class='sub'>No authenticated user.</p>";
      return;
    }
    const providerIds = (user.providerData || []).map(p => p.providerId).join(", ");
    out.innerHTML = `
      <div class="report-table">
        <div><span>UID</span><strong>${esc(user.uid)}</strong></div>
        <div><span>Email</span><strong>${esc(user.email)}</strong></div>
        <div><span>Email verified</span><strong>${esc(user.emailVerified)}</strong></div>
        <div><span>Display name</span><strong>${esc(user.displayName)}</strong></div>
        <div><span>Provider IDs</span><strong>${esc(providerIds)}</strong></div>
      </div>`;
  }

  async function google() {
    try {
      setText("debugStatus", "Opening Google popup...");
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    } catch(e) {
      setText("debugStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function microsoft() {
    try {
      const p = new firebase.auth.OAuthProvider("microsoft.com");
      p.setCustomParameters({prompt:"select_account"});
      setText("debugStatus", "Opening Microsoft popup...");
      await auth.signInWithPopup(p);
    } catch(e) {
      setText("debugStatus", `${e.code || "error"}: ${e.message}`);
    }
  }

  async function logout() {
    await auth.signOut();
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("debugGoogle").addEventListener("click", google);
    byId("debugMicrosoft").addEventListener("click", microsoft);
    byId("debugLogout").addEventListener("click", logout);

    auth.onAuthStateChanged(user => {
      setText("debugStatus", user ? `Signed in as ${user.email || user.displayName || user.uid}` : "Not signed in.");
      render(user);
    });
  });
})();

```


---

## 6. Current problems

- No build step or tests.
- `patron-app.js` is very large and has many appended patches.
- Club options screen still required v28.8 hard fix to show `Throw a ShoutOut`.
- Routing is not centralized.
- Service filtering is partially hardcoded and partially patched.
- Guest list must not route to ShoutOut templates.
- Media upload must save `mediaUrl` and `mediaType` to Firestore and display page must use them.
- AI suggestions are demo/static only.
- Messaging/inbox foundation exists, but full chat is not live.
- Firestore rules are too broad for production.
- Microsoft auth has had popup/redirect issues.

---

## 7. Desired improvements

- Refactor routing and state management.
- Replace DOM text-matching patches with explicit data attributes.
- Ensure every club options screen always shows `Throw a ShoutOut`.
- Complete media upload pipeline: Storage upload → Firestore `shoutouts` → admin approval → `liveContent` → display page.
- Complete pending ShoutOut edit/cancel/duplicate.
- Complete inbox and chat.
- Implement Club Master Admin approval workflow.
- Implement real role-based security using custom claims or role docs.
- Add tests.
- Add Firebase CLI and/or GitHub Actions deploy workflow.
- Keep `ShoutOut` un-translated.

---

## 8. Test and run instructions

Current static local run:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080/?v=local
```

Install/build/test commands: unknown / none currently.

Recommended future:

```bash
npm install
npm run dev
npm test
npm run build
```

No Firebase emulator config currently.

Recommended future:

```bash
firebase emulators:start --only auth,firestore,storage
```

Manual deployment:

```text
Extract ZIP
Upload files to GitHub repo root
Replace existing files
Commit
Wait 1–3 minutes
Test with ?v=28.8
```

Manual test checklist:

1. Open `https://jadzadco.github.io/shoutout-demo/?v=28.8`.
2. Login as patron.
3. Select Clubs.
4. Select any club.
5. Confirm Club Options shows `Throw a ShoutOut`.
6. Click Throw a ShoutOut.
7. Confirm template screen opens.
8. Upload one image or video.
9. Confirm large preview with text overlay.
10. Click AI recommendation.
11. Confirm text input and preview update.
12. Submit ShoutOut.
13. Confirm Storage object under `shoutouts/{uid}/...`.
14. Confirm Firestore `shoutouts` document.
15. Confirm `inboxNotifications` document.
16. Test guest list direct URL.
17. Test role request URL.

---

## 9. Implementation priorities

Codex should do first:

1. Run the app locally.
2. Inspect actual DOM for Club Options.
3. Replace v28.8 hardcoded setInterval patch with clean rendering.
4. Implement deterministic `renderClubOptions(locationId)`.
5. Make ShoutOut button always present.
6. Fix media persistence and display rendering.
7. Add tests.

Must not be changed:
- Do not translate `ShoutOut`.
- Do not remove GitHub Pages deployment path.
- Do not expose secrets/service accounts.
- Do not break Xibo-compatible `display.html`.
- Do not remove existing venue IDs without migration.

Risky areas:
- `patron-app.js`
- Auth provider flows
- Firebase Storage upload
- Firestore rules
- Xibo display rendering
- Club service routing

Acceptance criteria:
- Club Options always shows `Throw a ShoutOut`.
- Guest List never routes to ShoutOut template selection.
- ShoutOut media upload works and persists.
- Display page renders text + image/video.
- Patron portal shows submitted ShoutOut and inbox notification.
- Role request writes expected records.
- No secrets committed.
- README updated.
