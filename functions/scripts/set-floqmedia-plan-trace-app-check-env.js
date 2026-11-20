/* Merge FLOQR_APP_CHECK_ENFORCE=1 onto the live floqmediaPlanTrace function.
   Firebase CLI v13 replaces endpoint environmentVariables from dotenv, and
   functions/.env is gitignored so it is not on the GitHub Actions runner.
   This step runs after deploy, keeps every other variable, and never sets 0.
   It does not print other variable names or values, and it does not touch
   GEMINI_API_KEY or FLOQR_OIDC_JWT_SECRET. */
"use strict";

const PROJECT = "shoutoutdemo-5b402";
const REGION = "us-central1";
const FUNCTION_ID = "floqmediaPlanTrace";
const KEY = "FLOQR_APP_CHECK_ENFORCE";

function mergeAppCheckEnv(existing) {
  const next = {};
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    for (const [name, value] of Object.entries(existing)) {
      if (name === KEY) continue;
      if (typeof value !== "string") continue;
      next[name] = value;
    }
  }
  next[KEY] = "1";
  return next;
}

function publicEnvStatus(env) {
  const bag = env && typeof env === "object" ? env : {};
  const value = Object.prototype.hasOwnProperty.call(bag, KEY) ? String(bag[KEY]) : "";
  const otherKeys = Object.keys(bag).filter((name) => name !== KEY).length;
  return {FLOQR_APP_CHECK_ENFORCE: value, otherKeys};
}

function functionUrl() {
  return `https://cloudfunctions.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/functions/${FUNCTION_ID}`;
}

async function accessToken() {
  if (!process.env.FIREBASE_TOKEN) {
    throw new Error("FIREBASE_TOKEN missing");
  }
  const apiv2 = require("firebase-tools/lib/apiv2");
  apiv2.setRefreshToken(process.env.FIREBASE_TOKEN);
  const token = await apiv2.getAccessToken();
  if (!token || String(token).length < 20) throw new Error("access token missing");
  return token;
}

async function api(token, url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch (_) { body = {parseError: true}; }
  }
  return {status: response.status, body};
}

async function waitForOperation(token, operationName) {
  const url = operationName.startsWith("https://")
    ? operationName
    : `https://cloudfunctions.googleapis.com/v2/${operationName}`;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const op = await api(token, url);
    if (op.status >= 400) {
      throw new Error(`operation poll failed (${op.status})`);
    }
    if (op.body && op.body.done) {
      if (op.body.error) throw new Error(`operation error ${op.body.error.code || "failed"}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("operation timed out");
}

async function setEnforced() {
  const token = await accessToken();
  const url = functionUrl();
  let current = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    current = await api(token, url);
    if (current.status === 200) break;
    if (attempt === 5) throw new Error(`read function failed (${current.status})`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  const existing = current.body && current.body.serviceConfig
    ? current.body.serviceConfig.environmentVariables
    : {};
  const next = mergeAppCheckEnv(existing);
  if (publicEnvStatus(existing).FLOQR_APP_CHECK_ENFORCE === "1"
      && publicEnvStatus(next).otherKeys === publicEnvStatus(existing).otherKeys) {
    console.log("FLOQR_APP_CHECK_ENFORCE=1");
    console.log(`otherEnvKeys=${publicEnvStatus(existing).otherKeys}`);
    return;
  }
  const patched = await api(token, `${url}?updateMask=${encodeURIComponent("serviceConfig.environmentVariables")}`, {
    method: "PATCH",
    body: {serviceConfig: {environmentVariables: next}}
  });
  if (patched.status >= 400) throw new Error(`update function failed (${patched.status})`);
  if (patched.body && patched.body.name && patched.body.done !== true && String(patched.body.name).includes("operations/")) {
    await waitForOperation(token, patched.body.name);
  }
  const after = await api(token, url);
  if (after.status !== 200) throw new Error(`confirm read failed (${after.status})`);
  const status = publicEnvStatus(after.body && after.body.serviceConfig
    ? after.body.serviceConfig.environmentVariables
    : {});
  if (status.FLOQR_APP_CHECK_ENFORCE !== "1") {
    throw new Error("FLOQR_APP_CHECK_ENFORCE was not 1 after update");
  }
  console.log("FLOQR_APP_CHECK_ENFORCE=1");
  console.log(`otherEnvKeys=${status.otherKeys}`);
}

module.exports = {mergeAppCheckEnv, publicEnvStatus, KEY};

if (require.main === module) {
  setEnforced().catch((error) => {
    const message = String(error && error.message || "env update failed").replace(/ya29\.[A-Za-z0-9_\-]+/g, "[token]");
    console.error(message);
    process.exit(1);
  });
}
