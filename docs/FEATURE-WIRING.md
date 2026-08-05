# FLOQR Feature Wiring Registry

Living operational map: **what exists** and **how it is wired**.  
Architecture depth → `docs/FLOQR-TECHNICAL-BIBLE.md`.  
Agents: update this file in the same iteration as feature work (see `.cursor/rules/feature-wiring-records.mdc`).

| Field | Value |
|---|---|
| Live Pages | `https://jadzadco.github.io/shoutout-demo/` |
| Firebase | `shoutoutdemo-5b402` · Functions `us-central1` |
| Last registry touch | 2026-08-04 |

---

## Display Security (IP + board tokens)

**Purpose:** Gate venue LED boards (`display.html` / `display2.html`) so idle/live content only shows when an allowlisted IP **or** a valid `?k=` board token unlocks the page (OR — not both required).

| Layer | Wiring |
|---|---|
| UI | Master Admin → Security → **Display Security Setting** (`master-admin.html#displaySecurity`) |
| Client | `master-display-security.js` — load/save settings, rotate tokens, access logs, security messages |
| Display gate | `display-app.js` → `enforceDisplayAccess()` **before** idle/live; deny UI is Floq Media / FloqR “not configured” copy |
| Backend | `functions/display-security-functions.js` — `checkDisplayAccess`, `setVenueDisplayIps`, `provisionVenueDisplayTokens`, `getVenueDisplayTokens`, rotate/clear, access logs |
| Data | `clubLocations/{id}`: `displayIpRestrictionEnabled`, `displayTokenRequired`, `approvedDisplayIps`, `displayIpNotes`; secrets in `displayBoardSecrets/{id}`: `primaryToken`, `secondaryToken` (not on public club docs) |
| Logs | `displayAccessLogs` (90-day); Master Admin **Security Logs** + **Security System Messages** (`inboxNotifications` type `displayAccessDenied`) |
| URL contract | Display 1: `display.html?location={id}&k={token}` — **no `?v=`**. Display 2: `display2.html?location={id}&k={token}`. Token lock default ON unless `displayTokenRequired === false`. |
| Gate logic | **OR:** allowlisted IP unlocks **or** valid `?k=` unlocks. Deny only when every configured gate fails. Reasons include `ip_or_token_ok`, `token_missing`, `token_denied`, `token_not_configured`, `ip_denied`, `restriction_enabled_empty_allowlist`, combined `ip_denied+token_missing`. |
| Token compare | Access logs + Security System Messages record **last 5** of provided `?k=` vs expected secret, plus redacted `pageUrl` (`k=…xxxxx`). Full secrets never logged. |
| Help | `help-display-security-setting` in `floqai-help-repository.js` |

**Ops notes**

- Venue name in a deny message is the **location being opened**, not client geography. Check **client IP** (e.g. US Comcast `2601:14d:…` vs Spain venue) before assuming Xibo failed.
- IP restriction OFF + `token_missing` ⇒ page loaded without `?k=` (browser test, wrong Xibo URI, or query stripped)—not “token unset” if obfuscated last digits exist in portal.
- With both ON: home/office IP not on the list can still open the board with the correct Xibo `?k=`; venue LAN IP can open without a token.
- Full `?k=` shown **once** on onboard/rotate; portal otherwise obfuscates (last 4).
- Ask Xibo which public egress IP(s) players use and whether Webpage query strings (`?k=`) are preserved.
---

## Xibo Trigger on Error / display load-error fallback

**Purpose:** When Xibo cannot load the board Webpage, a fallback layout opens `display-error.html` and logs a diagnostic event (not a Security deny).

| Layer | Wiring |
|---|---|
| UI (Diagnostics) | Master Admin → Diagnostics → **Display / Xibo Load Errors** (`#diagnosticsDisplayErrors`) — build/copy fallback URL |
| UI (Security) | Master Admin → Security → **Display Security Setting** — **Trigger on Error URL** per loaded venue (Display 1 / Display 2) |
| Client | `master-diagnostics-panels.js` (`buildFallbackUrl`); `master-display-security.js` (`buildTriggerOnErrorUrl`); `display-error-app.js` |
| Page | `display-error.html` (stable URL — no `?v=`) |
| Backend | `reportDisplayLoadError` in `functions/display-security-functions.js` |
| Data / logs | Diagnostic app logs (≈30-day); **not** Security System Messages |
| URL contract | `display-error.html?location={id}&board=1\|2&reason=xibo_page_load_error` — no board token required |

