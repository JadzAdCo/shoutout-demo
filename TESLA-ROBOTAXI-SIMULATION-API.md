# FLOQR Pickup: Robotaxi Simulation and Proposed Provider API

Version 29.07

## Prototype boundary

FLOQR Pickup is currently a simulation. It does not charge a card, dispatch a vehicle, represent a live Tesla integration, or claim that Tesla exposes a third-party Robotaxi booking API. Vehicle, location, driver-mode, remote-safety-person, map, distance, charge, fare, and ETA data in the prototype are fictional.

The production integration is designed as a provider adapter. FLOQR can replace the simulation adapter with a Tesla-approved booking API if one becomes available through a future commercial collaboration. The current Tesla Fleet API documentation concerns authorized vehicle access and vehicle commands; it is not used as a ride-booking API by this build.

## Four booking modes

| Mode | Purpose | Required fields | Payment choices |
| --- | --- | --- | --- |
| `onDemand` | Request the closest eligible vehicle now | pickup, destination | organizer |
| `scheduled` | Reserve a future pickup | pickup, destination, scheduled time/time zone | organizer |
| `forAnother` | Request a ride for another FLOQR patron | recipient, pickup, destination | organizer pays, recipient pays, recipient approves and pays |
| `shared` | Add one to three FloqR patrons, including separate drop-offs | companions and their drop-offs | organizer pays, split evenly, each rider pays their route leg |

## Proposed REST API

Base URL: `https://api.floqr.com/pickup/v1`

Authentication: OAuth 2.0 bearer token plus `Idempotency-Key` for every create, pay, cancel, or update operation. Suggested scopes are `pickup.quotes:read`, `pickup.rides:write`, `pickup.rides:read`, and `pickup.webhooks:write`.

### Create a quote

`POST /quotes`

```json
{
  "provider": "tesla-robotaxi",
  "bookingMode": "shared",
  "pickup": {"address": "1400 K St NW, Washington, DC 20005, United States"},
  "destination": {"address": "1223 Connecticut Ave NW, Washington, DC 20036, United States"},
  "companions": [
    {"floqrUserId": "user_201", "dropoff": {"address": "Zebbies Garden DC"}},
    {"floqrUserId": "user_316", "dropoff": {"address": "Dupont Circle, Washington, DC"}}
  ],
  "paymentArrangement": "individualLegs"
}
```

```json
{
  "quoteId": "qt_01JRX27",
  "currency": "usd",
  "fareCents": 1840,
  "fareExpiresAt": "2026-07-14T21:16:00Z",
  "pickupEtaMinutes": 6,
  "tripEtaMinutes": 14,
  "distanceToPickupMiles": 1.8,
  "routeDistanceMiles": 4.7,
  "paymentShares": [
    {"floqrUserId": "organizer", "amountCents": 740},
    {"floqrUserId": "user_201", "amountCents": 510},
    {"floqrUserId": "user_316", "amountCents": 590}
  ]
}
```

### Create and authorize a ride

- `POST /rides` creates a ride from a valid quote.
- `POST /rides/{rideId}/payment-authorizations` records organizer, recipient, split, or per-leg authorizations.
- `POST /rides/{rideId}/confirm` sends an authorized ride to the provider adapter.
- `GET /rides/{rideId}` returns live status, vehicle confidence data, route, riders, and payment state.
- `POST /rides/{rideId}/cancel` requests cancellation and returns any fee.
- `POST /rides/{rideId}/companions` adds a companion before provider lock.
- `PATCH /rides/{rideId}/companions/{companionId}` updates a drop-off or payment choice.

Example ride response:

```json
{
  "rideId": "ride_01JRX27",
  "bookingMode": "onDemand",
  "status": "vehicle_en_route",
  "simulation": true,
  "vehicle": {
    "providerVehicleId": "RX-2047",
    "model": "Tesla Model Y Robotaxi",
    "tag": "FLOQR-RX27",
    "licensePlate": "SIM-RX27",
    "color": "Deep Blue Metallic",
    "currentLocation": {"display": "17th St & K St NW"},
    "distanceToPickupMiles": 1.8,
    "batteryPercent": 84,
    "estimatedRangeMiles": 239,
    "seats": 4,
    "accessibility": ["service_animal", "foldable_wheelchair_storage"]
  },
  "operation": {
    "drivingMode": "autonomous",
    "remoteSafetyContact": {"displayName": "Aurora M.", "simulated": true}
  },
  "eta": {"pickupMinutes": 6, "tripMinutes": 14},
  "payment": {"status": "authorized", "charged": false, "fareCents": 1840, "currency": "usd"}
}
```

## Ride states and webhooks

Canonical state order:

`quote_created` -> `payment_pending` -> `payment_authorized` -> `vehicle_assigned` -> `vehicle_en_route` -> `vehicle_arriving` -> `waiting_at_pickup` -> `rider_verified` -> `in_trip` -> `completed`

Terminal states: `cancelled`, `provider_declined`, `payment_failed`, `no_show`, `safety_hold`.

Provider-to-FLOQR webhook events:

- `ride.vehicle_assigned`
- `ride.vehicle_location_updated`
- `ride.eta_updated`
- `ride.arriving`
- `ride.waiting_at_pickup`
- `ride.started`
- `ride.completed`
- `ride.cancelled`
- `ride.safety_hold`
- `vehicle.charge_warning`

Webhook requests should use timestamped HMAC-SHA256 signatures, five-minute replay tolerance, event IDs for deduplication, and retry with exponential backoff.

## Confidence, privacy, and safety requirements

- Show vehicle tag, plate, color, model, charge, range, distance, pickup ETA, live status, accessibility, and safety-contact method before boarding.
- Do not expose the exact live vehicle position until a ride is confirmed.
- Share companion data only with explicit invitation and payment consent.
- Treat pickup/drop-off addresses and live route data as sensitive location data with short retention.
- Require provider-signed state updates; never infer a real dispatch from client-side animation.
- Separate `simulation` and `providerConfirmed` fields so mock and production rides cannot be confused.

## Current implementation

The browser prototype writes simulated records to `pickupRequests`. Every record includes `simulation: true`, `noVehicleDispatched: true`, a fictional vehicle snapshot, booking mode and companion/payment choices, mock-payment status, and animated ride status. The production adapter should write provider IDs and signed provider event IDs only from trusted server functions.
