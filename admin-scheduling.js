/* FLOQR Club Admin — Staff Scheduling tab ($20/mo + notify/approve). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const locationId = String(params.get("location") || params.get("club") || "").trim();
  if (!window.firebase || !byId("panelScheduling")) return;

  let auth;
  let db;
  try {
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (error) {
    return;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("schedulingStatus");
    if (el) el.textContent = message || "";
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isPaidAccess(access) {
    if (!access) return false;
    const flag = access.staffSchedulingPaid ?? access.paid;
    if (flag === 1 || flag === "1" || flag === true) return true;
    if (flag === 0 || flag === "0" || flag === false) return false;
    return access.subscribed === true;
  }

  /** Venue source of truth: clubLocations.staffSchedulingPaid (0|1). Seeds 1 when unset (demo). */
  async function readOrSeedVenuePaidFlag() {
    if (!locationId || !db) return null;
    const ref = db.collection("clubLocations").doc(locationId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const raw = snap.data()?.staffSchedulingPaid;
    if (raw === 0 || raw === "0" || raw === false) return 0;
    if (raw === 1 || raw === "1" || raw === true) return 1;
    try {
      await ref.set({
        staffSchedulingPaid: 1,
        schedulingEntitlementSource: "demo",
        schedulingPaidUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      return 1;
    } catch (_error) {
      return null;
    }
  }

  async function loadAccess() {
    if (!locationId || !auth.currentUser) return null;
    const result = await callable("getSchedulingAccess")({
      ownerType: "club",
      ownerId: locationId
    });
    return result?.data || null;
  }

  async function refreshSubscriptionUi() {
    const gate = byId("schedulingSubscribeGate");
    const workspace = byId("schedulingWorkspace");
    const badge = byId("schedulingSubBadge");
    const buyBtn = byId("buySchedulingSubBtn");
    const portalLink = byId("openSchedulingPortalLink");
    const gateTitle = byId("schedulingSubscribeTitle");
    const gateCopy = byId("schedulingSubscribeCopy");
    try {
      const venuePaid = await readOrSeedVenuePaidFlag();
      let access = null;
      try {
        access = await loadAccess();
      } catch (error) {
        setStatus(error?.message || String(error));
      }
      let paid = isPaidAccess(access);
      if (venuePaid === 1) paid = true;
      if (venuePaid === 0) paid = false;
      const monthStatus = access?.monthStatus || access?.status || (paid ? "paid this month" : "not paid this month");
      const ever = access?.everSubscribed === true || access?.cta === "resubscribe";
      const cta = paid ? "none" : (access?.cta || (ever ? "resubscribe" : "subscribe"));
      if (badge) {
        badge.textContent = paid
          ? `staffSchedulingPaid=1 · ${monthStatus}`
          : `staffSchedulingPaid=0 · ${monthStatus}`;
      }
      if (gate) gate.classList.toggle("hidden", paid);
      if (workspace) workspace.classList.toggle("hidden", !paid);
      if (buyBtn) {
        buyBtn.classList.toggle("hidden", paid);
        buyBtn.textContent = cta === "resubscribe" ? "Resubscribe $20/mo" : "Subscribe $20/mo";
      }
      if (gateTitle) {
        gateTitle.textContent = cta === "resubscribe"
          ? "Resubscribe · $20 / month"
          : "Subscribe · $20 / month";
      }
      if (gateCopy) {
        gateCopy.innerHTML = cta === "resubscribe"
          ? "This venue was subscribed before, but status is <code>not paid this month</code> (<code>staffSchedulingPaid=0</code>). Resubscribe to set <code>paid this month</code> and unlock the calendar."
          : "Unlock Staff Scheduling for this venue. Checkout sets <code>staffSchedulingPaid=1</code> and subscription status to <code>paid this month</code>.";
      }
      if (portalLink) {
        portalLink.classList.toggle("hidden", !paid);
        portalLink.textContent = "Open full calendar / Scheduling portal";
      }
      setStatus(
        paid
          ? `Calendar unlocked · ${monthStatus} (staffSchedulingPaid=1).`
          : `${cta === "resubscribe" ? "Resubscribe" : "Subscribe"} required · ${monthStatus} (staffSchedulingPaid=0).`
      );
      if (paid) await Promise.all([loadWorkers(), loadShifts()]);
    } catch (error) {
      setStatus(error?.message || String(error));
    }
  }

  async function startSubscription() {
    setStatus("Opening $20/month Staff Scheduling checkout…");
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL.");
    if (!window.FLOQRPayments?.startCheckout) throw new Error("Stripe checkout is not loaded.");
    const clubName = byId("clubName")?.textContent || locationId;
    await window.FLOQRPayments.startCheckout({
      orderType: "staffSchedulingSubscription",
      payload: {
        ownerType: "club",
        ownerId: locationId,
        clubLocationId: locationId,
        ownerName: clubName
      },
      status: setStatus
    });
  }

  async function loadWorkers() {
    const select = byId("scheduleAssignee");
    if (!select || !locationId) return;
    const snap = await db.collection("clubEmployeeDesignations")
      .where("clubLocationId", "==", locationId)
      .limit(200)
      .get();
    const options = ['<option value="">Select worker</option>'];
    snap.docs.forEach(doc => {
      const row = doc.data() || {};
      if (String(row.status || "").toLowerCase() === "rejected") return;
      const uid = row.workerUid || "";
      if (!uid) return;
      const label = `${row.workerName || row.workerEmail || uid} · ${row.roleElectionType || (row.workerRoles || [])[0] || "Worker"}`;
      options.push(`<option value="${esc(uid)}" data-name="${esc(row.workerName || "")}" data-email="${esc(row.workerEmail || "")}" data-role="${esc(row.roleElectionType || "")}">${esc(label)}</option>`);
    });
    select.innerHTML = options.join("");
  }

  async function loadShifts() {
    const list = byId("schedulingShiftList");
    if (!list || !locationId) return;
    const result = await callable("listScheduleShifts")({
      ownerType: "club",
      ownerId: locationId
    });
    const shifts = result?.data?.shifts || [];
    if (!shifts.length) {
      list.innerHTML = "<p class='sub'>No shifts yet. Create the first staff shift above.</p>";
      return;
    }
    list.innerHTML = shifts.map(shift => `
      <div class="report-row">
        <strong>${esc(shift.roleLabel || "Shift")} · ${esc(shift.assigneeName || "Unassigned")}</strong>
        <span>${esc(shift.startsAtLabel || shift.startsAt || "")} → ${esc(shift.endsAtLabel || shift.endsAt || "")}</span>
        <span class="tag">${esc(shift.status || "")}</span>
        ${shift.notes ? `<small>${esc(shift.notes)}</small>` : ""}
      </div>
    `).join("");
  }

  async function createShift() {
    const select = byId("scheduleAssignee");
    const option = select?.selectedOptions?.[0];
    const assigneeUid = select?.value || "";
    if (!assigneeUid) throw new Error("Choose a worker for this shift.");
    const startsAt = byId("scheduleStartsAt")?.value;
    const endsAt = byId("scheduleEndsAt")?.value;
    if (!startsAt || !endsAt) throw new Error("Set shift start and end.");
    setStatus("Creating shift and notifying assignee…");
    const result = await callable("createScheduleShift")({
      ownerType: "club",
      ownerId: locationId,
      ownerName: byId("clubName")?.textContent || locationId,
      assigneeUid,
      assigneeName: option?.dataset?.name || option?.textContent || "",
      assigneeEmail: option?.dataset?.email || "",
      roleLabel: byId("scheduleRole")?.value?.trim() || option?.dataset?.role || "Shift",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      notes: byId("scheduleNotes")?.value?.trim() || "",
      venueName: byId("clubName")?.textContent || "",
      notify: true,
      requireApproval: byId("scheduleRequireApproval")?.checked !== false
    });
    setStatus(`Shift saved (${result?.data?.status || "ok"}). Email/SMS/WhatsApp queued when channels are enabled.`);
    byId("scheduleNotes").value = "";
    await loadShifts();
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("buySchedulingSubBtn")?.addEventListener("click", () => {
      startSubscription().catch(error => setStatus(error.message));
    });
    byId("createScheduleShiftBtn")?.addEventListener("click", () => {
      createShift().catch(error => setStatus(error.message));
    });
    byId("refreshSchedulingBtn")?.addEventListener("click", () => {
      refreshSubscriptionUi().catch(error => setStatus(error.message));
    });
    auth.onAuthStateChanged(user => {
      if (user) refreshSubscriptionUi().catch(error => setStatus(error.message));
    });
  });
})();
