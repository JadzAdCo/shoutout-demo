/* FLOQR venue / activity query parser — "Hip Hop Clubs in DC", "EDM Events in New York". */
// Design notes: .cursor/rules/design-notes-floqai-venue-search.mdc
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FLOQRVenueQuery = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const VERSION = "s3.0.106";

  const VENUE_TYPES = [
    {
      id: "events",
      i18n: "cat.events",
      label: "Events",
      words: [
        "event", "events", "party", "parties", "live show", "live shows", "concert", "concerts",
        "gig", "gigs", "festival", "festivals", "rave", "raves", "day party", "day parties",
        "brunch party", "comedy show", "comedy shows", "ticket", "tickets", "happening", "happenings",
        "evento", "eventos", "evenement", "evenements", "veranstaltung", "veranstaltungen",
        "evenementen", "wydarzenie", "wydarzenia", "fiesta", "fiestas", "fete", "festa", "feste",
        "eventi", "мероприятие", "мероприятия", "событие", "события", "εκδηλωση", "εκδηλωσεις",
        "فعالية", "فعاليات", "الفعاليات", "حفلة", "حفلات"
      ]
    },
    {
      id: "beach-clubs",
      i18n: "cat.beachClubs",
      label: "Beach Clubs",
      words: [
        "beach club", "beach clubs", "beachclub", "beachclubs", "beach-club", "beach-clubs",
        "beach bar", "beach bars", "beachbar", "beachbars", "beach lounge club",
        "club de playa", "clubes de playa", "club de plage", "clubs de plage", "strandclub",
        "strandclubs", "strandbar", "beach klub", "club sulla spiaggia", "clubes de praia", "club de praia",
        "kluby plazowe", "klub plazowy", "пляжный клуб", "пляжные клубы", "πλαζ κλαμπ",
        "نادي شاطئ", "نادي الشاطئ", "نوادي الشاطئ"
      ]
    },
    {
      id: "lounge-club",
      i18n: "cat.loungeClubs",
      label: "Lounge-Clubs",
      words: [
        "lounge club", "lounge clubs", "loungeclub", "loungeclubs", "lounge-club", "lounge-clubs",
        "lounge and club", "lounge n club", "club lounge", "club lounges", "clublounge", "club-lounge",
        "lounge nightclub", "lounge night club", "clubs lounge", "lounge clubes", "kluby wypoczynkowe",
        "лаунж клуб", "лаунж клубы"
      ]
    },
    {
      id: "lounges",
      i18n: "cat.lounges",
      label: "Lounges",
      words: [
        "lounge", "lounges", "cocktail lounge", "cocktail lounges", "hookah lounge", "hookah lounges",
        "hookah", "shisha lounge", "shisha", "cigar lounge", "cigar lounges", "sky lounge",
        "rooftop lounge", "rooftop lounges", "lounge bar", "lounge bars", "loungebar",
        "salon", "salons", "salotto", "salotti", "лаунж", "лаунжи", "λαουντζ", "صالة", "الصالات"
      ]
    },
    {
      id: "clubs",
      i18n: "cat.clubs",
      label: "Clubs",
      words: [
        "club", "clubs", "nightclub", "nightclubs", "night club", "night clubs", "night-club",
        "night-clubs", "dance club", "dance clubs", "disco", "discos", "discotheque", "discotheques",
        "discoteca", "discotecas", "discoteche", "disko", "diskothek", "diskotheken", "boite de nuit",
        "boites de nuit", "boite", "nachtclub", "nachtclubs", "klub", "kluby", "klubs", "clubes",
        "клуб", "клубы", "ночной клуб", "ночные клубы", "κλαμπ", "νυχτερινο κεντρο", "νυχτερινα κλαμπ",
        "نادي", "نوادي", "النوادي", "نادي ليلي", "ملهى"
      ]
    }
  ];

  const GENRES = [
    {id: "Hip Hop", words: ["hip hop", "hiphop", "hip-hop", "rap", "trap", "drill", "hip hop and rnb", "хип хоп", "хипхоп", "هيب هوب"]},
    {id: "EDM", words: ["edm", "electronic", "electronic dance music", "electro", "dance music", "big room", "dubstep"]},
    {id: "Afro House", words: ["afro house", "afrohouse", "afro-house"]},
    {id: "House", words: ["house", "house music", "deep house", "tech house", "techhouse"]},
    {id: "Techno", words: ["techno", "hard techno", "minimal techno"]},
    {id: "Afrobeats", words: ["afrobeats", "afrobeat", "afro beats", "afro beat", "afro-beats", "naija"]},
    {id: "Amapiano", words: ["amapiano", "ama piano"]},
    {id: "R&B", words: ["r and b", "rnb", "r n b", "rhythm and blues", "r b"]},
    {id: "Reggaeton", words: ["reggaeton", "regueton", "reggaetón", "perreo", "latin trap"]},
    {id: "Latin", words: ["latin", "latino", "latina", "salsa", "bachata", "merengue", "cumbia"]},
    {id: "Dancehall", words: ["dancehall", "reggae", "soca", "caribbean"]},
    {id: "Kizomba", words: ["kizomba", "zouk"]},
    {id: "Jazz", words: ["jazz", "live jazz", "smooth jazz"]},
    {id: "Soul", words: ["soul", "neo soul", "neosoul"]},
    {id: "Pop", words: ["pop", "top 40", "top40", "chart hits"]},
    {id: "Rock", words: ["rock", "indie", "alternative"]},
    {id: "Country", words: ["country", "country music"]},
    {id: "Go-Go", words: ["go go", "gogo", "go-go"]},
    {id: "K-Pop", words: ["kpop", "k pop", "k-pop"]},
    {id: "Open Format", words: ["open format", "multi genre", "variety"]},
    {id: "Drum & Bass", words: ["drum and bass", "dnb", "d and b"]},
    {id: "Comedy", words: ["comedy", "stand up", "standup", "stand-up", "comedian", "comedians"]}
  ];

  /* detect = phrases that name the place; match = extra spellings accepted on records. */
  const PLACES = [
    {id: "washington-dc", label: "Washington DC", detect: ["dc", "d c", "washington dc", "washington d c", "district of columbia", "dmv"], match: ["washington", "district of columbia", "dc"]},
    {id: "new-york", label: "New York", detect: ["new york", "new york city", "nyc", "ny", "nueva york", "nova york", "нью йорк"], match: ["new york", "nyc", "manhattan", "brooklyn", "queens", "bronx"]},
    {id: "los-angeles", label: "Los Angeles", detect: ["los angeles", "la", "l a"], match: ["los angeles", "hollywood", "west hollywood"]},
    {id: "miami-beach", label: "Miami Beach", detect: ["miami beach", "south beach", "sobe"], match: ["miami beach"]},
    {id: "miami", label: "Miami", detect: ["miami"], match: ["miami", "miami beach", "wynwood", "brickell"]},
    {id: "atlanta", label: "Atlanta", detect: ["atlanta", "atl"], match: ["atlanta"]},
    {id: "las-vegas", label: "Las Vegas", detect: ["las vegas", "vegas"], match: ["las vegas", "vegas"]},
    {id: "chicago", label: "Chicago", detect: ["chicago", "chi town", "chitown"], match: ["chicago"]},
    {id: "houston", label: "Houston", detect: ["houston", "htx"], match: ["houston"]},
    {id: "san-francisco", label: "San Francisco", detect: ["san francisco", "sf"], match: ["san francisco"]},
    {id: "philadelphia", label: "Philadelphia", detect: ["philadelphia", "philly"], match: ["philadelphia"]},
    {id: "new-orleans", label: "New Orleans", detect: ["new orleans", "nola"], match: ["new orleans"]},
    {id: "baltimore", label: "Baltimore", detect: ["baltimore", "bmore"], match: ["baltimore"]},
    {id: "boston", label: "Boston", detect: ["boston"], match: ["boston"]},
    {id: "toronto", label: "Toronto", detect: ["toronto"], match: ["toronto"]},
    {id: "london", label: "London", detect: ["london", "ldn"], match: ["london"]},
    {id: "paris", label: "Paris", detect: ["paris"], match: ["paris"]},
    {id: "barcelona", label: "Barcelona", detect: ["barcelona", "bcn"], match: ["barcelona"]},
    {id: "madrid", label: "Madrid", detect: ["madrid"], match: ["madrid"]},
    {id: "ibiza", label: "Ibiza", detect: ["ibiza", "eivissa"], match: ["ibiza", "eivissa"]},
    {id: "berlin", label: "Berlin", detect: ["berlin"], match: ["berlin"]},
    {id: "dubai", label: "Dubai", detect: ["dubai"], match: ["dubai"]},
    {id: "lagos", label: "Lagos", detect: ["lagos"], match: ["lagos"]},
    {id: "mexico-city", label: "Mexico City", detect: ["mexico city", "cdmx", "ciudad de mexico"], match: ["mexico city", "ciudad de mexico", "cdmx"]},
    {id: "monaco", label: "Monaco", detect: ["monaco", "monte carlo", "montecarlo"], match: ["monaco", "monte carlo"]},
    {id: "cannes", label: "Cannes", detect: ["cannes"], match: ["cannes"]},
    {id: "mykonos", label: "Mykonos", detect: ["mykonos", "μυκονος"], match: ["mykonos"]},
    {id: "milan", label: "Milan", detect: ["milan", "milano"], match: ["milan", "milano"]}
  ];

  /* "Near me" in every supported language: the user's own location (GPS, then IP), not a place name. */
  const NEAR_ME = [
    "near me", "nearby", "near by", "near here", "close to me", "close by", "closest", "nearest",
    "around me", "around here", "near my location", "in my area",
    "cerca de mi", "cerca", "mas cercano", "mas cercanos", "cercanos",
    "pres de moi", "a proximite", "autour de moi", "le plus proche", "les plus proches",
    "in der nahe", "in meiner nahe", "in der naehe", "nahe", "nachste", "in meiner umgebung",
    "vicino a me", "qui vicino", "nelle vicinanze", "piu vicino", "piu vicini",
    "perto de mim", "proximo de mim", "perto", "mais proximo", "mais proximos",
    "рядом", "рядом со мной", "поблизости", "ближайшие", "ближайший",
    "κοντα μου", "κοντα", "πλησιεστερα", "πλησιεστερο",
    "w poblizu", "blisko mnie", "blisko", "najblizsze", "najblizej",
    "in de buurt", "bij mij in de buurt", "dichtbij", "dichtbij mij", "dichtstbijzijnde",
    "بالقرب مني", "قريب مني", "قريب", "الاقرب"
  ];

  const PLACE_PREPOSITIONS = new Set(["in", "near", "around", "en", "em", "im", "w", "в", "σε", "στο", "στη", "στην", "في"]);
  const STOP_WORDS = new Set([
    "a", "an", "the", "some", "any", "best", "top", "good", "great", "cool", "find", "show", "me",
    "search", "searching", "for", "looking", "look", "want", "i", "im", "id", "like", "to", "go", "of",
    "with", "and", "or", "please", "where", "are", "is", "there", "can", "you", "get", "list", "all",
    "near", "in", "around", "at", "my", "area", "nearby"
  ]);

  const WHEN_WORDS = new Set([
    "tonight", "today", "tomorrow", "weekend", "weekends", "now",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "mondays", "tuesdays", "wednesdays", "thursdays", "fridays", "saturdays", "sundays"
  ]);

  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function compact(value) {
    return normalize(value).replace(/\s+/g, "");
  }

  function singular(key) {
    if (key.length > 4 && key.endsWith("ies")) return `${key.slice(0, -3)}y`;
    if (key.length > 3 && key.endsWith("s")) return key.slice(0, -1);
    return key;
  }

  function buildLexicon() {
    const map = new Map();
    const add = (word, entry) => {
      const key = compact(word);
      if (!key || map.has(key)) return;
      map.set(key, entry);
    };
    NEAR_ME.forEach(word => add(word, {kind: "near", id: "near-me"}));
    PLACES.forEach(place => place.detect.forEach(word => add(word, {kind: "place", id: place.id})));
    VENUE_TYPES.forEach(type => type.words.forEach(word => add(word, {kind: "type", id: type.id})));
    GENRES.forEach(genre => genre.words.forEach(word => add(word, {kind: "genre", id: genre.id})));
    return map;
  }

  const LEXICON = buildLexicon();
  const MAX_SPAN = 4;
  const TYPE_SUFFIXES = Array.from(LEXICON.entries())
    .filter(([key, entry]) => entry.kind === "type" && key.length >= 4)
    .sort((a, b) => b[0].length - a[0].length);

  /* "hiphopclubs" / "technoclub" / "salsaparty": genre prefix glued to a type word. */
  function splitCompound(token) {
    if (token.length < 7) return null;
    for (const [suffix, entry] of TYPE_SUFFIXES) {
      if (!token.endsWith(suffix) || token.length === suffix.length) continue;
      const prefix = token.slice(0, -suffix.length);
      const genre = LEXICON.get(prefix);
      if (genre && genre.kind === "genre") return {type: entry.id, genre: genre.id};
    }
    return null;
  }

  function lookupSpan(tokens) {
    const key = tokens.join("");
    return LEXICON.get(key) || LEXICON.get(singular(key)) || null;
  }

  function typeById(id) {
    return VENUE_TYPES.find(type => type.id === id) || null;
  }

  function placeById(id) {
    return PLACES.find(place => place.id === id) || null;
  }

  function titleCase(value) {
    return String(value || "").replace(/\S+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
  }

  function pickType(typeHits) {
    if (!typeHits.length) return "";
    if (typeHits.includes("events")) return "events";
    const specificity = ["lounge-club", "beach-clubs", "lounges", "clubs"];
    return specificity.find(id => typeHits.includes(id)) || typeHits[0];
  }

  function extractFreePlace(tokens, consumed) {
    let prepAt = -1;
    tokens.forEach((token, index) => {
      if (!consumed[index] && PLACE_PREPOSITIONS.has(token)) prepAt = index;
    });
    if (prepAt < 0) return null;
    const words = [];
    for (let i = prepAt + 1; i < tokens.length; i += 1) {
      if (consumed[i] || WHEN_WORDS.has(tokens[i]) || tokens[i] === "this" || tokens[i] === "next") break;
      words.push(tokens[i]);
    }
    if (!words.length) return null;
    for (let i = prepAt; i < prepAt + 1 + words.length; i += 1) consumed[i] = true;
    const text = words.join(" ");
    return {id: `free:${text}`, label: titleCase(text), match: [text]};
  }

  /**
   * @param {string} query
   * @param {{entry?: string}} [opts] entry = where the search was typed:
   *   "category" (Search for page) or a listing type ("events", "clubs", ...).
   */
  function parse(query, opts = {}) {
    const normalized = normalize(query);
    const tokens = normalized ? normalized.split(" ") : [];
    const consumed = tokens.map(() => false);
    const typeHits = [];
    const genres = [];
    let place = null;
    let nearMe = false;

    for (let i = 0; i < tokens.length; i += 1) {
      if (consumed[i]) continue;
      for (let span = Math.min(MAX_SPAN, tokens.length - i); span >= 1; span -= 1) {
        const hit = lookupSpan(tokens.slice(i, i + span));
        if (!hit) continue;
        if (hit.kind === "place" && place) continue;
        for (let k = i; k < i + span; k += 1) consumed[k] = true;
        if (hit.kind === "type" && !typeHits.includes(hit.id)) typeHits.push(hit.id);
        if (hit.kind === "genre" && !genres.includes(hit.id)) genres.push(hit.id);
        if (hit.kind === "near") nearMe = true;
        if (hit.kind === "place") {
          const known = placeById(hit.id);
          place = {id: known.id, label: known.label, match: Array.from(new Set([...known.detect, ...known.match]))};
        }
        i += span - 1;
        break;
      }
    }

    tokens.forEach((token, index) => {
      if (consumed[index]) return;
      const parts = splitCompound(token);
      if (!parts) return;
      consumed[index] = true;
      if (!typeHits.includes(parts.type)) typeHits.push(parts.type);
      if (!genres.includes(parts.genre)) genres.push(parts.genre);
    });

    if (!place) place = extractFreePlace(tokens, consumed);

    const leftovers = tokens.filter((token, index) => !consumed[index] && !STOP_WORDS.has(token));
    const when = leftovers.filter(token => WHEN_WORDS.has(token));
    const residual = leftovers.filter(token => !WHEN_WORDS.has(token) && token !== "this" && token !== "next").join(" ");

    const queryType = pickType(typeHits);
    const entry = String(opts.entry || "category");
    const entryType = typeById(entry) ? entry : "";
    const type = queryType || entryType || "events";
    const typeSource = queryType ? "query" : entryType ? "entry" : "default";

    return {
      query: String(query || ""),
      normalized,
      type,
      typeSource,
      typeHits,
      venueHint: typeHits.find(id => id !== "events") || "",
      genres,
      place,
      nearMe: nearMe && !place,
      when,
      residual,
      entry
    };
  }

  function isVenueQuery(parsed) {
    return !!(parsed && (parsed.typeHits.length || parsed.genres.length || (parsed.place && !parsed.place.id.startsWith("free:"))));
  }

  function padded(value) {
    return ` ${normalize(value)} `;
  }

  function listText(values) {
    return values.flat(3).filter(v => v != null && v !== "").map(v => (typeof v === "object" ? Object.values(v).join(" ") : String(v))).join(" ");
  }

  function phraseHit(hayPadded, hayCompact, phrase) {
    const norm = normalize(phrase);
    if (!norm) return false;
    if (hayPadded.includes(` ${norm} `)) return true;
    const key = norm.replace(/\s+/g, "");
    return key.length >= 5 && hayCompact.includes(key);
  }

  function genreWords(id) {
    return GENRES.find(genre => genre.id === id)?.words || [id];
  }

  function matchesGenres(parsed, record = {}, extraText = "") {
    if (!parsed?.genres?.length) return true;
    const text = listText([
      record.genres, record.genre, record.categories, record.category, record.tags,
      record.publicSearchKeywords, record.eventName, record.title, record.description, extraText
    ]);
    const hay = padded(text);
    const hayCompact = compact(text);
    return parsed.genres.every(id => [id, ...genreWords(id)].some(word => phraseHit(hay, hayCompact, word)));
  }

  function matchesPlace(parsed, record = {}, extraText = "") {
    if (!parsed?.place) return true;
    const text = listText([
      record.city, record.region, record.stateRegion, record.state, record.country,
      record.locationLabel, record.address, record.neighborhood, record.locationName,
      record.brandName, extraText
    ]);
    const hay = padded(text);
    const hayCompact = compact(text);
    return parsed.place.match.some(word => phraseHit(hay, hayCompact, word));
  }

  function matchesFilters(parsed, record, extraText) {
    return matchesGenres(parsed, record, extraText) && matchesPlace(parsed, record, extraText);
  }

  function typeLabel(id, translate) {
    const type = typeById(id);
    if (!type) return "";
    if (typeof translate === "function") {
      const out = translate(type.i18n);
      if (out && out !== type.i18n) return out;
    }
    return type.label;
  }

  function wordList() {
    return {
      types: VENUE_TYPES.map(type => ({id: type.id, label: type.label, words: type.words.slice()})),
      genres: GENRES.map(genre => ({id: genre.id, words: genre.words.slice()})),
      places: PLACES.map(place => ({id: place.id, label: place.label, detect: place.detect.slice(), match: place.match.slice()}))
    };
  }

  return {
    VERSION,
    VENUE_TYPES,
    GENRES,
    PLACES,
    normalize,
    parse,
    isVenueQuery,
    matchesGenres,
    matchesPlace,
    matchesFilters,
    typeLabel,
    typeById,
    wordList
  };
});
