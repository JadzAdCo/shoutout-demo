/* Public iframe embed — published schedule via venuePublicFeed secret. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const API = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/venuePublicFeed";
  const gridApi = () => window.FLOQRStaffWeekGrid;

  const state = {
    locationId: String(params.get("location") || params.get("locationId") || "").trim(),
    secret: String(params.get("secret") || params.get("k") || "").trim(),
    weekStart: gridApi()?.startOfWeek(new Date()) || new Date(),
    shifts: [],
    venueName: ""
  };

  function setStatus(message) {
    const el = byId("embedStatus");
    if (el) el.textContent = message || "";
  }

  function updateWeekLabel() {
    const days = gridApi()?.weekDays(state.weekStart) || [];
    const label = byId("embedWeekLabel");
    if (!label || !days.length) return;
    const fmt = {month: "short", day: "numeric", year: "numeric"};
    label.textContent = `${days[0].toLocaleDateString([], fmt)} → ${days[6].toLocaleDateString([], fmt)}`;
  }

  function render() {
    updateWeekLabel();
    if (byId("embedVenueName") && state.venueName) {
      byId("embedVenueName").textContent = `${state.venueName} staff schedule`;
    }
    gridApi()?.renderReadOnly({
      host: byId("embedWeekGrid"),
      workers: gridApi().workersFromShifts(state.shifts),
      shifts: state.shifts,
      weekStart: state.weekStart,
      emptyMessage: "No published shifts this week."
    });
  }

  async function load() {
    if (!state.locationId || !state.secret) {
      setStatus("This embed needs a venue location and ingest secret.");
      return;
    }
    const url = `${API}?location=${encodeURIComponent(state.locationId)}&secret=${encodeURIComponent(state.secret)}&format=json&dataset=schedule`;
    const res = await fetch(url, {headers: {"X-Floqr-Ingest-Secret": state.secret}});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setStatus(data.error || `Could not load schedule (${res.status}).`);
      return;
    }
    state.venueName = data.venueName || "";
    const rows = Array.isArray(data.assignments) ? data.assignments : (Array.isArray(data.shifts) ? data.shifts : []);
    state.shifts = rows
      .filter(row => String(row.status || "").toUpperCase() === "CONFIRMED" || String(row.status || "").toLowerCase() === "confirmed")
      .map(row => {
        if (row.jobType) {
          const start = Date.parse(`${row.date}T${row.startTime || "00:00"}`);
          const end = Date.parse(`${row.date}T${row.endTime || "00:00"}`);
          return {
            id: row.id,
            roleLabel: row.jobType.name,
            assigneeName: row.displayName,
            status: "confirmed",
            startsAtMs: Number.isFinite(start) ? start : 0,
            endsAtMs: Number.isFinite(end) ? end : 0
          };
        }
        return {...row, status: "confirmed"};
      });
    render();
    setStatus("Confirmed shifts only.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("embedPrevWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, -7);
      render();
    });
    byId("embedNextWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().addDays(state.weekStart, 7);
      render();
    });
    byId("embedTodayWeekBtn")?.addEventListener("click", () => {
      state.weekStart = gridApi().startOfWeek(new Date());
      render();
    });
    load().catch(error => setStatus(error.message || String(error)));
  });
})();
