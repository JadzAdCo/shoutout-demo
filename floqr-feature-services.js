/* FLOQR Features & Services — Search tile visibility + test-feature page guard.
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
(function (root) {
  "use strict";

  const COLLECTION = "featureServices";
  const BETA_COLLECTION = "betaTesters";
  const GUARD_TIMEOUT_MS = 8000;

  // Mirrors functions/feature-services-core.js FEATURE_CATALOG (keys, routes, defaults).
  const CATALOG = Object.freeze([
    {key: "shoutOut", label: "ShoutOut", patronGate: "shoutOut", buttonIds: ["shoutoutBtnCard", "clubShoutoutBtn"], route: "./?start=shoutout", sortOrder: 10, IsFeatureEnabled: 1, IsTestFeature: 0},
    {key: "mingl", label: "Mingl", patronGate: "mingl", buttonIds: ["minglBtnCard", "confirmGoMinglBtn"], route: "./?start=mingl", sortOrder: 20, IsFeatureEnabled: 0, IsTestFeature: 1},
    {key: "bartr", label: "Trade by BartR", patronGate: "bartr", buttonIds: ["bartrBtnCard", "confirmGoBartrBtn"], route: "./commerce.html?from=search", sortOrder: 30, IsFeatureEnabled: 0, IsTestFeature: 1},
    {key: "rydr", label: "RydR", patronGate: "rydr", buttonIds: ["rydrBtnCard"], route: "./rydr.html?from=search", sortOrder: 40, IsFeatureEnabled: 0, IsTestFeature: 1},
    {key: "supRstar", label: "supRstar", patronGate: "", buttonIds: ["suprstrBtnCard"], route: "./suprstr-search.html?from=search", sortOrder: 50, IsFeatureEnabled: 0, IsTestFeature: 1},
    {key: "floqAi", label: "FloqAi", patronGate: "floqAi", buttonIds: ["intentSearchBtnCard"], route: "./?start=intent", sortOrder: 60, IsFeatureEnabled: 0, IsTestFeature: 1}
  ].map(row => Object.freeze(row)));

  let features = defaults();
  let viewer = {uid: "", isMasterAdmin: false, isBetaTester: false};
  let viewerUser = null;
  let viewerProfile = null;

  function flag(value) {
    return value === 1 || value === true || value === "1" ? 1 : 0;
  }

  function defaults() {
    return Object.fromEntries(CATALOG.map(row => [row.key, {...row, revision: 0, persisted: false}]));
  }

  function normalize(key, raw) {
    const base = CATALOG.find(row => row.key === key);
    if (!base) return null;
    const data = raw || {};
    const has = field => Object.prototype.hasOwnProperty.call(data, field);
    return {
      ...base,
      IsFeatureEnabled: has("IsFeatureEnabled") ? flag(data.IsFeatureEnabled) : base.IsFeatureEnabled,
      IsTestFeature: has("IsTestFeature") ? flag(data.IsTestFeature) : base.IsTestFeature,
      revision: Number(data.revision || 0),
      updatedByEmail: data.updatedByEmail || "",
      updatedAtMs: Number(data.updatedAtMs || 0),
      lastChangeReason: data.lastChangeReason || "",
      persisted: !!raw
    };
  }

  function t(key, fallback) {
    try {
      const value = root.FLOQRI18n?.t?.(key);
      return value && value !== key ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function unavailableMessage() {
    return t("feature.unavailable", "This feature isn't available on your account yet.");
  }

  // UI hint only; firestore.rules isMasterAdmin() and the callables are the enforcement point.
  const RULES_MASTER_ADMIN_EMAILS = ["bands.don@gmail.com", "bans.don@gmail.com", "don.b@jadzholdings.com"];

  function isMasterAdminUser(user, profile) {
    if (!user) return false;
    const gates = root.FLOQRFeatureGates;
    if (gates && (gates.isMasterAdminEmail(user) || gates.isSuperAdmin(user, profile))) return true;
    return RULES_MASTER_ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());
  }

  function canAccess(key, who = viewer, rows = features) {
    const row = rows[key];
    if (!row) return false;
    if (who.isMasterAdmin) return true;
    if (flag(row.IsFeatureEnabled) === 1) return true;
    return flag(row.IsTestFeature) === 1 && who.isBetaTester === true;
  }

  function isBetaOnly(key) {
    const row = features[key];
    return !!row && flag(row.IsFeatureEnabled) !== 1 && canAccess(key);
  }

  async function load({db, user, profile} = {}) {
    const database = db || root.firebase?.firestore?.();
    const next = defaults();
    let isBetaTester = false;
    if (database && user?.uid) {
      const [featureSnap, betaSnap] = await Promise.all([
        database.collection(COLLECTION).get().catch(error => {
          console.warn("Features & Services unavailable; using packaged defaults", error?.message || error);
          return null;
        }),
        database.collection(BETA_COLLECTION).doc(user.uid).get().catch(() => null)
      ]);
      featureSnap?.forEach(doc => {
        const row = normalize(doc.id, doc.data());
        if (row) next[doc.id] = row;
      });
      const beta = betaSnap?.exists ? betaSnap.data() || {} : {};
      isBetaTester = flag(beta.IsBetaTester) === 1 && beta.status === "active";
    }
    features = next;
    viewerUser = user || null;
    viewerProfile = profile || null;
    viewer = {uid: user?.uid || "", isMasterAdmin: isMasterAdminUser(user, profile), isBetaTester};
    return {features: getFeatures(), viewer: {...viewer}};
  }

  function patronGateAllows(base) {
    const gates = root.FLOQRFeatureGates;
    if (!base.patronGate || !gates?.patronMayUse) return true;
    return gates.patronMayUse(base.patronGate, viewerUser, viewerProfile);
  }

  function applySearchUi(doc = document) {
    const betaLabel = t("cat.betaPill", "Beta");
    CATALOG.forEach(base => {
      const allowed = canAccess(base.key) && patronGateAllows(base);
      const beta = allowed && isBetaOnly(base.key);
      base.buttonIds.forEach(id => {
        const el = doc.getElementById(id);
        if (!el) return;
        el.classList.toggle("hidden", !allowed);
        el.classList.toggle("feature-beta", beta);
        el.setAttribute("aria-disabled", allowed ? "false" : "true");
        if (el.tagName === "BUTTON") el.disabled = !allowed;
        if (beta) el.dataset.betaLabel = betaLabel;
        else delete el.dataset.betaLabel;
      });
    });
  }

  function waitForUser(auth) {
    return new Promise(resolve => {
      const stop = auth.onAuthStateChanged(user => {
        stop();
        resolve(user || null);
      });
    });
  }

  function ensureGuardStyles(doc) {
    if (doc.getElementById("floqrFeatureGuardStyles")) return;
    const style = doc.createElement("style");
    style.id = "floqrFeatureGuardStyles";
    style.textContent = [
      "body.feature-guard-pending>*{visibility:hidden}",
      "body.feature-guard-denied>*:not(.feature-guard-block){display:none!important}",
      ".feature-guard-block{max-width:560px;margin:12vh auto;padding:28px;border-radius:24px;background:#10132a;color:#fff;font:800 18px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.45)}",
      ".feature-guard-block a{display:inline-block;margin-top:18px;color:#dfff5a}"
    ].join("");
    doc.head.appendChild(style);
  }

  function showDenied(doc) {
    const body = doc.body;
    body.classList.remove("feature-guard-pending");
    body.classList.add("feature-guard-denied");
    if (doc.querySelector(".feature-guard-block")) return;
    const block = doc.createElement("div");
    block.className = "feature-guard-block";
    block.setAttribute("role", "alert");
    const message = doc.createElement("p");
    message.textContent = unavailableMessage();
    const back = doc.createElement("a");
    back.href = root.FLOQRNav?.stampCurrentVersion?.("./", {start: "search"}) || "./?start=search";
    back.target = root.self !== root.top ? "_parent" : "_self";
    back.textContent = t("feature.backToSearch", "Back to Search");
    block.append(message, back);
    body.prepend(block);
  }

  function showAllowed(doc) {
    doc.body.classList.remove("feature-guard-pending", "feature-guard-denied");
    doc.querySelector(".feature-guard-block")?.remove();
  }

  function firebaseAuth() {
    try {
      const fb = root.firebase;
      if (!fb) return null;
      if (!fb.apps?.length && root.firebaseConfig) fb.initializeApp(root.firebaseConfig);
      return fb.auth();
    } catch (error) {
      console.warn("Feature guard could not start Firebase Auth", error?.message || error);
      return null;
    }
  }

  /** <body data-floqr-feature="bartr" [data-floqr-feature-signed-out="allow"]> — fail closed. */
  function guardPage({featureKey, allowSignedOut = false, doc = document} = {}) {
    const key = String(featureKey || "");
    if (!CATALOG.some(row => row.key === key)) return Promise.resolve(true);
    ensureGuardStyles(doc);
    doc.body.classList.add("feature-guard-pending");
    const auth = firebaseAuth();
    if (!auth) {
      showDenied(doc);
      return Promise.resolve(false);
    }
    const timer = setTimeout(() => showDenied(doc), GUARD_TIMEOUT_MS);
    return new Promise(resolve => {
      auth.onAuthStateChanged(async user => {
        if (!user) {
          clearTimeout(timer);
          if (allowSignedOut) showAllowed(doc);
          else showDenied(doc);
          resolve(allowSignedOut);
          return;
        }
        let ok = false;
        try {
          await load({user});
          ok = canAccess(key);
        } catch (error) {
          console.warn("Feature guard check failed", error?.message || error);
        }
        clearTimeout(timer);
        if (ok) showAllowed(doc);
        else showDenied(doc);
        resolve(ok);
      });
    });
  }

  function getFeatures() {
    return Object.fromEntries(Object.entries(features).map(([key, row]) => [key, {...row}]));
  }

  function autoGuard() {
    const key = document.body?.dataset?.floqrFeature;
    if (!key) return;
    guardPage({featureKey: key, allowSignedOut: document.body.dataset.floqrFeatureSignedOut === "allow"});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoGuard);
  else autoGuard();

  root.FLOQRFeatureServices = {
    CATALOG,
    normalize,
    canAccess,
    isBetaOnly,
    load,
    applySearchUi,
    guardPage,
    waitForUser,
    getFeatures,
    getViewer: () => ({...viewer}),
    unavailableMessage
  };
})(window);
