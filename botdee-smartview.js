/* BOT DEE SMARTview renderer — typed payloads only, no innerHTML from model text. */
(function (global) {
  "use strict";

  const t = (key, fallback, vars) => {
    const value = global.FLOQRI18n?.t?.(key, vars);
    return value && value !== key ? value : fallback;
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function isDisplayPath(pathname) {
    const file = String(pathname || "").split("/").pop().toLowerCase();
    return file === "display.html" || file === "display2.html";
  }

  /** Path under the Pages project root (e.g. ./club-profile.html or ./images/foo.jpg). */
  function relativeRepoPath(pathname) {
    const path = String(pathname || "");
    const marker = "/shoutout-demo/";
    const idx = path.indexOf(marker);
    const tail = idx >= 0 ? path.slice(idx + marker.length) : path.replace(/^\//, "");
    return tail ? `./${tail}` : "";
  }

  /** Same-origin app links as ./file?query — GitHub Pages /shoutout-demo/ safe. Never ?v= on page links. */
  function resolveSameOriginHref(href) {
    const raw = String(href || "").trim();
    if (!raw || /javascript:/i.test(raw)) return "";
    if (raw.startsWith("./") && !raw.startsWith("./http")) {
      const nav = global.FLOQRNav;
      if (nav?.stampCurrentVersion && !isDisplayPath(raw)) return nav.stampCurrentVersion(raw);
      if (isDisplayPath(raw)) return nav?.stableDisplayUrl
        ? nav.stableDisplayUrl(new URL(raw, global.location.href).searchParams.get("location") || "")
        : raw.replace(/[?&]v=[^&#]+/g, "").replace(/\?&/, "?").replace(/\?$/, "");
      return raw;
    }
    try {
      const resolved = new URL(raw, global.location.href);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return "";
      if (resolved.origin !== global.location.origin) return resolved.href;
      const nav = global.FLOQRNav;
      if (isDisplayPath(resolved.pathname)) {
        resolved.searchParams.delete("v");
        const loc = resolved.searchParams.get("location") || "";
        if (nav?.stableDisplayUrl) {
          const board = resolved.pathname.split("/").pop() === "display2.html" ? "secondary" : "";
          return nav.stableDisplayUrl(loc, board ? {board} : {});
        }
        const rel = relativeRepoPath(resolved.pathname);
        const search = resolved.searchParams.toString();
        return `${rel}${search ? `?${search}` : ""}${resolved.hash || ""}`;
      }
      const rel = `${relativeRepoPath(resolved.pathname)}${resolved.search || ""}${resolved.hash || ""}`;
      if (nav?.stampCurrentVersion) return nav.stampCurrentVersion(rel);
      return rel || raw;
    } catch (_) {
      return raw.startsWith("./") || raw.startsWith("/") ? raw : "";
    }
  }

  function resolveImageSrc(url) {
    const raw = String(url || "").trim();
    if (!raw || /javascript:/i.test(raw)) return "";
    if (raw.startsWith("./")) {
      const v = global.FLOQRNav?.appVersion || "";
      if (v && !/[?&]v=/.test(raw)) {
        return `${raw}${raw.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`;
      }
      return raw;
    }
    try {
      const resolved = new URL(raw, global.location.href);
      if (resolved.origin !== global.location.origin) {
        const floqrPath = raw.replace(/^https?:\/\/[^/]+/i, "");
        if (floqrPath.startsWith("/images/")) {
          const v = global.FLOQRNav?.appVersion || "";
          return `./${floqrPath.replace(/^\//, "")}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
        }
        return resolved.href;
      }
      let rel = relativeRepoPath(resolved.pathname);
      if (!rel) rel = `./${resolved.pathname.split("/").pop()}`;
      if (rel.startsWith("./images/") && !resolved.searchParams.has("v")) {
        const v = global.FLOQRNav?.appVersion || "";
        if (v) return `${rel}`;
      }
      return `${rel}${resolved.search || ""}`;
    } catch (_) {
      return raw;
    }
  }

  function wireActionLinks(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll("a[href]").forEach(anchor => {
      const fixed = resolveSameOriginHref(anchor.getAttribute("href"));
      if (fixed) anchor.setAttribute("href", fixed);
    });
  }

  function ratingRow(row) {
    if (!row || !row.provider) return "";
    const value = Number.isFinite(Number(row.value)) ? Number(row.value).toFixed(1) : "—";
    return `<li><span class="botdee-sv-provider">${esc(row.provider)}</span> <span>${esc(value)}</span></li>`;
  }

  const PRIMARY_META = [
    {id: "Social", icon: "♧", key: "botdee.sv.social", label: "Social"},
    {id: "Dating", icon: "♡", key: "botdee.sv.dating", label: "Dating"},
    {id: "Dining", icon: "♜", key: "botdee.sv.dining", label: "Dining"},
    {id: "Future Travels", icon: "✈", key: "botdee.sv.futureTravels", label: "Future Travels"}
  ];
  const SOCIAL_SUB = [
    {id: "Music", key: "botdee.sv.music", label: "Music"},
    {id: "Nightlife", key: "botdee.sv.nightlife", label: "Nightlife"},
    {id: "Sports", key: "botdee.sv.sports", label: "Sports"},
    {id: "Events", key: "botdee.sv.events", label: "Events"}
  ];

  function peopleOf(payload) {
    return payload && payload.floqrPublicData && payload.floqrPublicData.peopleV2
      ? payload.floqrPublicData.peopleV2
      : null;
  }

  let overlaySession = null;

  function captureChatState() {
    const input = global.document?.getElementById("botDeeChatInput");
    const log = global.document?.getElementById("botDeeTranscript");
    return {
      draft: input ? input.value : "",
      scroll: log ? log.scrollTop : 0,
      active: global.document?.activeElement || null
    };
  }

  function restoreChatState(state) {
    if (!state) return;
    const input = global.document?.getElementById("botDeeChatInput");
    const log = global.document?.getElementById("botDeeTranscript");
    if (input && typeof state.draft === "string") input.value = state.draft;
    if (log && Number.isFinite(state.scroll)) log.scrollTop = state.scroll;
    try { state.active?.focus?.(); } catch (_) { /* ignore */ }
  }

  function subtabsFor(primary) {
    if (primary === "Social") return SOCIAL_SUB;
    if (primary === "Dating") {
      return [
        {id: "Preferences", key: "botdee.sv.preferences", label: "Preferences"},
        {id: "Discovery", key: "botdee.sv.discovery", label: "Discovery"}
      ];
    }
    if (primary === "Dining") {
      return [
        {id: "Cuisines", key: "botdee.sv.cuisines", label: "Cuisines"},
        {id: "Experiences", key: "botdee.sv.experiences", label: "Experiences"}
      ];
    }
    return [
      {id: "Upcoming", key: "botdee.sv.upcoming", label: "Upcoming"},
      {id: "Past", key: "botdee.sv.past", label: "Past"},
      {id: "Interests", key: "botdee.sv.interests", label: "Interests"}
    ];
  }

  function tagsForPeople(people, primary, secondary) {
    if (primary === "Dating" && !people?.datingVisible) return [];
    const group = people?.categories?.[primary];
    if (!group || typeof group !== "object") return [];
    const rows = group[secondary];
    return Array.isArray(rows) ? rows : [];
  }

  function currentOverlaySession() {
    return overlaySession;
  }

  function rememberOverlaySession(session) {
    overlaySession = session || null;
    return overlaySession;
  }

  function overlayMediaList(session) {
    const people = session?.people || {};
    const media = people.media || {};
    if ((session?.mediaType || "photos") === "videos") {
      return Array.isArray(media.videos) ? media.videos : [];
    }
    return Array.isArray(media.photos) ? media.photos : [];
  }

  function advanceOverlayMedia(delta) {
    const session = overlaySession;
    if (!session) return null;
    const list = overlayMediaList(session);
    const len = Math.max(list.length, 1);
    session.mediaIndex = ((Number(session.mediaIndex) || 0) + Number(delta || 0) + len) % len;
    return session;
  }

  function statusLabel(summary) {
    if (!summary) return "";
    if (summary.status === "translated") return "";
    if (summary.failed) return t("botdee.sv.translationFailed", "Translation failed. Showing the source language.");
    if (summary.pending) {
      return t("botdee.sv.translationPending", "Translation pending. Showing the source language.")
        + (summary.sourceLocale ? ` (${esc(summary.sourceLocale)})` : "");
    }
    return "";
  }

  function isCompactCard(payload) {
    const people = peopleOf(payload);
    return !!(people && people.presentation === "peopleSmartCard");
  }

  function subjectUidOf(payload) {
    return peopleOf(payload)?.subjectUid || "";
  }

  function peopleHeroMedia(people) {
    const photosList = Array.isArray(people?.media?.photos) ? people.media.photos : [];
    const videosList = Array.isArray(people?.media?.videos) ? people.media.videos : [];
    const fromPhoto = people?.photo?.kind !== "video" && people?.photo?.url
      ? people.photo.url
      : (photosList[0]?.url || "");
    const fromVideo = people?.photo?.kind === "video" && people?.photo?.url
      ? people.photo.url
      : (!fromPhoto && videosList[0]?.url ? videosList[0].url : "");
    const photo = fromPhoto ? resolveImageSrc(fromPhoto) : "";
    const video = fromVideo ? resolveImageSrc(fromVideo) : "";
    const count = photosList.length + videosList.length
      || (people?.photo && people.photo.count)
      || (photo || video ? 1 : 0);
    return {photosList, videosList, photo, video, count};
  }

  function renderCompactPeopleCard(payload) {
    const people = peopleOf(payload);
    if (!people) return "";
    const hero = peopleHeroMedia(people);
    const handles = Array.isArray(people.handles) ? people.handles : [];
    const summaryText = people.summary?.excerpt || people.summary?.text || "";
    const localeNote = statusLabel(people.summary);
    const name = people.displayName || payload.title || "";
    const uid = people.subjectUid || "";
    const hasMedia = !!(hero.photo || hero.video);
    const photoAlt = name || t("botdee.sc.photoAlt", "Public profile photo");
    const thumb = hero.photo
      ? `<img src="${esc(hero.photo)}" alt="${esc(photoAlt)}"/>`
      : (hero.video
        ? `<video src="${esc(hero.video)}" muted playsinline preload="metadata" aria-hidden="true"></video>`
        : `<span class="botdee-sc-thumb-empty" aria-hidden="true"></span>`);
    return `<article class="botdee-sv-people botdee-sc-card" data-kind="patron" data-presentation="peopleSmartCard" data-subject-uid="${esc(uid)}" role="button" tabindex="0" aria-label="${esc(t("botdee.sc.openSMARTview", "Open SMARTview"))}">
      <div class="botdee-sc-row">
        <div class="botdee-sc-thumb" aria-hidden="${hasMedia ? "false" : "true"}">
          ${thumb}
        </div>
        <div class="botdee-sc-body">
          <div class="botdee-sc-name">${esc(name)}${people.verified ? " <span class=\"botdee-sv-tick\" aria-hidden=\"true\">◆</span>" : ""}</div>
          <div class="botdee-sv-handles">${handles.map(row => {
            const href = resolveSameOriginHref(row.href || "");
            const label = row.handle || "";
            if (!label) return "";
            if (!href) return `<span>${esc(label)}</span>`;
            return `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(label)}</a>`;
          }).join("")}${people.city ? `<span>${esc(people.city)}</span>` : ""}</div>
          <p class="botdee-sc-summary">${esc(summaryText || t("botdee.sc.summaryPending", "No SMARTsummary is published yet."))}</p>
          ${localeNote ? `<span class="botdee-sv-locale">${localeNote}</span>` : ""}
        </div>
      </div>
    </article>`;
  }

  function renderPeopleCard(payload) {
    const people = peopleOf(payload);
    if (!people) return "";
    const mock = payload.sources && payload.sources.some(s => s.provider === "mock" || s.reuseRights === "unknown");
    const primary = people.defaultPrimary || "Social";
    const secondary = people.defaultSecondary || "Music";
    const tags = tagsForPeople(people, primary, secondary);
    const hero = peopleHeroMedia(people);
    const photo = hero.photo;
    const videoHero = hero.video;
    const count = hero.count;
    const handles = Array.isArray(people.handles) ? people.handles : [];
    const profileHref = resolveSameOriginHref(people.profileHref || "./patron-portal.html?tab=profile");
    const minglHref = resolveSameOriginHref(people.minglHref || "./?start=search");
    const summaryText = people.summary?.text || "";
    const localeNote = statusLabel(people.summary);
    const uid = people.subjectUid || "";
    return `<article class="botdee-sv-people" data-kind="patron" data-primary="${esc(primary)}" data-secondary="${esc(secondary)}" data-subject-uid="${esc(uid)}">
      <div class="botdee-sv-people-head">
        <strong>${esc(t("botdee.sv.person", "SMARTview — Person"))}</strong>
        ${people.verified ? `<span class="botdee-sv-verified">${esc(t("botdee.sv.verified", "Verified on FLOQR"))}</span>` : ""}
      </div>
      ${mock ? `<p class="botdee-sv-mock">${esc(t("botdee.smartviewMockBadge", "Mock / not live licensed data"))}</p>` : ""}
      <div class="botdee-sv-identity">
        <button type="button" class="botdee-sv-portrait" data-sv-open="media" ${photo || videoHero ? "" : "hidden"} aria-label="${esc(t("botdee.sv.openMedia", "View shared photos and videos"))}">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(people.displayName || "")}"/>` : (videoHero ? `<video src="${esc(videoHero)}" muted playsinline preload="metadata" aria-hidden="true"></video>` : "")}
          ${count ? `<span class="botdee-sv-counter">${esc(String(Math.min(1, count)))}/${esc(String(count))}</span>` : ""}
        </button>
        <div class="botdee-sv-identity-main">
          <div class="botdee-sv-name">${esc(people.displayName || payload.title || "")}${people.verified ? " <span class=\"botdee-sv-tick\" aria-hidden=\"true\">◆</span>" : ""}</div>
          <div class="botdee-sv-handles">${handles.map(row => {
            const href = resolveSameOriginHref(row.href || "");
            if (!href) return "";
            return `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(row.handle || "")}</a>`;
          }).join("")}${people.city ? `<span>${esc(people.city)}</span>` : ""}</div>
          <button type="button" class="botdee-sv-summary-btn" data-sv-open="summary">
            <span class="botdee-sv-summary-kicker">${esc(t("botdee.sv.smartSummary", "SMARTsummary"))}</span>
            <p class="botdee-sv-summary-text">${esc(summaryText)}</p>
            ${localeNote ? `<span class="botdee-sv-locale">${localeNote}</span>` : ""}
            <span class="botdee-sv-more">${esc(t("botdee.sv.tapMore", "Tap for more information"))}</span>
          </button>
        </div>
      </div>
      <div class="botdee-sv-primary" role="tablist" aria-label="${esc(t("botdee.sv.categories", "SMARTview categories"))}">${PRIMARY_META.map(tab => (
        `<button type="button" class="botdee-sv-tab" role="tab" data-sv-primary="${esc(tab.id)}" aria-selected="${tab.id === primary ? "true" : "false"}"><span class="botdee-sv-tab-ico" aria-hidden="true">${tab.icon}</span> ${esc(t(tab.key, tab.label))}</button>`
      )).join("")}</div>
      <section class="botdee-sv-details">
        <div class="botdee-sv-secondary" role="tablist" aria-label="${esc(t("botdee.sv.socialCategories", "Social categories"))}">${subtabsFor(primary).map(tab => (
          `<button type="button" class="botdee-sv-tab" role="tab" data-sv-secondary="${esc(tab.id)}" aria-selected="${tab.id === secondary ? "true" : "false"}">${esc(t(tab.key, tab.label))}</button>`
        )).join("")}</div>
        <div class="botdee-sv-tags">${tags.map(tag => `<span class="botdee-sv-tag">${esc(tag)}</span>`).join("")}</div>
        <p class="botdee-sv-note" ${people.datingVisible || primary !== "Dating" ? "hidden" : ""}>${esc(t("botdee.sv.datingHidden", "Dating details are visible only with the patron’s explicit opt-in. No dating preferences are inferred."))}</p>
      </section>
      <div class="botdee-sv-people-actions">
        <a class="botdee-sv-action" href="${esc(profileHref)}">${esc(t("botdee.sv.viewProfile", "View Full Profile"))}</a>
        <a class="botdee-sv-action botdee-sv-action-main" href="${esc(minglHref)}">${esc(t("botdee.sv.mingl", "Mingl"))}</a>
      </div>
    </article>`;
  }

  function isVersionPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "botDeeVersion");
  }

  function overlayFrontendPackage(payload) {
    const next = payload && typeof payload === "object" ? payload : {};
    const navV = global.FLOQRNav?.appVersion ? String(global.FLOQRNav.appVersion) : "";
    const floqr = next.floqr && typeof next.floqr === "object" ? {...next.floqr} : {};
    if (navV && !floqr.frontendPackage) floqr.frontendPackage = navV;
    return {...next, floqr};
  }

  /** Packaged default — must match functions/bot-dee-core.js TEXT_MODEL when env is unset. */
  const DEFAULT_TEXT_MODEL = "gemini-3.6-flash";

  function localVersionPayload() {
    const label = global.FLOQRNav?.appVersion ? String(global.FLOQRNav.appVersion) : "";
    const nowIso = new Date().toISOString();
    const packageOk = /^s3\./.test(label);
    return {
      schemaVersion: "floqr.botDeeVersionSmartView/1",
      kind: "botDeeVersion",
      generatedAtIso: nowIso,
      botDee: {packageLabel: label || null, packageVersion: label.replace(/^s/, "") || null},
      floqr: {backendPackage: null, frontendPackage: label || null},
      model: {
        configuredId: DEFAULT_TEXT_MODEL,
        sessionPath: "local-client",
        sessionModel: DEFAULT_TEXT_MODEL,
        usedThisTurn: false
      },
      service: {
        status: packageOk ? "degraded" : "unavailable",
        lastCheckAtIso: nowIso,
        checks: {functions: false, package: packageOk, gemini: false}
      },
      changelog: []
    };
  }

  function statusKey(payload) {
    const status = String(payload?.service?.status || "unavailable");
    if (status === "operational") return "operational";
    if (status === "degraded") return "degraded";
    return "unavailable";
  }

  function statusCopy(payload) {
    const key = statusKey(payload);
    if (key === "operational") return t("botdee.vs.statusOperational", "Operational");
    if (key === "degraded") return t("botdee.vs.statusDegraded", "Degraded");
    return t("botdee.vs.statusUnavailable", "Unavailable");
  }

  function modelCopy(payload) {
    const model = payload?.model && typeof payload.model === "object" ? payload.model : {};
    const id = String(model.sessionModel || model.configuredId || "").trim();
    if (id) return esc(id);
    return esc(t("botdee.vs.unavailable", "Unavailable"));
  }

  function formatWhen(iso) {
    if (!iso) return t("botdee.vs.unavailable", "Unavailable");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t("botdee.vs.unavailable", "Unavailable");
    try {
      return d.toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"});
    } catch (_) {
      return t("botdee.vs.unavailable", "Unavailable");
    }
  }

  function privilegedHtml(payload) {
    const priv = payload?.privileged;
    if (!priv || typeof priv !== "object") return "";
    const phases = Array.isArray(priv.phases) ? priv.phases : [];
    const caps = priv.capabilities && typeof priv.capabilities === "object" ? priv.capabilities : {};
    const capKeys = Object.keys(caps).slice(0, 8);
    return `<div class="botdee-sv-version-priv">
      <h4>${esc(t("botdee.vs.privilegedHeading", "Privileged diagnostics"))}</h4>
      <p>${esc(t("botdee.vs.privilegedNote", "Master Admin only. These flags do not prove a production deploy."))}</p>
      <p>${esc(t("botdee.vs.deployedClaim", "Deployed claim"))}: ${esc(priv.deployedClaim === true ? "true" : "false")}</p>
      ${phases.length ? `<ul>${phases.map(row => `<li>${esc(row.name || "")}: ${row.deployed ? "deployed" : "not-deployed"}</li>`).join("")}</ul>` : ""}
      ${capKeys.length ? `<ul>${capKeys.map(key => `<li>${esc(key)}: ${esc(caps[key].state || "")}</li>`).join("")}</ul>` : ""}
    </div>`;
  }

  function renderVersionCard(payload) {
    const view = overlayFrontendPackage(payload);
    const unavailable = t("botdee.vs.unavailable", "Unavailable");
    const botLabel = view.botDee?.packageLabel || unavailable;
    const stamp = value => {
      const s = String(value || "").trim();
      return s && s !== unavailable ? s : "";
    };
    const backend = stamp(view.floqr?.backendPackage);
    const frontend = stamp(view.floqr?.frontendPackage);
    const floqrShown = frontend && backend && frontend !== backend
      ? `${frontend} / ${backend}`
      : (frontend || backend || unavailable);
    const changelog = Array.isArray(view.changelog) ? view.changelog : [];
    const when = formatWhen(view.generatedAtIso);
    const status = statusCopy(view);
    return `<article class="botdee-sv-version" data-kind="botDeeVersion" data-tab="overview">
      <h2 class="botdee-sv-version-title"><span class="botdee-sv-version-spark" aria-hidden="true">✦</span>${esc(t("botdee.vs.title", "BOT DEE — Version SMARTview"))}</h2>
      <div class="botdee-sv-version-id"><div class="botdee-sv-version-robot" aria-hidden="true">🤖</div><div class="botdee-sv-version-id-copy"><strong>${esc(t("botdee.vs.identityName", "BOT DEE"))} ✓</strong><p class="botdee-sv-version-sub">${esc(t("botdee.vs.identitySub", "System & Version Information"))}</p></div><span class="botdee-sv-version-pill" data-status="${esc(statusKey(view))}">${esc(status)}</span></div>
      <div class="botdee-sv-version-rows">
        <div class="botdee-sv-version-row"><span>${esc(t("botdee.vs.rowBotDee", "BOT DEE version"))}</span><strong>${esc(botLabel)}</strong></div>
        <div class="botdee-sv-version-row"><span>${esc(t("botdee.vs.rowFloqr", "FLOQR version"))}</span><strong>${esc(floqrShown)}</strong></div>
        <div class="botdee-sv-version-row"><span>${esc(t("botdee.vs.rowModel", "AI model"))}</span><strong>${modelCopy(view)}</strong></div>
        <div class="botdee-sv-version-row"><span>${esc(t("botdee.vs.rowStatus", "Service status"))}</span><strong>${esc(status)}</strong></div>
      </div>
      <div class="botdee-sv-version-tabs" role="tablist" aria-label="${esc(t("botdee.vs.title", "BOT DEE — Version SMARTview"))}">
        <button type="button" role="tab" class="is-active" data-vs-tab="overview" aria-selected="true"><svg class="botdee-sv-version-tab-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="8" width="12" height="2" rx="0.6" fill="currentColor"/><rect x="2" y="11.5" width="12" height="2" rx="0.6" fill="currentColor"/><rect x="4" y="4.5" width="8" height="2" rx="0.6" fill="currentColor"/></svg>${esc(t("botdee.vs.tabOverview", "Overview"))}</button>
        <button type="button" role="tab" data-vs-tab="updates" aria-selected="false"><svg class="botdee-sv-version-tab-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2.5" width="10" height="11" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>${esc(t("botdee.vs.tabWhatsNew", "What's New"))}</button>
        <button type="button" role="tab" data-vs-tab="help" aria-selected="false"><svg class="botdee-sv-version-tab-ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.4 6.4a1.7 1.7 0 1 1 2.5 1.5c-.5.3-.9.7-.9 1.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11.3" r="0.7" fill="currentColor"/></svg>${esc(t("botdee.vs.tabHelp", "Help"))}</button>
      </div>
      <div class="botdee-sv-version-panel" data-vs-panel="overview" role="tabpanel">
        <h3>${esc(t("botdee.vs.aboutHeading", "About BOT DEE"))}</h3>
        <p>${esc(t("botdee.vs.aboutBody", "BOT DEE is FLOQR's in-app assistant for discovery, reservations, and other authorized actions across people, venues, events, and services."))}</p>
        <button type="button" class="botdee-sv-version-expand" data-vs-expand aria-expanded="false">${esc(t("botdee.vs.technical", "Technical Details"))} ▾</button>
        <div class="botdee-sv-version-tech" data-vs-tech hidden>
          <p>          ${esc(t("botdee.vs.techEnv", "Deployment environment"))}: ${esc(view.environment || t("botdee.vs.unavailable", "Unavailable"))}<br/>
          ${esc(t("botdee.vs.techBuild", "Build identifier"))}: ${esc(botLabel)}<br/>
          ${esc(t("botdee.vs.frontendLabel", "FLOQR frontend"))}: ${esc(frontend || unavailable)}<br/>
          ${esc(t("botdee.vs.backendLabel", "FLOQR backend"))}: ${esc(backend || unavailable)}<br/>
          ${esc(t("botdee.vs.configuredModel", `Configured: ${view.model?.configuredId || unavailable}`, {id: view.model?.configuredId || unavailable}))}<br/>
          ${esc(t("botdee.vs.techCheck", "Last successful health check"))}: ${esc(formatWhen(view.service?.lastCheckAtIso))}</p>
          ${privilegedHtml(view)}
        </div>
      </div>
      <div class="botdee-sv-version-panel" data-vs-panel="updates" role="tabpanel" hidden>
        <h3>${esc(t("botdee.vs.whatsNewHeading", "What's New"))}</h3>
        ${changelog.length
          ? `<ul>${changelog.map(item => `<li>${esc(item.text || item.id || "")}</li>`).join("")}</ul>`
          : `<p>${esc(t("botdee.vs.whatsNewEmpty", "No verified package notes are available for this build."))}</p>`}
      </div>
      <div class="botdee-sv-version-panel" data-vs-panel="help" role="tabpanel" hidden>
        <h3>${esc(t("botdee.vs.helpHeading", "Version command"))}</h3>
        <p>${esc(t("botdee.vs.helpBody", "Enter Ver, Vers, or Version to display this SMARTview. The command is case-insensitive. Longer questions like “what is your version?” still get a text answer plus this card."))}</p>
      </div>
      <div class="botdee-sv-version-foot">
        <span>${esc(t("botdee.vs.footBrand", "FLOQR · System Information"))}</span>
        <span>${esc(t("botdee.vs.footUpdated", "Last updated: {when}", {when}))}</span>
      </div>
    </article>`;
  }

  function paintVersionTab(card, tab) {
    if (!card) return;
    const next = tab === "updates" || tab === "help" ? tab : "overview";
    card.dataset.tab = next;
    card.querySelectorAll("[data-vs-tab]").forEach(btn => {
      const on = btn.getAttribute("data-vs-tab") === next;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    card.querySelectorAll("[data-vs-panel]").forEach(panel => {
      panel.hidden = panel.getAttribute("data-vs-panel") !== next;
    });
  }

  function bindVersionCard(card) {
    if (!card || card.dataset.vsBound === "1") return;
    card.dataset.vsBound = "1";
    card.querySelectorAll("[data-vs-tab]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        paintVersionTab(card, btn.getAttribute("data-vs-tab"));
      });
    });
    const expand = card.querySelector("[data-vs-expand]");
    const tech = card.querySelector("[data-vs-tech]");
    if (expand && tech) {
      expand.addEventListener("click", event => {
        event.preventDefault();
        const open = tech.hidden;
        tech.hidden = !open;
        expand.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    const tabs = [...card.querySelectorAll("[data-vs-tab]")];
    card.querySelector("[role='tablist']")?.addEventListener("keydown", event => {
      const keys = {ArrowLeft: -1, ArrowRight: 1, Home: "home", End: "end"};
      const move = keys[event.key];
      if (move == null) return;
      event.preventDefault();
      const current = tabs.findIndex(btn => btn.classList.contains("is-active"));
      let idx = current < 0 ? 0 : current;
      if (move === "home") idx = 0;
      else if (move === "end") idx = tabs.length - 1;
      else idx = (idx + move + tabs.length) % tabs.length;
      tabs[idx]?.focus();
      paintVersionTab(card, tabs[idx]?.getAttribute("data-vs-tab"));
    });
  }

  function isRoomPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "botDeeRoom");
  }

  function rememberRoomDecline(key) {
    const token = String(key || "").slice(0, 80);
    if (!token) return;
    let rows = [];
    try {
      rows = JSON.parse(global.sessionStorage?.getItem("floqr.roomSmartView.declined") || "[]");
    } catch (_) {
      rows = [];
    }
    const next = [...new Set([].concat(rows, token).map(String))].slice(-24);
    try {
      global.sessionStorage?.setItem("floqr.roomSmartView.declined", JSON.stringify(next));
    } catch (_) {}
  }

  function roomStatusCopy(payload) {
    const life = String(payload?.lifecycle || "created");
    if (life === "active") return t("botdee.rs.statusActive", "Active");
    if (life === "closing") return t("botdee.rs.statusClosing", "Closing");
    if (life === "closed") return t("botdee.rs.statusClosed", "Closed");
    if (payload?.mode === "setup" || payload?.mode === "offer") return t("botdee.rs.statusSetup", "Setup");
    return t("botdee.rs.statusCreated", "Created");
  }

  function renderRoomFacts(payload) {
    const facts = payload?.sharePreview && Array.isArray(payload.sharePreview.facts)
      ? payload.sharePreview.facts
      : [];
    if (!facts.length) {
      return `<p class="botdee-sv-room-note">${esc(t("botdee.rs.shareEmpty", "No selected shareable facts from this message. Private chat is not copied."))}</p>`;
    }
    return `<ul class="botdee-sv-room-facts">${facts.map(fact => `<li>
      <label><input type="checkbox" data-rs-fact="${esc(fact.id || "")}" ${fact.selected === false ? "" : "checked"}/> ${esc(fact.label || "")}${fact.tentative ? ` <small>${esc(t("botdee.rs.shareTentative", "tentative"))}</small>` : ""}</label>
    </li>`).join("")}</ul>`;
  }

  function roomVisual(view) {
    const api = window.FLOQRSmartVisuals;
    if (!api || typeof api.resolveVisual !== "function") return null;
    const title = String(view && view.authorizedTitle || "").trim();
    const description = String(view && view.authorizedDescription || "").trim();
    return api.resolveVisual({
      title: title || "Mingl Room",
      description,
      sourceKind: "authorized-room"
    });
  }

  function renderRoomNeedles(payload) {
    const rows = Array.isArray(payload?.namedNeedles) ? payload.namedNeedles : [];
    if (!rows.length) return "";
    return `<p class="botdee-sv-room-note">${esc(t("botdee.rs.namedUnknown", "Named people are not looked up until they are eligible Mingl friends. FLOQR will not say whether a name has an account."))}</p>
      <ul class="botdee-sv-room-needles">${rows.map(row => `<li>${esc(row.displayName || "")} · ${esc(t("botdee.rs.unresolved", "unresolved"))}</li>`).join("")}</ul>`;
  }

  function renderRoomCard(payload) {
    const view = payload && typeof payload === "object" ? payload : {};
    const count = Number(view.participantCount) || 0;
    const cap = Number(view.participantCap) || 8;
    const status = roomStatusCopy(view);
    const confirmable = view.needsConfirmation && view.mode !== "command" && view.mode !== "deny";
    const share = view.mode === "share_preview";
    const denied = view.injectionDenied === true || view.mode === "deny";
    const visual = roomVisual(view);
    const visualHero = visual ? `<div class="sv-hero botdee-sv-visual" data-sv-reason="${esc(visual.reasonCode || "neutral-fallback")}" data-sv-bg="${esc(visual.backgroundId || "")}" data-sv-st="${esc(visual.stencilId || "")}">
        <img class="sv-bg" src="${esc(visual.backgroundUrl)}" alt="${esc(t("sv.scenicAlt", "Scenic illustration for this room. Not a photograph."))}"/>
      </div>` : "";
    return `<article class="botdee-sv-room" data-kind="botDeeRoom" data-rs-mode="${esc(view.mode || "")}" data-rs-decline="${esc(view.declineKey || "")}">
      <h2 class="botdee-sv-room-title">${esc(t("botdee.rs.title", "Room SMARTview"))}</h2>
      ${visualHero}
      <div class="botdee-sv-room-head">
        <div class="botdee-sv-room-thumb" aria-hidden="true">♣</div>
        <div>
          <strong>${esc(t("botdee.rs.roomName", "BOT DEE group session"))}</strong>
          <div class="botdee-sv-room-sub">${esc(t("botdee.rs.subtitle", "Room SMARTview"))} · <span data-rs-status>${esc(status)}</span></div>
        </div>
      </div>
      <div class="botdee-sv-room-stats">
        <div class="botdee-sv-room-stat"><span>${esc(t("botdee.rs.participants", "Participants"))}</span><b>${esc(String(count))} / ${esc(String(cap))}</b><small>${esc(t("botdee.rs.includingHost", "including host"))}</small></div>
        <div class="botdee-sv-room-stat"><span>${esc(t("botdee.rs.roomStatus", "Room status"))}</span><b data-rs-status-b>${esc(status)}</b><small>${esc(t("botdee.rs.notLiveNote", "Group rooms are not live yet"))}</small></div>
      </div>
      ${denied ? `<p class="botdee-sv-room-note">${esc(t("botdee.rs.injectionDenied", "I can’t use private BOT DEE history or host memory for that. Room SMARTview only uses what this group later confirms."))}</p>` : ""}
      ${renderRoomNeedles(view)}
      ${share ? `<div class="botdee-sv-room-share"><h3>${esc(t("botdee.rs.sharePreview", "Share preview"))}</h3>${renderRoomFacts(view)}<p class="botdee-sv-room-note">${esc(t("botdee.rs.privacyNote", "Private BOT DEE messages, other members’ profiles, and SMARTsummary are not included."))}</p></div>` : ""}
      <div class="botdee-sv-room-rows">
        <button type="button" class="botdee-sv-room-row" data-rs-panel="itinerary"><span>▦</span><div><b>${esc(t("botdee.rs.itinerary", "Shared Itinerary"))}</b><small>${esc(t("botdee.rs.itineraryEmpty", "No shared plans yet"))}</small></div><span>›</span></button>
        <button type="button" class="botdee-sv-room-row" data-rs-panel="tab"><span>▣</span><div><b>${esc(t("botdee.rs.sharedTab", "Shared Tab (Opt-In)"))}</b><small>${esc(t("botdee.rs.tabConsent", "Consent required before any charge"))}</small></div><span>›</span></button>
        <button type="button" class="botdee-sv-room-row" data-rs-panel="permissions"><span>⬡</span><div><b>${esc(t("botdee.rs.permissions", "Room Permissions"))}</b><small>${esc(t("botdee.rs.hostManaged", "Host managed"))}</small></div><span>›</span></button>
      </div>
      <div class="botdee-sv-room-panel" data-rs-panel-body hidden></div>
      <div class="botdee-sv-room-controls">
        <button type="button" class="botdee-sv-room-btn" data-rs-panel="invite" disabled>${esc(t("botdee.rs.invite", "Invite"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-panel="members">${esc(t("botdee.rs.members", "Members"))}</button>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-danger" data-rs-end disabled>${esc(t("botdee.rs.endRoom", "End Room"))}</button>
      </div>
      ${confirmable ? `<div class="botdee-sv-room-confirm" data-rs-confirm-row>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-confirm>${esc(share ? t("botdee.rs.shareApprove", "Approve selected facts") : t("botdee.rs.confirm", "Confirm"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-decline>${esc(t("botdee.rs.notNow", "Not now"))}</button>
      </div>` : ""}
      <p class="botdee-sv-room-toast" data-rs-toast hidden></p>
      <div class="botdee-sv-room-foot">
        <span>${esc(t("botdee.rs.foot", "BOT DEE · Room SMARTview"))}</span>
        <span>${esc(t("botdee.rs.neverCharge", "No charge without a later personal OK"))}</span>
      </div>
    </article>`;
  }

  function roomPanelCopy(name) {
    if (name === "itinerary") {
      return `<p>${esc(t("botdee.rs.itineraryEmpty", "No shared plans yet"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.privacyNote", "Private BOT DEE messages, other members’ profiles, and SMARTsummary are not included."))}</p>`;
    }
    if (name === "tab") {
      return `<p>${esc(t("botdee.rs.tabConsent", "Consent required before any charge"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.neverCharge", "No charge without a later personal OK"))}</p>`;
    }
    if (name === "permissions") {
      return `<p>${esc(t("botdee.rs.hostManaged", "Host managed"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.notLiveNote", "Group rooms are not live yet"))}</p>`;
    }
    if (name === "members") {
      return `<p>${esc(t("botdee.rs.commandMembers", "There is no active Room SMARTview yet, so there is no member list to show."))}</p>`;
    }
    if (name === "invite") {
      return `<p>${esc(t("botdee.rs.commandInvite", "Invite more people from Room SMARTview. Group rooms are not live yet — no invite is sent until that ships."))}</p>`;
    }
    return "";
  }

  function bindRoomCard(card) {
    if (!card || card.dataset.rsBound === "1") return;
    card.dataset.rsBound = "1";
    const toast = card.querySelector("[data-rs-toast]");
    const showToast = message => {
      if (!toast) return;
      toast.hidden = false;
      toast.textContent = message;
    };
    const panel = card.querySelector("[data-rs-panel-body]");
    card.querySelectorAll("[data-rs-panel]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        if (!panel) return;
        const name = btn.getAttribute("data-rs-panel");
        const html = roomPanelCopy(name);
        const open = panel.getAttribute("data-open") === name;
        panel.hidden = open;
        panel.setAttribute("data-open", open ? "" : name);
        panel.innerHTML = open ? "" : html;
      });
    });
    card.querySelector("[data-rs-confirm]")?.addEventListener("click", event => {
      event.preventDefault();
      const share = card.getAttribute("data-rs-mode") === "share_preview";
      showToast(share
        ? t("botdee.rs.shareNotPublished", "Nothing was published. Selected facts stay in this preview. Group rooms are not live.")
        : t("botdee.rs.confirmedNotLive", "Confirmed. Group rooms are not live yet — nothing was created, invited, or charged."));
      card.querySelector("[data-rs-confirm-row]")?.setAttribute("hidden", "");
    });
    card.querySelector("[data-rs-decline]")?.addEventListener("click", event => {
      event.preventDefault();
      rememberRoomDecline(card.getAttribute("data-rs-decline"));
      showToast(t("botdee.rs.declined", "OK — I won’t keep offering Room SMARTview for this."));
      card.querySelector("[data-rs-confirm-row]")?.setAttribute("hidden", "");
    });
  }

  function renderCard(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (isVersionPayload(payload)) return renderVersionCard(payload);
    if (isRoomPayload(payload)) return renderRoomCard(payload);
    if (isCompactCard(payload)) return renderCompactPeopleCard(payload);
    if (peopleOf(payload)) return renderPeopleCard(payload);
    const mock = payload.sources && payload.sources.some(s => s.provider === "mock" || s.reuseRights === "unknown");
    const researchOff = payload.publicWebResearch && payload.publicWebResearch.enabled === false;
    const iframeOk = payload.floqrPublicData && payload.floqrPublicData.menuIframeAllowed === true;
    const images = Array.isArray(payload.images) ? payload.images.slice(0, 2) : [];
    const ratings = Array.isArray(payload.ratings) ? payload.ratings : [];
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const cuisine = payload.floqrPublicData && Array.isArray(payload.floqrPublicData.cuisines)
      ? payload.floqrPublicData.cuisines
      : (payload.floqrPublicData && payload.floqrPublicData.cuisine) || [];
    const nhtsa = payload.kind === "vehicle" ? payload.floqrPublicData && payload.floqrPublicData.nhtsa : null;
    return `<article class="botdee-sv-card" data-kind="${esc(payload.kind)}">
      <header class="botdee-sv-head">
        <p class="botdee-sv-kind">${esc(payload.kind)}</p>
        <h3>${esc(payload.title)}</h3>
        ${mock ? `<p class="botdee-sv-mock">${esc(t("botdee.smartviewMockBadge", "Mock / not live licensed data"))}</p>` : ""}
      </header>
      ${payload.summary ? `<p class="botdee-sv-summary">${esc(payload.summary)}</p>` : ""}
      ${images.length ? `<div class="botdee-sv-images">${images.map(img => (
        img.licenseStatus === "blocked"
          ? `<p class="sub small">${esc(img.attribution || "Image blocked")}</p>`
          : `<figure><img src="${esc(resolveImageSrc(img.url))}" alt="" width="160" height="90"/>
              <figcaption>${esc(img.attribution || "")}</figcaption></figure>`
      )).join("")}</div>` : ""}
      ${ratings.length ? `<div class="botdee-sv-ratings"><p>${esc(t("botdee.smartviewRatingsNote", "Ratings are shown separately by source."))}</p><ul>${ratings.map(ratingRow).join("")}</ul></div>` : ""}
      ${cuisine.length ? `<p class="botdee-sv-cuisine">${esc(cuisine.join(" · "))}</p>` : ""}
      ${nhtsa && nhtsa.status === "missing" ? `<p class="botdee-sv-missing">${esc(nhtsa.note || "Safety rating unavailable for this year/trim.")}</p>` : ""}
      ${payload.kind === "patron" && researchOff ? `<p class="botdee-sv-research">${esc(t("botdee.smartviewResearchDisabled", "Public Web Research is off until legal and identity review."))}</p>` : ""}
      ${payload.kind === "venue" && payload.canonicalFloqrPageId ? `<p class="botdee-sv-canonical">FLOQR Public Page</p>` : ""}
      <ul class="botdee-sv-actions">${actions.map(action => {
        const href = String(action.href || "").trim();
        if (!href || /javascript:/i.test(href)) return "";
        const label = action.id === "open-public-page"
          ? t("botdee.smartviewVenueOpen", "Open FLOQR Public Page")
          : (action.id === "menu-external" && !iframeOk
            ? t("botdee.smartviewMenuExternal", "Menu (opens outside FLOQR)")
            : esc(action.label || "Open"));
        const fixed = resolveSameOriginHref(href);
        if (!fixed) return "";
        return `<li><a class="buttonlike" href="${esc(fixed)}">${label}</a></li>`;
      }).join("")}</ul>
    </article>`;
  }

  function paintPeopleTabs(card, people, primary, secondary) {
    card.dataset.primary = primary;
    card.dataset.secondary = secondary;
    card.querySelectorAll("[data-sv-primary]").forEach(btn => {
      btn.setAttribute("aria-selected", btn.getAttribute("data-sv-primary") === primary ? "true" : "false");
    });
    const subHost = card.querySelector(".botdee-sv-secondary");
    if (subHost) {
      subHost.innerHTML = subtabsFor(primary).map(tab => (
        `<button type="button" class="botdee-sv-tab" role="tab" data-sv-secondary="${esc(tab.id)}" aria-selected="${tab.id === secondary ? "true" : "false"}">${esc(t(tab.key, tab.label))}</button>`
      )).join("");
    }
    const tags = tagsForPeople(people, primary, secondary);
    const tagHost = card.querySelector(".botdee-sv-tags");
    if (tagHost) {
      tagHost.innerHTML = tags.map(tag => `<span class="botdee-sv-tag">${esc(tag)}</span>`).join("");
      tagHost.classList.toggle("is-empty", !tags.length);
    }
    const note = card.querySelector(".botdee-sv-note");
    if (note) {
      const datingHidden = primary === "Dating" && !people.datingVisible;
      const empty = !tags.length && !datingHidden;
      note.hidden = !(datingHidden || empty);
      if (datingHidden) {
        note.textContent = t("botdee.sv.datingHidden", "Dating details are visible only with the patron’s explicit opt-in. No dating preferences are inferred.");
      } else if (empty) {
        note.textContent = t("botdee.sv.noShared", "No information has been shared for this category.");
      }
    }
  }

  function ensureOverlay(id, html) {
    const doc = global.document;
    if (!doc) return null;
    let el = doc.getElementById(id);
    if (!el) {
      el = doc.createElement("div");
      el.id = id;
      el.className = "botdee-sv-overlay";
      el.hidden = true;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.innerHTML = html;
      doc.body.appendChild(el);
    }
    return el;
  }

  function closeSmartViewOverlays(state) {
    const doc = global.document;
    if (!doc) return;
    doc.querySelectorAll(".botdee-sv-overlay").forEach(node => {
      node.hidden = true;
    });
    doc.body.classList.remove("botdee-sv-overlay-open");
    restoreChatState(state || overlaySession?.chatState);
    overlaySession = null;
  }

  function trapFocus(overlay, event) {
    if (event.key !== "Tab" || overlay.hidden) return;
    const focusable = [...overlay.querySelectorAll("button, [href], textarea, input, select")].filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && global.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && global.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderMediaFor(session, overlay) {
    if (!session || !overlay) return;
    const people = session.people || {};
    const mediaType = session.mediaType || "photos";
    overlay.querySelectorAll("[data-sv-media]").forEach(btn => {
      btn.setAttribute("aria-selected", btn.getAttribute("data-sv-media") === mediaType ? "true" : "false");
    });
    const stage = overlay.querySelector("[data-sv-stage]");
    const foot = overlay.querySelector("[data-sv-media-foot]");
    const list = overlayMediaList(session);
    const emptyCopy = mediaType === "videos"
      ? t("botdee.sv.noVideos", "No publicly shared videos.")
      : t("botdee.sv.noPhotos", "No publicly shared photos.");
    if (!list.length) {
      if (stage) stage.innerHTML = `<p class="botdee-sv-foot">${esc(emptyCopy)}</p>`;
      if (foot) foot.textContent = emptyCopy;
      return;
    }
    const mediaIndex = Math.max(0, (Number(session.mediaIndex) || 0) % list.length);
    session.mediaIndex = mediaIndex;
    const item = list[mediaIndex];
    const src = item && item.url ? resolveImageSrc(item.url) : "";
    const prevLabel = mediaType === "videos" ? t("botdee.sv.prevVideo", "Previous video") : t("botdee.sv.prev", "Previous photo");
    const nextLabel = mediaType === "videos" ? t("botdee.sv.nextVideo", "Next video") : t("botdee.sv.next", "Next photo");
    const mediaTag = mediaType === "videos"
      ? `<video src="${esc(src)}" controls playsinline preload="metadata" ${item.alt ? `aria-label="${esc(item.alt)}"` : ""}></video>`
      : `<img src="${esc(src)}" alt="${esc(item.alt || people.displayName || "")}"/>`;
    if (stage) {
      stage.innerHTML = src
        ? `<button type="button" class="botdee-sv-arrow prev" data-sv-prev aria-label="${esc(prevLabel)}">‹</button>
           ${mediaTag}
           <button type="button" class="botdee-sv-arrow next" data-sv-next aria-label="${esc(nextLabel)}">›</button>`
        : `<p class="botdee-sv-foot">${esc(emptyCopy)}</p>`;
    }
    if (foot) {
      const kicker = mediaType === "videos" ? t("botdee.sv.videoIndex", "Video") : t("botdee.sv.photoCount", "Photo");
      foot.textContent = `${kicker} ${mediaIndex + 1} / ${list.length}`;
    }
  }

  function showOverlay(session, kind) {
    const doc = global.document;
    if (!session || !doc) return;
    rememberOverlaySession(session);
    if (!session.chatState) session.chatState = captureChatState();
    const people = session.people || {};
    doc.body.classList.add("botdee-sv-overlay-open");
    if (kind === "media") {
      const overlay = ensureOverlay("botdeeSvMediaOverlay", `<div class="botdee-sv-overlay-head"><h2 id="botdeeSvMediaTitle">${esc(t("botdee.sv.mediaTitle", "Shared media"))}</h2><button type="button" class="botdee-sv-close" data-sv-close aria-label="${esc(t("botdee.sv.close", "Close"))}">×</button></div>
        <div class="botdee-sv-switch" role="tablist">
          <button type="button" data-sv-media="photos" aria-selected="true">${esc(t("botdee.sv.photos", "Photos"))}</button>
          <button type="button" data-sv-media="videos" aria-selected="false">${esc(t("botdee.sv.videos", "Videos"))}</button>
        </div>
        <div class="botdee-sv-stage" data-sv-stage></div>
        <p class="botdee-sv-foot" data-sv-media-foot></p>`);
      overlay.setAttribute("aria-labelledby", "botdeeSvMediaTitle");
      overlay.hidden = false;
      if (session.mediaType !== "videos") session.mediaType = "photos";
      if (!Number.isFinite(Number(session.mediaIndex))) session.mediaIndex = 0;
      renderMediaFor(session, overlay);
      overlay.querySelector("[data-sv-close]")?.focus();
    } else if (kind === "summary") {
      const overlay = ensureOverlay("botdeeSvSummaryOverlay", `<div class="botdee-sv-overlay-head"><h2 id="botdeeSvSummaryTitle">${esc(t("botdee.sv.smartSummary", "SMARTsummary"))}</h2><button type="button" class="botdee-sv-close" data-sv-close aria-label="${esc(t("botdee.sv.close", "Close"))}">×</button></div>
        <div class="botdee-sv-long" data-sv-long></div>`);
      overlay.setAttribute("aria-labelledby", "botdeeSvSummaryTitle");
      overlay.hidden = false;
      const long = overlay.querySelector("[data-sv-long]");
      const status = people.summary?.pending
        ? `<p class="botdee-sv-locale">${esc(t("botdee.sv.translationPending", "Translation pending. Showing the source language."))}</p>`
        : "";
      const edit = people.ownerMayEdit
        ? `<p class="botdee-sv-owner-row"><button type="button" class="botdee-sv-action" data-sv-edit>${esc(t("botdee.sv.editSummary", "Edit my SMARTsummary"))}</button></p>`
        : "";
      const conflict = people.conflictFlag
        ? `<p class="botdee-sv-locale">${esc(t("botdee.sv.conflictReview", "Your public profile changed. Review this summary — it was not overwritten."))}</p>`
        : "";
      long.innerHTML = `${edit}${conflict}${status}<p>${esc(people.summary?.text || "")}</p>
        <p class="botdee-sv-foot">${esc(t("botdee.sv.summaryFoot", "Drafted from public-within-FLOQR fields. Facts are not guaranteed. Hide or correct them in Profile visibility."))}</p>`;
      overlay.querySelector("[data-sv-close]")?.focus();
    } else if (kind === "edit" && people.ownerMayEdit) {
      const overlay = ensureOverlay("botdeeSvEditOverlay", `<div class="botdee-sv-overlay-head"><h2 id="botdeeSvEditTitle">${esc(t("botdee.sv.editSummary", "Edit my SMARTsummary"))}</h2><button type="button" class="botdee-sv-close" data-sv-close aria-label="${esc(t("botdee.sv.close", "Close"))}">×</button></div>
        <p class="botdee-sv-foot">${esc(t("botdee.sv.editHint", "Edit in your default profile language. Translations to every other language, including English, update in the background."))}</p>
        <label class="botdee-sv-edit-label">${esc(t("botdee.sv.sourceLanguage", "Default profile language"))}
          <input id="botdeeSvSourceLocale" type="text" maxlength="8" readonly/>
        </label>
        <label class="botdee-sv-edit-label">${esc(t("botdee.sv.smartSummary", "SMARTsummary"))}
          <textarea id="botdeeSvSummaryEditor" rows="8" maxlength="1400"></textarea>
        </label>
        <button type="button" class="botdee-sv-action botdee-sv-action-main" data-sv-save>${esc(t("botdee.sv.saveSummary", "Save and queue translations"))}</button>
        <p class="botdee-sv-foot" data-sv-edit-status role="status"></p>`);
      overlay.setAttribute("aria-labelledby", "botdeeSvEditTitle");
      overlay.hidden = false;
      const localeInput = overlay.querySelector("#botdeeSvSourceLocale");
      const editor = overlay.querySelector("#botdeeSvSummaryEditor");
      if (localeInput) localeInput.value = people.summary?.editLocale || people.summary?.sourceLocale || "en";
      if (editor) {
        editor.value = people.summary?.editText != null
          ? people.summary.editText
          : (people.summary?.sourceText || "");
      }
      editor?.focus();
    }
  }

  function bindOverlayDocument(doc) {
    if (!doc || typeof doc.addEventListener !== "function" || doc.__floqrSmartViewOverlayBound) return;
    doc.__floqrSmartViewOverlayBound = true;
    doc.addEventListener("click", event => {
      const overlay = event.target.closest(".botdee-sv-overlay");
      if (!overlay || overlay.hidden) return;
      const session = currentOverlaySession();
      if (!session) return;
      if (event.target.closest("[data-sv-close]")) {
        closeSmartViewOverlays(session.chatState);
        return;
      }
      if (event.target.closest("[data-sv-media]")) {
        session.mediaType = event.target.closest("[data-sv-media]").getAttribute("data-sv-media") || "photos";
        session.mediaIndex = 0;
        renderMediaFor(session, overlay);
        return;
      }
      if (event.target.closest("[data-sv-prev]") || event.target.closest("[data-sv-next]")) {
        const delta = event.target.closest("[data-sv-next]") ? 1 : -1;
        advanceOverlayMedia(delta);
        renderMediaFor(session, overlay);
        return;
      }
      if (event.target.closest("[data-sv-edit]")) {
        showOverlay(session, "edit");
        return;
      }
      if (event.target.closest("[data-sv-save]")) {
        const editor = overlay.querySelector("#botdeeSvSummaryEditor");
        const status = overlay.querySelector("[data-sv-edit-status]");
        const value = String(editor?.value || "").trim();
        if (!value) {
          if (status) status.textContent = t("botdee.sv.summaryEmpty", "Summary cannot be empty.");
          return;
        }
        if (status) status.textContent = t("botdee.sv.saving", "Saving…");
        const callable = global.firebase?.app?.()?.functions?.("us-central1")?.httpsCallable?.("saveSmartSummary");
        const locale = String(
          overlay.querySelector("#botdeeSvSourceLocale")?.value
          || session.people?.summary?.editLocale
          || session.people?.summary?.sourceLocale
          || ""
        ).trim();
        const finish = (ok, message) => {
          if (status) status.textContent = message;
          if (ok) {
            if (session.people) {
              session.people.summary = session.people.summary || {};
              session.people.summary.text = value;
              session.people.summary.editText = value;
              session.people.summary.sourceText = value;
              session.people.summary.status = "source";
              session.people.summary.pending = true;
              if (locale) {
                session.people.summary.editLocale = locale;
                session.people.summary.sourceLocale = locale;
              }
            }
            const short = session.card?.querySelector(".botdee-sv-summary-text");
            if (short) short.textContent = value;
            closeSmartViewOverlays(session.chatState);
          }
        };
        if (!callable) {
          finish(false, t("botdee.sv.saveOffline", "Sign in to save. Translations are queued on the server, not in this browser."));
          return;
        }
        callable({summary: value, locale: locale || undefined}).then(() => {
          finish(true, t("botdee.sv.savedQueued", "Saved. Translations queued."));
        }).catch(err => {
          finish(false, err?.message || t("botdee.sv.saveFailed", "Could not save the summary."));
        });
      }
    });
    doc.addEventListener("keydown", event => {
      const session = currentOverlaySession();
      const open = [...doc.querySelectorAll(".botdee-sv-overlay")].find(node => !node.hidden);
      if (!open || !session) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeSmartViewOverlays(session.chatState);
        return;
      }
      trapFocus(open, event);
      if (open.id === "botdeeSvMediaOverlay" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        const delta = event.key === "ArrowRight" ? 1 : -1;
        advanceOverlayMedia(delta);
        renderMediaFor(session, open);
      }
    });
  }

  function bindPeopleCard(card, payload) {
    const people = peopleOf(payload);
    if (!card || !people) return;
    bindOverlayDocument(global.document);
    card.addEventListener("click", event => {
      const primaryBtn = event.target.closest("[data-sv-primary]");
      if (primaryBtn && card.contains(primaryBtn)) {
        const next = primaryBtn.getAttribute("data-sv-primary");
        const first = (subtabsFor(next)[0] || {}).id || "Music";
        paintPeopleTabs(card, people, next, first);
        return;
      }
      const secondaryBtn = event.target.closest("[data-sv-secondary]");
      if (secondaryBtn && card.contains(secondaryBtn)) {
        paintPeopleTabs(card, people, card.dataset.primary || "Social", secondaryBtn.getAttribute("data-sv-secondary"));
        return;
      }
      const open = event.target.closest("[data-sv-open]");
      if (open && card.contains(open)) {
        const photosList = Array.isArray(people.media?.photos) ? people.media.photos : [];
        const videosList = Array.isArray(people.media?.videos) ? people.media.videos : [];
        const heroVideo = people.photo?.kind === "video" || (!photosList.length && videosList.length);
        rememberOverlaySession({
          people,
          card,
          mediaType: heroVideo ? "videos" : "photos",
          mediaIndex: 0,
          chatState: captureChatState()
        });
        showOverlay(currentOverlaySession(), open.getAttribute("data-sv-open"));
      }
    });
  }

  const liveByHost = new WeakMap();

  function stopLive(el) {
    el.__floqrLiveToken = (Number(el.__floqrLiveToken) || 0) + 1;
    const rows = liveByHost.get(el) || [];
    rows.forEach(fn => {
      try { fn(); } catch (_) { /* ignore */ }
    });
    liveByHost.set(el, []);
  }

  function functionsCallable(name) {
    try {
      return global.firebase?.app?.()?.functions?.("us-central1")?.httpsCallable?.(name) || null;
    } catch (_) {
      return null;
    }
  }

  function viewerLanguage() {
    return global.FLOQRI18n?.getLanguage?.() || global.FLOQRI18n?.language || "en";
  }

  function applyHostViews(el, nextViews, meta) {
    const list = Array.isArray(nextViews) ? nextViews : [];
    el.__floqrSmartViews = list;
    mount(el, list, meta);
  }

  function patchHostView(el, uid, nextPayload) {
    const current = Array.isArray(el.__floqrSmartViews) ? el.__floqrSmartViews.slice() : [];
    const idx = current.findIndex(row => subjectUidOf(row) === uid);
    if (!nextPayload) {
      if (idx < 0) return;
      current.splice(idx, 1);
      el.__floqrSmartViews = current;
      const gone = el.querySelector(`[data-subject-uid="${cssAttr(uid)}"]`);
      if (gone) gone.remove();
      return;
    }
    if (idx < 0) return;
    current[idx] = nextPayload;
    el.__floqrSmartViews = current;
    const html = renderCard(nextPayload);
    const wrap = el.ownerDocument.createElement("div");
    wrap.innerHTML = html;
    const nextCard = wrap.firstElementChild;
    if (!nextCard) return;
    const existing = el.querySelector(`[data-subject-uid="${cssAttr(uid)}"]`);
    if (existing) existing.replaceWith(nextCard);
    wireActionLinks(el);
    if (isCompactCard(nextPayload)) bindCompactCard(nextCard, nextPayload, el);
    else bindPeopleCard(nextCard, nextPayload);
  }

  function cssAttr(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function refetchSubject(uid) {
    const callable = functionsCallable("getPeopleSmartView");
    if (!callable || !uid) return Promise.resolve(null);
    return callable({subjectUid: uid, uiLanguage: viewerLanguage()}).then(res => {
      const data = res?.data || {};
      if (data.blocked || data.hidden || !Array.isArray(data.views) || !data.views.length) return null;
      return data.views[0];
    }).catch(() => null);
  }

  function pairBlockDocId(a, b) {
    return [String(a || ""), String(b || "")].filter(Boolean).sort().join("_");
  }

  function currentViewerUid() {
    try {
      return global.firebase?.auth?.()?.currentUser?.uid || "";
    } catch (_) {
      return "";
    }
  }

  function listenSubject(el, uid) {
    const db = global.firebase?.firestore?.();
    if (!db || !uid || /^mock[-_]/i.test(uid)) return () => {};
    const token = el.__floqrLiveToken;
    const applyRefetch = () => {
      refetchSubject(uid).then(view => {
        if (!el.isConnected || el.__floqrLiveToken !== token) return;
        const current = Array.isArray(el.__floqrSmartViews) ? el.__floqrSmartViews : [];
        const idx = current.findIndex(row => subjectUidOf(row) === uid);
        if (idx < 0) return;
        if (!view) {
          patchHostView(el, uid, null);
          return;
        }
        const keepCompact = isCompactCard(current[idx]);
        patchHostView(el, uid, keepCompact ? asClientCompact(view) : view);
      });
    };
    const unsubs = [];
    let sawReadable = false;
    unsubs.push(db.collection("usercharacter_analysis").doc(uid).onSnapshot(() => {
      sawReadable = true;
      applyRefetch();
    }, () => {
      /* Initial deny (unstamped / mock) keeps the search-authorized card.
         After a successful listen, hide makes the listener error — refetch.
         Missing analysis is readable for the owner; getPeopleSmartView decides. */
      if (!sawReadable) return;
      applyRefetch();
    }));
    const viewerUid = currentViewerUid();
    if (viewerUid && viewerUid !== uid) {
      unsubs.push(db.collection("userBlocks").doc(pairBlockDocId(viewerUid, uid)).onSnapshot(snap => {
        if (!el.isConnected || el.__floqrLiveToken !== token) return;
        if (snap.exists && snap.data()?.active !== false) patchHostView(el, uid, null);
      }, () => {}));
    }
    return () => {
      unsubs.forEach(fn => {
        try { fn(); } catch (_) { /* ignore */ }
      });
    };
  }

  function asClientCompact(view) {
    const people = peopleOf(view);
    if (!people) return view;
    return {
      ...view,
      floqrPublicData: {
        ...view.floqrPublicData,
        peopleV2: {
          ...people,
          presentation: "peopleSmartCard",
          summary: {
            ...(people.summary || {}),
            excerpt: people.summary?.text || "",
            clampLines: 4
          }
        }
      }
    };
  }

  function bindCompactCard(card, payload, host) {
    if (!card || !payload) return;
    const open = () => {
      const uid = subjectUidOf(payload);
      if (!uid) return;
      refetchSubject(uid).then(view => {
        if (!view || !host.isConnected) return;
        applyHostViews(host, [view], {mode: "one"});
      });
    };
    card.addEventListener("click", event => {
      if (event.target.closest("a")) return;
      event.preventDefault();
      open();
    });
    card.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  }

  function bindMore(el, meta) {
    if (!meta || !meta.hasMore) return;
    const btn = el.querySelector("[data-sc-more]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const callable = functionsCallable("searchPeopleSmartCards");
      if (!callable || !meta.query) return;
      btn.disabled = true;
      callable({query: meta.query, page: (Number(meta.page) || 1) + 1, uiLanguage: viewerLanguage()}).then(res => {
        const data = res?.data || {};
        const extra = Array.isArray(data.views) ? data.views : [];
        const nextMeta = {...meta, ...(data.peopleSearch || {}), query: meta.query};
        applyHostViews(el, (el.__floqrSmartViews || []).concat(extra), nextMeta);
      }).catch(() => {
        btn.disabled = false;
      });
    });
  }

  function catalogReady() {
    return !!(window.FLOQRSmartVisualsCatalog);
  }

  function scrollTranscriptAfterPaint(el) {
    const chat = window.FLOQRBotDeeChat;
    if (chat && typeof chat.scrollTranscriptToLatest === "function") {
      chat.scrollTranscriptToLatest();
      return;
    }
    const log = (el && el.closest && el.closest("#botDeeTranscript"))
      || (typeof document !== "undefined" && document.getElementById("botDeeTranscript"));
    if (!log || (el && log.contains && !log.contains(el))) return;
    log.scrollTop = log.scrollHeight;
  }

  function mount(el, views, peopleSearch) {
    if (!el) return;
    const list = Array.isArray(views) ? views : [];
    const paint = (resync) => {
      paintHost(el, list, peopleSearch);
      if (resync) scrollTranscriptAfterPaint(el);
    };
    const needsCatalog = list.some(isRoomPayload) && window.FLOQRSmartVisuals?.ensureCatalog;
    if (needsCatalog && !catalogReady()) {
      window.FLOQRSmartVisuals.ensureCatalog().then(() => paint(true), () => paint(true));
      return;
    }
    paint(false);
  }

  function paintHost(el, list, peopleSearch) {
    stopLive(el);
    el.__floqrSmartViews = list;
    el.__floqrPeopleSearch = peopleSearch || el.__floqrPeopleSearch || null;
    const meta = el.__floqrPeopleSearch || {};
    const more = meta.hasMore
      ? `<p class="botdee-sc-more"><button type="button" class="botdee-sv-action" data-sc-more>${esc(t("botdee.sc.moreResults", "Show more people"))}</button></p>`
      : "";
    el.innerHTML = list.map(renderCard).join("") + more || `<p class="sub small">${esc(t("botdee.libraryEmpty", "No saved SMARTviews yet."))}</p>`;
    wireActionLinks(el);
    el.querySelectorAll(".botdee-sv-version").forEach(card => bindVersionCard(card));
    el.querySelectorAll(".botdee-sv-room").forEach(card => bindRoomCard(card));
    const cards = el.querySelectorAll(".botdee-sv-people");
    let index = 0;
    list.forEach(payload => {
      if (!peopleOf(payload)) return;
      const card = cards[index];
      index += 1;
      if (!card) return;
      if (isCompactCard(payload)) bindCompactCard(card, payload, el);
      else bindPeopleCard(card, payload);
    });
    bindMore(el, meta);
    const unsubs = [];
    list.forEach(payload => {
      const uid = subjectUidOf(payload);
      if (uid) unsubs.push(listenSubject(el, uid));
    });
    liveByHost.set(el, unsubs);
  }

  if (global.document) bindOverlayDocument(global.document);
  if (global.document && !global.__floqrSmartViewChromeBound) {
    global.__floqrSmartViewChromeBound = true;
    global.addEventListener("floqr-chrome-change", () => {
      /* Site Chrome tokens restyle in place — do not remount or drop drafts. */
    });
  }

  global.FLOQRBotDeeSmartView = {
    renderCard,
    renderPeopleCard,
    renderCompactPeopleCard,
    renderVersionCard,
    renderRoomCard,
    isVersionPayload,
    isRoomPayload,
    localVersionPayload,
    peopleHeroMedia,
    isCompactCard,
    mount,
    resolveSameOriginHref,
    wireActionLinks,
    captureChatState,
    restoreChatState,
    tagsForPeople,
    currentOverlaySession,
    rememberOverlaySession,
    advanceOverlayMedia
  };
})(window);
