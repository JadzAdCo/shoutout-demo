/* BOT DEE six-phase upgrade — signed capability / version registry.
   Statuses are code-derived, never guessed from chat. deployed=false until
   origin/main Functions + Pages are verified. No secrets. */
"use strict";

const path = require("path");

const UPGRADE_SPEC_VERSION = "1.2";
const SCHEMA_VERSION = "floqr.botDeeUpgradeManifest/1";

function packageVersion() {
  try {
    return String(require("./package.json").version || "").trim() || "0.0.0";
  } catch (_) {
    return "0.0.0";
  }
}

function packageLabel(version) {
  const v = String(version || packageVersion());
  return v.startsWith("s") ? v : `s${v}`;
}

function textModelId() {
  return String(process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash").trim() || "gemini-3.6-flash";
}

/** Provider legal gates — UNKNOWN/BLOCKED until Master Admin records evidence. */
const PROVIDER_GATES = Object.freeze([
  {id: "google_places", label: "Google Places/Maps", intended: "places, ratings, photos, addresses", status: "blocked", mode: "mock_only"},
  {id: "gemini_grounding", label: "Gemini grounded search", intended: "cited web research", status: "blocked", mode: "mock_only"},
  {id: "yelp", label: "Yelp", intended: "business ratings/reviews", status: "blocked", mode: "mock_only"},
  {id: "ticketmaster_discovery", label: "Ticketmaster Discovery", intended: "event search / details — not ticket sales", status: "blocked", mode: "mock_only"},
  {id: "ticketmaster_partner", label: "Ticketmaster Partner", intended: "reserve/purchase — needs a signed distribution contract", status: "blocked", mode: "mock_only"},
  {id: "eventbrite", label: "Eventbrite", intended: "events / ticket links", status: "blocked", mode: "mock_only"},
  {id: "airbnb", label: "Airbnb", intended: "short-term rentals", status: "blocked", mode: "mock_only"},
  {id: "opentable", label: "OpenTable", intended: "menus / reservations", status: "blocked", mode: "mock_only"},
  {id: "resy", label: "Resy", intended: "dining reservations", status: "blocked", mode: "mock_only"},
  {id: "tesla", label: "Tesla", intended: "vehicle specs/images", status: "blocked", mode: "mock_only"},
  {id: "nhtsa_iihs", label: "NHTSA / IIHS", intended: "crash tests / recalls", status: "blocked", mode: "mock_only"},
  {id: "mls_idx", label: "Real estate MLS/IDX/RESO", intended: "listings", status: "blocked", mode: "mock_only"},
  {id: "hotels_flights", label: "Hotels / flights / travel", intended: "availability and booking", status: "blocked", mode: "mock_only"}
]);

const PHASES = Object.freeze([
  {
    id: 1,
    name: "foundation",
    implemented: true,
    tested: true,
    deployed: true,
    note: "Existing BOT DEE chat: executeBotSession, Auth + botDee gate, Gemini tools, 300s idle, durable threads. Audit documents the live path."
  },
  {
    id: 2,
    name: "durable_execution",
    implemented: true,
    tested: true,
    deployed: false,
    note: "Workflow checkpoints, leases, idempotency receipts, capability manifest. Not production-deployed until owner approval."
  },
  {
    id: 3,
    name: "memory",
    implemented: true,
    tested: true,
    deployed: false,
    note: "Opt-in archive + memories. Idle still ends the active session. Default consent is off."
  },
  {
    id: 5,
    name: "smartviews",
    implemented: true,
    tested: true,
    deployed: false,
    note: "Schema-driven SmartViews with mocked/licensed-placeholder data. Venue cards deep-link to club-profile.html. Patron web research disabled."
  },
  {
    id: 4,
    name: "research",
    implemented: true,
    tested: true,
    deployed: false,
    note: "Mock-only research adapters. No live Google/Yelp/Gemini grounding until legal gate evidence."
  },
  {
    id: 6,
    name: "action",
    implemented: true,
    tested: true,
    deployed: false,
    note: "Existing VIP / ShoutOut / floqCast tools remain. New partner bookings are mock-only + explicit confirm. PCI: hosted checkout only."
  }
]);

const CAPABILITIES = Object.freeze({
  executeBotSession: {state: "live", deployed: true},
  getBotDeeThread: {state: "live", deployed: true},
  setBotDeeSettings: {state: "live", deployed: true},
  conversationIdleSecondsDefault: {state: "live", value: 300, deployed: true},
  durableThreads: {state: "live", default: 1, deployed: true},
  minglSeparate: {state: "live", deployed: true},
  optInArchive: {state: "implemented", default: 0, deployed: false},
  userMemories: {state: "implemented", default: 0, deployed: false},
  executionCheckpoints: {state: "implemented", deployed: false},
  smartViews: {state: "implemented_mock", deployed: false},
  peopleSmartViewV2: {state: "implemented", deployed: false, note: "Inline People SmartView + owner edit + translation queue; Functions deploy pending owner approval"},
  publicWebResearch: {state: "disabled_legal_gate", deployed: false},
  partnerActions: {state: "mock_only", deployed: false},
  langchain: {state: "forbidden", deployed: false},
  redis: {state: "forbidden", deployed: false},
  cloudSql: {state: "forbidden", deployed: false}
});

function buildManifest(overrides) {
  const version = packageVersion();
  const extra = overrides && typeof overrides === "object" ? overrides : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    specVersion: UPGRADE_SPEC_VERSION,
    appVersion: version,
    appLabel: packageLabel(version),
    modelId: textModelId(),
    region: "us-central1",
    environment: extra.environment || "pr_not_production",
    generatedAtIso: extra.generatedAtIso || new Date().toISOString(),
    deployedClaim: false,
    tokenWindow: {
      modelId: textModelId(),
      configuredContextTurns: 12,
      maxInputTokensVerified: null,
      note: "Gemini token window is model-specific and must be read from the deployed model config. Do not assume 1M tokens. Server RAM is not the context window."
    },
    phases: PHASES.map(row => ({...row})),
    capabilities: {...CAPABILITIES},
    providers: PROVIDER_GATES.map(row => ({...row, ...(extra.providerOverrides && extra.providerOverrides[row.id] || {})})),
    limitations: [
      "Idle pause (default 300s) ends the active execution session; it does not by itself delete an opted-in archive.",
      "Guest chats are not persisted (sign-in required).",
      "Mingl conversations are never migrated into BOT DEE memory.",
      "Public-within-FLOQR is not web publication.",
      "Third-party research and partner bookings stay mock-only until Master Admin legal evidence.",
      "This registry does not prove Functions or Pages deploy. deployed flags stay false for new phases until verified."
    ],
    secretsExposed: false
  };
}

