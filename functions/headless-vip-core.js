/* Headless VIP reserV from BOT DEE chat.
   Parses club / night / section / party size. Area names (Mezzanine) list
   bookable tables instead of failing createVipHold. No Firebase. */
"use strict";

const fs = require("fs");
const path = require("path");
const betaCatalog = require("./vip-beta-catalog");
const shout = require("./headless-shoutout-core");

const SCHEMA_KIND = "botDeeVip";
const DEFAULT_PARTY = 2;

const CLUB_ALIASES = shout.CLUB_NAME_ALIASES || Object.freeze({
  aurelia: "temp-democlub-1",
  decades: "decades-washington-dc",
  "lima twist": "lima-twist-washington-dc"
});

function text(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function fold(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tonightIso(nowMs = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(nowMs));
}

function clubDisplayName(clubLocationId) {
  const id = text(clubLocationId, 120);
  if (!id) return "";
  const named = text(betaCatalog[id]?.venueName, 80);
  if (named) return named.replace(/\s*\((?:Demo Club|demo)\)\s*$/i, "").trim() || named;
  return id;
}

function resolveClubQuery(raw) {
  const folded = fold(raw);
  if (!folded) return "";
  if (betaCatalog[folded]) return folded;
  const keys = Object.keys(CLUB_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (folded === key || folded.includes(key)) return CLUB_ALIASES[key];
  }
  const byName = Object.keys(betaCatalog).find(id => {
    const venue = fold(betaCatalog[id]?.venueName || "");
    return venue && (folded === venue || folded.includes(venue) || venue.includes(folded));
  });
  return byName || "";
}

function loadPlan(clubLocationId) {
  const catalog = betaCatalog[clubLocationId];
  if (!catalog?.planFile) return null;
  const file = path.join(__dirname, "..", "vip-plans", catalog.planFile);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return null;
  }
}

function sectionsForClub(clubLocationId) {
  const catalog = betaCatalog[clubLocationId];
  return Array.isArray(catalog?.sections) ? catalog.sections : [];
}

function areasForClub(clubLocationId) {
  const plan = loadPlan(clubLocationId);
  const sections = sectionsForClub(clubLocationId);
  const byId = new Map(sections.map(row => [row.id, row]));
  return (Array.isArray(plan?.areas) ? plan.areas : []).map(area => {
    const ids = Array.isArray(area.sectionIds) ? area.sectionIds : [];
    return {
      id: text(area.id, 80),
      name: text(area.name || area.defaultName || area.label, 80),
      sectionIds: ids,
      sections: ids.map(id => byId.get(id)).filter(Boolean)
    };
  });
}

function publicSection(row, areaName) {
  if (!row) return null;
  return {
    id: text(row.id, 80),
    label: text(row.label || row.id, 80),
    type: text(row.type, 40),
    maxCapacity: Math.max(1, Math.floor(Number(row.maxCapacity) || 1)),
    includedGuests: Math.max(1, Math.floor(Number(row.includedGuests) || 1)),
    areaName: text(areaName, 80)
  };
}

function listSections(clubLocationId, needle) {
  const club = text(clubLocationId, 120);
  const areas = areasForClub(club);
  const sections = sectionsForClub(club);
  const areaBySection = new Map();
  areas.forEach(area => {
    area.sectionIds.forEach(id => areaBySection.set(id, area.name));
  });
  const all = sections.map(row => publicSection(row, areaBySection.get(row.id) || ""));
  const q = fold(needle);
  if (!q) return all;
  return all.filter(row => {
    const hay = fold(`${row.id} ${row.label} ${row.areaName} ${row.type}`);
    return hay === q || hay.includes(q) || q.includes(fold(row.label));
  });
}

