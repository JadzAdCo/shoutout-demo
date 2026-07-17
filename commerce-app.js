/* BartR shared marketplace frontend v29.09.8 — discovery + FloqR MoR checkout; seller tools live in patron portal. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(cents || 0) / 100);
  const setStatus = value => {
    const el = byId("commerceStatus");
    if (!el) return;
    const text = value == null ? "" : String(value);
    el.textContent = text;
    el.classList.toggle("hidden", !text.trim());
  };
  if (!window.firebaseConfig) return setStatus("Firebase configuration is missing.");
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let products = [];

  function shuffle(list) {
    const rows = Array.isArray(list) ? list.slice() : [];
    for (let i = rows.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows;
  }

  function isUsMarketplaceCountry(country = "") {
    const value = String(country || "").trim().toLowerCase();
    return ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america"].includes(value);
  }

  async function loadMarketplaceProducts() {
    const snap = await db.collection("commerceProducts").where("active", "==", true).limit(120).get();
    const rows = snap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    // US marketplace only — prefer explicit sellerCountry; drop unknown non-US when tagged.
    products = shuffle(rows.filter(product => {
      const country = product.sellerCountry || product.marketplaceCountry || "";
      if (!country) return true;
      return isUsMarketplaceCountry(country);
    }));
    renderProducts();
  }

  function previewMarkup(product = {}) {
    if (!product.imageUrl) return `<span>${esc((product.category || "Item").slice(0, 1))}</span>`;
    if (product.previewMediaType === "video") {
      return `<video src="${esc(product.imageUrl)}" controls muted playsinline preload="metadata" aria-label="${esc(product.name || "Video preview")}"></video>`;
    }
    return `<img src="${esc(product.imageUrl)}" alt="${esc(product.name || "Product")}"/>`;
  }

  function renderProducts() {
    const search = String(byId("commerceSearch")?.value || "").trim().toLowerCase();
    const category = byId("commerceCategory")?.value || "";
    const rows = products
      .filter(product => product.active !== false)
      .filter(product => !category || product.category === category)
      .filter(product => !search || `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.sellerName || ""} ${product.mediaLicense || ""}`.toLowerCase().includes(search));
    const grid = byId("commerceProductGrid");
    if (!grid) return;
    grid.innerHTML = rows.length ? rows.map(product => `<article class="card commerce-product-card">
      <div class="commerce-product-media">${previewMarkup(product)}</div>
      <p class="eyebrow">${esc(product.category || "Product")}</p>
      <h2>${esc(product.name || "Product")}</h2>
      <p class="sub">${esc(product.description || "")}</p>
      <p class="sub small">Vendor: ${esc(product.sellerName || "BartR vendor")}</p>
      ${product.productType && product.productType !== "physical" ? `<div class="badge-row"><span>Digital media</span><span>${esc(product.mediaLicense || "personal")} license</span></div>` : ""}
      <div class="commerce-product-buy"><strong>${money(product.priceCents)}</strong><span>${Number(product.inventory || 0)} available</span></div>
      <div class="queue-actions">
        <button type="button" class="primary" data-buy-product="${esc(product.id)}" ${Number(product.inventory || 0) === 0 ? "disabled" : ""}>Buy with Apple Pay / Card</button>
      </div>
    </article>`).join("") : `<div class="card"><h2>No BartR products yet</h2><p class="sub">US vendors publish from My Profile and Settings → BartR Store. FloqR collects payment; vendors ship.</p></div>`;
    document.querySelectorAll("[data-buy-product]").forEach(button => {
      button.addEventListener("click", () => checkout(button.dataset.buyProduct));
    });
  }

  async function checkout(productId) {
    try {
      await window.FLOQRPayments.startCheckout({
        orderType: "commerce",
        payload: { productId, quantity: 1 },
        status: setStatus
      });
    } catch (error) {
      setStatus(error?.message || String(error));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("commerceGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("commerceSearch")?.addEventListener("input", renderProducts);
    byId("commerceCategory")?.addEventListener("change", renderProducts);
    auth.onAuthStateChanged(async user => {
      byId("commerceLogin")?.classList.toggle("hidden", !!user);
      byId("commercePanel")?.classList.toggle("hidden", !user);
      if (!user) return setStatus("Sign in to shop BartR.");
      try {
        setStatus("Loading BartR…");
        await loadMarketplaceProducts();
        setStatus("");
      } catch (error) {
        setStatus(error?.message || String(error));
      }
    });
  });
})();
