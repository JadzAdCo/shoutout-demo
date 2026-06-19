# Jadz AdCo ShoutOut v24 Admin Analytics + Master Admin Package

## Deployment

Upload/replace **all files** in this ZIP at the GitHub repository root.

Then test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.4
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
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/?v=28.4
```

Zebbies Garden DC Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
5. Cache-busting updated to `v=28.4`.

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
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/auth-debug.html?v=28.4
```

If Microsoft fails on `auth-debug.html`, the issue is provider/browser/Firebase configuration, not the admin role logic.

## Test URLs

Club Admin:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4
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
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4
```

Guest List - Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.4
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.4
```

Club Admin - Zebbies DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4
```

Guest List — Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.4
```

Promoter Admin:

```text
https://jadzadco.github.io/shoutout-demo/promoter-admin.html?v=28.4
```

Club Admin — Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/admin.html?location=zebbies-garden-washington-dc&v=28.4
```

Master Admin:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28.4
```

Translation Policy:

```text
https://jadzadco.github.io/shoutout-demo/translation-policy.html?v=28.4
```

# Comprehensive Testing Plan

## A. Upload / Cache Test

1. Upload all package files to GitHub Pages.
2. Open each page with `?v=28.4`.
3. Hard refresh with Ctrl+Shift+R.
4. Confirm no page is stuck on `Loading...`.

## B. Guest List Intake Test

1. Open:

```text
guest-list.html?location=zebbies-garden-washington-dc&v=28.4
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
admin.html?location=zebbies-garden-washington-dc&v=28.4
```

2. Sign in with approved admin Google account.
3. Open `Guest Lists / Promoters` tab.
4. Confirm guest list totals appear for Zebbies only.
5. Confirm promoter performance appears.
6. Confirm Shôko or Christie records do not appear on Zebbies admin.

## E. Promoter Admin Test

1. Open:

```text
promoter-admin.html?v=28.4
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
master-admin.html?v=28.4
```

2. Sign in with master admin Google account.
3. Open `Promoters` tab.
4. Confirm network-wide promoter totals appear.

## G. Translation / Protected Terms Test

1. Open:

```text
translation-policy.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/?v=28.4
```

## Guest List Direct URLs

Zebbies Garden DC:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4
```

Shôko Barcelona:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=shoko-barcelona-spain&v=28.4
```

Christie Cannes:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=christie-cannes-france&v=28.4
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
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.4
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
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.4
```

Patron home:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.4
```


# v28.4 Fix

Fixes patron expanded menu and guest-list routing. Upload all files, replace existing files, commit, then test `?v=28.4`.

Test:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.4
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4
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
https://jadzadco.github.io/shoutout-demo/?v=28.4
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.4
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28.4

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
7. Test in Incognito with `?v=28.4`.

## Test URLs
https://jadzadco.github.io/shoutout-demo/?v=28.4
https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=28.4
https://jadzadco.github.io/shoutout-demo/role-request.html?v=28.4

## Future Feature Requests Noted
- DJ public profiles with work samples.
- DJ playlist and merch sales.
- Promoter public marketing profiles.
- Club master admin approval of club service providers.
- Full AI crawler for clubs/events, routed into an admin approval queue.
