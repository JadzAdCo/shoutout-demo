# CURRENT PACKAGE: Jadz AdCo ShoutOut v28.16-f Consolidated Fix Package

This ZIP is a full web app package for upload to the GitHub repo root.

Current live test URL after upload:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16-f
```

Current release highlights:

- Consolidates the v28.16 media upload/display pipeline fix and the Classic Black & White board sizing refinement into one fix package.
- Version suffix convention starts here: `-f` means fix release, `-nf` means new feature release.
- Refined the Classic Black & White display with a larger white center board.
- Increased Classic Black & White text size and weight while keeping it inside the board.
- Reduced excess red/black header space above the white board.
- Fixed the ShoutOut media upload/display pipeline for image and video templates.
- Patron submit now awaits the visible Photo/Video uploader before creating the Firestore ShoutOut.
- ShoutOut documents now carry `mediaUrl`, `mediaType`, `mediaFileName`, `mediaStoragePath`, and `mediaUploadedAt`.
- Admin approval now copies the same media fields into `liveContent/{clubLocationId}`.
- Display rendering now uses `mediaType` to render uploaded images or autoplay muted looping videos.
- Placeholder `IMAGE / VIDEO` only appears when no uploaded media URL exists.
- Fixed Classic Black & White preview text alignment so rows sit inside the white board.
- Forced the Classic Black & White subtitle into the same three-row board renderer instead of floating separately.
- Reduced and constrained board letter sizing for iframe previews and mobile screens.
- Updated the Classic Black & White ShoutOut template text layout.
- Classic Black & White now renders patron text only inside the white center board.
- Birthday-style text auto-breaks into physical board rows, for example `HAPPY / BIRTHDAY / D`.
- Added three board rows, faint horizontal guide rails, bold uppercase cut-out lettering, and subtle letter depth/shadow.
- Preview iframe and final display use the same `display.html` renderer and layout.
- Added a reusable Back button to the patron app workflow pages for easier navigation.
- Added Back navigation to the patron portal and role request page.
- Removed the public role-request link from the main search/ShoutOut workflow.
- Kept Club Admin / DJ / Promoter access requests available only from the patron portal profile area.
- Fixed the role request form submit logic so it uses the current form field IDs and can submit DJ/Promoter/Club Admin opt-in requests.
- Fixed avatar dropdown anchor link colors so My Profile, Messages, and Chats stay white.
- Added CSS for link, visited, hover, active, and focus states in the user menu dropdown.
- Updated ShoutOut templates and display preview styling.
- Traditional Black & White now uses a tighter full-sign marquee board direction.
- Removed unnecessary brand/footer text from the display preview.
- Added clearly labeled image/video placeholder template options.
- Added 50/50 media/text layout support for image/video templates.
- Added a simplified searchable template selection screen.
- Default ShoutOut template is now Traditional Black & White.
- Removed the Country, State / Region / Province, City, and Music Genre dropdown filters from the search display page.
- Kept the single contextual search box as the primary patron search workflow.
- Updated search helper text and placeholder examples for natural-language search.
- Clean `Throw a ShoutOut` button on Club Options.
- Removed timer-based ShoutOut button injection patches.
- Added contextual/fuzzy search for terms like `hiphop`, `hip hop`, `hip-hop`, and `Hip Hope`.
- Bumped cache-busting query strings to `v=28.16-f`.
- No Firestore, Storage, Firebase config, or rules changes required.

Rollback summary:

- Code rollback: revert the GitHub commit or upload the previous known-good package.
- Database rollback: no database rollback is needed for v28.16-f because this release does not require Firestore/Storage rules, index, or config changes.
- Future packages should include release ZIP, README, changed-files list, Firebase rules/index notes, migration notes, and rollback steps.

---

# Jadz AdCo ShoutOut v24 Admin Analytics + Master Admin Package

## Deployment

Upload/replace **all files** in this ZIP at the GitHub repository root.

Then test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

Club admin example:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=josephine-atlanta-ga
```

Master admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html
```

## v24 Major Updates

### 1. Club Admin Portal Expanded

The existing `admin.html` is now a club/location-specific command center.

Club admins can see only the selected location from the URL:

```text
admin.html?location=josephine-atlanta-ga
```

New club admin sections:

- Dashboard
- ShoutOut Queue
- Analytics
- Advertising
- Account Reconciliation
- Reports

### 2. Account Reconciliation Page Added

The club admin now includes a prototype reconciliation page showing:

- Estimated ShoutOut gross
- Jadz platform fee estimate
- Venue ShoutOut share estimate
- Estimated local ad share
- Pending payout
- Reconciliation status

This is currently a prototype and should later be connected to Stripe, Square, PayPal, or another payment ledger.

### 3. Club Owner Analytics Reports Added

New report cards include:

- Venue Summary
- Audience Analytics
- Music & Demand Intelligence
- Event / Reservation Funnel
- Ad Performance
- Recommended Sponsor Categories
- Exportable Reports placeholders

### 4. New Master Admin Portal Added

New files:

```text
master-admin.html
master-admin-app.js
```

Master admins can view:

- All locations
- All users
- All pending ShoutOuts
- All queues across locations
- Network reports
- Advertiser reports
- Network reconciliation
- Ticketing partner integration notes

### 5. Admin Separation

Club admin:

```text
admin.html?location=<locationId>
```

Sees only that selected location's queue and reports.

Master admin:

```text
master-admin.html
```

Sees the full Jadz AdCo network.

### 6. Master Admin Email List Added

`shared-data.js` now includes:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];
```

Club admins continue using:

```javascript
window.SHOUTOUT_ADMIN_EMAILS
```

## Ticketing / Affiliate Integration Notes

### Ticketmaster

Ticketmaster has a public Discovery API that can be used for event discovery, event details, venue data, artist data, images, and outbound ticket links.

Ticketmaster also has an affiliate/distribution partner ecosystem. After approval, eligible publishers may receive an onboarding guide, Impact publisher ID, API key or content tools, and access to reporting/payment tracking through Impact.

Ticketmaster's Partner API is different from the Discovery API. It is restricted to companies with official distribution relationships and can support reserve, purchase, and ticket/event retrieval workflows.

### Eventbrite

Eventbrite has a public platform/API for event management workflows, including data access, event creation, attendee/order workflows, and checkout customization. This may be easier for early event organizer integrations.

### Recommended Jadz Integration Path

Phase 1:

```text
Use Jadz-owned Firestore events
```

Phase 2:

```text
Add Ticketmaster Discovery API for event discovery and outbound ticket links
```

