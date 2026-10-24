# FLOQR Feature Wiring Registry

Living operational map: **what exists** and **how it is wired**.  
Architecture depth → `docs/FLOQR-TECHNICAL-BIBLE.md`.  
Agents: update this file in the same iteration as feature work (see `.cursor/rules/feature-wiring-records.mdc`).

| Field | Value |
|---|---|
| Live Pages | `https://jadzadco.github.io/shoutout-demo/` |
| Firebase | `shoutoutdemo-5b402` · Functions `us-central1` |
| Last registry touch | 2026-10-22 |

---

## Passes / door QR (`passes`)

**Purpose:** One-time QR door passes for VIP reserV, guest entry, and promoter clients.

| Layer | Wiring |
|---|---|
| Feature | `featureServices/passes` — packaged **Live** (`IsFeatureEnabled:1`, `IsTestFeature:0`); seed via Master → Features Mgmt → Release Control → Reload |
| Venue gate | `clubLocations.featureGates.passes` (opt-in; seeded on for Aurelia / Decades / Lima Twist) — Club Admin tab visibility |
| Callables | `listMyPasses`, `listClubPasses`, `issuePass`, `revealPass`, `checkInPass`, `sharePass`, `resolvePassToken` (`functions/passes-functions.js` + `passes-core.js`) |
| VIP bridge | `getVipReservationPass` mirrors into `passes` via `__passesHelpers.upsertPassFromVipReservation` |
| Client QR | `floqr-qrcode-lib.js` + `floqr-qr.js` → `FLOQRQr.render` |
| Surfaces | `pass.html?t=` public viewer; My Profile → Guest List & reserV **Show pass**; Club Admin → **Feature Mgmt → Passes** (`admin-passes.js`, `#panelPasses`); VIP confirm → `patron-portal.html?tab=passes` |
| Deep links | `admin.html?location=<id>&tab=passes` / `#panelPasses` |
| Data | Firestore `passes/{passId}` — server-write only; patron/issuer may read own rows |
| Door | Club Admin / VIP Door still check in VIP via `checkInVipReservation`; Passes `checkInPass` for generalized kinds (ID 21+ required) |

---

## Template selection — LED-true cards + Search lens (s3.2.21)

**Purpose:** Venue template pick uses the Search-page lens field, contextual template-only search, and a true LED preview at the venue primary display size.

| Layer | Wiring |
|---|---|
| Surface | `index.html` `#templateSelectPage` — `#templateSearchForm` / `#templateSearch` + `#templateSearchGo.category-floqai-lens` (always visible) |
| Client | `patron-app.js` — `templateLedPreviewHtml`, `mountTemplateLedPreviews`, `primaryTemplateFormat`; cards Use-only |
| Preview | `floqr-template-preview.js` `previewUrl` + `sampleFor` stock text/media; `floqr-board-frame.js` mounts native aspect |
| Format | Venue `primaryDisplayScreenFormatId` (fallback overlapping formats); label on card head with template name |
| Search scope | Official / club-approved / personal / community via `floqrSearch` + tags/description/popularity ranking |
| CSS | `styles.css` `.template-select-*`; reuses `floqai-search.css` lens field |
| Help | `help-default-template`, `help-floqai-template-search` |
| Diagnostics | Manual test `s3-2-21-template-select-led-search` |

---


## Template howitWorks (s3.2.27)

**Purpose:** Patrons see a short general `description` plus size-specific **How it works** copy for the venue’s primary LED format.

| Layer | Wiring |
|---|---|
| Data | `SHOUTOUT_TEMPLATES.*.description` (general) + `howitWorks: { "led-96x48", "led-64x48", "led-64x32" }` in `shared-data.js` / Firestore `templates` |
| Helper | `window.FLOQRTemplateCopy.howitWorks(template, formatId)` / `.description(template)` |
| Gallery | `patron-app.js` `templateCard` / `variantCard` / `updateTemplateSummary` — `.template-select-desc` (2-line clamp) + `.template-select-howitworks` |
| Admin | Master Admin template form: Description + three How it works textareas (`templateManageHowitWorks*`) |
| i18n | `template.howItWorks` in all chrome packs |
| Diagnostics | Manual test `s3-2-27-template-howitworks` |

---
## Login + Search chrome (s3.2.26)

**Purpose:** Compact sign-in, short welcome, privacy links in page footer, FloqR wordmark without pill, Search lens-in-field, tile-palette Site chrome, Search product icons bottom-pinned on phone/tablet.

| Layer | Wiring |
|---|---|
| Login copy | `index.html` `.login-welcome-line.help-label` → `app.welcomeSignIn` = **Please signin or signup**; left-justified with `?` (`align-self:flex-start`); **80px** under FloqR mark (`.login-card > .floqr-home-link`) |
| Login legal | `footer.login-page-footer` — single **Privacy** link (`app.privacy` → `privacy.html`). CSS: `position:fixed; bottom:0` (+ safe-area). DNS/GPC controls remain under My Profile → My Privacy |
| Login Site chrome | Early localStorage paint (`floqr.isSiteChrome`) + `FLOQRChromeScheme` always paints last-used chrome on login/Search (does **not** demote to Nightlife when beta access is unresolved/denied). Cross-device: `hydrateFromProfile` reads `users.isSiteChrome` after sign-in and writes localStorage. Picker UI still gated by `siteChrome` beta |
| Login layout | `#loginActions` 2-column grid, half-height buttons; SMS/WhatsApp keep 2-line `has-sub` labels |
| Login colors | `#loginActions` stack = FloqR tile `cyan → violet → magenta` (`--floqr-tile-*`) |
| Logo | `images/floqr-color.png` — NL display tiles + white FloqR text, no charcoal pill; `?v=s3.2.26` |
| Logo → home | `floqr-nav.js` `bindHomeLogos()` / `data-floqr-home-logo` → `searchHome()` (`./?start=search`) |
| Back | Site-wide compact left-justified pill: `.global-back-btn` / `.floqr-back-btn` + `nav.backShort` (`< Back`) via `applyGlobalBack`. **Never** full-bleed (`width:auto!important`; excluded from mobile `.buttonlike{width:100%}`). Follows Site chrome (WB: white fill + shiny black text + black outline). Click prefers `history.back()` with `resolveBack` href fallback. Headers: Back (left) → centered FloqR mark → page title |
| White/Black active controls (s3.2.52) | Active tabs/buttons stay **white fill + shiny black text** with thin **Tiffany** border (`--floqr-tiffany` / `#00d4fe` — FloqCAST T / BOT DEE). Never grey/black fill (was `--hot/--accent` both `#111` on `.admin-tab.active`). |
| Welcome OAuth | `patron-app.js` `signInProvider`: **popup first on every device** (user tap). Never redirect-first on mobile — GitHub Pages ↔ `*.firebaseapp.com` redirect often returns null under ITP (s3.2.35 regression: “full-page sign-in did not finish”). `auth/popup-blocked` → redirect last resort; never redirect on popup-closed. Failed redirect sets `floqr.authPreferPopup` and tells the patron to allow the popup or use Email/SMS OTP. `getRedirectResult` waits briefly for `onAuthStateChanged`. Portal Google (`patron-portal-app.js`) matches: popup first. |
| Search | `#categoryFloqAiInput` placeholder `Search for Clubs, Lounge, Events, etc.`; submit is `#categoryFloqAiGo.category-floqai-lens` inside `.category-floqai-field` (no full-width Search button). `.category-floqai-search` is `max-width:720px; margin:0 auto` so the desktop bar centers under the FloqR logo. Icon faces: transparent + tile-palette halo (no `#000` tile). `#categoryFloqAiSpeech` + green `.category-or` removed |
| Template FloqAi | Floating `#floqAiAgent` / speech **off** on `#templateSelectPage` (`floqai-search.js` `syncAgentVisibility` → intent only). Lens `#templateSearchPanel` stays |
| Search icon position | Phone/tablet (`max-width:1180px` + `floqr-mobile-browser` / `floqr-tablet-browser`): `#categoryPage` flex column, `.category-grid:has(.search-icon-row)` `margin-top:auto` so FloqCAST / ShoutOut / reserVIP / BOT DEE sit at the bottom of the viewport (safe-area aware). Wide desktop (`min-width:1181px`): icons stay under Search with centered max-width row — viewport width wins over `floqr-desktop-browser` so iPad “desktop site” still pins |
| Traditional login | `html[data-floqr-chrome="traditional"]` charcoal cards + soft tile accents on primary/login |
| Profile chip | `.user-menu-btn` hardcoded charcoal `linear-gradient(145deg,#4a4a4a,#1c1c1c 55%,#0e0e0e)` for nightlife/traditional/tiffany/dark-green/white-black — not Nightlife pink/cyan |
| Help | `help-welcome` OTP-only body (no Search and book…friends and family); all packs in `floqr-i18n-help.js` |
| i18n | `floqr-i18n.js` s3.2.26 — short welcome + login keys |
| Diagnostics | Manual tests `s3-2-26-template-no-float-floqai`, `s3-2-25-search-icons-bottom`, `s3-2-24-login-chrome-privacy`, `s3-2-23-login-welcome-help-layout` |

