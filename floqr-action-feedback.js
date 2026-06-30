/* FLOQR action feedback overlay v28.82: reusable progress/success flash for user actions. */
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
    overlay.innerHTML = `<div class="floqr-action-feedback-card">
      <strong id="floqrActionFeedbackTitle">Working...</strong>
      <p id="floqrActionFeedbackBody">Please wait.</p>
    </div>`;
    document.body.appendChild(overlay);
    return overlay;
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

  async function run(messages = {}, action) {
    const returnTo = messages.returnTo || messages.page || "the previous page";
    show(messages.starting || "Working...", messages.wait || "Please wait a few seconds.");
    try {
      const result = await action();
      show(messages.success || "Action succeeded", messages.redirecting || `Success. Returning to ${returnTo}.`, {status:"success"});
      hide(Number(messages.hideAfterMs || 1300));
      return result;
    } catch (error) {
      show(messages.failed || "Action failed", error?.message || String(error), {status:"failed"});
      hide(Number(messages.failHideAfterMs || 3500));
      throw error;
    }
  }

  window.FLOQRActionFeedback = {show, hide, run};
})();
