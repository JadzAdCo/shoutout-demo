/* Master Admin → Entity Management → Demo Svc / Emp Mgmt: one-time sign-in codes for demo employees.
   Design notes: .cursor/rules/design-notes-demo-signin.mdc */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const PANEL_ID = "demoEmployees";
  const AUDIT_EVENT = "demo.signin_code_issued";
  const MIN_REASON = 8;
  const CLUB_COUNT = 10;
  const DEMO_EMAIL = /^temp_([a-z0-9]+)_(\d+)@floqr-demo\.com$/;
  const ROLE_LABELS = Object.freeze({
    clubadmin: "Club Admin",
    waitress: "Waitress",
    waiter: "Waiter",
    busboy: "Busboy",
    bottle: "Bottle service",
    bartender: "Bartender",
    dj: "DJ",
    promoter: "Promoter"
  });

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"}[c]));
  const sos2fa = () => root.FLOQRSOS2FA;

  let db = null;
  let functions = null;
  let roster = [];
  let selectedEmail = "";
  let issued = null;
  let countdownTimer = null;
  let bound = false;
  let loaded = false;

  function setStatus(message) {
    const el = byId("demoEmpStatus");
    if (el) el.textContent = message || "";
  }

  function unlocked() {
    return !!sos2fa()?.isUnlocked?.(SCOPE);
  }

  function roleLabel(key) {
    return ROLE_LABELS[key] || String(key || "").replace(/^\w/, c => c.toUpperCase());
  }

  function demoEmail(roleKey, n) {
    return `temp_${roleKey}_${n}@floqr-demo.com`;
  }

  function parseDemoEmail(email) {
    const match = DEMO_EMAIL.exec(String(email || "").trim().toLowerCase());
    return match ? {roleKey: match[1], n: Number(match[2])} : null;
  }

  function clubName(n) {
    const club = root.FLOQRTempQaShowcase?.CLUBS?.[n - 1];
    return club?.brand || `temp-democlub-${n}`;
  }

  function seedRow(roleKey, n) {
    const person = root.FLOQRTempQaShowcase?.personRecord?.(roleKey, n, false);
    return {
      email: demoEmail(roleKey, n),
      roleKey,
      n,
      name: person?.name || "",
      role: roleLabel(roleKey),
      clubId: `temp-democlub-${n}`,
      club: clubName(n),
      uid: "",
      hasProfile: false
    };
  }

  /** Every packaged demo employee (8 roles × 10 demo clubs), before Firestore says which have a profile. */
  function seedRoster() {
    const rows = [];
    for (let n = 1; n <= CLUB_COUNT; n += 1) {
      Object.keys(ROLE_LABELS).forEach(roleKey => rows.push(seedRow(roleKey, n)));
    }
    return rows;
  }

  function mergeProfile(rows, uid, data = {}) {
    const email = String(data.email || "").trim().toLowerCase();
    const parsed = parseDemoEmail(email);
    if (!parsed) return rows;
    const roles = Array.isArray(data.approvedRoles) ? data.approvedRoles.filter(Boolean) : [];
    const existing = rows.find(row => row.email === email) || seedRow(parsed.roleKey, parsed.n);
    const merged = {
      ...existing,
      uid,
      hasProfile: true,
      name: String(data.displayName || data.fullName || existing.name || "").trim(),
      role: roles.length ? roles.map(roleLabel).join(", ") : existing.role,
      club: String(data.affiliatedClubName || existing.club || "").trim(),
      clubId: String(data.affiliatedClubId || existing.clubId || "").trim()
    };
    return rows.some(row => row.email === email)
      ? rows.map(row => (row.email === email ? merged : row))
      : [...rows, merged];
  }

  async function loadProfiles() {
    let rows = seedRoster();
    try {
      const snap = await db.collection("users").where("email", ">=", "temp_").where("email", "<", "temp`").limit(400).get();
      snap.forEach(doc => { rows = mergeProfile(rows, doc.id, doc.data() || {}); });
      setStatus(`${rows.length} demo employees · ${rows.filter(row => row.hasProfile).length} with a FLOQR profile.`);
    } catch (error) {
      setStatus(`Showing the packaged demo roster — profiles could not be read (${error?.message || error}).`);
    }
    roster = rows.sort((a, b) => a.n - b.n || a.roleKey.localeCompare(b.roleKey));
    loaded = true;
  }

  function matches(row, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const blob = [row.name, row.email, row.role, row.roleKey, row.club, row.clubId, `#${row.n}`].join(" ").toLowerCase();
    return q.split(/\s+/).every(token => blob.includes(token));
  }

  function filteredRows() {
    return roster.filter(row => matches(row, byId("demoEmpSearch")?.value || ""));
  }

  function renderSelect(rows) {
    const select = byId("demoEmpSelect");
    if (!select) return;
    select.innerHTML = rows.map(row => `<option value="${esc(row.email)}"${row.email === selectedEmail ? " selected" : ""}>${esc(
      `${row.name || row.email} — ${row.role} · ${row.club}`
    )}</option>`).join("");
  }

  function renderList(rows) {
    const list = byId("demoEmpList");
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<p class="sub">No demo employee matches. Pick a role and club number below instead.</p>`;
      return;
    }
    list.innerHTML = rows.map(row => `
      <div class="demo-emp-row${row.email === selectedEmail ? " is-selected" : ""}" data-demo-emp="${esc(row.email)}">
        <div class="demo-emp-who">
          <strong>${esc(row.name || row.email)}</strong>
          <span class="demo-emp-email">${esc(row.email)}</span>
          <span class="demo-emp-meta">${esc(row.role)} · ${esc(row.club)}${row.hasProfile ? "" : " · no profile yet"}</span>
        </div>
        <button type="button" class="primary" data-demo-emp-generate="${esc(row.email)}">Generate code</button>
      </div>`).join("");
  }

  function renderRoster() {
    const rows = filteredRows();
    renderSelect(rows);
    renderList(rows);
    const count = byId("demoEmpCount");
    if (count) count.textContent = `${rows.length} of ${roster.length}`;
  }

  function fillManualPickers() {
    const role = byId("demoEmpRole");
    const number = byId("demoEmpNumber");
    if (role && !role.options.length) {
      role.innerHTML = Object.entries(ROLE_LABELS).map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join("");
    }
    if (number && !number.options.length) {
      number.innerHTML = Array.from({length: CLUB_COUNT}, (_, i) => `<option value="${i + 1}">${i + 1} · ${esc(clubName(i + 1))}</option>`).join("");
    }
    refreshManualPreview();
  }

  function manualEmail() {
    return demoEmail(byId("demoEmpRole")?.value || "waitress", byId("demoEmpNumber")?.value || "1");
  }

  function refreshManualPreview() {
    const preview = byId("demoEmpManualEmail");
    if (preview) preview.textContent = manualEmail();
  }

  function selectEmployee(email) {
    selectedEmail = String(email || "").trim().toLowerCase();
    renderRoster();
  }

  function clearResult() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    issued = null;
    const code = byId("demoEmpCode");
    if (code) code.textContent = "";
    byId("demoEmpResult")?.classList.add("hidden");
  }

  function tickCountdown() {
    if (!issued) return;
    const seconds = Math.max(0, Math.ceil((issued.expiresAtMs - Date.now()) / 1000));
    const expired = seconds === 0;
    byId("demoEmpCode")?.classList.toggle("is-expired", expired);
    const countdown = byId("demoEmpCountdown");
    if (countdown) {
      countdown.textContent = expired
        ? "Expired — generate a new code."
        : `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    }
    if (expired) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function showResult(data) {
    issued = {email: data.email, code: data.code, expiresAtMs: Number(data.expiresAtMs) || Date.now() + 600000};
    byId("demoEmpResultEmail").textContent = issued.email;
    byId("demoEmpCode").textContent = issued.code;
    byId("demoEmpSearchUrl").textContent = new URL("./", location.href).href;
    byId("demoEmpResult").classList.remove("hidden");
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
    tickCountdown();
    byId("demoEmpResult").scrollIntoView?.({behavior: "smooth", block: "nearest"});
  }

  async function askReason(email) {
    const prompt = root.FLOQRReasonPrompt;
    if (!prompt?.ask) {
      setStatus("The reason prompt did not load. Reload Master Admin and try again.");
      return null;
    }
    const reason = await prompt.ask({summary: `Demo sign-in code for ${email}`, minLength: MIN_REASON, saveLabel: "Generate"});
    if (reason === null) setStatus("Cancelled — no code was generated.");
    return reason;
  }

  async function generate(email, button) {
    const target = String(email || "").trim().toLowerCase();
    if (!DEMO_EMAIL.test(target)) {
      setStatus("Only demo accounts like temp_waitress_1@floqr-demo.com can get a code.");
      return;
    }
    const sos2faSessionId = sos2fa()?.getSessionId?.(SCOPE);
    if (!sos2faSessionId) {
      setStatus("Unlock SOS2FA first.");
      sos2fa()?.requireUnlock?.(SCOPE);
      return;
    }
    selectEmployee(target);
    const reason = await askReason(target);
    if (!reason) return;
    if (button) button.disabled = true;
    try {
      setStatus(`Generating a sign-in code for ${target}…`);
      if (!functions) functions = firebase.app().functions("us-central1");
      const result = await functions.httpsCallable("issueDemoSignInCode")({email: target, reason, sos2faSessionId});
      showResult(result.data || {});
      setStatus(result.data?.accountExists === false
        ? `Code ready. ${target} has no account yet — it is created the first time you sign in.`
        : `Code ready for ${target}.`);
      loadRecent();
    } catch (error) {
      setStatus(error?.message || "The demo sign-in code could not be generated.");
      if (/SOS2FA/i.test(error?.message || "")) {
        sos2fa()?.lock?.(SCOPE);
        sos2fa()?.requireUnlock?.(SCOPE);
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadRecent() {
    const list = byId("demoEmpRecent");
    if (!list || !db) return;
    try {
      const snap = await db.collection("featureServiceAuditLogs").where("eventType", "==", AUDIT_EVENT).limit(50).get();
      const rows = snap.docs.map(doc => doc.data() || {})
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
        .slice(0, 10);
      list.innerHTML = rows.length
        ? `<ul class="demo-emp-recent-list">${rows.map(row => `<li>
            <span class="demo-emp-when">${esc(new Date(Number(row.createdAtMs) || 0).toLocaleString())}</span>
            <span><strong>${esc(row.targetId)}</strong> · by ${esc(row.actorEmail || row.actorUid)}</span>
            ${row.reason ? `<span class="demo-emp-reason">${esc(row.reason)}</span>` : ""}
          </li>`).join("")}</ul>`
        : `<p class="sub small">No demo sign-in codes issued yet.</p>`;
    } catch (error) {
      list.innerHTML = `<p class="sub small">Recent codes could not be loaded (${esc(error?.message || error)}).</p>`;
    }
  }

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch (_) {
      setStatus(`Copy failed — select the ${label.toLowerCase()} and copy it by hand.`);
    }
  }

  function bindUi() {
    if (bound) return;
    bound = true;
    byId("demoEmpSearch")?.addEventListener("input", renderRoster);
    byId("demoEmpSelect")?.addEventListener("change", event => selectEmployee(event.target.value));
    byId("demoEmpGenerateSelectedBtn")?.addEventListener("click", event => {
      generate(selectedEmail || byId("demoEmpSelect")?.value || "", event.currentTarget);
    });
    byId("demoEmpList")?.addEventListener("click", event => {
      const btn = event.target.closest("[data-demo-emp-generate]");
      if (btn) {
        generate(btn.dataset.demoEmpGenerate, btn);
        return;
      }
      const row = event.target.closest("[data-demo-emp]");
      if (row) selectEmployee(row.dataset.demoEmp);
    });
    ["demoEmpRole", "demoEmpNumber"].forEach(id => byId(id)?.addEventListener("change", refreshManualPreview));
    byId("demoEmpManualGenerateBtn")?.addEventListener("click", event => generate(manualEmail(), event.currentTarget));
    byId("demoEmpCopyCodeBtn")?.addEventListener("click", () => issued && copy(issued.code, "Code"));
    byId("demoEmpCopyEmailBtn")?.addEventListener("click", () => issued && copy(issued.email, "Email"));
    byId("demoEmpHideBtn")?.addEventListener("click", clearResult);
    byId("demoEmpReloadBtn")?.addEventListener("click", () => refresh());
    document.addEventListener("floqr:sos2fa-unlocked", event => {
      if (event.detail?.scope === SCOPE && byId(PANEL_ID)?.classList.contains("active")) refresh();
    });
    root.addEventListener("pagehide", clearResult);
  }

  async function refresh() {
    if (!unlocked()) {
      clearResult();
      return;
    }
    setStatus("Loading demo employees…");
    await loadProfiles();
    renderRoster();
    loadRecent();
  }

  /** Called whenever the tab opens; data loads only after the Entity Management SOS2FA unlock. */
  function mount() {
    if (!db) db = firebase.firestore();
    bindUi();
    fillManualPickers();
    if (!unlocked()) {
      clearResult();
      return;
    }
    if (!loaded) refresh();
    else renderRoster();
  }

  const api = {mount, refresh, seedRoster, parseDemoEmail, matches, mergeProfile, ROLE_LABELS, PANEL_ID};
  root.FLOQRMasterDemoEmployees = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
