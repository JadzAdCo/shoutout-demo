/**
 * Master Admin — Display Security
 * Features supported:
 *  - Approved venue public IPs (gateway allowlist)
 *  - Per-board Xibo secrets (?k=) stored privately in displayBoardSecrets
 *  - Obfuscated token view after onboarding (full value only on provision/rotate reveal)
 *  - Per-venue display access log (IP, board, token ok/deny, UA)
 */
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

  async function copyText(value) {
    const text = String(value || "");
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        return true;
      } catch (__) {
        return false;
      }
    }
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

  /**
   * Feature: Obfuscated token panel (normal Security portal view).
   * Full secrets are intentionally not shown — rotate for a one-time clear URL.
   */
  function renderTokenReport(data = {}, oneTimeReveal = null) {
    const host = byId("displayTokenReport");
    if (!host) return;
    const revealHtml = oneTimeReveal?.url ? `
      <div class="display-token-onetime" style="margin:12px 0;padding:12px;border:2px solid #dfff5a;border-radius:12px;background:rgba(223,255,90,.08)">
        <p><strong>⚠️ ONE-TIME full ${esc(oneTimeReveal.label || "board")} URL</strong></p>
        <p class="sub small">${esc(oneTimeReveal.warning || "Paste into Xibo now. This full value will not appear again until the next rotate.")}</p>
        <p><code id="displayOneTimeTokenUrl" style="word-break:break-all">${esc(oneTimeReveal.url)}</code></p>
        <div class="queue-actions">
          <button type="button" id="copyOneTimeDisplayTokenBtn">Copy full Xibo URL</button>
        </div>
      </div>` : "";

    host.innerHTML = `
      <div class="sub small" style="margin-bottom:10px;line-height:1.45">
        <strong>How to rotate (directives)</strong>
        <ol style="margin:6px 0 0;padding-left:1.2rem">
          <li>Choose the venue above and confirm token requirement is ON if Xibo should reject open links.</li>
          <li>Click <em>Generate / rotate</em> for Display 1 or Display 2.</li>
          <li>Immediately copy the yellow one-time URL into the Xibo Webpage widget for that player.</li>
          <li>Save/publish the Xibo layout. The old <code>?k=</code> stops working as soon as you rotate.</li>
          <li>This portal then shows only an obfuscated token (last 4 characters) for confirmation.</li>
        </ol>
      </div>
      <p class="sub small">Token required: <strong>${data.tokenRequired ? "ON" : "OFF"}</strong>
        · Display 1: ${data.primaryHasToken ? `set · <code>${esc(data.primaryTokenObfuscated || "••••")}</code>` : "none"}
        · Display 2: ${data.secondaryHasToken ? `set · <code>${esc(data.secondaryTokenObfuscated || "••••")}</code>` : "none"}</p>
      ${revealHtml}
      <p><strong>Display 1 (ShoutOut) — obfuscated preview</strong></p>
      <p><code style="word-break:break-all">${esc(data.primaryUrlObfuscated || data.primaryBaseUrl || "—")}</code></p>
      <p><strong>Display 2 (supRstar) — obfuscated preview</strong></p>
      <p><code style="word-break:break-all">${esc(data.secondaryUrlObfuscated || data.secondaryBaseUrl || "—")}</code></p>
      <p class="sub small" style="margin-top:10px">Obfuscated URLs are not usable in Xibo. Use onboarding reveal or Rotate for a real <code>?k=</code> URL. Never add <code>?v=</code>.</p>`;

    byId("copyOneTimeDisplayTokenBtn")?.addEventListener("click", async () => {
      const ok = await copyText(oneTimeReveal?.url || "");
      setText("displayTokenStatus", ok ? "Full Xibo URL copied." : "Copy failed — select the yellow URL manually.");
    });
  }

  async function loadVenueDisplayTokens(locationId) {
    setText("displayTokenStatus", `Loading board tokens for ${locationId}…`);
    try {
      const result = await callable("getVenueDisplayTokens")({locationId});
      const data = result?.data || {};
      if (byId("displaySecurityTokenRequired")) {
        byId("displaySecurityTokenRequired").checked = data.tokenRequired === true;
      }
      renderTokenReport(data, null);
      setText("displayTokenStatus", `Loaded obfuscated tokens for ${locationId}.`);
      return data;
    } catch (err) {
      setText("displayTokenStatus", err?.message || "Token load failed.");
      return null;
    }
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
      if (byId("displaySecurityTokenRequired")) byId("displaySecurityTokenRequired").checked = data.displayTokenRequired === true;
      if (byId("displaySecurityNotes")) byId("displaySecurityNotes").value = data.displayIpNotes || "";
      const preview = byId("displaySecurityPreview");
      if (preview) {
        preview.innerHTML = `
          <p><strong>${esc(data.locationName || locationId)}</strong></p>
          <p class="sub small">IP restriction: ${data.displayIpRestrictionEnabled === true ? "ON" : "OFF"} · Approved IPs: ${ips.length}</p>
          <p class="sub small">Token required: ${data.displayTokenRequired === true ? "ON" : "OFF"}</p>
          <p class="sub small">Updated by: ${esc(data.displayIpUpdatedBy || "—")}</p>`;
      }
      setText("displaySecurityStatus", snap.exists
        ? `Loaded display security for ${locationId}.`
        : `No clubLocations doc yet for ${locationId} — save will create settings.`);
      await loadVenueDisplayTokens(locationId);
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
    setText("displaySecurityStatus", `Saving security settings for ${locationId}…`);
    try {
      const result = await callable("setVenueDisplayIps")({
        locationId,
        approvedDisplayIps: String(byId("displaySecurityIps")?.value || ""),
        displayIpRestrictionEnabled: !!byId("displaySecurityRestrict")?.checked,
        displayTokenRequired: !!byId("displaySecurityTokenRequired")?.checked,
        notes: String(byId("displaySecurityNotes")?.value || "")
      });
      const data = result?.data || {};
      setText("displaySecurityStatus", `Saved. IP ${data.displayIpRestrictionEnabled ? "ON" : "OFF"} · Token ${data.displayTokenRequired ? "ON" : "OFF"} · ${Number(data.approvedDisplayIps?.length || 0)} IP(s).`);
      await loadVenueDisplaySecurity();
    } catch (err) {
      setText("displaySecurityStatus", err?.message || "Save failed.");
    }
  }

  /** Feature: Rotate board token — shows one-time clear Xibo URL, then portal returns to obfuscated view. */
  async function rotateBoardToken(board, {clear = false} = {}) {
    const locationId = resolveLocationId();
    if (!locationId) {
      setText("displayTokenStatus", "Choose a venue first.");
      return;
    }
    const label = board === "secondary" ? "Display 2" : "Display 1";
    setText("displayTokenStatus", clear ? `Clearing ${label} token…` : `Rotating ${label} token…`);
    try {
      const result = await callable("rotateVenueDisplayToken")({
        locationId,
        board,
        clear,
        tokenRequired: !!byId("displaySecurityTokenRequired")?.checked
      });
      const data = result?.data || {};
      const summary = await callable("getVenueDisplayTokens")({locationId});
      const view = summary?.data || {};
      if (clear) {
        renderTokenReport(view, null);
        setText("displayTokenStatus", `${label} token cleared. Update Xibo if that board used a token URL.`);
      } else {
        renderTokenReport(view, {
          label,
          url: data.url || "",
          warning: data.warning || ""
        });
        const ok = await copyText(data.url || "");
        setText("displayTokenStatus", ok
          ? `${label} rotated and full URL copied — paste into Xibo now.`
          : `${label} rotated — copy the yellow one-time URL into Xibo now.`);
      }
      await loadDisplayAccessLogs(locationId);
    } catch (err) {
      setText("displayTokenStatus", err?.message || "Token update failed.");
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
      setText("displaySecurityStatus", `Observed IP: ${ip}. Added to the list (click Save to keep).`);
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
      const result = await callable("listDisplayAccessLogs")({locationId, limit: 80});
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
                <th align="left">Token</th>
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
                  <td><code>${esc(row.clientIp || "—")}</code></td>
                  <td>${row.tokenRequired ? (row.tokenOk ? "ok" : (row.tokenProvided ? "bad" : "missing")) : "—"}</td>
                  <td>${row.allowed ? "yes" : "<strong>no</strong>"}</td>
                  <td>${esc(row.reason || "—")}</td>
                  <td><small>${esc((row.userAgent || "").slice(0, 80))}</small></td>
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

  /**
   * Feature: One-click Heist/venue test helper — regenerate Display 1 + Display 2 secrets
   * and show both full Xibo URLs once (yellow reveal). Use when testing both boards.
   */
  async function reissueBothDisplayTokens() {
    const locationId = resolveLocationId();
    if (!locationId) {
      setText("displayTokenStatus", "Choose a venue first (e.g. Heist Washington DC).");
      return;
    }
    setText("displayTokenStatus", `Re-issuing BOTH board tokens for ${locationId}…`);
    try {
      const result = await callable("provisionVenueDisplayTokens")({
        locationId,
        tokenRequired: !!byId("displaySecurityTokenRequired")?.checked || true,
        onlyIfMissing: false,
        force: true
      });
      const data = result?.data || {};
      const summary = await callable("getVenueDisplayTokens")({locationId});
      const view = summary?.data || {};
      if (data.revealOnce && data.primaryUrl && data.secondaryUrl) {
        const host = byId("displayTokenReport");
        if (host) {
          host.innerHTML = `
            <div class="display-token-onetime" style="margin:12px 0;padding:12px;border:2px solid #dfff5a;border-radius:12px;background:rgba(223,255,90,.08)">
              <p><strong>⚠️ ONE-TIME — Heist / venue test URLs for BOTH boards</strong></p>
              <p class="sub small">${esc(data.warning || "Paste into Xibo (or open in a browser) now. Full values will not be shown again until the next re-issue/rotate.")}</p>
              <p><strong>Display 1 (ShoutOut)</strong></p>
              <p><code id="heistTestPrimaryUrl" style="word-break:break-all">${esc(data.primaryUrl)}</code></p>
              <div class="queue-actions"><button type="button" id="copyHeistPrimaryUrlBtn">Copy Display 1 URL</button></div>
              <p style="margin-top:10px"><strong>Display 2 (supRstar)</strong></p>
              <p><code id="heistTestSecondaryUrl" style="word-break:break-all">${esc(data.secondaryUrl)}</code></p>
              <div class="queue-actions"><button type="button" id="copyHeistSecondaryUrlBtn">Copy Display 2 URL</button></div>
            </div>
            <p class="sub small">After this, the portal returns to obfuscated tokens only (${esc(view.primaryTokenObfuscated || "••••")} / ${esc(view.secondaryTokenObfuscated || "••••")}).</p>`;
          byId("copyHeistPrimaryUrlBtn")?.addEventListener("click", async () => {
            setText("displayTokenStatus", (await copyText(data.primaryUrl)) ? "Display 1 URL copied." : "Copy failed.");
          });
          byId("copyHeistSecondaryUrlBtn")?.addEventListener("click", async () => {
            setText("displayTokenStatus", (await copyText(data.secondaryUrl)) ? "Display 2 URL copied." : "Copy failed.");
          });
        }
        setText("displayTokenStatus", `Both tokens ready for ${locationId}. Copy the yellow URLs now.`);
      } else {
        renderTokenReport(view, null);
        setText("displayTokenStatus", data.warning || "Tokens exist but cleartext was not returned.");
      }
      if (byId("displaySecurityTokenRequired")) byId("displaySecurityTokenRequired").checked = true;
      await loadDisplayAccessLogs(locationId);
    } catch (err) {
      setText("displayTokenStatus", err?.message || "Re-issue failed.");
    }
  }

  function bind() {
    byId("loadDisplaySecurityBtn")?.addEventListener("click", () => loadVenueDisplaySecurity());
    byId("saveDisplaySecurityBtn")?.addEventListener("click", () => saveVenueDisplaySecurity());
    byId("detectDisplayIpBtn")?.addEventListener("click", () => detectMyIp());
    byId("refreshDisplayAccessLogsBtn")?.addEventListener("click", () => loadDisplayAccessLogs());
    byId("reissueBothDisplayTokensBtn")?.addEventListener("click", () => reissueBothDisplayTokens());
    byId("rotatePrimaryDisplayTokenBtn")?.addEventListener("click", () => rotateBoardToken("primary"));
    byId("rotateSecondaryDisplayTokenBtn")?.addEventListener("click", () => rotateBoardToken("secondary"));
    byId("clearPrimaryDisplayTokenBtn")?.addEventListener("click", () => rotateBoardToken("primary", {clear: true}));
    byId("clearSecondaryDisplayTokenBtn")?.addEventListener("click", () => rotateBoardToken("secondary", {clear: true}));
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
    detectMyIp,
    rotateBoardToken
  };
})(window);