Phase 3:

```text
Apply for Ticketmaster affiliate/distribution access
```

Phase 4:

```text
Add Eventbrite API for promoter-created events and ticket workflows
```

Phase 5:

```text
Build Jadz-owned reservation, VIP table, guest list, and ticket checkout for higher-margin venue transactions
```

## Recommended Firestore Rules Additions

Your current v23 rules should still work. For future admin separation, create these collections later:

```text
adminRoles
venueAdmins
transactions
reconciliation
adImpressions
adClicks
campaigns
ticketClicks
reservationRequests
guestListRequests
```

For now, v24 uses existing collections:

```text
users
clubLocations
events
templates
shoutouts
liveContent
```

## Current Major Features Preserved

- Patron sign-in/sign-up
- User profile completion
- Embedded splash ad images
- Main category screen
- Events / Clubs / Beach Clubs / Lounges / Lounge-Clubs / ShoutOut
- 10-second sponsored splash ads
- Multi-location venue model
- ShoutOut creation
- Admin approval workflow
- Location-specific display pages
- Xibo-compatible display page
- Firestore seeding utility

## Notes

This is still a front-end prototype. The analytics reports use available Firestore collections and estimated placeholder calculations where payment/ad event data is not yet tracked.

The next production step is to add real tracking events for:

- Category clicks
- Event clicks
- Ticket clicks
- Reservation requests
- Guest list requests
- Ad impressions
- Ad clicks
- ShoutOut payment status
- Payout records


---

# v25 Master Admin Security Update

## Summary

This package hardens the Master Admin portal.

Master Admin now requires:

1. The user email must be explicitly listed in:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

2. The user email domain must be one of:

```javascript
jadzadco.com
jadzholdings.com
```

3. The user must use an email-based identity. Phone-only OTP is blocked for Master Admin.

4. The user must sign in using:

```javascript
google.com
microsoft.com
```

Facebook, phone-only, anonymous, and other weaker providers are blocked for Master Admin.

5. The user email must be verified by the provider.

6. MFA must be enforced upstream by Microsoft Entra ID or Google Workspace for the allowed Jadz corporate domains.

## Important MFA Note

Firebase client JavaScript can detect Firebase-native MFA enrollment, but Microsoft Entra ID or Google Workspace MFA is usually enforced at the identity provider before Firebase receives the login. This package enforces corporate domain, verified email, allowed provider, and explicit allow-list. Keep MFA enforced in Microsoft Entra ID / Google Workspace.

## Master Admin URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Practical Recommendation

Use Microsoft authentication for Master Admin and enforce MFA with Microsoft Entra Conditional Access.

Do not allow phone OTP, Facebook login, personal Gmail, personal Outlook, fake emails, or unverified identities for Master Admin access.


---

# v25.1 Admin Login, Queue, and Text Fixes

## Changes

1. Updated patron landing text:

`Search and book entertainment and nightlife events or send a live ShoutOut to one of our ShoutOut displays.`

2. Added visible Account Status and Sign out card to Master Admin after login.

3. Changed admin and master-admin authentication from popup sign-in to redirect sign-in to reduce Microsoft `auth/popup-closed-by-user` issues.

4. Kept `bans.don@gmail.com` as a temporary Master Admin exception while corporate-domain admin accounts are finalized.

5. Fixed Zebbies Garden DC / club admin queue error by removing the Firestore composite-index requirement. The app now queries by `clubLocationId` and `status`, then sorts by `submittedAt` in the browser.

## Test URLs

Patron:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

Zebbies Garden DC Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production Note

For production scale, create the Firestore composite index and restore server-side ordering. For the current prototype, client-side sorting avoids deployment friction.


---

# v25.2 Microsoft Admin Authentication Diagnostics

## Summary

This package improves Microsoft authentication handling for the Club Admin and Master Admin portals.

## Changes

1. Microsoft admin sign-in continues to use `signInWithRedirect()` instead of popup.
2. Microsoft provider now includes:
   - `tenant: "common"`
   - `prompt: "select_account"`
   - scopes: `openid`, `profile`, `email`
3. Added clearer admin error messages for:
   - `auth/popup-closed-by-user`
   - `auth/operation-not-allowed`
   - `auth/unauthorized-domain`
   - `auth/account-exists-with-different-credential`
   - invalid OAuth client configuration
4. Added Microsoft sign-in notes to:
   - `admin.html`
   - `master-admin.html`
5. Cache-busting updated to `v=28.8`.

## Critical Firebase / Microsoft Console Checklist

If Microsoft sign-in still fails, verify these items:

### Firebase Console

Go to:

```text
Firebase Console > Authentication > Sign-in method > Microsoft
```

Confirm:

- Microsoft provider is enabled.
- Client ID is correct.
- Client Secret is correct.
- Callback / redirect URI shown by Firebase is copied.

### Microsoft Azure App Registration

Go to:

```text
Azure Portal > App registrations > Your app > Authentication
```

Add the Firebase callback URI exactly as shown in Firebase. It usually looks like:

```text
https://<your-firebase-project-id>.firebaseapp.com/__/auth/handler
```

Also confirm:

- Supported account type allows the accounts you are testing.
- If testing personal Microsoft accounts, use "common" / personal + organizational support.
- If testing only company accounts, use the correct tenant setup.
- The client secret has not expired.

### Firebase Authorized Domains

Go to:

```text
Firebase Console > Authentication > Settings > Authorized domains
```

Confirm:

```text
jadzadco.github.io
shoutoutdemo-5b402.firebaseapp.com
shoutoutdemo-5b402.web.app
```

