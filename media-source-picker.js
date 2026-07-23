/* FLOQR Media Source Picker — standard Add Video / Add Media entry for Club, Promoter, DJ, BartR.
 * Source types: local file | direct media URL | YouTube / TikTok embed.
 * Use FLOQRMediaSourcePicker.open / enhance / enhanceAll for every new upload flow.
 */
(function (global) {
  "use strict";

  const SOURCE_LOCAL = "local";
  const SOURCE_URL = "url";
  const SOURCE_EMBED = "embed";

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function looksLikeDirectVideo(url) {
    return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(String(url || ""));
  }

  function looksLikeDirectImage(url) {
    return /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(String(url || ""));
  }

  function parseYouTube(raw) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch (e) {
      return null;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(host)) return null;
    let id = "";
    if (host.includes("youtu.be")) id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2] || "";
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] || "";
    else id = url.searchParams.get("v") || "";
    id = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
    if (!id) return null;
    return {
      sourceType: SOURCE_EMBED,
      mediaType: "embed",
      mediaSource: "youtube",
      embedProvider: "youtube",
      embedId: id,
      mediaUrl: `https://www.youtube.com/watch?v=${id}`,
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    };
  }

  function parseTikTok(raw) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch (e) {
      return null;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!/(^|\.)tiktok\.com$/.test(host)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    let id = "";
    const videoIdx = parts.indexOf("video");
    if (videoIdx >= 0 && parts[videoIdx + 1]) id = parts[videoIdx + 1];
    else if (parts[0] === "embed" || parts[0] === "embed" || parts.includes("embed")) {
      id = parts[parts.length - 1] || "";
    }
    id = String(id || "").replace(/\D/g, "").slice(0, 24);
    if (!id) {
      // Accept paste of full TikTok URL even when ID parsing fails — store raw for later.
      return {
        sourceType: SOURCE_EMBED,
        mediaType: "embed",
        mediaSource: "tiktok",
        embedProvider: "tiktok",
        embedId: "",
        mediaUrl: url.toString(),
        embedSrc: url.toString().includes("/embed/") ? url.toString() : "",
        thumbnailUrl: ""
      };
    }
    return {
      sourceType: SOURCE_EMBED,
      mediaType: "embed",
      mediaSource: "tiktok",
      embedProvider: "tiktok",
      embedId: id,
      mediaUrl: `https://www.tiktok.com/@_/video/${id}`,
      embedSrc: `https://www.tiktok.com/embed/v2/${id}`,
      thumbnailUrl: ""
    };
  }

  function parseExternalMedia(raw, options = {}) {
    const text = String(raw || "").trim();
    if (!text) throw new Error("Paste a media URL first.");
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    } catch (e) {
      throw new Error("That does not look like a valid URL.");
    }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) media links are allowed.");

    const allowEmbed = options.allowEmbed !== false;
    if (allowEmbed) {
      const yt = parseYouTube(url.toString());
      if (yt) return yt;
      const tt = parseTikTok(url.toString());
      if (tt) {
        if (!tt.embedSrc) throw new Error("Paste a full TikTok video link (…/video/123…) so FLOQR can embed it.");
        return tt;
      }
    }

    const href = url.toString();
    const allowVideo = options.allowVideo !== false;
    const allowImage = options.allowImage !== false;
    if (looksLikeDirectVideo(href)) {
      if (!allowVideo) throw new Error("This field accepts images only.");
      return {
        sourceType: SOURCE_URL,
        mediaType: "video",
        mediaSource: "url",
        embedProvider: "",
        embedId: "",
        mediaUrl: href,
        embedSrc: "",
        thumbnailUrl: ""
      };
    }
    if (looksLikeDirectImage(href) || allowImage) {
      if (looksLikeDirectImage(href) && !allowImage) throw new Error("This field accepts video only.");
      // Prefer image when extension matches; otherwise treat as image URL for cover art / CDN links without extensions.
      if (!looksLikeDirectImage(href) && !looksLikeDirectVideo(href) && allowVideo && options.requireKnownExtension) {
        throw new Error("Use a direct image/video file URL, or a YouTube / TikTok link.");
      }
      if (!looksLikeDirectImage(href) && !looksLikeDirectVideo(href) && !allowImage) {
        throw new Error("Use a direct video file URL, or a YouTube / TikTok link.");
      }
      return {
        sourceType: SOURCE_URL,
        mediaType: looksLikeDirectVideo(href) ? "video" : "image",
        mediaSource: "url",
        embedProvider: "",
        embedId: "",
        mediaUrl: href,
        embedSrc: "",
        thumbnailUrl: ""
      };
    }
    throw new Error("Unsupported media URL.");
  }

  function renderPreview(previewEl, payload = {}) {
    if (!previewEl) return;
    const mediaUrl = String(payload.mediaUrl || payload.url || "").trim();
    const mediaType = String(payload.mediaType || "").toLowerCase();
    const embedSrc = String(payload.embedSrc || "").trim();
    if (!mediaUrl && !embedSrc) {
      previewEl.classList.add("hidden");
      previewEl.innerHTML = "";
      return;
    }
    previewEl.classList.remove("hidden");
    if (mediaType === "embed" || payload.embedProvider) {
      const src = esc(embedSrc || mediaUrl);
      const provider = esc(payload.embedProvider || "embed");
      previewEl.innerHTML = `<div class="floqr-media-embed-frame" data-provider="${provider}"><iframe src="${src}" title="${provider} preview" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="sub small">${esc(mediaUrl)}</p>`;
      return;
    }
    if (mediaType === "video" || looksLikeDirectVideo(mediaUrl) || (payload.file && String(payload.file.type || "").startsWith("video/"))) {
      previewEl.innerHTML = `<video src="${esc(mediaUrl)}" controls muted playsinline></video>`;
      return;
    }
    previewEl.innerHTML = `<img src="${esc(mediaUrl)}" alt="Selected media preview"/>`;
  }

  function ensureModal() {
    let root = document.getElementById("floqrMediaSourceModal");
    if (root) return root;
    root = document.createElement("div");
    root.id = "floqrMediaSourceModal";
    root.className = "floqr-media-source-modal hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "floqrMediaSourceTitle");
    root.innerHTML = `
      <div class="floqr-media-source-backdrop" data-media-dismiss="1"></div>
      <div class="floqr-media-source-dialog">
        <button type="button" class="floqr-media-source-close" data-media-dismiss="1" aria-label="Close">&times;</button>
        <p class="eyebrow">FLOQR media</p>
        <h2 id="floqrMediaSourceTitle">Add media</h2>
        <p class="sub small" id="floqrMediaSourceHint">Choose how you want to add media, then continue.</p>
        <div class="floqr-media-source-step" data-step="choose">
          <div class="floqr-media-source-options">
            <button type="button" class="floqr-media-source-option" data-source="${SOURCE_LOCAL}">
              <strong>Upload from this device</strong>
              <span>Choose a local photo or video file.</span>
            </button>
            <button type="button" class="floqr-media-source-option" data-source="${SOURCE_URL}">
              <strong>Paste a media URL</strong>
              <span>Direct link to an image or video file (mp4, webm, jpg…).</span>
            </button>
            <button type="button" class="floqr-media-source-option" data-source="${SOURCE_EMBED}" data-needs-embed="1">
              <strong>Embed YouTube or TikTok</strong>
              <span>Paste a watch/share link — FLOQR iframes the player.</span>
            </button>
          </div>
        </div>
        <div class="floqr-media-source-step hidden" data-step="local">
          <label class="floqr-media-source-label">Choose file(s)
            <input id="floqrMediaSourceFile" type="file"/>
          </label>
          <p class="sub small" id="floqrMediaSourceFileHint"></p>
        </div>
        <div class="floqr-media-source-step hidden" data-step="link">
          <label class="floqr-media-source-label">Media / embed URL
            <input id="floqrMediaSourceUrl" type="url" placeholder="https://…"/>
          </label>
          <p class="sub small" id="floqrMediaSourceUrlHint"></p>
          <div id="floqrMediaSourceLivePreview" class="url-media-preview floqr-media-source-live-preview hidden"></div>
        </div>
        <p id="floqrMediaSourceStatus" class="status" role="status"></p>
        <div class="queue-actions floqr-media-source-actions">
          <button type="button" id="floqrMediaSourceBack" class="hidden">Back</button>
          <button type="button" id="floqrMediaSourceContinue" class="primary hidden">Continue</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  let activeSession = null;

  function setStatus(message) {
    const el = document.getElementById("floqrMediaSourceStatus");
    if (el) el.textContent = message || "";
  }

  function showStep(name) {
    const root = ensureModal();
    root.querySelectorAll("[data-step]").forEach(step => {
      step.classList.toggle("hidden", step.getAttribute("data-step") !== name);
    });
    const back = document.getElementById("floqrMediaSourceBack");
    const cont = document.getElementById("floqrMediaSourceContinue");
    back?.classList.toggle("hidden", name === "choose");
    cont?.classList.toggle("hidden", name === "choose");
  }

  function closeModal(result) {
    const root = ensureModal();
    root.classList.add("hidden");
    document.documentElement.classList.remove("floqr-media-source-open");
    const session = activeSession;
    activeSession = null;
    if (session?.resolve) session.resolve(result || null);
  }

  function open(options = {}) {
    const opts = {
      title: options.title || (options.preferVideo ? "Add Video" : "Add Media"),
      hint: options.hint || "Choose local upload, a direct media URL, or a YouTube / TikTok embed link.",
      allowImage: options.allowImage !== false,
      allowVideo: options.allowVideo !== false,
      allowEmbed: options.allowEmbed !== false && options.allowVideo !== false,
      multiple: !!options.multiple,
      accept: options.accept || "",
      preferVideo: !!options.preferVideo,
      requireKnownExtension: options.requireKnownExtension === true
    };

    return new Promise(resolve => {
      const root = ensureModal();
      if (activeSession?.resolve) activeSession.resolve(null);
      activeSession = {resolve, options: opts};

      document.getElementById("floqrMediaSourceTitle").textContent = opts.title;
      document.getElementById("floqrMediaSourceHint").textContent = opts.hint;
      setStatus("");

      const fileInput = document.getElementById("floqrMediaSourceFile");
      const urlInput = document.getElementById("floqrMediaSourceUrl");
      const live = document.getElementById("floqrMediaSourceLivePreview");
      if (fileInput) {
        fileInput.value = "";
        fileInput.multiple = !!opts.multiple;
        const accept = opts.accept || [
          opts.allowImage ? "image/jpeg,image/png,image/webp,image/gif,image/svg+xml" : "",
          opts.allowVideo ? "video/mp4,video/webm,video/quicktime" : ""
        ].filter(Boolean).join(",");
        fileInput.accept = accept;
      }
      if (urlInput) urlInput.value = "";
      if (live) {
        live.classList.add("hidden");
        live.innerHTML = "";
      }

      document.getElementById("floqrMediaSourceFileHint").textContent = opts.multiple
        ? "You can select more than one file when adding gallery or profile media."
        : "Select one file from this device.";
      document.getElementById("floqrMediaSourceUrlHint").textContent = opts.allowEmbed
        ? "Direct file URLs, YouTube watch/share links, or TikTok video links."
        : "Paste a direct image or video file URL.";

      root.querySelectorAll("[data-needs-embed]").forEach(btn => {
        btn.classList.toggle("hidden", !opts.allowEmbed);
      });
      root.querySelectorAll(`[data-source="${SOURCE_URL}"]`).forEach(btn => {
        btn.classList.toggle("hidden", !opts.allowImage && !opts.allowVideo);
      });
      root.querySelectorAll(`[data-source="${SOURCE_LOCAL}"]`).forEach(btn => {
        btn.classList.toggle("hidden", !opts.allowImage && !opts.allowVideo);
      });

      showStep("choose");
      root.classList.remove("hidden");
      document.documentElement.classList.add("floqr-media-source-open");
    });
  }

  function bindModalOnce() {
    if (bindModalOnce.done) return;
    bindModalOnce.done = true;
    const root = ensureModal();
    root.addEventListener("click", async event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-media-dismiss]")) {
        closeModal(null);
        return;
      }
      const option = target.closest("[data-source]");
      if (option && activeSession) {
        const source = option.getAttribute("data-source");
        activeSession.pendingSource = source;
        if (source === SOURCE_LOCAL) showStep("local");
        else showStep("link");
        setStatus("");
        return;
      }
    });

    document.getElementById("floqrMediaSourceBack")?.addEventListener("click", () => {
      showStep("choose");
      setStatus("");
    });

    document.getElementById("floqrMediaSourceContinue")?.addEventListener("click", async () => {
      if (!activeSession) return;
      const opts = activeSession.options;
      const source = activeSession.pendingSource;
      try {
        if (source === SOURCE_LOCAL) {
          const input = document.getElementById("floqrMediaSourceFile");
          const files = Array.from(input?.files || []);
          if (!files.length) throw new Error("Choose at least one file.");
          for (const file of files) {
            const type = String(file.type || "");
            if (type.startsWith("image/") && !opts.allowImage) throw new Error("This field does not accept images.");
            if (type.startsWith("video/") && !opts.allowVideo) throw new Error("This field does not accept videos.");
            if (!type.startsWith("image/") && !type.startsWith("video/")) throw new Error("Choose an image or video file.");
          }
          closeModal({
            sourceType: SOURCE_LOCAL,
            mediaSource: "local",
            mediaType: files[0].type.startsWith("video/") ? "video" : "image",
            files,
            file: files[0],
            mediaUrl: "",
            embedProvider: "",
            embedId: "",
            embedSrc: ""
          });
          return;
        }

        const raw = document.getElementById("floqrMediaSourceUrl")?.value || "";
        const parsed = parseExternalMedia(raw, {
          allowEmbed: source === SOURCE_EMBED ? true : opts.allowEmbed,
          allowVideo: opts.allowVideo,
          allowImage: opts.allowImage,
          requireKnownExtension: opts.requireKnownExtension
        });
        if (source === SOURCE_EMBED && parsed.sourceType !== SOURCE_EMBED) {
          throw new Error("Paste a YouTube or TikTok video link for embed mode.");
        }
        if (source === SOURCE_URL && parsed.sourceType === SOURCE_EMBED) {
          // Allow auto-detect embed when user chose "URL" but pasted YT/TT — still OK.
        }
        closeModal(parsed);
      } catch (error) {
        setStatus(error?.message || String(error));
      }
    });

    document.getElementById("floqrMediaSourceUrl")?.addEventListener("input", () => {
      if (!activeSession) return;
      const live = document.getElementById("floqrMediaSourceLivePreview");
      const raw = document.getElementById("floqrMediaSourceUrl")?.value || "";
      try {
        const parsed = parseExternalMedia(raw, activeSession.options);
        renderPreview(live, parsed);
        setStatus("");
      } catch (error) {
        if (live) {
          live.classList.add("hidden");
          live.innerHTML = "";
        }
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && activeSession) closeModal(null);
    });
  }

  function applyFilesToInput(fileInput, files) {
    if (!fileInput || !files?.length) return false;
    try {
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", {bubbles: true}));
      return true;
    } catch (e) {
      return false;
    }
  }

  function writeHidden(host, name, value) {
    if (!host) return;
    let input = host.querySelector(`[data-media-meta="${name}"]`);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.dataset.mediaMeta = name;
      host.appendChild(input);
    }
    input.value = value == null ? "" : String(value);
  }

  function readHidden(host, name) {
    return host?.querySelector(`[data-media-meta="${name}"]`)?.value || "";
  }

  function syncSelectionToHost(host, selection, options = {}) {
    if (!host || !selection) return;
    host.dataset.mediaSourceType = selection.sourceType || "";
    writeHidden(host, "sourceType", selection.sourceType || "");
    writeHidden(host, "mediaSource", selection.mediaSource || selection.sourceType || "");
    writeHidden(host, "mediaType", selection.mediaType || "");
    writeHidden(host, "mediaUrl", selection.mediaUrl || "");
    writeHidden(host, "embedProvider", selection.embedProvider || "");
    writeHidden(host, "embedId", selection.embedId || "");
    writeHidden(host, "embedSrc", selection.embedSrc || "");

    const urlInput = options.urlInput || host.querySelector(options.urlSelector || 'input[type="url"], input[data-media-url], input.url-media-url');
    const fileInput = options.fileInput || host.querySelector('input[type="file"]');
    const preview = options.preview || host.querySelector(".url-media-preview, [data-media-preview]");

    if (selection.sourceType === SOURCE_LOCAL) {
      applyFilesToInput(fileInput, selection.files || (selection.file ? [selection.file] : []));
      if (preview && selection.file) {
        const objectUrl = URL.createObjectURL(selection.file);
        renderPreview(preview, {mediaUrl: objectUrl, mediaType: selection.mediaType, file: selection.file});
      }
      return;
    }

    if (fileInput) fileInput.value = "";
    if (urlInput) {
      urlInput.value = selection.mediaUrl || "";
      urlInput.dispatchEvent(new Event("input", {bubbles: true}));
    }
    renderPreview(preview, selection);
    if (typeof options.onChange === "function") options.onChange(selection);
  }

  function getSelectionFromHost(host) {
    if (!host) return null;
    const sourceType = readHidden(host, "sourceType") || host.dataset.mediaSourceType || "";
    if (!sourceType) return null;
    return {
      sourceType,
      mediaSource: readHidden(host, "mediaSource") || sourceType,
      mediaType: readHidden(host, "mediaType"),
      mediaUrl: readHidden(host, "mediaUrl"),
      embedProvider: readHidden(host, "embedProvider"),
      embedId: readHidden(host, "embedId"),
      embedSrc: readHidden(host, "embedSrc")
    };
  }

  function enhance(host, options = {}) {
    if (!host || host.dataset.floqrMediaEnhanced === "1") return host;
    bindModalOnce();
    host.dataset.floqrMediaEnhanced = "1";
    host.classList.add("floqr-media-source-host");

    const preferVideo = options.preferVideo === true || /video/i.test(options.title || host.getAttribute("data-media-label") || "");
    const allowVideo = options.allowVideo !== false && host.getAttribute("data-allow-video") !== "0";
    const allowImage = options.allowImage !== false && host.getAttribute("data-allow-image") !== "0";
    const allowEmbed = options.allowEmbed !== false && allowVideo && host.getAttribute("data-allow-embed") !== "0";
    const multiple = options.multiple === true || host.getAttribute("data-media-multiple") === "1";
    const buttonLabel = options.buttonLabel || host.getAttribute("data-media-button") || (preferVideo ? "Add Video" : "Add Media");

    const fileInput = options.fileInputId
      ? document.getElementById(options.fileInputId)
      : host.querySelector('input[type="file"]');
    const urlInput = options.urlInputId
      ? document.getElementById(options.urlInputId)
      : host.querySelector('input[type="url"], input[data-media-url]');
    const preview = options.previewId
      ? document.getElementById(options.previewId)
      : host.querySelector(".url-media-preview, [data-media-preview]");

    // Hide raw file control; picker becomes the entry point.
    if (fileInput) {
      const label = fileInput.closest("label");
      if (label && label.querySelector('input[type="file"]') === fileInput) {
        label.classList.add("floqr-media-native-hidden");
      } else {
        fileInput.classList.add("floqr-media-native-hidden");
      }
    }

    let actions = host.querySelector(".floqr-media-source-trigger-row");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "floqr-media-source-trigger-row queue-actions";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "floqr-media-add-btn primary";
      btn.textContent = buttonLabel;
      actions.appendChild(btn);
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "floqr-media-clear-btn";
      clearBtn.textContent = "Clear";
      actions.appendChild(clearBtn);
      const status = document.createElement("p");
      status.className = "sub small floqr-media-source-field-status";
      status.setAttribute("data-media-status", "1");
      host.insertBefore(actions, host.firstChild);
      host.appendChild(status);
    }

    const addBtn = actions.querySelector(".floqr-media-add-btn");
    const clearBtn = actions.querySelector(".floqr-media-clear-btn");
    const statusEl = host.querySelector("[data-media-status]");

    addBtn?.addEventListener("click", async () => {
      const selection = await open({
        title: options.title || buttonLabel,
        hint: options.hint,
        allowImage,
        allowVideo,
        allowEmbed,
        multiple,
        accept: fileInput?.accept || options.accept || "",
        preferVideo
      });
      if (!selection) return;
      syncSelectionToHost(host, selection, {
        fileInput,
        urlInput,
        preview,
        onChange: options.onChange
      });
      if (statusEl) {
        statusEl.textContent = selection.sourceType === SOURCE_LOCAL
          ? `Selected ${selection.files?.length || 1} local file(s).`
          : selection.sourceType === SOURCE_EMBED
            ? `Embedded ${selection.embedProvider || "video"} ready.`
            : "External media URL ready.";
      }
      if (selection.sourceType === SOURCE_LOCAL && typeof options.onLocal === "function") {
        await options.onLocal(selection);
      } else if (selection.sourceType !== SOURCE_LOCAL && typeof options.onExternal === "function") {
        await options.onExternal(selection);
      }
      if (typeof options.onSelect === "function") options.onSelect(selection);
    });

    clearBtn?.addEventListener("click", () => {
      if (fileInput) fileInput.value = "";
      if (urlInput) {
        urlInput.value = "";
        urlInput.dispatchEvent(new Event("input", {bubbles: true}));
      }
      ["sourceType", "mediaSource", "mediaType", "mediaUrl", "embedProvider", "embedId", "embedSrc"].forEach(key => writeHidden(host, key, ""));
      host.dataset.mediaSourceType = "";
      if (preview) {
        preview.classList.add("hidden");
        preview.innerHTML = "";
      }
      if (statusEl) statusEl.textContent = "";
      if (typeof options.onClear === "function") options.onClear();
    });

    return {
      host,
      open: () => addBtn?.click(),
      getSelection: () => getSelectionFromHost(host),
      setSelection: selection => syncSelectionToHost(host, selection, {fileInput, urlInput, preview})
    };
  }

  function enhanceAll(root = document, defaults = {}) {
    bindModalOnce();
    const nodes = [
      ...root.querySelectorAll(".url-media-field"),
      ...root.querySelectorAll("[data-floqr-media-source]")
    ];
    nodes.forEach(node => {
      if (node.dataset.floqrMediaEnhanced === "1") return;
      const allowVideo = node.getAttribute("data-allow-video");
      const file = node.querySelector('input[type="file"]');
      const accept = String(file?.accept || "");
      const inferredVideo = accept.includes("video") || allowVideo === "1";
      const inferredImageOnly = allowVideo === "0" || (accept.includes("image") && !accept.includes("video"));
      enhance(node, {
        ...defaults,
        allowVideo: defaults.allowVideo ?? (inferredImageOnly ? false : inferredVideo || true),
        allowImage: defaults.allowImage ?? !/video\/?\*$/.test(accept),
        allowEmbed: defaults.allowEmbed ?? (inferredImageOnly ? false : true),
        multiple: defaults.multiple ?? (file?.multiple || node.getAttribute("data-media-multiple") === "1"),
        preferVideo: defaults.preferVideo ?? (node.getAttribute("data-prefer-video") === "1"),
        buttonLabel: node.getAttribute("data-media-button") || undefined,
        title: node.getAttribute("data-media-label") || undefined
      });
    });
  }

  function mediaMarkup(item = {}, alt = "Media") {
    const mediaType = String(item.mediaType || "").toLowerCase();
    const url = item.mediaUrl || item.url || "";
    const embedSrc = item.embedSrc || "";
    if (mediaType === "embed" || item.embedProvider) {
      return `<div class="floqr-media-embed-frame" data-provider="${esc(item.embedProvider || "embed")}"><iframe src="${esc(embedSrc || url)}" title="${esc(alt)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    }
    if (mediaType === "video" || looksLikeDirectVideo(url)) {
      return `<video src="${esc(url)}" controls muted playsinline aria-label="${esc(alt)}"></video>`;
    }
    return url ? `<img src="${esc(url)}" alt="${esc(alt)}"/>` : "";
  }

  global.FLOQRMediaSourcePicker = {
    SOURCE_LOCAL,
    SOURCE_URL,
    SOURCE_EMBED,
    parseExternalMedia,
    parseYouTube,
    parseTikTok,
    renderPreview,
    mediaMarkup,
    open,
    enhance,
    enhanceAll,
    getSelectionFromHost,
    syncSelectionToHost,
    applyFilesToInput
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindModalOnce();
      enhanceAll(document);
    }, {once: true});
  } else {
    bindModalOnce();
    enhanceAll(document);
  }
})(window);
