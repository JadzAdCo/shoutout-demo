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

**Purpose:** Gate venue LED boards (`display.html` / `display2.html`) so idle/live content only shows for allowlisted IPs and/or a secret `?k=` token in the Xibo Webpage URL.

| Layer | Wiring |
|---|---|
| UI | Master Admin → Security → **Display Security Setting** (`master-admin.html#displaySecurity`) |
| Client | `master-display-security.js` — load/save settings, rotate tokens, access logs, security messages |
| Display gate | `display-app.js` → `enforceDisplayAccess()` **before** idle/live; deny UI is Floq Media / FloqR “not configured” copy |
| Backend | `functions/display-security-functions.js` — `checkDisplayAccess`, `setVenueDisplayIps`, `provisionVenueDisplayTokens`, `getVenueDisplayTokens`, rotate/clear, access logs |
| Data | `clubLocations/{id}`: `displayIpRestrictionEnabled`, `displayTokenRequired`, `approvedDisplayIps`, `displayIpNotes`; secrets in `displayBoardSecrets/{id}`: `primaryToken`, `secondaryToken` (not on public club docs) |
| Logs | `displayAccessLogs` (90-day); Master Admin **Security Logs** + **Security System Messages** (`inboxNotifications` type `displayAccessDenied`) |
| URL contract | Display 1: `display.html?location={id}&k={token}` — **no `?v=`**. Display 2: `display2.html?location={id}&k={token}`. Token lock default ON unless `displayTokenRequired === false`. |
| Deny reasons | `token_missing` (secret exists, URL has no/empty `k`); `token_denied` (wrong `k`); `token_not_configured` (lock ON, no secret stored); `ip_denied` / `restriction_enabled_empty_allowlist` |
| Help | `help-display-security-setting` in `floqai-help-repository.js` |

**Ops notes**

- Venue name in a deny message is the **location being opened**, not client geography. Check **client IP** (e.g. US Comcast `2601:14d:…` vs Spain venue) before assuming Xibo failed.
- IP restriction OFF + `token_missing` ⇒ page loaded without `?k=` (browser test, wrong Xibo URI, or query stripped)—not “token unset” if obfuscated last digits exist in portal.
- Full `?k=` shown **once** on onboard/rotate; portal otherwise obfuscates (last 4).

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

## Registry maintenance

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
