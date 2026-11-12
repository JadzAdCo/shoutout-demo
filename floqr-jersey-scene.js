/* FLOQR jersey scene timing — photoreal jersey pair (7s) + optional ShoutOut (5s).
 * Pure helper from reports/nba-phila-jersey-v1/contracts/sceneAt.ts.
 * Wire to the EXISTING display player's clock / FLOQRFrameLoop; no timers owned here. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.FLOQRJerseyScene = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const JERSEY_MS = 7000;
  const MESSAGE_MS = 5000;
  const TOTAL_WITH_MESSAGE_MS = JERSEY_MS + MESSAGE_MS;

  /** @typedef {"jersey"|"message"|"done"} Phase */

  /**
   * @param {number} elapsedMs
   * @param {boolean} hasMessage
   * @returns {Phase}
   */
  function sceneAt(elapsedMs, hasMessage) {
    if (!Number.isFinite(elapsedMs)) throw new Error("elapsedMs must be finite");
    const t = Math.max(0, elapsedMs);
    if (t < JERSEY_MS) return "jersey";
    if (hasMessage && t < TOTAL_WITH_MESSAGE_MS) return "message";
    return "done";
  }

  function hasMessageText(value) {
    return String(value || "").trim().length > 0;
  }

  function holdMsForPhase(phase, hasMessage) {
    if (phase === "message" && hasMessage) return MESSAGE_MS;
    return JERSEY_MS;
  }

  return {
    JERSEY_MS,
    MESSAGE_MS,
    TOTAL_WITH_MESSAGE_MS,
    sceneAt,
    hasMessageText,
    holdMsForPhase,
    version: "s3.3.001"
  };
});
