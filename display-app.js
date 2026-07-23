/* display-app.js v29.09.39 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const qsJson = (name, fallback = []) => {
    try { return JSON.parse(new URL(window.location.href).searchParams.get(name) || ""); }
    catch (error) { return fallback; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
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
  const templates = window.SHOUTOUT_TEMPLATES || {};
  const DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 * 60;
  const HEIST_MESSAGE_SECONDS = 20;
  const HEIST_BRAND_SLIDE_SECONDS = 8;
  const HEIST_LOCAL_LOGO = "./images/heist/heist-dc-logo.png";
  let liveContentExpiryTimer = null;
  let screenFormatOverride = "";
  let heistPhaseTimer = null;
  let heistPhaseLoopTimer = null;

  function canonicalStaticLocationId(id = "") {
    const key = String(id || "zebbies-garden-washington-dc").toLowerCase();
    const row = (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || {};
    return String(row.canonicalLocationId || row.aliasOf || row.mergedInto || key).toLowerCase();
  }

  function getStaticLocation(id = "") {
    const key = canonicalStaticLocationId(id);
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || (window.SHOUTOUT_CLUB_LOCATIONS || {})[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
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
      jerseyCssBack: data.jerseyCssBack != null ? !!data.jerseyCssBack : (source.defaultBackgroundUrl ? false : (source.jerseyCssBack !== false)),
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

  function resetBackgroundLayer(bgEl) {
    if (!bgEl) return;
    bgEl.className = "display-background";
    bgEl.style.backgroundImage = "";
    bgEl.style.background = "";
    bgEl.style.backgroundSize = "";
    bgEl.style.backgroundPosition = "";
    bgEl.style.backgroundRepeat = "";
  }

  function applyBackgroundLayer(bgEl, { backgroundUrl = "", backgroundColor = "", backgroundGradient = "" } = {}) {
    resetBackgroundLayer(bgEl);
    if (backgroundUrl) {
      bgEl.style.backgroundImage = `url("${String(backgroundUrl).replace(/"/g, "%22")}")`;
      bgEl.style.backgroundSize = "cover";
      bgEl.style.backgroundPosition = "center";
      bgEl.style.backgroundRepeat = "no-repeat";
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

  function clubDefaultMainText(location = {}) {
    const clubName = String(location.locationName || location.brandName || location.name || "Club").trim() || "Club";
    const configured = String(location.defaultMain || "").trim();
    if (configured && !/^USE\s*SHOUT\s*OUT\b/i.test(configured)) return configured;
    // Typical club idle board: Use ShoutOut @ Clubname
    return `Use ShoutOut @ ${clubName}`;
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
      data.screenFormatId
      || screenFormatOverride
      || loc.primaryDisplayScreenFormatId
      || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS?.[0]
      || "p125-96x48"
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
    canvas.dataset.textProfile = textCaps.profileId || "custom";
    const backgroundUrl = data.backgroundUrl || t.defaultBackgroundUrl || "";
    const backgroundColor = data.backgroundColor || "";
    const backgroundGradient = data.backgroundGradient || "";
    const hasCustomBackground = !!(backgroundUrl || backgroundColor || backgroundGradient);
    canvas.classList.toggle("custom-background-active", hasCustomBackground);
    const bgEl = byId("displayBackground");
    const hasBackgroundLayer = applyBackgroundLayer(bgEl, { backgroundUrl, backgroundColor, backgroundGradient });
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
      canvas.classList.add("soccer-jersey-template", "sports-jersey-template");
      const jerseyBg = data.backgroundUrl || t.defaultBackgroundUrl || backgroundUrl;
      if (t.jerseyCssBack || !jerseyBg) {
        canvas.classList.add("jersey-css-back");
        canvas.style.setProperty("--jersey-primary", t.jerseyPrimary || data.jerseyPrimary || "#111111");
        canvas.style.setProperty("--jersey-secondary", t.jerseySecondary || data.jerseySecondary || "#ffffff");
        canvas.style.setProperty("--jersey-accent", t.jerseyAccent || data.jerseyAccent || t.jerseySecondary || "#ffffff");
        if (!hasBackgroundLayer) {
          applyBackgroundLayer(bgEl, {
            backgroundGradient: `linear-gradient(165deg, ${t.jerseyPrimary || "#111"} 0%, ${t.jerseyPrimary || "#111"} 42%, ${t.jerseySecondary || "#fff"} 42%, ${t.jerseySecondary || "#fff"} 58%, ${t.jerseyPrimary || "#111"} 58%, #050505 100%)`
          });
          canvas.classList.add("has-background-layer");
        }
      } else if (jerseyBg && !hasBackgroundLayer) {
        applyBackgroundLayer(bgEl, {backgroundUrl: jerseyBg});
        canvas.classList.add("has-background-layer");
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
      // Base sizes: name +50% vs prior 10.8vh → 16.2; number +100% vs prior 32vh → 64.
      const baseName = Number(textCaps.mainTextSizePercent || 16.2);
      const baseNumber = Number(textCaps.subTextSizePercent || 64);
      const baseTeam = Number(textCaps.teamTextSizePercent || 7.2);
      const nameSize = Math.min(24, Math.max(8, baseName * wrapScale));
      const numberSize = Math.min(72, Math.max(22, baseNumber * wrapScale));
      const teamSize = Math.min(12, Math.max(4.5, baseTeam * wrapScale));
      const teamLabel = jerseyTeamLabel(t, data);
      const teamEl = ensureJerseyTeamEl(center);
      if (teamEl) {
        teamEl.className = "soccer-jersey-team" + (teamLabel ? "" : " hidden");
        teamEl.setAttribute("aria-hidden", teamLabel ? "false" : "true");
        teamEl.textContent = teamLabel;
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
        const idleValue = glyphSlice(cleanBoardText(`Use ShoutOut @ ${clubName}`), 0, 28) || identity.value;
        const showIdle = !subText && !mainText;
        rail.className = "display-identity-rail classic-bw-identity soccer-jersey-rail" + (showIdle || !identity.supplied ? " uses-brand-fallback" : " has-attribution");
        rail.setAttribute("aria-label", showIdle ? `Use ShoutOut @ ${clubName}` : `${identity.kicker} ${identity.value}`);
        rail.innerHTML = `<span class="classic-identity-shell"><small>${esc(showIdle ? "USE" : identity.kicker)}</small><strong>${esc(showIdle ? idleValue.replace(/^USE\s*/i, "") : identity.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
      } else if (rail) {
        rail.className = "display-identity-rail hidden";
        rail.innerHTML = "";
      }
      markDisplayReady();
      return;
    }
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
      byId("displaySub").textContent = subText;
    }
    markDisplayReady();
  }
  window.renderShoutOutDisplay = render;

  document.addEventListener("DOMContentLoaded", async () => {
    await persistenceReady;
    screenFormatOverride = normalizeScreenFormatId(qs("screen", qs("screenFormatId", "")));
    if (!explicitLocationRequested) {
      const ipBoundLocation = await resolveLocationFromIpParam();
      if (ipBoundLocation) locationId = canonicalStaticLocationId(ipBoundLocation);
    }
    locationId = await resolveDisplayLocationId(locationId);
    loc = getStaticLocation(locationId);
    try {
      const clubDoc = await db.collection("clubLocations").doc(locationId).get();
      if (clubDoc.exists) {
        const live = clubDoc.data() || {};
        loc = {
          ...loc,
          ...live,
          primaryDisplayScreenFormatId: live.primaryDisplayScreenFormatId || live.displayType || live.screenFormatId || loc.primaryDisplayScreenFormatId,
          displayScreenFormatIds: live.displayScreenFormatIds || loc.displayScreenFormatIds,
          displayFooterBrand: live.displayFooterBrand || loc.displayFooterBrand || "FLOQR ShoutOut",
          ledPanel: live.ledPanel || loc.ledPanel
        };
      }
    } catch (e) {}
    if (!screenFormatOverride) {
      screenFormatOverride = normalizeScreenFormatId(loc.primaryDisplayScreenFormatId || loc.displayType || loc.screenFormatId || "");
    }
    if (isUrlPreviewMode()) {
      render(buildUrlPreviewPayload());
      db.collection("liveContent").doc(locationId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data() || {};
        const status = String(data.status || "").toLowerCase();
        const hasLiveMessage = !!(String(data.mainText || "").trim() || data.mediaUrl);
        if (status === "approved" && hasLiveMessage) {
          if (screenFormatOverride && !data.screenFormatId) data.screenFormatId = screenFormatOverride;
          renderTimedLiveContent(data);
        }
      }, e => render({mainText:"DISPLAY ERROR", subText:e.message, template:"fire", locationName: loc.locationName}));
      return;
    }
    db.collection("liveContent").doc(locationId).onSnapshot(doc => {
      const payload = doc.exists ? doc.data() : defaultClubDisplayPayload();
      if (screenFormatOverride && !payload.screenFormatId) payload.screenFormatId = screenFormatOverride;
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
