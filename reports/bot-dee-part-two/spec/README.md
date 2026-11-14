# BOT-DEE Upgrade Part Two — Cursor Implementation Package

Purpose: durable workflows, reliable recovery, approval gates, tenant security, and Master Admin-verifiable BOT-DEE version/capability reporting.

Start: give Cursor this directory/ZIP, open `CURSOR_MASTER_PROMPT.md`, and ask it to complete the discovery/audit phase first. No production changes without approval.

Files:
- `CURSOR_MASTER_PROMPT.md` — authoritative implementation brief
- `docs/FEATURE_DOCUMENTATION_TEMPLATE.md` — required product/technical documentation structure
- `docs/RELEASE_PROCESS.md` — version and release governance
- `schemas/release-manifest.example.json` — EXAMPLE ONLY, not actual deployment status
- `schemas/workflow.example.json` — illustrative schema, not current Firestore structure
- `tests/ACCEPTANCE_CHECKLIST.md` — test matrix and go/no-go gates

Version rule: a design package version is not the BOT-DEE application version. Only deployed release metadata can establish application version.

Use existing code and security rules as source of truth; audit and reconcile before implementation.
