# BOT DEE Part Two — Phase A proposed design

**Not deployed.** Owner approval required before any application code.

Constraints from the spec: Firestore + existing Cloud Storage; **no** Cloud SQL, Redis, LangGraph, or LangSmith Agent Server; keep `executeBotSession` backward compatible; Cloud Tasks only if separately approved.

---

## 1. Product decisions that need a yes/no before PR‑2

Owner answers **13 Nov 2026:** D1 default · D3 yes · D4 default. **D2 and D5 still open** (owner asked to explain before choosing).

| ID | Decision | Default | Status |
|---|---|---|---|
| D1 | Extra **awaiting_approval** for chat-started VIP / ShoutOut / floqCast / pay, vs today’s “tool runs immediately + Stripe hosted pay”? | **Gate pay/publish**; holds may stay auto if 30‑min expiry remains | **Decided — default.** Chat may create a VIP hold (30‑min TTL). Stripe / publish wait for an approval step (who = D2). |
| D2 | Who approves: patron confirm in chat, Club Admin inbox, or both? | Patron **explicit confirm** in chat (digest shown); Club Admin only where existing product already requires it | **Open — explain.** |
| D3 | Conversation pause: expire **thread resume** vs keep workflow for the hold TTL? | Thread messages expire with idle (packaged **300s / 5 min**); **workflow** follows the business TTL (VIP hold 30 min) | **Decided — yes.** Fresh chat after pause; a hold/checkout already started still lives until its own expiry. |
| D4 | Non-admin “what version?” | Public: package id only + “I can’t verify a BOT DEE application build.” No roadmap | **Decided — default.** Internals only for server-verified Master Admin via `getBotDeeSystemInfo`. |
| D5 | Recovery worker | Use existing **`onSchedule`** (like `expireVipHolds`). No Cloud Tasks in v1 | **Open — explain.** |

---

## 2. Architecture (in-place)

Keep the callable. Add server-owned state. Gemini stays inside `executeBotSession`; it does **not** become a second runtime.

```
patron botdee.html
        │  executeBotSession({message, history?, threadId?})
        ▼
Firebase Callable (us-central1)
  Auth + botDee gate + classification
  load/create thread (uid-owned)
  if durable flag off → today's Gemini loop (compat)
  if on →
      append user event
      run at most N steps while lease held
      tools that are consequential → workflow docs
      reply + optional threadId / pendingApprovals
        │
        ├─ Firestore botDeeThreads / botDeeWorkflows / botDeeEvents
        ├─ existing vipHolds / serviceOrders / suprstarRequests
        └─ Storage botdee/{uid}/{workflowId}/*  (large artifacts only)
```

Master Admin version Q&A:

```
"What version are you?"
  → model may only call getBotDeeSystemInfo
  → server: isServerAdminAuth? load signed manifest : public stub
  → never invent semver from the prompt
```

### Sequence — durable turn (happy path)

1. Client sends message + optional `threadId` (ignored if it does not belong to `auth.uid`).
2. Function creates/opens `botDeeThreads/{threadId}` (`threadId` = `{uid}_{id}`).
3. Compare-and-set `revision`; take lease `leaseOwner=instanceId`, `leaseExpiresAt=now+55s` (under the 90s Function timeout).
4. Commit user message as an **event** (not an ever-growing transcript blob).
5. Gemini with last K events + system instruction (no secrets).
6. Tool call:
   - Read-only (`contextualSearch`) → run inline.
   - Consequential → create/advance `botDeeWorkflows/{workflowId}` **then** call existing helper **outside** the Firestore transaction.
7. Commit checkpoint (step index, redacted tool result refs, `revision++`), drop lease, return reply.

Crash: next call with same `threadId` sees expired lease and `state` in `executing`/`awaiting_external` → **resume from last committed checkpoint**; do not replay a side effect without the idempotency key.

---

## 3. State machine (workflows)

Legal transitions (**server only**):

```
created → validating → ready → executing → completed
                      ↘ awaiting_approval → ready
                      ↘ awaiting_external → executing
any non-terminal → cancelled | expired
executing → failed_retryable → executing | failed_terminal | awaiting_approval
awaiting_external → failed_retryable | completed | expired
```

