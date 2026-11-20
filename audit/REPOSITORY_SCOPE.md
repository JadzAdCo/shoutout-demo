# Features SMARTview — repository scope (Phase 0)

Inspected: `github.com/JadzAdCo/shoutout-demo` (this workspace remote). No other repos were authorized.

Live product names in code (do **not** use the package’s BOT-DEE / FloqCAST spellings in UI):

| Package label | Code / brand |
|---|---|
| BOT-DEE | **BOT DEE** (`botDee`) |
| FloqCAST | **floqCast** |
| VIP reserV | **VIP reserV** (`vipReservations`) |
| ShoutOut | **ShoutOut** (`shoutOut`) |
| Mingl | **Mingl** (`mingl`) |
| Si-nema | **Si-nema** (`sinema`) |
| Si-tube | **not in this repo** |
| FLOQR | **FloqR** / FLOQR platform |

Existing SMARTviews (not a Features catalog): People, Venue (mock), Version, Room, ShoutOut SMARTpreview, VIP headless. Master Admin → Features Mgmt → BOT DEE → SMARTviews hosts mocks only.

Packaged Features & Services defaults (`functions/feature-services-core.js`): ShoutOut live; BOT DEE enabled+test; Mingl / BartR / RydR / floqCast / VIP / Site chrome / Si-nema **Off** unless Master Admin saved live flags. Live Firestore flags were **not** read this run (Firebase CLI not logged in).
