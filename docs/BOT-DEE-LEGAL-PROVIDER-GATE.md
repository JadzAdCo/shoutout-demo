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
| ticketmaster_discovery | Ticketmaster Discovery | event search / details — **not** ticket sales |
| ticketmaster_partner | Ticketmaster Partner | reserve/purchase — needs a signed distribution contract |
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

### Later-fill slots (no live HTTP yet)

Fill slots exist for Google Places, Gemini Search grounding, Yelp, Ticketmaster Discovery, Ticketmaster Partner, and Eventbrite.

1. Put the key in `config/accounts-profile.local.json` under `accounts.botDeeProviders.fields.<key>.value` (gitignored). Names: `BOTDEE_GOOGLE_PLACES_API_KEY`, `BOTDEE_GEMINI_GROUNDING_API_KEY`, `BOTDEE_YELP_API_KEY`, `BOTDEE_TICKETMASTER_DISCOVERY_API_KEY`, `BOTDEE_TICKETMASTER_PARTNER_API_KEY`, `BOTDEE_EVENTBRITE_API_KEY`.
2. Dry run `node scripts/seed-accounts-profile.js --only botDeeProviders`, then `--apply --confirm-project shoutoutdemo-5b402` (stdin secrets, never argv). Redeploy Functions from `origin/main` so the runtime can see the secret.
3. Master Admin → Features Mgmt → BOT DEE → Later-fill integration slots: set **Enable slot**, paste a **legal evidence ref** (ticket/memo id, not the API key), optional billing ref + expiry → Save (SOS2FA + reason).
4. Runtime stays **mock** until `enabled=1` **and** the named secret is present **and** evidence ref is set **and** not expired. **Live vendor HTTP is still not implemented** — filling a slot does not open Google/Yelp/Ticketmaster/Eventbrite.

Missing or unknown slots stay mock. Do not paste secret values into Firestore or the Master Admin form.
