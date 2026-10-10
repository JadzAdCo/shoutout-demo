/* Master Admin demo sign-in code (break-glass while SendGrid is unpaid).
   Design notes: .cursor/rules/design-notes-demo-signin.mdc */
(function () {
  "use strict";

  const SCOPE = "entityManagement";
  const ROLES = [
    ["waitress", "Waitress"],
    ["waiter", "Waiter"],
    ["busboy", "Busboy"],
    ["bottle", "Bottle service"],
    ["bartender", "Bartender"],
    ["dj", "DJ"],
    ["promoter", "Promoter"],
    ["clubadmin", "Club Admin"],
    ["custom", "Other (type the email)"]
  ];
  const DEMO_EMAIL = /^temp_[a-z0-9]+_\d+@floqr-demo\.com$/;
  const MIN_REASON = 8;

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const fn = firebase.app().functions("us-central1");
  const byId = id => document.getElementById(id);
  const sos2fa = () => window.FLOQRSOS2FA;
  let isMaster = false;
  let countdownTimer = null;
  let issued = null;

  function setStatus(message) {
    byId("demoSigninStatus").textContent = message || "";
  }

  function show(id, visible) {
    byId(id)?.classList.toggle("hidden", !visible);
  }

  function selectedEmail() {
    if (byId("demoRole").value === "custom") return byId("demoCustomEmail").value.trim().toLowerCase();
    return `temp_${byId("demoRole").value}_${byId("demoNumber").value}@floqr-demo.com`;
  }

  function fillPickers() {
    byId("demoRole").innerHTML = ROLES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    byId("demoNumber").innerHTML = Array.from({length: 10}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  }

  function refreshForm() {
    const custom = byId("demoRole").value === "custom";
    show("demoCustomWrap", custom);
    byId("demoNumber").disabled = custom;
    const email = selectedEmail();
    byId("demoEmailPreview").textContent = email || "—";
    const unlocked = isMaster && sos2fa()?.isUnlocked(SCOPE);
    byId("demoGenerateBtn").disabled = !unlocked || !DEMO_EMAIL.test(email);
  }

  function refreshGate() {
    const user = auth.currentUser;
    show("demoSigninSos2fa", isMaster);
    show("demoSigninForm", isMaster);
    refreshForm();
    if (!user) return;
    if (!isMaster) {
      setStatus(`Signed in as ${user.email || user.uid}. Master Admin access is required.`);
      clearResult();
      return;
    }
    setStatus(sos2fa()?.isUnlocked(SCOPE)
      ? `Signed in as ${user.email}. SOS2FA unlocked — pick a demo account and press Generate.`
      : `Signed in as ${user.email}. Unlock SOS2FA to generate a demo sign-in code.`);
  }

  function clearResult() {
    clearInterval(countdownTimer);
    countdownTimer = null;
    issued = null;
    byId("demoResultCode").textContent = "";
    show("demoSigninResult", false);
  }

  function tickCountdown() {
    if (!issued) return;
    const seconds = Math.max(0, Math.ceil((issued.expiresAtMs - Date.now()) / 1000));
    const expired = seconds === 0;
    byId("demoResultCode").classList.toggle("is-expired", expired);
    byId("demoResultCountdown").textContent = expired
      ? "Expired — generate a new code."
      : `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
    if (expired) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function showResult(data) {
    issued = {email: data.email, code: data.code, expiresAtMs: Number(data.expiresAtMs) || Date.now() + 600000};
    byId("demoResultEmail").textContent = issued.email;
    byId("demoResultCode").textContent = issued.code;
    byId("demoSearchUrl").textContent = new URL("./", location.href).href;
    show("demoSigninResult", true);
    clearInterval(countdownTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
    tickCountdown();
    byId("demoSigninResult").scrollIntoView({behavior: "smooth", block: "start"});
  }

  async function askReason(email) {
    const prompt = window.FLOQRReasonPrompt;
    if (!prompt?.ask) {
      setStatus("The reason prompt did not load. Reload the page and try again.");
      return null;
    }
    const reason = await prompt.ask({summary: `Demo sign-in code for ${email}`, minLength: MIN_REASON, saveLabel: "Generate"});
    if (reason === null) setStatus("Cancelled — no code was generated.");
    return reason;
  }

  async function generate() {
    const email = selectedEmail();
    if (!DEMO_EMAIL.test(email)) {
      setStatus("Only demo accounts like temp_waitress_1@floqr-demo.com can get a code.");
      return;
    }
    const sos2faSessionId = sos2fa()?.getSessionId(SCOPE);
    if (!sos2faSessionId) {
      refreshGate();
      return;
    }
    const reason = await askReason(email);
    if (!reason) return;
    const button = byId("demoGenerateBtn");
    button.disabled = true;
    try {
      setStatus(`Generating a sign-in code for ${email}…`);
      const result = await fn.httpsCallable("issueDemoSignInCode")({email, reason, sos2faSessionId});
      showResult(result.data || {});
      setStatus(result.data?.accountExists === false
        ? `Code ready. ${email} has no account yet — it is created the first time you sign in.`
        : `Code ready for ${email}.`);
    } catch (error) {
      setStatus(error?.message || "The demo sign-in code could not be generated.");
      if (/SOS2FA/i.test(error?.message || "")) sos2fa()?.lock(SCOPE);
    } finally {
      refreshGate();
    }
  }

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch (_) {
      setStatus(`Copy failed — select the ${label.toLowerCase()} and copy it by hand.`);
    }
  }

  function bindUi() {
    fillPickers();
    ["demoRole", "demoNumber"].forEach(id => byId(id).addEventListener("change", refreshForm));
    byId("demoCustomEmail").addEventListener("input", refreshForm);
    byId("demoGenerateBtn").addEventListener("click", generate);
    byId("demoCopyCodeBtn").addEventListener("click", () => issued && copy(issued.code, "Code"));
    byId("demoCopyEmailBtn").addEventListener("click", () => issued && copy(issued.email, "Email"));
    byId("demoClearBtn").addEventListener("click", clearResult);
    byId("sos2faLockBtn").addEventListener("click", () => setTimeout(refreshGate, 0));
    document.addEventListener("floqr:sos2fa-unlocked", refreshGate);
    window.addEventListener("pagehide", clearResult);
    refreshForm();
  }

  bindUi();
  window.FLOQRSessionShell.bind({
    auth,
    chrome: "[data-floqr-auth-chrome]",
    statusEl: "#demoSigninStatus",
    onUser: async user => {
      const claims = await sos2fa().loadClaims(user);
      isMaster = sos2fa().isMasterAdminUser(user, claims);
      refreshGate();
      if (isMaster) Promise.resolve(sos2fa().mount({scope: SCOPE, onUnlocked: refreshGate})).finally(refreshGate);
    }
  });
})();