or your exact Firebase hosting domains are listed.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```


---

# v25.3 Admin Authentication Unification

## Why this update exists

The patron page Google authentication was working, but the admin page began showing Microsoft popup errors and Google stopped working after redirect-only changes.

## What changed

1. Club Admin and Master Admin now use the same primary authentication behavior as the patron portal:
   - `signInWithPopup()` first
   - automatic `signInWithRedirect()` fallback only if popup is blocked, closed, or cancelled

2. This fixes the regression where admin Google stopped working while patron Google still worked.

3. Microsoft sign-in keeps the Microsoft provider settings:
   - `tenant: "common"`
   - `prompt: "select_account"`
   - scopes: `openid`, `profile`, `email`

4. Master Admin security remains:
   - Google or Microsoft only
   - phone-only blocked
   - Facebook blocked
   - approved email list required
   - corporate domain requirement remains
   - `bans.don@gmail.com` remains temporarily allowed for testing

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Troubleshooting

If Microsoft still shows `auth/popup-blocked`, manually allow popups for:

```text
jadzadco.github.io
```

The app should then retry with redirect fallback automatically.


---

# v25.4 Admin Redirect-Only Authentication Fix

## Why this update exists

The admin pages continued to show:

```text
auth/popup-closed-by-user
```

That means the admin page was still opening a popup, or the browser was treating the provider flow as a popup-based session.

## What changed

1. Club Admin authentication is now redirect-only:
   - Google uses `signInWithRedirect()`
   - Microsoft uses `signInWithRedirect()`
   - Facebook uses `signInWithRedirect()` for club admin only

2. Master Admin authentication is now redirect-only:
   - Google uses `signInWithRedirect()`
   - Microsoft uses `signInWithRedirect()`
   - Facebook remains unavailable for Master Admin

3. Popup-based admin login is removed from admin pages.

4. Patron login is unchanged.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important

After uploading, do a hard refresh or open the URL in an incognito/private window so the browser does not use cached `admin-app.js`.


---

# v25.5 Master Admin Email Allow-List Only

## Why this update exists

The Master Admin page was working with Google, but the corporate-domain restriction added unnecessary complexity during the prototype phase.

## What changed

1. Domain enforcement is now disabled by default:

```javascript
window.SHOUTOUT_MASTER_ADMIN_ENFORCE_DOMAINS = false;
```

2. Master Admin access is still protected by:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

Only explicitly listed emails can access Master Admin.

3. Master Admin still requires an approved provider:

```javascript
google.com
microsoft.com
```

4. Phone-only login and Facebook login remain blocked for Master Admin.

5. `bans.don@gmail.com` continues to work as a Master Admin as long as it remains listed in `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Current Recommended Development Policy

Use explicit email allow-list only:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS = [
  "bans.don@gmail.com",
  "don.b@jadzholdings.com"
];
```

## Production Recommendation

Later, replace JavaScript-based admin authorization with a Firestore `adminRoles` collection or Firebase custom claims.

Recommended future model:

```text
adminRoles/{uid}
  role: "masterAdmin"
  email: "admin@jadzadco.com"
  allowedLocations: ["*"]
  mfaRequired: true
```

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```


---

# v25.6 Admin Popup Authentication Alignment

## Why this update exists

Google authentication works on the patron page using a popup. The admin pages were changed to redirect during troubleshooting, but you requested Microsoft/admin authentication to behave identically to Google.

## What changed

1. Club Admin Google uses:

```javascript
auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
```

2. Club Admin Microsoft uses:

```javascript
auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"))
```

3. Master Admin Google uses popup sign-in.

4. Master Admin Microsoft uses popup sign-in.

5. Redirect-only admin authentication was removed.

6. Patron login remains unchanged.

7. Master Admin domain enforcement remains disabled for development.

8. Master Admin remains protected by explicit email allow-list:

```javascript
window.SHOUTOUT_MASTER_ADMIN_EMAILS
```

## Microsoft Provider Settings

The Microsoft provider now uses a simpler popup-friendly configuration:

```javascript
const p = new firebase.auth.OAuthProvider("microsoft.com");
p.setCustomParameters({ prompt: "select_account" });
p.addScope("openid");
p.addScope("profile");
p.addScope("email");
```

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important Browser Note

Because popup sign-in is now used again, make sure popups are allowed for:

```text
jadzadco.github.io
```

If Microsoft still fails while Google works, the issue is likely Microsoft provider-specific, not the page flow.


---

# v25.7 Master Admin Load Fix

## Why this update exists

The Master Admin page was stuck on:

```text
Loading master admin app...
```

This usually means `master-admin-app.js` failed before completing initialization.

## What changed

