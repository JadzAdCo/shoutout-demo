# FLOQR Feature Wiring Registry

Living operational map: **what exists** and **how it is wired**.  
Architecture depth → `docs/FLOQR-TECHNICAL-BIBLE.md`.  
Agents: update this file in the same iteration as feature work (see `.cursor/rules/feature-wiring-records.mdc`).

| Field | Value |
|---|---|
| Live Pages | `https://jadzadco.github.io/shoutout-demo/` |
| Firebase | `shoutoutdemo-5b402` · Functions `us-central1` |
| Last registry touch | 2026-11-23 |
| Local copy | `http://127.0.0.1:4173/` — same files as Pages; browser calls still use live Firebase. See `docs/FLOQR-TECHNICAL-BIBLE.md` §13.4. |

---

## Local Cloud Agent copy

**Purpose:** Edit and test this repo before a Pages publish or a Firebase deploy.

| Layer | Wiring |
|---|---|
| Live site | GitHub Pages `https://jadzadco.github.io/shoutout-demo/` |
| Live backend | Firebase `shoutoutdemo-5b402`: Auth, Firestore, Storage, Functions `us-central1` |
| Local UI | `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/?start=search` |
| Client data | `firebase-config.js` has no emulator switch, so local pages read and write the live project |
| Functions check | `npm test` in `functions/` |
| Rules check | `npx --yes firebase-tools@15 emulators:exec --only firestore,storage --project demo-floqr-rules "npm --prefix rules-tests test"` |
| Detail | `docs/FLOQR-TECHNICAL-BIBLE.md` section 13.4 |


---

## Spatial Studio federation + Si-nema (FloqR side only)

**Purpose:** FloqMedia Spatial Studio already exists (`Jadz-Holdings/floqmedia.com`). FloqR reuses the current Firebase user, issues OIDC (code + PKCE S256) to that public client, stores **grant references** only, and loads a pinned revision as a Si-nema virtual set. Geometry stays on FloqMedia.

Pages `floqr-oidc-authorize.html` / `sinema.html` are live. OIDC + grant + Si-nema Functions deploy with `[firebase-deploy-spatial]`. Feature catalog writes (`setFeatureServiceFlags` / `seedFeatureServices`, including `sinema`) deploy with `[firebase-deploy-features]`. Production `firestore.rules` / `storage.rules` stay unchanged (draft only: `docs/spatial-studio-floqr-rules-draft.md`). Token HMAC is Firebase secret `FLOQR_OIDC_JWT_SECRET` (`defineSecret`, never git / Pages / FloqMedia `NEXT_PUBLIC_*`).

| Layer | Wiring |
|---|---|
| Identity | Existing Firebase Auth + `floqr-auth-gate.js` / `floqr-session-shell.js`. Authorize page `floqr-oidc-authorize.html` + `floqr-oidc-authorize.js`. `sub` = uid. No FloqMedia signup. |
| OIDC | Public client `floqmedia-spatial-studio`. Callable `issueFloqrOidcAuthCode`; HTTP `floqrOidcToken`. JWT HMAC `FLOQR_OIDC_JWT_SECRET`. Redirect `https://studio.floqmedia.com/auth/callback` (legacy www/apex `/spatial-studio/auth/callback` still allowed). |
| Grants | Collections `spatialGrantRefs`, `oidcAuthCodes` (Functions-write). HTTP `floqrSpatialGrant` (Bearer JWT). Callables `recordSpatialGrantRef`, `listMySpatialGrants`, `revokeSpatialGrantRef`, `attachGuestDraftToSubject` (confirm required). `editableUntil` always null on the grant. |
| Plan trace | Guest HTTP `floqmediaPlanTrace` (`POST https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/floqmediaPlanTrace`). Spatial Studio posts `{fileName, mime, dataBase64}` (SVG as prompt text; PDF/image as Gemini inline data) and may send header `X-Firebase-AppCheck`. FloqR returns `{ok:true, trace}` or `{ok:false, error}` and **forgets the drawing** — no project, grant, or file write. CORS allow-headers: `Content-Type, Authorization, X-Firebase-AppCheck`. Origins: `studio.floqmedia.com` / `www.floqmedia.com` / `floqmedia.com` + local `localhost:3000` / `127.0.0.1:3000` / `studio.localhost:3000`. Gemini: `GEMINI_API_KEY` + `FLOQR_GEMINI_TEXT_MODEL` / `gemini-3.6-flash`. Gemini access log records model + token counts only when Gemini ran (never the pass, `dataBase64`, or the drawing). Cap 12 MB / 200 objects. Not a survey. |
| App Check | Enforcement is the default. Unset `FLOQR_APP_CHECK_ENFORCE` still rejects. `FLOQR_APP_CHECK_ENFORCE=0` or `deps.enforce === false` is monitor mode for tests only; the deployed function is set to `1` (onRequest `environmentVariables`, then a post-deploy merge that does not replace other variables). A missing, invalid, or reused pass returns 401 `{ok:false, error:"This request was not accepted."}` and does not call Gemini. One verifier: `inspectAppCheck` → `defaultVerifyAppCheck` → `getAppCheck().verifyToken(token, {consume:true})` in `functions/floqmedia-plan-trace-core.js` for web app Spatial Studio `1:858205816285:web:e586eb1c2d7c4567cfa234` (Fraud Defense / reCAPTCHA Enterprise). Outcomes: `verified`, `app_check_missing`, `app_check_invalid`, `app_check_reused`. A verified pass is consumed once and the trace still runs. Helper `functions/app-check-log.js` writes both rows to existing `appLogs` (no rules change, not `displayAccessLogs`): Diagnostics category `app-check` action `spatial-plan-trace` (verified = info, missing while off = warn, never critical, never category `gemini`); Security category `security` action `app-check` level error for a rejected pass. Security System Message (`inboxNotifications` type `appCheckRejected`, `messageCategory: security`, same feed as display denies) when enforcement is on and the pass is missing, invalid, or reused. Message has no token and no drawing. Master Admin → Diagnostics → Application Logging and Security → Security Logs → App Check. |
| Si-nema | Feature key `sinema` (off/test). Search tile `sinemaBtnCard` sits on the same Search row as FloqCAST (`shoutout-icon-card` + `chrome-photo-face`, `data-feature-key="sinema"`, chrome `data-floqr-chrome-icon="sinema"`). Face art is a **vector** clapper + film + wordmark (`scripts/build-sinema-chrome-icons.py`, SVG under `images/chrome/sinema-svg/`). Ink / accent / metal fills come from the six Site chrome palettes. Screen, sprocket holes, lid-stripe gaps, and hinge centers are **transparent** (never painted black). White/Black Search uses `sinema-whiteblack.png`; other packs stay JPG on the chrome field. Approved FloqMedia official mark `images/chrome/official/si-nema-blacktiffany.webp` is layout reference only. Tile stays `hidden` until Features & Services `searchVisible` (Master Admin sees it with a Beta pill in test). Satellite `sinema.html` + `sinema-app.js` (same chrome hero, no FloqR parent logo). Callables `createSinemaScene`, `saveSinemaScene`, `loadSinemaScene`. Pin `projectId` + `pinRevisionId`. 48h from `originalSavedAtMs`. Geometry preservation `not_exact`. Enable Feature 1 + Beta 1 in Features Mgmt (Save + reason ≥8) after `setFeatureServiceFlags` is live so the row is not Packaged default — otherwise the tile never unhides. |
| Help | `help-sinema-virtual-set`, `help-floqr-oidc-floqmedia` (patron) + BOT DEE intent `sinema` |
| Out of scope | Spatial Studio UI, COLMAP/splats/survey, copying masters into FloqR, ads/floor plans on FloqR marketing, production rules |

Resume: `@spatial-studio$` / `$sinema$`. Rule: `.cursor/rules/spatial-studio-architecture.mdc`.

---

## GDPR data residency (security compliance — not migrated yet)

Owner requirement: **EU / EEA / UK patron PII must live on European Firebase/Firestore hosting** (GDPR). Live today is **`us-central1` only** — that is not the compliance end state. **Middle East location is undecided** (do not invent `me-central1` / `me-west1` / Europe). Do not run the split until the owner schedules it. Do not persist client IP. New PII stores must stay movable in-region.

Resume: `@gdpr$` / `$residency$`. Rule: `.cursor/rules/gdpr-data-residency.mdc`. Technical Bible §1.16 / §11.3.

---

## Patron phone unifier + account merge (s3.3.052)

**Purpose:** One mobile = one person. Duplicate Auth/Firestore patrons (e.g. MsLorna vs another Lorna Gmail) are merged by Master Admin. New sign-up / profile complete refuses a second account when the E.164 mobile is already claimed. **Do not run the live Lorna merge or delete Auth until a Master Admin confirms.**

| Layer | Wiring |
|---|---|
| Unifier | Normalized E.164 on `phoneIndex/{p{digits}}` + `users.phoneE164`. Client `phone` remains writable; E.164 / merge fields are backend-only. |
| Patron | Search + My Profile require mobile (`validateMobile({required:true})`). `claimPatronPhone` before `users` save. `phone_in_use` signs out and returns to `./?profileRequired=sign-in&phoneInUse=1`. Merged docs (`accountStatus: merged` / `mergedInto`) bounce to existing sign-in. Helper `floqr-account-unifier.js`. |
| Master Admin | Combined on **Demo Worker Mgmt** (`#demoEmployees`, card `#demoPatronAccountMerge`) and still on Duplicate Records (`#duplicateRecords`, alias `#patronAccountMerge`) so the card does not leak onto other tabs. One **Find patron** per column plus Preview / Merge. SOS2FA + `FLOQRReasonPrompt`. Callables `lookupPatronAccounts`, `previewPatronAccountMerge`, `mergePatronAccounts`. Moves Mingl connections, beta `features` union (incl. `mingl`), Inbox `recipientUid`, BOT DEE rooms/threads, blocks. **Never deletes Firebase Auth** (`authDeleted: false`). Chrome copy is operator-neutral (Master Admin, not a named person). |
| Audit | Chained `account.merged` on `featureServiceAuditLogs`. Unchained `account.phone_claimed` / `account.phone_denied`. Agent clients stamp `actorEmail: "agent"`. No client IP on `users` or `phoneIndex`. |
| Rules | `phoneIndex` Functions-only. `mergedInto`, `mergedFromUids`, `accountStatus`, `linkedAuthUids`, `phoneE164`, `phoneNormalized` in `hasBackendOnlyIdentityFields`. |
| Deploy | Functions subset tag `[firebase-deploy-accounts]` (claim/lookup/preview/merge). Pages cache-bust s3.3.069. |
| Help | `help-profile-mobile` (patron, required mobile) · `help-patron-account-merge` (masterAdmin, English). |
| Classification | `phoneIndex` secret PII; `users` merge/E.164 fields; system job `patronAccountUnifier`. Movable in-region; no stored IP. |
| Tests | `functions/account-unifier.test.js`, rules `phoneIndex` block, i18n chrome +12 keys × 11 langs. |

Mingl Search tile for Lorna is a separate change (`floqr-feature-services.js`). After a Master Admin confirms the live merge, the surviving uid must keep `betaTesters.features.mingl=1`.

## Demo Worker Mgmt (s3.3.069)

Master Admin → Entity Management → **Demo Worker Mgmt**. One-time sign-in codes for `temp_*@floqr-demo.com` workers when email OTP is not arriving.

| Layer | Wiring |
|---|---|
| Surfaces | Nav pill + panel h1 `master.demoEmployees` (“Demo Worker Mgmt”). Panel id / hash **`#demoEmployees`** (unchanged). Alias `#demoWorkerMgmt` → same panel. Redirect `demo-signin.html` → `#demoEmployees`. |
| Lookup | **Find demo worker** (`#demoEmpSearch`) + **Generate code**, and same-mobile **Find patron** / Preview / Merge (`#demoPatronAccountMerge`). Duplicate Records keeps `#patronAccountMerge`. |
| Client | `master-demo-employees.js` (`FLOQRMasterDemoEmployees.mount`). SOS2FA Entity Management gate. Reason via `FLOQRReasonPrompt` after Generate. |
| Backend | `issueDemoSignInCode`. Audit `demo.signin_code_issued`. |
| Help | `help-master-demo-signin` (masterAdmin). BOT DEE link label Demo Worker Mgmt, hash `#demoEmployees`. |
| Chrome | `master.demoEmployees` / `.find` / `.select` in all 11 langs. Operator-neutral (no named person). |
| Tests | `functions/demo-signin.test.js`. Diagnostics `s3-3-065-demo-worker-mgmt`. |

---

## Height unit + RydR pickup locale (s3.3.012)

Unit-first height and structured taxi pickup. Profile country wins; if empty, IP country (never stored) from `FLOQRGeoSearch.ipLocation`.

| Piece | Wiring |
|---|---|
| Module | `floqr-profile-locale.js` (`window.FLOQRProfileLocale`) — `bindHeightFields`, `bindPickupFields`, `validateHeight`, `usesZip` |
| Height | Choose **ft** or **m** first, then type. ft = `6'0"` (3'0–8'11); m = `1.78` (1.20–2.51). Mixing blocked. **United States defaults to ft.** Every other country (including Canada) and a non-US IP default to **m**. Typing the country field applies that default. Switching a valid value converts. Dual-read `heightUnit` `ftin`→`ft` |
| Pickup | Street #, street name, city, state/province (featured countries), ZIP (US resident) or postal (Canada / other / non-US IP). Composed `taxiPickupAddress` for RydR/commerce. Private on `users/{uid}` — not a Mingl public datapoint |
| Surfaces | Search welcome (`index.html`), My Profile (`patron-portal.html`), RydR (`pickup.html`) |
| Data | `users.taxiStreetNumber` / `taxiStreetName` / `taxiCity` / `taxiRegion` / `taxiRegionCode` / `taxiPostalCode` / `taxiPostalKind` / `taxiPickupAddress` — ownMaster PII, self-write |
| Help | `help-profile-height`, `help-profile-country`, `help-profile-mobile`, `help-taxi-pickup-address` (patron) |
| Tests | `functions/profile-locale.test.js`, `functions/geo-catalog.test.js` |

**ShoutOut nights / splash / editor + handle help (s3.3.017):** Venue cards list nights in calendar order with Oxford *and* (`Wed, Thu, Fri, and Sat`). Venue ShoutOut deep links paint `#adSplashPage` immediately (`html.floqr-shoutout-direct`) so Search never flashes blank; the 5s splash hold runs only for a paid/house creative or a Search-path (no venue yet). `showPage` always scrolls to top; Use a template focuses Message. FloqR / Mingl handle `?` sits on the label row (same as Country / Taxi), not in the input bubble — `hydrateInlineHelpButtons` swaps `button.floqr-help-popout` for the standard `details.help-popout`.

**VCC Dashboard queue links + FloqCAST label (s3.3.017):** Club Admin Dashboard `#metricPendingCard` / `#metricFloqCastDashCard` call `activatePanel("panelQueue"|"panelFloqCast")` when the count is **greater than 1**. Visible product name is **FloqCAST** (chrome `admin.floqcastQueue` / `cat.floqcast`); catalog key, files, and callables stay `floqCast`.

**AI Crawling publishing rules + CSV + logs (s3.3.019):** Master Admin → AI Crawling → **Publishing rule** per crawl type (`publishingRules` on `aiDiscoveryRatingCriteria/defaultNightlifeRating`). Nightclubs need Name, Genre, DJ(s), Address, City, Country, and Phone or Email; Promoter(s)/Instagram optional. Shared CSV template for sample / unpublished export / mass import. Review queue uses a real `discovery-queue-table` (not `.report-table`). Card actions are **Publish** (live) and **Save** (queue only). Publish always duplicate-checks. Past events ignored on crawl and cleaned via `retirePastCrawledEvents`. Auto-publish emails Master Admin. Categorized `appLogs` `category: aiCrawl` on Diagnostics → AI Crawling (`master-aicrawl-logging.js`). Modules: `functions/discovery-gates-core.js`, `functions/discovery-log-core.js`, `floqr-discovery-gates.js`.

