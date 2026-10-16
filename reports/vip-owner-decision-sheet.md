# VIP Reservations — owner decision sheet

Resume: `@vip$` / `$vip-decide$`.  
Sources: `reports/vip-reservations-proposal.md` §20 · `reports/vip-notifications-billing.md` §14 · `.cursor/rules/design-notes-vip-reservations.mdc`.  
Created: 2026-10-16.

## How to answer

1. **In chat** — reply with question IDs and your choice, e.g. `VIP-B-01 = destination`, `VIP-P-15 = VIP Reservations`.
2. **AskQuestion batches** — we will run Cursor AskQuestion with the Batch 1 set below (then further batches). Pick one option per question (or multi where noted).
3. **Recommended defaults** are opinionated starting points for beta; override freely. After you answer, decisions land in `design-notes-vip-reservations.mdc` and Status flips to DECIDED.

### Already decided (Oct 15 2026) — not listed below

| Topic | Decision |
|---|---|
| Stripe processing fee | **Patron pays** the card processing fee |
| Refunds | **Full-or-none** per club refund / cancellation policy (no partial deposit refunds in product) |
| Promoter payout | **Corporate check** with **AP reference** (ledger tracks; not Connect transfer in beta) |
| Lima Twist naming | **"Lima Twist Club"** (Washington DC) |
| Bars | **Never bookable** (Decades BAR, Lima Twist BAR1/BAR2) |
| Area names | **Club-editable** (`defaultName` → editable `name`) |
| 360 tour | **Yes, later** (2D map is primary for beta) |

### Batch 1 decided (Oct 16 2026) — status also on rows below

Standing requirement (owner): **whatever decisions are made here, help is adequately documented.** Each DECIDED row carries help ids to add/update when that surface is built (FloqAi / `floqai-help-repository` + `floqr-i18n-help` when translated; beta English-only OK per `vip-reservations-translation-incomplete.mdc`).

| ID | Owner answer (verbatim) | Help when built |
|---|---|---|
| **VIP-B-01** | Payment collector is chosen at management level (Master Admin + club in Services and Features / VIP ReserV), three options: (1) Club POS — Master Admin connects the club POS; collection controlled via that integration. (2) Club Stripe — club uses its own Stripe Connect. (3) FloqR Stripe — club uses FloqR platform Stripe. Owner quote: *If Clubs has an integrated POS system so if it chooses to have Master Admin connect the club's own POS system then this will be controlled at the management level, or they can opt for stripe (club's stripe) or opt to use FloqR's Stripe.* | [ ] `help-vip-payment-collector` — Master Admin + club F&S / VIP ReserV: choose Club POS / Club Stripe / FloqR Stripe |
| **VIP-B-02** | Derived from B-01 (not blanket for $20/mo): Club Stripe → Connect required; FloqR Stripe → Connect not required; Club POS → POS connection required, Connect not required for collection. Model A vs B is separate from collector choice. | [ ] Covered by `help-vip-payment-collector` (Connect / POS prerequisites per collector) |
| **VIP-B-03** | C — Model B percent includes in-venue spend (not only app deposit/prepaid). POS needed to measure in-venue spend. | [ ] `help-vip-model-b-in-venue-percent` — Model B fee base includes in-venue spend; POS required to measure |
| **VIP-B-05** | D — Club sets deposit/prepay amount using settings in Services & Features (feature management) for this feature. NOT a fixed platform default. | [ ] `help-vip-deposit-settings` — club charge-at-booking / deposit-or-prepay amount in F&S / club VIP settings · [ ] Master Admin F&S **VIP ReserV** management (deposit policy fields) · [ ] Club Admin settings for charge-at-booking |
| **VIP-B-10** | A — Allow Model B for POS and pay-at-venue (monthly invoice + attestation or POS webhooks). | [ ] `help-vip-model-b-pos` — Model B on POS / pay-at-venue paths; monthly invoice + attestation or POS webhooks |
| **VIP-P-13** | B — `https://www.floqr.app` (canonical host for VIP booking/embed/API links). | [ ] `help-vip-booking-links` / embed & API docs — booking, embed, and API base URLs use `www.floqr.app` · **Open conflict** with `cutoffrequirement.mdc` (`www.floqr.com` main app) — owner reconcile later |
| **VIP-P-16** | C — Product brand name **VIP ReserV** (owner spelling). | [ ] `help-vip-reserv-brand` — Search tile, F&S row label, patron/admin chrome use **VIP ReserV** · protected never-translate |
| **VIP-P-14** | D — First beta venues: Decades, Lima Twist Club, Aurelia (`temp-democlub-1`). | [ ] Master Admin / Club Admin onboarding help — beta venue list · [ ] floor-plan ingest topics for all three |

