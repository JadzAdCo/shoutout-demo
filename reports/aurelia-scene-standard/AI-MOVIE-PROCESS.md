# AI movie process — Aurelia SCENE-LOCK

Target runtime: **15–30 minutes** from a written story. Geometry stays locked per [SCENE-LOCK.md](./SCENE-LOCK.md). Method: **modeled club**, **not** photogrammetry. **No identifiable patrons.**

## Phase overview

| Phase | Output | Gate |
|---|---|---|
| **1. Bible** | Logline, characters (silhouette-only), act structure, target minutes | Owner / creative sign-off on story |
| **2. SCENE-LOCK keyframes** | One still per beat — architecture matches lock | Human or automated geometry check |
| **3. Image-to-video** | 3–8 s clips from keyframes | No wall/bar/DJ drift |
| **4. Assembly** | Rough cut to beat sheet; transitions on locked wides | Pacing ±10% of target runtime |
| **5. Audio** | Licensed music bed + optional VO; levels for club noise | No uncleared voice clones |
| **6. QC / architecture-drift fix** | Final pass; repair or replace bad clips | Zero moved structural elements |

---

## Example: 15-minute beat sheet (Aurelia)

~**12–18 beats** at ~50–75 s each (including clip + hold). Adjust for 30 min by doubling B-plot beats in Areas A and D.

| # | Beat | Area / camera | Story note |
|---|---|---|---|
| 1 | Exterior title card (optional) | Text only / no room drift | FloqMedia presents |
| 2 | Empty room pre-open | Overview | Lights low, club night mood |
| 3 | Staff walk-through | Walk start → north | Silhouettes only, checks bars |
| 4 | Red carpet arrival | Entrance path, arrival mood | Anonymous guests, no faces |
| 5 | Coat check handoff | Near entrance | Mutable props only |
| 6 | First drink at main bar | Area D, section focus | Bar stays non-bookable anchor |
| 7 | Dance floor opens | Area B, area focus | Dance-floor peak lighting |
| 8 | DJ silhouette sound check | DJ booth (fixed) | Blue booth, no real artist |
| 9 | West booth reservation | Area A, section focus | Table states for narrative |
| 10 | Mezz staircase ascent | Stairs (locked) | Mezz +1.2 m reveal |
| 11 | VIP champagne moment | Area C, VIP mezz mood | Bottles / sparklers mutable |
| 12 | LED ShoutOut silhouette | LED wall | ShoutOut board shape, no patron photo |
| 13 | Crowd peak montage | Intercut area focuses | Anonymous silhouettes |
| 14 | Quiet conversation booth | Area A | Closing soft begins |
| 15 | Last call at bar | Area D | Same bar geometry |
| 16 | Lights up / sweep | Overview → walk exit | Circulation clear |
| 17 | End card | Brand chrome | FloqR / FloqMedia |

---

## Prompt templates (copy-paste)

Replace `{BEAT}`, `{MOOD}`, `{AREA}` with values from the beat sheet. Always attach SCENE-LOCK constants in every prompt.

### (a) Still keyframe from SCENE-LOCK

```
SCENE-LOCK: Aurelia VIP club interior. Room 32m x 22m, walls 6m high. Four areas: A West Booths (west), B Dance Floor (center), C VIP Mezzanine (east, floor +1.2m), D Bar Lounge (south-west bar). FIXED positions: main bar, VIP bar, DJ booth (east), dance floor zone, entrance (south), coat check, restrooms, stairs, exits — do not move.

Camera: {CAMERA_PRESET — overview | area focus Area X | section table ID | walk POV x=7 z=19.6 eye 1.65m facing north}.

Lighting mood: {MOOD — club night | arrival red-carpet | VIP mezzanine champagne | dance-floor peak | closing soft}. Base: warm hemisphere #ffe7c2 / ground #1a1020, ambient white, directional key, point chandeliers #ffd28a.

Beat: {BEAT_DESCRIPTION}. Mutable only: anonymous silhouette crowd, wardrobe, bottles/sparklers, haze. NO identifiable faces. NO photogrammetry claim. Modeled procedural VIP club like a luxury Washington DC nightclub demo.

Brand: subtle FloqMedia / FloqR acceptable; LED wall may show abstract ShoutOut silhouette board only — no patron photos.

Output: one cinematic 16:9 still, photoreal or high-end 3D render, architecture exact to lock.
```

### (b) Image-to-video clip

```
Animate this SCENE-LOCK keyframe for 4 seconds. Camera motion: {SUBTLE_DOLLY | HOLD | SLOW_ORBIT within preset bounds}. 

RULES: Walls, both bars, DJ booth, stairs, exits stay pixel-locked to the keyframe. Crowd = anonymous silhouettes only. Lighting may pulse slightly per {MOOD} but fixture locations unchanged.

No new rooms, no moved DJ, no widened dance floor. No identifiable patrons. Not a real venue survey — stylized Aurelia demo standard.
```

### (c) Architecture-drift repair

```
REGENERATE — architecture drift detected. Previous output violated SCENE-LOCK.

Restore: 32x22m room, 6m walls, mezz +1.2m east, DJ booth fixed east side, main bar fixed in Bar Lounge, VIP bar on mezz, entrance south, exits north/east unchanged, stairs unchanged.

Match reference layout: reports/vip-aurelia-demo plan (Area A west booths, B center dance, C east mezz, D bar lounge). 

Keep the same story beat: {BEAT}. Keep mood: {MOOD}. Keep camera intent: {CAMERA_PRESET}.

Discard any version where bars, DJ, walls, or exits shifted. Anonymous silhouettes only; no identifiable patrons.
```

---

## QC checklist (phase 6)

- [ ] Room footprint reads 32 × 22 m in wides (proportion check vs overview still)
- [ ] DJ booth still on locked east footprint (blue booth zone)
- [ ] Both bars unchanged; dance floor not shrunk or merged into booths
- [ ] Mezz elevation visible on Area C shots (+1.2 m)
- [ ] Stairs and exits in same plan locations as demo
- [ ] No recognizable faces (blur or replace)
- [ ] Brand strings spelled FloqR / FloqMedia / ShoutOut if shown
- [ ] Runtime within target (15–30 min) after assembly

---

## Related files

- [SCENE-LOCK.md](./SCENE-LOCK.md) — geometry and cameras
- [README.md](./README.md) — pack index
- [../vip-aurelia-demo/](../vip-aurelia-demo/) — interactive three.js reference
- `.cursor/rules/design-notes-aurelia-scene-standard.mdc` — agent always-on summary
