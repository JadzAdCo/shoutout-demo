# FloqR × Tesla Robotaxi — Business Brief

**Product:** RydR (FloqR mobility)  
**Audience:** Tesla Robotaxi partnership / business development  
**Emphasis:** Eventbrite + Ticketmaster event graph, club and entertainment venues  
**Classification:** Partner briefing — not a live Tesla booking-API claim  
**Date:** 19 November 2026

---

## 1. Executive summary

Tesla Robotaxi is a vehicle, routing, and safety network. What it does not have is a **live entertainment demand graph**: which club, comedy room, concert, or ticketed night is actually filling, at which address, at which door time, and when the crowd lets out.

**FloqR** is that graph. It is a nightlife and live-entertainment operating system for **clubs, lounges, rooftops, beach clubs, dinner theaters, comedy, concerts, promoter nights, and other entertainment venues**. Two industry rails already feed it:

| Rail | What FloqR uses it for |
|---|---|
| **Ticketmaster** | Concert, comedy, and ticketed-show discovery; venue + artist + start time; outbound ticket links; path to Partner / distribution for reserve and order confirmation |
| **Eventbrite** | Promoter-created nights, club takeovers, comedy, daytime entertainment; event pages, attendees/orders, webhooks, checkout customization |

The ticket is the **intent**. The onboarded club or entertainment venue is the **destination**. **RydR** is FloqR’s mobility product — designed around Tesla Robotaxi — that turns “I have a ticket / I have a table / I am on the guest list” into a consented inbound hail and a predicted outbound surge.

The partnership thesis:

> FloqR sits between **Ticketmaster / Eventbrite / the venue** and **Tesla Robotaxi**. Tesla does not need to become a ticketing company or a club CRM. FloqR already binds the show to a verified curb. RydR asks Tesla to move the people.

Generic ride-hail sees a pin after someone opens an app. FloqR sees the trip **forming** when the Eventbrite order is placed, the Ticketmaster show is listed, the club publishes Friday 11 p.m., or a VIP hold is taken — hours before last call.

---

## 2. What FloqR is (venues first, tickets attached)

FloqR is not a generic super-app. It is built so every night out has a **venue of record** and, when the night is ticketed, an **official ticket URL** on that same event.

### 2.1 Club and entertainment venues FloqR already classifies

Venues and dated shows are first-class objects (`clubLocations` + `events`), not search snippets. Types Tesla would treat as Robotaxi POIs:

**Venues (the building / curb)**

| Class | Examples |
|---|---|
| Nightclub | Weekly DJ nights, 21+ door, late close |
| Lounge / rooftop lounge / rooftop bar | Timed occupancy, valet, street vs rooftop entrance |
| Beach club / day club | Day-to-night dwell, different let-out than a 2 a.m. club |
| Bar / dinner theater | SAX-style entertainment rooms, earlier curtain |
| Club brand with many nights | Recurring Thu/Fri/Sat programming at one address |

**Entertainment events (the show, always tied to a venue)**

| Class | Typical ticket rail |
|---|---|
| Concert / ticketed show | Ticketmaster Discovery (and Partner when licensed) |
| Comedy show | Ticketmaster or Eventbrite detail page |
| Promoter event / club takeover | Eventbrite, Posh, Dice, Shotgun, venue box office |
| Daytime entertainment (festival, market, brunch party, pool party) | Eventbrite + official venue page |

FloqR never treats a Ticketmaster *search results* URL or an Eventbrite *directory* URL as the event. Operators (and crawlers) must land on **one event or venue detail page**. That is how Tesla gets a real address and a real start time instead of a search query.

### 2.2 What gets stored on every club / venue

Club Admin and discovery onboard a **complete public profile**, not a name pin:

| Group | Datapoints Tesla can use |
|---|---|
| Identity | Stable `locationId`, brand, location name, type, categories, tagline |
| Place | Street, city, region, postal, country, coordinates, time zone |
| Contact | Phone, email, official website, Instagram / Facebook |
| Door | Age policy, dress code, amenities (valet, bottle service, private events) |
| Clock | Structured weekly hours, exceptions, activity dates |
| Programming | Genres, DJs / artists, promoters, featured staff |
| Screens | In-room LED estate (dwell / “still in the building” signal) |