---

## Site chrome (beta — `siteChrome` / `isSiteChrome`)

**Purpose:** Granted beta testers switch the **whole FLOQR site** between **Nightlife**, **Traditional**, **Black Tiffany**, **White/Black**, **Purple & White**, and **Black & Dark Green**. Not on public Search. Brand accents come from the FloqR tile palette (`images/chrome/floqr-tile-palette-ref.png`).

| Layer | Wiring |
|---|---|
| Feature | `featureServices/siteChrome` — Release Control Enable Feature / Enable Beta Feature (default off/test); empty `buttonIds` (no Search tile). Alias: `traditionalTheme` → `siteChrome` |
| Access | Master Admin → Features Mgmt → **Release Control** row **Site chrome**; invite/assign `betaTesters.features.siteChrome=1` |
| Preference | Firestore `users/{uid}.isSiteChrome` — `0` Nightlife, `1` Traditional, `2` Black Tiffany, `3` White/Black, `4` Purple & White, `5` Black & Dark Green (+ legacy `uiChrome` string) |
| Default | `0` / Nightlife for new patrons; last-used chrome is painted from localStorage / profile even when beta access is off (login + Search). Picker UI fail-closed until `FLOQRFeatureServices.canAccess("siteChrome")` |
| Client | `floqr-chrome-scheme.js` → `FLOQRChromeScheme` (`data-floqr-chrome`, `data-is-site-chrome`, `syncAccessGate` paints stored chrome — does not force Nightlife; `hydrateFromProfile` for cross-device; `data-floqr-theme-panel` / `data-floqr-theme-locked` gated) |
| Icons | Packs under `images/chrome/*` — nightlife / traditional / `vip-blacktiffany` / `vip-blackdarkgreen` / `*-whiteblack.*` |
| Palette | `:root` `--floqr-tile-cyan\|azure\|violet\|magenta\|coral` + `--floqr-brand-gradient` / `-h` (s3.2.20) |
| CSS slices | Nightlife = full spectrum on black; Traditional = charcoal + soft brand; Traditional secondary buttons = View Club style (charcoal fill, `--floqr-tile-cyan` ink; active = thin cyan border); Black Tiffany = cyan/azure; White/Black = white surfaces + **white cards** + shiny-black outline CTAs/login (white fill, `#0a0a0a` border + ink); VIP `vip.css` also forces white `body.vip-page` under whiteBlack (overrides nightlife hero wash); Purple & White = violet/coral; Black & Dark Green = forest green |
| Classic B&W template | `className: classic-bw` — LED board + FloqR identity rail use **red/black letterboard art**. Vault select **card shell** follows Site chrome (Traditional charcoal, White/Black white); only the mini-preview/LED keeps red. |
| Letter fit tags | Patron template cards show `FLOQRTextLayout` maxima per venue size (`96×48: 3×15=45`). Caps sized for ~1–3 m on P1.56. |
| FloqR Admin (templates) | Firestore `floqrAdmins/{uid}` (status active) or claim `floqrAdmin`. Rules: `canManageCatalogTemplates()` → `templates` write. Master Admin → Entity Onboarding card assigns/revokes. FloqR Admin-only session opens Template Management. |
| VIP icons | `scripts/build-chrome-icons.py` v31 — thin ring (`RING_STROKE=8`), only `re` under ring, raised mark; White/Black pack uses shiny chrome-black fonts + thin drawn ring; FloqCAST tips (Fl/T) preserved outside ring (`ICON_V` s3.2.07) |
| Surfaces | My Profile → **Appearance** → **Site chrome** card picker (`.chrome-select-*`); Language Settings no longer hosts the picker. Release Control titles use white `h2.features-release-title` + `?` |
| Routes | `patron-portal.html?tab=appearance` (`portalAppearance`); aliases `chrome` / `site-chrome` / `theme` |
| Profile chrome | Page title `portal.title` = **Profile & Settings**; manage blurb in title `?` (`help-my-profile`); global Back = compact left `< Back` via `FLOQRNav.applyGlobalBack` after i18n; FloqR mark under Back (`.floqr-page-brand`) |
| Receipts | `payment-return.html` / `ad-invoice.html` / `pass.html` — early-paint `data-floqr-chrome` + `floqr-chrome-scheme.js`; payment-return hydrates `users.isSiteChrome` after auth |
| Chrome audit | `floqr-chrome-audit.js` — Master Admin switch starts a localStorage session; each loaded page probes expected vs actual → pass/fail. Master Admin → Diagnostics → Manual Feature Tests → **Read Site chrome audit** / **Copy chrome fix prompt** |
| i18n / help | `nav.appearance`, `appearance.*`, `chrome.*` (+ blurbs / `lockedHint`); FloqAi `help-chrome-scheme` → Appearance; Master `help-chrome-audit` |

---

| Brand logos | `FLOQRChromeScheme.BRAND_LOGOS` + `applyBrandLogos` — Nightlife = white script + cyan→magenta neon border halo (`floqr-hero-nightlife-white-glow.png`); Traditional / Black Tiffany / White-Black / Purple & White / Black & Dark Green script heroes. Picker thumbs (`.chrome-select-logo`) are not overwritten. Wired on Search, login, VIP, pass, confirmation receipts |

## Post-feature QA email + Manual Feature Diagnostics

**Purpose:** After shipping features, email a test brief and track Succeed/Failed in Master Admin Diagnostics.

| Layer | Wiring |
|---|---|
| Rule | `.cursor/rules/post-feature-qa-email.mdc` |
| Email | `emailFloqrPreviewLinks` / `sendFloqrPreviewLinksEmail` — `note`, `qaGuide`, live links → `bans.don@gmail.com` |
| Diagnostics UI | Master Admin → Diagnostics → **Manual Feature Tests** (`#diagnosticsManualTests`) |
| Client | `ai-diagnostics-service.js` — `MANUAL_FEATURE_TESTS` (+ `troubleshoot`), Succeed/Failed + Codex resolution prompt |
| Package | `CURRENT_DIAGNOSTICS_PACKAGE_VERSION` / `PACKAGE_INSTALL_CHECKS` |

---

## Temp demo accounts (`temp_*@floqr-demo.com`)

**Purpose:** Removable QA pack for scheduling, public profiles, and delivery sinks.

