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

  const PLACE_KINDS = new Set([
    "venue", "restaurant", "hotel", "short_term_rental", "event",
    "real_estate", "product", "travel", "vehicle"
  ]);

  const KIND_LABELS = {
    venue: {key: "botdee.sv.kindVenue", label: "Venue"},
    restaurant: {key: "botdee.sv.kindRestaurant", label: "Restaurant"},
    hotel: {key: "botdee.sv.kindHotel", label: "Hotel"},
    short_term_rental: {key: "botdee.sv.kindRental", label: "Short-term rental"},
    event: {key: "botdee.sv.kindEvent", label: "Event"},
    travel: {key: "botdee.sv.kindTravel", label: "Travel"},
    vehicle: {key: "botdee.sv.kindVehicle", label: "Vehicle"},
    product: {key: "botdee.sv.kindProduct", label: "Product"},
    real_estate: {key: "botdee.sv.kindEstate", label: "Real estate"}
  };

  function isPlacePayload(payload) {
    return !!(payload && PLACE_KINDS.has(payload.kind));
  }

  function kindLabel(kind) {
    const row = KIND_LABELS[kind];
    return row ? t(row.key, row.label) : String(kind || "");
  }

  function placeVisual(payload) {
    const resolver = global.FLOQRSmartVisualsResolver;
    if (!resolver?.resolvePlaceCard) {
      return {backgroundUrl: "", backgroundId: "", stencilUrl: "", stencilId: "", tags: []};
    }
    const catalog = global.FLOQRSmartVisualsCatalog;
    const selection = resolver.resolvePlaceCard(payload, catalog);
    const publishedUrl = String(payload?.floqrPublicData?.smartBackgroundUrl || payload?.smartBackgroundUrl || "").trim();
    const urls = resolver.urlsFor
      ? resolver.urlsFor(Object.assign({}, selection, publishedUrl ? {backgroundUrl: publishedUrl} : {}), catalog)
      : {};
    const tags = Array.isArray(selection.tags)
      ? selection.tags
      : (resolver.normalizeSmartViewTags
        ? resolver.normalizeSmartViewTags(payload?.floqrPublicData?.smartTags || payload?.tags)
        : []);
    return {
      backgroundId: selection.backgroundId || "",
      backgroundUrl: urls.backgroundUrl || "",
      stencilId: selection.stencilId || "",
      stencilUrl: urls.stencilUrl || "",
      stencilName: urls.stencilName || "",
      tags
    };
  }

  function placeTagHtml(tags) {
    const seen = new Set();
    const list = [];
    (Array.isArray(tags) ? tags : []).forEach(tag => {
      const raw = String(tag || "");
      const next = raw.indexOf("destination:") === 0 ? raw.slice("destination:".length) : raw;
      if (!next || seen.has(next)) return;
      seen.add(next);
      list.push(next);
    });
    const shown = list.slice(0, 8);
    if (!shown.length) return "";
    return `<div class="botdee-sv-tags" data-sv-place-tags="1">${shown.map(tag =>
      `<span class="botdee-sv-tag">${esc(tag)}</span>`
    ).join("")}</div>`;
  }

  function chromeIconSrc() {
    const scheme = global.FLOQRChromeScheme;
    const url = scheme?.iconUrl?.("botDee");
    if (url) return url;
    return "./images/chrome/botdee-nightlife.jpg";
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
    return Array.isArray(rows)
      ? rows.map(tag => String(tag || "").trim()).filter(Boolean)
      : [];
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

  function lookingToMeetOf(people) {
    const direct = String(people?.lookingToMeet || "").trim();
    if (direct) return people?.datingVisible === false ? "" : direct;
    if (people?.datingVisible === false) return "";
    const prefs = people?.categories?.Dating?.Preferences;
    return Array.isArray(prefs) && prefs[0] ? String(prefs[0]).trim() : "";
  }

  function socialNetworkLabel(row) {
    const network = String(row?.network || "").toLowerCase();
    if (network === "instagram") return t("botdee.sv.instagram", "Instagram");
    if (network === "x" || network === "twitter") return t("botdee.sv.xNetwork", "X");
    return "";
  }

  /** Line 2 handle: FLOQR handle first, else first public social handle. */
  function primaryHandleOf(people) {
    const floqr = String(people?.handle || "").trim();
    if (floqr) {
      return {label: floqr.startsWith("@") ? floqr : `@${floqr.replace(/^@+/, "")}`, href: ""};
    }
    const handles = Array.isArray(people?.handles) ? people.handles : [];
    const first = handles.find(row => row && String(row.handle || "").trim());
    if (!first) return null;
    return {label: String(first.handle).trim(), href: first.href || ""};
  }

  function peopleHandleHtml(people) {
    const handle = primaryHandleOf(people);
    if (!handle || !handle.label) return "";
    const href = resolveSameOriginHref(handle.href || "");
    if (!href) return `<span class="botdee-sv-handle">${esc(handle.label)}</span>`;
    return `<a class="botdee-sv-handle" href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(handle.label)}</a>`;
  }

  function peopleNameHtml(people, payload) {
    const name = people.displayName || payload?.title || "";
    return `${esc(name)}${people.verified ? " <span class=\"botdee-sv-tick\" aria-hidden=\"true\">◆</span>" : ""}`;
  }

  function peopleFactsHtml(people) {
    const rows = [];
    const bio = String(people?.bio || "").trim();
    if (bio) {
      rows.push(`<dt>${esc(t("botdee.sv.bio", "Bio"))}</dt><dd>${esc(bio)}</dd>`);
    }
    const city = String(people?.city || "").trim();
    if (city) {
      rows.push(`<dt>${esc(t("botdee.sv.location", "Location"))}</dt><dd>${esc(city)}</dd>`);
    }
    const meet = lookingToMeetOf(people);
    if (meet) {
      rows.push(`<dt>${esc(t("botdee.sv.lookingToMeet", "Looking to meet"))}</dt><dd>${esc(meet)}</dd>`);
    }
    const socials = (Array.isArray(people?.handles) ? people.handles : []).filter(row => row && String(row.handle || "").trim());
    if (socials.length) {
      const links = socials.map(row => {
        const href = resolveSameOriginHref(row.href || "");
        const network = socialNetworkLabel(row);
        const label = network ? `${network} ${row.handle}` : row.handle;
        if (!href) return `<span>${esc(label)}</span>`;
        return `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${esc(label)}</a>`;
      }).join("");
      rows.push(`<dt>${esc(t("botdee.sv.socials", "Socials"))}</dt><dd><div class="botdee-sv-socials">${links}</div></dd>`);
    }
    if (!rows.length) return "";
    return `<dl class="botdee-sv-facts">${rows.join("")}</dl>`;
  }

  function renderCompactPeopleCard(payload) {
    const people = peopleOf(payload);
    if (!people) return "";
    const hero = peopleHeroMedia(people);
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
          <div class="botdee-sc-id botdee-sv-id">
            <div class="botdee-sc-name botdee-sv-name">${peopleNameHtml(people, payload)}</div>
            ${peopleHandleHtml(people)}
          </div>
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
    const profileHref = resolveSameOriginHref(people.profileHref || "./patron-portal.html?tab=profile");
    const minglHref = resolveSameOriginHref(people.minglHref || "./?start=search");
    const summaryText = people.summary?.text || people.summary?.excerpt || "";
    const localeNote = statusLabel(people.summary);
    const uid = people.subjectUid || "";
    const hasMedia = !!(photo || videoHero);
    return `<article class="botdee-sv-people" data-kind="patron" data-primary="${esc(primary)}" data-secondary="${esc(secondary)}" data-subject-uid="${esc(uid)}">
      <div class="botdee-sv-people-head">
        <strong>${esc(t("botdee.sv.person", "SMARTview — Person"))}</strong>
        ${people.verified ? `<span class="botdee-sv-verified">${esc(t("botdee.sv.verified", "Verified on FLOQR"))}</span>` : ""}
      </div>
      ${mock ? `<p class="botdee-sv-mock">${esc(t("botdee.smartviewMockBadge", "Mock / not live licensed data"))}</p>` : ""}
      <div class="botdee-sv-identity">
        <button type="button" class="botdee-sv-portrait" data-sv-open="media" ${hasMedia ? "" : "hidden"} aria-label="${esc(t("botdee.sv.openMedia", "View shared photos and videos"))}">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(people.displayName || "")}"/>` : (videoHero ? `<video src="${esc(videoHero)}" muted playsinline preload="metadata" aria-hidden="true"></video>` : "")}
          ${count ? `<span class="botdee-sv-counter">${esc(String(Math.min(1, count)))}/${esc(String(count))}</span>` : ""}
        </button>
        <div class="botdee-sv-id">
          <div class="botdee-sv-name">${peopleNameHtml(people, payload)}</div>
          ${peopleHandleHtml(people)}
        </div>
        <button type="button" class="botdee-sv-summary-btn" data-sv-open="summary" aria-label="${esc(t("botdee.sv.smartSummary", "SMARTsummary"))}">
          <span class="botdee-sv-summary-kicker">${esc(t("botdee.sv.smartSummary", "SMARTsummary"))}</span>
          <span class="botdee-sv-summary-text">${esc(summaryText)}</span>
          ${localeNote ? `<span class="botdee-sv-locale">${localeNote}</span>` : ""}
        </button>
      </div>
      ${peopleFactsHtml(people)}
      <div class="botdee-sv-primary" role="tablist" aria-label="${esc(t("botdee.sv.categories", "SMARTview categories"))}">${PRIMARY_META.map(tab => (
        `<button type="button" class="botdee-sv-tab" role="tab" data-sv-primary="${esc(tab.id)}" aria-selected="${tab.id === primary ? "true" : "false"}"><span class="botdee-sv-tab-ico" aria-hidden="true">${tab.icon}</span> ${esc(t(tab.key, tab.label))}</button>`
      )).join("")}</div>
      <section class="botdee-sv-details">
        <div class="botdee-sv-secondary" role="tablist" aria-label="${esc(t("botdee.sv.socialCategories", "Social categories"))}">${subtabsFor(primary).map(tab => (
          `<button type="button" class="botdee-sv-tab" role="tab" data-sv-secondary="${esc(tab.id)}" aria-selected="${tab.id === secondary ? "true" : "false"}">${esc(t(tab.key, tab.label))}</button>`
        )).join("")}</div>
        <div class="botdee-sv-tags${tags.length ? "" : " is-empty"}">${tags.map(tag => `<span class="botdee-sv-tag">${esc(tag)}</span>`).join("")}</div>
        <p class="botdee-sv-note" ${people.datingVisible || primary !== "Dating" ? "hidden" : ""}>${esc(t("botdee.sv.datingHidden", "Dating details are visible only with the patron’s explicit opt-in. No dating preferences are inferred."))}</p>
      </section>
      <div class="botdee-sv-people-actions">
        <a class="botdee-sv-action" href="${esc(profileHref)}">${esc(t("botdee.sv.viewProfile", "View Full Profile"))}</a>
        ${uid ? `<button type="button" class="botdee-sv-action botdee-sv-action-main" data-sv-invite-uid="${esc(uid)}">${esc(t("botdee.rs.invite", "Invite"))}</button>` : `<a class="botdee-sv-action botdee-sv-action-main" href="${esc(minglHref)}">${esc(t("botdee.sv.mingl", "Mingl"))}</a>`}
      </div>
    </article>`;
  }

  function isVersionPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "botDeeVersion");
  }

  function isFeaturesPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "featuresSmartView");
  }

  function renderFeaturesCard(payload) {
    return `<div class="floqr-fsv-inline-host" data-kind="featuresSmartView" data-fsv-product="${esc(payload.productId || "")}"></div>`;
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

  function whatsNewLine(item) {
    const id = String(item && item.id || "").trim();
    const localized = id ? t(`botdee.vs.note.${id}`, "") : "";
    if (localized) return localized;
    return String((item && (item.text || item.id)) || "");
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
          ? `<ul>${changelog.map(item => `<li>${esc(whatsNewLine(item))}</li>`).join("")}</ul>`
          : `<p>${esc(t("botdee.vs.whatsNewEmpty", "No BOT DEE or Gemini notes are listed for this build."))}</p>`}
      </div>
      <div class="botdee-sv-version-panel" data-vs-panel="help" role="tabpanel" hidden>
        <h3>${esc(t("botdee.vs.helpHeading", "Version command"))}</h3>
        <p>${esc(t("botdee.vs.helpBody", "Type Ver, Vers, or Version — capitals do not matter. BOT DEE shows the version card. A longer question like “what is your version?” still shows that card."))}</p>
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

  function isShoutOutPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "botDeeShoutOut");
  }

  function shoutNeedLabel(id) {
    if (id === "club") return t("botdee.so.needClub", "Which venue should this ShoutOut play on?");
    if (id === "message") return t("botdee.so.needMessage", "What should the shoutout text say on the sign?");
    if (id === "template") return t("botdee.so.needTemplate", "Choose a template");
    if (id === "handle") return t("botdee.so.needHandle", "Include your @handle?");
    if (id === "media") return t("botdee.so.needMedia", "Text only, or photo/video via compose");
    if (id === "compose") return t("botdee.so.needCompose", "Open compose for photo/video");
    if (id === "jerseyTeamId") return t("botdee.so.needJerseyTeam", "Which country or club kit should the jersey use?");
    if (id === "jerseyName") return t("botdee.so.needJerseyName", "What name goes on the jersey back?");
    if (id === "jerseyNumber") return t("botdee.so.needJerseyNumber", "What number goes on the jersey?");
    if (id === "playerName") return t("botdee.so.needPlayerName", "What name should the sign show?");
    if (id === "facePhoto") return t("botdee.so.needFacePhoto", "Baller's Alert needs a face photo — open compose or send a photo URL.");
    if (id === "teamPhotos") return t("botdee.so.needTeamPhotos", "Football Intro needs four player photos — open compose to add them.");
    if (id === "throw") return t("botdee.so.needThrow", "Reply throw it to send this ShoutOut");
    return esc(id);
  }

  function wrapShoutLines(text) {
    const perLine = 15;
    const lineCount = 3;
    const clean = String(text || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (!clean) return [];
    const rows = [];
    let row = [];
    clean.split(/\s+/).filter(Boolean).forEach(word => {
      const chunks = [];
      for (let i = 0; i < word.length; i += perLine) chunks.push(word.slice(i, i + perLine));
      chunks.forEach(chunk => {
        const nextLen = row.length ? row.join("").length + 1 + chunk.length : chunk.length;
        if (nextLen <= perLine) {
          if (row.length) row.push(" ");
          row.push(chunk);
        } else if (rows.length < lineCount) {
          if (row.length) rows.push(row.join(""));
          row = [chunk];
        }
      });
    });
    if (row.length && rows.length < lineCount) rows.push(row.join(""));
    return rows.slice(0, lineCount);
  }

  function shoutBoardSkin(templateId) {
    const id = String(templateId || "blackwhite");
    if (id === "classicHalloween") return "halloween";
    if (id === "gold" || id === "vip") return "gold";
    if (id === "neon" || id === "birthday") return "neon";
    return "traditional";
  }

  const SHOUT_TEMPLATE_PROMPTS = {
    Traditional: "blackwhite",
    Neon: "neon",
    Birthday: "birthday",
    Gold: "gold",
    VIP: "vip",
    Graduation: "graduation",
    Corporate: "corporate",
    Halloween: "classicHalloween"
  };

  /** Composer LED preview only. Do not use the Xibo location-only helper (that strips template/main). Never cache-bust display URLs. */
  function sanitizeShoutOutPreviewHref(href) {
    const raw = String(href || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, "https://floqr.local/");
      const file = String(url.pathname.split("/").pop() || "").toLowerCase();
      if (file !== "display.html") return "";
      url.searchParams.delete("v");
      url.searchParams.set("preview", "1");
      return `./display.html?${url.searchParams.toString()}`;
    } catch (_) {
      return "";
    }
  }

  function shoutOutLedSrc(view) {
    const fromHref = sanitizeShoutOutPreviewHref(view && view.previewHref);
    if (fromHref) return fromHref;
    const row = view && typeof view === "object" ? view : {};
    const params = new URLSearchParams();
    const loc = String(row.clubLocationId || "").trim();
    if (loc) params.set("location", loc);
    params.set("template", String(row.templateId || row.templateSuggestedId || "blackwhite"));
    if (row.mainText) params.set("main", String(row.mainText));
    if (row.includeAttribution || row.handleDecision === "include") {
      params.set("includeAttribution", "1");
      if (row.attribution) params.set("attribution", String(row.attribution));
    }
    if (row.screenFormatId) params.set("screen", String(row.screenFormatId));
    params.set("preview", "1");
    return `./display.html?${params.toString()}`;
  }

  function patchShoutOutLedSrc(src, patch) {
    const href = sanitizeShoutOutPreviewHref(src) || sanitizeShoutOutPreviewHref(shoutOutLedSrc({previewHref: src}));
    if (!href) return "";
    try {
      const url = new URL(href, "https://floqr.local/");
      const next = patch && typeof patch === "object" ? patch : {};
      if (next.templateId) url.searchParams.set("template", String(next.templateId));
      if (next.handle === "include") {
        url.searchParams.set("includeAttribution", "1");
        if (next.attribution) url.searchParams.set("attribution", String(next.attribution));
      } else if (next.handle === "skip") {
        url.searchParams.delete("includeAttribution");
        url.searchParams.delete("attribution");
      }
      url.searchParams.delete("v");
      url.searchParams.set("preview", "1");
      return `./display.html?${url.searchParams.toString()}`;
    } catch (_) {
      return href;
    }
  }

  function shoutStatusKey(view, needs) {
    if (view.checkoutUrl) return "pay";
    const mode = String(view.mode || "draft");
    if (mode === "submitted" || view.shoutoutId || view.portalHref) return "submitted";
    if (mode === "checkout") return "pay";
    if (!needs.length) return "ready";
    return "draft";
  }

  function shoutStatusCopy(key) {
    if (key === "ready") return t("botdee.so.statusReady", "Ready");
    if (key === "submitted") return t("botdee.so.statusSubmitted", "Submitted");
    if (key === "pay") return t("botdee.so.statusPay", "Pay");
    return t("botdee.so.statusDraft", "Draft");
  }

  function shoutChip(prompt, label, pressed) {
    const value = String(prompt || "").trim();
    if (!value) return "";
    return `<button type="button" class="botdee-so-chip" data-so-prompt="${esc(value)}" aria-pressed="${pressed ? "true" : "false"}">${esc(label || value)}</button>`;
  }

  function renderShoutOutCard(payload) {
    const view = payload && typeof payload === "object" ? payload : {};
    const needs = Array.isArray(view.needs) ? view.needs : [];
    const templates = Array.isArray(view.templates) ? view.templates.slice(0, 8) : [];
    const compose = resolveSameOriginHref(view.composeHref || "");
    const portal = resolveSameOriginHref(view.portalHref || "");
    const checkout = String(view.checkoutUrl || "").trim();
    const mode = String(view.mode || "draft");
    const templateId = view.templateId || view.templateSuggestedId || "blackwhite";
    const skin = view.boardSkin || shoutBoardSkin(templateId);
    const handleCopy = view.handleDecision === "include"
      ? (view.attribution || t("botdee.so.handleOn", "FloqR card on"))
      : (view.handleDecision === "skip"
        ? t("botdee.so.handleOff", "No @handle")
        : t("botdee.so.handleUnset", "Not chosen yet"));
    const mediaCopy = view.mediaDecision === "compose"
      ? t("botdee.so.photoCompose", "Photo/video — compose")
      : (view.mediaDecision === "none"
        ? t("botdee.so.textOnly", "Text only")
        : (view.mediaUrl ? view.mediaUrl : t("botdee.so.mediaUnset", "Not chosen yet")));
    const templateCopy = view.templateName
      || (view.templateId
        ? view.templateId
        : t("botdee.so.templateUnset", "Not chosen yet"));
    const lines = (Array.isArray(view.previewLines) && view.previewLines.length
      ? view.previewLines
      : wrapShoutLines(view.mainText)).concat(["", "", ""]).slice(0, 3);
    const railOn = view.handleDecision === "include";
    const railAsk = view.handleDecision !== "include" && view.handleDecision !== "skip";
    const railText = railOn
      ? (view.attribution || "@")
      : (railAsk ? t("botdee.so.handleUnset", "Not chosen yet") : t("botdee.so.handleOff", "No @handle"));
    const status = shoutStatusKey(view, needs);
    const collecting = mode === "draft" || mode === "ready";
    const step = view.currentStep || needs[0] || (collecting ? "throw" : "");
    const venue = view.venueName || view.clubLocationId || "—";
    const templateChipLabel = {
      blackwhite: "Traditional",
      birthday: "Birthday",
      vip: "VIP",
      neon: "Neon",
      gold: "Gold",
      graduation: "Graduation",
      corporate: "Corporate",
      classicHalloween: "Halloween"
    };
    const templateChips = templates.map(row => shoutChip(
      templateChipLabel[row.id] || row.id,
      templateChipLabel[row.id] || row.id,
      view.templateId === row.id && !!view.templateName
    )).join("");
    const handleChips = [
      shoutChip("include my handle", "include my handle", view.handleDecision === "include"),
      shoutChip("no handle", "no handle", view.handleDecision === "skip")
    ].join("");
    const mediaChips = [
      shoutChip("text only", "text only", view.mediaDecision === "none"),
      shoutChip("with a photo", "with a photo", view.mediaDecision === "compose")
    ].join("");
    const row = (label, value) => `<div class="botdee-so-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
    const ledSrc = shoutOutLedSrc(view);
    return `<article class="botdee-sv-shoutout" data-kind="botDeeShoutOut" data-so-mode="${esc(mode)}" data-so-step="${esc(step)}" data-so-status="${esc(status)}" data-so-surface="${esc(view.surface || "bubble")}">
      <h2 class="botdee-so-title"><span class="botdee-so-spark" aria-hidden="true">✦</span>${esc(t("botdee.so.title", "ShoutOut SMARTpreview"))}</h2>
      <div class="botdee-so-id">
        <div class="botdee-so-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="botdee-so-id-copy">
          <strong>ShoutOut</strong>
          <p class="botdee-so-sub">${esc(venue)} · ${esc(t("botdee.so.subtitle", "BOT DEE collection"))}</p>
        </div>
        <span class="botdee-so-pill" data-status="${esc(status)}">${esc(shoutStatusCopy(status))}</span>
      </div>
      <div class="botdee-so-board" data-skin="${esc(skin)}" data-media="${esc(view.mediaDecision || "")}" data-template="${esc(templateId)}" role="img" aria-label="${esc(t("botdee.so.preview", "ShoutOut preview"))}">
        ${ledSrc ? `<iframe class="botdee-so-led" title="${esc(t("botdee.so.preview", "ShoutOut preview"))}" src="${esc(ledSrc)}" data-so-attribution="${esc(view.attribution || "")}" loading="eager" referrerpolicy="no-referrer" tabindex="-1"></iframe>` : ""}
        <div class="botdee-so-board-fallback">
          <div class="botdee-so-board-frame">
            <div class="botdee-so-board-plate">
              <b>${esc(lines[0] || " ")}</b>
              <b>${esc(lines[1] || " ")}</b>
              <b>${esc(lines[2] || " ")}</b>
            </div>
            <div class="botdee-so-board-rail" data-handle="${esc(railOn ? "on" : (railAsk ? "ask" : "off"))}">
              <span>FloqR</span>
              <span>${esc(railText)}</span>
            </div>
          </div>
        </div>
      </div>
      <p class="botdee-so-hint">${esc(t("botdee.so.hint", "ShoutOut SMARTpreview stays with this chat. Reply here or tap a chip. A third-party headless throw does not need this card."))}</p>
      <div class="botdee-so-rows">
        ${row(t("botdee.so.venue", "Venue"), venue)}
        ${row(t("botdee.so.message", "Message"), view.mainText || "—")}
        ${row(t("botdee.so.template", "Template"), templateCopy)}
        ${row(t("botdee.so.handle", "@handle"), handleCopy)}
        ${row(t("botdee.so.media", "Photo / video"), mediaCopy)}
      </div>
      ${needs.length ? `<div class="botdee-so-needed"><h3>${esc(t("botdee.so.stillNeeded", "Still needed"))}</h3><ol>${needs.map(id => `<li>${esc(shoutNeedLabel(id))}</li>`).join("")}</ol></div>` : ""}
      ${collecting ? `<section class="botdee-so-step${step === "template" ? " is-current" : ""}" data-step="template">
        <h3>${esc(t("botdee.so.template", "Template"))}</h3>
        <div class="botdee-so-chips" role="group">${templateChips}</div>
      </section>
      <section class="botdee-so-step${step === "handle" ? " is-current" : ""}" data-step="handle">
        <h3>${esc(t("botdee.so.floqrCard", "FloqR card"))}</h3>
        <div class="botdee-so-chips" role="group">${handleChips}</div>
      </section>
      <section class="botdee-so-step${step === "media" || step === "compose" ? " is-current" : ""}" data-step="media">
        <h3>${esc(t("botdee.so.board", "Board"))}</h3>
        <div class="botdee-so-chips" role="group">${mediaChips}</div>
      </section>` : ""}
      <div class="botdee-so-actions">
        ${collecting && !checkout ? shoutChip("throw it", t("botdee.so.throwIt", "Throw it"), false).replace("botdee-so-chip", "botdee-so-chip botdee-so-throw") : ""}
        ${checkout ? `<a class="botdee-sv-action botdee-sv-action-main" href="${esc(checkout)}" rel="noopener">${esc(t("botdee.so.pay", "Pay securely"))}</a>` : ""}
        ${portal ? `<a class="botdee-sv-action" href="${esc(portal)}">${esc(t("botdee.so.portal", "Open in My ShoutOuts"))}</a>` : ""}
        ${compose && (view.mediaDecision === "compose" || needs.includes("compose")) ? `<a class="botdee-sv-action" href="${esc(compose)}">${esc(t("botdee.so.compose", "Open compose"))}</a>` : ""}
      </div>
      <div class="botdee-so-foot">
        <span>${esc(t("botdee.so.foot", "BOT DEE · ShoutOut SMARTpreview"))}</span>
        <span>${esc(t("botdee.so.footPending", "Pending until Club Admin approves"))}</span>
      </div>
    </article>`;
  }

  function bindShoutOutCard(card) {
    if (!card || card.dataset.soBound === "1") return;
    card.dataset.soBound = "1";
    const board = card.querySelector(".botdee-so-board");
    const iframe = card.querySelector(".botdee-so-led");
    const markLedReady = () => board?.classList.add("is-led-ready");
    iframe?.addEventListener("load", markLedReady);
    card.querySelectorAll("[data-so-prompt]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        const prompt = String(btn.getAttribute("data-so-prompt") || "").trim();
        if (!prompt) return;
        const templateId = SHOUT_TEMPLATE_PROMPTS[prompt] || "";
        const handle = prompt === "include my handle" ? "include" : (prompt === "no handle" ? "skip" : "");
        if (iframe && (templateId || handle)) {
          board?.classList.remove("is-led-ready");
          const next = patchShoutOutLedSrc(iframe.getAttribute("src") || "", {
            templateId,
            handle,
            attribution: iframe.getAttribute("data-so-attribution") || ""
          });
          if (next && next !== iframe.getAttribute("src")) iframe.setAttribute("src", next);
        }
        if (typeof global.FLOQRBotDeeChat?.sendMessage === "function") {
          global.FLOQRBotDeeChat.sendMessage(prompt);
          return;
        }
        const input = global.document?.getElementById("botDeeChatInput");
        const form = global.document?.getElementById("botDeeChatForm");
        if (input) {
          input.value = prompt;
          form?.dispatchEvent(new Event("submit", {bubbles: true, cancelable: true}));
        }
      });
    });
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
    const st = String(payload?.status || payload?.lifecycle || "created");
    if (st === "scheduled") return t("botdee.rs.statusScheduled", "Scheduled");
    if (st === "open" || st === "active") return payload?.status === "open"
      ? t("sv.liveInRoom", "Live in Room")
      : t("botdee.rs.statusActive", "Active");
    if (st === "closing") return t("botdee.rs.statusClosing", "Closing");
    if (st === "closed" || st === "ended" || st === "expired" || st === "cancelled") {
      return t("botdee.rs.statusClosed", "Closed");
    }
    if (payload?.mode === "setup" || payload?.mode === "offer") return t("botdee.rs.statusSetup", "Setup");
    return t("botdee.rs.statusCreated", "Created");
  }

  function formatScheduleLabel(ms, zone) {
    const start = Number(ms || 0);
    if (!start) return "";
    try {
      return new Date(start).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: zone || undefined
      });
    } catch (_) {
      return new Date(start).toLocaleString();
    }
  }

  function roomIsScheduledView(view) {
    return String(view?.status || "") === "scheduled" || (Number(view?.scheduledStartMs || 0) > 0 && String(view?.status || "") !== "open");
  }

  function datetimeLocalValue(ms) {
    const start = Number(ms || 0) || Date.now() + 60 * 60 * 1000;
    const d = new Date(start);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function askScheduleTime(currentMs) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "botdee-sv-schedule-overlay";
      overlay.innerHTML = `<div class="botdee-sv-schedule-sheet" role="dialog" aria-modal="true">
        <h2>${esc(t("botdee.rs.setSchedule", "Set a schedule"))}</h2>
        <p>${esc(t("botdee.rs.scheduleHint", "This is when the BOT DEE room starts — not Shared Itinerary."))}</p>
        <label>${esc(t("botdee.rs.scheduleWhen", "Start time"))}
          <input type="datetime-local" data-rs-schedule-input value="${esc(datetimeLocalValue(currentMs))}"/>
        </label>
        <div class="botdee-sv-schedule-actions">
          <button type="button" class="botdee-sv-room-btn" data-rs-schedule-cancel>${esc(t("botdee.rs.notNow", "Not now"))}</button>
          <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-schedule-save disabled>${esc(t("botdee.rs.scheduleSave", "Save schedule"))}</button>
        </div>
      </div>`;
      const input = overlay.querySelector("[data-rs-schedule-input]");
      const save = overlay.querySelector("[data-rs-schedule-save]");
      const close = value => {
        overlay.remove();
        resolve(value);
      };
      const sync = () => {
        const ms = input.value ? new Date(input.value).getTime() : 0;
        save.disabled = !(ms > Date.now() + 30 * 1000);
      };
      input.addEventListener("input", sync);
      sync();
      overlay.querySelector("[data-rs-schedule-cancel]").addEventListener("click", () => close(null));
      overlay.addEventListener("click", event => {
        if (event.target === overlay) close(null);
      });
      save.addEventListener("click", () => {
        const ms = new Date(input.value).getTime();
        if (!(ms > Date.now() + 30 * 1000)) return;
        close({
          scheduledStartMs: ms,
          scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        });
      });
      document.body.appendChild(overlay);
      input.focus();
    });
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

  function collabTallyText(tally) {
    return t("botdee.room.voteTally", "{yes} of {needed} yes ({members} joined)")
      .replace("{yes}", String(Number(tally?.yes || 0)))
      .replace("{needed}", String(Number(tally?.needed || 0)))
      .replace("{members}", String(Number(tally?.memberCount || 0)));
  }

  function renderCollabStrip(view) {
    const collab = view && view.collab && typeof view.collab === "object" ? view.collab : null;
    if (!collab) return `<div class="botdee-sv-room-collab" data-rs-collab hidden></div>`;
    const txn = collab.sharedTransaction;
    const ballot = collab.hostBallot;
    const label = txn
      ? (txn.snapshot?.sectionLabel || txn.snapshot?.sectionId || txn.snapshot?.templateName || txn.snapshot?.venueName || txn.kind || "")
      : "";
    const choiceLine = txn
      ? `<p class="botdee-sv-room-note">${esc(t("botdee.room.sharedChoice", "Host picked {label}").replace("{label}", label))}</p>
         <p class="botdee-sv-room-note">${esc(collab.canCommit ? t("botdee.room.choicePassed", "Group agreed — host can hold") : t("botdee.room.choiceWaiting", "Waiting for 60% yes"))} · ${esc(collabTallyText(collab.choiceTally))}</p>
         <div class="botdee-sv-room-controls">
           <button type="button" class="botdee-sv-room-btn" data-rs-vote="yes">${esc(t("botdee.room.voteYes", "Yes"))}</button>
           <button type="button" class="botdee-sv-room-btn" data-rs-vote="no">${esc(t("botdee.room.voteNo", "No"))}</button>
         </div>`
      : "";
    const hostLine = collab.hostVacant
      ? `<p class="botdee-sv-room-note">${esc(t("botdee.room.hostVacant", "No host — vote 60% to elect"))}</p>`
      : "";
    const guestHint = view.guestMode
      ? `<p class="botdee-sv-room-note">${esc(t("botdee.room.guestVoteHint", "Vote the host's pick. Hold it stays with the host."))}</p>`
      : "";
    const elect = `<div class="botdee-sv-room-controls">
        <button type="button" class="botdee-sv-room-btn" data-rs-nominate-self>${esc(t("botdee.room.nominateSelf", "Make me host"))}</button>
        ${ballot ? `<button type="button" class="botdee-sv-room-btn" data-rs-host-vote="yes">${esc(t("botdee.room.voteYes", "Yes"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-host-vote="no">${esc(t("botdee.room.voteNo", "No"))}</button>` : ""}
      </div>
      ${ballot ? `<p class="botdee-sv-room-note">${esc(collabTallyText(collab.hostTally))}</p>` : ""}`;
    return `<div class="botdee-sv-room-collab" data-rs-collab>
      <h3>${esc(t("botdee.room.collabTitle", "Shared picks"))}</h3>
      ${guestHint}${hostLine}${choiceLine}${elect}
    </div>`;
  }

  function applyCollabToCard(card, collab, roomId, binders) {
    if (!card || !collab) return;
    if (card.getAttribute("data-kind") === "botDeeVip" || card.classList.contains("botdee-sv-vip")) {
      applyCollabToVipCard(card, collab, roomId);
      return;
    }
    const host = card.querySelector("[data-rs-collab]");
    const html = renderCollabStrip({collab, guestMode: !collab.viewerIsHost});
    if (host) host.outerHTML = html;
    else card.querySelector(".botdee-sv-room-stats")?.insertAdjacentHTML("afterend", html);
    bindCollabActions(card, binders);
  }

  function bindCollabActions(card, {call, showToast, roomIdOf}) {
    const run = async (name, payload) => {
      const roomId = roomIdOf();
      if (!roomId) return;
      try {
        const data = await call(name, {roomId, ...payload});
        if (data?.collab) applyCollabToCard(card, data.collab, roomId, {call, showToast, roomIdOf});
        if (data?.elected) showToast(t("botdee.room.hostElected", "New host elected"));
      } catch (error) {
        showToast(error?.message || t("botdee.room.collabFailed", "Could not record that vote"));
      }
    };
    card.querySelectorAll("[data-rs-vote]").forEach(btn => {
      if (btn.dataset.rsBoundVote === "1") return;
      btn.dataset.rsBoundVote = "1";
      btn.addEventListener("click", event => {
        event.preventDefault();
        run("voteBotDeeRoomTransaction", {ballot: btn.getAttribute("data-rs-vote")});
      });
    });
    card.querySelectorAll("[data-rs-host-vote]").forEach(btn => {
      if (btn.dataset.rsBoundVote === "1") return;
      btn.dataset.rsBoundVote = "1";
      btn.addEventListener("click", event => {
        event.preventDefault();
        run("voteBotDeeRoomHost", {ballot: btn.getAttribute("data-rs-host-vote")});
      });
    });
    card.querySelectorAll("[data-rs-nominate-self]").forEach(btn => {
      if (btn.dataset.rsBoundVote === "1") return;
      btn.dataset.rsBoundVote = "1";
      btn.addEventListener("click", event => {
        event.preventDefault();
        run("nominateBotDeeRoomHost", {});
      });
    });
  }

  function renderRoomCard(payload) {
    const view = payload && typeof payload === "object" ? payload : {};
    const count = Number(view.participantCount) || 0;
    const cap = Number(view.participantCap) || 8;
    const status = roomStatusCopy(view);
    const confirmable = view.needsConfirmation && view.mode !== "command" && view.mode !== "deny" && view.mode !== "confirm";
    const share = view.mode === "share_preview";
    const denied = view.injectionDenied === true || view.mode === "deny";
    const joinHref = resolveSameOriginHref(view.joinHref || "");
    const scheduled = roomIsScheduledView(view);
    const liveOpen = String(view.status || "") === "open" || (view.hasActiveRoom === true && !scheduled);
    const activeRoom = liveOpen || scheduled || view.hasActiveRoom === true || view.lifecycle === "active" || !!view.roomId;
    const viewerHost = view.viewerIsHost !== false;
    const guestPending = scheduled && view.viewerIsHost === false && !view.hasActiveRoom && !view.roomId;
    const scheduleLabel = view.scheduledLabel || formatScheduleLabel(view.scheduledStartMs, view.scheduledTimeZone);
    const visual = roomVisual(view);
    const visualHero = visual ? `<div class="sv-hero botdee-sv-visual" data-sv-reason="${esc(visual.reasonCode || "neutral-fallback")}" data-sv-bg="${esc(visual.backgroundId || "")}" data-sv-st="${esc(visual.stencilId || "")}">
        <img class="sv-bg" src="${esc(visual.backgroundUrl)}" alt="${esc(t("sv.scenicAlt", "Scenic illustration for this room. Not a photograph."))}"/>
        ${placeTagHtml(visual.tags)}
      </div>` : "";
    return `<article class="botdee-sv-room" data-kind="botDeeRoom" data-rs-mode="${esc(view.mode || "")}" data-rs-decline="${esc(view.declineKey || "")}" data-rs-active="${activeRoom ? "1" : "0"}" data-rs-room="${esc(view.roomId || "")}" data-rs-status="${esc(view.status || "")}" data-rs-host="${viewerHost ? "1" : "0"}" data-rs-title="${esc(view.authorizedTitle || "")}" data-rs-desc="${esc(view.authorizedDescription || "")}">
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
        <div class="botdee-sv-room-stat"><span>${esc(t("botdee.rs.participants", "Participants"))}</span><b>${esc(String((Array.isArray(view.members) && view.members.length) || count))} / ${esc(String(cap))}</b><small>${esc(t("botdee.rs.includingHost", "including host"))}</small></div>
        <div class="botdee-sv-room-stat"><span>${esc(t("botdee.rs.roomStatus", "Room status"))}</span><b data-rs-status-b>${esc(status)}</b><small>${esc(scheduled ? (scheduleLabel || t("sv.scheduled", "Scheduled")) : (liveOpen || view.roomId ? t("botdee.room.minglOnly", "Mingl friends only · host plus 7 guests") : t("botdee.rs.notLiveNote", "Group rooms are not live yet")))}</small></div>
      </div>
      ${Array.isArray(view.members) && view.members.length ? `<div class="botdee-sv-room-roster" data-rs-roster>${view.members.map(row => `<span class="botdee-sv-room-chip">${esc(row.displayName || row.handle || "Member")}</span>`).join("")}</div>` : (view.roomId ? `<div class="botdee-sv-room-roster" data-rs-roster></div>` : "")}
      ${view.roomId ? `<div class="botdee-sv-room-transcript" data-rs-transcript>${(Array.isArray(view.turns) ? view.turns : []).map(row => {
        const who = row && (row.role === "model" || row.system) ? "BOT DEE" : (row && (row.displayName || row.handle)) || "Member";
        return `<div class="botdee-sv-room-turn" data-role="${esc(row && row.role || "")}"><b>${esc(who)}</b><span>${esc(row && row.text || "")}</span></div>`;
      }).join("")}</div>` : ""}
      ${activeRoom ? renderCollabStrip(view) : ""}
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
        <button type="button" class="botdee-sv-room-btn" data-rs-panel="invite"${view.roomId ? "" : " disabled"}>${esc(t("botdee.rs.invite", "Invite"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-panel="members">${esc(t("botdee.rs.members", "Members"))}</button>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-danger" data-rs-end${view.roomId ? "" : " disabled"}>${esc(t("botdee.rs.endRoom", "End Room"))}</button>
      </div>
      ${joinHref && liveOpen ? `<p class="botdee-sv-room-note"><a class="botdee-sv-action" href="${esc(joinHref)}">${esc(t("botdee.rs.joinLink", "Join this Room SMARTview"))}</a></p>` : ""}
      ${scheduled && scheduleLabel ? `<p class="botdee-sv-room-note" data-rs-schedule-label>📅 ${esc(scheduleLabel)}</p>` : ""}
      ${share && confirmable ? `<div class="botdee-sv-room-confirm" data-rs-confirm-row>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-confirm>${esc(t("botdee.rs.shareApprove", "Approve selected facts"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-decline>${esc(t("botdee.rs.notNow", "Not now"))}</button>
      </div>` : ""}
      ${!share && confirmable && !view.roomId ? `<div class="botdee-sv-room-confirm botdee-sv-room-joinrow" data-rs-confirm-row>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-join-now data-rs-confirm>${esc(t("botdee.rs.joinNow", "Join Now"))}</button>
        <span class="botdee-sv-room-or">${esc(t("sv.or", "or"))}</span>
        <button type="button" class="botdee-sv-room-btn" data-rs-set-schedule>${esc(t("botdee.rs.setSchedule", "Set a schedule"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-decline>${esc(t("botdee.rs.notNow", "Not now"))}</button>
      </div>` : ""}
      ${scheduled && viewerHost && view.roomId ? `<div class="botdee-sv-room-confirm botdee-sv-room-joinrow" data-rs-confirm-row>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-join-now>${esc(t("botdee.rs.joinNow", "Join Now"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-change-schedule>${esc(t("botdee.rs.changeSchedule", "Change schedule"))}</button>
      </div>` : ""}
      ${guestPending ? `<div class="botdee-sv-room-confirm" data-rs-confirm-row>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-rsvp-accept>${esc(t("botdee.rs.rsvpAccept", "Accepted"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-decline>${esc(t("botdee.rs.notNow", "Not now"))}</button>
      </div>` : ""}
      ${denied ? "" : (window.FLOQRSmartVisuals?.renderAdSlot
        ? window.FLOQRSmartVisuals.renderAdSlot({
          title: view.authorizedTitle,
          description: view.authorizedDescription,
          sourceKind: "authorized-room"
        }, visual)
        : "")}
      <p class="botdee-sv-room-toast" data-rs-toast hidden></p>
      <div class="botdee-sv-room-foot">
        <span>${esc(t("botdee.rs.foot", "BOT DEE · Room SMARTview"))}</span>
        <span>${esc(t("botdee.rs.neverCharge", "No charge without a later personal OK"))}</span>
      </div>
    </article>`;
  }

  function roomPanelCopy(name) {
    if (name === "itinerary") {
      return `<p>${esc(t("botdee.rs.itineraryEmpty", "No shared plans yet"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.itineraryNotCalendar", "Shared Itinerary is night-out notes, not a calendar. Set a schedule is when the BOT DEE room starts."))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.privacyNote", "Private BOT DEE messages, other members’ profiles, and SMARTsummary are not included."))}</p>`;
    }
    if (name === "tab") {
      return `<p>${esc(t("botdee.rs.tabConsent", "Consent required before any charge"))}</p>
        <p class="botdee-sv-room-note">${esc(t("botdee.room.tabHelp", "Opt in first. Add a line. Close as one payer or split. Receipts stay on the paying uid. Club POS is later."))}</p>
        <button type="button" class="botdee-sv-room-btn botdee-sv-room-main" data-rs-tab-optin>${esc(t("botdee.room.optInTab", "Opt in to shared tab"))}</button>
        <label class="botdee-sv-room-note">${esc(t("botdee.room.lineItem", "Item"))}<input data-rs-tab-item maxlength="80" /></label>
        <label class="botdee-sv-room-note">${esc(t("botdee.room.lineAmount", "Amount (USD)"))}<input data-rs-tab-amount inputmode="decimal" /></label>
        <button type="button" class="botdee-sv-room-btn" data-rs-tab-add>${esc(t("botdee.room.addLine", "Add line"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-tab-close-one>${esc(t("botdee.room.payWholeTab", "I'll pay the tab"))}</button>
        <button type="button" class="botdee-sv-room-btn" data-rs-tab-close-split>${esc(t("botdee.room.payMyLines", "Pay my lines"))}</button>`;
    }
    if (name === "permissions") {
      return `<p>${esc(t("botdee.rs.hostManaged", "Host managed"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.room.minglOnly", "Mingl friends only · host plus 7 guests"))}</p><p class="botdee-sv-room-note">${esc(t("botdee.rs.permissionsNotSchedule", "Room Permissions is host invite rules. The room stays open until the host taps End Room, about four hours after it opens, or everyone has been gone about 15 minutes. Pausing private BOT DEE chat is separate."))}</p>`;
    }
    if (name === "members") {
      return `<p>${esc(t("botdee.room.membersLive", "Members of this BOT DEE session. Display names only — no emails."))}</p><div data-rs-members-list></div>`;
    }
    if (name === "invite") {
      return `<p>${esc(t("botdee.room.commandInvite", "Invite Mingl friends into this BOT DEE session. Not a public link. Cap is host plus 7 guests."))}</p><div data-rs-friend-list>${esc(t("botdee.room.loadingFriends", "Loading Mingl friends…"))}</div>`;
    }
    return "";
  }

  function inviteErrorCopy(error) {
    const reason = error?.details?.reason || error?.details?.error || "";
    if (reason === "self") return t("botdee.room.self", "That's you — you're already in this BOT DEE session.");
    if (reason === "already_member") return t("botdee.room.alreadyMember", "That Mingl friend is already in this BOT DEE session.");
    if (reason === "invited" || reason === "used") return t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now.");
    if (reason === "full") return t("botdee.room.joinFull", "This BOT DEE session is full (host plus 7 guests).");
    if (reason === "not_friend") return t("botdee.room.notFriend", "BOT DEE session invites are Mingl friends only.");
    const msg = String(error?.message || "").trim();
    if (!msg || /^(INTERNAL|FAILED_PRECONDITION|PERMISSION_DENIED|NOT_FOUND|RESOURCE_EXHAUSTED)\b/i.test(msg)) {
      return t("botdee.room.inviteFailed", "Could not send that invite.");
    }
    return msg.replace(/^(INTERNAL|FAILED_PRECONDITION|PERMISSION_DENIED|NOT_FOUND|RESOURCE_EXHAUSTED):\s*/i, "").trim()
      || t("botdee.room.inviteFailed", "Could not send that invite.");
  }

  function invitedStorageKey(roomId) {
    return `floqr.botdeeInvited.${String(roomId || "").trim()}`;
  }

  function loadLocalInvited(roomId) {
    try {
      const rows = JSON.parse(global.sessionStorage?.getItem(invitedStorageKey(roomId)) || "[]");
      return Array.isArray(rows) ? rows.map(String).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function rememberLocalInvited(roomId, uid) {
    const id = String(uid || "").trim();
    if (!roomId || !id) return;
    const next = Array.from(new Set([...loadLocalInvited(roomId), id]));
    try { global.sessionStorage?.setItem(invitedStorageKey(roomId), JSON.stringify(next)); } catch (_) {}
  }

  function forgetLocalInvited(roomId, uid) {
    const id = String(uid || "").trim();
    const next = loadLocalInvited(roomId).filter(row => row !== id);
    try { global.sessionStorage?.setItem(invitedStorageKey(roomId), JSON.stringify(next)); } catch (_) {}
  }

  function inviteAlreadyAcked(error, result) {
    if (result && (result.alreadySent === true || result.ok === true)) return true;
    const reason = error?.details?.reason || error?.details?.error || "";
    return reason === "invited" || reason === "used" || reason === "already_member";
  }

  function chipDisplayName(btn) {
    return (btn?.getAttribute("data-rs-invite-name") || String(btn?.textContent || "").split("·")[0] || "").trim();
  }

  function markChipInvited(btn, sending) {
    if (!btn) return;
    const label = chipDisplayName(btn) || t("botdee.room.friend", "Mingl friend");
    btn.setAttribute("data-rs-invite-name", label);
    btn.classList.add("is-blocked");
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    btn.setAttribute("data-rs-invite-state", "invited");
    btn.textContent = sending
      ? `${label} · ${t("botdee.room.sendingInvite", "Sending…")}`
      : `${label} · ${t("botdee.room.chipInvited", "Invite sent")}`;
  }

  function restoreChipInvite(btn) {
    if (!btn) return;
    const label = chipDisplayName(btn) || t("botdee.room.friend", "Mingl friend");
    btn.classList.remove("is-blocked");
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
    btn.setAttribute("data-rs-invite-state", "invite");
    btn.textContent = label;
  }

  function showInviteAck(host, message, kind) {
    if (!host) return;
    let ack = host.querySelector("[data-rs-invite-ack]");
    if (!ack) {
      ack = document.createElement("p");
      ack.className = "botdee-sv-room-ack";
      ack.setAttribute("data-rs-invite-ack", "1");
      host.prepend(ack);
    }
    ack.dataset.kind = kind || "ok";
    ack.textContent = message;
    if (typeof ack.scrollIntoView === "function") {
      ack.scrollIntoView({block: "nearest", behavior: "smooth"});
    }
  }

  function friendChipHtml(row, roomFull) {
    const label = row.displayName || row.handle || t("botdee.room.friend", "Mingl friend");
    const state = row.inviteState || "invite";
    const uid = row.uid || "";
    if (state === "self") {
      return `<button type="button" class="botdee-sv-room-btn is-blocked" data-rs-invite-state="self" aria-disabled="true">${esc(label)} · ${esc(t("botdee.room.chipSelf", "That's you"))}</button>`;
    }
    if (state === "already_member") {
      return `<button type="button" class="botdee-sv-room-btn is-blocked" data-rs-invite-state="already_member" aria-disabled="true">${esc(label)} · ${esc(t("botdee.room.chipMember", "Already in this session"))}</button>`;
    }
    if (state === "invited") {
      return `<button type="button" class="botdee-sv-room-btn is-blocked" data-rs-invite-uid="${esc(uid)}" data-rs-invite-name="${esc(label)}" data-rs-invite-state="invited" disabled aria-disabled="true">${esc(label)} · ${esc(t("botdee.room.chipInvited", "Invite sent"))}</button>`;
    }
    if (roomFull) {
      return `<button type="button" class="botdee-sv-room-btn is-blocked" data-rs-invite-state="full" aria-disabled="true">${esc(label)}</button>`;
    }
    return `<button type="button" class="botdee-sv-room-btn" data-rs-invite-uid="${esc(uid)}" data-rs-invite-name="${esc(label)}" data-rs-invite-state="invite">${esc(label)}</button>`;
  }

  let presenceTimer = 0;
  let presenceRoomId = "";
  let presenceBound = false;

  function functionsForPresence() {
    try {
      return global.firebase?.functions?.() || null;
    } catch (_) {
      return null;
    }
  }

  function stopRoomPresence() {
    if (presenceTimer) {
      clearInterval(presenceTimer);
      presenceTimer = 0;
    }
    presenceRoomId = "";
  }

  function touchPresence(roomId, keepalive) {
    const id = String(roomId || presenceRoomId || "").trim();
    if (!id) return;
    try {
      const fns = functionsForPresence();
      const call = fns?.httpsCallable?.("touchBotDeeRoomPresence");
      if (!call) return;
      const payload = {roomId: id};
      if (keepalive && typeof navigator !== "undefined" && navigator.sendBeacon && false) {
        return;
      }
      call(payload).catch(() => {});
    } catch (_) {}
  }

  function roomConversationId() {
    return (global.FLOQRBotDeeChat && typeof global.FLOQRBotDeeChat.getConversationId === "function"
      ? global.FLOQRBotDeeChat.getConversationId()
      : "") || "";
  }

  function bindComposerToRoom(roomId, token, attach) {
    const id = String(roomId || "").trim();
    if (!id) return Promise.resolve();
    try { global.__floqrActiveBotDeeRoomId = id; } catch (_) {}
    if (attach && typeof global.FLOQRBotDeeChat?.attachRoomSession === "function") {
      return global.FLOQRBotDeeChat.attachRoomSession(id, token || "") || Promise.resolve();
    }
    if (typeof global.FLOQRBotDeeChat?.startGroupSessionPoll === "function") {
      global.FLOQRBotDeeChat.startGroupSessionPoll(id);
    }
    return Promise.resolve();
  }

  function startRoomPresence(roomId) {
    const id = String(roomId || "").trim();
    if (!id) return;
    presenceRoomId = id;
    if (presenceTimer) clearInterval(presenceTimer);
    touchPresence(id);
    presenceTimer = setInterval(() => touchPresence(id), 30 * 1000);
    if (!presenceBound && global.document) {
      presenceBound = true;
      const onHide = () => {
        if (!presenceRoomId) return;
        touchPresence(presenceRoomId, true);
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") onHide();
        else if (presenceRoomId) touchPresence(presenceRoomId);
      });
      window.addEventListener("pagehide", onHide);
    }
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
    const roomIdOf = () => card.getAttribute("data-rs-room") || "";
    const call = async (name, payload) => {
      const fn = functionsCallable(name);
      if (!fn) throw new Error("offline");
      return (await fn(payload))?.data || {};
    };
    const panel = card.querySelector("[data-rs-panel-body]");
    const fillFriends = async () => {
      const host = panel?.querySelector("[data-rs-friend-list]");
      if (!host) return;
      try {
        const data = await call("listBotDeeRoomFriends", {roomId: roomIdOf()});
        const friends = Array.isArray(data.friends) ? data.friends : [];
        if (!friends.length) {
          host.textContent = t("botdee.room.noFriends", "No Mingl friends to invite yet.");
          return;
        }
        if (data.roomFull) {
          showToast(t("botdee.room.joinFull", "This BOT DEE session is full (host plus 7 guests)."));
        }
        const pending = new Set([
          ...(Array.isArray(data.pendingUids) ? data.pendingUids : []),
          ...loadLocalInvited(roomIdOf())
        ].map(String));
        friends.forEach(row => {
          if (pending.has(String(row.uid || "")) && row.inviteState === "invite") {
            row.inviteState = "invited";
          }
        });
        const invitedAck = friends.some(row => row.inviteState === "invited")
          ? `<p class="botdee-sv-room-ack" data-rs-invite-ack="1">${esc(t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now."))}</p>`
          : "";
        host.innerHTML = invitedAck + friends.map(row => friendChipHtml(row, !!data.roomFull)).join("");
        host.querySelectorAll("[data-rs-invite-state], [data-rs-invite-uid]").forEach(btn => {
          btn.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();
            const roomId = roomIdOf();
            const uid = btn.getAttribute("data-rs-invite-uid") || "";
            const state = btn.getAttribute("data-rs-invite-state") || "invite";
            if (state === "self") {
              showInviteAck(host, t("botdee.room.self", "That's you — you're already in this BOT DEE session."), "ok");
              showToast(t("botdee.room.self", "That's you — you're already in this BOT DEE session."));
              return;
            }
            if (state === "already_member") {
              showInviteAck(host, t("botdee.room.alreadyMember", "That Mingl friend is already in this BOT DEE session."), "ok");
              showToast(t("botdee.room.alreadyMember", "That Mingl friend is already in this BOT DEE session."));
              return;
            }
            if (state === "invited") {
              const ack = t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now.");
              showInviteAck(host, ack, "ok");
              showToast(ack);
              return;
            }
            if (state === "full") {
              showInviteAck(host, t("botdee.room.joinFull", "This BOT DEE session is full (host plus 7 guests)."), "error");
              showToast(t("botdee.room.joinFull", "This BOT DEE session is full (host plus 7 guests)."));
              return;
            }
            if (!roomId) {
              showInviteAck(host, t("botdee.room.confirmFirst", "Confirm the session first, then invite Mingl friends."), "error");
              showToast(t("botdee.room.confirmFirst", "Confirm the session first, then invite Mingl friends."));
              return;
            }
            if (!uid) {
              showInviteAck(host, t("botdee.room.inviteFailed", "Could not send that invite."), "error");
              showToast(t("botdee.room.inviteFailed", "Could not send that invite."));
              return;
            }
            rememberLocalInvited(roomId, uid);
            markChipInvited(btn, true);
            showInviteAck(host, t("botdee.room.sendingInvite", "Sending…"), "ok");
            try {
              const sent = await call("createBotDeeRoomInvite", {roomId, targetUid: uid});
              markChipInvited(btn, false);
              const ack = t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now.");
              showInviteAck(host, ack, "ok");
              showToast(ack);
              bindComposerToRoom(roomId);
              if (sent && sent.alreadySent) {
                showInviteAck(host, ack, "ok");
              }
            } catch (error) {
              if (inviteAlreadyAcked(error)) {
                markChipInvited(btn, false);
                const ack = t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now.");
                showInviteAck(host, ack, "ok");
                showToast(ack);
                bindComposerToRoom(roomId);
                return;
              }
              forgetLocalInvited(roomId, uid);
              restoreChipInvite(btn);
              const copy = inviteErrorCopy(error);
              showInviteAck(host, copy, "error");
              showToast(copy);
            }
          });
        });
      } catch (error) {
        host.textContent = inviteErrorCopy(error);
      }
    };
    const fillMembers = async () => {
      const host = panel?.querySelector("[data-rs-members-list]");
      const roomId = roomIdOf();
      if (!host || !roomId) return;
      try {
        const data = await call("getBotDeeRoom", {roomId});
        const members = Array.isArray(data.members) ? data.members : [];
        const hostUid = data.room?.hostUid || "";
        const viewerIsHost = data.viewerIsHost === true;
        host.innerHTML = members.map(row => {
          const role = row.uid === hostUid ? t("botdee.room.host", "host") : t("botdee.room.guest", "guest");
          const kick = viewerIsHost && row.uid && row.uid !== hostUid
            ? ` <button type="button" class="botdee-sv-room-btn botdee-sv-room-danger" data-rs-kick-uid="${esc(row.uid)}">${esc(t("botdee.room.removeGuest", "Remove"))}</button>`
            : "";
          const nominate = row.uid
            ? ` <button type="button" class="botdee-sv-room-btn" data-rs-nominate-uid="${esc(row.uid)}">${esc(t("botdee.room.nominateHost", "Nominate host"))}</button>`
            : "";
          return `<div>${esc(row.displayName || row.handle || row.uid)} · ${esc(role)}${kick}${nominate}</div>`;
        }).join("");
        host.querySelectorAll("[data-rs-kick-uid]").forEach(btn => {
          btn.addEventListener("click", async event => {
            event.preventDefault();
            try {
              await call("kickBotDeeRoomMember", {roomId, targetUid: btn.getAttribute("data-rs-kick-uid")});
              showToast(t("botdee.room.kicked", "Guest removed from this session."));
              fillMembers();
            } catch (error) {
              showToast(error?.message || t("botdee.room.kickFailed", "Could not remove that guest."));
            }
          });
        });
        host.querySelectorAll("[data-rs-nominate-uid]").forEach(btn => {
          btn.addEventListener("click", async event => {
            event.preventDefault();
            try {
              const data = await call("nominateBotDeeRoomHost", {roomId, candidateUid: btn.getAttribute("data-rs-nominate-uid")});
              showToast(data?.elected
                ? t("botdee.room.hostElected", "New host elected")
                : t("botdee.room.youNominated", "Nomination opened. 60% of joined members elects the host."));
              fillMembers();
            } catch (error) {
              showToast(error?.message || t("botdee.room.collabFailed", "Could not record that vote"));
            }
          });
        });
      } catch (_) {
        host.textContent = t("botdee.room.membersLive", "Members of this BOT DEE session. Display names only — no emails.");
      }
    };
    const bindTabActions = () => {
      panel?.querySelector("[data-rs-tab-optin]")?.addEventListener("click", async event => {
        event.preventDefault();
        try {
          await call("optInBotDeeRoomTab", {roomId: roomIdOf()});
          showToast(t("botdee.room.tabOptedIn", "You opted in. Lines can attach to you now. Still no charge until you pay."));
        } catch (error) {
          showToast(error?.message || t("botdee.room.tabFailed", "Could not update the shared tab."));
        }
      });
      panel?.querySelector("[data-rs-tab-add]")?.addEventListener("click", async event => {
        event.preventDefault();
        const item = panel.querySelector("[data-rs-tab-item]")?.value || "Tab item";
        const dollars = Number(panel.querySelector("[data-rs-tab-amount]")?.value || 0);
        try {
          await call("addBotDeeRoomTabLine", {roomId: roomIdOf(), item, amountCents: Math.round(dollars * 100)});
          showToast(t("botdee.room.lineAdded", "Line added as proposed. Accept it before checkout."));
        } catch (error) {
          showToast(error?.message || t("botdee.room.tabFailed", "Could not update the shared tab."));
        }
      });
      const closeTab = async mode => {
        try {
          const plan = await call("closeBotDeeRoomTab", {roomId: roomIdOf(), mode});
          const checkout = functionsCallable("createFloqrCheckoutSession");
          if (!checkout) throw new Error("offline");
          const paid = await checkout({
            orderType: "botDeeRoomTab",
            payload: plan.payload || plan
          });
          const url = paid?.data?.url || paid?.data?.checkoutUrl;
          if (url) location.href = url;
          else showToast(t("botdee.room.checkoutReady", "Checkout is ready on your account only."));
        } catch (error) {
          showToast(error?.message || t("botdee.room.tabFailed", "Could not update the shared tab."));
        }
      };
      panel?.querySelector("[data-rs-tab-close-one]")?.addEventListener("click", event => {
        event.preventDefault();
        closeTab("one_payer");
      });
      panel?.querySelector("[data-rs-tab-close-split]")?.addEventListener("click", event => {
        event.preventDefault();
        closeTab("split");
      });
    };
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
        if (!open && name === "invite") fillFriends();
        if (!open && name === "members") fillMembers();
        if (!open && name === "tab") bindTabActions();
      });
    });
    const stampRoom = room => {
      if (!room || !room.roomId) return;
      card.setAttribute("data-rs-room", room.roomId);
      card.setAttribute("data-rs-status", room.status || "");
      card.setAttribute("data-rs-active", "1");
      try { global.__floqrActiveBotDeeRoomId = room.roomId; } catch (_) {}
      const inviteBtn = card.querySelector("[data-rs-panel='invite']");
      const endBtn = card.querySelector("[data-rs-end]");
      if (inviteBtn) inviteBtn.disabled = false;
      if (endBtn) endBtn.disabled = false;
    };
    const joinNow = async () => {
      try {
        const data = await call("startBotDeeRoom", {
          roomId: roomIdOf(),
          conversationId: roomConversationId(),
          title: card.getAttribute("data-rs-title") || "BOT DEE group session",
          authorizedTitle: card.getAttribute("data-rs-title") || "",
          authorizedDescription: card.getAttribute("data-rs-desc") || ""
        });
        stampRoom(data.room);
        startRoomPresence(data.room?.roomId);
        await bindComposerToRoom(data.room?.roomId, "", true);
        card.querySelector("[data-rs-confirm-row]")?.setAttribute("hidden", "");
        showToast(t("botdee.room.confirmedLive", "BOT DEE session is open. Invite Mingl friends, then type in this BOT DEE room. Joining does not charge anyone."));
      } catch (error) {
        showToast(error?.message || t("botdee.rs.joinFailed", "That BOT DEE invite isn't available. Ask your Mingl friend to send a new one."));
      }
    };
    const saveSchedule = async currentMs => {
      const picked = await askScheduleTime(currentMs);
      if (!picked) return;
      try {
        const roomId = roomIdOf();
        const name = roomId ? "rescheduleBotDeeRoom" : "scheduleBotDeeRoom";
        const data = await call(name, {
          roomId,
          conversationId: roomConversationId(),
          title: card.getAttribute("data-rs-title") || "BOT DEE group session",
          authorizedTitle: card.getAttribute("data-rs-title") || "",
          authorizedDescription: card.getAttribute("data-rs-desc") || "",
          scheduledStartMs: picked.scheduledStartMs,
          scheduledTimeZone: picked.scheduledTimeZone
        });
        stampRoom(data.room);
        await bindComposerToRoom(data.room?.roomId, "", true);
        const label = formatScheduleLabel(data.room?.scheduledStartMs, data.room?.scheduledTimeZone);
        let note = card.querySelector("[data-rs-schedule-label]");
        if (!note) {
          note = document.createElement("p");
          note.className = "botdee-sv-room-note";
          note.setAttribute("data-rs-schedule-label", "");
          card.querySelector("[data-rs-confirm-row]")?.before(note);
        }
        note.textContent = `📅 ${label}`;
        showToast(t("botdee.rs.scheduleSaved", "Scheduled. Search SMARTnotification is on for you and invited Mingl friends."));
        card.querySelector("[data-rs-set-schedule]")?.setAttribute("hidden", "");
      } catch (error) {
        showToast(error?.message || t("botdee.rs.schedulePast", "Pick a future time for the BOT DEE room."));
      }
    };
    card.querySelector("[data-rs-confirm]")?.addEventListener("click", event => {
      event.preventDefault();
      const share = card.getAttribute("data-rs-mode") === "share_preview";
      if (share) {
        showToast(t("botdee.rs.shareNotPublished", "Nothing was published. Selected facts stay in this preview. Shared tab charges stay off."));
        card.querySelector("[data-rs-confirm-row]")?.setAttribute("hidden", "");
        return;
      }
      if (card.querySelector("[data-rs-join-now]") && event.currentTarget.hasAttribute("data-rs-join-now")) {
        joinNow();
        return;
      }
      if (event.currentTarget.hasAttribute("data-rs-join-now")) joinNow();
    });
    const joinBtn = card.querySelector("[data-rs-join-now]");
    if (joinBtn && !joinBtn.hasAttribute("data-rs-confirm")) {
      joinBtn.addEventListener("click", event => {
        event.preventDefault();
        joinNow();
      });
    }
    card.querySelector("[data-rs-set-schedule]")?.addEventListener("click", event => {
      event.preventDefault();
      saveSchedule();
    });
    card.querySelector("[data-rs-change-schedule]")?.addEventListener("click", event => {
      event.preventDefault();
      saveSchedule();
    });
    card.querySelector("[data-rs-rsvp-accept]")?.addEventListener("click", async event => {
      event.preventDefault();
      try {
        await call("rsvpBotDeeRoomInvite", {roomId: roomIdOf(), rsvp: "accepted"});
        await bindComposerToRoom(roomIdOf(), "", true);
        showToast(t("botdee.rs.rsvpPending", "You're in. Join Now is available when the room is live."));
      } catch (error) {
        showToast(error?.message || t("botdee.rs.joinFailed", "That BOT DEE invite isn't available. Ask your Mingl friend to send a new one."));
      }
    });
    card.querySelector("[data-rs-decline]")?.addEventListener("click", event => {
      event.preventDefault();
      rememberRoomDecline(card.getAttribute("data-rs-decline"));
      if (roomIdOf() && card.getAttribute("data-rs-host") !== "1") {
        call("rsvpBotDeeRoomInvite", {roomId: roomIdOf(), rsvp: "declined"}).catch(() => {});
      }
      showToast(t("botdee.rs.declined", "OK — I won’t keep offering Room SMARTview for this."));
      card.querySelector("[data-rs-confirm-row]")?.setAttribute("hidden", "");
    });
    card.querySelector("[data-rs-end]")?.addEventListener("click", async event => {
      event.preventDefault();
      const roomId = roomIdOf();
      if (!roomId) return;
      try {
        await call("endBotDeeRoom", {roomId});
        stopRoomPresence();
        showToast(t("botdee.rs.endedLive", "This Room SMARTview is closed. Private BOT DEE chat continues here."));
        if (global.FLOQRBotDeeChat?.sendMessage) global.FLOQRBotDeeChat.sendMessage("leave the room");
      } catch (error) {
        showToast(error?.message || t("botdee.rs.endNeedsHost", "Only the host can end this Room SMARTview. Say leave the room to leave without closing it."));
      }
    });
    if (roomIdOf()) {
      try { global.__floqrActiveBotDeeRoomId = roomIdOf(); } catch (_) {}
    }
    if (card.getAttribute("data-rs-status") === "open" && roomIdOf()) {
      startRoomPresence(roomIdOf());
      bindComposerToRoom(roomIdOf());
    }
    bindCollabActions(card, {call, showToast, roomIdOf});
    const hydrateCollab = async () => {
      const roomId = roomIdOf();
      if (!roomId) return;
      try {
        const data = await call("getBotDeeRoom", {roomId});
        if (data?.collab) applyCollabToCard(card, data.collab, roomId, {call, showToast, roomIdOf});
      } catch (_) {}
    };
    hydrateCollab();
    const db = global.firebase?.firestore?.();
    if (db && roomIdOf() && !card._rsCollabUnsub) {
      try {
        card._rsCollabUnsub = db.collection("botDeeRooms").doc(roomIdOf()).onSnapshot(() => { hydrateCollab(); });
      } catch (_) {}
    }
  }

  function isVipPayload(payload) {
    return !!(payload && typeof payload === "object" && payload.kind === "botDeeVip");
  }

  function vipChip(prompt, selected, label, extraClass) {
    const cls = extraClass ? ` ${extraClass}` : "";
    return `<button type="button" class="botdee-sv-tag botdee-vip-chip${selected ? " is-on" : ""}${cls}" data-vip-prompt="${esc(prompt)}">${esc(label || prompt)}</button>`;
  }

  function vipSeatClass(table) {
    const status = String(table?.status || "available");
    if (table?.selected) return " is-on";
    if (status === "booked") return " is-booked";
    if (status === "held") return " is-held";
    if (status === "closed") return " is-closed";
    return "";
  }

  const VIP_PLAN_BY_CLUB = Object.freeze({
    "temp-democlub-1": "aurelia.json",
    "decades-washington-dc": "decades.json",
    "lima-twist-washington-dc": "lima-twist.json",
    "shoko-barcelona-spain": "shoko-barcelona.json"
  });

  function vipPlanFileForClub(id) {
    const key = String(id || "").trim();
    if (VIP_PLAN_BY_CLUB[key]) return VIP_PLAN_BY_CLUB[key];
    if (/aurelia/i.test(key)) return "aurelia.json";
    return "";
  }

  function vipShortAreaName(name) {
    return String(name || "").replace(/^Area\s+[A-Z]\s*[·•-]\s*/i, "").trim();
  }

  function vipSectionRect(row) {
    if (!row) return null;
    if (row.rect && Number.isFinite(Number(row.rect.w))) {
      return {
        x: Number(row.rect.x) || 0,
        y: Number(row.rect.y) || 0,
        w: Number(row.rect.w) || 0,
        h: Number(row.rect.h) || 0
      };
    }
    const box = Array.isArray(row.pixelBox) ? row.pixelBox : null;
    if (box && box.length === 4) {
      const w = Number(box[2]) - Number(box[0]) + 1;
      const h = Number(box[3]) - Number(box[1]) + 1;
      const imgW = Number(row._w) || 1;
      const imgH = Number(row._h) || 1;
      return {x: Number(box[0]) / imgW, y: Number(box[1]) / imgH, w: w / imgW, h: h / imgH};
    }
    const c = row.circle;
    if (c && Number.isFinite(Number(c.cx))) {
      const rx = Number(c.rx || c.r) || 0;
      const ry = Number(c.ry || c.r) || rx;
      return {x: Number(c.cx) - rx, y: Number(c.cy) - ry, w: rx * 2, h: ry * 2};
    }
    return null;
  }

  function mapLiteFromPlan(plan, view, opts = {}) {
    if (!plan || typeof plan !== "object") return null;
    const full = !!(opts && opts.full);
    const file = String(plan.image?.file || "").replace(/^\.\//, "");
    const areas = (Array.isArray(plan.areas) ? plan.areas : []).map(area => ({
      id: String(area.id || "").trim(),
      name: vipShortAreaName(area.name || area.defaultName || area.label),
      prompt: vipShortAreaName(area.name || area.defaultName || area.label),
      bounds: area.viewBox || area.bounds || area.rect || null
    })).filter(area => area.id && area.name);
    const sectionId = String(view?.sectionId || "").trim();
    const sectionQuery = String(view?.sectionQuery || "").trim().toLowerCase();
    let selected = null;
    if (!full) {
      if (sectionId) {
        selected = (plan.areas || []).find(area => (area.sectionIds || []).includes(sectionId)) || null;
      }
      if (!selected && sectionQuery) {
        selected = (plan.areas || []).find(area => {
          const hay = `${area.id} ${area.name} ${area.defaultName || ""} ${vipShortAreaName(area.name)}`.toLowerCase();
          return hay.includes(sectionQuery) || sectionQuery.includes(vipShortAreaName(area.name).toLowerCase());
        }) || null;
      }
    }
    const viewBox = selected
      ? (selected.viewBox || selected.bounds || selected.rect || {x: 0, y: 0, w: 1, h: 1})
      : {x: 0, y: 0, w: 1, h: 1};
    const ids = new Set(selected?.sectionIds || []);
    const tables = (Array.isArray(plan.sections) ? plan.sections : [])
      .filter(row => row && row.bookable !== false && (full || !selected || ids.has(row.id)))
      .map(row => {
        const rect = vipSectionRect(row);
        if (!rect || rect.w <= 0 || rect.h <= 0) return null;
        return {
          id: String(row.id || "").trim(),
          label: String(row.label || row.id || "").trim(),
          prompt: String(row.label || row.id || "").trim(),
          selected: row.id === sectionId,
          maxCapacity: Math.max(0, Math.floor(Number(row.maxCapacity) || 0)),
          status: "available",
          rect
        };
      })
      .filter(Boolean);
    return {
      planFile: String(opts.planFile || "").trim(),
      imageUrl: file ? `./${file}` : "",
      selectedAreaId: String(selected?.id || "").trim(),
      selectedAreaName: selected ? vipShortAreaName(selected.name || selected.defaultName) : "",
      viewBox,
      areas,
      tables: (full || selected) ? tables : []
    };
  }

  function hydrateVipMap(view) {
    const live = view && typeof view === "object" ? view : {};
    if (live.map && live.map.imageUrl) return Promise.resolve(live);
    const planFile = vipPlanFileForClub(live.clubLocationId || live.venueName);
    if (!planFile) return Promise.resolve(live);
    return fetch(`./vip-plans/${planFile}`, {cache: "no-store"})
      .then(res => res.ok ? res.json() : null)
      .then(plan => {
        if (!plan) return live;
        const map = mapLiteFromPlan(plan, live, {planFile});
        const mapFull = mapLiteFromPlan(plan, live, {full: true, planFile});
        if (!map || !map.imageUrl) return live;
        return {...live, map, mapFull: mapFull || map, planFile};
      })
      .catch(() => live);
  }

  function vipMapHtml(map, {interactive} = {interactive: true}) {
    if (!map || typeof map !== "object" || !map.imageUrl) return "";
    const vb = map.viewBox && typeof map.viewBox === "object" ? map.viewBox : {x: 0, y: 0, w: 1, h: 1};
    const vw = Math.max(0.08, Number(vb.w) || 1);
    const vh = Math.max(0.08, Number(vb.h) || 1);
    const sizeX = (1 / vw) * 100;
    const sizeY = (1 / vh) * 100;
    const posX = -(Number(vb.x) || 0) / vw * 100;
    const posY = -(Number(vb.y) || 0) / vh * 100;
    const tables = (Array.isArray(map.tables) ? map.tables : []).map(table => {
      const r = table.rect || {};
      const left = (Number(r.x) || 0) * 100;
      const top = (Number(r.y) || 0) * 100;
      const tw = (Number(r.w) || 0) * 100;
      const th = (Number(r.h) || 0) * 100;
      const status = String(table.status || "available");
      const locked = status === "booked" || status === "closed";
      const promptAttr = interactive && !locked
        ? ` data-vip-prompt="${esc(table.prompt || table.label)}"`
        : "";
      const disabled = locked ? " disabled" : "";
      return `<button type="button" class="botdee-vip-seat${vipSeatClass(table)}" style="left:${left}%;top:${top}%;width:${tw}%;height:${th}%"${promptAttr}${disabled} title="${esc(status)}">${esc(table.label)}</button>`;
    }).join("");
    return `<div class="botdee-vip-map" role="group" aria-label="${esc(t("botdee.vip.openMap", "Open VIP reserV map"))}"><div class="botdee-vip-map-stage" style="width:${sizeX}%;height:${sizeY}%;left:${posX}%;top:${posY}%;background-image:url('${esc(map.imageUrl)}')">${tables}</div></div>`;
  }

  const VIP_POPOUT_NAME = "botdeeVipPopout";
  let vipPopoutWin = null;

  function vipPopoutFeatures() {
    const availW = window.screen?.availWidth || window.innerWidth || 980;
    const availH = window.screen?.availHeight || window.innerHeight || 860;
    const w = Math.min(980, Math.max(420, Math.round(availW * 0.72)));
    const h = Math.min(860, Math.max(480, Math.round(availH * 0.82)));
    const left = Math.max(0, Math.round((availW - w) / 2));
    const top = Math.max(0, Math.round((availH - h) / 2));
    return `popup=yes,width=${w},height=${h},left=${left},top=${top}`;
  }

  function storeVipPopoutPayload(payload) {
    try { global.__floqrBotDeeVipPopout = payload; } catch (_) {}
    const raw = JSON.stringify(payload);
    try { sessionStorage.setItem("floqr.botdeeVipPopout", raw); } catch (_) {}
    try { localStorage.setItem("floqr.botdeeVipPopout", raw); } catch (_) {}
  }

  function openVipPopout(kind, view, sourceEl) {
    const payload = {
      kind: String(kind || "map"),
      view: view && typeof view === "object" ? view : {},
      labels: {
        close: t("botdee.photoClose", "Close"),
        map: t("botdee.vip.openMap", "Open VIP reserV map"),
        terms: t("botdee.vip.termsTitle", "VIP reserV Terms"),
        pass: t("botdee.vip.passTitle", "Your VIP reserV pass"),
        pay: t("botdee.vip.pay", "Pay securely"),
        stay: t("botdee.vip.checkoutStay", "Pay in the pop-out. This BOT DEE chat stays open.")
      }
    };
    if (kind === "pay") {
      const url = String(view?.checkoutUrl || "").trim();
      if (!url) return false;
      storeVipPopoutPayload({kind: "paid", view, labels: payload.labels});
      let win = null;
      try { win = window.open(url, VIP_POPOUT_NAME, vipPopoutFeatures()); } catch (_) { win = null; }
      if (!win) {
        global.FLOQRBotDeeChat?.setStatus?.(t("botdee.vip.payPopupBlocked", "Allow pop-up windows to pay. The chat stays behind."));
        return false;
      }
      vipPopoutWin = win;
      try { win.focus(); } catch (_) {}
      return true;
    }
    storeVipPopoutPayload(payload);
    let href = "./botdee-vip-popout.html";
    try {
      const url = new URL("botdee-vip-popout.html", location.href);
      if (kind) url.searchParams.set("kind", String(kind));
      const clubId = String(view?.clubLocationId || "").trim();
      const planFile = vipPlanFileForClub(clubId) || String(view?.planFile || view?.map?.planFile || "").trim();
      if (clubId) url.searchParams.set("location", clubId);
      if (planFile) url.searchParams.set("plan", planFile.replace(/^.*\//, ""));
      if (view?.night) url.searchParams.set("night", String(view.night));
      if (view?.map?.selectedAreaId) url.searchParams.set("area", String(view.map.selectedAreaId));
      if (view?.sectionId) url.searchParams.set("sel", String(view.sectionId));
      if (view?.guestMode) url.searchParams.set("guest", "1");
      href = url.href;
    } catch (_) {}
    let win = null;
    try { win = window.open(href, VIP_POPOUT_NAME, vipPopoutFeatures()); } catch (_) { win = null; }
    if (!win) {
      global.FLOQRBotDeeChat?.setStatus?.(t("botdee.photoPopoutBlocked", "Allow pop-up windows to enlarge the photo. The chat stays behind."));
      return false;
    }
    vipPopoutWin = win;
    try { win.focus(); } catch (_) {}
    return true;
  }

  function formatHoldClock(expiresAtMs) {
    const left = Math.max(0, Math.floor(((Number(expiresAtMs) || 0) - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(Math.floor(left % 60)).padStart(2, "0");
    return {text: `${mm}:${ss}`, left};
  }

  let vipHoldClock = 0;

  function stopHoldClock() {
    if (vipHoldClock) {
      clearInterval(vipHoldClock);
      vipHoldClock = 0;
    }
  }

  function startHoldClock(card, expiresAtMs) {
    stopHoldClock();
    const el = card.querySelector("[data-vip-clock]");
    if (!el || !expiresAtMs) return;
    const tick = () => {
      const live = vipPreviewHost()?.querySelector(".botdee-sv-vip") || card;
      if (!live || !live.isConnected) {
        stopHoldClock();
        return;
      }
      const {text: clock, left} = formatHoldClock(expiresAtMs);
      const clockEl = live.querySelector("[data-vip-clock]");
      if (clockEl) clockEl.textContent = t("botdee.vip.holdClock", "Hold {clock}").replace("{clock}", clock);
      if (left <= 0) {
        stopHoldClock();
        const mode = live.getAttribute("data-vip-mode") || "";
        const guest = live.getAttribute("data-guest-mode") === "1";
        if (!guest && (mode === "hold" || mode === "checkout") && global.FLOQRBotDeeChat?.sendMessage) {
          global.FLOQRBotDeeChat.sendMessage("cancel");
        }
      }
    };
    tick();
    vipHoldClock = setInterval(tick, 1000);
  }

  function renderVipCard(payload) {
    const view = payload && typeof payload === "object" ? payload : {};
    const mode = String(view.mode || "draft");
    const map = view.map && typeof view.map === "object" ? view.map : null;
    const nights = Array.isArray(view.nights) ? view.nights : [];
    const areas = Array.isArray(map?.areas) ? map.areas : [];
    const matches = Array.isArray(view.matches) ? view.matches : [];
    const venues = Array.isArray(view.venues) ? view.venues : [];
    const collapsed = !!view.collapsed && !!view.sectionId;
    const tableChips = (matches.length ? matches : (map?.tables || [])).slice(0, 8)
      .map(row => vipChip(row.label || row.prompt || row.id, row.id === view.sectionId || row.selected))
      .join("");
    const nightChips = nights.map(row => {
      const label = row.closed
        ? `${row.label || row.prompt} · ${t("botdee.vip.closedNight", "Closed")}`
        : row.label;
      return vipChip(row.prompt, !!row.selected, label, row.closed ? "is-closed" : "");
    }).join("");
    const areaChips = areas.map(row => vipChip(row.prompt, row.id === map.selectedAreaId, row.name)).join("");
    const venueChips = venues.map(row => vipChip(row.prompt || `at ${row.name}`, row.id === view.clubLocationId, row.name)).join("");
    const venue = String(view.venueName || "").replace(/temp-democlub-1/i, "Aurelia").trim();
    const cap = Math.max(0, Math.floor(Number(view.maxCapacity) || 0));
    const party = Math.max(1, Math.floor(Number(view.partySize) || 2));
    const maxParty = cap > 0 ? cap : 40;
    const payUrl = String(view.checkoutUrl || "").trim();
    const guest = view.guestMode === true;
    const needsVote = !guest && view.collab && Number(view.collab.choiceTally?.memberCount || 0) > 1 && view.collab.canCommit !== true;
    const cta = guest
      ? ""
      : (payUrl
        ? `<button type="button" class="botdee-sv-action botdee-sv-action-main" data-vip-popout="pay">${esc(t("botdee.vip.pay", "Pay securely"))}</button>`
        : (mode === "hold"
          ? `<button type="button" class="botdee-sv-action botdee-sv-action-main" data-vip-prompt="I agree">${esc(t("botdee.vip.agree", "I agree"))}</button>`
          : (mode === "pass"
            ? `<button type="button" class="botdee-sv-action botdee-sv-action-main" data-vip-popout="pass">${esc(t("botdee.vip.passTitle", "Your VIP reserV pass"))}</button>`
            : `<button type="button" class="botdee-sv-action botdee-sv-action-main" data-vip-prompt="hold it"${needsVote ? " disabled" : ""}>${esc(t("botdee.vip.holdIt", "Hold it"))}</button>`)));
    const voteNote = needsVote
      ? `<p class="botdee-vip-terms">${esc(t("botdee.room.holdNeedsVote", "Need 60% yes from joined members before Hold it"))}</p>`
      : "";
    const areaNav = map?.selectedAreaId
      ? `${vipChip("all areas", false, t("botdee.vip.allAreas", "All areas"))}${areaChips}`
      : areaChips;
    const holdClock = view.holdExpiresAtMs
      ? `<p class="botdee-vip-clock" data-vip-clock></p>`
      : "";
    const terms = mode === "hold"
      ? `<p class="botdee-vip-terms">${esc(t("botdee.vip.termsHint", "I agree records VIP Terms and opens Stripe in a pop-out. BOT DEE never takes card numbers."))}</p>`
      : "";
    const needsClub = (Array.isArray(view.needs) ? view.needs : []).includes("club") || !view.clubLocationId;
    const kicker = needsClub
      ? t("botdee.vip.venuesHint", "Tap a club, then a night and table.")
      : t("botdee.vip.mapHint", "Tap a night, then an area, then a table.");
    const collapseClass = collapsed ? " is-collapsed" : "";
    const passLine = mode === "pass" || mode === "checkout"
      ? `<p class="botdee-vip-pass">${esc(t("botdee.vip.passReady", "Table {table} at {venue} — show this at the door.").replace("{table}", view.sectionLabel || view.sectionId || "").replace("{venue}", venue))}</p>`
      : "";
    return `<article class="botdee-sv-vip${collapseClass}${guest ? " is-guest" : ""}" data-kind="botDeeVip" data-vip-mode="${esc(mode)}" data-hold-expires="${esc(String(view.holdExpiresAtMs || 0))}" data-rs-room="${esc(view.roomId || "")}" data-guest-mode="${guest ? "1" : "0"}">
      <h2 class="botdee-so-title">${esc(t("botdee.vip.title", "VIP reserV"))}</h2>
      <p class="botdee-so-sub">${esc(venue || t("botdee.vip.hint", "Hold a table from this chat. Joining a room is not a payment."))}</p>
      <p class="botdee-vip-kicker">${esc(kicker)}</p>
      ${needsClub ? `<div class="botdee-vip-rail" aria-label="${esc(t("botdee.vip.chooseVenue", "Choose a venue"))}">${venueChips}</div>` : ""}
      <div class="botdee-vip-rail" aria-label="${esc(t("botdee.vip.night", "Night"))}">${nightChips || vipChip("tonight", true, t("botdee.vip.tonight", "Tonight"))}</div>
      ${needsClub ? "" : `<div class="botdee-vip-expand">${collapsed ? "" : `<div class="botdee-vip-rail" aria-label="${esc(t("botdee.vip.pickArea", "Area"))}">${areaNav}</div>${vipMapHtml(map, {interactive: !guest})}`}</div>`}
      <div class="botdee-so-row"><span>${esc(t("botdee.vip.section", "Table"))}</span><strong>${esc(view.sectionLabel || view.sectionId || (map?.selectedAreaName || "—"))}</strong></div>
      ${collapsed || needsClub ? "" : `<div class="botdee-sv-tags">${tableChips}</div>`}
      <div class="botdee-vip-party">
        <span>${esc(t("botdee.vip.party", "Party"))}</span>
        ${guest ? "" : `<button type="button" class="botdee-vip-step" data-vip-prompt="${Math.max(1, party - 1)} guests" aria-label="-">−</button>`}
        <strong>${esc(String(party))}${cap ? ` <span class="botdee-vip-cap">${esc(t("botdee.vip.partyMax", "Max {n}").replace("{n}", String(cap)))}</span>` : ""}</strong>
        ${guest ? "" : `<button type="button" class="botdee-vip-step" data-vip-prompt="${Math.min(maxParty, party + 1)} guests" aria-label="+">+</button>`}
      </div>
      ${holdClock}
      ${terms}
      ${voteNote}
      ${passLine}
      ${view.collab ? renderCollabStrip(view) : ""}
      <div class="botdee-sv-people-actions">
        ${cta}
        ${!guest && (mode === "hold" || mode === "checkout") ? `<button type="button" class="botdee-sv-action" data-vip-prompt="cancel">${esc(t("botdee.vip.cancelHold", "Cancel hold"))}</button>` : ""}
        ${!guest && mode === "hold" ? `<button type="button" class="botdee-sv-action" data-vip-popout="terms">${esc(t("botdee.vip.termsOpen", "Read Terms"))}</button>` : ""}
        ${!guest && collapsed ? `<button type="button" class="botdee-sv-action" data-vip-prompt="change table">${esc(t("botdee.vip.changeTable", "Change table"))}</button>` : ""}
        <button type="button" class="botdee-sv-action" data-vip-popout="map">${esc(t("botdee.vip.openMap", "Open VIP reserV map"))}</button>
      </div>
    </article>`;
  }

  function vipCollabBinders(card, view) {
    return {
      call: async (name, payload) => {
        const fn = functionsCallable(name);
        if (!fn) throw new Error("offline");
        return (await fn(payload))?.data || {};
      },
      showToast: message => {
        const note = card.querySelector(".botdee-vip-terms, .botdee-so-sub");
        if (note) note.textContent = message;
      },
      roomIdOf: () => card.getAttribute("data-rs-room") || view?.roomId || ""
    };
  }

  function applyCollabToVipCard(card, collab, roomId) {
    if (!card || !collab || !card.isConnected) return;
    const dock = vipPreviewHost();
    if (!dock || dock.hidden || !dock.contains(card)) return;
    const guest = collab.viewerIsHost !== true;
    const view = {
      ...(card._vipView || lastVipView || {}),
      collab,
      guestMode: guest,
      roomId: roomId || card.getAttribute("data-rs-room") || ""
    };
    const wasGuest = card.getAttribute("data-guest-mode") === "1";
    if (wasGuest !== guest) {
      dockVipPreview(view);
      return;
    }
    const host = card.querySelector("[data-rs-collab]");
    if (host) {
      host.outerHTML = renderCollabStrip({collab, guestMode: guest});
      bindCollabActions(card, vipCollabBinders(card, view));
    }
    const hold = card.querySelector('[data-vip-prompt="hold it"]');
    if (hold) {
      const ready = collab.canCommit === true || Number(collab.choiceTally?.memberCount || 0) <= 1;
      hold.disabled = guest || !ready;
    }
    card._vipView = view;
    lastVipView = view;
  }

  function stopVipRoomWatch() {
    const el = vipPreviewHost();
    if (!el || !el._rsCollabUnsub) return;
    try { el._rsCollabUnsub(); } catch (_) {}
    el._rsCollabUnsub = null;
    el._rsCollabRoomId = "";
  }

  function watchVipRoom(roomId) {
    const el = vipPreviewHost();
    const id = String(roomId || "").trim();
    if (!el || !id) return;
    if (el._rsCollabRoomId === id && el._rsCollabUnsub) return;
    stopVipRoomWatch();
    el._rsCollabRoomId = id;
    const db = global.firebase?.firestore?.();
    if (!db) return;
    try {
      el._rsCollabUnsub = db.collection("botDeeRooms").doc(id).onSnapshot(() => {
        refreshVipCollab(id);
      });
    } catch (_) {}
  }

  async function refreshVipCollab(roomId) {
    const el = vipPreviewHost();
    const card = el?.querySelector(".botdee-sv-vip");
    if (!card || !roomId) return;
    try {
      const fn = functionsCallable("getBotDeeRoom");
      if (!fn) return;
      const data = (await fn({roomId}))?.data || {};
      const live = vipPreviewHost();
      const liveCard = live?.querySelector(".botdee-sv-vip");
      if (!liveCard || !liveCard.isConnected || live.hidden) return;
      if ((liveCard.getAttribute("data-rs-room") || "") !== String(roomId)) return;
      if (data.collab) applyCollabToVipCard(liveCard, data.collab, roomId);
    } catch (_) {}
  }

  function bindVipCard(card, view) {
    if (!card || card.dataset.vipBound === "1") return;
    card.dataset.vipBound = "1";
    card._vipView = view || {};
    if (card.getAttribute("data-guest-mode") === "1") {
      card.querySelectorAll("[data-vip-prompt]").forEach(btn => { btn.disabled = true; });
    }
    card.querySelectorAll("[data-vip-prompt]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        if (btn.disabled) return;
        const prompt = btn.getAttribute("data-vip-prompt") || "";
        if (prompt && global.FLOQRBotDeeChat?.sendMessage) global.FLOQRBotDeeChat.sendMessage(prompt);
      });
    });
    card.querySelectorAll("[data-vip-popout]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        openVipPopout(btn.getAttribute("data-vip-popout"), card._vipView, btn);
      });
    });
    startHoldClock(card, Number(card.getAttribute("data-hold-expires") || 0));
    bindCollabActions(card, vipCollabBinders(card, view));
    watchVipRoom(card.getAttribute("data-rs-room") || view?.roomId || "");
  }

  function vipPreviewHost() {
    return global.document?.getElementById("botDeeVipPreviewDock") || null;
  }

  let lastVipView = null;

  function isLiveVipPreview(view) {
    if (!isVipPayload(view)) return false;
    const mode = String(view.mode || "draft");
    return mode !== "cancelled";
  }

  function clearVipPreviewDock() {
    stopHoldClock();
    stopVipRoomWatch();
    const el = vipPreviewHost();
    if (!el) return;
    el.hidden = true;
    el.classList.remove("is-open");
    el.innerHTML = "";
    global.document?.body?.classList.remove("botdee-vip-dock-open");
  }

  function paintVipDock(el, view) {
    lastVipView = view;
    el.innerHTML = renderVipCard({...view, surface: "dock"});
    bindVipCard(el.querySelector(".botdee-sv-vip"), view);
  }

  function dockVipPreview(view) {
    const el = vipPreviewHost();
    if (!el || !isLiveVipPreview(view)) {
      if (!isLiveVipPreview(view)) clearVipPreviewDock();
      return false;
    }
    stopHoldClock();
    el.hidden = false;
    el.classList.add("is-open");
    global.document?.body?.classList.add("botdee-vip-dock-open");
    paintVipDock(el, view);
    if (!view.map?.imageUrl) {
      const stamp = `${view.clubLocationId || ""}|${view.night || ""}|${view.sectionId || ""}`;
      hydrateVipMap(view).then(live => {
        if (!el.isConnected || el.hidden) return;
        const now = lastVipView;
        const same = now && `${now.clubLocationId || ""}|${now.night || ""}|${now.sectionId || ""}` === stamp;
        if (!same || !live.map?.imageUrl) return;
        paintVipDock(el, live);
      });
    }
    return true;
  }

  function applyVipPreviewFromViews(views) {
    const list = Array.isArray(views) ? views : [];
    const vips = list.filter(isVipPayload);
    const live = vips.find(isLiveVipPreview);
    if (live) {
      dockVipPreview(live);
      return {docked: true, inline: list.filter(row => !isVipPayload(row))};
    }
    if (vips.length) clearVipPreviewDock();
    return {
      docked: false,
      inline: list.filter(row => !isVipPayload(row))
    };
  }

  function bindVipPopoutListener() {
    if (global.__floqrVipPopoutBound || !global.addEventListener) return;
    global.__floqrVipPopoutBound = true;
    global.addEventListener("message", event => {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (!data || data.source !== "floqr-botdee-vip") return;
      if (data.kind === "prompt" && data.prompt && global.FLOQRBotDeeChat?.sendMessage) {
        global.FLOQRBotDeeChat.sendMessage(String(data.prompt));
        return;
      }
      if (data.kind === "paid") {
        const next = {
          ...(lastVipView || {}),
          kind: "botDeeVip",
          mode: "pass",
          checkoutUrl: "",
          reservationId: data.reservationId || data.orderId || ""
        };
        dockVipPreview(next);
        return;
      }
      if (data.kind === "payCancel") {
        dockVipPreview({...(lastVipView || {}), kind: "botDeeVip", mode: "hold", checkoutUrl: ""});
      }
    });
  }

  function renderPlaceCard(payload) {
    const mock = payload.sources && payload.sources.some(s => s.provider === "mock" || s.reuseRights === "unknown");
    const iframeOk = payload.floqrPublicData && payload.floqrPublicData.menuIframeAllowed === true;
    const ratings = Array.isArray(payload.ratings) ? payload.ratings.filter(row => row && row.provider) : [];
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const cuisine = payload.floqrPublicData && Array.isArray(payload.floqrPublicData.cuisines)
      ? payload.floqrPublicData.cuisines
      : (payload.floqrPublicData && payload.floqrPublicData.cuisine) || [];
    const nhtsa = payload.kind === "vehicle" ? payload.floqrPublicData && payload.floqrPublicData.nhtsa : null;
    const visual = placeVisual(payload);
    const bgStyle = visual.backgroundUrl
      ? ` style="--sv-place-bg:url('${esc(visual.backgroundUrl)}')"`
      : "";
    const stencil = visual.stencilUrl
      ? `<img class="botdee-sv-place-stencil" src="${esc(visual.stencilUrl)}" alt="${esc(t("sv.stencilAlt", "SMARTstencil for this Place SMARTview. Illustration, not a photograph."))}" width="28" height="28" data-sv-st="${esc(visual.stencilId || "")}"/>`
      : "";
    const actionHtml = actions.map(action => {
      const href = String(action.href || "").trim();
      if (!href || /javascript:/i.test(href)) return "";
      const label = action.id === "open-public-page"
        ? t("botdee.smartviewVenueOpen", "Open FLOQR Public Page")
        : (action.id === "menu-external" && !iframeOk
          ? t("botdee.smartviewMenuExternal", "Menu (opens outside FLOQR)")
          : esc(action.label || "Open"));
      const fixed = resolveSameOriginHref(href);
      if (!fixed) return "";
      const main = action.id === "open-public-page" ? " botdee-sv-action-main" : "";
      return `<li><a class="buttonlike${main}" href="${esc(fixed)}">${label}</a></li>`;
    }).join("");
    return `<article class="botdee-sv-card botdee-sv-place" data-kind="${esc(payload.kind)}" data-sv-bg="${esc(visual.backgroundId || "")}" data-sv-st="${esc(visual.stencilId || "")}"${bgStyle}>
      <header class="botdee-sv-place-head">
        <img class="botdee-sv-place-chrome" data-floqr-chrome-icon="botDee" src="${esc(chromeIconSrc())}" alt="${esc(t("botdee.sv.chromeAlt", "BOT DEE"))}" width="28" height="28"/>
        <div class="botdee-sv-place-copy">
          <p class="botdee-sv-kind">${esc(kindLabel(payload.kind))}</p>
          <h3>${esc(payload.title)}</h3>
        </div>
        ${stencil}
        ${mock ? `<p class="botdee-sv-mock">${esc(t("botdee.smartviewMockBadge", "Mock / not live licensed data"))}</p>` : ""}
      </header>
      ${payload.summary ? `<p class="botdee-sv-summary">${esc(payload.summary)}</p>` : ""}
      ${placeTagHtml(visual.tags)}
      ${ratings.length ? `<ul class="botdee-sv-ratings">${ratings.map(ratingRow).join("")}</ul>` : ""}
      ${cuisine.length ? `<p class="botdee-sv-cuisine">${esc(Array.isArray(cuisine) ? cuisine.join(" · ") : cuisine)}</p>` : ""}
      ${nhtsa && nhtsa.status === "missing" ? `<p class="botdee-sv-missing">${esc(nhtsa.note || "Safety rating unavailable for this year/trim.")}</p>` : ""}
      ${actionHtml ? `<ul class="botdee-sv-actions">${actionHtml}</ul>` : ""}
    </article>`;
  }

  function renderCard(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (isVersionPayload(payload)) return renderVersionCard(payload);
    if (isFeaturesPayload(payload)) return renderFeaturesCard(payload);
    if (isRoomPayload(payload)) return renderRoomCard(payload);
    if (isShoutOutPayload(payload)) return renderShoutOutCard(payload);
    if (isVipPayload(payload)) return renderVipCard(payload);
    if (isCompactCard(payload)) return renderCompactPeopleCard(payload);
    if (peopleOf(payload)) return renderPeopleCard(payload);
    return renderPlaceCard(payload);
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
    const noteInvite = message => {
      let note = card.querySelector("[data-sv-invite-note]");
      if (!note) {
        note = document.createElement("p");
        note.className = "botdee-sv-room-toast";
        note.setAttribute("data-sv-invite-note", "");
        card.appendChild(note);
      }
      note.hidden = false;
      note.textContent = message;
    };
    card.addEventListener("click", event => {
      const inviteBtn = event.target.closest("[data-sv-invite-uid]");
      if (inviteBtn && card.contains(inviteBtn)) {
        event.preventDefault();
        event.stopPropagation();
        const targetUid = inviteBtn.getAttribute("data-sv-invite-uid") || "";
        const roomId = String(global.__floqrActiveBotDeeRoomId
          || document.querySelector(".botdee-sv-room[data-rs-room]")?.getAttribute("data-rs-room")
          || "").trim();
        if (!roomId) {
          noteInvite(t("botdee.room.confirmFirst", "Confirm the session first, then invite Mingl friends."));
          return;
        }
        if (!targetUid) {
          noteInvite(t("botdee.room.inviteFailed", "Could not send that invite."));
          return;
        }
        rememberLocalInvited(roomId, targetUid);
        markChipInvited(inviteBtn, true);
        const fn = functionsCallable("createBotDeeRoomInvite");
        if (!fn) {
          forgetLocalInvited(roomId, targetUid);
          restoreChipInvite(inviteBtn);
          noteInvite(t("botdee.room.inviteFailed", "Could not send that invite."));
          return;
        }
        fn({roomId, targetUid}).then(result => {
          markChipInvited(inviteBtn, false);
          noteInvite(t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now."));
          bindComposerToRoom(roomId);
          return result;
        }).catch(error => {
          if (inviteAlreadyAcked(error)) {
            markChipInvited(inviteBtn, false);
            noteInvite(t("botdee.room.inviteSentAck", "Invite sent. Type in this BOT DEE room. They tap Inbox → Review BOT DEE invite or Search → Join Now."));
            bindComposerToRoom(roomId);
            return;
          }
          forgetLocalInvited(roomId, targetUid);
          restoreChipInvite(inviteBtn);
          noteInvite(inviteErrorCopy(error));
        });
        return;
      }
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
      try { global.FLOQRChromeScheme?.applyDocument?.(); } catch (_) { /* ignore */ }
      if (resync) scrollTranscriptAfterPaint(el);
    };
    const needsCatalog = list.some(row => isRoomPayload(row) || isPlacePayload(row))
      && window.FLOQRSmartVisuals?.ensureCatalog;
    if (needsCatalog && !catalogReady()) {
      window.FLOQRSmartVisuals.ensureCatalog().then(() => paint(true), () => paint(true));
      return;
    }
    paint(false);
  }

  function shoutPreviewHost() {
    return global.document?.getElementById("botDeeShoutOutPreviewDock") || null;
  }

  function isLiveShoutPreview(view) {
    if (!isShoutOutPayload(view)) return false;
    const mode = String(view.mode || "draft");
    return mode === "draft" || mode === "checkout" || mode === "ready";
  }

  function clearShoutOutPreviewDock() {
    const el = shoutPreviewHost();
    if (!el) return;
    stopLive(el);
    el.hidden = true;
    el.classList.remove("is-open");
    el.innerHTML = "";
    el.__floqrSmartViews = [];
    global.document?.body?.classList.remove("botdee-so-dock-open");
  }

  function dockShoutOutPreview(view) {
    const el = shoutPreviewHost();
    if (!el || !isLiveShoutPreview(view)) {
      if (!isLiveShoutPreview(view)) clearShoutOutPreviewDock();
      return false;
    }
    el.hidden = false;
    el.classList.add("is-open");
    global.document?.body?.classList.add("botdee-so-dock-open");
    mount(el, [{...view, surface: "dock"}]);
    return true;
  }

  function applyShoutOutPreviewFromViews(views) {
    const list = Array.isArray(views) ? views : [];
    const shouts = list.filter(isShoutOutPayload);
    const live = shouts.find(isLiveShoutPreview);
    if (live) {
      dockShoutOutPreview(live);
      return {docked: true, inline: list.filter(row => !isShoutOutPayload(row))};
    }
    if (shouts.some(row => String(row.mode || "") === "submitted" || row.shoutoutId)) {
      clearShoutOutPreviewDock();
      return {docked: false, inline: list};
    }
    if (shouts.length) clearShoutOutPreviewDock();
    return {docked: false, inline: list};
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
    const featureHosts = el.querySelectorAll(".floqr-fsv-inline-host");
    let featureIndex = 0;
    list.forEach(payload => {
      if (!isFeaturesPayload(payload)) return;
      const host = featureHosts[featureIndex];
      featureIndex += 1;
      if (host && global.FLOQRFeaturesSmartView?.mountPayload) {
        host.setAttribute("data-fsv-layout", "inline");
        global.FLOQRFeaturesSmartView.mountPayload(host, payload);
      }
    });
    el.querySelectorAll(".botdee-sv-room").forEach(card => bindRoomCard(card));
    el.querySelectorAll(".botdee-sv-shoutout").forEach(card => bindShoutOutCard(card));
    const vipViews = list.filter(isVipPayload);
    let vipIndex = 0;
    el.querySelectorAll(".botdee-sv-vip").forEach(card => {
      bindVipCard(card, vipViews[vipIndex] || {});
      vipIndex += 1;
    });
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
  bindVipPopoutListener();
  if (global.document && !global.__floqrSmartViewChromeBound) {
    global.__floqrSmartViewChromeBound = true;
    global.addEventListener("floqr-chrome-change", () => {
      /* Site Chrome tokens restyle in place — do not remount or drop drafts. */
    });
  }

  global.FLOQRBotDeeSmartView = {
    renderCard,
    renderPlaceCard,
    isPlacePayload,
    renderPeopleCard,
    renderCompactPeopleCard,
    renderVersionCard,
    isFeaturesPayload,
    renderFeaturesCard,
    renderRoomCard,
    isVersionPayload,
    isRoomPayload,
    isShoutOutPayload,
    renderShoutOutCard,
    shoutOutLedSrc,
    patchShoutOutLedSrc,
    dockShoutOutPreview,
    clearShoutOutPreviewDock,
    applyShoutOutPreviewFromViews,
    isVipPayload,
    renderVipCard,
    dockVipPreview,
    clearVipPreviewDock,
    applyVipPreviewFromViews,
    isLiveShoutPreview,
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