**Augmentation:** Tesla receives a **named entertainment POI** with hours and door rules, not “drop pin on nightlife.”

### 2.3 What gets stored on every night / ticketed show

FloqR does not ship thin stubs (title + day). Each event is meant to carry everything the venue or ticket page publishes:

| Field | Why it matters to Robotaxi |
|---|---|
| `eventName`, description | In-car / receipt label (“Robotaxi to Sueño at Decades”) |
| `eventDate` / recurring, `eventDay`, `eventTime`, start ISO | Inbound window (doors) and outbound window (let-out) |
| `genres`, `artists`, `featuredDjs` | Demand intensity (headline vs resident night) |
| `presentedBy`, `promoters` | Who is packing the room (Eventbrite organizer / TM attraction) |
| `agePolicy`, `entryCutoffNotes` | Do not hail a rider the door will turn away |
| `venueSpace` | Rooftop vs main room vs beach — different curb |
| **`ticketUrl`** | Canonical Eventbrite / Ticketmaster / Posh / venue box-office link |
| **`externalTicketProvider`** | `eventbrite`, `ticketmaster`, `posh`, … |
| `vipPassUrl`, `bottleServiceUrl` | Higher show-up, later outbound |
| `flyerUrl`, `eventsPageUrl`, `sourceUrls[]` | Provenance — which official page the extract came from |

If a club weekly page links out to Eventbrite or Ticketmaster (or Posh), that URL is stored on **the club’s event** and in club `sourceUrls`. The ticket is never an orphaned tab; it belongs to the same `locationId` Tesla would dispatch to.

---

## 3. Eventbrite and Ticketmaster — FloqR’s entertainment rails

This is the layer Tesla should care about. Clubs tell FloqR *where* and *when*. Ticketmaster and Eventbrite tell FloqR *that people have already committed to be there*.

### 3.1 Why ticketing is a Robotaxi input

A paid ticket is a **high-confidence trip**. Compared with a random hail:

- Destination is the **listed venue**, not a guessed address.  
- Start time is **published**. Doors and let-out are inferable.  
- Headcount is **order volume** (Eventbrite attendees / TM inventory), not a guess from cell-tower density.  
- No-show risk is lower than an unpaid “maybe I’ll go.”  
- Cancelled or postponed shows (TM / Eventbrite status) can **kill inbound hails** before a car moves.

FloqR’s job is to **join that ticket to the venue curb** and offer RydR at the two moments that matter: **arrive on time** and **leave safely**.

### 3.2 Ticketmaster

FloqR’s ticketing architecture treats Ticketmaster as three complementary capabilities (Master Admin already tracks them as partner slots):

| Capability | What FloqR takes | What Tesla gets |
|---|---|---|
| **Discovery API** | Events, venues, attractions, images, start times, outbound ticket links | Metro-scale **show calendar** at real venues |
| **Affiliate / distribution** | Tracked outbound ticket links (Impact) | Proof of paid intent without FloqR selling the ticket |
| **Partner API** | Official distribution: reserve, purchase, ticket/event retrieval | **Order-confirmed** occupancy — the strongest staging signal |

Discovery answers *what is on tonight*. Partner / order confirmation answers *how many people will actually be at that curb at 10:05 p.m. and 11:40 p.m.*

Comedy, concerts, and ticketed entertainment are first-class FloqR event types (`comedyShow`, `concert`, `ticketedShow`). Publishing rules for those types require **date, time, and artist** — the same fields a Robotaxi quote needs.

### 3.3 Eventbrite

Eventbrite is how **promoters and clubs** put a night on sale when it is not a Ticketmaster arena show:

| Capability | What FloqR takes | What Tesla gets |
|---|---|---|
| Public event pages + JSON-LD | Title, date, time, venue address, ticket URL, categories | Structured show record tied to a club POI |
| Eventbrite API (events, attendees, orders, webhooks) | Organizer-created inventory; checkout and attendee updates | Live **order and check-in** counts |
| Checkout customization | FloqR can remain in the nightlife session | Offer “add a Robotaxi” next to the ticket, not after the fact |

