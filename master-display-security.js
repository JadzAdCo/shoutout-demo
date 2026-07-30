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

  /** Last fetched access-log rows — used by “Add IPs from access log”. */
  let lastAccessLogRows = [];

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

  /**
   * Feature: suggest a stable IPv6 /64 from a host address seen in the access log.
   * Xibo devices often change the last 64 bits while staying in the same /64.
   */
  function ipv6Slash64Suggestion(ip = "") {
    const raw = String(ip || "").trim().toLowerCase();
    if (!raw.includes(":")) return "";
    const cleaned = raw.replace(/^\[|\]$/g, "");
    const sides = cleaned.split("::");
    let head = (sides[0] ? sides[0].split(":") : []).filter(Boolean);
    let tail = sides.length > 1 ? (sides[1] ? sides[1].split(":") : []).filter(Boolean) : [];
    if (sides.length === 1) {
      head = cleaned.split(":").filter(Boolean);
      tail = [];
    }
    const missing = 8 - (head.length + tail.length);
    if (missing < 0) return "";
    const full = [...head, ...Array(Math.max(0, missing)).fill("0"), ...tail];
    if (full.length < 4) return "";
    const p = full.slice(0, 4).map((h) => (parseInt(h || "0", 16) || 0).toString(16));
    return `${p.join(":")}::/64`;
  }

  /**
   * Feature: pull distinct client IPs (and IPv6 /64 suggestions) from the access log into the allowlist box.
   */
  async function importIpsFromAccessLog() {
    const locationId = resolveLocationId();
    if (!locationId) {
      setText("displaySecurityStatus", "Choose a venue first.");
      return;
    }
    if (!lastAccessLogRows.length) {
      await loadDisplayAccessLogs(locationId);
    }
    const box = byId("displaySecurityIps");
    if (!box) return;
    const existing = String(box.value || "").split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
    const seen = new Set(existing.map((x) => x.toLowerCase()));
    let added = 0;
    lastAccessLogRows.forEach((row) => {
      const ip = String(row.clientIp || "").trim();
      if (!ip || ip === "—" || String(row.displayBoard || "") === "master-admin") return;
      const candidates = [ip];
      const slash64 = ipv6Slash64Suggestion(ip);
      if (slash64) candidates.push(slash64);
      candidates.forEach((c) => {
        const key = c.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        existing.push(c);
        added += 1;
      });
    });
    box.value = existing.join("\n");
    setText("displaySecurityStatus", added
      ? `Added ${added} address/prefix entr${added === 1 ? "y" : "ies"} from the access log (includes IPv6 /64 suggestions). Review, then Save.`
      : "No new IPs to add from the current log (board rows only; master-admin probes skipped).");
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
      const byIdMap = new Map();
      Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || window.FLOQR_CLUB_LOCATIONS || {}).forEach(([id, data]) => {
        if (id) byIdMap.set(id, {id, ...data});
      });
      const snap = await firebase.firestore().collection("clubLocations").limit(400).get();
      snap.docs.forEach((d) => {
        const prev = byIdMap.get(d.id) || {};
        byIdMap.set(d.id, {...prev, ...(d.data() || {}), id: d.id});
      });
      const rows = Array.from(byIdMap.values())
        .sort((a, b) => String(a.locationName || a.brandName || a.id).localeCompare(String(b.locationName || b.brandName || b.id)));
      global.__floqrMasterClubs = rows;
      list.innerHTML = clubOptionsHtml(rows);
    } catch (_) {
      const rows = Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || window.FLOQR_CLUB_LOCATIONS || {})
        .map(([id, data]) => ({id, ...data}))
        .sort((a, b) => String(a.locationName || a.brandName || a.id).localeCompare(String(b.locationName || b.brandName || b.id)));
      global.__floqrMasterClubs = rows;
      list.innerHTML = clubOptionsHtml(rows);
    }
  }

  /**
   * Feature: Obfuscated token panel (normal Security portal view).
   * Full secrets are intentionally not shown — rotate for a one-time clear URL.
   * Obfuscated last-4 keys sit behind "View Obfuscated Keys" (not help-popout nested text).
   */
  function obfuscatedKeysTableHtml(data = {}) {
    const d1 = data.primaryHasToken ? (data.primaryTokenObfuscated || "••••") : "none";
    const d2 = data.secondaryHasToken ? (data.secondaryTokenObfuscated || "••••") : "none";
    return `<details class="display-obfuscated-keys" data-keep-visible="true">
      <summary class="display-obfuscated-keys-btn">View Obfuscated Keys</summary>
      <div class="display-obfuscated-keys-panel" data-keep-visible="true">
        <p class="display-obfuscated-keys-meta" data-keep-visible="true">Token required: <strong>${data.tokenRequired ? "ON" : "OFF"}</strong></p>
        <table class="display-obfuscated-keys-table" data-keep-visible="true">
          <thead>
            <tr>
              <th scope="col">Display</th>
              <th scope="col">Obfuscated Keys showing last 4 digits</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Display 1 (ShoutOut)</td>
              <td><code>${esc(d1)}</code></td>
            </tr>
            <tr>
              <td>Display 2 (supRstar)</td>
              <td><code>${esc(d2)}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>`;
  }

  function renderTokenReport(data = {}, oneTimeReveal = null) {
    const host = byId("displayTokenReport");
    if (!host) return;
    const revealHtml = oneTimeReveal?.url ? `
      <div class="display-token-onetime" style="margin:12px 0;padding:12px;border:2px solid #dfff5a;border-radius:12px;background:rgba(223,255,90,.08)">
        <p><strong>⚠️ ONE-TIME full ${esc(oneTimeReveal.label || "board")} URL</strong></p>
        <p class="sub small" data-keep-visible="true">${esc(oneTimeReveal.warning || "Paste into Xibo now. This full value will not appear again until the next rotate.")}</p>
        <p><code id="displayOneTimeTokenUrl" style="word-break:break-all">${esc(oneTimeReveal.url)}</code></p>
        <div class="queue-actions">
          <button type="button" id="copyOneTimeDisplayTokenBtn">Copy full Xibo URL</button>
        </div>
      </div>` : "";

    host.innerHTML = `
      <div class="sub small" style="margin-bottom:10px;line-height:1.45" data-keep-visible="true">
        <strong>How to rotate (directives)</strong>
        <ol style="margin:6px 0 0;padding-left:1.2rem">
          <li>Choose the venue above and confirm token requirement is ON if Xibo should reject open links.</li>
          <li>Click <em>Generate / rotate</em> for Display 1 or Display 2.</li>
          <li>Immediately copy the yellow one-time URL into the Xibo Webpage widget for that player.</li>
          <li>Save/publish the Xibo layout. The old <code>?k=</code> stops working as soon as you rotate.</li>
          <li>This portal then shows only an obfuscated token (last 4 characters) for confirmation.</li>
        </ol>
      </div>
      ${obfuscatedKeysTableHtml(data)}
      ${revealHtml}
      <p class="sub small" style="margin-top:10px" data-keep-visible="true">Obfuscated secrets are confirmation-only (last 4 digits). Use onboarding reveal or Rotate for a real <code>?k=</code> URL. Never add <code>?v=</code>.</p>`;

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
      // Do not overwrite the Master Admin token checkbox from token portal status —
      // IP restriction and token lock are independent controls.
      renderTokenReport(data, null);
      setText("displayTokenStatus", `Loaded obfuscated tokens for ${locationId}.`);
      return data;
    } catch (err) {
      setText("displayTokenStatus", err?.message || "Token load failed.");
      return null;
    }
  }

  function renderDisplaySecurityStatus(data = {}, ips = []) {
    const preview = byId("displaySecurityPreview");
    if (!preview) return;
    const ipOn = data.displayIpRestrictionEnabled === true;
    const tokenOn = data.displayTokenRequired !== false;
    const ipCount = Array.isArray(ips) ? ips.length : 0;
    const name = data.locationName || data.brandName || "";
    preview.innerHTML = `
      <div class="display-security-status-row">
        ${name ? `<strong class="display-security-status-venue">${esc(name)}</strong>` : ""}
        <span class="display-security-badge ${ipOn ? "is-on" : "is-off"}">IP restriction ${ipOn ? "ON" : "OFF"}</span>
        <span class="display-security-badge ${tokenOn ? "is-on" : "is-off"}">Token lock ${tokenOn ? "ON" : "OFF"}</span>
        <span class="display-security-badge">${ipCount} approved IP${ipCount === 1 ? "" : "s"}</span>
      </div>
      <p class="sub small">Updated by: ${esc(data.displayIpUpdatedBy || "—")}</p>`;
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
      // Exact saved value: undefined/true → checked (default lock), explicit false → unchecked (IP-only tests).
      if (byId("displaySecurityTokenRequired")) {
        byId("displaySecurityTokenRequired").checked = data.displayTokenRequired !== false;
      }
      if (byId("displaySecurityNotes")) byId("displaySecurityNotes").value = data.displayIpNotes || "";
      renderDisplaySecurityStatus(data, ips);
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
      setText("displaySecurityStatus", `Observed IP: ${ip}. Added to the list (click Save to keep). If Xibo logs show a different IPv6 address, add that too — venues often use both.`);
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
      lastAccessLogRows = rows;
      if (!rows.length) {
        host.innerHTML = "<p class='sub'>No display access logs yet. Open a venue display page to generate one.</p>";
        setText("displayAccessLogStatus", "No logs.");
        return;
      }
      // Use display-access-log-table (NOT .report-table) — admin.css .report-table is a div-grid pattern that breaks <table>.
      host.innerHTML = `
        <div class="display-access-log-wrap">
          <table class="display-access-log-table" role="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Venue</th>
                <th scope="col">Board</th>
                <th scope="col">Client IP</th>
                <th scope="col">Hostname</th>
                <th scope="col">MAC Address</th>
                <th scope="col">Token</th>
                <th scope="col">IP restrict</th>
                <th scope="col">Allowed</th>
                <th scope="col">Reason</th>
                <th scope="col">UA / platform</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => {
                const tokenCell = row.tokenRequired
                  ? (row.tokenOk ? "ok" : (row.tokenProvided ? "bad" : "missing"))
                  : "off";
                const allowedCell = row.allowed ? "yes" : "no";
                return `
                <tr class="${row.allowed ? "is-allowed" : "is-denied"}">
                  <td>${esc(formatWhen(row.createdAtMs))}</td>
                  <td>${esc(row.locationName || row.locationId)}</td>
                  <td>${esc(row.displayBoard || "—")}</td>
                  <td><code>${esc(row.clientIp || "—")}</code>${row.reportedIp && row.reportedIp !== row.clientIp ? `<br/><small>reported ${esc(row.reportedIp)}</small>` : ""}</td>
                  <td>${esc(row.hostname || "—")}</td>
                  <td>${esc(row.macAddress || "n/a")}</td>
                  <td>${esc(tokenCell)}</td>
                  <td>${row.restrictionEnabled ? "on" : "off"}</td>
                  <td><strong>${allowedCell}</strong></td>
                  <td>${esc(row.reason || "—")}</td>
                  <td class="display-access-log-ua"><small>${esc((row.userAgent || "").slice(0, 100))}${row.platform ? ` · ${esc(row.platform)}` : ""}</small></td>
                </tr>`;
              }).join("")}
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
        tokenRequired: !!byId("displaySecurityTokenRequired")?.checked,
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
              <p class="sub small" data-keep-visible="true">${esc(data.warning || "Paste into Xibo (or open in a browser) now. Full values will not be shown again until the next re-issue/rotate.")}</p>
              <p><strong>Display 1 (ShoutOut)</strong></p>
              <p><code id="heistTestPrimaryUrl" style="word-break:break-all">${esc(data.primaryUrl)}</code></p>
              <div class="queue-actions"><button type="button" id="copyHeistPrimaryUrlBtn">Copy Display 1 URL</button></div>
              <p style="margin-top:10px"><strong>Display 2 (supRstar)</strong></p>
              <p><code id="heistTestSecondaryUrl" style="word-break:break-all">${esc(data.secondaryUrl)}</code></p>
              <div class="queue-actions"><button type="button" id="copyHeistSecondaryUrlBtn">Copy Display 2 URL</button></div>
            </div>
            <p class="sub small" data-keep-visible="true">After this, the portal returns to obfuscated tokens only. Use <em>View Obfuscated Keys</em> to confirm last-4 digits.</p>
            ${obfuscatedKeysTableHtml(view)}`;
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
      await loadDisplayAccessLogs(locationId);
    } catch (err) {
      setText("displayTokenStatus", err?.message || "Re-issue failed.");
    }
  }

  let systemMessagesUnsub = null;
  let lastSecurityMessages = [];

  function formatMessageDate(ms) {
    const n = Number(ms || 0);
    if (!n) return "—";
    try {
      return new Date(n).toLocaleDateString(undefined, {year: "numeric", month: "short", day: "numeric"});
    } catch (_) {
      return "—";
    }
  }

  function formatMessageTime(ms) {
    const n = Number(ms || 0);
    if (!n) return "—";
    try {
      return new Date(n).toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", second: "2-digit"});
    } catch (_) {
      return "—";
    }
  }

  function boardLabelForMessage(board) {
    const b = String(board || "").toLowerCase();
    if (b === "2" || b === "secondary" || b === "display2" || b === "suprstar") return "Display 2 (supRstar)";
    if (b === "1" || b === "primary" || b === "display" || b === "shoutout") return "Display 1 (ShoutOut)";
    return board ? `Board ${board}` : "";
  }

  function parseSecurityMessageColumns(row = {}) {
    const ms = Number(row.createdAtMs || row.createdAt?.toMillis?.() || 0);
    const isTwilio = row.type === "twilioSecurityAlert" || row.provider === "twilio";
    const venue = isTwilio
      ? "Twilio"
      : (String(row.locationName || row.clubLocationId || "—").trim() || "—");
    const error = String(row.title || (isTwilio ? "Twilio security alert" : "Display access denied")).trim();
    const board = boardLabelForMessage(row.displayBoard);
    const body = String(row.body || "").trim();
    let description = "";
    let causation = "";

    if (isTwilio) {
      description = body || String(row.errorMessage || "Twilio Debugger security event.").trim();
      causation = [
        row.errorCode ? `Code ${row.errorCode}` : "",
        row.denialReason || "",
        row.moreInfo || "",
        row.eventSid ? `Event ${row.eventSid}` : ""
      ].filter(Boolean).join(". ") || "Review Twilio Monitor / Debugger logs.";
      return {
        date: formatMessageDate(ms),
        time: formatMessageTime(ms),
        venue,
        error,
        description: description || "—",
        causation: causation || "—"
      };
    }

    if (board || row.clientIp || row.locationName || row.clubLocationId) {
      description = [
        board ? `${board} blocked for ${row.locationName || row.clubLocationId || venue}.` : "",
        row.clientIp ? `IP ${row.clientIp}.` : ""
      ].filter(Boolean).join(" ");
    }

    if (row.denialReason) {
      causation = `${String(row.denialReason).trim()}. Device was shown the Floq Media / FloqR not-configured message.`;
    }

    if ((!description || !causation) && body) {
      const reasonMatch = body.match(/Reason:\s*([^.]*)\.?/i);
      const deviceMatch = body.match(/Device was shown[\s\S]*$/i);
      if (!description) {
        description = reasonMatch
          ? body.slice(0, reasonMatch.index).replace(/\s+/g, " ").trim()
          : body;
      }
      if (!causation) {
        const reason = reasonMatch ? reasonMatch[1].trim() : "";
        const device = deviceMatch ? deviceMatch[0].trim() : "Device was shown the Floq Media / FloqR not-configured message.";
        causation = reason ? `${reason}. ${device}` : device;
      }
    }

    return {
      date: formatMessageDate(ms),
      time: formatMessageTime(ms),
      venue,
      error,
      description: description || "—",
      causation: causation || "—"
    };
  }

  function setSecurityMessagesBlink(hasUnread) {
    const tab = byId("securitySystemMessagesTab");
    if (tab) {
      tab.classList.toggle("is-blink", !!hasUnread);
      tab.setAttribute("aria-label", hasUnread
        ? "Security System Messages — new deny alerts"
        : "Security System Messages");
    }
    // Also pulse the parent Security tab so unread alerts are visible before expanding.
    const parent = document.querySelector('.admin-tab-parent[data-group="security"]');
    if (parent) parent.classList.toggle("is-blink", !!hasUnread);
    syncSecurityMessagesAck(hasUnread);
  }

  function syncSecurityMessagesAck(hasUnread) {
    const ack = byId("securityMessagesAckRead");
    if (!ack) return;
    // Checked only when there is nothing unread (including empty inbox).
    ack.checked = !hasUnread;
  }

  async function acknowledgeAllSecurityMessagesRead() {
    const ids = lastSecurityMessages.filter((row) => row.read !== true).map((row) => row.id).filter(Boolean);
    if (!ids.length) {
      setSecurityMessagesBlink(false);
      setText("securitySystemMessagesStatus", lastSecurityMessages.length
        ? `${lastSecurityMessages.length} security message(s)`
        : "No security system messages.");
      return;
    }
    try {
      await Promise.all(ids.map((id) => firebase.firestore().collection("inboxNotifications").doc(id).set({
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp(),
        acknowledgedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true})));
      // Optimistic local update so blink clears immediately before snapshot returns.
      lastSecurityMessages = lastSecurityMessages.map((row) => (
        ids.includes(row.id) ? {...row, read: true} : row
      ));
      setSecurityMessagesBlink(false);
      setText("securitySystemMessagesStatus", `${lastSecurityMessages.length} security message(s)`);
    } catch (err) {
      const ack = byId("securityMessagesAckRead");
      if (ack) ack.checked = false;
      setText("securitySystemMessagesStatus", err?.message || "Could not acknowledge messages as read.");
    }
  }

  function selectedSecurityMessageIds() {
    return Array.from(document.querySelectorAll("#masterSystemMessages .security-msg-check:checked"))
      .map((el) => String(el.value || "").trim())
      .filter(Boolean);
  }

  function bindSecurityMessageTableActions(host) {
    const selectAll = host.querySelector("#securityMsgSelectAll");
    const checks = () => Array.from(host.querySelectorAll(".security-msg-check"));
    selectAll?.addEventListener("change", () => {
      const on = !!selectAll.checked;
      checks().forEach((box) => { box.checked = on; });
    });
    host.querySelector("#securityMsgSelectAllBtn")?.addEventListener("click", () => {
      checks().forEach((box) => { box.checked = true; });
      if (selectAll) selectAll.checked = true;
    });
    host.querySelector("#securityMsgDeleteSelectedBtn")?.addEventListener("click", () => {
      deleteSelectedSecurityMessages();
    });
    checks().forEach((box) => {
      box.addEventListener("change", () => {
        if (selectAll) selectAll.checked = checks().length > 0 && checks().every((c) => c.checked);
      });
    });
  }

  function renderSystemMessages(rows = []) {
    const host = byId("masterSystemMessages");
    if (!host) return;
    lastSecurityMessages = rows;
    const unreadCount = rows.filter((row) => row.read !== true).length;
    setSecurityMessagesBlink(unreadCount > 0);
    setText("securitySystemMessagesStatus", rows.length
      ? `${rows.length} security message(s)`
      : "No security system messages.");
    if (!rows.length) {
      host.textContent = "No security system messages yet.";
      return;
    }

    const bodyRows = rows.map((row) => {
      const unread = row.read !== true;
      const cols = parseSecurityMessageColumns(row);
      return `<tr class="${unread ? "is-unread" : ""}" data-message-id="${esc(row.id)}">
        <td class="security-msg-check-cell">
          <input class="security-msg-check" type="checkbox" value="${esc(row.id)}" aria-label="Select message"/>
        </td>
        <td>${esc(cols.date)}</td>
        <td>${esc(cols.time)}</td>
        <td>${esc(cols.venue)}</td>
        <td>${esc(cols.error)}${unread ? " · NEW" : ""}</td>
        <td>${esc(cols.description)}</td>
        <td>${esc(cols.causation)}</td>
      </tr>`;
    }).join("");

    host.innerHTML = `<div class="security-messages-table-wrap" data-keep-visible="true">
      <table class="security-messages-table" data-keep-visible="true">
        <thead>
          <tr>
            <th scope="col" class="security-msg-check-cell">
              <input id="securityMsgSelectAll" type="checkbox" aria-label="Select all messages"/>
            </th>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Venue</th>
            <th scope="col">Error</th>
            <th scope="col">Error Description</th>
            <th scope="col">Causation</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <div class="security-messages-table-actions">
        <button id="securityMsgSelectAllBtn" type="button">Select All</button>
        <button id="securityMsgDeleteSelectedBtn" class="danger" type="button">Delete Selected</button>
      </div>
    </div>`;
    bindSecurityMessageTableActions(host);
  }

  async function deleteSelectedSecurityMessages() {
    const ids = selectedSecurityMessageIds();
    if (!ids.length) {
      setText("securitySystemMessagesStatus", "Select one or more messages first.");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected security message(s)? (Access logs are kept separately.)`)) return;
    try {
      await Promise.all(ids.map((id) => firebase.firestore().collection("inboxNotifications").doc(id).set({
        deleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedAtMs: Date.now(),
        read: true
      }, {merge: true})));
      setText("securitySystemMessagesStatus", `Deleted ${ids.length} selected message(s).`);
    } catch (err) {
      setText("securitySystemMessagesStatus", err?.message || "Delete selected failed.");
    }
  }

  async function deleteSecurityMessage(messageId) {
    const id = String(messageId || "").trim();
    if (!id) return;
    if (!window.confirm("Delete this security system message? (Access logs are kept separately.)")) return;
    try {
      await firebase.firestore().collection("inboxNotifications").doc(id).set({
        deleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedAtMs: Date.now(),
        read: true
      }, {merge: true});
      setText("securitySystemMessagesStatus", "Message deleted.");
    } catch (err) {
      setText("securitySystemMessagesStatus", err?.message || "Delete failed.");
    }
  }

  async function markSecurityMessageRead(messageId) {
    const id = String(messageId || "").trim();
    if (!id) return;
    try {
      await firebase.firestore().collection("inboxNotifications").doc(id).set({
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
    } catch (err) {
      setText("securitySystemMessagesStatus", err?.message || "Could not mark read.");
    }
  }

  async function markVisibleSecurityMessagesRead() {
    const ids = lastSecurityMessages.filter((row) => row.read !== true).map((row) => row.id).filter(Boolean);
    if (!ids.length) {
      setText("securitySystemMessagesStatus", "No unread messages.");
      return;
    }
    try {
      await Promise.all(ids.map((id) => firebase.firestore().collection("inboxNotifications").doc(id).set({
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true})));
      setText("securitySystemMessagesStatus", `Marked ${ids.length} message(s) read.`);
    } catch (err) {
      setText("securitySystemMessagesStatus", err?.message || "Mark read failed.");
    }
  }

  async function deleteReadSecurityMessages() {
    const ids = lastSecurityMessages.filter((row) => row.read === true).map((row) => row.id).filter(Boolean);
    if (!ids.length) {
      setText("securitySystemMessagesStatus", "No read messages to delete.");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} read security message(s)? Logs are not affected.`)) return;
    try {
      await Promise.all(ids.map((id) => firebase.firestore().collection("inboxNotifications").doc(id).set({
        deleted: true,
        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deletedAtMs: Date.now()
      }, {merge: true})));
      setText("securitySystemMessagesStatus", `Deleted ${ids.length} read message(s).`);
    } catch (err) {
      setText("securitySystemMessagesStatus", err?.message || "Delete failed.");
    }
  }

  /**
   * Feature: live Master Admin security system messages for display denials.
   * Blinks Security → Security System Messages while unread deny alerts exist.
   */
  function startMasterSystemMessageFeed() {
    if (systemMessagesUnsub) {
      try { systemMessagesUnsub(); } catch (_) {}
      systemMessagesUnsub = null;
    }
    const user = firebase.auth().currentUser;
    const host = byId("masterSystemMessages");
    if (!user || !host) return;
    host.textContent = "Listening for security deny alerts…";
    try {
      systemMessagesUnsub = firebase.firestore()
        .collection("inboxNotifications")
        .where("recipientUid", "==", user.uid)
        .limit(120)
        .onSnapshot((snap) => {
          const rows = snap.docs
            .map((doc) => ({id: doc.id, ...(doc.data() || {})}))
            .filter((row) => {
              const isSecurity = row.messageCategory === "security"
                || row.type === "displayAccessDenied"
                || row.type === "twilioSecurityAlert";
              return isSecurity && row.deleted !== true;
            })
            .sort((a, b) => Number(b.createdAtMs || b.createdAt?.toMillis?.() || 0) - Number(a.createdAtMs || a.createdAt?.toMillis?.() || 0))
            .slice(0, 40);
          renderSystemMessages(rows);
        }, (err) => {
          host.textContent = err?.message || "Could not load security system messages.";
          setSecurityMessagesBlink(false);
        });
    } catch (err) {
      host.textContent = err?.message || "Could not start security message feed.";
      setSecurityMessagesBlink(false);
    }
  }

  function focusSecurityMessages() {
    startMasterSystemMessageFeed();
    // Opening the page does not auto-clear blink; Master marks read or deletes.
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  async function exportSecurityLogsCsv() {
    const filterRaw = String(byId("securityLogVenueFilter")?.value || "").trim();
    const locationId = filterRaw
      ? (window.FLOQRLocations?.resolveLocationId?.(filterRaw) || filterRaw.toLowerCase().replace(/\s+/g, "-"))
      : "";
    setText("displayAccessLogStatus", "Preparing security log CSV export…");
    try {
      const result = await callable("listDisplayAccessLogs")({locationId, limit: 200});
      const rows = result?.data?.rows || [];
      if (!rows.length) {
        setText("displayAccessLogStatus", "No security logs to export.");
        return;
      }
      const header = ["when","locationId","locationName","displayBoard","clientIp","hostname","macAddress","allowed","reason","tokenRequired","tokenOk","tokenProvided","restrictionEnabled","userAgent","platform"];
      const lines = [header.join(",")];
      rows.forEach((row) => {
        lines.push([
          formatWhen(row.createdAtMs),
          row.locationId,
          row.locationName,
          row.displayBoard,
          row.clientIp,
          row.hostname,
          row.macAddress,
          row.allowed,
          row.reason,
          row.tokenRequired,
          row.tokenOk,
          row.tokenProvided,
          row.restrictionEnabled,
          row.userAgent,
          row.platform
        ].map(csvEscape).join(","));
      });
      const blob = new Blob([lines.join("\n")], {type: "text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `floqr-security-logs-${locationId || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setText("displayAccessLogStatus", `Exported ${rows.length} security log row(s). Retention is 90 days.`);
    } catch (err) {
      setText("displayAccessLogStatus", err?.message || "Export failed.");
    }
  }

  function bind() {
    byId("loadDisplaySecurityBtn")?.addEventListener("click", () => loadVenueDisplaySecurity());
    byId("loadDisplaySecurityBtnBottom")?.addEventListener("click", () => loadVenueDisplaySecurity());
    byId("saveDisplaySecurityBtn")?.addEventListener("click", () => saveVenueDisplaySecurity());
    byId("saveDisplaySecurityBtnBottom")?.addEventListener("click", () => saveVenueDisplaySecurity());
    byId("detectDisplayIpBtn")?.addEventListener("click", () => detectMyIp());
    byId("importIpsFromDisplayLogBtn")?.addEventListener("click", () => importIpsFromAccessLog());
    byId("refreshDisplayAccessLogsBtn")?.addEventListener("click", () => {
      const filter = String(byId("securityLogVenueFilter")?.value || "").trim();
      const id = filter ? resolveLocationIdFromFilter(filter) : "";
      loadDisplayAccessLogs(id);
    });
    byId("exportSecurityLogsBtn")?.addEventListener("click", () => exportSecurityLogsCsv());
    byId("securityMessagesAckRead")?.addEventListener("change", async (event) => {
      const ack = event.currentTarget;
      if (ack?.checked) {
        await acknowledgeAllSecurityMessagesRead();
        return;
      }
      // Blink is driven by unread messages only — unchecking does not re-open them.
      const hasUnread = lastSecurityMessages.some((row) => row.read !== true);
      if (!hasUnread) ack.checked = true;
    });
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
    try {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) startMasterSystemMessageFeed();
        else if (systemMessagesUnsub) {
          try { systemMessagesUnsub(); } catch (_) {}
          systemMessagesUnsub = null;
          renderSystemMessages([]);
          setSecurityMessagesBlink(false);
        }
      });
    } catch (_) {}
  }

  function resolveLocationIdFromFilter(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    try {
      const fromSearch = resolveLocationId();
      // Prefer security log filter box value when present.
      if (byId("securityLogVenueFilter")) {
        const locations = window.SHOUTOUT_CLUB_LOCATIONS || window.FLOQR_CLUB_LOCATIONS || {};
        const lower = value.toLowerCase();
        if (locations[lower]) return lower;
        const hit = Object.entries(locations).find(([, loc]) => {
          const name = String(loc?.locationName || loc?.brandName || "").toLowerCase();
          return name === lower || name.includes(lower) || lower.includes(String(loc?.id || "").toLowerCase());
        });
        if (hit) return hit[0];
      }
      return fromSearch || value.toLowerCase().replace(/\s+/g, "-");
    } catch (_) {
      return value.toLowerCase().replace(/\s+/g, "-");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  global.FLOQRDisplaySecurity = {
    loadVenueDisplaySecurity,
    saveVenueDisplaySecurity,
    loadDisplayAccessLogs,
    detectMyIp,
    rotateBoardToken,
    startMasterSystemMessageFeed,
    focusSecurityMessages,
    populateClubList,
    exportSecurityLogsCsv
  };
})(window);
