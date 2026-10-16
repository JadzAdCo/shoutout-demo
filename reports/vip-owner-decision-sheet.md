# VIP Reservations ΓÇö owner decision sheet

Resume: `@vip$` / `$vip-decide$`.  
Sources: `reports/vip-reservations-proposal.md` ┬º20 ┬╖ `reports/vip-notifications-billing.md` ┬º14 ┬╖ `.cursor/rules/design-notes-vip-reservations.mdc`.  
Created: 2026-10-16.

## How to answer

1. **In chat** ΓÇö reply with question IDs and your choice, e.g. `VIP-B-01 = destination`, `VIP-P-15 = VIP Reservations`.
2. **AskQuestion batches** ΓÇö we will run Cursor AskQuestion with the Batch 1 set below (then further batches). Pick one option per question (or multi where noted).
3. **Recommended defaults** are opinionated starting points for beta; override freely. After you answer, decisions land in `design-notes-vip-reservations.mdc` and Status flips to DECIDED.

### Already decided (Oct 15 2026) ΓÇö not listed below

| Topic | Decision |
|---|---|
| Stripe processing fee | **Patron pays** the card processing fee |
| Refunds | **Full-or-none** per club refund / cancellation policy (no partial deposit refunds in product) |
| Promoter payout | **Corporate check** with **AP reference** (ledger tracks; not Connect transfer in beta) |
| Lima Twist naming | **"Lima Twist Club"** (Washington DC) |
| Bars | **Never bookable** (Decades BAR, Lima Twist BAR1/BAR2) |
| Area names | **Club-editable** (`defaultName` ΓåÆ editable `name`) |
| 360 tour | **Yes, later** (2D map is primary for beta) |

### Batch 1 decided (Oct 16 2026) ΓÇö status also on rows below

Standing requirement (owner): **whatever decisions are made here, help is adequately documented.** Each DECIDED row carries help ids to add/update when that surface is built (FloqAi / `floqai-help-repository` + `floqr-i18n-help` when translated; beta English-only OK per `vip-reservations-translation-incomplete.mdc`).

| ID | Owner answer (verbatim) | Help when built |
|---|---|---|
| **VIP-B-01** | Payment collector is chosen at management level (Master Admin + club in Services and Features / VIP ReserV), three options: (1) Club POS ΓÇö Master Admin connects the club POS; collection controlled via that integration. (2) Club Stripe ΓÇö club uses its own Stripe Connect. (3) FloqR Stripe ΓÇö club uses FloqR platform Stripe. Owner quote: *If Clubs has an integrated POS system so if it chooses to have Master Admin connect the club's own POS system then this will be controlled at the management level, or they can opt for stripe (club's stripe) or opt to use FloqR's Stripe.* | [ ] `help-vip-payment-collector` ΓÇö Master Admin + club F&S / VIP ReserV: choose Club POS / Club Stripe / FloqR Stripe |
| **VIP-B-02** | Derived from B-01 (not blanket for $20/mo): Club Stripe ΓåÆ Connect required; FloqR Stripe ΓåÆ Connect not required; Club POS ΓåÆ POS connection required, Connect not required for collection. Model A vs B is separate from collector choice. | [ ] Covered by `help-vip-payment-collector` (Connect / POS prerequisites per collector) |
| **VIP-B-03** | C ΓÇö Model B percent includes in-venue spend (not only app deposit/prepaid). POS needed to measure in-venue spend. | [ ] `help-vip-model-b-in-venue-percent` ΓÇö Model B fee base includes in-venue spend; POS required to measure |
| **VIP-B-03b** | Model B percent is **NOT** a fixed platform default. It is configurable at Master Admin, shared with club admin, and is a **contractual obligation**. No single default % in product ΓÇö each club/promoter deal has its contracted rate; UI shows the contracted %; Master Admin Features & Services / VIP ReserV management is where % is set/negotiated. | [ ] `help-vip-model-b-percent-contract` ΓÇö Master Admin sets negotiated %; club admin can view; stored on subscription/legal agreement; changes need SOS2FA + reason + audit |
| **VIP-B-05** | D ΓÇö Club sets deposit/prepay amount using settings in Services & Features (feature management) for this feature. NOT a fixed platform default. | [ ] `help-vip-deposit-settings` ΓÇö club charge-at-booking / deposit-or-prepay amount in F&S / club VIP settings ┬╖ [ ] Master Admin F&S **VIP ReserV** management (deposit policy fields) ┬╖ [ ] Club Admin settings for charge-at-booking |
| **VIP-B-10** | A ΓÇö Allow Model B for POS and pay-at-venue (monthly invoice + attestation or POS webhooks). | [ ] `help-vip-model-b-pos` ΓÇö Model B on POS / pay-at-venue paths; monthly invoice + attestation or POS webhooks |
| **VIP-P-13** | B ΓÇö `https://www.floqr.app` (canonical host for VIP booking/embed/API links). | [ ] `help-vip-booking-links` / embed & API docs ΓÇö booking, embed, and API base URLs use `www.floqr.app` ┬╖ **Open conflict** with `cutoffrequirement.mdc` (`www.floqr.com` main app) ΓÇö owner reconcile later |
| **VIP-P-16** | C ΓÇö Product brand name **VIP ReserV** (owner spelling). | [ ] `help-vip-reserv-brand` ΓÇö Search tile, F&S row label, patron/admin chrome use **VIP ReserV** ┬╖ protected never-translate |
| **VIP-P-14** | D ΓÇö First beta venues: Decades, Lima Twist Club, Aurelia (`temp-democlub-1`). | [ ] Master Admin / Club Admin onboarding help ΓÇö beta venue list ┬╖ [ ] floor-plan ingest topics for all three |

### Batch 2 decided (Oct 16 2026) ΓÇö remaining money

