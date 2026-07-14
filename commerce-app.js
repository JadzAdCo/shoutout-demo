/* FLOQR Commerce storefront and seller tools v29.07. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(location.href).searchParams.get(name) || "";
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(cents || 0) / 100);
  const setStatus = value => { if (byId("commerceStatus")) byId("commerceStatus").textContent = value; };
  if (!window.firebaseConfig) return setStatus("Firebase configuration is missing.");
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let entityId = qs("seller") || qs("club") || "";
  let entityType = qs("club") ? "club" : "member";
  let entity = {};
  let products = [];
  let sellerOrders = [];
  let canManage = false;

  function sellerName() { return entity.commerceStoreName || entity.locationName || entity.displayName || entity.publicName || "FLOQR Marketplace"; }

  async function resolveEntity(user) {
    if (!entityId) entityId = user.uid;
    if (entityType === "club") {
      const snap = await db.collection("clubLocations").doc(entityId).get();
      entity = snap.exists ? {id:snap.id, ...snap.data()} : (window.SHOUTOUT_CLUB_LOCATIONS || {})[entityId] || {};
      const assignmentId = `${entityId}_${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const assignment = await db.collection("clubAdminAssignments").doc(assignmentId).get().catch(() => null);
      canManage = (entity.adminUids || []).includes(user.uid) || !!assignment?.exists;
    } else {
      const snap = await db.collection("users").doc(entityId).get();
      entity = snap.exists ? {id:snap.id, ...snap.data()} : {};
      canManage = entityId === user.uid;
    }
    byId("commerceStoreName").textContent = sellerName();
    byId("commerceSellerPanel").classList.toggle("hidden", !canManage);
  }

  async function loadProducts() {
    const [productSnap, orderSnap] = await Promise.all([
      db.collection("commerceProducts").where("sellerEntityId", "==", entityId).limit(100).get(),
      canManage ? db.collection("serviceOrders").where("sellerEntityId", "==", entityId).limit(100).get().catch(() => null) : Promise.resolve(null)
    ]);
    products = productSnap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    sellerOrders = orderSnap ? orderSnap.docs.map(doc => ({id:doc.id, ...doc.data()})) : [];
    renderProducts();
    renderSellerOrders();
  }

  function renderSellerOrders() {
    const wrap = byId("commerceOrdersReport");
    if (!wrap || !canManage) return;
    const paid = sellerOrders.filter(order => order.paymentStatus === "paid");
    wrap.innerHTML = paid.length ? paid.map(order => `<article class="queue-item"><div class="message-envelope-head"><strong>${esc(order.itemName || order.productSnapshot?.name || "Commerce sale")}</strong><span>${esc(order.shippingStatus || order.fulfillmentStatus || "paid")}</span></div><p>${esc(order.invoiceNumber || order.id)} - ${money(order.amountCents)}</p><small>${order.mediaLicense ? `${esc(order.mediaLicense)} media license | ` : ""}${esc(order.customerEmail || order.ownerEmail || "Customer")}</small></article>`).join("") : `<p class="sub">No paid sales yet.</p>`;
  }

  function previewMarkup(product = {}) {
    if (!product.imageUrl) return `<span>${esc((product.category || "Item").slice(0,1))}</span>`;
    if (product.previewMediaType === "video") return `<video src="${esc(product.imageUrl)}" controls muted playsinline preload="metadata" aria-label="${esc(product.name || "Video preview")}"></video>`;
    return `<img src="${esc(product.imageUrl)}" alt="${esc(product.name || "Product")}"/>`;
  }

  function renderProducts() {
    const search = String(byId("commerceSearch")?.value || "").trim().toLowerCase();
    const category = byId("commerceCategory")?.value || "";
    const rows = products.filter(product => product.active !== false)
      .filter(product => !category || product.category === category)
      .filter(product => !search || `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.mediaLicense || ""} ${product.productType || ""}`.toLowerCase().includes(search));
    byId("commerceProductGrid").innerHTML = rows.length ? rows.map(product => `<article class="card commerce-product-card">
      <div class="commerce-product-media">${previewMarkup(product)}</div>
      <p class="eyebrow">${esc(product.category || "Product")}</p><h2>${esc(product.name || "Product")}</h2><p class="sub">${esc(product.description || "")}</p>
      ${product.productType && product.productType !== "physical" ? `<div class="badge-row"><span>Digital media</span><span>${esc(product.mediaLicense || "personal")} license</span></div>` : ""}
      <div class="commerce-product-buy"><strong>${money(product.priceCents)}</strong><span>${Number(product.inventory || 0)} available</span></div>
      <div class="queue-actions"><button type="button" class="primary" data-buy-product="${esc(product.id)}" ${Number(product.inventory || 0) === 0 ? "disabled" : ""}>Buy with Apple Pay / Card</button>${canManage ? `<button type="button" data-toggle-product="${esc(product.id)}">Deactivate</button>` : ""}</div>
    </article>`).join("") : `<div class="card"><h2>No products found</h2><p class="sub">This commerce site is ready for the seller’s first product.</p></div>`;
    document.querySelectorAll("[data-buy-product]").forEach(button => button.addEventListener("click", () => checkout(button.dataset.buyProduct)));
    document.querySelectorAll("[data-toggle-product]").forEach(button => button.addEventListener("click", () => toggleProduct(button.dataset.toggleProduct)));
  }

  async function checkout(productId) {
    try {
      await window.FLOQRPayments.startCheckout({orderType:"commerce", payload:{productId, quantity:1}, status:setStatus});
    } catch (error) { setStatus(error?.message || String(error)); }
  }

  async function toggleProduct(productId) {
    await db.collection("commerceProducts").doc(productId).set({active:false, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    setStatus("Product deactivated.");
    await loadProducts();
  }

  async function saveProduct() {
    try {
      if (!canManage) throw new Error("Only the store owner can publish products.");
      const name = byId("commerceProductName").value.trim();
      const priceCents = Math.round(Number(byId("commerceProductPrice").value || 0) * 100);
      const productType = byId("commerceProductType").value || "physical";
      if (!name || priceCents < 50) throw new Error("Add a product name and a price of at least $0.50.");
      await db.collection("commerceProducts").add({
        sellerEntityId:entityId,
        sellerEntityType:entityType,
        sellerUid:auth.currentUser.uid,
        sellerName:sellerName(),
        stripeConnectAccountId:entity.stripeConnectAccountId || "",
        name,
        category:byId("commerceProductCategory").value,
        productType,
        previewMediaType:byId("commerceProductPreviewType").value || "image",
        mediaLicense:byId("commerceProductLicense").value || "personal",
        priceCents,
        inventory:Math.max(0, Number(byId("commerceProductInventory").value || 0)),
        imageUrl:byId("commerceProductImage").value.trim(),
        description:byId("commerceProductDescription").value.trim(),
        requiresShipping:productType === "physical" && byId("commerceProductShipping").checked,
        active:true,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      setStatus("Product published.");
      ["commerceProductName","commerceProductPrice","commerceProductImage","commerceProductDescription"].forEach(id => { byId(id).value = ""; });
      await loadProducts();
    } catch (error) { setStatus(error?.message || String(error)); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const updateProductType = () => {
      const type = byId("commerceProductType")?.value || "physical";
      const digital = type !== "physical";
      if (byId("commerceProductShipping")) { byId("commerceProductShipping").disabled = digital; byId("commerceProductShipping").checked = !digital; }
      if (type === "photoLicense") { byId("commerceProductCategory").value = "Photography"; byId("commerceProductPreviewType").value = "image"; }
      if (type === "videoLicense") { byId("commerceProductCategory").value = "Video"; byId("commerceProductPreviewType").value = "video"; }
    };
    byId("commerceGoogleLoginBtn")?.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
    byId("commerceSearch")?.addEventListener("input", renderProducts);
    byId("commerceCategory")?.addEventListener("change", renderProducts);
    byId("commerceSaveProductBtn")?.addEventListener("click", saveProduct);
    byId("commerceProductType")?.addEventListener("change", updateProductType);
    updateProductType();
    auth.onAuthStateChanged(async user => {
      byId("commerceLogin").classList.toggle("hidden", !!user);
      byId("commercePanel").classList.toggle("hidden", !user);
      if (!user) return setStatus("Sign in to shop or manage your store.");
      try { await resolveEntity(user); await loadProducts(); setStatus("Store ready."); } catch (error) { setStatus(error?.message || String(error)); }
    });
  });
})();
