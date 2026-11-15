/* Si-nema — pin a FloqMedia Spatial Studio grant as a virtual set. No geometry copy. */
(function (global) {
  "use strict";

  function t(key, fallback) {
    return global.FLOQRI18n?.t?.(key) || fallback;
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function setStatus(msg) {
    const el = byId("sinemaStatus");
    if (el) el.textContent = msg || "";
  }
  function fn(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  let currentUser = null;
  let selectedGrantId = "";
  let currentScene = null;

  function renderGrants(grants) {
    const list = byId("sinemaGrantList");
    const empty = byId("sinemaEmpty");
    const usable = (grants || []).filter((g) => g.status === "active" && g.destinationType === "sinema");
    if (empty) empty.classList.toggle("hidden", usable.length > 0);
    if (!list) return;
    list.innerHTML = usable.map((g) => {
      const pin = g.revisionPolicy?.pinRevisionId || "";
      return `<label class="card"><input type="radio" name="sinemaGrant" value="${g.grantId}"/> <strong>${g.projectId}</strong><br/><span class="sub small">${t("page.sinema.revisionLabel", "Pinned revision")}: ${pin}</span></label>`;
    }).join("");
    list.querySelectorAll("input[name=sinemaGrant]").forEach((input) => {
      input.addEventListener("change", () => {
        selectedGrantId = input.value;
        byId("sinemaSaveBtn").disabled = !selectedGrantId;
      });
    });
    if (usable[0] && !selectedGrantId) {
      const first = list.querySelector("input[name=sinemaGrant]");
      if (first) {
        first.checked = true;
        selectedGrantId = first.value;
        byId("sinemaSaveBtn").disabled = false;
      }
    }
  }

  function paintClock(scene) {
    const el = byId("sinemaClock");
    if (!el) return;
    if (!scene?.originalSavedAtMs) {
      el.textContent = `${t("page.sinema.clockLabel", "Edit window")}: starts on first save (48 hours, FloqR clock).`;
      return;
    }
    const until = new Date(scene.editableUntilMs).toISOString();
    el.textContent = `${t("page.sinema.clockLabel", "Edit window")} until ${until}`;
  }

  async function loadGrants() {
    const res = await fn("listMySpatialGrants")({});
    renderGrants(res?.data?.grants || []);
  }

  async function saveScene() {
    if (!selectedGrantId) return;
    try {
      if (!currentScene) {
        const created = await fn("createSinemaScene")({ grantId: selectedGrantId });
        currentScene = created.data.scene;
      }
      const saved = await fn("saveSinemaScene")({
        sceneId: currentScene.sceneId,
        notes: "si-nema-virtual-set"
      });
      currentScene = saved.data.scene;
      paintClock(currentScene);
      setStatus(saved.data.firstSave ? "Scene saved. 48-hour window started." : "Scene updated. Deadline unchanged.");
    } catch (err) {
      const code = err?.message || String(err);
      if (/edit_window_closed/.test(code)) {
        setStatus(t("page.sinema.windowClosed", "The 48-hour Si-nema edit window has closed. Later edits need a separate authorization. The original save timestamp is not reset."));
      } else {
        setStatus(code);
      }
    }
  }

  function showApp() {
    byId("sinemaGate")?.classList.add("hidden");
    byId("sinemaApp")?.classList.remove("hidden");
  }

  function boot() {
    if (global.FLOQRNav?.applyGlobalBack) global.FLOQRNav.applyGlobalBack();
    if (global.FLOQRI18n?.apply) global.FLOQRI18n.apply(document);
    if (!global.firebase?.apps?.length && global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    byId("sinemaSaveBtn")?.addEventListener("click", () => saveScene());
    if (!global.FLOQRSessionShell) {
      setStatus("Session shell missing.");
      return;
    }
    global.FLOQRSessionShell.bind({
      auth: firebase.auth(),
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#sinemaStatus",
      onUser: (user) => {
        if (global.FLOQRSessionShell.popupBlocked?.("#sinemaStatus")) return;
        currentUser = user;
        showApp();
        loadGrants().catch((err) => setStatus(err.message || String(err)));
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