1. Rebuilt `master-admin-app.js` cleanly to remove broken remnants from prior domain enforcement edits.
2. Domain enforcement is disabled during development.
3. Master Admin access is controlled by `SHOUTOUT_MASTER_ADMIN_EMAILS`.
4. Google/Microsoft provider checks remain active.
5. Phone-only and Facebook Master Admin access remain blocked.
6. `bans.don@gmail.com` works as Master Admin if listed in `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production Note

Later, move Master Admin roles to Firestore `adminRoles` or Firebase custom claims.


---

# v25.8 Microsoft Redirect Fallback / Popup-Closed Fix

## Why this update exists

Microsoft authentication continued to produce:

```text
auth/popup-closed-by-user
```

even after browser popups were allowed.

This usually means the provider flow is still being interrupted or the Microsoft OAuth popup is being closed before Firebase receives the final credential.

## What changed

1. Google sign-in still uses popup behavior.
2. Microsoft sign-in now uses full-page redirect behavior on both:
   - Club Admin
   - Master Admin
3. `auth.getRedirectResult()` was added back to process the returning Microsoft login result.
4. Master Admin domain enforcement remains disabled during development.
5. Master Admin is still protected by `SHOUTOUT_MASTER_ADMIN_EMAILS`.

## Why Microsoft is different from Google

Google popup works in your patron page. Microsoft OAuth can behave differently in Chrome because of account picker behavior, cross-site cookie policies, tenant/account-type prompts, and provider redirect handling.

Using redirect for Microsoft avoids popup closure entirely.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Important

After upload, test in an incognito/private window or hard refresh with Ctrl+F5.


---

# v25.9 Admin Auth Matched to Patron Auth

## Why this update exists

Microsoft redirect completed MFA but returned to the app without an authenticated Firebase user. Firebase documents that redirect sign-in can fail on browsers that block third-party storage when the app is served from a different domain than the Firebase Auth helper domain.

## What changed

1. Club Admin Google/Microsoft/Facebook now use popup sign-in, matching the patron page.
2. Master Admin Google/Microsoft now use popup sign-in, matching the patron page.
3. Microsoft provider config now matches the patron page:
   - `new firebase.auth.OAuthProvider("microsoft.com")`
   - `p.setCustomParameters({prompt:"select_account"})`
   - no extra tenant/scopes
4. Redirect handling was removed from admin/master admin.
5. Added `auth-debug.html` and `auth-debug.js` to test Firebase provider sign-in without admin role checks.

## Diagnostic URL

Use this first if Microsoft still fails:

```text
https://jadzadco.github.io/shoutout-demo/auth-debug.html?v=28.8
```

If Microsoft fails on `auth-debug.html`, the issue is provider/browser/Firebase configuration, not the admin role logic.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Production recommendation

For Microsoft redirect sign-in on GitHub Pages, Firebase recommends one of the redirect best-practice options, such as using Firebase Hosting/custom auth domain or proxying the auth helper path, because redirect sign-in relies on a Firebase Auth helper iframe that can be affected by third-party storage restrictions.


---

# v26 Guest List + Promoter Referral System

## Major Additions

### Guest List Intake

New files:

```text
guest-list.html
guest-list-app.js
```

Supports:

- Club/location selection
- Event/day selection
- Required promoter/promoting group selection
- Guest name, phone, email, party size, notes
- Firestore submission to `guestListRequests`

Example:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

### Promoter Admin Panel

New files:

```text
promoter-admin.html
promoter-admin-app.js
```

Reports include:

- Patron app signup referrals
- Guest list referrals
- Total referred guests
- Estimated promoter credit
- Referrals by club
- Recent guest list requests

Supported reporting periods:

- Daily
- Weekly
- Biweekly
- Monthly
- 6 months
- 1 year
- 2 years
- 5 years

Example:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

### Club Admin Updates

Club Admin now includes:

```text
Guest Lists / Promoters
```

Club admins can view guest list and promoter data linked to their club/location.

### Master Admin Updates

Master Admin now includes:

```text
Promoters
```

Master admins can view network-level promoter and guest list data.

### Promoter Registry

`shared-data.js` now includes:

```javascript
window.SHOUTOUT_PROMOTERS
window.SHOUTOUT_PROMOTER_ADMINS
```

### Patron Signup Referral Tracking

If a patron arrives with:

```text
?promoter=<promoterId>
```

the app can store:

```text
referredByPromoterId
```

on profile completion.

## Firestore Rules Needed

Add:

```javascript
match /guestListRequests/{id} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null;
}
```

## Test URLs

Guest List - Zebbies DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Guest List - Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

Club Admin - Zebbies DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

## Access Intent

- Promoter admin sees assigned promoter data.
- Club admin sees guest-list/promoter data linked to that club.
- Master admin sees network-wide data.

## Future Production Recommendation

Move access control into:

```text
adminRoles
promoters
promoterAdmins
promoterPayouts
guestListCheckIns
```

or Firebase custom claims.


---

# v28 Legal Guest Lists + Protected Translation Terms

## New in v28

1. Guest list primary guest now uses:
   - First Name
   - Last Name
   - Full Name

2. The form includes a required legal-name confirmation:

```text
I confirm the First Name and Last Name for me and my invitees exactly match the government-issued photo IDs that will be presented at venue entry.
```

3. Additional invitees are now supported.

Patrons can:
- Add invitees manually
- Add accepted app friends later from the `friendships` collection

4. Guest list records now store:

```text
primaryGuest
additionalGuests
firstName
lastName
fullName
totalGuestCount
legalNameConfirmed
```

5. Translation policy added.

Protected terms must never be translated:

```text
ShoutOut
Jadz AdCo
Jadz Holdings
Superstar
Big Baller
Baller
Diva
Money Spender
Bruv
```

Examples:

```text
French: Envoyer un ShoutOut
German: Einen ShoutOut senden
Italian: Invia un ShoutOut
Spanish: Enviar un ShoutOut
```

6. New reference page:

```text
translation-policy.html
```

## Firestore Rules Needed

Add:

```javascript
match /guestListRequests/{id} {
  allow create: if request.auth != null;
  allow read, update, delete: if request.auth != null;
}

match /friendships/{id} {
  allow read, write: if request.auth != null;
}

match /friendRequests/{id} {
  allow read, write: if request.auth != null;
}
```

## Test URLs

Guest List — Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Guest List — Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.8
```

Club Admin — Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.8
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.8
```

Translation Policy:

```text
https://jadzadco.github.io/shoutout-demo/translation-policy.html?v=28.8
```

# Comprehensive Testing Plan

## A. Upload / Cache Test

1. Upload all package files to GitHub Pages.
2. Open each page with `?v=28.8`.
3. Hard refresh with Ctrl+Shift+R.
4. Confirm no page is stuck on `Loading...`.

## B. Guest List Intake Test

1. Open:

```text
guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

2. Sign in with Google.
3. Confirm First Name and Last Name auto-fill from profile or Google display name.
4. Select Event/Day.
5. Select Promoter / Promoting Group.
6. Add one manual invitee.
7. Confirm Party Size updates from 1 to 2.
8. Try submitting without legal-name confirmation; submission should fail.
9. Check legal-name confirmation.
10. Submit.
11. Confirm receipt shows:
   - Reference
   - Club
   - Event / Day
   - Promoter
   - Primary Guest
   - Additional Invitees
   - Party Size
   - Pending status

## C. Firestore Guest List Record Test

In Firebase Console, check:

```text
guestListRequests
```

Confirm record includes:

```text
primaryGuest.firstName
primaryGuest.lastName
primaryGuest.fullName
additionalGuests[]
totalGuestCount
legalNameConfirmed: true
promoterId
clubLocationId
submittedByUid
```

## D. Club Admin Guest List / Promoter Test

1. Open:

```text
admin.html?location=zebbies-garden-washington-dc&v=28.8
```

2. Sign in with approved admin Google account.
3. Open `Guest Lists / Promoters` tab.
4. Confirm guest list totals appear for Zebbies only.
5. Confirm promoter performance appears.
6. Confirm Shôko or Christie records do not appear on Zebbies admin.

## E. Promoter Admin Test

1. Open:

```text
promoter-admin.html?v=28.8
```

2. Sign in with an email in `SHOUTOUT_PROMOTER_ADMINS`.
3. Change report periods:
   - Daily
   - Weekly
   - Biweekly
   - Monthly
   - 6 months
   - 1 year
   - 2 years
   - 5 years
4. Confirm metrics update:
   - Patron Signup Referrals
   - Guest List Referrals
   - Total Guest Count
   - Estimated Promoter Credit

## F. Master Admin Promoter Test

1. Open:

```text
master-admin.html?v=28.8
```

2. Sign in with master admin Google account.
3. Open `Promoters` tab.
4. Confirm network-wide promoter totals appear.

## G. Translation / Protected Terms Test

1. Open:

```text
translation-policy.html?v=28.8
```

2. Confirm examples show:

```text
Envoyer un ShoutOut
Einen ShoutOut senden
Invia un ShoutOut
Enviar un ShoutOut
```

3. Use browser auto-translate to French, German, or Italian.
4. Confirm `ShoutOut` remains visible as `ShoutOut`.

## H. Regression Test

Confirm these still work:

- Patron login
- Patron profile completion
- ShoutOut submission
- Club admin ShoutOut queue
- Approve and push live
- Display URL per location
- Master admin dashboard

