/* BOT DEE city / place tokens — packaged aliases in all 11 langs + Firestore overlay.
   No Gemini. Master Admin upsert fills missing langs from this table (or copies the source token). */
"use strict";

const ALLOWED_LANGS = Object.freeze(["en", "de", "fr", "es", "it", "pt", "ru", "el", "pl", "nl", "ar"]);

const PROTECTED_BRANDS = Object.freeze([
  "shoutout", "bot dee", "botdee", "floqr", "floqcast", "floq media", "floqmedia",
  "mingl", "bartr", "rydr", "vip reserv", "smartview", "smartpreview", "donpapi",
  "google", "microsoft", "facebook", "stripe", "whatsapp", "sms", "otp", "djbot", "dj bot"
]);

const PACKAGED = Object.freeze([
  {
    placeId: "washington-dc",
    canonicalTokens: ["washington", "dc"],
    consumed: ["washington", "dc", "district", "columbia"],
    aliasesByLang: {
      en: ["washington", "washington dc", "dc", "district of columbia"],
      de: ["washington", "washington dc"],
      fr: ["washington", "washington dc"],
      es: ["washington", "washington dc"],
      it: ["washington", "washington dc"],
      pt: ["washington", "washington dc"],
      ru: ["вашингтон", "вашингтон окр"],
      el: ["ουάσινγκτον"],
      pl: ["waszyngton"],
      nl: ["washington", "washington dc"],
      ar: ["واشنطن"]
    }
  },
  {
    placeId: "chinatown",
    canonicalTokens: ["chinatown"],
    consumed: ["chinatown"],
    aliasesByLang: {
      en: ["chinatown"], de: ["chinatown"], fr: ["chinatown"], es: ["barrio chino"],
      it: ["chinatown"], pt: ["bairro chinês"], ru: ["чайна-таун"], el: ["τσάιναταουν"],
      pl: ["chinatown"], nl: ["chinatown"], ar: ["تشايناتاون"]
    }
  },
  {
    placeId: "dupont",
    canonicalTokens: ["dupont"],
    consumed: ["dupont", "circle"],
    aliasesByLang: {
      en: ["dupont", "dupont circle"], de: ["dupont"], fr: ["dupont"], es: ["dupont"],
      it: ["dupont"], pt: ["dupont"], ru: ["дюпон"], el: ["ντιπόν"], pl: ["dupont"],
      nl: ["dupont"], ar: ["دوبونت"]
    }
  },
  {
    placeId: "new-york",
    canonicalTokens: ["new york", "nyc", "manhattan"],
    consumed: ["new", "york", "nyc", "manhattan", "city"],
    aliasesByLang: {
      en: ["new york", "nyc", "manhattan", "new york city"],
      de: ["new york", "nyc", "manhattan"],
      fr: ["new york", "nyc", "manhattan"],
      es: ["nueva york", "nyc", "manhattan"],
      it: ["new york", "nyc", "manhattan"],
      pt: ["nova york", "nyc", "manhattan"],
      ru: ["нью-йорк", "манхэттен"],
      el: ["νέα υόρκη", "μανχάταν"],
      pl: ["nowy jork", "manhattan"],
      nl: ["new york", "nyc", "manhattan"],
      ar: ["نيويورك", "مانهاتن"]
    }
  },
  {
    placeId: "miami",
    canonicalTokens: ["miami"],
    consumed: ["miami"],
    aliasesByLang: {
      en: ["miami"], de: ["miami"], fr: ["miami"], es: ["miami"], it: ["miami"],
      pt: ["miami"], ru: ["майами"], el: ["μαϊάμι"], pl: ["miami"], nl: ["miami"], ar: ["ميامي"]
    }
  },
  {
    placeId: "miami-beach",
    canonicalTokens: ["miami", "miami beach"],
    consumed: ["miami", "beach", "south", "sobe"],
    aliasesByLang: {
      en: ["miami beach", "south beach", "sobe"],
      de: ["miami beach", "south beach"],
      fr: ["miami beach", "south beach"],
      es: ["miami beach", "south beach"],
      it: ["miami beach", "south beach"],
      pt: ["miami beach", "south beach"],
      ru: ["майами-бич"],
      el: ["μάιαμι μπιτς"],
      pl: ["miami beach"],
      nl: ["miami beach"],
      ar: ["ميامي بيتش"]
    }
  },
  {
    placeId: "paris",
    canonicalTokens: ["paris"],
    consumed: ["paris"],
    aliasesByLang: {
      en: ["paris"], de: ["paris"], fr: ["paris"], es: ["parís"], it: ["parigi"],
      pt: ["paris"], ru: ["париж"], el: ["παρίσι"], pl: ["paryż"], nl: ["parijs"], ar: ["باريس"]
    }
  },
  {
    placeId: "ibiza",
    canonicalTokens: ["ibiza"],
    consumed: ["ibiza"],
    aliasesByLang: {
      en: ["ibiza"], de: ["ibiza"], fr: ["ibiza"], es: ["ibiza"], it: ["ibiza"],
      pt: ["ibiza"], ru: ["ибица"], el: ["ίμπιζα"], pl: ["ibiza"], nl: ["ibiza"], ar: ["إيبيزا"]
    }
  },
  {
    placeId: "london",
    canonicalTokens: ["london"],
    consumed: ["london"],
    aliasesByLang: {
      en: ["london"], de: ["london"], fr: ["londres"], es: ["londres"], it: ["londra"],
      pt: ["londres"], ru: ["лондон"], el: ["λονδίνο"], pl: ["londyn"], nl: ["londen"], ar: ["لندن"]
    }
  },
  {
    placeId: "atlanta",
    canonicalTokens: ["atlanta"],
    consumed: ["atlanta"],
    aliasesByLang: {
      en: ["atlanta"], de: ["atlanta"], fr: ["atlanta"], es: ["atlanta"], it: ["atlanta"],
      pt: ["atlanta"], ru: ["атланта"], el: ["ατλάντα"], pl: ["atlanta"], nl: ["atlanta"], ar: ["أتلانتا"]
    }
  },
  {
    placeId: "vegas",
    canonicalTokens: ["vegas", "las vegas"],
    consumed: ["las", "vegas"],
    aliasesByLang: {
      en: ["las vegas", "vegas"], de: ["las vegas", "vegas"], fr: ["las vegas", "vegas"],
      es: ["las vegas", "vegas"], it: ["las vegas", "vegas"], pt: ["las vegas", "vegas"],
      ru: ["лас-вегас"], el: ["λας βέγκας"], pl: ["las vegas"], nl: ["las vegas", "vegas"],
      ar: ["لاس فيغاس"]
    }
  },
  {
    placeId: "cancun",
    canonicalTokens: ["cancun"],
    consumed: ["cancun"],
    aliasesByLang: {
      en: ["cancun", "cancún"], de: ["cancun", "cancún"], fr: ["cancún"], es: ["cancún"],
      it: ["cancun"], pt: ["cancún"], ru: ["канкун"], el: ["κανκούν"], pl: ["cancun"],
      nl: ["cancun"], ar: ["كانكون"]
    }
  },
  {
    placeId: "mykonos",
    canonicalTokens: ["mykonos"],
    consumed: ["mykonos"],
    aliasesByLang: {
      en: ["mykonos"], de: ["mykonos"], fr: ["mykonos"], es: ["miconos"], it: ["micono"],
      pt: ["miconos"], ru: ["миконос"], el: ["μύκονος"], pl: ["mykonos"], nl: ["mykonos"], ar: ["ميكونوس"]
    }
  },
  {
    placeId: "bali",
    canonicalTokens: ["bali"],
    consumed: ["bali"],
    aliasesByLang: {
      en: ["bali"], de: ["bali"], fr: ["bali"], es: ["bali"], it: ["bali"],
      pt: ["bali"], ru: ["бали"], el: ["μπαλί"], pl: ["bali"], nl: ["bali"], ar: ["بالي"]
    }
  },
  {
    placeId: "milan",
    canonicalTokens: ["milan"],
    consumed: ["milan", "milano"],
    aliasesByLang: {
      en: ["milan", "milano"], de: ["mailand", "milan"], fr: ["milan"], es: ["milán"],
      it: ["milano"], pt: ["milão"], ru: ["милан"], el: ["μιλάνο"], pl: ["mediolan"],
      nl: ["milaan"], ar: ["ميلانو"]
    }
  },
  {
    placeId: "barcelona",
    canonicalTokens: ["barcelona"],
    consumed: ["barcelona"],
    aliasesByLang: {
      en: ["barcelona"], de: ["barcelona"], fr: ["barcelone"], es: ["barcelona"],
      it: ["barcellona"], pt: ["barcelona"], ru: ["барселона"], el: ["βαρκελώνη"],
      pl: ["barcelona"], nl: ["barcelona"], ar: ["برشلونة"]
    }
  },
  {
    placeId: "madrid",
    canonicalTokens: ["madrid"],
    consumed: ["madrid"],
    aliasesByLang: {
      en: ["madrid"], de: ["madrid"], fr: ["madrid"], es: ["madrid"], it: ["madrid"],
      pt: ["madrid"], ru: ["мадрид"], el: ["μαδρίτη"], pl: ["madryt"], nl: ["madrid"], ar: ["مدريد"]
    }
  },
  {
    placeId: "lisbon",
    canonicalTokens: ["lisbon"],
    consumed: ["lisbon", "lisboa"],
    aliasesByLang: {
      en: ["lisbon", "lisboa"], de: ["lissabon"], fr: ["lisbonne"], es: ["lisboa"],
      it: ["lisbona"], pt: ["lisboa"], ru: ["лиссабон"], el: ["λισαβόνα"], pl: ["lizbona"],
      nl: ["lissabon"], ar: ["لشبونة"]
    }
  },
  {
    placeId: "seattle",
    canonicalTokens: ["seattle"],
    consumed: ["seattle"],
    aliasesByLang: {
      en: ["seattle"], de: ["seattle"], fr: ["seattle"], es: ["seattle"], it: ["seattle"],
      pt: ["seattle"], ru: ["сиэтл"], el: ["σιάτλ"], pl: ["seattle"], nl: ["seattle"], ar: ["سياتل"]
    }
  },
  {
    placeId: "thailand",
    canonicalTokens: ["thailand"],
    consumed: ["thailand"],
    aliasesByLang: {
      en: ["thailand"], de: ["thailand"], fr: ["thaïlande"], es: ["tailandia"], it: ["thailandia"],
      pt: ["tailândia"], ru: ["таиланд"], el: ["ταϊλάνδη"], pl: ["tajlandia"], nl: ["thailand"], ar: ["تايلاند"]
    }
  }
]);

