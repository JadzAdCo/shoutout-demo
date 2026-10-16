# SCENE-LOCK — Aurelia VIP 3D geometry

Lock this document for every AI still, clip, and full movie. If generated pixels disagree, **regenerate** — do not accept drift.

**Reference:** `reports/vip-aurelia-demo/aurelia.json` (`model3d`) and `scene3d.js`.

## Room constants

| Parameter | Value |
|---|---|
| Room width × depth | **32 m × 22 m** |
| Wall height | **6 m** |
| Patron eye height (walk mode) | **1.65 m** |
| VIP mezzanine floor elevation | **+1.2 m** (east mezz run) |
| Coordinate note | Plan origin top-left, north up; 3D uses center offset (see demo) |

## Areas (fixed labels)

| Id | Name | Role |
|---|---|---|
| **A** | **Area A · West Booths** | West row booths / low tables |
| **B** | **Area B · Dance Floor** | Central dance zone (non-bookable floor overlay) |
| **C** | **Area C · VIP Mezzanine** | Elevated east VIP tables + suite |
| **D** | **Area D · Bar Lounge** | Main bar lounge + service circulation |

Area bounds in normalized plan space are in `aurelia.json` → `areas[]`. Do not merge or split areas for storytelling.

## Non-bookable (never sell / never move)

- **Main bar** (Bar Lounge)
- **VIP bar** (mezz service)
- **DJ booth** (blue legend state — fixed footprint)
- **Dance floor zone** (Area B surface — not a table product)
- **Entrance** (south main door)
- **Coat check**
- **Restrooms**
- **Stairs** (mezz access)
- **Exits** (north / east egress)

Bars, DJ, exits, and stairs stay **grey / blue** legend semantics in 2D; in 3D they stay the same meshes and positions as the demo.

## Circulation

- Keep **walk paths** between entrance → coat check → dance floor → bar clear (no prop blocking).
- Mezz stairs remain on the locked path — do not relocate for camera convenience.
- Walk collision in the demo follows floor height steps (~0.5 m tolerance); AI walkthroughs should respect the same level changes.

## Camera presets (match `scene3d.js`)

| Preset | Position / target (world space, meters) | When to use |
|---|---|---|
| **Overview** | Camera **(0, 24, 22)** → target **(0, 0, 1)** | Establishing dollhouse; aspect boost on narrow phones |
| **Area focus** | Center of area bounds; VIP areas add **+1.2 m** to floor Y; offset by ~0.75× area size + 4 m | Area chips / chapter headers |
| **Section focus** | Table center + sheet offset (dx **3.2** if right sheet, dz **3.5** if bottom sheet); camera elevated ~9 m above section | Table booking story beats |
| **Walk start** | **x = 7**, **z = 19.6**, **y = eye 1.65 m**, **yaw = 0** (north), **pitch ≈ -0.08** | POV arrival, corridor beats |

Orbit: max polar ~0.48π, distance 3–75 m. Walk: WASD / arrows; labels cull beyond ~8 m.

## Lighting moods

**Base club night** (default in demo):

- Hemisphere: sky **#ffe7c2**, ground **#1a1020**, intensity ~1.1
- Ambient: **#ffffff** ~0.35
- Directional key: white ~0.8 from ~(-8, 20, 10)
- Point chandeliers: **#ffd28a**, falloff per demo (~18 intensity, 16 distance)

**Named moods** (same fixture positions — only intensities / colors / haze change):

1. **club night** — base rig above
2. **arrival red-carpet** — brighter wash on entrance / south path; warm skin tones
3. **VIP mezzanine champagne** — slightly cooler fill on mezz (+1.2 m), soft specular on glass rails
4. **dance-floor peak** — stronger volumetric / beam effect over Area B only (no new walls)
5. **closing soft** — reduced chandelier output, deeper shadows, unchanged geometry

Background void: **#07070a** (demo scene background).

## Brand chrome

- **FloqR**, **FloqMedia**, **ShoutOut** — never translate; use as on-product spelling.
- **LED wall** (if visible): ShoutOut **silhouette boards** or abstract motion — **no** real patron faces, **no** readable private messages.
- Optional subtle “Powered by FloqR Social OS” only where product already uses it; do not invent alternate brands.

## Mutable story elements (safe to change)

- Wardrobe and era (within venue believability)
- Anonymous crowd silhouettes (no identifiable faces or tattoos)
- Bottle service, sparklers, confetti, floral props — **not** blocking circulation
- DJ as **silhouette** only (no real DJ likeness unless licensed)
- Story beats, dialogue cards, time-of-night, music genre mood
- Table state colors (available / held / booked) for narrative — bookable **section ids** stay fixed

## Forbidden

- Moving walls, bars, DJ booth, stairs, or exits
- Claiming photogrammetry or as-built survey accuracy
- Identifiable patrons or celebrity likeness without rights
- Second production origin for product URLs (see cutover rules in repo)
