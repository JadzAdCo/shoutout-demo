/* FloqR OIDC public client for FloqMedia Spatial Studio.
   Authorization code + PKCE S256. JWT payload includes sub, iss, exp.
   FloqMedia does not verify the signature in the browser; production cloud
   save still needs a server that verifies it. Do not put tokens in spatial
   project files. Design: docs/FLOQR-OIDC-FLOQMEDIA.md */
"use strict";

const crypto = require("crypto");

const CLIENT_ID = "floqmedia-spatial-studio";
const DEFAULT_ISSUER = "https://jadzadco.github.io/shoutout-demo";
const TOKEN_URL = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/floqrOidcToken";
const SCOPE = "openid";
const CODE_TTL_MS = 60 * 1000;
const ACCESS_TTL_SEC = 3600;
const PKCE_CHAR = /^[A-Za-z0-9\-._~]{43,128}$/;

const PRODUCTION_REDIRECTS = Object.freeze([
  "https://studio.floqmedia.com/auth/callback",
  "https://studio.floqmedia.com/spatial-studio/auth/callback",
  "https://www.floqmedia.com/spatial-studio/auth/callback",
  "https://floqmedia.com/spatial-studio/auth/callback"
]);

function text(value, max = 400) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function issuerOf(value) {
  return text(value, 200).replace(/\/$/, "") || DEFAULT_ISSUER;
}

function allowedRedirects({ allowLocalhost = false, extra = [] } = {}) {
  const out = [...PRODUCTION_REDIRECTS];
  if (allowLocalhost) {
    out.push("http://localhost:3000/auth/callback");
    out.push("http://127.0.0.1:3000/auth/callback");
    out.push("http://localhost:3000/spatial-studio/auth/callback");
    out.push("http://127.0.0.1:3000/spatial-studio/auth/callback");
  }
  (extra || []).forEach((uri) => {
    const clean = text(uri, 400);
    if (clean && !out.includes(clean)) out.push(clean);
  });
  return out;
}

