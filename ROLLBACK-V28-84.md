# FLOQR Rollback - v28.84 ShoutOut Media Chat Grammar

Use this note only for direct rollback from `v28.84-shoutout-media-chat-grammar`.

Rollback target:
- Restore the previous full package files from `v28.83-mobile-mingl-inbox`.
- Keep Firebase Auth users, Firestore user profiles, ShoutOut history, Mingl requests/chats, Bata planning data, guest lists, and uploaded media.
- Do not delete `users/{uid}.languageSettings`; older code will ignore it safely.

No Firebase rules rollback is required for this package unless you independently changed deployed rules.

After rollback:
1. Upload the previous package to GitHub Pages.
2. Hard refresh with `?v=28.83-mobile-mingl-inbox`.
3. Run Master Admin > Diagnostics > Package Install Diagnostics.
4. Run the rules smoke test only if Firestore or Storage rules were changed separately.