**Example — Shôko Barcelona Display 1**

```
https://jadzadco.github.io/shoutout-demo/display-error.html?location=shoko-barcelona-spain&board=1&reason=xibo_page_load_error
```

Display 2: same with `board=2`.

Xibo’s *Trigger on page load error* is usually a **trigger code**; put the URL above on the **fallback Webpage** layout that that trigger opens.

---

## SOS2FA (Entity Management unlock)

**Purpose:** Gate Master Admin Entity Management / onboarding with SMS and/or email OTP (and optional TOTP).

| Layer | Wiring |
|---|---|
| UI | `master-admin.html` SOS2FA gate + channel radios (Both / SMS / Email) |
| Styles | `admin.css` `.sos2fa-channel-option` (radio sizing); `styles.css` must not force radios to `width:100%` |
| Backend | `functions/sos2fa-functions.js` (+ Twilio / mail paths as deployed) |
| Help | SOS2FA popouts + FloqAi repository entries |

---

## Heist / jersey idle ghost (liveContent expiry)

**Purpose:** Expired soccer jersey ShoutOuts must not leave `backgroundUrl` on idle.

| Layer | Wiring |
|---|---|
| Backend | `expireLiveShoutouts` clears jersey/background fields (not merge-preserving ghosts) |
| Display | `display-app.js` treats `status:default` as clean idle on Display 1 |
| One-shot cleanup | `functions/scripts/clear-heist-livecontent-jersey.js` |

---

## Patron Portal auth shell

**Purpose:** My Profile and Settings must hide the Sign-in card whenever Firebase already has a session (global profile avatar is the signal).

| Layer | Wiring |
|---|---|
| UI | `patron-portal.html` — `#portalLogin` / `#portalPanel` |
| Client | `patron-portal-app.js` — `applyPortalAuthUi`, `bootPortalForUser`, `auth.onAuthStateChanged`, `auth.authStateReady`, `floqr:profile-access-ready`, short sync interval |
| Guard | `profile-access-guard.js` (does not own the Sign-in card on this page) |
| Global chrome | `global-profile-status.js` — avatar menu uses the same Firebase auth |

**Bug fixed (v29.09.119):** Signed-in avatar could show while Sign-in card stayed visible — portal shell now re-syncs from `auth.currentUser` and keeps the panel open if profile load fails.

---

## Birthday media template (split + rotate)

**Purpose:** Birthday ShoutOut with patron photo/video — readable on large panels and compact LEDs.

| Layer | Wiring |
|---|---|
| UI | Patron ShoutOut editor template `birthdayMedia`; display render on `display.html` |
| Client | `display-app.js` — `birthdayUsesRotate` / `startBirthdayRotate`; split uses `object-fit:cover`; rotate uses `contain` + decorative slot |
| Styles | `display.css` — `.birthday-media-layout`, `.birthday-rotate-layout`, phase classes |
| Data | `shared-data.js` profile `birthdayMedia` + `SHOUTOUT_TEMPLATES.birthdayMedia.screenFormatIds` (all six formats) |
| Backend normalize | `functions/commerce-functions.js` birthday caps (96×48: 3×15; 64×48: 4×8; 64×32: 4×10) |
| Contract | 96×48 split (~60/40); 64×48 boxed + 64×32 landscape rotate fullscreen picture ↔ 4-line text |
| Docs | `TEXT-LIMITS-V29-08-4.md` birthday notes |

---

## supRstar live duration + diagnostics

**Purpose:** Paid live minutes must not burn before the venue board ICE-connects; brief disconnects must be traceable.

| Layer | Wiring |
|---|---|
| UI | `suprstar-preview.html` + live pop-out; venue `display2.html` via `display-suprstr.js` |
| Client timer | `suprstar-preview.js` — arms only after **stable ICE/peer `connected`** (2.5s debounce); never on SDP answer alone |
| WebRTC | `suprstr-webrtc.js` — answer → status `answered`; true `connected` from `connectionState` / ICE |
| Backend | `startSuprstrLive` sets `liveEndsAtMs:0`; `armSuprstrLiveDuration` sets ends + `liveArmedAtMs` / `liveArmSource` |
| Diagnostics | `FLOQRLog` → Firestore `appLogs` category `suprstar` (`webrtc_status`, `live_timer_*`, `live_heartbeat`, display `display_*`) |
| Heartbeat | Preview emits `live_heartbeat` every 10s while broadcast handle is open |
| Cache bust | Preview scripts `?v=29.09.121` |

