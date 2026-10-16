# FLOQR on Azure — 3 simple sites + floqr.app (patron / admin / master split)

Planning document · Oct 12 2026 · package at time of writing: **s3.1.38** · status: **PLAN ONLY** — no app code changed, nothing published, no Azure resources created.

Azure prices and limits below are the last published figures known to the author. Confirm them on the Azure pricing page before you buy; they change.

---

## Executive summary (1 page)

**What you asked for**

1. Three simple websites on Azure.
2. Move the FLOQR demo (today on GitHub Pages) to **floqr.app** on Azure.
3. Separate the **patron** site from the **Club Admin** and **Master Admin** sites.

**Recommendation in one paragraph**

Use **Azure Static Web Apps (SWA)** for everything. It is built for plain HTML/JS sites, deploys automatically from GitHub, gives free HTTPS certificates, and supports custom domains, security headers and an optional Microsoft (Entra ID) sign-in gate. Keep **Firebase** (Auth, Firestore, Storage, Cloud Functions, Stripe/SendGrid/Twilio wiring) exactly where it is — this is a **hosting move**, not a backend rewrite. Moving the backend to Azure would be a separate 6–12-month project.

**Target layout for FLOQR**

| Host | What lives there |
|---|---|
| `www.floqr.app` (apex `floqr.app` → www) | Patron site: Search, My Profile, satellites, public pages, **Xibo Display boards** |
| `admin.floqr.app` | Club Admin (venue admin) console + manager tools |
| `master.floqr.app` | Master Admin only, with an extra Microsoft sign-in gate in front |
| `staging.floqr.app` | Full copy for testing before every release |

Three separate origins means three separate browser sessions, storage and security policies: a bug or bad script on the patron site cannot read an admin's session, and the Master Admin site can be locked down hardest.

**The three simple sites** each become one Free SWA app (cost **$0/month** plus your domain fees). You only need to tell us their names, domains and content (list in Part A §A7).

**Cost** — FLOQR hosting about **$27–30/month** (3 × SWA Standard at ~$9 + DNS), or **$0–2/month** if you start on the Free plan. Optional Azure Front Door WAF adds ~$35/month (Standard) or ~$330/month (Premium). Firebase bills stay as they are.

**Conflict to resolve** — the saved cutover rule picked **`https://www.floqr.com`** as the production address. You now want **floqr.app**. This plan assumes **`https://www.floqr.app`** is the new canonical address and that `floqr.com` (if you own it) **301-redirects** to it. Email is currently sent from `login@floqr.com`, so floqr.com's email DNS must stay alive even if its website redirects.

**Phases** — 0 prepare (domain, Azure, one origin config, remove hardcoded GitHub addresses) → 1 full mirror on `staging.floqr.app` → 2 split into www / admin / master (soft launch, GitHub Pages still primary) → 3 cutover (switch links, Functions defaults, Xibo board URLs) → 4 harden (Microsoft gate, CSP, per-site App Check, admin claims/tenants) → 5 retire GitHub Pages behind redirect pages. Every phase can be rolled back because GitHub Pages keeps serving the same code until Phase 5.

**Biggest risks found in the code** — Stripe checkout return addresses are locked to the GitHub address today (payments would bounce back to github.io); "Show Display URL" builds a *relative* link that would point Xibo at the admin host once admin moves; the sign-in fallback that uses page redirects can break across domains on Safari; patrons must sign in again once on the new domain.

---

## Part A — Three simple sites on Azure

### A1. What to use

**Recommended: Azure Static Web Apps (SWA).** You put HTML/CSS/JS/images in a GitHub folder; every push to `main` publishes the site within a minute or two. HTTPS certificates are created and renewed for you.

| | Free | Standard |
|---|---|---|
| Price | $0 | ~$9 per app per month |
| Custom domains per app | 2 | 5 |
| Free HTTPS certificate | Yes | Yes |
| Bandwidth | 100 GB/month per subscription (hard cap) | 100 GB included, then ~$0.20/GB |
| Max site size | 250 MB | 500 MB |
| Preview (staging) environments | 3 | 10 |
| Built-in sign-in (GitHub, Microsoft) | Yes | Yes |
| Your own Entra ID / OIDC sign-in, password-protected previews, SLA (99.95%) | No | Yes |

For three brochure-style sites, **Free is enough**. Move a site to Standard only if it needs an uptime SLA, a password on preview builds, or more than 2 domain names.

**Alternative: Azure Storage "static website" + Azure Front Door.** Use it only when you need something SWA cannot do: one domain serving several back ends by path (`floqr.app/admin` from a different source), a managed Web Application Firewall, advanced redirect rules that keep the path, or sites larger than 500 MB. It costs more (Front Door Standard ~$35/month base) and is more work to set up. Not recommended for simple sites.

**Not a fit for SWA:** sites that need WordPress or a server-side CMS. If any of the three sites must be edited by non-technical people in a browser, tell us — options are a static site generator with a Git-based editor, or Azure App Service.

### A2. One-time Azure setup (owner)

1. Create or sign in to an Azure account at portal.azure.com. Use a work account you control long-term (for example your Jadz Holdings Microsoft account), not a personal throwaway.
2. **Subscription:** "Pay-As-You-Go" is fine. Then **Cost Management → Budgets → Add**: monthly budget e.g. $50 with email alerts at 50% / 90% / 100%.
3. **Resource group:** Portal → Resource groups → Create → name `rg-floqr-sites`, region **East US 2** (SWA content is served globally; the region only stores settings).
4. **DNS (recommended):** Portal → DNS zones → Create → zone name = your domain (e.g. `example.com`). Azure shows 4 name servers; at your registrar (where you bought the domain) replace the name servers with those 4. Cost ~$0.50 per domain per month. This makes the "bare" domain (`example.com` without `www`) easy. **Before switching name servers, copy every existing record (especially MX / email, SPF, DKIM TXT records) into the Azure zone, or email for that domain stops.**

### A3. Repo layout (one repo for the three sites)

One GitHub repo (e.g. `JadzAdCo/simple-sites`) with a folder per site is easiest to maintain. Use three repos only if different people own each site.

