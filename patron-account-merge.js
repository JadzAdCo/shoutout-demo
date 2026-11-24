/* Master Admin — merge duplicate patron Auth/Firestore accounts. SOS2FA + reason. Never deletes Auth.
   Binds every [data-patron-account-merge] card (Demo Worker Mgmt + Duplicate Records). */
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

  function field(root, name) {
    return root.querySelector(`[data-merge-field="${name}"]`);
  }

  function setStatus(root, message) {
    const el = root.querySelector("[data-merge-status]");
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

  async function lookupSide(root, queryName, uidName, resultName) {
    if (!isUnlocked()) {
      setStatus(root, "Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const query = field(root, queryName)?.value.trim() || "";
    if (query.length < 2) {
      setStatus(root, "Type an email, handle, uid, or mobile.");
      return;
    }
    setStatus(root, "Looking up patron accounts…");
    try {
      const data = await call("lookupPatronAccounts", {query});
      const people = data.people || [];
      const first = people[0];
      const uidInput = field(root, uidName);
      if (first && uidInput) uidInput.value = first.uid;
      const results = field(root, resultName);
      if (results) {
        results.innerHTML = people.length
          ? people.map(row => cardHtml(row.uid, row)).join("")
          : `<p class="sub small">No patrons matched.</p>`;
      }
      setStatus(root, people.length ? `Found ${people.length} account(s). Auth is not deleted by lookup.` : "No patrons matched.");
    } catch (error) {
      setStatus(root, errorText(error));
    }
  }

  async function previewMerge(root) {
    if (!isUnlocked()) {
      setStatus(root, "Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const survivorUid = field(root, "survivorUid")?.value.trim() || "";
    const duplicateUid = field(root, "duplicateUid")?.value.trim() || "";
    setStatus(root, "Previewing merge…");
    try {
      const data = await call("previewPatronAccountMerge", {
        survivorUid,
        duplicateUid,
        survivorQuery: field(root, "survivorQuery")?.value.trim() || "",
        duplicateQuery: field(root, "duplicateQuery")?.value.trim() || ""
      });
      if (data.survivor?.uid && field(root, "survivorUid")) field(root, "survivorUid").value = data.survivor.uid;
      if (data.duplicate?.uid && field(root, "duplicateUid")) field(root, "duplicateUid").value = data.duplicate.uid;
      const preview = field(root, "preview");
      if (preview) {
        preview.innerHTML = [
          `<p class="sub small">Recommended survivor: <code>${esc(data.recommendedSurvivorUid)}</code>. Auth deleted: ${data.authDeleted ? "yes" : "no"}.</p>`,
          cardHtml(t("master.accountMerge.survivor", "Keep this uid"), data.survivor),
          cardHtml(t("master.accountMerge.duplicate", "Merge this uid away"), data.duplicate),
          `<p class="sub small">Would move: profile ${esc((data.wouldMove?.profileFields || []).join(", ") || "—")}; Mingl ${Number(data.wouldMove?.minglConnections || 0)}; Inbox ${Number(data.wouldMove?.inbox || 0)}.</p>`
        ].join("");
      }
      setStatus(root, "Preview only. Nothing was merged. Auth users stay.");
    } catch (error) {
      setStatus(root, errorText(error));
    }
  }

  async function mergeAccounts(root) {
    if (!isUnlocked()) {
      setStatus(root, "Unlock Entity Management (SOS2FA) first.");
      return;
    }
    const survivorUid = field(root, "survivorUid")?.value.trim() || "";
    const duplicateUid = field(root, "duplicateUid")?.value.trim() || "";
    if (!survivorUid || !duplicateUid) {
      setStatus(root, "Set both uids from Preview first.");
      return;
    }
    const promptApi = root.FLOQRReasonPrompt;
    if (!promptApi?.ask) {
      setStatus(root, "The reason window did not load. Reload the page and try again.");
      return;
    }
    const reason = await promptApi.ask({
      summary: `Merge patron ${duplicateUid} into ${survivorUid}. Auth is not deleted.`,
      minLength: REASON_MIN
    });
    if (!reason) {
      setStatus(root, "Cancelled — nothing was merged.");
      return;
    }
    const saveBtn = root.querySelector("[data-merge-action=\"merge\"]");
    const busy = root.FLOQRSaveBusy?.begin?.(saveBtn, {received: true});
    setStatus(root, "Merging Firestore records. Auth is not deleted.");
    try {
      const data = await call("mergePatronAccounts", {survivorUid, duplicateUid, reason});
      setStatus(root, `Merged ${data.duplicateUid} into ${data.survivorUid}. Auth deleted: ${data.authDeleted ? "yes" : "no"}. Mingl ${Number(data.moved?.mingl || 0)}, inbox ${Number(data.moved?.inbox || 0)}.`);
    } catch (error) {
      setStatus(root, errorText(error));
    } finally {
      busy?.idle?.();
    }
  }

  function bindRoot(root) {
    if (!root || root.dataset.mergeBound === "1") return;
    root.dataset.mergeBound = "1";
    root.querySelector("[data-merge-action=\"lookup-survivor\"]")?.addEventListener("click", () => {
      lookupSide(root, "survivorQuery", "survivorUid", "survivorResults");
    });
    root.querySelector("[data-merge-action=\"lookup-duplicate\"]")?.addEventListener("click", () => {
      lookupSide(root, "duplicateQuery", "duplicateUid", "duplicateResults");
    });
    root.querySelector("[data-merge-action=\"preview\"]")?.addEventListener("click", () => previewMerge(root));
    root.querySelector("[data-merge-action=\"merge\"]")?.addEventListener("click", () => mergeAccounts(root));
  }

  function bind() {
    document.querySelectorAll("[data-patron-account-merge]").forEach(bindRoot);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  root.FLOQRPatronAccountMerge = {bind, bindRoot, previewMerge, mergeAccounts};
})(typeof window !== "undefined" ? window : this);
