/* BOT DEE durable execution — leases, checkpoints, idempotency receipts.
   Independent of the 300s UI idle timer. No LangChain / Redis / SQL. */
"use strict";

const crypto = require("crypto");

const STATES = Object.freeze([
  "pending",
  "awaiting_approval",
  "executing",
  "succeeded",
  "failed",
  "cancelled"
]);

const CONSEQUENTIAL_TOOLS = Object.freeze([
  "startShoutOutCheckout",
  "createVipHold",
  "recordVipConsent",
  "createVipCheckout",
  "createFloqCastRequest",
  "createFloqCastCheckout"
]);

const DEFAULT_LEASE_MS = 90 * 1000;
const DEFAULT_WORKFLOW_TTL_MS = 30 * 60 * 1000;

function stableIdempotencyKey(parts) {
  const raw = JSON.stringify(parts || {});
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function executionIdFor(ownerUid, idempotencyKey) {
  const uid = String(ownerUid || "").trim();
  const key = String(idempotencyKey || "").trim();
  if (!uid || !key) return "";
  return `ex_${uid.slice(0, 12)}_${key.slice(0, 20)}`;
}

function normalizeState(raw) {
  const state = String(raw || "pending").trim();
  return STATES.includes(state) ? state : "pending";
}

function isConsequentialTool(name) {
  return CONSEQUENTIAL_TOOLS.includes(String(name || ""));
}

function newLease(ownerUid, threadId, nowMs, leaseMs) {
  const now = Number(nowMs) || Date.now();
  const ttl = Number(leaseMs) > 0 ? Number(leaseMs) : DEFAULT_LEASE_MS;
  return {
    ownerUid: String(ownerUid || "").trim(),
    threadId: String(threadId || ownerUid || "").trim(),
    lastActivityAt: now,
    expiresAt: now + ttl,
    status: "active"
  };
}

function leaseExpired(lease, nowMs) {
  const now = Number(nowMs) || Date.now();
  const expires = Number(lease?.expiresAt) || 0;
  if (!expires) return false;
  return now >= expires;
}

function checkpointDoc({
  ownerUid,
  threadId,
  toolName,
  args,
  state,
  nowMs,
  idempotencyKey,
  result,
  approvalRequired
}) {
  const now = Number(nowMs) || Date.now();
  const key = idempotencyKey || stableIdempotencyKey({
    ownerUid,
    toolName,
    args
  });
  const needsApproval = approvalRequired == null
    ? isConsequentialTool(toolName)
    : !!approvalRequired;
  return {
    schemaVersion: 1,
    executionId: executionIdFor(ownerUid, key),
    ownerUid: String(ownerUid || "").trim(),
    threadId: String(threadId || ownerUid || "").trim(),
    toolName: String(toolName || "").trim(),
    idempotencyKey: key,
    state: normalizeState(state || (needsApproval ? "awaiting_approval" : "pending")),
    approvalState: needsApproval ? "required" : "not_required",
    argsHash: crypto.createHash("sha256").update(JSON.stringify(args || {})).digest("hex").slice(0, 24),
    resultCode: result && result.ok === false ? "error" : (result ? "ok" : ""),
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs: now + DEFAULT_WORKFLOW_TTL_MS
  };
}

function applyReceipt(existing, nextState, result, nowMs) {
  const now = Number(nowMs) || Date.now();
  const prev = existing && typeof existing === "object" ? existing : {};
  const prevState = normalizeState(prev.state);
  if (prevState === "succeeded" || prevState === "cancelled") {
    return {
      ...prev,
      reused: true,
      updatedAtMs: now,
      duplicate: true
    };
  }
  const optimistic = Math.max(0, Math.floor(Number(prev.revision) || 0));
  return {
    ...prev,
    state: normalizeState(nextState),
    revision: optimistic + 1,
    resultCode: result && result.ok === false ? "error" : "ok",
    updatedAtMs: now,
    reused: false,
    duplicate: false
  };
}

function contextBudget({maxTurns, summaryTokens, memoryCount, toolReserve}) {
  const turns = Math.max(1, Math.min(24, Number(maxTurns) || 12));
  return {
    maxTurns: turns,
    summaryTokens: Math.max(0, Math.floor(Number(summaryTokens) || 800)),
    memoryCount: Math.max(0, Math.min(20, Number(memoryCount) || 8)),
    toolReserve: Math.max(0, Math.floor(Number(toolReserve) || 4)),
    note: "Bounded reconstruction. Not server RAM and not an assumed 1M-token window."
  };
}

function buildModelContext({turns, summary, memories, budget}) {
  const cap = contextBudget(budget);
  const recent = Array.isArray(turns) ? turns.slice(-cap.maxTurns) : [];
  const mems = Array.isArray(memories) ? memories.slice(0, cap.memoryCount) : [];
  const summaryText = String(summary || "").trim().slice(0, cap.summaryTokens * 4);
  return {
    recentTurns: recent,
    summary: summaryText,
    memories: mems,
    budget: cap
  };
}

module.exports = {
  STATES,
  CONSEQUENTIAL_TOOLS,
  DEFAULT_LEASE_MS,
  DEFAULT_WORKFLOW_TTL_MS,
  stableIdempotencyKey,
  executionIdFor,
  normalizeState,
  isConsequentialTool,
  newLease,
  leaseExpired,
  checkpointDoc,
  applyReceipt,
  contextBudget,
  buildModelContext
};
