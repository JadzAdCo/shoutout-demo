# Jadz AdCo ShoutOut v28 — Patron Portal + Role Requests

## Step-by-Step Implementation

### 1. Upload package
Upload and replace all files in this ZIP at your GitHub repository root.

### 2. Update Firestore rules
Open `firestore-rules-v28.txt`, copy everything, paste into Firebase Console > Firestore Database > Rules, then publish.

### 3. Test patron portal
Open:

```text
https://jadzadco.github.io/shoutout-demo/portal.html?v=28
```

Expected: Google login, overview, member level, ShoutOuts, guest lists, messages, role requests, and privacy/GDPR tabs.

### 4. Test profile menu link
Open:

```text
https://jadzadco.github.io/shoutout-demo/?v=28
```

Sign in, open the profile menu, and select `My Portal`.

### 5. Test additional role request
In Patron Portal, open `Request Access`. Do not select Patron; Patron is default. Select one or more of Club Admin, Club DJ, Promoter, Venue Owner, or Advertiser. Promoters and DJs must select clubs/events they represent. Submit.

Expected Firestore collection: `roleRequests` with `status: pending`.

### 6. Test Master Admin approval
Open:

```text
https://jadzadco.github.io/shoutout-demo/master-admin.html?v=28
```

Open `Role Requests`. Approve or reject a pending request.

### 7. Test guest list
Open:

```text
https://jadzadco.github.io/shoutout-demo/guest-list.html?location=zebbies-garden-washington-dc&v=28
```

Expected: First Name, Last Name, legal ID confirmation, promoter required, additional guests, and Firestore write to `guestListRequests`.

## New Files

- `portal.html`
- `portal-app.js`
- `firestore-rules-v28.txt`

## New Collections

- `roleRequests`
- `privacyRequests`
- `notifications`
- `chatRooms`
- `messages`
- `friendRequests`
- `friendships`

## Notes

- Patron is always the default role.
- Elevated roles require Master Admin approval.
- Chat and inbox are foundational UI sections in v28, not full E2E messaging yet.
- Production role enforcement should later move to Firebase custom claims or a secured `adminRoles` collection.
