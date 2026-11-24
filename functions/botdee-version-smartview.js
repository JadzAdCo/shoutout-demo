/* BOT DEE Version SMARTview — exact aliases Ver/Vers/Version.
   Payload is request-scoped (no new Firestore docs). Numbers in design
   renderings are illustrative — never copy them into production metadata. */
"use strict";

const fs = require("fs");
const path = require("path");
const manifest = require("./botdee-upgrade-manifest");
const whatsNewCatalog = require("./botdee-whats-new-catalog");

const SCHEMA_VERSION = "floqr.botDeeVersionSmartView/1";
const KIND = "botDeeVersion";

function isVersionSmartViewAlias(raw) {
  const q = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[?؟]+$/g, "")
    .trim();
  return q === "ver" || q === "vers" || q === "version";
}

function isMasterRole(role) {
  const value = String(role || "").trim();
  return value === "master" || value === "masterAdmin" || value === "superAdmin";
}

function parseChangelogText(text) {
  const items = [];
  const seen = new Set();
  const re = /^- (s3\.\d+\.\d+):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(String(text || ""))) && items.length < 40) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      text: `${id}: ${String(match[2] || "").trim()}`.slice(0, 280)
    });
  }
  return items;
}

function changelogFromBundle() {
  try {
    // Live package notes: functions/botdee-version-changelog.json (s3.3.035+).
    // What's New tab filters through botdee-whats-new-catalog.js (BOT DEE/Gemini only).
    const rows = require("./botdee-version-changelog.json");
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row && row.id && row.text).map(row => {
      const next = {
        id: String(row.id),
        text: String(row.text).slice(0, 280)
      };
      if (Array.isArray(row.audiences) && row.audiences.length) next.audiences = row.audiences.slice();
      if (row.whatsNewText) next.whatsNewText = String(row.whatsNewText).slice(0, 280);
      return next;
    });
  } catch (_) {
    return [];
  }
}

function changelogFromReadme(rootDir) {
  const file = path.join(rootDir || path.join(__dirname, ".."), "README.md");
  try {
    return parseChangelogText(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return [];
  }
}

function changelogItems(rootDir) {
  const bundled = changelogFromBundle();
  const source = bundled.length ? bundled : changelogFromReadme(rootDir);
  const shown = whatsNewCatalog.forVersionWhatsNew(source);
  let byVersion = new Map();
  try {
    const help = require("./help-verbiage-core");
    byVersion = new Map(help.whatsNewSeedRecords(source, whatsNewCatalog).map(row => [
      String(row.id || "").replace(/^whatsnew-/, ""),
      row
    ]));
  } catch (_) {
    byVersion = new Map();
  }
  return shown.map(row => {
    const seed = byVersion.get(row.id);
    const body = seed && seed.lasttextenhun && seed.lasttextenhun.body;
    return body ? {...row, text: body} : row;
  });
}

/** Probe this Version request. Never a static Not checked label.
    Operational = Functions ran + package stamp readable + Gemini key bound.
    Degraded = Functions + package, Gemini not configured.
    Unavailable = Functions not in this request (or package stamp missing). */
function probeVersionService(opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const functionsOk = options.functionsReachable === true;
  const packageLabel = options.packageLabel === undefined
    ? String(manifest.packageLabel() || "").trim()
    : String(options.packageLabel || "").trim();
  const packageOk = /^s3\./.test(packageLabel);
  const geminiOk = options.geminiConfigured === true;
  let status = "unavailable";
  if (functionsOk && packageOk && geminiOk) status = "operational";
  else if (functionsOk && packageOk) status = "degraded";
  else if (functionsOk || packageOk) status = "degraded";
  return {
    status,
    lastCheckAtIso: new Date(nowMs).toISOString(),
    checks: {
      functions: functionsOk,
      package: packageOk,
      gemini: geminiOk
    }
  };
}

function buildVersionSmartView(opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const iso = new Date(nowMs).toISOString();
  const pkg = manifest.packageLabel();
  const ver = manifest.packageVersion();
  const modelId = manifest.textModelId();
  const man = manifest.buildManifest({ generatedAtIso: iso });
  const probe = probeVersionService({
    now: nowMs,
    packageLabel: pkg,
    functionsReachable: options.functionsReachable === true,
    geminiConfigured: options.geminiConfigured === true
  });
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    kind: KIND,
    generatedAtIso: iso,
    botDee: {
      packageLabel: pkg,
      packageVersion: ver
    },
    floqr: {
      backendPackage: pkg,
      frontendPackage: options.frontendPackage ? String(options.frontendPackage) : null
    },
    model: {
      configuredId: modelId,
      sessionPath: options.sessionPath || "local-version",
      sessionModel: modelId,
      usedThisTurn: false
    },
    service: {
      status: probe.status,
      lastCheckAtIso: probe.lastCheckAtIso,
      checks: probe.checks
    },
    changelog: changelogItems(options.rootDir),
    environment: man.environment || "pr_not_production"
  };
  if (isMasterRole(options.role)) {
    payload.privileged = {
      deployedClaim: man.deployedClaim === true,
      specVersion: man.specVersion,
      phases: (man.phases || []).map(row => ({
        id: row.id,
        name: row.name,
        implemented: !!row.implemented,
        tested: !!row.tested,
        deployed: !!row.deployed
      })),
      capabilities: Object.fromEntries(
        Object.entries(man.capabilities || {}).map(([key, value]) => [key, {
          state: value && value.state ? value.state : "",
          deployed: !!(value && value.deployed)
        }])
      ),
      limitations: Array.isArray(man.limitations) ? man.limitations.slice(0, 8) : []
    };
  }
  return payload;
}

module.exports = {
  SCHEMA_VERSION,
  KIND,
  isVersionSmartViewAlias,
  isMasterRole,
  parseChangelogText,
  changelogFromBundle,
  changelogFromReadme,
  changelogItems,
  probeVersionService,
  buildVersionSmartView
};
