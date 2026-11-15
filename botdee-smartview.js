/* BOT DEE SmartView renderer — typed payloads only, no innerHTML from model text. */
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

  function renderCard(payload) {
    if (!payload || typeof payload !== "object") return "";
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

  function mount(el, views) {
    if (!el) return;
    const list = Array.isArray(views) ? views : [];
    el.innerHTML = list.map(renderCard).join("") || `<p class="sub small">${esc(t("botdee.libraryEmpty", "No saved SmartViews yet."))}</p>`;
    wireActionLinks(el);
  }

  global.FLOQRBotDeeSmartView = {renderCard, mount, resolveSameOriginHref, wireActionLinks};
})(window);
