# Jersey bring-up-to-standard (deferred)

## Status

Jersey catalog **core** on branch `cursor/sync-main-v29-09-96` is **frozen** to the blobs that match `origin/main` (v29.09.96 / `7c963c6`). A selective sync brought non-jersey WIP from the agents branch (`cursor/idle-shoutout-jersey-catalog-scheduling`) onto main without merging unrelated histories.

Do **not** treat agents-branch jersey work as the source of truth until a deliberate jersey uplift pass.

## Frozen to origin/main (must stay identical)

- `jersey-catalog.js`
- `jersey-preview-all.html`
- `national-teams-data.js`
- `.cursor/rules/sports-jersey-silhouettes.mdc`
- Tracked kit images under `images/soccer/soccer-*-back.png` (as on main)

## Bring up to standard later (not applied in this sync)

These exist on the agents worktree / WIP but were **not** forced onto this branch as main content:

| Item | Notes |
|------|--------|
| `soccer-jersey-preview.html` | Present on agents; not on main |
| `images/soccer/soccer-cameroon-back-blank.png` | Untracked on agents |
| `images/soccer/soccer-cameroon-back-with-country.png` | Untracked on agents |
| `images/soccer/soccer-nigeria-back-blank.png` | Untracked on agents |
| `images/soccer/soccer-nigeria-back-with-country.png` | Untracked on agents |

## Next step

Schedule a dedicated jersey uplift that reviews catalog data, silhouettes rule, preview pages, and national-team blank/with-country assets against product standard before replacing main-matching blobs.
