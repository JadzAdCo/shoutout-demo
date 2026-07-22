/* FLOQR contextual back navigation — keep users inside the current portal/area */
(function (global) {
  "use strict";

  const APP_V = "29.09.44";

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

  const FLOQRNav = {
    appVersion: APP_V,
    portalHome(extra = {}) {
      return buildUrl("./patron-portal.html", { v: APP_V, ...extra });
    },
    searchHome() {
      return `./?v=${APP_V}&start=search`;
    },
    adminHome(extra = {}) {
      const locationId = qs("location") || qs("club") || extra.location || "";
      const from = extra.from != null ? extra.from : (qs("from") === "master" ? "master" : "");
      const params = { v: APP_V, location: locationId, ...extra };
      if (from) params.from = from;
      else delete params.from;
      return buildUrl("./admin.html", params);
    },
    masterHome() {
      return `./master-admin.html?v=${APP_V}`;
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
      return buildUrl("./display.html", id ? {location: id, ...params} : params);
    },
    /** Resolve the correct back target for a satellite page. */
    resolveBack(fromOverride = "") {
      const from = String(fromOverride || qs("from") || "").toLowerCase();
      const file = pageName();

      // Club Admin landing: never dump managers onto the patron Search site.
      if (file === "admin.html") {
        if (from === "master") {
          return { href: this.masterHome(), label: "← Back to Master Admin" };
        }
        return { href: this.adminHome({ from: "" }), label: "← Venue Command Center", stay: true };
      }

      if (from === "portal" || from === "profile") {
        return { href: this.portalHome(), label: "← Back to My Profile and Settings" };
      }
      if (from === "admin" || from === "club") {
        return { href: this.adminHome({ from: "" }), label: "← Back to Venue Command Center" };
      }
      if (from === "master") {
        // Satellite opened from Master via Club Admin URL still returns to Master when stamped.
        if (file === "admin.html") return { href: this.masterHome(), label: "← Back to Master Admin" };
        return { href: this.masterHome(), label: "← Back to Master Admin" };
      }
      if (from === "mingl") {
        return { href: `./?v=${APP_V}&start=mingl`, label: "← Back to Mingl" };
      }
      if (from === "bartr" || from === "commerce") {
        return { href: `./commerce.html?v=${APP_V}`, label: "← Back to BartR" };
      }
      return { href: this.searchHome(), label: "← Back to Search" };
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
})(window);
