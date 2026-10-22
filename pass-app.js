/* Public door pass viewer — pass.html?t=<token> */
(function () {
  "use strict";

  function qs(name) {
    try { return new URL(location.href).searchParams.get(name) || ""; }
    catch (_) { return ""; }
  }

  function byId(id) { return document.getElementById(id); }

  async function boot() {
    const token = String(qs("t") || qs("token") || "").trim();
    const title = byId("passTitle");
    const meta = byId("passMeta");
    const status = byId("passStatus");
    const tokenEl = byId("passToken");
    const qrHost = byId("passQr");

    if (!token) {
      if (meta) meta.textContent = "Missing pass token. Open your pass from My Profile.";
      if (status) status.textContent = "No token in URL.";
      return;
    }

    if (tokenEl) tokenEl.textContent = token;
    try {
      window.FLOQRQr?.render?.(qrHost, token, {size: 200});
    } catch (_) { /* ignore */ }

    try {
      if (!firebase.apps.length && window.firebaseConfig) firebase.initializeApp(window.firebaseConfig);
      const call = firebase.app().functions("us-central1").httpsCallable("resolvePassToken");
      const res = await call({token});
      const row = res.data || {};
      if (title) title.textContent = row.venueName || "Door pass";
      if (meta) {
        const bits = [row.label, row.night, row.status].filter(Boolean);
        meta.textContent = bits.join(" · ") || "Show this QR at the door with ID 21+.";
      }
      if (status) status.textContent = "";
    } catch (err) {
      if (meta) meta.textContent = "Show this QR at the door with ID 21+.";
      if (status) status.textContent = err?.message || "Could not load pass details.";
    }

    try { window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack"); } catch (_) {}
    try { window.FLOQRNav?.bindHomeLogos?.(); } catch (_) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
