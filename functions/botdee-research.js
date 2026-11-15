/* BOT DEE research adapters — MOCK ONLY until Master Admin legal evidence.
   Do not scrape Google AI Mode. Relevance votes are not consent or identity proof.
   Person enrichment is not a global cache. */
"use strict";

const {PROVIDER_GATES} = require("./botdee-upgrade-manifest");

const GATE_STATUSES = Object.freeze(["unknown", "blocked", "approved", "revoked"]);
const FEEDBACK = Object.freeze(["relevant", "not_relevant", "incorrect_match"]);

function normalizeGate(row) {
  const base = PROVIDER_GATES.find(p => p.id === row?.id) || {
    id: String(row?.id || "unknown"),
    label: String(row?.label || "Unknown provider"),
    intended: "",
    status: "blocked",
    mode: "mock_only"
  };
  const status = GATE_STATUSES.includes(row?.status) ? row.status : (base.status || "blocked");
  const approved = status === "approved" && row?.evidenceRecorded === true;
  return {
    ...base,
    ...row,
    id: base.id,
    status: approved ? "approved" : (status === "approved" ? "blocked" : status),
    mode: approved ? "live_allowed" : "mock_only",
    evidenceRecorded: !!row?.evidenceRecorded,
    askedMasterAdmin: true
  };
}

function gateMatrix(overrides) {
  const map = overrides && typeof overrides === "object" ? overrides : {};
  return PROVIDER_GATES.map(row => normalizeGate({...row, ...(map[row.id] || {})}));
}

function mayCallProvider(gates, providerId) {
  const row = (gates || gateMatrix()).find(g => g.id === providerId);
  return !!(row && row.status === "approved" && row.mode === "live_allowed");
}

function mockGroundedSearch({query, subjectType}) {
  const q = String(query || "").trim().slice(0, 200);
  return {
    ok: true,
    provider: "mock",
    grounded: false,
    scrapedAiMode: false,
    query: q,
    subjectType: subjectType === "person" ? "person" : "place",
    citations: q ? [{
      title: "Mock citation (not a live search result)",
      url: "https://www.floqr.app/",
      retrievedAt: new Date().toISOString(),
      reuseRights: "unknown"
    }] : [],
    identityConfidence: subjectType === "person" ? 0 : null,
    identityMatched: false,
    publicationRights: false,
    note: "Live Gemini grounding is blocked until legal signoff. This is a mock adapter."
  };
}

function feedbackRecord({uid, evidenceId, vote, subjectUid}) {
  const v = FEEDBACK.includes(vote) ? vote : "";
  if (!v) return {ok: false, error: "invalid_vote"};
  return {
    ok: true,
    uid: String(uid || "").trim(),
    evidenceId: String(evidenceId || "").trim(),
    vote: v,
    subjectUid: String(subjectUid || "").trim(),
    isNotConsent: true,
    isNotIdentityProof: true,
    publishesGlobally: false,
    createdAtMs: Date.now()
  };
}

function identityAssociation({name, extraSignals}) {
  const n = String(name || "").trim();
  const signals = extraSignals && typeof extraSignals === "object" ? extraSignals : {};
  const hasMoreThanName = !!(signals.handle || signals.profileUrl || signals.city && signals.role);
  return {
    name: n,
    matched: false,
    confidence: 0,
    requiresMoreThanName: true,
    hasMoreThanName,
    mayAttachToNamedPerson: false,
    reason: hasMoreThanName
      ? "Signals present but publication rights and legal gate are not approved."
      : "A name alone is not enough to attach public web research to a person."
  };
}

function disputeRecord({uid, evidenceId, reason}) {
  return {
    ok: true,
    uid: String(uid || "").trim(),
    evidenceId: String(evidenceId || "").trim(),
    reason: String(reason || "").trim().slice(0, 500),
    suppressed: true,
    profileUnchanged: true,
    thirdPartyRemovalPromised: false,
    createdAtMs: Date.now()
  };
}

const MASTER_ADMIN_GATE_PROMPT =
  "This integration requires provider authorization and legal review. Have you obtained the required API access, commercial license/partner agreement, data display/caching rights, privacy approval and any booking permissions? Please provide evidence. Until confirmed I will implement only a mock interface.";

module.exports = {
  GATE_STATUSES,
  FEEDBACK,
  normalizeGate,
  gateMatrix,
  mayCallProvider,
  mockGroundedSearch,
  feedbackRecord,
  identityAssociation,
  disputeRecord,
  MASTER_ADMIN_GATE_PROMPT
};