**Open follow-up (do not invent):** **VIP-B-03b** — what percent number for Model B? (placeholder recommend **10%** until answered).

---

## A — Money & Stripe

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-01 | Proposal §20 Q2 · design notes Money · Billing §14 | Who collects VIP payments — and how is Connect / POS wired? (replaces destination-vs-direct as the primary charge-path question) | **Management-level collector: Club POS / Club Stripe / FloqR Stripe** | Owner: clubs with an integrated POS can have Master Admin connect it; otherwise club Stripe or FloqR Stripe | **DECIDED Oct 16 2026** — Collector chosen at management level (Master Admin + club in Services & Features / VIP ReserV): (1) Club POS; (2) Club Stripe (Connect); (3) FloqR Stripe. Help: [ ] `help-vip-payment-collector` |
| VIP-B-02 | Proposal §20 Q3 | Must Model A ($20/mo) clubs still complete Stripe Connect to receive deposits? | **Yes — Connect required for any deposit-taking club** | Avoids FloqMedia holding club funds / money-transmission risk | **DECIDED Oct 16 2026** — Derived from B-01 (not blanket for $20/mo): Club Stripe → Connect required; FloqR Stripe → Connect not required; Club POS → POS connection required, Connect not required for collection. Model A vs B separate from collector. Help: [ ] `help-vip-payment-collector` |
| VIP-B-03 | Proposal §20 Q4 | Model B “% of collected fees”: deposits/prepaid only, or also in-venue spend? Default %? | **Deposits + prepaid extras only · 10% (1000 bps)** | Measurable from FLOQR/POS webhooks; in-venue spend needs attestation and is Phase 2+ | **DECIDED Oct 16 2026** — C: Model B % includes **in-venue spend** (not only app deposit/prepaid). POS needed to measure in-venue spend. Help: [ ] `help-vip-model-b-in-venue-percent` |
| VIP-B-03b | Follow-up to VIP-B-03 | What Model B percent number (bps)? | **10% (1000 bps)** placeholder | Owner decided scope (incl. in-venue) but not the number | **OPEN** — placeholder recommend 10% until answered. Help: [ ] `help-vip-model-b-in-venue-percent` |
| VIP-B-04 | Proposal §20 Q5 | Charge patrons a FLOQR booking fee on top of deposit? | **No patron booking fee in beta** | All-in price stays the club’s deposit; Stripe processing already on patron (Oct 15) | OPEN |
| VIP-B-05 | Proposal §20 Q6 | Default charge at booking: partial deposit % of minimum, or full minimum prepay? | **Full minimum prepay** | Strongest no-show protection; simplest refunds (full-or-none) | **DECIDED Oct 16 2026** — D: Club sets deposit/prepay amount using settings in Services & Features (feature management) for this feature. NOT a fixed platform default. |
| VIP-B-06 | Proposal §20 Q7 | Refund FloqMedia’s application / Model B fee when a booking is cancelled? | **Refund fee only on club-caused cancellations** | Patron cancels → platform kept work; club cancels → make patron and club whole | OPEN |
| VIP-B-07 | Proposal §20 Q23(a) | Is the extra-guest VIP entry fee prepaid at booking? | **Yes — separate Checkout line** | Matches demo; door does not chase unpaid entry | OPEN |
| VIP-B-08 | Proposal §20 Q23(b) | Does extra-guest fee count toward Model B %? | **Yes** | It is money FLOQR collected / attested; same fee base as deposit | OPEN |
| VIP-B-09 | Proposal §20 Q23(c) | Extra-guest fee refundability vs deposit policy? | **Same full-or-none club policy as deposit** | One policy engine; no special partial guest-fee rules in beta | OPEN |
| VIP-B-10 | Billing §14 Q2 | Allow Model B for POS (b) and pay-at-venue (c) clubs (monthly invoice + attestation)? | **Yes — Model B on (b)/(c) with monthly invoice + attestation** | Clubs without Connect still pay %; ledger is source of truth | **DECIDED Oct 16 2026** — A: Allow Model B for POS and pay-at-venue (monthly invoice + attestation or POS webhooks). Help: [ ] `help-vip-model-b-pos` |
| VIP-B-11 | Billing §14 Q3 | When is FLOQR’s % fee returned on refunds / no-shows (club-caused, patron-caused, POS later)? Window? | **Return fee on club-caused only · within same or next billing period** | Aligns with VIP-B-06; POS late reports get a credit on next invoice | OPEN |
| VIP-B-12 | Billing §14 Q9 | Confirm dunning days (§6.4) and pause new bookings at day 21? | **Use §6.4 timeline · pause new bookings at day 21** | Protects AR without killing same-night door ops on day 1 | OPEN |
| VIP-B-13 | Billing §14 Q10 | Credit-note amount that needs a second Master Admin approver? | **$500** | Stops large goodwill credits without two-person rule on every $20 note | OPEN |
| VIP-B-14 | Billing §14 Q14 | Sales tax: is FLOQR’s fee taxable in DC / launch states? Deposits taxable at booking or service? Stripe Tax on/off? | **Counsel + accountant confirm before Live · Stripe Tax off in beta** | Tax is jurisdiction-specific; beta can invoice pre-tax with counsel checklist | OPEN |