| Layer | Wiring |
|---|---|
| Seed | `functions/scripts/seed-temp-demo-pack.js` + callable `seedTempDemoPack` (`functions/demo-seed-functions.js`) |
| Showcase names | `floqr-temp-qa-showcase.js` — **one** Priya Shah (`temp_waitress_1` / club 1). Waitress 2–4: Imani Cole, Sofia Alvarez, May Tran. Clubs 5–10: Keisha / Aaliyah / Noor / Camille / Elena / Zara (never re-cycle Priya). Seed re-syncs Auth `displayName` after showcase enrich. |
| Search profile menu | `patron-app.js` prefers Firestore `displayName`/photo over Auth; `syncAuthDisplayNameFromProfile` heals stale `Temp Waitress N`; inbox counts = non-deleted `inboxNotifications` + `messages` by `recipientUid` (same as `global-profile-status.js`) |
| Rule | `.cursor/rules/temp-demo-accounts.mdc` |
| Auth / profiles | Firebase Auth + `userProfiles` / `users`; codes in `system/demoAccounts` |
| Clubs | `clubLocations/temp-democlub-{1..4}` full public profile + structured hours |
| Schedule | `schedulingSubscriptions/club:temp-democlub-1` active; `scheduleShifts` + `clubEmployeeDesignations` |
| Events | Featured genre nights on democlub_1 for `temp_dj_1..4` (Hip Hop / Afro House / EDM / Reggaeton·Latin) |
| Delivery | `functions/demo-delivery.js` → email `bans.don@gmail.com`, SMS `+12027330274` (receipts, Twilio messaging, **and email OTP** via `requestEmailOtp` / `sendEmailOtp`) |
| Sign-in (QA) | Home → Email sign-in → `temp_*@floqr-demo.com` → Send 6-minute code → **8-character** OTP arrives at `bans.don@gmail.com` with subject `[FLOQR demo → …]` → Verify. Seed sets `profileCompleted: true`. Club Admin skips SMS MFA for `@floqr-demo.com`. Table “QA ref” is tracking only (not the OTP). |
| Private pages | No Google-only login. Unsigned users redirect to home (`floqr-auth-gate.js` / `profile-access-guard.js`) with `returnTo`. |
| Welcome OAuth (s3.1.85) | `patron-app.js` `signInProvider`: Google/Facebook/Microsoft use **popup**. `auth/popup-closed-by-user` does **not** call `signInWithRedirect` (GitHub Pages ↔ `*.firebaseapp.com` often returns null and left Welcome stuck on “Redirecting to secure sign-in…”). Only `auth/popup-blocked` tries full-page redirect; `getRedirectResult` clears pending status. |
| Search beta tiles (s3.1.86) | `searchVisible` / `searchTileVisible`: test features show for **Master Admin** (Beta pill, QA) and granted beta testers. floqCast / VIP / FloqAi stay `hidden` for regular patrons until Live or a beta grant. CSS: floqCast/VIP `<img>` marks no longer `height:100%` (was collapsing when face height is auto). |
| floqCast mark + live arm (s3.1.87) | `images/floqcast-icon.svg` must be valid UTF-8 (Windows-1252 `0x97` in a comment broke SVG-as-`<img>` → blank Search mark). Preview: `armFloqCastLiveDuration` only after stable ICE (`floqcast-webrtc.js` reports `answered` ≠ `connected`). `repairFloqCastPaidOrders` skips `ended`/`rejected` (no false “Moved N into queue”). Queue UI hides ended rows. |
| floqCast venue geo pick (s3.1.88) | `floqcast-search.html` loads `floqr-geo-search.js`. Empty search shows **top 4 nearest** floqCast venues (GPS → IP → profile city via `FLOQRGeoSearch.resolveUserLocation` / `sortNearest`). Typing matches club, brand, city, or `SHOUTOUT_EVENTS` event name. Status line shows nearest-of-N + place/source. Help: `help-floqcast-choose-venue`. |
| Feature landing standard (s3.2.44) | Shared `floqr-feature-landing.js` + `.css` (`FLOQRFeatureLanding`). **ShoutOut** `shoutout-search.html`, **VIP** `vip.html`, **floqCast** `floqcast-search.html`: Back → **product chrome icon only** (no FloqR parent) → title + `?` → Choose a venue → GPS nearest **4** cards with feature facts (ShoutOut: LED sizes + patron custom; VIP: open days / deposit / dress / age; floqCast: screen + sound). Search hub listing also uses fact cards + top-4 when the query is empty. Help: `help-shoutout-choose-venue`, `help-vip-choose-venue`, `help-floqcast-choose-venue`. Nav: `FLOQRNav.shoutoutHome()`. |
| Feature landing Site chrome (s3.2.51) | Landings follow selected Site chrome (not Nightlife-locked). Early-paint `data-floqr-chrome` on `floqcast-search.html` / `shoutout-search.html` / `vip.html` / `vip-terms.html`. Body washes per scheme in `floqr-feature-landing.css` for `body.floqcast-page` / `shoutout-search-page` / `vip-page`. Removed `!important` Nightlife lock from `floqcast-search.css` + `vip.css`. Auth hydrate: `hydrateFromProfile` on floqCast + ShoutOut landings (VIP already). |
| AI crawl daytime events (s3.1.98–100) | Crawler was nightlife-only (clubs/DJ), so daytime listings like The Parks DC **Flea + Fall Festival** never entered `aiDiscoveryQueue`. Added daytime event types (flea / farmers / community market, daytime + fall festival), Community/Festival/Market genres, Places `daytimeEvent` mapping, and daytime approval checklist (organizer + date/time; no DJ). **Washington places:** canonical markets `Washington, DC` (`washington-dc`) vs `Washington State` / `Seattle` (`washington-state` / `seattle-wa`). Bare “Washington” → capital. Places text + lat/lng bias differ (DC 38.91°N vs Seattle 47.61°N). Live schedule cities use **Washington, DC**. |
| Discovery crawl production upgrades (s3.1.101) | **Bounded concurrency:** `mapPool` (3) in `discoverPlacesForCriteria`; per-host HTML delay via `waitForHostBudget`. **Deterministic upserts:** queue ids `place_{placesId}` / `evt_{sha1(placesId\|start\|title)}` with `mergeQueuePolicy` (protects approved human fields). **Venue→event:** JSON-LD `Event`/`MusicEvent`/`ComedyEvent`/`Festival` → child dated docs (`attachEventsFromHtml`). **Auto-approve:** `processCrawledItem` (`discovery-auto-approve.js`) — identity anchors + schema gates + ≥92% confidence → live `clubLocations`/`events`; else `ADMIN_QUEUE`. **Past events:** `lifecycleStatus` upcoming/past/retired/removed; public feed `eventsView` vs `pastEventsView`; callable `retirePastCrawledEvents` + daily schedule. Modules: `discovery-crawl-core.js`, `discovery-auto-approve.js`, `discovery-past-events.js`. |
| floqCast ~10s drop / WebRTC hold (s3.1.102) | STUN-only + aggressive `displayJoins` rebuilds killed peers after brief ICE `disconnected` (~10s). Fix: `restartIce` before hard rebuild; `peerMediaAlive` / hold-media-alive; `DISPLAY_JOIN_DEBOUNCE_MS`; longer disconnect holds. |
| floqCast FLOQR TURN (s3.1.103+) | Public OpenRelay removed. Callable `getFloqCastIceServers` (`floqcast-functions.js`, **`invoker: "public"`**) returns STUN + **Twilio Network Traversal** tokens (existing `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`), optional env `FLOQR_TURN_*` Metered/coturn override. Cached in `systemConfig/floqcastIceServers`. Client `floqcast-webrtc.js` `resolveIceServers()` before `createPeer`. Display boards call without auth. Reconnect: `publishIceRestartOffer` (`createOffer({iceRestart:true})`), delta `peerMediaAlive`, display force-reattach after disconnect hold. |
| floqCast Aurelia blank + freeze reconnect (s3.1.97) | (1) After ICE connect, freeze→disconnect→immediate rebuild fought the board → reconnect errors. Fix: longer rebuild delay after a stable link; skip rebuild if ICE recovers; hold display after `hadVideoTrack`; resume paused preview canvas. (2) Select Aurelia → Go live opened `about:blank` then set **relative** `./floqcast-preview.html` → blank tab. Fix: `absoluteAppUrl` + same-tab on mobile. |
| floqCast Connecting hang (s3.1.96) | Board stuck **Connecting to patron…**: reattach killed the answering peer while answer SDP stayed → callee ICE ufrags ≠ answer (`saJX` vs `yyVO`/`RaMQ`/…). Fix: stick with peer after answer (disconnected ≠ dead); buffer callee ICE until answer write succeeds; phone filters by ufrag + clears candidate collections on new offer; `displayJoins` uses client Timestamp. **Rules deploy required** (candidate delete + `at is timestamp`). |
| floqCast retry storm (s3.1.95) | display2 treated every `*-error` as hard reattach, fighting `displayJoins` renegotiate → stuck **Retrying after error…** with SDP answered but ICE never stable. Fix: wait for phone rebuild on offer/rejoin errors; backoff + max reattach; show real error text. |
| floqCast upright from preview (s3.1.94) | Canvas send must paint from the **visible** `#floqcastPreviewVideo` (hidden 2×2 clones skip iOS orientation → forehead crop on LED). `resizeMode:"none"` + hard zoom reset. Safari **cannot** fuse multi-lens / Continuity — Front or Back only. |
| floqCast upright canvas send (s3.1.93) | iPhone local `<video>` applies orientation (full face) but raw WebRTC pixels stay landscape — Chrome LED shows forehead-only strip. Fix: `createUprightSendStream` (`video`→`canvas.captureStream`) before `addTrack`; preview keeps raw mirrored stream. Camera switch retargets canvas source (stable video sender). |
| floqCast framing + Switch camera (s3.1.92) | Do **not** force `1280×720` landscape — iPhone Safari crops a 16:9 **top strip** into WebRTC while local preview still looks upright. Switch camera now cycles Front↔Back (`switchCameraPool`, score &gt; -50) + `facingMode` toggle (was silent no-op: button showed for Back but pool was Front-only). Prefer VP8 / H264 baseline for Chrome LED. |
| floqCast LIVE black board (s3.1.91) | LIVE badge is Firestore (`suprstrLive`); video needs WebRTC. Bug: phone wrote `session.status: "answered"` which **blocked callee ICE** and renegotiate under rules. Fix: keep `connected`/`offering`; `displayJoins` for board refresh; phone `scheduleRebuild` on ICE failed; display `scheduleReattach` + Connecting status; preview warns if tab backgrounded (iOS stops camera). **Rules deploy required.** |
| floqCast camera framing (s3.1.90) | `floqcast-webrtc.js` prefers Front/FaceTime `deviceId`, skips Continuity/Telephoto/Ultra Wide, resets track zoom. Preview + board use `object-fit: contain` (no cover crop). Preview **Switch camera** + `replaceTrack` while live. Safari has no Apple fused multi-lens stream. |
| Search venue Select routing (s3.1.89) | Listing **Select** follows product intent from the query via `floqr-venue-actions.js` (`FLOQRVenueActions.resolve`). “Floqcast to Aurelia” → CTA **Go floqCast** → `floqcast-search.html?location=`. VIP phrases → `vip.html?location=`. Plain club browse still defaults to ShoutOut. Client routing is UX only; feature gates + satellite Auth + callables still enforce access (Bible §8.3 / §11). |
| UI | Master Admin → **Demo Accounts** (`master-admin-demo-accounts.js`) — removable |
| Callable bugfix | `demo-seed-functions.js` must init `const db = admin.firestore()` (missing `db` left Seed hanging on “Waiting…”); client uses 300s callable timeout + writes result to `masterActionFeedback` |
| Firestore rules | `system/{docId}` — Master Admin read for `system/demoAccounts` manifest (Admin SDK writes only); without this, Seed can succeed but Refresh shows misleading “Master Admin only” |
| Assets | `assets/demo-temp/avatars|icons/*.svg` + `manifest.json` |

