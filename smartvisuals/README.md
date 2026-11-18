# SMARTvisuals assets

Published **SMARTstencils** (26) and **SMARTbackgrounds** (34) for FLOQR SMARTnotification and Room SMARTview.

These files are **original SVG illustrations** from the FLOQR SMARTvisual kit. They are **not** photographs of destinations and must not be labeled as documentary photos or official partnership marks (Fashion Week, Burning Man, venue logos).

| File | Role |
|---|---|
| `registry.json` | Versioned published registry (IDs, tags, license, checksum, approvalStatus) |
| `catalog.json` | Resolver catalog derived from the registry |
| `stencils/` | Monochrome `currentColor` icons, rendered as `<img>` |
| `backgrounds/` | Scenic illustrations, rendered as `<img>` |

Rights / later photo upgrades: follow the kit’s `PHOTO_SOURCING_AND_LICENSES.md` (do not bulk-scrape; record creator, URL, license, checksum). Rebuild with `node scripts/build-smartvisuals-registry.js`.

Drafts created in Master Admin SMARTvisual Studio stay in Firestore and **do not** appear here until a reviewed git publish.