Illegal hops throw `failed-precondition` and write an event `transition_denied`.

| State | Meaning |
|---|---|
| `created` | Doc allocated; payload not validated |
| `validating` | Schema + RBAC + feature flags |
| `awaiting_approval` | Digest shown; waiting patron/club confirm |
| `ready` | Approved or auto-approved; runnable |
| `executing` | Lease held; about to / just called downstream |
| `awaiting_external` | Stripe/POS/webhook outstanding |
| `completed` | Terminal success |
| `failed_retryable` | Infra/timeout; backoff |
| `failed_terminal` | Business reject or max attempts |
| `cancelled` | Actor or admin cancel |
| `expired` | Deadline / idle / hold TTL |

**Replay safety:** side effects (Stripe, hold, live request) only in `executing` with a stable `idempotencyKey`. Unknown outcome → `awaiting_external` + reconcile job, **not** a blind retry.

Retries: exponential backoff + jitter, cap (e.g. 5), then `failed_terminal` + dead-letter flag for Master Admin. Distinguish `retryClass: infrastructure | business`.

---

## 4. Data model (Firestore)

Deterministic ids. Functions-write. Client **no** write. 1 MiB: split events.

### `botDeeThreads/{threadId}`

`threadId` = `{uid}_{ulid}` (server-minted if client omits).

| Field | Notes |
|---|---|
| `schemaVersion` | `1` |
| `uid` | Owner; **must** match auth on every resume |
| `clubLocationId` | Optional venue scope |
| `roleAtStart` | Classification snapshot (re-check live role each turn) |
| `revision` | CAS |
| `leaseOwner` / `leaseExpiresAtMs` | Claim |
| `activeWorkflowId` | Optional |
| `idleExpiresAtMs` | From `botDeeSettings` |
| `status` | `active \| idle_ended \| purged` |
| `createdAt` / `updatedAt` | Server timestamps |

Messages live in `botDeeThreads/{id}/events/{eventId}` append-only (`seq`, `kind`, `redactedText`, `actorUid`). Cap: keep last 12 in a rollup pointer; older → Storage or delete per retention.

### `botDeeWorkflows/{workflowId}`

| Field | Notes |
|---|---|
| `definition` | `vip_reservation` \| `shoutout_checkout` \| `floqcast_checkout` \| … |
| `definitionVersion` | int |
| `uid` / `clubLocationId` | Scope |
| `threadId` | Parent |
| `state` / `stepIndex` / `revision` | |
| `approvalDigest` | SHA-256 of canonical payload |
| `approvalExpiresAtMs` | |
| `idempotencyKey` | Stable per intent |
| `retryCount` / `retryClass` | |
| `deadlineAtMs` | |
| `checkpoint` | Small JSON: holdId, orderId, requestId — **redacted** |
| `resultStoragePath` | Optional GCS |
| `correlationId` | Logs |

### `botDeeWorkflows/{id}/events/{eventId}`

Append-only audit: `fromState`, `toState`, `reason`, `actorUid`, `actorRole`, `payloadDigest`, `createdAt`. Never store PAN/CVV/OTP/raw prompt dumps.

### `botDeeReleaseManifest/current` (protected)

Written **only** by CI/Admin SDK after a tagged deploy. Fields per `spec/schemas/release-manifest.example.json` plus `capabilities[]` **or** pointer to `botDeeCapabilityRegistry/{id}`.

Client rules: **Master Admin read** of a **publicSafe** projection optional; full doc Functions-read via callable.

### Cloud Storage

`botdee/{uid}/{workflowId}/{artifactId}` — non-public; Functions + owner download URLs if needed. No cards, no system prompt files.

### Classification (must land in the same PR as collections)

| Collection | Sensitivity | Read | Write |
|---|---|---|---|
| `botDeeThreads` | PII (chat) | owner via callable; Master Admin break-glass later | Functions |
| `botDeeWorkflows` | PII + commerce refs | same | Functions |
| `botDeeReleaseManifest` | internal | callable (`getBotDeeSystemInfo`) | CI/Admin SDK |
| `botDeeCapabilityRegistry` | internal | callable | Master Admin SOS2FA or CI |