---

## Structured club hours + crawl normalize

**Purpose:** Hour / minute / AM|PM stay as separate datapoints for scheduling, hail, and discovery — never a single opaque wall-clock string as the source of truth.

| Layer | Wiring |
|---|---|
| Shared | `shared-time.js` — `makeClock`, `normalizeWeekHours`, `normalizeCrawledHoursText`, `formatWeekHoursLines` |
| Public profile | `club-profile-app.js` Details → Monday–Sunday opening lines from `hoursStructured` |
| Crawl | `ai-diagnostics-service.js` extract + `ai-discovery-service.js` approve write `hoursStructured` / `hoursSource: crawl-normalized` |
| Data shape | `{ hour, minute, meridiem, hour24, display }` per open/close; week under `hoursStructured.days.{monday..sunday}` |

---

## Staff Scheduling ($20/mo)

**Purpose:** Club / promoter / DJ shift create + notify/approve.

| Layer | Wiring |
|---|---|
| UI | Club Admin Scheduling tab (`admin.html` + `admin-scheduling.js`); `scheduling.html` portal |
| Backend | `functions/scheduling-functions.js` — `getSchedulingAccess`, `createScheduleShift`, `listScheduleShifts`, `respondToScheduleShift` |
| Notify | `scheduleNotifyQueue` → `onScheduleNotifyQueued` (SMS/WhatsApp); inbox on create/respond |
| Data | `schedulingSubscriptions/{ownerType}:{ownerId}`; `scheduleShifts`; workers from `clubEmployeeDesignations` |
| Demo | `temp-democlub-1` pre-subscribed + seeded shifts (see Demo Accounts) |
| QA hub | `feature-tests-v29-09-122.html#scheduling` |

---

## Entity Management Venue Links (accurate Display URLs)

**Purpose:** Master Admin → Entity Management → **Venue Links** / Manage selected shows Club Admin, Display 1/2, and Xibo Diag for a club (or an event’s `clubLocationId`). Display URLs include the live board `?k=` when secrets exist.

| Layer | Wiring |
|---|---|
| UI | `entity-management.js` — `All venue links` + per-kind panels; Venue Links list hydrates via `revealVenueDisplayUrls` |
| Backend | `revealVenueDisplayUrls` (`display-security-functions.js`) — requires SOS2FA session; audited `reveal_venue_display_urls`; does not rotate tokens |
| Accuracy | `buildDisplayUrl(location, board, token)` — omit `k` only when no secret; never invent a token |
| Xibo Diag | `display-error.html?location=&board=1\|2&reason=xibo_page_load_error` (no `?v=`) |

---

## Display Security (IP + board tokens)

**Purpose:** Gate venue LED boards (`display.html` / `display2.html`) so idle/live content only shows when an allowlisted IP **or** a valid `?k=` board token unlocks the page (OR — not both required).

| Layer | Wiring |
|---|---|
| UI | Master Admin → Security → **Display Security Setting** (`master-admin.html#displaySecurity`) |
| Client | `master-display-security.js` — load/save settings, rotate tokens, access logs, security messages |
| Display gate | `display-app.js` → `enforceDisplayAccess()` **before** idle/live; deny UI is Floq Media / FloqR “not configured” copy |
| Backend | `functions/display-security-functions.js` — `checkDisplayAccess`, `setVenueDisplayIps`, `provisionVenueDisplayTokens`, `getVenueDisplayTokens`, rotate/clear, access logs |
| Data | `clubLocations/{id}`: `displayIpRestrictionEnabled`, `displayTokenRequired`, `approvedDisplayIps`, `displayIpNotes`; secrets in `displayBoardSecrets/{id}`: `primaryToken`, `secondaryToken` (not on public club docs) |
| Logs | `displayAccessLogs` (90-day); Master Admin **Security Logs** + **Security System Messages** (`inboxNotifications` type `displayAccessDenied`) |
| URL contract | Display 1: `display.html?location={id}&k={token}` — **no `?v=`**. Display 2: `display2.html?location={id}&k={token}`. Token lock default ON unless `displayTokenRequired === false`. |
| Gate logic | **OR:** allowlisted IP unlocks **or** valid `?k=` unlocks. Deny only when every configured gate fails. Reasons include `ip_or_token_ok`, `token_missing`, `token_denied`, `token_not_configured`, `ip_denied`, `restriction_enabled_empty_allowlist`, combined `ip_denied+token_missing`. |
| Token compare | Access logs + Security System Messages record **last 5** of provided `?k=` vs expected secret, plus redacted `pageUrl` (`k=…xxxxx`). Full secrets never logged. |
| Help | `help-display-security-setting` in `floqai-help-repository.js` |

**Ops notes**

- Venue name in a deny message is the **location being opened**, not client geography. Check **client IP** (e.g. US Comcast `2601:14d:…` vs Spain venue) before assuming Xibo failed.
- IP restriction OFF + `token_missing` ⇒ page loaded without `?k=` (browser test, wrong Xibo URI, or query stripped)—not “token unset” if obfuscated last digits exist in portal.
- With both ON: home/office IP not on the list can still open the board with the correct Xibo `?k=`; venue LAN IP can open without a token.
- Full `?k=` shown **once** on onboard/rotate; portal otherwise obfuscates (last 4).
- Ask Xibo which public egress IP(s) players use and whether Webpage query strings (`?k=`) are preserved.
---

## Xibo Trigger on Error / display load-error fallback

**Purpose:** When Xibo cannot load the board Webpage, a fallback layout opens `display-error.html`, logs a diagnostic event, and alerts Master Admin (Security System Messages). Detects dual-venue Xibo paste when the same player IP recently had allowed loads for a different `locationId`.

| Layer | Wiring |
|---|---|
| UI (Diagnostics) | Master Admin → Diagnostics → **Display / Xibo Load Errors** (`#diagnosticsDisplayErrors`) — build/copy fallback URL |
| UI (Security) | Master Admin → Security → **Security System Messages** — `displayLoadError` / `displayVenueMismatch` (also deny `displayAccessDenied`) |
| Client | `master-diagnostics-panels.js` (`buildFallbackUrl`); `master-display-security.js` (security feed includes load-error types); `display-error-app.js` |
| Page | `display-error.html` (stable URL — no `?v=`) |
| Backend | `reportDisplayLoadError` in `functions/display-security-functions.js` — `appLogs` + `notifyMasterAdminsDisplayLoadError`; lookback `displayAccessLogs` by `clientIp` (2h) via `pickVenueMismatch` |
| Data / logs | `appLogs` (displayFallback, 30-day); inbox `type` `displayLoadError` or `displayVenueMismatch` (`messageCategory: security`); cooldown `displayLoadErrorAlerts` (15 min) |
| URL contract | `display-error.html?location={id}&board=1\|2&reason=xibo_page_load_error` — no board token required; **fallback `location=` must match** the main `display.html` / `display2.html` venue |

**Example — Shôko Barcelona Display 1**

```
https://jadzadco.github.io/shoutout-demo/display-error.html?location=shoko-barcelona-spain&board=1&reason=xibo_page_load_error
```

Display 2: same with `board=2`.

Xibo’s *Trigger on page load error* is usually a **trigger code**; put the URL above on the **fallback Webpage** layout that that trigger opens.

---

## SOS2FA (Entity Management unlock)

**Purpose:** Gate Master Admin Entity Management / onboarding with SMS and/or email OTP (and optional TOTP).

| Layer | Wiring |
|---|---|
| UI | `master-admin.html` SOS2FA gate + channel radios (Both / SMS / Email) |
| Styles | `admin.css` `.sos2fa-channel-option` (radio sizing); `styles.css` must not force radios to `width:100%` |
| Backend | `functions/sos2fa-functions.js` (+ Twilio / mail paths as deployed) |
| Help | SOS2FA popouts + FloqAi repository entries |

