/* Master Admin — Security → Admin User Management (assign venue staff without self-election). */
(function (root) {
  "use strict";

  const STAFF_ROLES = [
    "Club Admin",
    "Promoter",
    "DJ",
    "Bottle Girl",
    "Bus Boy",
    "Security",
    "Waiter / Waitress",
    "Bartender / Barman",
    "Hospitality",
    "Videographer / Camera Operator"
  ];

  let functions = null;
  let locationsCache = [];
  let designationsCache = [];
  let bound = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, message) {
    const el = byId(id);
    if (el) el.textContent = message || "";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function callable(name) {
    if (!functions) functions = firebase.app().functions("us-central1");
    return functions.httpsCallable(name);
  }

  function locationOptionsHtml(selectedId = "") {
    return locationsCache.map((loc) => {
      const id = loc.id;
      const label = loc.locationName || loc.name || id;
      const city = loc.city ? ` · ${loc.city}` : "";
      return `<option value="${esc(id)}" ${id === selectedId ? "selected" : ""}>${esc(label)}${esc(city)}</option>`;
    }).join("");
  }

  function roleOptionsHtml(selected = "") {
    return STAFF_ROLES.map((role) => (
      `<option value="${esc(role)}" ${role === selected ? "selected" : ""}>${esc(role)}</option>`
    )).join("");
  }

  async function loadLocations() {
    const snap = await firebase.firestore().collection("clubLocations").limit(500).get();
    locationsCache = snap.docs.map((doc) => ({id: doc.id, ...(doc.data() || {})}))
      .sort((a, b) => String(a.locationName || a.name || a.id).localeCompare(String(b.locationName || b.name || b.id)));
    const venueSel = byId("aumVenueSelect");
    if (venueSel) {
      const keep = venueSel.value;
      venueSel.innerHTML = `<option value="">Select venue / business…</option>${locationOptionsHtml(keep)}`;
    }
  }

  async function loadDesignations(locationId) {
    const host = byId("aumStaffList");
    if (!host) return;
    if (!locationId) {
      designationsCache = [];
      host.innerHTML = "<p class='sub small'>Select a venue to list assigned staff.</p>";
      return;
    }
    setText("aumStatus", "Loading staff…");
    const snap = await firebase.firestore().collection("clubEmployeeDesignations")
      .where("clubLocationId", "==", locationId)
      .limit(200)
      .get();
    designationsCache = snap.docs.map((doc) => ({id: doc.id, ...(doc.data() || {})}));
    if (!designationsCache.length) {
      host.innerHTML = "<p class='sub small'>No employees assigned to this venue yet.</p>";
      setText("aumStatus", "0 staff assignments.");
      return;
    }
    host.innerHTML = `<div class="aum-staff-table-wrap" data-keep-visible="true">
      <table class="aum-staff-table" data-keep-visible="true">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role(s)</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${designationsCache.map((row) => {
            const roles = Array.isArray(row.workerRoles) ? row.workerRoles.join(", ") : (row.roleElectionType || "—");
            return `<tr data-designation-id="${esc(row.id)}">
              <td>${esc(row.workerName || "—")}</td>
              <td>${esc(row.workerEmail || "—")}</td>
              <td>${esc(roles)}</td>
              <td>${esc(row.status || "active")}</td>
              <td><button type="button" class="aum-remove-btn" data-uid="${esc(row.workerUid || "")}" data-role="${esc(row.roleElectionType || "")}">Remove</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
    host.querySelectorAll(".aum-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => removeAssignment(btn.dataset.uid, btn.dataset.role));
    });
    setText("aumStatus", `${designationsCache.length} staff assignment(s).`);
  }

  async function assignEmployee() {
    const clubLocationId = String(byId("aumVenueSelect")?.value || "").trim();
    const patronEmail = String(byId("aumPatronEmail")?.value || "").trim().toLowerCase();
    const patronUid = String(byId("aumPatronUid")?.value || "").trim();
    const role = String(byId("aumRoleSelect")?.value || "").trim();
    if (!clubLocationId) {
      setText("aumStatus", "Select a venue / business first.");
      return;
    }
    if (!patronEmail && !patronUid) {
      setText("aumStatus", "Enter the patron email (or uid) to assign.");
      return;
    }
    if (!role) {
      setText("aumStatus", "Select a staff role.");
      return;
    }
    try {
      setText("aumStatus", "Assigning employee…");
      const result = await callable("assignVenueEmployee")({
        clubLocationId,
        patronEmail,
        patronUid,
        role,
        requireSelfElection: false
      });
      const data = result?.data || {};
      setText("aumStatus", `Assigned ${data.patronEmail || patronEmail || patronUid} as ${role}.`);
      if (byId("aumPatronEmail")) byId("aumPatronEmail").value = "";
      if (byId("aumPatronUid")) byId("aumPatronUid").value = "";
      await loadDesignations(clubLocationId);
    } catch (err) {
      setText("aumStatus", err?.message || "Could not assign employee.");
    }
  }

  async function removeAssignment(patronUid, role) {
    const clubLocationId = String(byId("aumVenueSelect")?.value || "").trim();
    if (!clubLocationId || !patronUid) return;
    try {
      setText("aumStatus", "Removing assignment…");
      await callable("removeVenueEmployee")({clubLocationId, patronUid, role: role || ""});
      setText("aumStatus", "Assignment removed.");
      await loadDesignations(clubLocationId);
    } catch (err) {
      setText("aumStatus", err?.message || "Could not remove assignment.");
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    byId("aumRefreshVenuesBtn")?.addEventListener("click", async () => {
      try {
        await loadLocations();
        setText("aumStatus", `${locationsCache.length} venue(s) loaded.`);
      } catch (err) {
        setText("aumStatus", err?.message || "Could not load venues.");
      }
    });
    byId("aumVenueSelect")?.addEventListener("change", () => {
      loadDesignations(byId("aumVenueSelect")?.value || "");
    });
    byId("aumAssignBtn")?.addEventListener("click", () => assignEmployee());
    byId("aumRefreshStaffBtn")?.addEventListener("click", () => {
      loadDesignations(byId("aumVenueSelect")?.value || "");
    });
  }

  async function mount() {
    bind();
    const roleSel = byId("aumRoleSelect");
    if (roleSel && !roleSel.dataset.filled) {
      roleSel.innerHTML = roleOptionsHtml("Club Admin");
      roleSel.dataset.filled = "1";
    }
    try {
      if (!locationsCache.length) await loadLocations();
      const venueId = byId("aumVenueSelect")?.value || "";
      if (venueId) await loadDesignations(venueId);
      else setText("aumStatus", "Select a venue, then assign a registered patron to a staff role. Self-election is not required.");
    } catch (err) {
      setText("aumStatus", err?.message || "Could not load Admin User Management.");
    }
  }

  root.FLOQRAdminUserManagement = {mount, STAFF_ROLES};
})(window);
