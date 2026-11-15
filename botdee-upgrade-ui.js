/* BOT DEE upgrade panels — consent, memories, mock SmartViews, explain, privacy assistant.
   No second public/private profile toggle. Profile edits stay on My Profile. */
(function (global) {
  "use strict";

  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function callable(name) {
    try {
      if (!global.firebase?.apps?.length) return null;
      return global.firebase.app().functions("us-central1").httpsCallable(name);
    } catch (_) {
      return null;
    }
  }

  function setLine(id, text) {
    const el = byId(id);
    if (el) el.textContent = text || "";
  }

  async function call(name, payload) {
    const fn = callable(name);
    if (!fn) throw new Error("offline");
    return (await fn(payload || {}))?.data || {};
  }

  async function loadConsent() {
    try {
      const data = await call("getBotDeeConsent");
      const c = data.consent || {};
      const archive = byId("botDeeConsentArchive");
      const mem = byId("botDeeConsentMemory");
      const pers = byId("botDeeConsentPersonalize");
      if (archive) archive.checked = c.archive === 1;
      if (mem) mem.checked = c.memory === 1;
      if (pers) pers.checked = c.personalization === 1;
    } catch (_) {}
  }

  async function saveConsent() {
    setLine("botDeeUpgradeStatus", t("botdee.chatThinking", "BOT DEE is thinking…"));
    try {
      await call("setBotDeeConsent", {
        archive: byId("botDeeConsentArchive")?.checked ? 1 : 0,
        memory: byId("botDeeConsentMemory")?.checked ? 1 : 0,
        personalization: byId("botDeeConsentPersonalize")?.checked ? 1 : 0
      });
      setLine("botDeeUpgradeStatus", t("botdee.memorySaved", "Saved. The 5-minute pause still ends the live chat; opted-in history stays."));
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
      console.warn("BOT DEE consent save failed", error);
    }
  }

  async function exportData() {
    setLine("botDeeUpgradeStatus", t("botdee.chatThinking", "BOT DEE is thinking…"));
    try {
      const data = await call("exportBotDeeData");
      const blob = new Blob([JSON.stringify(data.export || {}, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bot-dee-export.json";
      a.click();
      URL.revokeObjectURL(url);
      setLine("botDeeUpgradeStatus", t("botdee.memorySaved", "Export downloaded."));
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  async function deleteArchive() {
    if (!window.confirm(t("botdee.memoryDelete", "Delete saved BOT DEE history?"))) return;
    try {
      await call("deleteBotDeeArchive", {confirm: "DELETE"});
      setLine("botDeeUpgradeStatus", t("botdee.memoryDeleted", "Saved BOT DEE history deleted."));
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  async function loadDemos() {
    const host = byId("botDeeSmartViewDemo");
    if (!host || !global.FLOQRBotDeeSmartView) return;
    try {
      const data = await call("listBotDeeSmartViews");
      global.FLOQRBotDeeSmartView.mount(host, data.views || []);
    } catch (_) {
      host.textContent = t("botdee.libraryEmpty", "No saved SmartViews yet.");
    }
  }

  function bind() {
    byId("botDeeConsentSave")?.addEventListener("click", saveConsent);
    byId("botDeeExportBtn")?.addEventListener("click", exportData);
    byId("botDeeDeleteArchiveBtn")?.addEventListener("click", deleteArchive);
    byId("botDeeLoadSmartViews")?.addEventListener("click", loadDemos);
    loadConsent();
  }

  global.FLOQRBotDeeUpgradeUi = {bind, loadConsent, loadDemos};
})(window);
