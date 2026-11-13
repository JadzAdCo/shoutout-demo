# BOT DEE capability registry (design draft)

**None of these rows are `deployed`.** Status reflects intent after Phase A only. Chat must not cite this file as live proof.

| Id | Description | Owner | Status | Flag | Evidence |
|---|---|---|---|---|---|
| `botdee.chat.executeBotSession` | Signed-in Gemini/local chat loop | FLOQR | `deployed` on `s3.3.004` | `featureServices/botDee` | `functions/bot-dee-functions.js` @ `03a17d3f` |
| `botdee.tools.product` | VIP / ShoutOut / floqCast tools, immediate execute | FLOQR | `deployed` | product feature keys | `functions/bot-dee-tools.js` |
| `botdee.pci.zero_card` | No card/CVV in chat; hosted checkout URLs | FLOQR | `deployed` (prompt + Stripe) | — | `systemInstruction` + commerce idempotency |
| `botdee.threads.durable` | Firestore thread + events | FLOQR | `planned` | `durableThreads` | Phase A design |
| `botdee.workflows.durable` | Typed workflow state machine + leases | FLOQR | `planned` | `durableWorkflows` | Phase A design |
| `botdee.workflows.approval` | Payload-digest approval before pay/publish | FLOQR | `planned` | D1/D2 | Needs owner decision |
| `botdee.recovery.schedule` | `onSchedule` sweep / reconcile | FLOQR | `planned` | `durableWorkflows` | No Cloud Tasks in v1 |
| `botdee.version.intelligence` | `getBotDeeSystemInfo` + CI manifest | FLOQR | `planned` | `versionIntelligence` | Phase A design |
| `botdee.langgraph` | LangGraph / Postgres / Redis | — | `deprecated` as approach | — | Owner Part Two: do not add |
