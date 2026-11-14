/* FLOQR profile locale: height unit-first + structured taxi pickup (ZIP vs postal). */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FLOQRProfileLocale = api;
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";

  const US_NAMES = new Set([
    "us", "usa", "u.s", "u.s.", "u.s.a", "u.s.a.", "u s", "u s a",
    "united states", "united states of america", "the united states", "the usa", "america"
  ]);
  const CA_NAMES = new Set(["ca", "can", "canada"]);
  const ZIP_RE = /^\d{5}(?:-\d{4})?$/;
  const CA_POSTAL_RE = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
  const OTHER_POSTAL_RE = /^[A-Z0-9][A-Z0-9 \-]{1,11}$/i;
  const STREET_NO_RE = /^[0-9]{1,8}[A-Za-z]?(-[0-9]{1,6}[A-Za-z]?)?$/;

  function t(key, fallback) {
    try {
      const i18n = root?.FLOQRI18n;
      if (i18n?.t) {
        const value = i18n.t(key);
        if (value && value !== key) return value;
      }
    } catch (_) { /* i18n not loaded */ }
    return fallback;
  }

  function byId(id) {
    return root?.document?.getElementById?.(id) || null;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function keyCountry(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function countryCodeOf(value) {
    const raw = text(value).toUpperCase();
    if (/^[A-Z]{2}$/.test(raw)) return raw;
    const name = keyCountry(value);
    const compact = name.replace(/[^a-z]/g, "");
    if (US_NAMES.has(name) || compact === "us" || compact === "usa" || compact === "unitedstates" || compact === "unitedstatesofamerica") return "US";
    if (CA_NAMES.has(name)) return "CA";
    return "";
  }

  function isUnitedStates(value) {
    return countryCodeOf(value) === "US";
  }

  function isCanada(value) {
    return countryCodeOf(value) === "CA";
  }

  function usesFeetInches(input = {}) {
    const profileRaw = text(input.country || input.profileCountry);
    const profile = countryCodeOf(profileRaw);
    if (profile) return profile === "US";
    if (profileRaw) return false;
    const ip = countryCodeOf(input.ipCountry || input.ipCountryCode);
    return ip === "US";
  }

  function usesZip(input = {}) {
    const profileRaw = text(input.country || input.profileCountry);
    const profile = countryCodeOf(profileRaw);
    if (profile) return profile === "US";
    if (profileRaw) return false;
    const ip = countryCodeOf(input.ipCountry || input.ipCountryCode);
    return ip === "US";
  }

  function preferredHeightUnit(input) {
    if (typeof input === "string") return usesFeetInches({country: input}) ? "ft" : "m";
    return usesFeetInches(input || {}) ? "ft" : "m";
  }

  function normalizeHeightUnit(unit) {
    const value = text(unit).toLowerCase();
    if (value === "ft" || value === "ftin" || value === "in" || value === "imperial") return "ft";
    if (value === "m" || value === "cm" || value === "metric") return "m";
    return "";
  }

  function looksLikeFeet(raw) {
    const value = text(raw);
    if (!value) return false;
    if (/['′’]|ft\b|in\b|["″]/.test(value.toLowerCase())) return true;
    if (/^\d{1,2}\s+[0-9]{1,2}$/.test(value)) return true;
    return false;
  }

  function looksLikeMeters(raw) {
    const value = text(raw).replace(",", ".");
    if (!value || looksLikeFeet(value)) return false;
    if (/^\d(?:\.\d{1,2})?\s*m$/i.test(value)) return true;
    const num = Number(value);
    return /^\d\.\d{1,2}$/.test(value) && num >= 1 && num < 3.2;
  }

  function parseFeetInches(raw) {
    const value = text(raw).replace(/[″"]/g, "").replace(/′/g, "'");
    let match = value.match(/^(\d{1,2})\s*'\s*(\d{1,2})$/);
    if (!match) match = value.match(/^(\d{1,2})\s*(?:ft|feet)\s*(\d{1,2})\s*(?:in|inch|inches)?$/i);
    if (!match) match = value.match(/^(\d{1,2})\s+(\d{1,2})$/);
    if (!match && /^\d{1,2}$/.test(value)) match = [null, value, "0"];
    if (!match) return null;
    const feet = Number(match[1]);
    const inches = Number(match[2]);
    if (!Number.isInteger(feet) || !Number.isInteger(inches)) return null;
    if (feet < 3 || feet > 8 || inches < 0 || inches > 11) return null;
    return {feet, inches, cm: Math.round((feet * 12 + inches) * 2.54)};
  }

  function parseMeters(raw) {
    const value = text(raw).toLowerCase().replace(",", ".").replace(/\s*m$/, "");
    if (!/^\d(?:\.\d{1,2})?$/.test(value)) return null;
    const meters = Number(value);
    if (!Number.isFinite(meters) || meters < 1.2 || meters > 2.51) return null;
    return {meters, cm: Math.round(meters * 100)};
  }

  function formatFeet(parsed) {
    if (!parsed) return "";
    return `${parsed.feet}'${parsed.inches}"`;
  }

  function formatMeters(parsed) {
    if (!parsed) return "";
    return (Math.round(parsed.meters * 100) / 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, parsed.meters % 1 ? "" : ".0");
  }

  function metersFromCm(cm) {
    return {meters: cm / 100, cm};
  }

  function feetFromCm(cm) {
    const total = Math.round(cm / 2.54);
    let feet = Math.floor(total / 12);
    let inches = total % 12;
    if (inches === 12) { feet += 1; inches = 0; }
    return {feet, inches, cm};
  }

  function validateHeight(raw, unit) {
    const normalizedUnit = normalizeHeightUnit(unit);
    const value = text(raw);
    if (!normalizedUnit) {
      return {ok: false, error: t("portal.height.pickUnit", "Choose ft or m first, then enter your height."), unit: ""};
    }
    if (!value) return {ok: true, empty: true, unit: normalizedUnit, normalized: "", display: ""};
    if (normalizedUnit === "ft") {
      if (looksLikeMeters(value) && !looksLikeFeet(value)) {
        return {ok: false, error: t("portal.height.errorFt", "Enter height in feet and inches (for example 6'0\"). Metric values like 1.78 belong with m."), unit: "ft"};
      }
      const parsed = parseFeetInches(value);
      if (!parsed) {
        return {ok: false, error: t("portal.height.errorFt", "Enter height in feet and inches (for example 6'0\"). Metric values like 1.78 belong with m."), unit: "ft"};
      }
      const normalized = formatFeet(parsed);
      return {ok: true, unit: "ft", normalized, display: normalized, cm: parsed.cm};
    }
    if (looksLikeFeet(value)) {
      return {ok: false, error: t("portal.height.errorM", "Enter height in meters (for example 1.78). Feet and inches like 6'0\" belong with ft."), unit: "m"};
    }
    const parsed = parseMeters(value);
    if (!parsed) {
      return {ok: false, error: t("portal.height.errorM", "Enter height in meters (for example 1.78). Feet and inches like 6'0\" belong with ft."), unit: "m"};
    }
    const normalized = parsed.meters.toFixed(2);
    return {ok: true, unit: "m", normalized, display: `${normalized} m`, cm: parsed.cm};
  }

  function convertHeight(raw, fromUnit, toUnit) {
    const from = validateHeight(raw, fromUnit);
    const dest = normalizeHeightUnit(toUnit);
    if (!from.ok || from.empty || !from.cm || !dest || dest === from.unit) return null;
    if (dest === "m") {
      const parsed = metersFromCm(from.cm);
      return {unit: "m", normalized: parsed.meters.toFixed(2), display: `${parsed.meters.toFixed(2)} m`};
    }
    const parsed = feetFromCm(from.cm);
    const normalized = formatFeet(parsed);
    return {unit: "ft", normalized, display: normalized};
  }

  function heightDisplay(profile = {}) {
    const value = text(profile.height);
    if (!value) return "";
    const checked = validateHeight(value, profile.heightUnit || preferredHeightUnit(profile));
    if (checked.ok && checked.display) return checked.display;
    const unit = normalizeHeightUnit(profile.heightUnit);
    if (unit === "m" && !/\bm\b/i.test(value)) return `${value} m`;
    return value;
  }

  function validatePostal(raw, zipMode) {
    const value = text(raw).toUpperCase();
    if (!value) {
      return {
        ok: false,
        error: zipMode
          ? t("portal.pickup.zipInvalid", "Enter a valid U.S. ZIP code (12345 or 12345-6789).")
          : t("portal.pickup.postalInvalid", "Enter a valid postal code.")
      };
    }
    if (zipMode) {
      if (!ZIP_RE.test(value)) {
        return {ok: false, error: t("portal.pickup.zipInvalid", "Enter a valid U.S. ZIP code (12345 or 12345-6789).")};
      }
      return {ok: true, normalized: value, kind: "zip"};
    }
    const compact = value.replace(/\s+/g, " ");
    if (CA_POSTAL_RE.test(compact)) {
      const letters = compact.replace(/\s+/g, "");
      return {ok: true, normalized: `${letters.slice(0, 3)} ${letters.slice(3)}`, kind: "postal"};
    }
    if (!OTHER_POSTAL_RE.test(compact) || compact.length < 3) {
      return {ok: false, error: t("portal.pickup.postalInvalid", "Enter a valid postal code.")};
    }
    return {ok: true, normalized: compact, kind: "postal"};
  }

  function validateStreetNumber(raw) {
    const value = text(raw);
    if (!value || !STREET_NO_RE.test(value)) {
      return {ok: false, error: t("portal.pickup.addressIncomplete", "Enter street number, street name, city, and ZIP or postal code.")};
    }
    return {ok: true, normalized: value};
  }

  function validatePickupParts(parts = {}, locale = {}) {
    const zipMode = usesZip(locale);
    const streetNumber = validateStreetNumber(parts.streetNumber);
    const streetName = text(parts.streetName);
    const city = text(parts.city);
    const postal = validatePostal(parts.postalCode, zipMode);
    const missing = !streetNumber.ok || !streetName || !city || !postal.ok;
    if (missing) {
      return {
        ok: false,
        usesZip: zipMode,
        error: !postal.ok && text(parts.postalCode)
          ? postal.error
          : t("portal.pickup.addressIncomplete", "Enter street number, street name, city, and ZIP or postal code.")
      };
    }
    const composed = composePickupAddress({
      streetNumber: streetNumber.normalized,
      streetName,
      city,
      postalCode: postal.normalized
    });
    return {
      ok: true,
      usesZip: zipMode,
      parts: {
        streetNumber: streetNumber.normalized,
        streetName,
        city,
        postalCode: postal.normalized,
        postalKind: postal.kind
      },
      composed
    };
  }

  function composePickupAddress(parts = {}) {
    const line = [text(parts.streetNumber), text(parts.streetName)].filter(Boolean).join(" ");
    return [line, text(parts.city), text(parts.postalCode)].filter(Boolean).join(", ");
  }

  function splitPickupAddress(raw) {
    const value = text(raw);
    if (!value) return {streetNumber: "", streetName: "", city: "", postalCode: ""};
    const chunks = value.split(",").map(part => part.trim()).filter(Boolean);
    const first = chunks.shift() || "";
    const numberMatch = first.match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\s+(.*)$/);
    const streetNumber = numberMatch ? numberMatch[1] : "";
    const streetName = numberMatch ? numberMatch[2] : first;
    let postalCode = "";
    let city = chunks.join(", ");
    if (chunks.length) {
      const last = chunks[chunks.length - 1];
      const zipMatch = last.match(/(\d{5}(?:-\d{4})?)\s*$/);
      const postalMatch = last.match(/([A-Z]\d[A-Z][ -]?\d[A-Z]\d)\s*$/i);
      const generic = last.match(/\b([A-Z0-9][A-Z0-9 \-]{2,11})\s*$/i);
      if (zipMatch) {
        postalCode = zipMatch[1];
        city = [chunks.slice(0, -1).join(", "), last.slice(0, zipMatch.index).replace(/[,\s]+$/, "")].filter(Boolean).join(", ");
      } else if (postalMatch) {
        postalCode = postalMatch[1].toUpperCase();
        city = [chunks.slice(0, -1).join(", "), last.slice(0, postalMatch.index).replace(/[,\s]+$/, "")].filter(Boolean).join(", ");
      } else if (chunks.length > 1 && generic && !/^[A-Za-z][A-Za-z\s]+$/.test(last)) {
        postalCode = generic[1].trim();
        city = chunks.slice(0, -1).join(", ");
      }
    }
    return {streetNumber, streetName, city, postalCode};
  }

  function pickupFromProfile(profile = {}) {
    const structured = {
      streetNumber: text(profile.taxiStreetNumber),
      streetName: text(profile.taxiStreetName),
      city: text(profile.taxiCity || profile.city),
      postalCode: text(profile.taxiPostalCode)
    };
    if (structured.streetNumber || structured.streetName) return structured;
    return splitPickupAddress(profile.taxiPickupAddress || profile.pickupAddress || "");
  }

  function ipHintFromGeo(geo) {
    if (!geo || typeof geo !== "object") return {};
    return {
      ipCountry: geo.country || "",
      ipCountryCode: geo.countryCode || geo.country_code || ""
    };
  }

  async function resolveIpCountry(opts = {}) {
    const Geo = opts.geo || root?.FLOQRGeoSearch;
    if (typeof Geo?.ipLocation === "function") {
      try {
        const geo = await Geo.ipLocation({
          fetch: opts.fetch,
          storage: opts.storage,
          ipWaitMs: opts.ipWaitMs,
          ipProviderUrl: opts.ipProviderUrl
        });
        return ipHintFromGeo(geo);
      } catch (_) { /* ignore */ }
    }
    if (typeof Geo?.resolveUserLocation === "function") {
      try {
        const geo = await Geo.resolveUserLocation({
          geolocation: null,
          fetch: opts.fetch,
          storage: opts.storage,
          ipWaitMs: opts.ipWaitMs,
          ipProviderUrl: opts.ipProviderUrl
        });
        if (geo?.source === "ip") return ipHintFromGeo(geo);
      } catch (_) { /* ignore */ }
    }
    return {};
  }

    function copyCityIfEmpty(cityEl, sourceEl) {
    if (!cityEl || !sourceEl) return;
    if (text(cityEl.value)) return;
    const next = text(sourceEl.value);
    if (next) cityEl.value = next;
  }

  function setHint(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
    el.classList.toggle("is-error", !!isError && !!message);
  }

  function applyPostalLabel(labelEl, inputEl, zipMode) {
    const copy = zipMode
      ? t("portal.field.zip", "ZIP")
      : t("portal.field.postalCode", "Postal code");
    if (labelEl) {
      labelEl.textContent = copy;
      labelEl.setAttribute("data-i18n", zipMode ? "portal.field.zip" : "portal.field.postalCode");
    }
    if (inputEl) {
      inputEl.placeholder = zipMode ? "20005" : "K1A 0B1";
      inputEl.autocomplete = zipMode ? "postal-code" : "postal-code";
      inputEl.inputMode = zipMode ? "numeric" : "text";
      inputEl.maxLength = zipMode ? 10 : 12;
      inputEl.setAttribute("aria-label", copy);
    }
  }

  function bindHeightFields(opts = {}) {
    const unitEl = typeof opts.unit === "string" ? byId(opts.unit) : opts.unit;
    const heightEl = typeof opts.height === "string" ? byId(opts.height) : opts.height;
    const hintEl = typeof opts.hint === "string" ? byId(opts.hint) : opts.hint;
    if (!unitEl || !heightEl) return {validate: () => ({ok: true, empty: true})};

    function locale() {
      return typeof opts.locale === "function" ? (opts.locale() || {}) : (opts.locale || {});
    }

    function syncPlaceholder() {
      const unit = normalizeHeightUnit(unitEl.value);
      heightEl.disabled = !unit;
      heightEl.placeholder = unit === "ft"
        ? t("portal.height.placeholderFt", "6'0\"")
        : t("portal.height.placeholderM", "1.78");
      if (!unit) setHint(hintEl, t("portal.height.pickUnit", "Choose ft or m first, then enter your height."), false);
    }

    function showLive() {
      const unit = normalizeHeightUnit(unitEl.value);
      if (!unit) {
        syncPlaceholder();
        return {ok: false, error: t("portal.height.pickUnit", "Choose ft or m first, then enter your height.")};
      }
      const result = validateHeight(heightEl.value, unit);
      if (result.empty) {
        setHint(hintEl, "", false);
        return result;
      }
      setHint(hintEl, result.ok ? "" : result.error, !result.ok);
      return result;
    }

    if (!unitEl.dataset.userSelected) {
      unitEl.value = preferredHeightUnit(locale());
    }
    syncPlaceholder();

    unitEl.addEventListener("change", () => {
      const nextUnit = normalizeHeightUnit(unitEl.value);
      const prevUnit = normalizeHeightUnit(unitEl.dataset.prevUnit || "");
      unitEl.dataset.userSelected = "true";
      if (prevUnit && nextUnit && prevUnit !== nextUnit && text(heightEl.value)) {
        const converted = convertHeight(heightEl.value, prevUnit, nextUnit);
        if (converted) heightEl.value = converted.normalized;
        else if (!validateHeight(heightEl.value, nextUnit).ok) heightEl.value = "";
      }
      unitEl.dataset.prevUnit = nextUnit;
      syncPlaceholder();
      showLive();
    });
    unitEl.dataset.prevUnit = normalizeHeightUnit(unitEl.value);
    heightEl.addEventListener("input", showLive);
    heightEl.addEventListener("blur", () => {
      const result = showLive();
      if (result.ok && result.normalized) heightEl.value = result.normalized;
    });

    return {
      validate(required) {
        const result = showLive();
        if (required && (result.empty || !normalizeHeightUnit(unitEl.value))) {
          const error = t("portal.height.pickUnit", "Choose ft or m first, then enter your height.");
          setHint(hintEl, error, true);
          return {ok: false, error};
        }
        return result;
      },
      syncPlaceholder,
      setLocale(next, opts = {}) {
        const loc = next || locale();
        const countryRaw = text(loc.country || loc.profileCountry);
        // Country typing always drives the default (US → ft, else m).
        // Skip only a late IP lookup after the patron already picked a unit with no country yet.
        if (!opts.fromCountry && unitEl.dataset.userSelected && !countryRaw) {
          syncPlaceholder();
          return;
        }
        const nextUnit = preferredHeightUnit(loc);
        const prevUnit = normalizeHeightUnit(unitEl.value);
        if (prevUnit && nextUnit && prevUnit !== nextUnit && text(heightEl.value)) {
          const converted = convertHeight(heightEl.value, prevUnit, nextUnit);
          if (converted) heightEl.value = converted.normalized;
          else if (!validateHeight(heightEl.value, nextUnit).ok) heightEl.value = "";
        }
        unitEl.value = nextUnit;
        unitEl.dataset.prevUnit = nextUnit;
        syncPlaceholder();
      },
      fill(data = {}) {
        const storedUnit = normalizeHeightUnit(data.unit);
        const nextUnit = storedUnit || preferredHeightUnit(data.locale || locale());
        if (storedUnit) unitEl.dataset.userSelected = "true";
        unitEl.value = nextUnit;
        unitEl.dataset.prevUnit = nextUnit;
        if (data.value != null) heightEl.value = text(data.value);
        syncPlaceholder();
        showLive();
      }
    };
  }

  function bindPickupFields(opts = {}) {
    const ids = opts.ids || {};
    const numberEl = byId(ids.streetNumber);
    const nameEl = byId(ids.streetName);
    const cityEl = byId(ids.city);
    const postalEl = byId(ids.postal);
    const composedEl = ids.composed ? byId(ids.composed) : null;
    const labelEl = ids.postalLabel ? byId(ids.postalLabel) : (postalEl?.previousElementSibling || null);
    const hintEl = ids.hint ? byId(ids.hint) : null;
    if (!numberEl || !nameEl || !cityEl || !postalEl) {
      return {validate: () => ({ok: false, error: "missing fields"}), read: () => ({}), fill() {}};
    }

    function locale() {
      return typeof opts.locale === "function" ? (opts.locale() || {}) : (opts.locale || {});
    }

    function paintPostal() {
      applyPostalLabel(labelEl, postalEl, usesZip(locale()));
    }

    function read() {
      return {
        streetNumber: numberEl.value,
        streetName: nameEl.value,
        city: cityEl.value,
        postalCode: postalEl.value
      };
    }

    function fill(parts = {}) {
      const next = {
        streetNumber: text(parts.streetNumber),
        streetName: text(parts.streetName),
        city: text(parts.city),
        postalCode: text(parts.postalCode)
      };
      if (!next.streetNumber && !next.streetName && parts.address) {
        Object.assign(next, splitPickupAddress(parts.address));
      }
      numberEl.value = next.streetNumber;
      nameEl.value = next.streetName;
      cityEl.value = next.city;
      postalEl.value = next.postalCode;
      if (composedEl) composedEl.value = composePickupAddress(next);
    }

    function validate(required) {
      paintPostal();
      const result = validatePickupParts(read(), locale());
      if (!required && !text(numberEl.value) && !text(nameEl.value) && !text(postalEl.value) && !text(cityEl.value)) {
        setHint(hintEl, "", false);
        if (composedEl) composedEl.value = "";
        return {ok: true, empty: true, composed: "", parts: read()};
      }
      setHint(hintEl, result.ok ? "" : result.error, !result.ok);
      if (composedEl) composedEl.value = result.ok ? result.composed : composePickupAddress(read());
      return result;
    }

    [numberEl, nameEl, cityEl, postalEl].forEach(el => {
      el.addEventListener("input", () => validate(false));
      el.addEventListener("blur", () => validate(false));
    });
    const citySource = typeof ids.citySource === "string" ? byId(ids.citySource) : ids.citySource;
    if (citySource) {
      citySource.addEventListener("input", () => {
        copyCityIfEmpty(cityEl, citySource);
        validate(false);
      });
      copyCityIfEmpty(cityEl, citySource);
    }
    paintPostal();

    return {validate, read, fill, paintPostal};
  }

  return {
    isUnitedStates,
    isCanada,
    usesFeetInches,
    usesZip,
    preferredHeightUnit,
    normalizeHeightUnit,
    validateHeight,
    convertHeight,
    heightDisplay,
    validatePickupParts,
    composePickupAddress,
    splitPickupAddress,
    pickupFromProfile,
    resolveIpCountry,
    bindHeightFields,
    bindPickupFields,
    applyPostalLabel
  };
});
