/* SOS2FA — Super Admin gate for Entity Management (SMS/email OTP + authenticator TOTP). */
(function (root) {
  "use strict";

  const STORAGE_PREFIX = "floqr_sos2fa_";
  const DEFAULT_TTL_MS = 60 * 60 * 1000;
  const WRONG_CODE_MESSAGE = "Wrong code entered, please enter the correct code to proceed";
  const SUPER_ADMIN_EMAILS = (
    root.SHOUTOUT_SUPER_ADMIN_EMAILS ||
    root.SHOUTOUT_MASTER_ADMIN_EMAILS ||
    ["bans.don@gmail.com", "don.b@jadzholdings.com"]
  ).map(x => String(x).toLowerCase());
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
  let methodsCache = null;
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

  function selectedChannel() {
    const checked = document.querySelector('input[name="sos2faChannel"]:checked');
    return String(checked?.value || "both").toLowerCase();
  }

  function showSentConfirmToast({phoneLast5 = "", emailMasked = "", failed = false, delivery = null} = {}) {
    document.querySelectorAll(".sos2fa-sent-toast").forEach((el) => el.remove());
    const toast = document.createElement("div");
    toast.className = "sos2fa-sent-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    const digits = String(phoneLast5 || "").replace(/\D/g, "").slice(-5);
    const parts = [];
    if (digits) parts.push(`mobile •••••${digits}`);
    if (emailMasked) parts.push(`email ${emailMasked}`);
    const dest = parts.join(" · ") || "your Super Admin contact";
    const smsFail = delivery?.smsError ? ` SMS failed (${delivery.smsError}).` : "";
    const emailFail = delivery?.emailError ? ` Email failed (${delivery.emailError}).` : "";
    toast.innerHTML = failed
      ? `<strong>SOS2FA delivery failed</strong><span>Tried ${dest}.${smsFail}${emailFail}</span>`
      : `<strong>SOS2FA code requested</strong><span>Sent toward ${dest}.${smsFail}${emailFail}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 280);
    }, 2600);
  }

  function phoneLast5FromError(error) {
    const details = error?.details || error?.customData?.details || error?.customData || {};
    if (details.phoneLast5) return String(details.phoneLast5);
    const msg = String(error?.message || "");
    const match = msg.match(/ending\s+(\d{4,5})/i);
    return match ? match[1] : "";
  }

  function emailMaskedFromError(error) {
    const details = error?.details || error?.customData?.details || error?.customData || {};
    return details.emailMasked ? String(details.emailMasked) : "";
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

  function syncTotpUi(methods) {
    const enrolled = !!methods?.totpEnrolled;
    byId("sos2faTotpDisableBtn")?.classList.toggle("hidden", !enrolled);
    byId("sos2faTotpStartBtn") && (byId("sos2faTotpStartBtn").textContent = enrolled ? "Re-enroll authenticator" : "Enroll authenticator");
    const status = byId("sos2faTotpStatus");
    if (status) {
      status.textContent = enrolled
        ? "Authenticator enrolled. Enter the current 6-digit app code to unlock."
        : "Optional. Use Google Authenticator, Authy, or Microsoft Authenticator after you enroll.";
    }
  }

  async function refreshMethods() {
    try {
      const result = await callable("getSos2faMethods")({});
      methodsCache = result?.data || {};
      syncTotpUi(methodsCache);
      return methodsCache;
    } catch (_) {
      return methodsCache;
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
    const channel = selectedChannel();
    setStatus(`Requesting SOS2FA code via ${channel === "both" ? "SMS + email" : channel}…`);
    try {
      const result = await callable("requestSos2faCode")({channel});
      const data = result?.data || {};
      challengeRequested = true;
      const last5 = data.phoneLast5 || data.phoneLast4 || "";
      const emailMasked = data.emailMasked || "";
      showSentConfirmToast({phoneLast5: last5, emailMasked, delivery: data.delivery || null});
      const hint = byId("sos2faPhoneHint");
      if (hint) {
        const bits = [];
        if (data.delivery?.sms === "sent" && last5) bits.push(`SMS •••••${last5}`);
        if (data.delivery?.email === "sent" && emailMasked) bits.push(`Email ${emailMasked}`);
        if (data.delivery?.smsError) bits.push(`SMS note: ${data.delivery.smsError}`);
        if (data.delivery?.emailError) bits.push(`Email note: ${data.delivery.emailError}`);
        hint.textContent = bits.length ? `Delivered / notes: ${bits.join(" · ")}` : "Code requested.";
      }
      setStatus("Enter the six-digit SOS2FA code from SMS or email.");
      syncGateUi("entityManagement", false);
      return data;
    } catch (error) {
      const last5 = phoneLast5FromError(error);
      const emailMasked = emailMaskedFromError(error);
      showSentConfirmToast({
        phoneLast5: last5,
        emailMasked,
        failed: true,
        delivery: error?.details?.delivery || null
      });
      throw error;
    }
  }

  async function verifyCode({code} = {}) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    const sms = String(code || byId("sos2faCode")?.value || "").trim();
    if (!/^\d{6}$/.test(sms)) throw new Error("Enter the six-digit SOS2FA code.");
    if (!challengeRequested) throw new Error("Request a SOS2FA code first (SMS and/or email).");

    try {
      const result = await callable("verifySos2faCode")({code: sms});
      const data = result?.data || {};
      unlock("entityManagement", data);
      challengeRequested = false;
      setStatus("SOS2FA unlocked for this browser session.");
      syncGateUi("entityManagement", true);
      await logActivity("entity_management_unlocked", {panel: activeEntityPanel()?.id || "entityManagement", method: "code"});
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

  async function verifyTotp({code} = {}) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    const totp = String(code || byId("sos2faTotpCode")?.value || "").trim();
    if (!/^\d{6}$/.test(totp)) throw new Error("Enter the six-digit authenticator code.");
    try {
      const result = await callable("verifySos2faTotp")({code: totp});
      const data = result?.data || {};
      unlock("entityManagement", data);
      challengeRequested = false;
      setStatus("SOS2FA unlocked with authenticator for this browser session.");
      syncGateUi("entityManagement", true);
      await logActivity("entity_management_unlocked", {panel: activeEntityPanel()?.id || "entityManagement", method: "totp"});
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

  async function startTotpEnrollment() {
    setStatus("Starting authenticator enrollment…");
    const result = await callable("startSos2faTotpEnrollment")({});
    const data = result?.data || {};
    const panel = byId("sos2faTotpEnrollPanel");
    const secretEl = byId("sos2faTotpSecret");
    const qr = byId("sos2faTotpQr");
    if (secretEl) secretEl.textContent = data.secret || "";
    if (qr && data.otpauthUrl) {
      qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.otpauthUrl)}`;
      qr.classList.remove("hidden");
    }
    panel?.classList.remove("hidden");
    setStatus("Scan the QR code (or enter the secret), then confirm with the app’s current code.");
    return data;
  }

  async function confirmTotpEnrollment() {
    const code = String(byId("sos2faTotpConfirmCode")?.value || "").trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the authenticator code to confirm enrollment.");
    await callable("confirmSos2faTotpEnrollment")({code});
    byId("sos2faTotpEnrollPanel")?.classList.add("hidden");
    await refreshMethods();
    setStatus("Authenticator enrolled. You can unlock with the app code anytime.");
  }

  async function disableTotp() {
    await callable("disableSos2faTotp")({});
    byId("sos2faTotpEnrollPanel")?.classList.add("hidden");
    await refreshMethods();
    setStatus("Authenticator disabled for SOS2FA.");
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
    refreshMethods();
    if (isUnlocked(scope)) {
      syncGateUi(scope, true);
      return true;
    }
    syncGateUi(scope, false);
    setStatus("Entity Management is locked. Request a SOS2FA code (SMS/email) or use your authenticator.");
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
      setStatus("Entity Management locked. Request a new SOS2FA code or use authenticator.");
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
    byId("sos2faTotpVerifyBtn")?.addEventListener("click", async () => {
      try {
        await verifyTotp();
      } catch (e) {
        if (e.message !== WRONG_CODE_MESSAGE) setStatus(e.message || String(e));
      }
    });
    byId("sos2faTotpStartBtn")?.addEventListener("click", async () => {
      try {
        await startTotpEnrollment();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faTotpConfirmBtn")?.addEventListener("click", async () => {
      try {
        await confirmTotpEnrollment();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faTotpDisableBtn")?.addEventListener("click", async () => {
      try {
        await disableTotp();
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faTotpCode")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        byId("sos2faTotpVerifyBtn")?.click();
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
    verifyTotp,
    startTotpEnrollment,
    confirmTotpEnrollment,
    disableTotp,
    requireUnlock,
    onPanelActivate,
    mount,
    syncGateUi,
    logActivity,
    DEFAULT_TTL_MS,
    WRONG_CODE_MESSAGE
  };
})(window);
