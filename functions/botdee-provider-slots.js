/* BOT DEE later-fill provider slots.
   Mock is the default. Missing/unknown = mock. No live vendor HTTP in this module.
   Secret values never live in Firestore or git — only secret *names*. */
"use strict";

const SECRET_LOOKING = /^(sk|rk)_(live|test)_|^whsec_|^SG\.|-----BEGIN|^AIza|^EAA[A-Za-z0-9]{20,}/;

const FILL_SLOTS = Object.freeze([
  {
    id: "google_places",
    label: "Google Places/Maps",
    secretName: "BOTDEE_GOOGLE_PLACES_API_KEY",
    billingHint: "Google Cloud billing on shoutoutdemo-5b402 · Places API (New)",
    legalDesk: "Maps Platform ToS + Places policies. Store Place IDs, not photo/review blobs."
  },
  {
    id: "gemini_grounding",
    label: "Gemini Search grounding",
    secretName: "BOTDEE_GEMINI_GROUNDING_API_KEY",
    billingHint: "Gemini API / Vertex on shoutoutdemo-5b402. Search grounding is a separate product from existing ShoutOut Gemini.",
    legalDesk: "Gemini additional terms · Grounding with Google Search. Do not scrape Google AI Mode."
  },
  {
    id: "yelp",
    label: "Yelp Places",
    secretName: "BOTDEE_YELP_API_KEY",
    billingHint: "Yelp Places API paid license (not a free scrape).",
    legalDesk: "API Terms + display requirements. Do not store Yelp payloads longer than 24 hours."
  },
  {
    id: "ticketmaster_discovery",
    label: "Ticketmaster Discovery",
    secretName: "BOTDEE_TICKETMASTER_DISCOVERY_API_KEY",
    billingHint: "Ticketmaster Developer Portal · Discovery v2 (~5k calls/day).",
    legalDesk: "Discovery lists events. It is not a license to sell tickets."
  },
  {
    id: "ticketmaster_partner",
    label: "Ticketmaster Partner",
    secretName: "BOTDEE_TICKETMASTER_PARTNER_API_KEY",
    billingHint: "Requires a signed Ticketmaster distribution / Partner relationship.",
    legalDesk: "Partner API is reserve/purchase. Stay mock until that contract exists."
  },
  {
    id: "eventbrite",
    label: "Eventbrite",
    secretName: "BOTDEE_EVENTBRITE_API_KEY",
    billingHint: "Eventbrite Account Settings → Developer Links → API Keys.",
    legalDesk: "API Terms of Use. Marketplace listing needs Submit for Review."
  }
]);

const FILL_IDS = Object.freeze(FILL_SLOTS.map(row => row.id));

function catalogRow(providerId) {
  const id = String(providerId || "").trim();
  return FILL_SLOTS.find(row => row.id === id) || null;
}

function secretPresent(secretName, env) {
  const name = String(secretName || "").trim();
  if (!name) return 0;
  const bag = env && typeof env === "object" ? env : process.env;
  return String(bag[name] || "").trim() ? 1 : 0;
}

function looksLikeSecretValue(value) {
  return SECRET_LOOKING.test(String(value || "").trim());
}

