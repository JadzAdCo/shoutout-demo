# FLOQR Rollback - v29.01

Rollback target: restore the previous tested package if the Club / Promoter Onboarding, Club Admin media controls, role election scaffolding, or guest list campaign controls need to be backed out.

## What Changed

- Added Master Admin > Club / Promoter Onboarding.
- Added single-club onboarding, CSV club import preview/import, and promoter onboarding records.
- Added predictable club admin portal URLs for onboarded club locations.
- Added Club Admin venue media controls with 1 main media, 5 public images, and 5 marketing videos.
- Added Club Admin role election scaffolding for Club Admin, DJ, Promoter, and Waiter / Waitress / Bottle Girl.
- Added Club Admin guest list campaign creation with enable, disable, archive, and reuse status.
- Added Firestore rules for `clubOnboardingRecords`, `promoterOnboardingRecords`, `clubMedia`, and `guestListCampaigns`.
- Added Storage rules for `clubMedia/{clubLocationId}/...`.

## Rollback Steps

1. Re-upload the previous full package ZIP to GitHub Pages.
2. Restore the previous `firestore.rules` and `storage.rules` from the prior package if v29.01 rules were published.
3. Keep Firestore data unless a specific onboarding test record must be removed manually.
4. If test records were created, remove only known test documents from:
   - `clubOnboardingRecords`
   - `promoterOnboardingRecords`
   - `clubMedia`
   - `guestListCampaigns`
   - matching test `clubLocations` / `clubs`

This rollback does not delete user profile data, ShoutOut history, Mingl history, guest list request history, or approved live display content.
