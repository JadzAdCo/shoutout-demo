/* BOT DEE conversation personalization — name, demeanor, recap, last-used.
   Versioned first-use (botDeePersonalizationVersion). last-used key userbotdeelastUsedtime.
   Guest prefs stay in the browser; signed-in prefs live on botDeeThreads/{uid}. */
"use strict";

const CURRENT_VERSION = 1;
const LAST_USED_FIELD = "userbotdeelastUsedtime";
const DEMEANORS = Object.freeze(["sociallyCool", "professional", "balanced"]);
const MAX_NAME = 40;

function clipName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

function firstNameFromDisplayName(raw) {
  const name = clipName(raw);
  if (!name) return "";
  const first = name.split(" ")[0];
  return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{0,39}$/.test(first) ? first : "";
}

function normalizeDemeanor(raw) {
  const key = String(raw || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
  if (key === "sociallycool" || key === "cool" || key === "social") return "sociallyCool";
  if (key === "professional" || key === "pro") return "professional";
  if (key === "balanced" || key === "balance") return "balanced";
  return "balanced";
}

function flag01(raw, fallback = 1) {
  if (raw === 0 || raw === "0" || raw === false) return 0;
  if (raw === 1 || raw === "1" || raw === true) return 1;
  return fallback === 0 ? 0 : 1;
}

function timeOfDay(nowMs, hourOverride) {
  const hour = Number.isInteger(hourOverride)
    ? hourOverride
    : new Date(Number(nowMs) || Date.now()).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function greetingLead(slot) {
  if (slot === "morning") return "Good morning";
  if (slot === "evening") return "Good evening";
  return "Good afternoon";
}

function normalizePersonalization(raw, extras) {
  const src = raw && typeof raw === "object" ? raw : {};
  const extra = extras && typeof extras === "object" ? extras : {};
  const name = clipName(src.preferredAddressName);
  const version = Math.max(0, Math.floor(Number(src.botDeePersonalizationVersion) || 0));
  return {
    preferredAddressName: name,
    demeanor: normalizeDemeanor(src.demeanor),
    remindWhereLeftOff: flag01(src.remindWhereLeftOff, 1),
    botDeePersonalizationVersion: version,
    profileFirstName: clipName(extra.profileFirstName || src.profileFirstName),
    [LAST_USED_FIELD]: Number(extra[LAST_USED_FIELD] || src[LAST_USED_FIELD]) || 0
  };
}

function needsOnboarding(personalization) {
  const row = normalizePersonalization(personalization);
  return row.botDeePersonalizationVersion < CURRENT_VERSION;
}

function nextLastUsed(previousMs, nowMs) {
  const prev = Number(previousMs) || 0;
  const now = Number(nowMs) || Date.now();
  return now >= prev ? now : prev;
}

function greetingFor(personalization, opts) {
  const row = normalizePersonalization(personalization);
  const options = opts && typeof opts === "object" ? opts : {};
  const slot = timeOfDay(options.nowMs, options.hour);
  const name = row.preferredAddressName;
  const lead = greetingLead(slot);
  if (row.demeanor === "sociallyCool") {
    return name ? `Wassup, ${name}! What's the move?` : "Wassup! What's the move?";
  }
  if (row.demeanor === "professional") {
    return name ? `${lead}, ${name}. How can I help?` : `${lead}. How can I help?`;
  }
  return name ? `Hey, ${lead.toLowerCase()}, ${name}. What are we working on?` : `Hey, ${lead.toLowerCase()}. What are we working on?`;
}

function recapFromTurns(turns) {
  const rows = (Array.isArray(turns) ? turns : [])
    .map(row => ({
      role: row?.role === "model" || row?.role === "assistant" ? "model" : "user",
      text: String(row?.text || "").replace(/\s+/g, " ").trim()
    }))
    .filter(row => row.text && !/^(hey|hi|hello|howdy|yo|sup|hiya|hola)\b/i.test(row.text));
  const last = rows.slice(-2);
  if (!last.length) return "";
  return last
    .map(row => (row.role === "user" ? `You: ${row.text.slice(0, 140)}` : `BOT DEE: ${row.text.slice(0, 140)}`))
    .join(" ");
}

function formatActionLine(link) {
  if (!link || typeof link !== "object") return "";
  const kind = String(link.kind || "").toLowerCase();
  const status = String(link.status || link.state || "Ready").replace(/\s+/g, " ").trim() || "Ready";
  const action =
    kind === "shoutout" ? "ShoutOut requested"
      : kind === "checkout" ? "Payment needed"
        : kind === "vip" ? "VIP hold"
          : kind === "floqcast" ? "floqCast request"
            : String(link.label || "Action").replace(/\s+/g, " ").trim();
  return `${action} · ${status} · View`;
}

function formatActionHistory(links) {
  const lines = (Array.isArray(links) ? links : [])
    .map(formatActionLine)
    .filter(Boolean);
  return Array.from(new Set(lines)).slice(0, 3).join("\n");
}

function appendActionHistory(reply, links) {
  const text = String(reply || "").trim();
  const history = formatActionHistory(links);
  if (!history) return text;
  if (text.includes(" · View")) return text;
  return text ? `${text}\n${history}` : history;
}

function personalizationInstruction(personalization) {
  const row = normalizePersonalization(personalization);
  const nameLine = row.preferredAddressName
    ? `Address the viewer as "${row.preferredAddressName}" when a greeting or name is natural — do not overuse it.`
    : "Do not invent a nickname. If you need a name, ask once.";
  const tone =
    row.demeanor === "sociallyCool"
      ? 'Demeanor Socially Cool: casual club energy (e.g. "Wassup, Boss! What\'s the move?"). Keep dates, prices, payment requirements, and errors clear.'
      : row.demeanor === "professional"
        ? 'Demeanor Professional: calm and precise (e.g. "Good afternoon. How can I help?"). Keep dates, prices, payment requirements, and errors clear.'
        : 'Demeanor Balanced: friendly and efficient (e.g. "Hey, good afternoon. What are we working on?"). Keep dates, prices, payment requirements, and errors clear.';
  const recap = row.remindWhereLeftOff === 1
    ? "If they ask where you left off, recap the last two meaningful turns plus the latest real action status — not the full transcript."
    : "Do not volunteer a recap unless they ask.";
  return [
    nameLine,
    tone,
    recap,
    "Never open a greeting by listing ShoutOut, VIP, floqCast, or other products. Ask how you can help in one short line.",
    "When a material new instruction conflicts with an earlier choice in THIS conversation, briefly and positively reference the earlier position, then ask whether the new direction is the one they want NOW. Do not say they contradicted themselves. Follow an explicit change of direction without redundant questions.",
    "Do not narrate internal tool steps. After a requested action, one short line: '{Action} · {Status} · View' using real backend status."
  ].join(" ");
}

function fromThread(data, extras) {
  const row = data && typeof data === "object" ? data : {};
  return normalizePersonalization(row.personalization || row, {
    profileFirstName: extras?.profileFirstName,
    [LAST_USED_FIELD]: row[LAST_USED_FIELD]
  });
}

function writePayload(input) {
  const row = normalizePersonalization(input);
  return {
    preferredAddressName: row.preferredAddressName,
    demeanor: row.demeanor,
    remindWhereLeftOff: row.remindWhereLeftOff,
    botDeePersonalizationVersion: CURRENT_VERSION
  };
}

module.exports = {
  CURRENT_VERSION,
  LAST_USED_FIELD,
  DEMEANORS,
  clipName,
  firstNameFromDisplayName,
  normalizeDemeanor,
  normalizePersonalization,
  needsOnboarding,
  nextLastUsed,
  timeOfDay,
  greetingFor,
  recapFromTurns,
  formatActionLine,
  formatActionHistory,
  appendActionHistory,
  personalizationInstruction,
  fromThread,
  writePayload
};