**Consistency note:** VIP-B-06 B and VIP-B-11 C agree ΓÇö always return / reverse the FloqMediaΓÇôFLOQR platform fee whenever the patron gets a deposit (or money) refund. **VIP-B-08 B:** Model B % fee base = **deposits + in-venue spend** (per B-03) **but not** extra-guest VIP entry fees.

| ID | Owner answer (verbatim) | Help when built |
|---|---|---|
| **VIP-B-04** | Configurable % ΓÇö FLOQR patron booking fee (if any) is a configurable percentage set at Master Admin / VIP ReserV management (shared with club as contractual), **NOT** a fixed beta-off or fixed dollar. Can be set to **0%** to mean no fee. | [ ] `help-vip-booking-fee-percent` ΓÇö Master Admin sets patron booking-fee %; club can view; 0% = no fee |
| **VIP-B-06** | B ΓÇö Always return FloqMedia/FLOQR platform fee whenever the patron gets a deposit refund. | [ ] `help-vip-platform-fee-refund` ΓÇö platform / application fee returned on every patron deposit refund |
| **VIP-B-07** | A ΓÇö Extra-guest VIP entry fee prepaid at booking as its own checkout line. | [ ] `help-vip-extra-guest-prepaid` ΓÇö separate Checkout line ΓÇ£Extra guests ΓÇö VIP entryΓÇ¥ |
| **VIP-B-08** | B ΓÇö Extra-guest fees do **NOT** count toward Model B % fee base. | [ ] `help-vip-model-b-fee-base` ΓÇö Model B base = deposits + in-venue spend; **exclude** extra-guest fees |
| **VIP-B-09** | A ΓÇö Extra-guest fee refunds follow same full-or-none club policy as deposit. | [ ] `help-vip-extra-guest-refund` ΓÇö same full-or-none policy engine as deposit |
| **VIP-B-11** | C ΓÇö Always reverse FLOQR % whenever money is refunded to the patron (same/next billing period for invoiced Model B). | [ ] `help-vip-percent-fee-reverse` ΓÇö reverse Model B / FLOQR % on every patron money refund; credit same or next invoice when Model B was invoiced |
| **VIP-B-12** | A ΓÇö Dunning day 0/3/7/14; pause new VIP bookings day 21; existing honored; Master Admin can extend. | [ ] `help-vip-dunning` ΓÇö dunning timeline; pause new bookings at day 21; MA extend |
| **VIP-B-13** | D ΓÇö No second Master Admin approver for credit notes in beta (any Master Admin alone). | [ ] `help-vip-credit-note-approval` ΓÇö beta: any Master Admin may issue credit notes alone (no two-person rule) |
| **VIP-B-14** | A ΓÇö Counsel+accountant before Live; Stripe Tax off in beta. | [ ] `help-vip-sales-tax-beta` ΓÇö Stripe Tax off in beta; counsel/accountant checklist before Live |


---

