# DC venue website extracts → FloqR onboarding

Extracted 2026-07-18 from official sites. Firestore + `shared-data.js` ids below.

| Venue | Official site | FloqR location id |
|---|---|---|
| Heist DC | https://www.heistdc.com/ | `heist-washington-dc` |
| GAIA / Gaiai DC | https://www.gaiasupperclub.com/ | `gaia-supperclub-washington-dc` |
| Onyx DC | https://onyxrooftopdc.com/ | `onyx-rooftop-washington-dc` |
| Vera DC | https://veradc.com/ | `vera-cocina-washington-dc` |
| SAX DC | https://www.saxwdc.com/ | `sax-washington-dc` |
| Decades DC | https://decadesdc.com/ | `decades-washington-dc` |
| The Mayflower DC | https://www.themayflowerdc.com/ | `mayflower-washington-dc` |
| Rose Bar DC | https://www.rosebarlounge.com/ | `rosebar-lounge-washington-dc` |
| KATA DC | https://www.kata-dc.com/ | `kata-washington-dc` |
| LIMA Twist (prior) | https://www.limatwist.com/ | `lima-twist-washington-dc` |
| **Casamara Rooftop** (onboarded seed) | https://casamaradc.com/rooftop/ | `casamara-rooftop-washington-dc` |

### Casamara Rooftop — extracted (2026-07-18) / onboarded

- Address: 1320 18th St. NW, Washington, DC 20036
- Phone: (202) 410-1313
- Email: rooftop@casamaradc.com
- IG: @casamararooftop (also @casamaradc)
- Resy: https://resy.com/cities/washington-dc/venues/92169
- Hours (site): Sun–Mon closed; Tue–Thu 4pm–11pm; Fri 4pm–12am; Sat 3pm–12am
- Events: Sunset Sundays (from June 7); private events (~80 seated / ~200 cocktail; retractable awning)
- Concept: Mediterranean rooftop; Sixty DC SMS marketing opt-in on rooftop page
- FLOQR: seed + `onboard-dc-venues.html` IDS; Master Admin push for Firestore

### Decades DC — weekly events extract (2026-07-31)

Canonical weekly page: https://decadesdc.com/weekly-events-decades-dc-events-decades-dc/  
(alias: https://decadesdc.com/weekly-events/)  
VIP / free-entry RSVP: https://decadesdc.com/vip-passes-exclusive-decades-nightclubdc-freeentry/  
Sueño tickets (Posh): https://posh.vip/e/sueo-decades-58  

| Night | Presenter | Age | Talent (as published) | Tickets |
|---|---|---|---|---|
| Summer Beach Club (Thu) | DCClubbing | 18+ | DCClubbing / Decades resident DJs (throwbacks) | VIP pass page |
| Fridays at Decades | Decades | 21+ | Decades resident DJs (90s–2010s Hip-Hop) | VIP pass page |
| Saturdays at Decades | Decades DC | 21+ | Guest DJs + residents | VIP pass page |
| Sueño Sundays (rooftop) | EG Productions × City Socials | 21+ | Sueño / City Socials DJs + guests | Posh `sueo-decades-58` |

VIP notes (from VIP page): Beach Club free entry to 11:00 PM (18+) / 11:30 PM (21+); Friday to 12:30 AM; Saturday to 11:30 PM. Named individual DJ bills are often not published — store resident/guest billing explicitly, never omit the talent slot.

FLOQR ids: club `decades-washington-dc`; recurring events `decades-summer-beach-club-weekly`, `decades-fridays`, `decades-saturdays`, `decades-sueno-sundays`.

## Gaps to fill later (not on public sites)

- GAIA / Onyx: Instagram not clearly published on scraped pages
- Decades: individual DJ legal/stage names often unpublished (use resident/guest billing until a flyer names them)
- GAIA postal: site showed 20003; onboarded as 20005 for Vermont Ave NW (confirm)
- Rosebar Friday hours: contact page incomplete; other sources say Fri open — confirm
- KATA hours: taken from third-party listings; confirm with venue
- Sueño Posh page may show a sample/dated occurrence — keep recurring Sunday + live Posh URL

## Test links (after Pages publish of shared-data)

- Admin: `admin.html?location=<id>`
- Display: `display.html?location=<id>`
- Public profile: `club-profile.html?location=<id>`