```text
simple-sites/
  site-one/
    index.html
    404.html
    about.html
    css/site.css
    js/site.js
    images/
    staticwebapp.config.json
  site-two/
    ...same shape...
  site-three/
    ...same shape...
  .github/workflows/
    azure-site-one.yml
    azure-site-two.yml
    azure-site-three.yml
```

### A4. Create each site (owner, ~10 minutes per site)

1. Portal → **Create a resource → Static Web App**.
2. Resource group `rg-floqr-sites`, name `swa-site-one`, plan **Free**, region East US 2.
3. Source **GitHub** → sign in → pick org, repo `simple-sites`, branch `main`.
4. Build presets **Custom**: App location `site-one`, Api location empty, Output location empty.
5. Create. Azure commits a workflow file to `.github/workflows/` and stores a deploy token as a GitHub secret. The first deploy runs automatically; the site appears at a random address like `https://nice-sand-0abc123.azurestaticapps.net`.
6. Repeat for site two and three (`app_location` = `site-two`, `site-three`).

Equivalent command line (Azure CLI), if you prefer:

```bash
az group create -n rg-floqr-sites -l eastus2
az staticwebapp create -n swa-site-one -g rg-floqr-sites \
  --source https://github.com/JadzAdCo/simple-sites --branch main \
  --app-location "site-one" --output-location "" --login-with-github --sku Free
```

### A5. Auto-deploy workflow (GitHub Actions)

Azure generates this. Two edits make it monorepo-friendly: `paths:` so a change in site-one does not redeploy the others, and `skip_app_build: true` because plain HTML needs no build.

```yaml
name: Deploy site-one
on:
  push:
    branches: [main]
    paths: ["site-one/**"]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]
    paths: ["site-one/**"]
jobs:
  deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_SITE_ONE }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: site-one
          output_location: ""
          skip_app_build: true
  close_preview:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_SITE_ONE }}
          action: close
          app_location: site-one
```

Pull requests get a temporary preview URL (public on Free). Merging to `main` publishes the real site.

### A6. Custom domain + HTTPS

In the portal: Static Web App → **Custom domains → Add**.

- **`www.example.com` (subdomain):** choose "CNAME". Add a DNS record `www` CNAME → `nice-sand-0abc123.azurestaticapps.net`. Azure validates and issues the certificate automatically (minutes to an hour).
- **`example.com` (apex / bare domain):** choose "TXT" validation. Add the TXT record Azure shows, wait for "Validated", then point the apex at the site:
  - With **Azure DNS**: add an **alias record** (`@`, type A, alias to the Static Web App resource). Simplest.
  - With another DNS provider: use an **ALIAS / ANAME / CNAME-flattening** record pointing at the `azurestaticapps.net` name. Plain A records to an IP are not supported.
- Then set one of the two as **default domain** so the other redirects to it (portal: Custom domains → "Set default"; confirm the option in your portal).
- HTTPS is automatic. Nothing to buy. Plain HTTP requests are redirected to HTTPS.

### A7. What we need from you for each of the three sites

You did not name them yet. For each site, please send:

1. Purpose in one line and the site's name.
2. Domain name (already owned? at which registrar? or do we buy it?). Does the domain have email today (MX records) that must keep working?
3. Pages and content: do you have finished HTML, a design/Figma, or only text and photos?
4. Contact or signup forms? (Static sites need a small serverless function or a form service to receive submissions — included free with SWA.)
5. Analytics (Google Analytics, Microsoft Clarity, none)? Cookie banner needed?
6. Languages.
7. Who edits it later and how (you via GitHub, an agent, a designer, or a browser CMS)?
8. Replacing an old site? If yes, list old URLs to redirect.
9. Any login / members area? (SWA can gate pages behind Microsoft or GitHub sign-in.)

Assumption until you answer: three small brochure sites, 3–10 pages each, English, contact link by email, Free plan, one repo.

### A8. Sample `staticwebapp.config.json` (simple site)

```json
{
  "trailingSlash": "auto",
  "routes": [
    { "route": "/old-about.html", "redirect": "/about.html", "statusCode": 301 },
    { "route": "/images/*", "headers": { "Cache-Control": "public, max-age=604800" } }
  ],
  "responseOverrides": {
    "404": { "rewrite": "/404.html", "statusCode": 404 }
  },
  "globalHeaders": {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  },
  "mimeTypes": { ".webmanifest": "application/manifest+json" }
}
```

Do not add `navigationFallback` for multi-page sites; it is only for single-page apps.

### A9. Cost for Part A

