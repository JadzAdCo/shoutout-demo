/* FLOQR Master Admin paid services, invoices, shipping, and analytics v29.07. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(Number(cents || 0) / 100);
  if (!window.firebase || !byId("servicesCommerce")) return;
  const auth = firebase.auth(), db = firebase.firestore();
  let orders = [], campaigns = [], pickups = [];
  function rows(values) { return `<div class="report-table">${values.map(([label,value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`; }

  async function collection(name, limit = 500) {
    try { const snap = await db.collection(name).limit(limit).get(); return snap.docs.map(doc => ({id:doc.id, ...doc.data()})); } catch (error) { return []; }
  }

  function render() {
    const paid = orders.filter(order => order.paymentStatus === "paid");
    byId("serviceOrderCount").textContent = String(paid.length);
    byId("serviceGrossRevenue").textContent = money(paid.reduce((sum, order) => sum + Number(order.amountCents || 0), 0));
    byId("serviceFloqrShare").textContent = money(paid.reduce((sum, order) => sum + Number(order.floqrShareCents ?? order.amountCents ?? 0), 0));
    byId("serviceEntityPayable").textContent = money(paid.reduce((sum, order) => sum + Number(order.venueShareCents || 0), 0));
    byId("serviceOrdersReport").innerHTML = orders.length ? orders.sort((a,b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0)).map(order => `<article class="queue-item service-order-row"><div class="message-envelope-head"><strong>${esc(order.itemName || order.orderType || "Service order")}</strong><span>${esc(order.paymentStatus || order.status || "pending")}</span></div><p>${esc(order.invoiceNumber || order.id)} - ${money(order.amountCents)}</p><small>Customer: ${esc(order.customerEmail || order.ownerEmail || order.ownerUid || "-")} | FloqR: ${money(order.floqrShareCents ?? order.amountCents)} | Entity: ${money(order.venueShareCents || 0)}${order.mediaLicense ? ` | License: ${esc(order.mediaLicense)}` : ""}</small><div class="profile-grid"><label>Fulfillment / shipping status<select data-order-status="${esc(order.id)}"><option value="paid-awaiting-fulfillment" ${order.shippingStatus === "paid-awaiting-fulfillment" ? "selected" : ""}>Paid - awaiting fulfillment</option><option value="digital-delivery-pending" ${order.shippingStatus === "digital-delivery-pending" ? "selected" : ""}>Digital delivery pending</option><option value="digital-delivered" ${order.shippingStatus === "digital-delivered" ? "selected" : ""}>Digital media delivered</option><option value="processing" ${order.shippingStatus === "processing" ? "selected" : ""}>Processing</option><option value="shipped" ${order.shippingStatus === "shipped" ? "selected" : ""}>Shipped</option><option value="delivered" ${order.shippingStatus === "delivered" ? "selected" : ""}>Delivered</option><option value="not-required" ${order.shippingStatus === "not-required" ? "selected" : ""}>Not required</option></select></label><label>Carrier / delivery method<input data-order-carrier="${esc(order.id)}" value="${esc(order.shippingCarrier || "")}" placeholder="Secure link, UPS, USPS, FedEx"/></label><label>Tracking / delivery reference<input data-order-tracking="${esc(order.id)}" value="${esc(order.trackingNumber || "")}"/></label><label>Tracking or secure delivery URL<input data-order-tracking-url="${esc(order.id)}" value="${esc(order.trackingUrl || "")}"/></label></div><button type="button" data-save-order="${esc(order.id)}">Save Fulfillment</button></article>`).join("") : `<p class="sub">No paid-service orders yet.</p>`;
    document.querySelectorAll("[data-save-order]").forEach(button => button.addEventListener("click", () => saveOrder(button.dataset.saveOrder)));
    const totalAudience = campaigns.reduce((sum,row) => sum + Number(row.deliveredCount || row.targetUserCount || 0), 0);
    const spend = campaigns.reduce((sum,row) => sum + Number(row.amountCents || 0), 0);
    byId("serviceCampaignAnalytics").innerHTML = rows([["Campaigns", campaigns.length.toLocaleString()], ["Follower campaigns", campaigns.filter(row => row.audienceMode === "followers").length.toLocaleString()], ["Targeted campaigns", campaigns.filter(row => row.audienceMode === "targetedFloqr").length.toLocaleString()], ["Total audience", totalAudience.toLocaleString()], ["Distribution revenue", money(spend)], ["Targeted rate", "$0.10 per patron"]]);
    byId("pickupAnalyticsReport").innerHTML = rows([["Pickup requests", pickups.length.toLocaleString()], ["Robotaxi simulations", pickups.filter(row => row.simulation === true || /tesla.*robotaxi/i.test(row.provider || "")).length.toLocaleString()], ["On-demand", pickups.filter(row => row.booking?.mode === "onDemand").length.toLocaleString()], ["Scheduled", pickups.filter(row => row.booking?.mode === "scheduled").length.toLocaleString()], ["For a Flocker", pickups.filter(row => row.booking?.mode === "forAnother").length.toLocaleString()], ["Shared", pickups.filter(row => row.booking?.mode === "shared").length.toLocaleString()], ["Live partner bookings", "0 - official partner API pending"]]);
  }

  async function saveOrder(id) {
    const shippingStatus = document.querySelector(`[data-order-status="${CSS.escape(id)}"]`)?.value || "processing";
    const shippingCarrier = document.querySelector(`[data-order-carrier="${CSS.escape(id)}"]`)?.value.trim() || "";
    const trackingNumber = document.querySelector(`[data-order-tracking="${CSS.escape(id)}"]`)?.value.trim() || "";
    const trackingUrl = document.querySelector(`[data-order-tracking-url="${CSS.escape(id)}"]`)?.value.trim() || "";
    await db.collection("serviceOrders").doc(id).set({shippingStatus, fulfillmentStatus:shippingStatus, shippingCarrier, trackingNumber, trackingUrl, updatedByUid:auth.currentUser.uid, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    const order = orders.find(row => row.id === id);
    if (order?.ownerUid) await db.collection("inboxNotifications").add({recipientUid:order.ownerUid, type:"orderTracking", title:"FLOQR order update", body:`${order.invoiceNumber || id}: ${shippingStatus}${trackingNumber ? ` - ${trackingNumber}` : ""}`, link:trackingUrl || "./patron-portal.html?tab=paid-services&v=29.09.8", read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await load();
  }

  async function load() { [orders, campaigns, pickups] = await Promise.all([collection("serviceOrders", 750), collection("audienceCampaigns", 750), collection("pickupRequests", 750)]); render(); }
  document.addEventListener("DOMContentLoaded", () => auth.onAuthStateChanged(user => { if (user) load(); }));
})();
