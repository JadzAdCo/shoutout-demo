/* FLOQR Master Admin — UI translation overrides (Phase 2). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  if (!byId("panelUiTranslations") || !window.firebase) return;
  const auth = firebase.auth();
  const db = firebase.firestore();

  function status(msg) {
    if (byId("uiTranslationStatus")) byId("uiTranslationStatus").textContent = msg || "";
  }

  function fillLangSelect() {
    const sel = byId("uiTranslationLang");
    if (!sel || !window.FLOQRI18n) return;
    sel.innerHTML = window.FLOQRI18n.SUPPORTED.filter(x => x.code !== "en")
      .map(x => `<option value="${x.code}">${x.native} (${x.label})</option>`).join("");
  }

  function keyList() {
    const en = window.FLOQRI18n?.STRINGS?.en || {};
    return Object.keys(en).sort();
  }

  async function loadLang() {
    const lang = byId("uiTranslationLang")?.value || "de";
    const keys = keyList();
    const snap = await db.collection("translationOverrides").doc(lang).get();
    const strings = snap.exists ? (snap.data()?.strings || {}) : {};
    const base = window.FLOQRI18n?.STRINGS?.[lang] || {};
    const wrap = byId("uiTranslationEditor");
    if (!wrap) return;
    wrap.innerHTML = keys.map(key => {
      const value = strings[key] != null ? strings[key] : (base[key] || "");
      return `<label class="profile-grid-wide"><code>${key}</code><textarea data-i18n-key="${key}" rows="2">${value.replace(/</g, "&lt;")}</textarea></label>`;
    }).join("");
    status(`Editing ${lang}. English source is locked as fallback.`);
  }

  async function saveLang() {
    const lang = byId("uiTranslationLang")?.value || "de";
    const strings = {};
    document.querySelectorAll("[data-i18n-key]").forEach(el => {
      const key = el.getAttribute("data-i18n-key");
      const value = String(el.value || "").trim();
      if (key && value) strings[key] = value.slice(0, 500);
    });
    await db.collection("translationOverrides").doc(lang).set({
      lang,
      strings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedByUid: auth.currentUser?.uid || "",
      updatedByEmail: auth.currentUser?.email || ""
    }, {merge: true});
    await window.FLOQRI18n?.loadOverrides?.();
    status(`Saved overrides for ${lang} (${Object.keys(strings).length} keys).`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillLangSelect();
    byId("uiTranslationLang")?.addEventListener("change", () => loadLang().catch(err => status(err.message)));
    byId("loadUiTranslationBtn")?.addEventListener("click", () => loadLang().catch(err => status(err.message)));
    byId("saveUiTranslationBtn")?.addEventListener("click", () => saveLang().catch(err => status(err.message)));
    auth.onAuthStateChanged(user => {
      if (user) loadLang().catch(() => {});
    });
  });
})();
