# Mingl SVG kit — FLOQR placement (stored, not live)

Owner kit (18 Nov 2026): colorless `currentColor` vectors. **Not Search production until explicitly wired.** Live Mingl still uses raster `images/mingl-chrome-logo.png` / `mingl-pink-logo.png` / `mingl-blue-logo.png`. Resume: `@mingl-icon$`.

## Recommended first uses (owner)

| Surface | File | Why |
|---|---|---|
| **Search page icon** | `icons/mingl-orbit.svg` | Feature-card identity at ~96 px. Search today shows Mingl as a **text** `category-card` (`#minglBtnCard`), not a chrome photo tile like ShoutOut / BOT DEE / VIP. Promote it to `.search-icon-row` with `data-floqr-chrome-icon="mingl"` **after** a 1024 chrome raster pack exists (or inline SVG inheriting Site Chrome `color`). Compact fallback for 24–32 px: `icons/mingl-compact-mark.svg`. |
| **FloqMedia Mingl logo** | `logos/mingl-by-floqr.svg` | Promotional lockup **Mingl by FLOQR**. Use on FloqMedia partner / studio / chrome-review surfaces. Header lockup on FLOQR product pages: `logos/mingl-horizontal.svg` (orbit mark + **Mingl** word). |

Do **not** drop a raw SVG onto the Search tile as the only face without Site Chrome. Other feature icons go through `floqr-chrome-scheme.js` `ICON_PACK` (nightlife / traditional / blackTiffany / whiteBlack / purpleWhite / blackDarkGreen). This kit has no palette: paint it with `color: var(--floqr-ink)` / `--accent`, then rasterize into those six packs the same way Si-nema / VIP do.

## Do not

- Hardcode cyan, purple, white, black, or gradients into production marks.
- Put the FloqR parent logo beside the Mingl feature icon on a feature landing (`design-notes-feature-landing-pages.mdc`).
- Translate **Mingl**, **Mingl by FLOQR**, or **Room SMARTview**.
- Replace live PNG logos until the owner approves the Search icon + FloqMedia lockup pass.
- Deploy Pages / Functions for this ingest.

## Inventory

- `icons/` — compact, orbit, people, chat, conversation-dots, interlock-m, chat-people
- `logos/` — wordmark, horizontal, by-floqr, chat-plan-share
- `components/` — bubble, orbit, person-center, three-people
- `examples/preview.html` — contact sheet (`http://127.0.0.1:<port>/images/chrome/mingl-svg/examples/preview.html`)
- Kit notes: `README.md`, `CURSOR_IMPLEMENTATION.md`
