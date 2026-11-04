#!/usr/bin/env node
"use strict";
const fs = require("fs");
const file = "display-app.js";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("backgroundUrlByFormat")) {
  const needle = '    const backgroundUrl = data.backgroundUrl || t.defaultBackgroundUrl || "";';
  const insert = `    const formatBackgroundUrl = (t.backgroundUrlByFormat && (t.backgroundUrlByFormat[screenFormatId] || t.backgroundUrlByFormat[String(screenFormatId || "").replace(/^p125-/, "led-")])) || "";
    const backgroundUrl = data.backgroundUrl || formatBackgroundUrl || t.defaultBackgroundUrl || "";`;
  if (!s.includes(needle)) throw new Error("backgroundUrl needle missing");
  s = s.replace(needle, insert);
}

if (!s.includes("isBallerCard")) {
  const needle = '    const isChristine = templateId === "christine" || t.id === "christine" || t.floqrCardHandleLoop === true || t.loopMediaWithText === true;';
  const insert = needle + `
    const isBallerCard = t.ballerCard === true || /\\bballer-card\\b/.test(String(t.className || "")) || ["blackCard","ballersAlert","blackCardAmex","ballersAlertAmex"].includes(templateId);
    const isBallerAlert = isBallerCard && (t.ballerAlert === true || /\\bballer-alert\\b/.test(String(t.className || "")) || templateId === "ballersAlert" || templateId === "ballersAlertAmex");`;
  if (!s.includes(needle)) throw new Error("isChristine needle missing");
  s = s.replace(needle, insert);
}

{
  const from = `    const mediaUrl = safeMediaUrl(data.mediaUrl);
    const mediaType = data.mediaType || "";
    const usesSplitMedia = t.layout === "split-media" || (t.supportsMedia && mediaUrl);`;
  const to = `    const mediaUrl = safeMediaUrl(data.mediaUrl);
    const mediaType = data.mediaType || "";
    const usesSplitMedia = !isBallerCard && (t.layout === "split-media" || (t.supportsMedia && mediaUrl));`;
  if (!s.includes(from)) throw new Error("usesSplitMedia needle missing");
  s = s.replace(from, to);
}

if (!s.includes("baller-face-medallion-slot")) {
  const from = `    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
    if (isSoccerJersey) {`;
  const to = `    } else if (isBallerAlert) {
      mediaSlot.classList.remove("hidden");
      mediaSlot.dataset.ballerFace = "baller-face-medallion-slot";
      if (mediaUrl) {
        const isVideo = mediaType === "video" || (!mediaType && /\\.(mp4|webm|ogg|mov)(\\?|$)/i.test(mediaUrl));
        mediaSlot.innerHTML = isVideo
          ? "<video src=\\"" + esc(mediaUrl) + "\\" autoplay muted loop playsinline></video>"
          : "<img src=\\"" + esc(mediaUrl) + "\\" alt=\\"Cardholder face\\">";
        const mediaElement = mediaSlot.querySelector("img,video");
        if (mediaElement) {
          mediaElement.style.objectFit = "cover";
          mediaElement.style.objectPosition = "center 18%";
        }
      } else {
        mediaSlot.innerHTML = '<div class="media-placeholder">FACE</div>';
      }
    } else {
      mediaSlot.classList.add("hidden");
      mediaSlot.innerHTML = "";
    }
    if (isBallerCard) {
      stopHeistIdentityCycle();
      stopHeistPhaseTimers();
      hideHeistBrandSlide();
      canvas.classList.add("baller-card");
      if (isBallerAlert) canvas.classList.add("baller-alert");
      if (center) {
        center.classList.remove("split-media-layout");
        center.classList.add("baller-card-center");
      }
      byId("displayMain").className = "baller-cardholder-name";
      byId("displaySub").className = "baller-company-name";
      byId("displayMain").textContent = glyphSlice(cleanDisplayText(mainText || data.mainText || ""), 0, mainLimit).toUpperCase();
      byId("displaySub").textContent = glyphSlice(cleanDisplayText(subText || data.subText || data.ballerCompany || ""), 0, subLimit).toUpperCase();
      byId("displayMain").style.setProperty("font-size", Math.min(7, Math.max(3.2, mainSize)) + "vh", "important");
      byId("displaySub").style.setProperty("font-size", Math.min(5, Math.max(2.4, subSize)) + "vh", "important");
      const rail = byId("displayIdentityRail");
      if (rail) {
        rail.className = "display-identity-rail hidden";
        rail.innerHTML = "";
      }
      markDisplayReady();
      return;
    }
    if (isSoccerJersey) {`;
  if (!s.includes(from)) throw new Error("soccer branch needle missing");
  s = s.replace(from, to);
}

fs.writeFileSync(file, s);
console.log("display-app.js patched");