---

## B — Roles & legal

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-01 | Proposal §20 Q1 · design notes | Finish principle 14: what capabilities must club admins have? (multi-select) | **a–h all; i Terms PDF upload = Should later** | Covers house holds, pricing, overrides, door ops, messaging, export, promoter caps; clause builder first | OPEN |
| VIP-P-02 | Proposal §20 Q9 | Master Admin access to patron PII: break-glass only or standing read? | **Break-glass only (30 min) + Owner notified** | Least privilege; matches design-notes Master Admin row | OPEN |
| VIP-P-03 | Proposal §20 Q10 | E-sign: paid provider (Dropbox Sign / DocuSign / Adobe) or passkey + TSA in-app for beta? | **Passkey + TSA in-app for beta** | Ship without vendor contract; offer provider as Should post-beta | OPEN |
| VIP-P-04 | Proposal §20 Q11 | TSA timestamp provider: paid (DigiCert / GlobalSign / Sectigo) or free? | **Paid TSA (DigiCert or Sectigo)** | Free stamps are weak evidence if a signature is challenged | OPEN |
| VIP-P-05 | Proposal §20 Q12 | Capture opt-in browser geolocation for counsel signatures? | **No — IP + passkey + bar verification only** | Geolocation is optional noise and never proof | OPEN |
| VIP-P-06 | Proposal §20 Q13 | EU / non-US clubs in beta scope (eIDAS, GDPR controller, SCA)? | **US-only for beta** | Avoids eIDAS/QES and SCA off-session complexity until counsel ready | OPEN |
| VIP-P-07 | Proposal §20 Q20 | Who is Club Owner (signs agreements) at each beta venue? | **Owner names one uid/email per club at onboarding** | Blocks certification until a real signer exists | OPEN |
| VIP-P-08 | Billing §14 Q11 | Create a FloqMedia Finance claim role, or Master-Admin-only books? | **Finance role (read-mostly) + Master Admin for writes** | Accountant can close books without full SOS2FA surface | OPEN |

---

## C — Booking UX & floor plans

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-09 | Proposal §20 Q15 remnant | Confirm Lima Twist **106 is the only DJ booth**? | **Yes — 106 only** | Matches owner Oct 15 map feedback; legend uses one blue DJ state | OPEN |
| VIP-P-10 | Proposal §20 Q16 | Decades: what is the unlabeled enclosure west of south VIP TABLES? Are the two VIP TABLES areas bookable as full buyouts? | **Enclosure = non-bookable · VIP areas = per-table only (no buyout SKU in beta)** | Fail closed on unlabeled shapes; buyouts can be a later night-type | OPEN |
| VIP-P-11 | Proposal §20 Q18 remnant | Who shoots the later 360 panoramas — club staff or FloqMedia photographer? | **Club staff with FloqMedia capture guide** | Cheaper; FloqMedia reviews privacy blur before publish | OPEN |
| VIP-P-12 | Proposal §20 Q24 | Confirm capacity placeholders (Decades VIP 8/6, tables 6/4; Lima 2–6). Is `includedGuests` usually = `maxCapacity`? | **Placeholders OK until club review · included often = max (extra-guest fee null)** | Clubs confirm in ingest `review`; null extra fee is the simple default | OPEN |