function allowedLang(value) {
  const code = String(value || "").trim().toLowerCase().split("-")[0];
  return ALLOWED_LANGS.includes(code) ? code : "";
}

function foldChars(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201B\u2032`´]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function normalizePlaceNeedle(value) {
  return foldChars(value)
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/['"]/g, "")
    .replace(/[^\p{L}\p{N}@\s._/-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function placePhraseHit(hay, alias) {
  const a = normalizePlaceNeedle(alias);
  if (!a) return false;
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRe(a)}(?:$|[^\\p{L}\\p{N}])`, "iu");
  return re.test(` ${hay} `);
}

function unique(list) {
  return [...new Set((list || []).map(item => String(item || "").trim()).filter(Boolean))];
}

function isProtectedBrand(token) {
  const n = normalizePlaceNeedle(token);
  if (!n) return false;
  return PROTECTED_BRANDS.some(brand => n === brand || n.includes(brand));
}

function slugFromToken(token) {
  const latin = normalizePlaceNeedle(token).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 48);
  const ascii = latin.replace(/[^a-z0-9-]+/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (ascii) return ascii;
  const hex = Buffer.from(String(token || ""), "utf8").toString("hex").slice(0, 16);
  return `place-${hex || "token"}`;
}

function emptyAliases() {
  const out = {};
  ALLOWED_LANGS.forEach(lang => { out[lang] = []; });
  return out;
}

