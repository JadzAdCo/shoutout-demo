/* Master Admin — merge duplicate patron Auth/Firestore accounts. SOS2FA + reason. Never deletes Auth. */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const REASON_MIN = 8;
  const byId = id => document.getElementById(id);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[ch]));

  function t(key, fallback) {
    return root.FLOQRI18n?.t?.(key) || fallback;
  }

  function setStatus(message) {
    const el = byId("patronAccountMergeStatus");
    if (el) el.textContent = message || "";
  }

  function isUnlocked() {
    return !!root.FLOQRSOS2FA?.isUnlocked?.(SCOPE);
  }

  async function call(name, data = {}) {
    const sessionId = root.FLOQRSOS2FA?.getSessionId?.(SCOPE) || "";
    const result = await root.firebase.app().functions("us-central1").httpsCallable(name)({
      ...data,
      sos2faSessionId: sessionId
    });
    return result?.data || {};
  }

  function errorText(error) {
    return String(error?.message || error || "Request failed.").replace(/^.*?:\s(?=[A-Z])/, "");
  }

  function cardHtml(label, row) {
    if (!row) return `<p class="sub small">${esc(label)}: none</p>`;
    return `<div class="report-block">
      <p><strong>${esc(label)}</strong></p>
      <p>uid: <code>${esc(row.uid)}</code></p>
      <p>email: ${esc(row.email || row.authEmail || "—")}</p>
      <p>handle: ${esc(row.floqrHandle || "—")}</p>
      <p>phone: ${esc(row.phoneE164 || "—")}</p>
      <p>profile completed: ${row.profileCompleted ? "yes" : "no"} · Mingl grant: ${row.minglGrant ? "1" : "0"} · Mingl friends: ${Number(row.minglCount || 0)} · Inbox: ${Number(row.inboxCount || 0)}</p>
      <p>status: ${esc(row.accountStatus || "active")}</p>
    </div>`;
  }

  async function lookupSide(inputId, resultId) {
    if (!isUnlocked()) {
      setStatus("Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const query = byId(inputId)?.value.trim() || "";
    if (query.length < 2) {
      setStatus("Type an email, handle, uid, or mobile.");
      return;
    }
    setStatus("Looking up patron accounts…");
    try {
      const data = await call("lookupPatronAccounts", {query});
      const people = data.people || [];
      const first = people[0];
      if (first && byId(inputId.replace("Query", "Uid"))) {
        byId(inputId.replace("Query", "Uid")).value = first.uid;
      }
      byId(resultId).innerHTML = people.length
        ? people.map(row => cardHtml(row.uid, row)).join("")
        : `<p class="sub small">No patrons matched.</p>`;
      setStatus(people.length ? `Found ${people.length} account(s). Auth is not deleted by lookup.` : "No patrons matched.");
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function previewMerge() {
    if (!isUnlocked()) {
      setStatus("Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const survivorUid = byId("patronMergeSurvivorUid")?.value.trim() || "";
    const duplicateUid = byId("patronMergeDuplicateUid")?.value.trim() || "";
    setStatus("Previewing merge…");
    try {
      const data = await call("previewPatronAccountMerge", {
        survivorUid,
        duplicateUid,
        survivorQuery: byId("patronMergeSurvivorQuery")?.value.trim() || "",
        duplicateQuery: byId("patronMergeDuplicateQuery")?.value.trim() || ""
      });
      if (data.survivor?.uid) byId("patronMergeSurvivorUid").value = data.survivor.uid;
      if (data.duplicate?.uid) byId("patronMergeDuplicateUid").value = data.duplicate.uid;
      byId("patronAccountMergePreview").innerHTML = [
        `<p class="sub small">Recommended survivor: <code>${esc(data.recommendedSurvivorUid)}</code>. Auth deleted: ${data.authDeleted ? "yes" : "no"}.</p>`,
        cardHtml(t("master.accountMerge.survivor", "Keep this uid"), data.survivor),
        cardHtml(t("master.accountMerge.duplicate", "Merge this uid away"), data.duplicate),
        `<p class="sub small">Would move: profile ${esc((data.wouldMove?.profileFields || []).join(", ") || "—")}; Mingl ${Number(data.wouldMove?.minglConnections || 0)}; Inbox ${Number(data.wouldMove?.inbox || 0)}.</p>`
      ].join("");
      setStatus("Preview only. Nothing was merged. Auth users stay.");
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  async function mergeAccounts() {
    if (!isUnlocked()) {
      setStatus("Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const survivorUid = byId("patronMergeSurvivorUid")?.value.trim() || "";
    const duplicateUid = byId("patronMergeDuplicateUid")?.value.trim() || "";
    if (!survivorUid || !duplicateUid) {
      setStatus("Set both uids from Preview first.");
      return;
    }
    const promptApi = root.FLOQRReasonPrompt;
    if (!promptApi?.ask) {
      setStatus("The reason window did not load. Reload the page and try again.");
      return;
    }
    const reason = await promptApi.ask({
      summary: `Merge patron ${duplicateUid} into ${survivorUid}. Auth is not deleted.`,
      minLength: REASON_MIN
    });
    if (!reason) {
      setStatus("Cancelled — nothing was merged.");
      return;
    }
    const saveBtn = byId("patronMergeRunBtn");
    const busy = root.FLOQRSaveBusy?.begin?.(saveBtn, {received: true});
    setStatus("Merging Firestore records. Auth is not deleted.");
    try {
      const data = await call("mergePatronAccounts", {survivorUid, duplicateUid, reason});
      setStatus(`Merged ${data.duplicateUid} into ${data.survivorUid}. Auth deleted: ${data.authDeleted ? "yes" : "no"}. Mingl ${Number(data.moved?.mingl || 0)}, inbox ${Number(data.moved?.inbox || 0)}.`);
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      busy?.idle?.();
    }
  }

  function bind() {
    if (!byId("patronAccountMerge")) return;
    byId("patronMergeLookupSurvivorBtn")?.addEventListener("click", () => lookupSide("patronMergeSurvivorQuery", "patronMergeSurvivorResults"));
    byId("patronMergeLookupDuplicateBtn")?.addEventListener("click", () => lookupSide("patronMergeDuplicateQuery", "patronMergeDuplicateResults"));
    byId("patronMergePreviewBtn")?.addEventListener("click", previewMerge);
    byId("patronMergeRunBtn")?.addEventListener("click", mergeAccounts);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  root.FLOQRPatronAccountMerge = {bind, previewMerge, mergeAccounts};
})(typeof window !== "undefined" ? window : this);