## Known Limitation

Friend request approval, inbox, real-time chat, and true end-to-end encrypted chat are not fully implemented in v28. v28 prepares guest-list invitee data structures and friend-based invitee selection for the future `friendships` collection.


---

# v28 Guest List Routing Fix

## What changed

1. The patron portal now routes **Join Guest List** actions to:

```text
guest-list.html
```

instead of the default ShoutOut flow.

2. Guest list links preserve the selected location:

```text
guest-list.html?location=<clubLocationId>
```

3. Promoter referral links are preserved when present:

```text
guest-list.html?location=<clubLocationId>&promoter=<promoterId>
```

## Patron Access URL

Patrons access their portal here:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```

## Guest List Direct URLs

Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.8
```

Christie Cannes:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=christie-cannes-france&v=28.8
```

## Test

1. Open patron portal.
2. Sign in.
3. Choose Clubs.
4. Select a venue.
5. Click **Join Guest List**.
6. Confirm that the app opens `guest-list.html` and not the ShoutOut editor.


---

# v28 Patron Profile Menu + Editable Patron Portal

## Changes

1. Patron status/profile menu now includes:

```text
My Profile
Member Level
Messages (new/total)
Chats (new/total)
```

2. New page:

```text
patron-portal.html
```

3. Patrons can edit:

```text
First Name
Last Name
Display Name
Phone Number
City
Country
Preferred Language
Instagram Handle
X Handle
```

4. Patron portal shows:

```text
My ShoutOuts
My Guest Lists
Messages
Chats
Privacy / GDPR
```

5. Messages and chats show counts such as:

```text
Messages (5/36)
Chats (2/14)
```

## Test URL

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
```


---

# v28 Patron Portal + Profile Menu Correction

## Correction

This package supersedes the prior v27.2 naming.

The requested patron-profile-menu and editable-patron-portal changes are now packaged as **v28**.

## Included v28 features

- Patron status menu includes:
  - My Profile
  - Member Level
  - Messages `(new/total)`
  - Chats `(new/total)`

- Patron portal page:
  - `patron-portal.html`

- Editable patron profile:
  - First Name
  - Last Name
  - Display Name
  - Phone Number
  - City
  - Country
  - Preferred Language
  - Instagram Handle
  - X Handle

- Patron activity sections:
  - My ShoutOuts
  - My Guest Lists
  - Messages
  - Chats
  - Privacy / GDPR

## v28 Test URLs

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
```

Patron home:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```


# v28.4 Fix

Fixes patron expanded menu and guest-list routing. Upload all files, replace existing files, commit, then test `?v=28.8`.

Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8
```

# v28.4 Inbox, Chat Status, ShoutOut Confirmation, and Club Service Isolation

## Includes
- Club-specific service catalog using `SHOUTOUT_LOCATION_SERVICES`
- Internal inbox notifications for ShoutOut submission/approval/rejection
- Global authenticated message/chat/notification status bar
- Simple patron message composer in Patron Portal
- ShoutOut audit collection foundation

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.4 inbox chat and service isolation`
5. Wait 1–3 minutes.
6. Test in Incognito or hard refresh.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.8

## Firestore Rule Additions
```javascript
match /inboxNotifications/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /shoutoutAudit/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /chatMessages/{id} {
  allow create, read, update, delete: if request.auth != null;
}
```


# v28.4 ShoutOut Templates, Photo Upload, AI Suggestions, History, and Role Requests

## Includes
- More standard ShoutOut templates: Classic Black & White, Summer Vibes, Car Meet, Champagne, Beach, Graduation, Wedding, Sports, Luxury Gold, Corporate.
- Native phone photo upload for ShoutOuts using Firebase Storage.
- AI-style ShoutOut suggestion button.
- Past ShoutOut reuse button.
- ShoutOut audit write on submission.
- ShoutOut recommendation/history foundation.
- Role request page for Club Admin, DJ, and Promoter access.
- DJ/Promoter profile foundation for future public profiles.

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.4 storage AI templates and role requests`.
5. Configure Firebase Storage using the guide in ChatGPT response.
6. Add Firestore and Storage rules.
7. Test in Incognito with `?v=28.8`.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.8
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.8

## Future Feature Requests Noted
- DJ public profiles with work samples.
- DJ playlist and merch sales.
- Promoter public marketing profiles.
- Club master admin approval of club service providers.
- Full AI crawler for clubs/events, routed into an admin approval queue.

# v28.5 Media, Video, Templates, and Role Request Release

## New
- Image upload from phone
- Video upload from phone
- Xibo HTML video rendering using autoplay muted loop playsinline
- Classic Black & White template
- Ferrari F8 VIP template
- Rolls-Royce Cullinan VIP template
- Summer Vibes, Champagne Gold, Neon Party templates
- Visible PHOTO/VIDEO placeholders
- ShoutOut recommendation demo section
- Role request page for Club Admin / DJ / Promoter

## Firebase Storage Rules

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

## Firestore Additions

```javascript
match /roleRequests/{id} {
  allow create, read, update, delete: if request.auth != null;
}
match /djProfiles/{id} {
  allow read: if true;
  allow create, update, delete: if request.auth != null;
}
match /promoterProfiles/{id} {
  allow read: if true;
  allow create, update, delete: if request.auth != null;
}
match /shoutoutRecommendations/{id} {
  allow create, read, update, delete: if request.auth != null;
}
```

## Install Steps
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit: `Upload v28.5 media video templates`.
5. Wait 1–3 minutes.
6. Test in Incognito.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.8
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.8
https://jadzadco.github.io/shoutout-demo/display.html?location=zebbies-garden-washington-dc&v=28.8

# v28.6 Media Preview Fix

## Fixes
- Single upload input only: photo OR video.
- Larger displayed media preview.
- Text overlay added to photo/video preview.
- AI recommendation selection now populates the text field and refreshes preview.
- Preview updates when text fields change.

## Install
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test with:
   https://jadzadco.github.io/shoutout-demo/?v=28.8


---

# v28.7 ShoutOut Link on All Club Views

## Fix

Every club/location options screen now forces a visible:

```text
Throw a ShoutOut
```

button, even if the service catalog is missing it.

## Install

1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8
```


# v28.8 Hard Fix — ShoutOut Button on Club Options

Fixes missing `Throw a ShoutOut` button on the Club Options screen.

## Install
1. Extract ZIP.
2. Upload all files to GitHub repo root.
3. Replace existing files.
4. Commit.
5. Test:
   https://jadzadco.github.io/shoutout-demo/?v=28.8

