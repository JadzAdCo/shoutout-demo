# Rollback Guide: Jadz AdCo ShoutOut v28.10

Release package:

```text
jadz-shoutout-v28-10-contextual-search-ui-cleanup-full-package.zip
```

Live test URL:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.10
```

## What v28.10 Changed

- Removed the Country / State / City / Music Genre dropdown filter row from the search page.
- Kept the contextual search input as the only visible search control.
- Updated search helper copy and placeholder text.
- Bumped cache-busting query strings to `v=28.10`.

## Firebase / Firestore / Storage Impact

No Firebase config changes.

No Firestore schema changes.

No Firestore rules changes.

No Firestore indexes added or removed.

No Firebase Storage rules or path changes.

## Code Rollback

Preferred rollback:

1. Revert the GitHub commit that uploaded v28.10.
2. Wait 1-3 minutes for GitHub Pages to republish.
3. Test with:

```text
https://jadzadco.github.io/shoutout-demo/?v=28.9-rollback-test
```

Manual rollback:

1. Extract the previous known-good package, such as v28.9.
2. Upload the previous package contents to the GitHub repo root.
3. Replace existing files.
4. Commit with:

```text
Rollback from v28.10 to previous package
```

## Database / Storage Rollback

No database rollback is required for v28.10.

If live testing created test ShoutOuts, guest list requests, or uploaded media:

1. Delete only the specific test Firestore records you created.
2. Delete only matching test media under:

```text
shoutouts/{uid}/...
```

Do not delete production records or shared configuration documents.
