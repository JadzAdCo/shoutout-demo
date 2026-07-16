/* FLOQR location-aware ranking v28.80: browser/profile location, preferences, Gemini hook, local fallback. */
(function () {
  "use strict";

  const CITY_COORDINATES = {
    "washington|district of columbia|united states": {latitude:38.9072, longitude:-77.0369},
    "washington||united states": {latitude:38.9072, longitude:-77.0369},
    "barcelona|catalonia|spain": {latitude:41.3851, longitude:2.1734},
    "cannes|provence-alpes-cote d azur|france": {latitude:43.5528, longitude:7.0174},
    "london|england|united kingdom": {latitude:51.5072, longitude:-0.1276},
    "dubai||united arab emirates": {latitude:25.2048, longitude:55.2708},
    "istanbul||turkey": {latitude:41.0082, longitude:28.9784},
    "singapore||singapore": {latitude:1.3521, longitude:103.8198},
    "miami|florida|united states": {latitude:25.7617, longitude:-80.1918},
    "new york|new york|united states": {latitude:40.7128, longitude:-74.0060}
  };

  let locationPromise = null;

  function normalize(value) {
    if (window.FLOQRAI?.normalizeQuery) return window.FLOQRAI.normalizeQuery(value);
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function valueList(value) {
    if (Array.isArray(value)) return value.flatMap(valueList);
    if (value && typeof value === "object") return Object.values(value).flatMap(valueList);
    return String(value || "").split(/[,;|/]+/).map(item => item.trim()).filter(Boolean);
  }

  function firstValue(...values) {
    return values.map(value => String(value || "").trim()).find(Boolean) || "";
  }

  function coordinateFor(city, stateRegion, country) {
    const directKey = [city, stateRegion, country].map(normalize).join("|");
    if (CITY_COORDINATES[directKey]) return CITY_COORDINATES[directKey];
    const looseKey = [city, "", country].map(normalize).join("|");
    return CITY_COORDINATES[looseKey] || null;
  }

  function distanceKm(aLat, aLon, bLat, bLon) {
    const nums = [aLat, aLon, bLat, bLon].map(Number);
    if (nums.some(value => !Number.isFinite(value))) return null;
    const [lat1, lon1, lat2, lon2] = nums.map(value => value * Math.PI / 180);
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function getBrowserCoordinates() {
    if (!navigator.geolocation) return Promise.resolve(null);
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), 2800);
      navigator.geolocation.getCurrentPosition(
        position => {
          clearTimeout(timer);
          resolve({
            latitude:position.coords.latitude,
            longitude:position.coords.longitude,
            accuracy:position.coords.accuracy || null
          });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        {enableHighAccuracy:false, timeout:2500, maximumAge:10 * 60 * 1000}
      );
    });
  }

  async function maybeBrowserCoordinates() {
    try {
      if (!navigator.permissions?.query) return getBrowserCoordinates();
      const permission = await navigator.permissions.query({name:"geolocation"});
      if (permission.state === "denied") return null;
      return getBrowserCoordinates();
    } catch (error) {
      return getBrowserCoordinates();
    }
  }

  async function getUserLocationContext(user) {
    const profile = user?.profile || user?.userProfile || user || {};
    const uid = user?.uid || profile.uid || "";
    const city = firstValue(profile.city, profile.profileCity, profile.locationCity, profile.homeCity);
    const stateRegion = firstValue(profile.stateRegion, profile.region, profile.profileRegion, profile.locationRegion);
    const country = firstValue(profile.country, profile.profileCountry, profile.locationCountry);
    const profileCoords = {
      latitude:Number(profile.latitude || profile.lat || profile.locationLatitude || profile.geo?.latitude),
      longitude:Number(profile.longitude || profile.lng || profile.lon || profile.locationLongitude || profile.geo?.longitude)
    };
    const hasProfileCoords = Number.isFinite(profileCoords.latitude) && Number.isFinite(profileCoords.longitude);
    const knownCityCoords = coordinateFor(city, stateRegion, country);
    const browserCoords = await maybeBrowserCoordinates();
    const coords = browserCoords || (hasProfileCoords ? profileCoords : knownCityCoords) || {};
    const locationSource = browserCoords ? "browser" : hasProfileCoords || city || country ? "profile" : "unknown";
    const preferredGenres = valueList([
      profile.preferredGenres,
      profile.favoriteGenres,
      profile.musicGenres,
      profile.genres,
      profile.profileGenres
    ]);
    const preferredVenueTypes = valueList([
      profile.preferredVenueTypes,
      profile.venueTypes,
      profile.nightlifeInterests,
      profile.interests
    ]);
    const preferredCities = valueList([
      profile.preferredCities,
      profile.cities,
      profile.favoriteCities,
      city
    ]);
    const interests = valueList([
      profile.interests,
      profile.nightlifeInterests,
      profile.foodChoices,
      profile.beverageChoices,
      profile.publicInterests
    ]);
    return {
      uid,
      city,
      stateRegion,
      country,
      latitude:Number.isFinite(Number(coords.latitude)) ? Number(coords.latitude) : null,
      longitude:Number.isFinite(Number(coords.longitude)) ? Number(coords.longitude) : null,
      preferredGenres,
      preferredVenueTypes,
      preferredCities,
      interests,
      locationSource,
      ipGeolocationProviderConfigured:!!window.FLOQR_IP_GEOLOCATION_PROVIDER
    };
  }

  function recordData(item) {
    if (Array.isArray(item)) return item[1] || {};
    return item?.data || item || {};
  }

  function recordId(item) {
    if (Array.isArray(item)) return item[0] || recordData(item).id || "";
    return item?.id || recordData(item).id || "";
  }

  function scoreListMatch(needles, hayValues, points) {
    const hay = normalize(valueList(hayValues).join(" "));
    return valueList(needles).reduce((score, needle) => {
      const key = normalize(needle);
      return key && hay.includes(key) ? score + points : score;
    }, 0);
  }

  function localRankLocations(locations, userContext = {}) {
    const records = Array.isArray(locations) ? locations : Object.entries(locations || {}).map(([id, data]) => ({id, data}));
    const scored = records.map((item, index) => {
      const data = recordData(item);
      const city = normalize(data.city);
      const region = normalize(data.region || data.stateRegion);
      const country = normalize(data.country);
      let score = Math.max(0, 1000 - index) / 1000;
      if (city && city === normalize(userContext.city)) score += 80;
      if (region && region === normalize(userContext.stateRegion)) score += 30;
      if (country && country === normalize(userContext.country)) score += 20;
      score += scoreListMatch(userContext.preferredCities, [data.city, data.locationLabel], 35);
      score += scoreListMatch(userContext.preferredGenres, [data.genres, data.activityDates, data.description], 24);
      score += scoreListMatch(userContext.preferredVenueTypes, [data.type, data.categories, data.locationName], 18);
      score += scoreListMatch(userContext.interests, [data.genres, data.categories, data.activityDates, data.locationName, data.brandName], 10);
      const coords = coordinateFor(data.city, data.region || data.stateRegion, data.country);
      const distance = coords ? distanceKm(userContext.latitude, userContext.longitude, coords.latitude, coords.longitude) : null;
      if (distance != null) {
        if (distance <= 15) score += 90;
        else if (distance <= 50) score += 70;
        else if (distance <= 150) score += 45;
        else if (distance <= 500) score += 20;
        else if (distance <= 1500) score += 8;
      }
      return {
        item,
        score,
        distance,
        reason:distance != null ? `${Math.round(distance)} km from location context` : "Profile/preferences ranking"
      };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .map(entry => {
        if (Array.isArray(entry.item)) return entry.item;
        return {
          ...entry.item,
          id:recordId(entry.item),
          data:recordData(entry.item),
          _locationRankScore:Math.round(entry.score * 100) / 100,
          _locationRankReason:entry.reason,
          _distanceKm:entry.distance == null ? null : Math.round(entry.distance)
        };
      });
  }

  async function geminiRankLocations(locations, userContext = {}) {
    if (window.FLOQR_AI_ENABLED !== true || !window.firebase?.functions) return localRankLocations(locations, userContext);
    try {
      const region = window.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
      const name = window.FLOQR_AI_LOCATION_RANK_FUNCTION || "aiRankLocations";
      const callable = firebase.app().functions(region).httpsCallable(name);
      const payloadLocations = (Array.isArray(locations) ? locations : Object.entries(locations || {}).map(([id, data]) => ({id, data})))
        .map(item => ({id:recordId(item), data:recordData(item)}))
        .slice(0, 80);
      const response = await callable({
        userContext:{
          city:userContext.city || "",
          stateRegion:userContext.stateRegion || "",
          country:userContext.country || "",
          preferredGenres:userContext.preferredGenres || [],
          preferredVenueTypes:userContext.preferredVenueTypes || [],
          preferredCities:userContext.preferredCities || [],
          interests:userContext.interests || [],
          locationSource:userContext.locationSource || "unknown"
        },
        locations:payloadLocations
      });
      const rankedIds = Array.isArray(response?.data?.rankedIds) ? response.data.rankedIds : [];
      if (!rankedIds.length) return localRankLocations(locations, userContext);
      const rank = new Map(rankedIds.map((id, index) => [String(id), index]));
      return payloadLocations
        .sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999))
        .map(item => ({...item, _locationRankScore:9999 - (rank.get(item.id) ?? 9999), _matchMode:"gemini-location-rank"}));
    } catch (error) {
      console.warn("FLOQR Gemini location ranking unavailable, using local ranking:", error?.message || error);
      return localRankLocations(locations, userContext);
    }
  }

  async function rankLocationsForUser(locations, userContext = {}) {
    if (window.FLOQR_AI_ENABLED === true) return geminiRankLocations(locations, userContext);
    return localRankLocations(locations, userContext);
  }

  window.FLOQRLocationAI = {
    getUserLocationContext,
    rankLocationsForUser,
    geminiRankLocations,
    localRankLocations
  };
  window.getUserLocationContext = getUserLocationContext;
  window.rankLocationsForUser = rankLocationsForUser;
  window.geminiRankLocations = geminiRankLocations;
  window.localRankLocations = localRankLocations;
})();
