#!/usr/bin/env node
"use strict";
const fs = require("fs");
const file = "patron-app.js";
let s = fs.readFileSync(file, "utf8");

function mustInclude(needle, label) {
  if (!s.includes(needle)) throw new Error("missing needle: " + label);
}

if (!s.includes("function isBallerCardTemplate")) {
  const needle = `  function isSoccerJerseyTemplate(templateId = selectedTemplate) {
    const id = String(templateId || selectedTemplate || "");
    const t = getTemplate(id);`;
  mustInclude(needle, "isSoccerJerseyTemplate");
  s = s.replace(needle, `  const BALLER_COMPANY_PRESETS = {
    "were-outside": "WE'RE OUTSIDE LLC",
    "bad-boy": "Bad Boy Inc.",
    "baddbches": "BaddB$ches Only Corp"
  };
  function isBallerCardTemplate(id = selectedTemplate) {
    const t = getTemplate(id);
    if (t?.ballerCard === true) return true;
    return ["blackCard", "ballersAlert", "blackCardAmex", "ballersAlertAmex"].includes(String(id || t?.id || ""));
  }
  function isBallerAlertTemplate(id = selectedTemplate) {
    const t = getTemplate(id);
    if (!isBallerCardTemplate(id)) return false;
    return t?.ballerAlert === true || t?.requiresFacePhoto === true || String(id || t?.id || "") === "ballersAlert" || String(id || t?.id || "") === "ballersAlertAmex";
  }
  function isMasterAdminViewer() {
    const services = window.FLOQRFeatureServices;
    if (services?.getViewer?.()?.isMasterAdmin === true) return true;
    const g = window.FLOQRFeatureGates;
    if (g?.isMasterAdminEmail?.(currentUser) || g?.isSuperAdmin?.(currentUser, cachedUserProfile)) return true;
    return false;
  }
  function ballerNameFromSource() {
    const source = byId("ballerNameSource")?.value || "displayName";
    const profile = cachedUserProfile || {};
    const emailName = String(currentUser?.email || "").split("@")[0] || "";
    const username = profile.username || emailName || currentUser?.displayName || "patron";
    if (source === "manual") return String(byId("ballerManualName")?.value || "").trim();
    if (source === "floqrHandle") return String(username).replace(/^@/, "").trim();
    if (source === "instagram") {
      const ig = String(profile.instagramHandle || profile.socialMediaHandles?.instagram || "").replace(/^@/, "").trim();
      return ig || String(username).replace(/^@/, "").trim();
    }
    return String(profile.displayName || currentUser?.displayName || username).trim();
  }
  function ballerCompanyFromFields() {
    const preset = byId("ballerCompanyPreset")?.value || "were-outside";
    if (preset === "custom") return String(byId("ballerCustomCompany")?.value || "").trim();
    return BALLER_COMPANY_PRESETS[preset] || BALLER_COMPANY_PRESETS["were-outside"];
  }
  function ballerCardPayloadFields() {
    if (!isBallerCardTemplate()) return {};
    const t = getTemplate();
    const formatId = byId("shoutoutScreenFormat")?.value || selectedScreenFormatId || "";
    const formatBg = (t.backgroundUrlByFormat && (t.backgroundUrlByFormat[formatId] || t.backgroundUrlByFormat[String(formatId).replace(/^p125-/, "led-")])) || "";
    const name = ballerNameFromSource();
    const company = ballerCompanyFromFields();
    return {
      ballerCard: true,
      ballerAlert: isBallerAlertTemplate(),
      ballerBrand: t.ballerBrand || (String(t.id || "").includes("Amex") ? "amex" : "ballers"),
      ballerNameSource: byId("ballerNameSource")?.value || "displayName",
      ballerCompanyPreset: byId("ballerCompanyPreset")?.value || "were-outside",
      ballerCompany: company,
      backgroundUrl: formatBg || t.defaultBackgroundUrl || "",
      mainText: name,
      subText: company
    };
  }
  function syncBallerCardFields() {
    const baller = isBallerCardTemplate();
    const alert = isBallerAlertTemplate();
    byId("ballerCardFields")?.classList.toggle("hidden", !baller);
    byId("ballerFaceHint")?.classList.toggle("hidden", !alert);
    byId("mainText")?.closest("label")?.classList.toggle("hidden", baller || (isSoccerJerseyTemplate() && !isNflDualJerseyTemplate()));
    if (baller) document.querySelector(".attribution-controls")?.classList.add("hidden");
    const source = byId("ballerNameSource")?.value || "displayName";
    byId("ballerManualNameWrap")?.classList.toggle("hidden", !baller || source !== "manual");
    const preset = byId("ballerCompanyPreset")?.value || "were-outside";
    byId("ballerCustomCompanyWrap")?.classList.toggle("hidden", !baller || preset !== "custom");
    if (!baller) return;
    const caps = templateDisplayCaps();
    const nameLimit = Math.max(1, Number(caps.main || caps.maxMainCharacters || 28));
    const companyLimit = Math.max(1, Number(caps.sub || caps.maxSubCharacters || 28));
    if (byId("ballerManualName")) byId("ballerManualName").maxLength = nameLimit;
    if (byId("ballerCustomCompany")) byId("ballerCustomCompany").maxLength = companyLimit;
    const name = String(ballerNameFromSource() || "").slice(0, nameLimit);
    const company = String(ballerCompanyFromFields() || "").slice(0, companyLimit);
    if (byId("mainText")) byId("mainText").value = name;
    if (byId("subText")) byId("subText").value = company;
    const mediaCard = byId("shoutoutMediaCard");
    if (mediaCard && alert) {
      const note = mediaCard.querySelector(".single-media-upload-note");
      if (note) note.textContent = "Face photo required — clear head-and-shoulders shot works best for the medallion.";
      const label = mediaCard.querySelector(".file-upload-label");
      if (label && label.childNodes[0]) label.childNodes[0].textContent = "Upload face photo ";
    }
  }
  async function maybeEnhanceBallerFace(uploadResult, referenceNumber) {
    if (!isBallerAlertTemplate() || !uploadResult?.mediaStoragePath) return uploadResult || {};
    if (!String(uploadResult.mediaType || "").startsWith("image") && uploadResult.mediaType && uploadResult.mediaType !== "image") {
      return uploadResult;
    }
    try {
      const client = firebase.app().functions(window.FLOQR_AI_FUNCTIONS_REGION || undefined);
      const callable = client.httpsCallable(window.FLOQR_AI_GEMINI_MEDIA_FUNCTION || "aiEnhanceShoutOutMedia");
      const result = await Promise.race([
        callable({
          mediaStoragePath: uploadResult.mediaStoragePath,
          referenceNumber,
          prompt: "Fit this face into a circular metal-card medallion.",
          enhancementType: "baller-face-medallion"
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini baller face timed out")), 45000))
      ]);
      const data = result?.data || {};
      if (data.status === "enhanced" && data.enhancedMediaUrl) {
        return {
          ...uploadResult,
          mediaUrl: data.enhancedMediaUrl,
          mediaType: "image",
          mediaStoragePath: data.enhancedMediaStoragePath || uploadResult.mediaStoragePath,
          originalMediaUrl: uploadResult.mediaUrl,
          originalMediaStoragePath: uploadResult.mediaStoragePath,
          enhancedMediaUrl: data.enhancedMediaUrl,
          enhancedMediaStoragePath: data.enhancedMediaStoragePath || "",
          selectedMediaVersion: "enhanced",
          aiEnhancementApplied: true,
          aiEnhancementType: "baller-face-medallion",
          aiEnhancementProvider: data.provider || "gemini",
          aiEnhancementModel: data.model || "",
          aiMediaSafetyStatus: data.aiMediaSafetyStatus || "passed",
          aiMediaSafetyNotes: data.aiMediaSafetyNotes || "Baller face medallion prepared."
        };
      }
    } catch (error) {
      console.warn("baller face Gemini fallback", error?.message || error);
    }
    return {
      ...uploadResult,
      aiEnhancementType: "none",
      aiMediaSafetyStatus: "fallback",
      aiMediaSafetyNotes: "Original face photo retained for medallion."
    };
  }
  ` + needle);
}

