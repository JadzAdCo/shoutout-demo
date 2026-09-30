/**
 * Google geocoding for clubLocations: every new or moved venue gets latitude/longitude once,
 * so nearest-first search works for any city without code changes.
 * Design notes: .cursor/rules/design-notes-floqai-venue-search.mdc
 */
"use strict";

const admin = require("firebase-admin");
const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const core = require("./venue-geocode-core");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_PLACES_API_KEY = defineSecret("GOOGLE_PLACES_API_KEY");
const BACKFILL_SCAN_LIMIT = 500;
const BACKFILL_GEOCODE_LIMIT = 60;
const FETCH_TIMEOUT_MS = 8000;

function apiKey() {
  try { return GOOGLE_PLACES_API_KEY.value() || process.env.GOOGLE_PLACES_API_KEY || ""; }
  catch (error) { return process.env.GOOGLE_PLACES_API_KEY || ""; }
}

async function fetchJson(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {...init, signal: controller.signal});
    if (!response.ok) return {ok: false, status: response.status, json: null};
    return {ok: true, status: response.status, json: await response.json()};
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeWithGoogle(query, key) {
  const places = await fetchJson("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
      "x-goog-fieldmask": "places.id,places.location,places.formattedAddress"
    },
    body: JSON.stringify({textQuery: query, maxResultCount: 1})
  });
  const placesHit = places.ok ? core.parsePlacesLocation(places.json) : null;
  if (placesHit) return {hit: placesHit, source: "google-places"};

  const geocode = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`,
    {method: "GET"}
  );
  const geocodeHit = geocode.ok ? core.parseGeocodeApi(geocode.json) : null;
  if (geocodeHit) return {hit: geocodeHit, source: "google-geocoding"};
  return {hit: null, source: "", status: `places:${places.status} geocode:${geocode.status}`};
}

async function geocodeVenue(ref, data) {
  const key = apiKey();
  if (!key) {
    console.warn("venue-geocode: GOOGLE_PLACES_API_KEY is not configured");
    return "no-key";
  }
  const query = core.geocodeQuery(data);
  const signature = core.geocodeSignature(data);
  const nowIso = new Date().toISOString();
  try {
    const result = await geocodeWithGoogle(query, key);
    if (!result.hit) {
      console.warn("venue-geocode: no match", {id: ref.id, status: result.status});
      await ref.set(core.missPatch(signature, nowIso), {merge: true});
      return "miss";
    }
    await ref.set(core.geoPatch(result.hit, signature, result.source, nowIso), {merge: true});
    return "ok";
  } catch (error) {
    console.error("venue-geocode: request failed", {id: ref.id, message: error?.message || String(error)});
    return "error";
  }
}

exports.onClubLocationGeocode = onDocumentWritten({
  document: "clubLocations/{locationId}",
  region: "us-central1",
  secrets: [GOOGLE_PLACES_API_KEY]
}, async event => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const data = after.data() || {};
  if (!core.needsGeocode(data)) return;
  await geocodeVenue(after.ref, data);
});

exports.scheduledVenueGeocodeBackfill = onSchedule({
  schedule: "every 12 hours",
  timeZone: "UTC",
  region: "us-central1",
  secrets: [GOOGLE_PLACES_API_KEY]
}, async () => {
  const snap = await db.collection("clubLocations").limit(BACKFILL_SCAN_LIMIT).get();
  const pending = snap.docs.filter(doc => core.needsGeocode(doc.data() || {})).slice(0, BACKFILL_GEOCODE_LIMIT);
  const tally = {ok: 0, miss: 0, error: 0, "no-key": 0};
  for (const doc of pending) {
    const outcome = await geocodeVenue(doc.ref, doc.data() || {});
    tally[outcome] = (tally[outcome] || 0) + 1;
    if (outcome === "no-key") break;
  }
  console.info("venue-geocode backfill", {scanned: snap.size, pending: pending.length, ...tally});
});