**AI Crawling workspace (s3.3.020):** One `#aiCrawling` page with inner tabs (`data-ai-crawl-page`: overview / review / run / rules / import / insights). Review is the default tab. Instant Crawl Now and Run Discovery Crawl sit in the always-visible `.ai-crawl-primary-actions` header (not only on Run & schedule). `hideAllSubtabs` only targets `.admin-tabs .admin-subtabs` so in-page crawl tabs stay visible. Rollup KPIs are counts only; last crawl is `#aiCrawlLastRun`. `jumpToStatus` opens Review. Instant Crawl / Run Discovery / Preview / Save schedule bind via `FLOQRDiagnostics.ensureCrawlReady` + `#aiCrawling` `[data-ai-crawl-action]` delegation when AI Crawling mounts (Diagnostics panel is not required). Status writes `#aiDiscoveryStatus`. Clicked crawl buttons get `.is-busy` (grey, disabled, “Sending…” then “function received…”) until the callable returns. Queue `orderBy(createdAt)` empty result falls back to unordered + client sort. `queueCard` is one template (a stray `` ` `` after the opening div made `ai-discovery-service.js` fail to parse, so the queue never painted and Instant Crawl had no discovery handler). Gemini: Fill missing from official page, never invent TBA. Help: `help-ai-crawl-gemini`.

**AI Crawling KPI jump (s3.3.017):** Rollup cards Needs research / Approved / Pending review are buttons (`data-ai-status-filter`) that call `FLOQRAIDiscovery.jumpToStatus` → `#aiDiscoveryStatusFilter` + scroll `#aiDiscoveryQueueList`.

**IP preferred language + Prior / Future travel (s3.3.017):** `FLOQRProfileLocale.languagePlan` maps country/IP to a supported site language (Spain→es, Germany→de). UAE/Dubai prompts Arabic vs English. IP is never stored. Travel Interest split into Prior Travels + Future Travel Destination with `floqr-place-suggest.js` catalog then Gemini. Help: `help-prior-travels`, `help-future-travel`. Turkish pack not added this pass.

| Piece | Wiring |
|---|---|
| Nights | `floqr-feature-landing.js` `openDaysLabel` / `joinAndList` / `featureLanding.list.and` |
| Splash | `index.html` early-paint script; `styles.css` `html.floqr-shoutout-direct`; `patron-app.js` `showAdSplash` |
| Editor | `patron-app.js` `resetPageScroll` + `focusFirstEditorInput({preventScroll})` |
| Handle help | `index.html` / `patron-portal.html` `.label-inline-row` + `help-floqr-handle`; `help-attach.js` `hydrateInlineHelpButtons` |
| iOS select text (s3.3.030) | `styles.css` `select:not([multiple])` uses `appearance:none` + custom chevron. s3.3.030 used `height:auto` + 12/40 padding to stop iPhone clipping (Patron→Datron). |
| Select value centering (s3.3.035) | Same global rule: `height`/`line-height` **48px**, `padding: 0 40px 0 16px` (no block padding). Chromium top-aligns `appearance:none` values, so `line-height:1.35` made the selected text sit high. Site chrome form fills use `background-color` (not `background` shorthand) so the chevron survives. Applies to Search, Club Admin, Master Admin, patron satellites, feature landings — any page on `styles.css`. Xibo Display URLs stay `display.html?location=` / `display2.html?location=` (no `?v=`). |
| Account type | `#editAccountType` Personal (default patron) / Business (`IsBusinessAccount=1` → business name + Ad Campaigns tab). `?` is `help-profile-account-type` on `.label-inline-row`. `help-attach.js` never mounts help onto INPUT/SELECT (that emptied the Account type bubble). |
| Tests | `functions/shoutout-profile-ux.test.js`, `functions/feature-landing.test.js` |

**Country / mobile / taxi State (s3.3.014):** Static in-page catalog (`floqr-geo-catalog.js`) — not Firestore. Country dropdown: United States, Canada, `----`, featured nightlife markets A–Z (France, Germany, Italy, Russia, Spain, Turkey, UAE, UK), `----`, remaining countries A–Z. Featured countries ship State / Province / Region lists. Country fills mobile `(+dial)`; national digits validate to E.164 for SMS/WhatsApp. Redundant standalone City removed; Country sits above taxi; taxi includes State. Phone row is a compact `(+1)` + national input (no grid stretch).

| Piece | Wiring |
|---|---|
| Module | `floqr-geo-catalog.js` (`window.FLOQRGeoCatalog`) — ISO2, ITU dial, NSN length, subdivisions |
| Surfaces | `patron-portal.html` Edit Profile, Search create-profile (`index.html`), RydR `pickup.html` |
| Client | `patron-portal-app.js` / `patron-app.js` `bind()` + E.164 save; `floqr-profile-locale.js` compose includes region |
| Data | `users.country` (English name) + `countryCode`; `region` / `regionCode`; `phone` E.164; taxi region fields |
| Help | `help-profile-country`, `help-profile-mobile` |

**Site chrome on Back / login (s3.3.016):** Changing Site chrome then tapping **Back** (or opening login) no longer keeps the previous chrome until a manual refresh. Cross-document Back loads Search/login instead of bfcache; `floqr.isSiteChromeAt` stops `hydrateFromProfile` from restoring a stale `users/{uid}` snapshot; Search and the Welcome/login card force-repaint from localStorage.

**Portal tab restore + ShoutOut editor first field (s3.3.015):** Clicking **My Profile** (and every other portal tab) writes `?tab=` + `#panelId` via `history.replaceState`, same idea as Club Admin hashes. Hard refresh on My Profile reopens My Profile instead of Overview. SessionStorage is a reload-only fallback (a fresh Search → Portal navigate still lands on Overview unless `?tab=` is set). After Throw a ShoutOut → Use a template, `goToEditor` scrolls to and focuses the first visible composer field (`#mainText` Message, or Team / jersey fields when Message is hidden).

| Piece | Wiring |
|---|---|
| Module | `floqr-portal-tabs.js` (`window.FLOQRPortalTabs`) — `resolve` / `persistHref` |
| Surfaces | `patron-portal.html` tabs; Search `index.html` ShoutOut editor |
| Client | `patron-portal-app.js` `persistPortalTab` / `restorePortalTabFromUrl`; `patron-app.js` `focusFirstEditorInput` |
| URL | `patron-portal.html?tab=profile#portalProfile` (Overview drops `tab` and uses `#portalOverview`) |
| Tests | `functions/portal-tab-persist.test.js`, `functions/editor-first-field.test.js` |

**Save Profile crash (s3.3.013):** My Profile **Save Profile** reloads the portal after the Firestore write. `renderPolicies` called `FLOQRI18n.t(key, null)`, and `t()` did `Object.keys(null)` → `Cannot convert undefined or null to object`. `t` / `tIn` now coerce non-object vars to `{}`. Portal policy helper uses `vars || {}`. A failed reload after a successful write no longer reports the save as failed.

| Piece | Wiring |
|---|---|
| Surfaces | `patron-portal.html` → **Save Profile** (`#saveProfileBtn`) |
| Client | `floqr-i18n.js` `interpolationVars` · `patron-portal-app.js` `saveProfile` / `renderPolicies` |
| Tests | `functions/i18n-t-vars.test.js` |

---

## Stripe sandbox wiring (s3.3.007)

Stay on Stripe **test/sandbox keys**. Do not switch `STRIPE_SECRET_KEY` to live.

| Piece | Wiring |
|---|---|
| Checkout | Hosted Stripe Checkout via `FLOQRPayments.startCheckout` → `createFloqrCheckoutSession` (`functions/commerce-functions.js`). Critical pay CTAs (`submitShoutoutBtn` Continue to Checkout, VIP Pay deposit, floqCast pay) lock on the first tap (`FLOQRPayments.lockCriticalButton` → `.is-critical-busy`, greyed, `pointer-events:none`) so a slow session create cannot double-charge. |
| Connect binding | `stripeConnectAccounts/{connect_<sha>}` written by Functions only (`createFloqrConnectOnboardingLink`, `getFloqrConnectStatus`, `persistConnectStatus`) |
| VIP Club Stripe | `loadClubStripeReady` reads `stripeConnectAccounts` (club binding), then club flag fallback. Club Admin onboarding no longer leaves `clubLocations.stripeConnectAccountId` empty as a blocker |
| Destination charges | When Connect transfers are ready, Checkout sets `payment_intent_data.transfer_data.destination` + `application_fee_amount` for ShoutOut (80/20), floqCast, VIP `clubStripe`, and BartR. ShoutOut still works without Connect (`optionalReadyRecipient`) |
| Webhook | Same `stripeFloqrWebhook` + `STRIPE_WEBHOOK_SECRET`. Add Dashboard events: `account.updated`, `capability.updated`, `account.application.deauthorized`. Lookup uses `connectAccountIdFromWebhookEvent` (`acct_` only — never capability names or `ca_`). Do not require `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Club flags | `persistConnectStatus` mirrors `stripeTransfersActive` / `stripeCapabilityTransfers` / `stripeConnectLivemode` onto `clubLocations` — **never** the `acct_` id. Client cannot write those fields (`preservesStripeBindingFields`) |
| Sandbox refund | Callable `refundFloqrCheckoutOrder` stays test-mode only (`reverse_transfer` + `refund_application_fee`) for webhook payout recovery. **Operator refunds are out of this pass** — no Master Admin “Refund sandbox order” control, no Pages QA. |
| Surfaces | Club Admin public profile Stripe card; Master Admin Application Logging; patron Checkout unchanged |
| Help | `help-vip-payment-collector` — Club Stripe uses Club Admin Connect onboarding |
| Deploy | Functions + webhook event list. Pages cache-bust `payment-service.js` / `admin-app.js` / diagnostics |

---

## Master Admin 5-min rollup (s3.3.013)

| | |
|---|---|
| **Purpose** | Precompute panel summary datapoints every 5 minutes so Master Admin strips do not run 27 collection counts / 1200-club duplicate scans / 750×3 commerce pulls on every panel open |
| **Schedule** | `scheduledMasterAdminRollup` — `every 5 minutes` UTC (`functions/master-admin-rollup-functions.js`) |
| **Callable** | `refreshMasterAdminRollup` — Master Admin only (`isServerAdminAuth`); writes same doc |
| **Doc** | `masterAdminRollups/current` — `diagnostics.collectionCounts`, `aiCrawl` status counts + last run, `duplicates` clusters, `commerce` paid aggregates, `templates`, `recommendations` |
| **Rules** | Master Admin read; client write `false` (Functions Admin SDK only) |
| **Client** | `master-admin-rollup.js` → `FLOQRMasterAdminRollup` — bind + load on sign-in; `paintForPanel` from `activatePanel`; Diagnostics **Refresh rollup** button |
| **Panel behavior** | Diagnostics mount paints rollup only (Run/Refresh Diagnostics = full live scan). Duplicate Records mount paints rollup; Refresh = live 1200 scan. AI Crawling `#aiCrawlingSummary` = rollup; `#aiDiscoverySummary` keeps how-to. Commerce/templates/recs metric cards from rollup |
| **Classification** | `floqr-data-classification.js` register + `masterAdminRollup` job collections |
| **Cache-bust** | `master-admin.html` / `master-admin-app.js` / `master-admin-rollup.js` / `ai-diagnostics-service.js` / `ai-discovery-service.js` / `duplicate-record-service.js` / `floqr-discovery-gates.js` / `floqr-data-classification.js` `?v=s3.3.018` |
| **Deploy** | Functions + Firestore rules required for live schedule/callable; Pages for client strips |

## PHILA front+back pair retired (s3.3.012)

| Piece | Wiring |
|---|---|
| Removed | `nbaPhiladelphia76ersPhila` (front+back / `nbaJerseyPair`) — no longer in catalog or picker |
| Kept | `nbaPhiladelphia76ers` — back-only 76ERS plate |
| Pair engine | Display `.nba-pair-kit-stack` / `paintIndependentPairFace` remains for unpublished Terps throwback pair |
| Test | `functions/phila-independent-pair.test.js` asserts pair gone + 76ers kept |

## PHILA White/Blue colorways (s3.3.004) — historical (pair retired)

| Piece | Wiring |
|---|---|
| Composer | `index.html` `#jerseyColorway` — shown when template has `jerseyColorways` (PHILA pair) |
| Catalog | `jersey-catalog.js` `nbaPhiladelphia76ersPhila.jerseyColorways` white\|blue + `FLOQRResolveJerseyColorway` |
| Assets | White `nba-76ers-phila-*-blank.png`; Blue Icon `nba-76ers-phila-blue-*-blank.png` |
| Display | `display-app.js` pair stage uses colorway URLs + `--nba-pair-ink` / `--nba-pair-outline` |
| Controls | White C + Blue LED-punch under `reports/nba-phila-jersey-v1/assets/control/` |

## PHILA white blanks + Terps gated QA (s3.3.003)

| Piece | Wiring |
|---|---|
| PHILA assets | `images/basketball/nba-76ers-phila-{front,back}-blank.png` — white Association RGBA cutouts; catalog overlays supply name / PHILA / number (no baked EMBIID) |
| Catalog | `nbaPhiladelphia76ersPhila` → blank URLs, `jerseyCssBack: false` |
| Pair chrome | `display-app.js` skips FloqMedia rail when `pairMode`; `display.css` hides identity rail + single-face `.display-background` on `.nba-jersey-pair` |
| Terps QA | `maryland-terps-pair-qa.html` — unlock key `terps-pair-qa`; hosts pair flags on published `nbaMarylandTerps` (front=back placeholder). Throwback Pair stays unpublished |
| Visual QA | `/cursor/stores/self/nba-jersey-pair-visual-qa.md` — PC agent must confirm render vs sample after deploy |

## Maryland Terps jersey pair v2 (s3.3.002)

| Piece | Wiring |
|---|---|
| Brief | `reports/maryland-terps-jersey-v2/` (CURSOR_MASTER_PROMPT, IMPLEMENTATION_CONTRACT, SOURCES, INTEGRATION, composition reference) |
| Catalog | `nbaMarylandTerpsThrowbackPair` — stable id `ncaa-umd-2026-27-2002-throwback-white-v2`, `nbaJerseyPair`, 7s/5s, `pairMessageTheme: maryland`, **`catalogPublished: false`** / **`productionAssetsReady: false`** (no front blank plate yet) |
| Live Terps | `nbaMarylandTerps` remains the published back-only LED kit |
| Gate | Unpublished pairs are omitted from `SHOUTOUT_TEMPLATES` / `FLOQR_JERSEY_TEMPLATE_IDS` / photo ids |
| Display | Shared pair stage; Maryland message gradient when theme set; pair requires front URL + assets ready |
| Engine | Same `floqr-jersey-scene.js` / FrameLoop as PHILA v1 — do not duplicate |
| Gated QA | `maryland-terps-pair-qa.html` (s3.3.003) — operator unlock only |

## PHILA jersey pair v1 (s3.3.001 → blanks s3.3.003)

| Piece | Wiring |
|---|---|
| Brief | `reports/nba-phila-jersey-v1/` (CURSOR_MASTER_PROMPT, IMPLEMENTATION_CONTRACT, SOURCES, reference PNG) |
| Catalog | `nbaPhiladelphia76ersPhila` — `nbaJerseyPair`, `jerseySceneMs:7000`, `messageSceneMs:5000`, `seasonStatus: reference-specific-unverified`, stable id `nba-phi-phila-white-reference-v1` |
| Timing | `floqr-jersey-scene.js` `sceneAt`; `floqr-frame-loop.js` `holdMsByPhase` + `includeCopy:false` when ShoutOut blank |
| Display | Pair stage back-left / front-right; optional ShoutOut panel; loads on `display.html` / `display2.html`; FloqMedia off on pair |
| Editor | Name + Number + optional ShoutOut (same chrome as NFL dual for PHILA) |
| Assets | White Association blanks `nba-76ers-phila-*-blank.png` (s3.3.003); legacy blue Icon `*-with-club.png` kept for other 76ers template |

## ShoutOut diagnostics + Baller face upload + PHILA dual (s3.2.101)

| Piece | Wiring |
|---|---|
| Decode error | Client `loadImageElement` — Storage URL → fetch blob → `createImageBitmap` / object URL; message **"Could not decode portrait image"** = composite could not load original/mask pixels (often after Gemini already returned a mask) |
| BG removal | `functions/gemini-portrait-mask.js` `parseSegmentationJson` repairs truncated JSON + box_2d fallback; client composite prefers local File blob |
| Baller Upload | Single **Upload photo** → chooser: Photo library / files **or** Camera — face guide (`openBallerFaceCameraCapture` oval). Standalone **Take photo** removed (duplicate of native sheet). Company max **18** UPPERCASE |
| Catalog | **Black Card** + **Black Card (Amex)** removed from `SHOUTOUT_TEMPLATES` / STANDARD. Keep **Baller's Alert** (+ Amex twin). Checkout refuses new `blackCard` / `blackCardAmex` |
| PHILA dual | Catalog `nbaPhiladelphia76ersPhila` (`nbaDualFaces`, `frontBackgroundUrl` + back kit). Display rotates front (PHILA + number) ↔ back (name + number) via `FLOQRFrameLoop` |
| Diagnostics | Master Admin → **Diagnostics → ShoutOut** (`#diagnosticsShoutOut`, `master-shoutout-logging.js` / `FLOQRShoutOutDiagnostics`). `appLogs` category `shoutout`; subsection groups `page_call` by `shoutoutTrailId` + time/template/location |
| Page trail | Starts on ShoutOut button (`shoutoutButton`) → Choose a venue (`shoutout-search.html` `shoutoutSearchPage`) → Throw ShoutOut Here (`throwShoutoutHere`) → `?start=shoutout` skips Search and opens splash (`adSplashPage`) → `templateSelectPage` → `editorPage` → `confirmationPage` → `checkoutRedirect` (Stripe host only) → `paymentReturn`. `FLOQRLog.shoutoutPageCall` in `floqr-logger.js`. Venue/template empty until chosen (never Zebbies/`blackwhite` defaults). Trail id rides `shoutoutTrailId` query + sessionStorage. Dead in-page `shoutoutLandingPage` removed. |

Cache-bust: `patron-app.js`, `styles.css`, `jersey-catalog.js`, `display-app.js`, `display.css`, `shared-data.js`, `master-admin.html`, `master-shoutout-logging.js`, `botdee-help-repository.js`, `floqr-i18n.js`, `floqr-i18n-help.js`, `ai-diagnostics-service.js` `?v=s3.2.101`.

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

## Baller company max 18 + UPPERCASE (s3.2.100)

| Piece | Wiring |
|---|---|
| Cap | `BALLER_COMPANY_MAX = 18` in `patron-app.js`; catalog/layout `maxSubCharacters:18`; `#ballerCustomCompany` `maxlength="18"` |
| UPPERCASE | `ballerCompanyNormalize` (composer + payload) + `display-app.js` company `toUpperCase()` on LED |
| Presets | `WE'RE OUTSIDE LLC`, `BAD BOY INC.`, `BADDB$CHES CORP` (≤18) |

Cache-bust: `patron-app.js` / `shared-data.js` / `display-app.js` / `index.html` / `floqr-i18n-help.js` / `botdee-help-repository.js` `?v=s3.2.100`. Manual test: `s3-2-100-baller-company-18`.

## LED — Terps number stroke weight −20% (s3.2.99)

| Piece | Wiring |
|---|---|
| Thinner outline | `floqr-varsity-numbers.js` SVG `stroke-width` **8.8** (was 11, −20%) |

Cache-bust: `floqr-varsity-numbers.js` `?v=s3.2.99`. Manual test: `s3-2-99-terps-stroke-thin`.

## LED — Terps number horizontal −30% (s3.2.98)

| Piece | Wiring |
|---|---|
| Narrower digits | `display.css` `.varsity-num { transform: scaleX(.7); transform-origin: center top }` — horizontal only; vertical size unchanged from s3.2.97 |

Cache-bust: `display.css` `?v=s3.2.98`. Manual test: `s3-2-98-terps-number-narrow`.

## LED + Saved — Terps varsity SVG +20% / Saved continue (s3.2.97)

| Piece | Wiring |
|---|---|
| Number inner encirclement | `display-app.js` NBA photo path paints `#displaySub` via `FLOQRVarsityNumbers.svg` (stroke + `fill-rule:evenodd` holes). Thin CSS text-shadow removed for NBA photo kits. |
| Number +20% vertical | `jersey-catalog.js` `BASKETBALL_JERSEY_OUTPUT.number` `one: 0.4968` / `two: 0.36432` (was 0.414 / 0.3036). |
| Stroke weight | `floqr-varsity-numbers.js` stroke-width `11` (was 9). |
| After Save opens Pending | `patron-portal-app.js` deep-link `id=` for `status:saved` now opens **Saved** pane (was always Pending). |
| Continue editing dead | Continue is a button → `continueSavedShoutout` → session draft with jersey fields + `openEditor` → Search `goToEditor()` (old `?start=editor&savedId=` was never handled). |

Cache-bust: `display.css` / `display-app.js` / `jersey-catalog.js` / `floqr-varsity-numbers.js` / `patron-app.js` / `patron-portal-app.js` / `ai-diagnostics-service.js` `?v=s3.2.97`. Manual test: `s3-2-97-terps-varsity-saved`.

## LED + My ShoutOuts — missing jersey number / past restore (s3.2.96)

| Piece | Wiring |
|---|---|
| Missing number + FloqMedia at collar | `display-app.js` NBA photo path used undeclared `digits` → `ReferenceError` before `#displaySub.textContent` and `pinJerseyFloqMediaRail`. Fix: `const digits = glyphLen(subText)`. |
| Attribution wiping mark | `patron-app.js` `syncAttribution` now skips all soccer/NBA/NFL kits (not only NFL dual); commit reads `#soccerJerseyNumber` for jersey `subText`. |
| Use Past ShoutOut | Restores `soccerManualName` + `soccerJerseyNumber` from past row; does not treat jersey mark as attribution. |
| Past memory | Failed `getPastShoutOutMemory` no longer caches empty forever; rows sorted by `submittedAt`. |
| My ShoutOuts empty Saved | Firestore had approved rows; Saved drafts can be zero. Portal auto-opens **Completed** when Saved+Pending empty and Completed has history. Query failures `console.warn`. |

Cache-bust: `display-app.js` / `patron-app.js` / `patron-portal-app.js` `?v=s3.2.96`. Manual test: `s3-2-96-jersey-number-my-shoutouts`.

## LED display fixes — Baller rim restore / jersey remnants / floqCast 100s / Gemini thinking (s3.2.95)

**Purpose:** Follow-up to s3.2.94 LED QA + Gemini/floqCast hardening (Nov 2026).

| Fix | Where |
|---|---|
| Baller ornate gold rim | `scripts/build-baller-card-photos.py` — exterior flood-fill only (no band luma/chroma wipe that deformed gold filigree); rebuild LED PNGs from package master |
| Terps / jersey remnants | `display-app.js` `isBoardRemnantText` + `jerseyRealText` — HAPPY HALLOWEEN / idle CTA never become kit name; stop Halloween finale + wipe classic overlays before jersey paint |
| NBA FloqMedia under hem | Portrait tanks use height-fit (`--nba-kit-h:86%`, `background-size:auto var(--nba-kit-h)`) so the hem stays on-board; rail `bottom:1.2%` + `pinJerseyFloqMediaRail` on canvas (s3.2.95) |
| floqCast default live | `floqcast-preview.js` + `functions/floqcast-functions.js` — allow **100s**, default **100** (was 90) |
| Gemini portrait mask | `functions/gemini-portrait-mask.js` — `thinkingLevel: LOW` for all 3.x; retry once without `thinkingConfig` if model rejects thinking args |
| Upload size | Keep FLOQR **8 MB** Gemini edit cap (`MAX_GEMINI_IMAGE_BYTES`) — do not remove; phone HEIC/JPEG can exceed Function/Gemini payload safely |

Cache-bust: `display.css` / `display-app.js` / `floqcast-preview.js` `?v=s3.2.95`. **Functions deploy required** for Gemini + floqCast duration. Manual test: `s3-2-95-baller-jersey-floqcast-gemini`.

## LED display fixes — Baller corners / Terps FloqMedia / Halloween grave (s3.2.94)

**Purpose:** Venue LED QA from live screenshots (Nov 2026).

| Fix | Where |
|---|---|
| Baller white corner wedges | `scripts/build-baller-card-photos.py` `scrub_led_corner_fringe` + black letterbox; `display.css` `.baller-card .display-background` radius `3.15%/5.1%` + black outline |
| Terps / NBA FloqMedia mid-jersey | Root cause: portrait kit + width-based `84% auto` cropped the hem, so screen-bottom FloqMedia sat mid-torso. Fix (s3.2.95): height-fit tank (`nbaPhotoKitLayout` / `--nba-kit-*`), remap jerseyOutput tops into that box, rail on canvas + `bottom:1.2%` + inline pin. Remnants: `isBoardRemnantText` / `clearClassicBoardRemnantsOnJersey` |
| Halloween RIP tomb | `display.css` `.hw-grave` top-left (`left:8%;top:4%`); ghosts start near grave (`hwGhostRush` from top-left) |

Cache-bust: `display.css` / `display-app.js` `?v=s3.2.94`. Manual test: `s3-2-94-led-display-fixes`.

## 2026 jersey backs — Maryland Terps + NBA icon + NFL home kits (s3.2.91)

**Purpose:** Photo LED backs. Maryland Terps basketball takes State, name, and number. All 30 NBA clubs use a 2026/27 icon tank (same cut as Terps); the club word, name, and number are typed on the kit. Every NFL club uses its 2026 home colors; the club word sits on the nameplate.

| Layer | Wiring |
|---|---|
| Art | `images/basketball/maryland-terps-2026-back.jpg`; `images/basketball/nba-*-back-with-club.png` from `scripts/build-nba-2026-jerseys.js`; `images/nfl/nfl-*-back-with-club.png` from `scripts/build-nfl-2026-jerseys.js` |
| Catalog | `jersey-catalog.js` — `jerseyOverlayWordmark`, `jerseyPlateLabel`, `jerseyStateField` (Terps only), `jerseyOutput` (basketball type: two-word places such as LOS ANGELES and OKLAHOMA CITY wrap to two lines at the regular size; a long single word shrinks; number is Alumni Sans Collegiate One at 41.4% / 30.4% with team-color fill and a white outline; word stays at 10.3%, name at 23.15%, number at 32.355%; number outline is an outside-only text-shadow ring so counters stay open; team/state word arches 25° end to end; NBA and Terps backs are photorealistic mesh fabric), `nflDualLayout` on NFL photos |
| Composer | `index.html` `#jerseyState` when `jerseyStateField`; name + mark already on `#soccerJerseyFields` |
| Board | `display-app.js` paints the plate word when `jerseyOverlayWordmark`; `display.css` places it on the NFL plate and on the Terps upper back. Once team, name, and number are real, the idle `Use ShoutOut @` line is not painted (`defaultMain` is deleted on approve and ignored on the board). |
| i18n | `editor.jerseyState` in all 11 chrome packs |

---

## Template selection — LED-true cards + Search lens (s3.2.21)

**Purpose:** Venue template pick uses the Search-page lens field, contextual template-only search, and a true LED preview at the venue primary display size.

| Layer | Wiring |
|---|---|
| Surface | `index.html` `#templateSelectPage` — `#templateSearchForm` / `#templateSearch` + `#templateSearchGo.category-botdee-lens` (always visible) |
| Client | `patron-app.js` — `templateLedPreviewHtml`, `mountTemplateLedPreviews`, `primaryTemplateFormat`; cards Use-only |
| Preview | `floqr-template-preview.js` `previewUrl` + `sampleFor` stock text/media; `floqr-board-frame.js` mounts native aspect |
| Format | Venue `primaryDisplayScreenFormatId` (fallback overlapping formats); label on card head with template name |
| Search scope | Official / club-approved / personal / community via `floqrSearch` + tags/description/popularity ranking |
| CSS | `styles.css` `.template-select-*`; reuses `botdee-search.css` lens field |
| Help | `help-default-template`, `help-botdee-template-search` |
| Diagnostics | Manual test `s3-2-21-template-select-led-search` |

---


## PC Search composition (s3.2.29)

**Purpose:** On PC monitors, Search is one centered composition (FloqR mark + Search field + product icons), not left-docked Search with icons pinned to the viewport bottom.

| Layer | Wiring |
|---|---|
| Search field | `floqai-search.css` `.category-floqai-search` — `margin:0 auto 18px`, `max-width:720px` |
| Desktop layout | `styles.css` — `html.floqr-desktop-browser` + `@media(min-width:1181px)` center `#categoryPage` with `justify-content:center`; icon row stays under Search (`margin-top:28px`, not `auto`) |
| Shell | `html.floqr-desktop-browser .app` — `max-width:1180px; margin-left/right:auto` |
| Admin shells | `admin.css` — `html.floqr-desktop-browser .admin-shell` same 1180px centered column |
| Phone/tablet | Unchanged bottom-pin via `@media(max-width:1180px)` + `floqr-mobile-browser` / `floqr-tablet-browser` |
| Diagnostics | Manual test `s3-2-29-pc-search-centered` |

---

## Template Description / How it works / Tag (s3.2.28)

**Purpose:** Template gallery cards show three labeled lines — **Description:**, **How it works:** (venue primary LED size), and **Tag:** chips. Club Admin owns venue tags; Master Admin owns description + howitWorks.

| Layer | Wiring |
|---|---|
| Data | `SHOUTOUT_TEMPLATES.*.description` + `howitWorks: { "led-96x48", "led-64x48", "led-64x32" }` in `shared-data.js` / Firestore `templates`; venue tags via `venueTemplateTags` |
| Helper | `FLOQRTemplateCopy.howitWorks` / `.description`; `FLOQRTemplateTags.publicTagsFor` / `isClubOwnedTemplate` |
| Gallery (Patron) | `patron-app.js` — `.template-select-copy` with labeled `Description:` / `How it works:` / `Tag:` (`publicTagsForTemplate`) — view only |
| Club Admin | Template Mgmt cards show the same three lines (Description/How it works read-only); **Manage template tags** edits Tag only on club-owned; shared FloqR Tag read-only |
| Master Admin | Template Management edits Description + per-size howitWorks + catalog tags; list rows show labeled Description/How it works/Tag; save **preserves** `scope`/`venueIds` for club-owned |
| Data / security | `venueTemplateTags` docs require `ownership:"club"`; rules `templateOwnedByClub` via `clubLocations.clubOwnedTemplateIds` or `templates/{id}.venueIds`. Shared FloqR templates cannot be written. Classification: public read for patron cards; writes club-owned only (`data-classification-core.js`). Rules version `s3.2.28-club-owned-template-tags` (deploy Firestore rules). |
| i18n | `template.descriptionLabel` / `howItWorks` / `tagLabel` / `noTags`; `templateTags.venueEditable` / `clubOwned*` / `sharedReadOnly` / `seedFromCatalog`; `admin.templateCopyOwnership` |
| Diagnostics | Manual tests `s3-2-28-template-tag-labels`, `s3-2-27-template-howitworks` |

## Template howitWorks (s3.2.27)

**Purpose:** Patrons see a short general `description` plus size-specific **How it works** copy for the venue’s primary LED format. Superseded UI labels in s3.2.28; datapoint unchanged.

---
## Login + Search chrome (s3.2.26)

**Purpose:** Compact sign-in, short welcome, privacy links in page footer, FloqR wordmark without pill, Search lens-in-field, tile-palette Site chrome, Search product icons bottom-pinned on phone/tablet.

| Layer | Wiring |
|---|---|
| Login copy | `index.html` `.login-welcome-line.help-label` → `app.welcomeSignIn` = **Please signin or signup**; left-justified with `?` (`align-self:flex-start`); **80px** under FloqR mark (`.login-card > .floqr-home-link`) |
| Login legal | `footer.login-page-footer` — single **Privacy** link (`app.privacy` → `privacy.html`). CSS: `position:fixed; bottom:0` (+ safe-area). DNS/GPC controls remain under My Profile → My Privacy |
| Login Site chrome | Early localStorage paint (`floqr.isSiteChrome`) + `FLOQRChromeScheme` always paints last-used chrome on login/Search (does **not** demote to Nightlife when beta access is unresolved/denied). Cross-device: `hydrateFromProfile` reads `users.isSiteChrome` after sign-in and writes localStorage unless a **fresh** picker write (`floqr.isSiteChromeAt`, 30 min) is newer than the cached profile. Picker UI still gated by `siteChrome` beta |
| Login layout | `#loginActions` 2-column grid, half-height buttons; SMS/WhatsApp keep 2-line `has-sub` labels |
| Login colors | `#loginActions` stack = FloqR tile `cyan → violet → magenta` (`--floqr-tile-*`) |
| Logo | `images/floqr-color.png` — NL display tiles + white FloqR text, no charcoal pill; `?v=s3.2.26` |
| Logo → home | `floqr-nav.js` `bindHomeLogos()` / `data-floqr-home-logo` → `searchHome()` (`./?start=search`) |
| Back | Site-wide compact left-justified pill: `.global-back-btn` / `.floqr-back-btn` + `nav.backShort` (`< Back`) via `applyGlobalBack`. **Never** full-bleed (`width:auto!important`; excluded from mobile `.buttonlike{width:100%}`). Follows Site chrome (WB: white fill + shiny black text + black outline). Same-document click uses `history.back()`; **cross-document** Back (My Profile → Search / login) follows the `searchHome()` href so early-paint reads `floqr.isSiteChrome` instead of restoring bfcache. Headers: Back (left) → centered FloqR mark → page title |
| White/Black active controls (s3.2.52) | Active tabs/buttons stay **white fill + shiny black text** with thin **Tiffany** border (`--floqr-tiffany` / `#00d4fe` — FloqCAST T / BOT DEE). Never grey/black fill (was `--hot/--accent` both `#111` on `.admin-tab.active`). |
| Welcome OAuth | `patron-app.js` `signInProvider`: **popup first on every device** (user tap). Never redirect-first on mobile — GitHub Pages ↔ `*.firebaseapp.com` redirect often returns null under ITP (s3.2.35 regression: “full-page sign-in did not finish”). `auth/popup-blocked` → redirect last resort; never redirect on popup-closed. Failed redirect sets `floqr.authPreferPopup` and tells the patron to allow the popup or use Email/SMS OTP. `getRedirectResult` waits briefly for `onAuthStateChanged`. Portal Google (`patron-portal-app.js`) matches: popup first. |
| Search | `#categoryBotDeeInput` placeholder `Search for Clubs, Lounge, Events, etc.`; submit is `#categoryBotDeeGo.category-botdee-lens` inside `.category-botdee-field` (no full-width Search button). `.category-botdee-search` is `max-width:720px; margin:0 auto` so the desktop bar centers under the FloqR logo. Icon faces: transparent + tile-palette halo (no `#000` tile). `#categoryBotDeeSpeech` (removed) + green `.category-or` removed |
| Template BOT DEE | Floating `#botDeeAgent` / speech **off** on `#templateSelectPage` (`botdee-search.js` `syncAgentVisibility` → intent only). Lens `#templateSearchPanel` stays |
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
| Preference | Firestore `users/{uid}.isSiteChrome` — `0` Nightlife, `1` Traditional, `2` Black Tiffany, `3` White/Black, `4` Purple & White, `5` Black & Dark Green (+ legacy `uiChrome` string). Browser-only `floqr.isSiteChromeAt` (not PII, not Firestore) timestamps the last picker write so a stale profile cache cannot revert Search/login |
| Default | `0` / Nightlife for new patrons; last-used chrome is painted from localStorage / profile even when beta access is off (login + Search). Picker UI fail-closed until `FLOQRFeatureServices.canAccess("siteChrome")` |
| Client | `floqr-chrome-scheme.js` → `FLOQRChromeScheme` (`data-floqr-chrome`, `data-is-site-chrome`, `syncAccessGate` paints stored chrome — does not force Nightlife; `hydrateFromProfile` for cross-device; `data-floqr-theme-panel` / `data-floqr-theme-locked` gated) |
| Live resync (s3.2.61 / s3.3.016) | `syncFromStorage` + listeners: `storage` (other tabs), `BroadcastChannel("floqr-chrome")`, `pageshow` (`force` when `persisted`) / `focus` / `visibilitychange`. Search `#categoryPage` and login `#landingPage` `showPage` force-repaint from localStorage. Soft sign-out dispatches `floqr:auth-signed-out` → force re-paint. Logout on Search stays in-document (no no-op `./` assign); logout from a satellite `replace("./")`. `hydrateFromProfile` will not clobber a picker write from the last 30 min with a stale Firestore cache |
| Icons | Packs under `images/chrome/*` — nightlife / traditional / `vip-blacktiffany` / `vip-blackdarkgreen` / `*-whiteblack.*` |
| Palette | `:root` `--floqr-tile-cyan\|azure\|violet\|magenta\|coral` + `--floqr-brand-gradient` / `-h` (s3.2.20) |
| CSS slices | Nightlife = full spectrum on black; Traditional = charcoal + soft brand; Traditional secondary buttons = View Club style (charcoal fill, `--floqr-tile-cyan` ink; active = thin cyan border); search-output pills (`.badge-row` / `.tag-row` on ShoutOut, VIP reserV, and floqCast cards) use that same cyan ink with `!important`; Black Tiffany = cyan/azure; White/Black = white surfaces + **white cards** + shiny-black outline CTAs/login (white fill, `#0a0a0a` border + ink); VIP `vip.css` also forces white `body.vip-page` under whiteBlack (overrides nightlife hero wash); Purple & White = violet/coral; Black & Dark Green = forest green |
| Classic B&W template | `className: classic-bw` — LED board + FloqR identity rail use **red/black letterboard art**. Vault select **card shell** follows Site chrome (Traditional charcoal, White/Black white); only the mini-preview/LED keeps red. |
| Letter fit tags | Patron template cards show `FLOQRTextLayout` maxima per venue size (`96×48: 3×15=45`). Caps sized for ~1–3 m on P1.56. |
| FloqR Admin (templates) | Firestore `floqrAdmins/{uid}` (status active) or claim `floqrAdmin`. Rules: `canManageCatalogTemplates()` → `templates` write. Master Admin → Entity Onboarding card assigns/revokes. FloqR Admin-only session opens Template Management. |
| Feature icons (s3.2.63) | Rounded-square Search / hero marks for FloqCast, ShoutOut, VIP ReserV, BOT DEE, BartR, RydR, **Settings** — all 6 Site chromes. FloqCast F + BOT DEE B tips padded inside square. VIP seats-removed lounge. ShoutOut traditional/WB tiffany **OUT**. Settings rebuilt square (no circular ring). Search tile CSS `border-radius:8.6%` (SQ_CORNER/S=88/1024) — never `50%` (clips square rings). Review `images/review/square-chrome-pack/`; live `images/chrome/*`. `ICON_V` s3.2.63 |
| VIP icons (legacy round) | `scripts/build-chrome-icons.py` v31 — thin ring (`RING_STROKE=8`), only `re` under ring, raised mark; superseded for Search tiles by s3.2.62+ square pack |
| Surfaces | My Profile → **Appearance** → **Site chrome** card picker (`.chrome-select-*`); Language Settings no longer hosts the picker. Release Control titles use white `h2.features-release-title` + `?` |
| Routes | `patron-portal.html?tab=appearance` (`portalAppearance`); aliases `chrome` / `site-chrome` / `theme` |
| Profile chrome | Page title `portal.title` = **Profile & Settings**; manage blurb in title `?` (`help-my-profile`); global Back = compact left `< Back` via `FLOQRNav.applyGlobalBack` after i18n; FloqR mark under Back (`.floqr-page-brand`) |
| Receipts | `payment-return.html` / `ad-invoice.html` / `pass.html` — early-paint `data-floqr-chrome` + `floqr-chrome-scheme.js`; payment-return hydrates `users.isSiteChrome` after auth |
| Chrome audit | `floqr-chrome-audit.js` — Master Admin switch starts a localStorage session; each loaded page probes expected vs actual → pass/fail. Master Admin → Diagnostics → Manual Feature Tests → **Read Site chrome audit** / **Copy chrome fix prompt** |
| i18n / help | `nav.appearance`, `appearance.*`, `chrome.*` (+ blurbs / `lockedHint`); BOT DEE `help-chrome-scheme` → Appearance; Master `help-chrome-audit` |

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
| Aurelia Gallery (s3.3.073) | Club Public Profile `club-profile.html?location=temp-democlub-1` gallery **does not** show the four DonPapi/VIP ShoutOut tiles (`vip-donpapi-led-hbd.png`, `vip-donpapi-led-checking-in.png`, `vip-donpapi-led-carry.png`, `club-aurelia-vip-shoutout.png`). Seed `publicGallery` in `floqr-temp-qa-showcase.js` starts at Happy Birthday Maya. `club-profile-app.js` `filterRetiredGallery` / `resolvePublicGallery` drops those tiles from Firestore `clubLocations.publicGallery` **and** `clubMedia` so a stale overlay cannot resurrect them. Next `seedTempDemoPack` writes the trimmed `publicGallery`. Keep Maya / Papi's ClubTech 64×48 tiles. Display URLs stay without `?v=`. |
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
| Search beta tiles (s3.1.86) | `searchVisible` / `searchTileVisible`: test features show for **Master Admin** (Beta pill, QA) and granted beta testers. floqCast / VIP / BOT DEE stay `hidden` for regular patrons until Live or a beta grant. CSS: floqCast/VIP `<img>` marks no longer `height:100%` (was collapsing when face height is auto). |
| floqCast mark + live arm (s3.1.87) | `images/floqcast-icon.svg` must be valid UTF-8 (Windows-1252 `0x97` in a comment broke SVG-as-`<img>` → blank Search mark). Preview: `armFloqCastLiveDuration` only after stable ICE (`floqcast-webrtc.js` reports `answered` ≠ `connected`). `repairFloqCastPaidOrders` skips `ended`/`rejected` (no false “Moved N into queue”). Queue UI hides ended rows. |
| floqCast venue geo pick (s3.1.88) | `floqcast-search.html` loads `floqr-geo-search.js`. Empty search shows **top 4 nearest** floqCast venues (GPS → IP → profile city via `FLOQRGeoSearch.resolveUserLocation` / `sortNearest`). Typing matches club, brand, city, or `SHOUTOUT_EVENTS` event name. Status line shows nearest-of-N + place/source. Help: `help-floqcast-choose-venue`. |
| ShoutOut / floqCast fast venue paint (s3.2.86) | Landings paint from packaged catalog first (parallel `loadVenueRecord` in background). Must load `floqr-temp-qa-showcase.js` before `shared-data.js`, and rebuild rows via `FLOQRFeatureGates.getCachedVenue` so Firestore names (e.g. **Aurelia** / `temp-democlub-1`) enter the search haystack — do not rebuild from empty temp stubs only. |
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
| Help | `help-display-security-setting` in `botdee-help-repository.js` |

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
| Recovery | Break-glass `SOS2FA_RECOVERY_CODE` (Secret Manager). Window `RECOVERY_UNTIL_ISO` = **2026-12-15T04:00:00Z**. Listed Super Admin + verified email only. Deploy `verifySos2faRecoveryCode` with `[firebase-deploy-sos2fa]`. |
| Help | SOS2FA popouts + BOT DEE repository entries |

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
| Diagnostics | `FLOQRLog` → Firestore `appLogs` category `floqCast` (legacy dual-read `suprstar`): `webrtc_status`, `ice_servers`, `live_timer_*`, `live_heartbeat`. Master Admin → **Diagnostics → FloqCast** (`#diagnosticsFloqCast`, `master-floqcast-logging.js` / `FLOQRFloqCastDiagnostics`). **ShoutOut** logs → **Diagnostics → ShoutOut** (`#diagnosticsShoutOut`, `master-shoutout-logging.js`) including `page_call` trails. Application Logging still shows the same rows under the broader filter. Phone must be signed in to write; display2 is anonymous (console-only). |
| Heartbeat | Preview emits `live_heartbeat` every 10s while broadcast handle is open |
| Cache bust | Preview + Master Admin FloqCast panel scripts `?v=s3.2.85` |

---

## Help verbiage enhancement

**Purpose:** One scheduled job rewrites a single help entry when its raw title or body changes. Patrons, service members, and venue admins read the published `lasttextenhun`. Master Admin help is enhanced too, and stays off the public Pages script.

| Layer | Wiring |
|---|---|
| Store | `helpVerbiage/{id}`: `beenModsincelasttextenhun` 0\|1, `lasttextenhun` `{title, body}`, `lasttextenhunSourceHash` SHA-256 of raw title + newline + body, `audiences`, `audienceLabel`, `locales` for de fr es it pt ru el pl nl ar. Functions set the flag. |
| Job | `scheduledHelpVerbiageEnhance` every 15 minutes UTC. One Gemini call per run (`FLOQR_GEMINI_TEXT_MODEL`, default `gemini-3.6-flash`). Steps on that entry: drop repeated sentences, grammar pass, contextual rewrite. Auto-publishes when checks pass. Legal help is never sent. Gemini failure leaves the previous `lasttextenhun` and the flag at 1. |
| Flag 0 | English `lasttextenhun` plus all 10 translations, together, for any patron / service member / venue admin audience. Master-only may stay English. |
| Seed | Patron What's New lines and Version SMARTview help are the first `lasttextenhun` (`seeded: 1`, flag 1) until that entry's scheduled pass publishes. |
| Pages | `help-verbiage-snapshot.js` and the copy inside `botdee-help-repository.js` (source for tests and the pack builder). Pages load `floqr-help-loader.js` only. The first `?` fetches `floqr-help-runtime.js`, `floqr-i18n-help-runtime.js`, and one audience pack. A patron page requests `floqr-help-pack-patron.js` only. Venue-admin and service-member packs stay off that page. Master-only text is not in any pack. No Gemini on the version card, a `?` popout, or any paint path. Rebuild packs: `node scripts/build-help-audience-packs.js`. |
| Read | Callable `getHelpVerbiage` (signed in, `filterContent`). `contextualSearch` replaces a result label/blurb from a published non-master `lasttextenhun` when the session loads it. |
| Rules | `helpVerbiage` client read/write off. `helpVerbiageMasterSource` client read/write off. `helpVerbiageAudit` Master Admin read, client write off. Not `translationOverrides`. |
| Audit | Help id, flag before/after, `lasttextenhun` before/after, source hash, model id, outcome. No client IP. Agent probes: `actorRole` / `actorEmail` `agent`. Gemini rows also go to `geminiApiAccessLogs`. |
| Source split | Public entries: `functions/help-verbiage-public-source.json`. Master-only raw title and body: Firestore `helpVerbiageMasterSource/catalog`, read by `scheduledHelpVerbiageEnhance` with the Admin SDK. `functions/help-verbiage-master-audiences.json` stores id and audience only. Seed from a local file that is not committed: `node scripts/seed-help-verbiage-master.js --file <path>` (add `--apply --confirm-project shoutoutdemo-5b402` to write). Rebuild public catalogs: `node scripts/build-help-verbiage-sources.js`. |

## BOT DEE intent search (plain-language router)

**Purpose:** Map short / partial patron wording to products and help cards (e.g. `throw` / `shou` → Throw a ShoutOut; `sho` → Shows/events + ShoutOut; `hai` / `hail` → RydR). Stays the **feature-optimized fast path / fallback** under BOT DEE chat (and inside feature searches).

| Layer | Wiring |
|---|---|
| UI | Search still hosts the intent panel on `index.html` when used; `botdee.html` is **chat only** (Quick intent search removed s3.3.014). No `?` help bubble / no “Showing answers for…” scope line — type **help** (like **version**) for a local BOT DEE help reply |
| Client | `intent-search.js` — `PRODUCT_INTENTS`, `HELP_INTENTS`, `aliases`, `searchPhrases`, prefix `phraseScore` / `aliasScore` |
| Help seed | `botdee-help-repository.js` stays the catalog. Search pages do not load it on first paint. The first `?` loads the signed-in audience pack, then `intent-search.js` can read `FLOQRHelpRepository`. |
| Cache bust | `intent-search.js?v=` on `index.html` / `botdee.html` |

---

## BOT DEE chat (Phase 1 — `executeBotSession`)

**Purpose:** Headless BOT DEE agent: Auth + `botDee` feature gate + data classification → Gemini (`@google/genai`) + tools. Tools re-validate product gates and wrap existing VIP / ShoutOut / FloqCAST / checkout runners. Chat never collects card data.

| Layer | Wiring |
|---|---|
| UI | `botdee.html` — chrome icon left, **← Back to Search** (`FLOQRNav.searchHome()`, no `?v=`), transcript + input (`bot-dee-chat.css` / `bot-dee-chat.js`); Site chrome early-paint. Legacy `floqai.html` / `floqai-search.html` removed (404). |
| History collapse (s3.3.036) | Header **+** (44×44) top right opens **Chats**; same control becomes **−** to retract (Esc / backdrop too). Open lands on welcome / one-line pause status — does **not** auto-paint last 12 turns. Collapse is visual only: `hydrateHistory` keeps recall and Send still posts `history`; `executeBotSession` still loads last 12 `events`. **New chat** clears the canvas only. **This session** / earlier rows resume a slice. One thread per account (`botDeeThreads/{uid}`); + lists epochs from returned turns. Composer pinned (`100dvh`, transcript `min-height:0` + `overflow-y:auto`, `--botdee-kb` from `visualViewport`). i18n `botdee.chats*`. Pages-only. |
| SMARTview scroll + chat rename (s3.3.037) | People SMARTview in chat was clipped (View Full Profile / Mingl unreachable). Cause: `styles.css` `.page.active{display:block}` beat `.botdee-chat-page{display:flex}`, so the transcript had no bounded height and `.botdee-chat-page{overflow:hidden}` clipped the card. Fix: `.page.botdee-chat-page.active{display:flex!important; min-height:0}`; transcript `overflow:auto` + `touch-action:pan-y` (not split `overflow-x:hidden` / `overflow-y:auto`); messages `flex:0 0 auto`; bubble + `.botdee-sv-host` / People / Version / Room cards `overflow:visible`. History **+ / −** unchanged. **Rename:** ⋯ (44×44) or long-press on a Chats row opens an in-page title prompt (`#botDeeRenameDialog`, not `window.prompt`). Callable `renameBotDeeChat` writes `botDeeThreads/{uid}.chatTitles.{cv_<uuid>}` (minted once per conversation on the slice / events; last-12 restore and This session do not change the key). Leftover `live`/`current`/`archive` and hashed first-user keys migrate onto `conversationId` then `persistChatTitles` **replaces** the map (`tx.update`, not merge-set). `getBotDeeThread` rewrites titles only when slot keys remain. Titles are display labels — **never** sent to Gemini. i18n `botdee.chatsRename*`. Cache-bust `botdee.html` `bot-dee-chat.js` / `.css` / `botdee-smartview.css` / `floqr-i18n.js` `?v=s3.3.037`. Rename needs Functions deploy; scroll is Pages. |
| Client | `bot-dee-chat.js` → callable `executeBotSession`; `botdee-page.js` binds chat; `botdee-access.js` / `getBotDeeAccess` (alias `getFloqAiAccess`) for audience scope |
| Backend | `functions/bot-dee-functions.js` `executeBotSession` + `getBotDeeThread` + `renameBotDeeChat` + `saveBotDeePersonalization` + `setBotDeeSettings`; persist `functions/bot-dee-thread.js`; core `functions/bot-dee-core.js`; prefs `functions/botdee-personalization.js`; catalog `functions/bot-dee-search-catalog.json` (build: `scripts/build-bot-dee-search-catalog.js`); six-phase callables in `functions/botdee-upgrade-functions.js` (consent, export/delete, SMARTviews, legal gates, capability manifest) |
| Chat vs search | Greetings (`isChitchatPrompt`, including **Hello sir**) → time-aware short hello (`chitchatReply` / `greetingFor`) — **never** a product catalog. Mid-chat hi → `stillHereReply`. Mood/`how are you` (`isMoodPrompt` / `moodReply`) → friendly chat reply, never search. Mid-chat acks (`isAckPrompt`) → soft `ackReply`. Identity → `identityReply`. Privacy / keyboard / pause (`isPrivacyPrompt`) → `privacyReply`. **Client mirror** in `bot-dee-chat.js` answers locally first when durable threads are off. Search tool only for clear how-to intents; min score 3. |
| Composer (s3.3.023) | `#botDeeChatInput` placeholder is **Ask BOT DEE…** only. **Enter** = Send; **Shift+Enter** = new line (unchanged). Keyboard copy lives in `#botDeeComposerHint` (visually hidden) + typed **help** / **privacy** + `help-botdee-privacy-session`. Pause restore status is `botdee.sessionPaused` (“Session paused. Continue chatting.”) — not the five-minute privacy paragraph on the composer. |
| Personalization (s3.3.026) | Versioned first-use `botDeePersonalizationVersion` **2**. First visit: overlay `#botDeePersonalizationDialog` on `botdee.html` (no Settings bar). Later edits: **Profile & Settings → Feature & Orders → My BOT DEE**. Chat reset is **one-shot** via `botDeeSessionResetVersion` (old turns hidden until stamped; overlay skip / later Save do not wipe new chat). Overlay skip stamps `retrievalFromSeq` so pre-reset `events` stay stored but are not retrieved, painted, or sent to Gemini. `saveBotDeePersonalization`. Guest = `localStorage floqr.botDeePersonalization.guest`. Composer capture **skips** greetings / help / privacy. Product-dump intros (I'm BOT DEE + catalog) rewritten; real answers that name ShoutOut/VIP/floqCast stay. |
| My BOT DEE demeanor layout (s3.3.029) | `#foBotDeePane` radios use `.botdee-pref-demeanor-list` / `.botdee-pref-demeanor-option` on a `22px minmax(0,1fr)` grid with **custom** 22px radios (`appearance:none`) so iOS cannot stretch native controls. Panel-wide `overflow-wrap:break-word` / `writing-mode:horizontal-tb` (overrides `styles.css` `label{overflow-wrap:anywhere}` + `input{max-width:100%}`). Phone stacks 44px rows; ≥720px wraps as chips. Same markup on the first-use overlay. Package stamp **s3.3.029** cache-busts iPhone `admin.css?v=s3.3.028`. |
| Conversation idle (s3.2.70 / s3.3.046) | Client pause after `conversationIdleSeconds` (packaged default **300** / 5 minutes) with no message → pause bubble + `idleEnded` lease. Config: Firestore `botDeeSettings/default` (signed-in read; Functions-write). Master Admin → Features Mgmt → **BOT DEE** → Save via callable `setBotDeeSettings` (SOS2FA + reason ≥ 8). Clamp 15–600s. Pause does **not** delete conversations, memories, or workflows. **s3.3.046:** the 5-minute client timer **re-arms** (does not pause) while a ShoutOut SMARTpreview dock, VIP reserV dock, or active Room SMARTview (`data-rs-active=1`) is open. |
| Durable threads (s3.3.006 / recall repair) | Signed-in chats store under `botDeeThreads/{uid}` (doc id = uid) + `events` (pruned to 24). **Every** `executeBotSession` loads last 12 `events` (not only archive-on-idle), except a pending session reset — then events stay stored and are excluded from retrieval/UI. Idle splits **lease** (`status: idle_ended`, client timer) from **transcript cursor** (`turns` / `events` stay). Overlay skip stamps `retrievalFromSeq` (does **not** delete events). `execution.buildModelContext({turns, summary, memories, executions})` → `contextToContents` (cap 12 + short summary + discussed-vs-confirmed from `reservationClaimFromContext` + `botDeeExecutions`). Memories only if `consent.memory === 1`. Recap last two retrieved turns (skip post-pause hello); discussed ≠ booked unless an execution receipt exists. Flag `botDeeSettings.durableThreads` default **1**; `0` rolls back to tab-only history. Client still sends `history` for old Functions. Guessed `threadId` is ignored (`coerceThreadId` → uid). Composer locks (`restoreInFlight` + `setBusy`) until restore finishes so a local chitchat cannot race `restoreTurns`. Idle clock / `lastMessageAtMs` is **when the patron sent** (`receivedAtMs`), not persist time. Stored user text is `clipStoredText` (Shift+Enter newlines kept); `sanitizeUserPrompt` still flattens for Gemini/search. Tests: `functions/botdee-recall.test.js`. |
| Data / security | `botDeeSettings/{docId}`: P ops setting (idle seconds, `durableThreads`, revision, actor email, reason); not patron PII. Rules: signed-in read, write false. `botDeeThreads` / `botDeeThreads/events`: owner read (`uid` + doc id match), write false (Admin SDK). `chatTitles` map is Functions-write, owner uid only, keyed by minted `conversationId` (`cv_` uuid on events + `currentConversationId` / `archiveConversationId`; `renameBotDeeChat` ignores client `threadId`; leftover live/current/archive keys are replaced, not merge-set). Callables re-check Auth + `botDee` feature gate. Classification: ownMaster + PII. Chat titles never go to Gemini. |
| Place / dining search | `attachVenueSearch` runs in `executeBotSession` before people search and Gemini. Dining or clubs-in-a-city (`classifyPlaceSearchIntent`) scans onboarded `clubLocations` only — never Google or Yelp. Venue path returns `results: []` so only compact Place SMARTviews render (`club-profile.html?location=`, no `?v=`, no photo well; SMARTbackground from `resolvePlaceCard` / `smartVisualOverrides/placeSmartView:venue`). Unknown city or cuisine stays an empty catalog. Help: `help-botdee-place-search`. Needs `executeBotSession` deployed for live override stamps; packaged city/kind defaults still paint on Pages. |
| Tools | `contextualSearch`; `lookupPublicProfiles` (public patrons + published clubs, incl. image URLs); `classifyPlaceSearchIntent` / `attachVenueSearch`; `listShoutOutTemplates`; `startShoutOutCheckout` (flat `clubLocationId` + `message`; paid → `checkoutUrl`, free → pending `shoutoutId`); FloqR callable `createHeadlessShoutOutCheckout`; `getVipAvailability` / `createVipHold` / `recordVipConsent` / `createVipCheckout`; `createFloqCastRequest` / `createFloqCastCheckout` — each re-validates product gate then delegates (`functions/bot-dee-tools.js`) |
| ShoutOut throw from chat (s3.3.038 / s3.3.041 / s3.3.043 / s3.3.044 / s3.3.063) | `"throw a shoutout"` / `"send a shoutout"` is **execute**, not a help-catalog dump. `isShoutOutExecutePrompt` caps at `MAX_MESSAGE_CHARS`. It omits `contextualSearch` from Gemini tools (keeps `listShoutOutTemplates` + `startShoutOutCheckout`). `"how do I throw a shoutout"` stays search. **Headless compose (s3.3.041):** `functions/headless-shoutout-core.js` parses club + shoutout text (+ optional `templateId` / `screenFormatId` / `@handle` / media) from chat. `startShoutOutCheckout` accepts **flat** `clubLocationId` / `locationName` + `message` / `mainText` (no full shoutout object). Default template is Traditional `blackwhite`. Paid (`classicHalloween`) → `runCreateFloqrCheckoutSession` (`checkoutUrl`). Free → Admin SDK pending `shoutouts` + `portalHref` (My ShoutOuts). FloqR / third-party one-shot: `createHeadlessShoutOutCheckout` + `FLOQRPayments.startHeadlessShoutOut` — **does not use SMARTview**. **Template collectableInput1..N (s3.3.063):** each `templates/{id}` + catalog row stores numbered Firebase fields `collectableInput1` … `collectableInputN` `{fieldId, required: 0|1, prompt}` plus `collectableInputCount`. Family lists in `functions/shoutout-template-inputs.js` / `window.FLOQRTemplatePatronInputs` **seed** those slots (Traditional N=3 club+shoutout text+optional handle; photo N=4; jersey N=6; Heist name-only N=3; Baller's Alert N=5; Football Intro N=4). BOT DEE headless and Gemini `listShoutOutTemplates` **read the numbered fields** (Firestore overlay when present), not a hardcoded family table. Overlay loads **before** `applyBareInteractiveReply` / `isInteractiveFollowUp` so a custom required slot is filled on the next bare reply. Follow-up fill uses the **draft’s** template, not a newly parsed `templateId` — a bare `jersey` switch does not stuff `jerseyTeamId`. `submitFreeHeadlessShoutOut` passes the overlay into `isComposerOnlyTemplate`. Empty venue `templates=[]` returns no cards; no club still lists the packaged catalog. `fillFromConversation` reads prior user turns so a bare `throw a shoutout` with Aurelia + birthday already in thread is enough for Traditional — no canned phrase. `interactiveNeeds` iterates `collectableInput1..N` and asks **one missing required slot**; optional extras never block. When required slots are filled, ShoutOut SMARTpreview is **ready**; `throw it` / skip extras mints. Photo / jersey / Football Intro / Baller's Alert still open compose when a required photo slot cannot be filled in chat. Draft on `botDeeThreads.headlessShoutOutDraft`. Optional **ShoutOut SMARTpreview** (`kind: botDeeShoutOut`) docks above the BOT DEE composer (`#botDeeShoutOutPreviewDock`); composer preview is `display.html?preview=1` (never Xibo `?v=`). Core never imports SMARTview. Master Admin → Features Mgmt → BOT DEE → **SMARTpreview**. **Composer parity (s3.3.043):** payload uses catalog `className` (`classic-bw`), venue address, layout percents, identity rail. Bare `yes`/`ok` never mints a ready Traditional draft; `throw it` sends. A new complete `throw a shoutout at … that says …` resets leftover extras. Failed mint keeps the draft + dock. Club Admin **Approve & Push Live** copies packaged `className` onto `liveContent`. Chat still does not mint a live board — venue must approve. Never invent a checkout URL; never collect cards. Help: `help-shoutout-headless-smartview`. Functions deploy: `[firebase-deploy-botdee]` (includes `createHeadlessShoutOutCheckout`). |
| Locale (s3.3.005) | Client sends `uiLanguage` from `FLOQRI18n.getLanguage()`. Server localizes result cards + action-link labels via `functions/bot-dee-result-locales.json` (build: `scripts/build-bot-dee-result-locales.js` from help packs + chrome keys). Gemini system instruction requires reply in app language. Client `localizeResults` is a safety net. English catalog text must not show when UI is DE/FR/… |
| Feature access (s3.3.005) | **Least privilege:** session loads Features & Services via `canAccessFeature` (live / test+beta grant / Master Admin). Search cards, Gemini tools, pitches, and help blurbs include products **this viewer may use**; scrub sibling betas they lack (multi-product help too). Granted floqCast/VIP/etc. **must** stay visible. Client `scrubGatedBrands` + `FLOQRFeatureServices.canAccess` safety net. |
| Public profiles | `lookupPublicProfiles` is viewer-context: the same volunteered public datapoints a signed-in patron can already see (not PII/PCI — never email/phone/PAN/GPS). Cards include `sharedDatapoints` (opted-in keys) + `datapoints` (every filled value; lists up to 40). Default missing `publicMinglDatapoints` = all keys; explicit `[]` = share none. **About me:** query `me` / `isSelfQuery` returns the viewer's public card (`relation:"self"`). Unpublished self = identity-only. **Friends:** Mingl/chat connections preferred; public profiles only. Missing key = empty or opted out — never “FLOQR doesn’t track that.” Data class: public P fields; Functions Admin SDK read. |
| Public photos | `executeBotSession` returns `media[]` (https image URLs only). Gemini sees `photoCount`, not storage URLs. Client `.botdee-photo-gallery` thumbnails fly out (`.botdee-photo-flyout`) into a frameless `window.open` of `botdee-photo-popout.html` (X + Close; chat stays visible). Popup blocked → status, no covering overlay. |
| Version (s3.3.008 / s3.3.032 / s3.3.034) | Exact aliases **Ver / Vers / Version** (optional `?`) attach a **Version SMARTview** card (`kind: botDeeVersion`) and **no chat-bubble dump** (not package/model/six-phase/mock-integrations text). Longer questions like “what is your version?” still get a short package stamp plus the card. `version history` is not an alias. See **Version SMARTview**. |
| Mobile header (s3.3.008) | `botdee.html`: icon + `.feature-landing-title-row` (title + `?` beside title) + full-width `#botDeeScopeNote` under the row — fixes 1-char vertical scope text and far-right `?`. |
| VIP pay path | `createVipCheckout` reads hold + `loadClubPaymentSettings` → **`clubPos`**: `runConfirmVipReservationForClubPos` (Toast/SpotOn at door; `checkoutUrl:null` + `passHref`); **no deposit**: `runConfirmVipReservationWithoutDeposit`; **`floqrStripe`/`clubStripe`**: `runCreateFloqrCheckoutSession` → `checkoutUrl`. Same branching as `vip-terms-app.js` — never hardcode Stripe. |
| Secrets | `GEMINI_API_KEY` + `STRIPE_SECRET_KEY` (Stripe collectors only); local `contextualSearch` fallback if Gemini missing/fails |
| Gate | `assertFeatureAccess(..., "botDee")` on session; packaged seed `botDee` **Beta** (alias `floqAi`) (`IsFeatureEnabled:1`, `IsTestFeature:1`); product tools re-assert `shoutOut` / `vipReservations` / `floqCast` |
| Tests | `functions/bot-dee-core.test.js`, `functions/botdee-page.test.js` (durable thread helpers + `getBotDeeThread` wiring), `functions/botdee-upgrade.test.js` (six-phase gates, mock-only providers), `functions/botdee-recall.test.js` (idle retrieve, Mykonos synthetic, discussed vs booked) |
| Headless VIP reserV (s3.3.046 / s3.3.055) | `"book a table"` / `"hold a table at Aurelia"` / `"do a reservation"` / `"I want a reservation"` is **execute**, not Gemini (typos like “visit reservation” still match `reservation`). `isVipExecutePrompt` + `tryHeadlessVip` run **before** Room confirm and Gemini; VIP failures stay headless. Patron copy uses `clubDisplayName` (**Aurelia**). Dock `#botDeeVipPreviewDock` has a **night rail**, **2D area map** (`mapLiteForClub` from `vip-plans/*.json`; crop via `.botdee-vip-map-stage`, not CSS `background-position`), table hotspots, party stepper, **Hold it** / **I agree**. Changing night/area/table **drops** `holdId` and releases the prior hold. **cancel** calls `releaseVipHold` and returns `mode: "cancelled"` so the client unmounts `#botDeeVipPreviewDock` (empty `smartViews` left Hold it / I agree mounted). Full pinch-zoom plan stays `vip.html`. Help: `help-botdee-headless-vip`. Functions deploy: `[firebase-deploy] [firebase-deploy-botdee]`. |
| Help | `help-botdee-page` (BOT DEE chat + Enter/Shift+Enter + chatable mood); `help-botdee-privacy-session` (pause vs saved history, keyboard, name/demeanor on My BOT DEE). Type **help** or **privacy** — no `?` on `botdee.html`. `help-botdee-headless-vip`. |
| Search Settings tile | `#settingsBtnCard` → `patron-portal.html?tab=appearance` (opens Appearance); chrome icons `settings-*` via `data-floqr-chrome-icon="settings"` |
| Search icon order | **1 ShoutOut · 2 BOT DEE · 3 VIP reserV · 4 Settings · 5 floqCast** (`index.html` `.search-icon-row`; tile label `cat.botdee` = **BOT DEE**) |
| BOT DEE verbiage (s3.2.60+) | Patron-facing chat/Search/help say **BOT DEE** (never FloqAi). Catalog key `botDee` with one-release dual-read from `floqAi`. Page file is `botdee.html`. Legacy `floqai.html` removed (s3.2.75). See `design-notes-botdee-rename.mdc`. |
| BOT DEE welcome (s3.2.65) | `botdee.chatWelcome` = **Hi, I am BOT DEE. How can I help you?** (all langs). |
| BOT DEE bubble chrome (s3.2.66–67) | Bot replies: CSS speech-origin tip (`.botdee-bubble-tail`) + **robot-head** avatar `images/botdee-chat-avatar.png` (s3.2.67 — not Site-chrome pack JPG). Header mark stays `data-floqr-chrome-icon="botDee"`. |
| BOT DEE club names | Tools resolve display names → slugs (`Aurelia` → `temp-democlub-1`) via `resolveClubLocationId` in `bot-dee-tools.js` before Firestore lookup. |
| BOT DEE Gemini (s3.2.67) | `executeBotSession` toolConfig = `FunctionCallingConfigMode.AUTO` **without** `allowedFunctionNames` (AUTO+names → Gemini 400 → silent `contextualSearch` fallback). Identity prompts (`isIdentityPrompt` / name pronunciation) answer locally. Help `?` panels: `fitHelpPopoutInViewport` in `helper-popouts.js` + `styles.css` `data-help-align`. |
| Privilege leak guard | Server still uses authz (`assertFeatureAccess`, `isMasterAdmin`, classification routing, Version SMARTview). **Gemini never sees this viewer’s privilege:** no `Viewer classification role`, no `isMasterAdmin` / claims / SOS2FA / beta-tester / Club Admin status in system instruction, tool JSON, memories, or last-12 turns. Master Admin–only help is grounded as **patron**. Hard instruction: refuse “am I a Master Admin?” with `botdee.privilegeRefuse` (“I don't have account-security details.”) — no confirm/deny. Post-filter `redactPrivilegeReply` replaces **first-person / viewer** leaks (“you are a Master Admin”, “I can see you as Master Admin”, this user’s SOS2FA/claims) with the same refusal; product glossary that names Master Admin / beta tester as FLOQR jobs (help-beta-booking-disclaimer, ads, Features & Services) stays. `"I can see you as wanting to throw a ShoutOut"` is **not** a leak (role required after `as`). Stripped empty blurbs keep `""` so `formatSearchFallback` never prints `undefined`. Session logs omit `role` / claims / allowedFeatures. Public display name, demeanor, `who am I` → `lookupPublicProfiles` stay. Module `functions/botdee-privilege-guard.js`. Tests `functions/botdee-privilege-guard.test.js`. No privilege text in logs. |
| FloqCast Go live CTA (s3.2.59) | Venue button + sticky: **Go live, start a cast** (`page.floqcast.goLiveCta` / `floqcast-search.js`). |
| Black & Dark Green icons (s3.2.58) | `BLACK_DARK_GREEN_ICONS` full pack (`*-blackdarkgreen.*`) — accent = Settings wordmark \"tings\" **`#5ac783`** (+ companion `#2e8a5a`). Build: `scripts/build-blackdarkgreen-icons.py`. CSS `html[data-floqr-chrome=blackDarkGreen] --accent:#5ac783`. |
| Profile chip chrome | Dark schemes: charcoal / accent face (`--floqr-profile-card-*`). **White/Black:** white face + shiny black initials — never list `whiteBlack` in the shared charcoal `.user-menu-btn` rule (`styles.css`). |
| Page title size | Shared schema: `.floqr-page-title` / `.floqr-page-title-row` + feature `.feature-landing-title-row`. Size = Appearance `h2` via `--floqr-page-title-size` (= `--floqr-title-size`). All title text (`.help-label-text`) inherits; `?` stays 11px badge. Profile & Settings one line (`admin.css` / `floqr-feature-landing.css`). |

---

## BOT DEE six-phase upgrade (spec v1.2)

**Purpose:** Upgrade existing `executeBotSession` with durable execution, opt-in archive, schema-driven SMARTviews, mock research, and mock actions. Third-party APIs stay `mock_only`. Later-fill slots hold enabled/secret **names**/evidence/expiry so keys can be added later without a new product path. **No live vendor HTTP** until a later Functions change.

| Layer | Wiring |
|---|---|
| UI | `botdee.html` — **chat + first-use overlay** (transcript + composer; no standing Settings button). First visit opens `#botDeePersonalizationDialog`. **My BOT DEE** = `patron-portal.html?tab=feature-orders&sub=botdee#portalFeatureOrders` → pane `#foBotDeePane`: standing name/tone form + saved chats & memories (`botdee-upgrade-ui.js`) + **What BOT DEE knows of me** (`loadKnows`) + **View my SMARTview** (`loadMySmartView` → `getPeopleSmartView` into `#botDeeSmartViewDemo` bubble). Master Admin → Features Mgmt → **BOT DEE**: `#botDeeMgmtSubtabs` always shows four tab buttons; `master-feature-services.js` `showBotDeeMgmtPage` toggles only `.botdee-mgmt-page` cards (Conversation Pause, Version & Legal Gates, **SMARTviews** mock host `#botDeeMasterSmartViewDemo`, **SMARTpreview** mock host `#botDeeMasterSmartPreviewDemo`). Deep links: `#featuresBotDee-smartviews`, `#botDeeMasterSmartViewDemo` → SMARTviews subtab; `#featuresBotDee-smartpreview`, `#botDeeMasterSmartPreviewDemo` → ShoutOut SMARTpreview subtab. Save buttons use `app.save`. No `?` on chat. Satellite `FLOQRSessionShell`. SMARTview action links resolve in `botdee-smartview.js` (`resolveSameOriginHref`) — venue `./club-profile.html?location=` (no `?v=`); profile `./patron-portal.html?tab=profile`; images `./images/chrome/` (asset `?v=` only). Callable fallback `botdee-smartview-mock.json` is **Master Admin only** for People/venue cards; ShoutOut SMARTpreview mocks are `botdee-smartpreview-mock.json` (Master Admin only — core never imports them). |
| Client | `bot-dee-chat.js` restores `archiveTurns` after idle when opted in; mounts `smartViews`. Version prompts include deployed / changed / limitations / integrations. `FLOQRBotDeeAccess.requireUsage` + `getBotDeeThread` / `getBotDeeConsent` / `getBotDeeAccess` check `hasUsedBotDee` **before** serving chat chrome (`floqr-feature-services.js` `guardPage` for `botDee`). `botdee-photo-popout.html` is a public photo viewer (no usage gate). |
| Backend | Same `executeBotSession` path. User turn persisted **before** Gemini. Archive under `botDeeThreads/{uid}/archive` (survives 300s idle). Checkpoints `botDeeExecutions`. Callables: `getBotDeeCapabilityManifest`, `get/setBotDeeConsent`, `list/upsert/deleteBotDeeMemory`, `exportBotDeeData`, `deleteBotDeeArchive`, `listBotDeeSmartViews`, People SMARTview v2 (`getPeopleSmartView`, `saveSmartSummary`, `queuePeopleSmartViewAnalysis`, `processSmartViewTranslationJob`, `onUserProfileSmartViewWrite`, `onSmartViewTranslationJobCreated`), `submitBotDeeEvidenceFeedback`, `disputeBotDeeIdentityMatch`, `get/setBotDeeLegalGate`, `getBotDeeProviderSlots` / `listBotDeeProviderSlots` / `setBotDeeProviderSlot`. Master Admin UI prefers `listBotDeeProviderSlots` (fresh Gen2 create) because `getBotDeeProviderSlots` can sit IAM-private after a cancelled first create. |
| Manifest | `functions/botdee-upgrade-manifest.js` — `deployedClaim: false`; never leaks secrets; Master Admin version reply lists implemented/tested/not-deployed. |
| Data | Classified: `botDeeThreads/archive\|memories\|research\|summaries\|executions`, `botDeeExecutions`, `botDeeFeedback`, `botDeeLegalGates`, `botDeeProviderSlots`, `botDeeCapabilityManifest`, `usercharacter_analysis/{uid}`, `smartViewTranslationJobs`, `botDeeSmartViewDiagnostics`. **`botDeeThreads/{uid}.hasUsedBotDee`** integer **0\|1** (never boolean): 0 = never used BOT DEE (first attempt / first-time Settings); 1 = has used. Functions-write on the existing thread/consent doc. Written `1` on first successful `persistUserTurn` / `executeBotSession` (and `markHasUsedBotDee` when durable threads are off). Fail-closed read → 0. **No stored IP.** Mingl `messages` never imported. Slots store `enabled` 0\|1, `secretName`, `legalEvidenceRef`, `expiresAtMs`, `billingAccountRef` — **never secret values**. |
| Legal / slots | Master Admin → Features Mgmt → BOT DEE. `setBotDeeLegalGate` and `setBotDeeProviderSlot` need SOS2FA + `FLOQRReasonPrompt`. Runtime mock unless `enabled=1` **and** named Firebase secret present **and** `legalEvidenceRef` set **and** not expired. Even then adapters do not call vendors. Ticketmaster is two slots: Discovery vs Partner. |
| Secrets | Accounts profile account `botDeeProviders` (`scripts/seed-accounts-profile.js`). Names: `BOTDEE_GOOGLE_PLACES_API_KEY`, `BOTDEE_GEMINI_GROUNDING_API_KEY`, `BOTDEE_YELP_API_KEY`, `BOTDEE_TICKETMASTER_DISCOVERY_API_KEY`, `BOTDEE_TICKETMASTER_PARTNER_API_KEY`, `BOTDEE_EVENTBRITE_API_KEY`. `readByCodeToday: false`. |
| Help | `help-botdee-memory`, `help-botdee-smartview`, `help-botdee-smartview-edit`, `help-botdee-smartview-translation`, `help-botdee-smartview-privacy`, `help-botdee-smartview-media`, `help-botdee-smartview-categories`, `help-botdee-smartview-chrome`, `help-botdee-smartview-review`, `help-botdee-smartview-troubleshoot`, `help-botdee-version-smartview`, `help-botdee-version-smartview-status`, `help-botdee-version-smartview-tabs`, `help-botdee-room-smartview`, `help-botdee-room-smartview-invite`, `help-botdee-room-smartview-join`, `help-botdee-room-smartview-end`, `help-botdee-room-smartview-tab`, `help-botdee-room-smartview-who-pays`, `help-botdee-room-smartview-kick`, `help-botdee-room-smartview-share`, `help-botdee-research-library`, `help-botdee-explain`, `help-botdee-privacy-assistant`, `help-bot-dee-mgmt` |
| Gate | Feature key `botDee`. |
| Docs | `docs/BOT-DEE-SIX-PHASE.md`, `docs/BOT-DEE-LEGAL-PROVIDER-GATE.md`, `docs/BOT-DEE-SMARTVIEW-V2.md` |

---

## People SMARTview v2 (s3.3.028)

**Purpose:** Inline People SMARTview inside BOT DEE chat (not a second profile page). Owner-authored **SMARTsummary** + async translation queue. The patron’s default UI language is the source locale (Gemini drafts and owner edits in that language). Save fans out to every other locale, including English. Compact hero + Photos/Videos overlay use the same `users.profileMediaSlots` as the FLOQR public page. Black Tiffany pack is illustration only — production inherits the viewing patron’s Site Chrome. No live Places/Yelp. Chat shell unchanged.

| Layer | Wiring |
|---|---|
| UI | People card in BOT DEE bubble (`bot-dee-chat.js` `appendBubble` → `FLOQRBotDeeSmartView.mount`) and **View my SMARTview** share one stacked layout (s3.3.039): (1) full-width public photo, (2) name + FLOQR handle on one row, (3) compact inline SMARTsummary (no min-height padded box; height = wrapped text), then compacted Bio / Location / Looking to meet / Socials `dl` (empty rows omitted) + Social / Dating / Dining / Future Travels + View Full Profile / Mingl. **s3.3.046:** the bordered details box (Music / Nightlife chips + genre tags) is flex, `max-height: none`, empty tags/notes hidden — no reserved spacer bands above/between/below chips. Overlays: photos/videos + SMARTsummary; X/Escape restores chat scroll + unsent draft. **My BOT DEE** (`#botDeeSmartViewPanel`): **View my SMARTview** + adjacent **Edit my SMARTsummary** (`.botdee-sv-mine-actions` nowrap only — Saved chats still wrap). `#botDeeSmartViewDemo` bubble auto-loads `getPeopleSmartView` with the viewer’s `uiLanguage`. Load failures use `botdee.sv.loadError` unless `functions/unauthenticated` (`botdee.sv.saveOffline`); a loaded card is not replaced. Master Admin → Features Mgmt → BOT DEE → **SMARTviews** (`#featuresBotDee-smartviews` / `#botDeeMasterSmartViewDemo`) is the mock catalog host (`Show mock SMARTviews`). Compact hero + Photos/Videos overlay use the same `users.profileMediaSlots` order as the FLOQR public page (`mediaSlotDefaults`: 8 photos + 2 videos). Missing slot 0 may fall back to `photoURL`; an empty stored slot 0 is skipped when later slots are filled. The first filled item is the compact hero, including video. Overlay keeps the Photos/Videos tab that matches that hero. |
| Client | `botdee-smartview.js` + `botdee-smartview.css` (tokens `--accent` `--hot` `--text` `--muted` `--floqr-ink`; no hardcoded Black Tiffany). Kind `patron` (not `person`). People payload in `floqrPublicData.peopleV2`. Chrome keys `botdee.sv.*`. Brand spelling **SMARTview** (never translate). Product term **SMARTsummary** (never translate). |
| Backend | `functions/botdee-smartview-v2-core.js` `publicPageMedia` + `functions/botdee-smartview-v2-functions.js`. `getPeopleSmartView` never calls Gemini; viewer locale is the **viewer’s** `uiLanguage` (request, then viewer profile — never the subject’s language). It copies `profileMediaSlots` (and Auth/legacy photo fallbacks) onto the People payload — not `photoURL` alone. `sourceLocale` = subject `uiLanguage`. Gemini analysis prompt writes SMARTsummary in that language; the deterministic draft (Gemini slow/unconfigured) is also in language B. Owner editor loads `editText` in profile language B, never a viewer translation. `saveSmartSummary` stamps `translations.{B}` as source, rejects a ready translation as the new source, and queues `smartViewTranslationJobs` for **every other locale, including `en`**. Profile writes `onUserProfileSmartViewWrite` draft Gemini unless owner-authored (conflict → review flag). New revision persist is `{merge:false}` **only** for that source write (stamped `translations.B` included). Fan-out persist is a **transactional `translations.{locale}` update** (sibling locales and a newer `saveSmartSummary` are not replaced). `onSmartViewTranslationJobCreated` is **onWrite** (export name kept): create, re-queued retries (`attempts++`), and regenerated overwrites with a new `sourceHash` all run. Job ids `{uid}_{revision}_{locale}_{sourceHash16}` so an in-flight translate cannot `cancelled_stale` the replacement. Paint uses **live** `categoriesFromSnapshot(snap)` so hidden fields / dating-off do not stick from frozen analysis. Persist also stamps `publicWithinFloqr` for SMARTcard live listeners. |
| Data | `usercharacter_analysis/{uid}` (`sourceText` + `sourceLocale` + `translations.{locale}`; Functions-write; owner read own; signed-in viewers may read when `publicWithinFloqr==1` and not blocked). English is a target locale unless the patron’s default is EN. `smartViewTranslationJobs/{jobId}` (uid/revision/hash/status; owner read own). `botDeeSmartViewDiagnostics` (Master Admin read; token counts, no summary text). Public-page media: `users.profileMediaSlots` only (plus `photoURL` when slot 0 is missing — same as public profile). Do not append `publicPhotos` / `galleryUrls` / `publicGallery`. Filter public-within-FLOQR fields before analysis and on read. Dating only with `lookingToMeet` + `publicMinglDatapoints` meet. **No stored IP.** |
| URL / contract | Chat: `botdee.html` (satellite, `data-floqr-feature="botDee"`). Portal edit: `patron-portal.html?tab=feature-orders&sub=botdee`. Master mock: `master-admin.html#featuresBotDee-smartviews`. Asset `./images/smartview/amara-mock.png` (`?v=` on assets only). Display boards never get `?v=`. |
| Security | Callables require signed-in + `assertFeatureAccess(botDee)`. Blocks via `userBlocks`. Firestore write `if false` on analysis/jobs/diagnostics. Gemini + translation secrets stay in Functions. |
| Observability | Diagnostics rows in `botDeeSmartViewDiagnostics` (usageMetadata token counts; `summaryTextLogged: false`). Manual Feature Tests `s3-3-028-people-smartview-v2`, `s3-3-031-smartsummary-locale-source`, `s3-3-031-smartview-public-media`. |
| Help | Patron ids listed in the six-phase Help row. Mock vs live called out. Photos/videos help matches public-page Profile Media. |
| Deploy | Live **s3.3.032** Pages + BOT DEE Functions (`getPeopleSmartView`, `searchPeopleSmartCards`, `executeBotSession`). Hard-refresh until `floqr-i18n.js?v=s3.3.032`. |

---

## People SMARTcard v6

**Purpose:** Compact People cards in BOT DEE chat for multi-match people search. Same authorized public profile + `usercharacter_analysis` as People SmartView — no second summary store. Deterministic eligibility; Gemini never decides existence. No Gemini on card view. Viewer Site Chrome only.

**s3.3.054 — Identity-only people search + compact picker:** `scorePerson` / `lookupPublicProfiles` (kind user) match **only** first name, last name, display name, FloqR / Mingl handle, and stored social handles (Instagram, TikTok, X, Facebook). Bios, likes, drinks, genres, SMARTview tags, and “Don Julio” in copy never score. Compact multi-match cards: photo, then name+handle tight, then bio — no empty band under the photo. Client `searchPeopleSmartCards` does not haystack bios. Exclusive self (`me` / `who am I` / `my profile`) is the only path that skips the public directory — a shared first name (`Who is Don` while signed in as Don) still lists other public Dons. Friend prompts (`my friend Don`) stay on connections and never inject the signed-in namesake.

**s3.3.040 — People alias match:** lookups match first+last, display name, squeezed display name (`DonPapi`), and handle with or without `@`. Follow-ups **What about …** / **How about …** stay on the People card (not Gemini prose + photo grid). Accented names and curly apostrophes fold before classify/score. `lookupPublicProfiles` scores identity aliases; `runPeopleSearch` does not skip the viewer when the needle is their own alias. Privilege strip unchanged.

**s3.3.039 — People card layout:** chat People cards and People SMARTview match: full-width photo first, name + handle, compact SMARTsummary, compacted facts. `peopleV2` now carries `bio` + `lookingToMeet` (gated by dating opt-in) so empty rows take no height. Compact multi-match cards use the same stacked header (`.botdee-sc-thumb` stays full-width). Chrome keys `botdee.sv.bio` / `location` / `lookingToMeet` / `socials` / `instagram` / `xNetwork`.

**s3.3.038 — People lookup in chat:** prompts like **What do you know of don banyong**, **tell me about {name}**, **what can you tell me about @handle**, and **Who is …** skip Gemini markdown dumps (`**Bio**` / Location / Details). Know-of / tell-me-about / describe require `isPersonNameNeedle` (so **tell me about group reservations** / **how to book VIP** stay Gemini/help). A trailing **profile** is a lookup only with a person-name needle (`don banyong's profile`), not **how do I edit my profile**. `executeBotSession` classifies first, `attachPeopleSearch` resolves via `lookupPublicProfiles` / public directory, and the transcript mounts a People SMARTview card (`botdee-sv-people`). One match = full card (name, handle, bio/SMARTsummary, location, looking-to-meet on Dating, socials). Many matches = compact cards. No match = short `botdee.sc.none` text, not a help-card dump. `peopleSearch` is returned on the session. Privilege keys (Master Admin / SOS2FA / claims) are stripped from the card payload. Chat `stripPeopleFieldDump` runs only when people intent is not `none`; a bold word plus Location/Instagram is not a dump. Chat also calls `searchPeopleSmartCards` with a canonical `Who is {name}?` when an older Functions deploy still answers in markdown.

| Layer | Wiring |
|---|---|
| UI | Compact cards (`botdee-smartview.js` `renderCompactPeopleCard`) use the same stacked header as full SMARTview: full-width photo, name + handle, compact SMARTsummary (4-line clamp on compact only). Tap → `getPeopleSmartView({subjectUid})` full SmartView in the same bubble. Live `onSnapshot` on `usercharacter_analysis/{uid}` then refetch callable (does not remount the host). Initial listen deny (unstamped / mock) keeps the search-authorized card. Missing analysis does not remove an owner SmartView — `getPeopleSmartView` decides. After a successful listen, hide/block refetches or removes. Full SmartView articles carry `data-subject-uid`; live patches never insert a new uid. Also listen to `userBlocks/{sortedPair}` so a block hides an open card. Pagination via `searchPeopleSmartCards` page. Chat: `bot-dee-chat.js` localizes `peopleSearch.replyKey`, classifies know-of prompts, and suppresses markdown field dumps when a People card is attached. |
| Client | `botdee-smartview.js` + `.botdee-sc-*` in `botdee-smartview.css` (tokens `--accent` `--text` `--muted`; never hardcoded Black Tiffany). Chrome keys `botdee.sc.*`. Feature key `botDee`. `bot-dee-chat.js` `classifyPeopleSearchIntent` / `ensurePeopleSmartViews` (keep in sync with `botdee-smartcard-core.js`). |
| Backend | `functions/botdee-smartcard-core.js` + `functions/botdee-smartcard-functions.js`. `executeBotSession` `attachPeopleSearch` before Gemini; people intents never fall through to a markdown Gemini dump. Callable `searchPeopleSmartCards`. Intent: self / person / empty (generic “this person”) / none. Know-of / tell-me-about person names are `person` (VIP / ShoutOut / BOT DEE / FloqR stay `none`). **People scoring** (`functions/bot-dee-tools.js` `scoreIdentity` / `scorePerson`): identity keys only — never `userHaystack` bios/likes. One match = full SmartView; many = compact cards; none/private/blocked = generic no-result (no name leak). Views pass `stripPrivilegeFromToolResult`. `loadAuthorizedPeopleView` and `getPeopleSmartView` both call `applyPublicPageMedia` so compact cards and full SMARTview use `users.profileMediaSlots` (not Auth `photoURL` alone). `getPeopleSmartView` private non-owner returns empty `views` (`hidden: true`). `persistAnalysis` / owner save stamp `publicWithinFloqr` + `summary_source`. |
| Data | Same `usercharacter_analysis/{uid}`. Discoverability stamp `publicWithinFloqr` 0\|1. Provenance `summary_source` `patron_edit`\|`gemini`. Diagnostics `people_smartcard_search` (latency, eligible count / mode; **no query text**). **No stored IP.** Public name / handle / bio / location / looking-to-meet / socials only. |
| URL / contract | Chat `botdee.html`. Subject selection by uid, not name. Display boards never get `?v=`. Asset `?v=` stays the current package (`s3.3.054`); bump script re-stamps on publish. |
| Security | Signed-in + `assertFeatureAccess(botDee)`. Firestore: owner or (`publicWithinFloqr==1` and not blocked). Functions-write. Blocks via sorted `userBlocks` pair id. Card JSON must not include `isMasterAdmin` / SOS2FA / claims. |
| Help | `help-botdee-smartcard`, `help-botdee-smartcard-search`, `help-botdee-smartcard-sync`. |
| Tests | `functions/botdee-smartcard.test.js`, `functions/bot-dee-tools.test.js` (Don vs bio Don Julio), stacked-layout asserts in `functions/botdee-smartview-v2.test.js`. Manual Feature Tests `s3-3-054-people-identity-only`, `s3-3-038-people-lookup-chat-card`, `s3-3-039-people-card-layout`, `s3-3-040-people-alias-match`. |
| Deploy | Needs Pages + Functions (`executeBotSession`, `searchPeopleSmartCards`, `getPeopleSmartView`, analysis persist/trigger) + Firestore rules from `origin/main`. Combined with SMARTsummary locale source fan-out (PR 101). Merged with PR 115 throw-ShoutOut on `s3.3.038`. |

---

## Version SMARTview (s3.3.032 / s3.3.034 / What's New catalog)

**Purpose:** Inline BOT DEE chat card for the exact aliases **Ver / Vers / Version**. Visual layout follows Don’s iPhone rendering (tabs, identity, rows, expander, composer stays in chat). Live numbers are **not** copied from that picture. Distinct from People SMARTview (`botdee.sv.*` / `botdee.sc.*`) and Room SMARTview (`botdee.rs.*`). **s3.3.034:** the card is the only audience-facing answer on those aliases — the six-phase chat dump is removed, not hidden or shortened. Status and AI model rows are **live probe values**, never placeholders. **What's New:** BOT DEE and Gemini notes only (catalogue the features). Master Admin / beta Find patron / Gray Save / Features SMARTview stay off this tab. README keeps the full package list. There is no separate Master Admin What's New surface yet.

| Layer | Wiring |
|---|---|
| UI | Card inside the BOT DEE bubble (`bot-dee-chat.js` `appendBubble` → `FLOQRBotDeeSmartView.mount`). Tabs: Overview, What's New, Help. Technical Details expander. Status pill is **Operational / Degraded / Unavailable** from this request’s probe (`data-status`). Composer and unsent draft stay. **Ver / Vers / Version** paint the card with **no bubble text** (no package / Part 1–6 / mock-integrations dump). AI model row shows the configured Gemini id (never “Not used this turn”). |
| Client | `botdee-smartview.js` `renderVersionCard` / `bindVersionCard` / `localVersionPayload`. What's New prefers `botdee.vs.note.{id}` when that chrome key exists, so the checked-in patron line shows before a Functions deploy. CSS `.botdee-sv-version*` uses Site Chrome tokens (`--accent` `--text` `--muted` `--floqr-ink`). Chrome keys `botdee.vs.*` including `statusOperational` / `statusDegraded`. Frontend package overlay from `FLOQRNav.appVersion` when the payload omits it. Durable-off paints a local card (Degraded if package stamp exists, Functions not in that request) and still shows packaged `gemini-3.6-flash`. Durable-on uses `executeBotSession.smartViews`. Alias replies stay empty. Restore skips empty model turns (no miss copy). |
| Backend | `functions/botdee-version-smartview.js` `buildVersionSmartView` + `probeVersionService`. This request: Functions reachable + `s3.*` package stamp + Gemini key bound → `operational`; Functions + package, no Gemini key → `degraded`; else `unavailable`. `lastCheckAtIso` is always stamped. `model.configuredId` / `sessionModel` = `manifest.textModelId()` (same as `executeBotSession` / `FLOQR_GEMINI_TEXT_MODEL` / `gemini-3.6-flash`). `versionReply` does **not** call `describeForRole`. `persistModelTurn({allowEmpty})` skips empty card-only replies. Raw notes: bundled `functions/botdee-version-changelog.json` (`text` stays the engineer note). **What's New filter:** `functions/botdee-whats-new-catalog.js` `forVersionWhatsNew` (rules at request time — **no live Gemini**). A checked-in `whatsNewText` that is plain patron language and still classifies as BOT DEE/Gemini is what the card shows. Authoring Gemini pass: `scripts/catalog-botdee-whats-new.js --patron` uses `functions/botdee-patron-language.js` and the same `gemini-3.6-flash` model (`FLOQR_GEMINI_TEXT_MODEL`, `GEMINI_API_KEY` from env only). `scripts/check-botdee-patron-language.js` fails if shown What's New or the version-command help still contains internal tokens (unmount, headless, six-phase, night rail, identity-only, compact picker, chat dump, executeBotSession). Privileged diagnostics only when viewer role is `master` (inside the card, not a chat dump). |
| Data | **No new Firestore docs.** Payload is request-scoped on the callable response. Changelog JSON is packaged public release notes (no patron PII, **no stored IP**). People `usercharacter_analysis` and Room `botDeeRoom` untouched. EU patron PII not in this path. |
| URL / contract | `botdee.html` satellite (`data-floqr-feature="botDee"`). Display boards never get `?v=`. Asset cache-bust `s3.3.057` on app scripts (`floqr-i18n.js`, `floqr-i18n-help.js`, `botdee-smartview.js`). |
| Security | Same `assertFeatureAccess(botDee)` as chat. Privileged block is omitted unless `resolveViewerRole` is `master`. Client cannot mint Master diagnostics. Catalog rules fail closed for unknown product notes. Gemini review cannot invent bullets or override hard excludes. |
| Observability | Manual Feature Tests `s3-3-034-version-card-only`, `botdee-whats-new-catalog`. |
| Help | `help-botdee-version-smartview`, `help-botdee-version-smartview-status`, `help-botdee-version-smartview-tabs`. BOT DEE intent `help-botdee-version-smartview`. |
| Deploy | Pages + Functions both needed so the empty alias reply, live probe, and model id match. Merge to `origin/main` then publish Pages + Functions from the `origin/main` archive (`[firebase-deploy] [firebase-deploy-botdee]`). |

---

## Room SMARTview + Mingl session invites (s3.3.033 / join s3.3.046 / Mingl invites s3.3.050 / invite chips s3.3.070 / schedule s3.3.071)

**Purpose:** BOT DEE recognizes Room SMARTview intents and opens an inline **Room SMARTview** card. Official name is **Room SMARTview** (never “Mingl Room SmartView”). **s3.3.051:** Natural Cancun trip phrasing (Let’s plan our Cancun trip, Let’s plan a trip to Cancun, plan a Cancun trip, Cancun trip with friends) mounts the same card as **Open Room SMARTview Cancun Trip** — `authorizedTitle` Cancun Trip, travel tags, kit art (`bg-bali` + `st-flight`), mock Ad Travel partner / Fly to Cancun. Not live flight/hotel booking. Nightlife-only asks (VIP tables tonight) stay VIP, not a trip card. **s3.3.050:** Mingl-friends-only session (host plus 7 guests). Guests can invite. Invite tokens are SHA-256 only, bound to `targetUid`, Inbox `type: botDeeRoomInvite` (**Review BOT DEE invite**, not a ShoutOut CTA). Join is **not** a payment. Shared tab is a later opt-in + FloqR Stripe (`orderType: botDeeRoomTab`). **s3.3.070:** Invite chips say That’s you / Already in this session. **s3.3.071:** **Join Now** vs **Set a schedule**. Schedule is the only path that sets `smartNotification: 1` and paints Search SMARTnotification for host + invitees. Join Now stays `smartNotification: 0`. TTL (`ROOM_TTL_MS` 4h) starts at **live open**. Last-logout close is additive (every remaining member gone or presence older than 15 min). Beta gates: `botDee` on chat, `mingl` on invite/join/create/tab/schedule. Distinct from Version SMARTview and People SMARTview.

| Layer | Wiring |
|---|---|
| UI | Card in the BOT DEE bubble (`bot-dee-chat.js` → `FLOQRBotDeeSmartView.mount`). Invite picker is Mingl friends only (chips: That’s you / Already in this session). Participants cap 8, itinerary / tab / members (host **Remove**) / Invite / End. Setup row is **Join Now** or **Set a schedule** (datetime sheet). `?room=&t=` (legacy `?join=`) stripped after capture. Failed invite tokens do **not** post “I joined”. Satellite `FLOQRSessionShell` on `botdee.html`. |
| Client | `botdee-room-smartview.js` (UMD, byte-identical to Functions). Classifier `isCancunTripAsk` treats close Cancun trip phrasing as explicit setup (same as Open Room SMARTview). `authorizedFromUtterance` canonicalizes those to title **Cancun Trip**. `botdee-smartview.js` `renderRoomCard` / `bindRoomCard` (`startBotDeeRoom`, `scheduleBotDeeRoom`, `rescheduleBotDeeRoom`, `rsvpBotDeeRoomInvite`, `touchBotDeeRoomPresence`, `listBotDeeRoomFriends`, `createBotDeeRoomInvite`, `kickBotDeeRoomMember`, `optInBotDeeRoomTab`, `endBotDeeRoom`). Invite chips pass `roomId`, mark `inviteState` `self` / `already_member` / `invite`. `data-rs-room` is stamped from `stored.joinedRoomId` on later cards. Chrome `botdee.rs.*` + `botdee.room.*`. Inbox `inboxLinkLabel` → Review BOT DEE invite. Search `smartvisuals-view.js` `listBotDeeRoomNotifications` + Join Now → `FLOQRNav` `botdee.html?room=` (never `mingl-chat.html`). Shared Itinerary is night-out notes; Set a schedule is the room clock. |
| Backend | Classifier `functions/botdee-room-smartview.js` (`isCancunTripAsk` / nightlife veto). Live I/O `functions/botdee-session-store.js` + thin `botdee-room-live.js` (`joinRoom` = `acceptInvite`; `kickMember` / `resolveKickTarget`; `inviteNamedGuests`). `createInvite` uses `classifyInviteTarget` (`self` / `already_member`) before friend-gate — not `used`. `listBotDeeRoomFriends` returns decorated chips + `roomFull`. `acceptInvite` reads room+invite **inside** the transaction (`admitMember`); scheduled accept records RSVP without burning TTL. Host block is checked on guest invites. Callables in `functions/botdee-session-functions.js` (`scheduleBotDeeRoom` / `startBotDeeRoom` / `rescheduleBotDeeRoom` / `touchBotDeeRoomPresence` / `listBotDeeRoomNotifications` / `rsvpBotDeeRoomInvite` / invite / kick / end / tab). Sweeper `expireBotDeeRooms` every 15 min UTC (`ttl` + `last_logout`). Tab accept/void is assignee (or host void) only. `executeBotSession` attach Room SMARTview **before** Gemini / contextualSearch so Cancun trip talk does not pitch VIP/ShoutOut/floqCast; named **invite Don** uses `inviteNamedGuests`. Checkout `createFloqrCheckoutSession` `botDeeRoomTab` as paying uid; `last4` on payer receipt only. |
| Data | `botDeeRooms` + `turns`/`events` (member-read). Fields: `status` scheduled\|open\|ended\|expired\|cancelled, `scheduledStartMs`, `scheduledTimeZone`, `liveOpenedAtMs`, `smartNotification` 0\|1, `lastPresenceAtMs`, `closeReason`. `botDeeRoomMembers` (`rsvp`, `lastPresenceAtMs`). `botDeeRoomInvites` (Functions-only, SHA-256). `botDeeRoomTabs` + `lines` (no card last4), `botDeeRoomAudit`, invite/turn throttles. Search list is callable-only — **no public notification collection**. **No IP.** Classification in `data-classification-core.js` job `botDeeSession`. |
| URL / contract | `botdee.html?room=<id>&t=<token>` (no `?v=`). Display boards never get `?v=`. |
| Security | `assertFeatureAccess(botDee)` + `mingl` on session callables and tab checkout. Token bound to `targetUid`; wrong account / expired / revoked / non-friend / **host block** / cap 8 / past schedule refuse. Search notifications invitee-scoped. Kicked uid removed from `memberUids` (cannot read events). Agent probes `actorRole: agent`. |
| Observability | Manual Feature Tests `s3-3-050-botdee-mingl-session-invite`, `s3-3-051-botdee-cancun-trip-natural`, `s3-3-068-botdee-invite-self-member`, `s3-3-071-botdee-room-schedule`. |
| Help | `help-botdee-room-smartview`, `-schedule`, `-invite`, `-join`, `-end`, `-tab`, `-who-pays`, `-kick`, `-share`; `help-smartvisuals-notification`, `help-smartvisuals-room` (11 langs). |
| Deploy | Pages + Functions + Firestore rules `s3.3.071-botdee-room-schedule`. Don merge go-ahead Nov 24 2026. `[firebase-deploy] [firebase-deploy-botdee]` from a clean `origin/main` archive. |

---

## SMARTvisuals (stencils + backgrounds)

**Purpose:** Shared FLOQR visual service for **SMARTnotification**, **Room SMARTview**, and later SMARTviews. Packaged **SMARTstencils** (26) and **SMARTbackgrounds** (34) are original illustrations — not photographs and not official destination marks. Resolver is deterministic; Gemini is **off** on card view. Ads are a reserved labeled slot; **AdSense is never loaded**. Not a Features & Services Search tile (layers on `mingl` + `botDee`). Official spellings: SMARTvisuals, SMARTstencils, SMARTbackgrounds, SMARTview, SMARTpreview, SMARTnotification.

**Verified (not the kit proposal):** published source of truth is git-backed `smartvisuals/registry.json` + `smartvisuals/catalog.json`. Firestore holds unpublished drafts, authorized overrides, a title-hash selection cache (no titles stored), ad policy, and audit. Live Mingl-friends rooms exist on `botdee.html` (`ROOMS_LIVE=true`). Search SMARTnotification is **invitee-scoped** via `listBotDeeRoomNotifications` when a room was **scheduled** (`smartNotification: 1`). Studio **Preview in Search SMARTnotification** keeps `?smartvisualInvite=cancun` (`demo: true`, synthetic Damon). Unsigned Search without that query does **not** fabricate a Damon invite. **s3.3.072:** compact Search card matches the original phone layout (header + thumbnail with TRAVEL/PLANNING + title/blurb + time/participants + View Invitation / Not Now). Cancun art is tropical lagoon + plane (`bg-bali`), not a temple/house. Labeled Ad stays on Room SMARTview, not the compact Search card. Join Now rooms never paint Search. Mock Ad fill is `resolver.selectAd` + `getSmartVisualAdPolicy`; AdSense is never loaded.

| Layer | Wiring |
|---|---|
| UI | Search `#smartvisualNotificationHost` on `index.html` (compact Mingl Room Invitation). Room overlay `#smartvisualRoomHost`. BOT DEE Room SMARTview scenic hero from `authorizedTitle` / `authorizedDescription` on the request-scoped payload (current utterance only). **Place SMARTview** (venue / restaurant / hotel / event / travel / …) is the compact BOT DEE club card — name, 2-line blurb, ratings, public-page CTA, 28px chrome, 28px SMARTstencil, tag chips; SMARTbackground CSS, no photo well. Distinct from People / Room / Features SMARTview. Master Admin tab `#smartvisualStudio` (Library / Create / Tagging / Review / Diagnostics / Ads): **Review / Publish** select a queued draft → Asset detail shows that file → **Publish** (visible after select and on each queued row; SOS2FA + reason, not hidden solely because SOS2FA is locked). **Preview in Place SMARTview** + **Save Place SMARTview assignment** (SMARTstencil + SMARTbackground + tags). Library and Tagging filter by tag. Features SMARTview compact cards show catalog `category` tags and a tag filter (not Room SMARTvisuals). |
| Client | `smartvisuals-resolver.js` (UMD, byte-identical to Functions) including `selectAd` / `adPolicy` / `resolvePlaceCard`. `smartvisuals-view.js` / `.css` — `ensureCatalog()` fetches `./smartvisuals/catalog.json` on every page that loads the module (Search and `botdee.html`), not only when `#smartvisualNotificationHost` exists. Compact Search `renderNotification` is side-by-side thumbnail + copy (no Ad). Room SMARTview banner + BOT DEE `renderAdSlot` keep the labeled mock Ad. Signed-in Search calls `listBotDeeRoomNotifications` and mounts the first real payload (`demo: false`). Join Now → `FLOQRNav.pageUrl("./botdee.html", {room, t})` (never `mingl-chat.html`; no `?v=`). Place cards: `botdee-smartview.js` `renderPlaceCard` + `botdee-smartview.css` `.botdee-sv-place`. `botdee.html` also preloads the catalog. `smartvisuals-studio.js` / `.css` Review reads `smartVisualDrafts.svgXml` via `<img src="data:image/svg+xml">` or raster `imageBase64` as a data URL. Create/Edit **Art upload** accepts SVG + JPEG/PNG/WebP (stencils SVG-only). Draft submit (`publishSmartVisualDraft`), Review **Publish** (`approveSmartVisualDraft`), Place SMARTview assignment (`assignPlaceVisual` → stencil + background + tags), and Studio `classifySmartVisual` go through `studioCallable`: `FLOQRSOS2FA.getSessionId("entityManagement")` (same as Features Mgmt / Entity Management), `getIdToken(true)`, then `sos2faSessionId`. Live s3.3.064 called a non-existent `sessionId()`, so Save always sent an empty session even after SOS2FA unlock. A valid session is reused — no new code request. `#smartvisualStudio` is SOS2FA-gated. Ads tab previews mock fill. |
| Backend | `classifySmartVisual`, `publishSmartVisualDraft` (SOS2FA + `FLOQRReasonPrompt` ≥8 + `sanitizeSmartVisualUpload`; SVG persists `svgXml` + `svgChecksumSha256`; JPEG/PNG/WebP SMARTbackgrounds persist `imageBase64` + `imageChecksumSha256` + `contentType`; queues `approvalStatus: review`), `approveSmartVisualDraft` (SOS2FA + reason; sets `approvalStatus: published`, `catalogAssetId` e.g. Milan → `bg-milan`; Studio overlays Asset detail; git registry still patron truth until Pages), `setSmartVisualOverride` (`roomKey` `placeSmartView:{kind}` or `placeSmartView`; `backgroundId`, `stencilId`, `tags` via `normalizeSmartViewTags`), `getSmartVisualAdPolicy` (extends packaged `resolver.adPolicy()`: `adsEnabled: false`, `adsenseApproved: false`, `mockFill: true`, `emptyWhen` private-chat / prompt-injection). Empty `sos2faSessionId` → `permission-denied` “Entity Management requires a valid SOS2FA session…” (not a WebP reject). `clubSmartView` stamps `floqrPublicData.smartBackgroundId` / `smartStencilId` / `smartTags` from `resolvePlaceCard` then Firestore override (`loadPlaceVisualOverride`). `functions/smartvisuals-svg-sanitize.js`. Gemini `geminiAllowed() === false`. |
| Data | Published: `smartvisuals/{stencils,backgrounds}/*.svg`, `registry.json`, `catalog.json`. Firestore Functions-write: `smartVisualDrafts` (sanitized `svgXml` or raster `imageBase64`; leftover `license` optional, not required on submit; `publishedAtMs` / `publishedByEmail` / `catalogAssetId` after Review Publish), `smartVisualOverrides` (`backgroundId`, `stencilId`, `tags[]`; no IP), `smartVisualSelections` (hash → IDs), `smartVisualAdPolicy`, `smartVisualAuditLogs`. Classification rows in `data-classification-core.js`. No stored client IP. Private BOT DEE chat `sourceKind: private-chat` → `publicNotification: false`. |
| Headless SMARTview | Public `botdee-smartview-headless.html` (`data-floqr-public`). `?mode=headless&q=` paints compact Place/info cards from authorized text via `botdee-smartview-headless.js` `cardsFromAuthorizedText` → `FLOQRBotDeeSmartView.mount` (`renderPlaceCard`). Optional `?tag=` filters the compact card by assigned SMARTview tags. `?mode=interactive` shows a paste box (same cards, still no `executeBotSession`). SPAAVS sample sentence / `ENTITY_RULES` / Load SPAAVS sample removed — that path no longer mints Product SPAAVS, Travel Mobility Hub, Product Autonomous docking equipment, or Vehicle Robotaxi fleet. Generic authorized text still yields one fallback compact card (stamped SMARTbackground / SMARTstencil / tags from the resolver). Not Search, not `features-smartview.html`. Gemini off. No Firestore write. Xibo `display.html` / `display2.html` unchanged (no `?v=`). |
| URL / contract | Demo Search: `./?start=search&smartvisualInvite=cancun`. Headless cards: `./botdee-smartview-headless.html?mode=headless&q=` (`?tag=` optional). Display boards never get `?v=`. Package stamp `s3.3.072`. |
| Security | Default-deny unpublished assets. Prompt-injection / remote URLs in titles → `prompt-injection-ignored` + neutral art. Override of draft IDs rejected. Studio publish needs Master Admin SOS2FA. Raster drafts magic-byte gated (JPEG/PNG/WebP); stencils cannot be raster. Rules: drafts/overrides/audit/adPolicy Master Admin read, write false; selections none. |
| Observability | Manual Feature Tests `s3-3-072-search-smartnotification-match`, `s3-3-038-smartvisuals-search-notification`, `s3-3-038-smartvisuals-studio`, `s3-3-064-smartvisuals-studio-upload`, `s3-3-065-smartvisuals-studio-sos2fa`, `s3-3-063-place-smartview-compact`, `s3-3-063-headless-smartview`, `s3-3-064-headless-smartview-no-spaavs`, `s3-3-066-place-smartview-stencil-tags`, `s3-3-067-smartvisuals-studio-review-publish`. Diagnostics package checks. |
| Help | `help-smartvisuals-notification`, `help-smartvisuals-room` (patron, 11 langs), `help-smartvisuals-studio` (masterAdmin), `help-smartvisuals-create` (Create/Edit `?`, upload types, 11 langs), `help-smartvisuals-place-assign` (Studio Place assignment `?`, masterAdmin). BOT DEE intents on those ids. |
| Deploy | Pages from `origin/main` after Don says merge. Functions `[firebase-deploy] [firebase-deploy-smartvisuals]` (`approveSmartVisualDraft` + existing Studio callables). No AdSense. |

Resume: `@smartvisuals$` / `$smartvisuals$`. Rule: `.cursor/rules/design-notes-smartvisuals.mdc`. Architecture: `docs/FLOQR-TECHNICAL-BIBLE.md` §2.3.

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
| Help / BOT DEE | “VIP table”, “hail waitress”, “table reservation”, “join table party” |

### Test methodology (abbrev.)

1. Pay → pending; Approve → active + ref on receipt.  
2. Cancel → **automatic Stripe refund** + notify; chat closed.  
3. Share ref → friend **Join table party** without waitress accept.  
4. Outside hours → hard block + CSR/on-duty text option; fix hours in VCC and retest open window.  
5. Existing hail auto-attaches ref; New-service hail allowed without prior VIP purchase.

**Manual QA hub (layouts, scheduling, today’s ship):** `feature-tests-v29-09-122.html` on the feature branch — deep links for Shôko Scheduling, birthday layouts, supRstar timer, display IP-or-token, BOT DEE cues.

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
| **Beta & Testing** | Search beside Find patron; select radio; Note + Invite; active/pending lists. Packaged Mingl default is Off; **live `featureServices/mingl` wins** (Master Admin using Mingl as beta means Enable Feature 1 + Enable Beta 1 — checkboxes are not disabled). **Find patron (s3.3.049):** `findBetaPatron` (SOS2FA Master Admin) uses Auth `getUserByEmail` then `users.email` / `floqrHandle` equality — no 120-doc scan. Returns uid/email/handle + active-tester flag; no IP stored; no new collection (`users` / `betaTesters` already classified). Client falls back to `users.where(email ==)` if the callable is not deployed yet. **Tester Save:** `setBetaTesterFeatures` rejects “Nothing changed” **before** the audit-head transaction; UI does not await Audit Trail after Save (that N+1 `users/{uid}` read was the “took forever” hang). |
| **Save busy (s3.3.047)** | `floqr-save-busy.js` greys Save on click and sets **Command received…** when a callable/Firestore write starts. Loaded after `floqr-nav.js`. |
| **Features SMARTview (s3.3.056 / Production s3.3.059)** | Eight products: **BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema, Si-tube** (exact display names; not Room SMARTview, not Version SMARTview, not FloqR cards). Git catalog `features-smartview/catalog.json` (+ Functions copy) is Pages truth. Core `features-smartview-core.js` is byte-identical with `functions/features-smartview-core.js`. Satellite `features-smartview.html` (`FLOQRSessionShell`). Patron badges: **Production** (`IsFeatureEnabled=1`, `IsTestFeature=0`; ShoutOut packaged default), **Testing**, **Beta**, **In development**. Coming Soon is In development only. Live `featureServices` flags preferred. BOT DEE retrieval via `isFeaturesSmartViewPrompt` + `buildSmartView` (citations to `features-smartview.html?feature=`; never treats a plan as shipped). Editorial SOS2FA callables `getFeaturesSmartViewCatalog` / `approveFeaturesSmartViewCopy` / `rollbackFeaturesSmartViewCopy`. Firestore `featuresSmartviewApprovals` / `Drafts` / `AuditLogs` Functions-write. Ingest `scripts/ingest-features-smartview.js` (local `gh`; cache gitignored). Every feature `statusVerified: false`; What's New empty; Si-tube `presentInRepo: false`. Help `help-features-smartview` / `-status` / `-botdee`. |
| **Audit Trail** | Hash-chained activity log + Verify integrity; loads audit only |
| **Legacy deep link** | `#featuresServices` → `#featuresReleaseControl` |
| **Agent audit** | Scripted/agent denials log `actorEmail`/`actorRole` = `agent` (`isAgentClient`) |
| **Standing rule** | `.cursor/rules/feature-data-classification-security.mdc` — classify + harden rules on every feature (like translation) |
| **Load perf** | Sub-tabs lazy-load; Master Admin sign-in no longer scans 1000 users; Network Dashboard loads on demand. **s3.3.010:** sign-in also defers Diagnostics / AI crawl / duplicates / commerce / templates / recs until panel open. **s3.3.013:** those panels paint from `masterAdminRollups/current` (5-min schedule + Refresh rollup); full live scans only on Run/Refresh. |
| **Beta invite consent (s3.1.56 / clean UI s3.1.70)** | `beta-invite.html` + `beta-invite-app.js` — scrollable FloqR Beta Test & Prerelease Agreement; Booking Disclaimer body in `?` (`help-beta-booking-disclaimer`); invite intro in title `?` (`help-beta-tester`); no green “FLOQR Beta” eyebrow / “Signed in…” status. Required `checks.betaAgreement` + `checks.bookingDisclaimer`; success card after join. Server: `acceptBetaInvite` stores `consent` (`BETA_AGREEMENT` v2 — reverse-payments / non-refundable). Profile card via `global-profile-status.js`. |
| **Profile menu fail-closed** | Search `#userDropdown` + `global-profile-status` mint feature links hidden; `FLOQRFeatureServices.applyFeatureLinks` reveals only granted Live/Beta. CSS: `.user-dropdown … .hidden` / `[hidden]` must beat `display:block!important` (also injected in `ensureLinkStyles`). |
| **Profile card close (s3.2.61)** | In-card `.profile-menu-link` / `data-patron-menu` click closes the open card before navigate. `showPage` / `pageshow` / `popstate` / sign-out also close. Toggle refuses empty slim box until menu content is rendered (`menuReady` / `userDropdownHasContent`). |
| **Inbox Recipient autocomplete** | Compose uses `#composeRecipientSearch` only — results appear after 2+ typed characters; empty query never dumps the directory. One Club Admin row (not one per support mailbox). |
| **Inbox-first + New Message FAB (s3.1.58)** | `loadPortal` renders `messages` + `inboxNotifications` before shoutout history / directory scans. Compose sheet `#portalCompose` stays hidden until floating `#inboxNewMessageFab`. Recipient directory: CSR + Club Admin seed first, then `FLOQRPeople.listSafe("contacts")`; Club Admin email local-parts searchable (not displayed). Profile-menu counts skip soft-deleted inbox rows. Follow Service: `listSafe("services")` + token haystack (handle/club/genre) + loading status. Help: `help-floqr-inbox-rules`. |
| **Inbox paint gate (s3.1.59)** | `loadAndRenderInbox(user)` starts immediately after profile bootstrap — **before** `renderTemplateVariantSettings` / BartR / AI prefs (those awaits left Inbox on Loading while menu already showed 5/10). Fast path = `recipientUid` queries (same as profile menu) + 12s timeout; email-scoped rows enrich without blocking first paint. |
| **Read badge nowrap (s3.1.60)** | `.message-envelope-head span` — `white-space:nowrap; flex-shrink:0` so Read/Unread pills do not wrap mid-word next to long subjects on mobile. |
| **Beta invite email handoff (s3.1.61–62)** | Email/private browsers have no Firebase session — landing no longer sticks on Restoring/Checking. `ensureAuth()` initializes Firebase before `auth()`; stashes invite `t` in `FLOQR_BETA_INVITE_TOKEN`; **Sign in to accept this invite** → home OTP with `returnTo` keeping `t`. `createBetaInvite` Inbox `link` is absolute Pages URL. |
| **Profile card on satellites (s3.1.63)** | `global-profile-status.js` calls `initializeApp` before `onAuthStateChanged` so beta-invite (and other satellites) show photo/initials when signed in — not a stuck `?` pill. |
| **Active beta testers table (s3.1.63)** | Master Admin → Features Mgmt → Beta & Testing — compact `.beta-testers-table` (tester + feature columns + Save/Revoke), ≤3 visual lines per user. |
| **BOT DEE Search tile (s3.1.64)** | `#intentSearchBtnCard` uses `.shoutout-icon-card` / black `.botdee-icon-face`, reuses Search `.category-botdee-mark` + `floqr-tiles-transparent.png`, white BOT DEE word beside mark. |
| **Search icon tiles** | `#categoryPage .search-icon-row` order: **ShoutOut → BOT DEE → VIP reserV → Settings → floqCast** (BOT DEE key `botDee`). Chrome photo faces via `data-floqr-chrome-icon` + `FLOQRChromeScheme.ICON_PACK`. Mobile/tablet: 3 across; PC: one line. Display2 idle logo: `images/chrome/floqcast-nightlife.jpg` (`display-app.js` `FLOQCAST_LOGO`). |
| **Search BOT DEE box (s3.2.18)** | No speech bubble. Input placeholder (`cat.botdeePlaceholder`) = “Search for Clubs, Lounge, Events, etc.” (localized). |
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
4. Mirror patterns in `intent-search.js` `PRODUCT_INTENTS` for BOT DEE carpets (keep in sync when adding a product).
5. Tests: `functions/floqr-venue-actions.test.js` — intent → URL, gate deny → fallback, index script order.

**Security (Bible §8.3 / §11):** Query string and CTA are **UX only**. Authorization stays on: feature flags (`searchVisible` / `guardPage`), Firebase Auth + satellite session shell, Firestore rules, money/live callables. Never grant floqCast/VIP from a crafted `?location=` alone.

**Default:** No product cue → Select still starts ShoutOut (historical primary LED product). Explicit `listingType=shoutout` → “Throw ShoutOut Here”.
| **VIP catalog (s3.1.66)** | `vip-app.js` `vipCandidateIds` — only PLAN_BY_ID + `getVipBetaVenues` + static `featureGates.vipReservations===true` (never all ~590 `SHOUTOUT_CLUB_LOCATIONS`). `showApp` clears Restoring / unhides `#vipApp` before `loadSubscribedVenues`. |
| **Beta pill (s3.1.68)** | `.shoutout-icon-card.feature-beta::after` (same yellow pill as `.category-card`) — BOT DEE/floqCast/VIP tiles are shoutout-icon-card, not category-card.
| **Package** | s3.1.80 |

## Beta invite landing (`beta-invite.html`)

| Layer | Wiring |
|---|---|
| Surface | Inbox `type: betaInvite` → absolute `https://…/beta-invite.html?t=…` (account-bound, 7-day expiry); body also includes the URL for email clients |
| UX | Session shell; signed-out → Sign in CTA (not stuck Restoring); clean header (title + `?` only); Agreement scroll; Booking section title + `?` (disclaimer body in popout); two mandatory unchecked checkboxes; **I Agree and join beta** disabled until both; Decline; success acknowledgement card |
| Client | `beta-invite-app.js` stashes/restores `t`, wires `FLOQRSessionShell.loginHref()` returnTo, passes `{token, checks}` to `acceptBetaInvite`; `unlockAgreementUi` clears status (no Signed-in line) |
| Server | `functions/feature-services-functions.js` `createBetaInvite` / `respondToInvite` — absolute invite URL; refuses without both checks; stamps `agreementDocId` / `agreementVersion` / `agreementSha256` (canonical v2 FloqR, reverse-payments refund) |
| Data | `betaInvites/{hash}` + `betaTesters/{uid}.consent` |
| Help / BOT DEE | `help-beta-tester`, `help-beta-booking-disclaimer`; phrases: beta agreement, booking disclaimer, sign in to accept this invite |
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
| **Floor plans** | Static `vip-plans/` (`decades.json`, `lima-twist.json`, `aurelia.json`, `shoko-barcelona.json`) + `functions/vip-beta-catalog.js`. Aurelia 2D published (`aurelia-floor-map.svg` bookable seats neutralized — no baked Available/Booked); 3D walk-through at `reports/vip-aurelia-demo/` (Explore 3D CTA on `vip.html`). **Shôko Barcelona** (`shoko-barcelona-spain`): NYE'27 map + pricing. Rebuild: `plan-svg.mjs` `neutralBookable: true` for Pages background art |
| **Night-scoped prices** | `vip-beta-catalog` / plan JSON `nightPricing[YYYY-MM-DD].sections[sectionId]` → `computePartyAmounts(..., {nightOverride})`. `extraNights` merge into `getVipAvailability` bookable nights (NYE beyond rolling horizon). Checkout uses `hold.amounts.currency` (EUR for Shôko). **Shôko:** standard (regular) minimum = NYE list ÷ 4; regular deposit = 25% of standard; NYE minimum = flyer list; NYE deposit = 50% of NYE list. |
| **POS (future)** | Research/design only: `reports/vip-pos-integrations.md` — top 4 Toast, Square, SpotOn, Clover; Generic CSV/manual fallback. Not built. |
| **Product chrome** | Same pink/cyan body + glass cards as ShoutOut — `styles.css` + scoped `vip-floor-viewer.css` (never global `:root`/`body` flat black). Rule: `.cursor/rules/design-notes-product-chrome.mdc` |
| **Session** | `floqr-session-shell.js` after `firebase-config.js` on `vip.html` / `vip-terms.html` / `vip-door.html`. Do not await a full clubLocations scan before clearing Restoring (see s3.1.66 `vipCandidateIds`). |
| **Callables** | `functions/vip-functions.js` — `getVipBetaVenues`, `getVipAvailability`, `createVipHold`, `releaseVipHold`, `recordVipConsent` (single Terms check + expand), `getMyVipReservations`, `getVipReservationPass`, `listVipReservations`, `checkInVipReservation`, `markVipNoShow`, `getVipClubSettings`, `saveVipClubSettings` (deposit + `refundPolicy`), `setVipSectionBlocked`, `confirmVipReservationWithoutDeposit`, `adminConfirmVipReservation`, `cancelVipReservation` (clears `isBooked`; FloqMedia/Club Stripe `refunds.create` by policy). Checkout: `createFloqrCheckoutSession` `orderType: "vipReservation"` (`holdId` + `consentId`). Fulfillment confirms reservation + `deliverServiceReceipt` Inbox |
| **Paid-before-booked** | Club `clubLocations.vipSettings.depositRequired` (default on when depositCents &gt; 0). Hold → `status:held` + `isReserved:0` only. Floor map `booked` / `isReserved:1` only after Stripe `fulfillVipReservationOrder` (paymentConfirmed=1), or `confirmVipReservationWithoutDeposit` when deposit not required, or Club Admin `adminConfirmVipReservation` with `paymentRecorded` when deposit required, or Club POS confirm (`confirmVipReservationForClubPos`). |
| **Payment collectors (VIP-B-01)** | `clubPos` (preferred for live Toast/SpotOn), `clubStripe`, `floqrStripe`, `manualCsv`. **Club Stripe** is ready when `stripeConnectAccounts` for the club binding has `transfersReady` (Club Admin → Stripe onboarding), not a typed `acct_` on `clubLocations`. **Aurelia demo (`temp-democlub-1`)** defaults to `floqrStripe` (FloqMedia Stripe). Setup help: BOT DEE `help-vip-floqr-stripe-aurelia`. Catalog: `functions/vip-payments-core.js`. Callables: `getVipPaymentCatalog`, `getVipPaymentSettings`, `saveVipPaymentSettings`, `beginVipPosConnect`, `confirmVipPosConnected`, `disconnectVipPos`, `confirmVipReservationForClubPos`, `exportVipReservationsCsv`, `listVipBillingStatements`, `setVipPosProviderEnabled`, `seedVipPosProviders`. |
| **POS providers** | Toast / SpotOn (open tab ★) / Square / Clover / Generic — sandbox flags: Toast, SpotOn, Square, Clover. Live OAuth/webhook adapters activate when partner credentials are deployed; Connect workflow + connection codes ship now. |
| **Club Admin** | `admin.html` → **Feature Mgmt** → **VIP reserV** (`#panelVipReserv`) — collector picker, POS connect (sandbox/live), CSV export, billing list, deposit policy, nights, check-in / cancel / block / walk-in. Help: `help-vip-club-admin`, `help-vip-deposit-settings`, `help-vip-payment-collector`. |
| **Club Admin Feature Mgmt (s3.1.84)** | Parent tab **Feature Mgmt** nests **ShoutOut** (sub: Queue Mgmt → `#panelQueue`, Display Mgmt → `#panelDisplaySecurity`, Template Mgmt → `#panelTemplateBackgrounds`), **FloqCAST** (`#panelFloqCast`, key `floqCast`), **VIP reserV**. Deep links `?tab=` / `#panel*` still activate nested parents. Dashboard Pending ShoutOuts / Pending FloqCAST link those queues when count > 1 (s3.3.017). |
| **Master Admin** | Features Mgmt → VIP reserV Payments (`#featuresVipPayments`) — enable providers, seed catalog, network billing statements. |
| **Per-table Firestore status** | `clubLocations/{clubLocationId}/vipNights/{night}/tables/{tableNumber}` — doc id = printed table number. Fields: `isBooked` (`"1"` / `"0"`), `isBookedYes` (`"yes"` / `"no"`), `status`, `reservationId`. **Booking-status control:** `getVipAvailability` marks a section booked only when `isBooked==="1"` (not legacy `vipInventory.isReserved` alone). Set to booked only after payment completes (Stripe fulfill, no-deposit confirm, Club POS confirm, admin walk-in with payment recorded). Cancel always clears `isBooked` to `"0"`. Rules: public read, Functions-only write. Classified as `clubLocations/vipNights`. |
| **Hold TTL + free table** | Hold datapoints: `vipHolds.expiresAtMs`, `vipInventory.status=held` + `expiresAtMs` (30 min via `HOLD_MS`). **Not booked** while held (`isReserved:0`, `isBooked:"0"`). `expireVipHolds` scheduled every 5 min frees inventory; `getVipAvailability` lazy-expires stale held rows. Client hold banner countdown clears UI at expiry. |
| **Open nights calendar** | Night picker uses `clubLocations.hoursStructured` + `hoursExceptions` (same datapoints as Club Public Profile / Guest List). `getVipAvailability` returns `bookableNights`; `createVipHold` rejects closed nights. Client also filters via `FLOQRVenueCalendar` when structured hours are on the venue row. |
| **Hold UX** | After successful hold, table popout closes and `#vipHoldBanner` (Continue to Terms) scrolls into view; hold errors surface in the popout. |
| **Cancel + refund (s3.1.83)** | Club Admin → VIP reserV Cancel. Always frees inventory + clears `isBooked`. FloqMedia Stripe / Club Stripe: optional Stripe refund (`processRefund`, default on) using `vipSettings.refundPolicy` — club cancel mode `full` (default) / `policy` (hours windows) / `none`. Club POS / CSV: table freed; POS void stays on Toast/SpotOn. UI: refund-on-cancel checkbox + policy hours. |
| **Data** | `vipInventory` (legacy night×section lock), `vipHolds`, `vipActiveHolds`, `vipConsents`, `vipReservations`, `clubLocations.vipSettings`, `clubLocations/.../vipNights/.../tables`, `vipPosConnections`, `vipPosProviders`, `vipPosStatements` (Functions-write) |
| **VIP-B-24** | `receipt-delivery.js` SMS via `sendTwilioMessagesApi`; `secret-redaction.js` protects `FLOQR-…` / `VR-…` invoice numbers |
| **Help / BOT DEE** | `help-vip-book-table`, `help-vip-floor-map`, `help-vip-terms-consent`, `help-vip-door-pass`, `help-vip-door-ops`, `help-vip-receipt-sms-redaction-fixes`; intent `vip-reserv` |
| **Gate** | Master Admin → Features & Services → seed/enable `vipReservations`; beta testers need grant. Venue opt-in: `clubLocations.featureGates.vipReservations` (default **false** in `feature-gates.js` **and** `functions/feature-gate-functions.js`). Entity Management → Save Venue Feature Gates. **s3.2.71 fix:** server `DEFAULT_VENUE_GATES` must include `vipReservations` + `passes` or ticks are stripped on save; refuse saves on merged duplicate club ids (e.g. `shoko-barcelona-beach-club-spain` → use `shoko-barcelona-spain`). Beta seeds: Decades, Lima Twist, Aurelia (`temp-democlub-1`), Shôko Barcelona (`shoko-barcelona-spain`) |
| **Shôko NYE'27 event** | `shared-data.js` event `shoko-nye-2027` (2026-12-31) + flyer `images/events/shoko-barcelona-nye-2027.png`; VIP night prices only for that date |
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

Visible order on Search (`index.html` `.search-icon-row`): **1 ShoutOut** · **2 Mingl** · **3 BOT DEE** · **4 VIP reserV** · **5 Settings** · **6 floqCast** · **7 Si-nema**. `#minglBtnCard` (`data-feature-key="mingl"`, chrome `data-floqr-chrome-icon="mingl"`) stays `hidden` until Features & Services `searchVisible` / `linkState` (test = granted beta tester or Master Admin). **s3.3.052:** test tiles **and** profile avatar / My Profile `data-floqr-feature-link="mingl"` links no longer AND the legacy `platformSettings/patronFeatureGates` kill switch — that uniquely hid Mingl while VIP/Si-nema (empty `patronGate`) showed. Search + `applyFeatureLinks` share `featureLinkAllowed`. Search reads `betaTesters/{signed-in uid}` only; a Mingl tick on a duplicate Lorna Auth account does not unhide the tile or profile Mingl Chat link for the other uid. BartR / RydR stay text cards after the icon row. Mingl face: v3 clean vector `images/chrome/mingl-svg/logos/mingl-color-master.svg` → transparent PNGs + `mingl-*.jpg` chrome tiles (`scripts/build-mingl-v3-logo.py`). Colorless SVG kit remains in `images/chrome/mingl-svg/` for compact / FloqMedia lockups. Resume `@mingl-icon$`.

## Mingl Chat / Gist Site chrome

| Piece | Where |
|---|---|
| **Surfaces** | `mingl-chat.html` (standalone chats), `mingl-gist.html` (stories). Feature key `mingl`. Satellite shell (`FLOQRSessionShell`). |
| **Chrome** | Same contract as BOT DEE / receipts: early-paint `html[data-floqr-chrome]` from `localStorage floqr.isSiteChrome`, then `floqr-chrome-scheme.js` + `floqr-chrome-audit.js`. Hero uses `data-floqr-chrome-icon="mingl"` + `floqr-page-title` (Appearance h2 size). Title **Mingl Chat** is a protected brand (never translated). |
| **Client** | `mingl-chat-app.js` / `mingl-gist-app.js` `hydrateSiteChrome` → `hydrateFromProfile(users/{uid})` after sign-in; `applyDocument` when signed out. Compose / bubbles / menus use `--hot` `--accent` `--floqr-ink` `--line` (`styles.css` + overlay `mingl-chat-chrome.css`). Gist **story viewer** stays a dark overlay. |
| **Data** | Reads existing `users.isSiteChrome` / `uiChrome` only. No new collection. No stored IP. |
| **Diagnostics** | Manual Feature Test `s3-3-046-mingl-chat-site-chrome`. |

## Chrome icon drafts (nightlife / traditional review)

| Piece | Where |
|---|---|
| **Rule / recipe** | `.cursor/rules/icon-chrome-build.mdc` (always) — type, ring layers, sizes, FIX PROMPT |
| **Builder** | `scripts/build-chrome-icons.py` — modular: ring once → graphic layers → type under/over → assemble |
| **Saved layers** | `images/chrome/layers/` — `ring-nightlife.png`, `floqcast-graphic.png`, `djbot-graphic.png`, `vip-graphic.png` (no type; reuse when only type moves) |
| **Review UI** | `icon-review-v4-chrome-compare.html`, `icon-review-square-green-halo.html`, `icon-review-mingl-chrome.html` |
| **FloqCAST** | Image 2 / V4 full mark: `images/chrome/floqcast-nightlife.jpg` (+ traditional / traditional-green). White/Black Search uses `floqcast-whiteblack.png`: **Image-2 geometry** on white (full-width FloqCAST via `place_floqcast_q_kiss`, ring `R=490`, dark ink + Tiffany T + tip halo) — same proportions as Nightlife chrome, WB palette only. Review SVGs: `images/review/floqcast-icon-{nightlife,traditional,whiteblack}.svg`. Search: `data-floqr-chrome-icon="floqCast"` → ICON_PACK (`ICON_V` s3.2.50). Display2 idle: `FLOQCAST_LOGO` → nightlife JPG (no `?v=`). |
| **BOT DEE** | `build_botdee_only()` / `--botdee-only` → `botdee-nightlife.jpg` / `-traditional.jpg` / `-whiteblack.jpg`; Search tile `data-floqr-chrome-icon="botDee"` (`ICON_V` s3.2.13). Centered headphones bot ×1.30 (no turntable / signal tray); stacked thin-border `BOT` (white) / `DEE` (tiffany) ≈ ShoutOut type size. Legacy `streetbot-*` + `floqbot-*` still written. |
| **djBOT** | `images/chrome/floqbot-nightlife.png` + `-spin.gif`; trad `floqbot-traditional*.png` (mirrors BOT DEE face) |
| **VIP reserVIP** | `images/chrome/vip-nightlife.jpg` / `vip-traditional.jpg`; actual `images/review/actual-icons/vip-reserv-actual.png` |
| **Mingl Search chrome (s3.3.042)** | Owner pack `Mingl_Cursor_Logo_White_Teal_Purple_v3` → clean vector `images/chrome/mingl-svg/logos/mingl-color-master.svg` (white glossy people, teal/purple trim, no orbit / no outer square) + `mingl-chrome-monochrome.svg` (`currentColor`). PNG 128/256/512/1024 in `mingl-svg/exports/`. Search tiles `images/chrome/mingl-*.jpg` composite that transparent mark onto Site Chrome squares (`scripts/build-mingl-v3-logo.py`; `build-mingl-chrome-icons.py` delegates). Brand keeps white/teal/purple on dark chromes; White/Black inverts. **Mingl™** is outlined Noto Sans Display Bold Italic: **Min** white, **gl** teal. `ICON_PACK.mingl` (`ICON_V` s3.3.042). `#minglBtnCard` stays hidden until Features & Services. Same CSS inset as peer tiles. Colorless compact kit unchanged (SMARTview). |
| **Layers** | bg → under-ring letters → ring → over-ring letters (Fl/d/reser+V under; T/IP over) |
| **Type** | NotoSansDisplay-Bold, shear 0.286, ×1.10 height; tiffany `(0,212,254)` accents |
| **Placement** | 2D search (left+top); reject any ink with max radial `> R-2`; tips target `R-10` |

## Baller metal cards (`ballersAlert` + Amex twin) — s3.2.91 / s3.2.101

Resume `@baller$`. Design notes: `.cursor/rules/design-notes-baller-cards.mdc`. Package: `reports/baller-cards/express-package/`.

| Piece | Where |
|---|---|
| **Catalog** | `shared-data.js` — public **`ballersAlert` only** ($100) in `SHOUTOUT_STANDARD_TEMPLATE_IDS`; private `ballersAlertAmex` (`masterAdminOnly`, Aurelia). **`blackCard` / `blackCardAmex` removed** (s3.2.101). Flags `ballerCard`, `ballerAlert`, `ballerBrand`, `requiresFacePhoto`, `textProfileId:'ballerCard'`; company `maxSubCharacters:18` (UPPERCASE) |
| **Art** | Package PNG `ballers-express-business.png` → `images/baller/ballers-alert-{2x1,4x3}.png` (+ `-amex-` twin) via `scripts/build-baller-card-photos.py`. Chip SVG/PNG: `images/baller/baller-emv-chip.svg` |
| **Composer** | `#ballerCardFields`: name or @handle + optional company (preset `WE'RE OUTSIDE LLC`, max 18, always UPPERCASE). Alert: single **Upload photo** → library/files or **Camera — face guide** (oval); no duplicate Take photo button. Immediate local + LED preview (`processBallerFaceSelection`), then Storage + Gemini mask on select; cancel keeps prior. File input uses `.baller-file-input-host`. Placement sliders `#ballerFaceScale` / `#ballerFacePosY` |
| **Display** | `placeBallerFaceSlot` + face oval; chip overlay above face (`z-index:5`); card layers `scale(0.935)` so flashing red halo sits in the black margin; `border-radius:2.9%/4.7%` clips residual silhouette fringe; name/company `top:64%` (64×48: `60%`), type `mainSize×0.92×1.5×1.1` vh (+10%); face slot `background:transparent`; metallic gold emboss; empty company hidden |
| **Checkout** | `functions/commerce-functions.js` `BALLER_CARD_PRICE_CENTS` + Amex requires `isServerAdminAuth` + Aurelia; `ballerCard` text caps (sub 25) |
| **Rules** | `firestore.rules` free-create excludes all four ids; `geminiApiAccessLogs` Master Admin / FloqR Admin read |
| **AI** | `functions/gemini-portrait-mask.js` (default `gemini-3.8-flash`, override `FLOQR_GEMINI_SEGMENTATION_MODEL` → full-frame alpha PNG / polygon) + `aiEnhanceShoutOutMedia` `baller-portrait-mask` (alias `baller-face-medallion` / `removeBallerPortraitBackground`). Client `destination-in` composite; original immutable |
| **Gemini audit** | `functions/gemini-api-access-log.js` → `geminiApiAccessLogs` + `appLogs` category `gemini` (success/failure + `failureReason`, failures `severity:"critical"`, 30-day). Hourly `checkGeminiApiAccessFailures` → inbox. Master Admin Application Logging → Gemini API Access card |
| **Critical log tab flash** | Standard: `floqr-critical-log-blink.js` (`FLOQRCriticalLogBlink`). Any registered critical failure flashes its subtab + parent group (same `.is-blink` / `criticalLogTabBlink` as Security). Sources: `securitySystemMessages`, `displayLoadErrors`, `geminiApiAccess`. Gemini: live failure watch + **Acknowledge critical failures** (session watermark). Resume `@critical-log-blink$` |
| **Help** | `help-black-card`, `help-ballers-alert`; intents `black-card`, `ballers-alert` |
| **Tests** | `functions/baller-card-template.test.js`, `functions/gemini-portrait-mask.test.js`, `functions/gemini-api-access-log.test.js` |

## Classic Halloween (`classicHalloween`) — seasonal ShoutOut template

Live package **s3.2.71**. Resume `@halloween$`.

| Piece | Where |
|---|---|
| **Design notes** | `.cursor/rules/design-notes-classic-halloween.mdc` |
| **Catalog** | `shared-data.js` `SHOUTOUT_TEMPLATES.classicHalloween` (`scope:'Shared'`, `seasonal`, `allowEmoji`, `halloweenFinale`, `Is96x48/Is64x48/Is64x32 = 1`, `priceCents:1500`) + `SHOUTOUT_STANDARD_TEMPLATE_IDS`. Packaged only — no Firestore `templates` doc needed |
| **Composer** | `patron-app.js` Seasonal section (`template.seasonalSection`), seasonal kept on `restrictTemplatesToLocationSet` venues, `isEmojiClassicBoardTemplate` (uppercase + grapheme caps, no HTML `maxlength`). `admin-app.js` `fitAdminEmojiText` for admin board writes |
| **Display** | `display-app.js` `syncHalloweenFinale` / `stopHalloweenFinale` on `FLOQRFrameLoop.cycle("halloween-finale")` (3 board phases + 1 finale phase × 6 s; no template timer); emoji branch `glyphSlice(cleanDisplayText(...))`. `display.css` `.classic-halloween` + `.halloween-finale` + reduced-motion block. Art `images/halloween/classic-halloween-2x1.svg` (96×48, 64×32) / `-4x3.svg` (64×48) |
| **Checkout** | `functions/commerce-functions.js` `CLASSIC_HALLOWEEN_PRICE_CENTS = 1500` in `normalizeCheckoutPayload` + `describeOrder` (server price wins); classic board text caps via `CLASSIC_BOARD_TEMPLATE_IDS` |
| **Rules** | `firestore.rules` `validFreePatronShoutoutCreate` refuses `template == 'classicHalloween'` (no free direct create of the paid template) |
| **Help** | `help-classic-halloween` (patron) in `botdee-help-repository.js`, `scripts/_help-en.json`, `floqr-i18n-help.js` (10 langs); BOT DEE intent `classic-halloween` in `intent-search.js`; regenerated `functions/botdee-content-classes.json` + `functions/bot-dee-search-catalog.json` |
| **Diagnostics** | Manual Feature Test `s3-2-71-classic-halloween`; package install checks `s3.2.71` |
| **Tests / QA** | `functions/classic-halloween-template.test.js`; visual QA `node reports/classic-halloween/halloween-qa.mjs` → `reports/classic-halloween/*.png` + `qa-results.json` |

## Features SMARTview (s3.3.056)

Product-discovery catalog. **Not** Room SMARTview / SMARTvisuals and **not** BOT DEE Version SMARTview. Resume from kit `internal/FLOQR_Features_SMARTview_Cursor_Package/`. **Do not merge or deploy until Don approves.**

| Layer | Wiring |
|---|---|
| Surfaces | Catalog page `features-smartview.html` (`data-floqr-public`, not Search). Mounts immediately; `FLOQRSessionShell.bind({ autoRedirect: false })` may restore a session for live `featureServices` flags but does not send visitors to Search. Close dismisses the product detail overlay (desktop + phone). Inline bind still calls `firebase.initializeApp(firebaseConfig)` when `firebase.apps.length` is 0. Master Admin → Features Mgmt → BOT DEE → SMARTviews → Show Features SMARTview. BOT DEE chat card via `botdee-smartview.js` `mountPayload`. |
| Products | Exact display names: BOT-DEE, Mingl, ShoutOut, RydR, floqCast, VIP reserV, Si-nema, Si-tube. Views: Overview, What's New, Feature Journey, All Features, Coming Soon, Past/Retired. Compact card + detail sheet. Try only when `statusVerified` + released/beta + availability + `canAccess`. |
| Client | `features-smartview-core.js`, `floqr-features-smartview.js` / `.css`, catalog `features-smartview/catalog.json`. Cache-bust `?v=s3.3.060` on `features-smartview.html` scripts. Empty `data-fsv-feature=""` does not fall back to `?feature=`. Host `.card` strips `backdrop-filter` so the overlay is not trapped. Nav links have no hardcoded `?v=`. Live `featureServices` flags via `FLOQRFeatureServices.ensureLoaded` preferred over packaged defaults. Evidence-backed Before / Now copy stays visible without `publicCopyApproved`. What's New still requires editorial approval. |
| Backend | `functions/features-smartview-functions.js` (`getFeaturesSmartViewCatalog`, `approveFeaturesSmartViewCopy`, `rollbackFeaturesSmartViewCopy`). SOS2FA via `assertAdmin`. Catalog copy `functions/features-smartview/catalog.json` must stay byte-identical. |
| Data | Git catalog is public Pages truth. Firestore `featuresSmartviewApprovals` / `featuresSmartviewDrafts` / `featuresSmartviewAuditLogs` — Master Admin read, Functions write. Classification in `data-classification-core.js`. Ingest cache gitignored. |
| BOT DEE | `isFeaturesSmartViewPrompt` wins over Version for product-scoped “what changed in Mingl”. Bare `Ver` stays Version. Room / Cancun / throw ShoutOut / hold VIP stay other cards. Citations are catalog pages, never private PR URLs. Chat prefetches `features-smartview/catalog.json` into `__FLOQR_FEATURES_SMARTVIEW_CATALOG` so local (durable-off) Features prompts never build against `{products:[],features:[]}`. BOT DEE cards scope to that retrieve’s product ids and render **raw catalog rows** for those products (tabs filter in the UI). They do not show the six-product switcher and do not bind to a What’s New slice. Compact **Read changes** honors `data-fsv-view-jump`. Apostrophes strip in `normalizePrompt` so “What's new in Mingl” still matches. |
| Help | `help-features-smartview`, `help-features-smartview-status`, `help-features-smartview-botdee` |
| Tests | `functions/features-smartview.test.js`, i18n coverage, Manual Feature Test `s3-3-056-features-smartview` |
| Status this PR | Patron badges: **Production** (IsFeatureEnabled=1 and IsTestFeature=0; badge **Production** / Prod), **Testing** (both 1), **Beta** (IsTestFeature=1 only), **In development** (Enable Feature off). ShoutOut packaged `{1,0}` is Production. Coming Soon is In development only. Feature Journey and All Features filter by those badges, not catalog `lifecycle`. Live Firestore `featureServices` flags win when loaded; packaged defaults otherwise. Catalog-wide BOT DEE replies never invent a FLOQR platform status. Dates stay Not verified — do not invent a release date. Every record `statusVerified: false`, `releaseDateVerified: false`, `publicCopyApproved: false`. What's New empty. Eight products including RydR and floqCast (brand spelling **floqCast**). Packaged rydr/floqCast/mingl `{0,1}` → Beta. Si-tube not in repo. SAMPLE_CATALOG.json unverified. |
