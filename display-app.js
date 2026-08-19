/* display-app.js v29.09.119 — Xibo stays display.html?location= / display2.html?location=
 * Screen size comes from clubLocations VenueSupports* + templates Is* + the composed ShoutOut.
 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const qsJson = (name, fallback = []) => {
    try { return JSON.parse(new URL(window.location.href).searchParams.get(name) || ""); }
    catch (error) { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function resolveDisplayBoard() {
    const q = String(qs("board", qs("display", "")) || "").toLowerCase();
    if (q === "secondary" || q === "2" || q === "display2" || q === "displays") return "secondary";
    if (q === "primary" || q === "1") return "primary";
    try {
      const file = String(location.pathname.split("/").pop() || "").toLowerCase();
      if (file === "display2.html" || file === "displays.html") return "secondary";
    } catch (_) {}
    const meta = document.querySelector('meta[name="floqr-display-board"]');
    if (meta && String(meta.content || "").toLowerCase() === "secondary") return "secondary";
    const canvas = byId("displayCanvas");
    if (canvas && String(canvas.getAttribute("data-display-board") || "").toLowerCase() === "secondary") return "secondary";
    return "primary";
  }

  const DISPLAY_BOARD = resolveDisplayBoard();
  window.FLOQR_DISPLAY_BOARD = DISPLAY_BOARD;

  function liveContentDocId(locId) {
    const id = String(locId || "").trim();
    return DISPLAY_BOARD === "secondary" ? `${id}__secondary` : id;
  }
  window.FLOQR_LIVE_CONTENT_DOC_ID = liveContentDocId;

  if (!window.firebaseConfig) { byId("displayMain").textContent = "CONFIG ERROR"; byId("displaySub").textContent = "firebase-config.js missing"; return; }
  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.firestore();
  const persistenceReady = db.enablePersistence ? db.enablePersistence({synchronizeTabs:true}).catch(() => null) : Promise.resolve();
  const FOOTBALL_MEDIA_CACHE = "floqr-football-media-v29-08-2";
  let footballObjectUrls = [];
  const explicitLocationRequested = !!(qs("location") || qs("club"));
  const requestedLocationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  let locationId = canonicalStaticLocationId(requestedLocationId);
  let loc = getStaticLocation(locationId);
  let templates = Object.assign({}, window.SHOUTOUT_TEMPLATES || {});
  const DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 * 60;
  const HEIST_MESSAGE_SECONDS = 20;
  const HEIST_BRAND_SLIDE_SECONDS = 8;
  const HEIST_LOCAL_LOGO = "./images/heist/heist-dc-logo.png";
  const SUPRSTAR_LOGO = "./images/suprstr-logo.png";
  let liveContentExpiryTimer = null;
  let screenFormatOverride = "";
  let heistPhaseTimer = null;
  let heistPhaseLoopTimer = null;
  let splitMediaLoopTimer = null;
  const SPLIT_MEDIA_LOOP_MS = 4000;

  function canonicalStaticLocationId(id = "") {
    const key = String(id || "zebbies-garden-washington-dc").toLowerCase();
    const row = (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || {};
    return String(row.canonicalLocationId || row.aliasOf || row.mergedInto || key).toLowerCase();
  }

  function getStaticLocation(id = "") {
    const key = canonicalStaticLocationId(id);
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || (window.SHOUTOUT_CLUB_LOCATIONS || {})[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  }

  async function hydrateTemplatesFromFirestore() {
    try {
      const snap = await db.collection("templates").get();
      snap.forEach(doc => {
        const packaged = window.SHOUTOUT_TEMPLATES?.[doc.id] || {};
        const merged = {...packaged, id: doc.id, ...doc.data()};
        templates[doc.id] = window.FLOQRScreenDatapoints?.applyTemplate?.(merged) || merged;
      });
    } catch (e) {}
  }

  function normalizeScreenFormatId(raw = "") {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) return "";
    if (value === "64x32" || value === "64×32" || value === "led-64x32" || value === "p125-64x32") return value.startsWith("p125") ? "p125-64x32" : "led-64x32";
    if (value === "64x48" || value === "led-64x48") return "led-64x48";
    if (value === "96x48" || value === "led-96x48") return "led-96x48";
    if ((window.FLOQR_DISPLAY_FORMATS || {})[value]) return value;
    return "";
  }

  function clubSupportedFormatIds(location = loc) {
    if (window.FLOQRScreenDatapoints?.applyVenue) {
      window.FLOQRScreenDatapoints.applyVenue(location);
      return window.FLOQRScreenDatapoints.venueLedIds(location);
    }
    const ids = Array.isArray(location?.displayScreenFormatIds) ? location.displayScreenFormatIds : [];
    const normalized = ids.map(normalizeScreenFormatId).filter(Boolean);
    return Array.from(new Set(normalized));
  }

  function boardAssignedFormatId(location = loc) {
    const supported = clubSupportedFormatIds(location);
    const assignedRaw = DISPLAY_BOARD === "secondary"
      ? (location?.secondaryDisplayScreenFormatId || location?.primaryDisplayScreenFormatId || location?.displayType || location?.screenFormatId)
      : (location?.primaryDisplayScreenFormatId || location?.displayType || location?.screenFormatId);
    const assigned = normalizeScreenFormatId(assignedRaw);
    if (assigned && (!supported.length || supported.includes(assigned))) return assigned;
    return supported[0] || "led-96x48";
  }

  function templateSupportsFormat(template = {}, formatId = "") {
    if (!formatId) return false;
    if (window.FLOQRScreenDatapoints) {
      const family = window.FLOQRScreenDatapoints.familyOf(formatId);
      if (family && window.FLOQRScreenDatapoints.as01(template[`Is${family}`]) === 0) return false;
    }
    const rule = window.FLOQRTextLayout?.resolve?.(template, formatId);
    if (rule && rule.supported === false) return false;
    const listed = Array.isArray(template.screenFormatIds) ? template.screenFormatIds.map(normalizeScreenFormatId) : [];
    if (listed.length && !listed.includes(formatId)) return false;
    return true;
  }

  function resolvePlaybackScreenFormat(data = {}, template = {}) {
    const previewFormat = isUrlPreviewMode()
      ? normalizeScreenFormatId(data.screenFormatId || urlSearchParams().get("screenFormatId") || urlSearchParams().get("screen"))
      : "";
    if (previewFormat) return previewFormat;
    if (window.FLOQRScreenDatapoints?.resolvePlaybackFormat) {
      return window.FLOQRScreenDatapoints.resolvePlaybackFormat({
        venue: loc,
        template,
        shoutout: data,
        board: DISPLAY_BOARD
      });
    }
    const boardFormat = boardAssignedFormatId();
    const clubFormats = clubSupportedFormatIds();
    const itemFormat = normalizeScreenFormatId(data.screenFormatId);
    if (templateSupportsFormat(template, boardFormat)) return boardFormat;
    if (itemFormat && (!clubFormats.length || clubFormats.includes(itemFormat)) && templateSupportsFormat(template, itemFormat)) {
      return itemFormat;
    }
    return clubFormats.find(id => templateSupportsFormat(template, id)) || boardFormat;
  }

  function displayDeviceDocId(ip = "") {
    return String(ip || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.:_-]/g, "-")
      .replace(/\.+/g, "_")
      .slice(0, 120);
  }

  async function resolveLocationFromIpParam() {
    const ip = String(qs("ip", "") || "").trim();
    if (!ip) return "";
    const docId = displayDeviceDocId(ip);
    try {
      const byIdDoc = await db.collection("displayDevices").doc(docId).get();
      if (byIdDoc.exists) {
        const data = byIdDoc.data() || {};
        const bound = String(data.locationId || data.clubLocationId || data.location || "").trim();
        if (bound) return bound;
      }
    } catch (e) {}
    try {
      const snap = await db.collection("displayDevices").where("ip", "==", ip).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data() || {};
        return String(data.locationId || data.clubLocationId || data.location || "").trim();
      }
    } catch (e) {}
    return "";
  }

  async function resolveDisplayLocationId(id = "") {
    let key = canonicalStaticLocationId(id);
    try {
      const alias = await db.collection("clubLocationAliases").doc(key).get();
      if (alias.exists && alias.data()?.canonicalLocationId) {
        key = String(alias.data().canonicalLocationId).toLowerCase();
      }
    } catch (e) {}
    try {
      const doc = await db.collection("clubLocations").doc(key).get();
      if (doc.exists) {
        const data = doc.data() || {};
        if (data.canonicalLocationId || data.aliasOf || data.mergedInto) {
          key = String(data.canonicalLocationId || data.aliasOf || data.mergedInto).toLowerCase();
        }
      }
    } catch (e) {}
    return canonicalStaticLocationId(key);
  }

  function graphemes(value) {
    const text = String(value ?? "");
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        return [...new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(text)].map(part => part.segment);
      }
    } catch (_) {}
    return Array.from(text);
  }

  function glyphs(value) {
    return graphemes(value);
  }

  function glyphLen(value) {
    return glyphs(value).length;
  }

  function glyphSlice(value, start, end) {
    return glyphs(value).slice(start, end).join("");
  }

  function cleanBoardText(value) {
    return String(value || "")
      .normalize("NFC")
      .toUpperCase()
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanJerseyMark(value) {
    // Preserve emoji + special characters; do not force uppercase.
    return String(value || "")
      .normalize("NFC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim();
  }

  function jerseyTeamLabel(template = {}, data = {}) {
    const team = window.FLOQRResolveSoccerTeam?.(data.jerseyTeamId || "") || null;
    const explicit = cleanBoardText(
      data.jerseyTeamLabel
      || team?.jerseyTeamLabel
      || template.jerseyTeamLabel
      || template.jerseyCountry
      || template.teamName
      || ""
    );
    if (explicit) return glyphSlice(explicit, 0, 22);
    const rawName = String(template.name || template.id || "");
    const stripped = rawName
      .replace(/^(Soccer|NBA|NFL)\s+/i, "")
      .replace(/\s+jersey$/i, "")
      .trim();
    return glyphSlice(cleanBoardText(stripped), 0, 22);
  }

  function resolveJerseyStyle(template = {}, data = {}) {
    const team = window.FLOQRResolveSoccerTeam?.(data.jerseyTeamId || "") || null;
    const legacyTeam = (!team && /^soccer/i.test(String(data.template || template.id || "")) && String(data.template || template.id) !== "soccerJersey")
      ? (window.FLOQRResolveSoccerTeam?.(data.template || template.id) || templates[data.template || template.id] || null)
      : null;
    const source = team || legacyTeam || template;
    return {
      ...template,
      ...source,
      id: template.id === "soccerJersey" ? "soccerJersey" : (template.id || source.id),
      jerseyPrimary: data.jerseyPrimary || source.jerseyPrimary || template.jerseyPrimary,
      jerseySecondary: data.jerseySecondary || source.jerseySecondary || template.jerseySecondary,
      jerseyAccent: data.jerseyAccent || source.jerseyAccent || source.jerseySecondary || template.jerseyAccent,
      jerseyCssBack: (data.backgroundUrl || source.defaultBackgroundUrl || template.defaultBackgroundUrl)
        ? false
        : (data.jerseyCssBack != null ? !!data.jerseyCssBack : (source.jerseyCssBack !== false)),
      defaultBackgroundUrl: data.backgroundUrl || source.defaultBackgroundUrl || template.defaultBackgroundUrl || "",
      jerseyTeamLabel: data.jerseyTeamLabel || source.jerseyTeamLabel || template.jerseyTeamLabel || ""
    };
  }

  function jerseyNameRows(mainText, caps = {}) {
    const maxTotal = Math.max(1, Math.min(14, Number(caps.maxMainCharacters || caps.main || 14)));
    const perLine = Math.max(1, Math.min(maxTotal, Number(caps.maxCharactersPerLine || caps.perLine || 8)));
    const name = glyphSlice(cleanBoardText(mainText), 0, maxTotal);
    if (!name) return [""];
    if (glyphLen(name) <= perLine) return [name];
    const rows = displayTextRows(name, {lineCount: 2, maxCharactersPerLine: perLine, maxMainCharacters: maxTotal});
    if (rows.length >= 2) return rows.slice(0, 2);
    // Hard wrap mid-word when a single token exceeds one line.
    const chars = glyphs(name);
    const mid = Math.ceil(chars.length / 2);
    return [chars.slice(0, mid).join(""), chars.slice(mid).join("")].filter(Boolean);
  }

  function ensureJerseyTeamEl(center) {
    let teamEl = byId("displayJerseyTeam");
    if (teamEl) return teamEl;
    if (!center) return null;
    teamEl = document.createElement("div");
    teamEl.id = "displayJerseyTeam";
    teamEl.className = "soccer-jersey-team hidden";
    teamEl.setAttribute("aria-hidden", "true");
    const main = byId("displayMain");
    if (main) center.insertBefore(teamEl, main);
    else center.appendChild(teamEl);
    return teamEl;
  }

  // Country/club sits on a ~7° collar arch (ends lower, middle follows the neckline).
  function paintJerseyCollarArch(el, label) {
    if (!el) return;
    const chars = glyphs(cleanBoardText(label));
    if (!chars.length) {
      el.textContent = "";
      el.classList.remove("jersey-collar-arch");
      return;
    }
    el.classList.add("jersey-collar-arch");
    const last = Math.max(1, chars.length - 1);
    el.innerHTML = chars.map((ch, i) => {
      const t = chars.length === 1 ? 0 : (i / last) - 0.5;
      const rot = t * 14;
      const lift = (1 - Math.abs(t) * 2) * 0.18;
      const glyph = ch === " " ? "&nbsp;" : esc(ch);
      return `<span class="jersey-arch-ch" style="transform:translateY(${(-lift).toFixed(3)}em) rotate(${rot.toFixed(2)}deg)">${glyph}</span>`;
    }).join("");
  }

  function pushWrapped(rows, words, maxRows, maxChars) {
    let line = "";
    words.forEach(word => {
      if (!word) return;
      if (glyphLen(word) > maxChars) {
        if (line && rows.length < maxRows) rows.push(line);
        line = "";
        const chars = glyphs(word);
        for (let i = 0; i < chars.length && rows.length < maxRows; i += maxChars) rows.push(chars.slice(i, i + maxChars).join(""));
        return;
      }
      const next = line ? `${line} ${word}` : word;
      if (glyphLen(next) <= maxChars) line = next;
      else {
        if (rows.length < maxRows) rows.push(line);
        line = word;
      }
    });
    if (line && rows.length < maxRows) rows.push(line);
  }

  function displayTextRows(mainText, caps = {}) {
    const maxRows = Math.max(1, Number(caps.lineCount || 1));
    const maxChars = Math.max(1, Number(caps.maxCharactersPerLine || caps.perLine || caps.maxMainCharacters || 60));
    const rows = [];

    const prepared = glyphSlice(String(mainText || "")
      .normalize("NFC")
      .toUpperCase()
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " "), 0, maxChars * maxRows + maxRows - 1);
    prepared.split(/\n+/).forEach(sourceLine => {
      if (rows.length >= maxRows) return;
      const words = sourceLine.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
      pushWrapped(rows, words, maxRows, maxChars);
    });

    return (rows.length ? rows : [""]).slice(0, maxRows);
  }

  function classicBoardRows(mainText, caps = {}) {
    return displayTextRows(mainText, {
      lineCount:Number(caps.lineCount || 3),
      maxCharactersPerLine:Number(caps.maxCharactersPerLine || caps.perLine || 15),
      maxMainCharacters:Number(caps.maxMainCharacters || caps.main || 45)
    });
  }

  function classicIdentityPresentation(subText) {
    const supplied = glyphSlice(cleanBoardText(subText), 0, 20);
    const brandFallback = glyphSlice(cleanBoardText(loc.displayFooterBrand || "FLOQR ShoutOut"), 0, 20) || "FLOQR ShoutOut";
    return {
      supplied:!!supplied,
      kicker:supplied ? "FROM" : "PRESENTED BY",
      value:supplied || brandFallback
    };
  }

  function isTextOverlayTemplate(template = {}, templateId = "") {
    if (template.layout === "soccer-jersey" || String(templateId || template.id || "").startsWith("soccer")) return false;
    return template.textOverlay === true || String(templateId || template.id || "").startsWith("heist");
  }

  function isSoccerJerseyTemplate(template = {}, templateId = "") {
    const id = String(templateId || template.id || "");
    return template.layout === "soccer-jersey"
      || id === "soccerJersey"
      || template.requiresTeamSelect === true
      || template.consolidatedTemplateId === "soccerJersey"
      || template.aliasOf === "soccerJersey"
      || id.startsWith("soccer")
      || id.startsWith("nba")
      || id.startsWith("nfl")
      || template.jerseyNumberField === true;
  }

  function jerseySportOf(template = {}, data = {}) {
    const sport = String(template.sport || data.sport || "").toLowerCase();
    if (sport === "nba" || sport === "nfl" || sport === "soccer") return sport;
    const id = String(template.id || data.template || data.jerseyTeamId || "");
    if (id.startsWith("nba")) return "nba";
    if (id.startsWith("nfl")) return "nfl";
    return "soccer";
  }

  function lockerRoomBackground() {
    return "#000";
  }

  function ensureJerseyMount(sport = "soccer", {hangerOnly = false} = {}) {
    let mount = byId("displayJerseyMount");
    if (!mount) {
      const center = document.querySelector(".display-center");
      if (!center) return null;
      mount = document.createElement("div");
      mount.id = "displayJerseyMount";
      mount.setAttribute("aria-hidden", "true");
      const team = byId("displayJerseyTeam");
      if (team) center.insertBefore(mount, team);
      else center.insertBefore(mount, center.firstChild);
    }
    mount.className = `jersey-hanger-mount jersey-sport-${sport}` + (hangerOnly ? " jersey-photo-hanger-only" : "");
    mount.setAttribute("aria-hidden", "false");
    mount.innerHTML = [
      '<div class="jersey-hanger">',
      '<span class="jersey-hanger-hook"></span>',
      '<span class="jersey-hanger-shoulder"></span>',
      "</div>",
      hangerOnly ? "" : [
        `<div class="jersey-garment jersey-garment-${sport}">`,
        '<span class="jersey-collar"></span>',
        '<span class="jersey-sleeve jersey-sleeve-l"></span>',
        '<span class="jersey-sleeve jersey-sleeve-r"></span>',
        '<span class="jersey-yoke"></span>',
        '<span class="jersey-nameplate"></span>',
        '<span class="jersey-torso"></span>',
        '<span class="jersey-side jersey-side-l"></span>',
        '<span class="jersey-side jersey-side-r"></span>',
        "</div>"
      ].join("")
    ].join("");
    return mount;
  }

  function hideJerseyMount() {
    const mount = byId("displayJerseyMount");
    if (!mount) return;
    mount.className = "jersey-hanger-mount hidden";
    mount.setAttribute("aria-hidden", "true");
    mount.innerHTML = "";
  }

  function resetBackgroundLayer(bgEl) {
    if (!bgEl) return;
    bgEl.className = "display-background";
    bgEl.style.backgroundImage = "";
    bgEl.style.background = "";
    bgEl.style.backgroundSize = "";
    bgEl.style.backgroundPosition = "";
    bgEl.style.backgroundRepeat = "";
    delete bgEl.dataset.backgroundFit;
  }

  function resolveBackgroundFit(data = {}, template = {}, backgroundUrl = "") {
    const explicit = String(data.backgroundFit || "").toLowerCase();
    if (explicit === "contain" || explicit === "cover") return explicit;
    const url = String(backgroundUrl || "").trim();
    if (!url) return "cover";
    const designed = String(template.defaultBackgroundUrl || "").trim();
    if (designed && url === designed) return "cover";
    if (template.sport || template.jerseyCssBack || String(template.id || "").startsWith("heist") || /jersey/i.test(String(template.id || ""))) {
      return "cover";
    }
    if (String(data.mediaFit || "").toLowerCase() === "cover") return "cover";
    return "contain";
  }

  function applyBackgroundLayer(bgEl, { backgroundUrl = "", backgroundColor = "", backgroundGradient = "", fit = "cover" } = {}) {
    resetBackgroundLayer(bgEl);
    if (backgroundUrl) {
      const size = fit === "contain" ? "contain" : "cover";
      bgEl.style.backgroundImage = `url("${String(backgroundUrl).replace(/"/g, "%22")}")`;
      bgEl.style.backgroundSize = size;
      bgEl.style.backgroundPosition = "center";
      bgEl.style.backgroundRepeat = "no-repeat";
      bgEl.dataset.backgroundFit = size;
      return true;
    }
    if (backgroundGradient && /^linear-gradient\(/.test(backgroundGradient)) {
      bgEl.style.background = backgroundGradient;
      return true;
    }
    if (backgroundColor && /^#[0-9a-fA-F]{6}$/.test(backgroundColor)) {
      bgEl.style.background = backgroundColor;
      return true;
    }
    return false;
  }

  function resolveFrameOverlayUrl(template = {}, data = {}) {
    return String(data.frameOverlayUrl || template.defaultFrameOverlayUrl || "").trim();
  }

  function applyFrameOverlay(frameEl, frameUrl = "", template = {}) {
    if (!frameEl) return false;
    const url = String(frameUrl || "").trim();
    const useCssHeistFrame = template.frameOverlay === true
      || template.frameOverlayStyle === "css-heist"
      || (!!url && /heist-text-frame-overlay/i.test(url))
      || String(template.id || "").startsWith("heist");
    // Never paint the old checkerboard PNG — Heist frames are CSS-only (true transparent center).
    if (useCssHeistFrame) {
      frameEl.className = "display-frame-overlay display-frame-overlay-css-heist";
      frameEl.style.backgroundImage = "";
      frameEl.style.backgroundSize = "";
      frameEl.style.backgroundPosition = "";
      frameEl.style.backgroundRepeat = "";
      return true;
    }
    if (!url) {
      frameEl.className = "display-frame-overlay hidden";
      frameEl.style.backgroundImage = "";
      return false;
    }
    frameEl.className = "display-frame-overlay";
    frameEl.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
    frameEl.style.backgroundSize = "100% 100%";
    frameEl.style.backgroundPosition = "center";
    frameEl.style.backgroundRepeat = "no-repeat";
    return true;
  }

  function heistIdentityMessages(template = {}) {
    const custom = Array.isArray(template.identityMessages) ? template.identityMessages.filter(Boolean) : [];
    const lines = custom.length ? custom.map(String) : ["Caught in a HEIST", "Powered by FloqR Social OS"];
    // Normalize legacy "$Caught…" / "Caught in HEISTS" copy.
    return lines
      .map(line => String(line || "").replace(/^\$\s*/, "").trim())
      .map(line => /^caught in heists?$/i.test(line) ? "Caught in a HEIST" : line)
      .filter(Boolean);
  }

  function stopHeistIdentityCycle() {
    if (window.__floqrHeistIdentityTimer) {
      window.clearInterval(window.__floqrHeistIdentityTimer);
      window.__floqrHeistIdentityTimer = null;
    }
  }

  function stopHeistPhaseTimers() {
    if (heistPhaseTimer) {
      window.clearTimeout(heistPhaseTimer);
      heistPhaseTimer = null;
    }
    if (heistPhaseLoopTimer) {
      window.clearTimeout(heistPhaseLoopTimer);
      heistPhaseLoopTimer = null;
    }
  }

  function stopSplitMediaLoop() {
    if (splitMediaLoopTimer) {
      window.clearInterval(splitMediaLoopTimer);
      splitMediaLoopTimer = null;
    }
    byId("displayCanvas")?.classList.remove("split-media-loop", "split-media-phase-media", "split-media-phase-copy");
  }

  function splitMediaIdentityPresentation(data = {}, subText = "") {
    const attrib = glyphSlice(cleanBoardText(data.attribution || ""), 0, 20);
    const sub = glyphSlice(cleanBoardText(subText), 0, 20);
    const celebration = /^(CELEBRATE BIG|LOVE ALL NIGHT|FOREVER STARTS TONIGHT|SHE SAID YES)$/i.test(sub);
    const handle = attrib || (!celebration && sub) || "";
    return {
      kicker: "FLOQR",
      value: handle || "ShoutOut",
      extraCopy: handle ? "" : sub
    };
  }

  function renderSplitMediaIdentityRail(identity) {
    const rail = byId("displayIdentityRail");
    if (!rail) return;
    rail.className = "display-identity-rail split-media-identity" + (identity.value === "ShoutOut" ? " uses-brand-fallback" : " has-attribution");
    rail.setAttribute("aria-hidden", "false");
    rail.setAttribute("aria-label", `${identity.kicker} ${identity.value}`);
    rail.innerHTML = `<span class="classic-identity-shell"><small>${esc(identity.kicker)}</small><strong>${esc(identity.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
  }

  function startSplitMediaLoop(canvas) {
    stopSplitMediaLoop();
    if (!canvas) return;
    canvas.classList.add("split-media-loop", "split-media-phase-media");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      canvas.classList.add("split-media-phase-copy");
      canvas.classList.remove("split-media-phase-media");
      return;
    }
    splitMediaLoopTimer = window.setInterval(() => {
      const onMedia = canvas.classList.contains("split-media-phase-media");
      canvas.classList.toggle("split-media-phase-media", !onMedia);
      canvas.classList.toggle("split-media-phase-copy", onMedia);
    }, SPLIT_MEDIA_LOOP_MS);
  }

  function heistBrandLogoUrl() {
    return String(loc.logoUrl || loc.clubLogoUrl || loc.brandLogoUrl || HEIST_LOCAL_LOGO || "").trim() || HEIST_LOCAL_LOGO;
  }

  function hideHeistBrandSlide() {
    const slide = byId("heistBrandSlide");
    const canvas = byId("displayCanvas");
    if (slide) {
      slide.classList.add("hidden");
      slide.setAttribute("aria-hidden", "true");
    }
    canvas?.classList.remove("heist-brand-slide-active");
  }

  function showHeistBrandSlide() {
    const slide = byId("heistBrandSlide");
    const logo = byId("heistBrandLogo");
    const canvas = byId("displayCanvas");
    if (!slide || !canvas) return;
    stopHeistIdentityCycle();
    if (logo) {
      const src = heistBrandLogoUrl();
      logo.src = src;
      logo.onerror = () => {
        if (logo.src.indexOf(HEIST_LOCAL_LOGO) === -1) logo.src = HEIST_LOCAL_LOGO;
      };
    }
    slide.classList.remove("hidden");
    slide.setAttribute("aria-hidden", "false");
    canvas.classList.add("heist-brand-slide-active");
  }

  function scheduleHeistMessageThenBrandSlide(template = {}) {
    stopHeistPhaseTimers();
    hideHeistBrandSlide();
    const messageSeconds = Math.max(5, Number(template.messageDurationSeconds || HEIST_MESSAGE_SECONDS));
    const brandSeconds = Math.max(3, Number(template.brandSlideSeconds || HEIST_BRAND_SLIDE_SECONDS));
    heistPhaseTimer = window.setTimeout(() => {
      showHeistBrandSlide();
      heistPhaseLoopTimer = window.setTimeout(() => {
        hideHeistBrandSlide();
        // Restart the identity rail and message phase for continuous venue playback.
        if (template.identityRail !== false) {
          const subText = String(byId("displaySub")?.getAttribute("data-patron-sub") || "");
          renderHeistIdentityRail(template, subText);
        }
        scheduleHeistMessageThenBrandSlide(template);
      }, brandSeconds * 1000);
    }, messageSeconds * 1000);
  }

  function renderHeistIdentityRail(template = {}, patronSubText = "") {
    stopHeistIdentityCycle();
    const sub = byId("displaySub");
    if (!sub) return;

    // Optional patron attribution (display name / Mingl / Instagram). When present it
    // leads the cycle; when absent the brand lines still run on their own.
    const supplied = glyphSlice(cleanBoardText(patronSubText), 0, 28);
    sub.setAttribute("data-patron-sub", supplied);
    const brandLines = heistIdentityMessages(template);
    const queue = [];
    if (supplied) queue.push({kicker: "FROM", value: supplied, attributed: true});
    brandLines.forEach(value => {
      const line = String(value || "").trim();
      if (line) queue.push({kicker: "", value: line, attributed: false});
    });
    if (!queue.length) return;

    sub.classList.remove("classic-bw-sub-hidden", "text-overlay-identity");
    sub.classList.add("classic-bw-identity", "heist-identity-rail");

    let index = 0;
    const holdSeconds = Math.max(1, Number(template.identityAnimationSeconds) || 3);
    const HOLD_MS = Math.round(holdSeconds * 1000);
    const paint = () => {
      const item = queue[index % queue.length];
      index += 1;
      sub.classList.toggle("has-attribution", !!item.attributed);
      sub.classList.toggle("uses-brand-fallback", !item.attributed);
      sub.setAttribute("aria-label", item.kicker ? `${item.kicker} ${item.value}` : item.value);
      const kickerHtml = item.kicker ? `<small>${esc(item.kicker)}</small>` : "";
      sub.innerHTML = `<span class="classic-identity-shell heist-identity-shell">${kickerHtml}<strong>${esc(item.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
    };
    paint();
    window.__floqrHeistIdentityTimer = window.setInterval(paint, HOLD_MS);
  }

  function urlSearchParams() {
    try { return new URL(window.location.href).searchParams; }
    catch (error) { return new URLSearchParams(); }
  }

  function urlHasParam(name = "") {
    return urlSearchParams().has(String(name || ""));
  }

  function isUrlPreviewMode() {
    const params = urlSearchParams();
    return params.has("template")
      || params.has("main")
      || params.has("backgroundUrl")
      || params.has("backgroundColor")
      || params.has("backgroundGradient")
      || params.get("preview") === "1";
  }

  function isLoopbackHost() {
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  }

  function paintUrlPreviewNow() {
    loc = getStaticLocation(locationId);
    if (!screenFormatOverride) screenFormatOverride = boardAssignedFormatId(loc);
    render(buildUrlPreviewPayload());
  }

  function buildUrlPreviewPayload() {
    const params = urlSearchParams();
    const templateId = String(params.get("template") || "neon").trim();
    const baseTemplate = templates[templateId] || templates.neon || {};
    const isOverlay = isTextOverlayTemplate(baseTemplate, templateId);
    let mainText = "";
    if (params.has("main")) mainText = params.get("main") || "";
    else if (!isOverlay) mainText = clubDefaultMainText(loc);
    return {
      mainText,
      subText: params.get("sub") || "",
      template: templateId,
      mediaUrl: params.get("media") || "",
      mediaType: params.get("mediaType") || "",
      mediaFit: params.get("mediaFit") || "contain",
      backgroundFit: params.has("backgroundFit")
        ? params.get("backgroundFit")
        : (params.get("backgroundUrl") ? (params.get("mediaFit") || "contain") : ""),
      screenFormatId: screenFormatOverride || params.get("screenFormatId") || "",
      selectedMediaVersion: params.get("selectedMediaVersion") || "",
      trimStart: params.get("trimStart") || "",
      trimEnd: params.get("trimEnd") || "",
      trimmedDuration: params.get("trimmedDuration") || "",
      backgroundUrl: params.get("backgroundUrl") || "",
      backgroundColor: params.get("backgroundColor") || "",
      backgroundGradient: params.get("backgroundGradient") || "",
      jerseyTeamId: params.get("jerseyTeamId") || "",
      jerseyTeamLabel: params.get("jerseyTeamLabel") || "",
      jerseyPrimary: params.get("jerseyPrimary") || "",
      jerseySecondary: params.get("jerseySecondary") || "",
      jerseyAccent: params.get("jerseyAccent") || "",
      jerseyCssBack: params.get("jerseyCssBack") === "1" ? true : (params.get("jerseyCssBack") === "0" ? false : undefined),
      teamMembers: qsJson("teamMembers", []),
      stadiumMessage: params.get("stadiumMessage") || "",
      animationDurationSeconds: 20,
      locationName: loc.locationName,
      status: "preview"
    };
  }

  function markDisplayReady() {
    document.body?.classList.remove("display-booting");
    document.body?.classList.add("display-ready");
  }

  function stripLegacyUseShoutOutCta(value = "") {
    // Kept for stale cross-club copy detection only — idle CTA is restored intentionally.
    return String(value || "").trim();
  }

  function clubVenueName(location = {}) {
    return String(location.locationName || location.brandName || location.name || "Club").trim() || "Club";
  }

  function clubDefaultMainText(location = {}) {
    const clubName = clubVenueName(location);
    if (DISPLAY_BOARD === "secondary") {
      // display2 / Xibo SupRStar board idle CTA
      return `Awaiting live Feed. Be a SupRstar @ ${clubName}`;
    }
    const configured = String(location.defaultMain || "").trim();
    if (configured && !/^USE\s*SHOUT\s*OUT\b/i.test(configured)) return configured;
    // Typical club idle board: Use ShoutOut @ Clubname
    return `Use ShoutOut @ ${clubName}`;
  }

  function isLegacyShoutOutIdleText(value = "") {
    return /^USE\s*SHOUT\s*OUT\b/i.test(String(value || "").trim());
  }

  function isSuprstarIdlePayload(data = {}) {
    if (DISPLAY_BOARD !== "secondary") return false;
    if (isUrlPreviewMode() && (urlSearchParams().has("template") || urlSearchParams().has("main"))) return false;
    const status = String(data.status || "").toLowerCase();
    if (status === "approved" || status === "live" || status === "preview") return false;
    if (data.idleCta || status === "default" || !status) return true;
    return isLegacyShoutOutIdleText(data.mainText);
  }

  function defaultClubDisplayPayload() {
    const previewTemplate = String(urlSearchParams().get("template") || "").trim();
    const previewMeta = previewTemplate ? templates[previewTemplate] : null;
    if (previewTemplate && isTextOverlayTemplate(previewMeta || {}, previewTemplate)) {
      return {
        locationName: loc.locationName,
        mainText: urlHasParam("main") ? (urlSearchParams().get("main") || "") : "",
        subText: urlSearchParams().get("sub") || "",
        template: previewTemplate,
        status: "preview"
      };
    }
    if (DISPLAY_BOARD === "secondary") {
      return {
        locationName: loc.locationName,
        mainText: clubDefaultMainText(loc),
        subText: "",
        template: "blackwhite",
        status: "default",
        idleCta: true,
        suprstarIdle: true
      };
    }
    const heistIdleTemplate = (Array.isArray(loc.templates) ? loc.templates : [])
      .map(String)
      .find(id => id.startsWith("heist")) || "";
    const idleTemplate = previewTemplate || heistIdleTemplate || "blackwhite";
    const idleIsJersey = isSoccerJerseyTemplate(templates[idleTemplate] || {}, idleTemplate);
    return {
      locationName: loc.locationName,
      mainText: idleIsJersey ? "" : clubDefaultMainText(loc),
      subText: "",
      template: idleTemplate,
      status: "default",
      idleCta: true
    };
  }

  function renderSuprstarIdleScreen(location = {}) {
    const clubName = clubVenueName(location);
    const canvas = byId("displayCanvas");
    const mediaSlot = byId("mediaSlot");
    const center = document.querySelector(".display-center");
    const rail = byId("displayIdentityRail");
    stopHeistIdentityCycle();
    stopHeistPhaseTimers();
    stopSplitMediaLoop();
    hideHeistBrandSlide();
    hideJerseyMount();
    if (canvas) {
      canvas.className = "display-canvas display-board-secondary suprstar-idle-canvas";
      canvas.classList.remove("has-background-layer", "custom-background-active", "frame-overlay-template", "soccer-jersey-template", "sports-jersey-template", "heist-brand-slide-active");
      canvas.style.backgroundImage = "";
      canvas.style.background = "";
    }
    const bgEl = byId("displayBackground");
    if (bgEl) {
      bgEl.style.backgroundImage = "";
      bgEl.style.background = "";
      bgEl.style.backgroundColor = "";
    }
    const frame = byId("displayFrameOverlay");
    if (frame) {
      frame.className = "display-frame-overlay hidden";
      frame.setAttribute("aria-hidden", "true");
      frame.innerHTML = "";
    }
    if (center) center.className = "display-center suprstar-idle-center";
    byId("displayBrand").textContent = "";
    if (mediaSlot) {
      mediaSlot.className = "media-slot suprstar-idle-logo-slot";
      mediaSlot.innerHTML = `<img src="${esc(SUPRSTAR_LOGO)}" alt="supRstar" class="suprstar-idle-logo" decoding="async"/>`;
    }
    byId("displayMain").className = "suprstar-idle-copy";
    byId("displayMain").style.removeProperty("font-size");
    byId("displayMain").innerHTML = [
      `<span class="suprstar-idle-line">Awaiting live Feed.</span>`,
      `<span class="suprstar-idle-line">Be a SupRstar @ ${esc(clubName)}</span>`,
      // Feature: make clear this is the idle/default board, not an IP/security block.
      `<span class="suprstar-idle-note">Idle board · no guest is live right now</span>`
    ].join("");
    byId("displaySub").className = "hidden";
    byId("displaySub").removeAttribute("aria-label");
    byId("displaySub").textContent = "";
    byId("displaySub").style.removeProperty("font-size");
    if (rail) {
      rail.className = "display-identity-rail hidden";
      rail.innerHTML = "";
    }
    const teamReset = byId("displayJerseyTeam");
    if (teamReset) {
      teamReset.className = "soccer-jersey-team hidden";
      teamReset.textContent = "";
      teamReset.setAttribute("aria-hidden", "true");
    }
    markDisplayReady();
  }

  function renderTimedLiveContent(data = {}) {
    if (liveContentExpiryTimer) {
      window.clearTimeout(liveContentExpiryTimer);
      liveContentExpiryTimer = null;
    }
    const approvedMillis = data.approvedAt?.toMillis?.() || 0;
    const durationSeconds = Math.max(1, Number(data.displayDurationSeconds || DEFAULT_LIVE_SHOUTOUT_SECONDS));
    const expiresMillis = approvedMillis ? approvedMillis + durationSeconds * 1000 : 0;
    if (String(data.status || "").toLowerCase() === "approved" && expiresMillis) {
      const remaining = expiresMillis - Date.now();
      if (remaining <= 0) {
        render(defaultClubDisplayPayload());
        return;
      }
      liveContentExpiryTimer = window.setTimeout(() => {
        liveContentExpiryTimer = null;
        render(defaultClubDisplayPayload());
      }, Math.min(remaining, 2147483647));
    }
    render(data);
  }

  function classicFitStyle(row, rows, textSizePercent = 16) {
    const rowLen = Math.max(glyphLen(row), 1);
    const compact = /64x32/.test(screenFormatOverride || loc.primaryDisplayScreenFormatId || "");
    const scale = Math.min(1.5, Math.max(.5, Number(textSizePercent || 16) / 16)) * (compact ? 0.82 : 1);
    const maxPx = Math.round((rowLen <= 5 ? 118 : rowLen <= 8 ? 106 : rowLen <= 10 ? 96 : rowLen <= 12 ? 88 : rowLen <= 16 ? 72 : 58) * scale);
    const vw = ((rowLen <= 8 ? 8.6 : rowLen <= 12 ? 7.4 : rowLen <= 16 ? 6.2 : 5.2) * scale).toFixed(2);
    const minPx = compact ? 18 : 38;
    return `--fit-size:clamp(${minPx}px,${vw}vw,${maxPx}px)`;
  }

  function enforceTrimmedVideoPlayback(video, data = {}) {
    if (!video || data.selectedMediaVersion !== "trimmed") return;
    const start = Number(data.trimStart || 0);
    const end = Number(data.trimEnd || data.trimmedDuration || 7);
    if (!end || end <= start) return;
    const loopTrim = () => {
      if (video.currentTime < start || video.currentTime >= end) {
        try { video.currentTime = start; } catch (e) {}
        video.play?.().catch(() => {});
      }
    };
    video.addEventListener("loadedmetadata", () => {
      try { video.currentTime = start; } catch (e) {}
    });
    video.addEventListener("timeupdate", loopTrim);
  }

  function normalizedFootballTeamMembers(data = {}, textCaps = {}) {
    const source = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    const nameLimit = Math.max(1, Number(textCaps.maxPlayerNameCharacters || 14));
    return Array.from({length:4}, (_, index) => {
      const member = source[index] || {};
      const name = String(member.name || `PLAYER ${index + 1}`).trim().slice(0, nameLimit) || `PLAYER ${index + 1}`;
      return {
        slot:index + 1,
        name,
        position:String(member.position || "TEAM MEMBER").trim().slice(0, 24) || "TEAM MEMBER",
        mediaUrl:String(member.mediaUrl || member.enhancedMediaUrl || member.originalMediaUrl || "").trim().slice(0, 1800),
        aiEnhancementApplied:member.aiEnhancementApplied === true,
        initials:name.split(/\s+/).map(part => part[0] || "").join("").slice(0, 2).toUpperCase() || String(index + 1)
      };
    });
  }

  function footballStadiumMessageRows(value = "", textCaps = {}) {
    const maxRows = Math.max(1, Number(textCaps.stadiumLineCount || 3));
    const perLine = Math.max(1, Number(textCaps.stadiumCharactersPerLine || 18));
    const total = Math.max(1, Number(textCaps.maxStadiumCharacters || maxRows * perLine));
    const clean = glyphSlice(cleanBoardText(value || "TONIGHT, WE TAKE THE FIELD TOGETHER"), 0, total);
    const rows = [];
    pushWrapped(rows, clean.split(" ").filter(Boolean), maxRows, perLine);
    return rows.slice(0, maxRows);
  }

  async function cacheBackedFootballMediaUrl(url) {
    if (!url || !window.caches || !window.fetch) return url;
    const cache = await window.caches.open(FOOTBALL_MEDIA_CACHE);
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url, {cache:"force-cache", mode:"cors"});
      if (!response.ok) throw new Error(`Media download failed (${response.status}).`);
      await cache.put(url, response.clone());
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    footballObjectUrls.push(objectUrl);
    return objectUrl;
  }

  function waitForFootballImage(image, timeoutMs = 15000) {
    return new Promise(resolve => {
      let settled = false;
      const finish = loaded => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        resolve(loaded);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      if (image.complete && image.naturalWidth > 0) finish(true);
    });
  }

  async function prepareFootballTeamMedia(stage) {
    footballObjectUrls.forEach(url => URL.revokeObjectURL(url));
    footballObjectUrls = [];
    const cachedUrls = new Map();
    const images = Array.from(stage.querySelectorAll("img[data-media-url]"));
    await Promise.all(images.map(async image => {
      const remoteUrl = image.dataset.mediaUrl || "";
      try {
        if (!cachedUrls.has(remoteUrl)) cachedUrls.set(remoteUrl, cacheBackedFootballMediaUrl(remoteUrl).catch(() => remoteUrl));
        image.src = await cachedUrls.get(remoteUrl);
        const loaded = await waitForFootballImage(image);
        if (!loaded) throw new Error("Image did not finish loading.");
      } catch (error) {
        image.replaceWith(Object.assign(document.createElement("span"), {className:"football-player-initials", textContent:image.dataset.initials || "?"}));
      }
    }));
    stage.classList.add("football-team-ready");
  }

  function renderFootballTeamIntro({canvas, center, mediaSlot, mainText, subText, data, textCaps}) {
    const members = normalizedFootballTeamMembers(data, textCaps);
    const stadiumMessageRows = footballStadiumMessageRows(data.stadiumMessage, textCaps);
    const openingRows = displayTextRows(mainText || "ZEBBIES ALL-STARS", textCaps);
    const themeId = String(data.colorTheme || "stadiumGold");
    const theme = window.FLOQRIdentity?.footballTheme?.(themeId) || {accent:data.themeAccent || "#dfff5a", field:"#06180f", ink:"#ffffff", frame:"#5c4700"};
    const formatId = String(data.screenFormatId || textCaps.formatId || "");
    const skipFinale = window.FLOQRIdentity?.isSmallFootballDisplay?.(formatId) || data.skipFinaleLineup === true || textCaps.skipFinaleLineup === true;
    const portraitMotion = data.aiPortraitMotion === true || members.some(member => member.aiEnhancementApplied);
    const backgroundColor = /^#[0-9a-fA-F]{6}$/.test(String(data.backgroundColor || "")) ? data.backgroundColor : "";
    const backgroundUrl = String(data.backgroundUrl || "").trim();
    const stageStyle = [
      `--football-accent:${theme.accent}`,
      `--football-field:${theme.field}`,
      `--football-ink:${theme.ink}`,
      `--football-frame:${theme.frame}`,
      backgroundColor ? `background-color:${backgroundColor}` : "",
      backgroundUrl ? `background-image:url("${backgroundUrl.replace(/"/g, "%22")}");background-size:cover;background-position:center;` : ""
    ].filter(Boolean).join(";");
    canvas.classList.add("football-team-intro");
    center.className = "display-center football-team-intro-layout";
    mediaSlot.classList.remove("hidden");
    const playerImage = member => member.mediaUrl
      ? `<img data-media-url="${esc(member.mediaUrl)}" data-initials="${esc(member.initials)}" alt="${esc(member.name)}">`
      : `<span class="football-player-initials">${esc(member.initials)}</span>`;
    const finaleHtml = skipFinale ? "" : `<div class="football-final-lineup">
          <header><span>ZEBBIES ALL-STARS</span><strong>${openingRows.map(row => esc(row)).join("<br>")}</strong></header>
          <div class="football-final-grid">${members.map((member, index) => `<article>
            <div class="football-final-photo">${playerImage(member)}</div>
            <b>${esc(member.name)}</b><small>${esc(member.position)}</small><em>0${index + 1}</em>
          </article>`).join("")}</div>
        </div>`;
    mediaSlot.innerHTML = `
      <section class="football-intro-stage${skipFinale ? " football-skip-finale" : ""}${portraitMotion ? " football-portrait-motion" : ""}" data-theme="${esc(themeId)}" style="${stageStyle}" aria-label="20-second Football Intro">
        <div class="football-stadium-lights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="football-field-lines" aria-hidden="true"></div>
        <div class="football-opening">
          <span>ZEBBIES GARDEN PRESENTS</span>
          <strong>${openingRows.map(row => esc(row)).join("<br>")}</strong>
          <small>${esc(subText || "GAME NIGHT LINEUP")}</small>
        </div>
        <div class="football-player-reveals">
          ${members.map((member, index) => `<article class="football-player-reveal football-player-${index + 1}">
            <div class="football-player-number">0${index + 1}</div>
            <div class="football-player-portrait">${playerImage(member)}</div>
            <div class="football-player-copy"><span>NOW INTRODUCING</span><strong>${esc(member.name)}</strong><small>${esc(member.position)}</small></div>
          </article>`).join("")}
        </div>
        <div class="football-stadium-message football-message-lines-${stadiumMessageRows.length}">
          <span>MESSAGE FROM THE LINEUP</span>
          <div>${stadiumMessageRows.map(row => `<b>${esc(row)}</b>`).join("")}</div>
        </div>
        ${finaleHtml}
        <div class="football-intro-progress" aria-hidden="true"></div>
      </section>`;
    prepareFootballTeamMedia(mediaSlot.querySelector(".football-intro-stage")).catch(() => mediaSlot.querySelector(".football-intro-stage")?.classList.add("football-team-ready"));
    byId("displayMain").textContent = "";
    byId("displaySub").textContent = "";
  }

  function render(data) {
    stopSplitMediaLoop();
    if (isSuprstarIdlePayload(data)) {
      renderSuprstarIdleScreen({...loc, locationName: data.locationName || loc.locationName});
      return;
    }
    const rawTemplateId = data.template || "neon";
    const baseTemplate = templates[rawTemplateId] || templates.neon || {};
    const consolidatedId = baseTemplate.consolidatedTemplateId || baseTemplate.aliasOf || rawTemplateId;
    const templateId = (consolidatedId === "soccerJersey" || rawTemplateId === "soccerJersey") ? "soccerJersey" : rawTemplateId;
    let t = {...(templates[templateId] || baseTemplate), className:data.templateClassName || baseTemplate.className, supportsMedia:data.templateSupportsMedia ?? baseTemplate.supportsMedia};
    if (!data.jerseyTeamId && /^soccer/i.test(rawTemplateId) && rawTemplateId !== "soccerJersey") {
      data = {...data, jerseyTeamId: rawTemplateId, template: "soccerJersey"};
    }
    if (isSoccerJerseyTemplate(t, templateId) || isSoccerJerseyTemplate(t, rawTemplateId)) {
      t = resolveJerseyStyle(t, data);
    }
    const isClassicBoard = templateId === "blackwhite" || t.id === "blackwhite" || t.className === "classic-bw" || t.identityRail === true;
    const isSoccerJersey = isSoccerJerseyTemplate(t, templateId) || isSoccerJerseyTemplate(t, rawTemplateId);
    const isTextOverlay = isTextOverlayTemplate(t, templateId);
    const isFootballTeamIntro = templateId === "zebbiesFootballTeamIntro" || t.layout === "football-team-intro";
    const screenFormatId = String(
      resolvePlaybackScreenFormat(data, t)
      || boardAssignedFormatId()
      || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS?.[0]
      || "led-96x48"
    );
    const textCaps = window.FLOQRTextLayout?.resolve?.(t, screenFormatId) || {
      supported:true,
      lineCount:Number(data.lineCount || t.lineCount || 1),
      maxCharactersPerLine:Number(data.maxCharactersPerLine || t.maxCharactersPerLine || data.maxMainCharacters || t.maxMainCharacters || 60),
      maxMainCharacters:Number(data.maxMainCharacters || t.maxMainCharacters || 60),
      maxSubCharacters:Number(data.maxSubCharacters ?? t.maxSubCharacters ?? 60),
      mainTextSizePercent:Number(data.mainTextSizePercent || t.mainTextSizePercent || 20.8),
      subTextSizePercent:Number(data.subTextSizePercent || t.subTextSizePercent || 7.8),
      teamTextSizePercent:Number(data.teamTextSizePercent || t.teamTextSizePercent || 7.2)
    };
    if (textCaps.supported === false && !isUrlPreviewMode() && String(data.status || "") !== "preview") {
      const idle = defaultClubDisplayPayload();
      if (idle && idle.template !== templateId) {
        render(idle);
        return;
      }
    }
    const mainSize = Math.min(40, Math.max(4, Number(textCaps.mainTextSizePercent || 20.8)));
    const subSize = Math.min(20, Math.max(2, Number(textCaps.subTextSizePercent || 7.8)));
    const mainLimit = Math.max(1, Number(textCaps.maxMainCharacters || textCaps.main || 60));
    const subLimit = Math.max(0, Number(textCaps.maxSubCharacters ?? textCaps.sub ?? 60));
    const canvas = byId("displayCanvas");
    canvas.className = "display-canvas";
    // className may be space-separated (e.g. "soccer-jersey soccer-morocco"); classList.add rejects spaces.
    String(t.className || "")
      .split(/\s+/)
      .filter(cls => cls && cls !== "neon")
      .forEach(cls => canvas.classList.add(cls));
    if (isClassicBoard && !isTextOverlay) canvas.classList.add("classic-board-template");
    if (isTextOverlay) canvas.classList.add("text-overlay-template");
    canvas.dataset.templateId = templateId;
    canvas.dataset.screenFormatId = screenFormatId;
    const screenFlags = window.FLOQRScreenDatapoints?.canvasFlags?.(screenFormatId) || {};
    canvas.dataset.is96x48 = screenFlags.is96x48 || "0";
    canvas.dataset.is64x48 = screenFlags.is64x48 || "0";
    canvas.dataset.is64x32 = screenFlags.is64x32 || "0";
    canvas.dataset.textProfile = textCaps.profileId || "custom";
    const backgroundUrl = data.backgroundUrl || t.defaultBackgroundUrl || "";
    const backgroundColor = data.backgroundColor || "";
    const backgroundGradient = data.backgroundGradient || "";
    const hasCustomBackground = !!(backgroundUrl || backgroundColor || backgroundGradient);
    canvas.classList.toggle("custom-background-active", hasCustomBackground);
    const bgEl = byId("displayBackground");
    const backgroundFit = resolveBackgroundFit(data, t, backgroundUrl);
    const hasBackgroundLayer = applyBackgroundLayer(bgEl, { backgroundUrl, backgroundColor, backgroundGradient, fit: backgroundFit });
    canvas.classList.toggle("has-background-layer", hasBackgroundLayer);
    const frameUrl = resolveFrameOverlayUrl(t, data);
    const hasFrameOverlay = applyFrameOverlay(byId("displayFrameOverlay"), isTextOverlay ? frameUrl : "", t);
    canvas.classList.toggle("frame-overlay-template", hasFrameOverlay);
    canvas.style.backgroundImage = "";
    canvas.style.background = "";
    canvas.style.backgroundSize = "";
    canvas.style.backgroundPosition = "";
    const staleZebbiesDefault = value => {
      const text = String(value || "").toUpperCase().replace(/\s+/g, " ").trim();
      return locationId !== "zebbies-garden-washington-dc" && /^USE SHOUT\s*OUT/.test(text) && /ZEBBIES/.test(text);
    };
    const locationDefaultMain = clubDefaultMainText(loc);
    const rawMain = (isTextOverlay || isSoccerJersey)
      ? String(data.mainText || "")
      : String((!data.mainText || staleZebbiesDefault(data.mainText)) ? locationDefaultMain : data.mainText);
    // Idle classic board keeps "Use ShoutOut @ Clubname"; do not strip intentional CTA.
    const mainSource = (data.idleCta || data.status === "default") && !isSoccerJersey && !isTextOverlay
      ? (rawMain || locationDefaultMain)
      : rawMain;
    const mainText = isSoccerJersey
      ? glyphSlice(cleanBoardText(mainSource), 0, Math.min(14, mainLimit))
      : mainSource.slice(0, mainLimit + Math.max(0, Number(textCaps.lineCount || 1) - 1));
    // Soccer jersey mark: any characters including emoji (grapheme-capped at 2).
    const subText = isSoccerJersey
      ? glyphSlice(cleanJerseyMark(data.subText || data.jerseyNumber || t.defaultSub || ""), 0, Math.min(2, subLimit || 2))
      : String(data.subText || data.attribution || data.displayName || t.defaultSub || "").slice(0, subLimit);
    byId("displayBrand").textContent = "";
    const center = document.querySelector(".display-center");
    const mediaSlot = byId("mediaSlot");
    if (center) center.className = "display-center";
    byId("displayMain").className = "";
    byId("displaySub").className = "";
    const teamReset = byId("displayJerseyTeam");
    if (teamReset && !isSoccerJersey) {
      teamReset.className = "soccer-jersey-team hidden";
      teamReset.textContent = "";
      teamReset.setAttribute("aria-hidden", "true");
    }
    canvas.classList.remove("jersey-name-wrapped");
    if (textCaps.supported === false) {
      if (center) center.classList.add("unsupported-text-layout");
      byId("displayMain").textContent = "DISPLAY SIZE NOT SUPPORTED";
      byId("displaySub").textContent = textCaps.advice || "Choose another display size for this template.";
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      markDisplayReady();
      return;
    }
    if (isFootballTeamIntro && center && mediaSlot) {
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      renderFootballTeamIntro({canvas, center, mediaSlot, mainText, subText, data, textCaps});
      markDisplayReady();
      return;
    }
    const mediaUrl = data.mediaUrl || "";
    const mediaType = data.mediaType || "";
    const usesSplitMedia = t.layout === "split-media" || (t.supportsMedia && mediaUrl);
    byId("displayMain").style.setProperty("font-size", `${usesSplitMedia ? mainSize * .78 : mainSize}vh`, "important");
    byId("displaySub").style.setProperty("font-size", `${usesSplitMedia ? subSize * .85 : subSize}vh`, "important");
    if (center) center.classList.toggle("split-media-layout", usesSplitMedia);
    if (usesSplitMedia) {
      mediaSlot.classList.remove("hidden");
      if (mediaUrl) {
        const isVideo = mediaType === "video" || (!mediaType && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl));
        mediaSlot.innerHTML = isVideo ? `<video src="${esc(mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(mediaUrl)}" alt="ShoutOut media">`;
        const mediaElement = mediaSlot.querySelector("img,video");
        if (mediaElement) mediaElement.style.objectFit = data.mediaFit === "cover" ? "cover" : "contain";
        if (isVideo) enforceTrimmedVideoPlayback(mediaSlot.querySelector("video"), data);
      } else {
        mediaSlot.innerHTML = '<div class="media-placeholder">IMAGE / VIDEO</div>';
      }
    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
    if (isSoccerJersey) {
      stopHeistIdentityCycle();
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      const sport = jerseySportOf(t, data);
      canvas.classList.remove("jersey-sport-soccer", "jersey-sport-nba", "jersey-sport-nfl");
      canvas.classList.add("soccer-jersey-template", "sports-jersey-template", `jersey-sport-${sport}`);
      const jerseyBg = data.backgroundUrl || t.defaultBackgroundUrl || backgroundUrl;
      const usePhotoBack = !!jerseyBg;
      canvas.style.setProperty("--jersey-primary", t.jerseyPrimary || data.jerseyPrimary || "#111111");
      canvas.style.setProperty("--jersey-secondary", t.jerseySecondary || data.jerseySecondary || "#ffffff");
      canvas.style.setProperty("--jersey-accent", t.jerseyAccent || data.jerseyAccent || t.jerseySecondary || "#ffffff");
      if (usePhotoBack) {
        // Named photo kits (country/club wordmark in PNG): no CSS hanger overlay.
        canvas.classList.remove("jersey-css-back");
        canvas.classList.add("jersey-photo-back");
        hideJerseyMount();
        if (!hasBackgroundLayer) {
          applyBackgroundLayer(bgEl, {backgroundUrl: jerseyBg});
          bgEl.style.backgroundSize = "";
          bgEl.style.backgroundPosition = "";
          canvas.classList.add("has-background-layer");
        }
      } else {
        // CSS hanger mount — kits without a photo back only.
        canvas.classList.add("jersey-css-back");
        canvas.classList.remove("jersey-photo-back");
        ensureJerseyMount(sport, {hangerOnly: false});
        if (!hasBackgroundLayer) {
          applyBackgroundLayer(bgEl, {backgroundGradient: lockerRoomBackground()});
          canvas.classList.add("has-background-layer");
        }
      }
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
      const nameRows = jerseyNameRows(mainText, {
        ...textCaps,
        maxMainCharacters: Math.min(14, Number(textCaps.maxMainCharacters || textCaps.main || 14)),
        maxCharactersPerLine: Math.min(8, Number(textCaps.maxCharactersPerLine || textCaps.perLine || 8)),
        lineCount: 2
      });
      const wrapped = nameRows.filter(Boolean).length > 1;
      const wrapScale = wrapped ? 0.85 : 1;
      // Soccer: upright condensed kit type for CSS name + number only. Country/club is in the PNG.
      let baseName = Number(textCaps.mainTextSizePercent || 16.2);
      let baseNumber = Number(textCaps.subTextSizePercent || 64);
      let baseTeam = Number(textCaps.teamTextSizePercent || 7.2);
      canvas.classList.remove("jersey-css-country");
      if (sport === "soccer" && usePhotoBack) {
        baseName = Math.min(baseName * 0.68, 11.2);
        baseNumber = Math.min(baseNumber * 0.72, 46);
        baseTeam = Math.min(baseTeam * 0.65, 5.5);
      } else if (sport === "nba") {
        baseName = Math.min(baseName, 12.5);
        baseNumber = Math.max(baseNumber, 70);
        baseTeam = Math.min(baseTeam, 5.8);
      } else if (sport === "nfl") {
        baseName = Math.min(baseName, 11.5);
        baseNumber = Math.max(baseNumber, 74);
        baseTeam = Math.min(baseTeam, 5);
      }
      const nameSize = Math.min(sport === "nba" || sport === "nfl" ? 16 : (usePhotoBack && sport === "soccer" ? 11.2 : 18), Math.max(7, baseName * wrapScale));
      const numberSize = Math.min(sport === "nfl" ? 78 : (usePhotoBack && sport === "soccer" ? 46 : 72), Math.max(16, baseNumber * wrapScale));
      const teamSize = Math.min(usePhotoBack && sport === "soccer" ? 5.4 : 12, Math.max(3.8, baseTeam * wrapScale));
      const teamLabel = jerseyTeamLabel(t, data);
      const teamEl = ensureJerseyTeamEl(center);
      if (teamEl) {
        const hideCrest = sport === "nfl" || !teamLabel || (sport === "soccer" && usePhotoBack);
        teamEl.className = "soccer-jersey-team" + (hideCrest ? " hidden" : "");
        teamEl.setAttribute("aria-hidden", hideCrest ? "true" : "false");
        if (hideCrest) teamEl.textContent = "";
        else if (sport === "soccer") paintJerseyCollarArch(teamEl, teamLabel);
        else teamEl.textContent = teamLabel;
        teamEl.style.setProperty("font-size", `${teamSize}vh`, "important");
      }
      canvas.classList.toggle("jersey-name-wrapped", wrapped);
      byId("displayMain").classList.add("soccer-jersey-name");
      byId("displayMain").classList.toggle("jersey-name-wrap", wrapped);
      byId("displayMain").style.setProperty("font-size", `${nameSize}vh`, "important");
      byId("displayMain").innerHTML = nameRows.filter(Boolean).map(row => `<span class="jersey-name-line">${esc(row)}</span>`).join("") || "";
      byId("displaySub").classList.remove("classic-bw-sub-hidden");
      byId("displaySub").classList.add("soccer-jersey-number");
      byId("displaySub").style.setProperty("font-size", `${numberSize}vh`, "important");
      byId("displaySub").textContent = subText;
      byId("displaySub").setAttribute("aria-label", subText ? `Jersey mark ${subText}` : "Jersey mark");
      // Animated text holder at bottom (same burst rail as classic).
      const rail = byId("displayIdentityRail");
      if (rail && t.identityRail !== false) {
        const clubName = String(data.locationName || loc.locationName || "Club").trim() || "Club";
        const identity = classicIdentityPresentation(data.attribution || "");
        const idleCta = DISPLAY_BOARD === "secondary"
          ? `Awaiting live Feed. Be a SupRstar @ ${clubName}`
          : `Use ShoutOut @ ${clubName}`;
        const idleValue = glyphSlice(cleanBoardText(idleCta), 0, 28) || identity.value;
        const showIdle = !subText && !mainText;
        rail.className = "display-identity-rail classic-bw-identity soccer-jersey-rail" + (showIdle || !identity.supplied ? " uses-brand-fallback" : " has-attribution");
        rail.setAttribute("aria-label", showIdle ? idleCta : `${identity.kicker} ${identity.value}`);
        const idleKicker = DISPLAY_BOARD === "secondary" ? "LIVE" : "USE";
        const idleStrong = showIdle
          ? (DISPLAY_BOARD === "secondary" ? idleValue.replace(/^AWAITING\s*/i, "") : idleValue.replace(/^USE\s*/i, ""))
          : identity.value;
        rail.innerHTML = `<span class="classic-identity-shell"><small>${esc(showIdle ? idleKicker : identity.kicker)}</small><strong>${esc(showIdle ? idleStrong : identity.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
      } else if (rail) {
        rail.className = "display-identity-rail hidden";
        rail.innerHTML = "";
      }
      markDisplayReady();
      return;
    }
    hideJerseyMount();
    canvas.classList.remove("jersey-sport-soccer", "jersey-sport-nba", "jersey-sport-nfl", "jersey-css-back", "jersey-photo-back", "jersey-css-country");
    const railClear = byId("displayIdentityRail");
    if (railClear) {
      railClear.className = "display-identity-rail hidden";
      railClear.innerHTML = "";
    }
    if (isClassicBoard && isTextOverlay) {
      const rows = mainText.trim()
        ? classicBoardRows(mainText, textCaps)
        : Array(Math.max(1, Number(textCaps.lineCount || 3))).fill("");
      byId("displayMain").classList.add("text-overlay-main");
      byId("displayMain").innerHTML = `<span class="text-overlay-lines text-overlay-lines-${rows.length}" style="--board-lines:${rows.length}" data-line-count="${rows.length}">${rows.map(row => `<b style="${classicFitStyle(row, rows, mainSize)}">${esc(row)}</b>`).join("")}</span>`;
      if (t.identityRail !== false) {
        renderHeistIdentityRail(t, subText);
      } else {
        stopHeistIdentityCycle();
        byId("displaySub").classList.add("text-overlay-identity", "classic-bw-sub-hidden");
        byId("displaySub").removeAttribute("aria-label");
        byId("displaySub").innerHTML = "";
      }
      if (String(templateId || "").startsWith("heist") || String(t.id || "").startsWith("heist")) {
        scheduleHeistMessageThenBrandSlide(t);
      } else {
        stopHeistPhaseTimers();
        hideHeistBrandSlide();
      }
    } else if (isClassicBoard) {
      stopHeistIdentityCycle();
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      const rows = classicBoardRows(mainText, textCaps);
      const identity = classicIdentityPresentation(subText);
      byId("displayMain").classList.add("classic-bw-board");
      byId("displayMain").innerHTML = `<span class="classic-board-lines classic-board-lines-${rows.length}" style="--board-lines:${rows.length}" data-line-count="${rows.length}">${rows.map(row => `<b style="${classicFitStyle(row, rows, mainSize)}">${esc(row)}</b>`).join("")}</span>`;
      byId("displaySub").classList.add("classic-bw-identity", identity.supplied ? "has-attribution" : "uses-brand-fallback");
      byId("displaySub").setAttribute("aria-label", `${identity.kicker} ${identity.value}`);
      byId("displaySub").innerHTML = `<span class="classic-identity-shell"><small>${esc(identity.kicker)}</small><strong>${esc(identity.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
    } else {
      stopHeistIdentityCycle();
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      byId("displayMain").classList.remove("classic-bw-board");
      byId("displaySub").classList.remove("classic-bw-sub-hidden");
      byId("displaySub").removeAttribute("aria-label");
      const rows = displayTextRows(mainText, textCaps);
      byId("displayMain").classList.add("display-message-lines", `display-message-lines-${rows.length}`);
      byId("displayMain").innerHTML = rows.map(row => `<span>${esc(row)}</span>`).join("");
      const identity = usesSplitMedia ? splitMediaIdentityPresentation(data, subText) : null;
      if (usesSplitMedia && identity) {
        byId("displaySub").classList.add("classic-bw-sub-hidden");
        byId("displaySub").textContent = identity.extraCopy || "";
        renderSplitMediaIdentityRail(identity);
        const family = window.FLOQRScreenDatapoints?.familyOf?.(screenFormatId) || "";
        if (family === "64x48" || family === "64x32") startSplitMediaLoop(canvas);
      } else {
        byId("displaySub").textContent = subText;
      }
    }
    markDisplayReady();
  }
  function showDisplayAccessDenied(info = {}) {
    // Feature: locked display — never show idle/venue marketing to unauthorized clients.
    stopHeistIdentityCycle();
    stopHeistPhaseTimers();
    stopSplitMediaLoop();
    hideHeistBrandSlide();
    hideJerseyMount();
    const canvas = byId("displayCanvas");
    if (canvas) {
      canvas.className = "display-canvas display-access-denied";
    }
    const mediaSlot = byId("mediaSlot");
    if (mediaSlot) {
      mediaSlot.className = "media-slot hidden";
      mediaSlot.innerHTML = "";
    }
    const rail = byId("displayIdentityRail");
    if (rail) {
      rail.className = "display-identity-rail hidden";
      rail.innerHTML = "";
    }
    byId("displayBrand").textContent = "Floq Media / FloqR";
    byId("displayMain").className = "display-denied-message";
    byId("displayMain").textContent =
      "This device has not been configured to work with Floq Media or FloqR. Please contact Floq Media or FloqR to get device properly configured";
    byId("displaySub").className = "display-denied-sub";
    byId("displaySub").textContent = "";
    markDisplayReady();
  }

  /**
   * Feature: Display Security gate — runs BEFORE idle or live content.
   * Protects display.html / display2.html equally (idle board included).
   * Always fail closed on venue players — never show idle when the check fails.
   */
  async function enforceDisplayAccess() {
    const accessKey = String(qs("k", qs("token", "")) || "").trim();
    try {
      if (!firebase?.app || !firebase.functions) {
        showDisplayAccessDenied({observedIp: "", reason: "security_helper_missing"});
        return false;
      }
      const fn = firebase.app().functions("us-central1").httpsCallable("checkDisplayAccess");
      const result = await fn({
        locationId,
        displayBoard: DISPLAY_BOARD,
        accessToken: accessKey,
        k: accessKey,
        pageUrl: String(location.href || "").slice(0, 500),
        userAgent: String(navigator.userAgent || "").slice(0, 400),
        screenFormatId: screenFormatOverride || "",
        // reportedIp is observational only — server must not allowlist from client-supplied IP.
        reportedIp: String(qs("ip", "") || "").trim(),
        reportedHostname: String(qs("host", qs("hostname", "")) || "").trim(),
        reportedMac: String(qs("mac", qs("macAddress", "")) || "").trim(),
        language: String(navigator.language || "").slice(0, 40),
        timezone: (() => {
          try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) { return ""; }
        })(),
        platform: String(navigator.platform || "").slice(0, 120)
      });
      const data = result?.data || {};
      window.__FLOQR_DISPLAY_CLIENT_IP = data.observedIp || "";
      if (data.allowed !== true) {
        showDisplayAccessDenied({
          observedIp: data.observedIp || "",
          reason: data.reason || "denied"
        });
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[display access]", err?.message || err);
      showDisplayAccessDenied({
        observedIp: "",
        reason: "check_failed"
      });
      return false;
    }
  }

  window.renderShoutOutDisplay = render;

  document.addEventListener("DOMContentLoaded", async () => {
    screenFormatOverride = isUrlPreviewMode()
      ? normalizeScreenFormatId(qs("screen", qs("screenFormatId", "")))
      : "";
    // Composer / QA URLs include template or preview=1. Xibo stays location-only and still uses Display Security.
    if (isUrlPreviewMode()) {
      paintUrlPreviewNow();
      return;
    }
    await persistenceReady;
    if (!explicitLocationRequested) {
      const ipBoundLocation = await resolveLocationFromIpParam();
      if (ipBoundLocation) locationId = canonicalStaticLocationId(ipBoundLocation);
    }
    locationId = await resolveDisplayLocationId(locationId);
    loc = getStaticLocation(locationId);
    const packagedLoc = loc;
    await hydrateTemplatesFromFirestore();
    try {
      const clubDoc = await db.collection("clubLocations").doc(locationId).get();
      if (clubDoc.exists) {
        const live = clubDoc.data() || {};
        loc = {
          ...loc,
          ...live,
          primaryDisplayScreenFormatId: packagedLoc.primaryDisplayScreenFormatId || live.primaryDisplayScreenFormatId || live.displayType || live.screenFormatId || loc.primaryDisplayScreenFormatId,
          secondaryDisplayScreenFormatId: packagedLoc.secondaryDisplayScreenFormatId || live.secondaryDisplayScreenFormatId || loc.secondaryDisplayScreenFormatId || live.primaryDisplayScreenFormatId || loc.primaryDisplayScreenFormatId,
          displayScreenFormatIds: Array.from(new Set([
            ...(Array.isArray(packagedLoc.displayScreenFormatIds) ? packagedLoc.displayScreenFormatIds : []),
            ...(Array.isArray(live.displayScreenFormatIds) ? live.displayScreenFormatIds : loc.displayScreenFormatIds || [])
          ].map(String).filter(Boolean))),
          displayFooterBrand: live.displayFooterBrand || loc.displayFooterBrand || "FLOQR ShoutOut",
          ledPanel: live.ledPanel || loc.ledPanel,
          approvedDisplayIps: live.approvedDisplayIps || [],
          displayIpRestrictionEnabled: live.displayIpRestrictionEnabled === true,
          displayTokenRequired: live.displayTokenRequired
        };
        ["VenueSupports96x48", "VenueSupports64x48", "VenueSupports64x32"].forEach(key => {
          const liveVal = live[key];
          const liveExplicit = liveVal === 0 || liveVal === 1 || liveVal === "0" || liveVal === "1";
          if (liveExplicit) loc[key] = liveVal;
          else if (packagedLoc[key] === 1 || packagedLoc[key] === "1") loc[key] = 1;
        });
        if (window.FLOQRScreenDatapoints?.applyVenue) window.FLOQRScreenDatapoints.applyVenue(loc);
      }
    } catch (e) {}
    if (!screenFormatOverride && isUrlPreviewMode()) {
      screenFormatOverride = boardAssignedFormatId(loc);
    }
    try {
      document.title = DISPLAY_BOARD === "secondary"
        ? `FLOQR Display 2 · ${loc.locationName || locationId}`
        : `FLOQR ShoutOut Display · ${loc.locationName || locationId}`;
    } catch (_) {}

    const accessOk = await enforceDisplayAccess();
    if (!accessOk) return;

    if (isUrlPreviewMode()) {
      render(buildUrlPreviewPayload());
      db.collection("liveContent").doc(liveContentDocId(locationId)).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data() || {};
        const status = String(data.status || "").toLowerCase();
        const hasLiveMessage = !!(String(data.mainText || "").trim() || data.mediaUrl);
        if (status === "approved" && hasLiveMessage) {
          if (!data.screenFormatId) data.screenFormatId = boardAssignedFormatId(loc);
          renderTimedLiveContent(data);
        }
      }, e => render({mainText:"DISPLAY ERROR", subText:e.message, template:"fire", locationName: loc.locationName}));
      return;
    }
    db.collection("liveContent").doc(liveContentDocId(locationId)).onSnapshot(doc => {
      let payload = doc.exists ? doc.data() : defaultClubDisplayPayload();
      if (DISPLAY_BOARD === "secondary") {
        const status = String(payload.status || "").toLowerCase();
        const hasLiveMessage = !!(String(payload.mainText || "").trim() || payload.mediaUrl);
        if (!doc.exists || status === "default" || payload.idleCta || (!status && !hasLiveMessage) || isLegacyShoutOutIdleText(payload.mainText)) {
          payload = defaultClubDisplayPayload();
        }
      }
      if (!payload.screenFormatId) payload.screenFormatId = boardAssignedFormatId(loc);
      renderTimedLiveContent(payload);
    }, e => render({mainText:"DISPLAY ERROR", subText:e.message, template:"fire", locationName: loc.locationName}));
  });
})();

/* v28.5 media renderer for Xibo HTML */
(function(){
function byId(id){return document.getElementById(id);}
window.jadzRenderDisplayMedia=function(data){
 if(!data||!data.mediaUrl)return;
 let host=byId("mediaHost")||byId("displayMedia")||document.querySelector(".display-media");
 if(!host){host=document.createElement("div");host.id="mediaHost";host.className="display-media";document.body.appendChild(host);}
 host.innerHTML=data.mediaType==="video"?`<video src="${data.mediaUrl}" autoplay muted loop playsinline style="max-width:100%;max-height:80vh;border-radius:18px;"></video>`:`<img src="${data.mediaUrl}" alt="" style="max-width:100%;max-height:80vh;border-radius:18px;">`;
 const video=host.querySelector("video");
 if(video&&data.selectedMediaVersion==="trimmed"){
  const start=Number(data.trimStart||0),end=Number(data.trimEnd||data.trimmedDuration||7);
  video.addEventListener("timeupdate",function(){if(video.currentTime<start||video.currentTime>=end){try{video.currentTime=start;}catch(e){} video.play&&video.play().catch(function(){});}});
 }
};
})();
