/**
 * Venue geocoding contract: which clubLocations need Google coordinates and how results are stored.
 * Design notes: .cursor/rules/design-notes-floqai-venue-search.mdc
 */
"use strict";

function text(value, max = 300) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

function norm(value) {
  return text(value, 600)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function finite(value) {
  const num = Number(value);
  return value !== null && value !== "" && value !== undefined && Number.isFinite(num) ? num : null;
}

function validPoint(lat, lng) {
  const a = finite(lat);
  const b = finite(lng);
  return a != null && b != null && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

function hasCoordinates(record) {
  return !!record && validPoint(record.latitude, record.longitude);
}

/** Street address when known, else venue name + city; always ends with region / country for disambiguation. */
function geocodeQuery(record) {
  if (!record || typeof record !== "object") return "";
  const address = text(record.address || record.streetAddress || record.formattedAddress || record.proposedAddress);
  const city = text(record.city, 120);
  const region = text(record.region || record.stateRegion, 120);
  const country = text(record.country, 120);
  if (!address && !city) return "";
  const lowerAddress = norm(address);
  const tail = [city, region, country].filter(part => part && !lowerAddress.includes(norm(part)));
  const head = address || text(record.locationName || record.brandName, 160);
  return [head, ...tail].filter(Boolean).join(", ");
}

function geocodeSignature(record) {
  return norm(geocodeQuery(record));
}

function needsGeocode(record) {
  if (!record || typeof record !== "object") return false;
  if (record.geoManual === true || record.geo?.source === "manual") return false;
  const signature = geocodeSignature(record);
  if (!signature) return false;
  const geo = record.geo || {};
  if (geo.signature === signature && geo.source === "google-miss") return false;
  if (!hasCoordinates(record)) return true;
  return !!geo.signature && geo.signature !== signature;
}

/** Places API (New) Text Search with field mask places.location. */
function parsePlacesLocation(payload) {
  const place = Array.isArray(payload?.places) ? payload.places[0] : null;
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (!validPoint(lat, lng)) return null;
  return {
    latitude: Number(lat),
    longitude: Number(lng),
    formattedAddress: text(place.formattedAddress),
    placeId: text(place.id, 200)
  };
}

/** Geocoding API JSON. */
function parseGeocodeApi(payload) {
  if (!payload || payload.status !== "OK" || !Array.isArray(payload.results)) return null;
  const hit = payload.results[0];
  const lat = hit?.geometry?.location?.lat;
  const lng = hit?.geometry?.location?.lng;
  if (!validPoint(lat, lng)) return null;
  return {
    latitude: Number(lat),
    longitude: Number(lng),
    formattedAddress: text(hit.formatted_address),
    placeId: text(hit.place_id, 200)
  };
}

function geoPatch(hit, signature, source, nowIso) {
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    geo: {
      latitude: hit.latitude,
      longitude: hit.longitude,
      signature,
      source,
      formattedAddress: hit.formattedAddress || "",
      placeId: hit.placeId || "",
      geocodedAt: nowIso
    }
  };
}

function missPatch(signature, nowIso) {
  return {geo: {signature, source: "google-miss", geocodedAt: nowIso}};
}

module.exports = {
  geocodeQuery,
  geocodeSignature,
  hasCoordinates,
  needsGeocode,
  parsePlacesLocation,
  parseGeocodeApi,
  geoPatch,
  missPatch
};