This is the weekly club takeover, the comedy room, the brunch party, the rooftop, the promoter Eventbrite that **is** the night. Those shows dump onto the same streets as resident club nights — often the same `locationId`.

### 3.4 How FloqR actually binds a ticket to a club

Three paths, all designed so Tesla never has to scrape Eventbrite or Ticketmaster:

1. **Club-owned events.** The venue (or FloqR onboarding) publishes the weekly night and **must** attach the live ticket URL the patrons use. Destination for RydR is the club’s verified address.  
2. **Source detail extraction.** Master Admin (and server extract `aiExtractPublicSourceUrl`) paste or fetch **one** Eventbrite, Ticketmaster, venue, or comedy **detail** page — not a search list. FloqR parses JSON-LD / metadata: date, time, address, ticket URL, source URL, categories, missing-datapoint status. Search-results URLs are rejected.  
3. **Trusted ticket hosts.** Ticketmaster, Eventbrite, Posh, Dice, Shotgun, RA are treated as trusted event sources when the URL is a detail page. Aggregator chrome is not allowed to replace the official venue.

BOT DEE / accounts profile already names the vendor slots: `BOTDEE_TICKETMASTER_DISCOVERY_API_KEY`, `BOTDEE_TICKETMASTER_PARTNER_API_KEY`, `BOTDEE_EVENTBRITE_API_KEY`. Live vendor HTTP is turned on when the commercial relationship and secret are in place. The **data model and venue join are already built** so Tesla does not wait on a greenfield schema.

### 3.5 What FloqR does *not* ask Tesla to do

Tesla should not integrate Eventbrite or Ticketmaster. FloqR already does. Tesla should accept a **ride request that already knows**:

- `clubLocationId` + verified address + curb zone  
- `eventId` + start / end / door cutoff  
- `externalTicketProvider` + `ticketUrl` (provenance, not for Tesla to scrape)  
- occupancy hint (party size, shared companions, optional ticketed headcount)  
- inbound vs outbound (`arrive` vs `leave`)

---

## 4. RydR — the Tesla-facing product on top of that graph

**RydR** is FloqR mobility. Search phrases such as “book a ride,” “hail,” “robotaxi,” or “get me to the show” land here. Destination is filled from the **venue’s verified address** (club or entertainment room), not free-typed by the patron.

Two modes:

1. **Robotaxi** — autonomous hail, designed for Tesla Robotaxi.  
2. **Ultra Luxury** — chauffeur-class arrivals (preview), for bottle-service doors that still want a human at inbound; Robotaxi still wins the late outbound.

### Honest current state (Tesla dispatch)

