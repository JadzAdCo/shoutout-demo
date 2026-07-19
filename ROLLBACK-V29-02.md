# FLOQR Rollback - v29.02

This rollback returns the web app to the previous known-good package before the v29.02 ShoutOut recommendation, grammar dictionary discovery, and location-ranking test updates.

## Rollback steps

1. Upload the previous full package to the GitHub Pages repository root.
2. Hard refresh the app with the previous package cache-bust URL.
3. If you published the v29.02 Firestore or Storage rule headers only for version alignment, republish the previous package rules if your diagnostics process requires exact header matching.
4. Rerun Master Admin > Diagnostics > Package Install Diagnostics and Rules Smoke Test.

## Data impact

This rollback does not delete Firebase Auth users, patron profiles, ShoutOuts, Mingl data, Bata data, guest lists, uploads, ad campaigns, diagnostics history, club onboarding records, or promoter onboarding records.

## What v29.02 changed

- ShoutOut recommendations use recommendation style, event/audience context, venue genres, profile signals, and past ShoutOuts without inserting visible `Tone:` or `Style:` labels.
- ShoutOut editor text is trimmed to the selected template's safe display caps.
- Patron Portal > Language Settings explains how to test personal dictionary corrections.
- Club/event search shows a visible ranking status line for browser/profile location and preference ranking.