function resolveSectionQuery(clubLocationId, raw) {
  const club = text(clubLocationId, 120);
  const query = text(raw, 80);
  const exact = sectionsForClub(club).find(row => row.id === query);
  if (exact) {
    const areas = areasForClub(club);
    const area = areas.find(a => a.sectionIds.includes(exact.id));
    return {ok: true, matches: [publicSection(exact, area?.name || "")], query};
  }
  const q = fold(query);
  if (!q) return {ok: false, matches: [], query, reason: "empty"};

  const areas = areasForClub(club);
  const areaHits = areas.filter(area => {
    const hay = fold(`${area.id} ${area.name}`);
    return hay === q || hay.includes(q) || q.includes(fold(area.name)) || q.includes("mezzanine") && hay.includes("mezzanine");
  });
  if (areaHits.length) {
    const matches = [];
    const seen = new Set();
    areaHits.forEach(area => {
      area.sections.forEach(row => {
        if (seen.has(row.id)) return;
        seen.add(row.id);
        matches.push(publicSection(row, area.name));
      });
    });
    if (matches.length === 1) return {ok: true, matches, query, area: areaHits[0].name};
    if (matches.length > 1) return {ok: false, matches, query, area: areaHits[0].name, reason: "area"};
  }

  const listed = listSections(club, query);
  if (listed.length === 1) return {ok: true, matches: listed, query};
  if (listed.length > 1) return {ok: false, matches: listed, query, reason: "ambiguous"};
  return {ok: false, matches: [], query, reason: "not_found"};
}

function parseNight(raw) {
  const source = String(raw || "");
  const iso = source.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const us = source.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/);
  if (us) {
    const mm = String(us[1]).padStart(2, "0");
    const dd = String(us[2]).padStart(2, "0");
    return `${us[3]}-${mm}-${dd}`;
  }
  const folded = fold(source);
  if (/\btonight\b/.test(folded) || /\btoday\b/.test(folded)) return tonightIso();
  return "";
}

