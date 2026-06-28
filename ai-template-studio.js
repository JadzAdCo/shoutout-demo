/* FLOQR Studio: locked-layout ShoutOut background variants. */
(function () {
  "use strict";

  const SAFE_COLORS = ["#000000", "#ffffff", "#07101c", "#111111", "#dfff5a", "#26d8ff", "#f43abf", "#e41616", "#ffd45a"];
  const SAFE_GRADIENTS = [
    "linear-gradient(135deg,#050505,#1b1b1b 32%,#e41616 33%,#111 58%,#e41616 74%,#060606)",
    "linear-gradient(135deg,#07101c,#103b5d,#26d8ff)",
    "linear-gradient(135deg,#09091c,#f43abf,#26d8ff)",
    "linear-gradient(135deg,#140d03,#ffd45a,#050505)",
    "linear-gradient(135deg,#063923,#dfff5a,#07101c)"
  ];

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const splitCSV = value => String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  const safeName = value => String(value || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90);

  window.__FLOQR_TEMPLATE_VARIANTS = window.__FLOQR_TEMPLATE_VARIANTS || {mine:[], community:[]};

  function fieldValue() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function currentServices(options = {}) {
    return {
      auth: options.auth || (window.firebase?.apps?.length ? firebase.auth() : null),
      db: options.db || (window.firebase?.apps?.length ? firebase.firestore() : null),
      storage: options.storage || (window.firebase?.apps?.length && firebase.storage ? firebase.storage() : null)
    };
  }

  async function loadPatronTemplateVariants({db, uid} = {}) {
    const out = {mine:[], community:[]};
    if (!db) return out;
    try {
      const publicSnap = await db.collection("patronTemplateVariants").where("visibility","==","public").limit(100).get();
      out.community = publicSnap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn("Could not load community templates:", e.message);
    }
    if (uid) {
      try {
        const mineSnap = await db.collection("patronTemplateVariants").where("ownerUid","==",uid).limit(100).get();
        out.mine = mineSnap.docs.map(d => ({id:d.id, ...d.data()}));
      } catch(e) {
        console.warn("Could not load saved templates:", e.message);
      }
    }
    window.__FLOQR_TEMPLATE_VARIANTS = out;
    return out;
  }

  function variantBackgroundStyle(variant = {}) {
    if (variant.backgroundType === "image" || variant.backgroundType === "ai-generated") {
      return variant.backgroundUrl ? `background-image:url('${String(variant.backgroundUrl).replace(/'/g, "%27")}')` : "";
    }
    if (variant.backgroundType === "gradient" && SAFE_GRADIENTS.includes(variant.backgroundGradient)) return `background:${variant.backgroundGradient}`;
    if (variant.backgroundType === "color" && SAFE_COLORS.includes(variant.backgroundColor)) return `background:${variant.backgroundColor}`;
    return "";
  }

  function previewHtml(baseTemplate = {}, variant = {}) {
    const style = variantBackgroundStyle(variant);
    return `<div class="floqr-studio-preview template ${esc(baseTemplate.className || "neon")}" style="${esc(style)}">
      <div class="template-mini-preview">
        <strong>${esc(baseTemplate.defaultMain || "SHOUTOUT")}</strong>
        <span>${esc(baseTemplate.defaultSub || baseTemplate.category || "Locked layout")}</span>
      </div>
    </div>`;
  }

  function ensureModal() {
    let modal = byId("floqrStudioModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "floqrStudioModal";
    modal.className = "floqr-studio-modal hidden";
    document.body.appendChild(modal);
    return modal;
  }

  function optionList(items, selected) {
    return items.map(item => `<option value="${esc(item)}" ${item === selected ? "selected" : ""}>${esc(item)}</option>`).join("");
  }

  async function savePromptHistory(db, user, data) {
    if (!db || !user || !data.prompt) return;
    await db.collection("aiTemplatePromptHistory").add({
      uid:user.uid,
      templateId:data.baseTemplateId,
      variantId:data.variantId,
      prompt:data.prompt,
      revisedPrompt:"",
      sourceType:data.sourceType || "ai-generated-background",
      visibility:data.promptShared && data.variantVisibility === "public" ? "public" : "private",
      createdAt:fieldValue()
    });
  }

  async function uploadBackground(storage, user, variantId, file, folder) {
    if (!file) return {};
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    if (!/^image\//.test(file.type || "")) throw new Error("Background must be an image file.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Background image must be under 8MB.");
    const path = `template-backgrounds/${user.uid}/${variantId}/${folder}/${Date.now()}-${safeName(file.name)}`;
    const ref = storage.ref().child(path);
    await ref.put(file, {contentType:file.type});
    return {backgroundUrl:await ref.getDownloadURL(), backgroundStoragePath:path};
  }

  function selectedBackground(modal) {
    const type = modal.querySelector("#studioBackgroundType")?.value || "color";
    if (type === "gradient") {
      const backgroundGradient = modal.querySelector("#studioBackgroundGradient")?.value || SAFE_GRADIENTS[0];
      return {backgroundType:"gradient", backgroundGradient:SAFE_GRADIENTS.includes(backgroundGradient) ? backgroundGradient : SAFE_GRADIENTS[0], backgroundColor:"", backgroundUrl:""};
    }
    if (type === "image") return {backgroundType:"image", backgroundColor:"", backgroundGradient:"", backgroundUrl:""};
    const backgroundColor = modal.querySelector("#studioBackgroundColor")?.value || SAFE_COLORS[0];
    return {backgroundType:"color", backgroundColor:SAFE_COLORS.includes(backgroundColor) ? backgroundColor : SAFE_COLORS[0], backgroundGradient:"", backgroundUrl:""};
  }

  function applyAiPlaceholder(modal) {
    modal.querySelector("#studioBackgroundType").value = "gradient";
    modal.querySelector("#studioBackgroundGradient").value = SAFE_GRADIENTS[3];
    modal.querySelector("#studioStatus").textContent = "AI generation is not live yet. A safe placeholder background is shown for preview.";
    refreshPreview(modal);
  }

  function refreshPreview(modal, baseTemplate) {
    const next = selectedBackground(modal);
    const preview = modal.querySelector("#studioPreview");
    if (preview) preview.innerHTML = previewHtml(baseTemplate || modal.__baseTemplate || {}, next);
  }

  async function openFloqrTemplateStudio(options = {}) {
    const services = currentServices(options);
    const user = options.currentUser || services.auth?.currentUser;
    if (!user) {
      alert("Sign in before saving a ShoutOut template background.");
      return;
    }
    const baseTemplate = options.baseTemplate || {};
    const baseTemplateId = options.baseTemplateId || baseTemplate.id || "blackwhite";
    const modal = ensureModal();
    modal.__baseTemplate = baseTemplate;
    modal.innerHTML = `
      <div class="floqr-studio-dialog">
        <div class="floqr-studio-head">
          <div><p class="eyebrow">FLOQR Studio</p><h2>Customize Background</h2></div>
          <button id="studioCloseBtn" type="button" aria-label="Close FLOQR Studio">x</button>
        </div>
        <p class="sub small">Official template layout, text position, media placeholders, animation timing, and display format stay locked. Patrons can change only the background.</p>
        <div class="floqr-studio-grid">
          <div>
            <label>Variant name<input id="studioVariantName" maxlength="80" value="${esc(baseTemplate.name || "My ShoutOut Background")}"/></label>
            <label>Visibility
              <select id="studioVisibility">
                <option value="private">Private</option>
                <option value="public">Shared/Public</option>
              </select>
            </label>
            <label>Background type
              <select id="studioBackgroundType">
                <option value="color">Color</option>
                <option value="gradient">Gradient</option>
                <option value="image">Upload image</option>
              </select>
            </label>
            <label>Allowed color
              <select id="studioBackgroundColor">${optionList(SAFE_COLORS, SAFE_COLORS[0])}</select>
            </label>
            <label>Allowed gradient
              <select id="studioBackgroundGradient">${optionList(SAFE_GRADIENTS, SAFE_GRADIENTS[0])}</select>
            </label>
            <label>Upload background image<input id="studioBackgroundFile" type="file" accept="image/*"/></label>
            <label>Tags<input id="studioTags" placeholder="birthday, flowers, tattoos, vip"/></label>
            <label>AI prompt<input id="studioAiPrompt" placeholder="Create a background that represents my love for flowery tattoos."/></label>
            <label class="consent-line"><input id="studioPromptShared" type="checkbox"/> <span>Share prompt publicly if this variant is public</span></label>
            <div class="button-row">
              <button id="studioAiDesignBtn" type="button">Design Background with AI</button>
              <button id="studioSaveBtn" class="primary" type="button">Save Template Variant</button>
            </div>
            <p id="studioStatus" class="status"></p>
          </div>
          <div>
            <h3>Locked Preview</h3>
            <div id="studioPreview">${previewHtml(baseTemplate, {backgroundType:"color", backgroundColor:SAFE_COLORS[0]})}</div>
          </div>
        </div>
      </div>`;
    modal.classList.remove("hidden");
    modal.querySelector("#studioCloseBtn")?.addEventListener("click", () => modal.classList.add("hidden"));
    ["studioBackgroundType", "studioBackgroundColor", "studioBackgroundGradient"].forEach(id => {
      modal.querySelector(`#${id}`)?.addEventListener("change", () => refreshPreview(modal, baseTemplate));
    });
    modal.querySelector("#studioAiDesignBtn")?.addEventListener("click", () => applyAiPlaceholder(modal));
    modal.querySelector("#studioSaveBtn")?.addEventListener("click", async () => {
      try {
        const variantRef = services.db.collection("patronTemplateVariants").doc();
        const bg = selectedBackground(modal);
        const file = modal.querySelector("#studioBackgroundFile")?.files?.[0];
        const upload = bg.backgroundType === "image" ? await uploadBackground(services.storage, user, variantRef.id, file, "uploaded") : {};
        const prompt = modal.querySelector("#studioAiPrompt")?.value.trim() || "";
        const promptShared = !!modal.querySelector("#studioPromptShared")?.checked;
        const visibility = modal.querySelector("#studioVisibility")?.value || "private";
        const tags = splitCSV(modal.querySelector("#studioTags")?.value);
        const payload = {
          ownerUid:user.uid,
          ownerDisplayName:user.displayName || user.email || "FLOQR Member",
          baseTemplateId,
          baseTemplateName:baseTemplate.name || baseTemplateId,
          variantName:modal.querySelector("#studioVariantName")?.value.trim() || `${baseTemplate.name || "ShoutOut"} Background`,
          backgroundType:bg.backgroundType,
          backgroundUrl:upload.backgroundUrl || bg.backgroundUrl || "",
          backgroundStoragePath:upload.backgroundStoragePath || "",
          backgroundColor:bg.backgroundColor || "",
          backgroundGradient:bg.backgroundGradient || "",
          aiPrompt:prompt,
          promptShared,
          visibility,
          isPublicProfileItem:visibility === "public",
          tags,
          searchKeywords:[...tags, baseTemplate.name || baseTemplateId, promptShared ? prompt : ""].filter(Boolean),
          status:"active",
          lockedBaseTemplate:true,
          allowedCustomization:["background"],
          createdAt:fieldValue(),
          updatedAt:fieldValue()
        };
        await variantRef.set(payload);
        await savePromptHistory(services.db, user, {
          baseTemplateId,
          variantId:variantRef.id,
          prompt,
          promptShared,
          variantVisibility:visibility,
          sourceType:bg.backgroundType === "image" ? "uploaded-background" : "ai-generated-background"
        });
        if (visibility === "public" && window.FLOQRAIIndex) {
          const indexRecord = window.FLOQRAIIndex.templateVariantIndexRecord({id:variantRef.id, ...payload});
          await window.FLOQRAIIndex.upsertAiIndex(services.db, `publicTemplateVariant_${variantRef.id}`, indexRecord);
        }
        modal.querySelector("#studioStatus").textContent = "Template variant saved.";
        await loadPatronTemplateVariants({db:services.db, uid:user.uid});
        if (typeof options.onSaved === "function") options.onSaved({id:variantRef.id, ...payload});
      } catch(e) {
        modal.querySelector("#studioStatus").textContent = e.message;
      }
    });
  }

  window.FLOQRStudio = {
    SAFE_COLORS,
    SAFE_GRADIENTS,
    openFloqrTemplateStudio,
    loadPatronTemplateVariants,
    variantBackgroundStyle,
    previewHtml
  };
})();
