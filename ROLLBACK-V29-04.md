# FLOQR Rollback - v29.04

This rollback returns FLOQR to the previous known-good v29.03 package before patron-facing club public pages, the required-profile access guard, scoped Inbox loading, manual command acknowledgement closing, and Mingl Accept/Deny actions.

## Rollback steps

1. Upload the previous full package, `ShoutOut-wepApp.v29.03.zip`, to the GitHub Pages repository root.
2. Hard refresh the app with:

```text
https://jadzadco.github.io/shoutout-demo/?v=29.03
```

3. If v29.04 rule headers were published, republish the v29.03 rule files only when exact package-marker alignment is required by diagnostics.
4. Rerun Master Admin > Diagnostics > Package Install Diagnostics and Rules Smoke Test.

## Data impact

Rollback does not delete users, profiles, club locations, club media, events, Mingl data, messages, or notifications.

New optional `clubLocations` fields may remain after rollback, including `logoUrl`, `tagline`, `description`, `hours`, `agePolicy`, `dressCode`, `amenities`, `publicServices`, `featuredDjs`, `featuredStaff`, `promotionGroups`, `publicProfilePublished`, and `publicProfileSections`. v29.03 ignores unused fields.

Mingl connections denied in v29.04 retain `status: "denied"`, `deniedByUid`, and `deniedAt`. Rollback does not reopen denied requests.

## What v29.04 changed

- Added a patron-facing club profile page and Venue Command Center publishing controls.
- Added profile-completion checks to protected deep links.
- Replaced broad Inbox collection reads with scoped queries and progressive directory loading.
- Added `Close Window` to automatic FLOQR command acknowledgements.
- Added visual feedback to Manage Mingl Friends save.
- Added Accept and Deny controls for received Mingl requests in Mingl and Inbox.
