/* FLOQR Scheduling portal — DJ / promoting company / club + assignee approve. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;

  let auth;
  try {
    auth = firebase.auth();
  } catch (error) {
    return;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("schedulingPortalStatus");
    if (el) el.textContent = message || "";
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ownerType() {
    return byId("portalOwnerType")?.value || "dj";
  }

  function ownerId() {
    const type = ownerType();
    const typed = String(byId("portalOwnerId")?.value || "").trim();
    if (typed) return typed;
    if (type === "dj") return auth.currentUser?.uid || "";
    return "";
  }

  function ownerName() {
    return String(byId("portalOwnerName")?.value || "").trim() || ownerId();
  }

  function isPaidAccess(access) {
    if (!access) return false;
    const flag = access.staffSchedulingPaid ?? access.paid;
    if (flag === 1 || flag === "1" || flag === true) return true;
    if (flag === 0 || flag === "0" || flag === false) return false;
    return access.subscribed === true;
  }

  async function readClubPaidFlag(id) {
    if (ownerType() !== "club" || !id || !window.firebase) return null;
    try {
      const snap = await firebase.firestore().collection("clubLocations").doc(id).get();
      if (!snap.exists) return null;
      const raw = snap.data()?.staffSchedulingPaid;
      if (raw === 0 || raw === "0" || raw === false) return 0;
      if (raw === 1 || raw === "1" || raw === true) return 1;
      await snap.ref.set({
        staffSchedulingPaid: 1,
        schedulingEntitlementSource: "demo",
        schedulingPaidUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      return 1;
    } catch (_error) {
      return null;
    }
  }

  async function refresh() {
    if (!auth.currentUser) {
      setStatus("Sign in to manage schedules.");
      return;
    }
    const id = ownerId();
    if (!id) {
      setStatus("Enter an owner id (company slug or club location), or choose DJ for your account.");
      return;
    }
    setStatus("Loading subscription…");
    const venuePaid = await readClubPaidFlag(id);
    let access = {};
    try {
      access = (await callable("getSchedulingAccess")({
        ownerType: ownerType(),
        ownerId: id
      }))?.data || {};
    } catch (error) {
      setStatus(error?.message || String(error));
    }
    let paid = isPaidAccess(access);
    if (venuePaid === 1) paid = true;
    if (venuePaid === 0) paid = false;
    const monthStatus = access.monthStatus || access.status || (paid ? "paid this month" : "not paid this month");
    const ever = access.everSubscribed === true || access.cta === "resubscribe";
    const cta = paid ? "none" : (access.cta || (ever ? "resubscribe" : "subscribe"));
    byId("portalSubBadge").textContent = paid
      ? `staffSchedulingPaid=1 · ${monthStatus}`
      : `staffSchedulingPaid=0 · ${monthStatus}`;
    byId("portalSubscribeGate")?.classList.toggle("hidden", paid);
    byId("portalBuySubBtn")?.classList.toggle("hidden", paid);
    if (byId("portalBuySubBtn")) {
      byId("portalBuySubBtn").textContent = cta === "resubscribe" ? "Resubscribe $20/mo" : "Subscribe $20/mo";
    }
    if (byId("portalSubscribeTitle")) {
      byId("portalSubscribeTitle").textContent = cta === "resubscribe"
        ? "Resubscribe · not paid this month"
        : "Activate Staff Scheduling";
    }
    if (byId("portalSubscribeCopy")) {
      byId("portalSubscribeCopy").innerHTML = cta === "resubscribe"
        ? "Prior subscriber detected. Status is <code>not paid this month</code>. Resubscribe to restore <code>paid this month</code> and the calendar."
        : "Subscribe to publish shifts. Payment sets <code>staffSchedulingPaid=1</code> and status <code>paid this month</code>.";
    }
    byId("portalWorkspace")?.classList.toggle("hidden", !paid);
    byId("portalCalendarHint")?.classList.toggle("hidden", !paid);
    setStatus(
      paid
        ? `Calendar unlocked · ${monthStatus}.`
        : `${cta === "resubscribe" ? "Resubscribe" : "Subscribe"} required · ${monthStatus}.`
    );

    if (paid) {
      try {
        const listResult = (await callable("listScheduleShifts")({
          ownerType: ownerType(),
          ownerId: id
        }))?.data || {};
        renderShiftList(byId("portalShiftList"), listResult.shifts || [], {manager: !!listResult.canManage});
      } catch (error) {
        if (byId("portalShiftList")) {
          byId("portalShiftList").innerHTML = `<p class='sub'>${esc(error?.message || error)}</p>`;
        }
      }
    } else if (byId("portalShiftList")) {
      byId("portalShiftList").innerHTML = "<p class='sub'>Subscribe to unlock the calendar engine.</p>";
    }

    try {
      const mine = (await callable("listScheduleShifts")({mineOnly: true}))?.data?.shifts || [];
      renderShiftList(byId("portalMyShifts"), mine, {assignee: true});
    } catch (_error) {
      /* assignees can still open portal before manage entitlement */
    }

    const focusShift = params.get("shift");
    if (focusShift) setStatus(`Focused shift ${focusShift}. Use Approve / Decline on My assignments if it is yours.`);
  }

  function renderShiftList(el, shifts, opts = {}) {
    if (!el) return;
    if (!shifts.length) {
      el.innerHTML = "<p class='sub'>No shifts.</p>";
      return;
    }
    el.innerHTML = shifts.map(shift => {
      const actions = opts.assignee && shift.status === "pending"
        ? `<div class="queue-actions">
            <button type="button" data-approve="${esc(shift.id)}">Approve</button>
            <button type="button" data-decline="${esc(shift.id)}">Decline</button>
          </div>`
        : "";
      return `<div class="report-row">
        <strong>${esc(shift.roleLabel || "Shift")} · ${esc(shift.assigneeName || "")}</strong>
        <span>${esc(shift.ownerName || shift.ownerKey || "")}</span>
        <span>${esc(shift.startsAtLabel || shift.startsAt || "")} → ${esc(shift.endsAtLabel || shift.endsAt || "")}</span>
        <span class="tag">${esc(shift.status || "")}</span>
        ${actions}
      </div>`;
    }).join("");
    el.querySelectorAll("[data-approve]").forEach(btn => {
      btn.addEventListener("click", () => respond(btn.getAttribute("data-approve"), "approve"));
    });
    el.querySelectorAll("[data-decline]").forEach(btn => {
      btn.addEventListener("click", () => respond(btn.getAttribute("data-decline"), "decline"));
    });
  }

  async function respond(shiftId, decision) {
    setStatus(`${decision === "approve" ? "Approving" : "Declining"}…`);
    await callable("respondToScheduleShift")({shiftId, decision});
    setStatus(`Shift ${decision}d.`);
    await refresh();
  }

  async function subscribe() {
    const id = ownerId();
    if (!id) throw new Error("Owner id required before checkout.");
    await window.FLOQRPayments.startCheckout({
      orderType: "staffSchedulingSubscription",
      payload: {
        ownerType: ownerType(),
        ownerId: id,
        clubLocationId: ownerType() === "club" ? id : "",
        ownerName: ownerName()
      },
      status: setStatus
    });
  }

  async function createShift() {
    const id = ownerId();
    const startsAt = byId("portalStartsAt")?.value;
    const endsAt = byId("portalEndsAt")?.value;
    const assigneeUid = String(byId("portalAssigneeUid")?.value || "").trim();
    if (!assigneeUid) throw new Error("Assignee uid is required.");
    if (!startsAt || !endsAt) throw new Error("Start and end are required.");
    setStatus("Creating shift…");
    await callable("createScheduleShift")({
      ownerType: ownerType(),
      ownerId: id,
      ownerName: ownerName(),
      assigneeUid,
      assigneeName: byId("portalAssigneeName")?.value?.trim() || "",
      assigneeEmail: byId("portalAssigneeEmail")?.value?.trim() || "",
      assigneePhone: byId("portalAssigneePhone")?.value?.trim() || "",
      roleLabel: byId("portalRole")?.value?.trim() || "Shift",
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      notes: byId("portalNotes")?.value?.trim() || "",
      notify: true,
      requireApproval: byId("portalRequireApproval")?.checked !== false
    });
    setStatus("Shift created. Notifications queued.");
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const ownerParam = params.get("owner") || "";
    if (ownerParam.includes(":")) {
      const [type, ...rest] = ownerParam.split(":");
      if (byId("portalOwnerType") && ["club", "dj", "promoterCompany"].includes(type)) {
        byId("portalOwnerType").value = type;
        byId("portalOwnerId").value = rest.join(":");
      }
    }
    byId("portalGoogleLoginBtn")?.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch(error => setStatus(error.message));
    });
    byId("portalBuySubBtn")?.addEventListener("click", () => subscribe().catch(error => setStatus(error.message)));
    byId("portalRefreshBtn")?.addEventListener("click", () => refresh().catch(error => setStatus(error.message)));
    byId("portalCreateShiftBtn")?.addEventListener("click", () => createShift().catch(error => setStatus(error.message)));
    byId("portalOwnerType")?.addEventListener("change", () => {
      if (ownerType() === "dj" && auth.currentUser && !byId("portalOwnerId").value) {
        byId("portalOwnerId").value = auth.currentUser.uid;
      }
    });
    auth.onAuthStateChanged(user => {
      if (user && ownerType() === "dj" && !byId("portalOwnerId")?.value) {
        byId("portalOwnerId").value = user.uid;
      }
      if (user) refresh().catch(error => setStatus(error.message));
      else setStatus("Sign in to continue.");
    });
  });
})();
