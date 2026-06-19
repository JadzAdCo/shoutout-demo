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

  function render(data) {
    const t = templates[data.template || "neon"] || templates.neon || {};
    const canvas = byId("displayCanvas");
    canvas.classList.remove("gold","ice","fire");
    if (t.className && t.className !== "neon") canvas.classList.add(t.className);
    byId("displayBrand").textContent = data.locationName ? `${data.locationName} x JADZ ADCO` : (loc.brand || "JADZ ADCO");
    byId("displayMain").textContent = data.mainText || loc.defaultMain || "USE SHOUT OUT";
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
      render({ mainText: qs("main"), subText: qs("sub"), template: qs("template","neon"), mediaUrl: qs("media",""), locationName: loc.locationName });
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