---

## Heist / jersey idle ghost (liveContent expiry)

**Purpose:** Expired soccer jersey ShoutOuts must not leave `backgroundUrl` on idle.

| Layer | Wiring |
|---|---|
| Backend | `expireLiveShoutouts` clears jersey/background fields (not merge-preserving ghosts) |
| Display | `display-app.js` treats `status:default` as clean idle on Display 1 |
| One-shot cleanup | `functions/scripts/clear-heist-livecontent-jersey.js` |

---

## Patron Portal auth shell

**Purpose:** My Profile and Settings must hide the Sign-in card whenever Firebase already has a session (global profile avatar is the signal).

| Layer | Wiring |
|---|---|
| UI | `patron-portal.html` — `#portalLogin` / `#portalPanel` |
| Client | `patron-portal-app.js` — `applyPortalAuthUi`, `bootPortalForUser`, `auth.onAuthStateChanged`, `auth.authStateReady`, `floqr:profile-access-ready`, short sync interval |
| Guard | `profile-access-guard.js` (does not own the Sign-in card on this page) |
| Global chrome | `global-profile-status.js` — avatar menu builds hrefs via `FLOQRNav.portalHome` / `minglChatHome` / etc. (no hardcoded `?v=`) |
| Nav | `floqr-nav.js` — `packageVersion()` from page `?v=` or `floqr-nav.js` script cache-bust; `stampAppAnchors()` on portal DOM ready |

**Bug fixed (v29.09.119):** Signed-in avatar could show while Sign-in card stayed visible — portal shell re-syncs from `auth.currentUser`.

**Bug fixed (v29.09.124):** `patron-portal-app.js` had a missing `}` after `fillProfileForm`, so the whole IIFE failed to parse and the UI stayed on “Checking sign-in…”. Profile-card links also pointed at stale hardcoded `?v=29.09.8`; they now go through `FLOQRNav`.

---

## FLOQR service receipts (site-wide)

**Purpose:** One VIP reserV–style receipt contract for every paid/fulfilled service. Rule: `.cursor/rules/floqr-service-receipts.mdc`.

| Layer | Wiring |
|---|---|
| Shared builder | `functions/receipt-delivery.js` — `shoutoutReceiptTitle`, `buildVipReservationReceipt`, `buildTempShoutoutReceipt`, `promoteShoutoutReceipt`, `deliverServiceReceipt({routeToInbox, sendEmail})` |
| Checkout / fulfill | `functions/commerce-functions.js` — descriptive `itemName`, `cardFieldsFromSession` (last4), VIP fulfill → Inbox+email; pending paid ShoutOut → `routeToInbox:false` / `sendEmail:false` |
| Club approve | `admin-app.js` `createStatusNotification` — completed → Inbox type `paidShoutoutReceipt` + Feature & Orders Completed deep link |
| Portal invoices | `patron-portal-app.js` My Invoices — title, venue, when, card •••• last4 |
| Datapoints | title (service + venue + when), `cardLast4`/`cardBrand`, `venueName`, `serviceDate`/`serviceTime`, `servicesRendered`, optional `clientIp`/`clientGeo` when lawful |
| Routing | Saved/Pending → Feature & Orders only; Completed/VIP deposit confirmed → FloqR Inbox + email when SendGrid healthy |

## ShoutOut paid receipt (screen + venue)

**Purpose:** Confirmation splash, Stripe return page, Feature & Orders, FloqR Inbox (completed only), email PDF, and SMS carry screen size + venue — not thin “FLOQR paid ShoutOut” stubs.

| Layer | Wiring |
|---|---|
| Patron confirm UI | `index.html` `#confirmationPage` — Venue, Address, Screen size; `patron-app.js` `showShoutoutConfirmation` |
| Save draft | `patron-app.js` `commitShoutout({mode:"saved"})` + `#saveShoutoutDraftBtn` → status `saved`; portal Saved pane |
| Payment return | `payment-return-app.js` shoutout receipt block |
| Submit payload | `patron-app.js` — `screenFormatId` / `screenFormatLabel`, address, `clientIp` |
| Backend | `functions/receipt-delivery.js` — shared deliverer |
| Checkout | `functions/commerce-functions.js` stores `order.receipt` at checkout create; promotes on paid |
| Delivery | Pending: Feature & Orders only. Completed: Inbox `paidShoutoutReceipt` + SendGrid PDF when available |

**Contract:** Titles like `Football Intro @ Aurelia — 2026-10-16`. Screen label prefers `FLOQR_DISPLAY_FORMATS`. Address prefers `fullAddress`.

---

## Birthday media template (split + rotate)

**Purpose:** Birthday ShoutOut with patron photo/video — readable on large panels and compact LEDs.

| Layer | Wiring |
|---|---|
| UI | Patron ShoutOut editor template `birthdayMedia`; display render on `display.html` |
| Client | `display-app.js` — `birthdayUsesRotate` / `startBirthdayRotate`; split uses `object-fit:cover`; rotate uses `contain` + decorative slot |
| Styles | `display.css` — `.birthday-media-layout`, `.birthday-rotate-layout`, phase classes |
| Data | `shared-data.js` profile `birthdayMedia` + `SHOUTOUT_TEMPLATES.birthdayMedia.screenFormatIds` (all six formats) |
| Backend normalize | `functions/commerce-functions.js` birthday caps (96×48: 3×15; 64×48: 4×8; 64×32: 4×10) |
| Contract | 96×48 split (~60/40); 64×48 boxed + 64×32 landscape rotate fullscreen picture ↔ 4-line text |
| Docs | `TEXT-LIMITS-V29-08-4.md` birthday notes |

---

## supRstar live duration + diagnostics

**Purpose:** Paid live minutes must not burn before the venue board ICE-connects; brief disconnects must be traceable.

| Layer | Wiring |
|---|---|
| UI | `suprstar-preview.html` + live pop-out; venue `display2.html` via `display-suprstr.js` |
| Client timer | `suprstar-preview.js` — arms only after **stable ICE/peer `connected`** (2.5s debounce); never on SDP answer alone |
| WebRTC | `suprstr-webrtc.js` — answer → status `answered`; true `connected` from `connectionState` / ICE |
| Backend | `startSuprstrLive` sets `liveEndsAtMs:0`; `armSuprstrLiveDuration` sets ends + `liveArmedAtMs` / `liveArmSource` |
| Diagnostics | `FLOQRLog` → Firestore `appLogs` category `suprstar` (`webrtc_status`, `live_timer_*`, `live_heartbeat`, display `display_*`) |
| Heartbeat | Preview emits `live_heartbeat` every 10s while broadcast handle is open |
| Cache bust | Preview scripts `?v=29.09.121` |

---

## FloqAi intent search (plain-language router)

**Purpose:** Map short / partial patron wording to products and help cards (e.g. `throw` / `shou` → Throw a ShoutOut; `sho` → Shows/events + ShoutOut; `hai` / `hail` → RydR).

| Layer | Wiring |
|---|---|
| UI | Search / FloqAi (`index.html` intent panel) |
| Client | `intent-search.js` — `PRODUCT_INTENTS`, `HELP_INTENTS`, `aliases`, `searchPhrases`, prefix `phraseScore` / `aliasScore` |
| Help seed | `floqai-help-repository.js` (loaded before `intent-search.js`) |
| Cache bust | `intent-search.js?v=` on `index.html` |

---

## VIP / Table reservations + Hail a Waitress (planned)

**Purpose:** Map-based VIP/table booking with VCC pricing/staffing; patron hail/chat to assigned waitress with shareable service refs.

### Pilot floor plans (assets received 2026-08-04)

Stored under `assets/table-maps/`:

| Venue map | File | Tables / sections (seed cutouts) |
|---|---|---|
| **Decades** | `decades-floor-plan.png` | **C1–C11**. Sections: Top VIP (C1–C5); Main floor (C6–C9, C6 by DJ); Bottom VIP (C10–C11). Landmarks: Bar, DJ Booth, Stairs, Emergency Exit |
| **Lima Twist DC** | `lima-twist-table-map.png` | Series cutouts: **200s** (209→201), **100s** (106→101), **500s** circular (503→501), **300s** U-booth (307–301), **400s** (403→401), **BAR1/BAR2** (service landmarks, not bookable by default) |

VCC editor will place hotspots on these JPEGs (full plan + section crops); zoom/pan on patron + admin views.

### Locked product calls (2026-08-04)

| Topic | Decision |
|---|---|
| Club cancel after pay | **Stripe auto-refund** on cancel (no manual Stripe console step for the happy path) |
| Friend with shared ref | **Join table party** is granted from the **original table reservation** (booker shares ref). Friend gets party access / chat as designed — **waitress does not accept** the join |
| Outside club hours | **Hard closed** for waitress hail/chat. Offer fallback: **text on-duty or assigned venue CSR** only |
| Hours source of truth | Club hours must be **structured and correct** in VCC/onboarding (`hoursStructured` / profile hours) — hail gating uses venue timezone + those hours |

