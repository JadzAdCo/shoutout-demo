/* FLOQR contextual back navigation — keep users inside the current portal/area */
(function (global) {
  "use strict";

  /* CURRENT PACKAGE. Bump this whenever README CURRENT PACKAGE bumps.
     Asset cache-bust only (script/link tags). Page links never carry ?v= (owner decision Oct 10 2026). */
  const APP_V = "s3.2.18";

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

  function buildUrl(path, params = {}, drop = []) {
    try {
      const next = new URL(path, global.location.href);
      ["v", ...drop].forEach(key => next.searchParams.delete(key));
      Object.entries(params).forEach(([key, value]) => {
        if (key !== "v" && value != null && value !== "") next.searchParams.set(key, String(value));
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
      return buildUrl("./patron-portal.html", extra);
    },
    searchHome() {
      return `./?start=search`;
    },
    /** Throw a ShoutOut at one venue or event: Search shows that venue's ad splash, then its ShoutOut landing. */
    shoutoutLink({ locationId = "", eventId = "" } = {}) {
      const location = String(locationId || "").trim();
      const event = String(eventId || "").trim();
      if (!location && !event) return this.searchHome();
      return buildUrl("./", { start: "shoutout", location, event });
    },
    /** Absolute form of shoutoutLink for iframes on club websites and copied links. */
    shoutoutUrl(target = {}) {
      const href = this.shoutoutLink(target);
      try { return new URL(href, global.location.href).toString(); }
      catch (e) { return href; }
    },
    adminHome(extra = {}) {
      const extraLocation = extra.location;
      const locationId = extraLocation != null && String(extraLocation).trim() !== ""
        ? String(extraLocation).trim()
        : (qs("location") || qs("club") || "");
      const from = extra.from != null ? extra.from : (qs("from") === "master" ? "master" : "");
      const params = { ...extra, location: locationId };
      if (from) params.from = from;
      else delete params.from;
      return buildUrl("./admin.html", params);
    },
    /** Club Admin URL for Venue Links / onboarding. */
    adminPortalUrl(locationId = "", extra = {}) {
      return this.adminHome({ location: locationId, from: "master", ...extra });
    },
    /** Relative app link with any old ?v= removed. Display boards also drop screen params. */
    stampCurrentVersion(href = "", extra = {}) {
      if (!href) return href;
      if (isDisplayFile(href)) return buildUrl(href, extra, ["screen", "screenFormatId"]);
      return buildUrl(href, extra);
    },
    masterHome(extra = {}) {
      const { hash, ...params } = extra || {};
      const href = buildUrl("./master-admin.html", params);
      const panel = String(hash || "").replace(/^#/, "").trim();
      return panel ? `${href}#${panel}` : href;
    },
    floqcastHome(extra = {}) {
      return buildUrl("./floqcast-search.html", { from: "master", ...extra });
    },
    /** Satellite page under My Profile and Settings */
    portalLink(path, extra = {}) {
      return buildUrl(path, { from: "portal", ...extra });
    },
    /** Satellite page under Club Admin — always stamp from=admin (+ location). */
    adminLink(path, extra = {}) {
      const locationId = qs("location") || qs("club") || extra.location || "";
      return buildUrl(path, { from: "admin", location: locationId, ...extra });
    },
    /** Satellite opened from Master Admin NIC — stamp from=master so Back returns to NIC. */
    masterLink(path, extra = {}) {
      return buildUrl(path, { from: "master", ...extra });
    },
    /** Stable venue board URL (for LED devices and external embeds). */
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
      let hash = "";
      try { hash = String(global.location?.hash || "").replace(/^#/, "").trim(); } catch (_) {}

      // Master Admin NIC: never dump operators onto the patron Search landing.
      // Profile & Settings is an explicit profile-menu exit (new tab), not Back.
      if (file === "master-admin.html") {
        const onHome = !hash || hash === "networkDashboard";
        return {
          href: this.masterHome({ hash: "networkDashboard" }),
          label: navT("nav.backToNic", "← Network Intelligence Center"),
          stay: onHome
        };
      }

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
        return { href: this.masterHome(), label: navT("nav.backToMaster", "← Back to Master Admin") };
      }
      if (from === "mingl") {
        return { href: `./?start=mingl`, label: navT("nav.backToMingl", "← Back to Mingl") };
      }
      if (from === "bartr" || from === "commerce") {
        return { href: `./commerce.html`, label: navT("nav.backToBartr", "← Back to BartR") };
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
      const shortLabel = navT("nav.backShort", "< Back");
      anchor.href = target.href;
      anchor.textContent = shortLabel;
      anchor.setAttribute("aria-label", shortLabel);
      // On Club Admin / Master Admin NIC home, hide a no-op "home" back.
      const hub = pageName();
      if (target.stay && (hub === "admin.html" || hub === "master-admin.html") && !queryFrom) {
        anchor.classList.add("hidden");
        anchor.setAttribute("aria-hidden", "true");
      } else {
        anchor.classList.remove("hidden");
        anchor.removeAttribute("aria-hidden");
      }
      if (!anchor.dataset.floqrHistoryBackBound) {
        anchor.dataset.floqrHistoryBackBound = "1";
        anchor.addEventListener("click", (event) => {
          const fromNow = qs("from") || anchor.dataset.from || "";
          const next = this.resolveBack(fromNow);
          if (next.stay && (pageName() === "admin.html" || pageName() === "master-admin.html") && !qs("from")) {
            return;
          }
          try {
            if (global.history && global.history.length > 1) {
              event.preventDefault();
              global.history.back();
            }
          } catch (_) {}
        });
      }
      return {...target, label: shortLabel};
    },
    /** FloqR mark → Search home (never history.back). */
    bindHomeLogos(root = document) {
      const href = this.searchHome();
      root.querySelectorAll("[data-floqr-home-logo], .floqr-hero-logo, .product-parent-logo, .intent-floqr-logo").forEach((el) => {
        const link = el.closest("a.floqr-home-link") || (el.matches?.("a.floqr-home-link") ? el : null);
        if (link) {
          link.href = href;
          return;
        }
        if (el.tagName === "IMG" && !el.closest("a")) {
          const wrap = document.createElement("a");
          wrap.href = href;
          wrap.className = "floqr-home-link";
          wrap.setAttribute("data-floqr-home-logo", "");
          wrap.setAttribute("aria-label", "FloqR home");
          el.parentNode?.insertBefore(wrap, el);
          wrap.appendChild(el);
        }
      });
      root.querySelectorAll("[data-floqr-history-back]").forEach((el) => {
        if (el.dataset.floqrHistoryBackBound) return;
        el.dataset.floqrHistoryBackBound = "1";
        el.addEventListener("click", (event) => {
          try {
            if (global.history && global.history.length > 1) {
              event.preventDefault();
              global.history.back();
            }
          } catch (_) {}
        });
      });
    },
    /** Call after DOM ready on index.html to honor ?start=search|mingl|intent */
    applyStartPage(showPage) {
      if (typeof showPage !== "function") return;
      const start = String(qs("start") || "").toLowerCase();
      if (start === "intent" || start === "ask" || start === "wish") {
        const q = qs("q");
        global.location.replace(buildUrl("./floqai.html", q ? { q } : {}));
      }
      else if (start === "search" || start === "categories" || start === "category") showPage("categoryPage");
      else if (start === "mingl") showPage("minglLandingPage");
    },
    intentSearchHome() {
      return buildUrl("./floqai.html");
    }
  };

  global.FLOQRNav = FLOQRNav;

  if (typeof global.addEventListener === "function") {
    global.addEventListener("floqr:ui-language", () => {
      try { FLOQRNav.applyGlobalBack("floqrGlobalBack"); } catch (_) {}
    });
    const bootNav = () => {
      try { FLOQRNav.applyGlobalBack("floqrGlobalBack"); } catch (_) {}
      try { FLOQRNav.bindHomeLogos(); } catch (_) {}
    };
    if (global.document?.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", bootNav);
    } else {
      bootNav();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
