# FLOQR — Standard things to do after each deployment

Use this checklist **every** time a package ships to GitHub Pages / Firebase (or when a local iteration is marked “ready”).  
Do **not** skip items because the change “felt small.”

Live base URL:

```text
https://jadzadco.github.io/shoutout-demo/
```

Cache-bust with `?v=<package>` on every link you hand a tester.

---

## After-deploy checklist (required)

### 1. Update the diagnostic page

- Bump `CURRENT_DIAGNOSTICS_PACKAGE_VERSION` in `ai-diagnostics-service.js`.
- Add a **package install** block under `PACKAGE_INSTALL_CHECKS` for the new version (file markers + cache-bust strings).
- Add **manual feature tests** under `MANUAL_FEATURE_TESTS` for each user-visible change.
- Cache-bust `ai-diagnostics-service.js?v=…` on `master-admin.html`.
- After publish: Master Admin → **Diagnostics** → **Run Diagnostics** → **Rules Smoke Test** if rules/functions changed.
- Archive passing package checks when appropriate.

### 2. Help `?` popouts on every developed page

- Prefer short helper copy in `p.sub.small` / `.helper-text` so `helper-popouts.js` auto-converts to `?`.
- Or use explicit `<details class="help-popout">` / `floqr-help-popout` buttons.
- Load `helper-popouts.js` on every interactive HTML page (not display-only boards).
- Help text must explain **what the control does**, not repeat the page title.

### 3. Standard popout open / dismiss behavior (site-wide)

All help / status / command popouts must share this behavior:

| Action | Expected |
|--------|----------|
| Click `?` or open control | One popout opens |
| Click another `?` | Previous help closes; new one opens |
| Click anywhere else on the page | Open help/status popout closes |
| Press `Escape` | Open help popout closes |
| Command result popout | Auto-hides after success (~2s) **and** offers **Close Window**; click outside also closes |

Shared implementations:

- Help: `helper-popouts.js`
- Command results: `floqr-action-feedback.js` (`FLOQRActionFeedback.run`)

Do **not** invent page-specific dismiss rules unless the product requires a modal lock (auth MFA, payment).

### 4. Document live step-by-step tests

- Update **this file** (live links + steps below) **and** `README.md` release notes / focused manual tests.
- Mirror the same scenarios into Master Admin Diagnostics manual tests.
- Every test step must use a **real live URL** after deploy (or clearly mark “local only”).

### 5. Profile and status card on all non-popout screens

- Load `global-profile-status.js` on every signed-in interactive page.
- **Exceptions (no profile pill):** `display.html` (venue board), pure redirect stubs, migration/seed/auth-debug tools if intentionally bare.
- Main `index.html` already owns `#userMenu` — do not double-inject there.
- Profile menu must include Sign out, My Profile / Settings, Inbox, Mingl (and BartR when shopping is live).

### 6. Command buttons that do **not** navigate need confirmation popouts

Any in-place command (Save, Publish, Deactivate, Accept/Deny, Connect refresh, etc.) must use `FLOQRActionFeedback` (or equivalent) so the patron sees:

1. Working…  
2. Success or failure  
3. Auto-dismiss **and** Close Window  

**Not** required for pure links (`<a href>` to another page) or Back navigation.

### 7. Quality gate — CI logs before preview email (required)

**Do not email preview links until CI is green** for the published commit.

1. Confirm the commit is on the intended remotes (`workspace/v29-08` and, for GitHub Pages, `main`).
2. If `functions/**`, `firestore.rules`, `storage.rules`, or related paths changed, open the latest **Functions CI and Deploy** run for that SHA and read the **Functions tests** logs (not just the email/notification).
3. Run `npm test` in `functions/` locally when CI is red or before pushing functions changes.
4. Fix failures and re-push; wait for a **success** conclusion on Functions tests (Pages build success alone is not enough when functions changed).
5. Only after the gate passes → send mobile preview email (step 8).

Firebase Functions / rules deploy is separate: Pages can be live while Functions CI failed and `workflow_dispatch` deploy was skipped. Treat that as **not fully deployed**.

### 8. Email mobile preview links (required after webapp changes)

After every iteration that changes patron/admin UX, **and after the CI quality gate in step 7 passes**, send preview links by email so testers can open them on iPhone:

1. Publish the package to GitHub Pages (or confirm the live site reflects the change).
2. Master Admin → **Diagnostics** → **Email mobile preview links** (SendGrid via `sendFloqrPreviewLinksEmail` when signed in).
3. Or POST to Cloud Function `emailFloqrPreviewLinks` (defaults to `bans.don@gmail.com` if not signed in).
4. Update `PREVIEW_LINKS_PACKAGE` in `ai-diagnostics-service.js` and `defaultFloqrPreviewLinks()` in `functions/ai-discovery-functions.js` when the package version changes.
5. Include **stable display URLs** (no `?v=`) for LED/embed links; admin/portal links may include `?v=`.

