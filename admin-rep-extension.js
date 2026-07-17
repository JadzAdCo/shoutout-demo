/* FLOQR Club Role Activity & Permission (REP) v29.07. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const locationId = new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("panelRep")) return;
  const auth = firebase.auth(), db = firebase.firestore();
  let designations = [], activities = [], notificationSettings = {};
  const permissionOptions = [
    ["manageGuestLists", "Create and manage guest lists"],
    ["postPublicContent", "Post to the club public page"],
    ["customerSupport", "Act as a Customer Service Representative"],
    ["manageCommerce", "Manage club Commerce products and orders"]
  ];

  function roleName(row = {}) { return row.roleElectionType || (row.workerRoles || [])[0] || "Club Worker"; }

  function renderPolicies() {
    const wrap = byId("repRolePolicies");
    if (!wrap) return;
    wrap.innerHTML = designations.length ? designations.map(row => {
      const permissions = new Set(row.rolePermissions || []);
      return `<article class="queue-item rep-worker-policy" data-rep-id="${esc(row.id)}"><div class="message-envelope-head"><strong>${esc(row.workerName || row.workerEmail || "Club worker")}</strong><span>${esc(roleName(row))}</span></div><div class="privacy-datapoint-grid">${permissionOptions.map(([key,label]) => `<label><input type="checkbox" data-rep-permission="${key}" ${permissions.has(key) ? "checked" : ""}/> ${esc(label)}</label>`).join("")}<label><input type="checkbox" data-rep-approval ${row.requireApproval !== false ? "checked" : ""}/> Club Admin must approve this worker’s postings</label></div></article>`;
    }).join("") : `<p class="sub">Approve or elect workers on Employee/Workers before assigning REP duties.</p>`;
  }

  function renderActivities() {
    const wrap = byId("repPendingActivity");
    if (!wrap) return;
    const pending = activities.filter(row => String(row.status || "pendingApproval") === "pendingApproval");
    wrap.innerHTML = pending.length ? pending.map(row => `<article class="queue-item"><div class="message-envelope-head"><strong>${esc(row.payload?.campaignName || row.payload?.title || row.actionType || "Role activity")}</strong><span>${esc(row.submittedByRole || "Club worker")}</span></div><p>${esc(row.payload?.description || row.payload?.body || "")}</p><small>${esc(row.payload?.audienceMode || "followers")}</small><div class="queue-actions"><button type="button" data-rep-activity="${esc(row.id)}" data-rep-status="approved">Approve</button><button type="button" data-rep-activity="${esc(row.id)}" data-rep-status="rejected">Reject</button></div></article>`).join("") : `<p class="sub">No role activity is waiting for approval.</p>`;
    wrap.querySelectorAll("[data-rep-activity]").forEach(button => button.addEventListener("click", () => reviewActivity(button.dataset.repActivity, button.dataset.repStatus)));
  }

  async function loadRep() {
    const [designationSnap, activitySnap, notificationSnap] = await Promise.all([
      db.collection("clubEmployeeDesignations").where("clubLocationId", "==", locationId).limit(200).get(),
      db.collection("clubRoleActivity").where("clubLocationId", "==", locationId).limit(200).get(),
      db.collection("clubNotificationSettings").doc(locationId).get()
    ]);
    designations = designationSnap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    activities = activitySnap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    notificationSettings = notificationSnap.exists ? notificationSnap.data() || {} : {};
    renderPolicies(); renderActivities();
    byId("repNotifyInApp").checked = notificationSettings.inApp !== false;
    byId("repNotifyPush").checked = !!notificationSettings.push;
    byId("repNotifyEmail").checked = !!notificationSettings.email;
    byId("repNotifySms").checked = !!notificationSettings.smsEnabled;
  }

  async function savePolicies() {
    const batch = db.batch();
    document.querySelectorAll(".rep-worker-policy").forEach(card => {
      const permissions = Array.from(card.querySelectorAll("[data-rep-permission]:checked")).map(input => input.dataset.repPermission);
      batch.set(db.collection("clubEmployeeDesignations").doc(card.dataset.repId), {rolePermissions:permissions, requireApproval:!!card.querySelector("[data-rep-approval]")?.checked, updatedByUid:auth.currentUser?.uid || "", updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    });
    await batch.commit();
    byId("repStatus").textContent = "Individual duties and approval requirements saved.";
    await loadRep();
  }

  async function reviewActivity(id, status) {
    const activity = activities.find(row => row.id === id);
    if (!activity) return;
    if (status === "approved" && activity.actionType === "guestListCampaign") {
      const payload = activity.payload || {};
      if (payload.audienceMode === "targetedFloqr") {
        await db.collection("clubRoleActivity").doc(id).set({status:"approvedAwaitingPayment", reviewedByUid:auth.currentUser.uid, reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
        const checkoutCampaign = {...payload, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()};
        await window.FLOQRPayments.startCheckout({orderType:"targetedGuestList", payload:{clubLocationId:locationId, campaign:checkoutCampaign, targetUserCount:Number(payload.targetUserCount || 0)}, status:message => { byId("repStatus").textContent = message; }});
        return;
        await db.collection("inboxNotifications").add({recipientUid:activity.submittedByUid, type:"repApproval", title:"Campaign approved — payment required", body:`${payload.campaignName || "Guest list campaign"} is approved. Complete targeted FloqR payment before publication.`, link:`./admin.html?location=${encodeURIComponent(locationId)}&v=29.09.8`, read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      } else {
        const campaignRef = await db.collection("guestListCampaigns").add({...payload, status:"enabled", active:true, approvedByUid:auth.currentUser.uid, approvedAt:firebase.firestore.FieldValue.serverTimestamp(), createdAt:firebase.firestore.FieldValue.serverTimestamp(), updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        const result = await window.FLOQRPayments.publishFollowerCampaign({entityId:locationId, campaign:{title:payload.campaignName || "Guest List", body:payload.description || "A new guest list is open.", campaignType:"guestList", sourceCampaignId:campaignRef.id, link:`./guest-list.html?location=${encodeURIComponent(locationId)}&campaign=${encodeURIComponent(campaignRef.id)}&v=29.09.8`}});
        await campaignRef.set({deliveredCount:result.deliveredCount || 0}, {merge:true});
        await db.collection("clubRoleActivity").doc(id).set({status:"approved", publishedCampaignId:campaignRef.id, reviewedByUid:auth.currentUser.uid, reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
      }
    } else {
      await db.collection("clubRoleActivity").doc(id).set({status, reviewedByUid:auth.currentUser.uid, reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }
    await loadRep();
  }

  async function saveNotifications() {
    const wantsSms = byId("repNotifySms").checked;
    await db.collection("clubNotificationSettings").doc(locationId).set({inApp:byId("repNotifyInApp").checked, push:byId("repNotifyPush").checked, email:byId("repNotifyEmail").checked, smsRequested:wantsSms, smsEnabled:wantsSms && !!notificationSettings.smsPaidAt, updatedByUid:auth.currentUser.uid, updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    if (wantsSms && !notificationSettings.smsPaidAt) {
      byId("repStatus").textContent = "SMS selected. Opening the $10 service checkout…";
      await window.FLOQRPayments.startCheckout({orderType:"smsNotifications", payload:{clubLocationId:locationId}, status:message => { byId("repStatus").textContent = message; }});
      return;
    }
    byId("repStatus").textContent = "Club Admin notification choices saved.";
    await loadRep();
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("saveRepPoliciesBtn")?.addEventListener("click", () => savePolicies().catch(error => { byId("repStatus").textContent = error.message; }));
    byId("saveRepNotificationsBtn")?.addEventListener("click", () => saveNotifications().catch(error => { byId("repStatus").textContent = error.message; }));
    auth.onAuthStateChanged(user => { if (user) loadRep().catch(error => { byId("repStatus").textContent = error.message; }); });
  });
})();
