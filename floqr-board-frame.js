/* FLOQR board frame — preview iframes render display.html at the board's native pixel size, then scale to fit.
 * Design notes: .cursor/rules/design-notes-board-fit.mdc
 */
(function (global) {
  "use strict";

  const DEFAULT_FORMAT = "led-96x48";
  const FALLBACK_SIZES = {
    "led-96x48": {width: 624, height: 312},
    "led-64x48": {width: 416, height: 312},
    "led-64x32": {width: 416, height: 208}
  };

  function canonicalId(formatId = "") {
    const raw = String(formatId || "").trim();
    return global.FLOQRScreenDatapoints?.canonicalFormatId?.(raw) || raw.replace(/^p125-/, "led-") || DEFAULT_FORMAT;
  }

  /** Native pixel size of a board (shared-data.js FLOQR_DISPLAY_FORMATS wins). */
  function sizeOf(formatId = "") {
    const id = canonicalId(formatId);
    const fmt = (global.FLOQR_DISPLAY_FORMATS || {})[id];
    if (fmt && Number(fmt.pixelWidth) > 0 && Number(fmt.pixelHeight) > 0) {
      return {formatId: id, width: Number(fmt.pixelWidth), height: Number(fmt.pixelHeight)};
    }
    const fallback = FALLBACK_SIZES[id] || FALLBACK_SIZES[DEFAULT_FORMAT];
    return {formatId: FALLBACK_SIZES[id] ? id : DEFAULT_FORMAT, ...fallback};
  }

  /** Uniform scale that fits a board inside the host, centered. */
  function scaleFor(hostWidth, hostHeight, boardWidth, boardHeight) {
    if (!(hostWidth > 0) || !(boardWidth > 0) || !(boardHeight > 0)) return {scale: 0, offsetX: 0, offsetY: 0};
    const byWidth = hostWidth / boardWidth;
    const scale = hostHeight > 0 ? Math.min(byWidth, hostHeight / boardHeight) : byWidth;
    return {
      scale,
      offsetX: Math.max(0, (hostWidth - boardWidth * scale) / 2),
      offsetY: hostHeight > 0 ? Math.max(0, (hostHeight - boardHeight * scale) / 2) : 0
    };
  }

  const hosts = new WeakMap();
  let observer = null;

  function layout(host) {
    const state = hosts.get(host);
    if (!state) return;
    const {iframe, width, height} = state;
    const fit = scaleFor(host.clientWidth, host.clientHeight, width, height);
    if (!fit.scale) return;
    iframe.style.setProperty("transform", `translate(${fit.offsetX}px, ${fit.offsetY}px) scale(${fit.scale})`, "important");
  }

  function ensureHost(iframe) {
    const parent = iframe.parentElement;
    if (parent && parent.classList.contains("floqr-board-frame")) return parent;
    const host = global.document.createElement("div");
    host.className = "floqr-board-frame";
    parent.insertBefore(host, iframe);
    host.appendChild(iframe);
    return host;
  }

  /**
   * Make `iframe` a native-size board preview for `formatId`.
   * options.maxHeight: CSS length capping the preview height (default "min(72vh, 620px)").
   */
  function mount(iframe, formatId, options = {}) {
    if (!iframe || !iframe.parentElement || !global.document) return null;
    const size = sizeOf(formatId);
    const host = ensureHost(iframe);
    const maxHeight = options.maxHeight || "min(72vh, 620px)";
    host.dataset.boardFormat = size.formatId;
    host.style.aspectRatio = `${size.width} / ${size.height}`;
    host.style.maxWidth = `calc(${maxHeight} * ${size.width} / ${size.height})`;
    [
      ["position", "absolute"], ["left", "0"], ["top", "0"],
      ["width", `${size.width}px`], ["height", `${size.height}px`],
      ["max-width", "none"], ["aspect-ratio", "auto"], ["border", "0"], ["border-radius", "0"],
      ["transform-origin", "0 0"]
    ].forEach(([prop, value]) => iframe.style.setProperty(prop, value, "important"));
    hosts.set(host, {iframe, width: size.width, height: size.height});
    layout(host);
    if (global.ResizeObserver) {
      observer = observer || new global.ResizeObserver(entries => entries.forEach(entry => layout(entry.target)));
      observer.observe(host);
    } else {
      global.addEventListener?.("resize", () => layout(host));
    }
    return {host, ...size};
  }

  const api = {sizeOf, scaleFor, mount};
  global.FLOQRBoardFrame = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
