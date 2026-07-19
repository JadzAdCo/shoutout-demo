# FLOQR v29.09.14 Deployment

## Release contents

- **DC club spot ads** in advertisement pool (`dc-spot-ad-campaigns.js` + Firestore `spotAdCampaigns`)
- **Club Admin** spot campaign composer + seed-from-website-events
- **RydR / Pickup**: saved pickups, ride history, spot ad between address and matching, Stripe `rydrFare`, extended map stages through drop-off confirmation
- **Mingl**: spot ad splash + in-grid spots; **Mingl Gist** Stories page
- **Lucy/Cobra BartR**: Master Admin seed callable + 20 art/jewelry/accessory products

## After Pages + Firebase deploy

1. Open https://jadzadco.github.io/shoutout-demo/seed-v29-09-14.html?v=29.09.14
2. Master Admin Google → **Seed DC spot ad pool** then **Enable Lucy/Cobra BartR + 20 products**
3. Test RydR: `pickup.html?v=29.09.14` (real Stripe fare; simulated dispatch)
4. Test Mingl → Mingl Gist
5. Test BartR commerce for seeded seller products