### Surfaces (to build)

| Layer | Wiring |
|---|---|
| UI (VCC) | Table map upload, section cutouts, prices, staff↔section, reservation Approve / Cancel+auto-refund |
| UI (patron) | Zoomable floor/section views; reserve+pay; **Hail a Waitress** → Existing purchased (auto-ref) \| New service; share ref (Mingl / SMS / WhatsApp / email) |
| Backend | Reservation callables; cancel → Stripe refund; hours gate; party-join via ref (no waitress accept) |
| Data | Table maps/sections/reservations; section→waitress/CSR; activity `referenceNumber` on receipt + inbox |
| Hours | Require structured club hours before enabling live hail during “open” |
| Help / FloqAi | “VIP table”, “hail waitress”, “table reservation”, “join table party” |

### Test methodology (abbrev.)

1. Pay → pending; Approve → active + ref on receipt.  
2. Cancel → **automatic Stripe refund** + notify; chat closed.  
3. Share ref → friend **Join table party** without waitress accept.  
4. Outside hours → hard block + CSR/on-duty text option; fix hours in VCC and retest open window.  
5. Existing hail auto-attaches ref; New-service hail allowed without prior VIP purchase.

**Manual QA hub (layouts, scheduling, today’s ship):** `feature-tests-v29-09-122.html` on the feature branch — deep links for Shôko Scheduling, birthday layouts, supRstar timer, display IP-or-token, FloqAi cues.

When adding a section, use this skeleton:

```markdown
## Feature name

**Purpose:** …

| Layer | Wiring |
|---|---|
| UI | … |
| Client | … |
| Backend | … |
| Data | … |
| URL / contract | … |
| Observability | … |
| Help | … |
```

---

## Features Mgmt (`featuresServices` group)

| | |
|---|---|
| **NIC tab** | Parent **Features Mgmt** (`master.featuresServices`); sub-tabs: **Release Control** (`featuresReleaseControl`), **Beta & Testing** (`featuresBetaTesting`), **Audit Trail** (`featuresAuditTrail`) |
| **Release Control** | Feature flag table + **Test → live** promotion; loads flags only |
| **Beta & Testing** | Search beside Find patron; select radio; Note + Invite; active/pending lists; loads beta data only (catalog flags if needed) |
| **Audit Trail** | Hash-chained activity log + Verify integrity; loads audit only |
| **Legacy deep link** | `#featuresServices` → `#featuresReleaseControl` |
| **Agent audit** | Scripted/agent denials log `actorEmail`/`actorRole` = `agent` (`isAgentClient`) |
| **Standing rule** | `.cursor/rules/feature-data-classification-security.mdc` — classify + harden rules on every feature (like translation) |
| **Load perf** | Sub-tabs lazy-load; Master Admin sign-in no longer scans 1000 users; Network Dashboard loads on demand |
| **Beta invite consent (s3.1.56 / clean UI s3.1.70)** | `beta-invite.html` + `beta-invite-app.js` — scrollable FloqR Beta Test & Prerelease Agreement; Booking Disclaimer body in `?` (`help-beta-booking-disclaimer`); invite intro in title `?` (`help-beta-tester`); no green “FLOQR Beta” eyebrow / “Signed in…” status. Required `checks.betaAgreement` + `checks.bookingDisclaimer`; success card after join. Server: `acceptBetaInvite` stores `consent` (`BETA_AGREEMENT` v2 — reverse-payments / non-refundable). Profile card via `global-profile-status.js`. |
| **Profile menu fail-closed** | Search `#userDropdown` + `global-profile-status` mint feature links hidden; `FLOQRFeatureServices.applyFeatureLinks` reveals only granted Live/Beta. CSS: `.user-dropdown … .hidden` / `[hidden]` must beat `display:block!important` (also injected in `ensureLinkStyles`). |
| **Inbox Recipient autocomplete** | Compose uses `#composeRecipientSearch` only — results appear after 2+ typed characters; empty query never dumps the directory. One Club Admin row (not one per support mailbox). |
| **Inbox-first + New Message FAB (s3.1.58)** | `loadPortal` renders `messages` + `inboxNotifications` before shoutout history / directory scans. Compose sheet `#portalCompose` stays hidden until floating `#inboxNewMessageFab`. Recipient directory: CSR + Club Admin seed first, then `FLOQRPeople.listSafe("contacts")`; Club Admin email local-parts searchable (not displayed). Profile-menu counts skip soft-deleted inbox rows. Follow Service: `listSafe("services")` + token haystack (handle/club/genre) + loading status. Help: `help-floqr-inbox-rules`. |
| **Inbox paint gate (s3.1.59)** | `loadAndRenderInbox(user)` starts immediately after profile bootstrap — **before** `renderTemplateVariantSettings` / BartR / AI prefs (those awaits left Inbox on Loading while menu already showed 5/10). Fast path = `recipientUid` queries (same as profile menu) + 12s timeout; email-scoped rows enrich without blocking first paint. |
| **Read badge nowrap (s3.1.60)** | `.message-envelope-head span` — `white-space:nowrap; flex-shrink:0` so Read/Unread pills do not wrap mid-word next to long subjects on mobile. |
| **Beta invite email handoff (s3.1.61–62)** | Email/private browsers have no Firebase session — landing no longer sticks on Restoring/Checking. `ensureAuth()` initializes Firebase before `auth()`; stashes invite `t` in `FLOQR_BETA_INVITE_TOKEN`; **Sign in to accept this invite** → home OTP with `returnTo` keeping `t`. `createBetaInvite` Inbox `link` is absolute Pages URL. |
| **Profile card on satellites (s3.1.63)** | `global-profile-status.js` calls `initializeApp` before `onAuthStateChanged` so beta-invite (and other satellites) show photo/initials when signed in — not a stuck `?` pill. |
| **Active beta testers table (s3.1.63)** | Master Admin → Features Mgmt → Beta & Testing — compact `.beta-testers-table` (tester + feature columns + Save/Revoke), ≤3 visual lines per user. |
| **FloqAi Search tile (s3.1.64)** | `#intentSearchBtnCard` uses `.shoutout-icon-card` / black `.floqai-icon-face`, reuses Search `.category-floqai-mark` + `floqr-tiles-transparent.png`, white FloqAi word beside mark. |
| **Search icon tiles** | `#categoryPage .search-icon-row` order: **floqCast → ShoutOut → VIP reserV → BOT DEE** (tile label; key `floqAi`). All four use chrome photo faces via `data-floqr-chrome-icon` + `FLOQRChromeScheme.ICON_PACK` (ShoutOut nightlife `shoutout-nightlife.png`, traditional `shoutout-traditional-green.png`; floqCast/VIP chrome JPGs; BOT DEE chrome photo). Mobile/tablet: 3 across; PC: one line. Display2 idle logo: `images/chrome/floqcast-nightlife.jpg` (`display-app.js` `FLOQCAST_LOGO`). |
| **Search FloqAi box (s3.2.18)** | No speech bubble. Input placeholder (`cat.floqaiPlaceholder`) = “Search for Clubs, Lounge, Events, etc.” (localized). |
| **floqCast board (s3.1.78)** | Always `display2.html?location=` + `suprstrLive/{id}__secondary`. Callables force `displayBoard: secondary`. Display 1 must not load `display-floqcast.js`. |
| **floqCast idle 64×48 (s3.1.108)** | Idle mark ~+30% (`36vh` / `60vw` vs base `28vh`/`46vw`) when `data-is-64x48=1` / `led-64x48`. `renderFloqCastIdleScreen` stamps format flags. Hello copy (`#displayMain.floqcast-idle-copy`) uses `margin-top:auto` so AWAITING / GO LIVE / idle note sit under the larger icon. Short-viewport media query must keep the 36vh/60vw scale (not shrink to 64×32 idle). |
| **Feature landing headers (s3.1.77)** | Site architecture: Back → FloqR logo → feature hero icon **under** FloqR → title + `?` (VIP pattern). floqCast uses `floqcast-hero-icon.svg` (not `suprstr-logo.png`, not side-by-side with FloqR). Venue pick = search + cards. Rule: `.cursor/rules/design-notes-feature-landing-pages.mdc`. |
| **floqCast venue picker (s3.1.88)** | `floqcast-search.js` + `floqr-geo-search.js` — empty = nearest 4; typeahead = club/event name match (same geo stack as Search ShoutOut listings). Deep link `?location=` preselects (Search Select → floqCast). |
| **Search venue Select (s3.1.89)** | `floqr-venue-actions.js` registry + `patron-app.js` `activateListingVenue`. Intent from query → CTA label + route. See “Venue Select routing” below. |

