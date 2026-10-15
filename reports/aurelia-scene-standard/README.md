# Aurelia scene standard — operator pack

**Purpose:** Repeatable **3D club layout** and **AI movie process** for Aurelia-style VIP venues. Owner decision **Oct 15 2026** — the [VIP Aurelia demo](../vip-aurelia-demo/) is the reference geometry; this folder is the written standard for agents and operators.

**Resume tags:** `@aurelia-scene$` / `$ai-movie$` (see `.cursor/rules/design-notes-aurelia-scene-standard.mdc`, **always apply**).

## Status

- **Docs only** — no app build, no GitHub Pages publish, no Functions deploy from this pack alone.
- Layout is **modeled / AI-directed**, **not** photogrammetry.
- **No identifiable patrons** in any generated still or video.

## Locked vs mutable (quick)

| Keep fixed | You may change per story |
|---|---|
| Room size, walls, mezz height, bar + DJ positions, exits, stairs | Wardrobe, anonymous crowd density, props, lighting mood *within* presets |
| Four booking areas (A–D) and circulation | Beat timing, camera *motion* between presets, music mood |

Details: [SCENE-LOCK.md](./SCENE-LOCK.md).

## Open the interactive demo

From the **repo root**, serve HTTP (ES modules require it):

```powershell
npx --yes http-server -p 8787 -c-1 .
```

Then: [http://127.0.0.1:8787/reports/vip-aurelia-demo/](http://127.0.0.1:8787/reports/vip-aurelia-demo/)

Source of truth for meters and areas: `reports/vip-aurelia-demo/aurelia.json` · cameras in `scene3d.js`.

## Documents in this pack

| File | Contents |
|---|---|
| [SCENE-LOCK.md](./SCENE-LOCK.md) | Locked dimensions, areas, non-bookable elements, camera presets, lighting moods, brand rules |
| [AI-MOVIE-PROCESS.md](./AI-MOVIE-PROCESS.md) | Six pipeline phases, 15-minute beat sheet example, copy-paste AI prompts |

## Related

- [VIP Aurelia demo](../vip-aurelia-demo/README.md) — floor plan + three.js walk-through
- VIP floor-plan ingest (live clubs): `.cursor/rules/vip-floorplan-ingest.mdc`
- VIP Reservations proposal (product): `.cursor/rules/design-notes-vip-reservations.mdc`
