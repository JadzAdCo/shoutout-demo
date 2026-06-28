/* FLOQR ShoutOut media AI readiness: filters, safety metadata, 7-second video guard. */
(function () {
  "use strict";

  const MAX_VIDEO_SECONDS = 7;
  const FILTERS = {
    original: {label:"Use Original", css:"none", type:"none"},
    bright: {label:"Improve Lighting", css:"brightness(1.18) contrast(1.08)", type:"lighting"},
    contrast: {label:"Apply Filter", css:"contrast(1.2) saturate(1.08)", type:"filter"},
    neon: {label:"Neon", css:"saturate(1.45) contrast(1.15) hue-rotate(12deg)", type:"neon"},
    vip: {label:"Make VIP Style", css:"sepia(.2) saturate(1.25) contrast(1.12) brightness(1.06)", type:"vip"},
    club: {label:"Make Club Ready", css:"brightness(1.08) contrast(1.18) saturate(1.3)", type:"filter"},
    blackwhite: {label:"Black & White", css:"grayscale(1) contrast(1.18)", type:"filter"},
    warm: {label:"Warm", css:"sepia(.18) saturate(1.18) brightness(1.05)", type:"filter"}
  };

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  let selectedFilter = "original";
  let currentDuration = 0;
  let safetyStatus = "notChecked";
  let safetyNotes = "";
  let wrappedUpload = false;

  function editor() {
    return byId("editorPage");
  }

  function mediaInput() {
    return byId("shoutoutMediaUpload") || byId("shoutoutPhoto");
  }

  function previewMediaEl() {
    return byId("shoutoutMediaPreview")?.querySelector("img,video");
  }

  function setPanelStatus(value) {
    const el = byId("aiMediaStatus");
    if (el) el.textContent = value || "";
  }

  function ensurePanel() {
    const host = editor();
    if (!host || byId("aiMediaPanel")) return;
    const messageCard = host.querySelector(".composer .card") || host;
    const panel = document.createElement("div");
    panel.id = "aiMediaPanel";
    panel.className = "ai-media-panel";
    panel.innerHTML = `
      <h2>AI Media Enhancement</h2>
      <p class="sub small">AI-ready panel. Live Gemini/Firebase AI processing is disabled unless configured; browser filters are preview-only.</p>
      <div class="ai-filter-row">
        ${Object.entries(FILTERS).map(([key, item]) => `<button type="button" data-ai-filter="${esc(key)}">${esc(item.label)}</button>`).join("")}
        <button type="button" data-ai-trim>Trim Video to 7 Seconds</button>
      </div>
      <div class="button-row">
        <button type="button" data-ai-version="original">Use Original</button>
        <button type="button" data-ai-version="enhanced">Use Enhanced</button>
      </div>
      <input id="aiSelectedMediaVersion" type="hidden" value="original"/>
      <input id="aiEnhancementType" type="hidden" value="none"/>
      <input id="aiEnhancementPrompt" type="hidden" value=""/>
      <input id="aiOriginalDuration" type="hidden" value=""/>
      <input id="aiTrimmedDuration" type="hidden" value=""/>
      <input id="aiTrimStart" type="hidden" value="0"/>
      <input id="aiTrimEnd" type="hidden" value=""/>
      <p id="aiMediaStatus" class="status"></p>`;
    messageCard.appendChild(panel);
    panel.addEventListener("click", event => {
      const filterBtn = event.target.closest("[data-ai-filter]");
      if (filterBtn) applyFilter(filterBtn.dataset.aiFilter);
      const versionBtn = event.target.closest("[data-ai-version]");
      if (versionBtn) setSelectedVersion(versionBtn.dataset.aiVersion);
      if (event.target.closest("[data-ai-trim]")) trimVideoMetadataOnly();
    });
  }

  function applyFilter(key) {
    selectedFilter = FILTERS[key] ? key : "original";
    const media = previewMediaEl();
    if (media) media.style.filter = FILTERS[selectedFilter].css;
    byId("aiEnhancementType").value = FILTERS[selectedFilter].type;
    byId("aiEnhancementPrompt").value = FILTERS[selectedFilter].label;
    byId("aiSelectedMediaVersion").value = selectedFilter === "original" ? "original" : "enhanced";
    setPanelStatus(selectedFilter === "original" ? "Original media selected." : `${FILTERS[selectedFilter].label} preview applied. The original file will be uploaded with enhancement metadata.`);
  }

  function setSelectedVersion(version) {
    byId("aiSelectedMediaVersion").value = version === "enhanced" ? "enhanced" : "original";
    setPanelStatus(version === "enhanced" ? "Enhanced preview selected. Metadata will be saved with the ShoutOut." : "Original media selected.");
  }

  function trimVideoMetadataOnly() {
    const input = mediaInput();
    const file = input?.files?.[0];
    if (!file || !file.type.startsWith("video/")) {
      setPanelStatus("Choose a video before trimming.");
      return;
    }
    if (currentDuration > MAX_VIDEO_SECONDS) {
      setPanelStatus("Please upload a video that is 7 seconds or shorter.");
      return;
    }
    byId("aiSelectedMediaVersion").value = "trimmed";
    byId("aiEnhancementType").value = "trim";
    byId("aiTrimStart").value = "0";
    byId("aiTrimEnd").value = String(Math.min(currentDuration || MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS));
    byId("aiTrimmedDuration").value = String(Math.min(currentDuration || MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS));
    setPanelStatus("Video is within 7 seconds. Trim metadata is ready.");
  }

  function inspectSelectedMedia() {
    const input = mediaInput();
    const file = input?.files?.[0];
    if (!file) return;
    safetyStatus = "passed";
    safetyNotes = "Browser checks passed. AI moderation is scaffolded for backend processing.";
    if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) {
      safetyStatus = "flagged";
      safetyNotes = "Unsupported file type.";
      setPanelStatus(safetyNotes);
      return;
    }
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        currentDuration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        byId("aiOriginalDuration").value = String(currentDuration || "");
        byId("aiTrimEnd").value = String(Math.min(currentDuration || MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS));
        if (currentDuration > MAX_VIDEO_SECONDS) {
          safetyStatus = "flagged";
          safetyNotes = "Video is longer than 7 seconds.";
          setPanelStatus("Please upload a video that is 7 seconds or shorter.");
        } else {
          setPanelStatus(`Video duration ${currentDuration.toFixed(1)}s. Ready.`);
        }
      };
      video.src = url;
    } else {
      setPanelStatus("Photo ready. Choose an enhancement preview or use original.");
    }
  }

  function readVideoDuration(file) {
    return new Promise(resolve => {
      if (!file || !file.type.startsWith("video/")) {
        resolve(0);
        return;
      }
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      video.src = url;
    });
  }

  function metadata() {
    const input = mediaInput();
    const file = input?.files?.[0];
    const selectedVersion = byId("aiSelectedMediaVersion")?.value || "original";
    const enhancementType = byId("aiEnhancementType")?.value || "none";
    return {
      selectedMediaVersion:selectedVersion,
      aiEnhancementApplied:selectedVersion === "enhanced" || selectedVersion === "trimmed",
      aiEnhancementType:enhancementType,
      aiEnhancementPrompt:byId("aiEnhancementPrompt")?.value || "",
      originalDuration:Number(byId("aiOriginalDuration")?.value || 0) || null,
      trimmedDuration:Number(byId("aiTrimmedDuration")?.value || 0) || null,
      trimStart:Number(byId("aiTrimStart")?.value || 0) || 0,
      trimEnd:Number(byId("aiTrimEnd")?.value || 0) || null,
      aiMediaSafetyStatus:safetyStatus,
      aiMediaSafetyNotes:safetyNotes,
      mediaUploadedAt:window.firebase?.firestore?.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      _fileType:file?.type || "",
      _fileDuration:currentDuration
    };
  }

  async function validateBeforeUpload() {
    const input = mediaInput();
    const file = input?.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/") && !currentDuration) {
      currentDuration = await readVideoDuration(file);
      const originalDuration = byId("aiOriginalDuration");
      if (originalDuration) originalDuration.value = String(currentDuration || "");
    }
    if (file.type.startsWith("video/") && currentDuration > MAX_VIDEO_SECONDS) {
      throw new Error("Please upload a video that is 7 seconds or shorter.");
    }
  }

  function wrapUpload() {
    if (wrappedUpload || !window.jadzUploadSelectedShoutoutMedia) return;
    wrappedUpload = true;
    const original = window.jadzUploadSelectedShoutoutMedia;
    window.jadzUploadSelectedShoutoutMedia = async function floqrAiMediaUpload(referenceNumber) {
      await validateBeforeUpload();
      const result = await original(referenceNumber);
      const meta = metadata();
      if (!result || !result.mediaUrl) return result;
      return {
        ...result,
        originalMediaUrl: result.mediaUrl,
        enhancedMediaUrl: meta.selectedMediaVersion === "enhanced" ? result.mediaUrl : "",
        selectedMediaVersion: meta.selectedMediaVersion,
        aiEnhancementApplied: meta.aiEnhancementApplied,
        aiEnhancementType: meta.aiEnhancementType,
        aiEnhancementPrompt: meta.aiEnhancementPrompt,
        originalDuration: meta.originalDuration,
        trimmedDuration: meta.trimmedDuration,
        trimStart: meta.trimStart,
        trimEnd: meta.trimEnd,
        aiMediaSafetyStatus: meta.aiMediaSafetyStatus,
        aiMediaSafetyNotes: meta.aiMediaSafetyNotes
      };
    };
  }

  function bindInput() {
    const input = mediaInput();
    if (!input || input.dataset.aiMediaBound === "1") return;
    input.dataset.aiMediaBound = "1";
    input.addEventListener("change", () => {
      currentDuration = 0;
      selectedFilter = "original";
      setTimeout(() => {
        inspectSelectedMedia();
        applyFilter("original");
      }, 100);
    });
  }

  function boot() {
    setInterval(() => {
      ensurePanel();
      bindInput();
      wrapUpload();
    }, 1000);
  }

  window.FLOQRAIMedia = {
    MAX_VIDEO_SECONDS,
    FILTERS,
    getSelectedMediaMetadata:metadata,
    validateBeforeUpload
  };
  document.addEventListener("DOMContentLoaded", boot);
})();