## Venue Select routing (scalable feature CTAs)

**Bug fixed (s3.1.89):** Natural Search “Floqcast to Aurelia” showed **Select** and always called `selectLocationForShoutOut` → template composer. Wrong when the query names another product.

**Pattern (add features without new if/else in the grid):**

1. Register one row in `floqr-venue-actions.js` `ACTIONS`: `id`, `featureKey`, `patterns` / `strip`, `ctaKey`, `buildUrl(locationId)` or `mode: "shoutout"`.
2. Listing reads `FLOQRVenueActions.resolve({query, listingType})` for label + click.
3. Satellite accepts `?location=` (floqCast / VIP already) and still runs `FLOQRFeatureServices` / session shell / callables.
4. Mirror patterns in `intent-search.js` `PRODUCT_INTENTS` for FloqAi carpets (keep in sync when adding a product).
5. Tests: `functions/floqr-venue-actions.test.js` — intent → URL, gate deny → fallback, index script order.

**Security (Bible §8.3 / §11):** Query string and CTA are **UX only**. Authorization stays on: feature flags (`searchVisible` / `guardPage`), Firebase Auth + satellite session shell, Firestore rules, money/live callables. Never grant floqCast/VIP from a crafted `?location=` alone.

**Default:** No product cue → Select still starts ShoutOut (historical primary LED product). Explicit `listingType=shoutout` → “Throw ShoutOut Here”.
| **VIP catalog (s3.1.66)** | `vip-app.js` `vipCandidateIds` — only PLAN_BY_ID + `getVipBetaVenues` + static `featureGates.vipReservations===true` (never all ~590 `SHOUTOUT_CLUB_LOCATIONS`). `showApp` clears Restoring / unhides `#vipApp` before `loadSubscribedVenues`. |
| **Beta pill (s3.1.68)** | `.shoutout-icon-card.feature-beta::after` (same yellow pill as `.category-card`) — FloqAi/floqCast/VIP tiles are shoutout-icon-card, not category-card.
| **Package** | s3.1.80 |

## Beta invite landing (`beta-invite.html`)

| Layer | Wiring |
|---|---|
| Surface | Inbox `type: betaInvite` → absolute `https://…/beta-invite.html?t=…` (account-bound, 7-day expiry); body also includes the URL for email clients |
| UX | Session shell; signed-out → Sign in CTA (not stuck Restoring); clean header (title + `?` only); Agreement scroll; Booking section title + `?` (disclaimer body in popout); two mandatory unchecked checkboxes; **I Agree and join beta** disabled until both; Decline; success acknowledgement card |
| Client | `beta-invite-app.js` stashes/restores `t`, wires `FLOQRSessionShell.loginHref()` returnTo, passes `{token, checks}` to `acceptBetaInvite`; `unlockAgreementUi` clears status (no Signed-in line) |
| Server | `functions/feature-services-functions.js` `createBetaInvite` / `respondToInvite` — absolute invite URL; refuses without both checks; stamps `agreementDocId` / `agreementVersion` / `agreementSha256` (canonical v2 FloqR, reverse-payments refund) |
| Data | `betaInvites/{hash}` + `betaTesters/{uid}.consent` |
| Help / FloqAi | `help-beta-tester`, `help-beta-booking-disclaimer`; phrases: beta agreement, booking disclaimer, sign in to accept this invite |
| Link reuse | `betaInvites.isBetaLinkused` `0|1` — set `1` on successful accept (terms + subscribe); `evaluateInvite` denies reuse with clear “link already used” error |

## VIP reserV (`vipReservations`) — Phase 2

