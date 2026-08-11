/* FLOQR contextual back navigation — keep users inside the current portal/area */
(function (global) {
  "use strict";

  // Single fallback only — never copy package ids into href strings elsewhere.
  // Prefer page ?v=, then the floqr-nav.js script src cache-bust.
  const FALLBACK_APP_V = "29.09.124";

  function qs(name) {
    try { return new URL(global.location.href).searchParams.get(name) || ""; }
    catch (e) { return ""; }
  }

  function packageVersion() {
    const fromPage = qs("v");
    if (fromPage) return fromPage;
    try {
      const scripts = global.document?.getElementsByTagName?.("script") || [];
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const src = scripts[i].src || "";
        if (!/floqr-nav\.js/i.test(src)) continue;
        const v = new URL(src, global.location.href).searchParams.get("v");
        if (v) return v;
      }
    } catch (e) {}
    return FALLBACK_APP_V;
  }

  function buildUrl(path, params = {}, options = {}) {
    try {
      const next = new URL(path, global.location.href);
      const stampVersion = options.stampVersion !== false;
      const merged = stampVersion ? { v: packageVersion(), ...params } : { ...params };
      if (!stampVersion) delete merged.v;
      Object.entries(merged).forEach(([key, value]) => {
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
    get appVersion() { return packageVersion(); },
    portalHome(extra = {}) {
      return buildUrl("./patron-portal.html", { ...extra });
    },
    searchHome() {
      return buildUrl("./index.html", { start: "search" }).replace(/^\.\/index\.html/, "./");
    },
    adminHome(extra = {}) {
      const locationId = qs("location") || qs("club") || extra.location || "";
      const from = extra.from != null ? extra.from : (qs("from") === "master" ? "master" : "");
      const params = { location: locationId, ...extra };
      if (from) params.from = from;
      else delete params.from;
      return buildUrl("./admin.html", params);
    },
    masterHome() {
      return buildUrl("./master-admin.html");
    },
    suprstrHome(extra = {}) {
      return buildUrl("./suprstr-search.html", { from: "master", ...extra });
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
    commerceHome(extra = {}) {
      return buildUrl("./commerce.html", { from: "search", ...extra });
    },
    rydrHome(extra = {}) {
      return buildUrl("./rydr.html", { from: "search", ...extra });
    },
    minglChatHome(extra = {}) {
      return buildUrl("./mingl-chat.html", { from: "portal", ...extra });
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
      return buildUrl(page, id ? {location: id, ...params} : params, { stampVersion: false });
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
        return { href: buildUrl("./index.html", { start: "mingl" }).replace(/^\.\/index\.html/, "./"), label: "← Back to Mingl" };
      }
      if (from === "bartr" || from === "commerce") {
        return { href: this.commerceHome({ from: "search" }), label: "← Back to BartR" };
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
      return buildUrl("./index.html", { start: "intent" }).replace(/^\.\/index\.html/, "./");
    },
    /** Stamp ?v= on in-app anchors from packageVersion(). Never use on display boards. */
    stampAppAnchors(root = global.document) {
      if (!root?.querySelectorAll) return 0;
      const v = packageVersion();
      let count = 0;
      root.querySelectorAll("a[href]").forEach(anchor => {
        const raw = anchor.getAttribute("href") || "";
        if (!raw || /^(https?:|mailto:|tel:|#)/i.test(raw)) return;
        if (/display2?\.html/i.test(raw)) return;
        try {
          const next = new URL(raw, global.location.href);
          const file = (next.pathname.split("/").pop() || "").toLowerCase();
          if (file && !file.endsWith(".html") && file !== "index.html") return;
          next.searchParams.set("v", v);
          const search = next.searchParams.toString();
          const hash = next.hash || "";
          const normalized = (!file || file === "index.html")
            ? `./${search ? `?${search}` : ""}${hash}`
            : `./${file}${search ? `?${search}` : ""}${hash}`;
          if (anchor.getAttribute("href") !== normalized) {
            anchor.setAttribute("href", normalized);
            count += 1;
          }
        } catch (e) {}
      });
      return count;
    }
  };

  global.FLOQRNav = FLOQRNav;
})(window);