| Layer | Status |
|---|---|
| Venue + event graph, ticket URLs, structured pickup | **In product** |
| Four booking modes (on-demand, scheduled, for another patron, shared) | **Built** |
| Trip-fare checkout (Stripe) | **Live in demo** |
| Vehicle matching / map / ETA | **Simulated**, labeled |
| Tesla third-party booking API | **Not public.** Handoff to [tesla.com/robotaxi](https://www.tesla.com/robotaxi) |
| Production adapter | **Specified** — swap simulation for a Tesla-approved API |

FloqR does not use Tesla Fleet API as ride-hailing. RydR needs a **quote / accept / state** API Tesla would authorize.

### Booking modes (now with a ticketed event attached)

| Mode | Patron job | Tesla payload |
|---|---|---|
| **On-demand** | “Take me to the Eventbrite night / the club now.” | Pickup + venue POI + `eventId` |
| **Scheduled** | “Pick us up 35 minutes before doors.” | Future pickup locked to TM / Eventbrite start |
| **For another FloqR** | Promoter sends a car to a ticketed guest | Recipient + who pays |
| **Shared** | 2–4 patrons, optional extra drop-offs after the show | Occupancy, multi-stop |

Payment: organizer, recipient, approve-and-pay, split, or per-leg. Tesla can operate the trip; FloqR can remain nightlife merchant of record — commercial choice.

Ride states: `quote` → `payment` → `vehicle assigned` → `en route` → `arriving` → `waiting` → `rider verified` → `in trip` → `completed` (plus cancelled, declined, no-show, safety hold). Pre-board confidence fields already match Tesla-class UX: model, tag, plate, color, charge, range, seats, accessibility, remote safety contact. Live vehicle position is withheld until confirm.

---

## 5. Datapoints that augment Tesla Robotaxi

Sharing with Tesla is **consented, minimized, purpose-limited** (§9).

### 5.1 Ticket + show clock (Eventbrite / Ticketmaster)

| Signal | Source | Robotaxi use |
|---|---|---|
| Start ISO / `eventTime` / doors | TM Discovery, Eventbrite page/API, club calendar | Stage inbound 20–40 min before doors |
| Let-out / close / `entryCutoffNotes` | Venue hours + event | Stage outbound before the surge |
| Ticket URL + provider | `ticketUrl`, `externalTicketProvider` | Paid-intent flag; cancel hail if listing is cancelled |
| Artist / headliner | TM attraction, Eventbrite title, club `artists` | Weight demand (arena comedy vs resident DJ) |
| Promoter / `presentedBy` | Eventbrite organizer, club event | Recurring nights at the same curb |
| Age on the listing | TM / Eventbrite / club `agePolicy` | Skip illegal or door-reject trips |
| Attendee / order counts (API) | Eventbrite orders; TM Partner | **How many cars**, not only where |

### 5.2 Venue POI and curb

| Signal | Robotaxi use |
|---|---|
| `locationId`, brand, full address, lat/lng | Durable destination node |
| Venue class (club vs comedy vs rooftop vs beach) | Dwell time and let-out shape |
| Amenities: valet, private events | Avoid valet stack; use ride-hail lane |
| `venueSpace` (rooftop / main / beach) | Correct entrance |
| Club-approved geofence (RydR target) | Legal curb polygon |
| Time zone + structured hours | No inbound after last entry |

### 5.3 Patron origin

Structured pickup (street #, street, city, region, ZIP/postal) → `taxiPickupAddress`. Saved labels: Home, **Preferred Home Pickup**, Work, Other. Private (not social). GPS for nearby venues only; **IP never stored**.

### 5.4 Party and ticketed occupancy

| Source | Signal |
|---|---|
| RydR shared (up to 3 companions) | Seats, multi-stop after the show |
| VIP reserV `partySize` / table | Arrival window for bottle-service nights |
| Guest list | Soft headcount for free/reduced entry nights |
| Eventbrite attendee / TM order (when licensed) | Building-level occupancy |
| Mingl companions | Shared hail without exchanging phones |

Vehicle card already: 4 seats, service-animal, foldable wheelchair storage.

### 5.5 In-venue liveness (after the ticket is scanned)

FloqR stays open **inside** the club — something Ticketmaster and Eventbrite do not see:

| Signal | Dispatch meaning |
|---|---|
| Door / VIP check-in vs no-show | Arrival confirmed; cancel unused inbound |
| ShoutOut on the LED / floqCast live | Still in the room — delay outbound staging |
| Guest list redeemed | Through the door |
| Staff Work Calendar shift end | Talent and security outbound, timed |
| Hours / last call | Start staging 20–40 min prior |

Predicting **end-of-night ride demand** from event context is an explicit FloqR target.

---

## 6. Use cases (tickets + venues + Robotaxi)

### A — Ticketmaster concert / comedy let-out

A Ticketmaster comedy or concert listing is onboarded to a FloqR entertainment venue (address, door time, artist). Show ends ~11:20 p.m. FloqR stages outbound RydR to **Preferred Home Pickup** for patrons who opted in.

**Tesla gain:** Arena/club let-out is the classic failed hail. FloqR gives Tesla **when** and **which curb** from the TM clock, not from watching the map go red.

### B — Eventbrite promoter night at a club

A promoter sells Saturday on Eventbrite at an onboarded nightclub. `ticketUrl` lives on the club’s event. Patrons in FloqR see “Hail RydR — doors 10:30.” Shared ride for a party of three.

**Tesla gain:** **Weekly, repeating, ticketed demand** at the same POI — better than one-off pins. Eventbrite order webhooks can raise/lower staging.

### C — Club resident night with no TM page

Decades-style weekly night: club calendar + optional Posh/Eventbrite ticket link, VIP tables, guest list. Destination still the verified club address. Inbound scheduled to the table hold; outbound from close.

**Tesla gain:** The **un-ticketed majority** of nightlife still has a FloqR clock (hours, VIP, guest list) Tesla would otherwise miss.

### D — “Add a Robotaxi” on the ticket path

Patron completes Eventbrite checkout (or follows a TM outbound link) inside the FloqR session. RydR offers a **scheduled hail** to the same `eventId` before they close the phone.

**Tesla gain:** Capture the trip at **purchase**, not at 1:55 a.m. in the rain.

### E — Cancelled or postponed listing

TM / Eventbrite marks the show cancelled. FloqR cancels scheduled Robotaxis and does not stage the curb.

**Tesla gain:** Deadhead avoided. Generic apps still send cars to a dark marquee.

### F — Age-gated club vs all-ages Ticketmaster

Club event is 21+. Comedy listing is all-ages. FloqR applies the **event** age policy to the hail.

**Tesla gain:** Fewer door turn-aways after a paid autonomous trip.

### G — Shared post-show drop-offs

Four Eventbrite guests; two go home, one to an afterparty at a second FloqR venue. RydR shared + per-leg pay.

**Tesla gain:** Occupancy and a **second entertainment POI** on the same paid night.

### H — Promoter pays the car (“For a FloqR”)

Promoter or table host pays inbound Robotaxi for a ticketed guest. Recipient confirms in Inbox. Tesla still verifies the rider at the vehicle.

**Tesla gain:** B2B entertainment spend without Tesla building promoter tools.

### I — Staff and talent after a ticketed night

DJ, security, and hosts have Work Calendar end times after the Eventbrite close.

**Tesla gain:** A second, punctual outbound wave at the same curb.

### J — Tesla app handoff (if Tesla keeps the cabin)

FloqR still packages venue POI + event clock + party, then deep-links Tesla’s official Robotaxi app. Current honest fallback.

**Tesla gain:** FloqR remains **demand-gen and destination quality** even without dispatch control.

---

## 7. Proposed partnership (who integrates whom)

```
Ticketmaster ──┐
Eventbrite  ───┼──►  FloqR venue + event graph  ──►  RydR  ──►  Tesla Robotaxi
Club Admin  ───┘         (POI, curb, clock, party)
```

**FloqR integrates Eventbrite and Ticketmaster** (discovery, detail extract, ticket URL on the club event; API / Partner / attendee webhooks as credentials allow).  
**FloqR asks Tesla** only for ride quote, assign, state, and optional fare.

Tesla-facing adapter (already specified): provider `tesla-robotaxi`; quotes; rides; companions; HMAC webhooks (`vehicle_assigned`, `eta_updated`, `arriving`, `started`, `completed`, `cancelled`, `safety_hold`, `charge_warning`). Simulation vs `providerConfirmed` never mix.

**Ask of Tesla:**

1. Ride-booking API or structured official-app deep link.  
2. Accept **named venue POIs + event ids + curb geofences** from FloqR.  
3. Occupancy / accessibility on quote.  
4. Optional: Tesla takes fare; FloqR remains entertainment context — or FloqR MoR remits Tesla.

**Tesla does not build:** Ticketmaster/Eventbrite connectors, club CRM, guest lists, VIP maps, promoter pay-for-guest, 11-language nightlife chrome, in-room dwell.

---

## 8. First-market sketch (entertainment venues, not only clubs)

Washington, DC nightlife graph is already onboarded (clubs, rooftops, lounges, dinner theater) with addresses, hours, and ticketed nights. A Tesla pilot can be:

1. **Ticketed entertainment:** comedy / concert / promoter Eventbrite at FloqR venues — inbound scheduled to doors, outbound at let-out.  
2. **Club resident nights:** same curbs, hours-driven surge.  
3. Shared rides only among **known FloqR companions**.  
4. KPIs: show-up vs generic hail, deadhead into entertainment clusters, pickup time at let-out, cancelled-show deadhead avoided, 2–4 a.m. safety vs human ride-hail.

No public “live Tesla dispatch” claim until Tesla authorizes the API.

---

## 9. Privacy, safety, and trust

- Tesla gets origin, venue POI, event clock, occupancy, accessibility — **not** chat, ShoutOut copy, or card PAN.  
- Ticket URLs are provenance; Tesla need not receive attendee PII from Eventbrite/TM.  
- Pickup addresses stay private. No stored client IP.  
- Live vehicle position only after confirm.  
- Rider verification at the car remains Tesla’s.  
- EU/UK patron PII is designed to be hostable in-region.  
- RydR’s nightlife story is a **safe autonomous alternative after the show** — not a feed of who was in which room.

---

## 10. Commercial sketch (discussion, not a term sheet)

| Model | Patron pays | Tesla | FloqR |
|---|---|---|---|
| **A. Channel** | Tesla app | Dispatch + fare | Eventbrite/TM/venue demand + POI + deep link |
| **B. Merchant** | FloqR Stripe | Dispatch, invoice FloqR | Nightlife checkout + receipts |
| **C. Show capacity** | Either | Guaranteed vehicles at doors / let-out | Forecast from ticketed occupancy |
| **D. Venue night** | Club or promoter | Dedicated Robotaxis for a listing | Club Admin + Eventbrite organizer |

Entertainment trips peak when airport and commute demand is low. Ticketed **let-out** is complementary utilization, not a cannibal of Tesla daytime.

Affiliate note: FloqR’s near-term Ticketmaster path is outbound ticket links, then Impact tracking, then Partner checkout. **VIP / table / guest list** stay FloqR-owned (higher-margin venue transactions). Robotaxi is the last mile on all of those, not a ticket reseller.

---

## 11. Ask

FloqR is requesting a Robotaxi conversation with Tesla to:

1. Confirm a **booking API or structured deep link** for an entertainment channel that already joins **Eventbrite, Ticketmaster, and club venues**.  
2. Pilot RydR in one US market against **ticketed let-out + club close**.  
3. Align on POI / event-id / curb fields Tesla will accept.  
4. Align on privacy minimization (no TM/Eventbrite PII dump into Tesla).

RydR is built so Tesla replaces a simulation adapter. The venue and ticketing graph does not get reinvented.

---

## Appendix A — Payload Tesla would see

- `bookingMode`, structured `pickup`, destination = venue address + `clubLocationId`  
- `eventId`, `eventStart`, `eventEnd` / close, `arrive|leave`  
- `externalTicketProvider` (`ticketmaster` | `eventbrite` | `posh` | …), `ticketUrl` (optional provenance)  
- `scheduledFor`, companions + drop-offs, payment arrangement  
- Vehicle + autonomous mode + remote safety contact  
- ETA, distance, seats, accessibility  

## Appendix B — FloqR products (one line)

- **FloqR** — identity, **club & entertainment venues**, **Eventbrite/Ticketmaster-linked events**, payments, notify.  
- **RydR** — Robotaxi-first mobility to and from those venues.  
- **VIP reserV** — table/section for a night, party size.  
- **ShoutOut / floqCast** — in-room presence on venue LEDs.  
- **Mingl / BOT DEE / BartR** — friends, “book a ride,” adjacent commerce.

## Appendix C — Sources

RydR / Pickup product, `TESLA-ROBOTAXI-SIMULATION-API.md`, venue datapoints, event onboarding (ticket URL + `externalTicketProvider` on the club event), AI discovery Source Detail Extraction (Eventbrite / Ticketmaster **detail** pages, JSON-LD), ticketing partner notes (Discovery, Affiliate, Partner, Eventbrite API), FloqR Technical Bible §2.5 (event-aware rides, geofenced zones, end-of-night surge, Tesla adapter).
