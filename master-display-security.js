/* Master Admin — Display Security (approved IPs + access logs). */
(function (global) {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value || "";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function clubOptionsHtml(rows = []) {
    return rows.map((row) => {
      const id = String(row.id || row.locationId || "").trim();
      const name = String(row.locationName || row.brandName || id).trim();
      if (!id) return "";
      return `<option value="${esc(id)}">${esc(name)} (${esc(id)})</option>`;
    }).join("");
  }

  function resolveLocationId() {
    const raw = String(byId("displaySecuritySearch")?.value || byId("displaySecurityLocationId")?.value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    const clubs = global.__floqrMasterClubs || [];
    const hit = clubs.find((c) => {
      const id = String(c.id || "").toLowerCase();
      const name = String(c.locationName || c.brandName || "").toLowerCase();
      return id === lower || name === lower || `${name} (${id})` === lower || lower.includes(id);
    });
    if (hit) return String(hit.id);
    if (/^[a-z0-9][a-z0-9_-]+$/i.test(raw)) return raw.toLowerCase();
    return "";
  }

  async function populateClubList() {
    const list = byId("displaySecurityOptions");
    if (!list) return;
    try {
      const snap = await firebase.firestore().collection("clubLocations").limit(400).get();
      const rows = snap.docs.map((d) => ({id: d.id, ...(d.data() || {})}))
        .sort((a, b) => String(a.locationName || a.id).localeCompare(String(b.locationName || b.id)));
      global.__floqrMasterClubs = rows;
      list.innerHTML = clubOptionsHtml(rows);
    } catch (_) {}
  }

  async function loadVenueDisplaySecurity() {
    const locationId = resolveLocationId();
    if (!locationId) {
      setText("displaySecurityStatus", "Choose a venue first.");
      return;
    }
    if (byId("displaySecurityLocationId")) byId("displaySecurityLocationId").value = locationId;
    setText("displaySecurityStatus", `Loading display security for ${locationId}…`);
    try {
      const snap = await firebase.firestore().collection("clubLocations").doc(locationId).get();
      const data = snap.exists ? snap.data() || {} : {};
      const ips = Array.isArray(data.approvedDisplayIps) ? data.approvedDisplayIps : [];
      if (byId("displaySecurityIps")) byId("displaySecurityIps").value = ips.join("\n");
      if (byId("displaySecurityRestrict")) byId("displaySecurityRestrict").checked = data.displayIpRestrictionEnabled === true;
      if (byId("displaySecurityNotes")) byId("displaySecurityNotes").value = data.displayIpNotes || "";
      const preview = byId("displaySecurityPreview");
      if (preview) {
        preview.innerHTML = `
          <p><strong>${esc(data.locationName || locationId)}</strong></p>
          <p class="sub small">Restriction: ${data.displayIpRestrictionEnabled === true ? "ON" : "OFF"} · Approved IPs: ${ips.length}</p>
          <p class="sub small">Display 1: <code>display.html?location=${esc(locationId)}</code></p>
          <p class="sub small">Display 2: <code>display2.html?location=${esc(locationId)}</code></p>
          <p class="sub small">Updated by: ${esc(data.displayIpUpdatedBy || "—")}</p>`;
      }
      setText("displaySecurityStatus", snap.exists
        ? `Loaded display security for ${locationId}.`
        : `No clubLocations doc yet for ${locationId} — save will create IP settings.`);
      await loadDisplayAccessLogs(locationId);
    } catch (err) {
      setText("displaySecurityStatus", err?.message || "Load failed.");
    }
  }

  async function saveVenueDisplaySecurity() {
    const locationId = resolveLocationId();
    if (!locationId) {
      setText("displaySecurityStatus", "Choose a venue first.");
      return;
    }
    const approvedDisplayIps = String(byId("displaySecurityIps")?.value || "");
    const displayIpRestrictionEnabled = !!byId("displaySecurityRestrict")?.checked;
    const notes = String(byId("displaySecurityNotes")?.value || "");
    setText("displaySecurityStatus", `Saving approved IPs for ${locationId}…`);
    try {
      const result = await callable("setVenueDisplayIps")({
        locationId,
        approvedDisplayIps,
        displayIpRestrictionEnabled,
        notes
      });
      const data = result?.data || {};
      setText("displaySecurityStatus", `Saved. Restriction ${data.displayIpRestrictionEnabled ? "ON" : "OFF"} · ${Number(data.approvedDisplayIps?.length || 0)} IP(s) · ${Number(data.deviceBindings || 0)} device binding(s).`);
      await loadVenueDisplaySecurity();
    } catch (err) {
      setText("displaySecurityStatus", err?.message || "Save failed.");
    }
  }

  async function detectMyIp() {
    const locationId = resolveLocationId() || "heist-washington-dc";
    setText("displaySecurityStatus", "Detecting this browser’s public IP via Cloud Function…");
    try {
      const result = await callable("checkDisplayAccess")({
        locationId,
        displayBoard: "master-admin",
        pageUrl: location.href,
        userAgent: navigator.userAgent,
        language: navigator.language || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        platform: navigator.platform || ""
      });
      const ip = result?.data?.observedIp || "";
      if (!ip) {
        setText("displaySecurityStatus", "Could not observe an IP from this request.");
        return;
      }
      const box = byId("displaySecurityIps");
      if (box) {
        const lines = String(box.value || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
        if (!lines.includes(ip)) {
          lines.push(ip);
          box.value = lines.join("\n");
        }
      }
      setText("displaySecurityStatus", `Observed IP: ${ip}. Added to the list (click Save to keep). Allowed=${result?.data?.allowed ? "yes" : "no"}.`);
      await loadDisplayAccessLogs(locationId);
    } catch (err) {
      setText("displaySecurityStatus", err?.message || "IP detect failed.");
    }
  }

  function formatWhen(ms) {
    const n = Number(ms || 0);
    if (!n) return "—";
    try { return new Date(n).toLocaleString(); } catch (_) { return String(n); }
  }

  async function loadDisplayAccessLogs(locationIdOverride = "") {
    const locationId = String(locationIdOverride || resolveLocationId() || "").trim();
    const host = byId("displayAccessLogReport");
    if (!host) return;
    setText("displayAccessLogStatus", locationId ? `Loading logs for ${locationId}…` : "Loading recent display access logs…");
    try {
      const result = await callable("listDisplayAccessLogs")({
        locationId,
        limit: 80
      });
      const rows = result?.data?.rows || [];
      if (!rows.length) {
        host.innerHTML = "<p class='sub'>No display access logs yet. Open a venue display page to generate one.</p>";
        setText("displayAccessLogStatus", "No logs.");
        return;
      }
      host.innerHTML = `
        <div class="report-table-wrap" style="overflow:auto">
          <table class="report-table" style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr>
                <th align="left">When</th>
                <th align="left">Venue</th>
                <th align="left">Board</th>
                <th align="left">Client IP</th>
                <th align="left">Allowed</th>
                <th align="left">Reason</th>
                <th align="left">UA / platform</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${esc(formatWhen(row.createdAtMs))}</td>
                  <td>${esc(row.locationName || row.locationId)}</td>
                  <td>${esc(row.displayBoard || "—")}</td>
                  <td><code>${esc(row.clientIp || "—")}</code>${row.reportedIp ? `<br/><small>reported ${esc(row.reportedIp)}</small>` : ""}</td>
                  <td>${row.allowed ? "yes" : "<strong>no</strong>"}${row.restrictionEnabled ? "" : " <small>(open)</small>"}</td>
                  <td>${esc(row.reason || "—")}</td>
                  <td><small>${esc((row.userAgent || "").slice(0, 90))}${row.platform ? ` · ${esc(row.platform)}` : ""}${row.timezone ? ` · ${esc(row.timezone)}` : ""}</small></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
      setText("displayAccessLogStatus", `Showing ${rows.length} log row(s)${locationId ? ` for ${locationId}` : ""}.`);
    } catch (err) {
      host.innerHTML = `<p class='sub'>${esc(err?.message || "Could not load logs.")}</p>`;
      setText("displayAccessLogStatus", err?.message || "Log load failed.");
    }
  }

  function bind() {
    byId("loadDisplaySecurityBtn")?.addEventListener("click", () => loadVenueDisplaySecurity());
    byId("saveDisplaySecurityBtn")?.addEventListener("click", () => saveVenueDisplaySecurity());
    byId("detectDisplayIpBtn")?.addEventListener("click", () => detectMyIp());
    byId("refreshDisplayAccessLogsBtn")?.addEventListener("click", () => loadDisplayAccessLogs());
    byId("displaySecuritySearch")?.addEventListener("change", () => {
      const id = resolveLocationId();
      if (id && byId("displaySecurityLocationId")) byId("displaySecurityLocationId").value = id;
    });
    populateClubList();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  global.FLOQRDisplaySecurity = {
    loadVenueDisplaySecurity,
    saveVenueDisplaySecurity,
    loadDisplayAccessLogs,
    detectMyIp
  };
})(window);
