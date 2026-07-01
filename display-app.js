/* display-app.js v28.73 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  if (!window.firebaseConfig) { byId("displayMain").textContent = "CONFIG ERROR"; byId("displaySub").textContent = "firebase-config.js missing"; return; }
  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.firestore();
  const requestedLocationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  let locationId = canonicalStaticLocationId(requestedLocationId);
  let loc = getStaticLocation(locationId);
  const templates = window.SHOUTOUT_TEMPLATES || {};

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

  function classicBoardRows(mainText, subText) {
    const maxRows = 3;
    const maxChars = 12;
    const attribution = glyphSlice(cleanBoardText(subText), 0, maxChars);
    const availableRows = attribution ? 2 : maxRows;
    const words = glyphSlice(cleanBoardText(mainText), 0, 36).split(" ").filter(Boolean);
    const rows = [];

    if (words[0] === "HAPPY" && words[1] === "BIRTHDAY") {
      rows.push("HAPPY", "BIRTHDAY");
      pushWrapped(rows, words.slice(2), availableRows, maxChars);
    } else {
      pushWrapped(rows, words, availableRows, maxChars);
    }

    if (attribution) rows.push(attribution);

    while (rows.length < maxRows) rows.push("");
    return rows.slice(0, maxRows);
  }

  function classicFitStyle(row, rows) {
    const longest = Math.max(...rows.map(x => glyphLen(x)), 1);
    const rowLen = Math.max(glyphLen(row), longest);
    const maxPx = rowLen <= 5 ? 118 : rowLen <= 8 ? 106 : rowLen <= 10 ? 96 : rowLen <= 12 ? 88 : rowLen <= 16 ? 72 : 58;
    const vw = rowLen <= 8 ? 8.6 : rowLen <= 12 ? 7.4 : rowLen <= 16 ? 6.2 : 5.2;
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

  function render(data) {
    const templateId = data.template || "neon";
    const t = templates[templateId] || templates.neon || {};
    const isClassicBoard = templateId === "blackwhite" || t.id === "blackwhite";
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
    const mainText = data.mainText || t.defaultMain || loc.defaultMain || "USE SHOUT OUT";
    const subText = data.subText || t.defaultSub || "";
    byId("displayBrand").textContent = "";
    const center = document.querySelector(".display-center");
    const mediaSlot = byId("mediaSlot");
    const mediaUrl = data.mediaUrl || "";
    const mediaType = data.mediaType || "";
    const usesSplitMedia = t.layout === "split-media" || (t.supportsMedia && mediaUrl);
    if (center) center.classList.toggle("split-media-layout", usesSplitMedia);
    if (usesSplitMedia) {
      mediaSlot.classList.remove("hidden");
      if (mediaUrl) {
        const isVideo = mediaType === "video" || (!mediaType && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl));
        mediaSlot.innerHTML = isVideo ? `<video src="${esc(mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(mediaUrl)}" alt="ShoutOut media">`;
        if (isVideo) enforceTrimmedVideoPlayback(mediaSlot.querySelector("video"), data);
      } else {
        mediaSlot.innerHTML = '<div class="media-placeholder">IMAGE / VIDEO</div>';
      }
    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
    if (isClassicBoard) {
      const rows = classicBoardRows(mainText, subText);
      byId("displayMain").classList.add("classic-bw-board");
      byId("displayMain").innerHTML = `<span class="classic-board-lines">${rows.map(row => `<b style="${classicFitStyle(row, rows)}">${esc(row)}</b>`).join("")}</span>`;
      byId("displaySub").classList.add("classic-bw-sub-hidden");
      byId("displaySub").textContent = "";
    } else {
      byId("displayMain").classList.remove("classic-bw-board");
      byId("displaySub").classList.remove("classic-bw-sub-hidden");
      byId("displayMain").textContent = mainText;
      byId("displaySub").textContent = subText;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    locationId = await resolveDisplayLocationId(locationId);
    loc = getStaticLocation(locationId);
    if (qs("main","")) {
      render({
        mainText: qs("main"),
        subText: qs("sub"),
        template: qs("template","neon"),
        mediaUrl: qs("media",""),
        mediaType: qs("mediaType",""),
        selectedMediaVersion: qs("selectedMediaVersion",""),
        trimStart: qs("trimStart",""),
        trimEnd: qs("trimEnd",""),
        trimmedDuration: qs("trimmedDuration",""),
        backgroundUrl: qs("backgroundUrl",""),
        backgroundColor: qs("backgroundColor",""),
        backgroundGradient: qs("backgroundGradient",""),
        locationName: loc.locationName
      });
      return;
    }
    db.collection("liveContent").doc(locationId).onSnapshot(doc => {
      render(doc.exists ? doc.data() : {locationName: loc.locationName, mainText: loc.defaultMain, subText: loc.defaultSub, template: "neon"});
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
