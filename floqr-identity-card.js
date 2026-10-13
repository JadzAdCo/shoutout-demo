/* FLOQR identity card — the FloqR pill on every board: PRESENTED BY FloqMedia, then FROM @handle when the patron opted in.
 * Design notes: .cursor/rules/design-notes-identity-card.mdc */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.FLOQRIdentityCard = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const g = root || (typeof globalThis !== "undefined" ? globalThis : {});
  const BRAND = "FloqMedia";
  const KICKER_BRAND = "PRESENTED BY";
  const KICKER_FROM = "FROM";
  const CHANNEL = "identity-card";
  const MAX_GLYPHS = 22;
  const PARTICLES = 12;
  const MAX_PHASES = 6;
  const DEFAULT_PHASES = Object.freeze(["brand", "handle"]);
  const CELEBRATION = /^(CELEBRATE BIG|LOVE ALL NIGHT|FOREVER STARTS TONIGHT|SHE SAID YES)$/i;
  const HANDLE_CHOICES = {instagram: "instagram", floqrHandle: "mingl", username: "mingl", mingl: "mingl"};
  const NAME_CHOICES = ["displayName", "manual", "name"];
  const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  const PHONE_CHARS = /^\+?[\d\s().-]+$/;
  const HANDLE_TOKEN = /^[A-Z0-9._]{2,30}$/;

  function holdMs() {
    return Number(g.FLOQRFrameLoop?.HOLD_MS) || 6000;
  }

  function glyphs(value) {
    const text = String(value || "");
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(text), part => part.segment);
    }
    return Array.from(text);
  }

  function clean(value) {
    return String(value || "")
      .normalize("NFC")
      .toUpperCase()
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isTruthy(value) {
    return value === true || value === 1 || value === "1" || String(value || "").toLowerCase() === "true";
  }

  function localEscape(value) {
    return String(value ?? "").replace(/[&<>"'`]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;"}[ch]));
  }

  function escaper(custom) {
    if (typeof custom === "function") return custom;
    return g.FLOQRSafeRender?.escapeHtml || localEscape;
  }

  /** Email addresses and phone numbers never reach the board. */
  function looksPrivate(value) {
    const text = String(value || "").trim();
    if (EMAIL.test(text)) return true;
    return text.replace(/\D/g, "").length >= 7 && PHONE_CHARS.test(text);
  }

  function kindOf(choice) {
    const key = String(choice || "").trim();
    if (HANDLE_CHOICES[key]) return HANDLE_CHOICES[key];
    if (NAME_CHOICES.includes(key)) return "name";
    return "auto";
  }

  /** Instagram / Mingl → @handle; an entered display name is shown as typed (uppercased like the rest of the board). */
  function formatValue(raw, kind, maxGlyphs = MAX_GLYPHS) {
    const text = clean(raw);
    const bare = text.replace(/^@+/, "").trim();
    if (!bare) return "";
    const asHandle = kind === "instagram" || kind === "mingl"
      || (kind === "auto" && (text.startsWith("@") || HANDLE_TOKEN.test(bare)));
    const value = asHandle ? `@${bare.replace(/\s+/g, "")}` : bare;
    return glyphs(value).slice(0, Math.max(1, Number(maxGlyphs) || MAX_GLYPHS)).join("");
  }

  /**
   * Who the card credits, or null. Opt-in only:
   * 1. attributionChoice "none" → nobody.
   * 2. includeAttribution (true / "1") or a non-empty attribution → attribution, the handle the composer resolved for the
   *    patron's "Show as" choice (Instagram, FloqR / Mingl handle, or display name).
   * 3. Legacy payloads with no attribution fields at all (composed before s3.1.41) → subText, only where the caller says
   *    that template already used subText as its card (Heist / text overlay, split media), never a template default line.
   */
  function resolveHandle(data = {}, options = {}) {
    const choice = String(data.attributionChoice || "").trim();
    if (choice === "none") return null;
    const attribution = String(data.attribution || "").trim();
    const optedIn = isTruthy(data.includeAttribution) || !!attribution;
    let value = optedIn ? attribution : "";
    let source = "attribution";
    if (!value && options.legacySubText && !attribution && !choice && !isTruthy(data.includeAttribution)) {
      const sub = String(data.subText || "").trim();
      const defaultSub = String(options.defaultSub || "").trim();
      if (sub && !CELEBRATION.test(sub) && clean(sub) !== clean(defaultSub)) {
        value = sub;
        source = "legacySubText";
      }
    }
    if (!value || looksPrivate(value)) return null;
    const kind = source === "legacySubText" ? "auto" : kindOf(choice);
    const display = formatValue(value, kind, options.maxGlyphs);
    return display ? {value: display, kind, source} : null;
  }

  function brandPhase() {
    return {kind: "brand", kicker: KICKER_BRAND, value: clean(BRAND)};
  }

  /**
   * Template phase list (`identityPhases` on the template config): "brand", "handle", or a fixed line
   * {kicker, value}. Anything else falls back to the default ["brand", "handle"].
   */
  function normalizePhaseSpec(spec) {
    if (!Array.isArray(spec)) return DEFAULT_PHASES.slice();
    const out = [];
    for (const entry of spec.slice(0, MAX_PHASES)) {
      if (entry === "brand" || entry === "handle") out.push(entry);
      else if (entry && typeof entry === "object") {
        const kicker = glyphs(clean(entry.kicker)).slice(0, MAX_GLYPHS).join("");
        const value = glyphs(clean(entry.value)).slice(0, MAX_GLYPHS).join("");
        if (value) out.push({kicker, value});
      }
    }
    return out.some(entry => entry !== "handle") ? out : DEFAULT_PHASES.slice();
  }

  /**
   * Phases in template order. The handle phase appears only when the patron opted in and the handle resolves;
   * idle boards never credit a patron. Default template: brand only, or brand then handle.
   */
  function phases(data = {}, options = {}) {
    const handle = options.idle ? null : resolveHandle(data, options);
    const list = [];
    for (const entry of normalizePhaseSpec(options.identityPhases)) {
      if (entry === "brand") list.push(brandPhase());
      else if (entry === "handle") {
        if (handle) list.push({kind: "handle", kicker: KICKER_FROM, value: handle.value, handleKind: handle.kind});
      } else list.push({kind: "tagline", kicker: entry.kicker, value: entry.value});
    }
    return list.length ? list : [brandPhase()];
  }

  function phaseAt(list, elapsedMs, hold = holdMs()) {
    const count = Math.max(1, Array.isArray(list) ? list.length : 1);
    const step = Number(hold) > 0 ? Number(hold) : holdMs();
    return Math.floor(Math.max(0, Number(elapsedMs) || 0) / step) % count;
  }

  function shellHtml(phase, options = {}) {
    const esc = escaper(options.escape);
    const shellClass = ["classic-identity-shell", options.shellClass].filter(Boolean).join(" ");
    return `<span class="${esc(shellClass)}"><small>${esc(phase.kicker)}</small><strong>${esc(phase.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(PARTICLES)}</span>`;
  }

  function paint(host, phase, options = {}) {
    host.classList.toggle("has-attribution", phase.kind === "handle");
    host.classList.toggle("uses-brand-fallback", phase.kind !== "handle");
    host.setAttribute("data-identity-phase", phase.kind);
    host.setAttribute("aria-label", `${phase.kicker} ${phase.value}`);
    host.setAttribute("aria-hidden", "false");
    host.innerHTML = shellHtml(phase, options);
    g.FLOQRBoardFit?.fitIdentity?.(host);
  }

  function stop() {
    g.FLOQRFrameLoop?.stopCycle?.(CHANNEL);
  }

  /**
   * Paint the card into `host` and loop it on FLOQRFrameLoop (6s per phase).
   * options: data, idle, identityPhases, legacySubText, defaultSub, hostClass, shellClass, escape, holdMs.
   */
  function mount(host, options = {}) {
    stop();
    if (!host) return null;
    const list = phases(options.data || {}, options);
    String(options.hostClass || "").split(/\s+/).filter(Boolean).forEach(name => host.classList.add(name));
    host.classList.add("floqr-identity-card");
    host.classList.remove("hidden", "classic-bw-sub-hidden");
    host.setAttribute("data-identity-phases", String(list.length));
    const loop = g.FLOQRFrameLoop;
    if (list.length > 1 && typeof loop?.cycle === "function") {
      loop.cycle(CHANNEL, {count: list.length, holdMs: options.holdMs, onAdvance: index => paint(host, list[index], options)});
    } else {
      paint(host, list[0], options);
    }
    return {phases: list};
  }

  return {
    BRAND,
    KICKER_BRAND,
    KICKER_FROM,
    CHANNEL,
    MAX_GLYPHS,
    DEFAULT_PHASES,
    holdMs,
    normalizePhaseSpec,
    looksPrivate,
    formatValue,
    resolveHandle,
    phases,
    phaseAt,
    shellHtml,
    mount,
    stop
  };
});