function parsePartySize(raw) {
  const source = String(raw || "");
  const party = source.match(/\b(?:party(?:\s*size)?|for|table for|we(?:['’]re| are)?)\s+(\d{1,2})\b/i);
  if (party) return Math.max(1, Math.min(40, Number(party[1])));
  const ofUs = source.match(/\b(\d{1,2})\s+(?:of us|people|guests|pax)\b/i);
  if (ofUs) return Math.max(1, Math.min(40, Number(ofUs[1])));
  if (/^\d{1,2}$/.test(source.trim())) return Math.max(1, Math.min(40, Number(source.trim())));
  return 0;
}

function extractSectionNeedle(raw) {
  const source = String(raw || "").trim();
  if (!source) return "";
  const labeled = source.match(/\b(?:table|section|booth|suite)\s+([A-Za-z0-9][A-Za-z0-9 _-]{0,24})\b/i);
  if (labeled) return labeled[1].trim();
  const idLike = source.match(/\b((?:aurelia-)?(?:v|c|t|l)\d{1,3}|aurelia suite|[a-z]+-\d{2,4})\b/i);
  if (idLike) return idLike[1];
  const folded = fold(source);
  if (/\bmezzanine\b/.test(folded)) return "Mezzanine";
  if (/\bwest booths?\b/.test(folded)) return "West Booths";
  if (/\bdance floor\b/.test(folded)) return "Dance Floor";
  if (/\bbar lounge\b/.test(folded)) return "Bar Lounge";
  if (/\bnorth vip\b/.test(folded)) return "North VIP";
  if (/\bsouth vip\b/.test(folded)) return "South VIP";
  if (/^[a-z]{1,3}\d{1,3}$/i.test(source.trim())) return source.trim();
  return "";
}

function parseVipExecute(raw) {
  const source = String(raw || "").trim();
  const clubFromAlias = resolveClubQuery(source);
  const at = source.match(/\b(?:at|@)\s+([A-Za-z][A-Za-z0-9 .'-]{1,40})/i);
  const clubFromAt = at ? resolveClubQuery(at[1]) : "";
  return {
    clubQuery: clubFromAt || clubFromAlias,
    night: parseNight(source),
    sectionQuery: extractSectionNeedle(source),
    partySize: parsePartySize(source),
    confirmHold: isConfirmHoldPrompt(source),
    cancel: isCancelVipPrompt(source),
    acceptTerms: isAcceptTermsPrompt(source)
  };
}

function isVipExecutePrompt(raw) {
  const q = fold(raw);
  if (!q || q.length > 2000) return false;
  if (/\b(?:how|help|what is|where do i|instructions?|explain)\b/.test(q)) return false;
  if (/\b(?:throw|send|post)\b.{0,24}\bshout\s*out/.test(q)) return false;
  if (/\bvip\s*reserv/.test(q) || /\breserv\s*v\b/.test(q)) return true;
  if (/\bheadless\s+vip\b/.test(q)) return true;
  if (/\b(?:book|hold|reserve|reserv)\b.{0,48}\b(?:vip|table|booth|section|mezzanine|club)\b/.test(q)) return true;
  if (/\b(?:book|hold|reserve|reserv)\s+(?:a |an |the )?(?:table|booth|reservation)s?\b/.test(q)) return true;
  if (/\b(?:do|make|get|want|need|place)\b.{0,32}\b(?:a |an |the )?(?:reservation|reservations)\b/.test(q)) return true;
  if (/\b(?:vip)\b.{0,40}\b(?:table|booth|mezzanine|section)\b/.test(q)) return true;
  if (/\b(?:reservation|reservations)\b/.test(q) && !/\b(?:hotel|flight|airline|airbnb)\b/.test(q)) return true;
  return false;
}

function isOverviewPrompt(raw) {
  const q = fold(raw);
  return /^(all areas|overview|whole floor|full map|floor plan)$/.test(q);
}

function addDaysIso(iso, days) {
  const night = parseNight(iso) || tonightIso();
  const [y, m, d] = night.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Math.floor(Number(days) || 0));
  return dt.toISOString().slice(0, 10);
}

function formatNightChip(iso) {
  const night = parseNight(iso);
  if (!night) return "";
  if (night === tonightIso()) return "Tonight";
  const [y, m, d] = night.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString("en-US", {weekday: "short", month: "short", day: "numeric"});
}

function nightOptions(selectedIso, count = 7) {
  const start = tonightIso();
  const selected = parseNight(selectedIso) || start;
  const want = Math.max(3, Math.min(14, Math.floor(Number(count) || 7)));
  const out = [];
  for (let i = 0; i < want; i += 1) {
    const iso = addDaysIso(start, i);
    out.push({
      iso,
      prompt: iso === start ? "tonight" : iso,
      label: formatNightChip(iso),
      selected: iso === selected
    });
  }
  return out;
}

function shortAreaName(name) {
  return text(String(name || "").replace(/^Area\s+[A-Z]\s*[·•-]\s*/i, ""), 80);
}

function sectionRect(row) {
  if (!row) return null;
  if (row.rect && Number.isFinite(Number(row.rect.w))) {
    return {
      x: Number(row.rect.x) || 0,
      y: Number(row.rect.y) || 0,
      w: Number(row.rect.w) || 0,
      h: Number(row.rect.h) || 0
    };
  }
  const c = row.circle;
  if (c && Number.isFinite(Number(c.rx || c.r))) {
    const rx = Number(c.rx || c.r) || 0;
    const ry = Number(c.ry || c.r) || rx;
    return {x: Number(c.cx) - rx, y: Number(c.cy) - ry, w: rx * 2, h: ry * 2};
  }
  return null;
}

function pickSelectedArea(plan, draft) {
  const row = clipInteractiveDraft(draft);
  const areas = Array.isArray(plan?.areas) ? plan.areas : [];
  if (row.sectionId) {
    return areas.find(area => (area.sectionIds || []).includes(row.sectionId)) || null;
  }
  const names = [...new Set((row.matches || []).map(item => fold(item.areaName)).filter(Boolean))];
  if (names.length === 1) {
    return areas.find(area => {
      const hay = fold(`${area.id} ${area.name} ${area.defaultName || ""}`);
      return hay.includes(names[0]) || names[0].includes(fold(shortAreaName(area.name)));
    }) || null;
  }
  if (row.sectionQuery) {
    const q = fold(row.sectionQuery);
    return areas.find(area => {
      const hay = fold(`${area.id} ${area.name} ${area.defaultName || ""} ${shortAreaName(area.name)}`);
      return hay === q || hay.includes(q) || q.includes(fold(shortAreaName(area.name)));
    }) || null;
  }
  return null;
}

function mapLiteForClub(clubLocationId, draft) {
  const plan = loadPlan(clubLocationId);
  if (!plan) return null;
  const file = text(plan.image?.file, 200).replace(/^\.\//, "");
  const areas = (Array.isArray(plan.areas) ? plan.areas : []).map(area => ({
    id: text(area.id, 80),
    name: shortAreaName(area.name || area.defaultName || area.label),
    prompt: shortAreaName(area.name || area.defaultName || area.label),
    bounds: area.viewBox || area.bounds || area.rect || null
  })).filter(area => area.id && area.name);
  const selected = pickSelectedArea(plan, draft);
  const viewBox = selected
    ? (selected.viewBox || selected.bounds || selected.rect || {x: 0, y: 0, w: 1, h: 1})
    : {x: 0, y: 0, w: 1, h: 1};
  const ids = new Set(selected?.sectionIds || []);
  const tables = (Array.isArray(plan.sections) ? plan.sections : [])
    .filter(row => row && row.bookable !== false && (!selected || ids.has(row.id)))
    .map(row => {
      const rect = sectionRect(row);
      if (!rect || rect.w <= 0 || rect.h <= 0) return null;
      return {
        id: text(row.id, 80),
        label: text(row.label || row.id, 80),
        prompt: text(row.label || row.id, 80),
        selected: row.id === clipInteractiveDraft(draft).sectionId,
        rect
      };
    })
    .filter(Boolean);
  return {
    imageUrl: file ? `./${file}` : "",
    selectedAreaId: text(selected?.id, 80),
    selectedAreaName: selected ? shortAreaName(selected.name || selected.defaultName) : "",
    viewBox,
    areas,
    tables: selected ? tables : []
  };
}

function isRepeatSelectedSection(raw, draft) {
  const row = clipInteractiveDraft(draft);
  if (!row.sectionId) return false;
  const needle = fold(extractSectionNeedle(raw) || raw);
  if (!needle || needle.length > 24) return false;
  const label = fold(row.sectionLabel);
  const id = fold(row.sectionId);
  const last = id.split("-").pop();
  return needle === label || needle === id || (last && needle === last);
}

function isConfirmHoldPrompt(raw) {
  const q = fold(raw);
  return /^(hold it|book it|confirm|yes hold|hold that table|book that table)$/.test(q)
    || /\b(?:hold|book)\s+(?:it|that table|this table)\b/.test(q);
}

function isCancelVipPrompt(raw) {
  const q = fold(raw);
  return /^(cancel|nevermind|never mind|stop)$/.test(q)
    || /\bcancel (?:the )?(?:vip|hold|reservation|table)\b/.test(q);
}

function isAcceptTermsPrompt(raw) {
  const q = fold(raw);
  return /\b(?:agree|i agree|accept terms|accept the terms)\b/.test(q);
}

function isBareAffirmative(raw) {
  return /^(yes|yep|yeah|ok|okay|sure|please|do it)$/i.test(String(raw || "").trim());
}

function emptyDraft() {
  return {
    clubQuery: "",
    night: "",
    sectionId: "",
    sectionLabel: "",
    sectionQuery: "",
    partySize: 0,
    holdId: "",
    consentId: "",
    matches: []
  };
}

function clipInteractiveDraft(draft = {}) {
  const row = draft && typeof draft === "object" ? draft : {};
  const matches = Array.isArray(row.matches)
    ? row.matches.slice(0, 12).map(item => ({
      id: text(item.id, 80),
      label: text(item.label, 80),
      type: text(item.type, 40),
      maxCapacity: Math.max(0, Math.floor(Number(item.maxCapacity) || 0)),
      areaName: text(item.areaName, 80)
    })).filter(item => item.id)
    : [];
  return {
    clubQuery: text(row.clubQuery || row.clubLocationId, 120),
    night: text(row.night, 12),
    sectionId: text(row.sectionId, 80),
    sectionLabel: text(row.sectionLabel, 80),
    sectionQuery: text(row.sectionQuery, 80),
    partySize: Math.max(0, Math.min(40, Math.floor(Number(row.partySize) || 0))),
    holdId: text(row.holdId, 80),
    consentId: text(row.consentId, 80),
    matches
  };
}

function mergeInteractiveDraft(previous, parsed = {}) {
  const next = previous ? clipInteractiveDraft(previous) : emptyDraft();
  const club = text(parsed.clubQuery, 120);
  if (club) next.clubQuery = club;
  if (parsed.night) next.night = parsed.night;
  if (parsed.partySize) next.partySize = parsed.partySize;
  if (parsed.sectionQuery) next.sectionQuery = parsed.sectionQuery;
  if (parsed.sectionId) next.sectionId = parsed.sectionId;
  if (parsed.sectionLabel) next.sectionLabel = parsed.sectionLabel;
  if (Array.isArray(parsed.matches)) next.matches = clipInteractiveDraft({matches: parsed.matches}).matches;
  if (parsed.holdId) next.holdId = parsed.holdId;
  if (parsed.consentId) next.consentId = parsed.consentId;
  if (!next.night) next.night = tonightIso();
  if (!next.partySize) next.partySize = DEFAULT_PARTY;
  return next;
}

function interactiveNeeds(draft) {
  const row = clipInteractiveDraft(draft);
  const needs = [];
  if (!row.clubQuery) needs.push("club");
  if (!row.sectionId) needs.push("section");
  if (!row.night) needs.push("night");
  if (!row.partySize) needs.push("party");
  return needs;
}

function isInteractiveFollowUp(raw, draft) {
  if (!draft || typeof draft !== "object") return false;
  const row = clipInteractiveDraft(draft);
  if (!row.clubQuery) return false;
  const source = String(raw || "").trim();
  if (!source || source.length > 200) return false;
  if (isVipExecutePrompt(source) || isCancelVipPrompt(source) || isConfirmHoldPrompt(source) || isAcceptTermsPrompt(source)) {
    return true;
  }
  if (isOverviewPrompt(source)) return true;
  if (parseNight(source) || parsePartySize(source)) return true;
  if (extractSectionNeedle(source)) return true;
  if (isFloorNavPrompt(source, row)) return true;
  if (isBareAffirmative(source) && row.matches.length === 1 && !row.sectionId) return true;
  if (/^[a-z]{1,3}\d{1,3}$/i.test(source)) return true;
  return false;
}

function isFloorNavPrompt(raw, draft) {
  const row = clipInteractiveDraft(draft);
  if (!row.clubQuery) return false;
  const q = fold(raw);
  if (!q || q.length > 40) return false;
  if (isOverviewPrompt(raw)) return true;
  if (areasForClub(row.clubQuery).some(area => fold(shortAreaName(area.name)) === q || fold(area.name) === q)) {
    return true;
  }
  return listSections(row.clubQuery, raw).some(item => {
    const label = fold(item.label);
    const id = fold(item.id);
    return label === q || id === q || (id.endsWith(q) && q.length >= 2);
  });
}

function missingAsk(needs, draft) {
  const row = clipInteractiveDraft(draft);
  if (needs.includes("club")) {
    return "Which club? VIP reserV beta is Decades, Lima Twist Club, or Aurelia.";
  }
  if (needs.includes("section")) {
    if (row.matches && row.matches.length) {
      const labels = row.matches.slice(0, 8).map(item => item.label).join(", ");
      return `That area has a few bookable tables: ${labels}. Tap a table on the map, or reply with a table id (for example V1).`;
    }
    return "Tap a night, then an area on the floor map (Mezzanine, West Booths, Dance Floor, Bar Lounge), or say V1 / C10.";
  }
  if (needs.includes("night")) return "Which night? Tap a date on the card, or say tonight.";
  if (needs.includes("party")) return "How many guests?";
  return "VIP reserV is ready — say hold it to reserve, or pick another table.";
}

function applySectionMatch(draft, query) {
  const next = clipInteractiveDraft(draft);
  const club = next.clubQuery;
  if (!club || !query) return {draft: next, match: resolveSectionQuery(club, "")};
  const match = resolveSectionQuery(club, query);
  next.sectionQuery = query;
  next.matches = match.matches || [];
  if (match.ok && match.matches[0]) {
    next.sectionId = match.matches[0].id;
    next.sectionLabel = match.matches[0].label;
  } else {
    next.sectionId = "";
    next.sectionLabel = "";
  }
  return {draft: next, match};
}

module.exports = {
  SCHEMA_KIND,
  DEFAULT_PARTY,
  CLUB_ALIASES,
  text,
  fold,
  tonightIso,
  clubDisplayName,
  resolveClubQuery,
  loadPlan,
  sectionsForClub,
  areasForClub,
  listSections,
  resolveSectionQuery,
  parseNight,
  parsePartySize,
  extractSectionNeedle,
  parseVipExecute,
  isVipExecutePrompt,
  isConfirmHoldPrompt,
  isCancelVipPrompt,
  isAcceptTermsPrompt,
  isBareAffirmative,
  isRepeatSelectedSection,
  isOverviewPrompt,
  isFloorNavPrompt,
  addDaysIso,
  nightOptions,
  mapLiteForClub,
  emptyDraft,
  clipInteractiveDraft,
  mergeInteractiveDraft,
  interactiveNeeds,
  isInteractiveFollowUp,
  missingAsk,
  applySectionMatch
};