// Call syncBallerCardFields from syncSoccerJerseyFields start (and when not soccer)
{
  const needle = `  function syncSoccerJerseyFields() {
    const soccer = isSoccerJerseyTemplate();
    const nflDual = isNflDualJerseyTemplate();
    byId("soccerJerseyFields")?.classList.toggle("hidden", !soccer);`;
  mustInclude(needle, "syncSoccerJerseyFields");
  if (!s.includes("syncBallerCardFields();")) {
    s = s.replace(needle, `  function syncSoccerJerseyFields() {
    syncBallerCardFields();
    const soccer = isSoccerJerseyTemplate();
    const nflDual = isNflDualJerseyTemplate();
    byId("soccerJerseyFields")?.classList.toggle("hidden", !soccer);`);
  }
}

// Filter masterAdminOnly in renderTemplates official filter
{
  const needle = `.filter(record => String(record.data.status || "active") === "active" && window.FLOQRScreenDatapoints?.templateFitsVenue?.(record.data, location) !== false);`;
  mustInclude(needle, "official filter");
  if (!s.includes("masterAdminOnly")) {
    s = s.replace(needle, `.filter(record => String(record.data.status || "active") === "active" && window.FLOQRScreenDatapoints?.templateFitsVenue?.(record.data, location) !== false)
      .filter(record => record.data?.masterAdminOnly !== true || isMasterAdminViewer());`);
  }
}

