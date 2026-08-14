/* FLOQR venue website ingest helpers — no Firebase. */
"use strict";

const crypto = require("crypto");

const DEFAULT_ORIGIN = "https://jadzadco.github.io/shoutout-demo";
const DEFAULT_API = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/venuePublicFeed";

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function hashIngestSecret(secret = "") {
  return crypto.createHash("sha256").update(String(secret || ""), "utf8").digest("hex");
}

function newIngestSecret() {
  return `floq_ingest_${crypto.randomBytes(18).toString("hex")}`;
}

function secretsMatch(provided = "", storedHash = "") {
  const got = hashIngestSecret(provided);
  const want = text(storedHash, 80).toLowerCase();
  if (!provided || got.length !== want.length || !/^[a-f0-9]+$/.test(want)) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(want, "utf8"));
  } catch (_error) {
    return false;
  }
}

function opaqueAssigneeKey(uid = "") {
  const raw = text(uid, 160);
  if (!raw) return "";
  return hashIngestSecret(raw).slice(0, 16);
}

function obfuscateSecret(secret = "") {
  const raw = text(secret, 80);
  if (raw.length < 12) return raw ? `${raw.slice(0, 4)}…` : "";
  return `${raw.slice(0, 12)}…${raw.slice(-4)}`;
}

function xmlEscape(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function feedUrls({locationId = "", secret = "", origin = DEFAULT_ORIGIN, apiBase = DEFAULT_API} = {}) {
  const loc = encodeURIComponent(text(locationId, 160));
  const key = encodeURIComponent(text(secret, 80));
  const api = String(apiBase || DEFAULT_API).replace(/\/$/, "");
  const site = String(origin || DEFAULT_ORIGIN).replace(/\/$/, "");
  const qs = `location=${loc}${key ? `&secret=${key}` : ""}`;
  return {
    json: `${api}?${qs}&format=json&dataset=schedule`,
    rss: `${api}?${qs}&format=rss&dataset=schedule`,
    hours: `${api}?${qs}&format=json&dataset=hours`,
    profile: `${api}?${qs}&format=json&dataset=profile`,
    all: `${api}?${qs}&format=json&dataset=all`,
    iframe: `${site}/schedule-embed.html?${qs}`
  };
}

function iframeSnippet(iframeUrl = "") {
  const src = xmlEscape(iframeUrl);
  return `<iframe src="${src}" title="Staff schedule" loading="lazy" referrerpolicy="no-referrer" style="width:100%;min-height:520px;border:0;border-radius:16px;background:#0b1220"></iframe>`;
}

function buildScheduleRss({venueName = "FLOQR", feedUrl = "", shifts = []} = {}) {
  const title = xmlEscape(`${venueName} staff schedule`);
  const items = (Array.isArray(shifts) ? shifts : []).slice(0, 80).map(shift => {
    const when = [shift.startsAt, shift.endsAt].filter(Boolean).join(" – ")
      || (shift.startsAtMs ? new Date(Number(shift.startsAtMs)).toUTCString() : "");
    const heading = xmlEscape(`${shift.roleLabel || "Shift"}${shift.assigneeName ? ` · ${shift.assigneeName}` : ""}`);
    const desc = xmlEscape(`${when}${shift.status ? ` · ${shift.status}` : ""}`);
    return `<item><title>${heading}</title><description>${desc}</description><guid isPermaLink="false">${xmlEscape(shift.id || heading)}</guid></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${title}</title><link>${xmlEscape(feedUrl)}</link><description>Published staff shifts only.</description>${items}</channel></rss>`;
}

module.exports = {
  DEFAULT_ORIGIN,
  DEFAULT_API,
  hashIngestSecret,
  newIngestSecret,
  secretsMatch,
  obfuscateSecret,
  opaqueAssigneeKey,
  feedUrls,
  iframeSnippet,
  buildScheduleRss
};
