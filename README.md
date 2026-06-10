# Jadz AdCo ShoutOut v24 Admin Analytics + Master Admin Package

## Deployment

Upload/replace **all files** in this ZIP at the GitHub repository root.

Then test:

```text
https://jadzadco.github.io/shoutout-demo/?v=24
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
