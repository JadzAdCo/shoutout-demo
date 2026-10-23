/* Master Admin — Features Mgmt (Release Control, Beta & Testing, Audit Trail).
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const PANEL_IDS = Object.freeze([
    "featuresReleaseControl",
    "featuresBetaTesting",
    "featuresAuditTrail"
  ]);
  const AUDIT_LIMIT = 40;
  const USER_SCAN_LIMIT = 120;
  const RESULT_LIMIT = 20;
  const REASON_MIN = 8;
  const LOAD_TIMEOUT_MS = 20000;
  const AUDIT_JSON_MAX = 1200;

  let bound = false;
  let seededOnce = false;
  let userCache = null;
  let features = {};
  /** Last Features Mgmt sub-tab mounted (for SOS2FA re-entry). */
  let activePanelId = "featuresReleaseControl";
  /** Selected patron uid from search results (radio). */
  let selectedInviteUid = "";

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]));
  }

  function setStatus(id, message) {
    const el = byId(id);
    if (el) el.textContent = message || "";
  }

  function db() {
    return root.firebase.firestore();
  }

  function isUnlocked() {
    return !!root.FLOQRSOS2FA?.isUnlocked?.(SCOPE);
  }

  function callable(name) {
    return root.firebase.app().functions("us-central1").httpsCallable(name);
  }

  async function call(name, data = {}) {
    const sessionId = root.FLOQRSOS2FA?.getSessionId?.(SCOPE) || "";
    const result = await callable(name)({...data, sos2faSessionId: sessionId});
    return result?.data || {};
  }

  function errorText(error) {
    return String(error?.message || error || "Request failed.").replace(/^.*?:\s(?=[A-Z])/, "");
  }

  function withTimeout(promise, label, ms = LOAD_TIMEOUT_MS) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Tap Reload.`)), ms);
      })
    ]);
  }

  function formatWhen(ms) {
    const value = Number(ms || 0);
    return value ? new Date(value).toISOString().replace("T", " ").slice(0, 19) : "—";
  }

  function catalog() {
    return root.FLOQRFeatureServices?.CATALOG || [];
  }

  function testLink(base) {
    const nav = root.FLOQRNav;
    const [path, query = ""] = base.route.split("?");
    const params = Object.fromEntries(new URLSearchParams(query));
    return nav?.stampCurrentVersion?.(path, {...params, from: "features-services"}) || base.route;
  }

  async function loadFeatures() {
    const snap = await db().collection("featureServices").get();
    const next = {};
    const canon = key => root.FLOQRFeatureServices?.canonicalizeFeatureKey?.(key) || key;
    catalog().forEach(base => { next[base.key] = root.FLOQRFeatureServices.normalize(base.key, null); });
    snap.forEach(doc => {
      const key = canon(doc.id);
      const row = root.FLOQRFeatureServices.normalize(key, doc.data());
      if (!row) return;
      if (doc.id === "traditionalTheme" && next.siteChrome?.persisted) return;
      next[key] = row;
    });
    features = next;
    return snap.size;
  }

  const FIELD_LABEL = {IsFeatureEnabled: "Enable Feature", IsTestFeature: "Enable Beta Feature"};

  function flagToggle(key, field, value) {
    const checked = value === 1 ? " checked" : "";
    const label = `${featureLabel(key)}: ${FIELD_LABEL[field]}`;
    return `<label class="toggle-inline feature-flag-toggle"><input type="checkbox" data-feature-key="${esc(key)}" data-feature-field="${field}" aria-label="${esc(label)}"${checked}/> <span>${value === 1 ? "1" : "0"}</span></label>`;
  }

  const STATE_TEXT = {
    off: "Off for everyone",
    test: "Testing — granted beta testers see it on Search; Master Admins use the link here",
    live: "Live — every patron sees it on Search"
  };

  const SITE_CHROME_STATE_TEXT = {
    off: "Off for everyone — Nightlife stays the only site look",
    test: "Testing — granted beta testers (and Master Admins) choose Nightlife / Traditional / Black Tiffany / White-Black / Purple & White / Black & Dark Green via isSiteChrome in My Profile",
    live: "Live — every patron can choose Site chrome (isSiteChrome) in My Profile"
  };

  function stateTextFor(base, state) {
    if (base?.key === "siteChrome") return SITE_CHROME_STATE_TEXT[state] || STATE_TEXT[state];
    return STATE_TEXT[state];
  }

  function revisionText(row) {
    return `<span class="feature-revision" title="Number of saved changes to this feature">Revision ${esc(row.revision)}</span>`;
  }

  function featureCell(base, row) {
    const state = stateOf(row);
    const isSiteChrome = base.key === "siteChrome";
    const link = state === "off"
      ? `<small class="feature-open-note">Off — set Enable Feature to 1 to open it.</small>`
      : isSiteChrome
        ? `<a class="feature-open-link" href="${esc(testLink(base))}" target="_blank" rel="noopener">Open Appearance</a><small class="feature-open-note">isSiteChrome: 0 Nightlife · 1 Traditional · 2 Black Tiffany · 3 White/Black · 4 Purple & White · 5 Black & Dark Green</small>`
        : `<a class="feature-open-link" href="${esc(testLink(base))}" target="_blank" rel="noopener">Open ${esc(base.label)}</a>`;
    return `<strong>${esc(base.label)}</strong><small class="feature-state">${esc(stateTextFor(base, state))}</small>${link}`;
  }

  function stateOf(row) {
    return root.FLOQRFeatureServices?.stateOf?.(row) || "off";
  }

  function featureLabel(key) {
    return catalog().find(base => base.key === key)?.label || key;
  }

  function betaKeys() {
    return root.FLOQRFeatureServices?.BETA_ELIGIBLE_KEYS || [];
  }

  function renderFeatures() {
    const tbody = byId("featureServicesRows");
    if (!tbody) return;
    tbody.innerHTML = catalog().map(base => {
      const row = features[base.key] || base;
      const last = row.revision
        ? `<div>${revisionText(row)} · ${esc(row.updatedByEmail || "system")} · ${esc(formatWhen(row.updatedAtMs))}<small class="feature-reason">${esc(row.lastChangeReason || "")}</small></div>`
        : "<div><small>Packaged default (not saved yet)</small></div>";
      return `<tr>
        <td data-label="Feature" class="feature-name-cell">${featureCell(base, row)}</td>
        <td data-label="Enable Feature" class="feature-flag-cell">${flagToggle(base.key, "IsFeatureEnabled", row.IsFeatureEnabled)}</td>
        <td data-label="Enable Beta Feature" class="feature-flag-cell">${flagToggle(base.key, "IsTestFeature", row.IsTestFeature)}</td>
        <td data-label="Last change" class="feature-last-cell">${last}</td>
        <td class="feature-save-cell"><button type="button" data-feature-save="${esc(base.key)}">Save</button></td>
      </tr>`;
    }).join("");
    renderInviteFeatures();
  }

  function featureCheckboxes(attrs, granted = {}) {
    return betaKeys().map(key => {
      const state = stateOf(features[key]);
      const checked = Number(granted[key]) === 1 && state !== "off" ? " checked" : "";
      const disabled = state === "off" ? " disabled" : "";
      const hint = STATE_TEXT[state] ? ` <small>(${esc(state)})</small>` : "";
      return `<label class="toggle-inline"><input type="checkbox" ${attrs} data-feature-key="${esc(key)}"${checked}${disabled}/> ${esc(featureLabel(key))}${hint}</label>`;
    }).join(" ");
  }

  function shortFeatureLabel(key) {
    const map = {
      mingl: "Mingl",
      bartr: "BartR",
      rydr: "RydR",
      floqCast: "floqCast",
      floqAi: "FloqAi",
      vipReservations: "VIP",
      siteChrome: "Chrome",
      traditionalTheme: "Chrome"
    };
    return map[key] || featureLabel(key);
  }

  function featureTableHeaders() {
    return betaKeys().map(key => {
      const state = stateOf(features[key]);
      const hint = STATE_TEXT[state] ? ` (${state})` : "";
      return `<th scope="col" class="beta-feat-col" title="${esc(featureLabel(key))}${esc(hint)}">${esc(shortFeatureLabel(key))}</th>`;
    }).join("");
  }

  function featureTableCells(uid, granted = {}) {
    return betaKeys().map(key => {
      const state = stateOf(features[key]);
      const checked = Number(granted[key]) === 1 && state !== "off" ? " checked" : "";
      const disabled = state === "off" ? " disabled" : "";
      const title = `${featureLabel(key)}${STATE_TEXT[state] ? ` (${state})` : ""}`;
      return `<td class="beta-feat-cell"><label class="beta-feat-check" title="${esc(title)}"><input type="checkbox" data-tester-feature="${esc(uid)}" data-feature-key="${esc(key)}"${checked}${disabled}/><span class="visually-hidden">${esc(title)}</span></label></td>`;
    }).join("");
  }

  function renderInviteFeatures() {
    const box = byId("betaInviteFeatures");
    if (!box) return;
    const previous = Object.fromEntries([...box.querySelectorAll("input[data-invite-feature]")].map(input => [input.dataset.featureKey, input.checked ? 1 : 0]));
    box.innerHTML = `<legend>Features this tester may use</legend>${featureCheckboxes("data-invite-feature=\"1\"", previous)}`;
    syncInviteFeaturesVisibility();
  }

  /** PC: features always visible. Tablet/mobile (≤1024px): only after a patron is selected (.is-ready). */
  function syncInviteFeaturesVisibility() {
    const box = byId("betaInviteFeatures");
    if (!box) return;
    box.classList.toggle("is-ready", !!selectedInviteUid);
  }

  function syncInviteSubmitState() {
    const btn = byId("betaInviteSubmitBtn");
    if (!btn) return;
    const note = String(byId("betaInviteNote")?.value || "").trim();
    const ready = !!selectedInviteUid && note.length >= 3;
    btn.disabled = !ready;
    btn.setAttribute("aria-disabled", ready ? "false" : "true");
  }

  function selectInvitePatron(uid) {
    selectedInviteUid = String(uid || "");
    document.querySelectorAll("#betaPatronResults input[name=\"betaInvitePick\"]").forEach(input => {
      input.checked = input.value === selectedInviteUid;
    });
    syncInviteFeaturesVisibility();
    syncInviteSubmitState();
  }

  function checkedKeys(selector) {
    return [...document.querySelectorAll(selector)].filter(input => input.checked).map(input => input.dataset.featureKey);
  }

  /** Reason for the audit trail, asked after Save. Design notes: .cursor/rules/reason-prompt-on-save.mdc */
  async function askReason(summary, statusId) {
    const promptApi = root.FLOQRReasonPrompt;
    if (!promptApi?.ask) {
      setStatus(statusId, "The reason window did not load. Reload the page and try again.");
      return null;
    }
    const reason = await promptApi.ask({summary, minLength: REASON_MIN});
    if (!reason) setStatus(statusId, "Cancelled — nothing was saved.");
    return reason;
  }

  function flagChangeSummary(key, payload) {
    const row = features[key] || {};
    const changes = Object.keys(FIELD_LABEL)
      .filter(field => Object.prototype.hasOwnProperty.call(payload, field) && Number(row[field]) !== payload[field])
      .map(field => `${FIELD_LABEL[field]} ${Number(row[field]) === 1 ? 1 : 0} → ${payload[field]}`);
    return `${featureLabel(key)}: ${changes.join(", ") || "no change"}`;
  }

  async function saveFeature(key) {
    const inputs = document.querySelectorAll(`#featureServicesRows input[data-feature-key="${CSS.escape(key)}"]`);
    const payload = {featureKey: key};
    inputs.forEach(input => { payload[input.dataset.featureField] = input.checked ? 1 : 0; });
    const row = features[key] || {};
    if (Object.keys(FIELD_LABEL).every(field => Number(row[field]) === payload[field])) {
      setStatus("featureServicesStatus", `Nothing changed for ${featureLabel(key)} — tick or untick a switch first.`);
      return;
    }
    const reason = await askReason(flagChangeSummary(key, payload), "featureServicesStatus");
    if (!reason) return;
    payload.reason = reason;
    setStatus("featureServicesStatus", `Saving ${featureLabel(key)}…`);
    try {
      const result = await call("setFeatureServiceFlags", payload);
      setStatus("featureServicesStatus", `Saved ${featureLabel(key)}: ${result.eventType || "updated"} (audit ${String(result.eventId || "").slice(0, 8)}).`);
      await refreshFeatures();
    } catch (error) {
      setStatus("featureServicesStatus", errorText(error));
    }
  }

  async function refreshFeatures() {
    if (!isUnlocked()) {
      setStatus("featureServicesStatus", "Unlock with SOS2FA to manage features.");
      return;
    }
    try {
      const count = await loadFeatures();
      const drifted = Object.values(features).some(row => row.persisted && row.linkFieldsDrifted);
      if ((count < catalog().length || drifted) && !seededOnce) {
        seededOnce = true;
        try {
          const seeded = await call("seedFeatureServices");
          if (seeded.created?.length || seeded.backfilled?.length) await loadFeatures();
        } catch (error) {
          console.warn("Features & Services seed/backfill failed", errorText(error));
          if (count < catalog().length) throw error;
        }
      }
      renderFeatures();
      setStatus("featureServicesStatus", "");
    } catch (error) {
      setStatus("featureServicesStatus", `Could not load features: ${errorText(error)}`);
    }
  }

  function leanUser(doc) {
    const data = doc.data() || {};
    return {
      uid: doc.id,
      displayName: data.displayName || "",
      fullName: data.fullName || "",
      floqrHandle: data.floqrHandle || "",
      email: data.email || "",
      phone: data.phone || data.phoneNumber || ""
    };
  }

  async function loadUsers() {
    if (userCache) return userCache;
    /* Prefer Network Dashboard lean cache when present — avoids a second fat users scan. */
    const shared = root.networkUsers;
    if (Array.isArray(shared) && shared.length) {
      userCache = shared.map(row => ({
        uid: row.uid || row.id,
        displayName: row.displayName || "",
        fullName: row.fullName || "",
        floqrHandle: row.floqrHandle || "",
        email: row.email || "",
        phone: row.phone || row.phoneNumber || ""
      }));
      return userCache;
    }
    const snap = await withTimeout(db().collection("users").limit(USER_SCAN_LIMIT).get(), "Patron search");
    userCache = snap.docs.map(leanUser);
    return userCache;
  }

  function userLabel(user) {
    return user.displayName || user.fullName || user.floqrHandle || user.email || user.uid;
  }

  async function searchPatrons() {
    const query = String(byId("betaPatronSearch")?.value || "").trim().toLowerCase();
    const out = byId("betaPatronResults");
    if (!out) return;
    selectedInviteUid = "";
    syncInviteFeaturesVisibility();
    syncInviteSubmitState();
    if (query.length < 2) {
      out.innerHTML = "<p class=\"sub small\">Type at least 2 characters.</p>";
      return;
    }
    out.innerHTML = "<p class=\"sub small\">Searching…</p>";
    try {
      const users = await loadUsers();
      const hits = users.filter(user => [user.displayName, user.fullName, user.floqrHandle, user.email, user.phone, user.uid]
        .some(value => String(value || "").toLowerCase().includes(query))).slice(0, RESULT_LIMIT);
      out.innerHTML = hits.length
        ? hits.map(user => `<label class="queue-item beta-patron-pick"><input type="radio" name="betaInvitePick" value="${esc(user.uid)}"/> <span><strong>${esc(userLabel(user))}</strong> <small>${esc(user.email || "")}</small></span></label>`).join("")
        : "<p class=\"sub small\">No patrons match in the first search window. Try a more specific email.</p>";
    } catch (error) {
      out.innerHTML = `<p class="sub small">${esc(errorText(error))}</p>`;
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function invite(uid) {
    const targetUid = String(uid || selectedInviteUid || "").trim();
    if (!targetUid) {
      setStatus("betaInviteStatus", "Search for a patron and select them first.");
      return;
    }
    const note = String(byId("betaInviteNote")?.value || "").trim();
    if (note.length < 3) {
      setStatus("betaInviteStatus", "Enter a short note (why they were picked) before inviting.");
      return;
    }
    const featureKeys = checkedKeys("#betaInviteFeatures input[data-invite-feature]")
      .filter(key => stateOf(features[key]) !== "off");
    if (!featureKeys.length) {
      setStatus("betaInviteStatus", "Tick at least one Live or Beta feature (Off features cannot be granted).");
      syncInviteFeaturesVisibility();
      return;
    }
    setStatus("betaInviteStatus", "Sending invitation…");
    try {
      const result = await call("createBetaInvite", {targetUid, featureKeys, note});
      const url = new URL(result.invitePath, location.href).href;
      const copied = await copyText(url);
      const granted = featureKeys.map(featureLabel).join(", ");
      setStatus("betaInviteStatus", `Invitation for ${granted} sent to ${result.targetEmailMasked || "the patron"}'s Inbox. ${copied ? "Link copied to clipboard." : `Link: ${url}`} Expires ${formatWhen(result.expiresAtMs)} UTC.`);
      selectedInviteUid = "";
      if (byId("betaInviteNote")) byId("betaInviteNote").value = "";
      syncInviteFeaturesVisibility();
      syncInviteSubmitState();
      await loadBeta();
      await loadAudit();
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function loadBeta() {
    const testersEl = byId("betaTesterList");
    const invitesEl = byId("betaInviteList");
    if (testersEl) testersEl.innerHTML = "<p class=\"sub small\">Loading beta testers…</p>";
    if (invitesEl) invitesEl.innerHTML = "<p class=\"sub small\">Loading pending invites…</p>";
    const [testersResult, invitesResult] = await Promise.allSettled([
      withTimeout(db().collection("betaTesters").where("status", "==", "active").limit(100).get(), "Beta testers"),
      withTimeout(db().collection("betaInvites").where("status", "==", "pending").limit(100).get(), "Pending invites")
    ]);
    if (testersEl) {
      if (testersResult.status === "rejected") {
        testersEl.innerHTML = `<p class="sub small">${esc(errorText(testersResult.reason))}</p>`;
      } else {
        const testers = testersResult.value;
        if (testers.empty) {
          testersEl.innerHTML = "<p class=\"sub small\">No active beta testers.</p>";
        } else {
          const body = testers.docs.map(doc => {
            const row = doc.data();
            const uid = esc(doc.id);
            const who = esc(row.emailMasked || doc.id);
            const meta = `since ${esc(formatWhen(row.acceptedAtMs))} · by ${esc(row.invitedByEmail || "—")}`;
            return `<tr data-tester-uid="${uid}">
              <td class="beta-tester-who"><strong>${who}</strong><small>${meta}</small></td>
              ${featureTableCells(uid, row.features || {})}
              <td class="beta-tester-actions">
                <button type="button" class="primary" data-beta-features-save="${uid}">Save</button>
                <button type="button" class="ghost" data-beta-revoke="${uid}">Revoke</button>
              </td>
            </tr>`;
          }).join("");
          testersEl.innerHTML = `<div class="beta-testers-scroll" role="region" aria-label="Active beta testers">
            <table class="beta-testers-table">
              <thead><tr><th scope="col">Tester</th>${featureTableHeaders()}<th scope="col">Actions</th></tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>`;
        }
      }
    }
    if (invitesEl) {
      if (invitesResult.status === "rejected") {
        invitesEl.innerHTML = `<p class="sub small">${esc(errorText(invitesResult.reason))}</p>`;
      } else {
        const invites = invitesResult.value;
        const rows = invites.docs.map(doc => doc.data()).sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
        invitesEl.innerHTML = rows.length ? rows.map(row => `<div class="queue-item"><strong>${esc(row.targetName || row.targetEmailMasked || row.targetUid)}</strong>
            <small>${esc(row.targetEmailMasked || "")} · expires ${esc(formatWhen(row.expiresAtMs))} · by ${esc(row.createdByEmail || "")}</small>
            <button type="button" class="ghost" data-invite-revoke="${esc(row.inviteId)}">Revoke invite</button></div>`).join("")
          : "<p class=\"sub small\">No pending invitations.</p>";
      }
    }
  }

  function testerLabel(uid) {
    const button = document.querySelector(`#betaTesterList [data-beta-revoke="${CSS.escape(uid)}"]`);
    const row = button?.closest("tr[data-tester-uid], .queue-item");
    return row?.querySelector(".beta-tester-who strong, strong")?.textContent || "this beta tester";
  }

  async function revokeTester(uid) {
    const reason = await askReason(`Revoke beta access for ${testerLabel(uid)}`, "betaInviteStatus");
    if (!reason) return;
    try {
      await call("revokeBetaTester", {targetUid: uid, reason});
      setStatus("betaInviteStatus", "Beta access revoked.");
      await loadBeta();
      await loadAudit();
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function saveTesterFeatures(uid) {
    const featureKeys = checkedKeys(`#betaTesterList input[data-tester-feature="${CSS.escape(uid)}"]`);
    if (!featureKeys.length) {
      setStatus("betaInviteStatus", "A beta tester needs at least one feature. To remove all access, use Revoke.");
      return;
    }
    const reason = await askReason(`${testerLabel(uid)}: beta features → ${featureKeys.map(featureLabel).join(", ")}`, "betaInviteStatus");
    if (!reason) return;
    try {
      await call("setBetaTesterFeatures", {targetUid: uid, featureKeys, reason});
      setStatus("betaInviteStatus", "Beta feature access saved.");
      await loadBeta();
      await loadAudit();
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function revokeInvite(inviteId) {
    try {
      await call("revokeBetaInvite", {inviteId});
      setStatus("betaInviteStatus", "Invitation revoked.");
      await loadBeta();
      await loadAudit();
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function recordPromotion() {
    const testKeys = Object.values(features).filter(row => stateOf(row) === "test").map(row => row.key);
    const scope = testKeys.length ? testKeys.map(featureLabel).join(", ") : "no feature currently in testing";
    const reason = await askReason(`Promote test code to live (${scope})`, "featurePromotionStatus");
    if (!reason) return;
    setStatus("featurePromotionStatus", "Recording promotion…");
    try {
      const result = await call("logFeatureCodePromotion", {reason, featureKeys: testKeys});
      setStatus("featurePromotionStatus", `Promotion recorded (audit ${String(result.eventId || "").slice(0, 8)}). In GitHub, click Run workflow on the page that just opened.`);
      if (result.workflowUrl) root.open(result.workflowUrl, "_blank", "noopener");
      await loadAudit();
    } catch (error) {
      setStatus("featurePromotionStatus", errorText(error));
    }
  }

  function auditWhen(row) {
    const iso = String(row.createdAtIso || "");
    return iso ? iso.replace("T", " ").replace(/\.\d+Z$/, "Z") : formatWhen(row.createdAtMs);
  }

  function truncated(value, className = "") {
    const text = String(value == null ? "" : value);
    return text ? `<span class="audit-trunc ${className}" title="${esc(text)}">${esc(text)}</span>` : "";
  }

  function auditChange(row) {
    if (!row.before && !row.after) return "";
    let text = `${JSON.stringify(row.before || {}, null, 1)}\n→\n${JSON.stringify(row.after || {}, null, 1)}`;
    if (text.length > AUDIT_JSON_MAX) text = `${text.slice(0, AUDIT_JSON_MAX)}\n… (truncated)`;
    return `<details class="audit-change"><summary>Before → after</summary><pre class="audit-json">${esc(text)}</pre></details>`;
  }

  function outcomeKey(outcome) {
    const value = String(outcome || "").toLowerCase();
    return ["success", "denied", "failure"].includes(value) ? value : "other";
  }

  /** Integrity chain hash (SHA-256) — not a person/record lookup id. */
  function auditChainHashHtml(row) {
    if (!row.chained || !row.hash) return "";
    const full = String(row.hash);
    const short = full.length > 16 ? `${full.slice(0, 12)}…` : full;
    return `<small class="audit-sub audit-mono" title="Integrity chain hash (SHA-256). Used by Verify integrity — not a patron id.&#10;${esc(full)}">chain ${esc(short)}</small>`;
  }

  function patronLabelFromDoc(data = {}, uid = "") {
    const name = String(data.displayName || data.fullName || data.floqrHandle || "").trim();
    const email = String(data.email || "").trim();
    if (name && email) return `${name} · ${email}`;
    if (name) return name;
    if (email) return email;
    return uid ? `uid ${uid.slice(0, 10)}…` : "";
  }

  async function resolveAuditTargetLabels(rows) {
    const labels = Object.create(null);
    const patronUids = [...new Set(
      rows
        .filter(row => String(row.targetType || "") === "patron" && row.targetId)
        .map(row => String(row.targetId))
    )].slice(0, AUDIT_LIMIT);
    await Promise.all(patronUids.map(async uid => {
      try {
        const snap = await db().collection("users").doc(uid).get();
        labels[uid] = patronLabelFromDoc(snap.exists ? snap.data() : {}, uid);
      } catch (_) {
        labels[uid] = `uid ${uid.slice(0, 10)}…`;
      }
    }));
    return labels;
  }

  function auditTargetHtml(row, labels = {}) {
    const type = String(row.targetType || "").trim();
    const id = String(row.targetId || "").trim();
    if (!type && !id) return "—";
    if (type === "patron" && id) {
      const label = labels[id] || row.detail?.targetEmailMasked || `uid ${id.slice(0, 10)}…`;
      return `<span class="audit-trunc" title="Patron Firebase uid: ${esc(id)}">${esc(`patron · ${label}`)}</span>`;
    }
    if (type === "demoAccount" && id) {
      return `<span class="audit-trunc" title="${esc(id)}">${esc(`demo · ${id}`)}</span>`;
    }
    if (type === "feature" && id) {
      return `<span class="audit-trunc" title="${esc(id)}">${esc(`feature · ${featureLabel(id)}`)}</span>`;
    }
    const raw = [type, id].filter(Boolean).join(": ");
    return truncated(raw) || "—";
  }

  function auditRowHtml(row, labels = {}) {
    const seq = row.chained ? `<span class="audit-seq">#${esc(row.seq)}</span>` : "";
    const hash = auditChainHashHtml(row);
    const role = row.actorRole ? `<small class="audit-sub">${esc(row.actorRole)}</small>` : "";
    return `<tr class="audit-row">
      <td data-label="When (UTC)"><time datetime="${esc(row.createdAtIso || "")}">${esc(auditWhen(row))}</time>${seq}${hash}</td>
      <td data-label="Event"><code class="audit-event">${esc(row.eventType || "—")}</code>${auditChange(row)}</td>
      <td data-label="Who">${truncated(row.actorEmail || row.actorUid || "—")}${role}${truncated(row.sourceIpTruncated, "audit-mono")}</td>
      <td data-label="Target">${auditTargetHtml(row, labels)}</td>
      <td data-label="Outcome"><span class="audit-outcome is-${outcomeKey(row.outcome)}">${esc(row.outcome || "—")}</span></td>
      <td data-label="Reason">${esc(row.reason || "—")}</td>
    </tr>`;
  }

  async function loadAudit() {
    const tbody = byId("featureAuditRows");
    if (!tbody) return;
    tbody.innerHTML = "<tr class=\"audit-empty\"><td colspan=\"6\">Loading audit trail…</td></tr>";
    setStatus("featureAuditStatus", "");
    try {
      const snap = await withTimeout(
        db().collection("featureServiceAuditLogs").orderBy("createdAtMs", "desc").limit(AUDIT_LIMIT).get(),
        "Audit trail"
      );
      if (snap.empty) {
        tbody.innerHTML = "<tr class=\"audit-empty\"><td colspan=\"6\">No activity yet.</td></tr>";
        return;
      }
      const rows = snap.docs.map(doc => doc.data() || {});
      const labels = await resolveAuditTargetLabels(rows);
      tbody.innerHTML = rows.map(row => auditRowHtml(row, labels)).join("");
    } catch (error) {
      tbody.innerHTML = `<tr class="audit-empty"><td colspan="6">${esc(errorText(error))}</td></tr>`;
      setStatus("featureAuditStatus", `Could not load audit trail: ${errorText(error)}`);
    }
  }

  async function verifyAudit() {
    setStatus("featureAuditStatus", "Verifying hash chain…");
    try {
      const result = await call("verifyFeatureServiceAuditChain", {limit: 2000});
      setStatus("featureAuditStatus", result.ok
        ? `Integrity OK — ${result.checked} chained records verified (head #${result.headSeq}).`
        : `Integrity FAILED at ${result.brokenAt || "head"} (${result.issue}). Escalate per the security incident process.`);
      await loadAudit();
    } catch (error) {
      setStatus("featureAuditStatus", errorText(error));
    }
  }

  function onPanelClick(event) {
    const pick = event.target.closest("input[name=\"betaInvitePick\"]");
    if (pick) {
      selectInvitePatron(pick.value);
      return;
    }
    const pickLabel = event.target.closest("label.beta-patron-pick");
    if (pickLabel && !event.target.closest("input")) {
      const radio = pickLabel.querySelector("input[name=\"betaInvitePick\"]");
      if (radio) {
        radio.checked = true;
        selectInvitePatron(radio.value);
      }
      return;
    }
    const target = event.target.closest("button");
    if (!target) return;
    if (target.id === "betaInviteSubmitBtn") invite(selectedInviteUid);
    else if (target.dataset.featureSave) saveFeature(target.dataset.featureSave);
    else if (target.dataset.betaFeaturesSave) saveTesterFeatures(target.dataset.betaFeaturesSave);
    else if (target.dataset.betaRevoke) revokeTester(target.dataset.betaRevoke);
    else if (target.dataset.inviteRevoke) revokeInvite(target.dataset.inviteRevoke);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    PANEL_IDS.forEach(id => byId(id)?.addEventListener("click", onPanelClick));
    byId("featureServicesReloadBtn")?.addEventListener("click", () => refreshFeatures());
    byId("betaPatronSearchBtn")?.addEventListener("click", () => searchPatrons());
    byId("betaPatronSearch")?.addEventListener("keydown", event => { if (event.key === "Enter") searchPatrons(); });
    byId("betaInviteNote")?.addEventListener("input", () => syncInviteSubmitState());
    byId("featurePromotionBtn")?.addEventListener("click", () => recordPromotion());
    byId("featureAuditReloadBtn")?.addEventListener("click", () => loadAudit());
    byId("featureAuditVerifyBtn")?.addEventListener("click", () => verifyAudit());
    if (typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(max-width: 1024px)");
      const onMq = () => syncInviteFeaturesVisibility();
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
    document.addEventListener("floqr:sos2fa-unlocked", event => {
      if (event.detail?.scope !== SCOPE) return;
      const active = PANEL_IDS.find(id => byId(id)?.classList.contains("active"));
      if (active) mount(active);
    });
    syncInviteFeaturesVisibility();
    syncInviteSubmitState();
  }

  /** Ensure catalog flags are in memory (needed for beta feature checkboxes). */
  async function ensureFeaturesLoaded() {
    if (Object.keys(features).length) return;
    await withTimeout(loadFeatures(), "Feature catalog");
    renderInviteFeatures();
  }

  async function loadReleaseControl() {
    if (!isUnlocked()) {
      setStatus("featureServicesStatus", "Unlock with SOS2FA to manage features.");
      return;
    }
    setStatus("featureServicesStatus", "Loading feature flags…");
    try {
      await refreshFeatures();
      if (!String(byId("featureServicesStatus")?.textContent || "").trim()) {
        setStatus("featureServicesStatus", "");
      }
    } catch (error) {
      setStatus("featureServicesStatus", errorText(error));
    }
  }

  async function loadBetaTesting() {
    if (!isUnlocked()) {
      setStatus("betaInviteStatus", "Unlock with SOS2FA to manage beta testers.");
      return;
    }
    setStatus("betaInviteStatus", "Loading beta testers…");
    try {
      await ensureFeaturesLoaded();
      await withTimeout(loadBeta(), "Beta testers");
      if (!String(byId("betaInviteStatus")?.textContent || "").trim()) {
        setStatus("betaInviteStatus", "");
      }
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function loadAuditTrail() {
    if (!isUnlocked()) {
      setStatus("featureAuditStatus", "Unlock with SOS2FA to view the audit trail.");
      return;
    }
    setStatus("featureAuditStatus", "Loading audit trail…");
    try {
      await withTimeout(loadAudit(), "Audit trail");
      if (!String(byId("featureAuditStatus")?.textContent || "").trim()) {
        setStatus("featureAuditStatus", "");
      }
    } catch (error) {
      setStatus("featureAuditStatus", errorText(error));
    }
  }

  /** Mount only the active Features Mgmt sub-tab (isolates load time). */
  function mount(panelId) {
    bindOnce();
    const id = PANEL_IDS.includes(panelId) ? panelId : "featuresReleaseControl";
    activePanelId = id;
    if (id === "featuresReleaseControl") return loadReleaseControl();
    if (id === "featuresBetaTesting") return loadBetaTesting();
    if (id === "featuresAuditTrail") return loadAuditTrail();
  }

  root.FLOQRMasterFeatureServices = {
    mount,
    refreshFeatures,
    loadAudit,
    auditRowHtml,
    featureCell,
    flagChangeSummary,
    PANEL_IDS,
    activePanelId: () => activePanelId
  };
})(window);