---

## FloqAi intent search (plain-language router)

**Purpose:** Map short / partial patron wording to products and help cards (e.g. `throw` / `shou` → Throw a ShoutOut; `sho` → Shows/events + ShoutOut; `hai` / `hail` → RydR).

| Layer | Wiring |
|---|---|
| UI | Search / FloqAi (`index.html` intent panel) |
| Client | `intent-search.js` — `PRODUCT_INTENTS`, `HELP_INTENTS`, `aliases`, `searchPhrases`, prefix `phraseScore` / `aliasScore` |
| Help seed | `floqai-help-repository.js` (loaded before `intent-search.js`) |
| Cache bust | `intent-search.js?v=` on `index.html` |

---

## VIP / Table reservations + Hail a Waitress (planned)

**Purpose:** Map-based VIP/table booking with VCC pricing/staffing; patron hail/chat to assigned waitress with shareable service refs.

### Pilot floor plans (assets received 2026-08-04)

Stored under `assets/table-maps/`:

| Venue map | File | Tables / sections (seed cutouts) |
|---|---|---|
| **Decades** | `decades-floor-plan.png` | **C1–C11**. Sections: Top VIP (C1–C5); Main floor (C6–C9, C6 by DJ); Bottom VIP (C10–C11). Landmarks: Bar, DJ Booth, Stairs, Emergency Exit |
| **Lima Twist DC** | `lima-twist-table-map.png` | Series cutouts: **200s** (209→201), **100s** (106→101), **500s** circular (503→501), **300s** U-booth (307–301), **400s** (403→401), **BAR1/BAR2** (service landmarks, not bookable by default) |

VCC editor will place hotspots on these JPEGs (full plan + section crops); zoom/pan on patron + admin views.

### Locked product calls (2026-08-04)

| Topic | Decision |
|---|---|
| Club cancel after pay | **Stripe auto-refund** on cancel (no manual Stripe console step for the happy path) |
| Friend with shared ref | **Join table party** is granted from the **original table reservation** (booker shares ref). Friend gets party access / chat as designed — **waitress does not accept** the join |
| Outside club hours | **Hard closed** for waitress hail/chat. Offer fallback: **text on-duty or assigned venue CSR** only |
| Hours source of truth | Club hours must be **structured and correct** in VCC/onboarding (`hoursStructured` / profile hours) — hail gating uses venue timezone + those hours |

### Surfaces (to build)

| Layer | Wiring |
|---|---|
| UI (VCC) | Table map upload, section cutouts, prices, staff↔section, reservation Approve / Cancel+auto-refund |
| UI (patron) | Zoomable floor/section views; reserve+pay; **Hail a Waitress** → Existing purchased (auto-ref) \| New service; share ref (Mingl / SMS / WhatsApp / email) |
| Backend | Reservation callables; cancel → Stripe refund; hours gate; party-join via ref (no waitress accept) |
| Data | Table maps/sections/reservations; section→waitress/CSR; activity `referenceNumber` on receipt + inbox |
| Hours | Require structured club hours before enabling live hail during “open” |
| Help / FloqAi | “VIP table”, “hail waitress”, “table reservation”, “join table party” |

### Test methodology (abbrev.)

1. Pay → pending; Approve → active + ref on receipt.  
2. Cancel → **automatic Stripe refund** + notify; chat closed.  
3. Share ref → friend **Join table party** without waitress accept.  
4. Outside hours → hard block + CSR/on-duty text option; fix hours in VCC and retest open window.  
5. Existing hail auto-attaches ref; New-service hail allowed without prior VIP purchase.

When adding a section, use this skeleton:

```markdown
## Feature name

**Purpose:** …

| Layer | Wiring |
|---|---|
| UI | … |
| Client | … |
| Backend | … |
| Data | … |
| URL / contract | … |
| Observability | … |
| Help | … |
```
