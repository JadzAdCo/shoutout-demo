/* BOT DEE upgrade panels — consent, memories, mock SmartViews (Master Admin SMARTviews tab).
   Saved chats, memories, and "what BOT DEE knows of me" live on My Profile → Feature & Orders → My BOT DEE.
   Chat page has no Settings bubble / memory popout. First-use does not open an overlay. */
(function (global) {
  "use strict";

  const t = (key, fallback) => {
    const value = global.FLOQRI18n?.t?.(key);
    return value && value !== key ? value : fallback;
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function usageFlagFrom(value) {
    return value === 1 || value === "1" ? 1 : 0;
  }

  function applyUsageFlag(value) {
    const flag = usageFlagFrom(value);
    global.FLOQRBotDeeAccess?.applyUsageFlag?.(flag, {autoOpen: false});
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

  function stampChatLink() {
    const link = byId("portalBotDeeChatLink");
    if (!link) return;
    const nav = global.FLOQRNav;
    const href = nav?.intentSearchHome?.() || nav?.stampCurrentVersion?.("./botdee.html") || "./botdee.html";
    link.href = href;
  }

  async function loadConsent() {
    if (!byId("botDeeConsentArchive") && !byId("botDeeKnowsList")) return;
    try {
      const data = await call("getBotDeeConsent");
      if (data && Object.prototype.hasOwnProperty.call(data, "hasUsedBotDee")) {
        applyUsageFlag(data.hasUsedBotDee);
      }
      const c = data.consent || {};
      const archive = byId("botDeeConsentArchive");
      const mem = byId("botDeeConsentMemory");
      const pers = byId("botDeeConsentPersonalize");
      if (archive) archive.checked = c.archive === 1;
      if (mem) mem.checked = c.memory === 1;
      if (pers) pers.checked = c.personalization === 1;
      await loadKnows(c);
    } catch (_) {
      await loadKnows(null);
    }
  }

  async function saveConsent() {
    setLine("botDeeUpgradeStatus", t("botdee.chatThinking", "BOT DEE is thinking…"));
    try {
      const next = {
        archive: byId("botDeeConsentArchive")?.checked ? 1 : 0,
        memory: byId("botDeeConsentMemory")?.checked ? 1 : 0,
        personalization: byId("botDeeConsentPersonalize")?.checked ? 1 : 0
      };
      await call("setBotDeeConsent", next);
      setLine("botDeeUpgradeStatus", t("botdee.memorySaved", "Saved. The 5-minute pause still ends the live chat; opted-in history stays."));
      await loadKnows(next);
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
      setLine("botDeeUpgradeStatus", t("botdee.memoryExported", "Export downloaded."));
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  async function deleteArchive() {
    if (!window.confirm(t("botdee.memoryDelete", "Delete saved history"))) return;
    try {
      await call("deleteBotDeeArchive", {confirm: "DELETE"});
      setLine("botDeeUpgradeStatus", t("botdee.memoryDeleted", "Saved BOT DEE history deleted."));
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderKnows(items, consent) {
    const host = byId("botDeeKnowsList");
    if (!host) return;
    const memoryOn = consent && Number(consent.memory) === 1;
    if (!memoryOn) {
      host.innerHTML = `<p class="sub">${escapeHtml(t("botdee.knowsOff", "Turn on memory above so BOT DEE can keep facts you approve."))}</p>`;
      return;
    }
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      host.innerHTML = `<p class="sub">${escapeHtml(t("botdee.knowsEmpty", "BOT DEE has not stored any facts about you yet."))}</p>`;
      return;
    }
    host.innerHTML = rows.map(row => {
      const id = String(row.memoryId || "").trim();
      const value = String(row.value || "").trim();
      const purpose = String(row.purpose || "").trim();
      const meta = purpose ? `<span class="sub small">${escapeHtml(purpose)}</span>` : "";
      return `<div class="report-row portal-botdee-fact" data-memory-id="${escapeHtml(id)}">` +
        `<strong>${escapeHtml(value)}</strong> ${meta}` +
        `<button type="button" class="buttonlike" data-botdee-forget="${escapeHtml(id)}">${escapeHtml(t("botdee.knowsDelete", "Remove this fact"))}</button>` +
        `</div>`;
    }).join("");
    host.querySelectorAll("[data-botdee-forget]").forEach(btn => {
      btn.addEventListener("click", () => deleteKnowsFact(btn.getAttribute("data-botdee-forget")));
    });
  }

  async function loadKnows(consentHint) {
    const host = byId("botDeeKnowsList");
    if (!host) return;
    const consent = consentHint && typeof consentHint === "object"
      ? consentHint
      : {
        memory: byId("botDeeConsentMemory")?.checked ? 1 : 0
      };
    if (Number(consent.memory) !== 1) {
      renderKnows([], consent);
      return;
    }
    try {
      const data = await call("listBotDeeMemories");
      renderKnows(data.memories || [], {memory: 1});
    } catch (_) {
      renderKnows([], {memory: 1});
    }
  }

  async function deleteKnowsFact(memoryId) {
    const id = String(memoryId || "").trim();
    if (!id) return;
    try {
      await call("deleteBotDeeMemory", {memoryId: id});
      setLine("botDeeUpgradeStatus", t("botdee.knowsDeleted", "Fact removed."));
      await loadKnows({memory: 1});
    } catch (error) {
      setLine("botDeeUpgradeStatus", t("botdee.chatError", "BOT DEE could not answer. Try again in a moment."));
    }
  }

  async function loadMockViews() {
    const nav = global.FLOQRNav;
    const mockUrl = nav?.stampCurrentVersion
      ? nav.stampCurrentVersion("./botdee-smartview-mock.json")
      : "./botdee-smartview-mock.json";
    const res = await fetch(mockUrl, {credentials: "same-origin"});
    if (!res.ok) throw new Error("mock_fetch_failed");
    const payload = await res.json();
    return Array.isArray(payload.views) ? payload.views : [];
  }

  async function loadDemos(hostId) {
    const host = byId(hostId || "botDeeMasterSmartViewDemo");
    if (!host || !global.FLOQRBotDeeSmartView) return;
    const busy = t("botdee.chatThinking", "BOT DEE is thinking…");
    host.setAttribute("aria-busy", "true");
  /* Only replace card HTML; avoid clobbering if mount runs twice in quick succession. */
    const prior = host.innerHTML;
    if (!prior.trim()) host.textContent = busy;
    try {
      const data = await call("listBotDeeSmartViews");
      global.FLOQRBotDeeSmartView.mount(host, data.views || []);
    } catch (_) {
      try {
        const views = await loadMockViews();
        if (views.length) global.FLOQRBotDeeSmartView.mount(host, views);
        else host.textContent = t("botdee.libraryEmpty", "No saved SmartViews yet.");
      } catch (__) {
        host.textContent = t("botdee.libraryEmpty", "No saved SmartViews yet.");
      }
    } finally {
      host.removeAttribute("aria-busy");
    }
  }

  function isUnauthError(error) {
    const code = String(error?.code || "").replace(/^functions\//, "");
    return code === "unauthenticated";
  }

  function smartViewLoadCopy(error) {
    if (isUnauthError(error)) {
      return t("botdee.sv.saveOffline", "Sign in to save. Translations are queued on the server, not in this browser.");
    }
    return t("botdee.sv.loadError", "Your SMARTview could not load. Try again in a moment.");
  }

  async function loadMySmartView(opts = {}) {
    const host = byId("botDeeSmartViewDemo");
    if (!host || !global.FLOQRBotDeeSmartView) return;
    const hadCard = !!host.querySelector(".botdee-sv-people, .botdee-sv-card");
    host.setAttribute("aria-busy", "true");
    if (!host.innerHTML.trim()) host.textContent = t("botdee.chatThinking", "BOT DEE is thinking…");
    try {
      const data = await call("getPeopleSmartView", {});
      const views = Array.isArray(data.views) ? data.views : [];
      if (!views.length) {
        host.textContent = t("botdee.sv.mineEmpty", "Your SMARTview will appear here from your public FLOQR profile.");
        return;
      }
      global.FLOQRBotDeeSmartView.mount(host, views);
      if (opts.openSummary) host.querySelector("[data-sv-open='summary']")?.click();
    } catch (error) {
      if (!hadCard) host.textContent = smartViewLoadCopy(error);
      throw error;
    } finally {
      host.removeAttribute("aria-busy");
    }
  }

  let bound = false;

  function bind() {
    stampChatLink();
    if (bound) {
      if (byId("botDeeSmartViewDemo")) loadMySmartView().catch(() => {});
      if (byId("botDeeConsentArchive") || byId("botDeeKnowsList")) loadConsent();
      return;
    }
    bound = true;
    byId("botDeeConsentSave")?.addEventListener("click", saveConsent);
    byId("botDeeExportBtn")?.addEventListener("click", exportData);
    byId("botDeeDeleteArchiveBtn")?.addEventListener("click", deleteArchive);
    byId("botDeeLoadSmartViews")?.addEventListener("click", () => loadMySmartView().catch(() => {}));
    byId("botDeeMasterLoadSmartViews")?.addEventListener("click", () => loadDemos("botDeeMasterSmartViewDemo"));
    byId("botDeeEditSmartSummary")?.addEventListener("click", async () => {
      setLine("botDeeUpgradeStatus", t("botdee.chatThinking", "BOT DEE is thinking…"));
      try {
        await loadMySmartView({openSummary: true});
        setLine("botDeeUpgradeStatus", "");
      } catch (error) {
        setLine("botDeeUpgradeStatus", smartViewLoadCopy(error));
      }
    });
    if (byId("botDeeSmartViewDemo")) loadMySmartView().catch(() => {});
    if (byId("botDeeConsentArchive") || byId("botDeeKnowsList")) loadConsent();
  }

  global.FLOQRBotDeeUpgradeUi = {
    bind,
    loadConsent,
    loadKnows,
    loadDemos,
    loadMySmartView,
    smartViewLoadCopy,
    applyUsageFlag
  };
})(window);