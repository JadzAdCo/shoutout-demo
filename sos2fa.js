/* SOS2FA — Super Admin SMS gate for Entity Management (server-side Twilio OTP). */
(function (root) {
  "use strict";

  const STORAGE_PREFIX = "floqr_sos2fa_";
  const DEFAULT_TTL_MS = 60 * 60 * 1000;
  const WRONG_CODE_MESSAGE = "Wrong code entered, please enter the correct code to proceed";
  const SUPER_ADMIN_EMAILS = (root.SHOUTOUT_SUPER_ADMIN_EMAILS || ["bands.don@gmail.com", "bans.don@gmail.com"]).map(x => String(x).toLowerCase());
  const ENTITY_MGMT_PANELS = [
    "clubAdminUrls",
    "entityManagement",
    "allQueues",
    "clubOnboarding",
    "templateManagement",
    "recommendationModeration"
  ];

  let uiBound = false;
  let functions = null;
  let challengeRequested = false;
  const unlockCallbacks = new Map();

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSuperAdminUser(user, profile) {
    const email = normalizeEmail(user?.email || profile?.email);
    if (SUPER_ADMIN_EMAILS.includes(email)) return true;
    if (profile?.superAdmin === true) return true;
    if (user?.superAdmin === true) return true;
    try {
      if (root.FLOQRFeatureGates?.isSuperAdmin?.(email, profile || user)) return true;
    } catch (_) {}
    return false;
  }

  function isEntityMgmtPanel(panelId) {
    return ENTITY_MGMT_PANELS.includes(String(panelId || ""));
  }

  function storageKey(scope) {
    return `${STORAGE_PREFIX}${String(scope || "default")}`;
  }

  function readSession(scope) {
    try {
      const raw = sessionStorage.getItem(storageKey(scope));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionId || !parsed?.exp) return null;
      if (Date.now() > Number(parsed.exp)) {
        sessionStorage.removeItem(storageKey(scope));
        return null;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function isUnlocked(scope) {
    return !!readSession(scope)?.sessionId;
  }

  function getSessionId(scope) {
    return readSession(scope)?.sessionId || "";
  }

  function unlock(scope, payload = {}) {
    const ttlMs = Number(payload.expiresInSeconds) > 0 ? Number(payload.expiresInSeconds) * 1000 : DEFAULT_TTL_MS;
    const exp = Date.now() + ttlMs;
    sessionStorage.setItem(storageKey(scope), JSON.stringify({
      ok: true,
      sessionId: String(payload.sessionId || ""),
      exp,
      at: Date.now()
    }));
  }

  function lock(scope) {
    sessionStorage.removeItem(storageKey(scope));
    challengeRequested = false;
  }

  function callable(name) {
    if (!functions) functions = firebase.app().functions("us-central1");
    return functions.httpsCallable(name);
  }

  function setStatus(message) {
    const el = byId("sos2faStatus");
    if (el) el.textContent = message || "";
  }

  function ensureGatedWrappers() {
    ENTITY_MGMT_PANELS.forEach(id => {
      if (id === "entityManagement") return;
      const section = byId(id);
      if (!section || section.dataset.entityMgmtWrapped === "1") return;
      section.dataset.entityMgmtWrapped = "1";
      section.dataset.entityMgmtGated = "1";
      const wrap = document.createElement("div");
      wrap.className = "entity-mgmt-content";
      while (section.firstChild) wrap.appendChild(section.firstChild);
      section.appendChild(wrap);
    });
    const entitySection = byId("entityManagement");
    if (entitySection) entitySection.dataset.entityMgmtGated = "1";
  }

  function parkGate() {
    const gate = byId("sos2faGate");
    const parking = byId("entityMgmtSos2faParking");
    if (gate && parking && gate.parentElement !== parking) parking.appendChild(gate);
  }

  function activeEntityPanel() {
    const active = document.querySelector(".admin-panel-section.active");
    return active && isEntityMgmtPanel(active.id) ? active : null;
  }

  function syncGateUi(scope, unlocked) {
    ensureGatedWrappers();
    const gate = byId("sos2faGate");
    const active = activeEntityPanel();

    ENTITY_MGMT_PANELS.forEach(id => {
      const section = byId(id);
      if (!section) return;
      if (id === "entityManagement") {
        byId("entityManageSecureBody")?.classList.toggle("hidden", !unlocked);
      } else {
        section.querySelectorAll(".entity-mgmt-content").forEach(el => el.classList.toggle("hidden", !unlocked));
      }
    });

    if (!gate) return;
    if (!unlocked && active) {
      active.prepend(gate);
      gate.classList.remove("hidden");
    } else {
      gate.classList.add("hidden");
      parkGate();
    }

    const hint = byId("sos2faPhoneHint");
    if (hint && !challengeRequested) {
      hint.textContent = "";
    }
  }

  async function logActivity(action, detail) {
    const sessionId = getSessionId("entityManagement");
    if (!sessionId) return;
    try {
      await callable("logEntityManagementActivity")({action, detail, sos2faSessionId: sessionId});
    } catch (_) {}
  }

  async function sendCode() {
    const authUser = firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    if (!isSuperAdminUser(authUser)) {
      throw new Error("SOS2FA Entity Management unlock is limited to Super Admin.");
    }
    setStatus("Requesting SOS2FA code via SMS…");
    const result = await callable("requestSos2faCode")({});
    const data = result?.data || {};
    challengeRequested = true;
    const last4 = data.phoneLast4 ? ` ending ${data.phoneLast4}` : "";
    setStatus(`SOS2FA code sent to Super Admin mobile${last4}. Enter the six-digit code.`);
    syncGateUi("entityManagement", false);
    return data;
  }

  async function verifyCode({code} = {}) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    const sms = String(code || byId("sos2faCode")?.value || "").trim();
    if (!/^\d{6}$/.test(sms)) throw new Error("Enter the six-digit SOS2FA SMS code.");
    if (!challengeRequested) throw new Error("Request SOS2FA Code via SMS first.");

    try {
      const result = await callable("verifySos2faCode")({code: sms});
      const data = result?.data || {};
      unlock("entityManagement", data);
      challengeRequested = false;
      setStatus("SOS2FA unlocked for this browser session.");
      syncGateUi("entityManagement", true);
      await logActivity("entity_management_unlocked", {panel: activeEntityPanel()?.id || "entityManagement"});
      fireUnlock("entityManagement");
      return true;
    } catch (error) {
      const message = String(error?.message || error?.details || error || "");
      if (/wrong code entered/i.test(message)) {
        setStatus(WRONG_CODE_MESSAGE);
        throw new Error(WRONG_CODE_MESSAGE);
      }
      throw error;
    }
  }

  async function requireUnlock(scope, options = {}) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) {
      setStatus("Sign in required.");
      syncGateUi(scope, false);
      return false;
    }
    if (!isSuperAdminUser(authUser, options.profile)) {
      setStatus("Only Super Admin may unlock Entity Management with SOS2FA.");
      syncGateUi(scope, false);
      byId("sos2faActions")?.classList.add("hidden");
      byId("sos2faSendBtn")?.classList.add("hidden");
      return false;
    }
    byId("sos2faActions")?.classList.remove("hidden");
    byId("sos2faSendBtn")?.classList.remove("hidden");
    if (isUnlocked(scope)) {
      syncGateUi(scope, true);
      return true;
    }
    syncGateUi(scope, false);
    setStatus("Entity Management is locked. Request SOS2FA Code via SMS to continue.");
    return false;
  }

  function onPanelActivate(panelId) {
    if (!isEntityMgmtPanel(panelId)) {
      parkGate();
      byId("sos2faGate")?.classList.add("hidden");
      return;
    }
    requireUnlock("entityManagement");
  }

  function fireUnlock(scope) {
    const cb = unlockCallbacks.get(scope);
    if (typeof cb === "function") cb();
  }

  function bindUi(scope) {
    if (uiBound) return;
    uiBound = true;
    byId("sos2faSendBtn")?.addEventListener("click", async () => {
      try {
        await sendCode();
        byId("sos2faCode")?.focus();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faVerifyBtn")?.addEventListener("click", async () => {
      try {
        await verifyCode();
      } catch (e) {
        if (e.message !== WRONG_CODE_MESSAGE) setStatus(e.message || String(e));
      }
    });
    byId("sos2faLockBtn")?.addEventListener("click", async () => {
      lock(scope);
      syncGateUi(scope, false);
      setStatus("Entity Management locked. Request a new SOS2FA code to continue.");
      try {
        await logActivity("entity_management_locked", {});
      } catch (_) {}
    });
    byId("sos2faCode")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        byId("sos2faVerifyBtn")?.click();
      }
    });
  }

  function mount(options = {}) {
    const scope = options.scope || "entityManagement";
    if (typeof options.onUnlocked === "function") unlockCallbacks.set(scope, options.onUnlocked);
    bindUi(scope);
    ensureGatedWrappers();
    return requireUnlock(scope, options);
  }

  root.FLOQRSOS2FA = {
    name: "SOS2FA",
    fullName: "Social OS 2FA",
    ENTITY_MGMT_PANELS,
    isSuperAdminUser,
    isEntityMgmtPanel,
    isUnlocked,
    getSessionId,
    unlock,
    lock,
    sendCode,
    verifyCode,
    requireUnlock,
    onPanelActivate,
    mount,
    syncGateUi,
    logActivity,
    DEFAULT_TTL_MS,
    WRONG_CODE_MESSAGE
  };
})(window);
