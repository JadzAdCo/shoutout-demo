
/* display-app.js v18 - Club-specific display only */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  if (!window.firebaseConfig) { byId("displayMain").textContent = "CONFIG ERROR"; byId("displaySub").textContent = "firebase-config.js missing"; return; }
  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.firestore();
  const clubId = qs("club", "zebbies-garden");
  const club = window.SHOUTOUT_CLUBS[clubId] || window.SHOUTOUT_CLUBS["zebbies-garden"];
  const templates = window.SHOUTOUT_TEMPLATES || {};

  function render(data) {
    const t = templates[data.template || "neon"] || templates.neon || {};
    const canvas = byId("displayCanvas");
    canvas.classList.remove("gold","ice","fire");
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
    byId("displayBrand").textContent = data.clubName ? `${data.clubName} x JADZ ADCO` : (club.brand || "JADZ ADCO");
    byId("displayMain").textContent = data.mainText || club.defaultMain || "USE SHOUT OUT";
    byId("displaySub").textContent = data.subText || "";
    const mediaSlot = byId("mediaSlot");
    if (data.mediaUrl) {
      mediaSlot.classList.remove("hidden");
      const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(data.mediaUrl);
      mediaSlot.innerHTML = isVideo ? `<video src="${esc(data.mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${esc(data.mediaUrl)}" alt="ShoutOut media">`;
    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (qs("main","")) {
      render({ mainText: qs("main"), subText: qs("sub"), template: qs("template","neon"), mediaUrl: qs("media",""), clubName: club.name });
      return;
    }
    db.collection("liveContent").doc(clubId).onSnapshot(doc => {
      render(doc.exists ? doc.data() : {clubName: club.name, mainText: club.defaultMain, subText: club.defaultSub, template: "neon"});
    }, e => render({mainText:"DISPLAY ERROR", subText:e.message, template:"fire", clubName: club.name}));
  });
})();
