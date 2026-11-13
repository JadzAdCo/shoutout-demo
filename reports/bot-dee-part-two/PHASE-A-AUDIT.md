# BOT DEE Part Two — Phase A current-state audit

**Audit date:** 2026-11-13  
**Repo:** `JadzAdCo/shoutout-demo`  
**Branch audited:** `origin/main` @ `03a17d3f`  
**FLOQR package id (Pages cache-bust / diagnostics):** `s3.3.004`  
**Functions package.json version:** `3.3.004`  
**Environment:** Firebase project `shoutoutdemo-5b402`, callables `us-central1`  
**Part Two spec:** `reports/bot-dee-part-two/spec/CURSOR_MASTER_PROMPT.md` (owner zip; **specification only**)

This report is **not** a claim that Part Two is live.

---

## 1. Verified current behavior

BOT DEE is a **stateless Gemini callable** plus a **browser-only transcript**. There is no durable thread, no workflow engine, no lease/claim, no `getBotDeeSystemInfo`, and no LangGraph/Postgres/Redis.

### 1.1 Callables and client

| Surface | Path | Verified fact |
|---|---|---|
| Chat page | `botdee.html` | Feature-gated satellite (`data-floqr-feature="botDee"`). Cache-bust `s3.3.004`. |
| Client | `bot-dee-chat.js` | Sends `{message, history}` to `executeBotSession`. `MAX_HISTORY = 12`. Idle (default **60s**) **clears** in-memory history. No `threadId`. |
| Page bind | `botdee-page.js` | Chat + intent-search fallback. |
| Access helper | `botdee-access.js` | Calls `getBotDeeAccess` (legacy alias `getFloqAiAccess`). |
| Session | `functions/bot-dee-functions.js` `executeBotSession` | Auth required; `assertFeatureAccess(..., "botDee")`; classification role; Gemini tool loop **or** local chitchat/search fallback. |
| Settings | same file `setBotDeeSettings` | Master Admin + SOS2FA + reason ≥ 8. Writes `botDeeSettings/default`. |
| Access | `functions/data-classification-functions.js` `getBotDeeAccess` | Role + content filter. Exported via `functions/index.js` spread of that module. |
| Tools | `functions/bot-dee-core.js` + `functions/bot-dee-tools.js` | Declarations + runners. Each product tool re-asserts its feature key then delegates to VIP / commerce / floqCast helpers. |
| Catalog | `functions/bot-dee-search-catalog.json` | Built by `scripts/build-bot-dee-search-catalog.js`. |
| Wiring | `docs/FEATURE-WIRING.md` § BOT DEE chat | Matches code on `main` (no locale tool, no public-profile tool on this SHA). |

**`executeBotSession` public contract today (must keep unless a versioned change is approved):**

Request: `{ message | prompt, history?: [{role, text}] }`  
Response: `{ ok, role, reply, results[], provider, model, toolRounds }`  
Errors: `unauthenticated`, `failed-precondition` (feature off), `invalid-argument`, `internal`.

Client ignores unknown fields, so additive keys (`threadId`, `workflowId`, `systemInfo`) are backward compatible if optional.

### 1.2 Tools (this SHA)

| Tool | Side effect | Gate re-check |
|---|---|---|
| `contextualSearch` | None (catalog + classification) | Session already gated `botDee` |
| `listShoutOutTemplates` | Read | `shoutOut` |
| `startShoutOutCheckout` | Stripe Checkout session | `shoutOut` |
| `createVipHold` | 30‑min inventory hold | `vipReservations` |
| `recordVipConsent` | Terms consent on hold | `vipReservations` |
| `createVipCheckout` | Club POS confirm **or** no-deposit confirm **or** Stripe URL | `vipReservations` |
| `createFloqCastRequest` | Preview request (`displayBoard` forced secondary) | `floqCast` |
| `createFloqCastCheckout` | Stripe Checkout | `floqCast` |

