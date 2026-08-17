/* FLOQR Work Sheet — weekly staff calendar + worker confirm (checkboxes, then Approve). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const gridApi = () => window.FLOQRStaffWeekGrid;
  const confirmApi = () => window.FLOQRWorkerConfirm;

  let auth;
  try {
    auth = firebase.auth();
  } catch (_error) {
    return;
  }

  function locationFromOwner(owner) {
    const raw = String(owner || "").trim();
    if (raw.startsWith("club:")) return raw.slice(5);
    return "";
  }

  const state = {
    locationId: String(params.get("location") || params.get("club") || locationFromOwner(params.get("owner")) || "").trim(),
    focusShiftId: String(params.get("shift") || "").trim(),
    fromNotify: String(params.get("from") || "") === "schedule-notify",
    weekStart: gridApi()?.startOfWeek(new Date()) || new Date(),
    workers: [],
    shifts: [],
    mine: [],
    venues: [],
    viewerUid: "",
    locationName: ""
  };

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("worksheetStatus");
    if (el) el.textContent = message || "";
  }

  function setConfirmNote(message) {
    const el = byId("worksheetConfirmNote");
    if (el) el.textContent = message || "";
  }

  function shiftStatus(row = {}) {
    const status = String(row.status || "") === "approved" ? "confirmed" : String(row.status || "");
    return status;
  }

  function updateWeekLabel() {
    const days = gridApi()?.weekDays(state.weekStart) || [];
    const label = byId("worksheetWeekLabel");
    if (!label || !days.length) return;
    const fmt = {month: "short", day: "numeric", year: "numeric"};
    label.textContent = `${days[0].toLocaleDateString([], fmt)} → ${days[6].toLocaleDateString([], fmt)}`;
  }

  function renderVenueSelect() {
    const select = byId("worksheetVenueSelect");
    if (!select) return;
    const rows = state.venues.length
      ? state.venues
      : (state.locationId ? [{locationId: state.locationId, locationName: state.locationName || state.locationId}] : []);
    select.innerHTML = rows.map(row =>
      `<option value="${gridApi().esc(row.locationId)}" ${row.locationId === state.locationId ? "selected" : ""}>${gridApi().esc(row.locationName || row.locationId)}</option>`
    ).join("");
    if (!state.locationId && rows[0]) state.locationId = rows[0].locationId;
  }

  function jumpWeekToFocus() {
    const focused = state.mine.find(row => row.id === state.focusShiftId) || state.shifts.find(row => row.id === state.focusShiftId);
    if (!focused) return;
    const ms = Number(focused.startsAtMs) || Date.parse(focused.startsAt) || 0;
    if (!ms || !gridApi()?.startOfWeek) return;
    state.weekStart = gridApi().startOfWeek(new Date(ms));
  }

  function paintFocusNote() {
    if (!state.focusShiftId) {
      setConfirmNote("Tick each pending shift you accept, or Select all, then Approve selected.");
      return;
    }
    const focused = state.mine.find(row => row.id === state.focusShiftId);
    if (!focused) {
      setConfirmNote("This confirmation link is for the assigned service member. Sign in as that worker to review and approve. Opening the link does not confirm the shift.");
      return;
    }
    const status = shiftStatus(focused);
    if (status === "confirmed") {
      setConfirmNote("This shift is already confirmed. The inbox link only opens this page — it does not confirm. Only the assigned worker can Approve selected.");
      return;
    }
    if (status === "declined") {
      setConfirmNote("This shift was declined. Opening the confirmation link does not change status.");
      return;
    }
    setConfirmNote("Review the highlighted shift, keep it ticked (or Select all), then Approve selected. The link itself does not confirm.");
  }

  function renderConfirm() {
    const host = byId("worksheetConfirmHost");
    const api = confirmApi();
    if (!host || !api) return;
    api.render(host, {
      shifts: state.mine,
      focusId: state.focusShiftId,
      emptyMessage: state.focusShiftId
        ? "No pending assignment for this account. If this shift is already confirmed, only the assigned worker’s Approve selected could have done that."
        : "No shifts are waiting for your confirmation."
    });
    api.bind(host, {
      onApprove: ids => respondSelected(ids, "approve"),
      onDecline: ids => respondSelected(ids, "decline")
    });
    paintFocusNote();
  }

  function renderGrid() {
    updateWeekLabel();
    const heading = byId("worksheetVenueHeading");
    if (heading && state.locationName) heading.textContent = state.locationName;
    gridApi()?.renderReadOnly({
      host: byId("worksheetWeekGrid"),
      workers: state.workers,
      shifts: state.shifts,
      weekStart: state.weekStart,
      highlightUid: state.viewerUid,
      emptyMessage: "No elected colleagues or published shifts for this week."
    });
  }

  function render() {
    renderConfirm();
    renderGrid();
  }

  async function respondSelected(ids, decision) {
    if (!ids.length) {
      setConfirmNote("Tick at least one pending shift, then Approve selected or Decline selected.");
      return;
    }
    const verb = decision === "approve" ? "Approving" : "Declining";
    setStatus(`${verb} ${ids.length} shift${ids.length === 1 ? "" : "s"}…`);
    try {
      await callable("respondToScheduleShifts")({shiftIds: ids, decision, from: "work-calendar"});
    } catch (error) {
      const message = error?.message || String(error);
      if (!/not found|does not exist|unimplemented/i.test(message)) throw error;
      for (const shiftId of ids) {
        await callable("respondToScheduleShift")({shiftId, decision, from: "work-calendar"});
      }
    }
    setStatus(decision === "approve" ? "Selected shifts confirmed." : "Selected shifts declined.");
    await loadWorksheet();
  }

  async function loadMine() {
    try {
      const result = await callable("listScheduleShifts")({mineOnly: true});
      state.mine = result?.data?.shifts || [];
    } catch (_error) {
      state.mine = [];
    }
  }

  async function loadWorksheet() {
    if (!auth.currentUser) {
      setStatus("Sign in to review your assigned shifts.");
      return;
    }
    setStatus("Loading published schedule…");
    await loadMine();
    jumpWeekToFocus();
    try {
      const result = await callable("listStaffWorksheet")({
        locationId: state.locationId || undefined
      });
      const data = result?.data || {};
      state.locationId = data.locationId || state.locationId;
      state.locationName = data.locationName || "";
      state.workers = data.workers || [];
      state.shifts = data.shifts || [];
      state.viewerUid = data.viewerUid || auth.currentUser.uid;
      state.venues = data.venues || [];
    } catch (error) {
      state.viewerUid = auth.currentUser.uid;
      setStatus(error?.message || String(error));
    }
    renderVenueSelect();
    render();
    setStatus(state.locationName
      ? `${state.locationName} · review pending assignments above, then the week grid`
      : "Review pending assignments, then Approve selected.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("worksheetGoogleLoginBtn")?.addEventListener("click", () => {
      if (window.FLOQRSessionShell?.popupBlocked?.("#worksheetStatus")) return;
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch(error => setStatus(error.message));
    });
    byId("worksheetPrevWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, -7);
      renderGrid();
    });
    byId("worksheetNextWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, 7);
      renderGrid();
    });
    byId("worksheetTodayWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().startOfWeek(new Date());
      renderGrid();
    });
    byId("worksheetRefreshBtn")?.addEventListener("click", () => {
      loadWorksheet().catch(error => setStatus(error.message));
    });
    byId("worksheetVenueSelect")?.addEventListener("change", event => {
      state.locationId = String(event.target.value || "").trim();
      loadWorksheet().catch(error => setStatus(error.message));
    });
    const shell = window.FLOQRSessionShell;
    if (shell?.bind) {
      shell.bind({
        auth,
        chrome: "[data-floqr-auth-chrome]",
        loginButtons: "[data-floqr-login-btn]",
        statusEl: "#worksheetStatus",
        onUser: () => loadWorksheet().catch(error => setStatus(error.message || String(error))),
        onSignedOut: () => {
          /* shell sets status / chrome */
        }
      });
    } else {
      auth.onAuthStateChanged(user => {
        if (user) loadWorksheet().catch(error => setStatus(error.message || String(error)));
        else setStatus("Sign in to continue.");
      });
    }
  });
})();
