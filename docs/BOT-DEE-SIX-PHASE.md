# BOT DEE six-phase upgrade (spec v1.2)

Brand: **BOT DEE**. Feature key: `botDee`. Page: `botdee.html` → `executeBotSession`. Upgrade, never rebuild.

**Status:** implemented and unit-tested on this branch. **Not production-deployed.** `deployedClaim` stays false until origin/main Pages + Functions are verified. Do not merge or deploy without owner approval.

Idle pause (Master Admin, packaged default **300 seconds**) ends the **active** session. It does not delete an opted-in archive. Default consent is off. Guests are not saved. Mingl conversations are never imported. No stored IP. No LangChain / Redis / SQL.

## Phase order (1 → 2 → 3 → 5 → 4 → 6)

| Part | Name | Code | Tested | Deployed |
|---|---|---|---|---|
| 1 | Foundation / audit | existing `executeBotSession` + Auth + `botDee` gate + 300s idle | yes | live chat already on main |
| 2 | Durable execution + version manifest | checkpoints, idempotency, capability registry | yes | no |
| 3 | Opt-in memory | archive, memories, export/delete, consent | yes | no |
| 5 | SmartViews | schema + mock catalog; venue → `club-profile.html?location=` | yes | no |
| 4 | Research adapters | mock-only; votes ≠ consent; name ≠ identity | yes | no |
| 6 | Actions | existing FLOQR tools; partner bookings mock + confirm | yes | no |

## Backout

1. Leave Functions undeployed (this PR).
2. If already deployed: set `botDeeSettings.durableThreads=0` and keep legal gates `blocked` / `mock_only`.
3. Pages rollback: revert `botdee.html` Settings bubble / memory popout.

## Owner decisions still required

1. Merge this PR?
2. Deploy Functions + Firestore rules?
3. Legal evidence per provider (see `docs/BOT-DEE-LEGAL-PROVIDER-GATE.md`) before any live adapter.

## Key files

`functions/botdee-upgrade-*.js`, `functions/botdee-execution.js`, `functions/botdee-memory.js`, `functions/botdee-smartview-core.js`, `functions/botdee-research.js`, `functions/botdee-actions.js`, `botdee-upgrade-ui.js`, `botdee-smartview.js`, `schemas/botdee-smartview.schema.json`, `firestore.rules` (new collections Functions-write).
