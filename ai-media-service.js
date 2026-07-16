/* FLOQR ShoutOut media AI readiness v28.84: Gemini callable image editing, nested filters, safety metadata, first-7-second video trim. */
(function () {
  "use strict";

  const MAX_VIDEO_SECONDS = 7;
  const GEMINI_MEDIA_TIMEOUT_MS = 45000;
  const FILTERS = {
    neon: {
      label:"Neon",
      css:"saturate(1.55) contrast(1.16) brightness(1.04) hue-rotate(10deg)",
      type:"neon",
      definition:"Bright nightclub color, stronger glow, and higher contrast for LED-friendly energy.",
      prompt:"Create a vibrant neon nightlife enhancement with electric color, clear faces, and LED-safe contrast."
    },
    vip: {
      label:"VIP Style",
      css:"sepia(.20) saturate(1.24) contrast(1.14) brightness(1.06)",
      type:"vip",
      definition:"Warm luxury polish with black-and-gold richness for VIP table moments.",
      prompt:"Create a refined VIP luxury enhancement with warm gold light, polished contrast, and natural skin tones."
    },
    club: {
      label:"Club Ready",
      css:"brightness(1.08) contrast(1.20) saturate(1.30)",
      type:"club-ready",
      definition:"Improves dark nightlife photos with punchier lighting and clearer contrast.",
      prompt:"Make this ShoutOut media club-ready with improved low-light clarity, balanced contrast, and lively color."
    },
    blackwhite: {
      label:"B&W",
      css:"grayscale(1) contrast(1.20) brightness(1.03)",
      type:"black-white",
      definition:"Classic black-and-white treatment with stronger definition and clean highlights.",
      prompt:"Create a classic black-and-white enhancement with crisp contrast and clean highlights."
    },
    warm: {
      label:"Warm",
      css:"sepia(.18) saturate(1.16) brightness(1.07)",
      type:"warm",
      definition:"Soft warm color and gentle brightness for flattering portraits and celebration media.",
      prompt:"Create a warm flattering enhancement with soft golden light and natural skin tones."
    },
    original: {
      label:"Original",
      css:"none",
      type:"none",
      definition:"Keeps the uploaded image or video unchanged.",
      prompt:"Use the original media without AI image/video enhancement."
    }
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

  function controlsCard() {
    return editor()?.querySelector(".composer > .card:not(.preview)") || editor()?.querySelector(".composer .card") || editor();
  }

  function placePanel(panel) {
    const host = controlsCard();
    if (!host || !panel) return;
    const mediaCard = byId("shoutoutMediaUpload")?.closest(".media-upload-card");
    const submit = byId("submitShoutoutBtn");
    const anchor = mediaCard && mediaCard.parentElement === host
      ? mediaCard.nextSibling
      : submit && submit.parentElement === host
        ? submit
        : null;
    if (panel.parentElement !== host || panel.previousElementSibling !== mediaCard) {
      host.insertBefore(panel, anchor || null);
    }
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

  function infoPopout(label, text, extraClass = "") {
    return `<details class="info-popout ${extraClass}"><summary>${esc(label)}</summary><div class="info-popout-bubble">${esc(text)}</div></details>`;
  }

  function setVideoNotice(value, label = "Video trim warning") {
    const notice = byId("videoTrimNotice");
    if (notice) notice.innerHTML = value ? infoPopout(label, value, "warning-popout") : "";
  }

  function showFilterBubble(key) {
    const item = FILTERS[key] || FILTERS.original;
    const bubble = byId("aiMediaFilterBubble");
    if (!bubble) return;
    bubble.textContent = item.definition || "";
    bubble.classList.remove("hidden");
    clearTimeout(showFilterBubble.timer);
    showFilterBubble.timer = setTimeout(() => bubble.classList.add("hidden"), 3600);
  }

  function setActiveCommand(key) {
    const panel = byId("aiMediaPanel");
    if (!panel) return;
    panel.querySelectorAll("[data-ai-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.aiFilter === key);
    });
  }

  function setHidden(id, value) {
    const el = byId(id);
    if (el) el.value = value == null ? "" : String(value);
  }

  function ensurePanel() {
    const host = editor();
    const existing = byId("aiMediaPanel");
    if (!host) return;
    if (existing) {
      placePanel(existing);
      return;
    }
    const panel = document.createElement("div");
    panel.id = "aiMediaPanel";
    panel.className = "ai-media-panel";
    panel.innerHTML = `
      <h2>Ai Image/Video Enhancement</h2>
      ${infoPopout("How AI enhancement works", "Gemini image editing runs through Firebase Functions when deployed. Browser previews remain the safe fallback and keep the original upload intact unless Gemini returns an enhanced file.", "ai-media-help-popout")}
      <button id="aiMediaEnhancementToggle" class="ai-media-enhancement-toggle" type="button" data-ai-enhancement-toggle aria-expanded="false">Ai Image/Video Enhancement</button>
      <div id="aiMediaCommandMenu" class="ai-media-command-menu hidden">
        ${Object.entries(FILTERS).map(([key, item]) => `<button type="button" data-ai-filter="${esc(key)}">${esc(item.label)}</button>`).join("")}
      </div>
      <p id="aiMediaFilterBubble" class="ai-media-filter-bubble hidden"></p>
      <button id="aiApplyFilterBtn" class="primary ai-apply-filter-btn" type="button" data-ai-apply-filter>Apply filter</button>
      <div class="button-row">
        <button type="button" data-ai-trim>Trim Video to 7 Seconds</button>
      </div>
      <input id="aiSelectedMediaVersion" type="hidden" value="original"/>
      <input id="aiEnhancementType" type="hidden" value="none"/>
      <input id="aiEnhancementPrompt" type="hidden" value=""/>
      <input id="aiOriginalDuration" type="hidden" value=""/>
      <input id="aiTrimmedDuration" type="hidden" value=""/>
      <input id="aiTrimStart" type="hidden" value="0"/>
      <input id="aiTrimEnd" type="hidden" value=""/>
      <p id="aiMediaStatus" class="status"></p>`;
    placePanel(panel);
    panel.addEventListener("click", event => {
      const toggleBtn = event.target.closest("[data-ai-enhancement-toggle]");
      if (toggleBtn) {
        const menu = byId("aiMediaCommandMenu");
        const open = menu?.classList.toggle("hidden") === false;
        toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      }
      const filterBtn = event.target.closest("[data-ai-filter]");
      if (filterBtn) applyFilter(filterBtn.dataset.aiFilter);
      if (event.target.closest("[data-ai-apply-filter]")) applySelectedFilter();
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
    setVideoNotice(trimWarning);
    setPanelStatus(trimWarning);
  }

  function applyFilter(key) {
    selectedFilter = FILTERS[key] ? key : "original";
    const media = previewMediaEl();
    if (media) media.style.filter = FILTERS[selectedFilter].css;
    setActiveCommand(selectedFilter);
    showFilterBubble(selectedFilter);
    if (isSelectedLongVideo()) {
      markTrimmed(currentDuration, {
        prompt: `${FILTERS[selectedFilter].prompt || FILTERS[selectedFilter].label}; Trim Video to 7 Seconds`,
        notes: "Video exceeded 7 seconds; first 7 seconds selected for trim.",
        mode: trimProcessingMode || "metadata-pending"
      });
      return;
    }
    setHidden("aiEnhancementType", FILTERS[selectedFilter].type);
    setHidden("aiEnhancementPrompt", FILTERS[selectedFilter].prompt || FILTERS[selectedFilter].label);
    setHidden("aiSelectedMediaVersion", selectedFilter === "original" ? "original" : "enhanced");
    setPanelStatus(selectedFilter === "original" ? "Original media selected." : `${FILTERS[selectedFilter].label} preview applied. Tap Apply filter to keep this enhancement metadata for upload.`);
  }

  function applySelectedFilter() {
    const file = selectedFile();
    if (!file) {
      setPanelStatus("Choose an image or video before applying a filter.");
      return;
    }
    applyFilter(selectedFilter || "original");
    const item = FILTERS[selectedFilter] || FILTERS.original;
    setPanelStatus(selectedFilter === "original"
      ? "Original selected. FLOQR will upload the media without enhancement metadata."
      : `${item.label} applied. Gemini receives this enhancement prompt when image editing is configured; otherwise FLOQR saves the selected filter metadata.`);
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
          setVideoNotice(`Video duration ${currentDuration.toFixed(1)} seconds. Ready.`, "Video details");
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

  function functionsClient() {
    if (!window.firebase?.app || !window.firebase?.functions) return null;
    const region = window.FLOQR_AI_FUNCTIONS_REGION || "";
    return region ? firebase.app().functions(region) : firebase.app().functions();
  }

  function withTimeout(promise, timeoutMs, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs))
    ]);
  }

  async function requestGeminiImageEnhancement(uploadResult, referenceNumber) {
    const file = selectedFile();
    const selectedVersion = byId("aiSelectedMediaVersion")?.value || "original";
    if (!file || !file.type.startsWith("image/") || selectedVersion !== "enhanced") return null;
    if (!uploadResult?.mediaStoragePath) return null;
    const client = functionsClient();
    if (!client) {
      safetyStatus = "flagged";
      safetyNotes = "Gemini image editing unavailable: Firebase Functions SDK is not loaded.";
      return null;
    }
    const functionName = window.FLOQR_AI_GEMINI_MEDIA_FUNCTION || "aiEnhanceShoutOutMedia";
    const callable = client.httpsCallable(functionName);
    setPanelStatus("Sending image to Gemini for enhancement...");
    try {
      const result = await withTimeout(callable({
        mediaStoragePath:uploadResult.mediaStoragePath,
        referenceNumber,
        prompt:byId("aiEnhancementPrompt")?.value || FILTERS[selectedFilter]?.label || "Improve this ShoutOut image.",
        enhancementType:byId("aiEnhancementType")?.value || FILTERS[selectedFilter]?.type || "image-edit"
      }), GEMINI_MEDIA_TIMEOUT_MS, "Gemini image enhancement");
      const data = result?.data || {};
      if (data.status !== "enhanced" || !data.enhancedMediaUrl) {
        throw new Error(data.message || "Gemini did not return an enhanced image URL.");
      }
      safetyStatus = data.aiMediaSafetyStatus || "passed";
      safetyNotes = data.aiMediaSafetyNotes || "Gemini image edit completed.";
      setPanelStatus("Gemini enhanced image ready. Enhanced version selected.");
      return {
        ...uploadResult,
        mediaUrl:data.enhancedMediaUrl,
        mediaType:"image",
        mediaStoragePath:data.enhancedMediaStoragePath || uploadResult.mediaStoragePath,
        originalMediaUrl:uploadResult.mediaUrl,
        originalMediaStoragePath:uploadResult.mediaStoragePath,
        enhancedMediaUrl:data.enhancedMediaUrl,
        enhancedMediaStoragePath:data.enhancedMediaStoragePath || "",
        selectedMediaVersion:"enhanced",
        aiEnhancementApplied:true,
        aiEnhancementProvider:data.provider || "gemini",
        aiEnhancementModel:data.model || "",
        aiMediaSafetyStatus:safetyStatus,
        aiMediaSafetyNotes:safetyNotes
      };
    } catch (error) {
      safetyStatus = "flagged";
      safetyNotes = `Gemini image editing fallback used: ${error?.message || error}`;
      setPanelStatus(safetyNotes);
      return null;
    }
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
    const enhanced = meta.selectedMediaVersion === "enhanced";
    return {
      ...result,
      originalMediaUrl: result.originalMediaUrl || (trimmed ? (overrides.originalMediaUrl || "") : result.mediaUrl),
      enhancedMediaUrl: result.enhancedMediaUrl || (enhanced ? result.mediaUrl : ""),
      trimmedMediaUrl: trimmed ? result.mediaUrl : "",
      selectedMediaVersion: meta.selectedMediaVersion,
      aiEnhancementApplied: meta.aiEnhancementApplied,
      aiEnhancementType: meta.aiEnhancementType,
      aiEnhancementPrompt: meta.aiEnhancementPrompt,
      aiEnhancementProvider: result.aiEnhancementProvider || "",
      aiEnhancementModel: result.aiEnhancementModel || "",
      originalMediaStoragePath: result.originalMediaStoragePath || "",
      enhancedMediaStoragePath: result.enhancedMediaStoragePath || "",
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
      const geminiResult = await requestGeminiImageEnhancement(result, referenceNumber);
      if (geminiResult) return decorateResult(geminiResult);
      return decorateResult(result, {
        trimProcessingMode,
        trimWarning,
        originalMediaUploaded:true
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

  function resetSelection() {
    selectedFilter = "original";
    currentDuration = 0;
    safetyStatus = "notChecked";
    safetyNotes = "";
    trimProcessingMode = "";
    trimWarning = "";
    ["aiSelectedMediaVersion","aiEnhancementType","aiEnhancementPrompt","aiOriginalDuration","aiTrimmedDuration","aiTrimStart","aiTrimEnd"].forEach(id => setHidden(id, id === "aiTrimStart" ? 0 : ""));
    setHidden("aiSelectedMediaVersion", "original");
    setHidden("aiEnhancementType", "none");
    setActiveCommand("original");
    byId("aiMediaFilterBubble")?.classList.add("hidden");
    setVideoNotice("");
    setPanelStatus("Media removed.");
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
    trimVideoToFirstSevenSeconds,
    resetSelection
  };
  document.addEventListener("DOMContentLoaded", boot);
})();