Retention: propose 24 months then delete/anonymize threads (align with VIP PII TBD / counsel). Capability registry retained with releases.

---

## 5. Access matrix

Every read/resume/approve/cancel/status **re-verifies** Auth + feature + live RBAC. Client-supplied ids are handles, not authority.

| Actor | Thread | Workflow | Approve pay/publish | Version internals | Roadmap |
|---|---|---|---|---|---|
| Signed-out | deny | deny | deny | deny | deny |
| Patron (botDee allowed) | own only | own only | own confirm if D2 | public stub only | no |
| Club Admin | own club workflows if scoped | venue-scoped | if D2 requires club | no | no |
| Master Admin (`isServerAdminAuth`) | break-glass later (not v1) | ops list v1 optional | no silent execute as patron | **yes** via `getBotDeeSystemInfo` | if registry `planned` |
| Spoofed “I am Master Admin” in chat | — | — | — | **deny**; tool uses token not text | — |

v1 Master Admin does **not** get a default PII browser on all threads (VIP-P-02 break-glass is a later gated change).

---

## 6. `executeBotSession` compatibility

Keep today’s fields. Additive optional:

```json
{
  "ok": true,
  "role": "patron",
  "reply": "…",
  "results": [],
  "provider": "gemini",
  "model": "gemini-3.6-flash",
  "toolRounds": 1,
  "threadId": "uid_01H…",
  "workflowId": null,
  "durable": false
}
```

`durable: false` when flag off → identical behavior to `s3.3.004`. Old clients omit `threadId`; server may still persist if flag on **or** stay memory-only until flag on.

---

## 7. Version intelligence

New callable `getBotDeeSystemInfo` (also a Gemini tool, **admin-only details**).

1. Require Auth + `botDee` (or Master Admin).
2. If `isServerAdminAuth(request.auth)` → full manifest + registry.
3. Else → `{applicationVersion: null, packageId: "s3.3.004", note: "cannot_verify_application_build", capabilities: []}` **or** policy D4.
4. If manifest missing/signature fail → `{verified: false, message: "I can't verify my deployed version right now"}`. **Never** fill from `systemInstruction`.
5. Prompt: identity/version questions for admins **must** call this tool; patrons get the stub without roadmap.

Manifest producer (CI, after Functions deploy from `origin/main`):

- `version` from a **BOT DEE** semver tag (new; not `s3.3.004`)
- `buildSha` = git SHA actually deployed
- `environment` = `production` \| `staging`
- `deployedAt` = pipeline time
- `capabilities[]` statuses: `planned | in_development | implemented | tested | deployed | disabled | deprecated`

Until that pipeline exists, the only honest chat answer is **cannot verify**.

Integrity v1: SHA-256 of canonical JSON stored next to the doc; CI writes both. Signature (KMS) is a later increment.

---

## 8. Feature flags

Do **not** use a new LangGraph. Use `botDeeSettings/default` (already Functions-write):

```
durableThreads: 0|1
durableWorkflows: 0|1
versionIntelligence: 0|1
```

Master Admin `setBotDeeSettings` already has SOS2FA + reason. Extend it (same callable, additive fields). Defaults **0**. Production stays current loop until flagged.

---

## 9. Observability

Structured log (redacted): `correlationId`, `threadId`, `workflowId`, `uid` (not email), `step`, `state`, `latencyMs`, `retryCount`, `errorCode`, `durable`.

Metrics (callable return + optional `botDeeOps/latest` rollup, not a new dashboard product): success, retry rate, pending approvals, stale leases, `awaiting_external` age, duplicate-key hits.

Alerts (proposal, no invented UI): Cloud Logging metric on `botdee.workflow_stuck` and `botdee.manifest_missing`. Master Admin Diagnostics row later (PR‑5).

---

## 10. Cost (Firestore at FLOQR scale)

No new always-on DB. Order of magnitude:

- 10k turns/month × ~6 writes + ~4 reads ≈ well under free daily quotas until busy beta.
- Worst case a few dollars/month plus existing Gemini (`gemini-3.6-flash` $0.75/$3.75 per 1M tokens through 2026-12-31).

Gemini dominates. Persistence is not the cost driver.
