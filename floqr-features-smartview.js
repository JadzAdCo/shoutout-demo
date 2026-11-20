/* FLOQR Features SMARTview — evidence-backed product catalog cards.
   Dates stay "Not verified" until a reviewer attaches deployment proof. */
(function (root) {
  "use strict";
  if (root.FLOQRFeaturesSmartView) return;

  const CATALOG_URL = "./features-smartview/catalog.json";
  let catalog = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[ch]));
  }

  function badge(product) {
    if (product.presentInRepo === false) return "Status not verified";
    if (!product.statusVerified) return "Status not verified";
    const map = {
      private_beta: "Private beta",
      public_beta: "Public beta",
      in_development: "In development",
      released: "Released",
      unverified: "Status not verified"
    };
    return map[product.lifecycle] || "Status not verified";
  }

  function cardHtml(product) {
    const missing = product.presentInRepo === false
      ? `<p class="floqr-fsv-note">Not in this repository. No Try action.</p>`
      : `<p class="floqr-fsv-note">Date implemented: Not verified</p>`;
    return `<article class="floqr-fsv-card" data-fsv-product="${esc(product.id)}">
      <h4 class="floqr-fsv-name">${esc(product.displayName)}</h4>
      <span class="floqr-fsv-badge">${esc(badge(product))}</span>
      <p class="floqr-fsv-mission">${esc(product.mission || "")}</p>
      ${missing}
    </article>`;
  }

  function featureHtml(row) {
    return `<article class="floqr-fsv-card">
      <h4 class="floqr-fsv-name">${esc(row.title)}</h4>
      <span class="floqr-fsv-badge">Status not verified</span>
      <p class="floqr-fsv-mission">${esc(row.shortDescription || row.accomplishment || "")}</p>
      <p class="floqr-fsv-note">Available to me: not verified from live flags. Date implemented: Not verified.</p>
    </article>`;
  }

  function render(host, view) {
    if (!host || !catalog) return;
    const products = catalog.products || [];
    const features = catalog.features || [];
    const body = view === "features"
      ? (features.length ? `<div class="floqr-fsv-grid">${features.map(featureHtml).join("")}</div>`
        : `<p class="floqr-fsv-empty">No published feature copy yet.</p>`)
      : `<div class="floqr-fsv-grid">${products.map(cardHtml).join("")}</div>`;
    host.innerHTML = `<div class="floqr-fsv-root">
      <div class="floqr-fsv-hero">
        <h3>Features SMARTview</h3>
        <p class="floqr-fsv-note">${esc(catalog.warning || "")}</p>
      </div>
      <div class="floqr-fsv-tabs" role="tablist">
        <button type="button" class="buttonlike" data-fsv-view="products" aria-selected="${view !== "features"}">Overview</button>
        <button type="button" class="buttonlike" data-fsv-view="features" aria-selected="${view === "features"}">All Features</button>
      </div>
      ${body}
    </div>`;
    host.querySelectorAll("[data-fsv-view]").forEach(btn => {
      btn.addEventListener("click", () => render(host, btn.dataset.fsvView));
    });
  }

  async function loadCatalog() {
    if (catalog) return catalog;
    const response = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load Features catalog.");
    catalog = await response.json();
    return catalog;
  }

  async function mount(hostId) {
    const host = typeof hostId === "string" ? root.document.getElementById(hostId) : hostId;
    if (!host) return;
    host.textContent = "Loading Features catalog…";
    try {
      await loadCatalog();
      render(host, "products");
    } catch (error) {
      host.textContent = error.message || "Could not load Features catalog.";
    }
  }

  root.FLOQRFeaturesSmartView = { mount, loadCatalog, badge };
})(typeof window !== "undefined" ? window : globalThis);
