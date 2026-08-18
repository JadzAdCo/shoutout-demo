/* FLOQR contextual back navigation — keep users inside the current portal/area */
(function (global) {
  "use strict";

  /* CURRENT PACKAGE. Bump this whenever README CURRENT PACKAGE bumps.
     Generated in-app links (Venue Links, FloqAi, Back) stamp this at render time.
     Never copy the page's ?v= — old bookmarks would keep minting old Club Admin URLs. */
  const APP_V = "s3.0.5";

  function navT(key, fallback) {
    try {
      const fn = global.FLOQRI18n?.t;
      if (typeof fn === "function") {
        const out = fn(key);
        if (out && out !== key) return out;
      }
    } catch (_) {}
    return fallback;
  }

  function qs(name) {
    try { return new URL(global.location.href).searchParams.get(name) || ""; }
    catch (e) { return ""; }
  }

  function buildUrl(path, params = {}) {
    try {
      const next = new URL(path, global.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value != null && value !== "") next.searchParams.set(key, String(value));
      });
      const file = next.pathname.split("/").pop() || path.replace(/^\.\//, "");
      const search = next.searchParams.toString();
      return `./${file}${search ? `?${search}` : ""}${next.hash || ""}`;
    } catch (e) {
      return path;
    }
  }

  function pageName() {
    try {
      return String(global.location.pathname.split("/").pop() || "").toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function currentVersion() {
    return APP_V;
  }

  function isDisplayFile(path) {
    const file = String(path || "").split("?")[0].split("/").pop() || "";
    return file === "display.html" || file === "display2.html";
  }

  const FLOQRNav = {
    appVersion: APP_V,
    currentVersion,
    portalHome(extra = {}) {
      return buildUrl("./patron-portal.html", { v: APP_V, ...extra });
    },
    searchHome() {
      return `./?v=${APP_V}&start=search`;
    },
    adminHome(extra = {}) {
      const extraLocation = extra.location;
      const locationId = extraLocation != null && String(extraLocation).trim() !== ""
        ? String(extraLocation).trim()
        : (qs("location") || qs("club") || "");
      const from = extra.from != null ? extra.from : (qs("from") === "master" ? "master" : "");
      const params = { ...extra, location: locationId, v: APP_V };
      if (from) params.from = from;
      else delete params.from;
      return buildUrl("./admin.html", params);
    },
    /** Club Admin URL for Venue Links / onboarding — always current package, never page ?v=. */
    adminPortalUrl(locationId = "", extra = {}) {
      return this.adminHome({ location: locationId, from: "master", ...extra });
    },
    /** Stamp current package on a relative app URL. Display boards stay location-only. */
    stampCurrentVersion(href = "", extra = {}) {
      if (!href) return href;
      if (isDisplayFile(href)) {
        const params = { ...extra };
        delete params.v;
        return buildUrl(href, params);
      }
      return buildUrl(href, { v: APP_V, ...extra });
    },
    masterHome() {
      return `./master-admin.html?v=${APP_V}`;
    },
    suprstrHome(extra = {}) {
      return buildUrl("./suprstr-search.html", { v: APP_V, from: "master", ...extra });
    },
    /** Satellite page under My Profile and Settings */
    portalLink(path, extra = {}) {
      return buildUrl(path, { v: APP_V, from: "portal", ...extra });
    },
    /** Satellite page under Club Admin — always stamp from=admin (+ location). */
    adminLink(path, extra = {}) {
      const locationId = qs("location") || qs("club") || extra.location || "";
      return buildUrl(path, { v: APP_V, from: "admin", location: locationId, ...extra });
    },
    /** Stable venue board URL — no cache-bust ?v= (for LED devices and external embeds). */
    stableDisplayUrl(locationId = "", extra = {}) {
      const id = String(locationId || qs("location") || qs("club") || extra.location || "").trim();
      const params = {...extra};
      delete params.location;
      delete params.v;
      const board = String(params.board || params.displayBoard || "").toLowerCase();
      delete params.board;
      delete params.displayBoard;
      const page = (board === "secondary" || board === "2" || board === "display2" || board === "displays") ? "./display2.html" : "./display.html";
      return buildUrl(page, id ? {location: id, ...params} : params);
    },
    /** Second LED/board per club — display2.html?location=… */
    stableSecondaryDisplayUrl(locationId = "", extra = {}) {
      return this.stableDisplayUrl(locationId, {...extra, board: "secondary"});
    },
    /** Resolve the correct back target for a satellite page. */
    resolveBack(fromOverride = "") {
      const from = String(fromOverride || qs("from") || "").toLowerCase();
      const file = pageName();

      // Club Admin landing: never dump managers onto the patron Search site.
      if (file === "admin.html") {
        if (from === "master") {
          return { href: this.masterHome(), label: navT("nav.backToMaster", "← Back to Master Admin") };
        }
        return { href: this.adminHome({ from: "" }), label: navT("nav.backToVenueCommand", "← Venue Command Center"), stay: true };
      }

      if (from === "portal" || from === "profile") {
        return { href: this.portalHome(), label: navT("nav.backToPortal", "← Back to My Profile and Settings") };
      }
      if (from === "admin" || from === "club") {
        return { href: this.adminHome({ from: "" }), label: navT("nav.backToAdmin", "← Back to Venue Command Center") };
      }
      if (from === "master") {
        if (file === "admin.html") return { href: this.masterHome(), label: navT("nav.backToMaster", "← Back to Master Admin") };
        return { href: this.masterHome(), label: navT("nav.backToMaster", "← Back to Master Admin") };
      }
      if (from === "mingl") {
        return { href: `./?v=${APP_V}&start=mingl`, label: navT("nav.backToMingl", "← Back to Mingl") };
      }
      if (from === "bartr" || from === "commerce") {
        return { href: `./commerce.html?v=${APP_V}`, label: navT("nav.backToBartr", "← Back to BartR") };
      }
      return { href: this.searchHome(), label: navT("nav.backToSearchArrow", "← Back to Search") };
    },
    /**
     * Prefer URL ?from= over hardcoded data-from so Club Admin deep links win.
     * data-from is only a fallback when the query has no from.
     */
    applyGlobalBack(anchorOrId = "floqrGlobalBack") {
      const anchor = typeof anchorOrId === "string" ? document.getElementById(anchorOrId) : anchorOrId;
      if (!anchor) return null;
      const queryFrom = qs("from");
      const from = queryFrom || anchor.dataset.from || "";
      if (queryFrom) anchor.dataset.from = queryFrom;
      const target = this.resolveBack(from);
      anchor.href = target.href;
      anchor.textContent = target.label;
      // On admin landing with no Master return path, hide a no-op "home" back.
      if (target.stay && pageName() === "admin.html" && !queryFrom) {
        anchor.classList.add("hidden");
        anchor.setAttribute("aria-hidden", "true");
      } else {
        anchor.classList.remove("hidden");
        anchor.removeAttribute("aria-hidden");
      }
      return target;
    },
    /** Call after DOM ready on index.html to honor ?start=search|mingl|intent */
    applyStartPage(showPage) {
      if (typeof showPage !== "function") return;
      const start = String(qs("start") || "").toLowerCase();
      if (start === "intent" || start === "ask" || start === "wish") showPage("intentSearchPage");
      else if (start === "search" || start === "categories" || start === "category") showPage("categoryPage");
      else if (start === "mingl") showPage("minglLandingPage");
    },
    intentSearchHome() {
      return `./?v=${APP_V}&start=intent`;
    }
  };

  global.FLOQRNav = FLOQRNav;

  if (typeof global.addEventListener === "function") {
    global.addEventListener("floqr:ui-language", () => {
      try { FLOQRNav.applyGlobalBack("floqrGlobalBack"); } catch (_) {}
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
