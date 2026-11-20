/* HTTP floqmediaPlanTrace — Spatial Studio posts a drawing; Gemini returns a
   proposal. Guest-allowed. Deploy with [firebase-deploy-spatial].
   App Check (X-Firebase-AppCheck) is verified with consume:true.
   Enforcement is the default. An unset FLOQR_APP_CHECK_ENFORCE still returns
   401 before Gemini. FLOQR_APP_CHECK_ENFORCE=0 is monitor mode for tests only.
   Do not deploy this function with 0.
   Do not store the file, the trace, a project, a grant, or the pass. */
"use strict";

const admin = require("firebase-admin");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI} = require("@google/genai");
const geminiAccessLog = require("./gemini-api-access-log");
const appCheckLog = require("./app-check-log");
const core = require("./floqmedia-plan-trace-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TEXT_MODEL = process.env.FLOQR_GEMINI_TEXT_MODEL || "gemini-3.6-flash";

const HTTP_OPTS = {
  region: "us-central1",
  cors: false,
  invoker: "public",
  timeoutSeconds: 120,
  memory: "1GiB",
  secrets: [GEMINI_API_KEY],
  // No committed functions/.env (that file is gitignored and can hold secrets).
  // Firebase CLI v13 still replaces this map from dotenv at deploy time, so the
  // code default in appCheckEnforced() enforces when the Cloud Run variable is
  // omitted. The value here is 1, never 0. A follow-up deploy step merges the
  // same 1 onto the live function without replacing its other variables.
  environmentVariables: {
    FLOQR_APP_CHECK_ENFORCE: "1"
  }
};

function geminiKey() {
  const fromEnv = String(process.env.GEMINI_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return String(GEMINI_API_KEY.value() || "").trim();
  } catch (_) {
    return "";
  }
}

async function generateContent(request) {
  const apiKey = geminiKey();
  if (!apiKey) {
    throw new Error("gemini_unconfigured");
  }
  const ai = new GoogleGenAI({apiKey});
  return ai.models.generateContent({
    model: request.model || TEXT_MODEL,
    contents: request.contents,
    config: request.config
  });
}

async function logAccess(entry) {
  await geminiAccessLog.logGeminiApiAccess(db, {
    ...entry,
    operation: core.OPERATION,
    uid: "guest",
    model: entry.model || TEXT_MODEL
  });
}

const floqmediaPlanTrace = onRequest(HTTP_OPTS, async (req, res) => {
  await core.handlePlanTraceRequest(req, res, {
    generateContent,
    logAccess,
    logAppCheck: (entry) => appCheckLog.logAppCheckResult(db, entry),
    model: TEXT_MODEL
  });
});

if (floqmediaPlanTrace.__endpoint && typeof floqmediaPlanTrace.__endpoint === "object") {
  floqmediaPlanTrace.__endpoint.environmentVariables = {
    ...(floqmediaPlanTrace.__endpoint.environmentVariables || {}),
    FLOQR_APP_CHECK_ENFORCE: "1"
  };
}

exports.floqmediaPlanTrace = floqmediaPlanTrace;