## Verify
Open:
https://jadzadco.github.io/shoutout-demo/patron-app.js?v=28.8

Search for:
v28.8 hardcoded club option ShoutOut insertion

---

# v28.9 Codex Release — Clean Club Options + Contextual Search

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-9-codex-contextual-search-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Club Options now includes a real `Throw a ShoutOut` button in `index.html`.
2. Removed the v28.7/v28.8 timer-based ShoutOut button injection patches from `patron-app.js`.
3. Added contextual/fuzzy patron search in `patron-app.js`.
4. Search now supports natural variations such as:
   - `hiphop clubs in Barcelona`
   - `hip hop clubs in Barcelona, Spain`
   - `hip-hop clubs in Barcelona Spain`
   - `Hip Hope clubs Barcelona Spain`
5. HTML cache-busting query strings were bumped from `v=28.8` to `v=28.9`.

## Files Changed In This Release

```text
index.html
patron-app.js
README.md
*.html cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.9.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

Existing Firebase services still used:

```text
Firebase Auth
Firestore
Firebase Storage
GitHub Pages hosting
```

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with a clear message:

```text
Upload v28.9 contextual search full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with a cache-busting URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Important: do not upload the parent folder itself. Upload the files inside the package so `index.html`, `patron-app.js`, `firebase-config.js`, and the other app files remain at the repository root.

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Barcelona ShoutOut search flow:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9
```

Guest list direct page:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.9
```

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.9
```

Role request:

```text
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.9
```

Display page:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&v=28.9
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Select `Clubs`.
4. Confirm Club Options shows `Throw a ShoutOut`.
5. Click `Throw a ShoutOut`.
6. Confirm the ShoutOut location picker opens.
7. Search:

```text
hiphop
hiphop clubs in Barcelona
hip hop clubs in Barcelona, Spain
hip-hop clubs in Barcelona Spain
Hip Hope clubs Barcelona Spain
```

8. Confirm Barcelona Hip Hop-capable venues appear, including Shoko Barcelona / Shoko Barcelona Beach Club where available.
9. Pick a location.
10. Confirm the template page opens.
11. Go back and test `Join Guest List`.
12. Confirm Guest List does not route to ShoutOut templates.
13. Submit a test ShoutOut only if you want to create real Firestore/Storage records.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. In GitHub, open the commit that uploaded v28.9.
2. Use GitHub's revert option, or manually upload the previous known-good package.
3. Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.8-rollback-test
```

Manual rollback:

1. Keep the prior package ZIP before uploading a new release.
2. If v28.9 has problems, upload the prior package contents back to the repo root.
3. Commit with:

```text
Rollback from v28.9 to previous package
```

### Firestore / Storage Rollback

This v28.9 release does not require Firestore or Storage config changes.

For future releases that change Firestore data, rules, indexes, or Storage rules:

1. Export or document the current rules before changing them.
2. Record every new collection, document field, index, and Storage path in this README.
3. Include a forward migration and rollback migration.
4. If seed data changes, keep the old seed package or a JSON export.
5. For destructive data changes, do not run them from the live app; use a reviewed admin script and keep a backup/export first.

Recommended future rollback artifacts per release:

```text
release ZIP
README.md with changed files
Firestore rules before/after
Storage rules before/after
Firestore indexes before/after
Seed/migration notes
Known-good test URL
Rollback test URL
```

## Known Limits

The contextual search is a lightweight client-side matcher. It normalizes punctuation, spacing, accents, and common genre aliases, and allows small typos. It is not yet a server-side semantic search engine.

Future upgrade path:

```text
Firestore indexed search fields
Algolia / Typesense / Meilisearch
AI-assisted search query parsing
User preference ranking
Location-aware ranking
```

---

# v28.10 Codex Release — Search Display Cleanup

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-10-contextual-search-ui-cleanup-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Removed the visible dropdown filters from the Search / Choose Location page:
   - Country
   - State / Region / Province
   - City
   - Music genre
2. Kept the single contextual search box as the main search interface.
3. Updated the search page helper copy:

```text
Search naturally by city, country, venue, genre, artist, event day, or activity date.
```

4. Updated the search placeholder:

```text
Try hiphop clubs in Barcelona, Afro House in Miami, or Friday events in DC...
```

5. Bumped HTML/JS cache-busting query strings to `v=28.10`.

## Files Changed In This Release

```text
index.html
patron-app.js
README.md
ROLLBACK-V28-10.md
*.html / *.js cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.10.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with a clear message:

```text
Upload v28.10 contextual search UI cleanup full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10
```

Important: do not upload the parent folder itself. Upload the files inside the package so `index.html`, `patron-app.js`, `firebase-config.js`, and the other app files remain at the repository root.

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10
```

Guest list direct page:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.10
```

Patron portal:

```text
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.10
```

Role request:

```text
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.10
```

Display page:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&v=28.10
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Click `Throw a ShoutOut`.
4. Confirm the search page shows only one search input and no Country / State / City / Music Genre dropdown row.
5. Search:

```text
hiphop in dc
hiphop clubs in Barcelona
hip hop clubs in Barcelona, Spain
hip-hop clubs in Barcelona Spain
Hip Hope clubs Barcelona Spain
```

6. Confirm matching venues appear.
7. Pick a location.
8. Confirm the template page opens.
9. Go back and test `Join Guest List`.
10. Confirm Guest List does not route to ShoutOut templates.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. In GitHub, revert the commit that uploaded v28.10.
2. Or upload the previous known-good package, such as v28.9.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9-rollback-test
```

Manual rollback:

1. Upload the prior package contents back to the repo root.
2. Commit with:

```text
Rollback from v28.10 to previous package
```

### Firestore / Storage Rollback

This v28.10 release does not require Firestore or Storage config changes.

No database rollback is needed unless live test submissions were created manually during testing. If test ShoutOuts or guest list requests were submitted, delete only those specific test records from Firestore and any matching test media under `shoutouts/{uid}/...` in Firebase Storage.

---

# v28.11 Codex Release — Template Preview Cleanup

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-11-template-preview-cleanup-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Traditional Black & White now uses a tighter red/black marquee-board direction.
2. Removed extra brand text from display preview output.
3. Removed the display footer line from preview output.
4. Added clear labels for templates that do or do not use media.
5. Added image/video placeholder templates:
   - Happy Birthday with image/video placeholder
   - Happy Anniversary with image/video placeholder
   - Happy Engagement with image/video placeholder
   - Fiance Celebration with image/video placeholder