## A ΓÇö Money & Stripe

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-01 | Proposal ┬º20 Q2 ┬╖ design notes Money ┬╖ Billing ┬º14 | Who collects VIP payments ΓÇö and how is Connect / POS wired? (replaces destination-vs-direct as the primary charge-path question) | **Management-level collector: Club POS / Club Stripe / FloqR Stripe** | Owner: clubs with an integrated POS can have Master Admin connect it; otherwise club Stripe or FloqR Stripe | **DECIDED Oct 16 2026** ΓÇö Collector chosen at management level (Master Admin + club in Services & Features / VIP ReserV): (1) Club POS; (2) Club Stripe (Connect); (3) FloqR Stripe. Help: [ ] `help-vip-payment-collector` |
| VIP-B-02 | Proposal ┬º20 Q3 | Must Model A ($20/mo) clubs still complete Stripe Connect to receive deposits? | **Yes ΓÇö Connect required for any deposit-taking club** | Avoids FloqMedia holding club funds / money-transmission risk | **DECIDED Oct 16 2026** ΓÇö Derived from B-01 (not blanket for $20/mo): Club Stripe ΓåÆ Connect required; FloqR Stripe ΓåÆ Connect not required; Club POS ΓåÆ POS connection required, Connect not required for collection. Model A vs B separate from collector. Help: [ ] `help-vip-payment-collector` |
| VIP-B-03 | Proposal ┬º20 Q4 | Model B ΓÇ£% of collected feesΓÇ¥: deposits/prepaid only, or also in-venue spend? Default %? | **Deposits + prepaid extras only ┬╖ 10% (1000 bps)** | Measurable from FLOQR/POS webhooks; in-venue spend needs attestation and is Phase 2+ | **DECIDED Oct 16 2026** ΓÇö C: Model B % includes **in-venue spend** (not only app deposit/prepaid). POS needed to measure in-venue spend. Help: [ ] `help-vip-model-b-in-venue-percent` |
| VIP-B-03b | Follow-up to VIP-B-03 | What Model B percent number (bps)? | Configurable per deal (no platform default) | Contractual rate per club/promoter; Master Admin negotiates | **DECIDED Oct 16 2026** ΓÇö NOT a fixed platform default. Configurable at Master Admin, shared with club admin, contractual obligation. Each deal has its contracted rate; UI shows contracted %; set in F&S / VIP ReserV management. Help: [ ] `help-vip-model-b-percent-contract` |
| VIP-B-04 | Proposal ┬º20 Q5 | Charge patrons a FLOQR booking fee on top of deposit? | **No patron booking fee in beta** | All-in price stays the clubΓÇÖs deposit; Stripe processing already on patron (Oct 15) | **DECIDED Oct 16 2026** ΓÇö Configurable % at Master Admin / VIP ReserV management (shared with club as contractual); **NOT** fixed beta-off or fixed dollar; **0%** = no fee. Help: [ ] `help-vip-booking-fee-percent` |
| VIP-B-05 | Proposal ┬º20 Q6 | Default charge at booking: partial deposit % of minimum, or full minimum prepay? | **Full minimum prepay** | Strongest no-show protection; simplest refunds (full-or-none) | **DECIDED Oct 16 2026** ΓÇö D: Club sets deposit/prepay amount using settings in Services & Features (feature management) for this feature. NOT a fixed platform default. |
| VIP-B-06 | Proposal ┬º20 Q7 | Refund FloqMediaΓÇÖs application / Model B fee when a booking is cancelled? | **Refund fee only on club-caused cancellations** | Patron cancels ΓåÆ platform kept work; club cancels ΓåÆ make patron and club whole | **DECIDED Oct 16 2026** ΓÇö B: Always return FloqMedia/FLOQR platform fee whenever the patron gets a deposit refund. Help: [ ] `help-vip-platform-fee-refund` |
| VIP-B-07 | Proposal ┬º20 Q23(a) | Is the extra-guest VIP entry fee prepaid at booking? | **Yes ΓÇö separate Checkout line** | Matches demo; door does not chase unpaid entry | **DECIDED Oct 16 2026** ΓÇö A: Extra-guest VIP entry fee prepaid at booking as its own checkout line. Help: [ ] `help-vip-extra-guest-prepaid` |
| VIP-B-08 | Proposal ┬º20 Q23(b) | Does extra-guest fee count toward Model B %? | **Yes** | It is money FLOQR collected / attested; same fee base as deposit | **DECIDED Oct 16 2026** ΓÇö B: Extra-guest fees do **NOT** count toward Model B % fee base (base = deposits + in-venue spend only). Help: [ ] `help-vip-model-b-fee-base` |
| VIP-B-09 | Proposal ┬º20 Q23(c) | Extra-guest fee refundability vs deposit policy? | **Same full-or-none club policy as deposit** | One policy engine; no special partial guest-fee rules in beta | **DECIDED Oct 16 2026** ΓÇö A: Extra-guest fee refunds follow same full-or-none club policy as deposit. Help: [ ] `help-vip-extra-guest-refund` |
| VIP-B-10 | Billing ┬º14 Q2 | Allow Model B for POS (b) and pay-at-venue (c) clubs (monthly invoice + attestation)? | **Yes ΓÇö Model B on (b)/(c) with monthly invoice + attestation** | Clubs without Connect still pay %; ledger is source of truth | **DECIDED Oct 16 2026** ΓÇö A: Allow Model B for POS and pay-at-venue (monthly invoice + attestation or POS webhooks). Help: [ ] `help-vip-model-b-pos` |
| VIP-B-11 | Billing ┬º14 Q3 | When is FLOQRΓÇÖs % fee returned on refunds / no-shows (club-caused, patron-caused, POS later)? Window? | **Return fee on club-caused only ┬╖ within same or next billing period** | Aligns with VIP-B-06; POS late reports get a credit on next invoice | **DECIDED Oct 16 2026** ΓÇö C: Always reverse FLOQR % whenever money is refunded to the patron (same/next billing period for invoiced Model B). Consistent with VIP-B-06 B. Help: [ ] `help-vip-percent-fee-reverse` |
| VIP-B-12 | Billing ┬º14 Q9 | Confirm dunning days (┬º6.4) and pause new bookings at day 21? | **Use ┬º6.4 timeline ┬╖ pause new bookings at day 21** | Protects AR without killing same-night door ops on day 1 | **DECIDED Oct 16 2026** ΓÇö A: Dunning day 0/3/7/14; pause new VIP bookings day 21; existing honored; Master Admin can extend. Help: [ ] `help-vip-dunning` |
| VIP-B-13 | Billing ┬º14 Q10 | Credit-note amount that needs a second Master Admin approver? | **$500** | Stops large goodwill credits without two-person rule on every $20 note | **DECIDED Oct 16 2026** ΓÇö D: No second Master Admin approver for credit notes in beta (any Master Admin alone). Help: [ ] `help-vip-credit-note-approval` |
| VIP-B-14 | Billing ┬º14 Q14 | Sales tax: is FLOQRΓÇÖs fee taxable in DC / launch states? Deposits taxable at booking or service? Stripe Tax on/off? | **Counsel + accountant confirm before Live ┬╖ Stripe Tax off in beta** | Tax is jurisdiction-specific; beta can invoice pre-tax with counsel checklist | **DECIDED Oct 16 2026** ΓÇö A: Counsel+accountant before Live; Stripe Tax off in beta. Help: [ ] `help-vip-sales-tax-beta` |

---

## B ΓÇö Roles & legal

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-01 | Proposal ┬º20 Q1 ┬╖ design notes | Finish principle 14: what capabilities must club admins have? (multi-select) | **aΓÇôh all; i Terms PDF upload = Should later** | Covers house holds, pricing, overrides, door ops, messaging, export, promoter caps; clause builder first | OPEN |
| VIP-P-02 | Proposal ┬º20 Q9 | Master Admin access to patron PII: break-glass only or standing read? | **Break-glass only (30 min) + Owner notified** | Least privilege; matches design-notes Master Admin row | OPEN |
| VIP-P-03 | Proposal ┬º20 Q10 | E-sign: paid provider (Dropbox Sign / DocuSign / Adobe) or passkey + TSA in-app for beta? | **Passkey + TSA in-app for beta** | Ship without vendor contract; offer provider as Should post-beta | OPEN |
| VIP-P-04 | Proposal ┬º20 Q11 | TSA timestamp provider: paid (DigiCert / GlobalSign / Sectigo) or free? | **Paid TSA (DigiCert or Sectigo)** | Free stamps are weak evidence if a signature is challenged | OPEN |
| VIP-P-05 | Proposal ┬º20 Q12 | Capture opt-in browser geolocation for counsel signatures? | **No ΓÇö IP + passkey + bar verification only** | Geolocation is optional noise and never proof | OPEN |
| VIP-P-06 | Proposal ┬º20 Q13 | EU / non-US clubs in beta scope (eIDAS, GDPR controller, SCA)? | **US-only for beta** | Avoids eIDAS/QES and SCA off-session complexity until counsel ready | OPEN |
| VIP-P-07 | Proposal ┬º20 Q20 | Who is Club Owner (signs agreements) at each beta venue? | **Owner names one uid/email per club at onboarding** | Blocks certification until a real signer exists | OPEN |
| VIP-P-08 | Billing ┬º14 Q11 | Create a FloqMedia Finance claim role, or Master-Admin-only books? | **Finance role (read-mostly) + Master Admin for writes** | Accountant can close books without full SOS2FA surface | OPEN |

