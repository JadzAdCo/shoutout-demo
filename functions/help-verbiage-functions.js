/* Scheduled help verbiage enhancement.
   The only Gemini reader: one non-legal entry per run. Auto-publishes when the
   checks pass. Client reads of helpVerbiage stay off. */
"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {getFirestore} = require("firebase-admin/firestore");
const core = require("./help-verbiage-core");
const dc = require("./data-classification-core");
const geminiLog = require("./gemini-api-access-log");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const CALL_OPTS = {region: "us-central1", timeoutSeconds: 30, memory: "256MiB"};

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function isAgentClient(request) {
  const data = request?.data || {};
  const kind = text(data.clientKind || data.actorKind || "", 40).toLowerCase();
  if (kind === "agent") return true;
  const headers = request?.rawRequest?.headers || {};
  if (text(headers["x-floqr-client"], 40).toLowerCase() === "agent") return true;
  const ua = String(headers["user-agent"] || "");
  if (/^(curl\/|wget\/|python-requests\/|Go-http-client\/|axios\/|node-fetch\/|undici)/i.test(ua)) return true;
  if (/HeadlessChrome|Playwright|Puppeteer|Cursor|FLOQR-Agent|cloud.?agent/i.test(ua)) return true;
  return false;
}

function auditActorFromRequest(request, roleFallback) {
  if (isAgentClient(request)) return {uid: request?.auth?.uid || "", email: "agent", role: "agent"};
  return {
    uid: request?.auth?.uid || "",
    email: text(request?.auth?.token?.email || "", 200),
    role: roleFallback || "patron"
  };
}

function loadCatalog() {
  const publicRows = require("./help-verbiage-public-source.json");
  const masterRows = require("./help-verbiage-master-source.json");
  const changelog = require("./botdee-version-changelog.json");
  const whatsNewCatalog = require("./botdee-whats-new-catalog");
  const help = [...publicRows, ...masterRows].filter(row => row && row.id && !core.isLegalVerbiage(row));
  const whatsNewSeeds = core.whatsNewSeedRecords(changelog, whatsNewCatalog);
  const whatsNew = whatsNewSeeds.map(seed => ({
    id: seed.id,
    title: seed.rawTitle,
    body: seed.rawBody,
    audiences: seed.audiences
  }));
  return {
    entries: [...help, ...whatsNew],
    seeds: [...core.versionSeedRecords(publicRows), ...whatsNewSeeds]
  };
}

function firestoreBody(doc, now) {
  const body = {
    id: doc.id,
    audiences: doc.audiences || [],
    audienceLabel: doc.audienceLabel || "",
    beenModsincelasttextenhun: doc.beenModsincelasttextenhun === 0 ? 0 : 1,
    lasttextenhunSourceHash: String(doc.lasttextenhunSourceHash || ""),
    seeded: doc.seeded === 1 ? 1 : 0,
    legal: 0,
    updatedAtMs: now
  };
  if (doc.rawTitle || doc.rawBody) {
    body.rawTitle = String(doc.rawTitle || "");
    body.rawBody = String(doc.rawBody || "");
  }
  if (doc.lasttextenhun && doc.lasttextenhun.title && doc.lasttextenhun.body) {
    body.lasttextenhun = {title: doc.lasttextenhun.title, body: doc.lasttextenhun.body};
  }
  body.locales = doc.locales && typeof doc.locales === "object" ? doc.locales : {};
  return body;
}

