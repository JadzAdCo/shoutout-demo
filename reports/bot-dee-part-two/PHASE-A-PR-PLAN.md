# BOT DEE Part Two — Phase A PR plan

**No application code in this PR.** Implementation starts only after owner approval of [PHASE-A-DESIGN.md](./PHASE-A-DESIGN.md) decisions D1–D5.

Flags default **off**. Rollback = flag `0` + revert Functions; schema is additive (no destructive migrations in v1).

---

## PR‑0 — Part One prerequisite: durable threads (flag `durableThreads`)

**Depends on:** none  
**Touches:** `bot-dee-functions.js`, `bot-dee-chat.js`, `firestore.rules`, classification register, tests

- Server-mint `threadId`; ignore ids that are not `{auth.uid}_*`
- `botDeeThreads` + `events` subcollection; last 12 events for Gemini
- CAS `revision`; short lease for the Function invocation
- Client: send `threadId` when present; still send `history` for old Functions
- Idle: mark thread `idle_ended`; do not keep unbounded transcripts
- Tests: owner isolation, guessed id denied, emulator transaction conflict

**Without PR‑0, Part Two workflows have nothing to resume.**

---

## PR‑1 — Version intelligence (flag `versionIntelligence`)

**Depends on:** none (can parallel PR‑0)  
**Touches:** new `getBotDeeSystemInfo`, `systemInstruction` tool rule, CI manifest writer (dry-run), `botDeeReleaseManifest` rules, tests, admin help

- Read-only callable; `isServerAdminAuth` for internals
- Missing manifest → explicit cannot-verify
- Seed registry rows as `planned` / `in_development` only — **never** `deployed` until rollout proof
- Script `scripts/build-bot-dee-release-manifest.js` for CI; do not auto-publish from a chat
- Docs: `BOT_DEE_RELEASE_NOTES.md` (empty history + this design SHA)

This is the smallest user-visible Master Admin win and does not need the workflow engine.

---

## PR‑2 — Workflow engine core (flag `durableWorkflows`)

**Depends on:** PR‑0  
**Touches:** new `functions/bot-dee-workflows.js`, rules, indexes, unit tests

- State machine + legal transition table
- Workflow doc + append-only events
- Lease/claim, backoff, cancel, expire helpers
- **No** product tool wiring yet (engine tests with a fake `echo` definition)

---

## PR‑3 — Consequential tools + approval + idempotency

**Depends on:** PR‑2, owner D1/D2  
**Touches:** `bot-dee-tools.js` wrappers only (do not fork VIP/Stripe internals)

- `createVipHold` / checkout / floqCast / ShoutOut pay create or advance workflows
- Side effects **outside** Firestore transactions
- Reuse Stripe `idempotencyKey` and VIP hold ids in `checkpoint`
- Uncertain timeout → `awaiting_external`
- Approval digest + expiry; re-check feature + role at execute
- PCI: still no card storage

---

## PR‑4 — Recovery via existing `onSchedule`

**Depends on:** PR‑3  
**Touches:** new `expireBotDeeWorkflows` next to `expireVipHolds`

- Sweep stale leases, expired approvals, `awaiting_external` past deadline
- Reconcile Stripe/hold by **read** then one idempotent retry max
- Never Cloud Tasks unless a later architecture decision

---

## PR‑5 — Docs, Diagnostics, i18n chrome, capability evidence

**Depends on:** PR‑1 at least; PR‑3 for “tested” evidence  

- `BOT_DEE_FEATURE_GUIDE.md`, `BOT_DEE_ADMIN_GUIDE.md`, `BOT_DEE_RUNBOOK.md`, `BOT_DEE_CAPABILITY_REGISTRY.md`
- Manual Feature Test rows; FEATURE-WIRING; classification
- i18n for any new patron strings (all 11 langs) **in the same PR**
- Do not email QA until Pages + Functions are actually live (post-feature-qa rule)

---

## Deployment phases (spec §9)

| Phase | What |
|---|---|
| **A** | This audit/design (current) |
| **B** | PRs 0–5 on feature branch, flags 0 |
| **C** | Emulator + staging; canary one beta tenant; flags 1 there only |
| **D** | Production flags only after **explicit owner approval**; Functions deploy from `origin/main` archive (`post-deploy-qc.mdc`) |

Pages publish ≠ Functions deploy. Version intelligence is a **Functions** feature.

---

## Rollback

1. `durableWorkflows` / `durableThreads` / `versionIntelligence` → 0  
2. Revert Functions to previous `main` SHA  
3. Leave unused collections in place (no drop)  
4. Clients still work: they ignore extra response fields and still send `history`

---

## Security review (must travel with PR‑0/1/2)

- Rules: no client writes to threads/workflows/manifest  
- Callable authz: uid match, Master Admin via `admin-trust` not prompt text  
- Redaction in logs and events  
- Prompt injection: tool results are data; version tool ignores user-claimed roles  
- Data classification rows in the **same** iteration (`feature-data-classification-security.mdc`)

---

## What is **not** implemented (this Phase A)

- No production code, flags, or collections  
- No LangGraph / Postgres / Redis / LangSmith  
- No Cloud Tasks  
- No Master Admin PII break-glass browser  
- No claim that Part Two or PR #69 is deployed  
- No BOT DEE application semver until CI writes a real manifest  
- No automatic production deploy  

**Go / no-go for writing code:** owner approves this design + D1–D5. Until then, stop.
