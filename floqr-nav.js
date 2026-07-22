/* FLOQR contextual back navigation — keep users inside the current portal/area */
(function (global) {
  "use strict";

  const APP_V = "29.09.40";

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
      return buildUrl("./admin.html", { v: APP_V, location: locationId, ...extra });
    },
    masterHome() {
      return `./master-admin.html?v=${APP_V}`;
    },
    /** Satellite page under My Profile and Settings */
    portalLink(path, extra = {}) {
      return buildUrl(path, { v: APP_V, from: "portal", ...extra });
    },
    /** Satellite page under Club Admin */
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
      if (from === "portal" || from === "profile") {
        return { href: this.portalHome(), label: "← Back to My Profile and Settings" };
      }
      if (from === "admin" || from === "club") {
        return { href: this.adminHome(), label: "← Back to Venue Command Center" };
      }
      if (from === "master") {
        return { href: this.masterHome(), label: "← Back to Master Admin" };
      }
      if (from === "mingl") {
        return { href: `./?v=${APP_V}&start=mingl`, label: "← Back to Mingl" };
      }
      return { href: this.searchHome(), label: "← Back to Search" };
    },
    applyGlobalBack(anchorOrId = "floqrGlobalBack") {
      const anchor = typeof anchorOrId === "string" ? document.getElementById(anchorOrId) : anchorOrId;
      if (!anchor) return null;
      const from = anchor.dataset.from || qs("from") || "";
      const target = this.resolveBack(from);
      anchor.href = target.href;
      anchor.textContent = target.label;
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