async function readDocs(db, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const refs = unique.map(id => db.collection(core.COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);
  const out = {};
  snaps.forEach(snap => {
    if (snap && snap.exists) out[snap.id] = snap.data() || {};
  });
  return out;
}

async function writeDoc(db, doc, now) {
  dc.systemJob("helpVerbiageEnhance", core.COLLECTION);
  await db.collection(core.COLLECTION).doc(doc.id).set(firestoreBody(doc, now));
}

async function writeAudit(db, row) {
  dc.systemJob("helpVerbiageEnhance", core.AUDIT_COLLECTION);
  const now = row.createdAtMs || Date.now();
  await db.collection(core.AUDIT_COLLECTION).doc().set({
    helpId: String(row.helpId || ""),
    actorUid: String(row.actorUid || ""),
    actorEmail: String(row.actorEmail || ""),
    actorRole: String(row.actorRole || ""),
    flagBefore: row.flagBefore === 0 ? 0 : 1,
    flagAfter: row.flagAfter === 0 ? 0 : 1,
    lasttextenhunBefore: row.lasttextenhunBefore || null,
    lasttextenhunAfter: row.lasttextenhunAfter || null,
    sourceHash: String(row.sourceHash || ""),
    modelId: String(row.modelId || ""),
    outcome: String(row.outcome || ""),
    reason: String(row.reason || ""),
    createdAtMs: now
  });
}

async function runScheduledEnhance(options = {}) {
  const db = options.db;
  if (!db) throw new Error("help verbiage enhance needs a database");
  const fetchImpl = options.fetchImpl || global.fetch;
  const apiKey = options.apiKey != null ? String(options.apiKey) : String(process.env.GEMINI_API_KEY || "");
  const now = options.now || Date.now();
  const bundle = options.catalog || loadCatalog();
  const entries = (bundle.entries || []).filter(entry => !core.isLegalVerbiage(entry));
  const seeds = new Map((bundle.seeds || []).map(row => [row.id, row]));
  dc.systemJob("helpVerbiageEnhance", core.COLLECTION);

  let docs = await readDocs(db, entries.map(entry => entry.id));
  for (const entry of entries) {
    const seed = seeds.get(entry.id);
    if (!seed || docs[entry.id]) continue;
    await writeDoc(db, seed, now);
    docs[entry.id] = firestoreBody(seed, now);
  }
  for (const entry of entries) {
    const next = core.reconcileDoc(entry, docs[entry.id]);
    if (next.skip) continue;
    const current = docs[entry.id] || {};
    const sameFlag = current.beenModsincelasttextenhun === next.beenModsincelasttextenhun;
    const sameLabel = current.audienceLabel === next.audienceLabel;
    if (sameFlag && sameLabel && current.id) continue;
    const merged = {
      ...current,
      ...next,
      lasttextenhun: current.lasttextenhun || next.lasttextenhun,
      locales: current.locales || next.locales || {},
      lasttextenhunSourceHash: current.lasttextenhunSourceHash || next.lasttextenhunSourceHash || "",
      rawTitle: next.rawTitle,
      rawBody: next.rawBody,
      seeded: current.seeded === 1 ? 1 : next.seeded
    };
    await writeDoc(db, merged, now);
    docs[entry.id] = firestoreBody(merged, now);
  }

  const entry = core.selectNext(entries, docs);
  if (!entry) return {processed: false, calls: 0};

  const before = docs[entry.id] || {};
  const prompt = core.enhancementPrompt(entry);
  let review = {ok: false, down: true, reasons: ["gemini-down"]};
  let calls = 0;
  if (apiKey && prompt) {
    calls = 1;
    try {
      const request = core.geminiGenerateRequest(prompt, apiKey);
      const response = await fetchImpl(request.url, request.init);
      if (!response || response.ok !== true) throw new Error("gemini-http");
      const payload = await response.json();
      const parsed = core.parseGeminiJson(core.extractGeminiText(payload));
      review = parsed ? core.reviewOutput(entry, parsed) : {ok: false, reasons: ["unparsed"]};
    } catch (_) {
      review = {ok: false, down: true, reasons: ["gemini-down"]};
    }
  }
  const applied = core.applyReview(entry, before, review);
  await writeDoc(db, {
    ...applied.doc,
    rawTitle: core.text(entry.title),
    rawBody: core.text(entry.body)
  }, now);
  await writeAudit(db, {
    helpId: entry.id,
    actorUid: "system",
    actorEmail: "system",
    actorRole: "system",
    flagBefore: before.beenModsincelasttextenhun === 0 ? 0 : 1,
    flagAfter: applied.doc.beenModsincelasttextenhun === 0 ? 0 : 1,
    lasttextenhunBefore: before.lasttextenhun || null,
    lasttextenhunAfter: applied.doc.lasttextenhun || null,
    sourceHash: core.sourceHash(entry.title, entry.body),
    modelId: core.TEXT_MODEL,
    outcome: applied.outcome,
    reason: "",
    createdAtMs: now
  });
  if (typeof options.logGemini === "function") {
    dc.systemJob("helpVerbiageEnhance", "geminiApiAccessLogs");
    await options.logGemini({
      ok: applied.outcome === "published",
      outcome: applied.outcome === "published" ? "success" : "failure",
      operation: "helpVerbiageEnhance",
      enhancementType: "helpVerbiage",
      model: core.TEXT_MODEL,
      failureReason: applied.outcome === "published" ? "" : (applied.reasons || []).slice(0, 8).join(", "),
      message: `Help verbiage ${entry.id} ${applied.outcome}`,
      uid: "system",
      email: "",
      source: "scheduledHelpVerbiageEnhance",
      details: {helpId: entry.id, outcome: applied.outcome}
    });
  }
  return {processed: true, id: entry.id, outcome: applied.outcome, calls, reasons: applied.reasons || []};
}

function manifestWithWhatsNew(base) {
  const help = {...(base && base.help ? base.help : {})};
  return {help, intents: (base && base.intents) || {}};
}

async function readHelpForViewer({ids, viewer, actor, db, manifest, request}) {
  const sourceIds = dc.sanitizeSourceIds((ids || []).map(id => {
    const key = String(id || "").replace(/^help:/, "").trim();
    return key ? `help:${key}` : "";
  }));
  const classes = manifestWithWhatsNew(manifest || require("./botdee-content-classes.json"));
  sourceIds.forEach(sourceId => {
    const key = sourceId.slice("help:".length);
    if (key.startsWith("whatsnew-") && !classes.help[key]) classes.help[key] = ["patron"];
  });
  const {allowed, denied} = dc.filterContent(sourceIds, classes, viewer || {role: "anonymous"});
  if (denied.length && db) {
    const who = actor || {uid: "", email: "", role: "patron"};
    await writeAudit(db, {
      helpId: denied.map(row => row.id).join(",").slice(0, 200),
      actorUid: who.uid || "",
      actorEmail: who.email || "",
      actorRole: who.role || "patron",
      flagBefore: 1,
      flagAfter: 1,
      lasttextenhunBefore: null,
      lasttextenhunAfter: null,
      sourceHash: "",
      modelId: "",
      outcome: "denied",
      reason: "",
      createdAtMs: Date.now()
    });
  }
  const allowedIds = allowed.map(sourceId => sourceId.slice("help:".length));
  const docs = db ? await readDocs(db, allowedIds) : {};
  return {
    ok: true,
    actorRole: actor && actor.role || "",
    denied: denied.map(row => ({id: row.id, level: row.level})),
    results: allowedIds.map(id => {
      const doc = docs[id] || {};
      const audiences = doc.audiences || classes.help[id] || [];
      if (core.isMasterOnly(audiences) && viewer?.role !== "master") return null;
      return {
        id,
        audiences,
        audienceLabel: doc.audienceLabel || audiences[0] || "",
        lasttextenhun: doc.lasttextenhun || null,
        locales: doc.locales || {},
        beenModsincelasttextenhun: doc.beenModsincelasttextenhun === 0 ? 0 : 1
      };
    }).filter(Boolean),
    requestSeen: !!(request && request.rawRequest)
  };
}

async function loadPublishedMap(ids, db) {
  const docs = await readDocs(db, ids);
  const out = {};
  Object.entries(docs).forEach(([id, doc]) => {
    if (!doc || core.isMasterOnly(doc.audiences)) return;
    if (doc.lasttextenhun && doc.lasttextenhun.title && doc.lasttextenhun.body) out[id] = doc;
  });
  return out;
}

let _db;
function database() {
  if (!_db) _db = getFirestore();
  return _db;
}

const scheduledHelpVerbiageEnhance = onSchedule({
  schedule: "every 15 minutes",
  timeZone: "UTC",
  region: "us-central1",
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: [GEMINI_API_KEY]
}, async () => {
  const store = database();
  await runScheduledEnhance({
    db: store,
    apiKey: process.env.GEMINI_API_KEY || "",
    logGemini: entry => geminiLog.logGeminiApiAccess(store, entry)
  });
});

const getHelpVerbiage = onCall(CALL_OPTS, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to read help.");
  const facts = await require("./data-classification-functions").__botDeeHelpers.roleFactsFor(request.auth);
  const viewer = dc.resolveViewerRole(facts);
  const actor = auditActorFromRequest(request, viewer.role);
  return readHelpForViewer({
    ids: request.data?.ids || request.data?.sourceIds || [],
    viewer,
    actor,
    db: database(),
    request
  });
});

module.exports = {
  scheduledHelpVerbiageEnhance,
  getHelpVerbiage,
  runScheduledEnhance,
  readHelpForViewer,
  loadPublishedMap,
  loadCatalog,
  isAgentClient,
  auditActorFromRequest,
  firestoreBody
};