Confirm the email arrived before marking the deploy complete.

---

## Also update (same iteration)

| Artifact | What to change |
|----------|----------------|
| `README.md` | Current package version, live `?v=` URL, bullet highlights, focused manual tests |
| `FLOQR-WORDLIST.md` | New shared terms / backlog only |
| `DEPLOYMENT-V*.md` / `ROLLBACK-V*.md` | When shipping a numbered package |
| Firebase functions/rules | Deploy only when backend changed; then Rules Smoke Test |
| Script `?v=` cache-busts | Every edited JS/CSS/HTML consumer |
| Media inputs | Local file upload first; use `url-media-field.js`; no visible URL paste for logos/icons |
| Display URLs | Stable `display.html?location=…` without `?v=` (devices + external embeds) |
| Preview link email | Master Admin → Email mobile preview links; bump `PREVIEW_LINKS_PACKAGE` each release |

---

## How to test current features (live links)

Replace `29.09.9` with the package you just published if different.

### A. Search screen + BartR entry

1. Open [Search (category page)](https://jadzadco.github.io/shoutout-demo/?v=29.09.9&start=search) (sign in if needed).
2. Confirm **BartR** appears as a **larger** tile under ShoutOut / Mingl with the BartR icon.
3. Tap BartR → [BartR storefront](https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.9&from=search).
4. Confirm Back says **Back to Search** (not welcome).
5. Confirm top-right **profile status** pill is present.

### B. Contextual Back (portal satellites)

1. Open [My Profile and Settings](https://jadzadco.github.io/shoutout-demo/patron-portal.html?v=29.09.9).
2. Confirm **no** duplicate “Signed in as…” / Account card under the title (identity is the top-right pill).
3. Open [Mingl Chat from portal](https://jadzadco.github.io/shoutout-demo/mingl-chat.html?v=29.09.9&from=portal) → Back → Profile and Settings.
4. Open [Follow Services](https://jadzadco.github.io/shoutout-demo/services.html?v=29.09.9&from=portal) → Back → Profile and Settings.
5. Open [BartR from portal](https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.9&from=portal) → Back → Profile and Settings.
6. From Profile and Settings, Back → Search (`start=search`).

### C. BartR seller backend (US only)

1. In Profile → **My Profile**, set Country to **United States**, enable **BartR seller store**, set store name / contact / refund policy, **Save Profile** (expect success popout).
2. Open tab **BartR Store** (`?tab=bartr`).
3. Publish a test product → expect success popout; product listed.
4. Open [BartR marketplace](https://jadzadco.github.io/shoutout-demo/commerce.html?v=29.09.9&from=search) signed in → product appears (may be shuffled).
5. Optional Stripe test checkout (marks test payment). Vendor ships; FloqR is MoR.

### D. Fix Grammar (personal dictionary)

1. [Language Settings](https://jadzadco.github.io/shoutout-demo/patron-portal.html?tab=language&v=29.09.9).
2. Under **My Personal Corrections** add:

   ```text
   watz -> what's
   weakend -> weekend
   ```

3. Save (expect acknowledgement popout).
4. Open [Mingl Chat](https://jadzadco.github.io/shoutout-demo/mingl-chat.html?v=29.09.9&from=portal).
5. Type a draft with those words → **Correct Grammar/Spelling** (or Fix Grammar).
6. Expect Gemini first; if unavailable, only personal corrections apply. Word List entries must not be “fixed away.”

### E. Help `?` and dismiss

1. On Profile / Language / ShoutOut editor pages, click a `?`.
2. Click elsewhere → popout closes.
3. Press Escape → closes.
4. Open a second `?` → first closes.

### F. Club / Master Admin Back + profile pill

1. [Club Admin](https://jadzadco.github.io/shoutout-demo/admin.html?v=29.09.9) → Back to Search; profile pill visible.
2. [Master Admin](https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.9) → Diagnostics for current package; profile pill visible.

### G. Master Admin Diagnostics

1. [Master Admin Diagnostics](https://jadzadco.github.io/shoutout-demo/master-admin.html?v=29.09.9) → open **Diagnostics**.
2. **Run Diagnostics** for package `v29.09.9` (or current).
3. Walk the **manual feature tests** listed for BartR, navigation, and grammar.

---

## Honest status (this workspace)

| Practice | Status |
|----------|--------|
| README + diagnostics after **every** local iteration | **Required going forward** via this standard (recent BartR/nav work was partially ahead of docs; this package catches up). |
| Live publish | Only when you explicitly approve deploy. |
| Remaining chrome cleanup | See `FLOQR-WORDLIST.md` backlog (index Sign out rows, etc.). |

---

## Quick owner command (copy/paste)

After you say “Deploy” and publish succeeds:

1. Checklist §1–6 above  
2. Smoke A–G with live `?v=`  
3. Paste any Fail into chat with URL + expected vs actual  
