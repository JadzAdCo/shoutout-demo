/* Master Admin — Security → Data classification (register grid, review guidance, Save all, sensitive fields, simulator, exposure + fix list).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const PANEL_ID = "dataClassification";
  const EDITABLE = ["isPublicAccessible", "isPatronAccessible", "isRegularEmployeeAccessible", "isPrivilegedEmployeeAccessible", "isClubAdminAccessible", "isMasterAdminAccessible"];
  const ROLE_LABEL_KEYS = {
    anonymous: ["dataClass.role.anonymous", "Signed out"],
    patron: ["dataClass.colPatron", "Patron"],
    regular: ["dataClass.colRegular", "Regular employee"],
    privileged: ["dataClass.colPrivileged", "Privileged employee"],
    clubAdmin: ["dataClass.colClubAdmin", "Club Admin"],
    master: ["dataClass.colMaster", "Master Admin"],
    system: ["dataClass.role.system", "System (server only)"]
  };
  const STATUS_TEXT = {
    saved: "Saved",
    default: "Default (not saved)",
    edited: "Edited (not saved)",
    review: "Needs review"
  };
  const NOTE_TEXT = {
    piiPublic: "Personal data is marked Public, so anyone could read it without signing in. Untick Public unless you are sure.",
    piiPatron: "Personal data is readable by every signed-in patron. Untick Patron and use Own record instead.",
    rulesRead: "The live security rules let more people read this than the register allows. Keep the register; the rules are tightened in a release (see What needs fixing).",
    rulesWrite: "Any signed-in account can change this today. Keep the register; writes are restricted in a release (see What needs fixing)."
  };
  const REC_TEXT = {
    shoutouts: "Keep as is: the patron and the club's staff can read it. The display board gets the text from Content playing on display boards, not from here.",
    patronRanks: "Keep Public only if the leaderboard shows nicknames patrons chose. If it shows real names, untick Public.",
    displayDevices: "Keep Public: display boards read it without signing in. Board keys are kept separately and stay Secret.",
    suprstrSessions: "Keep Public for now: the display board joins the live video without signing in. A join code will replace this later.",
    minglGists: "Keep Public if Mingl posts are meant to be seen by people who are not signed in. Otherwise untick Public.",
    guestListRequests: "Keep as is, or untick Regular employee if only door staff and managers should see guest names and phone numbers.",
    clubEmployeeDesignations: "Keep as is. Staff email and phone are already stricter (Club Admin only) under Sensitive fields.",
    featureServices: "Keep as is: Search must know which features are switched on for a signed-in patron.",
    aiIndex: "Tick Public if signed-out visitors should find venues with FloqAi. Leave it if venue search is for signed-in patrons only.",
    paymentLedger: "Keep Club Admin. Set Delete after to 2555 days (7 years) to match tax-record rules."
  };
  const FIX_TEXT = {
    piiRead: ["Personal data any signed-in account can read", "Limit reads to the person, their club's staff, and Master Admins."],
    restrictedWrite: ["Private or personal data any signed-in account can change", "Only the owner, the club's staff, or the FLOQR server may write."],
    clubRead: ["Club or private data any signed-in account can read", "Limit reads to that club's staff or the person it belongs to."],
    publicWrite: ["Published data any signed-in account can edit", "Only the club's admins or the FLOQR server may edit published listings."],
    openWrite: ["Data anyone can write without signing in", "Replace with a short-lived join code for the display board."]
  };

  let bound = false;
  let rows = [];
  let drafts = {};
  let issues = [];
  let rulesAccess = null;

  const byId = id => document.getElementById(id);
  const DC = () => root.FLOQRDataClassification;

  function t(key, fallback) {
    const value = root.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  }

  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) => (values[key] === undefined ? match : String(values[key])));
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]));
  }

  function setStatus(id, message) {
    const el = byId(id);
    if (el) el.textContent = message || "";
  }

  function errorText(error) {
    return String(error?.message || error || "Request failed.").replace(/^.*?:\s(?=[A-Z])/, "");
  }

  function isUnlocked() {
    return !!root.FLOQRSOS2FA?.isUnlocked?.(SCOPE);
  }

  async function call(name, data = {}) {
    const sessionId = root.FLOQRSOS2FA?.getSessionId?.(SCOPE) || "";
    const result = await root.firebase.app().functions("us-central1").httpsCallable(name)({...data, sos2faSessionId: sessionId});
    return result?.data || {};
  }

  function levelLabel(level) {
    return t(`dataClass.level.${level}`, level);
  }

  function formatWhen(ms) {
    const value = Number(ms || 0);
    return value ? new Date(value).toISOString().replace("T", " ").slice(0, 19) : "";
  }

  function reason() {
    return String(byId("dataClassReason")?.value || "").trim();
  }

  async function loadRules() {
    if (rulesAccess) return rulesAccess;
    const response = await fetch(`./firestore.rules?ts=${Date.now()}`, {cache: "no-store"});
    if (!response.ok) throw new Error(`firestore.rules ${response.status}`);
    rulesAccess = DC().parseRulesAccess(await response.text());
    return rulesAccess;
  }

  async function loadRows() {
    const snap = await root.firebase.firestore().collection(DC().COLLECTION).get();
    const saved = {};
    snap.forEach(doc => { saved[DC().collectionFromDocId(doc.id)] = doc.data(); });
    rows = DC().COLLECTIONS.map(collection => ({...DC().normalize(collection, saved[collection] || null), saved: !!saved[collection]}));
    drafts = {};
    return snap.size;
  }

  /** The values on screen: the unsaved edit when there is one, else the loaded row. */
  function current(row) {
    return drafts[row.collection] || row;
  }

  function isEdited(row) {
    const draft = drafts[row.collection];
    return !!draft && DC().diff(row, draft).length > 0;
  }

  function currentRows() {
    return rows.map(current);
  }

  function rowState(row) {
    const shown = current(row);
    const notes = DC().reviewNotes(shown, issues);
    return {shown, notes, ...DC().rowStatus({saved: row.saved, edited: isEdited(row), notes})};
  }

  function box(collection, field, value, disabled) {
    return `<input type="checkbox" data-dc-collection="${esc(collection)}" data-dc-field="${field}"${value ? " checked" : ""}${disabled ? " disabled" : ""} aria-label="${esc(field)}"/>`;
  }

  function rulesCell(collection) {
    const rule = rulesAccess?.[collection];
    return rule ? `${esc(rule.read)} / ${esc(rule.write)}` : "—";
  }

  function statusCell(state) {
    const main = esc(t(`dataClass.status.${state.status}`, STATUS_TEXT[state.status]));
    const review = state.needsReview ? `<br/><strong>${esc(t("dataClass.status.review", STATUS_TEXT.review))}</strong>` : "";
    return `<small>${main}</small>${review}`;
  }

  function notesHtml(notes) {
    const lines = [];
    if (notes.recommendation) {
      lines.push(`<strong>${esc(t("dataClass.recommendation", "Recommendation:"))}</strong> ${esc(t(`dataClass.rec.${notes.recommendation}`, REC_TEXT[notes.recommendation]))}`);
    }
    [...notes.decide.filter(code => code !== "judgment"), ...notes.fix].forEach(code => {
      lines.push(esc(t(`dataClass.note.${code}`, NOTE_TEXT[code])));
    });
    return lines.length ? `<ul class="sub small" style="margin:4px 0 0 1em;padding:0">${lines.map(line => `<li>${line}</li>`).join("")}</ul>` : "";
  }

  function renderRows() {
    const tbody = byId("dataClassRows");
    if (!tbody) return;
    const filter = String(byId("dataClassFilter")?.value || "").trim().toLowerCase();
    const onlyReview = !!byId("dataClassOnlyReview")?.checked;
    tbody.innerHTML = rows.map(row => ({row, state: rowState(row)}))
      .filter(({row}) => !filter || row.collection.toLowerCase().includes(filter) || String(row.description).toLowerCase().includes(filter))
      .filter(({state}) => !onlyReview || state.needsReview)
      .map(({row, state}) => {
        const shown = state.shown;
        const meta = row.saved
          ? `r${esc(row.revision)} · ${esc(row.updatedByEmail)} · ${esc(formatWhen(row.updatedAtMs))}`
          : esc(t("dataClass.notSaved", "Packaged default (not saved yet)"));
        return `<tr>
        <td><strong>${esc(row.collection)}</strong><br/><small>${esc(row.description)}</small><br/><small>${meta}</small>${notesHtml(state.notes)}</td>
        <td>${statusCell(state)}</td>
        <td>${esc(levelLabel(DC().deriveLevel(shown)))}</td>
        ${EDITABLE.map(field => `<td style="text-align:center">${box(row.collection, field, shown[field])}</td>`).join("")}
        <td style="text-align:center">${box(row.collection, DC().SYSTEM_FLAG, 1, true)}</td>
        <td style="text-align:center">${box(row.collection, "ownRecordReadable", shown.ownRecordReadable)}</td>
        <td style="text-align:center">${box(row.collection, "containsPII", shown.containsPII)}</td>
        <td><input type="number" min="0" max="3650" step="1" style="width:6em" data-dc-collection="${esc(row.collection)}" data-dc-field="retentionDays" value="${esc(shown.retentionDays || 0)}"/></td>
        <td><small>${rulesCell(row.collection)}</small></td>
        <td><button type="button" data-dc-save="${esc(row.collection)}">${esc(t("dataClass.save", "Save"))}</button></td>
      </tr>`;
      }).join("");
  }

  function renderSummary() {
    const counts = {saved: 0, defaults: 0, edited: 0, review: 0};
    rows.forEach(row => {
      const state = rowState(row);
      if (state.status === "saved") counts.saved += 1;
      else if (state.status === "default") counts.defaults += 1;
      else counts.edited += 1;
      if (state.needsReview) counts.review += 1;
    });
    setStatus("dataClassSummary", fill(t("dataClass.summary", "{saved} saved · {defaults} default (not saved) · {edited} edited · {review} need review"), counts));
  }

  function renderFields() {
    const tbody = byId("dataClassFieldRows");
    if (!tbody) return;
    tbody.innerHTML = DC().FIELD_CATALOG.map(row => {
      const readers = ["isPublicAccessible", ...DC().TIERS].filter(key => row[key]).map(key => key.replace(/^is|Accessible$/g, "")).join(", ");
      const own = row.ownRecordReadable ? ` · ${esc(t("dataClass.colOwn", "Own record"))}` : "";
      return `<tr><td><strong>${esc(row.collection)}</strong><br/><small>${esc(row.description)}</small></td><td>${esc(levelLabel(row.classificationLevel))}</td><td><small>${esc(readers)}${own} · ${esc(t("dataClass.colSystem", "System"))}</small></td></tr>`;
    }).join("");
  }

  function renderSimRoles() {
    const select = byId("dataClassSimRole");
    if (!select || select.options.length) return;
    select.innerHTML = DC().ROLES.map(role => {
      const [key, fallback] = ROLE_LABEL_KEYS[role];
      return `<option value="${role}">${esc(t(key, fallback))}</option>`;
    }).join("");
    select.value = "patron";
  }

  function renderSim() {
    const tbody = byId("dataClassSimRows");
    if (!tbody) return;
    const role = byId("dataClassSimRole")?.value || "patron";
    const viewer = {role, sameClub: !!byId("dataClassSimSameClub")?.checked, own: !!byId("dataClassSimOwn")?.checked, server: role === "system"};
    const label = {yes: t("dataClass.access.yes", "Yes"), own: t("dataClass.access.own", "Own only"), no: t("dataClass.access.no", "No")};
    const shown = currentRows().map(row => ({...row, classificationLevel: DC().deriveLevel(row)}));
    tbody.innerHTML = DC().simulate(shown, viewer).map(row =>
      `<tr><td>${esc(row.collection)}</td><td>${esc(levelLabel(row.level))}</td><td><strong>${esc(label[row.access])}</strong></td></tr>`
    ).join("");
  }

  function renderExposure() {
    const tbody = byId("dataClassExposureRows");
    const kind = {readBroader: t("dataClass.kindReadBroader", "More people can read it than allowed"), writeOpen: t("dataClass.kindWriteOpen", "Any signed-in account can write it")};
    const severity = {high: t("dataClass.severityHigh", "High"), medium: t("dataClass.severityMedium", "Medium")};
    if (tbody) {
      tbody.innerHTML = issues.map(row =>
        `<tr><td><strong>${esc(severity[row.severity])}</strong></td><td>${esc(row.collection)}</td><td>${esc(kind[row.kind])}</td><td><small>${esc(row.rule)} · ${esc(levelLabel(row.level))}</small></td></tr>`
      ).join("");
    }
    const list = byId("dataClassFixList");
    if (list) {
      list.innerHTML = DC().fixList(issues).map(({group, collections}) => {
        const [title, fix] = FIX_TEXT[group];
        return `<div class="report-block" style="margin-top:8px">
          <strong>${esc(t(`dataClass.fix.${group}.title`, title))}</strong> · <small>${esc(fill(t("dataClass.fixCount", "{count} collections"), {count: collections.length}))}</small>
          <p class="sub small" style="margin:4px 0"><strong>${esc(t("dataClass.fixFix", "Fix:"))}</strong> ${esc(t(`dataClass.fix.${group}.fix`, fix))}</p>
          <p class="sub small" style="margin:0"><code>${collections.map(esc).join("</code>, <code>")}</code></p>
        </div>`;
      }).join("");
    }
    setStatus("dataClassExposureStatus", issues.length
      ? fill(t("dataClass.exposureCount", "{count} gaps found"), {count: issues.length})
      : t("dataClass.exposureNone", "No collection is more open than its classification."));
  }

  function computeIssues() {
    issues = rulesAccess ? DC().exposureReport(currentRows().map(row => ({...row, classificationLevel: DC().deriveLevel(row)})), rulesAccess) : [];
  }

  function renderAll() {
    computeIssues();
    renderSummary();
    renderRows();
    renderFields();
    renderSimRoles();
    renderSim();
    renderExposure();
  }

  async function refresh() {
    if (!isUnlocked()) {
      setStatus("dataClassStatus", t("dataClass.unlock", "Unlock with SOS2FA to manage data classification."));
      return;
    }
    setStatus("dataClassStatus", t("dataClass.loading", "Loading…"));
    try {
      await loadRows();
      try { await loadRules(); } catch (error) { console.warn("Data classification: rules not loaded", error?.message || error); }
      renderAll();
      setStatus("dataClassStatus", "");
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
    }
  }

  function readRow(collection) {
    const out = {collection};
    document.querySelectorAll(`#dataClassRows [data-dc-collection="${CSS.escape(collection)}"]`).forEach(input => {
      const field = input.dataset.dcField;
      if (field === DC().SYSTEM_FLAG) return;
      out[field] = field === "retentionDays" ? Number(input.value || 0) : (input.checked ? 1 : 0);
    });
    return out;
  }

  /** Higher tiers follow lower ones on screen too, so what is shown is what will be saved. */
  function onEdit(collection) {
    const row = rows.find(entry => entry.collection === collection);
    if (!row) return;
    const draft = {...row, ...DC().cumulative({...current(row), ...readRow(collection)})};
    draft.classificationLevel = DC().deriveLevel(draft);
    if (DC().diff(row, draft).length) drafts[collection] = draft;
    else delete drafts[collection];
    renderAll();
  }

  function payloadRow(row) {
    const out = {collection: row.collection, retentionDays: Number(row.retentionDays || 0)};
    DC().FLAGS.forEach(key => { out[key] = row[key] ? 1 : 0; });
    return out;
  }

  function requireReason() {
    if (reason().length >= 8) return true;
    setStatus("dataClassStatus", t("dataClass.reasonMissing", "Enter a reason of at least 8 characters first."));
    byId("dataClassReason")?.focus();
    return false;
  }

  async function save(collection) {
    if (!requireReason()) return;
    const row = rows.find(entry => entry.collection === collection);
    if (!row) return;
    setStatus("dataClassStatus", t("dataClass.loading", "Loading…"));
    try {
      await call("setDataClassification", {...payloadRow(current(row)), reason: reason()});
      await loadRows();
      renderAll();
      setStatus("dataClassStatus", `${collection}: ${t("dataClass.saved", "Saved.")}`);
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
    }
  }

  async function saveAll() {
    if (!requireReason()) return;
    const button = byId("dataClassSaveAllBtn");
    if (button) button.disabled = true;
    setStatus("dataClassStatus", t("dataClass.loading", "Loading…"));
    try {
      const result = await call("saveAllDataClassifications", {rows: currentRows().map(payloadRow), reason: reason()});
      await loadRows();
      renderAll();
      setStatus("dataClassStatus", fill(t("dataClass.saveAllDone", "Saved {created} new and {changed} changed rows. {unchanged} were already up to date."), {
        created: (result.created || []).length,
        changed: (result.changed || []).length,
        unchanged: Number(result.unchanged || 0)
      }));
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function exportCsv() {
    try {
      await call("logDataClassificationExport", {format: "csv", rows: rows.length});
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
      return;
    }
    const blob = new Blob([DC().toCsv(rows)], {type: "text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `floqr-data-classification-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function exposure() {
    setStatus("dataClassExposureStatus", t("dataClass.loading", "Loading…"));
    try {
      rulesAccess = null;
      await loadRules();
      renderAll();
    } catch (error) {
      setStatus("dataClassExposureStatus", errorText(error));
    }
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    byId(PANEL_ID)?.addEventListener("click", event => {
      const button = event.target.closest("button[data-dc-save]");
      if (button) save(button.dataset.dcSave);
    });
    byId("dataClassRows")?.addEventListener("change", event => {
      const collection = event.target?.dataset?.dcCollection;
      if (collection) onEdit(collection);
    });
    byId("dataClassSaveAllBtn")?.addEventListener("click", () => saveAll());
    byId("dataClassReloadBtn")?.addEventListener("click", () => refresh());
    byId("dataClassExportBtn")?.addEventListener("click", () => exportCsv());
    byId("dataClassExposureBtn")?.addEventListener("click", () => exposure());
    byId("dataClassFilter")?.addEventListener("input", () => renderRows());
    byId("dataClassOnlyReview")?.addEventListener("change", () => renderRows());
    ["dataClassSimRole", "dataClassSimSameClub", "dataClassSimOwn"].forEach(id => byId(id)?.addEventListener("change", () => renderSim()));
    document.addEventListener("floqr:sos2fa-unlocked", event => {
      if (event.detail?.scope === SCOPE && byId(PANEL_ID)?.classList.contains("active")) refresh();
    });
  }

  function mount() {
    if (!DC()) return;
    bindOnce();
    refresh();
  }

  root.FLOQRMasterDataClassification = {mount, refresh};
})(window);
