/* FLOQR board fit — venue size merge, live-content gate, safe-margin text fit.
 * Design notes: .cursor/rules/design-notes-board-fit.mdc
 */
(function (global) {
  "use strict";

  const SAFE_X = 0.04;
  const SAFE_Y = 0.06;
  const MIN_SCALE = 0.3;
  const DEFAULT_LIVE_SECONDS = 600;
  const LIVE_STATUSES = ["approved", "live"];
  const VENUE_SIZE_KEYS = ["VenueSupports96x48", "VenueSupports64x48", "VenueSupports64x32"];

  const firstText = (...values) => {
    for (const value of values) {
      const text = String(value == null ? "" : value).trim();
      if (text) return text;
    }
    return "";
  };
  const isExplicit01 = value => value === 0 || value === 1 || value === "0" || value === "1";
  const idList = value => (Array.isArray(value) ? value.map(String).map(s => s.trim()).filter(Boolean) : []);

  /** Firestore (Club Admin) wins field by field; packaged catalog only fills gaps. */
  function mergeVenueForDisplay(packaged = {}, live = {}) {
    const merged = {...packaged, ...live};
    merged.primaryDisplayScreenFormatId = firstText(
      live.primaryDisplayScreenFormatId, live.displayType, live.screenFormatId,
      packaged.primaryDisplayScreenFormatId, packaged.displayType, packaged.screenFormatId
    );
    merged.secondaryDisplayScreenFormatId = firstText(
      live.secondaryDisplayScreenFormatId, packaged.secondaryDisplayScreenFormatId, merged.primaryDisplayScreenFormatId
    );
    const liveIds = idList(live.displayScreenFormatIds);
    merged.displayScreenFormatIds = liveIds.length ? liveIds : idList(packaged.displayScreenFormatIds);
    VENUE_SIZE_KEYS.forEach(key => {
      if (isExplicit01(live[key])) merged[key] = Number(live[key]);
      else if (isExplicit01(packaged[key])) merged[key] = Number(packaged[key]);
      else delete merged[key];
    });
    return merged;
  }

  /** Which display size is actually in effect, and where it came from. */
  function effectiveBoardSize(packaged = {}, live = {}, board = "primary") {
    const key = board === "secondary" ? "secondaryDisplayScreenFormatId" : "primaryDisplayScreenFormatId";
    const merged = mergeVenueForDisplay(packaged, live);
    const fromLive = board === "secondary"
      ? firstText(live.secondaryDisplayScreenFormatId)
      : firstText(live.primaryDisplayScreenFormatId, live.displayType, live.screenFormatId);
    return {formatId: merged[key], source: fromLive ? "firestore" : (merged[key] ? "packaged" : "default")};
  }

  const hasMessage = data => !!(String(data?.mainText || "").trim() || data?.mediaUrl);

  /** "live" = render a ShoutOut, "idle" = show the club idle board. Anything not approved/live is never rendered. */
  function liveContentDecision(data) {
    if (!data || typeof data !== "object") return "idle";
    const status = String(data.status || "").trim().toLowerCase();
    if (LIVE_STATUSES.includes(status) && hasMessage(data)) return "live";
    return "idle";
  }

  const toMillis = value => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /** End time for an approved ShoutOut; falls back to first-seen + duration when the doc has no timing. */
  function liveExpiryMillis(data = {}, firstSeenMs = 0, defaultSeconds = DEFAULT_LIVE_SECONDS) {
    const explicit = toMillis(data.expiresAt) || toMillis(data.liveUntil) || toMillis(data.playedUntil);
    if (explicit) return {expiresMs: explicit, source: "explicit"};
    const seconds = Math.max(1, Number(data.displayDurationSeconds || defaultSeconds));
    const startedMs = toMillis(data.approvedAt);
    if (startedMs) return {expiresMs: startedMs + seconds * 1000, source: "approvedAt"};
    const writtenMs = toMillis(data.updatedAt) || toMillis(data.createdAt);
    if (writtenMs) return {expiresMs: writtenMs + seconds * 1000, source: "updatedAt"};
    return {expiresMs: (firstSeenMs || Date.now()) + seconds * 1000, source: "firstSeen"};
  }

  /** Pack whole words into maxRows; the soft per-line budget grows instead of splitting a word. */
  function packWordsWithoutSplitting(words, maxRows, softMaxChars, lengthOf = s => [...String(s)].length) {
    const list = (words || []).map(String).filter(Boolean);
    const rows = Math.max(1, Number(maxRows) || 1);
    if (!list.length) return [""];
    const longest = Math.max(...list.map(lengthOf));
    let budget = Math.max(1, Number(softMaxChars) || 16, longest);
    for (;;) {
      const out = [];
      let line = "";
      list.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (lengthOf(next) <= budget) line = next;
        else { out.push(line); line = word; }
      });
      if (line) out.push(line);
      if (out.length <= rows) return out;
      budget += 1;
    }
  }

  /** Scale (≤ 1) that brings a run of size w×h inside a box of W×H minus the safe margin. */
  function shrinkFactor(runWidth, runHeight, boxWidth, boxHeight, safeX = SAFE_X, safeY = SAFE_Y) {
    const availW = boxWidth * (1 - 2 * safeX);
    const availH = boxHeight * (1 - 2 * safeY);
    let factor = 1;
    if (runWidth > 0 && availW > 0 && runWidth > availW) factor = Math.min(factor, availW / runWidth);
    if (runHeight > 0 && availH > 0 && runHeight > availH) factor = Math.min(factor, availH / runHeight);
    return Math.max(MIN_SCALE, factor);
  }

  /* ---------- DOM fitting (browser only) ---------- */

  function measureRun(row) {
    const run = row.querySelector(":scope > .board-fit-run");
    return run ? {width: run.offsetWidth, height: run.offsetHeight} : null;
  }

  /** Keeps the designed size; only rows that would clip shrink until they sit inside the safe margin. */
  function fitRows(rows) {
    rows.forEach(row => {
      row.style.removeProperty("font-size");
      const size = measureRun(row);
      if (!size || !row.clientWidth) return;
      const base = parseFloat(global.getComputedStyle(row).fontSize) || 0;
      if (!base) return;
      let factor = shrinkFactor(size.width, size.height, row.clientWidth, row.clientHeight);
      if (factor >= 1) return;
      for (let pass = 0; pass < 3 && factor < 1; pass += 1) {
        const next = Math.max(base * MIN_SCALE, Math.floor(base * factor * 0.99));
        row.style.setProperty("font-size", `${next}px`, "important");
        const after = measureRun(row);
        if (!after) return;
        const extra = shrinkFactor(after.width, after.height, row.clientWidth, row.clientHeight);
        if (extra >= 1) return;
        factor *= extra;
      }
    });
  }

  /** Attribution pill: shrink the value instead of ellipsis-truncating it. */
  function fitIdentity(scope) {
    scope.querySelectorAll(".classic-identity-shell strong").forEach(strong => {
      strong.style.removeProperty("font-size");
      strong.style.removeProperty("text-overflow");
      if (!strong.clientWidth || strong.scrollWidth <= strong.clientWidth + 1) return;
      const base = parseFloat(global.getComputedStyle(strong).fontSize) || 0;
      if (!base) return;
      let size = base;
      for (let pass = 0; pass < 3 && strong.scrollWidth > strong.clientWidth + 1; pass += 1) {
        const factor = strong.clientWidth / strong.scrollWidth;
        size = Math.max(base * MIN_SCALE, Math.floor(size * factor * 0.98));
        strong.style.setProperty("font-size", `${size}px`, "important");
        strong.style.setProperty("text-overflow", "clip", "important");
      }
    });
  }

  function fitBoard(scope) {
    if (!scope || !global.getComputedStyle) return;
    fitRows(Array.from(scope.querySelectorAll(".classic-board-lines > b, .text-overlay-lines > b")));
    fitIdentity(scope);
  }

  let observer = null;
  const observed = new Set();
  /** Fit now, after layout settles, after fonts load, and whenever the board resizes. */
  function scheduleFit(scope) {
    if (!scope) return;
    const run = () => fitBoard(scope);
    run();
    if (global.requestAnimationFrame) global.requestAnimationFrame(() => { run(); global.requestAnimationFrame(run); });
    global.document?.fonts?.ready?.then(run).catch(() => {});
    if (global.ResizeObserver && !observed.has(scope)) {
      observer = observer || new global.ResizeObserver(entries => entries.forEach(entry => fitBoard(entry.target)));
      observer.observe(scope);
      observed.add(scope);
    }
  }

  /** Wrap row text so its natural width can be measured inside a full-width row. */
  function rowHtml(text, style, escape) {
    return `<b style="${style}"><span class="board-fit-run">${escape(text)}</span></b>`;
  }

  const api = {
    SAFE_X, SAFE_Y, MIN_SCALE, DEFAULT_LIVE_SECONDS,
    mergeVenueForDisplay, effectiveBoardSize,
    liveContentDecision, liveExpiryMillis,
    packWordsWithoutSplitting, shrinkFactor,
    fitBoard, scheduleFit, rowHtml
  };
  global.FLOQRBoardFit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