6. Added 50/50 split layout for media templates: media on one side, ShoutOut text on the other.
7. Added a car-themed Luxury Car Celebration template direction.
8. Simplified template selection with a search box.
9. Set Traditional Black & White as the default template.
10. Bumped cache-busting query strings to `v=28.11`.

## Files Changed In This Release

```text
index.html
shared-data.js
patron-app.js
display.html
display-app.js
display.css
styles.css
README.md
ROLLBACK-V28-11.md
rollback-v28-11.ps1
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.11.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

This release changes frontend display/template behavior only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with:

```text
Upload v28.11 template preview cleanup full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11
```

## Test URLs

Patron app:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11
```

Display preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=blackwhite&main=HAPPY%20BIRTHDAY&sub=STACY&v=28.11
```

Birthday media template preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=birthdayMedia&main=HAPPY%20BIRTHDAY&sub=CELEBRATE%20BIG&v=28.11
```

Car template preview:

```text
https://jadzadco.github.io/shoutout-demo/display.html?location=shoko-barcelona-spain&template=car&main=LUXURY%20RIDE%20CREW&sub=PULL%20UP%20CLEAN&v=28.11
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in as a patron.
3. Search and select a location.
4. Confirm the template selection screen has a template search box.
5. Confirm Traditional Black & White is selected by default.
6. Confirm media templates are labeled as image/video placeholder templates.
7. Continue to editor.
8. Confirm the display preview no longer shows club name / Jadz AdCo header text.
9. Confirm the display preview no longer shows the footer line.
10. Test Traditional Black & White.
11. Test one image/video placeholder template.
12. Test Luxury Car Celebration.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.11.
2. Or upload the previous known-good package, such as v28.10.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10-rollback-test
```

Manual rollback:

1. Upload the prior package contents back to the repo root.
2. Commit with:

```text
Rollback from v28.11 to previous package
```

Helper script:

```powershell
.\rollback-v28-11.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

### Firestore / Storage Rollback

This v28.11 release does not require Firestore or Storage config changes.

No database rollback is needed unless live test submissions were created manually during testing. If test ShoutOuts, guest list requests, or media uploads were created, delete only those test records/media.

---

# v28.12 Codex Release — Avatar Dropdown Link Color Fix

Generated: 2026-06-23  
Package: `jadz-shoutout-v28-12-avatar-dropdown-link-color-full-package.zip`

This is a full upload package. It contains all web app files, not only changed files.

## What Changed

1. Fixed avatar/user dropdown links so they remain white in all browser link states.
2. Added explicit CSS coverage for:
   - normal links
   - unvisited links
   - visited links
   - hover
   - active
   - focus
3. Applied the rule to both `.user-menu` and `.user-dropdown`.
4. Preserved the dropdown link layout with block display, readable spacing, and hover opacity.
5. Bumped cache-busting query strings to `v=28.12`.

## Files Changed In This Release

```text
styles.css
README.md
ROLLBACK-V28-12.md
rollback-v28-12.ps1
*.html / *.js cache-busting query strings
```

## Firebase / Firestore / Storage Impact

No Firebase project configuration changes are required for v28.12.

No Firestore collections were added or removed.

No Firestore document shapes were changed.

No Firebase Storage paths were changed.

No Firestore Security Rules or Storage Rules changes are required for this release.

This release changes frontend CSS only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Open the extracted folder.
3. Upload the contents of the extracted folder to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

4. Replace the existing files in the repo root.
5. Commit with:

```text
Upload v28.12 avatar dropdown link color full package
```

6. Wait 1-3 minutes for GitHub Pages to publish.
7. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12
```

## Manual Test Checklist

1. Open the patron app URL.
2. Sign in.
3. Open the avatar/user dropdown.
4. Confirm `My Profile`, `Messages (0/0)`, and `Chats (0/0)` are white.
5. Click one of the links.
6. Go back to the app.
7. Open the dropdown again.
8. Confirm the clicked/visited link is still white, not blue or purple.
9. Hard refresh or open incognito and repeat.

## Rollback Plan

### Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.12.
2. Or upload the previous known-good package, such as v28.11.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.11-rollback-test
```

Helper script:

```powershell
.\rollback-v28-12.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

### Firestore / Storage Rollback

This v28.12 release does not require Firestore or Storage config changes.

No database rollback is needed.

---

# Jadz AdCo ShoutOut v28.13 Navigation + Patron Role Request Fix

## Package

```text
jadz-shoutout-v28-13-navigation-role-request-full-package.zip
```

## What Changed

- Added a global Back button to the patron app workflow after sign-in.
- Added Back navigation to `patron-portal.html` and `role-request.html`.
- Removed the Club Admin / DJ / Promoter request link from the public search/ShoutOut page.
- Kept the access request link only inside the patron portal profile summary.
- Updated the role request script to match the current form IDs and submit the selected role request.
- Preserved the v28.12 avatar dropdown white-link fix.
- Bumped active cache-busting links and scripts to `v=28.13`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

The role request form continues to use existing request/profile collections. No schema migration is required.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.13 navigation role request full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Confirm the Back button appears after leaving the login screen.
3. Move through category, search, template, editor, and confirmation screens.
4. Confirm Back returns to the previous workflow screen.
5. Confirm the main search/ShoutOut page does not show `Request Club Admin / DJ / Promoter Access`.
6. Open `patron-portal.html?v=28.13`.
7. Confirm the profile summary still shows `Request Club Admin / DJ / Promoter Access`.
8. Open the role request page from the patron portal.
9. Confirm DJ, Promoter, and Club Admin choices are available.
10. Open the avatar dropdown and confirm My Profile, Messages, and Chats remain white, including visited links.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.13.
2. Or upload the previous known-good package, such as v28.12.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.12-rollback-test
```

Helper script:

```powershell
.\rollback-v28-13.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.13.

---

# Jadz AdCo ShoutOut v28.14 Classic Black & White Board Text Layout

## Package

```text
jadz-shoutout-v28-14-classic-black-white-board-layout-full-package.zip
```

## What Changed

- Updated the Classic Black & White ShoutOut renderer to behave like a three-row physical cut-out letter board.
- Kept the current red/black outer sign background and white center board.
- Forces Classic Black & White text to render only inside the white board area.
- Auto-breaks birthday-style text such as `Happy Birthday D` into:

```text
HAPPY
BIRTHDAY
D
```

