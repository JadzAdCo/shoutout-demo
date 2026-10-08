/* FLOQR club website feed — public profile, featured staff, DJs, events, gallery. No Firebase. */
// Design notes: .cursor/rules/design-notes-club-website-feed.mdc
"use strict";

const STAFF_PHOTO_FIELDS = ["photoUrl", "photoURL", "imageUrl"];
const HIDDEN_EVENT_STATUSES = new Set(["deleted", "cancelled", "canceled", "rejected", "draft"]);

function text(value = "", max = 500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function httpsUrl(value = "") {
  const url = text(value, 1000);
  return /^https:\/\//i.test(url) ? url : "";
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function entryPhoto(entry = {}) {
  for (const field of STAFF_PHOTO_FIELDS) if (entry[field]) return String(entry[field]);
  return "";
}

function entryKey(entry = {}) {
  const uid = entry.uid || entry.workerUid || "";
  return uid ? `uid:${uid}` : `name:${normalize(entry.name || entry.displayName)}`;
}

/** Same signature as floqr-featured-staff.js photoSignature — keep in sync. */
function photoSignature(featured = []) {
  return (Array.isArray(featured) ? featured : [])
    .filter(entry => entry && typeof entry === "object" && entryPhoto(entry))
    .map(entry => `${entryKey(entry)}|${entryPhoto(entry)}`)
    .sort()
    .join("\n");
}

function staffPhotosConsented(club = {}) {
  const sig = photoSignature(club.featuredStaff || club.featuredServiceStaff);
  return !!sig && club.featuredStaffPhotoConsent?.photoSignature === sig;
}

function sectionOn(club = {}, key) {
  const sections = club.publicProfileSections || {};
  return sections[key] !== false;
}

function personView(entry, {fallbackRole = "", withPhoto = true} = {}) {
  if (typeof entry === "string") entry = {name: entry};
  if (!entry || typeof entry !== "object") return null;
  const name = text(entry.name || entry.displayName, 120);
  if (!name) return null;
  const handle = text(entry.instagram || entry.instagramHandle, 60).replace(/^@/, "");
  return {
    name,
    role: text(entry.role || entry.title || fallbackRole, 60),
    bio: text(entry.bio || entry.description, 280),
    photoUrl: withPhoto ? httpsUrl(entryPhoto(entry)) : "",
    instagram: handle ? `@${handle}` : ""
  };
}

function staffView(club = {}) {
  if (!sectionOn(club, "featuredStaff")) return [];
  const withPhoto = staffPhotosConsented(club);
  return (Array.isArray(club.featuredStaff || club.featuredServiceStaff) ? (club.featuredStaff || club.featuredServiceStaff) : [])
    .map(entry => personView(entry, {fallbackRole: "Service Team", withPhoto}))
    .filter(Boolean)
    .slice(0, 60);
}

function djsView(club = {}) {
  if (!sectionOn(club, "featuredDjs")) return [];
  return (Array.isArray(club.featuredDjs) ? club.featuredDjs : [])
    .map(entry => personView(entry, {fallbackRole: "DJ"}))
    .filter(Boolean)
    .slice(0, 40);
}

function eventStartMs(event = {}) {
  const raw = event.startsAt || event.eventDate || event.date || event.startDate;
  if (!raw) return 0;
  if (typeof raw.toMillis === "function") return raw.toMillis();
  if (typeof raw === "object" && Number.isFinite(raw._seconds)) return raw._seconds * 1000;
  const withTime = event.eventTime && /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? `${raw}T${event.eventTime}` : raw;
  const ms = Date.parse(String(withTime));
  return Number.isFinite(ms) ? ms : 0;
}

function eventsView(events = [], nowMs = Date.now(), club = {}) {
  if (!sectionOn(club, "upcomingEvents")) return [];
  const cutoff = nowMs - 12 * 60 * 60 * 1000;
  const seen = new Set();
  return (Array.isArray(events) ? events : [])
    .filter(event => event && !HIDDEN_EVENT_STATUSES.has(text(event.status, 30).toLowerCase()) && event.active !== false)
    .filter(event => !seen.has(event.id) && seen.add(event.id))
    .map(event => ({event, startMs: eventStartMs(event)}))
    .filter(row => !row.startMs || row.startMs >= cutoff)
    .sort((a, b) => (a.startMs || Infinity) - (b.startMs || Infinity))
    .slice(0, 30)
    .map(({event, startMs}) => ({
      id: text(event.id, 160),
      name: text(event.eventName || event.title, 160) || "Club event",
      startsAt: startMs ? new Date(startMs).toISOString() : "",
      date: text(typeof event.eventDate === "string" ? event.eventDate : event.date, 40),
      time: text(event.eventTime, 40),
      artists: (event.artists || event.featuredDjs || event.djs || []).map(v => text(typeof v === "string" ? v : v?.name, 80)).filter(Boolean).slice(0, 8),
      genres: (Array.isArray(event.genres) ? event.genres : []).map(v => text(v, 40)).filter(Boolean).slice(0, 6),
      imageUrl: httpsUrl(event.imageUrl || event.flyerUrl),
      ticketUrl: httpsUrl(event.ticketUrl || event.officialUrl || event.sourceUrl)
    }));
}

function galleryView(media = [], club = {}) {
  if (!sectionOn(club, "gallery")) return [];
  const seen = new Set();
  return [...(Array.isArray(media) ? media : []), ...(Array.isArray(club.publicGallery) ? club.publicGallery : [])]
    .filter(item => item && item.slotType !== "main" && item.slotType !== "logo" && !HIDDEN_EVENT_STATUSES.has(text(item.status, 30).toLowerCase()))
    .map(item => ({
      url: httpsUrl(item.mediaUrl || item.url),
      type: text(item.mediaType, 20) === "video" ? "video" : "image",
      title: text(item.title, 160),
      order: Number(item.galleryOrder) || 999
    }))
    .filter(item => item.url && !seen.has(item.url) && seen.add(item.url))
    .sort((a, b) => a.order - b.order)
    .slice(0, 24)
    .map(({order, ...item}) => item);
}

function profileView(club = {}, locationId = "", origin = "") {
  const contact = sectionOn(club, "contact");
  const socials = contact ? (club.socialMediaHandles || club.socialHandles || {}) : {};
  const site = String(origin || "").replace(/\/$/, "");
  return {
    locationId,
    name: text(club.locationName || club.brandName || club.name, 160),
    tagline: text(club.tagline || club.publicTagline, 200),
    description: text(club.description || club.publicDescription || club.about, 1200),
    address: text(club.fullAddress || club.address || club.formattedAddress, 220),
    city: text(club.city, 80),
    country: text(club.country, 80),
    phone: contact ? text(club.publicPhone || club.telephone || club.phone, 40) : "",
    email: contact ? text(club.email, 120) : "",
    website: httpsUrl(club.officialWebsite || club.website),
    logoUrl: httpsUrl(club.logoUrl || club.clubLogoUrl),
    genres: (Array.isArray(club.genres) ? club.genres : []).map(v => text(v, 40)).filter(Boolean).slice(0, 12),
    hours: text(club.hours || club.operatingHours, 200),
    timeZone: text(club.timeZone, 80),
    socials: {
      instagram: text(socials.instagram, 80),
      facebook: text(socials.facebook, 120),
      tiktok: text(socials.tiktok, 80),
      x: text(socials.x, 80)
    },
    publicPageUrl: site && locationId ? `${site}/club-profile.html?location=${encodeURIComponent(locationId)}` : ""
  };
}

function isProfilePublished(club = {}) {
  return club.publicProfilePublished !== false && club.publicVisible !== false && !club.offboarded;
}

function xmlEscape(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEventsRss({venueName = "FLOQR", feedUrl = "", pageUrl = "", events = []} = {}) {
  const items = events.map(event => {
    const desc = [event.date || event.startsAt, event.time, event.artists.join(" · ")].filter(Boolean).join(" · ");
    const link = event.ticketUrl || pageUrl;
    return `<item><title>${xmlEscape(event.name)}</title>${link ? `<link>${xmlEscape(link)}</link>` : ""}<description>${xmlEscape(desc)}</description>${event.startsAt ? `<pubDate>${new Date(event.startsAt).toUTCString()}</pubDate>` : ""}<guid isPermaLink="false">${xmlEscape(event.id || event.name)}</guid></item>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(`${venueName} events`)}</title><link>${xmlEscape(pageUrl || feedUrl)}</link><description>Upcoming events published on FLOQR.</description>${items}</channel></rss>`;
}

module.exports = {
  sectionOn,
  photoSignature,
  staffPhotosConsented,
  staffView,
  djsView,
  eventStartMs,
  eventsView,
  galleryView,
  profileView,
  isProfilePublished,
  buildEventsRss
};