---

## D — Notifications & receipts

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-15 | Billing §14 Q4 | Who pays for patron SMS / WhatsApp (confirm / remind / pass)? | **Club message credits** (opt-in at booking) | Club-ops already use club packs; FloqMedia does not subsidize venue SMS | OPEN |
| VIP-B-16 | Billing §14 Q5 | Confirm mandatory notification list (§2.3) and that Owner cannot turn them off? | **Confirm as written** | Disputes / invoices / statements / MA access must always land | OPEN |
| VIP-B-17 | Billing §14 Q6 | Quiet-hours default for staff alerts? | **03:00–11:00 local preset (urgent still breaks through)** | Nightclubs sleep late; urgent list already defined | OPEN |
| VIP-B-18 | Billing §14 Q7 | Receipt issuer of record? | **Club as merchant · “Processed by FLOQR”** | Matches Connect settlement; club brand on the PDF | OPEN |
| VIP-B-19 | Billing §14 Q8 | Path (c) pay-at-venue: always issue FLOQR receipts, or club may opt out? | **Always issue FLOQR receipt of record** | One immutable trail for ledger / disputes even if POS printed a slip | OPEN |

---

## E — Promoters & ledger

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-20 | Proposal §20 Q8 (price only; payout = corporate check) | Promoter platform subscription also $20/month? | **Yes — $20/month** | Same Model A as clubs; simple catalog | OPEN |
| VIP-B-21 | Billing §14 Q13 | Revenue recognition system: QuickBooks Online or Xero? Daily or monthly sub recognition? Map chart now? | **QuickBooks Online · monthly recognition · map chart at Phase 6** | Common for US SMBs; CSV export covers beta | OPEN |
| VIP-B-22 | Billing §14 Q15 | Confirm 3–5 letter club codes for numbering (e.g. `DEC`, `LIMA`)? | **Yes — Master Admin sets code at certification** | Stable receipt / invoice / statement prefixes | OPEN |

---

## F — Brand / origin / beta rollout

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-P-13 | Proposal §20 Q14 · cutover rule | Canonical origin for booking / embed / API links: `www.floqr.com` or `www.floqr.app`? | **`https://www.floqr.com`** | Matches cutover canonical origin; single helper | **DECIDED Oct 16 2026** — B: `https://www.floqr.app` (canonical host for VIP booking/embed/API links). **Open conflict** with `cutoffrequirement.mdc` (`www.floqr.com` for main app) — owner to reconcile later if needed. |
| VIP-P-14 | Proposal §20 Q19 | Beta venues: Decades + Lima Twist first? Existing `clubLocations` ids? | **Yes those two · confirm/create ids at Phase 1** | Maps already ingested; owner knows both rooms | **DECIDED Oct 16 2026** — D: First beta venues: Decades, Lima Twist Club, Aurelia (`temp-democlub-1`). |
| VIP-P-15 | Proposal §20 Q21 | Block Live until both translation tiers pass? Which languages get counsel Terms first? | **Block Live until tiers pass · Terms EN first, then FR/ES** | Matches `vip-reservations-translation-incomplete.mdc` | OPEN |
| VIP-P-16 | Proposal §20 Q22 | Product name: “VIP Tables”, “VIP Reservations”, or a protected brand? | **VIP Reservations** (protected brand string) | Matches feature key `vipReservations` and F&S naming | **DECIDED Oct 16 2026** — C: Product brand name **VIP ReserV** (owner spelling). Protected / never-translate. |

---

## G — Other

| ID | Section | Question | Recommended default | Why recommended | Status |
|---|---|---|---|---|---|
| VIP-B-23 | Billing §14 Q16 | Retention: 7 years receipts/invoices/ledger/statements; 13 months notification delivery logs? | **Confirm as written** | Aligns with finance + PCI-ish log practice already in proposal | OPEN |
| VIP-B-24 | Billing §14 Q17 | Schedule separate fixes: VIP receipt SMS via `sendTwilioMessagesApi`; stop redactor masking `FLOQR-…` invoice numbers? | **Yes — schedule before VIP Functions ship** | Open security / ops findings; do not copy the bug into VIP | OPEN |

