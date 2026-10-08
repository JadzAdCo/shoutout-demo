/* Master Admin — Security → Data classification (register grid, sensitive fields, simulator, exposure report).
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

  let bound = false;
  let rows = [];
  let rulesAccess = null;

  const byId = id => document.getElementById(id);
  const DC = () => root.FLOQRDataClassification;

  function t(key, fallback) {
    const value = root.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
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
    return snap.size;
  }

  function box(collection, field, value, disabled) {
    return `<input type="checkbox" data-dc-collection="${esc(collection)}" data-dc-field="${field}"${value ? " checked" : ""}${disabled ? " disabled" : ""} aria-label="${esc(field)}"/>`;
  }

  function rulesCell(collection) {
    const rule = rulesAccess?.[collection];
    return rule ? `${esc(rule.read)} / ${esc(rule.write)}` : "—";
  }

  function renderRows() {
    const tbody = byId("dataClassRows");
    if (!tbody) return;
    const filter = String(byId("dataClassFilter")?.value || "").trim().toLowerCase();
    const visible = rows.filter(row => !filter || row.collection.toLowerCase().includes(filter) || String(row.description).toLowerCase().includes(filter));
    tbody.innerHTML = visible.map(row => {
      const meta = row.saved
        ? `r${esc(row.revision)} · ${esc(row.updatedByEmail)} · ${esc(formatWhen(row.updatedAtMs))}`
        : esc(t("dataClass.notSaved", "Packaged default (not saved yet)"));
      return `<tr>
        <td><strong>${esc(row.collection)}</strong><br/><small>${esc(row.description)}</small><br/><small>${meta}</small></td>
        <td>${esc(levelLabel(row.classificationLevel))}</td>
        ${EDITABLE.map(field => `<td style="text-align:center">${box(row.collection, field, row[field])}</td>`).join("")}
        <td style="text-align:center">${box(row.collection, DC().SYSTEM_FLAG, 1, true)}</td>
        <td style="text-align:center">${box(row.collection, "ownRecordReadable", row.ownRecordReadable)}</td>
        <td style="text-align:center">${box(row.collection, "containsPII", row.containsPII)}</td>
        <td><input type="number" min="0" max="3650" step="1" style="width:6em" data-dc-collection="${esc(row.collection)}" data-dc-field="retentionDays" value="${esc(row.retentionDays || 0)}"/></td>
        <td><small>${rulesCell(row.collection)}</small></td>
        <td><button type="button" data-dc-save="${esc(row.collection)}">${esc(t("dataClass.save", "Save"))}</button></td>
      </tr>`;
    }).join("");
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
    tbody.innerHTML = DC().simulate(rows, viewer).map(row =>
      `<tr><td>${esc(row.collection)}</td><td>${esc(levelLabel(row.level))}</td><td><strong>${esc(label[row.access])}</strong></td></tr>`
    ).join("");
  }

  function renderAll() {
    renderRows();
    renderFields();
    renderSimRoles();
    renderSim();
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
    document.querySelectorAll(`[data-dc-collection="${CSS.escape(collection)}"]`).forEach(input => {
      const field = input.dataset.dcField;
      if (field === DC().SYSTEM_FLAG) return;
      out[field] = field === "retentionDays" ? Number(input.value || 0) : (input.checked ? 1 : 0);
    });
    return out;
  }

  async function save(collection) {
    const reason = String(byId("dataClassReason")?.value || "").trim();
    setStatus("dataClassStatus", t("dataClass.loading", "Loading…"));
    try {
      await call("setDataClassification", {...readRow(collection), reason});
      await loadRows();
      renderAll();
      setStatus("dataClassStatus", `${collection}: ${t("dataClass.saved", "Saved.")}`);
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
    }
  }

  async function seed() {
    setStatus("dataClassStatus", t("dataClass.loading", "Loading…"));
    try {
      const result = await call("seedDataClassification");
      await loadRows();
      renderAll();
      setStatus("dataClassStatus", `${t("dataClass.saved", "Saved.")} (${(result.created || []).length})`);
    } catch (error) {
      setStatus("dataClassStatus", errorText(error));
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
    const tbody = byId("dataClassExposureRows");
    setStatus("dataClassExposureStatus", t("dataClass.loading", "Loading…"));
    try {
      rulesAccess = null;
      const issues = DC().exposureReport(rows, await loadRules());
      const kind = {readBroader: t("dataClass.kindReadBroader", "More people can read it than allowed"), writeOpen: t("dataClass.kindWriteOpen", "Any signed-in account can write it")};
      const severity = {high: t("dataClass.severityHigh", "High"), medium: t("dataClass.severityMedium", "Medium")};
      if (tbody) {
        tbody.innerHTML = issues.map(row =>
          `<tr><td><strong>${esc(severity[row.severity])}</strong></td><td>${esc(row.collection)}</td><td>${esc(kind[row.kind])}</td><td><small>${esc(row.rule)} · ${esc(levelLabel(row.level))}</small></td></tr>`
        ).join("");
      }
      renderRows();
      setStatus("dataClassExposureStatus", issues.length ? `${issues.length}` : t("dataClass.exposureNone", "No collection is more open than its classification."));
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
    byId("dataClassReloadBtn")?.addEventListener("click", () => refresh());
    byId("dataClassSeedBtn")?.addEventListener("click", () => seed());
    byId("dataClassExportBtn")?.addEventListener("click", () => exportCsv());
    byId("dataClassExposureBtn")?.addEventListener("click", () => exposure());
    byId("dataClassFilter")?.addEventListener("input", () => renderRows());
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