function normalizeSlot(stored, env, nowMs) {
  const catalog = catalogRow(stored?.id) || catalogRow(stored?.providerId);
  if (!catalog) {
    return {
      id: String(stored?.id || stored?.providerId || "unknown"),
      known: false,
      enabled: 0,
      secretName: "",
      secretPresent: 0,
      billingAccountRef: "",
      legalEvidenceRef: "",
      expiresAtMs: 0,
      expired: false,
      slotReady: false,
      mode: "mock_only",
      httpAllowed: false,
      note: "Unknown provider — mock only."
    };
  }
  const now = Number(nowMs) || Date.now();
  const enabled = Number(stored?.enabled) === 1 ? 1 : 0;
  const secretName = catalog.secretName;
  const present = secretPresent(secretName, env);
  const billingAccountRef = String(stored?.billingAccountRef || "").trim().slice(0, 200);
  const legalEvidenceRef = String(stored?.legalEvidenceRef || "").trim().slice(0, 200);
  const expiresAtMs = Number(stored?.expiresAtMs) > 0 ? Number(stored.expiresAtMs) : 0;
  const expired = expiresAtMs > 0 && now >= expiresAtMs;
  const slotReady = enabled === 1 && present === 1 && !!legalEvidenceRef && !expired;
  return {
    id: catalog.id,
    known: true,
    label: catalog.label,
    enabled,
    secretName,
    secretPresent: present,
    billingAccountRef,
    billingHint: catalog.billingHint,
    legalEvidenceRef,
    legalDesk: catalog.legalDesk,
    expiresAtMs,
    expired,
    slotReady,
    mode: "mock_only",
    httpAllowed: false,
    note: slotReady
      ? "Slot is filled. Live vendor HTTP is not implemented — adapters stay mock."
      : "Missing enabled, secret, legal evidence, or past expiresAt — mock only."
  };
}

function slotMatrix(overrides, env, nowMs) {
  const map = overrides && typeof overrides === "object" ? overrides : {};
  return FILL_SLOTS.map(row => normalizeSlot({id: row.id, ...(map[row.id] || {})}, env, nowMs));
}

function publicSlot(row) {
  return {
    id: row.id,
    known: row.known !== false,
    label: row.label || "",
    enabled: row.enabled === 1 ? 1 : 0,
    secretName: row.secretName || "",
    secretPresent: row.secretPresent === 1 ? 1 : 0,
    billingAccountRef: row.billingAccountRef || "",
    billingHint: row.billingHint || "",
    legalEvidenceRef: row.legalEvidenceRef || "",
    legalDesk: row.legalDesk || "",
    expiresAtMs: Number(row.expiresAtMs) || 0,
    expired: !!row.expired,
    slotReady: !!row.slotReady,
    mode: "mock_only",
    httpAllowed: false,
    note: row.note || ""
  };
}

function sanitizeSlotWrite(data, providerId) {
  const catalog = catalogRow(providerId);
  if (!catalog) return {ok: false, error: "unknown_provider"};
  const legalEvidenceRef = String(data?.legalEvidenceRef || "").trim().slice(0, 200);
  const billingAccountRef = String(data?.billingAccountRef || "").trim().slice(0, 200);
  if (looksLikeSecretValue(legalEvidenceRef) || looksLikeSecretValue(billingAccountRef)) {
    return {ok: false, error: "secret_value_rejected"};
  }
  if (data?.secretValue || data?.apiKey || data?.secret) {
    return {ok: false, error: "secret_value_rejected"};
  }
  const enabled = Number(data?.enabled) === 1 ? 1 : 0;
  const expiresAtMs = Number(data?.expiresAtMs) > 0 ? Number(data.expiresAtMs) : 0;
  return {
    ok: true,
    row: {
      id: catalog.id,
      enabled,
      secretName: catalog.secretName,
      billingAccountRef,
      legalEvidenceRef,
      expiresAtMs
    }
  };
}

/** Always mock. Never opens a vendor socket, even when the slot is filled. */
function runMockAdapter({providerId, query, slot}) {
  const id = String(providerId || "").trim();
  const resolved = slot && slot.id === id ? slot : normalizeSlot({id});
  return {
    ok: true,
    provider: id || "unknown",
    query: String(query || "").trim().slice(0, 200),
    mode: "mock_only",
    httpCalled: false,
    slotReady: !!resolved.slotReady,
    results: [],
    note: resolved.note
  };
}

module.exports = {
  FILL_SLOTS,
  FILL_IDS,
  catalogRow,
  secretPresent,
  looksLikeSecretValue,
  normalizeSlot,
  slotMatrix,
  publicSlot,
  sanitizeSlotWrite,
  runMockAdapter
};
