# BOT-DEE UPGRADE — PART TWO: Durable Execution, Recovery & Version Intelligence

**Implementation status:** specification only; not evidence of deployed functionality.
**Target:** existing FLOQR / BOT-DEE repository and Firebase environment.
**Directive:** upgrade in place; audit first; do not deploy or merge without approval.

## 0. Source-of-truth and discovery (mandatory first)
Inspect actual source and deployment configuration before writing code. Locate `executeBotSession`, Firebase callable exports, Firestore schema/rules, auth/RBAC, tenant scoping, audit logs, BOT-DEE prompts, tests, release workflow, and FLOQR client call sites. Report paths and verified current behavior. Do not assume a graph framework or database schema exists. Identify current BOT-DEE version source, if any. If the repo differs from these assumptions, produce a gap report and propose a migration, not a silent rewrite.

## 1. Objectives and boundaries
Implement durable execution and recovery for BOT-DEE while retaining the current Firebase callable interface and existing application flows. Use Firestore as the default durable state store and Cloud Storage for large media. Do NOT introduce Cloud SQL, Redis, LangGraph, LangSmith Agent Server, or new hosted dependencies without a separate approved architecture decision. Preserve `executeBotSession` public contract unless a versioned change is approved. Existing client integrations must continue to work.

Part One (Firestore persistence) may be incomplete. Verify its prerequisites before Part Two. If missing, implement prerequisites behind flags or stop and request approval; do not imply completion.

## 2. Durable workflow engine
Model each long-running operation as a durable, typed workflow with explicit states: `created`, `validating`, `awaiting_approval`, `ready`, `executing`, `awaiting_external`, `completed`, `failed_retryable`, `failed_terminal`, `cancelled`, `expired`. Validate legal transitions on server only. Store workflow definition version, tenantId, actor UID, resource scope, intent, step index, execution metadata, timestamps, retry count, deadlines, checkpoint revision, and redacted structured results. Use append-only event records for audit. No single ever-growing JSON document: respect Firestore 1 MiB document limit. Large artifacts go to Cloud Storage with scoped references.

Implement transaction-guarded compare-and-set revisions and per-workflow lease/claim with expiry for concurrent calls and workers. Use server timestamps and deterministic workflow IDs. Do not hold a Firestore transaction open while calling an external API. Support resumable execution from the last *committed* checkpoint; define replay safety and side-effect boundaries. Distinguish infrastructure retry from business-operation retry. Implement bounded exponential backoff, jitter, max attempts, timeouts, dead-letter/manual review state, cancellation and expiration. Use scheduled jobs/Cloud Tasks only if already present or explicitly approved. Never infer that exactly-once execution is guaranteed.

## 3. External actions, approval and safety
Require explicit approval for bookings, purchases, posting, ShoutOut/FloqCAST publication, payments and other consequential actions as appropriate to existing policies. Approval must bind tenant, user, role, exact action payload digest, expiration and workflow version. Recheck authorization and approval at execution time. Use stable idempotency keys for external actions; persist request intent and result, reconcile uncertain outcomes before retrying, and do not duplicate reservations or publications. If downstream service lacks idempotency, implement a manual reconciliation path. PCI zero-card policy: do not store card numbers, CVV, or payment credentials; use hosted checkout links only.

## 4. Tenant isolation and privacy
Enforce all authorization in trusted backend code, not by client-supplied `threadId`, workflow ID or role. Verify Firebase Auth identity and membership, tenant and venue scope, and current RBAC for every read, resume, approve, cancel, and status operation. Separate patron, venue-manager, master-admin visibility. Restrict cross-tenant access even for guessed IDs. Master Admin access must be server-verified, logged, and limited to authorized administrative scopes; never assume a title in a user prompt is proof. Classify PII, redact logs and traces, define retention/deletion policies and GDPR/CCPA handling where applicable. Do not expose secrets, system prompts, internal tokens, other tenants' records or raw stack traces in chat.

