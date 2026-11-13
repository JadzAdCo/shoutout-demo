# BOT DEE capability registry (design draft)

**None of these rows are `deployed`.** Status reflects intent after Phase A only. Chat must not cite this file as live proof.

| Id | Description | Owner | Status | Flag | Evidence |
|---|---|---|---|---|---|
| `botdee.chat.executeBotSession` | Signed-in Gemini/local chat loop | FLOQR | `deployed` on `s3.3.004` | `featureServices/botDee` | `functions/bot-dee-functions.js` @ `03a17d3f` |
| `botdee.tools.product` | VIP / ShoutOut / floqCast tools, immediate execute | FLOQR | `deployed` | product feature keys | `functions/bot-dee-tools.js` |
| `botdee.pci.zero_card` | No card/CVV in chat; hosted checkout URLs | FLOQR | `deployed` (prompt + Stripe) | — | `systemInstruction` + commerce idempotency |
| `botdee.threads.durable` | Firestore thread + events | FLOQR | `in_development` (this PR; not live until Functions + rules deploy) | `durableThreads` (default 1) | `functions/bot-dee-thread.js` |
| `botdee.workflows.durable` | Typed workflow state machine + leases | FLOQR | `planned` | `durableWorkflows` | Phase A design |
| `botdee.workflows.approval` | Payload-digest approval before pay/publish | FLOQR | `planned` | D1 decided (gate pay/publish); **D2 open** | Who confirms is still owner D2 |
| `botdee.recovery.schedule` | Sweep / reconcile stuck workflows | FLOQR | `planned` | **D5 open** | Default candidate: existing `onSchedule` (no Cloud Tasks unless D5 picks Tasks) |
| `botdee.version.intelligence` | `getBotDeeSystemInfo` + CI manifest | FLOQR | `planned` | `versionIntelligence` | D4 decided: patrons get package id only |
| `botdee.langgraph` | LangGraph / Postgres / Redis | — | `deprecated` as approach | — | Owner Part Two: do not add |
