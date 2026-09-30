/* Master Admin — Features & Services (flags, beta testers, promotion log, audit trail).
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const PANEL_ID = "featuresServices";
  const AUDIT_LIMIT = 50;
  const USER_SCAN_LIMIT = 500;
  const RESULT_LIMIT = 20;

  let bound = false;
  let seededOnce = false;
  let userCache = null;
  let features = {};

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
    catalog().forEach(base => { next[base.key] = root.FLOQRFeatureServices.normalize(base.key, null); });
    snap.forEach(doc => {
      const row = root.FLOQRFeatureServices.normalize(doc.id, doc.data());
      if (row) next[doc.id] = row;
    });
    features = next;
    return snap.size;
  }

  function flagToggle(key, field, value) {
    const checked = value === 1 ? " checked" : "";
    return `<label class="toggle-inline"><input type="checkbox" data-feature-key="${esc(key)}" data-feature-field="${field}"${checked}/> <span>${value === 1 ? "1" : "0"}</span></label>`;
  }

  function renderFeatures() {
    const tbody = byId("featureServicesRows");
    if (!tbody) return;
    tbody.innerHTML = catalog().map(base => {
      const row = features[base.key] || base;
      const last = row.revision
        ? `r${esc(row.revision)} · ${esc(row.updatedByEmail || "system")} · ${esc(formatWhen(row.updatedAtMs))}<br/><small>${esc(row.lastChangeReason || "")}</small>`
        : "<small>Packaged default (not saved yet)</small>";
      const state = row.IsFeatureEnabled === 1 ? "Live for everyone" : row.IsTestFeature === 1 ? "Admins + beta testers" : "Hidden";
      return `<tr>
        <td><strong>${esc(base.label)}</strong><br/><small>${esc(state)}</small></td>
        <td style="text-align:center">${flagToggle(base.key, "IsFeatureEnabled", row.IsFeatureEnabled)}</td>
        <td style="text-align:center">${flagToggle(base.key, "IsTestFeature", row.IsTestFeature)}</td>
        <td><a href="${esc(testLink(base))}" target="_blank" rel="noopener">Open ${esc(base.label)}</a></td>
        <td>${last}</td>
        <td><button type="button" data-feature-save="${esc(base.key)}">Save</button></td>
      </tr>`;
    }).join("");
  }

  async function saveFeature(key) {
    const reason = String(byId("featureServicesReason")?.value || "").trim();
    if (reason.length < 8) {
      setStatus("featureServicesStatus", "Enter a reason of at least 8 characters before saving. It is saved in the audit trail.");
      byId("featureServicesReason")?.focus();
      return;
    }
    const inputs = document.querySelectorAll(`#featureServicesRows input[data-feature-key="${CSS.escape(key)}"]`);
    const payload = {featureKey: key, reason};
    inputs.forEach(input => { payload[input.dataset.featureField] = input.checked ? 1 : 0; });
    setStatus("featureServicesStatus", `Saving ${key}…`);
    try {
      const result = await call("setFeatureServiceFlags", payload);
      setStatus("featureServicesStatus", `Saved ${key}: ${result.eventType || "updated"} (audit ${String(result.eventId || "").slice(0, 8)}).`);
      await refreshFeatures();
      await loadAudit();
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
      if (count < catalog().length && !seededOnce) {
        seededOnce = true;
        const seeded = await call("seedFeatureServices");
        if (seeded.created?.length) await loadFeatures();
      }
      renderFeatures();
      setStatus("featureServicesStatus", "");
    } catch (error) {
      setStatus("featureServicesStatus", `Could not load features: ${errorText(error)}`);
    }
  }

  async function loadUsers() {
    if (userCache) return userCache;
    const snap = await db().collection("users").limit(USER_SCAN_LIMIT).get();
    userCache = snap.docs.map(doc => ({uid: doc.id, ...doc.data()}));
    return userCache;
  }

  function userLabel(user) {
    return user.displayName || user.fullName || user.floqrHandle || user.email || user.uid;
  }

  async function searchPatrons() {
    const query = String(byId("betaPatronSearch")?.value || "").trim().toLowerCase();
    const out = byId("betaPatronResults");
    if (!out) return;
    if (query.length < 2) {
      out.innerHTML = "<p class=\"sub small\">Type at least 2 characters.</p>";
      return;
    }
    out.innerHTML = "<p class=\"sub small\">Searching…</p>";
    try {
      const users = await loadUsers();
      const hits = users.filter(user => [user.displayName, user.fullName, user.floqrHandle, user.email, user.phone, user.phoneNumber, user.uid]
        .some(value => String(value || "").toLowerCase().includes(query))).slice(0, RESULT_LIMIT);
      out.innerHTML = hits.length
        ? hits.map(user => `<div class="queue-item"><strong>${esc(userLabel(user))}</strong> <small>${esc(user.email || "")}</small>
            <button type="button" data-beta-invite="${esc(user.uid)}">Invite as beta tester</button></div>`).join("")
        : "<p class=\"sub small\">No patrons match.</p>";
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
    setStatus("betaInviteStatus", "Sending invitation…");
    try {
      const result = await call("createBetaInvite", {targetUid: uid, note: String(byId("betaInviteNote")?.value || "").trim()});
      const url = new URL(result.invitePath, location.href).href;
      const copied = await copyText(url);
      setStatus("betaInviteStatus", `Invitation sent to ${result.targetEmailMasked || "the patron"}'s Inbox. ${copied ? "Link copied to clipboard." : `Link: ${url}`} Expires ${formatWhen(result.expiresAtMs)} UTC.`);
      await loadBeta();
      await loadAudit();
    } catch (error) {
      setStatus("betaInviteStatus", errorText(error));
    }
  }

  async function loadBeta() {
    const testersEl = byId("betaTesterList");
    const invitesEl = byId("betaInviteList");
    try {
      const [testers, invites] = await Promise.all([
        db().collection("betaTesters").where("status", "==", "active").limit(200).get(),
        db().collection("betaInvites").where("status", "==", "pending").limit(100).get()
      ]);
      if (testersEl) {
        testersEl.innerHTML = testers.empty ? "<p class=\"sub small\">No active beta testers.</p>" : testers.docs.map(doc => {
          const row = doc.data();
          return `<div class="queue-item"><strong>${esc(row.emailMasked || doc.id)}</strong> <small>since ${esc(formatWhen(row.acceptedAtMs))} · invited by ${esc(row.invitedByEmail || "—")}</small>
            <button type="button" class="ghost" data-beta-revoke="${esc(doc.id)}">Revoke</button></div>`;
        }).join("");
      }
      if (invitesEl) {
        const rows = invites.docs.map(doc => doc.data()).sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
        invitesEl.innerHTML = rows.length ? rows.map(row => `<div class="queue-item"><strong>${esc(row.targetName || row.targetEmailMasked || row.targetUid)}</strong>
            <small>${esc(row.targetEmailMasked || "")} · expires ${esc(formatWhen(row.expiresAtMs))} · by ${esc(row.createdByEmail || "")}</small>
            <button type="button" class="ghost" data-invite-revoke="${esc(row.inviteId)}">Revoke invite</button></div>`).join("")
          : "<p class=\"sub small\">No pending invitations.</p>";
      }
    } catch (error) {
      if (testersEl) testersEl.innerHTML = `<p class="sub small">${esc(errorText(error))}</p>`;
    }
  }

  function askReason(prompt) {
    const value = String(root.prompt(prompt) || "").trim();
    if (value.length < 8) {
      setStatus("betaInviteStatus", "A reason of at least 8 characters is required.");
      return "";
    }
    return value;
  }

  async function revokeTester(uid) {
    const reason = askReason("Reason for revoking this beta tester (saved in the audit trail):");
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
    const reason = String(byId("featurePromotionReason")?.value || "").trim();
    if (reason.length < 8) {
      setStatus("featurePromotionStatus", "Enter a promotion reason of at least 8 characters.");
      return;
    }
    const testKeys = Object.values(features).filter(row => row.IsTestFeature === 1).map(row => row.key);
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

  function auditTarget(row) {
    return [row.targetType, row.targetId].filter(Boolean).join(": ");
  }

  async function loadAudit() {
    const tbody = byId("featureAuditRows");
    if (!tbody) return;
    try {
      const snap = await db().collection("featureServiceAuditLogs").orderBy("createdAtMs", "desc").limit(AUDIT_LIMIT).get();
      tbody.innerHTML = snap.empty ? "<tr><td colspan=\"6\">No activity yet.</td></tr>" : snap.docs.map(doc => {
        const row = doc.data();
        const change = row.before || row.after ? `<br/><small>${esc(JSON.stringify(row.before || {}))} → ${esc(JSON.stringify(row.after || {}))}</small>` : "";
        return `<tr>
          <td>${esc(row.createdAtIso || formatWhen(row.createdAtMs))}${row.chained ? ` <small>#${esc(row.seq)}</small>` : ""}</td>
          <td>${esc(row.eventType)}${change}</td>
          <td>${esc(row.actorEmail || row.actorUid || "—")}<br/><small>${esc(row.actorRole || "")} ${esc(row.sourceIpTruncated || "")}</small></td>
          <td>${esc(auditTarget(row))}</td>
          <td>${esc(row.outcome)}</td>
          <td>${esc(row.reason || "")}</td>
        </tr>`;
      }).join("");
    } catch (error) {
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
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.featureSave) saveFeature(target.dataset.featureSave);
    else if (target.dataset.betaInvite) invite(target.dataset.betaInvite);
    else if (target.dataset.betaRevoke) revokeTester(target.dataset.betaRevoke);
    else if (target.dataset.inviteRevoke) revokeInvite(target.dataset.inviteRevoke);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    byId(PANEL_ID)?.addEventListener("click", onPanelClick);
    byId("featureServicesReloadBtn")?.addEventListener("click", () => refreshFeatures());
    byId("betaPatronSearchBtn")?.addEventListener("click", () => searchPatrons());
    byId("betaPatronSearch")?.addEventListener("keydown", event => { if (event.key === "Enter") searchPatrons(); });
    byId("featurePromotionBtn")?.addEventListener("click", () => recordPromotion());
    byId("featureAuditReloadBtn")?.addEventListener("click", () => loadAudit());
    byId("featureAuditVerifyBtn")?.addEventListener("click", () => verifyAudit());
    document.addEventListener("floqr:sos2fa-unlocked", event => {
      if (event.detail?.scope === SCOPE && byId(PANEL_ID)?.classList.contains("active")) loadAll();
    });
  }

  async function loadAll() {
    if (!isUnlocked()) {
      setStatus("featureServicesStatus", "Unlock with SOS2FA to manage features.");
      return;
    }
    await refreshFeatures();
    await Promise.all([loadBeta(), loadAudit()]);
  }

  function mount() {
    bindOnce();
    loadAll();
  }

  root.FLOQRMasterFeatureServices = {mount, refreshFeatures, loadAudit};
})(window);
