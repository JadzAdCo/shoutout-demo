/* display-app.js v29.08.2 */
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
  const requestedLocationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  let locationId = canonicalStaticLocationId(requestedLocationId);
  let loc = getStaticLocation(locationId);
  const templates = window.SHOUTOUT_TEMPLATES || {};
  const DEFAULT_LIVE_SHOUTOUT_SECONDS = 10 * 60;
  let liveContentExpiryTimer = null;

  function canonicalStaticLocationId(id = "") {
    const key = String(id || "zebbies-garden-washington-dc").toLowerCase();
    const row = (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || {};
    return String(row.canonicalLocationId || row.aliasOf || row.mergedInto || key).toLowerCase();
  }

  function getStaticLocation(id = "") {
    const key = canonicalStaticLocationId(id);
    return (window.SHOUTOUT_CLUB_LOCATIONS || {})[key] || (window.SHOUTOUT_CLUB_LOCATIONS || {})[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
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

  function classicBoardRows(mainText) {
    const maxRows = 3;
    const maxChars = 15;
    const words = glyphSlice(cleanBoardText(mainText), 0, maxChars * maxRows).split(" ").filter(Boolean);
    const rows = [];

    if (words[0] === "HAPPY" && words[1] === "BIRTHDAY") {
      rows.push("HAPPY", "BIRTHDAY");
      pushWrapped(rows, words.slice(2), maxRows, maxChars);
    } else {
      pushWrapped(rows, words, maxRows, maxChars);
    }

    return (rows.length ? rows : ["SHOUTOUT"]).slice(0, maxRows);
  }

  function classicIdentityPresentation(subText) {
    const supplied = glyphSlice(cleanBoardText(subText), 0, 20);
    return {
      supplied:!!supplied,
      kicker:supplied ? "FROM" : "PRESENTED BY",
      value:supplied || "FLOQR SHOUTOUT"
    };
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
    const longest = Math.max(...rows.map(x => glyphLen(x)), 1);
    const rowLen = Math.max(glyphLen(row), longest);
    const scale = Math.min(1.5, Math.max(.5, Number(textSizePercent || 16) / 16));
    const maxPx = Math.round((rowLen <= 5 ? 118 : rowLen <= 8 ? 106 : rowLen <= 10 ? 96 : rowLen <= 12 ? 88 : rowLen <= 16 ? 72 : 58) * scale);
    const vw = ((rowLen <= 8 ? 8.6 : rowLen <= 12 ? 7.4 : rowLen <= 16 ? 6.2 : 5.2) * scale).toFixed(2);
    return `--fit-size:clamp(38px,${vw}vw,${maxPx}px)`;
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

  function normalizedFootballTeamMembers(data = {}) {
    const source = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    return Array.from({length:4}, (_, index) => {
      const member = source[index] || {};
      const name = String(member.name || `PLAYER ${index + 1}`).trim().slice(0, 24) || `PLAYER ${index + 1}`;
      return {
        slot:index + 1,
        name,
        position:String(member.position || "TEAM MEMBER").trim().slice(0, 24) || "TEAM MEMBER",
        mediaUrl:String(member.mediaUrl || member.enhancedMediaUrl || member.originalMediaUrl || "").trim().slice(0, 1800),
        initials:name.split(/\s+/).map(part => part[0] || "").join("").slice(0, 2).toUpperCase() || String(index + 1)
      };
    });
  }

  function footballStadiumMessageRows(value = "") {
    const clean = glyphSlice(cleanBoardText(value || "TONIGHT, WE TAKE THE FIELD TOGETHER"), 0, 60);
    const rows = [];
    pushWrapped(rows, clean.split(" ").filter(Boolean), 3, 20);
    return rows.slice(0, 3);
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

  function renderFootballTeamIntro({canvas, center, mediaSlot, mainText, subText, data}) {
    const members = normalizedFootballTeamMembers(data);
    const stadiumMessageRows = footballStadiumMessageRows(data.stadiumMessage);
    canvas.classList.add("football-team-intro");
    center.className = "display-center football-team-intro-layout";
    mediaSlot.classList.remove("hidden");
    const playerImage = member => member.mediaUrl
      ? `<img data-media-url="${esc(member.mediaUrl)}" data-initials="${esc(member.initials)}" alt="${esc(member.name)}">`
      : `<span class="football-player-initials">${esc(member.initials)}</span>`;
    mediaSlot.innerHTML = `
      <section class="football-intro-stage" aria-label="20-second Zebbies four-player football introduction">
        <div class="football-stadium-lights" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="football-field-lines" aria-hidden="true"></div>
        <div class="football-opening">
          <span>ZEBBIES GARDEN PRESENTS</span>
          <strong>${esc(mainText || "ZEBBIES ALL-STARS")}</strong>
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
        <div class="football-final-lineup">
          <header><span>ZEBBIES ALL-STARS</span><strong>${esc(mainText || "GAME NIGHT LINEUP")}</strong></header>
          <div class="football-final-grid">${members.map((member, index) => `<article>
            <div class="football-final-photo">${playerImage(member)}</div>
            <b>${esc(member.name)}</b><small>${esc(member.position)}</small><em>0${index + 1}</em>
          </article>`).join("")}</div>
        </div>
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
    const isClassicBoard = templateId === "blackwhite" || t.id === "blackwhite";
    const isFootballTeamIntro = templateId === "zebbiesFootballTeamIntro" || t.layout === "football-team-intro";
    const mainSize = Math.min(40, Math.max(4, Number(data.mainTextSizePercent || t.mainTextSizePercent || 16)));
    const subSize = Math.min(20, Math.max(2, Number(data.subTextSizePercent || t.subTextSizePercent || 6)));
    const mainLimit = Math.max(1, Number(data.maxMainCharacters || t.maxMainCharacters || 60));
    const subLimit = Math.max(0, Number(data.maxSubCharacters ?? t.maxSubCharacters ?? 60));
    const canvas = byId("displayCanvas");
    canvas.className = "display-canvas";
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
    if (isClassicBoard) canvas.classList.add("classic-board-template");
    const backgroundUrl = data.backgroundUrl || "";
    const backgroundColor = data.backgroundColor || "";
    const backgroundGradient = data.backgroundGradient || "";
    canvas.style.backgroundImage = "";
    canvas.style.background = "";
    canvas.style.backgroundSize = "";
    canvas.style.backgroundPosition = "";
    if (backgroundUrl) {
      canvas.style.backgroundImage = `url("${backgroundUrl.replace(/"/g, "%22")}")`;
      canvas.style.backgroundSize = "cover";
      canvas.style.backgroundPosition = "center";
    }
    else if (backgroundGradient && /^linear-gradient\(/.test(backgroundGradient)) canvas.style.background = backgroundGradient;
    else if (backgroundColor && /^#[0-9a-fA-F]{6}$/.test(backgroundColor)) canvas.style.background = backgroundColor;
    const staleZebbiesDefault = value => {
      const text = String(value || "").toUpperCase().replace(/\s+/g, " ").trim();
      return locationId !== "zebbies-garden-washington-dc" && /^USE SHOUT\s*OUT/.test(text) && /ZEBBIES/.test(text);
    };
    const locationDefaultMain = clubDefaultMainText(loc);
    const mainText = String((!data.mainText || staleZebbiesDefault(data.mainText)) ? locationDefaultMain : data.mainText).slice(0, mainLimit);
    const subText = String(data.subText || t.defaultSub || "").slice(0, subLimit);
    byId("displayBrand").textContent = "";
    const center = document.querySelector(".display-center");
    const mediaSlot = byId("mediaSlot");
    if (center) center.className = "display-center";
    byId("displayMain").className = "";
    byId("displaySub").className = "";
    if (isFootballTeamIntro && center && mediaSlot) {
      renderFootballTeamIntro({canvas, center, mediaSlot, mainText, subText, data});
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
    if (isClassicBoard) {
      const rows = classicBoardRows(mainText);
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
      byId("displayMain").textContent = mainText;
      byId("displaySub").textContent = subText;
    }
  }
  window.renderShoutOutDisplay = render;

  document.addEventListener("DOMContentLoaded", async () => {
    await persistenceReady;
    locationId = await resolveDisplayLocationId(locationId);
    loc = getStaticLocation(locationId);
    if (qs("main","")) {
      render({
        mainText: qs("main"),
        subText: qs("sub"),
        template: qs("template","neon"),
        mediaUrl: qs("media",""),
        mediaType: qs("mediaType",""),
        mediaFit: qs("mediaFit","contain"),
        screenFormatId: qs("screenFormatId",""),
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
      renderTimedLiveContent(doc.exists ? doc.data() : defaultClubDisplayPayload());
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
