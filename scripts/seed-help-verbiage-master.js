#!/usr/bin/env node
/* Write the Master Admin help catalog to Firestore.
   The raw JSON is never committed. Pass a file outside the repo, or a
   gitignored path such as config/help-verbiage-master.local.json.
   Dry run (default): node scripts/seed-help-verbiage-master.js --file <path>
   Apply: add --apply --confirm-project shoutoutdemo-5b402
   Doc: helpVerbiageMasterSource/catalog. Client read and write stay off. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const COLLECTION = "helpVerbiageMasterSource";
const DOC_ID = "catalog";
const DEFAULT_PROJECT = "shoutoutdemo-5b402";
const TRACKED_SOURCE = "functions/help-verbiage-master-source.json";

function toPosix(rel) {
  return rel.split(path.sep).join("/");
}

function assertSeedFileAllowed(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error(`Seed file not found: ${abs}`);
  }
  const rel = toPosix(path.relative(ROOT, abs));
  const inside = rel !== "" && !rel.startsWith("../") && !path.isAbsolute(rel);
  if (!inside) return abs;
  if (rel === TRACKED_SOURCE) {
    throw new Error(`Refusing ${TRACKED_SOURCE}. Copy it outside the repo before seeding.`);
  }
  try {
    childProcess.execFileSync("git", ["check-ignore", "-q", "--", abs], {cwd: ROOT});
  } catch (err) {
    if (err && err.status === 1) {
      throw new Error("Refusing a file inside the repo that git would track. Use a path outside the repo or a gitignored local file.");
    }
    throw err;
  }
  return abs;
}

function validateEntries(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error("Catalog must be a non-empty array.");
  const ids = new Set();
  return rows.map(row => {
    const id = String(row && row.id || "").trim();
    const title = String(row && row.title || "");
    const body = String(row && row.body || "");
    const audiences = Array.isArray(row && row.audiences) ? row.audiences.map(String) : [];
    if (!id || !title.trim() || !body.trim()) throw new Error(`Entry ${id || "(missing id)"} needs a title and a body.`);
    if (audiences.length !== 1 || audiences[0] !== "masterAdmin") throw new Error(`${id} must be Master Admin only.`);
    if (ids.has(id)) throw new Error(`Duplicate id ${id}.`);
    ids.add(id);
    return {
      id,
      title,
      body,
      audiences: ["masterAdmin"],
      searchPhrases: Array.isArray(row.searchPhrases) ? row.searchPhrases.map(item => String(item)) : [],
      links: Array.isArray(row.links) ? row.links.map(link => ({
        label: String(link && link.label || ""),
        href: String(link && link.href || "")
      })) : [],
      page: String(row.page || ""),
      source: String(row.source || "")
    };
  });
}

function plan(entries) {
  return {
    collection: COLLECTION,
    docId: DOC_ID,
    projectId: DEFAULT_PROJECT,
    entryCount: entries.length,
    ids: entries.map(row => row.id).sort()
  };
}

function readEntries(file) {
  const abs = assertSeedFileAllowed(file);
  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  return validateEntries(parsed);
}

function parseArgs(argv) {
  const args = {apply: false, file: "", confirmProject: ""};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg === "--file") args.file = argv[++i] || "";
    else if (arg === "--confirm-project") args.confirmProject = argv[++i] || "";
    else throw new Error(`Unknown option ${arg}`);
  }
  if (!args.file) throw new Error("Pass --file <path>. The path must not be a tracked git file.");
  return args;
}

async function firestoreFromCli(projectId) {
  const admin = require(path.join(ROOT, "functions/node_modules/firebase-admin"));
  let adcPath = "";
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const cli = path.join(process.env.APPDATA || "", "npm/node_modules/firebase-tools/lib");
    const fauth = require(path.join(cli, "auth"));
    const scopes = require(path.join(cli, "scopes"));
    const api = require(path.join(cli, "api"));
    const account = fauth.getGlobalDefaultAccount();
    const refreshToken = account && account.tokens && account.tokens.refresh_token;
    if (!refreshToken) throw new Error("Firebase CLI has no refresh token. Run firebase login as the owner, then retry.");
    await fauth.getAccessToken(refreshToken, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
    adcPath = path.join(os.tmpdir(), `floqr-help-master-adc-${process.pid}.json`);
    fs.writeFileSync(adcPath, JSON.stringify({
      type: "authorized_user",
      client_id: api.clientId(),
      client_secret: api.clientSecret(),
      refresh_token: refreshToken
    }), {encoding: "utf8", mode: 0o600});
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  }
  const app = admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault()
  }, `help-verbiage-master-${process.pid}`);
  return {
    db: app.firestore(),
    cleanup: async () => {
      await app.delete();
      if (adcPath) fs.rmSync(adcPath, {force: true});
    }
  };
}

async function main(argv) {
  const args = parseArgs(argv);
  const entries = readEntries(args.file);
  const summary = plan(entries);
  console.log(`${summary.collection}/${summary.docId}`);
  console.log(`entries: ${summary.entryCount}`);
  console.log(`ids: ${summary.ids.join(", ")}`);
  if (!args.apply) {
    console.log("Dry run. Nothing written. Add --apply --confirm-project shoutoutdemo-5b402 to write Firestore.");
    return 0;
  }
  if (args.confirmProject !== DEFAULT_PROJECT) {
    throw new Error(`Refusing to write. Pass --confirm-project ${DEFAULT_PROJECT}.`);
  }
  const {db, cleanup} = await firestoreFromCli(DEFAULT_PROJECT);
  try {
    await db.collection(COLLECTION).doc(DOC_ID).set({
      entries,
      entryCount: entries.length,
      updatedAtMs: Date.now()
    });
    console.log(`Wrote ${summary.entryCount} entries. Delete the local seed file.`);
  } finally {
    await cleanup();
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => {
    process.exit(code || 0);
  }).catch(err => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = {
  COLLECTION,
  DOC_ID,
  DEFAULT_PROJECT,
  TRACKED_SOURCE,
  assertSeedFileAllowed,
  validateEntries,
  plan,
  readEntries
};
