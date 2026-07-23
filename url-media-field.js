/* FLOQR: bind a local file picker to an existing media URL input. */
(function (global) {
  "use strict";

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function looksLikeVideo(url, file) {
    if (file && String(file.type || "").startsWith("video/")) return true;
    return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ""));
  }

  function looksLikeEmbed(url) {
    const text = String(url || "");
    return /youtube\.com|youtu\.be|tiktok\.com/i.test(text);
  }

  function renderPreview(previewEl, url, file) {
    if (!previewEl) return;
    const resolved = String(url || "").trim();
    if (!resolved) {
      previewEl.classList.add("hidden");
      previewEl.innerHTML = "";
      return;
    }
    if (global.FLOQRMediaSourcePicker?.renderPreview && (looksLikeEmbed(resolved) || file)) {
      try {
        if (file) {
          global.FLOQRMediaSourcePicker.renderPreview(previewEl, {
            mediaUrl: resolved,
            mediaType: String(file.type || "").startsWith("video/") ? "video" : "image",
            file
          });
          return;
        }
        const parsed = global.FLOQRMediaSourcePicker.parseExternalMedia(resolved, {allowEmbed:true, allowVideo:true, allowImage:true});
        global.FLOQRMediaSourcePicker.renderPreview(previewEl, parsed);
        return;
      } catch (e) {
        /* fall through to basic preview */
      }
    }
    previewEl.classList.remove("hidden");
    previewEl.innerHTML = looksLikeVideo(resolved, file)
      ? `<video src="${esc(resolved)}" controls muted playsinline></video>`
      : `<img src="${esc(resolved)}" alt="Selected media preview"/>`;
  }

  async function uploadToStorage(file, options = {}) {
    if (!global.firebase?.storage) throw new Error("Firebase Storage is not loaded.");
    const user = firebase.auth?.().currentUser;
    if (!user) throw new Error("Sign in before uploading media.");
    const type = String(file?.type || "");
    const allowVideo = options.allowVideo !== false;
    if (type.startsWith("image/")) {
      /* ok */
    } else if (allowVideo && type.startsWith("video/")) {
      /* ok */
    } else {
      throw new Error(allowVideo ? "Choose an image or video file." : "Choose an image file.");
    }
    const maxBytes = Number(options.maxBytes || (type.startsWith("video/") ? 60 : 30) * 1024 * 1024);
    if (file.size > maxBytes) {
      throw new Error(`File must be under ${Math.max(1, Math.round(maxBytes / (1024 * 1024)))} MB.`);
    }
    const prefix = String(options.pathPrefix || `uploads/${user.uid}`).replace(/\/$/, "");
    const safe = String(file.name || "media").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
    const path = `${prefix}/${Date.now()}-${safe}`;
    const ref = firebase.storage().ref().child(path);
    await ref.put(file, {
      contentType: type,
      customMetadata: {uploadedBy: user.uid}
    });
    return {url: await ref.getDownloadURL(), path, mediaType: type.startsWith("video/") ? "video" : "image"};
  }

  function bind(options = {}) {
    const urlInput = document.getElementById(options.urlInputId);
    const fileInput = document.getElementById(options.fileInputId);
    const previewEl = options.previewId ? document.getElementById(options.previewId) : null;
    const statusEl = options.statusId ? document.getElementById(options.statusId) : null;
    if (!urlInput || !fileInput) return null;

    const setStatus = message => {
      if (statusEl) statusEl.textContent = message || "";
    };

    const notify = () => {
      urlInput.dispatchEvent(new Event("input", {bubbles: true}));
      if (typeof options.onChange === "function") options.onChange(urlInput.value);
    };

    renderPreview(previewEl, urlInput.value);
    urlInput.addEventListener("input", () => renderPreview(previewEl, urlInput.value));
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        setStatus("Uploading media…");
        const result = typeof options.upload === "function"
          ? await options.upload(file)
          : await uploadToStorage(file, options);
        const url = typeof result === "string" ? result : result?.url;
        if (!url) throw new Error("Upload did not return a media URL.");
        urlInput.value = url;
        renderPreview(previewEl, url, file);
        setStatus("Media uploaded.");
        notify();
      } catch (error) {
        fileInput.value = "";
        setStatus(error?.message || String(error));
      }
    });

    return {
      refreshPreview() {
        renderPreview(previewEl, urlInput.value);
      }
    };
  }

  global.FLOQRUrlMediaField = {bind, renderPreview, upload: uploadToStorage};
})(window);