- 3 × SWA Free: **$0/month**.
- Azure DNS: ~$0.50 per domain per month (+ cents for queries).
- Domains: ~$10–20 per domain per year at the registrar (Azure's own domain store does not sell `.app`; buy those at Cloudflare, Namecheap, Porkbun, Squarespace Domains, etc.).
- Optional upgrade to Standard: ~$9 per site per month.

---

## Part B — FLOQR on floqr.app with patron / admin / master separation

### B1. The domain decision (conflict with the saved cutover rule)

`.cursor/rules/cutoffrequirement.mdc` says canonical production is **`https://www.floqr.com`**, apex redirects to www, and `floq.ai` / `floqr.ai` / GitHub Pages are not canonical. `floqr-canonical.js` hardcodes `https://www.floqr.com`, and `privacy.html`, a privacy test, and the ad checkout allowlist repeat it. **floqr.app appears nowhere in the code today.**

This plan treats **floqr.app as your new choice**:

- Canonical patron origin: **`https://www.floqr.app`**; apex `https://floqr.app` → 301 → www. (Keeping www matches the old rule, so only the TLD changes. Apex-as-canonical also works on SWA if you prefer the shorter address — open decision.)
- New hosts added to the rule: `admin.floqr.app`, `master.floqr.app`, `staging.floqr.app`.
- **floqr.com:** if you own it, keep it and **301-redirect every path to `https://www.floqr.app`**. It must keep its email DNS (SPF / DKIM / DMARC for SendGrid) because Functions send from `login@floqr.com` in five places. Optionally move the sender to `login@floqr.app` later (needs SendGrid domain authentication on floqr.app).
- **`.app` note:** the whole `.app` TLD is on the browsers' HSTS preload list. Browsers will only ever load it over HTTPS. SWA issues certificates automatically, so this is fine — but there is no "http first, fix SSL later": the certificate must be validated before anyone visits. Any `http://` asset URL would be blocked.

What changes in the cutover rule once you confirm (to be edited in Phase 0, not now):

- `www.floqr.com` → `www.floqr.app` everywhere (canonical, Authorized domains, OAuth origins, reCAPTCHA domains, Stripe returns, privacy URLs, Associated Domains / App Links, Display host).
- Add the admin / master / staging hosts and the "floqr.com 301 → floqr.app" line.
- Hosting changes from "GitHub Pages → www" to "Azure Static Web Apps (3 apps)".
- Related notes to update in the same change: the fork proposal in `design-notes-feature-services.mdc` (`admin.floqr.com` + Firebase Hosting site → `admin.floqr.app` / `master.floqr.app` on SWA), the cutover note in `design-notes-club-website-feed.mdc`, and the App Check / security-header rows in `design-notes-data-classification.mdc`.

### B2. Target topology (recommended)

| Host | SWA app | Plan | Gate in front of Firebase login |
|---|---|---|---|
| `www.floqr.app` + `floqr.app` | `swa-floqr-www` | Standard | None (public; Xibo must load without login) |
| `admin.floqr.app` | `swa-floqr-admin` | Standard | None at first (venue admins are external people) |
| `master.floqr.app` | `swa-floqr-master` | Standard | Microsoft Entra ID sign-in (Phase 4), optional IP allowlist |
| `staging.floqr.app` | `swa-floqr-staging` | Free | None, but not linked anywhere; `noindex` |
| `floqr.com` (if owned) | `swa-floqr-redirect` | Free | Redirect only |

**Why a separate `master.floqr.app` instead of `admin.floqr.app/master`:**

- Each origin has its own Firebase session storage (IndexedDB), localStorage and cookies. A Club Admin page — or a script injected into it — can never read a Master Admin session.
- Each origin gets its own Content-Security-Policy and framing rules.
- The Microsoft (Entra) gate and an IP allowlist can cover the whole master site without touching venue admins, who are not in your Microsoft tenant.
- It can get its own App Check key and, later, its own Identity Platform tenant.
- SWA cannot serve one domain from two apps by path without adding Front Door.

You may prefer a less guessable name (`ops.floqr.app`, `nic.floqr.app`). Obscurity is not security, but it reduces noise — open decision.

**Displays stay on `www.floqr.app`.** Xibo URLs keep their exact shape — only the host changes:
`https://jadzadco.github.io/shoutout-demo/display.html?location=<id>` → `https://www.floqr.app/display.html?location=<id>` (same for `display2.html`). No `?v=`, no `?screen=` (`screen-datapoints.mdc`, `floqr-versioning.mdc`). Note the `/shoutout-demo/` path prefix disappears; the app uses relative `./` links, so that is safe.

### B3. Keep Firebase as the backend (recommended)

Phase 1–5 change **only where the HTML/JS files are served from**. Auth, Firestore, Storage, the ~130 Cloud Functions (us-central1), App Check, Stripe/SendGrid/Twilio webhooks (all on `cloudfunctions.net` URLs) stay unchanged. Callable functions accept any origin, so they keep working from the new hosts.

Rough size of a *full* move to Azure, for reference only (not recommended now):

- Auth (Google, Microsoft, Facebook, email OTP, SMS, WhatsApp, custom claims, SOS2FA) → Entra External ID + custom code.
- Firestore (~128 collections) **and its security rules** → Cosmos DB plus a new API layer: ~70 client JS files read/write Firestore directly and rely on rules; Azure has no equivalent, so every read/write needs a server endpoint.
- ~130 Functions (callables, triggers, schedules, webhooks) → Azure Functions rewrite; secrets → Key Vault.
- Storage + storage rules → Blob Storage + SAS tokens; App Check → no direct equivalent.
- Estimate: **6–12 months of engineering**, effectively a rewrite of every data path, with data migration and a long dual-run. Only worth it for a strategic reason (single vendor, compliance contract, Azure credits).

### B4. Page inventory and where each page goes

Classified from the workspace HTML files (served pages at repo root; `.tmp-*`, `previews/`, `migrations/`, `reports/` are never shipped). Today GitHub Pages serves *everything tracked on main*, including seed and debug tools. The new build uses an **allowlist**, so anything not listed is not published.

**Patron + public site — `www.floqr.app`**

- Hubs: `index.html` (Search + Welcome sign-in), `patron-portal.html` (My Profile & Settings).
- Satellites (session shell): `floqai.html`, `commerce.html` (BartR), `pickup.html` + `rydr.html` (RydR), `mingl-chat.html`, `mingl-gist.html`, `suprstr-search.html`, `suprstar-preview.html`, `guest-list.html`, `services.html`, `role-request.html`, `beta-invite.html`, `payment-return.html` (Stripe return), `staff-worksheet.html` (Work Calendar, framed by My Profile).
- Public (no sign-in): `privacy.html`, `translation-policy.html`, `club-profile.html`, `ad-submit.html`, `ad-invoice.html`, `jersey-preview-all.html` (linked from FloqAi), legacy redirects `floqai-search.html` → floqai, `bartr.html`.
- Embeds for club websites (framed by third-party sites): `club-embed.html`, `schedule-embed.html`.
- Display (Xibo, no login): `display.html`, `display2.html`, `displays.html` (redirect to Display 2), `display-error.html`.

**Club Admin site — `admin.floqr.app`**

- Hub: `admin.html` (Venue Command Center).
- Satellites: `scheduling.html` (manager scheduling), `template-tags.html`, `role-profiles.html`, `promoter-admin.html` (promoter dashboard — today used only by Master Admins; open decision).
- Preview-only copies of `display.html` / `display2.html` for the in-page board preview iframes (never given to Xibo).

**Master Admin site — `master.floqr.app`**

- Hub: `master-admin.html` (Network Intelligence Center).
- Tools: `demo-signin.html` (redirects into the Master Admin tab), `seed-v29-09-14.html` (SOS2FA seed caller), `onboard-dc-venues.html` (venue batch onboarding), `scheduling.html` copy if Master Admins schedule on behalf of clubs (or link to admin site).
- Preview-only display copies, as above.

**Staging only — `staging.floqr.app` (never production)**

- Debug / QA: `auth-debug.html`, `mobile-test-checklist.html`, `temp-qa-images-preview.html`.
- LED art previews: `nfl-*.html` (8), `soccer-*.html` (3), `heist-*-preview.html` (2), `football-intro-preview.html`, `christine-text-fit-demo.html`, `ad-campaign-preview-v28.99.html`.
- Local design previews: `rydr-icon-preview.html`, `rydr-logo-iterations.html`, `bartr-ui-preview.html`.

**Retire (not published anywhere)**

- `seed.html` (old seed DB page), `firestore-rebrand-jadz-to-floqr-v28.31-f.html` (one-off migration).

Links that currently point at staging-only pages and must change: `admin.html` and `master-admin.html` sign-in notes mention `auth-debug.html`; FloqAi / help link to `onboard-dc-venues.html` (move to master host); the preview-email Functions link to seed / checklist / temp-QA pages.

### B5. Which JavaScript each site needs

All three sites share one core set (copied into each site at build time):

- Firebase compat SDK from `www.gstatic.com/firebasejs/10.12.5` + `firebase-config.js`, `floqr-app-check.js`.
- Navigation / session: `floqr-nav.js`, `floqr-session-shell.js`, `profile-access-guard.js`, `global-profile-status.js`, `floqr-canonical.js`.
- i18n + help: `floqr-i18n.js`, `floqr-i18n-help.js`, `floqai-help-repository.js`, `help-attach.js`, `helper-popouts.js`, `floqr-reason-prompt.js` (+ CSS).
- Data / gates: `shared-data.js`, `feature-gates.js`, `floqr-feature-services.js`, `floqr-tab-gates.js`, `floqr-people-directory.js`, `floqr-access-notice.js`, `floqr-action-feedback.js`, `floqr-logger.js`, `payment-service.js`, `notification-center.js`, `floqr-identity.js`.
- Styles + images: `styles.css`, `admin.css`, brand images.

Site-specific:

- **www:** `patron-app.js`, `patron-portal-app.js`, `intent-search.js`, `floqai-*.js`, `floqr-geo-search.js`, ad scripts (`ad-campaigns.js`, `floqr-ad-*.js`, `dc-spot-ad-campaigns.js`), satellite apps (`commerce-app.js`, `pickup-app.js`, `mingl-*-app.js`, `suprstr-search.js`, `suprstar-preview.js`, `suprstr-webrtc.js`, `guest-list-app.js`, `services-app.js`, `staff-worksheet.js`, `staff-week-grid.js`, `worker-confirm.js`, …), display stack (`display-app.js`, `display-suprstr.js`, `floqr-frame-loop.js`, `floqr-board-fit.js`, `jersey-catalog.js`, `national-teams-data.js`), embeds (`club-embed.js`), all LED art in `images/`.
- **admin:** `admin-app.js`, `admin-*.js` (scheduling, notifications, marketing, spot ads, venue hours, rep extension), `scheduling-*.js`, `assignment-card.js`, `floqr-venue-calendar.js`, `floqr-employee-network.js`, `floqr-featured-staff.js`, `floqr-staff-marketing-consent.js`, `media-source-picker.js`, `messaging-credits.js`, `marketing-templates.js`, `floqr-board-frame.js`, `floqr-template-*.js`, `master-twilio-logging.js` (admin.html loads it today), display stack for previews.
- **master:** `master-admin-app.js`, `master-*.js` (feature services, data classification, display security, diagnostics panels, logging, ad management, shoutouts, demo employees), `sos2fa.js`, `entity-management.js`, `ai-discovery-service.js`, `ai-diagnostics-service.js`, `floqr-venue-datapoints.js`, `duplicate-record-service.js`, `floqr-data-classification.js`, display stack for previews.

Phase 2 ships "core + everything except the other sites' app files" (safe, little risk of a missing file). Phase 4 tightens to exact lists (the fork proposal's "split bundles": no `master-*.js` on www). Note: hiding admin JS from www is hygiene, not security — the server and rules are the real controls.

### B6. Shared code and repo strategy

**One repo (`JadzAdCo/shoutout-demo`), one source tree, a build step that cuts it into sites.**

- The repo root stays the source of truth. GitHub Pages keeps serving it unchanged until Phase 5 (this is the rollback path).
- New `sites/sites.config.json`: for each site, the page allowlist, extra files, header template, and per-environment origins. A test fails CI if any root `.html` page is not assigned to exactly one of: www / admin / master / staging-only / retired. New pages can never ship by accident.
- New `scripts/build-sites.js` → writes `dist/www`, `dist/admin`, `dist/master`, `dist/staging`, each with its own `staticwebapp.config.json` and a generated `floqr-sites.js` (origin map for that environment). `dist/` is git-ignored.
- One workflow `.github/workflows/azure-swa.yml` with a job per site: checkout → `node scripts/i18n-coverage-report.js` + version-sync tests → `node scripts/build-sites.js` → `Azure/static-web-apps-deploy@v1` with `app_location: dist/<site>`, `skip_app_build: true`. Production apps deploy from `main`; staging deploys from `test` (matches the existing `sync-main-into-test.yml` / `promote-test-to-main.yml` flow).
- **Why not git submodules or a shared asset host (`assets.floqr.app`):** submodules add a second release process; a shared cross-origin asset host needs CORS + Subresource Integrity + wider CSP. Duplicating ~2–5 MB of JS per site is free and keeps each site self-contained.
- **Cache-busting:** unchanged — the bump script stamps `?v=<package>` on asset tags; page links never carry `?v=` (`floqr-versioning.mdc`). Suggest calling the split release **s3.2.0** (minor: new hosting, compatible).
- **i18n / help:** `floqr-i18n.js` and `floqr-i18n-help.js` ship to every site; the i18n gate runs before each deploy. Any new string (e.g. "Club Admin now lives at admin.floqr.app — sign in there") goes into all 11 language packs and the FloqAi repository in the same change.
- **Functions deploy** rules are unchanged: only from a clean `git archive` of `origin/main`, after `check-functions-sync.js` (`post-deploy-qc.mdc`).

### B7. One origin config instead of hardcoded addresses

**Inventory of hardcoded origins** (workspace, excluding `.tmp-*`, `reports/`, `migrations/`, `.cursor/`):

- `jadzadco.github.io` / `github.io/shoutout-demo`: **~276 occurrences in 72 files**. Most are docs (`README.md` 99, `STANDARD-AFTER-DEPLOYMENT.md` 13, DEPLOYMENT/ROLLBACK notes ~33) and one-off scripts (preview-email / publish scripts ~110).
- **Served client code — 8 files, 18 hits:** `ai-diagnostics-service.js` (9, test instructions + a base URL), `patron-app.js` (3, error messages naming the domain), `admin-app.js` (1), `master-admin-app.js` (1), `master-diagnostics-panels.js` (1, `PUBLIC_BASE`), `floqr-temp-qa-showcase.js` (1, `PAGES`), `mobile-test-checklist.js` (1, `BASE`), `firebase-config.js` (1 comment listing App Check domains).
- **Functions runtime — 9 files, 13 hits:** `commerce-functions.js` (`DEFAULT_ORIGIN`, no env override — Stripe returns), `ad-functions.js` (`FLOQR_PUBLIC_ORIGIN` + `RETURN_ORIGINS`), `messaging-functions.js` (`FLOQR_PUBLIC_ORIGIN`), `scheduling-core.js` (default; `scheduling-functions.js` reads `FLOQR_PUBLIC_ORIGIN`), `venue-ingest-core.js` (club feed / iframe links, no env), `display-security-functions.js` (`FLOQR_DISPLAY_BASE_URL`), `stripe-connect-core.js` (`business_url`), `demo-seed-functions.js`, `ai-discovery-functions.js` (4, preview-email bases).
- Functions one-off scripts 4 files / 6 hits; Functions tests 4 files / 4 hits.
- `floqr.com`: client `floqr-canonical.js` (3), `privacy.html` (3), `ai-diagnostics-service.js` (3); Functions `ad-functions.js` return allowlist (1); sender `login@floqr.com` in `sos2fa-functions.js`, `messaging-functions.js` (2), `commerce-functions.js`, `receipt-delivery.js`, `ad-functions.js`; discovery bot user-agent `+https://floqr.com` (1 + 1 script); 7 test files.
- `floqr.app`: 0.

**Design (Phase 0, agent):**

- Client: generated `floqr-sites.js` → `window.FLOQRSites = { env, patron, admin, master, display, siteOf(page), urlFor(page, params) }`. On GitHub Pages it maps every role to the same origin + `/shoutout-demo/`, so nothing changes until cutover. `FLOQRCanonical` reads it (`PRODUCTION_ORIGIN` → `https://www.floqr.app`).
- `FLOQRNav.adminHome`, `masterHome`, `portalHome`, `searchHome`, `stableDisplayUrl`, and the FloqAi `pageUrl` builders return an **absolute** URL when the target page belongs to another site, relative otherwise. Today `stableDisplayUrl` returns `./display.html…`, which on `admin.floqr.app` would show admins an admin-host Display URL to paste into Xibo — must become `https://www.floqr.app/display.html?location=…`.
- Functions: one module `functions/public-origins.js` reading plain env vars (in `functions/.env`, not secrets): `FLOQR_PUBLIC_ORIGIN`, `FLOQR_ADMIN_ORIGIN`, `FLOQR_MASTER_ORIGIN`, `FLOQR_DISPLAY_BASE_URL`, `FLOQR_RETURN_ORIGINS` (comma list). Replace the nine hardcoded defaults; tests assert no `github.io` literal remains in runtime Functions code.
- Error messages that name `jadzadco.github.io` use `location.hostname` instead.

### B8. Cross-site links and sign-in

- **Sessions are per origin.** A patron signed in on www is *not* signed in on admin or master. Club Admins and Master Admins sign in again on their site (same Firebase account, same providers, until Phase 4 tenants). Put one sentence in the Club Admin help and the Welcome "?" (all languages).
- **Sign-in redirects must stay on the same site.** `FLOQRSessionShell.loginHref()` and `profile-access-guard.js` send signed-out users to `./?profileRequired=sign-in&returnTo=…`. On the admin and master sites, `./` must be that site's own sign-in hub (`admin.html` / `master-admin.html` auth card, with `returnTo` support) — never the patron Welcome card, whose session would be useless there.
- **Stored relative links keep working via redirect stubs.** Inbox rows must use relative `./page.html…` links (Firestore rules enforce it), and Functions build absolute email/SMS links. So each site gets redirect routes for the *other* sites' pages: e.g. `www.floqr.app/admin.html?tab=scheduling` → `https://admin.floqr.app/admin.html?tab=scheduling`, and `admin.floqr.app/patron-portal.html?tab=work-calendar…` → www. Query strings and `#hash` must survive; verify SWA redirect behaviour in Phase 1, and fall back to a 10-line HTML stub (`location.replace`) if SWA drops the query.
- Volume of cross links: FloqAi/help repository ~100 links to admin pages, `intent-search.js` 22, diagnostics ~75 — all go through `FLOQRSites.urlFor`, with the stubs as a safety net.
- **Iframes:** My Profile frames `staff-worksheet.html` (same site — fine). Admin and master board previews use their own local copies of `display.html`. Third-party club websites frame `club-embed.html` and `schedule-embed.html`.

### B9. Security headers per site (`staticwebapp.config.json`)

All sites: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (**not** `same-origin` — that breaks Firebase popup sign-in).

Content-Security-Policy starts as **`Content-Security-Policy-Report-Only`** for at least a week: the pages use inline `style=` attributes and some inline script, so an enforced policy on day one would break screens. Hosts the policy must allow: `www.gstatic.com` (Firebase SDK, reCAPTCHA), `www.google.com` / `recaptchaenterprise` (App Check), `*.googleapis.com` (Firestore, Auth, Storage, App Check), `*.cloudfunctions.net` / `us-central1-shoutoutdemo-5b402.cloudfunctions.net`, `shoutoutdemo-5b402.firebaseapp.com` (auth frame), `firebasestorage.googleapis.com` (media), `get.geojs.io` (IP location), embed providers used by media pickers (YouTube, Mixcloud, …), `checkout.stripe.com` (navigation only).

- **www:** `frame-ancestors 'self'` by default, with route exceptions: `club-embed.html` and `schedule-embed.html` → `frame-ancestors *` (club websites); **`display.html` / `display2.html` → no `frame-ancestors` and no `X-Frame-Options`**, because Xibo players may render web widgets inside an iframe. `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)` (supRstar camera, FloqAi nearest-first).
- **admin:** `frame-ancestors 'self'` (only its own preview frames), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` on HTML.
- **master:** same as admin + `frame-ancestors 'none'` on `master-admin.html`, Entra gate (Phase 4), optional IP allowlist (`networking.allowedIpRanges`, confirm plan support).
- Preview (pull-request) environments on admin/master: disable, or use Standard's password protection — on Free they are public.

Sample master config (Phase 4 shape):

```json
{
  "routes": [
    { "route": "/.auth/login/github", "statusCode": 404 },
    { "route": "/.auth/*", "allowedRoles": ["anonymous", "authenticated"] },
    { "route": "/*", "allowedRoles": ["masteradmin"] }
  ],
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/aad?post_login_redirect_uri=.referrer", "statusCode": 302 },
    "404": { "rewrite": "/master-admin.html" }
  },
  "globalHeaders": {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy-Report-Only": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.google.com; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net; frame-src https://shoutoutdemo-5b402.firebaseapp.com https://www.google.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'"
  }
}
```

The `masteradmin` role is granted by SWA **invitation** (portal → Role management → Invite, Free and Standard) or, on Standard, by a custom Entra app registration limited to your tenant. This gate sits *in front of* Firebase sign-in and SOS2FA; it does not replace them.

### B10. Firebase and third-party changes (owner console work, mostly additive)

**Firebase Auth**

- Authentication → Settings → **Authorized domains**: add `www.floqr.app`, `floqr.app`, `admin.floqr.app`, `master.floqr.app`, `staging.floqr.app` (and the raw `*.azurestaticapps.net` hostnames for pre-DNS smoke tests). SWA pull-request preview hosts are random and cannot be authorized — sign-in will not work there; use staging.
- `authDomain` stays `shoutoutdemo-5b402.firebaseapp.com` in Phases 1–3, so **Google, Microsoft and Facebook redirect URIs do not change** (they point at `…firebaseapp.com/__/auth/handler`).
- Google Cloud → APIs & Services → Credentials → OAuth web client: add the new hosts to Authorized JavaScript origins. Facebook app → App Domains / Site URL: add floqr.app.
- If the browser API key (`AIza…` in `firebase-config.js`) has HTTP-referrer restrictions, add `https://*.floqr.app/*`.
- **Risk:** Google/Microsoft sign-in tries a popup first and falls back to `signInWithRedirect` (`patron-app.js`, `admin-app.js`, `master-admin-app.js`). Redirect sign-in breaks on Safari/iOS and other browsers that block third-party storage when `authDomain` is a different site — this already applies on github.io. Phase 4 fix: give each site its own `authDomain` by self-hosting Firebase's `/__/auth/*` helper files on that site, then add `https://<host>/__/auth/handler` to the Google, Microsoft and Facebook redirect URIs. Bonus: the sign-in screen shows floqr.app instead of `shoutoutdemo-5b402.firebaseapp.com`.
- Email OTP, SMS OTP, WhatsApp OTP use callables + custom tokens, so they are origin-independent.

**App Check (reCAPTCHA Enterprise)**

- Phase 1: Google Cloud → Security → reCAPTCHA → key `6LcoLhYt…` → add all floqr.app hosts to its domain list (one key may list many domains). Update the comment in `firebase-config.js`.
- Phase 4 (optional): separate key for admin + master. App Check binds one provider per Firebase web app, so this means registering a second Firebase web app (new `appId`) for the admin/master sites. Then turn on `enforceAppCheck` for admin and paid callables once metrics are clean (already planned in data-classification Phase 3).

**Stripe**

- **Must fix before patrons pay on floqr.app:** `commerce-functions.js` `safeReturnBase` only accepts the github.io origin and otherwise falls back to it, so a payment started on www.floqr.app would return to github.io. Replace with the `FLOQR_RETURN_ORIGINS` allowlist (additive: keep github.io during transition). `ad-functions.js` `RETURN_ORIGINS` gets the same treatment (it lists `www.floqr.com` today).
- Stripe Connect: `stripe-connect-core.js` `business_url` and account-link return/refresh URLs → floqr.app.
- Stripe Dashboard: Customer Portal default return URL, business website, Checkout branding. Webhooks need no change (they call `cloudfunctions.net`). Hosted Checkout needs no domain registration (only Stripe Elements / Apple Pay buttons on your own page would).

**SendGrid / Twilio**

- Link bases in emails/SMS come from the Functions origin config (B7). Switch defaults at Phase 3.
- Sender domain: decide `login@floqr.com` (keep floqr.com email DNS) vs `login@floqr.app` (new SendGrid domain authentication records in the floqr.app zone). Optional link branding `links.floqr.app`.
- The pending WhatsApp Authentication template (`whatsapp-twilio-incomplete.mdc`): if it gets a URL button, submit it with floqr.app so Meta does not have to re-approve.
- Twilio status callbacks are on `cloudfunctions.net` — no change.

**Other**

- Club website feed: `venue-ingest-core.js` builds `clubIframe` / `publicPageUrl` from github.io. After cutover, clubs must re-copy their iframe code (old github.io iframes keep working while Pages stays up and then via redirect).
- Display access security (`checkDisplayAccess` token / approved IP) is not origin-based — unaffected.
- Storage bucket CORS: no `cors.json` in the repo; if any page fetches Storage media with `fetch`/canvas, add the floqr.app origins to the bucket CORS config.
- Browser data that will not move: Firebase sign-in, language choice, privacy/CMP choices and ad consent in localStorage are per origin. Patrons sign in once more; account-level settings in Firestore (`uiLanguage`, `privacyPolicyVersionAccepted`) carry over.

### B11. DNS and redirects

- Buy `floqr.app` at a registrar that sells `.app`; delegate name servers to an **Azure DNS zone** `floqr.app` (alias record for the apex).
- Records: `www` CNAME → www SWA; apex alias → www SWA (set www as default domain so apex redirects); `admin`, `master`, `staging` CNAME → their SWA apps; TXT records for validation. Lower TTL to 300 s a few days before Phase 3.
- `floqr.com` (if owned): move or keep its DNS, **preserve MX/SPF/DKIM/DMARC**, point `www` + apex at a tiny redirect SWA whose `index.html` / `404.html` forward `location.pathname + search + hash` to `https://www.floqr.app`. (SWA route redirects cannot rewrite the path into the target; Front Door can, at extra cost.)
- **GitHub Pages:** cannot send server redirects. In Phase 3 every non-display page on Pages becomes a small HTML page that forwards to the right floqr.app host with path, query and hash, plus a `<link rel="canonical">`. `display.html` / `display2.html` on Pages stay **fully working** until every Xibo board is moved (Phase 5), then they too become forwarders (a forgotten board still lands on the new host).

### B12. Phased migration

#### Phase 0 — Prepare (no user-visible change)

Owner:
1. Decide the open questions below (at least 1–6).
2. Buy `floqr.app`; confirm whether you own `floqr.com` and who hosts its email.
3. Azure: subscription, budget alert, resource group `rg-floqr-web` (East US 2), DNS zone `floqr.app`, delegate name servers.
4. GitHub: allow the Azure Static Web Apps app on the `JadzAdCo` org.

Agent (on a branch, tested, then published when you say so):
1. `floqr-sites.js` + `FLOQRSites` origin map; `FLOQRCanonical` → floqr.app; `FLOQRNav` / FloqAi link builders site-aware; `stableDisplayUrl` absolute to www.
2. `functions/public-origins.js` + env vars; remove the 9 hardcoded Functions origins; Stripe return allowlist **additive** (github.io + floqr.app hosts).
3. Site-aware `loginHref` / `profile-access-guard` (admin and master sign in on their own hub, with `returnTo`).
4. `sites/sites.config.json`, `scripts/build-sites.js`, per-site header templates, "every page assigned" test.
5. Display heartbeat / access log records the board's host, so we can see which Xibo boards still use github.io.
6. Measure each built site against the 250 MB / 500 MB size limit (LED art in `images/` is the big part).
7. Update rule files (cutover, fork proposal, club feed, data classification), privacy text and tests for floqr.app; help + i18n for "admin lives at admin.floqr.app".

Tests: Functions `npm test`, rules emulator suite, i18n gate, version-sync test, new site-assignment test, `check-functions-sync.js`.
Rollback: revert the commits; all changes are additive while Pages is primary.

#### Phase 1 — Mirror the whole app on `staging.floqr.app`

Owner: create `swa-floqr-staging` (Free) from the repo; add custom domain `staging.floqr.app`; add it to Firebase Authorized domains, reCAPTCHA key domains, Google OAuth origins.
Agent: `azure-swa.yml` staging job (whole allowlisted app, staging headers, CSP report-only, `noindex`); deploy Functions with additive origin allowlist (from `origin/main`).
Smoke checklist:
- Sign in with Google, Microsoft, Facebook, email OTP, SMS OTP (US/CA), WhatsApp (sandbox) on desktop Chrome, iPhone Safari, Android.
- Search → compose ShoutOut → Stripe test checkout → returns to **staging**, not github.io → Club Admin approves → shows on `staging.floqr.app/display.html?location=<test venue>`.
- My Profile Work Calendar iframe, Inbox links, FloqAi links, language switch (11 languages), privacy page.
- App Check metrics show verified requests from the new host; no `auth/unauthorized-domain` errors.
- Headers check (securityheaders.com / Mozilla Observatory); CSP reports reviewed.
- SWA redirect keeps `?query` and `#hash` (decides stub approach).
Rollback: delete the staging app / DNS record. No patron impact.

#### Phase 2 — Split into www / admin / master (soft launch)

Owner: create `swa-floqr-www`, `swa-floqr-admin`, `swa-floqr-master` (Standard recommended); add custom domains; add each host to Authorized domains / reCAPTCHA / OAuth origins.
Agent: build + deploy jobs for the three sites; cross-site redirect routes/stubs; local display copies for admin/master previews; help copy; release **s3.2.0** to `main` (Pages still serves the monolith — unchanged for users).
Smoke checklist:
- Patron: everything from Phase 1 on www.
- Club Admin on admin.floqr.app: sign in, approve ShoutOut, scheduling publish → worker Inbox link opens www Work Calendar, "Show Display URL" shows a **www** URL, template tags, Club Public Profile link → www, website-feed iframe code points at www.
- Master Admin on master.floqr.app: SOS2FA unlock, Features & Services save with reason, data classification, display security, demo sign-in code.
- Old links: `www.floqr.app/admin.html?...` → admin host; `admin.floqr.app/patron-portal.html?...` → www, query + hash intact.
- A patron session on www does not appear on admin/master (separate storage).
- Seed/debug pages return 404 on all production hosts.
Rollback: nobody depends on floqr.app yet — fix forward or point users back to github.io.

#### Phase 3 — Cutover

Owner:
1. Announce to Club Admins (new admin address, sign in once more).
2. Update Xibo: each layout's Webpage widget URL → `https://www.floqr.app/display.html?location=<id>` (or `display2.html`). Do one test venue first; watch it for an hour; then the rest. Keep a list of boards and check them off against the display access log host.
3. Stripe Dashboard settings → floqr.app.
Agent:
1. Functions env defaults → floqr.app (`FLOQR_PUBLIC_ORIGIN`, `FLOQR_ADMIN_ORIGIN`, `FLOQR_MASTER_ORIGIN`, `FLOQR_DISPLAY_BASE_URL`); deploy from `origin/main`; keep github.io in `FLOQR_RETURN_ORIGINS` for in-flight checkouts.
2. Publish GitHub Pages forwarders for every non-display page (display pages untouched).
3. Update README CURRENT PACKAGE / `STANDARD-AFTER-DEPLOYMENT.md` live URLs and the preview-email defaults; send the post-deploy preview email after CI is green.
Smoke checklist: full Phase 2 list on production; a real (small) payment; email + SMS links open floqr.app; Xibo test board shows idle "Use ShoutOut @ club" and a live ShoutOut; supRstar on `display2.html`; monitor Auth errors, Functions errors and Stripe webhook failures for 48 h.
Rollback: revert Functions env to github.io and redeploy; revert the Pages forwarders commit (Pages serves the full app again); Xibo boards still on github.io never broke. DNS stays; floqr.app can be left up.

#### Phase 4 — Harden

Agent + owner, each item independent:
- Entra gate on `master.floqr.app` (SWA built-in auth; invite your Microsoft accounts with role `masteradmin`; on Standard optionally restrict to your tenant). Optional IP allowlist.
- CSP from report-only to enforced, site by site.
- Separate App Check key/web app for admin + master; enable `enforceAppCheck` on admin and paid callables.
- Self-hosted Firebase auth helper per site (own `authDomain`) — fixes Safari redirect sign-in, brands the consent screen; add the three `__/auth/handler` URIs to Google / Microsoft / Facebook.
- Fork proposal items adapted: custom claims (`role`, `venueIds`) synced by a trigger; Identity Platform **`admins` tenant** for admin + master (patron accounts cannot sign in there; Club Admins who are patrons need two accounts); admin login offers Microsoft/Google workforce SSO + passkeys; SOS2FA remains for dangerous actions.
- Optional Azure Front Door: Standard (~$35/month, custom WAF rules, rate limits, geo) or Premium (~$330/month, managed OWASP rules, bot protection) in front of admin + master.
- Exact per-site JS lists (no admin code on www).
Tests: Entra gate denies a non-invited account; Firebase + SOS2FA still required behind it; App Check metrics stay clean for a week before enforcement; full smoke.
Rollback: each item is a config change (remove route roles, revert CSP header, turn enforcement off).

#### Phase 5 — Retire GitHub Pages

- When the display log shows no board on github.io for 30 days: replace Pages `display.html` / `display2.html` with forwarders too.
- Point Pages at a small `pages-redirect` branch containing only forwarders (main keeps the source). Keep it 6–12 months for old emails, bookmarks and club iframes, then disable Pages.
- Remove github.io from `FLOQR_RETURN_ORIGINS`, Authorized domains, reCAPTCHA domains, OAuth origins.
- Update the cutover rule's post-cutoff checklist, app store listings, privacy policy contact.
Rollback: re-enable the old Pages source branch.

### B13. Risks

- **Stripe returns to github.io** until `safeReturnBase` is fixed (Phase 0 must land before any patron pays on floqr.app).
- **Wrong Display URL shown to venues** from admin host (relative `stableDisplayUrl`) — fixed in Phase 0.
- **Redirect-based sign-in on Safari/iOS** with a foreign `authDomain` — popup works; redirect fallback may fail until the Phase 4 auth helper.
- **Separate sessions** confuse Club Admins ("I'm already signed in") — help copy + announcement.
- **Xibo boards** are physical and sometimes managed by venues; some may stay on github.io for weeks. Mitigated by keeping Pages displays alive and logging the host.
- **SWA limits:** 250 MB (Free) / 500 MB (Standard) per site and a file-count limit; LED art may be large — measure in Phase 0, keep previews off production.
- **Query/hash loss on redirects** — verify in Phase 1; HTML stub fallback.
- **CSP breaking screens** — report-only first; `same-origin-allow-popups` for COOP.
- **Email deliverability** if floqr.com DNS is changed carelessly (sender `login@floqr.com`).
- **`.app` HTTPS-only** — certificates must validate before announcing.
- **Two vendors** (Azure hosting, Google backend): two consoles and bills; no performance cost (static files only).
- Functions deploy discipline (from `origin/main` only) still applies to every Functions change in this plan.

### B14. Cost estimate (monthly)

| Item | Low (start Free) | Recommended | With WAF |
|---|---|---|---|
| SWA www / admin / master | $0 | ~$27 (3 × Standard) | ~$27 |
| SWA staging + floqr.com redirector | $0 | $0 | $0 |
| Azure DNS (2 zones + queries) | ~$1–2 | ~$1–2 | ~$1–2 |
| Front Door | — | — | ~$35 (Standard) / ~$330 (Premium) + traffic |
| Bandwidth over 100 GB (Standard only) | — | ~$0.20/GB | included in Front Door pricing |
| **Total** | **~$2** | **~$30** | **~$65 / ~$360** |

Plus domains (~$15–20/year for floqr.app). Part A's three sites: ~$0–2/month plus their domains. Firebase (Blaze) bills unchanged; Identity Platform tenants (Phase 4) are free up to ~50k monthly active users for email/social sign-in, SMS billed per message.

### B15. Open decisions for the owner

1. Confirm **floqr.app replaces www.floqr.com** as the production address. Canonical `www.floqr.app` (recommended) or bare `floqr.app`?
2. ~~Do you own **floqr.app**?~~ **Answered Oct 12 2026: the owner owns floqr.app.** Still open: is floqr.com also owned (Functions send from `login@floqr.com`, so its email DNS must stay alive), and should it 301-redirect to floqr.app?
3. Keep sending email from **`login@floqr.com`**, or move the sender to `@floqr.app`?
4. Master Admin host name: `master.floqr.app` (recommended), something less guessable (`ops.` / `nic.`), or a single `admin.floqr.app` for both admin types?
5. Which Microsoft accounts get through the Master Admin Entra gate (e.g. `don.b@jadzholdings.com`; `bans.don@gmail.com` as a personal Microsoft account or guest)? IP allowlist too, given travel?
6. SWA **Standard** ($9/site/month, SLA) for the three production sites, or start on Free?
7. Front Door WAF now, later, or not at all?
8. Page placement: `promoter-admin.html` and `scheduling.html` on admin (proposed); `staff-worksheet.html` on www (proposed)?
9. Displays on www (proposed) or a dedicated `display.floqr.app`?
10. Which preview/QA pages to keep on staging and which to delete?
11. Azure: which account/billing owner, budget alert amount, region (East US 2 proposed)?
12. Who updates the Xibo layouts and by when? How long should github.io displays keep working (proposed: until 30 days with no github.io board in the log)?
13. Keep GitHub Pages as an emergency backup after Phase 5, or switch it off after the forwarding period?
14. Phase 4 own sign-in domain (consent screen shows floqr.app) — yes / later?
15. Identity Platform `admins` tenant — accept that Club Admins who are also patrons will need two accounts?
16. Release numbering: call the split **s3.2.0** (minor) or a major **s4.0.0**?
17. Keep the Firebase project id `shoutoutdemo-5b402` for production, or create a clean production Firebase project later (separate, larger decision)?
18. Part A: names, domains, content and editors for the three simple sites (A7 list).
