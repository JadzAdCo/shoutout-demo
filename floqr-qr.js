/**
 * FLOQR QR helper — wraps qrcodejs (davidshimjs) for door / Passes tokens.
 * API: FLOQRQr.render(hostEl, text, {size})
 */
(function (global) {
  "use strict";

  function render(host, text, opts) {
    const el = typeof host === "string" ? document.querySelector(host) : host;
    if (!el) return null;
    const value = String(text || "").trim();
    el.innerHTML = "";
    el.classList.add("floqr-qr");
    if (!value) {
      el.textContent = "—";
      return null;
    }
    if (typeof global.QRCode !== "function") {
      el.textContent = value;
      return null;
    }
    const size = Math.max(96, Number(opts?.size) || 180);
    try {
      // eslint-disable-next-line no-new
      new global.QRCode(el, {
        text: value,
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: global.QRCode.CorrectLevel?.M || 0
      });
      return el;
    } catch (err) {
      el.textContent = value;
      console.warn("FLOQRQr", err);
      return null;
    }
  }

  global.FLOQRQr = {render};
})(typeof window !== "undefined" ? window : globalThis);
