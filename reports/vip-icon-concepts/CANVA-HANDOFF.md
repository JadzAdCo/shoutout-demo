# FLOQR VIP / Table Reservation icon — Canva handoff

Design concepts only. Nothing here is wired into the app.

Open `preview.html` in a browser (or look at `preview.png` / `preview-phone-390.png`) to compare every concept at 16 / 24 / 32 / 48 / 96 / 180 px on dark and light backgrounds, next to the ShoutOut tile.

## Files

Four concepts, six files each (`a` = VIP Ledger, `b` = Book + Reserved Table, `c` = VIP Ticket, `d` = Reserved Book-Tent):

| File | Use it for |
|---|---|
| `vip-?-*-color.svg` | Full-color icon, 32 px and larger (web tiles, buttons, marketing) |
| `vip-?-*-color-small.svg` | Full-color icon at 16–24 px (favicon, tab bar, small chips) |
| `vip-?-*-mono.svg` | One-color icon for nav / menus, 32 px and larger. Uses `currentColor`, so it takes the text color around it |
| `vip-?-*-mono-small.svg` | One-color icon at 16–24 px |
| `vip-?-*-app.svg` | App icon / Search tile: rounded dark square, artwork sized for iOS and PWA "any" icons |
| `vip-?-*-maskable.svg` | Android / PWA maskable icon: full-bleed square, artwork inside the 80% safe circle |

Colors: pink `#ff4fd8` → cyan `#5ee7ff` gradient, gold `#ffd45a` crown/accents, dark ink plate `#24175a` → `#0c0a2a`, white `VIP`.
The `VIP` letters are drawn as shapes (no font), so they look identical everywhere.

`build-icons.mjs` regenerates every SVG and the preview; `render.mjs` re-renders the PNGs with headless Edge.

## Import into Canva

1. Open Canva → **Create a design** → **Custom size** → 1024 × 1024 px (app icon) or 512 × 512 px.
2. Left panel → **Uploads** → **Upload files** → pick one or more `.svg` files from this folder.
   - Canva accepts SVG up to 3 MB; these files are 1–4 KB each.
3. Click the uploaded SVG to drop it on the page, then drag a corner to fill the page. It stays sharp at any size.
4. To recolor: select the graphic → the color swatches in the top toolbar list each color in the file (pink, cyan, gold, ink, white). Click one to change it everywhere it is used.
   - Gradients may import as their first color in some Canva versions. If the pink→cyan gradient flattens, either keep the solid color or select the shape and apply a gradient from the color panel.
   - The `mono` files use `currentColor`; Canva shows them as black. Recolor them with the swatch.
5. Export: **Share → Download → PNG** (tick *Transparent background* for the color/mono icons) at 1024 px, or **SVG** (Canva Pro) to keep it vector.

Figma / Illustrator: drag the SVG in; every shape stays editable (letters are paths, not text).

## Exporting for the app later (when it is wired)

| Target | Source file | Export |
|---|---|---|
| iOS app icon | `-app.svg` | 1024 × 1024 PNG, no transparency (iOS rounds the corners itself — remove the rounded corner by using the `-maskable.svg` instead if Xcode warns about transparency) |
| Android adaptive / PWA maskable | `-maskable.svg` | 512 × 512 and 192 × 192 PNG, `"purpose": "maskable"` |
| PWA "any" icon | `-app.svg` | 512 × 512 and 192 × 192 PNG |
| Favicon / tab bar | `-color-small.svg` | 32 × 32 and 16 × 16 PNG, or the SVG directly |
| Web nav / menu | `-mono-small.svg` (≤ 24 px) or `-mono.svg` (≥ 32 px) | inline SVG |

## Canva prompt / brief (to generate alternatives in Canva)

Use Canva **Magic Media → Graphics** (or Dream Lab) with this prompt, then refine the best result with the editor:

> Flat vector app icon for a nightlife app's **VIP table reservation** feature. Subject: a closed hardcover reservation book standing upright, front cover facing the viewer, with the letters **"VIP"** in bold geometric sans-serif capitals in the center of the cover and a small gold crown above the letters; a pink ribbon bookmark hangs from the bottom; page edges visible on the right. Neon line-art style: thick glowing outlines with a pink (#ff4fd8) to cyan (#5ee7ff) gradient, cover filled deep navy-purple (#24175a to #0c0a2a), letters pure white, crown gold (#ffd45a). Centered on a dark rounded-square background (#1b0f45 to #060918) with a soft pink glow top-left and cyan glow bottom-right. Simple, bold shapes that stay readable at 24 pixels. No photo realism, no extra text, no people, no drop-in mockup frame.

Variations to try (swap the "Subject" sentence):

- **Table + book:** "an open reservation book with a gold checkmark on the right page, standing on a small two-legged table next to a gold A-frame RESERVED tent card with a star and a tiny crown."
- **Ticket:** "a horizontal ticket / reservation pass with notched edges, the letters VIP on the main part, a row of perforation dots, and a gold circle with a checkmark on the stub."
- **Reserved table:** "a short A-frame tent card that reads VIP standing on a wide table with two legs, a gold crown floating above the card, and a pink ribbon bookmark hanging over the table edge."

Brief for a designer (one paragraph):

> Icon for "Book VIP" (VIP table reservations) that sits beside FLOQR's ShoutOut, Mingl, BartR, RydR and supRstar tiles. Must read at 16, 24, 32 and 48 px and as an iOS/Android/PWA app icon. Keep FLOQR's neon look: pink→cyan gradient strokes on a dark navy/purple plate, white lettering, gold only for the crown/accents. Provide full color, one-color (for menus), a simplified small version (drop fine detail below 24 px), and a maskable version with the artwork inside the central 80% circle. The owner likes a book (= booking) with "VIP" on it.