---

## C ΓÇö Booking UX & floor plans

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-09 | Proposal ┬º20 Q15 remnant | Confirm Lima Twist **106 is the only DJ booth**? | **Yes ΓÇö 106 only** | Matches owner Oct 15 map feedback; legend uses one blue DJ state | OPEN |
| VIP-P-10 | Proposal ┬º20 Q16 | Decades: what is the unlabeled enclosure west of south VIP TABLES? Are the two VIP TABLES areas bookable as full buyouts? | **Enclosure = non-bookable ┬╖ VIP areas = per-table only (no buyout SKU in beta)** | Fail closed on unlabeled shapes; buyouts can be a later night-type | OPEN |
| VIP-P-11 | Proposal ┬º20 Q18 remnant | Who shoots the later 360 panoramas ΓÇö club staff or FloqMedia photographer? | **Club staff with FloqMedia capture guide** | Cheaper; FloqMedia reviews privacy blur before publish | OPEN |
| VIP-P-12 | Proposal ┬º20 Q24 | Confirm capacity placeholders (Decades VIP 8/6, tables 6/4; Lima 2ΓÇô6). Is `includedGuests` usually = `maxCapacity`? | **Placeholders OK until club review ┬╖ included often = max (extra-guest fee null)** | Clubs confirm in ingest `review`; null extra fee is the simple default | OPEN |

---

## D ΓÇö Notifications & receipts

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-15 | Billing ┬º14 Q4 | Who pays for patron SMS / WhatsApp (confirm / remind / pass)? | **Club message credits** (opt-in at booking) | Club-ops already use club packs; FloqMedia does not subsidize venue SMS | OPEN |
| VIP-B-16 | Billing ┬º14 Q5 | Confirm mandatory notification list (┬º2.3) and that Owner cannot turn them off? | **Confirm as written** | Disputes / invoices / statements / MA access must always land | OPEN |
| VIP-B-17 | Billing ┬º14 Q6 | Quiet-hours default for staff alerts? | **03:00ΓÇô11:00 local preset (urgent still breaks through)** | Nightclubs sleep late; urgent list already defined | OPEN |
| VIP-B-18 | Billing ┬º14 Q7 | Receipt issuer of record? | **Club as merchant ┬╖ ΓÇ£Processed by FLOQRΓÇ¥** | Matches Connect settlement; club brand on the PDF | OPEN |
| VIP-B-19 | Billing ┬º14 Q8 | Path (c) pay-at-venue: always issue FLOQR receipts, or club may opt out? | **Always issue FLOQR receipt of record** | One immutable trail for ledger / disputes even if POS printed a slip | OPEN |

---

## E ΓÇö Promoters & ledger

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-20 | Proposal ┬º20 Q8 (price only; payout = corporate check) | Promoter platform subscription also $20/month? | **Yes ΓÇö $20/month** | Same Model A as clubs; simple catalog | OPEN |
| VIP-B-21 | Billing ┬º14 Q13 | Revenue recognition system: QuickBooks Online or Xero? Daily or monthly sub recognition? Map chart now? | **QuickBooks Online ┬╖ monthly recognition ┬╖ map chart at Phase 6** | Common for US SMBs; CSV export covers beta | OPEN |
| VIP-B-22 | Billing ┬º14 Q15 | Confirm 3ΓÇô5 letter club codes for numbering (e.g. `DEC`, `LIMA`)? | **Yes ΓÇö Master Admin sets code at certification** | Stable receipt / invoice / statement prefixes | OPEN |

---

## F ΓÇö Brand / origin / beta rollout

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-13 | Proposal ┬º20 Q14 ┬╖ cutover rule | Canonical origin for booking / embed / API links: `www.floqr.com` or `www.floqr.app`? | **`https://www.floqr.com`** | Matches cutover canonical origin; single helper | **DECIDED Oct 16 2026** ΓÇö B: `https://www.floqr.app` (canonical host for VIP booking/embed/API links). **Open conflict** with `cutoffrequirement.mdc` (`www.floqr.com` for main app) ΓÇö owner to reconcile later if needed. |
| VIP-P-14 | Proposal ┬º20 Q19 | Beta venues: Decades + Lima Twist first? Existing `clubLocations` ids? | **Yes those two ┬╖ confirm/create ids at Phase 1** | Maps already ingested; owner knows both rooms | **DECIDED Oct 16 2026** ΓÇö D: First beta venues: Decades, Lima Twist Club, Aurelia (`temp-democlub-1`). |
| VIP-P-15 | Proposal ┬º20 Q21 | Block Live until both translation tiers pass? Which languages get counsel Terms first? | **Block Live until tiers pass ┬╖ Terms EN first, then FR/ES** | Matches `vip-reservations-translation-incomplete.mdc` | OPEN |
| VIP-P-16 | Proposal ┬º20 Q22 | Product name: ΓÇ£VIP TablesΓÇ¥, ΓÇ£VIP ReservationsΓÇ¥, or a protected brand? | **VIP Reservations** (protected brand string) | Matches feature key `vipReservations` and F&S naming | **DECIDED Oct 16 2026** ΓÇö C: Product brand name **VIP ReserV** (owner spelling). Protected / never-translate. |

---

## G ΓÇö Other

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-23 | Billing ┬º14 Q16 | Retention: 7 years receipts/invoices/ledger/statements; 13 months notification delivery logs? | **Confirm as written** | Aligns with finance + PCI-ish log practice already in proposal | OPEN |
| VIP-B-24 | Billing ┬º14 Q17 | Schedule separate fixes: VIP receipt SMS via `sendTwilioMessagesApi`; stop redactor masking `FLOQR-ΓÇª` invoice numbers? | **Yes ΓÇö schedule before VIP Functions ship** | Open security / ops findings; do not copy the bug into VIP | OPEN |

