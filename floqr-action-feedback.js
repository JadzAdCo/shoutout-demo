/* FLOQR action feedback overlay v29.04: reusable progress/result popout with manual close. */
(function () {
  "use strict";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function ensureOverlay() {
    let overlay = document.getElementById("floqrActionFeedbackOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "floqrActionFeedbackOverlay";
    overlay.className = "floqr-action-feedback hidden";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `<div class="floqr-action-feedback-card" role="dialog" aria-modal="true" aria-labelledby="floqrActionFeedbackTitle">
      <strong id="floqrActionFeedbackTitle">Working...</strong>
      <p id="floqrActionFeedbackBody">Please wait.</p>
      <button id="floqrActionFeedbackClose" type="button">Close Window</button>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById("floqrActionFeedbackClose")?.addEventListener("click", () => hide());
    return overlay;
  }

  function markDeviceMode() {
    const root = document.documentElement;
    if (!root) return "desktop";
    const width = Math.max(window.innerWidth || 0, root.clientWidth || 0);
    const ua = navigator.userAgent || "";
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const tabletUa = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const phoneUa = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua);
    const mode = tabletUa || (coarse && width >= 700 && width <= 1180)
      ? "tablet"
      : (phoneUa || (coarse && width < 700) || width <= 640 ? "mobile" : "desktop");
    root.dataset.floqrDevice = mode;
    root.classList.remove("floqr-mobile-browser", "floqr-tablet-browser", "floqr-desktop-browser");
    root.classList.add(`floqr-${mode}-browser`);
    return mode;
  }

  function show(title, body, options = {}) {
    const overlay = ensureOverlay();
    overlay.classList.remove("hidden", "success", "failed");
    if (options.status) overlay.classList.add(options.status);
    const titleEl = document.getElementById("floqrActionFeedbackTitle");
    const bodyEl = document.getElementById("floqrActionFeedbackBody");
    if (titleEl) titleEl.innerHTML = esc(title || "Working...");
    if (bodyEl) bodyEl.innerHTML = esc(body || "Please wait.");
    return overlay;
  }

  function hide(delayMs = 0) {
    const run = () => document.getElementById("floqrActionFeedbackOverlay")?.classList.add("hidden");
    if (delayMs) setTimeout(run, delayMs);
    else run();
  }

  function bindDismissBehavior() {
    if (window.__FLOQR_ACTION_FEEDBACK_DISMISS__) return;
    window.__FLOQR_ACTION_FEEDBACK_DISMISS__ = true;
    document.addEventListener("click", event => {
      const overlay = document.getElementById("floqrActionFeedbackOverlay");
      if (!overlay || overlay.classList.contains("hidden")) return;
      if (event.target === overlay) hide();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") hide();
    });
  }

  async function run(messages = {}, action) {
    const returnTo = messages.returnTo || messages.page || "the previous page";
    show(messages.starting || "Working...", messages.wait || "Please wait a few seconds.");
    try {
      const result = await action();
      show(messages.success || "Action succeeded", messages.redirecting || `Success. Returning to ${returnTo}.`, {status:"success"});
      hide(Number(messages.hideAfterMs || 2200));
      return result;
    } catch (error) {
      show(messages.failed || "Action failed", error?.message || String(error), {status:"failed"});
      hide(Number(messages.failHideAfterMs || 5500));
      throw error;
    }
  }

  markDeviceMode();
  bindDismissBehavior();
  window.addEventListener("resize", markDeviceMode, {passive:true});
  window.addEventListener("orientationchange", markDeviceMode, {passive:true});

  window.FLOQRActionFeedback = {show, hide, run, markDeviceMode};
})();
