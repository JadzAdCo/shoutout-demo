# FLOQR Shared Word List

Use these terms exactly when we plan or build. Prefer the **Term** column in chat.

| Term | Meaning | Not the same as |
|------|---------|-----------------|
| **ShoutOut** | A timed display message shown on club LED/panel displays | Mingl chat message; public profile bio |
| **Template** | A ShoutOut visual design (e.g. Football Intro, Black & White) | Club public-profile layout |
| **Football Intro** | Display name for the priced football ShoutOut (internal ID still `zebbiesFootballTeamIntro` until renamed in code) | Generic “football” sports content |
| **Display format** | Physical panel size/type: `p125-96x48`, `p125-64x48`, `p125-64x32`, `led-96x48`, `led-64x48`, `led-64x32` | Browser window size |
| **Large display** | Formats with height 48 rows (`*-96x48`, `*-64x48`) — keep full finale layout | Small display |
| **Small display** | Formats with height 32 rows (`*-64x32`) — skip side-by-side all-players finale | Large display |
| **Finale lineup** | Animation segment where all player photos appear side by side | Sequential single-player reveals |
| **Stadium message** | Short text shown mid-animation on Football Intro | Player identity label |
| **Player identity** | What appears under a player photo: one of Display Name, Instagram, or Mingl handle (patron chooses) | Free-typed roster name |
| **Display name** | Human-facing name; may include special characters and emoji | FloqR handle; Instagram |
| **FloqR handle** | `@`-style identity stored in `floqrHandle`; same field as **Mingl handle** (username stays synced without `@` for backward compatibility) | Display name; Instagram |
| **Instagram handle** | Social handle stored normalized with a leading `@` | FloqR handle |
| **Mingl handle** | Same as FloqR handle (`floqrHandle`); shown on Mingl cards and public profile contacts | Instagram; separate username field |
| **Patron** | End-user / guest member of FloqR. In UI copy, prefer **FloqR** / **FloqR patron** (never “Flocker” / “Flockers”). | Club Admin; Master Admin; deprecated “Flocker” |
| **Club** | Venue entity (e.g. Zebbies) with Club Admin | Patron vendor store |
| **Entity** | Any onboarded actor: patron, club, promoter, etc. | Template |
| **Club Admin** | Operator of one club’s backend | Master Admin |
| **Master Admin** | Network operator (FloqR) | Club Admin |
| **Public profile** | Outward-facing page for a patron or club | Private portal settings |
| **Profile layout** | Chosen visual arrangement for a club’s public profile page | ShoutOut template |
| **Profile background** | Image/color backdrop for a public profile | ShoutOut template background |
| **Open/closed days** | Structured weekly schedule (per weekday open/closed + hours) | Free-text “hours” blurb |
| **What’s open** | Discovery use-case: patrons find currently open clubs | Mingl social match |
| **Mingl** | Social discovery / matching / chat between patrons | ShoutOut; marketplace |
| **Match datapoint** | Profile field that contributed to a Mingl match score (e.g. music, location) | Full public profile dump |
| **Privacy datapoints** | Patrons toggle which datapoints are public vs hidden | Marketing consent |
| **Match-reason only** | Public Mingl view shows the datapoint(s) that caused the match; other datapoints stay private unless opted in | Show-all public profile |
| **Onboarding** | First-time signup / setup flow | Later profile edit |
| **UI language** | Language of FloqR chrome/strings (en, de, fr, es, it, ru, el, pl, pt, …) | Content language of a ShoutOut message |
| **Source locale** | Canonical copy language: US English (`en-US`) | Override translation |
| **Auto translation** | Machine-generated strings from `en-US` | Manual override |
| **Translation override** | Human/admin correction that wins over auto translation | Auto translation |
| **Translation management** | Master Admin page to review/edit all translated UI strings | Patron language preference |
| **Browser default language** | `navigator.language` / `navigator.languages` used on first visit | Saved UI language preference |
| **Toast warning** | Short auto-dismiss notice (~3s) with optional close control | Blocking modal |
| **Help popout (?)** | Inline help control explaining field rules (e.g. FloqR handle charset) | Toast |
| **Marketplace** | Place patrons buy/sell goods and services | Club ShoutOut commerce share |
| **BartR** | Shared FloqR ecommerce **frontend** (name from **barter** + swag). Amazon/eBay-style discovery + checkout. One site for all shoppers. Formerly drafted as “Bata” — use **BartR** only. | Per-vendor seller backend; ShoutOut |
| **RydR** | FloqR **mobility** product (ride). Robotaxi path (existing Pickup simulation) + Ultra Luxury chauffeur rides. Plain-language Search (“book a ride”) routes here. Casing: **RydR**. | Generic taxi; unbranded Pickup-only |
| **Ask FloqR / Intent Search** | Alternate Search: FloqR logo + plain-language wish box (“In plain words, what do you wish to accomplish”). Routes to Mingl, RydR, BartR, ShoutOut, venues. Account via top-right profile card (no left Patron Status panel). `?start=intent` | Classic category tile Search only |
| **FloqAi** | Animated graphical FloqR mark (diamond cluster) that idles on Search, can explode into "Tell, how can I help you?", and on tap opens contextual Ask FloqR search. Preview URL: `floqai-search.html` (local / package preview only - not production default yet). | Static FLOQR wordmark; Ask FloqR page chrome |
| **UberAds** | Advertisement feature used by entities within the FloqR app to advertise within the FloqR app ecosystem (in-app spot / interstitial campaigns). | WindowAds; external billboard-only buys |
| **WindowAds** | Advertisement product for companies that allow Jadz Ad Co to place LED Display screens (Transparent or LED Walls) and offer DooH access to the venue. | UberAds; generic out-of-home without venue screen placement |
| **BartR seller backend** | Per patron/service (US only) tools in My Profile: products, store info, contact, binding refund policy, fulfillment | Shared BartR frontend |
| **Vendor** | US-based patron or service member selling through BartR; **ships** the item after FloqR payment | FloqR MoR / checkout |
| **Vendor category** | Goods type: electronics, clothes, jewelry, arts, services, or multi | Stripe product type only |
| **Vendor storefront template** | Category-driven layout for seller backend / public vendor page (later) | ShoutOut template |
| **FloqR-priced ShoutOut** | Patron pays FloqR Stripe (e.g. Football Intro $30); club accrues 20% | Connect destination charge to club |
| **BartR payment** | Patron pays **FloqR** (MoR) for BartR goods; FloqR remits vendor share; **vendor ships** | Direct seller Stripe Checkout as MoR |
| **Test payment** | Stripe test-mode payment marked `isTestPayment` for later purge | Live charge |
| **Account Reconciliation** | Club/Master ledger of FloqR-priced shares | Stripe Connect payout dashboard |
| **MoR** | Merchant of Record — FloqR for priced ShoutOuts **and** BartR checkout | Connected-account seller (payouts only) |
| **Refined Discovery Search** | Master Admin panel where city, genre, and venue/event type are defined before a crawl | Generic AI Crawling tab label |
| **Discovery crawl** | Callable or scheduled run that queries Google Places and public pages and writes review queue records | Manual source paste only |
| **Impactful datapoints** | Required review fields: name, genre, DJ(s)/artist(s), promoter(s), phone, email, Instagram, address | Optional marketing fields |
| **Source confirmation** | Flags showing which upstream source verified a record (Google Places, public page, Eventbrite; Ticketmaster later) | Live publish status |
| **Ticketmaster (later)** | Planned Ticketmaster Discovery API confirmation — optional research link today, not required for crawl | Live Ticketmaster API confirmation |

