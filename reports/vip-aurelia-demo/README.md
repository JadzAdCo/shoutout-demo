# Aurelia (Demo Club) — VIP floor plan + interactive 3D

Demo only. Modeled layout for **Aurelia / `temp-democlub-1`**, inspired by the club's public FloqR gallery photos. **Not a survey, not photogrammetry.** Real clubs will need a proper 360° / photo walk-through (and counsel / fire-plan review) before anything like this goes live.

Schema: `floqr.vipFloorPlan/2` (`aurelia.json`) · legend: `../vip-floorplans/legend.json`.

## How to open

Serve from the **repo root** (so relative photo / three.js paths resolve). ES modules need HTTP, not `file://`.

**Windows (recommended — no Python):** Node is usually already installed with this repo’s tooling. From the repo root in PowerShell or cmd:

```powershell
npx --yes http-server -p 8787 -c-1 .
```

If `npx` is slow or unavailable, this one-liner also works (Node 18+):

```powershell
node -e "const http=require('http');const fs=require('fs');const path=require('path');const root=process.cwd();const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};http.createServer((req,res)=>{let u=decodeURIComponent((req.url||'/').split('?')[0]);if(u.endsWith('/'))u+='index.html';const f=path.normalize(path.join(root,u));if(!f.startsWith(root)){res.writeHead(403);return res.end();}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(f).toLowerCase()]||'application/octet-stream'});res.end(d);});}).listen(8787,'127.0.0.1',()=>console.log('http://127.0.0.1:8787/'));"
```

**Optional (real Python only):** do **not** use the Microsoft Store `python` / `python3` stub (“Python was not found”). If you installed Python from python.org and `py -3` works:

```powershell
py -3 -m http.server 8787
```

Then open: [http://127.0.0.1:8787/reports/vip-aurelia-demo/](http://127.0.0.1:8787/reports/vip-aurelia-demo/)

## What you get

| Piece | Notes |
|---|---|
| `aurelia.json` | 4 areas · **25** bookable sections · 10 non-bookable (bar, DJ booth, dance floor, entrance, coat check, restrooms, stairs, exits) · demo booked/held · demo USD prices (`demo:true`) |
| `plan.svg` | Top-down plan with walls, exits, legend states + icons |
| `index.html` + `app.js` + `scene3d.js` | three.js **r160** (vendored) procedural 3D: orbit, walk (WASD / arrows + on-screen joystick on touch), area chips, 2D toggle synced with selection, side sheet (bottom sheet ≤600px), table list fallback |
| `photos/` | Resized copies of Aurelia's public FloqR gallery images (club-owned; identifiable patron party photos excluded) |
| `screenshots/` | CDP device-emulation stills (390 / 820 / 1280) |

### Views

- **3D** — orbit overview; area chips fly the camera; click a table → detail sheet
- **Walk** — first-person at eye height; WASD / arrows; drag to look; Esc leaves walk; on-screen joystick on touch / ≤820px
- **2D plan** — SVG from the same JSON; same selection as 3D
- **Table list** — accessible fallback with ≥44px rows

Color is never the only cue: every state has an icon, a fill pattern (held / booked / not bookable) and a text label.

### Demo vs real

| Demo (this folder) | Real VIP product |
|---|---|
| Holds are simulated in the page (10 min timer, no backend) | Stripe deposit + Functions hold / expire |
| Prices / capacities flagged `demo:true` | Club-confirmed amounts + counsel Terms |
| Modeled geometry from photos | Club drawing or Master Admin floor-plan ingest |
| Club staff demo personas in wall textures | Venue-approved media only |

## Photos used

Copied from `images/temp-qa/` (same URLs as `clubLocations/temp-democlub-1.publicGallery` on Pages). See `photos/photos.json`.

| File | Shows | Used for |
|---|---|---|
| `main-room.jpg` | Main room, chandeliers, booths + dance floor | Area A / B · west wall |
| `entrance.jpg` | Red carpet entrance (no people) | Entrance / Area D · south wall |
| `vip-room.jpg` | Red VIP banquettes + champagne (no people) | Area C · east wall |
| `dj-booth.jpg` | Resident DJ at decks (club staff demo) | DJ booth · north wall |
| `bar.jpg` | Champagne tower at the main bar (club staff) | Main bar · back-bar panel |
| `bottle-service.jpg` | Sparkler bottle service (club staff) | Area C · east wall |
| `portrait-led-wall.jpg` | Portrait LED wall ShoutOut (people only as silhouettes) | LED behind DJ |

**Excluded on purpose:** `vip-donpapi-led-*.png`, `club-aurelia-vip-maya-guests.jpg` and similar frames with identifiable patron faces.

## Rebuild / verify

```bash
node reports/vip-aurelia-demo/tools/build-aurelia.mjs   # regenerates aurelia.json + plan.svg
node reports/vip-aurelia-demo/tools/shoot.mjs           # CDP screenshots → screenshots/
```

## Honest limits

This is a **modeled representation** of a plausible Aurelia layout that matches the public photos' vibe (booths facing a DJ booth, mezzanine VIP, main bar, entrance). It is **not** a measured floor plan of the real room. A production club needs the floor-plan ingest workflow (upload → Master Admin process → club review → publish) described in `.cursor/rules/vip-floorplan-ingest.mdc`.
