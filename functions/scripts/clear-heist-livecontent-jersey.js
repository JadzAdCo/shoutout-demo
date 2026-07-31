/**
 * One-shot: clear Heist liveContent jersey/background ghost leftovers.
 * Uses Firestore REST + Firebase CLI OAuth tokens (no ADC required).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { UserRefreshClient } = require(path.join(__dirname, "..", "node_modules", "google-auth-library"));

const PROJECT_ID = "shoutoutdemo-5b402";
const DOC_ID = "heist-washington-dc";
const DOC_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/liveContent/${DOC_ID}`;

function loadTokens() {
  const p = path.join(process.env.USERPROFILE || "", ".config", "configstore", "firebase-tools.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const tokens = j.tokens || {};
  if (!tokens.refresh_token) throw new Error("No Firebase CLI refresh_token. Run: npx firebase login");
  return tokens;
}

async function getAccessToken(tokens) {
  const expiresAt = Number(tokens.expires_at || 0);
  if (tokens.access_token && expiresAt > Date.now() + 60_000) {
    return tokens.access_token;
  }
  const client = new UserRefreshClient(
    "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    "j9iVZfS8kkCEFUPaAeJV0sAi",
    tokens.refresh_token
  );
  const r = await client.getAccessToken();
  if (!r || !r.token) throw new Error("Failed to refresh Firebase CLI access token");
  return r.token;
}

function fromFirestoreValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) {
    const out = {};
    const fields = (v.mapValue && v.mapValue.fields) || {};
    for (const [k, vv] of Object.entries(fields)) out[k] = fromFirestoreValue(vv);
    return out;
  }
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fromFirestoreValue);
  return v;
}

function toStringValue(s) {
  return { stringValue: String(s ?? "") };
}

async function firestoreFetch(accessToken, method, urlPath, body) {
  const url = `https://firestore.googleapis.com/v1/${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Firestore ${method} ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function pickFields(fields, keys) {
  const out = {};
  for (const k of keys) {
    out[k] = fields[k] === undefined ? null : fromFirestoreValue(fields[k]);
  }
  return out;
}

async function main() {
  const tokens = loadTokens();
  const accessToken = await getAccessToken(tokens);

  const interesting = [
    "template", "mainText", "subText", "status", "source",
    "backgroundUrl", "backgroundColor", "backgroundGradient", "backgroundType", "backgroundStoragePath",
    "jerseyTeamId", "jerseyTeamLabel", "jerseyPrimary", "jerseySecondary", "jerseyAccent", "jerseyCssBack",
    "mediaUrl", "mediaType", "mediaStoragePath", "updatedAt"
  ];

  const beforeDoc = await firestoreFetch(accessToken, "GET", DOC_PATH);
  const beforeFields = beforeDoc.fields || {};
  const beforePick = pickFields(beforeFields, interesting);
  const beforeTemplate = beforePick.template || "";
  const keepHeist = String(beforeTemplate).toLowerCase().startsWith("heist");
  const nextTemplate = keepHeist ? "heistVaultNight" : "blackwhite";

  const updateFields = {
    template: toStringValue(nextTemplate),
    mainText: toStringValue(""),
    subText: toStringValue(""),
    backgroundUrl: toStringValue(""),
    backgroundColor: toStringValue(""),
    backgroundGradient: toStringValue(""),
    backgroundType: toStringValue(""),
    backgroundStoragePath: toStringValue(""),
    jerseyTeamId: toStringValue(""),
    jerseyTeamLabel: toStringValue(""),
    jerseyPrimary: toStringValue(""),
    jerseySecondary: toStringValue(""),
    jerseyAccent: toStringValue(""),
    mediaUrl: toStringValue(""),
    mediaType: toStringValue(""),
    mediaStoragePath: toStringValue(""),
    status: toStringValue("default"),
    source: toStringValue("manualHeistJerseyGhostCleanup"),
    updatedAt: { timestampValue: new Date().toISOString() },
  };

  // Clear jerseyCssBack by omitting it from update and using updateMask + currentDocument;
  // Firestore PATCH with updateMask can delete via fieldPaths when value is absent if we use a transform.
  // Use commit with update + FieldTransform... simpler: PATCH with fields including nullValue for jerseyCssBack.
  updateFields.jerseyCssBack = { nullValue: null };

  const fieldPaths = Object.keys(updateFields);
  const qs = fieldPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&");
  const afterWrite = await firestoreFetch(
    accessToken,
    "PATCH",
    `${DOC_PATH}?${qs}`,
    { fields: updateFields }
  );

  // Delete jerseyCssBack properly via commit FieldTransform / update with delete — use :commit
  await firestoreFetch(accessToken, "POST", `projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
    writes: [
      {
        update: {
          name: DOC_PATH,
          fields: {},
        },
        updateMask: { fieldPaths: ["jerseyCssBack"] },
        currentDocument: { exists: true },
      },
    ],
  }).catch(async () => {
    // Fallback: second PATCH setting delete via updateMask alone is not enough; use Document.delete transform
    await firestoreFetch(accessToken, "POST", `projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
      writes: [
        {
          transform: {
            document: DOC_PATH,
            fieldTransforms: [
              // No delete transform in older API — use update with mask only after null.
            ],
          },
        },
      ],
    }).catch(() => null);
  });

  // Proper delete of jerseyCssBack using update with empty + updateMask in a single write that omits the field
  // Firestore REST delete field: write.update + updateMask listing the field, and do NOT include the field in update.fields
  await firestoreFetch(accessToken, "POST", `projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
    writes: [
      {
        update: { name: DOC_PATH, fields: {} },
        updateMask: { fieldPaths: ["jerseyCssBack"] },
      },
    ],
  });

  const afterDoc = await firestoreFetch(accessToken, "GET", DOC_PATH);
  const afterPick = pickFields(afterDoc.fields || {}, interesting);

  console.log(JSON.stringify({
    ok: true,
    projectId: PROJECT_ID,
    docId: DOC_ID,
    templateDecision: { before: beforeTemplate || null, after: nextTemplate, keepHeist },
    before: beforePick,
    after: afterPick,
    writeName: afterWrite.name || null,
  }, null, 2));
}

main().catch((err) => {
  console.error(String(err && err.stack || err));
  process.exit(1);
});
