# Maryland Terps jersey v2 — repository integration (s3.3.002)

Extends the shared pair engine from PHILA v1 (`floqr-jersey-scene.js`, `nbaJerseyPair`). Do **not** remove or overwrite `nbaPhiladelphia76ersPhila`.

## Wired

| Surface | Change |
|---|---|
| Catalog | `nbaMarylandTerpsThrowbackPair` — stable id `ncaa-umd-2026-27-2002-throwback-white-v2`, `nbaJerseyPair`, 7s/5s, `catalogPublished: false` until front+blank plates ready |
| Existing Terps | `nbaMarylandTerps` stays the live back-only LED kit (selector “Maryland Terps”) |
| Display | Same pair stage + optional ShoutOut; message panel can use Maryland red/gold via `pairMessageTheme` |
| Timing | Shared `FLOQRJerseyScene.sceneAt` (7s jersey / 5s message / blank = jersey only) |
| Package | This folder = Cursor brief + composition reference (PHILA layout authority only) |

## Asset readiness (`productionAssetsReady: false`)

| Asset | Status |
|---|---|
| Official throwback research | Documented in `SOURCES.md` (Oct 22 2026 umterps.com launch + media day) |
| Clean blank **front** plate (MARYLAND chest + Taxi Trim; no athlete glyphs) | **Missing** — blocks publish |
| Clean blank **back** plate for this throwback edition | **Missing** — current `maryland-terps-2026-back.jpg` is a prior working LED back, not verified throwback blanks |
| Under Armour / conference marks for this exact edition | **Unverified** — do not invent |
| Full rear geometry for throwback | **Unverified** per SOURCES |
| Photoreal blank / UV pipeline from contract | **Not ready** |

Until `productionAssetsReady` and `catalogPublished` are true **and** `frontBackgroundUrl` points at a reviewed front plate, the pair template is **not** merged into live `SHOUTOUT_TEMPLATES` (patrons keep using `nbaMarylandTerps` back-only).

## How to enable later

1. Prepare authorized front + back blank plates for the 2026–27 white 2002-championship throwback.
2. Place under `images/basketball/` (versioned filenames).
3. Set `frontBackgroundUrl` / `backBackgroundUrl` / `defaultBackgroundUrl`, then `productionAssetsReady: true`, `catalogPublished: true`.
4. Smoke `node scripts/smoke-jersey-catalog.js`; preview all three LED sizes; publish package stamp.

## QA fixture (when published)

Name `DON BANYONG`, Number `21`, Message `HAPPY BIRTHDAY, DON!`

## Still open (contract)

- High-res blank garment preparation from official throwback photography (licensed/owned)
- Exact glyph atlas for arched MARYLAND + Taxi Trim
- Native-panel export verification at device pixels
- Do not tint the white throwback into red/black/gold “official” colorways without separate references
