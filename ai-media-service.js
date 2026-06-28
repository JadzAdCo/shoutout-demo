/* FLOQR ShoutOut media AI readiness: filters, safety metadata, first-7-second video trim. */
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
  let trimProcessingMode = "";
  let trimWarning = "";
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

  function setHidden(id, value) {
    const el = byId(id);
    if (el) el.value = value == null ? "" : String(value);
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

  function selectedFile() {
    const input = mediaInput();
    return input?.files?.[0] || null;
  }

  function isSelectedLongVideo() {
    const file = selectedFile();
    return !!file && file.type.startsWith("video/") && Number(currentDuration || 0) > MAX_VIDEO_SECONDS;
  }

  function markTrimmed(duration, options = {}) {
    const trimEnd = Math.min(Number(duration || currentDuration || MAX_VIDEO_SECONDS), MAX_VIDEO_SECONDS);
    setHidden("aiSelectedMediaVersion", "trimmed");
    setHidden("aiEnhancementType", "trim");
    setHidden("aiEnhancementPrompt", options.prompt || "Trim Video to 7 Seconds");
    setHidden("aiOriginalDuration", duration || currentDuration || "");
    setHidden("aiTrimStart", 0);
    setHidden("aiTrimEnd", trimEnd);
    setHidden("aiTrimmedDuration", trimEnd);
    safetyStatus = "passed";
    safetyNotes = options.notes || "Video will use only the first 7 seconds.";
    trimProcessingMode = options.mode || trimProcessingMode || "metadata-pending";
    trimWarning = options.warning || "This video is longer than 7 seconds. FLOQR will use only the first 7 seconds.";
    enforcePreviewTrimPlayback();
    setPanelStatus(trimWarning);
  }

  function applyFilter(key) {
    selectedFilter = FILTERS[key] ? key : "original";
    const media = previewMediaEl();
    if (media) media.style.filter = FILTERS[selectedFilter].css;
    if (isSelectedLongVideo()) {
      markTrimmed(currentDuration, {
        prompt: `${FILTERS[selectedFilter].label}; Trim Video to 7 Seconds`,
        notes: "Video exceeded 7 seconds; first 7 seconds selected for trim.",
        mode: trimProcessingMode || "metadata-pending"
      });
      return;
    }
    setHidden("aiEnhancementType", FILTERS[selectedFilter].type);
    setHidden("aiEnhancementPrompt", FILTERS[selectedFilter].label);
    setHidden("aiSelectedMediaVersion", selectedFilter === "original" ? "original" : "enhanced");
    setPanelStatus(selectedFilter === "original" ? "Original media selected." : `${FILTERS[selectedFilter].label} preview applied. The original file will be uploaded with enhancement metadata.`);
  }

  function setSelectedVersion(version) {
    if (isSelectedLongVideo()) {
      markTrimmed(currentDuration, {
        notes: "Video exceeded 7 seconds; full original playback is not allowed for ShoutOut display.",
        mode: trimProcessingMode || "metadata-pending"
      });
      return;
    }
    setHidden("aiSelectedMediaVersion", version === "enhanced" ? "enhanced" : "original");
    setPanelStatus(version === "enhanced" ? "Enhanced preview selected. Metadata will be saved with the ShoutOut." : "Original media selected.");
  }

  function trimVideoMetadataOnly() {
    const file = selectedFile();
    if (!file || !file.type.startsWith("video/")) {
      setPanelStatus("Choose a video before trimming.");
      return;
    }
    markTrimmed(currentDuration || MAX_VIDEO_SECONDS, {
      notes: currentDuration > MAX_VIDEO_SECONDS
        ? "Video exceeded 7 seconds; first 7 seconds selected for trim."
        : "Video is within 7 seconds; trim metadata is ready.",
      mode: currentDuration > MAX_VIDEO_SECONDS ? "metadata-pending" : "metadata-only",
      warning: currentDuration > MAX_VIDEO_SECONDS
        ? "Warning: this video is longer than 7 seconds. FLOQR will cut and use only the first 7 seconds."
        : "Video is within 7 seconds. Trim metadata is ready."
    });
  }

  function enforcePreviewTrimPlayback() {
    const media = previewMediaEl();
    if (!media || media.tagName !== "VIDEO") return;
    const end = Number(byId("aiTrimEnd")?.value || 0);
    if (!end || media.dataset.floqrTrimBound === "1") return;
    media.dataset.floqrTrimBound = "1";
    const start = Number(byId("aiTrimStart")?.value || 0);
    const loopTrim = () => {
      if (media.currentTime < start || media.currentTime >= end) {
        try { media.currentTime = start; } catch (e) {}
        media.play?.().catch(() => {});
      }
    };
    media.addEventListener("loadedmetadata", () => {
      try { media.currentTime = start; } catch (e) {}
    });
    media.addEventListener("timeupdate", loopTrim);
  }

  function inspectSelectedMedia() {
    const file = selectedFile();
    if (!file) return;
    safetyStatus = "passed";
    safetyNotes = "Browser checks passed. AI moderation is scaffolded for backend processing.";
    trimProcessingMode = "";
    trimWarning = "";
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
        setHidden("aiOriginalDuration", currentDuration || "");
        setHidden("aiTrimEnd", Math.min(currentDuration || MAX_VIDEO_SECONDS, MAX_VIDEO_SECONDS));
        if (currentDuration > MAX_VIDEO_SECONDS) {
          markTrimmed(currentDuration, {
            notes: "Video exceeded 7 seconds; first 7 seconds selected for trim.",
            mode: "metadata-pending",
            warning: `Warning: video is ${currentDuration.toFixed(1)} seconds. FLOQR will cut and use only the first 7 seconds.`
          });
        } else {
          setPanelStatus(`Video duration ${currentDuration.toFixed(1)}s. Ready.`);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        setPanelStatus("Video metadata could not be read. FLOQR will attempt safe upload metadata.");
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

  function chooseRecordingMimeType() {
    const options = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    return options.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function waitForEvent(target, eventName, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${eventName} timed out`));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        target.removeEventListener(eventName, onEvent);
        target.removeEventListener("error", onError);
      };
      const onEvent = event => {
        cleanup();
        resolve(event);
      };
      const onError = () => {
        cleanup();
        reject(new Error(`${eventName} failed`));
      };
      target.addEventListener(eventName, onEvent, {once:true});
      target.addEventListener("error", onError, {once:true});
    });
  }

  async function trimVideoToFirstSevenSeconds(file) {
    if (!file || !file.type.startsWith("video/") || !window.MediaRecorder) return null;
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    try {
      await waitForEvent(video, "loadedmetadata");
      if (video.currentTime !== 0) {
        video.currentTime = 0;
        await waitForEvent(video, "seeked", 2000);
      }
      const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream ? video.mozCaptureStream() : null;
      const mimeType = chooseRecordingMimeType();
      if (!stream || !mimeType) throw new Error("Browser video recording is not available.");
      const chunks = [];
      const recorder = new MediaRecorder(stream, {mimeType});
      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      const stopped = waitForEvent(recorder, "stop", MAX_VIDEO_SECONDS * 1000 + 4000);
      recorder.start();
      await video.play();
      await new Promise(resolve => setTimeout(resolve, MAX_VIDEO_SECONDS * 1000));
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      const blob = new Blob(chunks, {type:mimeType});
      if (!blob.size) throw new Error("Trimmed video output was empty.");
      const base = String(file.name || "shoutout-video").replace(/\.[a-z0-9]+$/i, "");
      return {
        blob,
        mimeType,
        fileName:`${base}-first-7-seconds.webm`
      };
    } catch (error) {
      console.warn("FLOQR client video trim unavailable:", error.message);
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function metadata() {
    const file = selectedFile();
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
      trimProcessingMode,
      trimWarning,
      mediaUploadedAt:window.firebase?.firestore?.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      _fileType:file?.type || "",
      _fileDuration:currentDuration
    };
  }

  async function prepareBeforeUpload() {
    const file = selectedFile();
    if (!file) return;
    if (file.type.startsWith("video/") && !currentDuration) {
      currentDuration = await readVideoDuration(file);
      setHidden("aiOriginalDuration", currentDuration || "");
    }
    if (file.type.startsWith("video/") && currentDuration > MAX_VIDEO_SECONDS) {
      markTrimmed(currentDuration, {
        notes: "Video exceeded 7 seconds; first 7 seconds selected for trim.",
        mode: "metadata-pending",
        warning: `Warning: video is ${currentDuration.toFixed(1)} seconds. FLOQR will cut and use only the first 7 seconds.`
      });
    }
  }

  async function uploadBlob(referenceNumber, blob, fileName, contentType) {
    if (!firebase.storage) {
      alert("Firebase Storage SDK is not loaded.");
      return {mediaUrl:"", mediaType:""};
    }
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Please sign in before uploading media.");
    const safeName = `${referenceNumber || Date.now()}-${fileName || "trimmed-video.webm"}`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `shoutouts/${user.uid}/${referenceNumber || Date.now()}/trimmed/${safeName}`;
    const ref = firebase.storage().ref().child(storagePath);
    await ref.put(blob, {contentType:contentType || blob.type || "video/webm"});
    const mediaUrl = await ref.getDownloadURL();
    const mediaUrlInput = byId("shoutoutMediaUrl");
    const mediaTypeInput = byId("shoutoutMediaType");
    if (mediaUrlInput) mediaUrlInput.value = mediaUrl;
    if (mediaTypeInput) mediaTypeInput.value = "video";
    return {
      mediaUrl,
      mediaType:"video",
      mediaFileName:fileName || safeName,
      mediaStoragePath:storagePath,
      mediaUploadedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function decorateResult(result, overrides = {}) {
    const meta = metadata();
    if (!result || !result.mediaUrl) return result;
    const trimmed = meta.selectedMediaVersion === "trimmed";
    return {
      ...result,
      originalMediaUrl: trimmed ? (overrides.originalMediaUrl || "") : result.mediaUrl,
      enhancedMediaUrl: meta.selectedMediaVersion === "enhanced" ? result.mediaUrl : "",
      trimmedMediaUrl: trimmed ? result.mediaUrl : "",
      selectedMediaVersion: meta.selectedMediaVersion,
      aiEnhancementApplied: meta.aiEnhancementApplied,
      aiEnhancementType: meta.aiEnhancementType,
      aiEnhancementPrompt: meta.aiEnhancementPrompt,
      originalDuration: meta.originalDuration,
      trimmedDuration: meta.trimmedDuration,
      trimStart: meta.trimStart,
      trimEnd: meta.trimEnd,
      aiMediaSafetyStatus: meta.aiMediaSafetyStatus,
      aiMediaSafetyNotes: meta.aiMediaSafetyNotes,
      trimProcessingMode: overrides.trimProcessingMode || meta.trimProcessingMode,
      trimWarning: overrides.trimWarning || meta.trimWarning,
      originalMediaUploaded: overrides.originalMediaUploaded !== undefined ? overrides.originalMediaUploaded : !trimmed
    };
  }

  function wrapUpload() {
    if (wrappedUpload || !window.jadzUploadSelectedShoutoutMedia) return;
    wrappedUpload = true;
    const original = window.jadzUploadSelectedShoutoutMedia;
    window.jadzUploadSelectedShoutoutMedia = async function floqrAiMediaUpload(referenceNumber) {
      await prepareBeforeUpload();
      const file = selectedFile();
      if (file?.type?.startsWith("video/") && currentDuration > MAX_VIDEO_SECONDS) {
        setPanelStatus("Creating a first-7-second video cut...");
        const trimmed = await trimVideoToFirstSevenSeconds(file);
        if (trimmed?.blob) {
          trimProcessingMode = "client-side-webm";
          trimWarning = "Video was longer than 7 seconds. FLOQR uploaded a first-7-second trimmed version.";
          setPanelStatus(trimWarning);
          const result = await uploadBlob(referenceNumber, trimmed.blob, trimmed.fileName, trimmed.mimeType);
          return decorateResult(result, {
            trimProcessingMode,
            trimWarning,
            originalMediaUploaded:false
          });
        }
        trimProcessingMode = "metadata-display-only";
        trimWarning = "Video was longer than 7 seconds. Browser trimming was unavailable, so FLOQR will display only the first 7 seconds. Configure backend AI/video trimming for a permanent file cut.";
        safetyNotes = trimWarning;
        setPanelStatus(trimWarning);
      }
      const result = await original(referenceNumber);
      return decorateResult(result, {
        trimProcessingMode,
        trimWarning,
        originalMediaUploaded:!(file?.type?.startsWith("video/") && currentDuration > MAX_VIDEO_SECONDS)
      });
    };
  }

  function bindInput() {
    const input = mediaInput();
    if (!input || input.dataset.aiMediaBound === "1") return;
    input.dataset.aiMediaBound = "1";
    input.addEventListener("change", () => {
      currentDuration = 0;
      selectedFilter = "original";
      trimProcessingMode = "";
      trimWarning = "";
      setHidden("aiSelectedMediaVersion", "original");
      setHidden("aiEnhancementType", "none");
      setHidden("aiEnhancementPrompt", "");
      setHidden("aiOriginalDuration", "");
      setHidden("aiTrimmedDuration", "");
      setHidden("aiTrimStart", 0);
      setHidden("aiTrimEnd", "");
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
    validateBeforeUpload:prepareBeforeUpload,
    trimVideoToFirstSevenSeconds
  };
  document.addEventListener("DOMContentLoaded", boot);
})();
