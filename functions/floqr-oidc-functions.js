/* FloqR OIDC endpoints for FloqMedia Spatial Studio.
   Public client, authorization code + PKCE S256.
   Deployed with [firebase-deploy-spatial] so Continue can issue an auth code. */
"use strict";

const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const core = require("./floqr-oidc-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FLOQR_OIDC_JWT_SECRET = defineSecret("FLOQR_OIDC_JWT_SECRET");
const CALL_OPTS = { region: "us-central1", cors: true, timeoutSeconds: 30, memory: "256MiB" };
const HTTP_OPTS = { region: "us-central1", cors: false, invoker: "public", timeoutSeconds: 30, memory: "256MiB", secrets: [FLOQR_OIDC_JWT_SECRET] };
const CODES = "oidcAuthCodes";

function jwtSecret() {
  try {
    return String(FLOQR_OIDC_JWT_SECRET.value() || process.env.FLOQR_OIDC_JWT_SECRET || "").trim();
  } catch (_) {
    return String(process.env.FLOQR_OIDC_JWT_SECRET || "").trim();
  }
}

function allowLocalhost() {
  return process.env.FLOQR_OIDC_ALLOW_LOCALHOST === "1";
}

function extraRedirects() {
  return String(process.env.FLOQR_OIDC_EXTRA_REDIRECTS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function oidcOpts() {
  return { allowLocalhost: allowLocalhost(), extra: extraRedirects(), issuer: core.DEFAULT_ISSUER };
}

function requireAuth(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in with your FloqR account.");
  return auth.uid;
}

function displayName(auth) {
  const token = auth?.token || {};
  return core.displayNameFromUser({
    uid: auth.uid,
    displayName: token.name,
    name: token.name,
    email: token.email
  });
}

exports.issueFloqrOidcAuthCode = onCall(CALL_OPTS, async (request) => {
  const uid = requireAuth(request.auth);
  const parsed = core.validateAuthorizeRequest(request.data || {}, oidcOpts());
  if (!parsed.ok) {
    throw new HttpsError("invalid-argument", parsed.reason || "invalid_request");
  }
  const issued = core.issueAuthCode({
    ...parsed,
    uid,
    displayName: displayName(request.auth),
    email: core.text(request.auth?.token?.email, 200),
    nonce: parsed.nonce
  });
  await db.collection(CODES).doc(issued.code).set(issued.record);
  const url = new URL(parsed.redirectUri);
  url.searchParams.set("code", issued.code);
  if (parsed.state) url.searchParams.set("state", parsed.state);
  return { code: issued.code, redirect: url.toString(), expiresInSec: Math.floor(core.CODE_TTL_MS / 1000) };
});

function applyCors(req, res) {
  const origin = core.corsOrigin(req.get("origin") || "", oidcOpts());
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return origin;
}

function parseTokenBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  return Object.fromEntries(new URLSearchParams(String(req.rawBody || req.body || "")));
}

exports.floqrOidcToken = onRequest(HTTP_OPTS, async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "invalid_request" });
    return;
  }
  const body = parseTokenBody(req);
  const code = core.text(body.code, 128);
  const snap = code ? await db.collection(CODES).doc(code).get() : { exists: false };
  const record = snap.exists ? snap.data() : null;
  const exchanged = core.exchangeAuthCode(body, record, jwtSecret(), { issuer: core.DEFAULT_ISSUER });
  if (!exchanged.ok) {
    res.status(exchanged.status || 400).json({ error: exchanged.error || "invalid_grant" });
    return;
  }
  await db.collection(CODES).doc(code).set({ usedAtMs: exchanged.usedAtMs }, { merge: true });
  res.status(200).json(exchanged.token);
});

