# BOT DEE session lifecycle and memory

Master Admin idle (`conversationIdleSeconds`, default **300**) ends the **active execution session**. It is not archive deletion.

| Store | Lifetime | Default |
|---|---|---|
| Active turns on `botDeeThreads/{uid}` | Lease ends on idle / farewell (`idleEnded`); turns stay for retrieval | on for signed-in (`durableThreads`) |
| Opt-in archive `botDeeThreads/{uid}/archive` | Survives idle until user deletes or revokes consent | **off** |
| Memories `botDeeThreads/{uid}/memories` | User-controlled, TTL | **off** |
| Guest tab history | Ephemeral | never persisted |
| Mingl `messages` | Separate product | never imported |

Resume rebuilds bounded Gemini context from the last 12 authorized turns plus summaries/memories. Server RAM is not the model token window. `maxInputTokensVerified` stays null until the deployed model config is read.

User text is persisted **before** Gemini so a crash does not drop the last message. Consent revocation stops retrieval immediately; backups may retain copies for the platform window.
