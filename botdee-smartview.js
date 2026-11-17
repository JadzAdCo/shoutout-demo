/* BOT DEE SMARTview renderer — typed payloads only, no innerHTML from model text. */
(function (global) {
  "use strict";

  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
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

  function renderCompactPeopleCard(payload) {
    const people = peopleOf(payload);
    if (!people) return "";
    const photo = people.photo && people.photo.url ? resolveImageSrc(people.photo.url) : "";
    const handles = Array.isArray(people.handles) ? people.handles : [];
    const summaryText = people.summary?.excerpt || people.summary?.text || "";
    const localeNote = statusLabel(people.summary);
    const name = people.displayName || payload.title || "";
    const uid = people.subjectUid || "";
    const photoAlt = photo
      ? (name || t("botdee.sc.photoAlt", "Public profile photo"))
      : t("botdee.sc.photoAlt", "Public profile photo");
    return `<article class="botdee-sv-people botdee-sc-card" data-kind="patron" data-presentation="peopleSmartCard" data-subject-uid="${esc(uid)}" role="button" tabindex="0" aria-label="${esc(t("botdee.sc.openSmartView", "Open SmartView"))}">
      <div class="botdee-sc-row">
        <div class="botdee-sc-thumb" aria-hidden="${photo ? "false" : "true"}">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(photoAlt)}"/>` : `<span class="botdee-sc-thumb-empty" aria-hidden="true"></span>`}
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
    const photosList = Array.isArray(people.media?.photos) ? people.media.photos : [];
    const videosList = Array.isArray(people.media?.videos) ? people.media.videos : [];
    const heroKind = people.photo?.kind === "video" ? "video" : "image";
    const heroUrl = (people.photo && people.photo.url)
      || (heroKind === "video" ? videosList[0]?.url : photosList[0]?.url)
      || "";
    const photo = heroKind !== "video" && heroUrl ? resolveImageSrc(heroUrl) : "";
    const videoHero = (heroKind === "video" && heroUrl ? resolveImageSrc(heroUrl) : "")
      || (!photo && videosList[0]?.url ? resolveImageSrc(videosList[0].url) : "");
    const count = photosList.length + videosList.length
      || (people.photo && people.photo.count)
      || (photo || videoHero ? 1 : 0);
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

  function renderCard(payload) {
    if (!payload || typeof payload !== "object") return "";
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
    unsubs.push(db.collection("usercharacter_analysis").doc(uid).onSnapshot(() => {
      applyRefetch();
    }, () => {
      /* permission-denied / unstamped / unpublished: keep the search-authorized card */
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

  function mount(el, views, peopleSearch) {
    if (!el) return;
    stopLive(el);
    const list = Array.isArray(views) ? views : [];
    el.__floqrSmartViews = list;
    el.__floqrPeopleSearch = peopleSearch || el.__floqrPeopleSearch || null;
    const meta = el.__floqrPeopleSearch || {};
    const more = meta.hasMore
      ? `<p class="botdee-sc-more"><button type="button" class="botdee-sv-action" data-sc-more>${esc(t("botdee.sc.moreResults", "Show more people"))}</button></p>`
      : "";
    el.innerHTML = list.map(renderCard).join("") + more || `<p class="sub small">${esc(t("botdee.libraryEmpty", "No saved SMARTviews yet."))}</p>`;
    wireActionLinks(el);
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
