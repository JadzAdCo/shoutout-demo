/* BOT DEE standalone page — chat via executeBotSession.
   Design notes: .cursor/rules/design-notes-botdee-page.mdc */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const nav = () => window.FLOQRNav;
  const href = (path, params) => {
    const stamped = nav()?.stampCurrentVersion?.(path, params);
    if (stamped) return stamped;
    const qs = new URLSearchParams(params).toString();
    return qs ? `${path}?${qs}` : path;
  };
  const access = () => window.FLOQRBotDeeAccess;

  function ensureFirebase() {
    try {
      if (window.firebase && !firebase.apps.length && window.firebaseConfig) firebase.initializeApp(window.firebaseConfig);
    } catch (error) {
      console.warn("BOT DEE could not start Firebase", error?.message || error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureFirebase();
    access()?.activate?.();
    nav()?.applyGlobalBack?.("floqrGlobalBack");
    window.FLOQRChromeScheme?.applyDocument?.();
    window.showShoutoutLanding = () => { location.href = href("./", {start: "search"}); };
    window.FLOQRBotDeeChat?.bind({});
    const q = new URL(location.href).searchParams.get("q");
    if (q) {
      const chatInput = byId("botDeeChatInput");
      if (chatInput) {
        chatInput.value = q.slice(0, 2000);
        chatInput.focus();
      }
    }
    window.firebase?.auth?.().onAuthStateChanged(() => {
      access()?.reset?.();
    });
  });
})();