---

## Batch 1 ΓÇö answer these first (critical)

At most 8. Use for AskQuestion immediately. **Γÿà** = recommended option.

| ID | Prompt (short) | Options |
|---|---|---|
| VIP-B-01 | How should VIP deposits charge through Stripe Connect? | Γÿà `destination` ΓÇö Destination charges + `on_behalf_of` club ┬╖ `direct` ΓÇö Direct charges on Standard accounts ┬╖ `decide_later` ΓÇö Defer (blocks Connect build) |
| VIP-B-02 | Must $20/mo (Model A) clubs still finish Stripe Connect to take deposits? | Γÿà `connect_required` ΓÇö Yes, Connect required ┬╖ `no_connect_model_a` ΓÇö No, FloqMedia can hold/remit ┬╖ `model_a_no_deposits` ΓÇö Model A clubs cannot take card deposits |
| VIP-B-03 | What does Model B ΓÇ£% of collected feesΓÇ¥ cover, and default %? | Γÿà `deposits_10` ΓÇö Deposits + prepaid extras only @ 10% ┬╖ `deposits_only_10` ΓÇö Deposits only @ 10% ┬╖ `incl_invenue_10` ΓÇö Also in-venue spend @ 10% ┬╖ `other_pct` ΓÇö Same scope as Γÿà but different % (say in chat) |
| VIP-B-05 | Default amount charged at booking? | Γÿà `full_minimum` ΓÇö Full minimum prepay ┬╖ `deposit_50` ΓÇö ~50% deposit ┬╖ `deposit_25` ΓÇö ~25% deposit ┬╖ `club_chooses` ΓÇö No platform default; club sets per night |
| VIP-B-10 | Allow Model B (% fee) for POS and pay-at-venue clubs (invoice + attestation)? | Γÿà `allow_bc` ΓÇö Yes, allow (b) and (c) ┬╖ `path_a_only` ΓÇö Model B only when FLOQR collects (path a) ┬╖ `a_and_b` ΓÇö Paths (a) and (b) only |
| VIP-P-13 | Canonical host for VIP booking / embed / API links? | Γÿà `floqr_com` ΓÇö `https://www.floqr.com` ┬╖ `floqr_app` ΓÇö `https://www.floqr.app` ┬╖ `helper_both` ΓÇö Helper supports both; Pages stays github.io until cutover |
| VIP-P-16 | Public product name (also protected from translation)? | Γÿà `vip_reservations` ΓÇö VIP Reservations ┬╖ `vip_tables` ΓÇö VIP Tables ┬╖ `brand_later` ΓÇö Placeholder ΓÇ£VIP ReservationsΓÇ¥; invent brand before Live |
| VIP-P-14 | First beta venues? | Γÿà `decades_lima` ΓÇö Decades + Lima Twist Club ┬╖ `decades_only` ΓÇö Decades only ┬╖ `lima_only` ΓÇö Lima Twist only ┬╖ `other` ΓÇö Different venues (name in chat) |

---

## AskQuestion payload (Batch 1)

```json
[
  {
    "id": "VIP-B-01",
    "prompt": "How should VIP deposits charge through Stripe Connect?",
    "options": [
      { "id": "destination", "label": "Destination charges + on_behalf_of club (recommended)" },
      { "id": "direct", "label": "Direct charges on Standard Connect accounts" },
      { "id": "decide_later", "label": "Defer (blocks Connect build)" }
    ]
  },
  {
    "id": "VIP-B-02",
    "prompt": "Must $20/mo (Model A) clubs still finish Stripe Connect to take deposits?",
    "options": [
      { "id": "connect_required", "label": "Yes ΓÇö Connect required (recommended)" },
      { "id": "no_connect_model_a", "label": "No ΓÇö FloqMedia can hold/remit" },
      { "id": "model_a_no_deposits", "label": "Model A clubs cannot take card deposits" }
    ]
  },
  {
    "id": "VIP-B-03",
    "prompt": "What does Model B ΓÇ£% of collected feesΓÇ¥ cover, and default %?",
    "options": [
      { "id": "deposits_10", "label": "Deposits + prepaid extras only @ 10% (recommended)" },
      { "id": "deposits_only_10", "label": "Deposits only @ 10%" },
      { "id": "incl_invenue_10", "label": "Also in-venue spend @ 10%" },
      { "id": "other_pct", "label": "Same as recommended scope, different % (say in chat)" }
    ]
  },
  {
    "id": "VIP-B-05",
    "prompt": "Default amount charged at booking?",
    "options": [
      { "id": "full_minimum", "label": "Full minimum prepay (recommended)" },
      { "id": "deposit_50", "label": "~50% deposit" },
      { "id": "deposit_25", "label": "~25% deposit" },
      { "id": "club_chooses", "label": "No platform default ΓÇö club sets per night" }
    ]
  },
  {
    "id": "VIP-B-10",
    "prompt": "Allow Model B (% fee) for POS and pay-at-venue clubs (monthly invoice + attestation)?",
    "options": [
      { "id": "allow_bc", "label": "Yes ΓÇö allow paths (b) and (c) (recommended)" },
      { "id": "path_a_only", "label": "Model B only when FLOQR collects (path a)" },
      { "id": "a_and_b", "label": "Paths (a) and (b) only" }
    ]
  },
  {
    "id": "VIP-P-13",
    "prompt": "Canonical host for VIP booking / embed / API links?",
    "options": [
      { "id": "floqr_com", "label": "https://www.floqr.com (recommended)" },
      { "id": "floqr_app", "label": "https://www.floqr.app" },
      { "id": "helper_both", "label": "Helper supports both; Pages stays github.io until cutover" }
    ]
  },
  {
    "id": "VIP-P-16",
    "prompt": "Public product name (protected from translation)?",
    "options": [
      { "id": "vip_reservations", "label": "VIP Reservations (recommended)" },
      { "id": "vip_tables", "label": "VIP Tables" },
      { "id": "brand_later", "label": "Placeholder VIP Reservations; invent brand before Live" }
    ]
  },
  {
    "id": "VIP-P-14",
    "prompt": "First beta venues?",
    "options": [
      { "id": "decades_lima", "label": "Decades + Lima Twist Club (recommended)" },
      { "id": "decades_only", "label": "Decades only" },
      { "id": "lima_only", "label": "Lima Twist Club only" },
      { "id": "other", "label": "Different venues (name in chat)" }
    ]
  }
]
```

