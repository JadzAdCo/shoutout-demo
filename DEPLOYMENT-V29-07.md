# FLOQR Deployment - v29.07

v29.07 adds normalized addresses, public/search Genres, Pickup simulation, Commerce, Stripe Checkout, paid and follower campaigns, service-role following, REP permissions, staffing approvals, guest-list themes, paid-service analytics, and complete template lifecycle actions.

## Deploy

1. Upload the complete v29.07 package to the GitHub Pages repository root.
2. Deploy `firestore.rules`. The v29.07 marker and new Commerce, follow, campaign, REP, staffing, order, notification, and Pickup collections must be present.
3. Deploy Cloud Functions from `functions/`:

   ```text
   npm install
   firebase deploy --only functions
   ```

4. Configure Firebase Functions secrets:

   ```text
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

5. In Stripe, create an HTTPS webhook for `stripeFloqrWebhook` and subscribe to `checkout.session.completed`. Use that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.
6. Enable cards and Apple Pay in Stripe payment-method settings. Stripe Checkout presents Apple Pay only on eligible devices/browsers and otherwise presents supported card methods.
7. For seller or club payouts, complete Stripe Connect onboarding and save the resulting public connected-account ID (`acct_...`) in the entity's Commerce settings. Never enter a Stripe secret key in a browser field.
8. Hard refresh `https://jadzadco.github.io/shoutout-demo/?v=29.07`.

No Tesla API key is configured. Pickup is intentionally a no-charge/no-dispatch simulation. See `TESLA-ROBOTAXI-SIMULATION-API.md` for the proposed future provider adapter.

## Required checks

1. Open Zebbies public profile and confirm it shows `Washington, District of Columbia` once. Confirm Directions and Pickup use the full verified street address.
2. Save a US and a non-US club. Confirm public/search locations use `City, State` and `City, Country`, respectively.
3. Open Master Admin crawler review. Confirm raw and parsed JSON are collapsed until the plus/summary control is opened and address fields are separate.
4. In Template Management, test View, Edit, Deactivate, and the resulting Activate action.
5. In Pickup, test On-demand, Scheduled, For a Flocker, and Shared. Confirm the simulation notice, fictional map, confidence data, payment choice, and status popout appear. Confirm no real checkout opens.
6. Enable Commerce for a patron and a club, publish products, and complete a Stripe test-mode Checkout using card and an eligible Apple Pay test device.
   Elect and approve a Videographer / Camera Operator, enable their Commerce site, publish watermarked photo and video previews with license terms, purchase in test mode, and confirm the sale appears in seller and Master Admin fulfillment tracking.
7. Submit a free follower guest-list campaign and a targeted test campaign. Confirm the targeted amount is `$0.10 x target users`.
8. Submit an association request, approve it as Club Admin, configure REP duties/approval, and approve a worker-created guest-list campaign.
   In Master Admin assignment, confirm club entities are searchable/dropdown-selectable and the patron dropdown excludes patrons who never elected waiter/waitress, bottle-service, promoter, DJ, bartender/barman, or videographer/camera-operator roles.
9. Submit a non-default image ShoutOut and a video ShoutOut. Confirm test-mode prices are $20 and $30 and the paid records enter the club approval queue with 60% FloqR / 40% club ledger values.
10. In Master Admin > Services & Commerce, update a test order through processing, shipped, and delivered; confirm the patron can view invoice and tracking status.

## Production cautions

- Keep Stripe in test mode until webhook completion, refunds, Connect onboarding, tax, shipping, dispute handling, and legal terms are approved.
- The current static prototype uses broad authenticated-user Firestore access patterns inherited from the demo. Tighten role claims and per-owner rules before production launch.
- SMS purchase records the paid service state; it does not send a carrier SMS until an approved SMS provider is connected.