function describeForRole(role, overrides) {
  const manifest = buildManifest(overrides);
  const isMaster = role === "master" || role === "masterAdmin";
  const lines = [
    `I'm BOT DEE on FLOQR package ${manifest.appLabel} (release ${manifest.appVersion}).`,
    `Model id in this build: ${manifest.modelId}.`
  ];
  if (!isMaster) {
    lines.push("I can help with FLOQR products your account may use. Type help for what I can do.");
    return {reply: lines.join(" "), manifest: null, role: role || "patron"};
  }
  const phaseLines = manifest.phases.map(p => {
    const flags = [
      p.implemented ? "implemented" : "not-implemented",
      p.tested ? "tested" : "untested",
      p.deployed ? "deployed" : "not-deployed"
    ].join("/");
    return `Part ${p.id} ${p.name}: ${flags}.`;
  });
  const blocked = manifest.providers.filter(p => p.status !== "approved").map(p => p.label);
  lines.push(`Six-phase spec ${manifest.specVersion}. New phases are not production-deployed.`);
  lines.push(phaseLines.join(" "));
  lines.push(`Integrations still mock-only: ${blocked.join(", ")}.`);
  lines.push("I will not invent a deploy. Ask Master Admin Diagnostics after a real Functions/Pages ship.");
  return {reply: lines.join(" "), manifest, role: "master"};
}

function changelogPath() {
  return path.join(__dirname, "..", "docs", "BOT-DEE-SIX-PHASE.md");
}

module.exports = {
  SCHEMA_VERSION,
  UPGRADE_SPEC_VERSION,
  PROVIDER_GATES,
  PHASES,
  CAPABILITIES,
  packageVersion,
  packageLabel,
  textModelId,
  buildManifest,
  describeForRole,
  changelogPath
};
