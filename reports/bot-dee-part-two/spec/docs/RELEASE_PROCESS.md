# BOT-DEE Release Governance

- Define BOT-DEE application semver independently of AI model/provider versions.
- CI creates manifest from tagged release, immutable git SHA, environment and deployment timestamp.
- Deployment pipeline publishes only verified manifest to protected location.
- Capability registry entries include evidence, status, owner, flag and environment; status 'deployed' only after rollout verification.
- Protected read-only backend `getBotDeeSystemInfo` loads deployed manifest and registry; checks verified Master Admin role before internal details.
- Chat responses cite release metadata and distinguish current vs planned functionality; no fabricated versions.
- On manifest missing/mismatch: explicit inability to verify, alert operators, do not invent a version.
- Release PR checklist: docs, migrations, tests, monitoring, rollback, security, version Q&A regression, approval.
