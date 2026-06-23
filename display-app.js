/* display-app.js v19 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  if (!window.firebaseConfig) { byId("displayMain").textContent = "CONFIG ERROR"; byId("displaySub").textContent = "firebase-config.js missing"; return; }
  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.firestore();
  const locationId = qs("location", qs("club", "zebbies-garden-washington-dc"));
  const loc = window.SHOUTOUT_CLUB_LOCATIONS[locationId] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  const templates = window.SHOUTOUT_TEMPLATES || {};

  function cleanBoardText(value) {
    return String(value || "").toUpperCase().replace(/[^\w\s&'-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function pushWrapped(rows, words, maxRows, maxChars) {
    let line = "";
    words.forEach(word => {
      if (!word) return;
      if (word.length > maxChars) {
        if (line && rows.length < maxRows) rows.push(line);
        line = "";
        for (let i = 0; i < word.length && rows.length < maxRows; i += maxChars) rows.push(word.slice(i, i + maxChars));
        return;
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length <= maxChars) line = next;
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
    const attribution = cleanBoardText(subText).slice(0, maxChars);
    const availableRows = attribution ? 2 : maxRows;
    const words = cleanBoardText(mainText).slice(0, 36).split(" ").filter(Boolean);
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
    const longest = Math.max(...rows.map(x => x.length), 1);
    const rowLen = Math.max(row.length, longest);
    const maxPx = rowLen <= 5 ? 118 : rowLen <= 8 ? 106 : rowLen <= 10 ? 96 : rowLen <= 12 ? 88 : rowLen <= 16 ? 72 : 58;
    const vw = rowLen <= 8 ? 8.6 : rowLen <= 12 ? 7.4 : rowLen <= 16 ? 6.2 : 5.2;
    return `--fit-size:clamp(38px,${vw}vw,${maxPx}px)`;
  }

  function render(data) {
    const templateId = data.template || "neon";
    const t = templates[templateId] || templates.neon || {};
    const isClassicBoard = templateId === "blackwhite" || t.id === "blackwhite";
    const canvas = byId("displayCanvas");
    canvas.className = "display-canvas";
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
    if (isClassicBoard) canvas.classList.add("classic-board-template");
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

  document.addEventListener("DOMContentLoaded", () => {
    if (qs("main","")) {
      render({ mainText: qs("main"), subText: qs("sub"), template: qs("template","neon"), mediaUrl: qs("media",""), mediaType: qs("mediaType",""), locationName: loc.locationName });
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
};
})();
