# VIP floor plans — public photo match (PROPOSAL)

Checked Oct 15 2026, **read-only**. Only public profile images were looked at. No private data was read or downloaded, and nothing was written to Firestore or Storage.

## What was checked

| Source | Decades (`decades-washington-dc`) | Lima Twist Club (`lima-twist-washington-dc`) |
|---|---|---|
| Firestore `clubLocations/{id}` — `mainMediaUrl`, `coverImageUrl`, `logoUrl`, `publicGallery` | 1 cover photo + logo; **no `publicGallery`** | 1 cover photo + logo; **no `publicGallery`** |
| Firestore `clubMedia` where `clubLocationId` = id (what the Club Public Profile gallery reads) | **0 rows** | **0 rows** |
| Packaged `shared-data.js` venue entry | Same cover + logo | Same cover + logo |
| Packaged events (`shared-data.js`) | 4 event flyers (graphics, not the room) | None with images |

So each venue has exactly **one** public profile photo. The Club Public Profile gallery is empty for both.

## Photo-by-photo assessment

| # | Photo | What it shows | Area / section match | Confidence | Usable for "Explore the room"? | Usable as a section thumbnail? |
|---|---|---|---|---|---|---|
| D1 | <a href="https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/02/722A8852.jpg?ssl=1"><img src="https://i0.wp.com/decadesdc.com/wp-content/uploads/2024/02/722A8852.jpg?ssl=1&w=240" width="240" alt="Decades cover: crowded dance floor with a swirl light effect"></a><br>Decades cover (`722A8852.jpg`, decadesdc.com) | Packed dance floor, a heavy motion-swirl effect, a lit back bar / bottle shelf in the far background, ceiling projector and moving lights | Maybe **Floor** (`decades-floor`, dance floor), with the back bar behind it. But Decades has 6 floors and 8 bars, and the photo cannot be tied to the floor shown on this plan. **No table (C1–C11), VIP TABLES row or DJ BOOTH is visible.** | **Low** | **No.** Dozens of identifiable patrons' faces, crowd-blocked sightlines and an intentional distortion effect. | **No.** Same privacy problem, and no table in frame. |
| D2–D5 | Event flyers (`beachclub-ig-1.jpg`, `JELLOSHOT-IG.png`, `LADIESNIGHT-IG.png`, `SUENO-FEATURED.jpg`) | Promotional graphics | None (not photos of the room) | — | No | No |
| L1 | <a href="https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=1500w"><img src="https://images.squarespace-cdn.com/content/v1/66031ca5fde1186b2367bc7f/fb22d58b-4396-4697-8eea-da403bc01db8/LIMA-115.png?format=300w" width="180" alt="Lima Twist Club cover: plated fish dish with wine on a wood table"></a><br>Lima Twist Club cover (`LIMA-115.png`, limatwist.com) | Food close-up: a fish dish, white wine and water on a wood table with a black runner; a dark upholstered banquette out of focus behind it, with green accent light | The banquette **suggests** a booth-style 2-top along a wall, such as the 200 row (`lima-twist-area-a`) or the 100 row (`lima-twist-area-b`). Nothing in the frame identifies a table number. | **Very low** | **No.** It shows a table top, not the room. | **Not as a section photo.** At most a generic "dining" mood image for the venue header (there are no people, so no privacy issue). |

**Result:** none of the current public photos can be matched to a table, the DJ booth or a bar with useful confidence. Neither venue has photos suitable for a 360 view or for section thumbnails. Both official websites probably have more interior photos, but they are the venue's copyrighted material: we do not copy them. We ask each club to upload rights-cleared photos through Club Admin.

## What to ask each club for (before the 360 shoot)

Per area, 2–4 still photos taken with the **venue closed** (no patrons) and **service lighting** on, plus 1 photo per bookable section, taken from the guest's seat looking out.

| Venue | Area | Photos needed |
|---|---|---|
| Decades | North VIP (C1–C5) | Row from the dance floor; view from C3's seat |
| Decades | Floor (C6–C9, DJ BOOTH) | DJ BOOTH from C6; floor from C8 |
| Decades | South VIP (C10–C11) | Section from the entrance; view from C10 |
| Lima Twist Club | Area A · 200 Row | Banquette row end-on; view from 205 |
| Lima Twist Club | Area B · DJ & 100 Row | DJ booth (106) with the 100 row; view from 103 |
| Lima Twist Club | Area C · Bar & 400s | Bars BAR1 / BAR2 with the 400s; view from 402 |
| Lima Twist Club | Area D · 300s & Rounds | Rounds 501–503 with the 300s; view from 305 |

The 360 shoot itself (owner: yes, later) follows the capture guide in the proposal, §13.6.

## Proposed per-section photo fields

Photos live in the club's media (`clubMedia`, same Storage rules as the Club Public Profile). Sections and areas only **reference** them.

```json
{
  "photos": [
    {
      "photoId": "ph_8f2c…",
      "mediaRef": "clubMedia/{mediaId}",
      "url": "https://…/render-1600.webp",
      "thumbUrl": "https://…/thumb-480.webp",
      "kind": "sectionView | fromSeat | areaView | panoramaStill",
      "caption": "View from C3 toward the DJ BOOTH",
      "alt": "Low VIP table with a bench seat facing the dance floor",
      "focalPoint": {"x": 0.52, "y": 0.44},
      "rights": {"owner": "club", "source": "club-upload", "licenseNote": "Venue-owned, licensed to FloqMedia for booking display"},
      "peopleVisible": false,
      "privacyReview": {"status": "approved | rejected | pending", "byUid": "…", "atMs": 0},
      "match": {"sectionId": "decades-c3", "areaId": "decades-north-vip", "confidence": "confirmed | high | medium | low", "matchedBy": "club | masterAdmin | ai-suggestion"},
      "sortOrder": 0
    }
  ]
}
```

- `vipSections/{id}.photos[]`: up to 4 photos. The first one with `privacyReview.status = approved` and `match.confidence = confirmed` is the thumbnail on the map sheet and in the list.
- `areas[].photos[]`: up to 4 photos, shown on the area chip's header on phones.
- `vipFloorPlans/{id}.heroPhotoRef`: optional venue-level photo; the cover photo is the fallback.
- Patrons only see photos with `match.confidence = "confirmed"` (set by the club or a Master Admin). AI matches stay **suggestions** in the review step.
- Photos with `peopleVisible: true` need `privacyReview.status = approved`, which requires blurring or recorded consent. Strip EXIF GPS on upload. Data classification: render and thumbnail are **P** once approved; the original upload is **CC**.