---

## Counts

| Group | Open IDs |
|---|---|
| A Money & Stripe | **none** ΓÇö all money IDs decided (Batch 1 + Batch 2) |
| B Roles & legal | VIP-P-01ΓÇª08 (8) |
| C Booking UX & floor plans | VIP-P-09ΓÇª12 (4) |
| D Notifications & receipts | VIP-B-15ΓÇª19 (5) |
| E Promoters & ledger | VIP-B-20ΓÇª22 (3) |
| F Brand / origin / beta | VIP-P-15 only (1) ΓÇö P-13/14/16 decided |
| G Other | VIP-B-23ΓÇª24 (2) |
| **Total OPEN** | **23** |
| Skipped (Oct 15) | Stripe fee payer ┬╖ full-or-none refunds ┬╖ promoter corporate check ┬╖ Lima name ┬╖ bars ┬╖ area names ┬╖ 360 timing |
| Decided Batch 1 (Oct 16) | VIP-B-01 ┬╖ VIP-B-02 ┬╖ VIP-B-03 ┬╖ VIP-B-03b ┬╖ VIP-B-05 ┬╖ VIP-B-10 ┬╖ VIP-P-13 ┬╖ VIP-P-14 ┬╖ VIP-P-16 |
| Decided Batch 2 (Oct 16) | VIP-B-04 ┬╖ VIP-B-06 ┬╖ VIP-B-07 ┬╖ VIP-B-08 ┬╖ VIP-B-09 ┬╖ VIP-B-11 ┬╖ VIP-B-12 ┬╖ VIP-B-13 ┬╖ VIP-B-14 |

---

## Batch 2 (DECIDED Oct 16 2026) ΓÇö remaining money

All 9 money IDs answered. See **Batch 2 decided** table above. Roles/legal deferred to Batch 3.

| ID | Decision (short) | Help |
|---|---|---|
| VIP-B-04 | Configurable patron booking-fee % (0% = none) | [ ] `help-vip-booking-fee-percent` |
| VIP-B-06 | B ΓÇö Always return platform fee on patron deposit refund | [ ] `help-vip-platform-fee-refund` |
| VIP-B-07 | A ΓÇö Extra-guest fee prepaid as own Checkout line | [ ] `help-vip-extra-guest-prepaid` |
| VIP-B-08 | B ΓÇö Extra-guest fees **excluded** from Model B % base | [ ] `help-vip-model-b-fee-base` |
| VIP-B-09 | A ΓÇö Extra-guest refunds = same full-or-none as deposit | [ ] `help-vip-extra-guest-refund` |
| VIP-B-11 | C ΓÇö Always reverse FLOQR % on patron money refund | [ ] `help-vip-percent-fee-reverse` |
| VIP-B-12 | A ΓÇö Dunning 0/3/7/14; pause new bookings day 21; MA can extend | [ ] `help-vip-dunning` |
| VIP-B-13 | D ΓÇö No second MA approver for credit notes in beta | [ ] `help-vip-credit-note-approval` |
| VIP-B-14 | A ΓÇö Counsel+accountant before Live; Stripe Tax off in beta | [ ] `help-vip-sales-tax-beta` |

### Suggested Batch 3 groups (presented Oct 16 2026)

| Batch | Group | Open IDs | Why next |
|---|---|---|---|
| **3a** | B Roles & legal | VIP-P-01ΓÇª08 (8) | Blocks certification, e-sign, break-glass, Finance role |
| **3b** | D Notifications & receipts | VIP-B-15ΓÇª19 (5) | SMS payer, mandatory list, quiet hours, receipt issuer |
| **3c** | C Booking UX & floor plans | VIP-P-09ΓÇª12 (4) | Map edge cases + capacity placeholders |
| Later | E Promoters & ledger ┬╖ F ┬╖ G | VIP-B-20ΓÇª24 ┬╖ VIP-P-15 (6) | Promoter $20, QBO, club codes, retention, translation Live gate |

---

## Batch 3a (presented Oct 16 2026) ΓÇö roles & legal

Reply format: `P-01 A`, `P-02 B`, ΓÇª (or full `VIP-P-01 = A`). Γÿà = recommended. Do **not** re-ask money / brand / host (Batches 1ΓÇô2).

Standing requirement: every DECIDED answer that creates a user-facing surface ships FloqAi/help before Live (`help-vip-*` ids below).

### VIP-P-01 ΓÇö What should club admins be able to do in VIP ReserV?

**Clarify:** Finishes cut-off principle 14 (ΓÇ£Give club admins the capability to ΓÇªΓÇ¥). Letters aΓÇôi are the capability list from the proposal.

| Letter | Capability |
|---|---|
| a | Hold / block tables for house guests, comps, walk-ins |
| b | Different minimums per night, event, or time slot |
| c | Optional request-to-book (manual approve) instead of instant |
| d | Override policy (waive fees, refund beyond policy, move parties) |
| e | Assign tables to servers / bottle staff |
| f | Message reserved guests (night-of updates) |
| g | Export reservations CSV (door / accounting) |
| h | Set promoter quotas / allocations |
| i | Upload their own Terms PDF (instead of clause builder) |