## 5. BOT-DEE Version Intelligence — REQUIRED FEATURE
When a verified Master Admin asks questions like "What version are you?", "What's new in BOT-DEE?", "What improvements are installed?", "What's planned?", "What is your release history?", BOT-DEE must call a protected, read-only `getBotDeeSystemInfo` backend tool. Never rely on model memory or a static system prompt for factual version information. Responses must distinguish:
- BOT-DEE application version (semver), build SHA, environment, deployedAt, release channel
- AI model/provider version only if verifiably available and allowed; explicitly distinguish from BOT-DEE application version
- capabilities: `planned`, `in_development`, `implemented`, `tested`, `deployed`, `disabled`, `deprecated` (with scope/feature flag)
- release notes, improvements, migration status, known limitations, operational readiness
- last verified health-check timestamp, if available
- links or IDs to approved internal documentation, without exposing privileged paths or secrets.

Populate system info from a deployment-generated release manifest and an approved, access-controlled capability registry. Version/build metadata must be generated by CI/CD from a tagged release and actual deployment; never self-increment in chat or claim Part Two is live merely because this prompt was read. Validate manifest schema and signature/integrity as appropriate. If metadata is unavailable, say "I can't verify my deployed version right now" and provide only verifiable information. Non-admins may receive a minimal safe public version summary only if policy permits; no internal infrastructure or roadmap details. Ensure administrator queries cannot be spoofed through user messages or retrieved content. Include admin-facing change log and release notes in the repo.

Suggested response shape (only with verified data): "BOT-DEE application vX.Y.Z (production; build abc123; deployed YYYY-MM-DD). Part Two: durable workflows [deployed/tested/planned], recovery [status], approval gates [status]. Recent improvements: ... Known limitations: ... This is BOT-DEE's application version, not the underlying AI model version."

## 6. Documentation as a maintained product feature
Create or update the docs listed in README. Document architecture, diagrams, API contracts, state machine and legal transitions, Firestore collections/indexes/rules, access matrix, privacy/retention, idempotency and failure recovery, operator runbooks, observability, feature flags, migration/rollback, release notes, admin version Q&A and a capability matrix with evidence links. Keep user-facing explanations accessible; technical details restricted to admins. Add a docs-maintenance checklist to every release PR. Treat stale or undocumented capabilities as not verified.

## 7. Observability and reliability
Emit structured logs with correlationId, workflowId, tenant-safe identifiers, step, state, latency, retry, and error code; redact content and PII. Metrics: execution success, retry rate, pending approvals, stale leases, age of awaiting_external workflows, duplicate-action prevention, recovery time, Firestore read/write/storage cost estimates. Alerts for stuck workflows, repeated failures and version-manifest mismatch. Provide operational dashboard proposal without inventing an existing dashboard.

## 8. Tests and acceptance gates
Unit: state transition validation, revision conflicts, idempotency, approval expiry, policy enforcement, version manifest parsing and response. Integration: Firebase emulator Firestore transactions, duplicate concurrent requests, resume after simulated crash, expired lease, external timeout with unknown outcome, cancellation, role revocation, tenant isolation. E2E: patron -> approval -> authorized execution -> completion; Master Admin version Q&A reads actual manifest; unauthenticated/spoofed admin requests denied. Negative tests: malicious thread IDs, replay, forged tool output, secrets and cross-tenant reads. Test migration with synthetic data; never use production PII in fixtures. Verify backward compatibility and rollback.

## 9. Deployment strategy
Phase A: audit and design diff (NO CODE CHANGES until reviewed). Phase B: implement behind flags in feature branch, with schema/rules/index migration plan. Phase C: emulator + staging validation, canary/limited tenant pilot. Phase D: production only after explicit owner approval. Document rollback of code, flags and worker schedules; avoid irreversible schema changes. Preserve existing production data. No automatic production deployment.

## 10. Required Cursor deliverables
1. Current-state audit with exact file paths and verified facts vs assumptions.
2. Proposed architecture + sequence diagram, state machine, data model and access matrix.
3. Implementation plan broken into PRs with dependencies and estimates.
4. Changes in feature branch after approval; tests and migration scripts.
5. `BOT_DEE_FEATURE_GUIDE.md`, `BOT_DEE_ADMIN_GUIDE.md`, `BOT_DEE_RELEASE_NOTES.md`, `BOT_DEE_CAPABILITY_REGISTRY.md`, `BOT_DEE_RUNBOOK.md`.
6. Release manifest generator and read-only `getBotDeeSystemInfo` implementation with auth and tests.
7. Test results, staging proof, cost estimates, security review and rollback plan.
8. Explicit list of what is *not* yet implemented.

**Stop point:** Return the audit, proposed diffs and design first. Do not merge, enable flags in production, or deploy without approval.
