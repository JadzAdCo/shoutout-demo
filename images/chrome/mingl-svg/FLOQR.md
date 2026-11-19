# Mingl SVG kit — FLOQR placement

Owner pack (19 Nov 2026): **Mingl_Cursor_Logo_White_Teal_Purple_v3**. Resume: `@mingl-icon$`.

## Live Search chrome (v3 vector)

| Piece | Path |
|---|---|
| Color master (transparent, no tile) | `logos/mingl-color-master.svg` |
| Monochrome `currentColor` | `logos/mingl-chrome-monochrome.svg` |
| PNG exports | `exports/mingl-logo-{128,256,512,1024}.png` |
| Owner reference pack | `images/chrome/mingl-logo-v3/` (noisy PNG + starter + prompt) |
| Search tiles | `images/chrome/mingl-*.jpg` — Site Chrome owns the enclosing tile |
| Builder | `scripts/build-mingl-v3-logo.py` (`build-mingl-chrome-icons.py` delegates) |

Approved composition: three glossy white people (center purple trim, sides teal), white bubble, **Min** white / **gl** teal + TM. No filmstrip, no orbit, no outer square on the brand mark.

Typography is outlined **Noto Sans Display Bold Italic** (permitted FLOQR family) — approximation of the unknown heavy italic in the noisy reference PNG.

Search `#minglBtnCard` is a hidden chrome photo tile (`data-floqr-chrome-icon="mingl"`). Click still splash → Mingl landing. Tile stays hidden until Features & Services enables Mingl.

## Recommended first uses (owner)

| Surface | File | Why |
|---|---|---|
| **Search page icon** | `images/chrome/mingl-nightlife.jpg` (and Site Chrome peers) | Wired. Master SVG is frameless; chrome JPGs add the tile. |
| **FloqMedia Mingl logo** | `logos/mingl-by-floqr.svg` | Promotional lockup **Mingl by FLOQR**. Not required for this Search pass. |
| **People SMARTview Mingl CTA** | `icons/mingl-compact-mark.svg` | Unchanged this pass. Inline `currentColor`. |

## Do not

- Wrap the noisy reference PNG in an `<image>` and call it vector.
- Put an outer square / filmstrip / orbit on the brand master.
- Translate **Mingl**, **Mingl by FLOQR**, or **Room SMARTview**.
- Alter Room SMARTview or invitation logic in this pass.
- Deploy Pages / Functions until the owner approves.

## Inventory

- `icons/` — compact, orbit, people, chat, conversation-dots, interlock-m, chat-people
- `logos/` — color master, chrome monochrome, wordmark, horizontal, by-floqr, chat-plan-share
- `exports/` — transparent PNG 128 / 256 / 512 / 1024
- `components/` — bubble, orbit, person-center, three-people
- `examples/preview.html` — contact sheet
- Owner pack: `images/chrome/mingl-logo-v3/`