Gemini may call consequential tools **in the same request** with no extra BOT DEE approval document. Club Admin does not get an “approve this chat booking” step. PCI: no card fields; checkout URLs only. Stripe checkout already uses `idempotencyKey: floqr-checkout-${orderRef.id}`.

### 1.3 Prompt / identity / no-card (Part A of a prior brief)

On **this** `main` SHA, `systemInstruction()` in `functions/bot-dee-core.js` already says: never ask for card numbers; pay links only from tools; VIP collector branching. It does **not** yet include the extra trust / public-profile / locale lines from open PR **#69**.

Open PR #69 (`cursor/botdee-locale-profiles-bbee`) adds locale result cards, `lookupPublicProfiles`, and stronger system-prompt trust/no-card/tool rules. **Not merged.** Part Two must not assume it is live.

### 1.4 Persistence that exists vs Part One

The Part Two brief says Part One (Firestore persistence) may be incomplete. **On `main` it is absent.**

| Store | Exists? | Role |
|---|---|---|
| Browser `history[]` | Yes | Last 12 turns; lost on idle / reload / new device |
| `botDeeSettings/default` | Yes | Idle seconds only (not transcripts) |
| `botDeeThreads` / checkpoints | **No** | — |
| `botDeeWorkflows` | **No** | — |
| LangGraph / Postgres / Redis | **No** | Spec forbids adding these without a separate architecture decision |

Nearby durable patterns (reuse, do not confuse with BOT DEE threads):

- `vipHolds` + `vipActiveHolds/{uid}_{night}` + `vipInventory` — transactional hold, 30‑min expiry, `expireVipHolds` `onSchedule`
- `serviceOrders` + Stripe idempotency keys
- `featureServiceAuditLogs` chained audit (Master Admin)

`vipHolds` has **no** client `match` in `firestore.rules` → default deny; Admin SDK only.

### 1.5 Auth, RBAC, tenant

| Check | Where |
|---|---|
| Signed-in | `executeBotSession` throws if no `request.auth.uid` |
| Feature `botDee` | `assertFeatureAccess` (packaged `{IsFeatureEnabled:1, IsTestFeature:1}` → beta + Master Admin) |
| Classification role | `roleFactsFor` + `resolveViewerRole` (`patron` / venue / master, etc.) |
| Master Admin | `isServerAdminAuth` in `functions/admin-trust.js`: token `masterAdmin`/`superAdmin` **or** `email_verified` + listed email. **Never** `users/{uid}` fields. |
| Product tools | Re-assert `shoutOut` / `vipReservations` / `floqCast` |
| Club scope | Tools resolve venue slug/name to `clubLocations/{id}`; VIP helpers enforce hold ownership |

There is **no** tenant field on chat. “Tenant” in FLOQR is club/venue (`clubLocationId`), not a separate org id. Guessed `threadId` cannot be abused today because threads are not stored.

### 1.6 Rules, classification, indexes

| Item | Fact |
|---|---|
| `firestore.rules` `botDeeSettings/{docId}` | signed-in read; write false |
| `botDeeAccessThrottle` | deny-all (Functions only) |
| `floqAiAccessThrottle` | deny-all (legacy id) |
| Classification register | `botDeeSettings` internal; throttles secret. **No** thread/workflow/manifest rows |
| `firestore.indexes.json` | no BOT DEE composite indexes |
| Cloud Storage BOT DEE prefix | none |

### 1.7 Workers / queues

| Mechanism | In repo? | Used by BOT DEE? |
|---|---|---|
| `onSchedule` (Firebase scheduler) | **Yes** (`expireVipHolds`, `expireLiveShoutouts`, crawl, …) | No |
| Cloud Tasks / `onTaskDispatched` | **No** (VIP POS proposal only) | Spec: do not add unless approved |
| Pub/Sub domain events | Technical Bible wish-list, not BOT DEE | No |

