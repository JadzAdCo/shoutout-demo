/* Master Admin — Firestore translationOverrides for de/ar (runtime chrome fixes). */
(function (global) {
  "use strict";

  const COLLECTION = "translationOverrides";
  const LANGS = ["de", "ar"];
  let lang = "de";
  let keys = [];
  let enPack = {};
  let savedOverrides = {};
  let draft = {};
  let bound = false;
  let loading = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(message, isError) {
    const el = byId("translationOverridesStatus");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error", !!isError);
  }

  function db() {
    return global.firebase?.firestore?.();
  }

  function authUser() {
    return global.firebase?.auth?.()?.currentUser || null;
  }

  function refreshKeyCatalog() {
    const i18n = global.FLOQRI18n;
    keys = typeof i18n?.listKeys === "function" ? i18n.listKeys() : Object.keys(i18n?.getPack?.("en") || {}).sort();
    enPack = typeof i18n?.getPack === "function" ? i18n.getPack("en") : {};
  }

  function overrideValue(key) {
    if (Object.prototype.hasOwnProperty.call(draft, key)) return draft[key];
    return savedOverrides[key] || "";
  }

  function hasOverride(key) {
    return String(overrideValue(key)).trim().length > 0;
  }

  function filteredKeys() {
    const query = String(byId("translationOverridesSearch")?.value || "").trim().toLowerCase();
    const mode = String(byId("translationOverridesFilter")?.value || "all");
    return keys.filter((key) => {
      if (query) {
        const en = String(enPack[key] || "");
        if (!key.toLowerCase().includes(query) && !en.toLowerCase().includes(query)) return false;
      }
      if (mode === "overridden") return hasOverride(key);
      if (mode === "missing") return !hasOverride(key);
      return true;
    });
  }

  function syncLangButtons() {
    byId("translationOverridesLangDe")?.classList.toggle("primary", lang === "de");
    byId("translationOverridesLangAr")?.classList.toggle("primary", lang === "ar");
  }

  function renderRows() {
    const tbody = byId("translationOverridesRows");
    if (!tbody) return;
    const visible = filteredKeys();
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="4">No keys match this filter.</td></tr>`;
      return;
    }
    tbody.innerHTML = visible
      .map((key) => {
        const en = enPack[key] || "";
        const val = overrideValue(key);
        return `<tr data-key="${esc(key)}">
          <td><code>${esc(key)}</code></td>
          <td>${esc(en)}</td>
          <td><textarea rows="2" class="translation-override-input" data-key="${esc(key)}" dir="${lang === "ar" ? "rtl" : "ltr"}">${esc(val)}</textarea></td>
          <td><button type="button" class="ghost translation-override-clear" data-key="${esc(key)}">Clear</button></td>
        </tr>`;
      })
      .join("");
  }

  async function loadLanguageDoc() {
    if (loading) return;
    const user = authUser();
    if (!user) {
      setStatus("Sign in as Master Admin to load overrides.", true);
      return;
    }
    const firestore = db();
    if (!firestore) {
      setStatus("Firestore is not available.", true);
      return;
    }
    loading = true;
    setStatus(`Loading ${lang} overrides…`);
    try {
      refreshKeyCatalog();
      const snap = await firestore.collection(COLLECTION).doc(lang).get();
      savedOverrides = snap.exists ? {...(snap.data()?.strings || {})} : {};
      draft = {};
      syncLangButtons();
      renderRows();
      const count = Object.keys(savedOverrides).filter((k) => String(savedOverrides[k] || "").trim()).length;
      setStatus(`Loaded ${lang}: ${count} override(s), ${keys.length} chrome keys.`);
    } catch (err) {
      setStatus(err?.message || String(err), true);
    } finally {
      loading = false;
    }
  }

  function collectStringsForSave() {
    const strings = {};
    keys.forEach((key) => {
      const trimmed = String(overrideValue(key)).trim();
      if (trimmed) strings[key] = trimmed;
    });
    return strings;
  }

  async function saveLanguage() {
    const user = authUser();
    if (!user) {
      setStatus("Sign in as Master Admin to save.", true);
      return;
    }
    const firestore = db();
    if (!firestore) {
      setStatus("Firestore is not available.", true);
      return;
    }
    const strings = collectStringsForSave();
    setStatus(`Saving ${lang}…`);
    try {
      await firestore.collection(COLLECTION).doc(lang).set({
        lang,
        strings,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedByUid: user.uid,
      });
      savedOverrides = {...strings};
      draft = {};
      renderRows();
      if (global.FLOQRI18n?.loadOverrides) {
        await global.FLOQRI18n.loadOverrides();
        global.FLOQRI18n.applyDom?.();
      }
      setStatus(`Saved ${lang}: ${Object.keys(strings).length} override(s).`);
    } catch (err) {
      setStatus(err?.message || String(err), true);
    }
  }

  function onTableInput(event) {
    const target = event.target;
    if (!target?.classList?.contains("translation-override-input")) return;
    const key = target.getAttribute("data-key");
    if (!key) return;
    draft[key] = target.value;
  }

  function onTableClick(event) {
    const btn = event.target?.closest?.(".translation-override-clear");
    if (!btn) return;
    const key = btn.getAttribute("data-key");
    if (!key) return;
    draft[key] = "";
    const row = btn.closest("tr");
    const input = row?.querySelector(".translation-override-input");
    if (input) input.value = "";
    setStatus(`Cleared override for ${key}. Save language to persist.`);
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    byId("translationOverridesLangDe")?.addEventListener("click", () => {
      if (lang === "de") return;
      lang = "de";
      loadLanguageDoc();
    });
    byId("translationOverridesLangAr")?.addEventListener("click", () => {
      if (lang === "ar") return;
      lang = "ar";
      loadLanguageDoc();
    });
    byId("translationOverridesReloadBtn")?.addEventListener("click", () => loadLanguageDoc());
    byId("translationOverridesSaveBtn")?.addEventListener("click", () => saveLanguage());
    byId("translationOverridesSearch")?.addEventListener("input", () => renderRows());
    byId("translationOverridesFilter")?.addEventListener("change", () => renderRows());
    byId("translationOverridesRows")?.addEventListener("input", onTableInput);
    byId("translationOverridesTableWrap")?.addEventListener("click", onTableClick);
  }

  function mount() {
    if (!LANGS.includes(lang)) lang = "de";
    bindOnce();
    loadLanguageDoc();
  }

  global.FLOQRMasterTranslationOverrides = { mount, reload: loadLanguageDoc };
})(typeof window !== "undefined" ? window : globalThis);
