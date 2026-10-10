/* FLOQR Club Role Activity & Permission (REP) v29.09.10 — policies only; Notifications live on their own tab. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const locationId = new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("panelRep")) return;
  const auth = firebase.auth(), db = firebase.firestore();
  let designations = [], activities = [];
  const permissionOptions = [
    ["manageGuestLists", "Create and manage guest lists"],
    ["manageSchedules", "Create and manage staff schedules"],
    ["postPublicContent", "Post to the club public page"],
    ["customerSupport", "Act as a Customer Service Representative"],
    ["manageCommerce", "Manage club Commerce products and orders"],
    ["postAds", "Post in-app ads on behalf of the club (Club Ad Poster)"],
    ["administerTemplates", "Administer Templates — Template Administrator: read, add and remove template tags"],
    ["manageTemplates", "Manage Templates — Template Manager: read and add template tags"]
  ];
  const repLabel = (key, fallback) => {
    const out = window.FLOQRI18n?.t?.(`rep.${key}`);
    return out && out !== `rep.${key}` ? out : fallback;
  };

  function roleName(row = {}) { return row.roleElectionType || (row.workerRoles || [])[0] || "Club Worker"; }

  function renderPolicies() {
    const wrap = byId("repRolePolicies");
    if (!wrap) return;
    wrap.innerHTML = designations.length ? designations.map(row => {
      const permissions = new Set(row.rolePermissions || []);
      return `<article class="queue-item rep-worker-policy" data-rep-id="${esc(row.id)}"><div class="message-envelope-head"><strong>${esc(row.workerName || row.workerEmail || "Club worker")}</strong><span>${esc(roleName(row))}</span></div><div class="privacy-datapoint-grid">${permissionOptions.map(([key,label]) => `<label><input type="checkbox" data-rep-permission="${key}" ${permissions.has(key) ? "checked" : ""}/> ${esc(repLabel(key, label))}</label>`).join("")}<label><input type="checkbox" data-rep-approval ${row.requireApproval !== false ? "checked" : ""}/> Club Admin must approve this worker's postings</label></div></article>`;
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
    const [designationSnap, activitySnap] = await Promise.all([
      db.collection("clubEmployeeDesignations").where("clubLocationId", "==", locationId).limit(200).get(),
      db.collection("clubRoleActivity").where("clubLocationId", "==", locationId).limit(200).get()
    ]);
    designations = designationSnap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    activities = activitySnap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    renderPolicies();
    renderActivities();
  }

  /** postAds is enforced server-side through adPosterDelegations (setClubAdPoster), not by this checkbox alone. */
  async function syncAdPosters(changes) {
    if (!changes.length) return [];
    const setPoster = firebase.app().functions("us-central1").httpsCallable("setClubAdPoster");
    const failures = [];
    for (const change of changes) {
      try {
        await setPoster({clubLocationId: locationId, uid: change.uid, email: change.email, enabled: change.enabled});
      } catch (error) {
        failures.push(`${change.email || change.uid}: ${error?.message || error}`);
      }
    }
    return failures;
  }

  /** Template roles live in venueTemplateRoles (rules-enforced); the REP checkbox is only the editor. */
  async function syncTemplateRoles(changes) {
    const TT = window.FLOQRTemplateTags;
    if (!changes.length || !TT) return [];
    const user = auth.currentUser;
    const failures = [];
    for (const change of changes) {
      try {
        await db.collection("venueTemplateRoles").doc(TT.roleDocId(locationId, change.uid)).set({
          clubLocationId: locationId,
          uid: change.uid,
          email: String(change.email || "").toLowerCase(),
          displayName: change.name || "",
          role: change.role || change.previousRole,
          status: change.role ? "active" : "revoked",
          grantedByUid: user.uid,
          grantedByEmail: String(user.email || "").toLowerCase(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (change.role) {
          const roleName = change.role === "administrator" ? "Template Administrator" : "Template Manager";
          await db.collection("inboxNotifications").add({
            type: "templateRole",
            title: `You are now a ${roleName}`,
            subject: `You are now a ${roleName}`,
            body: change.role === "administrator"
              ? "You can add and remove search tags on this venue's templates."
              : "You can add search tags to this venue's templates.",
            recipientUid: change.uid,
            recipientEmail: String(change.email || "").toLowerCase(),
            createdByUid: firebase.auth().currentUser?.uid || "",
            clubLocationId: locationId,
            link: `./template-tags.html?location=${encodeURIComponent(locationId)}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (error) {
        failures.push(`${change.email || change.uid}: ${error?.message || error}`);
      }
    }
    return failures;
  }

  async function savePolicies() {
    const batch = db.batch();
    const adChanges = [];
    const templateChanges = [];
    const TT = window.FLOQRTemplateTags;
    document.querySelectorAll(".rep-worker-policy").forEach(card => {
      const permissions = Array.from(card.querySelectorAll("[data-rep-permission]:checked")).map(input => input.dataset.repPermission);
      const row = designations.find(item => item.id === card.dataset.repId) || {};
      const hadAds = (row.rolePermissions || []).includes("postAds");
      const hasAds = permissions.includes("postAds");
      if (hadAds !== hasAds) adChanges.push({uid: row.workerUid || row.uid || "", email: row.workerEmail || "", enabled: hasAds});
      const previousRole = TT ? TT.roleFromPermissions(row.rolePermissions) : "";
      const nextRole = TT ? TT.roleFromPermissions(permissions) : "";
      const workerUid = row.workerUid || row.uid || "";
      if (workerUid && previousRole !== nextRole) templateChanges.push({uid: workerUid, email: row.workerEmail || "", name: row.workerName || "", role: nextRole, previousRole});
      batch.set(db.collection("clubEmployeeDesignations").doc(card.dataset.repId), {rolePermissions:permissions, requireApproval:!!card.querySelector("[data-rep-approval]")?.checked, updatedByUid:auth.currentUser?.uid || "", updatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    });
    await batch.commit();
    const failures = await syncAdPosters(adChanges);
    const templateFailures = await syncTemplateRoles(templateChanges);
    byId("repStatus").textContent = failures.length || templateFailures.length
      ? [failures.length ? `Duties saved, but the Club Ad Poster role could not be updated for: ${failures.join("; ")}` : "",
        templateFailures.length ? `Duties saved, but the template role could not be updated for: ${templateFailures.join("; ")}` : ""].filter(Boolean).join(" ")
      : "Individual duties and approval requirements saved.";
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
      }
      const campaignRef = await db.collection("guestListCampaigns").add({...payload, status:"enabled", active:true, approvedByUid:auth.currentUser.uid, approvedAt:firebase.firestore.FieldValue.serverTimestamp(), createdAt:firebase.firestore.FieldValue.serverTimestamp(), updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      const result = await window.FLOQRPayments.publishFollowerCampaign({entityId:locationId, campaign:{title:payload.campaignName || "Guest List", body:payload.description || "A new guest list is open.", campaignType:"guestList", sourceCampaignId:campaignRef.id, link:`./guest-list.html?location=${encodeURIComponent(locationId)}&campaign=${encodeURIComponent(campaignRef.id)}`}});
      await campaignRef.set({deliveredCount:result.deliveredCount || 0}, {merge:true});
      await db.collection("clubRoleActivity").doc(id).set({status:"approved", publishedCampaignId:campaignRef.id, reviewedByUid:auth.currentUser.uid, reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    } else {
      await db.collection("clubRoleActivity").doc(id).set({status, reviewedByUid:auth.currentUser.uid, reviewedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }
    await loadRep();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const tagsLink = byId("clubTemplateTagsLink");
    if (tagsLink) tagsLink.href = `./template-tags.html?location=${encodeURIComponent(locationId)}`;
    byId("saveRepPoliciesBtn")?.addEventListener("click", () => savePolicies().catch(error => { byId("repStatus").textContent = error.message; }));
    auth.onAuthStateChanged(user => { if (user) loadRep().catch(error => { byId("repStatus").textContent = error.message; }); });
  });
})();
