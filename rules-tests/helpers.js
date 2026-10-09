"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, setDoc } = require("firebase/firestore");

const PROJECT_ID = "demo-floqr-rules";
const REPO_ROOT = path.resolve(__dirname, "..");

function emulatorHostPort(envName, fallbackPort) {
  const raw = process.env[envName];
  if (raw) {
    const idx = raw.lastIndexOf(":");
    const host = raw.slice(0, idx).replace(/^\[|\]$/g, "") || "127.0.0.1";
    const port = Number(raw.slice(idx + 1));
    if (Number.isFinite(port)) return { host: host === "localhost" ? "127.0.0.1" : host, port };
  }
  return { host: "127.0.0.1", port: fallbackPort };
}

// FLOQR_FIRESTORE_RULES / FLOQR_STORAGE_RULES let you test a draft rules file without touching the repo copy.
function rulesFile(envName, fileName) {
  return fs.readFileSync(process.env[envName] || path.join(REPO_ROOT, fileName), "utf8");
}

async function createEnv({ storage = false } = {}) {
  const config = {
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesFile("FLOQR_FIRESTORE_RULES", "firestore.rules"),
      ...emulatorHostPort("FIRESTORE_EMULATOR_HOST", 8080)
    }
  };
  if (storage) {
    config.storage = {
      rules: rulesFile("FLOQR_STORAGE_RULES", "storage.rules"),
      ...emulatorHostPort("FIREBASE_STORAGE_EMULATOR_HOST", 9199)
    };
  }
  return initializeTestEnvironment(config);
}

const IDENTITIES = {
  alice: { uid: "alice", token: { email: "alice@example.com", email_verified: true } },
  bob: { uid: "bob", token: { email: "bob@example.com", email_verified: true } },
  mallory: { uid: "mallory", token: { email: "mallory@example.com", email_verified: true } },
  owner: { uid: "owner", token: { email: "bans.don@gmail.com", email_verified: true } }
};

/** Lazily-created, per-file auth contexts: who.alice.firestore(), who.anon.storage(), … */
function contexts(env) {
  const cache = {};
  const get = name => {
    if (!cache[name]) {
      cache[name] = name === "anon"
        ? env.unauthenticatedContext()
        : env.authenticatedContext(IDENTITIES[name].uid, IDENTITIES[name].token);
    }
    return cache[name];
  };
  return {
    get alice() { return get("alice"); },
    get bob() { return get("bob"); },
    get mallory() { return get("mallory"); },
    get owner() { return get("owner"); },
    get anon() { return get("anon"); }
  };
}

/** Seed Firestore docs with rules disabled. `docs` maps "collection/id" → data. */
async function seed(env, docs) {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const [docPath, data] of Object.entries(docs)) {
      await setDoc(doc(db, docPath), data);
    }
  });
}

module.exports = { PROJECT_ID, createEnv, contexts, seed };
