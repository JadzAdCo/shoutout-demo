/* FLOQR Features SMARTview — reusable product catalog UI.
   Dates stay Not verified until a reviewer attaches availability evidence. */
(function (root) {
  "use strict";
  if (root.FLOQRFeaturesSmartView && root.FLOQRFeaturesSmartView._fsvFull) return;

  const CATALOG_URL = "./features-smartview/catalog.json";
  const core = () => root.FLOQRFeaturesSmartViewCore;
  let catalog = null;
  let lastHost = null;

  function t(key, fallback, vars) {
    const i18n = root.FLOQRI18n;
    const text = i18n && typeof i18n.t === "function" ? i18n.t(key, fallback) : (fallback || key);
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  function navUrl(path, params) {
    const nav = root.FLOQRNav;
    if (nav && typeof nav.pageUrl === "function") return nav.pageUrl(path, params || {});
    const url = new URL(path, root.location ? root.location.href : "https://jadzadco.github.io/shoutout-demo/");
    Object.keys(params || {}).forEach(key => {
      if (key === "v") return;
      if (params[key] != null && params[key] !== "") url.searchParams.set(key, params[key]);
    });
    return url.pathname.split("/").pop() + url.search + url.hash;
  }

  function viewerAccess() {
    const services = root.FLOQRFeatureServices;
    const keys = core().FEATURE_KEYS;
    const canAccessKeys = {};
    Object.keys(keys).forEach(productId => {
      const key = keys[productId];
      if (!key) return;
      try {
        canAccessKeys[key] = !!(services && services.canAccess && services.canAccess(key));
      } catch (_) {
        canAccessKeys[key] = false;
      }
    });
    let isMasterAdmin = false;
    try {
      isMasterAdmin = !!(root.FLOQRFeatureGates && root.FLOQRFeatureGates.isMasterAdmin && root.FLOQRFeatureGates.isMasterAdmin());
    } catch (_) {}
    return { role: isMasterAdmin ? "masterAdmin" : "patron", canAccessKeys, isMasterAdmin };
  }

  function catalogFor(host) {
    if (catalog) return catalog;
    if (host && host.__fsvSnapshot) return host.__fsvSnapshot;
    return null;
  }

  function projection(host) {
    const source = catalogFor(host);
    if (!source) return {products: [], features: [], warning: ""};
    return core().publicProjection(source, viewerAccess());
  }

  function stateFrom(host) {
    const params = new URLSearchParams(root.location ? root.location.search : "");
    return {
      productId: host.getAttribute("data-fsv-product") || params.get("product") || "",
      view: host.getAttribute("data-fsv-view") || params.get("view") || "overview",
      featureId: host.getAttribute("data-fsv-feature") || params.get("feature") || "",
      q: host.getAttribute("data-fsv-q") || "",
      lifecycle: host.getAttribute("data-fsv-lifecycle") || ""
    };
  }

  function setState(host, next) {
    if (next.productId != null) host.setAttribute("data-fsv-product", next.productId);
    if (next.view) host.setAttribute("data-fsv-view", next.view);
    if (next.featureId != null) host.setAttribute("data-fsv-feature", next.featureId);
    if (next.q != null) host.setAttribute("data-fsv-q", next.q);
    if (next.lifecycle != null) host.setAttribute("data-fsv-lifecycle", next.lifecycle);
  }

  function badgeClass(label) {
    if (label === core().STATUS_NOT_VERIFIED) return "is-unknown";
    if (label === "Released") return "is-released";
    if (label === "Beta") return "is-beta";
    if (label === "In development") return "is-dev";
    if (label === "Planned" || label === "Concept") return "is-plan";
    if (label === "Deprecated" || label === "Retired") return "is-past";
    return "is-unknown";
  }

  function compactCard(row, opts) {
    const tryBtn = row.tryAllowed && row.tryRoute
      ? `<a class="floqr-fsv-try" href="${esc(navUrl(row.tryRoute, row.productId === "shoutout" ? {start: "shoutout"} : {from: "features-smartview"}))}">${esc(t("fsv.tryFeature", "Try feature"))}</a>`
      : `<span class="floqr-fsv-note">${esc(t("fsv.noTry", "Try is hidden until this feature is available to you."))}</span>`;
    const ask = `<button type="button" class="buttonlike" data-fsv-ask="${esc(row.id)}">${esc(t("fsv.askBotDee", "Ask BOT DEE"))}</button>`;
    return `<article class="floqr-fsv-card" data-fsv-open="${esc(row.id)}">
      <p class="floqr-fsv-kicker">${esc(row.productName)}</p>
      <h4 class="floqr-fsv-name">${esc(row.title)}</h4>
      <span class="floqr-fsv-badge ${badgeClass(row.lifecycleLabel)}">${esc(row.lifecycleLabel)}</span>
      <p class="floqr-fsv-mission">${esc(row.accomplishment || row.shortDescription)}</p>
      <p class="floqr-fsv-note">${esc(t("fsv.dateImplemented", "Date implemented"))}: ${esc(row.implementedLabel)}</p>
      ${opts && opts.actions === false ? "" : `<div class="floqr-fsv-actions">
        <button type="button" class="buttonlike" data-fsv-open="${esc(row.id)}">${esc(t("fsv.compactMore", "View details"))}</button>
        <button type="button" class="buttonlike" data-fsv-view-jump="journey">${esc(t("fsv.viewJourney", "View journey"))}</button>
        <button type="button" class="buttonlike" data-fsv-view-jump="whatsNew">${esc(t("fsv.readChanges", "Read changes"))}</button>
        ${ask}
        ${tryBtn}
      </div>`}
    </article>`;
  }

  function productHero(product, count, warning) {
    return `<header class="floqr-fsv-hero">
      <h3 class="floqr-fsv-title">${esc(product ? product.displayName : t("fsv.title", "Features SMARTview"))}</h3>
      <p class="floqr-fsv-mission">${esc(product ? product.mission : t("fsv.subtitle", "Evidence-backed product features. Plans are not treated as shipped."))}</p>
      <p class="floqr-fsv-note">${esc(t("fsv.featureCount", "{n} catalog features", {n: count}))}
        · ${esc(t("fsv.latestRelease", "Latest verified release"))}: ${esc(product ? product.latestRelease : core().DATE_NOT_VERIFIED)}</p>
      <p class="floqr-fsv-warning">${esc(warning || "")}</p>
    </header>`;
  }

  function productSwitcher(proj, current) {
    const buttons = proj.products.map(product => {
      const on = product.id === current;
      return `<button type="button" class="floqr-fsv-chip${on ? " is-active" : ""}" data-fsv-product="${esc(product.id)}" aria-pressed="${on ? "true" : "false"}">${esc(product.displayName)}</button>`;
    }).join("");
    return `<div class="floqr-fsv-switcher" role="group" aria-label="${esc(t("fsv.switchProduct", "Product"))}">
      <button type="button" class="floqr-fsv-chip${current ? "" : " is-active"}" data-fsv-product="" aria-pressed="${current ? "false" : "true"}">${esc(t("fsv.filterProduct", "All products"))}</button>
      ${buttons}
    </div>`;
  }

  function tabs(view) {
    const items = [
      ["overview", t("fsv.tabOverview", "Overview")],
      ["whatsNew", t("fsv.tabWhatsNew", "What's New")],
      ["journey", t("fsv.tabJourney", "Feature Journey")],
      ["all", t("fsv.tabAll", "All Features")],
      ["comingSoon", t("fsv.tabComingSoon", "Coming Soon")],
      ["past", t("fsv.tabPast", "Past/Retired")]
    ];
    return `<div class="floqr-fsv-tabs" role="tablist">
      ${items.map(([id, label]) => `<button type="button" role="tab" class="buttonlike" data-fsv-view="${id}" aria-selected="${view === id ? "true" : "false"}">${esc(label)}</button>`).join("")}
    </div>`;
  }

  function detailHtml(row) {
    if (!row) return "";
    const citations = (row.citations || []).map(cite =>
      `<a href="${esc(navUrl("./features-smartview.html", {feature: cite.featureId}))}">${esc(t("fsv.citation", "Catalog") + " " + cite.featureId)}</a>`
    ).join(" · ");
    const history = (row.history || []).map(ev =>
      `<li><strong>${esc(ev.type)}</strong> ${esc(ev.at || core().DATE_NOT_VERIFIED)} — ${esc(ev.note || "")}</li>`
    ).join("") || `<li>${esc(t("fsv.dateNotVerified", "Not verified"))}</li>`;
    const tryBtn = row.tryAllowed && row.tryRoute
      ? `<a class="floqr-fsv-try" href="${esc(navUrl(row.tryRoute, row.productId === "shoutout" ? {start: "shoutout"} : {from: "features-smartview"}))}">${esc(t("fsv.tryFeature", "Try feature"))}</a>`
      : "";
    return `<div class="floqr-fsv-detail" role="dialog" aria-modal="true" aria-labelledby="fsvDetailTitle">
      <button type="button" class="floqr-fsv-close" data-fsv-close>${esc(t("fsv.close", "Close"))}</button>
      <p class="floqr-fsv-kicker">${esc(row.productName)}</p>
      <h4 id="fsvDetailTitle" class="floqr-fsv-name">${esc(row.title)}</h4>
      <span class="floqr-fsv-badge ${badgeClass(row.lifecycleLabel)}">${esc(row.lifecycleLabel)}</span>
      <dl class="floqr-fsv-dl">
        <dt>${esc(t("fsv.accomplishment", "What it accomplishes"))}</dt><dd>${esc(row.accomplishment)}</dd>
        <dt>${esc(t("fsv.before", "Before"))}</dt><dd>${esc(row.previousBehavior || t("fsv.dateNotVerified", "Not verified"))}</dd>
        <dt>${esc(t("fsv.now", "Now / target"))}</dt><dd>${esc(row.currentBehavior || row.proposedBehavior || t("fsv.dateNotVerified", "Not verified"))}</dd>
        <dt>${esc(t("fsv.why", "Why it matters"))}</dt><dd>${esc(row.patronBenefit)}</dd>
        <dt>${esc(t("fsv.audience", "Audience"))}</dt><dd>${esc((row.audienceRoles || []).join(", ") || t("fsv.dateNotVerified", "Not verified"))}</dd>
        <dt>${esc(t("fsv.dateImplemented", "Date implemented"))}</dt><dd>${esc(row.implementedLabel)}</dd>
        <dt>${esc(t("fsv.mergedOn", "Merged on"))}</dt><dd>${esc(row.mergedAt || t("fsv.dateNotVerified", "Not verified"))}</dd>
        <dt>${esc(t("fsv.availableSince", "Available since"))}</dt><dd>${esc(row.releasedAt || t("fsv.dateNotVerified", "Not verified"))}</dd>
      </dl>
      <h5>${esc(t("fsv.tabJourney", "Feature Journey"))}</h5>
      <ol class="floqr-fsv-journey">${history}</ol>
      <p class="floqr-fsv-cite">${citations}</p>
      <div class="floqr-fsv-actions">${tryBtn}
        <button type="button" class="buttonlike" data-fsv-ask="${esc(row.id)}">${esc(t("fsv.askBotDee", "Ask BOT DEE"))}</button>
      </div>
    </div>`;
  }

  function journeyHtml(rows) {
    const order = ["concept", "planned", "in_development", "beta", "released", "deprecated", "retired"];
    return `<ol class="floqr-fsv-journey floqr-fsv-journey-wide">
      ${order.map(step => {
        const hits = rows.filter(row => row.lifecycle === step);
        const label = t("fsv.lifecycle." + step, core().LIFECYCLE_LABELS[step]);
        return `<li>
          <strong>${esc(label)}</strong>
          ${hits.length ? hits.map(row => `<span class="floqr-fsv-badge ${badgeClass(row.lifecycleLabel)}">${esc(row.title)} · ${esc(row.lifecycleLabel)}</span>`).join(" ") : `<span class="floqr-fsv-note">${esc(t("fsv.dateNotVerified", "Not verified"))}</span>`}
        </li>`;
      }).join("")}
    </ol>`;
  }

  function emptyFor(view) {
    if (view === "whatsNew") return t("fsv.emptyWhatsNew", "What's New lists only approved, verified releases. None are published yet.");
    if (view === "comingSoon") return t("fsv.emptyComingSoon", "No approved planned work is listed. Dates are not invented.");
    if (view === "past") return t("fsv.emptyPast", "No deprecated or retired features are listed.");
    return t("fsv.emptyAll", "No catalog features match.");
  }

  function render(host) {
    const source = catalogFor(host);
    if (!host || !source) return;
    const api = core();
    if (!api) {
      host.textContent = "Features SMARTview core missing.";
      return;
    }
    const st = stateFrom(host);
    const proj = projection(host);
    const product = proj.products.find(row => row.id === st.productId) || null;
    let rows = api.filterFeatures(proj.features, {
      view: st.view === "overview" ? "all" : st.view,
      productId: st.productId,
      q: st.q
    });
    if (st.lifecycle) rows = rows.filter(row => row.lifecycle === st.lifecycle);
    const open = rows.find(row => row.id === st.featureId) || proj.features.find(row => row.id === st.featureId);
    const overviewCards = st.view === "overview"
      ? (product ? rows.slice(0, 6) : proj.products.map(prod => {
        const sample = proj.features.find(row => row.productId === prod.id);
        return `<article class="floqr-fsv-card" data-fsv-product="${esc(prod.id)}">
          <h4 class="floqr-fsv-name">${esc(prod.displayName)}</h4>
          <span class="floqr-fsv-badge ${badgeClass(prod.lifecycleLabel)}">${esc(prod.lifecycleLabel)}</span>
          <p class="floqr-fsv-mission">${esc(prod.mission)}</p>
          <p class="floqr-fsv-note">${esc(t("fsv.dateImplemented", "Date implemented"))}: ${esc(prod.latestRelease)}</p>
          ${prod.presentInRepo === false ? `<p class="floqr-fsv-note">${esc(t("fsv.notAvailable", "Not in this repository. No Try action."))}</p>` : ""}
        </article>`;
      }).join(""))
      : "";
    const grid = st.view === "overview" && !product
      ? `<div class="floqr-fsv-grid">${overviewCards}</div>`
      : st.view === "journey"
        ? journeyHtml(rows)
        : (rows.length
          ? `<div class="floqr-fsv-grid">${rows.map(row => compactCard(row)).join("")}</div>`
          : `<p class="floqr-fsv-empty">${esc(emptyFor(st.view))}</p>`);
    const search = st.view === "all" ? `<form class="floqr-fsv-search" role="search">
      <label class="visually-hidden" for="fsvSearch">${esc(t("fsv.search", "Search features"))}</label>
      <input id="fsvSearch" type="search" value="${esc(st.q)}" placeholder="${esc(t("fsv.search", "Search features"))}"/>
      <label class="visually-hidden" for="fsvLifecycle">${esc(t("fsv.filterLifecycle", "Lifecycle"))}</label>
      <select id="fsvLifecycle">
        <option value="">${esc(t("fsv.filterAll", "All statuses"))}</option>
        ${["concept","planned","in_development","beta","released","deprecated","retired"].map(step =>
          `<option value="${step}"${st.lifecycle === step ? " selected" : ""}>${esc(t("fsv.lifecycle." + step, api.LIFECYCLE_LABELS[step]))}</option>`
        ).join("")}
      </select>
    </form>` : "";
    host.innerHTML = `<div class="floqr-fsv-root" data-fsv-layout="${host.getAttribute("data-fsv-layout") || "page"}">
      ${productHero(product, rows.length, source.warning)}
      ${productSwitcher(proj, st.productId)}
      ${tabs(st.view)}
      ${search}
      ${grid}
      <div class="floqr-fsv-sheet" data-fsv-sheet ${open ? "" : "hidden"}>${open ? detailHtml(open) : ""}</div>
    </div>`;
    bind(host);
    if (open) {
      const sheet = host.querySelector("[data-fsv-sheet]");
      const close = host.querySelector("[data-fsv-close]");
      close && close.focus();
      trapFocus(sheet);
    }
  }

  function trapFocus(sheet) {
    if (!sheet || sheet.hidden) return;
    const nodes = [...sheet.querySelectorAll("button, a, input, select, textarea, [tabindex]:not([tabindex='-1'])")];
    if (!nodes.length) return;
    sheet.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const host = sheet.closest("[id], .botdee-sv-host, .floqr-fsv-mount") || lastHost;
        if (host) {
          setState(host, {featureId: ""});
          render(host);
        }
        return;
      }
      if (event.key !== "Tab") return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && root.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && root.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function askBotDee(featureId) {
    const row = projection(lastHost).features.find(item => item.id === featureId);
    const name = row ? row.productName : "";
    const href = navUrl("./botdee.html", {from: "features-smartview", q: name ? `What can ${name} do?` : "Features SMARTview"});
    if (root.location) root.location.href = href;
  }

  function bind(host) {
    host.querySelectorAll("[data-fsv-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        setState(host, {view: btn.getAttribute("data-fsv-view"), featureId: ""});
        render(host);
      });
    });
    host.querySelectorAll("[data-fsv-product]").forEach(btn => {
      btn.addEventListener("click", () => {
        setState(host, {productId: btn.getAttribute("data-fsv-product") || "", featureId: ""});
        render(host);
      });
    });
    host.querySelectorAll("[data-fsv-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        setState(host, {featureId: btn.getAttribute("data-fsv-open")});
        render(host);
      });
    });
    host.querySelectorAll("[data-fsv-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        setState(host, {featureId: ""});
        render(host);
      });
    });
    host.querySelectorAll("[data-fsv-ask]").forEach(btn => {
      btn.addEventListener("click", () => askBotDee(btn.getAttribute("data-fsv-ask")));
    });
    host.querySelectorAll("[data-fsv-view-jump]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.stopPropagation();
        const view = btn.getAttribute("data-fsv-view-jump") || "overview";
        setState(host, {view});
        render(host);
      });
    });
    const form = host.querySelector(".floqr-fsv-search");
    const input = host.querySelector("#fsvSearch");
    const lifecycle = host.querySelector("#fsvLifecycle");
    if (form && input) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        setState(host, {q: input.value, lifecycle: lifecycle ? lifecycle.value : ""});
        render(host);
      });
    }
    if (lifecycle) {
      lifecycle.addEventListener("change", () => {
        setState(host, {lifecycle: lifecycle.value, q: input ? input.value : ""});
        render(host);
      });
    }
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    if (root.__FLOQR_FEATURES_SMARTVIEW_CATALOG) {
      catalog = root.__FLOQR_FEATURES_SMARTVIEW_CATALOG;
      return catalog;
    }
    const response = await fetch(CATALOG_URL, {cache: "no-store"});
    if (!response.ok) throw new Error("Could not load Features catalog.");
    catalog = await response.json();
    root.__FLOQR_FEATURES_SMARTVIEW_CATALOG = catalog;
    return catalog;
  }

  async function mount(hostId, opts) {
    const host = typeof hostId === "string" ? root.document.getElementById(hostId) : hostId;
    if (!host) return;
    lastHost = host;
    host.classList.add("floqr-fsv-mount");
    host.textContent = "Loading Features catalog…";
    try {
      await loadCatalog();
      if (opts && opts.productId) host.setAttribute("data-fsv-product", opts.productId);
      if (opts && opts.view) host.setAttribute("data-fsv-view", opts.view);
      if (opts && opts.featureId) host.setAttribute("data-fsv-feature", opts.featureId);
      if (!host.getAttribute("data-fsv-view")) host.setAttribute("data-fsv-view", "overview");
      render(host);
    } catch (error) {
      host.textContent = error.message || "Could not load Features catalog.";
    }
  }

  function snapshotFromPayload(payload) {
    return {
      schemaVersion: payload.schemaVersion || "",
      catalogVersion: payload.catalogVersion || 1,
      warning: payload.warning || "",
      products: payload.products || [],
      features: payload.features || []
    };
  }

  function mountPayload(host, payload) {
    if (!host || !payload) return;
    lastHost = host;
    host.classList.add("floqr-fsv-mount");
    // Per-host snapshot only. A retrieve payload is product-filtered and capped at 12;
    // never assign it to the module-wide catalog used by later cards in this session.
    host.__fsvSnapshot = snapshotFromPayload(payload);
    if (payload.productId) host.setAttribute("data-fsv-product", payload.productId);
    if (payload.view) host.setAttribute("data-fsv-view", payload.view);
    render(host);
  }

  root.FLOQRFeaturesSmartView = {
    mount,
    mountPayload,
    loadCatalog,
    badge: function (product) {
      const api = core();
      if (!api) return "Status not verified";
      if (product && product.presentInRepo === false) return api.STATUS_NOT_VERIFIED;
      return api.lifecycleLabel(product && product.lifecycle, !!(product && product.statusVerified));
    },
    _fsvFull: true
  };
})(typeof window !== "undefined" ? window : globalThis);
