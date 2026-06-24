# Rollback Guide: FLOQR ShoutOut v28.25-nf

Release package:

```text
shoutoutwepp,vers-28.25-nf-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.25-nf
```

## What v28.25-nf Changed

- Added Public Profile tab in the patron portal.
- Added profile templates for Patron, Promoter, DJ, and Waiter / Waitress / Bottle Girl.
- Added patron social profile fields for music, travel, hobbies, nightlife style, looking-to-meet, bio, visibility, and profile type.
- Added 10 patron profile media slots: 8 image slots and 2 short-video slots.
- Added Firebase Storage upload support for profile media.
- Corrected direct inbox messaging rules in the patron portal UI.
- Added inbox envelope behavior with sender, timestamp, subject, body, read/unread state, and read-on-open updates.
- Normalized system notifications as internal inbox messages from `System Message`.
- Added chat policy guidance for mutual follow and patron-originated action requirements.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore indexes added or removed.

No Firestore rules are included in this package. Before production launch, enforce the messaging, chat, follow, and profile-media permissions in Firestore Security Rules or a trusted server function.

New or expanded user profile fields may be written to `users/{uid}`:

```text
publicProfileType
publicProfileVisibility
musicInterests
travelInterests
hobbies
nightlifeStyle
lookingToMeet
bio
profileMediaSlots
profileMediaUpdatedAt
```

Profile media may be uploaded to:

```text
profileMedia/{uid}/images/...
profileMedia/{uid}/videos/...
```

Inbox documents in `messages` and `inboxNotifications` may receive:

```text
read
readAt
openedAt
firstOpenedAt
```

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.25-nf.
2. Or upload the previous known-good v28.24-f package or stable v28.22-s package.
3. Wait 1-3 minutes for GitHub Pages to republish.
4. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.24-f-rollback-test
```

Manual rollback:

1. Extract the previous known-good package.
2. Upload the package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.25-nf
```

## Database / Storage Rollback

No required database migration rollback.

Optional cleanup:

1. Remove or ignore the new profile fields on `users/{uid}`.
2. Delete uploaded files under `profileMedia/{uid}/...` if the media profile feature is rolled back and storage cleanup is desired.
3. Leave message `readAt`, `openedAt`, and `firstOpenedAt` fields in place unless you specifically need to reset read state.