/** Values FloqMedia reads from env. Localhost redirects are off unless allowLocalhost. */
function floqmediaRegistration(opts = {}) {
  const issuer = issuerOf(opts.issuer);
  return {
    NEXT_PUBLIC_FLOQR_ISSUER: issuer,
    NEXT_PUBLIC_FLOQR_CLIENT_ID: CLIENT_ID,
    NEXT_PUBLIC_FLOQR_AUTHORIZE_URL: `${issuer}/floqr-oidc-authorize.html`,
    NEXT_PUBLIC_FLOQR_TOKEN_URL: opts.tokenUrl || TOKEN_URL,
    redirect_uris: allowedRedirects(opts),
    token_endpoint_auth_method: "none",
    response_type: "code",
    scope: SCOPE,
    code_challenge_method: "S256"
  };
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function s256Challenge(verifier) {
  return crypto.createHash("sha256").update(String(verifier), "ascii").digest("base64url");
}

function signJwt(payload, secret, { expiresInSec = ACCESS_TTL_SEC, nowMs } = {}) {
  if (!secret) throw new Error("oidc_secret_missing");
  const now = Math.floor((Number(nowMs) || Date.now()) / 1000);
  const body = {
    ...payload,
    iat: payload.iat || now,
    exp: payload.exp || now + expiresInSec,
    iss: payload.iss || DEFAULT_ISSUER,
    sub: String(payload.sub || "")
  };
  if (!body.sub) throw new Error("oidc_sub_required");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${sig}`;
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function verifyJwt(token, secret, { nowMs, issuer } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  if (!secret) return { ok: false, reason: "oidc_secret_missing" };
  const expected = crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub || !payload.iss || !payload.exp) {
    return { ok: false, reason: "missing_claims" };
  }
  const nowSec = Math.floor((Number(nowMs) || Date.now()) / 1000);
  if (Number(payload.exp) <= nowSec) return { ok: false, reason: "expired" };
  if (issuer && payload.iss !== issuerOf(issuer)) return { ok: false, reason: "iss_mismatch" };
  return { ok: true, payload };
}

function validateAuthorizeRequest(query, opts = {}) {
  const clientId = text(query.client_id, 80);
  const redirectUri = text(query.redirect_uri, 400);
  const responseType = text(query.response_type, 20);
  const scope = text(query.scope, 80) || SCOPE;
  const method = text(query.code_challenge_method, 10);
  const challenge = text(query.code_challenge, 128);
  const state = text(query.state, 256);
  const nonce = text(query.nonce, 128);
  const redirects = allowedRedirects(opts);

  if (clientId !== CLIENT_ID) return { ok: false, reason: "unknown_client", redirect: false };
  if (!redirects.includes(redirectUri)) return { ok: false, reason: "redirect_uri_denied", redirect: false };
  if (responseType !== "code") return { ok: false, reason: "unsupported_response_type", redirect: true, redirectUri, state };
  if (scope.split(/\s+/).indexOf("openid") < 0) {
    return { ok: false, reason: "invalid_scope", redirect: true, redirectUri, state };
  }
  if (method !== "S256") return { ok: false, reason: "pkce_s256_required", redirect: true, redirectUri, state };
  if (!PKCE_CHAR.test(challenge)) return { ok: false, reason: "invalid_code_challenge", redirect: true, redirectUri, state };
  return {
    ok: true,
    clientId,
    redirectUri,
    scope: SCOPE,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state,
    nonce
  };
}

function newAuthCode() {
  return crypto.randomBytes(32).toString("base64url");
}

function issueAuthCode(params, { nowMs } = {}) {
  const now = Number(nowMs) || Date.now();
  const code = newAuthCode();
  return {
    code,
    record: {
      code,
      clientId: CLIENT_ID,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: "S256",
      uid: text(params.uid, 128),
      displayName: text(params.displayName, 120),
      email: text(params.email, 200),
      nonce: text(params.nonce, 128),
      createdAtMs: now,
      expiresAtMs: now + CODE_TTL_MS,
      usedAtMs: 0
    }
  };
}

function exchangeAuthCode(body, storeRecord, secret, opts = {}) {
  const grantType = text(body.grant_type, 40);
  const code = text(body.code, 128);
  const redirectUri = text(body.redirect_uri, 400);
  const clientId = text(body.client_id, 80);
  const verifier = text(body.code_verifier, 128);
  const now = Number(opts.nowMs) || Date.now();

  if (grantType !== "authorization_code") return { ok: false, status: 400, error: "unsupported_grant_type" };
  if (clientId !== CLIENT_ID) return { ok: false, status: 400, error: "invalid_client" };
  if (!PKCE_CHAR.test(verifier)) return { ok: false, status: 400, error: "invalid_grant" };
  if (!storeRecord) return { ok: false, status: 400, error: "invalid_grant" };
  if (storeRecord.usedAtMs) return { ok: false, status: 400, error: "invalid_grant" };
  if (now >= Number(storeRecord.expiresAtMs || 0)) return { ok: false, status: 400, error: "invalid_grant" };
  if (storeRecord.redirectUri !== redirectUri) return { ok: false, status: 400, error: "invalid_grant" };
  if (s256Challenge(verifier) !== storeRecord.codeChallenge) return { ok: false, status: 400, error: "invalid_grant" };
  if (!storeRecord.uid) return { ok: false, status: 400, error: "invalid_grant" };
  if (!secret) return { ok: false, status: 500, error: "server_error" };

  const payload = {
    iss: issuerOf(opts.issuer),
    sub: storeRecord.uid,
    aud: CLIENT_ID,
    nonce: storeRecord.nonce || undefined,
    name: storeRecord.displayName || undefined,
    preferred_username: storeRecord.displayName || storeRecord.email || undefined,
    email: storeRecord.email || undefined
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  const jwt = signJwt(payload, secret, { nowMs: now, expiresInSec: ACCESS_TTL_SEC });
  return {
    ok: true,
    usedAtMs: now,
    token: {
      access_token: jwt,
      id_token: jwt,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SEC
    }
  };
}

function corsOrigin(origin, opts = {}) {
  const allowed = new Set(
    allowedRedirects(opts).map((uri) => {
      try {
        return new URL(uri).origin;
      } catch (_) {
        return "";
      }
    }).filter(Boolean)
  );
  const clean = text(origin, 200);
  return allowed.has(clean) ? clean : "";
}

function displayNameFromUser(user = {}) {
  return text(user.displayName || user.name || user.email || user.uid, 120);
}

module.exports = {
  CLIENT_ID,
  DEFAULT_ISSUER,
  TOKEN_URL,
  SCOPE,
  CODE_TTL_MS,
  ACCESS_TTL_SEC,
  PRODUCTION_REDIRECTS,
  text,
  issuerOf,
  allowedRedirects,
  floqmediaRegistration,
  s256Challenge,
  signJwt,
  decodeJwtPayload,
  verifyJwt,
  validateAuthorizeRequest,
  issueAuthCode,
  exchangeAuthCode,
  corsOrigin,
  displayNameFromUser
};
