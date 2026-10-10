/* FLOQR Scheduling portal — DJ / promoting company / club + assignee approve. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const owners = window.FLOQRScheduleOwners;
  const people = window.FLOQRScheduleAssignees;

  function t(key, fallback, vars = {}) {
    const value = window.FLOQRI18n?.t?.(key, vars);
    if (value && value !== key) return value;
    return Object.keys(vars).reduce((text, name) => text.split(`{${name}}`).join(String(vars[name])), fallback);
  }

  function setStatus(message) {
    const el = byId("schedulingPortalStatus");
    if (el) el.textContent = message || "";
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  const STATUS_KEYS = {
    pending: ["sched.statusPending", "pending"],
    confirmed: ["sched.statusConfirmed", "confirmed"],
    declined: ["sched.statusDeclined", "declined"],
    draft: ["sched.statusDraft", "draft"]
  };

  function statusLabel(status) {
    const pair = STATUS_KEYS[status];
    return pair ? t(pair[0], pair[1]) : status;
  }

  let auth;
  try {
    // firebase-config.js only sets window.firebaseConfig; each page app starts Firebase itself.
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
    auth = firebase.auth();
  } catch (error) {
    console.error("[scheduling] Firebase init failed", error);
    document.addEventListener("DOMContentLoaded", () => {
      setStatus(t("sched.firebaseError", "FLOQR could not start on this page. Refresh the page."));
    });
    return;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  const pickerState = {
    user: null,
    isMaster: false,
    clubs: [],
    companies: [],
    myDesignations: [],
    requested: owners?.parseOwnerParam(params.get("owner") || "") || null,
    selected: {club: "", promoterCompany: ""}
  };

  const assigneeState = {key: "", seq: 0, loading: false, sources: null, selected: ""};

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ownerType() {
    return document.querySelector("input[name='portalOwnerType']:checked")?.value || "dj";
  }

  function ownerId() {
    return owners.resolveOwnerId(ownerType(), byId("portalOwnerId")?.value || "", auth.currentUser?.uid || "");
  }

  function ownerName() {
    if (ownerType() === "dj") {
      const user = auth.currentUser;
      return String(user?.displayName || user?.email?.split("@")[0] || "DJ").trim();
    }
    const select = byId("portalOwnerId");
    return String(select?.selectedOptions?.[0]?.textContent || "").trim() || ownerId();
  }

  function optionsFor(type) {
    if (type === "club") return pickerState.clubs;
    if (type === "promoterCompany") return pickerState.companies;
    return [];
  }

  function renderOwnerPicker() {
    const type = ownerType();
    const pick = byId("portalOwnerPick");
    const select = byId("portalOwnerId");
    const hint = byId("portalOwnerHint");
    const searchWrap = byId("portalOwnerSearchWrap");
    if (!pick || !select || !hint) return;
    if (type === "dj") {
      pick.classList.add("hidden");
      select.innerHTML = "";
      hint.textContent = t("sched.djAuto", "Your own DJ calendar. Nothing to choose.");
      return;
    }
    const all = optionsFor(type);
    const label = byId("portalOwnerPickLabel");
    if (label) {
      const key = type === "club" ? "sched.pickClub" : "sched.pickCompany";
      label.setAttribute("data-i18n", key);
      label.textContent = t(key, type === "club" ? "Club" : "Company");
    }
    if (!all.length) {
      pick.classList.add("hidden");
      select.innerHTML = "";
      hint.textContent = type === "club"
        ? t("sched.noClubs", "You don't manage a club yet. A Club Admin can give you schedule access in Club Admin.")
        : t("sched.noCompanies", "No promoting company is linked to your account yet. A Club Admin sets it when they add you as a promoter.");
      return;
    }
    pick.classList.remove("hidden");
    const showSearch = pickerState.isMaster || all.length > 8;
    searchWrap?.classList.toggle("hidden", !showSearch);
    const query = showSearch ? byId("portalOwnerSearch")?.value || "" : "";
    const shown = owners.filterOptions(all, query);
    const keep = pickerState.selected[type];
    select.innerHTML = "";
    shown.forEach(option => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });
    if (keep && shown.some(option => option.value === keep)) select.value = keep;
    pickerState.selected[type] = select.value || "";
    hint.textContent = !shown.length
      ? t("sched.noMatch", "No match. Try another name.")
      : (pickerState.isMaster && type === "club" ? t("sched.allClubs", "Master Admin: every club is listed.") : "");
  }

  async function queryDocs(query) {
    try {
      return (await query.get()).docs;
    } catch (error) {
      console.warn("[scheduling] owner lookup skipped", error?.code || error?.message || error);
      return [];
    }
  }

  async function clubRows(ids) {
    const db = firebase.firestore();
    const snaps = await Promise.all(ids.map(id => db.collection("clubLocations").doc(id).get().catch(() => null)));
    return ids.map((id, index) => ({id, data: snaps[index]?.exists ? snaps[index].data() : {}}));
  }

  async function loadOwners(user) {
    const db = firebase.firestore();
    const claims = await user.getIdTokenResult().then(result => result.claims).catch(() => ({}));
    pickerState.isMaster = owners.isMasterAdminViewer({email: user.email, emailVerified: user.emailVerified, claims});
    if (pickerState.isMaster) {
      const [clubDocs, companyDocs] = await Promise.all([
        queryDocs(db.collection("clubLocations").limit(1000)),
        queryDocs(db.collection("clubEmployeeDesignations").where("promoterCompany", ">", "").limit(500))
      ]);
      pickerState.clubs = owners.clubOptions(clubDocs.map(doc => ({id: doc.id, data: doc.data()})));
      pickerState.companies = owners.companyOptions(companyDocs.map(doc => doc.data()), {anyStatus: true});
    } else {
      const email = String(user.email || "").toLowerCase();
      const [profileDocs, assignmentDocs, byUidDocs, byEmailDocs, designationDocs] = await Promise.all([
        db.collection("users").doc(user.uid).get().then(snap => (snap.exists ? [snap] : [])).catch(() => []),
        queryDocs(db.collection("clubAdminAssignments").where("patronUid", "==", user.uid).limit(50)),
        queryDocs(db.collection("clubLocations").where("adminUids", "array-contains", user.uid).limit(40)),
        email ? queryDocs(db.collection("clubLocations").where("adminEmails", "array-contains", email).limit(40)) : [],
        queryDocs(db.collection("clubEmployeeDesignations").where("workerUid", "==", user.uid).limit(60))
      ]);
      const designations = designationDocs.map(doc => doc.data() || {});
      pickerState.myDesignations = designations;
      const ids = owners.managedClubIds({
        profile: profileDocs[0]?.data() || {},
        assignments: assignmentDocs.map(doc => doc.data() || {}),
        clubsByUid: byUidDocs.map(doc => doc.id),
        clubsByEmail: byEmailDocs.map(doc => doc.id),
        designations
      });
      pickerState.clubs = owners.clubOptions(await clubRows(ids));
      pickerState.companies = owners.companyOptions(designations);
    }
    const requested = pickerState.requested;
    if (requested && requested.ownerType !== "dj") {
      const key = requested.ownerType === "club" ? "clubs" : "companies";
      let list = owners.withRequested(pickerState[key], requested.ownerId);
      if (requested.ownerType === "club" && list.some(option => option.requested)) {
        const [named] = owners.clubOptions(await clubRows([requested.ownerId]));
        if (named) list = list.map(option => (option.requested ? {...named, requested: true} : option));
      }
      pickerState[key] = list;
      pickerState.selected[requested.ownerType] = pickerState[key]
        .find(option => option.value.toLowerCase() === requested.ownerId.toLowerCase())?.value || "";
    }
    const type = owners.defaultOwnerType({
      requested: requested?.ownerType,
      clubCount: pickerState.clubs.length,
      companyCount: pickerState.companies.length
    });
    const radio = document.querySelector(`input[name='portalOwnerType'][value='${type}']`);
    if (radio) radio.checked = true;
    renderOwnerPicker();
  }

  async function directoryRows(request) {
    try {
      return (await callable("getPeopleDirectory")(request))?.data?.people || [];
    } catch (error) {
      console.warn("[scheduling] people directory skipped", error?.code || error?.message || error);
      return [];
    }
  }

  async function rosterDocs(type, id) {
    const db = firebase.firestore();
    if (type === "club") {
      return queryDocs(db.collection("clubEmployeeDesignations").where("clubLocationId", "==", id).limit(200));
    }
    if (type !== "promoterCompany") return [];
    if (pickerState.isMaster) {
      return queryDocs(db.collection("clubEmployeeDesignations").where("promoterCompany", "==", id).limit(200));
    }
    const clubIds = [...new Set(pickerState.myDesignations
      .filter(row => String(row.promoterCompany || "").trim().toLowerCase() === id.toLowerCase())
      .map(row => String(row.clubLocationId || "").trim())
      .filter(Boolean))].slice(0, 10);
    const lists = await Promise.all(clubIds.map(clubId =>
      queryDocs(db.collection("clubEmployeeDesignations").where("clubLocationId", "==", clubId).limit(200))));
    return lists.flat();
  }

  function directoryRequests(type, id) {
    if (type === "club") return [{mode: "club", clubLocationId: id}];
    return pickerState.isMaster ? [{mode: "services"}, {mode: "public"}] : [{mode: "services"}];
  }

  async function loadAssignees() {
    const user = auth.currentUser;
    const type = ownerType();
    const id = ownerId();
    const key = `${type}:${id}`;
    if (!user || !id || key === assigneeState.key) {
      renderAssigneePicker();
      return;
    }
    const seq = ++assigneeState.seq;
    Object.assign(assigneeState, {key, loading: true, sources: null, selected: ""});
    renderAssigneePicker();
    const [docs, ...lists] = await Promise.all([
      rosterDocs(type, id),
      ...directoryRequests(type, id).map(directoryRows)
    ]);
    if (seq !== assigneeState.seq) return;
    let directory = lists.flat();
    if (type === "club" && !pickerState.isMaster) {
      directory = directory.filter(row => Object.prototype.hasOwnProperty.call(row, "phone"));
    }
    assigneeState.sources = {
      self: {uid: user.uid, name: String(user.displayName || "").trim(), email: user.email || "", phone: user.phoneNumber || ""},
      roster: people.rosterFromDesignations(docs.map(doc => doc.data() || {}), {ownerType: type, ownerId: id}),
      directory
    };
    assigneeState.loading = false;
    renderAssigneePicker();
  }

  function assigneeOptions() {
    if (!assigneeState.sources) return [];
    return people.assigneeOptions({
      ...assigneeState.sources,
      labels: {you: t("sched.you", "you"), member: t("sched.member", "Member"), team: t("sched.team", "Team")}
    });
  }

  function selectedAssignee() {
    const uid = byId("portalAssignee")?.value || "";
    return uid ? assigneeOptions().find(option => option.value === uid) || null : null;
  }

  function renderAssigneePicker() {
    const select = byId("portalAssignee");
    const hint = byId("portalAssigneeHint");
    if (!select) return;
    const all = assigneeOptions();
    const showSearch = all.length > 8;
    byId("portalAssigneeSearchWrap")?.classList.toggle("hidden", !showSearch);
    const shown = people.filterPeople(all, showSearch ? byId("portalAssigneeSearch")?.value || "" : "");
    const keep = assigneeState.selected;
    select.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = t("sched.choosePerson", "Choose a person");
    select.appendChild(blank);
    shown.forEach(option => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });
    select.value = keep && shown.some(option => option.value === keep) ? keep : "";
    if (!hint) return;
    hint.textContent = assigneeState.loading
      ? t("sched.loadingPeople", "Loading people…")
      : !all.length
        ? t("sched.noPeople", "No one to assign yet. People appear here once they join this team.")
        : !shown.length ? t("sched.noMatch", "No match. Try another name.") : "";
  }

  function onAssigneeChange() {
    assigneeState.selected = byId("portalAssignee")?.value || "";
    const person = selectedAssignee();
    const email = byId("portalAssigneeEmail");
    const phone = byId("portalAssigneePhone");
    if (email) email.value = person?.email || "";
    if (phone) phone.value = person?.phone || "";
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
      return null;
    } catch (_error) {
      return null;
    }
  }

  let refreshSeq = 0;

  async function refresh() {
    const seq = ++refreshSeq;
    if (!auth.currentUser) {
      setStatus(t("sched.signInToManage", "Sign in to manage schedules."));
      return;
    }
    const id = ownerId();
    if (!id) {
      setStatus(t("sched.chooseOwner", "Choose a club or company under Schedule for first."));
      return;
    }
    setStatus(t("sched.loadingSubscription", "Loading subscription…"));
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
    if (seq !== refreshSeq) return;
    let paid = isPaidAccess(access);
    if (venuePaid === 1) paid = true;
    if (venuePaid === 0) paid = false;
    const monthStatus = paid
      ? t("sched.paidThisMonth", "Paid this month")
      : t("sched.notPaidThisMonth", "Not paid this month");
    const ever = access.everSubscribed === true || access.cta === "resubscribe";
    const cta = paid ? "none" : (access.cta || (ever ? "resubscribe" : "subscribe"));
    const resub = cta === "resubscribe";
    setText("portalSubBadge", monthStatus);
    byId("portalSubscribeGate")?.classList.toggle("hidden", paid);
    byId("portalBuySubBtn")?.classList.toggle("hidden", paid);
    setText("portalBuySubBtn", resub ? t("sched.resubscribe", "Resubscribe $20/mo") : t("sched.subscribe", "Subscribe $20/mo"));
    setText("portalSubscribeTitle", resub
      ? t("sched.resubscribeTitle", "Resubscribe · not paid this month")
      : t("sched.activateTitle", "Activate Staff Scheduling"));
    setText("portalSubscribeCopy", resub
      ? t("sched.resubscribeCopy", "This calendar was subscribed before but is not paid this month. Resubscribe to unlock it again.")
      : t("sched.subscribeCopy", "Subscribe to publish shifts on this calendar. After payment the calendar unlocks for the month."));
    byId("portalWorkspace")?.classList.toggle("hidden", !paid);
    byId("portalCalendarHint")?.classList.toggle("hidden", !paid);
    setStatus(paid
      ? t("sched.calendarUnlocked", "Calendar unlocked · {status}.", {status: monthStatus})
      : t("sched.subscribeRequired", "Subscription needed · {status}.", {status: monthStatus}));

    if (paid) {
      loadAssignees().catch(error => setStatus(error.message));
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
      byId("portalShiftList").innerHTML = `<p class='sub'>${esc(t("sched.subscribeToUnlock", "Subscribe to unlock this calendar."))}</p>`;
    }

    try {
      const mine = (await callable("listScheduleShifts")({mineOnly: true}))?.data?.shifts || [];
      renderMyAssignments(byId("portalMyShifts"), mine);
    } catch (_error) {
      /* assignees can still open portal before manage entitlement */
    }

    const focusShift = params.get("shift");
    if (focusShift) {
      setStatus(t("sched.reviewFocus", "Review the highlighted shift under My assignments, tick it, then Approve selected. Opening this page does not confirm."));
    }
  }

  function renderMyAssignments(el, shifts) {
    const api = window.FLOQRWorkerConfirm;
    if (el && api) {
      api.render(el, {
        shifts,
        focusId: params.get("shift") || "",
        emptyMessage: t("sched.noAssignments", "No pending assignments for this account.")
      });
      api.bind(el, {
        onApprove: ids => respondSelected(ids, "approve"),
        onDecline: ids => respondSelected(ids, "decline")
      });
      return;
    }
    renderShiftList(el, shifts, {assignee: true});
  }

  async function respondSelected(ids, decision) {
    if (!ids.length) {
      setStatus(t("sched.tickFirst", "Tick at least one pending shift, then Approve selected or Decline selected."));
      return;
    }
    setStatus(decision === "approve"
      ? t("sched.approvingN", "Approving {count}…", {count: ids.length})
      : t("sched.decliningN", "Declining {count}…", {count: ids.length}));
    try {
      await callable("respondToScheduleShifts")({shiftIds: ids, decision, from: "scheduling-portal"});
    } catch (error) {
      const message = error?.message || String(error);
      if (!/not found|does not exist|unimplemented/i.test(message)) throw error;
      for (const shiftId of ids) {
        await callable("respondToScheduleShift")({shiftId, decision, from: "scheduling-portal"});
      }
    }
    setStatus(decision === "approve"
      ? t("sched.approvedSelected", "Selected shifts confirmed.")
      : t("sched.declinedSelected", "Selected shifts declined."));
    await refresh();
  }

  function renderShiftList(el, shifts, opts = {}) {
    if (!el) return;
    if (!shifts.length) {
      el.innerHTML = `<p class='sub'>${esc(t("sched.noShifts", "No shifts."))}</p>`;
      return;
    }
    el.innerHTML = shifts.map(shift => {
      const status = String(shift.status || "") === "approved" ? "confirmed" : String(shift.status || "");
      const actions = opts.assignee && status === "pending"
        ? `<div class="queue-actions">
            <button type="button" data-approve="${esc(shift.id)}">${esc(t("sched.confirmShift", "Confirm shift"))}</button>
            <button type="button" data-decline="${esc(shift.id)}">${esc(t("sched.decline", "Decline"))}</button>
          </div>`
        : opts.manager && ["draft", "pending", "confirmed", "declined"].includes(status) && shift.id
          ? `<div class="queue-actions"><button type="button" data-delete="${esc(shift.id)}">${esc(t("sched.delete", "Delete"))}</button></div>`
          : "";
      return `<div class="report-row${params.get("shift") === shift.id ? " is-focused" : ""}">
        <strong>${esc(shift.roleLabel || t("sched.shiftFallback", "Shift"))} · ${esc(shift.assigneeName || "")}</strong>
        <span>${esc(shift.ownerName || "")}</span>
        <span>${esc(shift.startsAtLabel || shift.startsAt || "")} → ${esc(shift.endsAtLabel || shift.endsAt || "")}</span>
        <span class="tag">${esc(statusLabel(status))}</span>
        ${actions}
      </div>`;
    }).join("");
    el.querySelectorAll("[data-approve]").forEach(btn => {
      btn.addEventListener("click", () => respond(btn.getAttribute("data-approve"), "approve"));
    });
    el.querySelectorAll("[data-decline]").forEach(btn => {
      btn.addEventListener("click", () => respond(btn.getAttribute("data-decline"), "decline"));
    });
    el.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => deleteShift(btn.getAttribute("data-delete")));
    });
  }

  async function respond(shiftId, decision) {
    const approve = decision === "approve";
    setStatus(approve
      ? t("sched.approvingN", "Approving {count}…", {count: 1})
      : t("sched.decliningN", "Declining {count}…", {count: 1}));
    await callable("respondToScheduleShift")({shiftId, decision});
    setStatus(approve ? t("sched.shiftApproved", "Shift confirmed.") : t("sched.shiftDeclined", "Shift declined."));
    await refresh();
  }

  async function deleteShift(shiftId) {
    if (!shiftId || !window.confirm(t("sched.deleteConfirm", "Delete this shift?"))) return;
    setStatus(t("sched.deleting", "Deleting shift…"));
    await callable("deleteScheduleShift")({shiftId});
    setStatus(t("sched.deleted", "Shift deleted."));
    await refresh();
  }

  async function subscribe() {
    const id = ownerId();
    if (!id) throw new Error(t("sched.chooseOwner", "Choose a club or company under Schedule for first."));
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
    const person = selectedAssignee();
    if (!person) throw new Error(t("sched.chooseAssignee", "Choose who this shift is for."));
    if (!startsAt || !endsAt) throw new Error(t("sched.needTimes", "Start and end are required."));
    setStatus(t("sched.creating", "Creating shift…"));
    await callable("createScheduleShift")({
      ownerType: ownerType(),
      ownerId: id,
      ownerName: ownerName(),
      assigneeUid: person.value,
      assigneeName: person.name,
      assigneeEmail: byId("portalAssigneeEmail")?.value?.trim() || "",
      assigneePhone: byId("portalAssigneePhone")?.value?.trim() || "",
      roleLabel: byId("portalRole")?.value?.trim() || t("sched.shiftFallback", "Shift"),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      notes: byId("portalNotes")?.value?.trim() || "",
      notify: true
    });
    setStatus(t("sched.created", "Pending shift created. The person confirms it from Inbox, Email, SMS or WhatsApp."));
    await refresh();
  }

  async function onSignedIn(user) {
    if (pickerState.user?.uid !== user.uid) {
      pickerState.user = user;
      setStatus(t("sched.loadingOwners", "Loading what you can manage…"));
      await loadOwners(user);
    }
    await refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const shell = window.FLOQRSessionShell;
    byId("portalSignInBtn")?.addEventListener("click", () => {
      if (shell?.popupBlocked?.("#schedulingPortalStatus")) return;
      shell?.redirectToLogin?.();
    });
    byId("portalBuySubBtn")?.addEventListener("click", () => subscribe().catch(error => setStatus(error.message)));
    byId("portalRefreshBtn")?.addEventListener("click", () => refresh().catch(error => setStatus(error.message)));
    byId("portalCreateShiftBtn")?.addEventListener("click", () => createShift().catch(error => setStatus(error.message)));
    document.querySelectorAll("input[name='portalOwnerType']").forEach(radio => {
      radio.addEventListener("change", () => {
        renderOwnerPicker();
        if (auth.currentUser) refresh().catch(error => setStatus(error.message));
      });
    });
    byId("portalOwnerId")?.addEventListener("change", () => {
      pickerState.selected[ownerType()] = byId("portalOwnerId").value || "";
      refresh().catch(error => setStatus(error.message));
    });
    byId("portalOwnerSearch")?.addEventListener("input", renderOwnerPicker);
    byId("portalAssignee")?.addEventListener("change", onAssigneeChange);
    byId("portalAssigneeSearch")?.addEventListener("input", renderAssigneePicker);
    window.addEventListener("floqr:ui-language", () => {
      renderOwnerPicker();
      renderAssigneePicker();
    });
    renderOwnerPicker();
    if (!shell?.bind) {
      setStatus(t("sched.firebaseError", "FLOQR could not start on this page. Refresh the page."));
      return;
    }
    shell.bind({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#schedulingPortalStatus",
      onUser: user => onSignedIn(user).catch(error => setStatus(error.message))
    });
  });
})();
