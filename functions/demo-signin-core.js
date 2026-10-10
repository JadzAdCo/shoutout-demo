/* Demo sign-in code (break-glass while SendGrid is unpaid): pure helpers shared by
   requestEmailOtp and issueDemoSignInCode so both write the same challenge record.
   Design notes: .cursor/rules/design-notes-demo-signin.mdc */
"use strict";

const crypto = require("crypto");
const {isFloqrDemoEmail} = require("./floqr-demo-accounts");

const DEMO_SIGNIN_PURPOSE = "demo-signin-code";
const DEMO_SIGNIN_TTL_MS = 10 * 60 * 1000;
const DEMO_SIGNIN_REISSUE_MS = 10 * 1000;
const EMAIL_OTP_TTL_MS = 6 * 60 * 1000;
const REASON_MIN = 8;
const REASON_MAX = 500;
const DEMO_ROLE_KEYS = Object.freeze(["clubadmin", "waitress", "waiter", "busboy", "bottle", "bartender", "dj", "promoter"]);

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

/** Document id of the email OTP challenge; the Welcome card derives the same id client-side. */
function emailOtpChallengeId(email) {
  return crypto.createHash("sha256").update(String(email || "")).digest("hex");
}

/** Shape read by verifyEmailOtp: email, codeHash, attempts, used, requestedAt, expiresAt (+ locked once tripped). */
function emailOtpChallengeRecord({email, codeHash, requestedAt, expiresAt, extra = null}) {
  return {
    email,
    codeHash,
    attempts: 0,
    used: false,
    requestedAt,
    expiresAt,
    ...(extra && typeof extra === "object" ? extra : {})
  };
}

function demoChallengeExtra({actorUid = "", nowMs = Date.now()} = {}) {
  return {
    source: DEMO_SIGNIN_PURPOSE,
    issuedByUid: text(actorUid, 128),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + DEMO_SIGNIN_TTL_MS
  };
}

/** True while a Master Admin–issued code is still usable, so a Send on the Welcome card must not replace it. */
function adminIssuedChallengeActive(data, nowMs = Date.now()) {
  if (!data || data.source !== DEMO_SIGNIN_PURPOSE) return false;
  if (data.used === true || data.locked === true) return false;
  const expiresAtMs = Number(data.expiresAt?.toMillis?.() || data.expiresAtMs || 0);
  return expiresAtMs > nowMs;
}

function validateDemoSigninRequest(data = {}) {
  const email = text(data.email, 200).toLowerCase();
  const reason = text(data.reason, REASON_MAX);
  if (!isFloqrDemoEmail(email)) {
    return {ok: false, code: "demo-only", email, reason, message: "Only FLOQR demo accounts (temp_<role>_<1-10>@floqr-demo.com) can get a demo sign-in code."};
  }
  if (reason.length < REASON_MIN) {
    return {ok: false, code: "reason", email, reason, message: `Enter a reason of at least ${REASON_MIN} characters. It is saved in the audit trail.`};
  }
  return {ok: true, code: "", email, reason, message: ""};
}

/** systemMailLogs row: records the issue next to email OTP sends, never the code or a body. */
function demoSigninMailLogRow({email, actorUid = "", actorEmail = "", nowMs = Date.now(), packageVersion = ""}) {
  return {
    kind: "email-otp",
    source: "issueDemoSignInCode",
    trigger: "callable",
    purpose: DEMO_SIGNIN_PURPOSE,
    to: [],
    toLower: "",
    from: "",
    subject: `[FLOQR demo → ${email}] sign-in code issued in Master Admin (not emailed)`,
    textBody: "",
    htmlBody: "",
    bodyRedacted: true,
    attachmentNames: [],
    packageVersion: text(packageVersion, 40),
    status: "issued-in-app",
    sendOk: false,
    httpStatus: 0,
    sendgridMessageId: "",
    extra: {
      purpose: DEMO_SIGNIN_PURPOSE,
      demoIntendedEmail: email,
      issuedByUid: text(actorUid, 128),
      issuedByEmail: text(actorEmail, 200).toLowerCase(),
      expiresAtMs: nowMs + DEMO_SIGNIN_TTL_MS
    },
    events: [],
    error: "",
    createdAtMs: nowMs,
    updatedAtMs: nowMs
  };
}

module.exports = {
  DEMO_SIGNIN_PURPOSE,
  DEMO_SIGNIN_TTL_MS,
  DEMO_SIGNIN_REISSUE_MS,
  EMAIL_OTP_TTL_MS,
  REASON_MIN,
  DEMO_ROLE_KEYS,
  emailOtpChallengeId,
  emailOtpChallengeRecord,
  demoChallengeExtra,
  adminIssuedChallengeActive,
  validateDemoSigninRequest,
  demoSigninMailLogRow
};
