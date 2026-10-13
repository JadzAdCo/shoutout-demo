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

  /* ---------- Idle CTA ("USE SHOUTOUT @ {club}") — system text, never capped ---------- */

  const IDLE_MAX_ROWS = 5;
  const IDLE_MAX_GLYPHS = 160;
  const IDLE_CHAR_EM = 0.52;
  const IDLE_MEASURE_CANDIDATES = 4;
  /** Vertical budget per idle row in em: board CSS line-height is .8–.84, so glyphs + shadow need more than the line box. */
  const IDLE_LINE_EM = 0.95;
  const IDLE_ENUMERATE_TOKENS = 12;
  const glyphCount = s => [...String(s)].length;

  /** Words of the idle line with "@" glued to the word before it; clubStart = first token after "@" (or -1). */
  function idleTokens(text) {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const tokens = [];
    let clubStart = -1;
    words.forEach(word => {
      if (word === "@" && tokens.length) {
        tokens[tokens.length - 1] = `${tokens[tokens.length - 1]} @`;
        clubStart = tokens.length;
        return;
      }
      tokens.push(word);
    });
    return {tokens, clubStart: clubStart > 0 && clubStart < tokens.length ? clubStart : -1};
  }

  /** Every contiguous split of tokens into ≤ maxRows rows (break indexes = token index that starts a row). */
  function idleSplits(count, maxRows) {
    const out = [];
    const gaps = Math.max(0, count - 1);
    for (let mask = 0; mask < (1 << gaps); mask += 1) {
      const breaks = [];
      for (let i = 0; i < gaps; i += 1) if (mask & (1 << i)) breaks.push(i + 1);
      if (breaks.length + 1 <= maxRows) out.push(breaks);
    }
    return out;
  }

  function rowsFromBreaks(tokens, breaks) {
    const rows = [];
    let start = 0;
    [...breaks, tokens.length].forEach(end => { rows.push(tokens.slice(start, end).join(" ")); start = end; });
    return rows;
  }

  /** Long inputs: min-max greedy packing per row count (optimal longest row, contiguous). */
  function idleGreedyCandidates(tokens, maxRows) {
    const out = [];
    for (let n = 1; n <= Math.min(maxRows, tokens.length); n += 1) {
      const rows = packWordsWithoutSplitting(tokens, n, 1, glyphCount);
      if (!out.some(prev => prev.join("\n") === rows.join("\n"))) out.push(rows);
    }
    return out;
  }

  /** Estimated px a row set reaches inside a safe-area box; only used to choose the split. */
  function estimateIdlePx(rows, boxWidth, boxHeight) {
    const longest = Math.max(1, ...rows.map(glyphCount));
    return Math.min(boxWidth / (longest * IDLE_CHAR_EM), boxHeight / (rows.length * IDLE_LINE_EM));
  }

  /**
   * Rank idle row splits for a safe-area box: every word kept, "@" stays with SHOUTOUT. Score = estimated uniform px ×
   * preference (club name starts its own row, club name split over as few rows as possible); ties → most balanced rows.
   */
  function rankIdleRows(text, boxWidth = 2, boxHeight = 1, options = {}) {
    const maxRows = Math.max(1, Number(options.maxRows) || IDLE_MAX_ROWS);
    const {tokens, clubStart} = idleTokens(text);
    if (!tokens.length) return [{rows: [""], factor: 1, score: 0, spread: 0}];
    const W = boxWidth > 0 ? boxWidth : 2;
    const H = boxHeight > 0 ? boxHeight : 1;
    const candidates = tokens.length <= IDLE_ENUMERATE_TOKENS
      ? idleSplits(tokens.length, maxRows).map(breaks => ({breaks, rows: rowsFromBreaks(tokens, breaks)}))
      : idleGreedyCandidates(tokens, maxRows).map(rows => ({breaks: null, rows}));
    const ranked = candidates.map(({breaks, rows}) => {
      let factor = 1;
      if (breaks && clubStart > 0) {
        if (!breaks.includes(clubStart)) factor *= 0.93;
        factor *= Math.pow(0.96, breaks.filter(b => b > clubStart).length);
      }
      const lengths = rows.map(glyphCount);
      return {rows, factor, score: estimateIdlePx(rows, W, H) * factor, spread: Math.max(...lengths) - Math.min(...lengths)};
    });
    ranked.sort((a, b) => (Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.spread - b.spread));
    return ranked.slice(0, Math.max(1, Number(options.limit) || ranked.length));
  }

  function pickIdleRows(text, boxWidth = 2, boxHeight = 1, options = {}) {
    return rankIdleRows(text, boxWidth, boxHeight, {...options, limit: 1})[0].rows;
  }

  /** Largest single px at which every row (widths measured at refPx) and the stacked height fit the safe area. */
  function uniformFitPx(rowWidthsAtRef, refPx, boxWidth, boxHeight, options = {}) {
    const lineEm = Number(options.lineHeightEm) || IDLE_LINE_EM;
    const minPx = Math.max(1, Number(options.minPx) || 8);
    const availW = boxWidth * (1 - 2 * (options.safeX ?? SAFE_X));
    const availH = boxHeight * (1 - 2 * (options.safeY ?? SAFE_Y));
    const widths = (rowWidthsAtRef || []).map(Number).filter(w => w > 0);
    const widest = widths.length ? Math.max(...widths) : 0;
    const byWidth = widest > 0 ? (availW * refPx) / widest : Infinity;
    const byHeight = availH / (Math.max(1, (rowWidthsAtRef || []).length) * lineEm);
    const px = Math.floor(Math.min(byWidth, byHeight));
    return Number.isFinite(px) ? Math.max(minPx, px) : minPx;
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

  function setIdleRows(host, rows) {
    const doc = host.ownerDocument || global.document;
    while (host.firstChild) host.removeChild(host.firstChild);
    rows.forEach(text => {
      const row = doc.createElement("b");
      const run = doc.createElement("span");
      run.className = "board-fit-run";
      run.textContent = text;
      row.appendChild(run);
      host.appendChild(row);
    });
    host.className = String(host.className || "").replace(/\bclassic-board-lines-\d+\b/g, "").trim() + ` classic-board-lines-${rows.length}`;
    host.style.setProperty("--board-lines", String(rows.length));
    host.setAttribute("data-line-count", String(rows.length));
    host.parentElement?.style?.setProperty("--board-lines", String(rows.length));
  }

  const IDLE_REF_PX = 100;

  const showIdleRows = (host, rows) => {
    const current = Array.from(host.children).map(row => row.textContent);
    if (current.join("\n") !== rows.join("\n")) setIdleRows(host, rows);
    return Array.from(host.children);
  };
  const applyPx = (els, px) => els.forEach(row => row.style.setProperty("font-size", `${px}px`, "important"));

  /** Uniform px for the rows currently in the host, from real run widths at a reference size. */
  function measuredIdlePx(host, boxW, boxH) {
    const els = Array.from(host.children);
    applyPx(els, IDLE_REF_PX);
    const runs = els.map(measureRun);
    if (!runs.length || runs.some(run => !run)) return 0;
    const lineEm = Math.max(IDLE_LINE_EM, ...runs.map(run => run.height / IDLE_REF_PX));
    return uniformFitPx(runs.map(run => run.width), IDLE_REF_PX, boxW, boxH, {lineHeightEm: lineEm, safeX: 0, safeY: 0});
  }

  /**
   * Idle CTA: measure the best-ranked row splits in the real box, keep the one with the largest uniform size, then give
   * every row that one size. The idle host is inset to the safe area by display.css, so no extra margin is applied here.
   */
  function fitIdleHost(host) {
    const boxW = host.clientWidth;
    const boxH = host.clientHeight;
    if (!boxW || !boxH) return 0;
    const text = host.getAttribute("data-idle-text") || "";
    let best = null;
    rankIdleRows(text, boxW, boxH, {limit: IDLE_MEASURE_CANDIDATES}).forEach(candidate => {
      showIdleRows(host, candidate.rows);
      const px = measuredIdlePx(host, boxW, boxH);
      if (px && (!best || px * candidate.factor > best.score)) best = {rows: candidate.rows, px, score: px * candidate.factor};
    });
    if (!best) return 0;
    const els = showIdleRows(host, best.rows);
    let px = best.px;
    const cellH = boxH / els.length;
    const fits = () => els.every(row => {
      const run = measureRun(row);
      return run && run.width <= boxW + 0.5 && Math.max(run.height, px * IDLE_LINE_EM) <= cellH + 0.5;
    });
    applyPx(els, px);
    for (let pass = 0; pass < 40 && px > 8 && !fits(); pass += 1) applyPx(els, --px);
    host.setAttribute("data-idle-fit-px", String(px));
    return px;
  }

  function fitBoard(scope) {
    if (!scope || !global.getComputedStyle) return;
    scope.querySelectorAll(".classic-board-lines[data-idle-fit]").forEach(fitIdleHost);
    fitRows(Array.from(scope.querySelectorAll(".classic-board-lines:not([data-idle-fit]) > b, .text-overlay-lines > b")));
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
    IDLE_MAX_ROWS, IDLE_MAX_GLYPHS, IDLE_LINE_EM, idleTokens, rankIdleRows, pickIdleRows, uniformFitPx, fitIdleHost,
    fitBoard, fitIdentity, scheduleFit, rowHtml
  };
  global.FLOQRBoardFit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
