/**
 * display-error-app.js
 * Xibo / player fallback when display.html or display2.html fails to load.
 * Reports via public callable reportDisplayLoadError → diagnostic appLogs (30-day).
 * Not a security deny page (that remains on the main display gate).
 */
(function () {
  "use strict";

  function qs(name, fallback = "") {
    try {
      return new URLSearchParams(location.search).get(name) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function text(value, max = 200) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function boardLabel(board) {
    const b = String(board || "").toLowerCase();
    if (b === "2" || b === "secondary" || b === "display2" || b === "suprstar") return "Display 2 (supRstar)";
    if (b === "1" || b === "primary" || b === "display" || b === "shoutout") return "Display 1 (ShoutOut)";
    return board ? `Board ${board}` : "Display";
  }

  async function reportViaCallable(payload) {
    if (!window.firebase || !window.firebaseConfig) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
      const fn = firebase.app().functions("us-central1").httpsCallable("reportDisplayLoadError");
      await fn(payload);
      return true;
    } catch (err) {
      console.warn("[display-error] reportDisplayLoadError failed", err?.message || err);
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const locationId = text(qs("location", qs("club", "")), 120).toLowerCase();
    const board = text(qs("board", qs("displayBoard", "")), 40);
    const reason = text(qs("reason", qs("error", "xibo_page_load_error")), 120);
    const fromUrl = text(qs("from", qs("src", "")), 500);
    const code = text(qs("code", qs("status", "")), 40);

    const main = byId("displayMain");
    const sub = byId("displaySub");
    const brand = byId("displayBrand");
    if (brand) brand.textContent = "Floq Media / FloqR";
    if (main) {
      main.textContent = code && /^\d{3}$/.test(code)
        ? `Display load error ${code}`
        : "Display page failed to load";
    }
    if (sub) {
      sub.textContent = [
        boardLabel(board),
        locationId ? `@ ${locationId}` : "",
        "· Xibo load-error fallback",
        reason ? `· ${reason}` : "",
        "· Logged to FloqR Diagnostics (30-day retention)"
      ].filter(Boolean).join(" ");
    }

    document.title = locationId
      ? `FLOQR Display Error · ${locationId}`
      : "FLOQR Display · Load Error";

    await reportViaCallable({
      message: `Xibo/display load-error fallback shown${locationId ? ` for ${locationId}` : ""}.`,
      locationId,
      displayBoard: board || "unknown",
      board: board || "unknown",
      reason: reason || "xibo_page_load_error",
      httpCode: code || "",
      code: code || "",
      fromUrl,
      pageUrl: String(location.href || "").slice(0, 500),
      userAgent: String(navigator.userAgent || "").slice(0, 300),
      platform: String(navigator.platform || "").slice(0, 120),
      reportedAtMs: Date.now(),
      appVersion: "29.09.90"
    });
  });
})();
