# FLOQR AI, Commerce, Campaign, and Pickup Functions

This folder contains deployable Firebase Functions for FLOQR AI crawling and source extraction. The GitHub Pages app can call HTTPS callable functions after Firebase Auth verifies the user.

Included functions:

- `requestEmailOtp` and `verifyEmailOtp`: SendGrid-delivered, eight-character alphanumeric email codes with server-side HMAC hashes, five-minute expiry, resend throttling, attempt limits, one-time use, and Firebase custom-token sign-in.
- `assignClubAdmin`: Master Admin-only assignment of a completed patron who elected an eligible service role to a specific `clubLocations` record.
- `createFloqrCheckoutSession`: server-priced Stripe Checkout for ShoutOuts, Commerce, targeted distribution, and paid SMS notification service.
- `createFloqrConnectOnboardingLink`: authorization-checked Accounts v2 recipient-account creation plus Stripe-hosted onboarding/account-update links for a club or the signed-in member.
- `getFloqrConnectStatus`: retrieves the trusted Accounts v2 recipient capability and returns only readiness/status data to the authorized club admin or member.
- `stripeFloqrWebhook`: Stripe SDK-verified, idempotent Checkout completion/delayed-payment/expiration handling, paid-service invoicing, fulfillment records, paid ShoutOut submission, and targeted campaign creation.
- `publishFloqrFollowerCampaign`: authorization-checked delivery to an entity's own followers.
- `requestTeslaRobotaxiPickup`: records a provider-handoff request only. The v29.07 browser experience uses a clearly labeled no-charge/no-dispatch simulation because no public third-party Tesla Robotaxi booking endpoint is configured.
- `scheduledAiDiscoveryCrawl`: a 15-minute dispatcher that honors saved per-day run times and IANA timezone settings, claims each local run slot once, crawls approved sources, and optionally runs localized Google Places Text Search jobs.

- Scheduled public-source discovery crawl at the times selected in Master Admin. It extracts records from configured public source URLs and skips generic API documentation/manual-source placeholders instead of publishing fake listings.
- Search-results guard. Google/Ticketmaster/Eventbrite directory pages are not saved as approvable discovery records; the crawler must use a final event/venue detail URL or official API detail data.
- `aiExtractPublicSourceUrl`, which fetches a public source URL server-side, parses Eventbrite/Ticketmaster/venue metadata where available, extracts JSON-LD event data, and returns a structured `aiDiscoveryQueue`-ready record.
- `aiEnhanceShoutOutMedia`, which checks Firebase Auth, verifies the requested Storage path is owned by the signed-in user, calls Gemini image editing with the server-side `GEMINI_API_KEY` secret, stores the enhanced image under `shoutouts/{uid}/{reference}/enhanced/`, and returns structured media metadata.
- `aiSuggestShoutOut`, which uses Gemini text generation through the same server-side secret to return LED-safe ShoutOut copy, with curated fallback if Gemini is unavailable.
  - v28.86 also accepts privacy-safe client context (`profileSignals` and the signed-in user's own `pastShoutouts`) so suggestions can be personalized without indexing private chats, payment data, or other users' data.
- `aiSuggestGrammarCorrection`, which corrects user-requested draft text for chat/messages/profile copy through Gemini JSON output. Drafts are not indexed and are not stored by the function.
- `aiRankLocations`, which ranks public club/event/location results using the signed-in user's own non-sensitive location and preference context, with deterministic fallback if Gemini is unavailable.
- HTTPS callable AI/search placeholders for app integration points.

Supported discovery targets include Ticketmaster, Eventbrite, approved resale partners, official venue/feed pages, nightclubs, lounges, rooftop lounges, rooftop bars, beach clubs, brunch parties, pool parties, summer parties, DJ events, promoter events, comedy shows, Latin music, Arabic music, and ticket resale opportunities.

Do not place AI API keys in frontend code. Use Firebase Functions, Cloud Run Functions, Secret Manager, and Firebase Auth checks.

## Stripe setup

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with Firebase Functions secrets. Prefer a least-privilege restricted Stripe API key (`rk_...`) as the value of `STRIPE_SECRET_KEY`; never place either value in browser code or source control. The backend uses Stripe Node SDK 22.3.1 with API behavior pinned to `2026-06-24.dahlia`.

Configure Stripe to send `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, and `charge.dispute.closed` to the deployed `stripeFloqrWebhook` endpoint. Payment methods are controlled dynamically from the Stripe Dashboard, enabling Apple Pay on eligible devices without hard-coding card-only checkout. Seller and club payouts use Connect destination charges only after `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` is verified as `active` through Accounts v2.

Connected-account IDs are stored only in the backend-only `stripeConnectAccounts` collection. Browser forms never accept arbitrary `acct_...` values, Commerce products never carry connected-account IDs, and checkout re-verifies the Stripe capability immediately before creating a destination charge. Firestore rules restrict products to their seller, orders to buyer/seller/Master Admin reads, and payment state to the backend.

Run the focused Connect unit tests from this directory:

```bash
npm.cmd test
```

The tests include rule-security invariants. A full Firestore rule compile still requires the Firebase Emulator Suite and a local Java runtime; run that compile before deployment.

Commerce inventory is held transactionally before Checkout and committed or released from signed webhook state. Refund/dispute webhooks create operational review state, but the authenticated refund action and destination-transfer reversal remain launch gates until FLOQR approves the governing policy. Tax registrations and the ordinary-Commerce platform fee are also unresolved. See `../STRIPE-INTEGRATION-PLAN.md`.

## Gemini Media Editing Setup

Set the Gemini API key as a Firebase Functions secret before deploying:

Run these commands from the package/repo root where `firebase.json` is located:

```bash
firebase functions:secrets:get GEMINI_API_KEY --project shoutoutdemo-5b402
npm.cmd --prefix functions install
firebase deploy --only functions:aiEnhanceShoutOutMedia,functions:aiSuggestShoutOut,functions:aiSuggestGrammarCorrection,functions:aiRankLocations
```

If `GEMINI_API_KEY` does not exist yet, set it before deployment:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

The default image model is `gemini-3.1-flash-image`. The default text model is `gemini-2.5-flash`. To override them in backend runtime configuration, set `FLOQR_GEMINI_IMAGE_MODEL` and `FLOQR_GEMINI_TEXT_MODEL`.

After deployment, run Master Admin > Diagnostics. `ShoutOut: Media AI panel` passes only when the callable responds in diagnostic mode and the secret is available.