## Languages in scope (UI)

| Code | Language |
|------|----------|
| `en` | English (US source) |
| `de` | German |
| `fr` | French |
| `es` | Spanish |
| `it` | Italian |
| `ru` | Russian |
| `el` | Greek |
| `pl` | Polish |
| `pt` | Portuguese |

## Football Intro — agreed behavior (this request)

1. Rename UI label to **Football Intro** (keep stable ID `zebbiesFootballTeamIntro`).
2. Support **all display formats**, with layout variants by size.
3. On **small displays** (64×32), omit the **finale lineup** (`skipFinaleLineup`).
4. Per-player identity: **Display name**, **Instagram**, or **FloqR / Mingl handle**.
5. **FloqR handle = Mingl handle** (same field `floqrHandle`; username synced without `@`).
6. Color themes + customizable background.
7. Portrait motion (not filters), **≤5s** budget; CSS Ken Burns when opted in; Gemini framing optional with timeout → originals.
8. Role-aware Mingl match bonus for promoter / hospitality (waiter, bottle girl) / DJ / media creator.

## Next iteration — backlog

Do **not** start these unless asked. Capture only.

| Priority | Feature | Scope |
|----------|---------|--------|
| **Next** | **BartR product ranking** | Shared BartR frontend should prefer products from taste/datapoints and people the patron follows; later FloqR may buy 3rd-party datapoints for matching. Today: random/shuffle of active US-vendor listings. |
| **Next** | **BartR seller backend polish** | Contact info, binding refund policy editor, fulfillment/shipping tools, vendor category templates — beyond basic product publish. **DJ (v29.09.12):** playlist curation, Mixcloud show embeds, consultation, merch, cleared-download-with-cert; see `DJ-BARTR-MIXCLOUD.md`. |
| **Next** | **Post-deploy standards enforcement** | Keep `STANDARD-AFTER-DEPLOYMENT.md` current each ship; remaining gaps: index Sign out chrome cleanup, audit every Save button for `FLOQRActionFeedback`. |
| **Next** | **FloqR Inbox management** | Patron, Club, Promoter, and other entity inboxes need normal inbox controls: **delete** (and typical management: select, bulk delete, archive/trash if we add folders). Today messages cannot be deleted. |
| **Next** | **Inbox recipient privacy** | Patrons must never see Club Admin / CSR / staff **emails** in FLOQR Inbox recipient search. Show display name, FloqR handle, or role label only. (Local fix in `patron-portal-app.js` + `patron-portal.html?v=29.09.7` — **publish in next iteration**, not live yet.) |
| **Next** | **Mingl group chat** | Patron can **create a Mingl chat group**, **invite friends**, and friends must **approve** before joining. Pair Mingl chat already exists; group rooms + invite/accept flow do not. |
| **Next** | **Ask FloqR contextual correlation** | Intent Search (`intent-search.js`) today only keyword-routes to products (Mingl/RydR/BartR/ShoutOut/clubs). **Bug/gap (v29.09.9):** queries like **Hip Hop** or **dance** return empty — no product match and no venue/event handoff. **Fix intent:** treat activity + music/genre cues as venue discovery. Examples: *dance* → night clubs, day clubs, lounge parties, pool parties, dance events; *Hip Hop* (and similar genres) → clubs/events tagged that genre / nightlife. Expand correlation beyond literal `club`/`party` words; ideally bridge into classic Search / discovery with genre+venue-type context, not only product tiles. |
| **Next** | **FloqAi Search iteration → production** | Preview: `floqai-search.html`. FloqAi diamond mark idles on the right (up to top-right profile card), auto pop→explode into “Tell, how can I help you?”, tap opens wish box. Preview help lives behind a `?` under the FloqR logo (no left Patron Status). Shipping note: keep as preview until merge with `?start=intent`. |
| **Shipped** | **SMS/WhatsApp credit packs + marketing** | v29.09.12: $10 packs → 466 SMS / 233 WhatsApp ($7 Twilio / $3 FloqR). Bundles when exhausted. Club Admin Advertising campaigns + industry templates. |
| **Next** | **Club/Promoter marketing → FloqR IG** | FloqR posts via marketing Instagram with @club / @promoter mentions; opted-in patron lists at scale (beyond test recipient send). |
| **Next** | **Patron phone verification + channel gate** | All patrons must enter a valid phone and verify via SMS (or WhatsApp) code; green verified check beside phone in My Profile and Settings. Email already has OTP verify. Unverified phone → access limited to settings until verified. Privacy: select at least one of SMS or WhatsApp for notifications. |
| **Next** | **Mixcloud OAuth / deeper sync** | Today: URL + embed + Creator Subscriptions link. Later: optional Mixcloud OAuth to pull show catalog into BartR seller tools. |
| Shipped seed | **Casamara Rooftop DC** | Fully seeded `casamara-rooftop-washington-dc` from https://casamaradc.com/rooftop/ — Sunset Sundays, private events (~80 seated / ~200 cocktail), Resy 92169, Sixty DC SMS. Push Firestore via `onboard-dc-venues.html`. Optional later: public profile media / dress-code polish. |
| Queued | UI languages (de fr es it ru el pl pt) + browser-default first-use + Master Admin translation overrides | Phase 2 from earlier roadmap |
| Queued | Club public profile: structured open/closed days, layout templates, backgrounds | Phase 3 |
| Queued | Mingl match-reason-only privacy | Phase 4 |
| Queued | BartR vendor category templates / seller-page layouts | Phase 5 (was “Patron marketplace vendor category templates”) |
| Queued | Ticketmaster Discovery API confirmation for refined crawl | Explicitly deferred |
