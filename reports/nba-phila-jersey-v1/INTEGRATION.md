# PHILA jersey v1 — repository integration (s3.3.001)

## Wired

| Surface | Change |
|---|---|
| Catalog | `nbaPhiladelphia76ersPhila` → `nbaJerseyPair`, 7s/5s, `seasonStatus: reference-specific-unverified`, stable id `nba-phi-phila-white-reference-v1` |
| Display | Pair stage: back left + front right; optional ShoutOut panel; `FLOQRFrameLoop` asymmetric holds |
| Timing | `floqr-jersey-scene.js` (`sceneAt`) + FrameLoop `holdMsByPhase` / `includeCopy` |
| Editor | PHILA uses Name + Number + optional ShoutOut (blank = jersey-only 7s) |
| Package | This folder = Cursor implementation brief + reference image |

## Asset readiness

| Asset | Status |
|---|---|
| `images/basketball/nba-76ers-front-with-club.png` | In use (typed PHILA + number overlays) |
| `images/basketball/nba-76ers-back-with-club.png` | In use (typed name + number overlays) |
| Clean blank plates / UV maps / licensed glyph atlas | **Not ready** — current PNGs are working plates with typed overlays; not full photoreal blank pipeline from the contract |
| Exact season / LockerVision edition proof | **Unverified** — do not label 2026–27 official |

## How to run

1. Search → venue → templates → **NBA Philadelphia 76ers PHILA**
2. Enter jersey name + number; optional ShoutOut message
3. Preview / LED: pair for 7s; if message set, ShoutOut card for 5s then loop (preview) or advance (queue)

## QA fixture

Name `DON BANYONG`, Number `21`, Message `HAPPY BIRTHDAY, DON!`

## Still open (contract)

- High-res blank garment preparation without residual EMBIID/21 ghosts
- Font atlas matching PHILA block lettering exactly
- Native-panel pixel export verification at device resolution
- Maryland Version 2 package (separate)
