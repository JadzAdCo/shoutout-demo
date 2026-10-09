/* One-time code attempt decision. Pure so the lockout can be unit tested.
   Callers record the verdict inside their Firestore transaction, let it commit,
   and throw only after — a throw inside the transaction rolls back the attempt count. */
"use strict";

const crypto = require("crypto");

function hashesMatch(stored, provided) {
  const a = Buffer.from(String(stored || ""));
  const b = Buffer.from(String(provided || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * outcome: "ok" | "wrong" | "locked" | "expired" | "consumed"
 * nextAttempts: attempt count to store (only changes on "wrong")
 * lock: true when this wrong attempt reached maxAttempts
 */
function evaluateOtpAttempt({
  storedHash = "",
  providedHash = "",
  attempts = 0,
  maxAttempts = 5,
  expiresAtMs = 0,
  nowMs = Date.now(),
  consumed = false,
  locked = false
} = {}) {
  const used = Math.max(0, Number(attempts) || 0);
  const max = Math.max(1, Number(maxAttempts) || 1);
  if (consumed === true || !storedHash) return {outcome: "consumed", nextAttempts: used, lock: false};
  if ((Number(expiresAtMs) || 0) < nowMs) return {outcome: "expired", nextAttempts: used, lock: false};
  if (locked === true || used >= max) return {outcome: "locked", nextAttempts: used, lock: true};
  if (!hashesMatch(storedHash, providedHash)) {
    const nextAttempts = used + 1;
    return {outcome: "wrong", nextAttempts, lock: nextAttempts >= max};
  }
  return {outcome: "ok", nextAttempts: used, lock: false};
}

module.exports = {evaluateOtpAttempt, hashesMatch};
