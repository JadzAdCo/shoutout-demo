/* BOT DEE Version SMARTview — exact aliases Ver/Vers/Version.
   Payload is request-scoped (no new Firestore docs). Numbers in design
   renderings are illustrative — never copy them into production metadata. */
"use strict";

const fs = require("fs");
const path = require("path");
const manifest = require("./botdee-upgrade-manifest");

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

function changelogFromReadme(rootDir) {
  const file = path.join(rootDir || path.join(__dirname, ".."), "README.md");
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (_) {
    return [];
  }
  const items = [];
  const seen = new Set();
  const re = /^- (s3\.\d+\.\d+):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(text)) && items.length < 8) {
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

function buildVersionSmartView(opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const nowMs = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const iso = new Date(nowMs).toISOString();
  const pkg = manifest.packageLabel();
  const ver = manifest.packageVersion();
  const modelId = manifest.textModelId();
  const man = manifest.buildManifest({ generatedAtIso: iso });
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
      sessionModel: null,
      usedThisTurn: false
    },
    service: {
      status: "not_checked",
      lastCheckAtIso: null
    },
    changelog: changelogFromReadme(options.rootDir),
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
  changelogFromReadme,
  buildVersionSmartView
};