function mergeAliasMap(base, extra) {
  const out = emptyAliases();
  ALLOWED_LANGS.forEach(lang => {
    out[lang] = unique([...(base[lang] || []), ...(extra[lang] || [])]);
  });
  return out;
}

function packagedById() {
  const map = new Map();
  PACKAGED.forEach(row => map.set(row.placeId, row));
  return map;
}

function findPackagedByAlias(token) {
  const n = normalizePlaceNeedle(token);
  if (!n) return null;
  for (const row of PACKAGED) {
    for (const lang of ALLOWED_LANGS) {
      if ((row.aliasesByLang[lang] || []).some(alias => normalizePlaceNeedle(alias) === n)) return row;
    }
    if ((row.canonicalTokens || []).some(alias => normalizePlaceNeedle(alias) === n)) return row;
  }
  return null;
}

function autocompleteAliases(sourceToken, sourceLang) {
  const lang = allowedLang(sourceLang);
  const token = String(sourceToken || "").trim();
  if (!lang) return {ok: false, error: "language_required"};
  if (!token) return {ok: false, error: "token_required"};
  if (isProtectedBrand(token)) return {ok: false, error: "protected_brand"};
  const packaged = findPackagedByAlias(token);
  const aliases = emptyAliases();
  aliases[lang] = unique([token]);
  if (packaged) {
    ALLOWED_LANGS.forEach(code => {
      aliases[code] = unique([...(packaged.aliasesByLang[code] || []), ...(code === lang ? [token] : [])]);
    });
    return {
      ok: true,
      placeId: packaged.placeId,
      canonicalTokens: packaged.canonicalTokens.slice(),
      consumed: (packaged.consumed || []).slice(),
      aliasesByLang: aliases,
      packaged: true
    };
  }
  ALLOWED_LANGS.forEach(code => {
    if (code !== lang) aliases[code] = unique([token]);
  });
  return {
    ok: true,
    placeId: slugFromToken(token),
    canonicalTokens: [normalizePlaceNeedle(token) || token],
    consumed: unique(normalizePlaceNeedle(token).split(/\s+/)),
    aliasesByLang: aliases,
    packaged: false
  };
}

