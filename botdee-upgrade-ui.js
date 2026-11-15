/* BOT DEE upgrade panels — consent, memories, mock SmartViews, explain, privacy assistant.
   No second public/private profile toggle. Profile edits stay on My Profile.
   Memory settings live in a Settings bubble popout (composer-below card), not an inline card. */
(function (global) {
  "use strict";

  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  let firstUseOpened = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function usageFlagFrom(value) {
    return value === 1 || value === "1" ? 1 : 0;
  }

  function applyFirstUseUi(flag, opts) {
    const firstUse = usageFlagFrom(flag) !== 1;
    const note = byId("botDeeSettingsFirstUse");
    const bubble = byId("botDeeSettingsBubble");
    if (note) note.hidden = !firstUse;
    bubble?.classList.toggle("is-first-use", firstUse);
    const autoOpen = !opts || opts.autoOpen !== false;
    if (autoOpen && firstUse && !firstUseOpened) {
      firstUseOpened = true;
      openMemoryPopout();
    }
  }

  function applyUsageFlag(value, opts) {
    const flag = usageFlagFrom(value);
    global.FLOQRBotDeeAccess?.applyUsageFlag?.(flag, opts);
    applyFirstUseUi(flag, opts);
    return flag;
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

  function isPopoutOpen() {
    const popout = byId("botDeeMemoryPopout");
    return !!(popout && !popout.hidden);
  }

  function closeMemoryPopout() {
    const popout = byId("botDeeMemoryPopout");
    const bubble = byId("botDeeSettingsBubble");
    if (!popout || popout.hidden) return;
    popout.hidden = true;
    if (bubble) {
      bubble.setAttribute("aria-expanded", "false");
      bubble.focus();
    }
  }

  function openMemoryPopout() {
    const popout = byId("botDeeMemoryPopout");
    const bubble = byId("botDeeSettingsBubble");
    const closeBtn = byId("botDeeMemoryClose");
    if (!popout) return;
    popout.hidden = false;
    if (bubble) bubble.setAttribute("aria-expanded", "true");
    loadConsent();
    (closeBtn || popout.querySelector("input, button"))?.focus?.();
    popout.scrollIntoView({block: "nearest", inline: "nearest"});
  }

  function toggleMemoryPopout() {
    if (isPopoutOpen()) closeMemoryPopout();
    else openMemoryPopout();
  }

  async function loadConsent() {
    try {
      const data = await call("getBotDeeConsent");
      if (data && Object.prototype.hasOwnProperty.call(data, "hasUsedBotDee")) {
        applyUsageFlag(data.hasUsedBotDee);
      } else {
        applyFirstUseUi(global.FLOQRBotDeeAccess?.hasUsedBotDee?.() === 1 ? 1 : 0);
      }
      const c = data.consent || {};
      const archive = byId("botDeeConsentArchive");
      const mem = byId("botDeeConsentMemory");
      const pers = byId("botDeeConsentPersonalize");
      if (archive) archive.checked = c.archive === 1;
      if (mem) mem.checked = c.memory === 1;
      if (pers) pers.checked = c.personalization === 1;
    } catch (_) {
      applyFirstUseUi(global.FLOQRBotDeeAccess?.hasUsedBotDee?.() === 1 ? 1 : 0);
    }
  }

  async function saveConsent() {
    setLine("botDeeUpgradeStatus", t("botdee.chatThinking", "BOT DEE is thinking…"));
    try {
      await call("setBotDeeConsent", {
        archive: byId("botDeeConsentArchive")?.checked ? 1 : 0,
        memory: byId("botDeeConsentMemory")?.checked ? 1 : 0,
        personalization: byId("botDeeConsentPersonalize")?.checked ? 1 : 0
      });
      const saved = t("botdee.memorySaved", "Saved. The 5-minute pause still ends the live chat; opted-in history stays.");
      setLine("botDeeUpgradeStatus", saved);
      setLine("botDeeChatStatus", saved);
      closeMemoryPopout();
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
      const done = t("botdee.memoryExported", "Export downloaded.");
      setLine("botDeeUpgradeStatus", done);
      setLine("botDeeChatStatus", done);
      closeMemoryPopout();
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  async function deleteArchive() {
    if (!window.confirm(t("botdee.memoryDelete", "Delete saved BOT DEE history?"))) return;
    try {
      await call("deleteBotDeeArchive", {confirm: "DELETE"});
      const done = t("botdee.memoryDeleted", "Saved BOT DEE history deleted.");
      setLine("botDeeUpgradeStatus", done);
      setLine("botDeeChatStatus", done);
      closeMemoryPopout();
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

  function bindPopout() {
    const bubble = byId("botDeeSettingsBubble");
    const popout = byId("botDeeMemoryPopout");
    const closeBtn = byId("botDeeMemoryClose");
    bubble?.addEventListener("click", event => {
      event.preventDefault();
      toggleMemoryPopout();
    });
    closeBtn?.addEventListener("click", event => {
      event.preventDefault();
      closeMemoryPopout();
    });
    popout?.addEventListener("click", event => {
      const link = event.target.closest?.("a[href]");
      if (!link || !popout.contains(link)) return;
      closeMemoryPopout();
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (!isPopoutOpen()) return;
      event.preventDefault();
      closeMemoryPopout();
    });
  }

  function bind() {
    bindPopout();
    byId("botDeeConsentSave")?.addEventListener("click", saveConsent);
    byId("botDeeExportBtn")?.addEventListener("click", exportData);
    byId("botDeeDeleteArchiveBtn")?.addEventListener("click", deleteArchive);
    byId("botDeeLoadSmartViews")?.addEventListener("click", loadDemos);
    global.FLOQRBotDeeAccess?.onChange?.(info => {
      applyFirstUseUi(info?.hasUsedBotDee === 1 ? 1 : 0, {autoOpen: info?.hasUsedBotDee !== 1});
    });
    applyFirstUseUi(global.FLOQRBotDeeAccess?.hasUsedBotDee?.() === 1 ? 1 : 0, {autoOpen: false});
    loadConsent();
  }

  global.FLOQRBotDeeUpgradeUi = {
    bind,
    loadConsent,
    loadDemos,
    openMemoryPopout,
    closeMemoryPopout,
    applyUsageFlag
  };
})(window);