- **A Γÿà** ΓÇö Ops pack now: **aΓÇôh**; Terms PDF upload (**i**) later (Should)
- **B** ΓÇö All of **aΓÇôi** in beta (incl. Terms PDF upload)
- **C** ΓÇö Lean beta only: **a, b, d, f, g**
- **D** ΓÇö Custom ΓÇö reply with the letters you want (e.g. `a b d f g h`)

Help when decided: [ ] `help-vip-club-admin-capabilities`

### VIP-P-02 ΓÇö How may Master Admins see patron personal data (names, phones, etc.)?

**Clarify:** ΓÇ£Break-glassΓÇ¥ = temporary unlock (about 30 minutes), then access ends; club Owner is notified.

- **A Γÿà** ΓÇö Break-glass only (30 min) + Owner notified
- **B** ΓÇö Standing read for Master Admins (no unlock step)
- **C** ΓÇö Break-glass only, **no** Owner notify
- **D** ΓÇö Never ΓÇö only Club Owner / VIP Manager see patron PII

Help when decided: [ ] `help-vip-break-glass-pii`

### VIP-P-03 ΓÇö How do clubs / counsel sign agreements in beta?

**Clarify:** Passkey = device biometric / security key over the document hash. TSA = trusted timestamp so the signature time is hard to dispute. Paid e-sign = Dropbox Sign / DocuSign / Adobe.

- **A Γÿà** ΓÇö Passkey + TSA in-app for beta; paid e-sign provider later if needed
- **B** ΓÇö Paid e-sign provider from day one (budget for Dropbox Sign / DocuSign / Adobe)
- **C** ΓÇö Wet-ink PDF upload only (scan + hash) for beta
- **D** ΓÇö Passkey only (no TSA) for beta

Help when decided: [ ] `help-vip-esign-beta`

### VIP-P-04 ΓÇö Which trusted timestamp (TSA) service for those signatures?

**Clarify:** A paid TSA is stronger evidence if a signature is challenged in court; free stamps are weaker.

- **A Γÿà** ΓÇö Paid TSA (DigiCert or Sectigo ΓÇö pick at build time)
- **B** ΓÇö Paid TSA (GlobalSign)
- **C** ΓÇö Free / public TSA (not recommended for evidence)
- **D** ΓÇö Defer TSA until post-beta (passkey only until then)

Help when decided: [ ] `help-vip-tsa-provider`

### VIP-P-05 ΓÇö Capture the signerΓÇÖs browser location (GPS) for counsel signatures?

**Clarify:** Optional phone/browser geolocation. IP address + passkey + bar verification can still prove who signed without GPS.

- **A Γÿà** ΓÇö No GPS ΓÇö IP + passkey + bar verification only
- **B** ΓÇö Opt-in GPS when the signer agrees
- **C** ΓÇö Require GPS for counsel signatures
- **D** ΓÇö Opt-in GPS for FloqMedia counsel only; never for club counsel

Help when decided: [ ] `help-vip-signer-geolocation`

### VIP-P-06 ΓÇö Are EU / non-US clubs in the VIP ReserV beta?

**Clarify:** Non-US adds eIDAS signature rules, GDPR controller duties, and stronger card ΓÇ£SCAΓÇ¥ challenges. US-only keeps beta simpler.

- **A Γÿà** ΓÇö US-only for beta
- **B** ΓÇö US + Canada for beta
- **C** ΓÇö US + selected EU markets (name countries in chat)
- **D** ΓÇö Worldwide from beta (accept eIDAS / GDPR / SCA complexity)

Help when decided: [ ] `help-vip-beta-geography`

### VIP-P-07 ΓÇö Who is the Club Owner (signs agreements) at each beta venue?

**Clarify:** Club Owner is the person who signs the subscription / legal agreements ΓÇö not every Club Admin. Beta venues already chosen: Decades, Lima Twist Club, Aurelia.

- **A Γÿà** ΓÇö You name one email/uid per club at onboarding (blocks certification until named)
- **B** ΓÇö Any Club Admin may sign as Owner
- **C** ΓÇö Master Admin acts as temporary Owner until the club names one
- **D** ΓÇö Name Owners now in chat (one line per club)

Help when decided: [ ] `help-vip-club-owner-onboarding`

### VIP-P-08 ΓÇö Who can open the VIP books / ledger?

**Clarify:** ΓÇ£Finance roleΓÇ¥ = a FloqMedia bookkeeper claim (mostly read). Writes (adjustments, write-offs) stay with Master Admin + SOS2FA.

- **A Γÿà** ΓÇö Finance role (read-mostly) + Master Admin for writes
- **B** ΓÇö Master-Admin-only (no separate Finance claim)
- **C** ΓÇö Finance role may propose adjustments; Master Admin must approve every write
- **D** ΓÇö Club Owner may export their own club memo book; platform books Master-Admin-only

Help when decided: [ ] `help-vip-finance-role`

---

## Batch 3b (presented Oct 16 2026) ΓÇö notifications & receipts

Reply format: `B-15 A`, `B-16 B`, ΓÇª Γÿà = recommended.

### VIP-B-15 ΓÇö Who pays for patron SMS / WhatsApp (confirm, remind, door pass)?

**Clarify:** Club-ops staff alerts already use the clubΓÇÖs message packs. This is only **patron-facing** texts (booking confirm, reminder, QR pass).

- **A Γÿà** ΓÇö Club message credits (patron opts in at booking)
- **B** ΓÇö FloqMedia / platform pays
- **C** ΓÇö Folded into the patron booking-fee % (when that % is > 0)
- **D** ΓÇö Email + Inbox only in beta (no patron SMS/WhatsApp)

Help when decided: [ ] `help-vip-patron-sms-payer`

### VIP-B-16 ΓÇö Keep the mandatory notification list (Owner cannot turn them off)?

**Clarify:** Proposal list covers disputes, invoices, statements, and Master Admin access alerts ΓÇö always delivered to the Owner (and required roles). Optional marketing / night-of guest texts stay optional.

