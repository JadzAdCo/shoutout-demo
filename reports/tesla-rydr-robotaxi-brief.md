# FloqR × Tesla Robotaxi — Business Brief

**Product:** RydR (FloqR mobility)  
**Audience:** Tesla Robotaxi partnership / business development  
**Classification:** Partner briefing — not a live booking-API claim  
**Date:** 19 November 2026

---

## 1. Executive summary

Tesla Robotaxi is a vehicle, routing, and safety network. What it does not yet have, at nightlife scale, is **intent**: who is going out, to which club, on which night, with how many people, when the room actually empties, and which curb is legal to use.

**FloqR** is a nightlife operating system. Patrons use it to find venues, book tables, join guest lists, message friends, pay for in-club experiences, and hail a ride. **RydR** is FloqR’s mobility product. It is already designed around Tesla Robotaxi as the primary autonomous path (with an Ultra Luxury chauffeur path as a complementary premium tier).

The partnership thesis is simple:

> FloqR supplies **verified nightlife demand, destinations, party composition, and predicted surge**. Tesla supplies **autonomous vehicles, dispatch, and in-trip safety**. RydR is the product surface that joins the two.

Nightlife is one of the hardest mobility problems Tesla will face: late hours, clustered demand, curb congestion, mixed party sizes, age-restricted venues, and “get me home after last call” spikes that generic hail apps see only after they happen. FloqR sees those trips **forming** — in Search, VIP holds, guest lists, event calendars, and friend groups — hours before a patron opens a ride app.

This brief describes FloqR, the RydR product, the datapoints already in the platform, and the concrete ways those datapoints can **augment Tesla Robotaxi** rather than compete with it.

---

## 2. What FloqR is

FloqR (brand: **FloqR**) is a consumer and venue platform for nightlife, lounges, clubs, and live events. It is not a generic super-app. Every product sits on the same identity, venue, event, notification, and billing core:

| Product | Role | Why it matters to Robotaxi |
|---|---|---|
| **Search / BOT DEE** | “I want a ride,” “take me to the club,” venue discovery | Natural-language ride intent + nearest nightlife destinations |
| **RydR** | Mobility: Robotaxi hail + Ultra Luxury chauffeur | Tesla-facing demand and trip context |
| **VIP reserV** | Table / booth booking with party size, deposit, night | Known occupancy and timed arrivals |
| **Guest lists** | Night-of entry campaigns | Headcount and show-up windows |
| **ShoutOut** | Paid messages on in-venue LED boards | In-room activity and dwell signal |
| **floqCast** | Patron live video on the venue’s secondary LED | Peak-energy / still-in-room signal |
| **Mingl** | Patron social graph and chat | Shared rides among known companions |
| **BartR** | In-app commerce | Pre- and post-night spend adjacency |
| **Club Admin** | Hours, events, staff schedules, door ops | Official curb, close time, staffing |

Venues onboard with a **verified street address**, hours, age policy, dress code, genres, DJs, promoters, amenities, and weekly events. Patrons onboard with a signed-in identity, structured home/pickup address, language, and (optionally) friends and reservations.

FloqR already operates a **provider-adapter** model for mobility. RydR is not trying to become a second Tesla app. It is trying to become the **nightlife channel** that sends Tesla high-quality, consented trip requests with destination and party context Tesla would otherwise have to guess.

---

## 3. What RydR is today

**RydR** (casing: RydR) is FloqR’s mobility product. Search phrases such as “book a ride,” “hail,” “robotaxi,” or “get me there” route into RydR.

Two modes are productized:

1. **Robotaxi** — autonomous hail, designed for Tesla Robotaxi (Model Y class in the current experience).
2. **Ultra Luxury** — chauffeur-class arrivals (preview; complements Robotaxi for bottle-service / VIP drop-offs that still want a human chauffeur).

### Honest current state (important for Tesla)

RydR is a **hybrid prototype**, not a live Tesla dispatch:

| Layer | Status |
|---|---|
| Patron identity, venue destination, structured pickup address | **Live** in FloqR |
| Four booking modes (on-demand, scheduled, for another patron, shared) | **Built** |
| Trip-fare checkout (Stripe, FloqR merchant of record) | **Live in demo** |
| Vehicle matching, map, ETA, charge, tag/plate confirmation | **Simulated**, clearly labeled |
| Tesla third-party booking API | **Not public.** FloqR records a handoff to [tesla.com/robotaxi](https://www.tesla.com/robotaxi) |
| Production adapter | **Specified** — swap simulation for a Tesla-approved API without changing the patron product |

FloqR does **not** use Tesla Fleet API as a ride-hailing API. Fleet API is vehicle access and commands. RydR is a **booking / quote / state** integration, which Tesla would need to authorize commercially.

That gap is the partnership. The product, datapoints, and ride state machine are already shaped for it.

### Booking modes Tesla would receive

| Mode | Patron job | What Tesla gets |
|---|---|---|
| **On-demand** | “Take me to the club now.” | Pickup + verified venue drop-off, now |
| **Scheduled** | “Pick me up at 10:40 for a 11:00 reservation.” | Future pickup locked to a night / table hold |
| **For another FloqR** | Promoter, host, or friend sends a car | Recipient identity + who pays |
| **Shared** | 2–4 patrons, optional separate drop-offs | Occupancy, multi-stop, split or organizer pay |

Payment arrangements already exist: organizer pays, recipient pays, recipient approves and pays, split evenly, or each rider pays their route leg. Tesla can remain the **trip operator**; FloqR can remain the **nightlife merchant and identity layer**, or Tesla can take fare — that is a commercial choice, not a product blocker.

### Ride states (designed for a provider webhook)

Canonical order:

`quote` → `payment` → `vehicle assigned` → `en route` → `arriving` → `waiting at pickup` → `rider verified` → `in trip` → `completed`

Terminal: cancelled, provider declined, payment failed, no-show, safety hold.

RydR already shows Tesla-class confidence fields **before boarding**: model, vehicle tag, plate, color, charge %, estimated range, seats, accessibility notes, pickup ETA, trip ETA, driving mode, remote safety contact. Exact live vehicle position is withheld until a ride is confirmed — a privacy rule FloqR is willing to keep in production.

---

## 4. Why nightlife is a Robotaxi problem Tesla should want solved

Generic ride-hailing treats a club drop-off like any other pin. Nightlife is different:

- **Demand is event-shaped**, not uniform. Friday 23:30–01:00 inbound; 02:30–04:30 outbound.
- **Destinations are clustered.** Dupont, U Street, Ivy City, a beach-club corridor — many parties, few curbs.
- **Party size is the product.** A VIP table of six is not six independent Ubers.
- **The destination is a venue with rules.** 21+, dress code, guest list cutoff, valet, “no ride-hail in the front drive.”
- **The return trip is the valuable one.** Patrons are tired, possibly impaired, and least willing to hunt for a car. Autonomous, no-driver Robotaxi is a **safety story** here, not only a cost story.
- **Staff go home on a schedule.** DJs, bottle service, security, and hosts end shifts together.

Tesla’s network optimization improves if it knows *which blocks will surge at 2:40 a.m.*, *which curb is the club’s official drop-off*, and *whether the rider is a party of one or four*. FloqR already stores those facts as **venue and event datapoints**, not as after-the-fact GPS traces.

---

## 5. FloqR datapoints that augment Robotaxi

All of the following exist in FloqR’s model today. Sharing with Tesla would be **consented, purpose-limited, and minimized** (see §8). The value is the *existence* of the data in a nightlife graph Tesla does not have.

### 5.1 Verified destinations (venues)

Every onboarded club/location carries a canonical identity Tesla can treat as a **named POI**, not a raw geocode:

| Datapoint | Example | Robotaxi use |
|---|---|---|
| `locationId` (stable slug) | `decades-washington-dc` | Durable POI key across nights |
| Brand + location name | Decades, Onyx Rooftop Lounge | In-car destination label |
| Full street address, city, region, postal, country | 1815 M Street NW, Washington, DC 20036 | Routing + geocode QA |
| Coordinates (stored or city-resolved) | lat/lng | Dispatch radius, deadhead |
| Telephone, website, Instagram | ops / rider confirm | Exception handling |
| Venue type / categories | rooftop, beach club, lounge, dinner theater | Curb class, dwell time |
| Time zone | America/New_York | Schedule vs local close |

**Augmentation:** Tesla stops treating “the club” as an address string. It becomes a **known drop-off node** with hours, age rules, and a preferred curb.

### 5.2 When the room is actually open (hours and events)

| Datapoint | Robotaxi use |
|---|---|
| Hours summary + **structured weekly hours** (`hoursStructured`) | Pre-position vehicles before open; stop inbound after last entry |
| Hour exceptions (holidays, takeovers) | Avoid false demand on dark nights |
| Recurring nights (`eventDay`, `eventTime`, `eventDate`) | Thursday vs Saturday fleet plans |
| Event name, description, genres, DJs, promoters | Demand intensity (headline DJ ≠ quiet lounge) |
| Age policy (`18+` / `21+`) | Do not dispatch a minor to a 21+ door |
| Dress code | Not a routing input; useful for Ultra Luxury vs Robotaxi mix |
| Entry cutoff notes | Inbound hail cutoff (“doors close 1:30”) |
| Ticket / VIP / bottle URLs | Paid intent = higher show-up probability |

**Augmentation:** Tesla can **forecast inbound and outbound windows per venue**, not city-wide. End-of-night surge is a first-class FloqR target: ride requests with *venue event context*.

### 5.3 Curb and site operations (what generic maps miss)

Nightlife venues have unofficial rules that break autonomous drop-off:

- Valet vs ride-hail lane
- Rooftop vs street-level entrance
- “Use the alley / garage / K Street side”
- Emergency exits and fire lanes that must never be a pin

FloqR’s venue profile already stores **amenities** (valet, bottle service, private events), **venue space** on events (rooftop / main / beach), and Club Admin as the operator who can designate a **geofenced pickup/drop-off zone**. Target RydR architecture: one official zone per venue, published to the provider.

**Augmentation:** Tesla gets a **club-approved curb polygon** instead of dropping a Robotaxi in the valet stack or on a crosswalk. That is operational safety and neighborhood goodwill.

### 5.4 Patron identity and pickup (the origin)

RydR pickup is a **structured address**, not a single text box — street number, street name, city, state/province, ZIP or postal — composed into `taxiPickupAddress`. Saved labels already exist:

- Home  
- Preferred Home Pickup (the curb the robotaxi should actually use)  
- Work  
- Other  

Locale follows the patron’s country (US ZIP vs Canada/other postal). Height, phone (E.164), language, and UI language live on the same profile. Pickup address is **private** (not a social datapoint).

GPS is used for “venues near me” with foreground disclosure; **client IP is never stored**.

**Augmentation:** Tesla receives a **repeatable, structured origin** and a preferred-home-pickup that may differ from mailing address (apartment rear alley, hotel porte-cochère). Fewer failed pickups, fewer “walk to the pin” disputes.

### 5.5 Party composition (occupancy is the product)

| Source | Signal | Robotaxi use |
|---|---|---|
| RydR shared ride (up to 3 companions + organizer) | Occupancy 2–4, optional **separate drop-offs** | Seat check, multi-stop routing, fare legs |
| VIP reserV | `partySize`, `maxCapacity`, `includedGuests`, table/section, night | Arrival window; outbound party of N at close |
| Guest list requests | Headcount for a named night | Soft demand; no-show risk |
| Mingl connections | Consented companions | Shared hail without exchanging phone numbers |
| “For a FloqR” | Ride gifted to another patron | Promoter / host / parent-of-group flows |

Vehicle snapshot in RydR already includes **seats (4)** and accessibility: service-animal ready, foldable wheelchair storage. That maps to Tesla Robotaxi cabin constraints.

**Augmentation:** Tesla can **reject or upsize** before dispatch (party of 5 → two vehicles or luxury path), and can **batch compatible drop-offs** toward the same corridor at closing time.

### 5.6 In-venue liveness (dwell and exit prediction)

FloqR is unique among ride apps because the patron is **still in the product** after they arrive:

| Signal | Meaning for dispatch |
|---|---|
| VIP table still held / checked in | Party is in-house; outbound hail is later |
| Door scan (`vip-door`) check-in / no-show | Arrival confirmed vs wasted inbound |
| ShoutOut approved and playing on the LED | Patron is in the room *now* |
| floqCast live on Display 2 | Peak energy; do not pull cars to the curb yet |
| Guest list redeemed | Through the door |
| Staff Work Calendar shift end | Employee outbound wave (predictable to the minute) |
| Last-call / hours end | Start staging vehicles 20–40 minutes prior |

FloqR’s technical target explicitly includes **predicting end-of-night ride demand** from these signals.

**Augmentation:** Tesla pre-positions Robotaxis on the right block **before** the surge hits the public network — the same advantage airlines have when they know gate close times.

### 5.7 Commerce and willingness to pay

RydR already runs **real trip-fare checkout**. Adjacent FloqR payments (VIP deposits, ShoutOuts, guest products) are a **propensity** signal: a patron who prepaid a table is more likely to keep a scheduled hail and less likely to no-show.

Receipts already carry venue, night, amount, and last-4 card — the same descriptive style Tesla would want for a Robotaxi trip receipt (“Robotaxi to Decades, Fri 11:00 p.m.”).

**Augmentation:** Higher **show-up rate** on scheduled trips; optional FloqR-billed fare so Tesla is paid without the patron leaving the nightlife app.

### 5.8 Language, market, and accessibility

FloqR chrome ships in **11 languages** (en, de, fr, es, it, pt, ru, el, pl, nl, ar). Pickup locale follows country. Accessibility notes are already on the vehicle card.

**Augmentation:** Tesla Robotaxi in-car and pre-trip copy can inherit the patron’s FloqR language. Accessibility flags can be a **dispatch constraint**, not a post-arrival surprise.

### 5.9 Advertising and in-car / pre-trip moments (optional)

RydR already has a **sponsored interstitial** before hail (FloqR Media slot, 8-second hold, skip allowed). Club campaigns can target the RydR surface (“hail, then throw a ShoutOut”).

This is not required for a Tesla partnership. It is a **revenue adjacency**: Tesla could decline ads in-car (FloqR recommendation: keep the Robotaxi cabin ad-free) while FloqR keeps the pre-hail sponsor slot on the phone.

---

## 6. Use cases (how FloqR + Tesla should work together)

### Use case A — “Take me to the club” (inbound, on-demand)

**Today in FloqR:** Patron is signed in → Search or BOT DEE → RydR → destination **locked to the club’s verified address** → structured pickup → pay → (today: simulated) hail.

**With Tesla:** Quote from Tesla network using FloqR origin + venue POI. Vehicle assigned with tag/plate/color/charge. Patron confirms curb and vehicle. Tesla drives; FloqR shows status.

**Tesla gain:** High-intent nightlife trips with a **clean destination** and a **repeat origin**.

### Use case B — Scheduled hail tied to a VIP table

Patron holds table C10 at Decades for Friday, party of four, doors 10 p.m. RydR offers “Pick us up at 10:25” from Preferred Home Pickup.

**Tesla gain:** **Reservable utilization** instead of random inbound. If the hold expires or the table is cancelled, FloqR can cancel the hail before a car moves.

### Use case C — Shared ride among Mingl friends

Three patrons going to the same lounge, one continuing to a second afterparty. RydR shared mode already collects companions and per-person drop-offs, with organizer / split / per-leg pay.

**Tesla gain:** **Occupancy** and a **multi-stop** that is socially consented (not a stranger pool). Better than anonymous ride-share for safety optics.

### Use case D — Promoter or host sends a car (“For a FloqR”)

A promoter pays for a guest’s inbound Robotaxi. Recipient approves in FloqR Inbox. Tesla still verifies the rider at the door of the car.

**Tesla gain:** **B2B nightlife spend** (promoters, tables, brands) without Tesla building promoter tooling.

### Use case E — End-of-night surge (the core Robotaxi nightlife loop)

Club Admin hours say Saturday close 3:00 a.m. VIP check-ins and ShoutOut volume show a full room. At 2:20 a.m. FloqR predicts outbound demand of *N* parties of 1–4 within a three-block radius.

**Tesla gain:** **Staging**, not chasing. Cars wait on the club-approved curb polygon. Patrons tap “RydR home” with Home / Preferred Home Pickup already filled. Impaired driving alternative is the safety narrative.

### Use case F — Staff and talent shift-end

Work Calendar publishes when security, bartenders, and DJs end. Those trips are **punctual, clustered, and recurring**.

**Tesla gain:** A second, reliable nighttime demand class — employees, not only patrons — with known destinations (often the same metro nodes).

### Use case G — Age-gated and no-show hygiene

Venue is 21+. FloqR can refuse to send a Robotaxi to that door for a profile that cannot meet policy (where age is verified). Guest-list no-shows and VIP no-shows cancel inbound hails.

**Tesla gain:** Fewer **wasted deadheads** to doors that will turn the rider away.

### Use case H — Official Tesla app handoff (if Tesla prefers to own the cabin)

If Tesla does not open a third-party booking API, FloqR still helps: it collects **intent, party, and POI**, then deep-links into Tesla’s official Robotaxi app with those fields. That is the current honest fallback (`provider-handoff-required`).

**Tesla gain:** FloqR becomes a **demand-gen and destination-quality** channel even without dispatch control.

### Use case I — Ultra Luxury vs Robotaxi mix

Bottle-service arrivals may still want a chauffeur; the same patron wants Robotaxi home at 3:15 a.m. FloqR can split the night: luxury inbound, Robotaxi outbound.

**Tesla gain:** Robotaxi wins the **highest-volume, safety-sensitive leg** without fighting the valet brand at the door.

---

## 7. Proposed technical partnership (adapter, not a fork)

FloqR’s specified production shape:

- Provider id: `tesla-robotaxi`
- FLOQR Pickup API (quotes, rides, payment authorizations, companions, cancel)
- Tesla → FloqR webhooks: vehicle assigned, location, ETA, arriving, waiting, started, completed, cancelled, safety hold, charge warning
- HMAC-signed events, idempotency keys, simulation vs `providerConfirmed` flags so mock and live never mix

**What FloqR is asking Tesla for (commercial + API):**

1. A **ride-booking API** (quote, accept, cancel, state) distinct from Fleet API.  
2. Permission to show **Tesla Robotaxi** as the RydR autonomous vehicle class.  
3. Ability to pass **named venue POIs** and **curb geofences**.  
4. Occupancy / accessibility constraints on quote.  
5. Optional: Tesla takes dispatch + fare; FloqR remains identity and nightlife context — or FloqR remains merchant of record and remits Tesla.

**What Tesla would not have to build:** nightlife CRM, guest lists, VIP maps, club admin hours, promoter pay-for-guest, 11-language patron chrome, or in-venue dwell signals.

---

## 8. Privacy, safety, and trust (non-negotiable)

Nightlife data is sensitive. A Tesla partnership should be **narrower** than “share the FloqR graph.”

Proposed rules:

- **Consent.** Location and ride sharing are purpose-limited. Pickup addresses stay off social profiles.  
- **Minimize.** Tesla gets origin, destination POI, occupancy, accessibility, schedule — not Mingl chat, not ShoutOut copy, not card PAN.  
- **No stored client IP** on patron records (FloqR policy today).  
- **Do not expose live vehicle position** until the ride is confirmed.  
- **Rider verification** at the car remains Tesla’s. FloqR identity is a complement, not a replacement for Tesla’s safety stack.  
- **EU/UK patron PII** is designed to be hostable in-region (GDPR residency is a FloqR compliance track; US-central is the live default, not the end state).  
- **Impaired driving.** RydR’s job is a safe autonomous alternative after last call — not a surveillance feed of who was in which club.

Remote safety specialist (Tesla’s model) maps cleanly onto RydR’s existing “remote safety contact” slot in the rider UI.

---

## 9. Commercial sketch (for discussion, not a term sheet)

Possible models (not mutually exclusive):

| Model | Who the patron pays | Tesla role | FloqR role |
|---|---|---|---|
| **A. Channel** | Tesla app | Dispatch + fare | Demand, POI, deep link |
| **B. Merchant** | FloqR (Stripe), as in the current demo | Dispatch API, invoice FloqR | Checkout, receipts, nightlife UX |
| **C. Scheduled capacity** | Either | Guaranteed vehicles in a geofence at close | Forecast + venue contracts |
| **D. Venue fleet** | Club or promoter | Dedicated Robotaxis for a night | Club Admin booking |

Nightlife fares are short, high-frequency, and peak at hours when airport and commute demand is low. That is **complementary utilization** for a Robotaxi network, not a cannibal of Tesla’s daytime trips.

---

## 10. What success looks like (first market)

A concrete first slice, using FloqR’s existing Washington, DC nightlife graph (clubs such as Decades, rooftops, lounges — already onboarded with addresses, hours, and nights):

1. Tesla enables a **booking or handoff** path for RydR in one metro.  
2. Inbound: on-demand + scheduled-to-VIP.  
3. Outbound: end-of-night staging at **club-approved curbs**.  
4. Shared rides limited to **known FloqR companions** (not open pooling).  
5. KPIs Tesla and FloqR can share: show-up rate vs generic hail, deadhead miles into nightlife clusters, time-to-pickup at 2–4 a.m., no-show rate on scheduled VIP hails, safety incidents vs human ride-hail.

No public claim of a live Tesla dispatch should be made until Tesla authorizes the API. FloqR’s current UI already refuses to fake that claim.

---

## 11. Ask

FloqR is requesting a **Robotaxi partnership conversation** with Tesla to:

1. Confirm whether a **third-party ride-booking API** (or official-app deep link with structured fields) will exist for licensed nightlife channels.  
2. Pilot RydR as a **demand and destination layer** in one US nightlife market.  
3. Align on **POI + curb geofence** data Tesla will accept from venues.  
4. Align on **privacy minimization** and rider-verification boundaries.

RydR is built so that when Tesla is ready, FloqR replaces a simulation adapter — it does not reinvent the patron product.

---

## Appendix A — RydR fields Tesla would see on a quote/ride

From the current FloqR pickup contract (simulation today; production adapter tomorrow):

- `bookingMode`: onDemand | scheduled | forAnother | shared  
- `pickup` structured address + optional saved label  
- `destination` = club verified address + `clubLocationId`  
- `scheduledFor` + time zone (scheduled mode)  
- `companions[]` with optional per-person `dropoff`  
- `paymentArrangement` / payer  
- Vehicle: provider vehicle id, model (Tesla Model Y Robotaxi), tag, plate, color, charge, range, seats, accessibility  
- Operation: autonomous driving mode, remote safety contact  
- ETA: pickup minutes, trip minutes, distance  
- Status machine and webhook events listed in §3  

## Appendix B — FloqR products in one sentence each

- **FloqR** — nightlife identity, venues, events, payments, and notifications.  
- **RydR** — get patrons and staff to and from the venue; Robotaxi-first.  
- **VIP reserV** — book a specific table/section for a night, with party size.  
- **ShoutOut** — paid LED messages in the room.  
- **floqCast** — patron live camera on the venue’s secondary board.  
- **Mingl** — friends and chat inside FloqR.  
- **BOT DEE** — plain-language help and routing (“book a ride”).  
- **BartR** — marketplace adjacent to the night out.

## Appendix C — Source of this brief

Grounded in FloqR product behavior and contracts: RydR / Pickup (`rydr.html`, `pickup.html`), Tesla simulation API note (`TESLA-ROBOTAXI-SIMULATION-API.md`), venue datapoints (`floqr-venue-datapoints.js`), patron pickup locale, VIP party-size model, and FloqR Technical Bible §2.5 (RydR target: event-aware rides, geofenced zones, end-of-night surge, Tesla adapter).
