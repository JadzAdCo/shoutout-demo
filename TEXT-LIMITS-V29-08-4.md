# FLOQR display-aware text limits (v29.08.4)

These are readability ceilings, not writing targets. The patron editor, preview, recommendation system, stored payload, display renderer, paid-checkout normalization, and direct Black and White Firestore submission now use the same template-and-display rules.

Main and subtext render 30% larger than v29.08.2: `16 -> 20.8` and `6 -> 7.8` percent of display height before template-specific layout scaling.

## Published-template profiles

| Profile | Published templates |
|---|---|
| Full-screen message | Neon ShoutOut; Birthday Glow; VIP Table; Bottle Service; Gold Celebration; Ice Blue; Fire Night; Latin Night; Hip Hop Night; Afro House / Amapiano; EDM / House; Summer Vibes; Champagne Celebration; Beach Party; Wedding Celebration; Sports Night; Luxury Gold |
| Three-line classic board | Traditional Black and White ShoutOut; Graduation Night; Corporate Event |
| Media and message split | Happy Birthday with image/video; Happy Anniversary with image/video; Happy Engagement with image/video; Fiance Celebration with image/video |
| Illustrated car message | Luxury Car Celebration |
| Four-player football introduction | Zebbies 4-Player Football Intro |

## Main-message limits by display

`3 x 16 = 48` means three lines, approximately 16 visible characters per line, and 48 visible main-message characters total. Automatic line-break separators do not consume the visible-character allowance.

| Display | Full-screen | Classic board | Split media | Car | Football intro |
|---|---:|---:|---:|---:|---:|
| P1.25 96 x 48 cm (768 x 384) | 3 x 16 = 48 | 3 x 15 = 45 | 3 x 10 = 30 | 2 x 14 = 28 | 2 x 14 = 28 |
| P1.25 64 x 48 cm (512 x 384) | 3 x 10 = 30 | 3 x 12 = 36 | 2 x 12 = 24 | 2 x 10 = 20 | 2 x 10 = 20 |
| P1.25 64 x 32 cm (512 x 256) | 3 x 14 = 42 | 3 x 14 = 42 | Not recommended | 2 x 12 = 24 | Not recommended |
| 96 x 48 cm (624 x 312) | 3 x 16 = 48 | 3 x 15 = 45 | 3 x 10 = 30 | 2 x 14 = 28 | 2 x 14 = 28 |
| 64 x 48 cm (416 x 312) | 3 x 10 = 30 | 3 x 12 = 36 | 2 x 12 = 24 | 2 x 10 = 20 | 2 x 10 = 20 |
| 64 x 32 cm (416 x 208) | 3 x 12 = 36 | 3 x 12 = 36 | Not recommended | 2 x 12 = 24 | Not recommended |

## Attribution and subtext limits

| Display | Full-screen | Classic board | Split media | Car | Football intro |
|---|---:|---:|---:|---:|---:|
| P1.25 96 x 48 cm | 28 | 20 | 20 | 22 | 20 |
| P1.25 64 x 48 cm | 22 | 18 | 18 | 18 | 16 |
| P1.25 64 x 32 cm | 24 | 18 | Not recommended | 18 | Not recommended |
| 96 x 48 cm | 28 | 20 | 20 | 22 | 20 |
| 64 x 48 cm | 22 | 18 | 18 | 18 | 16 |
| 64 x 32 cm | 20 | 16 | Not recommended | 16 | Not recommended |

## Football-specific limits

| Display | Stadium message | Player name |
|---|---:|---:|
| P1.25 96 x 48 cm / 96 x 48 cm | 3 x 18 = 54 | 14 |
| P1.25 64 x 48 cm / 64 x 48 cm | 3 x 12 = 36 | 10 |
| Either 64 x 32 cm display | Not recommended | Not recommended |

## Patron guidance

- The display selector disables combinations that are not suitable.
- The editor reports the selected display, current visible-character count, total maximum, line count, characters per line, attribution/subtext limit, and planned minimum letter height.
- Text is wrapped before preview and submission. Recommendations, past-ShoutOut reuse, and AI output pass through the same fitting function.
- The display renderer resolves the rules again instead of trusting client-supplied limits.
- Paid ShoutOut payloads are normalized again in Firebase Functions. Direct browser creation is restricted to the default Black and White template and its reviewed per-display limits.