// Preview payload: merge baller fields
{
  const needle = `    const jerseyPayload = soccerJerseyPayloadFields();
    const previewPayload = {
      mainText:fitTemplateText(byId("mainText")?.value.trim()||"SHOUTOUT!", "main"),
      subText:fitTemplateText(byId("subText")?.value.trim()||"", "sub"),`;
  mustInclude(needle, "previewPayload");
  if (!s.includes("ballerCardPayloadFields()")) {
    s = s.replace(needle, `    const jerseyPayload = soccerJerseyPayloadFields();
    const ballerPayload = ballerCardPayloadFields();
    const previewPayload = {
      mainText:fitTemplateText((ballerPayload.mainText || byId("mainText")?.value.trim()||"SHOUTOUT!"), "main"),
      subText:fitTemplateText((ballerPayload.subText || byId("subText")?.value.trim()||""), "sub"),`);
    s = s.replace(
      `      backgroundUrl:jerseyPayload.backgroundUrl || (isFootballTeamIntro() ? (backgroundPayload.backgroundUrl || selectedTemplateVariant?.backgroundUrl || "") : (selectedTemplateVariant?.backgroundUrl || "")),`,
      `      backgroundUrl:ballerPayload.backgroundUrl || jerseyPayload.backgroundUrl || (isFootballTeamIntro() ? (backgroundPayload.backgroundUrl || selectedTemplateVariant?.backgroundUrl || "") : (selectedTemplateVariant?.backgroundUrl || "")),`
    );
    s = s.replace(
      `      ...themePayload,
      ...jerseyPayload
    };`,
      `      ...themePayload,
      ...jerseyPayload,
      ...ballerPayload
    };`
  );
  }
}

// Submit: sync baller, require face, enhance, merge payload
{
  const needle = `      const uploadedMedia = !footballIntro && currentTemplateSupportsMedia() ? await uploadShoutoutMedia(referenceNumber) : {};`;
  mustInclude(needle, "uploadShoutoutMedia");
  if (!s.includes("maybeEnhanceBallerFace")) {
    s = s.replace(needle, `      if (isBallerCardTemplate()) syncBallerCardFields();
      if (isBallerAlertTemplate() && !saveOnly) {
        const existingFace = window.FLOQRSafeRender?.safeUrl(byId("shoutoutMediaUrl")?.value || byId("mediaUrl")?.value) || "";
        const hasFile = !!(byId("shoutoutMediaUpload")?.files?.[0]);
        if (!existingFace && !hasFile) {
          status.textContent = "Baller's Alert needs a clear face photo for the medallion.";
          byId("shoutoutMediaUpload")?.focus?.();
          return;
        }
      }
      if (isBallerCardTemplate() && !saveOnly) {
        const nameCheck = ballerNameFromSource();
        const companyCheck = ballerCompanyFromFields();
        if (!nameCheck) {
          status.textContent = "Enter or choose a cardholder name for the metal card.";
          (byId("ballerManualName") || byId("ballerNameSource"))?.focus?.();
          return;
        }
        if (!companyCheck) {
          status.textContent = "Choose a company line for the metal card.";
          (byId("ballerCustomCompany") || byId("ballerCompanyPreset"))?.focus?.();
          return;
        }
        if (getTemplate()?.masterAdminOnly === true && !isMasterAdminViewer()) {
          status.textContent = "This American Express preview template is Master Admin only.";
          return;
        }
      }
      let uploadedMedia = !footballIntro && currentTemplateSupportsMedia() ? await uploadShoutoutMedia(referenceNumber) : {};
      if (isBallerAlertTemplate() && uploadedMedia?.mediaStoragePath) {
        status.textContent = "Preparing face medallion…";
        uploadedMedia = await maybeEnhanceBallerFace(uploadedMedia, referenceNumber);
      }`);
  }
}