function flattenAliases(aliasesByLang) {
  const out = [];
  ALLOWED_LANGS.forEach(lang => {
    (aliasesByLang[lang] || []).forEach(alias => out.push(alias));
  });
  return unique(out);
}

function catalogRowFromPackaged(row, overlay) {
  const aliases = mergeAliasMap(row.aliasesByLang, overlay && overlay.aliasesByLang || {});
  const enabled = overlay && overlay.enabled === 0 ? 0 : 1;
  return {
    placeId: row.placeId,
    canonicalTokens: unique([...(row.canonicalTokens || []), ...(overlay && overlay.canonicalTokens || [])]),
    consumed: unique([...(row.consumed || []), ...(overlay && overlay.consumed || [])]),
    aliasesByLang: aliases,
    matchAliases: flattenAliases(aliases),
    enabled,
    source: overlay ? "firestore" : "packaged",
    revision: Number(overlay && overlay.revision || 0)
  };
}

function catalogRowFromCustom(overlay) {
  const aliases = mergeAliasMap(emptyAliases(), overlay.aliasesByLang || {});
  return {
    placeId: overlay.placeId,
    canonicalTokens: unique(overlay.canonicalTokens || [overlay.placeId]),
    consumed: unique(overlay.consumed || []),
    aliasesByLang: aliases,
    matchAliases: flattenAliases(aliases),
    enabled: overlay.enabled === 0 ? 0 : 1,
    source: "firestore",
    revision: Number(overlay.revision || 0)
  };
}

function mergeCatalog(firestoreRows) {
  const packaged = packagedById();
  const seen = new Set();
  const out = [];
  (firestoreRows || []).forEach(doc => {
    const id = String(doc.placeId || "").trim();
    if (!id) return;
    seen.add(id);
    if (packaged.has(id)) out.push(catalogRowFromPackaged(packaged.get(id), doc));
    else out.push(catalogRowFromCustom(doc));
  });
  packaged.forEach((row, id) => {
    if (seen.has(id)) return;
    out.push(catalogRowFromPackaged(row, null));
  });
  return out;
}

function matchPlacesWithCatalog(needle, catalog) {
  const hay = normalizePlaceNeedle(needle);
  const tokens = [];
  const consumed = [];
  (catalog || []).forEach(row => {
    if (row.enabled === 0) return;
    const hit = (row.matchAliases || []).some(alias => placePhraseHit(hay, alias));
    if (!hit) return;
    tokens.push(...(row.canonicalTokens || []));
    consumed.push(...(row.consumed || []), ...(row.matchAliases || []).map(alias => normalizePlaceNeedle(alias)));
  });
  return {tokens: unique(tokens), consumed: unique(consumed.map(item => item.replace(/\s+/g, " ")))};
}

function publicTokenRow(row) {
  return {
    placeId: row.placeId,
    canonicalTokens: row.canonicalTokens,
    aliasesByLang: row.aliasesByLang,
    enabled: row.enabled,
    source: row.source,
    revision: row.revision || 0
  };
}

function sanitizeWrite(data) {
  const sourceLang = allowedLang(data.sourceLang);
  const sourceToken = String(data.sourceToken || "").trim().slice(0, 80);
  if (!sourceLang) return {ok: false, error: "language_required"};
  if (!sourceToken) return {ok: false, error: "token_required"};
  if (isProtectedBrand(sourceToken)) return {ok: false, error: "protected_brand"};
  const auto = autocompleteAliases(sourceToken, sourceLang);
  if (!auto.ok) return auto;
  const overrides = data.aliasesByLang && typeof data.aliasesByLang === "object" ? data.aliasesByLang : {};
  const aliases = mergeAliasMap(auto.aliasesByLang, overrides);
  const placeId = String(data.placeId || auto.placeId).trim().slice(0, 64) || auto.placeId;
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(placeId)) return {ok: false, error: "place_id_invalid"};
  const enabled = data.enabled === 0 ? 0 : 1;
  return {
    ok: true,
    row: {
      placeId,
      canonicalTokens: unique(auto.canonicalTokens),
      consumed: unique(auto.consumed),
      aliasesByLang: aliases,
      sourceLang,
      sourceToken,
      enabled
    }
  };
}

module.exports = {
  ALLOWED_LANGS,
  PACKAGED,
  allowedLang,
  normalizePlaceNeedle,
  placePhraseHit,
  isProtectedBrand,
  autocompleteAliases,
  mergeCatalog,
  matchPlacesWithCatalog,
  publicTokenRow,
  sanitizeWrite,
  findPackagedByAlias
};