- **A Γÿà** ΓÇö Confirm as written ΓÇö Owner cannot disable the mandatory list
- **B** ΓÇö Mandatory list, but Owner may mute non-urgent items during quiet hours
- **C** ΓÇö Make the whole list optional (Owner chooses)
- **D** ΓÇö Shrink the mandatory list ΓÇö say which events stay mandatory in chat

Help when decided: [ ] `help-vip-mandatory-notifications`

### VIP-B-17 ΓÇö Default quiet hours for staff alerts?

**Clarify:** Quiet hours pause non-urgent staff pings. Urgent items (disputes, break-glass, door emergencies) still break through.

- **A Γÿà** ΓÇö 03:00ΓÇô11:00 local preset (urgent still breaks through)
- **B** ΓÇö No quiet hours by default (club may set their own)
- **C** ΓÇö 02:00ΓÇô10:00 local preset
- **D** ΓÇö Quiet hours off for Owner; on for other staff (03:00ΓÇô11:00)

Help when decided: [ ] `help-vip-quiet-hours`

### VIP-B-18 ΓÇö Whose name is on the receipt (issuer of record)?

**Clarify:** ΓÇ£Merchant of recordΓÇ¥ is the business name the guest sees on the PDF / card trail. ΓÇ£Processed by FLOQRΓÇ¥ is a footer line, not the issuer.

- **A Γÿà** ΓÇö Club as merchant ┬╖ footer ΓÇ£Processed by FLOQRΓÇ¥
- **B** ΓÇö FloqMedia / FLOQR as issuer (club named as venue only)
- **C** ΓÇö Depends on payment collector: Club Stripe / Club POS ΓåÆ club; FloqR Stripe ΓåÆ FLOQR
- **D** ΓÇö Dual PDF ΓÇö club guest receipt + FLOQR ledger copy

Help when decided: [ ] `help-vip-receipt-issuer`

### VIP-B-19 ΓÇö Pay-at-venue path: always issue a FLOQR receipt, or may the club opt out?

**Clarify:** Pay-at-venue means the guest pays at the club (POS / cash), not in the app. A FLOQR receipt of record still helps disputes and the ledger even if the POS printed a slip.

- **A Γÿà** ΓÇö Always issue FLOQR receipt of record
- **B** ΓÇö Club may opt out when its POS already prints a receipt
- **C** ΓÇö FLOQR receipt only when Model B % applies (needs attested totals)
- **D** ΓÇö Email/Inbox confirmation only (no PDF receipt) for pay-at-venue

Help when decided: [ ] `help-vip-pay-at-venue-receipt`

---

## Batch 3c (presented Oct 16 2026) ΓÇö floor-plan UX

Reply format: `P-09 A`, `P-10 B`, ΓÇª Γÿà = recommended. Already decided (do not re-ask): bars never bookable ┬╖ area names club-editable ┬╖ 360 tour later ┬╖ Lima Twist Club spelling.

### VIP-P-09 ΓÇö On the Lima Twist map, is **106** the only DJ booth?

**Clarify:** 106 is already marked blue / not bookable. Confirm nothing else on that plan is a DJ booth.

- **A Γÿà** ΓÇö Yes ΓÇö 106 only
- **B** ΓÇö No ΓÇö also mark another label as DJ booth (name it in chat)
- **C** ΓÇö 106 is a table / something else (say what in chat)
- **D** ΓÇö Unsure ΓÇö leave 106 as DJ booth for beta; club can correct in review

Help when decided: [ ] `help-vip-lima-dj-booth`

### VIP-P-10 ΓÇö Decades: unlabeled enclosure west of south VIP TABLES ΓÇö and can VIP areas sell as full buyouts?

**Clarify:** Unlabeled shapes stay non-bookable until the club names them. ΓÇ£BuyoutΓÇ¥ = book a whole VIP area as one SKU instead of table-by-table.

- **A Γÿà** ΓÇö Enclosure = non-bookable ┬╖ VIP areas = per-table only (no buyout SKU in beta)
- **B** ΓÇö Enclosure = non-bookable ┬╖ allow VIP-area buyout SKU in beta
- **C** ΓÇö Enclosure is bookable (name / capacity in chat) ┬╖ per-table only
- **D** ΓÇö Ask Decades club in review before locking either answer

Help when decided: [ ] `help-vip-decades-enclosure-buyout`

### VIP-P-11 ΓÇö Who shoots the later 360┬░ ΓÇ£Explore the roomΓÇ¥ panoramas?

**Clarify:** 360 is after beta core (already decided). Hotspots still book the same tables. Photos must blur faces / empty room.

- **A Γÿà** ΓÇö Club staff with a FloqMedia capture guide (FloqMedia reviews privacy blur before publish)
- **B** ΓÇö FloqMedia photographer at FloqMedia cost
- **C** ΓÇö FloqMedia photographer billed to the club
- **D** ΓÇö Skip 360 entirely (2D map only forever)

Help when decided: [ ] `help-vip-360-capture`

### VIP-P-12 ΓÇö Are the seat placeholders OK until each club reviews? Is ΓÇ£included guestsΓÇ¥ usually the full table?

**Clarify:** Placeholders today: Decades VIP ~8 max / 6 included, tables ~6 / 4; Lima Twist ~2ΓÇô6 per table. `includedGuests` = guests covered by the minimum; beyond that ΓåÆ optional extra-guest VIP entry fee (already decided: prepaid, own line).

- **A Γÿà** ΓÇö Placeholders OK until club review ┬╖ included often = max (extra-guest fee usually null)
- **B** ΓÇö Placeholders OK ┬╖ included usually **less** than max (extra-guest fee common)
- **C** ΓÇö Freeze numbers now as platform defaults (clubs may only lower max)
- **D** ΓÇö Wipe placeholders ΓÇö every section starts empty until the club fills capacity

Help when decided: [ ] `help-vip-capacity-placeholders`
