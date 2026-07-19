/* SOS2FA — Social OS SMS second-factor gate for sensitive Master Admin surfaces. */
(function (root) {
  "use strict";

  const STORAGE_PREFIX = "floqr_sos2fa_";
  const DEFAULT_TTL_MS = 30 * 60 * 1000;
  const SUPER_ADMIN_EMAILS = (root.SHOUTOUT_SUPER_ADMIN_EMAILS || ["bands.don@gmail.com"]).map(x => String(x).toLowerCase());
  const SECONDARY_APP_NAME = "floqr-sos2fa";

  let recaptcha = null;
  let verificationId = "";
  let enrollmentSession = null;
  let pendingPhone = "";
  let uiBound = false;
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

  function storageKey(scope) {
    return `${STORAGE_PREFIX}${String(scope || "default")}`;
  }

  function isUnlocked(scope) {
    try {
      const raw = sessionStorage.getItem(storageKey(scope));
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.ok || !parsed?.exp) return false;
      if (Date.now() > Number(parsed.exp)) {
        sessionStorage.removeItem(storageKey(scope));
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function unlock(scope, ttlMs) {
    const exp = Date.now() + (Number(ttlMs) > 0 ? Number(ttlMs) : DEFAULT_TTL_MS);
    sessionStorage.setItem(storageKey(scope), JSON.stringify({ok:true, exp, at:Date.now()}));
  }

  function lock(scope) {
    sessionStorage.removeItem(storageKey(scope));
  }

  function clearVerifier() {
    try { recaptcha?.clear?.(); } catch (_) {}
    recaptcha = null;
  }

  function getVerifier(containerId) {
    if (recaptcha) return recaptcha;
    const id = containerId || "sos2fa-recaptcha";
    if (!byId(id)) {
      const host = document.createElement("div");
      host.id = id;
      host.className = "sos2fa-recaptcha";
      (byId("sos2faGate") || document.body).appendChild(host);
    }
    recaptcha = new firebase.auth.RecaptchaVerifier(id, {size:"normal"});
    return recaptcha;
  }

  function setStatus(message) {
    const el = byId("sos2faStatus");
    if (el) el.textContent = message || "";
  }

  function phoneHint(user) {
    try {
      const factors = user?.multiFactor?.enrolledFactors || [];
      const phone = factors.find(f => f.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID) || factors[0];
      return phone?.phoneNumber || phone?.displayName || "";
    } catch (_) {
      return "";
    }
  }

  function secondaryAuth() {
    let app;
    try {
      app = firebase.app(SECONDARY_APP_NAME);
    } catch (_) {
      app = firebase.initializeApp(firebase.app().options, SECONDARY_APP_NAME);
    }
    return app.auth();
  }

  async function sendCode({user, phoneNumber, containerId} = {}) {
    const authUser = user || firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    if (!isSuperAdminUser(authUser)) {
      throw new Error("SOS2FA Entity Management unlock is limited to Super Admin.");
    }

    clearVerifier();
    verificationId = "";
    enrollmentSession = null;
    pendingPhone = "";

    const provider = new firebase.auth.PhoneAuthProvider(firebase.auth());
    const verifier = getVerifier(containerId);
    const enrolled = authUser.multiFactor?.enrolledFactors || [];
    const phoneFactor = enrolled.find(f => f.factorId === firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID);
    const enrollFields = byId("sos2faEnrollFields");

    if (phoneFactor?.phoneNumber) {
      if (enrollFields) enrollFields.classList.add("hidden");
      pendingPhone = String(phoneFactor.phoneNumber).trim();
      setStatus(`Sending SOS2FA SMS to Super Admin mobile ${pendingPhone}…`);
      verificationId = await provider.verifyPhoneNumber(pendingPhone, verifier);
      setStatus("SOS2FA SMS sent to Super Admin. Enter the six-digit code.");
      return {mode:"verify", phone:pendingPhone};
    }

    if (enrollFields) enrollFields.classList.remove("hidden");
    const enrollPhone = String(phoneNumber || byId("sos2faPhone")?.value || "").trim();
    if (!/^\+\d{10,15}$/.test(enrollPhone)) {
      throw new Error("Enter Super Admin mobile in E.164 format (example +12025550123) to enroll SOS2FA.");
    }
    pendingPhone = enrollPhone;
    setStatus("Enrolling SOS2FA on Super Admin mobile…");
    enrollmentSession = await authUser.multiFactor.getSession();
    verificationId = await provider.verifyPhoneNumber({phoneNumber:enrollPhone, session:enrollmentSession}, verifier);
    setStatus("SOS2FA enrollment SMS sent. Enter the six-digit code to finish.");
    return {mode:"enroll", phone:enrollPhone};
  }

  async function verifyCode({code} = {}) {
    const authUser = firebase.auth().currentUser;
    if (!authUser) throw new Error("Sign in as Super Admin before SOS2FA.");
    const sms = String(code || byId("sos2faCode")?.value || "").trim();
    if (!verificationId || !/^\d{6}$/.test(sms)) throw new Error("Enter the six-digit SOS2FA SMS code.");

    const credential = firebase.auth.PhoneAuthProvider.credential(verificationId, sms);

    if (enrollmentSession) {
      const assertion = firebase.auth.PhoneMultiFactorGenerator.assertion(credential);
      await authUser.multiFactor.enroll(assertion, "SOS2FA Super Admin");
      enrollmentSession = null;
    } else {
      const alt = secondaryAuth();
      try {
        const result = await alt.signInWithCredential(credential);
        const confirmed = String(result?.user?.phoneNumber || "").trim();
        if (pendingPhone && confirmed && confirmed !== pendingPhone) {
          throw new Error("SOS2FA phone confirmation did not match Super Admin mobile.");
        }
      } finally {
        try { await alt.signOut(); } catch (_) {}
      }
    }

    verificationId = "";
    pendingPhone = "";
    clearVerifier();
    setStatus("SOS2FA verified.");
    return true;
  }

  function syncGateUi(scope, unlocked) {
    const gate = byId("sos2faGate");
    const body = byId("entityManageSecureBody");
    if (gate) gate.classList.toggle("hidden", !!unlocked);
    if (body) body.classList.toggle("hidden", !unlocked);
    const hint = byId("sos2faPhoneHint");
    if (hint) {
      const phone = phoneHint(firebase.auth().currentUser);
      hint.textContent = phone
        ? `SOS2FA will SMS Super Admin mobile ${phone}.`
        : "First use: enroll Super Admin mobile for SOS2FA, then confirm with the SMS code.";
    }
    const enrollFields = byId("sos2faEnrollFields");
    if (enrollFields) {
      const phone = phoneHint(firebase.auth().currentUser);
      enrollFields.classList.toggle("hidden", !!phone);
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
      byId("sos2faGate")?.classList.remove("hidden");
      byId("entityManageSecureBody")?.classList.add("hidden");
      byId("sos2faActions")?.classList.add("hidden");
      byId("sos2faEnrollFields")?.classList.add("hidden");
      return false;
    }
    byId("sos2faActions")?.classList.remove("hidden");
    if (isUnlocked(scope)) {
      syncGateUi(scope, true);
      return true;
    }
    syncGateUi(scope, false);
    setStatus("SOS2FA required. Send an SMS code to Super Admin to continue.");
    return false;
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
        await sendCode({phoneNumber:byId("sos2faPhone")?.value});
        byId("sos2faCode")?.focus();
      } catch (e) {
        clearVerifier();
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faVerifyBtn")?.addEventListener("click", async () => {
      try {
        await verifyCode();
        unlock(scope);
        syncGateUi(scope, true);
        setStatus("SOS2FA unlocked for this browser session.");
        fireUnlock(scope);
      } catch (e) {
        setStatus(e.message || String(e));
      }
    });
    byId("sos2faLockBtn")?.addEventListener("click", () => {
      lock(scope);
      syncGateUi(scope, false);
      setStatus("SOS2FA locked. Send a new SMS code to re-open Entity Management.");
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
    return requireUnlock(scope, options);
  }

  root.FLOQRSOS2FA = {
    name: "SOS2FA",
    fullName: "Social OS 2FA",
    isSuperAdminUser,
    isUnlocked,
    unlock,
    lock,
    sendCode,
    verifyCode,
    requireUnlock,
    mount,
    syncGateUi,
    DEFAULT_TTL_MS
  };
})(window);