Recovery of a crashed `executeBotSession` **does not exist**. If the Function times out after Stripe `sessions.create` but before the client sees `checkoutUrl`, Stripe idempotency on `orderId` helps **if the same order doc is reused**; BOT DEE does not persist that intent today.

### 1.8 Version / release intelligence (Part Two §5)

| Question | Answer on this SHA |
|---|---|
| BOT DEE application semver | **None.** FLOQR uses package id `s3.3.004` (cache-bust + `functions/package.json` + diagnostics). |
| CI-generated release manifest | **None** |
| `getBotDeeSystemInfo` | **None** |
| Capability registry | **None** (this folder is design-only) |
| If Master Admin asks “what version are you?” | Model improvises. Prompt does not forbid it. **Fails the spec.** |
| GitHub Actions | `functions-ci.yml` tests on push/PR; **deploy only** `workflow_dispatch deploy=true` or commit message `[firebase-deploy]` on `main`. `promote-test-to-main.yml` merges `test` → `main`. No manifest publish step. |

`FLOQRNav.appVersion` = `s` + `functions/package.json` version (`functions/app-version-sync.test.js`). That is **Pages asset cache-bust**, not BOT DEE application semver, and not a signed deployed manifest.

### 1.9 Tests

`functions/bot-dee-core.test.js`, `functions/botdee-page.test.js`, `functions/botdee-help-access.test.js`. Coverage: catalog, chitchat, tool wiring, idle settings, rules snippet. **No** workflow transitions, leases, manifest parsing, or admin version Q&A.

### 1.10 Observability

`console.info` JSON `{event:"botdee.session", uid, role, provider, results, toolRounds}`. No `correlationId`, no workflow metrics, no manifest-mismatch alert, no cost meters.

---

## 2. Gap vs Part Two spec

| Spec item | Status | Gap |
|---|---|---|
| Durable typed workflows + legal transitions | Missing | New engine |
| Firestore default store; no SQL/Redis/LangGraph | Compatible | Stay on Firestore |
| Compare-and-set revision + lease/claim | Missing | New |
| Append-only events; no 1 MiB blob doc | Missing | Split transcript vs events |
| Resume from last committed checkpoint | Missing | Part One prerequisite |
| Approval bound to tenant/user/payload digest | Missing | Product change: tools currently execute immediately |
| Recheck auth at execution | Partial | Tools re-check feature; no approval doc |
| Idempotency + uncertain-outcome reconcile | Partial | Stripe keys exist; BOT DEE has no intent ledger |
| PCI zero-card | Met in prompt + checkout URLs | Keep |
| Server-verified Master Admin version tool | Missing | `getBotDeeSystemInfo` |
| Deployment-generated manifest | Missing | CI + protected Firestore/Storage |
| Docs as product + capability matrix | Missing | This Phase A starts it; not shipped |
| Cloud Tasks | Not in stack | Prefer existing `onSchedule` |
| Preserve `executeBotSession` contract | Met if we only **add** optional fields | Do not rename callable |

**Stop:** Part One (durable **thread**) is not on `main`. Part Two (workflows + recovery + version intelligence) must not be described as complete. Implementation is **behind flags, after owner approval of this design**.

---

## 3. Assumptions in the spec that the repo does not match

1. **“Part One Firestore persistence”** — not shipped. Propose it as PR‑0, same flag family, not a silent rewrite.
2. **`tenantId`** — FLOQR scopes by `uid` + `clubLocationId`. Map spec `tenantId` → `clubLocationId` (empty for non-venue chat).
3. **Graph framework** — none. Do not add LangGraph.
4. **BOT DEE semver** — does not exist; do not treat `s3.3.004` as BOT DEE v1.0.0.
5. **Approval gates for chat bookings** — not current product behavior. Needs an explicit owner decision (see design).
6. **Open PR #69** — locale/profiles/prompt; independent of Part Two.
