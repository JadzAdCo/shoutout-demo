/* display-app.js v29.09.30 */
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
  let liveContentExpiryTimer = null;
  let screenFormatOverride = "";

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

  function cleanBoardText(value) {
    return String(value || "")
      .normalize("NFC")
      .toUpperCase()
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function glyphs(value) {
    return Array.from(String(value || ""));
  }

  function glyphLen(value) {
    return glyphs(value).length;
  }

  function glyphSlice(value, start, end) {
    return glyphs(value).slice(start, end).join("");
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

    return (rows.length ? rows : ["SHOUTOUT"]).slice(0, maxRows);
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
    const brandFallback = glyphSlice(cleanBoardText(loc.displayFooterBrand || "FLOQR SHOUTOUT"), 0, 20) || "FLOQR SHOUTOUT";
    return {
      supplied:!!supplied,
      kicker:supplied ? "FROM" : "PRESENTED BY",
      value:supplied || brandFallback
    };
  }

  function isTextOverlayTemplate(template = {}, templateId = "") {
    return template.textOverlay === true || String(templateId || template.id || "").startsWith("heist");
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

  function applyFrameOverlay(frameEl, frameUrl = "") {
    if (!frameEl) return false;
    const url = String(frameUrl || "").trim();
    if (!url) {
      frameEl.className = "display-frame-overlay hidden";
      frameEl.style.backgroundImage = "";
      return false;
    }
    frameEl.className = "display-frame-overlay";
    frameEl.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
    frameEl.style.backgroundSize = "contain";
    frameEl.style.backgroundPosition = "center";
    frameEl.style.backgroundRepeat = "no-repeat";
    return true;
  }

  function clubDefaultMainText(location = {}) {
    const configured = String(location.defaultMain || "").trim();
    if (configured) return configured.replace(/USE SHOUT\s*OUT/i, "USE SHOUTOUT");
    const clubName = String(location.locationName || location.brandName || "THIS CLUB")
      .replace(/\s+x\s+FLOQR.*$/i, "")
      .trim()
      .toUpperCase();
    return `USE SHOUTOUT @ ${clubName}`;
  }

  function defaultClubDisplayPayload() {
    return {
      locationName:loc.locationName,
      mainText:clubDefaultMainText(loc),
      subText:"",
      template:"blackwhite",
      status:"default"
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
    const templateId = data.template || "neon";
    const baseTemplate = templates[templateId] || templates.neon || {};
    const t = {...baseTemplate, className:data.templateClassName || baseTemplate.className, supportsMedia:data.templateSupportsMedia ?? baseTemplate.supportsMedia};
    const isClassicBoard = templateId === "blackwhite" || t.id === "blackwhite" || t.className === "classic-bw" || t.identityRail === true;
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
      subTextSizePercent:Number(data.subTextSizePercent || t.subTextSizePercent || 7.8)
    };
    const mainSize = Math.min(40, Math.max(4, Number(textCaps.mainTextSizePercent || 20.8)));
    const subSize = Math.min(20, Math.max(2, Number(textCaps.subTextSizePercent || 7.8)));
    const mainLimit = Math.max(1, Number(textCaps.maxMainCharacters || textCaps.main || 60));
    const subLimit = Math.max(0, Number(textCaps.maxSubCharacters ?? textCaps.sub ?? 60));
    const canvas = byId("displayCanvas");
    canvas.className = "display-canvas";
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
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
    const hasFrameOverlay = applyFrameOverlay(byId("displayFrameOverlay"), isTextOverlay ? frameUrl : "");
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
    const mainSource = isTextOverlay
      ? String(data.mainText || "")
      : String((!data.mainText || staleZebbiesDefault(data.mainText)) ? locationDefaultMain : data.mainText);
    const mainText = mainSource.slice(0, mainLimit + Math.max(0, Number(textCaps.lineCount || 1) - 1));
    const subText = String(data.subText || t.defaultSub || "").slice(0, subLimit);
    byId("displayBrand").textContent = "";
    const center = document.querySelector(".display-center");
    const mediaSlot = byId("mediaSlot");
    if (center) center.className = "display-center";
    byId("displayMain").className = "";
    byId("displaySub").className = "";
    if (textCaps.supported === false) {
      if (center) center.classList.add("unsupported-text-layout");
      byId("displayMain").textContent = "DISPLAY SIZE NOT SUPPORTED";
      byId("displaySub").textContent = textCaps.advice || "Choose another display size for this template.";
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
      return;
    }
    if (isFootballTeamIntro && center && mediaSlot) {
      renderFootballTeamIntro({canvas, center, mediaSlot, mainText, subText, data, textCaps});
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
    if (isClassicBoard && isTextOverlay) {
      const rows = mainText.trim()
        ? classicBoardRows(mainText, textCaps)
        : Array(Math.max(1, Number(textCaps.lineCount || 3))).fill("");
      const identity = classicIdentityPresentation(subText);
      byId("displayMain").classList.add("text-overlay-main");
      byId("displayMain").innerHTML = `<span class="text-overlay-lines text-overlay-lines-${rows.length}" style="--board-lines:${rows.length}" data-line-count="${rows.length}">${rows.map(row => `<b style="${classicFitStyle(row, rows, mainSize)}">${esc(row)}</b>`).join("")}</span>`;
      if (identity.supplied) {
        byId("displaySub").classList.add("text-overlay-identity", "classic-bw-identity", "has-attribution");
        byId("displaySub").setAttribute("aria-label", `${identity.kicker} ${identity.value}`);
        byId("displaySub").innerHTML = `<span class="text-overlay-identity-shell"><small>${esc(identity.kicker)}</small><strong>${esc(identity.value)}</strong></span>`;
      } else {
        byId("displaySub").classList.add("text-overlay-identity", "classic-bw-identity", "uses-brand-fallback");
        byId("displaySub").setAttribute("aria-label", `${identity.kicker} ${identity.value}`);
        byId("displaySub").innerHTML = `<span class="text-overlay-identity-shell"><small>${esc(identity.kicker)}</small><strong>${esc(identity.value)}</strong></span>`;
      }
    } else if (isClassicBoard) {
      const rows = classicBoardRows(mainText, textCaps);
      const identity = classicIdentityPresentation(subText);
      byId("displayMain").classList.add("classic-bw-board");
      byId("displayMain").innerHTML = `<span class="classic-board-lines classic-board-lines-${rows.length}" style="--board-lines:${rows.length}" data-line-count="${rows.length}">${rows.map(row => `<b style="${classicFitStyle(row, rows, mainSize)}">${esc(row)}</b>`).join("")}</span>`;
      byId("displaySub").classList.add("classic-bw-identity", identity.supplied ? "has-attribution" : "uses-brand-fallback");
      byId("displaySub").setAttribute("aria-label", `${identity.kicker} ${identity.value}`);
      byId("displaySub").innerHTML = `<span class="classic-identity-shell"><small>${esc(identity.kicker)}</small><strong>${esc(identity.value)}</strong></span><span class="classic-identity-particles" aria-hidden="true">${"<i></i>".repeat(12)}</span>`;
    } else {
      byId("displayMain").classList.remove("classic-bw-board");
      byId("displaySub").classList.remove("classic-bw-sub-hidden");
      byId("displaySub").removeAttribute("aria-label");
      const rows = displayTextRows(mainText, textCaps);
      byId("displayMain").classList.add("display-message-lines", `display-message-lines-${rows.length}`);
      byId("displayMain").innerHTML = rows.map(row => `<span>${esc(row)}</span>`).join("");
      byId("displaySub").textContent = subText;
    }
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
          displayFooterBrand: live.displayFooterBrand || loc.displayFooterBrand || "FLOQR SHOUTOUT",
          ledPanel: live.ledPanel || loc.ledPanel
        };
      }
    } catch (e) {}
    if (!screenFormatOverride) {
      screenFormatOverride = normalizeScreenFormatId(loc.primaryDisplayScreenFormatId || loc.displayType || loc.screenFormatId || "");
    }
    if (qs("main","")) {
      render({
        mainText: qs("main"),
        subText: qs("sub"),
        template: qs("template","neon"),
        mediaUrl: qs("media",""),
        mediaType: qs("mediaType",""),
        mediaFit: qs("mediaFit","contain"),
        screenFormatId: screenFormatOverride || qs("screenFormatId",""),
        selectedMediaVersion: qs("selectedMediaVersion",""),
        trimStart: qs("trimStart",""),
        trimEnd: qs("trimEnd",""),
        trimmedDuration: qs("trimmedDuration",""),
        backgroundUrl: qs("backgroundUrl",""),
        backgroundColor: qs("backgroundColor",""),
        backgroundGradient: qs("backgroundGradient",""),
        teamMembers: qsJson("teamMembers", []),
        stadiumMessage:qs("stadiumMessage",""),
        animationDurationSeconds:20,
        locationName: loc.locationName
      });
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
