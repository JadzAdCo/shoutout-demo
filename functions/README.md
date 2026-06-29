# FLOQR AI Functions

This folder contains deployable Firebase Functions for FLOQR AI crawling and source extraction. The GitHub Pages app can call HTTPS callable functions after Firebase Auth verifies the user.

Included functions:

- Scheduled public-source discovery crawl 4-6 times per day. It extracts records from configured public source URLs and skips generic API documentation/manual-source placeholders instead of publishing fake listings.
- Search-results guard. Google/Ticketmaster/Eventbrite directory pages are not saved as approvable discovery records; the crawler must use a final event/venue detail URL or official API detail data.
- `aiExtractPublicSourceUrl`, which fetches a public source URL server-side, parses Eventbrite/Ticketmaster/venue metadata where available, extracts JSON-LD event data, and returns a structured `aiDiscoveryQueue`-ready record.
- `aiEnhanceShoutOutMedia`, which checks Firebase Auth, verifies the requested Storage path is owned by the signed-in user, calls Gemini image editing with the server-side `GEMINI_API_KEY` secret, stores the enhanced image under `shoutouts/{uid}/{reference}/enhanced/`, and returns structured media metadata.
- HTTPS callable AI/search placeholders for app integration points.

Supported discovery targets include Ticketmaster, Eventbrite, approved resale partners, official venue/feed pages, nightclubs, lounges, rooftop lounges, rooftop bars, beach clubs, brunch parties, pool parties, summer parties, DJ events, promoter events, comedy shows, Latin music, Arabic music, and ticket resale opportunities.

Do not place AI API keys in frontend code. Use Firebase Functions, Cloud Run Functions, Secret Manager, and Firebase Auth checks.

## Gemini Media Editing Setup

Set the Gemini API key as a Firebase Functions secret before deploying:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions:aiEnhanceShoutOutMedia
```

The default image model is `gemini-3.1-flash-image`. To override it in backend runtime configuration, set `FLOQR_GEMINI_IMAGE_MODEL`.

After deployment, run Master Admin > Diagnostics. `ShoutOut: Media AI panel` passes only when the callable responds in diagnostic mode and the secret is available.
