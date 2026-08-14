/* FLOQR Work Sheet — read-only weekly staff calendar for elected workers. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const gridApi = () => window.FLOQRStaffWeekGrid;

  let auth;
  try {
    auth = firebase.auth();
  } catch (_error) {
    return;
  }

  const state = {
    locationId: String(params.get("location") || params.get("club") || "").trim(),
    weekStart: gridApi()?.startOfWeek(new Date()) || new Date(),
    workers: [],
    shifts: [],
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

  function render() {
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

  async function loadWorksheet() {
    if (!auth.currentUser) {
      setStatus("Sign in to open the Work Sheet.");
      return;
    }
    setStatus("Loading published schedule…");
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
    renderVenueSelect();
    render();
    setStatus(state.locationName
      ? `${state.locationName} · published shifts only`
      : "Published shifts only.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("worksheetGoogleLoginBtn")?.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch(error => setStatus(error.message));
    });
    byId("worksheetPrevWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, -7);
      render();
    });
    byId("worksheetNextWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, 7);
      render();
    });
    byId("worksheetTodayWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().startOfWeek(new Date());
      render();
    });
    byId("worksheetRefreshBtn")?.addEventListener("click", () => {
      loadWorksheet().catch(error => setStatus(error.message));
    });
    byId("worksheetVenueSelect")?.addEventListener("change", event => {
      state.locationId = String(event.target.value || "").trim();
      loadWorksheet().catch(error => setStatus(error.message));
    });
    auth.onAuthStateChanged(user => {
      if (user) loadWorksheet().catch(error => setStatus(error.message || String(error)));
      else setStatus("Sign in to continue.");
    });
  });
})();
