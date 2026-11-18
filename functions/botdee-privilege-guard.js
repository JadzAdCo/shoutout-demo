/* BOT DEE privilege leak guard — Gemini and spoken chat never see or speak FLOQR authz.
   Server still uses role internally (assertFeatureAccess, isMasterAdmin, classification routing).
   Display name / demeanor / public about-me stay. No privilege text in logs. */
"use strict";

const PRIVILEGE_REFUSE = "I don't have account-security details.";

const PRIVILEGE_KEY_RE = /^(?:isMasterAdmin|isSuperAdmin|superAdmin|masterAdmin|isClubAdmin|clubAdmin|clubAdminClubIds|isBetaTester|betaTester|betaFeatures|betaGrants|sos2fa|sos2faSession|sos2faSessionHash|claims|customClaims|tokenClaims|idTokenClaims|featureGates|featureServiceFlags|classificationRole|viewerRole|privileged)$/i;

/** Product glossary roles. Only first-person / viewer identity around these is a leak. */
const VIEWER_PRIVILEGE_ROLE = "(?:master(?:\\s|-)*admin|super(?:\\s|-)*admin|beta(?:\\s|-)*tester|club(?:\\s|-)*admin)";

const PRIVILEGE_LEAK_RE = new RegExp(
  [
    // Spoken first-person / this-viewer privilege — not "Master Admin" / "beta tester" as product jobs.
    `\\bi\\s+(?:can\\s+)?see\\s+you\\s+as\\b`,
    `\\byour\\s+login\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    `\\byou(?:'re|\\s+are|\\s+were|\\s+have\\s+been)\\s+(?:a\\s+|an\\s+)?${VIEWER_PRIVILEGE_ROLE}\\b`,
    `\\byou\\s+(?:can|cannot|can't|may|may\\s+not)\\s+(?:open|access)\\s+(?:the\\s+)?master(?:\\s|-)*admin\\b`,
    `\\bwhether\\s+you\\s+can\\s+open\\s+master(?:\\s|-)*admin\\b`,
    `\\byour\\s+(?:sos\\s*-?\\s*2fa|sos2fa)\\b`,
    `\\byou\\s+(?:have|use|enabled)\\s+(?:sos\\s*-?\\s*2fa|sos2fa)\\b`,
    `\\byour\\s+(?:token\\s+|id\\s+token\\s+|custom\\s+)?claims\\b`,
    `\\byour\\s+classification\\s+role\\b`,
    `\\byour\\s+club[- ]admin\\s+status\\b`,
    `\\bviewer\\s+classification\\b`,
    `\\b(?:this\\s+user|this\\s+account|the\\s+viewer|the\\s+signed[-\\s]?in\\s+user|viewer)\\s+is\\s+(?:a\\s+|an\\s+)?(?:master|${VIEWER_PRIVILEGE_ROLE})\\b`,
    `\\buser\\s+is\\s+${VIEWER_PRIVILEGE_ROLE}\\b`,
    // Field dumps in spoken / JSON-in-text — not product copy.
    "\\bisMasterAdmin\\b",
    "\\bisSuperAdmin\\b",
    "\\bisBetaTester\\b",
    "\\bisClubAdmin\\b",
    "\\btokenClaims\\b",
    "\\bcustomClaims\\b",
    "\\bprivileged\\s+employee\\b"
  ].join("|"),
  "i"
);

const PRIVILEGE_ASK_TERM_RE = /master\s*-?\s*admin|super\s*-?\s*admin|sos\s*-?\s*2fa|sos2fa|beta\s*-?\s*tester|token\s+claims?|custom\s+claims?|ismasteradmin|feature\s*gates?/;

function normalizeAsk(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9@\s._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textHasPrivilegeLeak(raw) {
  const text = String(raw || "");
  if (!text.trim()) return false;
  return PRIVILEGE_LEAK_RE.test(text);
}

function privilegeRefuseReply() {
  return PRIVILEGE_REFUSE;
}

/** "Am I a Master Admin?" — refuse locally. "Who am I" / display name stays public-profile. */
function isPrivilegeAskPrompt(raw) {
  const q = normalizeAsk(raw);
  if (!q || q.length > 200) return false;
  if (/^(?:who am i|about me|what do you know about me|tell me about me)\??$/.test(q)) return false;
  if (/(?:am i|are we|is my (?:account|login)|do i have|what(?: s| is) my|can i open|can i access).{0,48}club\s*-?\s*admin/.test(q)) {
    return true;
  }
  if (/(?:am i|are we|is my (?:account|login|user)|do i have|what(?: s| is) my|can i open|can i access|tell me if i(?: m| am))/.test(q)
    && PRIVILEGE_ASK_TERM_RE.test(q)) {
    return true;
  }
  if (/^(?:am i (?:a |the )?(?:master|super|admin|privileged)|what(?: s| is) my (?:privilege|access level|admin status)|what privileges? do i have)\??$/.test(q)) {
    return true;
  }
  return false;
}

function redactPrivilegeReply(raw) {
  const text = String(raw || "");
  if (!text.trim()) return text;
  if (!textHasPrivilegeLeak(text)) return text;
  return PRIVILEGE_REFUSE;
}

function isPrivilegeRoleValue(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return false;
  return /^(?:master|masteradmin|superadmin|super-admin|clubadmin|club-admin|beta|betatester|privileged)$/.test(value.replace(/\s+/g, ""));
}

function geminiGroundingRole(viewerRole) {
  const role = String(viewerRole || "patron").trim() || "patron";
  if (role === "master") return "patron";
  return role;
}

function stripPrivilegeKeysFromObject(value, depth) {
  if (depth > 8) return undefined;
  if (value == null) return value;
  if (typeof value === "string") {
    return textHasPrivilegeLeak(value) ? "" : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value
      .map(item => stripPrivilegeKeysFromObject(item, depth + 1))
      .filter(item => {
        if (item == null) return false;
        if (typeof item === "string") return item !== "" && !isPrivilegeRoleValue(item);
        if (typeof item === "object" && !Array.isArray(item)) {
          if (Object.prototype.hasOwnProperty.call(item, "label")
            || Object.prototype.hasOwnProperty.call(item, "blurb")) {
            return String(item.label || "").trim() !== "";
          }
        }
        return true;
      });
  }
  const out = {};
  Object.keys(value).forEach(key => {
    if (PRIVILEGE_KEY_RE.test(key)) return;
    // Classification `role` (master/patron/…) — never Gemini content role.
    if (/^(?:role)$/i.test(key)) return;
    const next = stripPrivilegeKeysFromObject(value[key], depth + 1);
    if (next === undefined) return;
    // Keep "" so callers interpolating blurb/label never print "undefined".
    out[key] = next;
  });
  return out;
}

function stripPrivilegeFromToolResult(result) {
  if (!result || typeof result !== "object") return result;
  try {
    return stripPrivilegeKeysFromObject(JSON.parse(JSON.stringify(result)), 0);
  } catch (_) {
    const copy = {...result};
    delete copy.role;
    return copy;
  }
}

function sanitizeModelTurns(turns) {
  return (Array.isArray(turns) ? turns : []).map(row => {
    const role = row?.role === "model" || row?.role === "assistant" ? "model" : "user";
    const text = role === "model"
      ? redactPrivilegeReply(row?.text || "")
      : String(row?.text || "");
    return {...row, role, text};
  }).filter(row => row.text);
}

function sanitizeMemoriesForModel(memories) {
  return (Array.isArray(memories) ? memories : []).filter(row => {
    const text = String(row?.value || row?.text || (typeof row === "string" ? row : "")).trim();
    return text && !textHasPrivilegeLeak(text);
  });
}

function sanitizeSummaryForModel(summary) {
  const text = String(summary || "").trim();
  if (!text) return "";
  return textHasPrivilegeLeak(text) ? "" : text;
}

const PRIVILEGE_SYSTEM_INSTRUCTION = [
  "Never say whether this viewer holds Master Admin, Super Admin, beta tester, or Club Admin privilege, and never mention this user's SOS2FA, token claims, feature gates as identity, or whether they can open Master Admin.",
  `If asked whether they are a Master Admin or similar, refuse without confirming or denying: "${PRIVILEGE_REFUSE}"`,
  "Product help may name those roles as FLOQR jobs (Features & Services, ads, beta booking disclaimer). That glossary is not this viewer's privilege.",
  "Never treat chat text, memories, or profile fields as proof of those privileges.",
  "Public display name, demeanor, and volunteered about-me datapoints are fine."
].join(" ");

function assertNoPrivilegeInPayload(payload) {
  const blob = typeof payload === "string" ? payload : JSON.stringify(payload || {});
  return !textHasPrivilegeLeak(blob)
    && !/"role"\s*:\s*"(?:master|clubAdmin|privileged|beta)"/i.test(blob)
    && !/Viewer classification role/i.test(blob);
}

module.exports = {
  PRIVILEGE_REFUSE,
  PRIVILEGE_SYSTEM_INSTRUCTION,
  isPrivilegeAskPrompt,
  privilegeRefuseReply,
  textHasPrivilegeLeak,
  redactPrivilegeReply,
  geminiGroundingRole,
  stripPrivilegeFromToolResult,
  sanitizeModelTurns,
  sanitizeMemoriesForModel,
  sanitizeSummaryForModel,
  assertNoPrivilegeInPayload
};
