# BOT DEE legal provider gate

Master Admin prompt (must be asked before each provider):

> This integration requires provider authorization and legal review. Have you obtained the required API access, commercial license/partner agreement, data display/caching rights, privacy approval and any booking permissions? Please provide evidence. Until confirmed I will implement only a mock interface.

Technical feasibility is **not** permission. Cursor does not certify legality.

## Default matrix (this PR)

Every provider ships `status: blocked`, `mode: mock_only`, `evidenceRecorded: false`.

| id | Label | Intended use |
|---|---|---|
| google_places | Google Places/Maps | places, ratings, photos, addresses — **do not cache photos/reviews as a permanent DB** |
| gemini_grounding | Gemini grounded search | cited web research — **do not scrape Google AI Mode** |
| yelp | Yelp | business ratings/reviews |
| ticketmaster | Ticketmaster | event discovery / tickets |
| eventbrite | Eventbrite | events / ticket links |
| airbnb | Airbnb | short-term rentals |
| opentable | OpenTable | menus / reservations |
| resy | Resy | dining reservations |
| tesla | Tesla | vehicle specs/images |
| nhtsa_iihs | NHTSA / IIHS | crash tests / recalls |
| mls_idx | Real estate MLS/IDX/RESO | listings |
| hotels_flights | Hotels / flights / travel | availability and booking |

## How to record evidence

Master Admin → Features Mgmt → **BOT DEE** → Version and legal gates → pick provider → tick evidence → Save (SOS2FA + reason). Approved **without** evidence stays mock-only.

Live API adapters must not be enabled until evidence is recorded **and** the owner approves a Functions deploy.
