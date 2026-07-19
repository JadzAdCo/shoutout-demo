# FLOQR Rollback - v29.03

This rollback returns the web app to the previous known-good package before the v29.03 ShoutOut editor, Mingl Requests, profile status, birthday/privacy, and Mingl friend settings updates.

## Rollback steps

1. Upload the previous full package, `ShoutOut-wepApp.v29.02.zip`, to the GitHub Pages repository root.
2. Hard refresh the app with the previous cache-bust URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=29.02
```

3. If you published the v29.03 Firestore or Storage rule headers for diagnostics alignment, republish the v29.02 rule files only if your diagnostics require exact header matching.
4. Rerun Master Admin > Diagnostics > Package Install Diagnostics and Rules Smoke Test.

## Data impact

This rollback does not delete Firebase Auth users, patron profiles, ShoutOuts, Mingl data, Bata data, guest lists, uploads, ad campaigns, diagnostics history, club onboarding records, or promoter onboarding records.

New v29.03 profile fields such as `birthMonth`, `birthDay`, `birthdayNotifyOthers`, `birthdayNotificationScope`, `languageSettings.emojiSkinTone`, and `minglFriendSettings` may remain in Firestore after rollback. The v29.02 app should ignore those unused fields.

## What v29.03 changed

- ShoutOut editor message flow now places the Preview ShoutOut control in the Message card and opens preview in a modal that auto-closes after 5 seconds.
- ShoutOut recommendations are grouped into AI Recommendations, Trending ShoutOuts, and Generic ShoutOuts with help text behind `?` popouts.
- Mingl Requests are separated into Sent Mingl/Friend Request and Received Mingl/Friend Request groups.
- Mingl Requests now show a right-side `(sent/received)` status popout.
- Patron profile now stores birthday month/day only.
- My Privacy now includes birthday notification choices.
- Patron Portal now includes Manage Mingl Friends for close friends, exclude viewing/contacting, and only disappearing messages.
- Language Settings now includes emoji skin tone preference.
- Mingl Chat message edit uses an inline mini editor rather than a browser prompt.
- Mingl Chat adds forward, do-not-forward, and immediate disappearing message actions.
- Global profile status pill is injected on main user/admin/backend pages, excluding display output pages.