- Uses bold black uppercase block letters.
- Adds subtle depth/shadow behind the letters to mimic physical plastic cut-out letters.
- Adds faint horizontal guide rails/grooves behind the text rows.
- Keeps editor preview and final display consistent because both use `display.html` and `display-app.js`.
- Bumped active cache-busting links and scripts to `v=28.14`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend template rendering update only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.14 classic black white board layout full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Choose a location and select the Traditional Black & White template.
3. Enter `Happy Birthday D` as the main message.
4. Confirm preview row 1 is `HAPPY`.
5. Confirm preview row 2 is `BIRTHDAY`.
6. Confirm preview row 3 is `D`.
7. Confirm all letters remain inside the white center board.
8. Confirm faint horizontal guide rails/grooves appear behind each row.
9. Confirm letters are bold black uppercase with subtle physical depth/shadow.
10. Submit or preview the final display URL and confirm it matches the editor preview.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.14.
2. Or upload the previous known-good package, such as v28.13.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.13-rollback-test
```

Helper script:

```powershell
.\rollback-v28-14.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.14.

---

# Jadz AdCo ShoutOut v28.15 Classic Board Preview Alignment Fix

## Package

```text
jadz-shoutout-v28-15-classic-board-preview-alignment-full-package.zip
```

## What Changed

- Fixed the Classic Black & White preview so text no longer floats into the red/black background.
- Moved the three-row text grid lower and tighter inside the white center board.
- Reduced row font sizing for iframe/mobile previews so large words stay inside the board.
- Forced the normal subtitle element to stay hidden for the Classic Black & White template.
- Renders the main and sub message through the same three board rows.
- Example: `DB in da House` plus `Holla @the_don_4ld` now becomes:

```text
DB IN DA
HOUSE
HOLLA
```

- Preserves the birthday-specific split:

```text
HAPPY
BIRTHDAY
D
```

- Bumped active cache-busting links and scripts to `v=28.15`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend display rendering update only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.15 classic board preview alignment full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15
```

## Manual Test Checklist

1. Open the patron app and sign in.
2. Choose Traditional Black & White.
3. Enter `DB in da House` as the main message.
4. Enter `Holla @the_don_4ld` as the sub message.
5. Confirm the preview text stays inside the white board.
6. Confirm the sub message does not appear as a separate floating line.
7. Test `Happy Birthday D` and confirm the rows are `HAPPY`, `BIRTHDAY`, and `D`.
8. Confirm final display URL matches the editor preview.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.15.
2. Or upload the previous known-good package, such as v28.14.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.14-rollback-test
```

Helper script:

```powershell
.\rollback-v28-15.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.15.

---

# Jadz AdCo ShoutOut v28.16 Media Upload Display Pipeline Fix

## Package

```text
jadz-shoutout-v28-16-media-upload-display-pipeline-full-package.zip
```

## What Changed

- Fixed patron media submissions so the visible Photo/Video uploader is awaited before the Firestore ShoutOut document is created.
- Saves these fields on submitted ShoutOut documents when media exists:

```text
mediaUrl
mediaType
mediaFileName
mediaStoragePath
mediaUploadedAt
```

- Admin approval now copies those media fields into `liveContent/{clubLocationId}`.
- Display rendering now uses `mediaType` first:
  - `image` renders an `<img>`.
  - `video` renders `<video autoplay muted loop playsinline>`.
- The `IMAGE / VIDEO` placeholder appears only when no `mediaUrl` exists.
- Admin preview links now include `mediaType`.
- Existing text-only ShoutOuts continue to work.
- Fixed an approval notification bug where approval also created rejected audit/notification entries.
- Bumped active cache-busting links and scripts to `v=28.16`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No migration is required. New media metadata fields are added only to new submissions with uploaded media.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.16 media upload display pipeline full package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16
```

## Manual Test Checklist

1. Submit a ShoutOut with an image.
2. Confirm `shoutouts/{id}` contains `mediaUrl` and `mediaType: image`.
3. Approve it as admin.
4. Confirm `liveContent/{clubLocationId}` contains the same media fields.
5. Open `display.html?location=zebbies-garden-washington-dc&v=28.16`.
6. Confirm the uploaded image appears instead of `IMAGE / VIDEO`.
7. Repeat with an MP4 video.
8. Confirm the video autoplays muted and loops.
9. Submit a text-only media template ShoutOut.
10. Confirm the placeholder appears only when no media was uploaded.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.16.
2. Or upload the previous known-good package, such as v28.15.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.15-rollback-test
```

Helper script:

```powershell
.\rollback-v28-16.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

Database rollback is normally not needed. If a specific media ShoutOut must be removed, delete or update only that `liveContent/{clubLocationId}` document or the related pending `shoutouts/{id}` document manually.

---

# Jadz AdCo ShoutOut v28.16-f Consolidated Fix Package

## Package

```text
shoutoutwepp,vers-28.16-f-full-package.zip
```

## What Changed

- Consolidated the previous v28.16 media upload/display pipeline fix and the Classic Black & White board size refinement into one `28.16-f` fix release.
- Adopted release suffix convention: `-f` for fixes and `-nf` for new features.
- Enlarged the Classic Black & White white center board.
- Moved the white board upward to reduce excess red/black header space.
- Enlarged and strengthened the three cut-out letter rows.
- Preserved the three-row board behavior and birthday split.
- Preserved the v28.16 media upload/display pipeline fix.
- Bumped active cache-busting links and scripts to `v=28.16-f`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

No database migration is required. This is a frontend display CSS refinement only.

## Install / Upload Steps

1. Extract the ZIP package.
2. Upload the extracted files to the GitHub repo root:

```text
https://github.com/jadzadco/shoutout-demo
```

3. Replace existing files.
4. Commit with:

```text
Upload v28.16-f consolidated fix package
```

5. Wait 1-3 minutes for GitHub Pages to publish.
6. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16-f
```

## Manual Test Checklist

1. Open a Classic Black & White display preview.
2. Confirm the white center board is larger than v28.16.
3. Confirm the text is larger and bolder.
4. Confirm text remains fully inside the white board.
5. Confirm the red/black header space above the board is reduced.
6. Confirm image/video templates still render uploaded media.

## Rollback Plan

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.16-f.
2. Or upload the previous known-good package, such as v28.16.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.16-rollback-test
```

Helper script:

```powershell
.\rollback-v28-16-f.ps1 -PreviousPackagePath "C:\path\to\previous-package.zip" -OutputPath "C:\path\to\rollback-upload"
```

The helper script prepares a rollback upload folder from a previous ZIP. It does not push to GitHub or delete live data.

No Firestore or Storage rollback is needed for v28.16-f.
