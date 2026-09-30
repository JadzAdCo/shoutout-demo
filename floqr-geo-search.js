/* FLOQR location-aware search order: GPS first, then IP estimate, then profile city; nearest first, then name. */
// Design notes: .cursor/rules/design-notes-floqai-venue-search.mdc
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FLOQRGeoSearch = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";

  const VERSION = "s3.0.106";
  const DEFAULT_IP_PROVIDER = "https://get.geojs.io/v1/ip/geo.json";
  const IP_CACHE_KEY = "floqr.ipLocation.v1";
  const IP_CACHE_MS = 6 * 60 * 60 * 1000;
  const GPS_CACHE_MS = 10 * 60 * 1000;
  const GPS_WAIT_MS = 3000;
  const IP_WAIT_MS = 2500;
  const NEAREST_CITY_KM = 80;

  const CITIES = [
    {city: "Washington", country: "United States", lat: 38.9072, lng: -77.0369, aliases: ["washington dc", "washington d c", "district of columbia", "dc"]},
    {city: "Arlington", country: "United States", lat: 38.8816, lng: -77.0910},
    {city: "Alexandria", country: "United States", lat: 38.8048, lng: -77.0469},
    {city: "Bethesda", country: "United States", lat: 38.9847, lng: -77.0947},
    {city: "Baltimore", country: "United States", lat: 39.2904, lng: -76.6122},
    {city: "Philadelphia", country: "United States", lat: 39.9526, lng: -75.1652},
    {city: "New York", country: "United States", lat: 40.7128, lng: -74.0060, aliases: ["new york city", "nyc", "manhattan"]},
    {city: "Brooklyn", country: "United States", lat: 40.6782, lng: -73.9442},
    {city: "Boston", country: "United States", lat: 42.3601, lng: -71.0589},
    {city: "Atlanta", country: "United States", lat: 33.7490, lng: -84.3880},
    {city: "Miami", country: "United States", lat: 25.7617, lng: -80.1918},
    {city: "Miami Beach", country: "United States", lat: 25.7907, lng: -80.1300},
    {city: "New Orleans", country: "United States", lat: 29.9511, lng: -90.0715},
    {city: "Houston", country: "United States", lat: 29.7604, lng: -95.3698},
    {city: "Chicago", country: "United States", lat: 41.8781, lng: -87.6298},
    {city: "Las Vegas", country: "United States", lat: 36.1699, lng: -115.1398},
    {city: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437},
    {city: "San Francisco", country: "United States", lat: 37.7749, lng: -122.4194},
    {city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832},
    {city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, aliases: ["ciudad de mexico", "cdmx"]},
    {city: "Cancun", country: "Mexico", lat: 21.1619, lng: -86.8515},
    {city: "Tulum", country: "Mexico", lat: 20.2114, lng: -87.4654},
    {city: "Sao Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333},
    {city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729},
    {city: "London", country: "United Kingdom", lat: 51.5072, lng: -0.1276},
    {city: "Paris", country: "France", lat: 48.8566, lng: 2.3522},
    {city: "Cannes", country: "France", lat: 43.5528, lng: 7.0174},
    {city: "Nice", country: "France", lat: 43.7102, lng: 7.2620},
    {city: "Saint-Tropez", country: "France", lat: 43.2727, lng: 6.6406, aliases: ["saint tropez", "st tropez"]},
    {city: "Monaco", country: "Monaco", lat: 43.7384, lng: 7.4246, aliases: ["monte carlo", "montecarlo"]},
    {city: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734},
    {city: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038},
    {city: "Ibiza", country: "Spain", lat: 38.9067, lng: 1.4206, aliases: ["eivissa"]},
    {city: "Marbella", country: "Spain", lat: 36.5101, lng: -4.8825},
    {city: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393, aliases: ["lisboa"]},
    {city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041},
    {city: "Berlin", country: "Germany", lat: 52.5200, lng: 13.4050},
    {city: "Munich", country: "Germany", lat: 48.1351, lng: 11.5820, aliases: ["munchen"]},
    {city: "Frankfurt", country: "Germany", lat: 50.1109, lng: 8.6821},
    {city: "Hamburg", country: "Germany", lat: 53.5511, lng: 9.9937},
    {city: "Milan", country: "Italy", lat: 45.4642, lng: 9.1900, aliases: ["milano"]},
    {city: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, aliases: ["roma"]},
    {city: "Athens", country: "Greece", lat: 37.9838, lng: 23.7275, aliases: ["athina"]},
    {city: "Mykonos", country: "Greece", lat: 37.4467, lng: 25.3289},
    {city: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784},
    {city: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708},
    {city: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792},
    {city: "Accra", country: "Ghana", lat: 5.6037, lng: -0.1870},
    {city: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219},
    {city: "Johannesburg", country: "South Africa", lat: -26.2041, lng: 28.0473},
    {city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198}
  ];

  let lastGps = null;

  function key(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  const CITY_INDEX = CITIES.reduce((map, entry) => {
    [entry.city, ...(entry.aliases || [])].forEach(name => {
      const k = key(name);
      if (k && !map.has(k)) map.set(k, entry);
    });
    return map;
  }, new Map());

  function finite(value) {
    const num = Number(value);
    return value !== null && value !== "" && Number.isFinite(num) ? num : null;
  }

  function point(lat, lng) {
    const a = finite(lat);
    const b = finite(lng);
    return a == null || b == null || Math.abs(a) > 90 || Math.abs(b) > 180 ? null : {latitude: a, longitude: b};
  }

  function cityCoordinates(city) {
    const entry = CITY_INDEX.get(key(city));
    return entry ? {latitude: entry.lat, longitude: entry.lng, city: entry.city, country: entry.country} : null;
  }

  function distanceKm(a, b) {
    if (!a || !b) return null;
    const p = point(a.latitude, a.longitude);
    const q = point(b.latitude, b.longitude);
    if (!p || !q) return null;
    const rad = Math.PI / 180;
    const dLat = (q.latitude - p.latitude) * rad;
    const dLng = (q.longitude - p.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.latitude * rad) * Math.cos(q.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function nearestCity(latitude, longitude, maxKm = NEAREST_CITY_KM) {
    const origin = point(latitude, longitude);
    if (!origin) return null;
    let best = null;
    CITIES.forEach(entry => {
      const km = distanceKm(origin, {latitude: entry.lat, longitude: entry.lng});
      if (km != null && km <= maxKm && (!best || km < best.km)) best = {city: entry.city, country: entry.country, km};
    });
    return best;
  }

  /** Venue / event coordinates: stored lat/lng first, else the city centre. */
  function recordCoordinates(record) {
    if (!record || typeof record !== "object") return null;
    const direct =
      point(record.latitude, record.longitude) ||
      point(record.lat, record.lng ?? record.lon) ||
      point(record.geo?.latitude ?? record.geo?.lat, record.geo?.longitude ?? record.geo?.lng) ||
      point(record.location?.latitude ?? record.location?.lat, record.location?.longitude ?? record.location?.lng) ||
      point(record.coordinates?.latitude ?? record.coordinates?.lat, record.coordinates?.longitude ?? record.coordinates?.lng);
    if (direct) return direct;
    return cityCoordinates(record.city) || cityCoordinates(record.locationCity) || null;
  }

  function compareNames(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, {sensitivity: "base", numeric: true});
  }

  /**
   * Nearest first (whole km, so venues in the same city tie), then name A→Z.
   * Without an origin, or for records with no coordinates, order is by name.
   * @returns {Array<{item:any, distanceKm:number|null}>} new array; input is not mutated.
   */
  function sortNearest(items, origin, opts = {}) {
    const nameOf = typeof opts.nameOf === "function" ? opts.nameOf : item => item?.name || "";
    const coordsOf = typeof opts.coordsOf === "function" ? opts.coordsOf : recordCoordinates;
    const from = origin ? point(origin.latitude, origin.longitude) : null;
    const entries = (Array.isArray(items) ? items : []).map(item => {
      const km = from ? distanceKm(from, coordsOf(item)) : null;
      return {item, distanceKm: km == null ? null : Math.round(km), name: nameOf(item)};
    });
    entries.sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      }
      return compareNames(a.name, b.name);
    });
    return entries.map(({item, distanceKm}) => ({item, distanceKm}));
  }

  function located(source, coords, extra = {}) {
    const p = point(coords?.latitude, coords?.longitude);
    if (!p) return null;
    const near = extra.city ? null : nearestCity(p.latitude, p.longitude);
    return {
      source,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: finite(extra.accuracy),
      city: extra.city || near?.city || "",
      region: extra.region || "",
      country: extra.country || near?.country || ""
    };
  }

  function gpsPosition(geolocation, opts) {
    const now = Date.now();
    if (lastGps && now - lastGps.at < GPS_CACHE_MS) return Promise.resolve(lastGps.coords);
    if (!geolocation || typeof geolocation.getCurrentPosition !== "function") return Promise.resolve(null);
    const waitMs = finite(opts.gpsWaitMs) ?? GPS_WAIT_MS;
    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => { settled = true; resolve(null); }, waitMs);
      try {
        geolocation.getCurrentPosition(
          position => {
            const coords = {
              latitude: position?.coords?.latitude,
              longitude: position?.coords?.longitude,
              accuracy: position?.coords?.accuracy
            };
            if (!point(coords.latitude, coords.longitude)) return;
            lastGps = {at: Date.now(), coords};
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(coords);
            } else if (typeof opts.onLateGps === "function") {
              opts.onLateGps(coords);
            }
          },
          () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(null);
          },
          {enableHighAccuracy: false, timeout: 15000, maximumAge: GPS_CACHE_MS}
        );
      } catch (error) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
      }
    });
  }

  /** Accepts GeoJS, ipapi.co, and ipwho.is shapes. Never keeps the IP address itself. */
  function parseIpPayload(json) {
    if (!json || typeof json !== "object" || json.success === false || json.error === true) return null;
    const p = point(json.latitude ?? json.lat, json.longitude ?? json.lon ?? json.lng);
    if (!p) return null;
    return {
      latitude: p.latitude,
      longitude: p.longitude,
      city: String(json.city || ""),
      region: String(json.region || json.region_name || ""),
      country: String(json.country_name || json.country || "")
    };
  }

  function readIpCache(storage) {
    try {
      const raw = storage?.getItem?.(IP_CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      return cached && Date.now() - Number(cached.at) < IP_CACHE_MS ? parseIpPayload(cached.data) : null;
    } catch (error) {
      return null;
    }
  }

  function writeIpCache(storage, data) {
    try { storage?.setItem?.(IP_CACHE_KEY, JSON.stringify({at: Date.now(), data})); } catch (error) { /* storage full or blocked */ }
  }

  function ipProviderUrl(opts) {
    const configured = opts.ipProviderUrl !== undefined ? opts.ipProviderUrl : root?.FLOQR_IP_GEOLOCATION_PROVIDER;
    if (configured === false) return "";
    return typeof configured === "string" && /^https:\/\//i.test(configured) ? configured : DEFAULT_IP_PROVIDER;
  }

  async function ipLocation(opts) {
    const storage = opts.storage !== undefined ? opts.storage : root?.sessionStorage;
    const cached = readIpCache(storage);
    if (cached) return cached;
    const url = ipProviderUrl(opts);
    const fetchImpl = opts.fetch || root?.fetch;
    if (!url || typeof fetchImpl !== "function") return null;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), finite(opts.ipWaitMs) ?? IP_WAIT_MS);
    try {
      const response = await fetchImpl(url, {signal: controller?.signal, credentials: "omit", cache: "no-store"});
      if (!response?.ok) return null;
      const data = parseIpPayload(await response.json());
      if (data) writeIpCache(storage, data);
      return data;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function profileLocation(profile) {
    const p = profile || {};
    const city = String(p.city || p.profileCity || p.locationCity || p.homeCity || "").trim();
    const country = String(p.country || p.profileCountry || p.locationCountry || "").trim();
    const coords = point(p.latitude ?? p.lat, p.longitude ?? p.lng) || cityCoordinates(city);
    return coords ? located("profile", coords, {city, country}) : null;
  }

  /**
   * GPS → IP estimate → profile city → unknown.
   * @param {{geolocation?:object, fetch?:Function, storage?:object, profile?:object,
   *   ipProviderUrl?:string|false, gpsWaitMs?:number, ipWaitMs?:number, onLateGps?:Function}} [opts]
   */
  async function resolveUserLocation(opts = {}) {
    const geolocation = opts.geolocation !== undefined ? opts.geolocation : root?.navigator?.geolocation;
    const gps = await gpsPosition(geolocation, opts);
    if (gps) return located("gps", gps, {accuracy: gps.accuracy});
    const ip = await ipLocation(opts);
    if (ip) return located("ip", ip, ip);
    return profileLocation(opts.profile) || {source: "unknown", latitude: null, longitude: null, accuracy: null, city: "", region: "", country: ""};
  }

  function resetCache(storage) {
    lastGps = null;
    try { storage?.removeItem?.(IP_CACHE_KEY); } catch (error) { /* ignore */ }
  }

  return {
    VERSION,
    DEFAULT_IP_PROVIDER,
    CITIES,
    cityCoordinates,
    distanceKm,
    nearestCity,
    recordCoordinates,
    compareNames,
    sortNearest,
    parseIpPayload,
    resolveUserLocation,
    resetCache
  };
});