---

## Batch 1 — answer these first (critical)

At most 8. Use for AskQuestion immediately. **★** = recommended option.

| ID | Prompt (short) | Options |
|---|---|---|
| VIP-B-01 | How should VIP deposits charge through Stripe Connect? | ★ `destination` — Destination charges + `on_behalf_of` club · `direct` — Direct charges on Standard accounts · `decide_later` — Defer (blocks Connect build) |
| VIP-B-02 | Must $20/mo (Model A) clubs still finish Stripe Connect to take deposits? | ★ `connect_required` — Yes, Connect required · `no_connect_model_a` — No, FloqMedia can hold/remit · `model_a_no_deposits` — Model A clubs cannot take card deposits |
| VIP-B-03 | What does Model B “% of collected fees” cover, and default %? | ★ `deposits_10` — Deposits + prepaid extras only @ 10% · `deposits_only_10` — Deposits only @ 10% · `incl_invenue_10` — Also in-venue spend @ 10% · `other_pct` — Same scope as ★ but different % (say in chat) |
| VIP-B-05 | Default amount charged at booking? | ★ `full_minimum` — Full minimum prepay · `deposit_50` — ~50% deposit · `deposit_25` — ~25% deposit · `club_chooses` — No platform default; club sets per night |
| VIP-B-10 | Allow Model B (% fee) for POS and pay-at-venue clubs (invoice + attestation)? | ★ `allow_bc` — Yes, allow (b) and (c) · `path_a_only` — Model B only when FLOQR collects (path a) · `a_and_b` — Paths (a) and (b) only |
| VIP-P-13 | Canonical host for VIP booking / embed / API links? | ★ `floqr_com` — `https://www.floqr.com` · `floqr_app` — `https://www.floqr.app` · `helper_both` — Helper supports both; Pages stays github.io until cutover |
| VIP-P-16 | Public product name (also protected from translation)? | ★ `vip_reservations` — VIP Reservations · `vip_tables` — VIP Tables · `brand_later` — Placeholder “VIP Reservations”; invent brand before Live |
| VIP-P-14 | First beta venues? | ★ `decades_lima` — Decades + Lima Twist Club · `decades_only` — Decades only · `lima_only` — Lima Twist only · `other` — Different venues (name in chat) |

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
      { "id": "connect_required", "label": "Yes — Connect required (recommended)" },
      { "id": "no_connect_model_a", "label": "No — FloqMedia can hold/remit" },
      { "id": "model_a_no_deposits", "label": "Model A clubs cannot take card deposits" }
    ]
  },
  {
    "id": "VIP-B-03",
    "prompt": "What does Model B “% of collected fees” cover, and default %?",
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
      { "id": "club_chooses", "label": "No platform default — club sets per night" }
    ]
  },
  {
    "id": "VIP-B-10",
    "prompt": "Allow Model B (% fee) for POS and pay-at-venue clubs (monthly invoice + attestation)?",
    "options": [
      { "id": "allow_bc", "label": "Yes — allow paths (b) and (c) (recommended)" },
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
| A Money & Stripe | VIP-B-04, 06…09, 11…14 (9) + follow-up **VIP-B-03b** (Model B % number) — B-01/02/03/05/10 decided |
| B Roles & legal | VIP-P-01…08 (8) |
| C Booking UX & floor plans | VIP-P-09…12 (4) |
| D Notifications & receipts | VIP-B-15…19 (5) |
| E Promoters & ledger | VIP-B-20…22 (3) |
| F Brand / origin / beta | VIP-P-15 only (1) — P-13/14/16 decided |
| G Other | VIP-B-23…24 (2) |
| **Total OPEN** | **32** (+ VIP-B-03b follow-up) |
| Skipped (Oct 15) | Stripe fee payer · full-or-none refunds · promoter corporate check · Lima name · bars · area names · 360 timing |
| Decided Batch 1 (Oct 16) | VIP-B-01 · VIP-B-02 · VIP-B-03 · VIP-B-05 · VIP-B-10 · VIP-P-13 · VIP-P-14 · VIP-P-16 |
