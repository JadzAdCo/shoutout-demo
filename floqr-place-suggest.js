/* FLOQR city/country spelling suggestions for Prior Travels and Future Travel Destination.
   Local catalog first; signed-in Gemini (Google AI Studio via Functions) when the catalog is unsure.
   Never stores IP. Draft tokens stay on the device until the patron saves the profile. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FLOQRPlaceSuggest = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";

  const EXTRA_COUNTRIES = [
    "United States", "Canada", "Mexico", "Spain", "France", "Germany", "Italy", "Portugal",
    "United Kingdom", "Ireland", "Netherlands", "Belgium", "Switzerland", "Austria", "Greece",
    "Poland", "Sweden", "Norway", "Denmark", "Finland", "Iceland", "Russia", "Ukraine",
    "Brazil", "Argentina", "Colombia", "Chile", "Peru", "Venezuela", "Ecuador", "Uruguay",
    "Paraguay", "Bolivia", "Cuba", "Dominican Republic", "Puerto Rico", "Costa Rica", "Panama",
    "Guatemala", "Honduras", "El Salvador", "Nicaragua", "Jamaica", "Haiti",
    "Japan", "China", "India", "South Korea", "Thailand", "Vietnam", "Indonesia", "Philippines",
    "Singapore", "Malaysia", "Australia", "New Zealand", "South Africa", "Nigeria", "Ghana",
    "Kenya", "Morocco", "Egypt", "Tunisia", "Algeria", "Senegal", "United Arab Emirates",
    "Saudi Arabia", "Qatar", "Lebanon", "Jordan", "Turkey", "Israel"
  ];
  const EXTRA_CITIES = [
    "Madrid", "Valencia", "Seville", "Sevilla", "Malaga", "Palma", "Bilbao",
    "Mexico City", "Guadalajara", "Monterrey", "Bogota", "Medellin", "Lima", "Santiago",
    "Buenos Aires", "Rio de Janeiro", "Sao Paulo", "Lisbon", "Porto",
    "Paris", "Nice", "Cannes", "Lyon", "Marseille", "Berlin", "Munich", "Hamburg", "Frankfurt",
    "Rome", "Milan", "Florence", "Venice", "Naples", "Amsterdam", "Rotterdam",
    "London", "Manchester", "Dublin", "Edinburgh", "Athens", "Mykonos",
    "Warsaw", "Krakow", "Moscow", "Dubai", "Abu Dhabi", "Istanbul", "Cairo", "Marrakech",
    "Lagos", "Accra", "Nairobi", "Johannesburg", "Cape Town",
    "New York", "Los Angeles", "Miami", "Miami Beach", "Chicago", "Houston", "Atlanta",
    "Washington", "Boston", "Philadelphia", "Las Vegas", "San Francisco", "New Orleans",
    "Toronto", "Montreal", "Vancouver", "Cancun", "Tulum", "Ibiza", "Marbella", "Barcelona",
    "Tokyo", "Osaka", "Seoul", "Bangkok", "Singapore", "Sydney", "Melbourne"
  ];
  const ALIASES = {
    espana: "Spain",
    españa: "Spain",
    barclona: "Barcelona",
    barcelone: "Barcelona",
    barcellona: "Barcelona",
    madrid: "Madrid",
    sevilla: "Seville",
    seville: "Seville",
    "mexico city": "Mexico City",
    "ciudad de mexico": "Mexico City",
    cdmx: "Mexico City",
    "nueva york": "New York",
    nyc: "New York",
    "los angeles": "Los Angeles",
    "la": "Los Angeles",
    "washington dc": "Washington",
    "washington d c": "Washington",
    lisboa: "Lisbon",
    lisbon: "Lisbon",
    milano: "Milan",
    roma: "Rome",
    munchen: "Munich",
    münchen: "Munich",
    athina: "Athens",
    eivissa: "Ibiza"
  };

  function t(key, fallback, vars) {
    try {
      const i18n = root?.FLOQRI18n;
      if (i18n?.t) {
        const value = i18n.t(key, vars || {});
        if (value && value !== key) return value;
      }
    } catch (_) { /* i18n not loaded */ }
    let text = fallback;
    Object.keys(vars || {}).forEach(name => {
      text = String(text).replace(new RegExp(`\\{${name}\\}`, "g"), String(vars[name]));
    });
    return text;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function keyOf(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function uniquePlaces(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach(item => {
      const name = text(item && item.name ? item.name : item);
      const kind = item && item.kind ? item.kind : "place";
      const k = keyOf(name);
      if (!name || !k || seen.has(k)) return;
      seen.add(k);
      out.push({name, kind, key: k});
    });
    return out;
  }

  function catalogPlaces() {
    const cities = [];
    const Geo = root?.FLOQRGeoSearch;
    (Geo?.CITIES || []).forEach(row => {
      if (row?.city) cities.push({name: row.city, kind: "city"});
      (row?.aliases || []).forEach(alias => cities.push({name: alias, kind: "city"}));
    });
    EXTRA_CITIES.forEach(name => cities.push({name, kind: "city"}));
    const countries = EXTRA_COUNTRIES.map(name => ({name, kind: "country"}));
    return uniquePlaces([...cities, ...countries]);
  }

  function levenshtein(a, b) {
    const s = keyOf(a);
    const t = keyOf(b);
    if (s === t) return 0;
    if (!s) return t.length;
    if (!t) return s.length;
    const rows = Array.from({length: t.length + 1}, (_, i) => i);
    for (let i = 1; i <= s.length; i += 1) {
      let prev = i - 1;
      rows[0] = i;
      for (let j = 1; j <= t.length; j += 1) {
        const cur = rows[j];
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, prev + cost);
        prev = cur;
      }
    }
    return rows[t.length];
  }

  function localSuggest(raw, catalog) {
    const value = text(raw);
    if (!value) return {ok: true, empty: true, suggestion: "", confidence: 1, source: "empty"};
    const key = keyOf(value);
    const alias = ALIASES[key];
    const places = catalog || catalogPlaces();
    if (alias) {
      const hit = places.find(p => p.key === keyOf(alias)) || {name: alias, kind: "place", key: keyOf(alias)};
      return {ok: true, suggestion: hit.name, kind: hit.kind, confidence: 0.99, source: "alias", input: value};
    }
    const exact = places.find(p => p.key === key);
    if (exact) return {ok: true, suggestion: exact.name, kind: exact.kind, confidence: 1, source: "exact", input: value};
    const prefix = places.filter(p => p.key.startsWith(key) || key.startsWith(p.key)).sort((a, b) => a.name.length - b.name.length)[0];
    if (prefix && Math.abs(prefix.key.length - key.length) <= 4) {
      return {ok: true, suggestion: prefix.name, kind: prefix.kind, confidence: 0.86, source: "prefix", input: value};
    }
    let best = null;
    let bestDist = 99;
    places.forEach(p => {
      if (Math.abs(p.key.length - key.length) > 3) return;
      const dist = levenshtein(key, p.key);
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    });
    const maxDist = key.length >= 8 ? 2 : 1;
    if (best && bestDist <= maxDist && bestDist > 0) {
      return {ok: true, suggestion: best.name, kind: best.kind, confidence: bestDist === 1 ? 0.9 : 0.78, source: "fuzzy", input: value};
    }
    return {ok: false, suggestion: "", kind: "", confidence: 0, source: "none", input: value};
  }

  function splitTokens(raw) {
    return String(raw || "").split(/[,;|/]+/).map(part => text(part)).filter(Boolean);
  }

  function joinTokens(tokens) {
    return tokens.map(part => text(part)).filter(Boolean).join(", ");
  }

  function functionsClient() {
    try {
      if (!root?.firebase?.functions) return null;
      const region = root.FLOQR_AI_FUNCTIONS_REGION || "us-central1";
      return root.firebase.app().functions(region);
    } catch (_) {
      return null;
    }
  }

  async function geminiSuggest(tokens, language) {
    const client = functionsClient();
    const names = (tokens || []).map(text).filter(Boolean).slice(0, 8);
    if (!client || !names.length) return [];
    try {
      const callable = client.httpsCallable(root.FLOQR_AI_PLACE_SUGGEST_FUNCTION || "aiSuggestPlaceNames");
      const response = await callable({
        tokens: names,
        preferredLanguage: String(language || root.FLOQRI18n?.getLanguage?.() || "en").slice(0, 8)
      });
      const places = Array.isArray(response?.data?.places) ? response.data.places : [];
      return places.slice(0, 8).map(item => ({
        input: text(item.input || item.original),
        suggestion: text(item.suggestion || item.name),
        kind: text(item.kind || "place") || "place",
        confidence: Number(item.confidence || 0.7),
        source: "gemini"
      })).filter(item => item.input && item.suggestion);
    } catch (error) {
      console.warn("FLOQR place suggest Gemini fallback:", error?.message || error);
      return [];
    }
  }

  async function suggestToken(raw, opts = {}) {
    const local = localSuggest(raw, opts.catalog);
    if (local.empty) return local;
    if (local.ok && local.confidence >= 0.86) return local;
    if (opts.allowGemini === false) return local;
    const remote = await geminiSuggest([raw], opts.language);
    const hit = remote.find(item => keyOf(item.input) === keyOf(raw) && item.suggestion);
    if (hit && keyOf(hit.suggestion) !== keyOf(raw)) {
      return {
        ok: true,
        suggestion: hit.suggestion,
        kind: hit.kind,
        confidence: hit.confidence,
        source: "gemini",
        input: text(raw)
      };
    }
    return local;
  }

  function setHint(el, message, isError) {
    if (!el) return;
    const textValue = text(message);
    el.hidden = !textValue;
    el.textContent = textValue;
    el.classList.toggle("is-error", !!isError && !!textValue);
  }

  function bindPlaceField(opts = {}) {
    const input = typeof opts.input === "string" ? root?.document?.getElementById(opts.input) : opts.input;
    const hint = typeof opts.hint === "string" ? root?.document?.getElementById(opts.hint) : opts.hint;
    const suggestBox = typeof opts.suggest === "string" ? root?.document?.getElementById(opts.suggest) : opts.suggest;
    if (!input) return null;
    const catalog = catalogPlaces();
    let pending = "";

    function hideSuggest() {
      if (!suggestBox) return;
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
    }

    function showSuggest(token, suggestion) {
      if (!suggestBox || !suggestion || keyOf(suggestion) === keyOf(token)) {
        hideSuggest();
        return;
      }
      pending = token;
      suggestBox.hidden = false;
      const useLabel = t("portal.travel.useSuggestion", "Use {name}", {name: suggestion});
      const keepLabel = t("portal.travel.keepTyped", "Keep what I typed");
      suggestBox.innerHTML = `<p>${t("portal.travel.didYouMean", "Did you mean {name}?", {name: suggestion})}</p>
        <div class="place-suggest-actions">
          <button type="button" class="primary" data-place-use="${encodeURIComponent(suggestion)}">${useLabel}</button>
          <button type="button" data-place-keep="1">${keepLabel}</button>
        </div>`;
    }

    function replaceToken(from, to) {
      const tokens = splitTokens(input.value).map(part => keyOf(part) === keyOf(from) ? to : part);
      if (!splitTokens(input.value).some(part => keyOf(part) === keyOf(from)) && text(input.value) && !/,/.test(input.value)) {
        input.value = to;
      } else {
        input.value = joinTokens(tokens);
      }
      input.dispatchEvent(new Event("input", {bubbles: true}));
    }

    async function reviewLastToken() {
      const tokens = splitTokens(input.value);
      const last = tokens[tokens.length - 1] || "";
      if (!last) {
        setHint(hint, "", false);
        hideSuggest();
        return {ok: true, empty: true};
      }
      const result = await suggestToken(last, {catalog, language: root.FLOQRI18n?.getLanguage?.()});
      if (result.ok && result.suggestion && keyOf(result.suggestion) !== keyOf(last)) {
        setHint(hint, t("portal.travel.didYouMean", "Did you mean {name}?", {name: result.suggestion}), false);
        showSuggest(last, result.suggestion);
        return result;
      }
      if (!result.ok) {
        setHint(hint, t("portal.travel.unknownPlace", "We could not match that city or country. Pick a suggestion or check the spelling."), false);
        hideSuggest();
        return result;
      }
      if (result.ok && result.suggestion && keyOf(result.suggestion) === keyOf(last) && result.suggestion !== last) {
        replaceToken(last, result.suggestion);
      }
      setHint(hint, "", false);
      hideSuggest();
      return result;
    }

    if (suggestBox) {
      suggestBox.addEventListener("click", event => {
        const use = event.target?.getAttribute?.("data-place-use");
        if (use) {
          replaceToken(pending, decodeURIComponent(use));
          hideSuggest();
          setHint(hint, "", false);
          return;
        }
        if (event.target?.getAttribute?.("data-place-keep")) hideSuggest();
      });
    }
    input.addEventListener("blur", () => { reviewLastToken(); });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        reviewLastToken();
      }
    });
    input.addEventListener("input", () => {
      if (/[,;]$/.test(input.value)) reviewLastToken();
    });
    input.setAttribute("placeholder", input.getAttribute("placeholder") || t("portal.travel.placeholderPrior", "Barcelona, Miami, Spain"));

    return {
      review: reviewLastToken,
      suggestToken: raw => suggestToken(raw, {catalog}),
      readTokens: () => splitTokens(input.value)
    };
  }

  return {
    catalogPlaces,
    localSuggest,
    splitTokens,
    joinTokens,
    suggestToken,
    geminiSuggest,
    bindPlaceField
  };
});
