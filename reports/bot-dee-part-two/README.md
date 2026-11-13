# BOT DEE Part Two — Phase A (audit / design)

**Status:** specification + audit, plus PR‑0 durable threads on the feature branch. **Workflows / version intelligence not deployed.** Owner 13 Nov 2026: D1 default, D3 yes, D4 default; **D2 and D5 still open.**

**Workspace HEAD audited:** `03a17d3f` (`main`, package `s3.3.004` / `functions/package.json` `3.3.004`).

**Directive from the owner package:** upgrade in place; audit first; do not merge, enable flags, or deploy without explicit approval.

| Doc | Role |
|---|---|
| [PHASE-A-AUDIT.md](./PHASE-A-AUDIT.md) | Current-state facts vs Part Two assumptions (required stop point) |
| [PHASE-A-DESIGN.md](./PHASE-A-DESIGN.md) | Proposed Firestore engine, state machine, access matrix, version intelligence |
| [PHASE-A-PR-PLAN.md](./PHASE-A-PR-PLAN.md) | Flagged PRs, dependencies, rollback, cost, what is **not** implemented |
| [spec/](./spec/) | Owner zip as received (`CURSOR_MASTER_PROMPT.md` is authoritative) |

Application version is **not** this design-package folder. Only a CI-published release manifest can establish BOT DEE’s application version (Part Two §5 / §9).