| Piece | Where |
|---|---|
| **Brand** | VIP reserV (never translate) |
| **Feature key** | `vipReservations` in `functions/feature-services-core.js` + `floqr-feature-services.js` — default `IsFeatureEnabled=0`, `IsTestFeature=1`, route `./vip.html?from=search` |
| **Search tile** | `index.html` `#vipReservBtnCard` `data-feature-key="vipReservations"` |
| **Patron page** | `vip.html` + `vip-app.js` + `vip.css` + `vip-floor-viewer.js` + `floqr-feature-landing.js` — VIP chrome icon hero (**no FloqR**). Title `?` (`help-vip-book-table`); Choose a venue `?` (`help-vip-choose-venue`); GPS nearest 4 + VIP fact cards; no green Signed-in status. Table tap opens centered pop-out (`#info` + `#vipTablePopoutBackdrop`). Inventory `isReserved` `0|1` on `vipInventory`. **Workflow:** venue search → floor map + night → hold → `vip-terms.html` → Stripe deposit → `vip.html?vipPaid=1` |
| **Terms page** | `vip-terms.html` + `vip-terms-app.js` — satellite session shell; hold via `sessionStorage` `FLOQR_VIP_HOLD` + `?holdId=`; single required `checks.terms` (server `expandConsentChecks` fills refund/noShow/age21/minimumSpend; marketing optional) |
| **Mobile map** | `vip-floor-viewer.css` ≤600px — selected table `#info` in document flow **below** the map (not fixed bottom sheet). Desktop sticky side panel unchanged |
| **Profile menu** | `global-profile-status.js` `featureLink("vipReservations", …, "VIP reserV")` — same Features & Services gate as Search tile |
| **VCC tab** | Club Admin `panelFloqCast` label forced to **floqCast** (never legacy `supRstar`) |
| **Door** | `vip-door.html` + `vip-door-app.js` (satellite session shell) — list, check-in, no-show |
| **My Profile** | Feature & Orders → Guest List & reserV (`?tab=guest-list-reserv` / legacy `?tab=reservations`) — list + Show pass |
| **Search + landing icon** | Chrome pack via `data-floqr-chrome-icon="vipReserv"` → `images/chrome/vip-nightlife.jpg` / `vip-traditional.jpg` (`FLOQRChromeScheme`). Landing `vip.html` / `vip-terms.html` hero same pack; hydrate `isSiteChrome` from profile in `vip-app.js`. Legacy SVG (`vip-reserv-icon.svg` / `vip-reserv-mark.svg`) retired from Search/landing. |
| **Floor plans** | Static `vip-plans/` (`decades.json`, `lima-twist.json`, `aurelia.json`) + `functions/vip-beta-catalog.js`. Aurelia 2D published (`aurelia-floor-map.svg` bookable seats neutralized — no baked Available/Booked); 3D walk-through at `reports/vip-aurelia-demo/` (Explore 3D CTA on `vip.html`). Rebuild: `plan-svg.mjs` `neutralBookable: true` for Pages background art |
| **POS (future)** | Research/design only: `reports/vip-pos-integrations.md` — top 4 Toast, Square, SpotOn, Clover; Generic CSV/manual fallback. Not built. |
| **Product chrome** | Same pink/cyan body + glass cards as ShoutOut — `styles.css` + scoped `vip-floor-viewer.css` (never global `:root`/`body` flat black). Rule: `.cursor/rules/design-notes-product-chrome.mdc` |
| **Session** | `floqr-session-shell.js` after `firebase-config.js` on `vip.html` / `vip-terms.html` / `vip-door.html`. Do not await a full clubLocations scan before clearing Restoring (see s3.1.66 `vipCandidateIds`). |
| **Callables** | `functions/vip-functions.js` — `getVipBetaVenues`, `getVipAvailability`, `createVipHold`, `releaseVipHold`, `recordVipConsent` (single Terms check + expand), `getMyVipReservations`, `getVipReservationPass`, `listVipReservations`, `checkInVipReservation`, `markVipNoShow`, `getVipClubSettings`, `saveVipClubSettings` (deposit + `refundPolicy`), `setVipSectionBlocked`, `confirmVipReservationWithoutDeposit`, `adminConfirmVipReservation`, `cancelVipReservation` (clears `isBooked`; FloqMedia/Club Stripe `refunds.create` by policy). Checkout: `createFloqrCheckoutSession` `orderType: "vipReservation"` (`holdId` + `consentId`). Fulfillment confirms reservation + `deliverServiceReceipt` Inbox |
| **Paid-before-booked** | Club `clubLocations.vipSettings.depositRequired` (default on when depositCents &gt; 0). Hold → `status:held` + `isReserved:0` only. Floor map `booked` / `isReserved:1` only after Stripe `fulfillVipReservationOrder` (paymentConfirmed=1), or `confirmVipReservationWithoutDeposit` when deposit not required, or Club Admin `adminConfirmVipReservation` with `paymentRecorded` when deposit required, or Club POS confirm (`confirmVipReservationForClubPos`). |
| **Payment collectors (VIP-B-01)** | `clubPos` (preferred for live Toast/SpotOn), `clubStripe`, `floqrStripe`, `manualCsv`. **Aurelia demo (`temp-democlub-1`)** defaults to `floqrStripe` (FloqMedia Stripe). Setup help: FloqAi `help-vip-floqr-stripe-aurelia`. Catalog: `functions/vip-payments-core.js`. Callables: `getVipPaymentCatalog`, `getVipPaymentSettings`, `saveVipPaymentSettings`, `beginVipPosConnect`, `confirmVipPosConnected`, `disconnectVipPos`, `confirmVipReservationForClubPos`, `exportVipReservationsCsv`, `listVipBillingStatements`, `setVipPosProviderEnabled`, `seedVipPosProviders`. |
| **POS providers** | Toast / SpotOn (open tab ★) / Square / Clover / Generic — sandbox flags: Toast, SpotOn, Square, Clover. Live OAuth/webhook adapters activate when partner credentials are deployed; Connect workflow + connection codes ship now. |
| **Club Admin** | `admin.html` → **Feature Mgmt** → **VIP reserV** (`#panelVipReserv`) — collector picker, POS connect (sandbox/live), CSV export, billing list, deposit policy, nights, check-in / cancel / block / walk-in. Help: `help-vip-club-admin`, `help-vip-deposit-settings`, `help-vip-payment-collector`. |
| **Club Admin Feature Mgmt (s3.1.84)** | Parent tab **Feature Mgmt** nests **ShoutOut** (sub: Queue Mgmt → `#panelQueue`, Display Mgmt → `#panelDisplaySecurity`, Template Mgmt → `#panelTemplateBackgrounds`), **floqCast** (`#panelFloqCast`), **VIP reserV**. Deep links `?tab=` / `#panel*` still activate nested parents. |
| **Master Admin** | Features Mgmt → VIP reserV Payments (`#featuresVipPayments`) — enable providers, seed catalog, network billing statements. |
| **Per-table Firestore status** | `clubLocations/{clubLocationId}/vipNights/{night}/tables/{tableNumber}` — doc id = printed table number. Fields: `isBooked` (`"1"` / `"0"`), `isBookedYes` (`"yes"` / `"no"`), `status`, `reservationId`. **Booking-status control:** `getVipAvailability` marks a section booked only when `isBooked==="1"` (not legacy `vipInventory.isReserved` alone). Set to booked only after payment completes (Stripe fulfill, no-deposit confirm, Club POS confirm, admin walk-in with payment recorded). Cancel always clears `isBooked` to `"0"`. Rules: public read, Functions-only write. Classified as `clubLocations/vipNights`. |
| **Hold TTL + free table** | Hold datapoints: `vipHolds.expiresAtMs`, `vipInventory.status=held` + `expiresAtMs` (30 min via `HOLD_MS`). **Not booked** while held (`isReserved:0`, `isBooked:"0"`). `expireVipHolds` scheduled every 5 min frees inventory; `getVipAvailability` lazy-expires stale held rows. Client hold banner countdown clears UI at expiry. |
| **Open nights calendar** | Night picker uses `clubLocations.hoursStructured` + `hoursExceptions` (same datapoints as Club Public Profile / Guest List). `getVipAvailability` returns `bookableNights`; `createVipHold` rejects closed nights. Client also filters via `FLOQRVenueCalendar` when structured hours are on the venue row. |
| **Hold UX** | After successful hold, table popout closes and `#vipHoldBanner` (Continue to Terms) scrolls into view; hold errors surface in the popout. |
| **Cancel + refund (s3.1.83)** | Club Admin → VIP reserV Cancel. Always frees inventory + clears `isBooked`. FloqMedia Stripe / Club Stripe: optional Stripe refund (`processRefund`, default on) using `vipSettings.refundPolicy` — club cancel mode `full` (default) / `policy` (hours windows) / `none`. Club POS / CSV: table freed; POS void stays on Toast/SpotOn. UI: refund-on-cancel checkbox + policy hours. |
| **Data** | `vipInventory` (legacy night×section lock), `vipHolds`, `vipActiveHolds`, `vipConsents`, `vipReservations`, `clubLocations.vipSettings`, `clubLocations/.../vipNights/.../tables`, `vipPosConnections`, `vipPosProviders`, `vipPosStatements` (Functions-write) |
| **VIP-B-24** | `receipt-delivery.js` SMS via `sendTwilioMessagesApi`; `secret-redaction.js` protects `FLOQR-…` / `VR-…` invoice numbers |
| **Help / FloqAi** | `help-vip-book-table`, `help-vip-floor-map`, `help-vip-terms-consent`, `help-vip-door-pass`, `help-vip-door-ops`, `help-vip-receipt-sms-redaction-fixes`; intent `vip-reserv` |
| **Gate** | Master Admin → Features & Services → seed/enable `vipReservations`; beta testers need grant. Venue opt-in: `clubLocations.featureGates.vipReservations` (default **false** in `feature-gates.js`). Beta seeds: Decades, Lima Twist, Aurelia (`temp-democlub-1`) |
| **Not yet** | Promoter path, counsel Live Terms, Model B invoicing |
| **Design notes** | `.cursor/rules/design-notes-vip-reservations.mdc`, `.cursor/rules/design-notes-product-chrome.mdc`, `.cursor/rules/design-notes-aurelia-scene-standard.mdc` |
| **Owner decisions** | `reports/vip-owner-decision-sheet.md` |
| **Package** | s3.1.80 |

## Feature & Orders (patron portal)

| Piece | Where |
|---|---|
| **Tab** | `patron-portal.html` `#portalFeatureOrders` — renamed from Paid Services & Orders |
| **Nested** | Status (default), Guest List & reserV, My ShoutOuts (Saved/Pending/Completed/Archive/Templates), My FloqCasts, My Invoices |
| **JS** | `patron-portal-app.js` `showFeatureOrdersPane`, `renderFeatureOrdersStatus`, deep links `tab=feature-orders\|shoutouts\|guest-list-reserv\|invoices` |
| **i18n** | `nav.featureOrders`, `nav.guestListReserv`, `portal.fo.*`, `portal.savedShoutouts*` — all supported langs |

## Search category icon row (spots)

Visible order on Search (`index.html` `.search-icon-row`): **1 floqCast** · **2 ShoutOut** · **3 VIP reserV** · **4 BOT DEE** (Search tile label; feature key `floqAi`). Hidden: Mingl / BartR / RydR.

## Chrome icon drafts (nightlife / traditional review)

| Piece | Where |
|---|---|
| **Rule / recipe** | `.cursor/rules/icon-chrome-build.mdc` (always) — type, ring layers, sizes, FIX PROMPT |
| **Builder** | `scripts/build-chrome-icons.py` — modular: ring once → graphic layers → type under/over → assemble |
| **Saved layers** | `images/chrome/layers/` — `ring-nightlife.png`, `floqcast-graphic.png`, `djbot-graphic.png`, `vip-graphic.png` (no type; reuse when only type moves) |
| **Review UI** | `icon-review-v4-chrome-compare.html`, `icon-review-square-green-halo.html` |
| **FloqCAST** | Image 2 / V4 full mark: `images/chrome/floqcast-nightlife.jpg` (+ traditional / traditional-green). White/Black Search uses `floqcast-whiteblack.png`: **Image-2 geometry** on white (full-width FloqCAST via `place_floqcast_q_kiss`, ring `R=490`, dark ink + Tiffany T + tip halo) — same proportions as Nightlife chrome, WB palette only. Review SVGs: `images/review/floqcast-icon-{nightlife,traditional,whiteblack}.svg`. Search: `data-floqr-chrome-icon="floqCast"` → ICON_PACK (`ICON_V` s3.2.50). Display2 idle: `FLOQCAST_LOGO` → nightlife JPG (no `?v=`). |
| **BOT DEE** | `build_botdee_only()` / `--botdee-only` → `botdee-nightlife.jpg` / `-traditional.jpg` / `-whiteblack.jpg`; Search tile `data-floqr-chrome-icon="floqAi"` (`ICON_V` s3.2.13). Centered headphones bot ×1.30 (no turntable / signal tray); stacked thin-border `BOT` (white) / `DEE` (tiffany) ≈ ShoutOut type size. Legacy `streetbot-*` + `floqbot-*` still written. |
| **djBOT** | `images/chrome/floqbot-nightlife.png` + `-spin.gif`; trad `floqbot-traditional*.png` (mirrors BOT DEE face) |
| **VIP reserVIP** | `images/chrome/vip-nightlife.jpg` / `vip-traditional.jpg`; actual `images/review/actual-icons/vip-reserv-actual.png` |
| **Layers** | bg → under-ring letters → ring → over-ring letters (Fl/d/reser+V under; T/IP over) |
| **Type** | NotoSansDisplay-Bold, shear 0.286, ×1.10 height; tiffany `(0,212,254)` accents |
| **Placement** | 2D search (left+top); reject any ink with max radial `> R-2`; tips target `R-10` |
