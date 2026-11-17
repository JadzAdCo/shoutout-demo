# People SmartView v2 (s3.3.028)

Status: **implemented on this branch**. Pages + Functions **not deployed** until Don approves. Do not merge without Don.

Black Tiffany pack is illustration only. Production inherits the viewing patron’s Site Chrome. Chat shell and recall are unchanged. No live Places/Yelp.

## Implemented

- Inline People SmartView (`kind: patron`) in BOT DEE bubbles; compact photo + SMARTsummary + Social/Dating/Dining/Future Travels.
- Source locale is the patron’s default UI language. Gemini drafts SMARTsummary in that language. Owner edits store `translations.{B}` as source and fan out to every other locale, including English.
- Site Chrome tokens (`--accent`, `--hot`, `--text`, `--muted`, `--floqr-ink`). Theme change updates the card without dropping the chat draft.
- `usercharacter_analysis/{uid}` + `smartViewTranslationJobs` + `botDeeSmartViewDiagnostics` (Functions-write).
- Owner-only `saveSmartSummary` in default profile language (`uiLanguage`); editor loads source text in B, never a viewer translation; ready translations cannot be re-stamped as source. Deterministic Gemini-off draft is in B. Revision/hash stale-job guard; source fallback labeled while pending/failed.
- Gemini drafts asynchronously after profile save **in the source locale**; never on `getPeopleSmartView`. Owner-authored text is not overwritten. An English viewer reads `translations.en`.
- Dating only with explicit opt-in. Public-within-FLOQR fields only. Blocks honored.
- 11-language chrome (`botdee.sv.*`) + help ids. Master Admin SMARTviews subtab preserved (`#featuresBotDee-smartviews`).

## Mocked / awaiting approval

- Venue/restaurant/etc. catalog remains mock (`listBotDeeSmartViews` / `botdee-smartview-mock.json`).
- Gemini translation requires Functions deploy + `GEMINI_API_KEY`. Unconfigured jobs fail closed to labeled source language.
- Live chrome on GitHub Pages waits on Don (close-the-loop). Amara mock photo is a static asset, not a live patron.

## Rollback

Revert this PR. Collections are Functions-write; unused docs do not affect chat. No Pages/Functions deploy in this iteration.