// Merge baller into submit payload — after jerseyFields
{
  const needle = `      const canonicalTemplateId = jerseyFields.template || selectedTemplate;
      const canonicalTemplate = getTemplate(canonicalTemplateId);
      const nflDualSubmit = isNflDualJerseyTemplate();
      const mainRaw = byId("mainText").value.trim();`;
  mustInclude(needle, "canonicalTemplateId");
  if (!s.includes("const ballerFields = ballerCardPayloadFields()")) {
    s = s.replace(needle, `      const ballerFields = ballerCardPayloadFields();
      const canonicalTemplateId = jerseyFields.template || selectedTemplate;
      const canonicalTemplate = getTemplate(canonicalTemplateId);
      const nflDualSubmit = isNflDualJerseyTemplate();
      const mainRaw = (ballerFields.mainText || byId("mainText").value.trim());`);
    // Patch the giant payload line to include baller fields and use baller subText
    s = s.replace(
      `...variantPayload, ...jerseyFields, mainText:fitTemplateText(nflDualSubmit ? mainRaw : (mainRaw||"SHOUTOUT!"),"main"), subText:fitTemplateText(byId("subText").value.trim()||"","sub"), ...mediaPayload,`,
      `...variantPayload, ...jerseyFields, ...ballerFields, mainText:fitTemplateText(nflDualSubmit ? mainRaw : (mainRaw||"SHOUTOUT!"),"main"), subText:fitTemplateText(ballerFields.subText || byId("subText").value.trim()||"","sub"), ...mediaPayload,`
    );
  }
}

// startAnother reset
{
  const needle = `if(byId("soccerNameSource"))byId("soccerNameSource").value="displayName"; if(byId("soccerTeamId"))byId("soccerTeamId").value=""; if(byId("nameShoutoutInput"))byId("nameShoutoutInput").value=""; syncAttribution(); syncSoccerJerseyFields();`;
  mustInclude(needle, "startAnother");
  if (!s.includes('byId("ballerNameSource")')) {
    s = s.replace(needle, `if(byId("soccerNameSource"))byId("soccerNameSource").value="displayName"; if(byId("soccerTeamId"))byId("soccerTeamId").value=""; if(byId("nameShoutoutInput"))byId("nameShoutoutInput").value=""; if(byId("ballerNameSource"))byId("ballerNameSource").value="displayName"; if(byId("ballerManualName"))byId("ballerManualName").value=""; if(byId("ballerCompanyPreset"))byId("ballerCompanyPreset").value="were-outside"; if(byId("ballerCustomCompany"))byId("ballerCustomCompany").value=""; syncAttribution(); syncSoccerJerseyFields();`);
  }
}

// Event listeners near soccer ones
{
  const needle = `    byId("soccerNameSource")?.addEventListener("change", () => { syncSoccerJerseyFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });`;
  mustInclude(needle, "soccerNameSource listener");
  if (!s.includes('byId("ballerNameSource")?.addEventListener')) {
    s = s.replace(needle, needle + `
    byId("ballerNameSource")?.addEventListener("change", () => { syncBallerCardFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });
    byId("ballerManualName")?.addEventListener("input", () => { syncBallerCardFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });
    byId("ballerCompanyPreset")?.addEventListener("change", () => { syncBallerCardFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });
    byId("ballerCustomCompany")?.addEventListener("input", () => { syncBallerCardFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });`);
  }
}

fs.writeFileSync(file, s);
console.log("patron-app.js patched");
