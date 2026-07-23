/* patron-app.js v29.09.1 */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const setStatus = value => {
    const el = byId("authStatus");
    if (!el) return;
    el.textContent = value || "";
    el.classList.toggle("hidden", !value);
  };
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const unique = items => [...new Set(items.filter(Boolean))].sort();
  const FOOTBALL_TEAM_INTRO_TEMPLATE_ID = "zebbiesFootballTeamIntro";
  const FOOTBALL_TEAM_MEMBER_COUNT = 4;
  const FOOTBALL_AI_TIMEOUT_MS = 5000;
  const floqrId = () => window.FLOQRIdentity || {};

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage ? firebase.storage() : null;
  const functions = firebase.app().functions("us-central1");

  let currentUser = null;
  let selectedLocationId = null;
  let selectedTemplate = "blackwhite";
  let selectedScreenFormatId = "led-96x48";
  let selectedTemplateVariant = null;
  let confirmationResult = null;
  let locations = {};
  let locationAliases = {};
  let templates = {};
  let events = {};
  let pendingDirectLocation = qs("location", qs("club", ""));
  let pendingReturnTo = qs("returnTo", "");
  let cachedUserProfile = null;
  let lastProfileReadError = null;
  let minglCandidates = [];
  let minglConnections = [];
  let activeMinglRoomId = "";
  let minglMessagesUnsubscribe = null;
  let minglAttachmentFile = null;
  let templateVariants = {mine:[], community:[], club:[]};
  let locationContextPromise = null;
  let confirmationReturnTimer = null;
  let confirmationCountdownTimer = null;
  let personalizedSuggestionTimer = null;
  let pastShoutoutMemoryPromise = null;
  let approvedRecommendationLibrary = [];
  let approvedRecommendationLibraryPromise = null;
  let emailOtpChallengeId = "";
  let emailOtpExpiresAt = 0;
  let emailOtpTimer = null;

  function isMergedLocation(loc = {}) {
    const status = String(loc.status || "").toLowerCase();
    return status === "merged" || status === "deleted" || !!loc.aliasOf || !!loc.mergedInto;
  }
  function canonicalLocationId(id = "") {
    const key = String(id || "").toLowerCase();
    const loc = locations[key] || window.SHOUTOUT_CLUB_LOCATIONS[key] || {};
    return String(locationAliases[key]?.canonicalLocationId || loc.canonicalLocationId || loc.aliasOf || loc.mergedInto || key || "zebbies-garden-washington-dc").toLowerCase();
  }
  function locationId() { return canonicalLocationId(selectedLocationId || pendingDirectLocation || "zebbies-garden-washington-dc"); }
  function getLocation(id = locationId()) {
    const canonical = canonicalLocationId(id);
    return locations[canonical] || locations[id] || window.SHOUTOUT_CLUB_LOCATIONS[canonical] || window.SHOUTOUT_CLUB_LOCATIONS[id] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  }
  function getTemplate(id = selectedTemplate) { return templates[id] || window.SHOUTOUT_TEMPLATES[id] || window.SHOUTOUT_TEMPLATES.neon; }
  function currentTemplateSupportsMedia() {
    const t = getTemplate();
    return !!(t.supportsMedia || t.supportsImage || t.supportsVideo);
  }
  function currentTemplateAccepts() {
    const t = getTemplate();
    if (t.supportsVideo || t.supportsMedia) return "image/*,video/mp4,video/quicktime,video/webm";
    if (t.supportsImage) return "image/*";
    return "";
  }
  function isFootballTeamIntro(templateId = selectedTemplate) {
    return String(templateId || "") === FOOTBALL_TEAM_INTRO_TEMPLATE_ID;
  }
  function isSoccerJerseyTemplate(templateId = selectedTemplate) {
    const id = String(templateId || selectedTemplate || "");
    const t = getTemplate(id);
    return t.layout === "soccer-jersey" || /^(soccer|nba|nfl)/i.test(id) || t.jerseyNumberField === true;
  }
  function graphemes(value = "") {
    const text = String(value ?? "");
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        return [...new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(text)].map(part => part.segment);
      }
    } catch (_) {}
    return Array.from(text);
  }
  function glyphCap(value = "", max = 0) {
    const limit = Math.max(0, Number(max) || 0);
    return graphemes(value).slice(0, limit).join("");
  }
  function soccerNameFromSource() {
    const profile = cachedUserProfile || {};
    const source = byId("soccerNameSource")?.value || "displayName";
    const emailName = (currentUser?.email || "").split("@")[0] || "";
    const username = profile.username || emailName || currentUser?.displayName || "patron";
    if (source === "manual") return String(byId("soccerManualName")?.value || "").trim();
    if (source === "instagram") return floqrId().normalizeInstagramHandle?.(profile.instagramHandle || byId("profileInstagram")?.value || username) || cleanHandle(username);
    if (source === "floqrHandle") return floqrId().normalizeFloqrHandle?.(profile.floqrHandle || profile.username || username) || floqrId().normalizeFloqrHandle?.(username);
    return String(profile.displayName || currentUser?.displayName || username).trim();
  }
  function syncSoccerJerseyFields() {
    const soccer = isSoccerJerseyTemplate();
    byId("soccerJerseyFields")?.classList.toggle("hidden", !soccer);
    byId("mainText")?.closest("label")?.classList.toggle("hidden", soccer);
    document.querySelector(".attribution-controls")?.classList.toggle("hidden", soccer);
    const source = byId("soccerNameSource")?.value || "displayName";
    byId("soccerManualNameWrap")?.classList.toggle("hidden", !soccer || source !== "manual");
    if (!soccer) return;
    const caps = templateDisplayCaps();
    const nameLimit = Math.max(1, Math.min(14, Number(caps.main || caps.maxMainCharacters || 14)));
    const numberLimit = Math.min(2, Math.max(1, Number(caps.sub || caps.maxSubCharacters || 2)));
    if (byId("soccerManualName")) byId("soccerManualName").maxLength = nameLimit;
    // HTML maxlength counts UTF-16 units and blocks emoji — rely on grapheme glyphCap instead.
    if (byId("soccerJerseyNumber")) byId("soccerJerseyNumber").removeAttribute("maxlength");
    const name = glyphCap(String(soccerNameFromSource() || "").toUpperCase(), nameLimit);
    // Any characters allowed for jersey mark (emoji/special); hard-capped at 2 graphemes.
    const mark = glyphCap(byId("soccerJerseyNumber")?.value || "", numberLimit);
    if (byId("soccerJerseyNumber") && byId("soccerJerseyNumber").value !== mark) byId("soccerJerseyNumber").value = mark;
    if (byId("mainText")) byId("mainText").value = name;
    if (byId("subText")) byId("subText").value = mark;
  }
  function footballThemePayload() {
    const themeId = byId("footballColorTheme")?.value || "stadiumGold";
    const theme = floqrId().footballTheme?.(themeId) || {id:themeId, accent:"#dfff5a"};
    return {colorTheme:themeId, themeAccent:theme.accent || "#dfff5a"};
  }
  function footballBackgroundPayload() {
    const backgroundColor = byId("footballBackgroundColor")?.value || "";
    const backgroundUrl = byId("footballBackgroundUrl")?.value.trim() || "";
    return {
      backgroundColor:/^#[0-9a-fA-F]{6}$/.test(backgroundColor) ? backgroundColor : "",
      backgroundUrl
    };
  }
  function autofillFootballIdentityValue(slot) {
    const caps = templateDisplayCaps(getTemplate(FOOTBALL_TEAM_INTRO_TEMPLATE_ID));
    const nameLimit = Math.max(1, Number(caps.maxPlayerNameCharacters || 14));
    const identityType = byId(`footballTeamIdentity${slot}`)?.value || "displayName";
    const input = byId(`footballTeamIdentityValue${slot}`);
    if (!input) return;
    input.value = floqrId().resolvePlayerIdentityLabel?.(identityType, cachedUserProfile || {}, "", nameLimit) || input.value;
    updatePreview();
  }
  function footballTeamDraftMembers() {
    const caps = templateDisplayCaps(getTemplate(FOOTBALL_TEAM_INTRO_TEMPLATE_ID));
    const nameLimit = Math.max(1, Number(caps.maxPlayerNameCharacters || 14));
    return Array.from({length:FOOTBALL_TEAM_MEMBER_COUNT}, (_, index) => {
      const slot = index + 1;
      const input = byId(`footballTeamPhoto${slot}`);
      const identityType = byId(`footballTeamIdentity${slot}`)?.value || "displayName";
      const identityValue = String(byId(`footballTeamIdentityValue${slot}`)?.value || "").trim();
      const name = floqrId().resolvePlayerIdentityLabel?.(identityType, cachedUserProfile || {}, identityValue, nameLimit)
        || identityValue
        || `PLAYER ${slot}`;
      return {
        slot,
        identityType,
        identityValue,
        name:String(name).trim().slice(0, nameLimit) || `PLAYER ${slot}`,
        position:String(byId(`footballTeamPosition${slot}`)?.value || "Team Member").trim().slice(0, 24),
        file:input?.files?.[0] || null,
        mediaUrl:input?.dataset.previewUrl || "",
        originalMediaUrl:input?.dataset.previewUrl || "",
        selectedMediaVersion:"original"
      };
    });
  }
  function resetFootballTeamEditor() {
    for (let slot = 1; slot <= FOOTBALL_TEAM_MEMBER_COUNT; slot += 1) {
      const input = byId(`footballTeamPhoto${slot}`);
      if (input?.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
      if (input) {
        input.value = "";
        delete input.dataset.previewUrl;
      }
      const preview = byId(`footballTeamPreview${slot}`);
      if (preview) preview.innerHTML = `<span>${slot}</span>`;
    }
    if (byId("footballAiTreatment")) byId("footballAiTreatment").checked = false;
    if (byId("footballPhotoConsent")) byId("footballPhotoConsent").checked = false;
    if (byId("footballTeamMessage")) byId("footballTeamMessage").value = "TONIGHT, WE TAKE THE FIELD TOGETHER";
    if (byId("footballBackgroundUrl")) byId("footballBackgroundUrl").value = "";
    if (byId("footballBackgroundFile")) byId("footballBackgroundFile").value = "";
    window.FLOQRUrlMediaField?.renderPreview?.(byId("footballBackgroundPreview"), "");
    if (byId("footballBackgroundColor")) byId("footballBackgroundColor").value = "#071713";
    if (byId("footballColorTheme")) byId("footballColorTheme").value = "stadiumGold";
    for (let slot = 1; slot <= FOOTBALL_TEAM_MEMBER_COUNT; slot += 1) {
      const identitySelect = byId(`footballTeamIdentity${slot}`);
      if (identitySelect) identitySelect.value = "displayName";
      autofillFootballIdentityValue(slot);
    }
    setText("footballTeamStatus", "");
  }
  function renderFootballTeamPhotoPreview(input) {
    const slot = Number(input?.dataset.slot || 0);
    const file = input?.files?.[0];
    if (!slot || !file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      input.value = "";
      setText("footballTeamStatus", `Player ${slot}: choose a JPG, PNG, or WEBP image.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      input.value = "";
      setText("footballTeamStatus", `Player ${slot}: the image must be 10 MB or smaller.`);
      return;
    }
    if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
    input.dataset.previewUrl = URL.createObjectURL(file);
    const preview = byId(`footballTeamPreview${slot}`);
    if (preview) preview.innerHTML = `<img src="${esc(input.dataset.previewUrl)}" alt="Player ${slot} preview">`;
    setText("footballTeamStatus", `${footballTeamDraftMembers().filter(member => member.file).length} of 4 photos ready.`);
    updatePreview();
  }
  function populateFootballThemeSelect() {
    const themeSelect = byId("footballColorTheme");
    if (!themeSelect || themeSelect.options.length) return;
    Object.values(floqrId().FOOTBALL_COLOR_THEMES || {}).forEach(theme => {
      themeSelect.add(new Option(theme.label, theme.id));
    });
    themeSelect.value = "stadiumGold";
  }
  function bindFootballTeamEditor() {
    populateFootballThemeSelect();
    document.querySelectorAll("[data-football-team-photo]").forEach(input => input.addEventListener("change", () => renderFootballTeamPhotoPreview(input)));
    document.querySelectorAll("[data-football-team-identity]").forEach(select => {
      select.addEventListener("change", () => autofillFootballIdentityValue(Number(select.dataset.slot || 0)));
    });
    document.querySelectorAll("[data-football-team-identity-value],[data-football-team-position]").forEach(input => input.addEventListener("input", updatePreview));
    byId("footballTeamMessage")?.addEventListener("input", updatePreview);
    byId("footballColorTheme")?.addEventListener("change", updatePreview);
    byId("footballBackgroundColor")?.addEventListener("input", updatePreview);
    byId("footballBackgroundUrl")?.addEventListener("input", updatePreview);
    window.FLOQRUrlMediaField?.bind?.({
      urlInputId:"footballBackgroundUrl",
      fileInputId:"footballBackgroundFile",
      previewId:"footballBackgroundPreview",
      statusId:"footballTeamStatus",
      pathPrefix: currentUser?.uid ? `shoutouts/${currentUser.uid}/backgrounds` : "shoutouts/anonymous/backgrounds",
      allowVideo:false,
      maxBytes:12 * 1024 * 1024,
      upload: async file => {
        if (!currentUser?.uid) throw new Error("Sign in before uploading a background image.");
        return window.FLOQRUrlMediaField.upload(file, {
          pathPrefix:`shoutouts/${currentUser.uid}/backgrounds`,
          allowVideo:false,
          maxBytes:12 * 1024 * 1024
        });
      },
      onChange:updatePreview
    });
    for (let slot = 1; slot <= FOOTBALL_TEAM_MEMBER_COUNT; slot += 1) autofillFootballIdentityValue(slot);
  }
  async function uploadFootballTeamMembers(referenceNumber) {
    if (!storage) throw new Error("Firebase Storage is not initialized.");
    if (!byId("footballPhotoConsent")?.checked) throw new Error("Confirm that you have permission to use all four photos.");
    const drafts = footballTeamDraftMembers();
    if (drafts.some(member => !member.file)) throw new Error("Upload all four player photos before checkout.");
    drafts.forEach(member => {
      if (!/^image\/(jpeg|png|webp)$/i.test(member.file.type)) throw new Error(`Player ${member.slot}: only JPG, PNG, and WEBP images are allowed.`);
      if (member.file.size > 10 * 1024 * 1024) throw new Error(`Player ${member.slot}: the image must be 10 MB or smaller.`);
    });

    const originals = [];
    for (const member of drafts) {
      setText("footballTeamStatus", `Uploading player ${member.slot} of 4...`);
      const safeName = `${member.slot}-${member.file.name}`.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const mediaStoragePath = `shoutouts/${currentUser.uid}/${referenceNumber}/original/team/${Date.now()}-${safeName}`;
      const ref = storage.ref().child(mediaStoragePath);
      const snap = await ref.put(member.file, {
        contentType:member.file.type,
        customMetadata:{uploadedBy:currentUser.uid, referenceNumber, footballTeamSlot:String(member.slot)}
      });
      const mediaUrl = await snap.ref.getDownloadURL();
      originals.push({
        slot:member.slot,
        identityType:member.identityType || "displayName",
        identityValue:member.identityValue || "",
        name:member.name,
        position:member.position,
        mediaUrl,
        originalMediaUrl:mediaUrl,
        enhancedMediaUrl:"",
        mediaStoragePath,
        originalMediaStoragePath:mediaStoragePath,
        enhancedMediaStoragePath:"",
        selectedMediaVersion:"original",
        aiEnhancementApplied:false,
        aiEnhancementProvider:"",
        aiEnhancementModel:"",
        aiMediaSafetyStatus:"notChecked",
        aiMediaSafetyNotes:"",
        mediaFileName:member.file.name
      });
    }

    if (!byId("footballAiTreatment")?.checked) {
      setText("footballTeamStatus", "Four original photos uploaded. Opening $30 checkout...");
      return originals;
    }

    setText("footballTeamStatus", "Animating portraits (up to 5 seconds). Originals remain if enhancement fails...");
    const callable = functions.httpsCallable(window.FLOQR_AI_GEMINI_MEDIA_FUNCTION || "aiEnhanceShoutOutMedia");
    let fallbackCount = 0;
    const motionPrompt = "Subtle cinematic portrait motion for an LED stadium display. Preserve this person's recognizable face and natural identity. Add gentle Ken Burns-style zoom and parallax only—no filters, uniforms, logos, text, or stylized football gear. Keep lighting natural and high-contrast for a live venue screen.";
    const enhanceAll = Promise.all(originals.map(async member => {
      try {
        const response = await callable({
          mediaStoragePath:member.originalMediaStoragePath,
          referenceNumber,
          enhancementType:"football-portrait-motion",
          prompt:motionPrompt
        });
        const data = response?.data || {};
        if (data.status !== "enhanced" || !data.enhancedMediaUrl) throw new Error("No enhanced image returned.");
        return {
          ...member,
          mediaUrl:data.enhancedMediaUrl,
          enhancedMediaUrl:data.enhancedMediaUrl,
          mediaStoragePath:data.enhancedMediaStoragePath || member.mediaStoragePath,
          enhancedMediaStoragePath:data.enhancedMediaStoragePath || "",
          selectedMediaVersion:"enhanced",
          aiEnhancementApplied:true,
          aiEnhancementType:"football-portrait-motion",
          aiEnhancementProvider:data.provider || "gemini",
          aiEnhancementModel:data.model || "",
          aiMediaSafetyStatus:data.aiMediaSafetyStatus || "passed",
          aiMediaSafetyNotes:data.aiMediaSafetyNotes || "Portrait motion completed."
        };
      } catch (error) {
        fallbackCount += 1;
        return {...member, aiEnhancementType:"none", aiMediaSafetyStatus:"fallback", aiMediaSafetyNotes:`Original retained: ${String(error?.message || error).slice(0, 180)}`};
      }
    }));
    let enhanced = originals;
    try {
      enhanced = await Promise.race([
        enhanceAll,
        new Promise((_, reject) => setTimeout(() => reject(new Error("AI enhancement timed out after 5 seconds.")), FOOTBALL_AI_TIMEOUT_MS))
      ]);
    } catch (error) {
      fallbackCount = 4;
      enhanced = originals.map(member => ({...member, aiEnhancementType:"none", aiMediaSafetyStatus:"fallback", aiMediaSafetyNotes:String(error?.message || "Timed out; originals retained.").slice(0, 180)}));
    }
    setText("footballTeamStatus", fallbackCount ? `${4 - fallbackCount} animated portrait(s) ready; ${fallbackCount} original photo(s) retained. Opening $30 checkout...` : "Four animated portraits ready. Opening $30 checkout...");
    return enhanced;
  }
  function safeUser() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
  function safeReturnTo(value = "") {
    if (!value) return "";
    try {
      const target = new URL(value, window.location.href);
      if (target.origin !== window.location.origin) return "";
      const basePath = window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/") + 1);
      if (!target.pathname.startsWith(basePath)) return "";
      if (/(?:^|\/)display\.html$/i.test(target.pathname)) return "";
      return target.toString();
    } catch (e) { return ""; }
  }
  async function userLocationContext() {
    if (!window.FLOQRLocationAI || !currentUser) {
      return {uid:currentUser?.uid || "", locationSource:"unknown", preferredGenres:[], preferredVenueTypes:[], preferredCities:[], interests:[]};
    }
    if (!locationContextPromise) {
      locationContextPromise = window.FLOQRLocationAI.getUserLocationContext({
        ...(cachedUserProfile || {}),
        profile:cachedUserProfile || {},
        uid:currentUser.uid
      });
    }
    return locationContextPromise;
  }
  function resetUserLocationContext() {
    locationContextPromise = null;
  }
  function detectRenderContext() {
    const ua = navigator.userAgent || "";
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const isTouch = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;
    const isTablet = /iPad|Tablet/i.test(ua) || (isTouch && width >= 700 && width <= 1180);
    const isMobile = !isTablet && (/Mobi|Android|iPhone|iPod/i.test(ua) || width <= 640);
    const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Windows/i.test(ua) ? "windows" : /Mac OS X/i.test(ua) ? "mac" : "other";
    document.documentElement.lang = (window.FLOQRI18n?.getLanguage?.() || navigator.language || "en").slice(0, 12);
    document.body.dataset.device = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
    document.body.dataset.os = os;
    document.body.dataset.touch = isTouch ? "true" : "false";
    document.body.dataset.lang = window.FLOQRI18n?.getLanguage?.() || navigator.language || "en";
    document.body.classList.toggle("device-mobile", isMobile);
    document.body.classList.toggle("device-tablet", isTablet);
    document.body.classList.toggle("device-desktop", !isMobile && !isTablet);
  }
  function showPage(id) {
    if (!id || !byId(id)) return;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    byId(id)?.classList.add("active");
    if (id === "templateSelectPage") {
      window.FLOQRFloqAi?.setMode?.("templates");
      window.FLOQRFloqAi?.ensureTemplateMode?.();
    } else if (id === "floqAiPage" || document.getElementById("floqAiPage")?.classList.contains("active")) {
      window.FLOQRFloqAi?.setMode?.("intent");
    }
  }
  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function getInitials(user) {
    const name = user?.displayName || user?.email || user?.phoneNumber || "Guest";
    return name.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join("") || "?";
  }

  function updateUserMenu(user) {
    const photoURL = user?.photoURL || "";
    const displayName = user?.displayName || user?.email || user?.phoneNumber || "Please Sign-In or Sign-Up:";
    const email = user?.email || user?.phoneNumber || "Guest";
    const userPhoto = byId("userPhoto");
    const dropdownPhoto = byId("dropdownUserPhoto");
    const initials = byId("userInitials");

    if (userPhoto) {
      userPhoto.src = photoURL || "";
      userPhoto.classList.toggle("hidden", !photoURL);
    }
    if (dropdownPhoto) {
      dropdownPhoto.src = photoURL || "";
      dropdownPhoto.classList.toggle("hidden", !photoURL);
    }
    if (initials) {
      initials.textContent = user ? getInitials(user) : "?";
      initials.classList.toggle("hidden", !!photoURL);
    }
    setText("dropdownUserName", displayName);
    setText("dropdownUserEmail", email);
    window.FLOQRIntentSearch?.syncPatronCard(user, cachedUserProfile || {});
  }

  function toggleUserDropdown(event) {
    if (event) event.stopPropagation();
    byId("userDropdown")?.classList.toggle("hidden");
  }

  function closeUserDropdownOnOutsideClick(event) {
    const menu = byId("userMenu");
    if (menu && !menu.contains(event.target)) byId("userDropdown")?.classList.add("hidden");
  }

  const AD_CONTENT = {
    "lounge-club": { title: "Gran Coramino Tequila", body: "A smooth premium tequila experience associated with Kevin Hart. Perfect for a Lounge-Club moment.", badge: "Sponsored Lounge-Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGRAN%20CORAMINO%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "clubs": { title: "Gucci Fragrances", body: "Luxury fragrance energy for a night out. Own the room before the first song drops.", badge: "Sponsored Club Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ffd45a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23ff64d8%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ffd45a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EGUCCI%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EFRAGRANCES%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "events": { title: "Nike Air Max", body: "Step into the night with Nike energy. Built for movement, style, and the next event.", badge: "Sponsored Event Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%2362eaff%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ENIKE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EAIR%20MAX%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "lounges": { title: "Teremana Tequila", body: "Dwayne Johnson's tequila brand brings a premium toast to the lounge experience.", badge: "Sponsored Lounge Moment", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23dfff5a%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3ETEREMANA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3ETEQUILA%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "beach-clubs": { title: "Advertise Here", body: "Beach club audiences are premium, social, and ready to discover your brand.", badge: "Beach Club Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "shoutout": { title: "Advertise Here", body: "Put your brand in front of patrons right before they create a live LED ShoutOut.", badge: "ShoutOut Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "mingl": { title: "Advertise Here", body: "Reach social patrons right before they browse Mingl people and Gist stories.", badge: "Mingl Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2362eaff%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%2362eaff%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EMINGL%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22800%22%3EGIST%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" },
    "default": { title: "Advertise Here", body: "Your brand can own this moment before patrons browse nightlife.", badge: "FLOQR Media Slot", image: "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20900%20520%22%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20x2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23ff64d8%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23dfff5a%22/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Crect%20width%3D%22900%22%20height%3D%22520%22%20rx%3D%2244%22%20fill%3D%22%2309091c%22/%3E%0A%3Ccircle%20cx%3D%22170%22%20cy%3D%22110%22%20r%3D%22155%22%20fill%3D%22%23ff64d8%22%20opacity%3D%22.20%22/%3E%0A%3Ccircle%20cx%3D%22730%22%20cy%3D%22385%22%20r%3D%22185%22%20fill%3D%22%23dfff5a%22%20opacity%3D%22.20%22/%3E%0A%3Crect%20x%3D%22245%22%20y%3D%22135%22%20width%3D%22410%22%20height%3D%22240%22%20rx%3D%2234%22%20fill%3D%22none%22%20stroke%3D%22url%28%23g%29%22%20stroke-width%3D%2214%22/%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22245%22%20fill%3D%22%23fff%22%20font-size%3D%2256%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%20font-weight%3D%22900%22%3EADVERTISE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22310%22%20fill%3D%22%23dfff5a%22%20font-size%3D%2230%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3EHERE%3C/text%3E%0A%3Ctext%20x%3D%22450%22%20y%3D%22450%22%20fill%3D%22%23c9cee5%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%22%3ESponsored%20FLOQR%20Media%20Slot%3C/text%3E%0A%3C/svg%3E" }
  };

  let pendingCategoryAfterAd = null;
  let adTimer = null;

  function showAdSplash(type, nextFn) {
    pendingCategoryAfterAd = nextFn;
    const activeLocation = getLocation?.() || {};
    const clubName = activeLocation.locationName || activeLocation.brandName || "Club";
    const clubLogoUrl = activeLocation.logoUrl || activeLocation.clubLogoUrl || "";
    setText("adTitle", clubName);
    setText("adBody", "Your shoutout goes live after this splash.");
    const clubLogo = byId("splashClubLogo");
    const clubLogoFallback = byId("splashClubLogoFallback");
    if (clubLogo) {
      if (clubLogoUrl) {
        clubLogo.src = clubLogoUrl;
        clubLogo.onerror = () => {
          clubLogo.classList.add("hidden");
          if (clubLogoFallback) {
            clubLogoFallback.textContent = String(clubName || "Club").slice(0, 24).toUpperCase();
            clubLogoFallback.classList.remove("hidden");
          }
        };
        clubLogo.classList.remove("hidden");
        clubLogoFallback?.classList.add("hidden");
      } else {
        clubLogo.classList.add("hidden");
        if (clubLogoFallback) {
          clubLogoFallback.textContent = String(clubName || "Club").slice(0, 24).toUpperCase();
          clubLogoFallback.classList.remove("hidden");
        }
      }
    }
    const statementPrimary = byId("splashStatementPrimary");
    const statementSecondary = byId("splashStatementSecondary");
    statementPrimary?.classList.remove("is-hidden");
    statementSecondary?.classList.remove("is-hidden");
    let remaining = 10;
    setText("adCountdown", String(remaining));
    showPage("adSplashPage");
    clearInterval(adTimer);
    adTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 6) statementPrimary?.classList.add("is-hidden");
      if (remaining <= 3) statementSecondary?.classList.add("is-hidden");
      setText("adCountdown", String(Math.max(remaining, 0)));
      if (remaining <= 0) {
        clearInterval(adTimer);
        const fn = pendingCategoryAfterAd;
        pendingCategoryAfterAd = null;
        if (typeof fn === "function") fn();
      }
    }, 1000);
  }

  function skipAdSplash() {
    clearInterval(adTimer);
    const fn = pendingCategoryAfterAd;
    pendingCategoryAfterAd = null;
    if (typeof fn === "function") fn();
  }

  function cancelAdSplash() {
    clearInterval(adTimer);
    pendingCategoryAfterAd = null;
    showPage("categoryPage");
  }


  async function loadTemplates() {
    templates = {...window.SHOUTOUT_TEMPLATES};
    try {
      const snap = await db.collection("templates").get();
      snap.forEach(doc => {
        const packaged = window.SHOUTOUT_TEMPLATES?.[doc.id] || {};
        templates[doc.id] = {...packaged, id:doc.id, ...doc.data(), backgroundEditable:Object.keys(packaged).length ? true : doc.data().backgroundEditable !== false};
      });
    } catch(e) {}
  }
  async function loadTemplateVariants() {
    if (!window.FLOQRStudio || !currentUser) {
      templateVariants = {mine:[], community:[], club:[]};
      return templateVariants;
    }
    const patronVariants = await window.FLOQRStudio.loadPatronTemplateVariants({db, uid:currentUser.uid});
    const clubVariants = await window.FLOQRStudio.loadClubTemplateVariants({db, clubLocationId:locationId()});
    templateVariants = {...patronVariants, club:clubVariants};
    return templateVariants;
  }
  async function loadLocationAliases() {
    locationAliases = {};
    try {
      const snap = await db.collection("clubLocationAliases").get();
      snap.forEach(doc => {
        const data = doc.data();
        if (String(data.status || "active") === "active" && data.canonicalLocationId) {
          locationAliases[doc.id.toLowerCase()] = {id:doc.id, ...data};
        }
      });
    } catch(e) {}
    Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(([id, loc]) => {
      if (loc.canonicalLocationId || loc.aliasOf || loc.mergedInto) {
        locationAliases[id.toLowerCase()] = {
          id,
          aliasId:id,
          canonicalLocationId:loc.canonicalLocationId || loc.aliasOf || loc.mergedInto,
          aliasName:loc.locationName || loc.brandName || id,
          status:"active"
        };
      }
    });
  }
  function visibleLocationEntry([id, loc]) {
    const obsoleteIds = new Set((window.FLOQR_OBSOLETE_LOCATION_IDS || []).map(value => String(value || "").toLowerCase()));
    const key = String(id || loc?.id || "").toLowerCase();
    const g = window.FLOQRFeatureGates;
    if (!loc || obsoleteIds.has(key) || isMergedLocation(loc)) return false;
    if (g) {
      if (g.entityIsOffboarded(loc) || !g.entityIsPubliclyVisible(loc)) return false;
      if (!g.entityIsAppEnabled(loc) && String(loc.status || "").toLowerCase() === "disabled") return false;
    }
    return loc.active !== false && String(loc.status || "active") !== "deleted" && String(loc.status || "active") !== "offboarded";
  }
  async function loadLocations() {
    await loadLocationAliases();
    locations = {};
    try { const snap = await db.collection("clubLocations").where("active","==",true).orderBy("locationName","asc").get(); snap.forEach(doc => { const data = doc.data(); if (visibleLocationEntry([doc.id, data])) locations[doc.id] = {id:doc.id, ...data}; else if (data.canonicalLocationId || data.aliasOf || data.mergedInto) locationAliases[doc.id.toLowerCase()] = {id:doc.id, canonicalLocationId:data.canonicalLocationId || data.aliasOf || data.mergedInto, aliasName:data.locationName || data.brandName || doc.id, status:"active"}; }); } catch(e) {}
    if (Object.keys(locations).length === 0) locations = Object.fromEntries(Object.entries(window.SHOUTOUT_CLUB_LOCATIONS || {}).filter(visibleLocationEntry));
  }
  async function loadEvents() {
    events = {...(window.SHOUTOUT_EVENTS || {})};
    try { const snap = await db.collection("events").where("active","==",true).get(); snap.forEach(doc => { const data = doc.data(); if (String(data.status || "active") !== "deleted") events[doc.id] = {id:doc.id, ...data}; }); } catch(e) {}
  }
  async function resolveLocationAlias(id = "") {
    const key = String(id || "").toLowerCase();
    const known = canonicalLocationId(key);
    if (known && known !== key) return known;
    try {
      const alias = await db.collection("clubLocationAliases").doc(key).get();
      if (alias.exists && alias.data()?.canonicalLocationId) {
        locationAliases[key] = {id:alias.id, ...alias.data()};
        return String(alias.data().canonicalLocationId).toLowerCase();
      }
    } catch(e) {}
    try {
      const locDoc = await db.collection("clubLocations").doc(key).get();
      if (locDoc.exists) {
        const data = locDoc.data() || {};
        const canonical = String(data.canonicalLocationId || data.aliasOf || data.mergedInto || "").toLowerCase();
        if (canonical && canonical !== key) {
          locationAliases[key] = {id:key, canonicalLocationId:canonical, aliasName:data.locationName || data.brandName || key, status:"active"};
          return canonical;
        }
      }
    } catch(e) {}
    return key;
  }
  async function loadLocationById(id) {
    const requested = String(id || "").toLowerCase();
    const canonical = await resolveLocationAlias(requested);
    if (locations[canonical]) return locations[canonical];
    try {
      const doc = await db.collection("clubLocations").doc(canonical).get();
      if (doc.exists) {
        const data = {id:doc.id, ...doc.data()};
        if (isMergedLocation(data) && data.canonicalLocationId && data.canonicalLocationId !== canonical) return loadLocationById(data.canonicalLocationId);
        locations[doc.id] = data;
        return locations[doc.id];
      }
    } catch(e) {}
    return window.SHOUTOUT_CLUB_LOCATIONS[canonical] || window.SHOUTOUT_CLUB_LOCATIONS[requested] || window.SHOUTOUT_CLUB_LOCATIONS["zebbies-garden-washington-dc"];
  }

  function updateLoginUI(user) {
    setText("signedInAs", user ? "" : "Please Sign-In or Sign-Up:");
    byId("signedInActions")?.classList.toggle("hidden", !user);
    byId("loginActions")?.classList.toggle("hidden", !!user);
    updateUserMenu(user);
  }

  
  async function getUserProfile() {
    if (!currentUser) return null;
    lastProfileReadError = null;
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      cachedUserProfile = doc.exists ? doc.data() : null;
      resetUserLocationContext();
      return cachedUserProfile;
    } catch (e) {
      lastProfileReadError = e;
      console.warn("Could not read user profile:", e.message);
      throw e;
    }
  }

  function prefillSignupProfile() {
    if (!currentUser) return;
    const displayName = currentUser.displayName || "";
    const emailName = (currentUser.email || "").split("@")[0] || "";
    const cleanName = (displayName || emailName || "patron").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24);

    if (byId("profileUsername") && !byId("profileUsername").value) byId("profileUsername").value = floqrId().normalizeFloqrHandle?.(cleanName) || cleanName;
    if (byId("profileDisplayName") && !byId("profileDisplayName").value) byId("profileDisplayName").value = displayName;
  }

  function cleanHandle(value) {
    return floqrId().normalizeInstagramHandle?.(value) || "";
  }

  function currentAttributionValue() {
    if (!byId("includeAttribution")?.checked) return "";
    const profile = cachedUserProfile || {};
    const choice = byId("attributionChoice")?.value || "displayName";
    const emailName = (currentUser?.email || "").split("@")[0] || "";
    const username = profile.username || emailName || currentUser?.displayName || "patron";
    if (choice === "instagram") return floqrId().normalizeInstagramHandle?.(profile.instagramHandle || byId("profileInstagram")?.value || username) || cleanHandle(username);
    if (choice === "floqrHandle" || choice === "username") return floqrId().normalizeFloqrHandle?.(profile.floqrHandle || profile.username || username) || floqrId().normalizeFloqrHandle?.(username);
    return String(profile.displayName || currentUser?.displayName || username).trim().slice(0, 30);
  }

  function syncAttribution() {
    const enabled = !!byId("includeAttribution")?.checked;
    byId("attributionChoiceWrap")?.classList.toggle("hidden", !enabled);
    if (byId("subText")) byId("subText").value = fitTemplateText(currentAttributionValue(), "sub");
    if (typeof updateTemplateCharacterCapHint === "function") updateTemplateCharacterCapHint();
    updatePreview();
  }

  function showSignupProfile() {
    prefillSignupProfile();
    showPage("signupProfilePage");
  }

  function splitCSV(value) {
    return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  function profileSaveErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "permission-denied" || /missing or insufficient permissions/i.test(message)) {
      return "Profile save was blocked by Firestore rules. Publish this package's firestore.rules and confirm users/{uid} allows the signed-in user to create/update their own profile.";
    }
    return message;
  }

  function profileReadErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "permission-denied" || /missing or insufficient permissions/i.test(message)) {
      return "FLOQR could not read your existing profile because Firestore rules are blocking users/{uid}. Your saved profile data was not changed. Please publish this package's firestore.rules, then sign in again.";
    }
    return message;
  }

  function minglUploadErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "storage/unauthorized" || /unauthorized|permission|storage rules/i.test(message)) {
      return "Mingl picture upload failed because Firebase Storage rules are blocking mingl-chat/{uid}/{roomId}. Publish this package's storage.rules, then try the picture again.";
    }
    return message;
  }

  function preserveExistingProfileData(updates, existing = {}) {
    const protectedUpdates = {...updates};
    Object.entries(protectedUpdates).forEach(([key, value]) => {
      if (["uid", "email", "phoneNumber", "photoURL", "providerIds", "analyticsConsent", "marketingConsent", "profileCompleted", "updatedAt"].includes(key)) return;
      const existingValue = existing[key];
      const isBlankString = typeof value === "string" && !value.trim();
      const isBlankArray = Array.isArray(value) && value.length === 0;
      if ((isBlankString || isBlankArray) && existingValue !== undefined && existingValue !== null && String(existingValue).length > 0) {
        delete protectedUpdates[key];
      }
    });
    return protectedUpdates;
  }

  async function saveProfile() {
    const status = byId("profileStatus");
    try {
      if (!currentUser) {
        status.textContent = "Please sign in first.";
        return;
      }

      const rawHandle = byId("profileUsername").value.trim();
      const floqrHandle = floqrId().normalizeFloqrHandle?.(rawHandle) || rawHandle;
      if (!floqrHandle || !floqrId().isValidFloqrHandle?.(floqrHandle)) {
        status.textContent = "Please choose a valid FloqR / Mingl handle (letters, numbers, underscores, dashes).";
        return;
      }
      const username = floqrId().normalizeFloqrHandle?.(rawHandle, {requireAt:false}) || floqrHandle.replace(/^@+/, "");

      const profile = {
        uid: currentUser.uid,
        floqrHandle,
        username,
        displayName: byId("profileDisplayName").value.trim() || currentUser.displayName || "",
        email: currentUser.email || "",
        phoneNumber: currentUser.phoneNumber || "",
        photoURL: currentUser.photoURL || "",
        providerIds: (currentUser.providerData || []).map(p => p.providerId),
        country: byId("profileCountry").value.trim(),
        region: byId("profileRegion").value.trim(),
        city: byId("profileCity").value.trim(),
        taxiPickupAddress:byId("profileTaxiPickupAddress")?.value.trim() || "",
        ageRange: byId("profileAgeRange").value,
        gender: byId("profileGender")?.value || "",
        height: byId("profileHeight")?.value.trim() || "",
        heightUnit: byId("profileHeightUnit")?.value || preferredHeightUnit(byId("profileCountry")?.value || ""),
        favoriteGenres: splitCSV(byId("profileGenres").value),
        nightlifeInterests: splitCSV(byId("profileInterests").value),
        musicInterests: splitCSV(byId("profileGenres").value),
        foodChoices: splitCSV(byId("profileFoodChoices")?.value || "Sushi, Tapas, Steakhouse"),
        favoriteBeverages: splitCSV(byId("profileBeverageChoices")?.value || "Champagne, Tequila, Mocktails"),
        instagramHandle: floqrId().normalizeInstagramHandle?.(byId("profileInstagram").value) || "",
        xHandle: byId("profileX").value.trim(),
        analyticsConsent: byId("profileAnalyticsConsent").checked,
        marketingConsent: byId("profileMarketingConsent").checked,
        referredByPromoterId: new URL(window.location.href).searchParams.get("promoter") || "",
        profileCompleted: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const profileRef = db.collection("users").doc(currentUser.uid);
      let existingSnap;
      try {
        existingSnap = await profileRef.get();
      } catch (readError) {
        status.textContent = profileReadErrorMessage(readError);
        return;
      }
      const existingProfile = existingSnap.exists ? existingSnap.data() : {};
      const savePayload = existingSnap.exists
        ? preserveExistingProfileData(profile, existingProfile)
        : {...profile, createdAt: firebase.firestore.FieldValue.serverTimestamp()};

      await profileRef.set(savePayload, { merge: true });

      status.textContent = "Profile saved.";
      await continueToMainCategories();
    } catch (e) {
      console.error(e);
      status.textContent = profileSaveErrorMessage(e);
    }
  }

  async function continueToMainCategories() {
    const returnUrl = safeReturnTo(pendingReturnTo);
    if (returnUrl) {
      pendingReturnTo = "";
      window.location.href = returnUrl;
      return;
    }
    try {
      await window.FLOQRFeatureGates?.loadPatronGates?.(db);
      window.FLOQRFeatureGates?.applyPatronGateUi?.(currentUser, cachedUserProfile);
    } catch (e) {}
    showPage("categoryPage");
    window.FLOQRNav?.applyStartPage(showPage);
    if (pendingDirectLocation) {
      openCategory("shoutout");
      setTimeout(() => selectLocationForShoutOut(pendingDirectLocation), 400);
    }
  }


  async function afterLogin() {
    await loadTemplates();
    await loadLocations();
    await loadEvents();
    await loadTemplateVariants();

    let profile = null;
    try {
      profile = await getUserProfile();
    } catch (readError) {
      setStatus(profileReadErrorMessage(readError));
      showPage("landingPage");
      return;
    }
    if (!profile || !profile.profileCompleted) {
      showSignupProfile();
      return;
    }
    if (window.FLOQRFeatureGates?.entityIsOffboarded(profile) || profile.appEnabled === false || String(profile.status || "").toLowerCase() === "disabled") {
      if (!window.FLOQRFeatureGates?.isSuperAdmin(currentUser, profile)) {
        setStatus("This account is disabled or offboarded and cannot use FLOQR features.");
        showPage("landingPage");
        return;
      }
    }

    try {
      await window.FLOQRI18n?.init?.(profile);
      window.FLOQRI18n?.applyDom?.();
      await window.FLOQRI18n?.maybePromptReturningPatron?.({...profile, uid: currentUser?.uid, email: currentUser?.email});
    } catch (_) {}

    await continueToMainCategories();
  }

  async function signInProvider(provider, label) {
    try {
      setStatus(`Opening ${label} sign-in...`);
      await auth.signInWithPopup(provider);
    } catch(e) {
      const code = e?.code || "";
      if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
        setStatus(`${label} popup was blocked. Redirecting instead...`);
        await auth.signInWithRedirect(provider);
        return;
      }
      setStatus(`${e.code || "error"}: ${e.message}`);
    }
  }
  async function loginGoogle() { await signInProvider(new firebase.auth.GoogleAuthProvider(), "Google"); }
  async function loginFacebook() { await signInProvider(new firebase.auth.FacebookAuthProvider(), "Facebook"); }
  function microsoftAuthErrorMessage(e) {
    const code = e?.code || "error";
    const message = e?.message || String(e || "Unknown error");
    if (code === "auth/popup-closed-by-user") return "Microsoft sign-in popup closed before completion. Try again, or allow popups for this site.";
    if (code === "auth/popup-blocked") return "Your browser blocked Microsoft sign-in. Allow popups for jadzadco.github.io and try again.";
    if (code === "auth/operation-not-allowed") return "Microsoft sign-in is not enabled in Firebase Authentication.";
    if (code === "auth/unauthorized-domain") return "This site is not authorized in Firebase Authentication. Add jadzadco.github.io under Authentication > Settings > Authorized domains.";
    if (code === "auth/account-exists-with-different-credential") return "This email already exists with another sign-in method. Sign in with the original provider first.";
    if (code === "auth/invalid-credential" || code === "auth/invalid-oauth-client-id") return "Microsoft OAuth configuration appears invalid. Verify Microsoft Client ID, Client Secret, and Firebase redirect URI.";
    return `${code}: ${message}`;
  }
  function buildMicrosoftProvider() {
    const p = new firebase.auth.OAuthProvider("microsoft.com");
    p.setCustomParameters({prompt:"select_account"});
    return p;
  }
  function isMicrosoftPopupIssue(e) {
    const code = e?.code || "";
    return code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
  }
  async function loginMicrosoft() {
    const p = buildMicrosoftProvider();
    try {
      setStatus("Opening Microsoft sign-in...");
      await auth.signInWithPopup(p);
    } catch(e) {
      if (isMicrosoftPopupIssue(e)) {
        try {
          setStatus("Microsoft popup was blocked or closed. Redirecting instead...");
          await auth.signInWithRedirect(p);
          return;
        } catch(redirectError) {
          setStatus(microsoftAuthErrorMessage(redirectError));
          return;
        }
      }
      setStatus(microsoftAuthErrorMessage(e));
    }
  }
  function showEmailOtpPanel() {
    const panel = byId("emailOtpPanel");
    const button = byId("showEmailOtpBtn");
    if (!panel || !button) return;
    const willOpen = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !willOpen);
    panel.setAttribute("aria-hidden", String(!willOpen));
    button.classList.toggle("email-selected", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
    button.setAttribute("aria-pressed", String(willOpen));
    button.textContent = willOpen ? "Email sign-in selected" : "Continue with your own Email";
    if (willOpen && !emailOtpChallengeId) {
      setText("emailOtpStatus", "Email sign-in selected. Enter your email address to receive a secure code.");
    }
    if (willOpen) byId("emailOtpAddress")?.focus();
  }
  function updateEmailOtpCountdown() {
    const status = byId("emailOtpStatus");
    if (!status || !emailOtpExpiresAt) return;
    const seconds = Math.max(0, Math.ceil((emailOtpExpiresAt - Date.now()) / 1000));
    status.textContent = seconds ? `Code sent. Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.` : "This code expired. Request a new one.";
    if (!seconds && emailOtpTimer) { clearInterval(emailOtpTimer); emailOtpTimer = null; }
  }
  async function requestEmailOtp() {
    const email = String(byId("emailOtpAddress")?.value || "").trim().toLowerCase();
    if (!functions) { setText("emailOtpStatus", "Firebase Functions is unavailable on this page."); return; }
    try {
      setText("emailOtpStatus", "Sending your secure sign-in code...");
      const response = await functions.httpsCallable("requestEmailOtp")({email});
      emailOtpChallengeId = response.data?.challengeId || "";
      emailOtpExpiresAt = Date.now() + Number(response.data?.expiresInSeconds || 300) * 1000;
      clearInterval(emailOtpTimer);
      emailOtpTimer = setInterval(updateEmailOtpCountdown, 1000);
      updateEmailOtpCountdown();
      byId("emailOtpCode")?.focus();
    } catch (error) {
      setText("emailOtpStatus", error?.message || "The email code could not be sent.");
    }
  }
  async function verifyEmailOtp() {
    const email = String(byId("emailOtpAddress")?.value || "").trim().toLowerCase();
    const code = String(byId("emailOtpCode")?.value || "").trim().toUpperCase();
    if (!functions || !emailOtpChallengeId) { setText("emailOtpStatus", "Request a new code first."); return; }
    try {
      setText("emailOtpStatus", "Verifying code...");
      const response = await functions.httpsCallable("verifyEmailOtp")({email, code, challengeId:emailOtpChallengeId});
      await auth.signInWithCustomToken(response.data.customToken);
      clearInterval(emailOtpTimer);
      emailOtpTimer = null;
      setText("emailOtpStatus", "Email verified. You are signed in.");
    } catch (error) {
      setText("emailOtpStatus", error?.message || "The email code could not be verified.");
    }
  }
  async function logout() { await auth.signOut(); window.location.href = "./"; }
  window.jadzPatronLogout = logout;

  function showSmsOtpPanel() {
    byId("smsOtpPanel")?.classList.remove("hidden");
    setupPhoneAuth();
    setStatus("Enter your phone number, then send the SMS OTP.");
  }
  function setupPhoneAuth() { if (!byId("recaptcha-container") || window.recaptchaVerifier) return; window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {size:"normal"}); }
  function buildSmsPhoneNumber() {
    const countryCode = byId("phoneCountryCode")?.value || "";
    const local = (byId("phoneNationalNumber")?.value || byId("phoneNumber")?.value || "").replace(/[^\d]/g, "");
    const phone = `${countryCode}${local}`;
    if (byId("phoneNumber")) byId("phoneNumber").value = phone;
    return phone;
  }
  async function sendPhoneCode() {
    try {
      setupPhoneAuth();
      const phone = buildSmsPhoneNumber();
      if (!phone.startsWith("+")) { setStatus("Use international format, for example +12025550123."); return; }
      if (phone.replace(/[^\d]/g, "").length < 8) { setStatus("Enter a valid phone number."); return; }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      byId("phoneCodeBlock")?.classList.remove("hidden");
      setStatus("Code sent. Enter it below.");
    } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function verifyPhoneCode() { try { if (!confirmationResult) { setStatus("Send the OTP first."); return; } await confirmationResult.confirm(byId("phoneCode").value.trim()); } catch(e) { setStatus(`${e.code || "error"}: ${e.message}`); } }


  function openGuestListForSelectedLocation() {
    const id =
      selectedLocation?.id ||
      selectedClub?.id ||
      selectedClub?.locationId ||
      selectedClub?.clubLocationId ||
      new URL(window.location.href).searchParams.get("location") ||
      "";

    const url = new URL("./guest-list.html", window.location.href);
    if (id) url.searchParams.set("location", id);

    const promoter = new URL(window.location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);

    window.location.href = url.toString();
  }


  function openCategory(type) {
    showAdSplash(type, () => openCategoryAfterAd(type));
  }

  function openCategoryAfterAd(type) {
    if (type === "clubs" || type === "lounges" || type === "lounge-club" || type === "beach-clubs") {
      byId("clubActionsPage")?.setAttribute("data-category-type", type);
      showPage("clubActionsPage");
      return;
    }

    byId("listingType").value = type;
    byId("listingTitle").textContent =
      type === "events" ? "Search Events" :
      type === "shoutout" ? "Choose Location for ShoutOut" :
      type.startsWith("club-action:") ? type.replace("club-action:","").replaceAll("-"," ").replace(/\b\w/g, c => c.toUpperCase()) :
      "Search";
    byId("listingIntro").textContent =
      type === "shoutout" ? "Pick the exact location where your ShoutOut should appear." :
      type.startsWith("club-action:") ? "Select the exact venue/location for this action. Payment and booking integration will be connected later." :
      "Search naturally by city, country, venue, genre, artist, event day, or activity time.";
    showListing();
  }

  function populateFilters() {
    const country = byId("countryFilter"), region = byId("regionFilter"), city = byId("cityFilter"), genre = byId("genreFilter");
    if (!country) return;
    country.innerHTML = '<option value="">All countries</option>';
    region.innerHTML = '<option value="">All states / regions</option>';
    city.innerHTML = '<option value="">All cities</option>';
    genre.innerHTML = '<option value="">All genres</option>';
    const source = byId("listingType").value === "events" ? Object.values(events) : Object.values(locations);
    unique(source.map(x => x.country)).forEach(x => country.append(new Option(x,x)));
    unique(source.map(x => x.region)).forEach(x => region.append(new Option(x,x)));
    unique(source.map(x => x.city)).forEach(x => city.append(new Option(x,x)));
    unique(source.flatMap(x => x.genres || [])).forEach(x => genre.append(new Option(x,x)));
  }
  function bindFilters() {
    ["locationSearch","countryFilter","regionFilter","cityFilter","genreFilter"].forEach(id => {
      const el = byId(id);
      if (el && !el.dataset.bound) { el.addEventListener("input", renderGrid); el.addEventListener("change", renderGrid); el.dataset.bound = "1"; }
    });
  }
  function showListing() { showPage("listingPage"); populateFilters(); bindFilters(); renderGrid(); }

  function renderGrid() {
    const type = byId("listingType").value || "clubs";
    if (type === "events") return renderEventGrid();
    return renderLocationGrid();
  }

  const SEARCH_STOP_WORDS = new Set(["a","an","and","am","are","at","for","i","in","interested","interest","into","like","likes","looking","near","of","on","people","person","the","to","want","who","with","going","go","club","clubs","venue","venues","event","events","night","nightlife"]);
  const SEARCH_ALIASES = {
    hiphop: ["hiphop","hip hop","hip-hop","rap"],
    hop: ["hop","hope"],
    girl: ["girl","girls","female","woman","women","lady","ladies"],
    girls: ["girl","girls","female","woman","women","lady","ladies"],
    female: ["female","girl","girls","woman","women"],
    woman: ["woman","women","female","girl","girls"],
    women: ["woman","women","female","girl","girls"],
    car: ["car","cars","fast car","fast cars","coupe","luxury car","exotic car"],
    cars: ["car","cars","fast car","fast cars","coupe","luxury car","exotic car"],
    fast: ["fast","fast car","fast cars","car","cars","coupe"],
    fastcar: ["fast car","fast cars","car","cars","coupe","luxury car"],
    fastcars: ["fast cars","fast car","car","cars","coupe","luxury car"],
    latina: ["latina","latin","latino","reggaeton","salsa","bachata","latin events","latin night"],
    latin: ["latin","latina","latino","reggaeton","salsa","bachata","latin events","latin night"],
    afrobeats: ["afrobeats","afro beats","afrobeat","afro beat"],
    afrobeat: ["afrobeat","afro beat","afrobeats","afro beats"],
    rnb: ["rnb","r b","r&b","r and b"],
    edm: ["edm","electronic dance music"],
    loungeclub: ["loungeclub","lounge club","lounge-club"],
    beachclub: ["beachclub","beach club","beach-club"]
  };

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function compactSearchText(value) {
    return normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
  }

  function searchTokens(value) {
    return normalizeSearchText(value).split(/\s+/).filter(token => token && !SEARCH_STOP_WORDS.has(token));
  }

  function searchFields(value) {
    const text = normalizeSearchText(value);
    return { text, compact: text.replace(/[^a-z0-9]/g, ""), tokens: text.split(/\s+/).filter(Boolean) };
  }

  function editDistanceWithin(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return false;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const curr = [i];
      let rowMin = curr[0];
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        rowMin = Math.min(rowMin, curr[j]);
      }
      if (rowMin > limit) return false;
      for (let j = 0; j < curr.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length] <= limit;
  }

  function tokenMatchesSearchField(token, field) {
    const variants = SEARCH_ALIASES[compactSearchText(token)] || [token];
    return variants.some(variant => {
      const normalized = normalizeSearchText(variant);
      const compact = compactSearchText(variant);
      if (!compact) return true;
      if (field.text.includes(normalized) || field.compact.includes(compact)) return true;
      const tolerance = compact.length >= 6 ? 2 : compact.length >= 3 ? 1 : 0;
      return tolerance > 0 && field.tokens.some(candidate => editDistanceWithin(compact, candidate, tolerance));
    });
  }

  function contextualSearchMatch(query, value) {
    const tokens = searchTokens(query);
    if (!tokens.length) return true;
    const field = searchFields(value);
    return tokens.every(token => tokenMatchesSearchField(token, field));
  }

  async function getCollectionSafe(name, filterFn, limit = 1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function getDocsByIdsSafe(name, ids = []) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 250);
    const rows = [];
    for (const id of uniqueIds) {
      try {
        const snap = await db.collection(name).doc(id).get();
        if (snap.exists) rows.push({id:snap.id, ...snap.data()});
      } catch(e) {
        console.warn(`Could not read ${name}/${id}:`, e.message);
      }
    }
    return rows;
  }

  async function getParticipantCollectionSafe(name, uid, limit = 1000, fallbackIds = []) {
    try {
      const snap = await db.collection(name).where("participants", "array-contains", uid).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, ...d.data()}));
    } catch(e) {
      console.warn(`Could not read participant ${name}:`, e.message);
      return fallbackIds.length ? getDocsByIdsSafe(name, fallbackIds) : [];
    }
  }

  function pairId(a, b) {
    return [a, b].filter(Boolean).sort().join("_");
  }

  function minglLogoForProfile(profile = cachedUserProfile || {}) {
    const gender = String(profile.gender || profile.sex || profile.genderIdentity || "").toLowerCase();
    if (gender.includes("female") || gender.includes("woman")) return "./images/mingl-pink-logo.png";
    if (gender.includes("male") || gender.includes("man")) return "./images/mingl-blue-logo.png";
    return "./images/mingl-chrome-logo.png";
  }

  function profileStateRegion(profile = {}) {
    return profile.state || profile.region || profile.province || profile.stateRegionProvince || profile.stateProvince || profile.regionProvince || "";
  }

  function profileLocationParts(profile = {}) {
    return [profile.city, profileStateRegion(profile), profile.country].filter(Boolean);
  }

  function publicProfileHaystack(profile) {
    return [
      profile.displayName,
      profile.username,
      profile.floqrHandle,
      profile.instagramHandle,
      profile.publicProfileBioOriginal || profile.publicProfileBioEnglish || profile.bio,
      ...(publicDatapointAllowed(profile, "location") ? profileLocationParts(profile) : []),
      ...(publicDatapointAllowed(profile, "gender") ? [profile.gender] : []),
      ...(publicDatapointAllowed(profile, "height") ? [profile.height] : []),
      ...(publicDatapointAllowed(profile, "events") ? [profile.nightlifeStyle, ...(profile.nightlifeInterests || [])] : []),
      ...(publicDatapointAllowed(profile, "meet") ? [profile.lookingToMeet] : []),
      ...(publicDatapointAllowed(profile, "music") ? (profile.musicInterests || profile.favoriteGenres || []) : []),
      ...(publicDatapointAllowed(profile, "travel") ? (profile.travelInterests || []) : []),
      ...(publicDatapointAllowed(profile, "hobbies") ? (profile.hobbies || profile.generalHobbies || []) : []),
      ...(publicDatapointAllowed(profile, "food") ? (profile.foodChoices || []) : []),
      ...(publicDatapointAllowed(profile, "beverage") ? (profile.favoriteBeverages || []) : [])
    ].join(" ");
  }

  function normValue(value) {
    return normalizeSearchText(value).replace(/\s+/g, " ").trim();
  }

  function valueSet(value) {
    const items = Array.isArray(value) ? value : splitCSV(value);
    return new Set(items.map(normValue).filter(Boolean));
  }

  function setsOverlap(a, b) {
    for (const item of a) if (b.has(item)) return true;
    return false;
  }

  function valuesContextuallyOverlap(a, b) {
    const left = Array.from(valueSet(a));
    const right = Array.from(valueSet(b));
    return left.some(item => right.some(candidate => contextualSearchMatch(item, candidate) || contextualSearchMatch(candidate, item)));
  }

  function contextualValueEquals(a, b) {
    const left = normValue(a);
    const right = normValue(b);
    return !!left && !!right && (contextualSearchMatch(left, right) || contextualSearchMatch(right, left));
  }

  function normalizedServiceRole(value = "") {
    const role = String(value || "").toLowerCase();
    if (role.includes("promoter")) return "promoter";
    if (role.includes("dj")) return "dj";
    if (/hospitality|waitress|waiter|bottle|bartender/.test(role)) return "hospitality";
    if (/videographer|camera operator|cameraman|photographer|media ?creator/.test(role)) return "mediaCreator";
    return "";
  }

  function profileServiceRole(profile = {}) {
    return normalizedServiceRole(profile.publicProfileType || profile.serviceRole || profile.role || (profile.electedRoles || []).join(","));
  }

  function profileMatchScore(a = {}, b = {}) {
    const overlaps = PROFILE_DATAPOINTS.filter(point => publicDatapointAllowed(a, point.key) && publicDatapointAllowed(b, point.key))
      .filter(point => valuesContextuallyOverlap(point.get(a), point.get(b)) || contextualValueEquals(point.get(a), point.get(b)));
    let score = overlaps.length;
    const roleA = profileServiceRole(a);
    const roleB = profileServiceRole(b);
    if (roleA && roleB && roleA === roleB && publicDatapointAllowed(a, "serviceRole") && publicDatapointAllowed(b, "serviceRole")) score += 2;
    return score;
  }

  const PROFILE_DATAPOINTS = [
    {key:"gender", label:"Gender", get:p => p.gender},
    {key:"height", label:"Height", get:p => heightDisplay(p) || p.height},
    {key:"music", label:"Music", get:p => p.musicInterests || p.favoriteGenres},
    {key:"events", label:"Events", get:p => p.nightlifeInterests || p.nightlifeStyle},
    {key:"travel", label:"Travel", get:p => p.travelInterests},
    {key:"hobbies", label:"Hobbies", get:p => p.hobbies || p.generalHobbies},
    {key:"food", label:"Food", get:p => p.foodChoices},
    {key:"beverage", label:"Beverages", get:p => p.favoriteBeverages},
    {key:"meet", label:"Meet", get:p => p.lookingToMeet},
    {key:"location", label:"Location", get:p => profileLocationParts(p)},
    {key:"serviceRole", label:"Service role", get:p => p.publicProfileType || p.serviceRole || p.role || (p.electedRoles || []).join(",")}
  ];

  function dataPointValues(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return splitCSV(value).length ? splitCSV(value) : (value ? [String(value)] : []);
  }

  function publicMinglDatapoints(profile = {}) {
    if (Array.isArray(profile.publicMinglDatapoints) && profile.publicMinglDatapoints.length) {
      return profile.publicMinglDatapoints;
    }
    return PROFILE_DATAPOINTS.map(point => point.key).concat("media");
  }

  function publicDatapointAllowed(profile = {}, key = "") {
    return publicMinglDatapoints(profile).includes(key);
  }

  function profileSearchHaystack(profile = {}) {
    return [
      publicProfileHaystack(profile),
      ...PROFILE_DATAPOINTS.filter(point => publicDatapointAllowed(profile, point.key)).flatMap(point => dataPointValues(point.get(profile)))
    ].join(" ");
  }

  function queryIntentScore(query, profile = {}) {
    const tokens = searchTokens(query);
    if (!tokens.length) return 0;
    const haystack = searchFields(profileSearchHaystack(profile));
    return tokens.reduce((sum, token) => sum + (tokenMatchesSearchField(token, haystack) ? 1 : 0), 0);
  }

  function sharedDataPointLabels(a = {}, b = {}) {
    const labels = PROFILE_DATAPOINTS
      .filter(point => publicDatapointAllowed(a, point.key) && publicDatapointAllowed(b, point.key))
      .filter(point => valuesContextuallyOverlap(point.get(a), point.get(b)) || contextualValueEquals(point.get(a), point.get(b)))
      .map(point => point.label);
    const roleA = profileServiceRole(a);
    const roleB = profileServiceRole(b);
    if (roleA && roleB && roleA === roleB && publicDatapointAllowed(a, "serviceRole") && publicDatapointAllowed(b, "serviceRole") && !labels.includes("Service role")) {
      labels.push("Service role");
    }
    return labels;
  }

  function profileContactLine(profile = {}) {
    const floqr = floqrId().floqrHandleFromProfile?.(profile) || "";
    const instagram = floqrId().normalizeInstagramHandle?.(profile.instagramHandle || "") || "";
    return [floqr, instagram].filter(Boolean).map(value => `<small class="mingl-contact-handle">${esc(value)}</small>`).join("");
  }

  function isPublicMinglCandidate(profile = {}) {
    const visibility = String(profile.publicProfileVisibility || "").toLowerCase();
    return visibility === "public" && publicDatapointAllowed(profile, "media") && !!profileMinglPhoto(profile) && profileMatchScore(cachedUserProfile || {}, profile) >= 3;
  }

  function profileMinglPhoto(profile = {}) {
    const media = Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots.find(x => x?.url && x.type !== "video") : null;
    return media?.url || profile.photoURL || profile.avatarUrl || "";
  }

  function connectionFor(uid) {
    const id = pairId(currentUser?.uid, uid);
    return minglConnections.find(x => x.id === id || x.connectionId === id);
  }

  function connectionStatusFor(uid) {
    const c = connectionFor(uid);
    if (!c) return {state:"none"};
    if (c.status === "mutual") return {state:"mutual", connection:c};
    if (c.requestedBy === currentUser?.uid) return {state:"sent", connection:c};
    return {state:"received", connection:c};
  }

  function minglRequestBody(targetProfile = {}, sharedLabels = [], nextStatus = "pending") {
    const actorName = cachedUserProfile?.displayName || currentUser?.displayName || currentUser?.email || "A FLOQR patron";
    const targetName = targetProfile.displayName || targetProfile.username || "a FLOQR patron";
    const action = nextStatus === "mutual" ? "accepted a Friend or Mingl Request with" : "sent a Friend or Mingl Request to";
    const location = profileLocationParts(cachedUserProfile || {}).join(", ");
    return [
      `${actorName} ${action} ${targetName}.`,
      sharedLabels.length ? `Matched on shared interests (${sharedLabels.length} areas).` : "Shared interests were matched by the Mingl algorithm.",
      "Both patrons must approve before full Mingl Chat opens."
    ].filter(Boolean).join("\n");
  }

  async function recordMinglRequest({connectionId, targetUid, targetProfile, nextStatus, sharedLabels}) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const body = minglRequestBody(targetProfile, sharedLabels, nextStatus);
    const base = {
      title:"Friend or Mingl Request",
      subject:"Friend or Mingl Request",
      body,
      connectionId,
      requesterUid:currentUser.uid,
      requesterEmail:currentUser.email || "",
      requesterName:cachedUserProfile?.displayName || currentUser.displayName || currentUser.email || "Patron",
      targetUid,
      targetName:targetProfile.displayName || targetProfile.username || "Mingl Member",
      sharedDatapoints:sharedLabels,
      requesterLocation:profileLocationParts(cachedUserProfile || {}).join(", "),
      status:nextStatus,
      link:"./patron-portal.html?tab=inbox&v=29.09.8",
      minglLink:"./mingl-chat.html?v=29.09.33",
      read:false,
      createdAt:now
    };
    const writes = [
      db.collection("inboxNotifications").add({recipientUid:targetUid, recipientEmail:targetProfile.email || "", type:"minglRequest", ...base}),
      db.collection("inboxNotifications").add({recipientUid:currentUser.uid, recipientEmail:currentUser.email || "", type:"minglRequestReceipt", ...base}),
      db.collection("messages").add({messageType:"mingl_request", senderUid:"system", senderName:"System Message", recipientUid:targetUid, recipientEmail:targetProfile.email || "", ...base}),
      db.collection("minglAudit").add({type:"mingl_request", actorUid:currentUser.uid, participants:[currentUser.uid, targetUid], ...base})
    ];
    await Promise.allSettled(writes);
  }

  function joinList(value) {
    return Array.isArray(value) ? value.slice(0, 4).join(", ") : String(value || "");
  }

  function countryUsesFeetInches(country = "") {
    const value = String(country || "").trim().toLowerCase();
    return ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "canada", "ca"].includes(value);
  }

  function preferredHeightUnit(country = "") {
    return countryUsesFeetInches(country) ? "ftin" : "m";
  }

  function applyProfileHeightUnit(force = false) {
    const unit = byId("profileHeightUnit");
    const height = byId("profileHeight");
    if (!unit || !height) return;
    if (force || !unit.dataset.userSelected) unit.value = preferredHeightUnit(byId("profileCountry")?.value || "");
    height.placeholder = unit.value === "ftin" ? "5'10\"" : "1.78";
  }

  function heightDisplay(profile = {}) {
    const value = String(profile.height || "").trim();
    if (!value) return "";
    const unit = profile.heightUnit || preferredHeightUnit(profile.country);
    return unit === "m" ? `${value} m` : value;
  }

  function portalChatUrl(roomId = "") {
    const params = new URLSearchParams({ v: "29.09.8", from: "mingl" });
    if (roomId) params.set("room", roomId);
    return `./mingl-chat.html?${params.toString()}`;
  }

  async function showShoutoutLanding() {
    const g = window.FLOQRFeatureGates;
    if (g && !g.patronMayUse("shoutOut", currentUser, cachedUserProfile)) {
      setStatus("ShoutOut is currently disabled for patrons.");
      return;
    }
    showPage("shoutoutLandingPage");
  }

  async function showMinglLanding() {
    if (!currentUser) {
      setStatus("Please sign in before using Mingl.");
      showPage("landingPage");
      return;
    }
    const g = window.FLOQRFeatureGates;
    if (g && !g.patronMayUse("mingl", currentUser, cachedUserProfile)) {
      setStatus("Mingl is currently disabled for patrons.");
      return;
    }
    const profile = await getUserProfile();
    const logo = byId("minglLandingLogo");
    if (logo) logo.src = minglLogoForProfile(profile || {});
    updateMinglGrammarControls();
    showPage("minglLandingPage");
    await loadMingl();
  }

  window.showShoutoutLanding = showShoutoutLanding;
  window.showMinglLanding = showMinglLanding;

  function focusMinglPeopleSearch() {
    const search = byId("minglSearch");
    search?.scrollIntoView({behavior:"smooth", block:"center"});
    setTimeout(() => search?.focus(), 180);
  }

  function openMinglChatShortcut() {
    window.location.href = portalChatUrl();
  }

  async function loadMingl() {
    if (!currentUser) return;
    const users = await getCollectionSafe("users", x => x.uid !== currentUser.uid && isPublicMinglCandidate(x));
    const fallbackConnectionIds = users.map(profile => pairId(currentUser.uid, profile.uid || profile.id));
    const connections = await getParticipantCollectionSafe("minglConnections", currentUser.uid, 1000, fallbackConnectionIds);
    minglCandidates = users;
    minglConnections = connections;
    renderMinglSelfCard();
    renderMinglPeople();
    renderMinglChats();
    renderMinglRequests();
  }

  function renderProfileDatapoints(profile = {}, prefix = "profile") {
    return `<div class="profile-datapoint-grid">${PROFILE_DATAPOINTS.filter(point => publicDatapointAllowed(profile, point.key)).map((point, index) => {
      const values = dataPointValues(point.get(profile));
      if (!values.length) return "";
      const id = `${prefix}-${point.key}-${index}`;
      return `<details class="profile-datapoint">
        <summary>${esc(point.label)}</summary>
        <div>${values.map(value => `<span>${esc(value)}</span>`).join("")}</div>
      </details>`;
    }).join("")}</div>`;
  }

  function setupDatapointPopouts(root = document) {
    root.querySelectorAll(".profile-datapoint").forEach(detail => {
      if (detail.dataset.bound === "1") return;
      detail.dataset.bound = "1";
      detail.addEventListener("toggle", () => {
        if (!detail.open) return;
        document.querySelectorAll(".profile-datapoint[open]").forEach(other => {
          if (other !== detail) other.removeAttribute("open");
        });
      });
    });
  }

  function renderMinglSelfCard() {
    const wrap = byId("minglSelfCard");
    if (!wrap || !currentUser) return;
    const profile = cachedUserProfile || {};
    const photo = profileMinglPhoto(profile) || currentUser.photoURL || "";
    wrap.innerHTML = `
      <div class="mingl-self-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(profile.displayName || "Your profile")}">` : `<span>${esc((profile.displayName || currentUser.displayName || "M").slice(0,1).toUpperCase())}</span>`}</div>
      <div>
        <p class="eyebrow">Mingl Profile</p>
        <h3>${esc(profile.displayName || currentUser.displayName || currentUser.email || "Your Profile")}</h3>
        ${profileContactLine(profile) ? `<div class="mingl-contact-row">${profileContactLine(profile)}</div>` : ""}
        ${renderProfileDatapoints(profile, "self")}
      </div>`;
    setupDatapointPopouts(wrap);
  }

  async function renderMinglPeople() {
    const grid = byId("minglPeopleGrid");
    if (!grid) return;
    const query = byId("minglSearch")?.value || "";
    const usedFloqrSearch = !!(query && window.floqrSearch && window.FLOQRAISearch);
    const searchedProfiles = usedFloqrSearch
      ? (await window.floqrSearch(query, {
          records:window.FLOQRAISearch.profilesToRecords(minglCandidates),
          db,
          currentUser,
          profile:cachedUserProfile,
          role:"patron",
          source:"mingl"
        })).map(record => record.data).filter(Boolean)
      : minglCandidates;
    const matches = searchedProfiles
      .map(profile => ({
        profile,
        sharedScore: profileMatchScore(cachedUserProfile || {}, profile),
        intentScore: queryIntentScore(query, profile)
      }))
      .filter(item => !query || usedFloqrSearch || item.intentScore > 0 || contextualSearchMatch(query, publicProfileHaystack(item.profile)))
      .sort((a,b) => (b.intentScore + b.sharedScore) - (a.intentScore + a.sharedScore))
      .slice(0, 40);
    grid.innerHTML = matches.length ? "" : '<div class="empty">No public Mingl profiles matched that search yet. Try interests like fast cars, Latin events, Afro House, travel, food, city, or hobbies.</div>';
    matches.forEach(({profile, sharedScore, intentScore}, index) => {
      const uid = profile.uid || profile.id;
      const status = connectionStatusFor(uid);
      const photoUrl = profileMinglPhoto(profile);
      const card = document.createElement("div");
      card.className = "mingl-person-card";
      const buttonText = status.state === "mutual" ? "Open Mingl Chat" : status.state === "sent" ? "Mingl Request Sent" : status.state === "received" ? "Mingl Back" : "Let's Mingl";
      const sharedLabels = sharedDataPointLabels(cachedUserProfile || {}, profile).slice(0, 5);
      const isMutual = status.state === "mutual";
      const matchReasonOnly = !isMutual;
      const matchReasonText = sharedLabels.length > 1
        ? (window.FLOQRI18n?.t?.("mingl.matchReasonCount", {n: sharedLabels.length}) || `Matched on ${sharedLabels.length} shared interest areas`)
        : (window.FLOQRI18n?.t?.("mingl.matchReason") || "Matched on shared interests");
      card.innerHTML = `
        <div class="mingl-person-photo">${photoUrl ? `<img src="${esc(photoUrl)}" alt="${esc(profile.displayName || "Mingl profile")}">` : `<span>${esc((profile.displayName || profile.username || "M").slice(0,1).toUpperCase())}</span>`}</div>
        <div>
          <h3>${esc(profile.displayName || profile.username || "Mingl Member")}</h3>
          ${profileContactLine(profile) ? `<div class="mingl-contact-row">${profileContactLine(profile)}</div>` : ""}
          <small>${sharedScore} shared profile matches${query ? ` - ${intentScore} search signals` : ""}</small>
          ${matchReasonOnly
            ? (sharedLabels.length ? `<div class="mingl-shared-row mingl-match-reason-only"><span>${esc(matchReasonText)}</span></div>` : "")
            : (sharedLabels.length ? `<div class="mingl-shared-row">${sharedLabels.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : "")}
          ${matchReasonOnly ? "" : `<div class="mingl-nested-datapoints">${renderProfileDatapoints(profile, `match-${esc(uid)}`)}</div>`}
          <button class="primary" type="button" ${status.state === "sent" ? "disabled" : ""}>${esc(buttonText)}</button>
        </div>`;
      card.querySelector("button").addEventListener("click", () => handleMinglAction(profile));
      grid.appendChild(card);
      if ((index + 1) % 4 === 0) {
        const ad = window.FLOQRAdCampaigns?.pickCampaign?.("mingl", cachedUserProfile || profile || {}) || AD_CONTENT.mingl || AD_CONTENT.default;
        if (ad) {
          const adCard = document.createElement("div");
          adCard.className = "mingl-person-ad-card";
          adCard.innerHTML = `
            <div class="mingl-person-photo">${ad.image ? `<img src="${esc(ad.image)}" alt="${esc(ad.title || "Sponsored")}">` : `<span>Ad</span>`}</div>
            <div>
              <span class="ad-badge">${esc(ad.badge || "Sponsored")}</span>
              <h3>${esc(ad.title || "Sponsored")}</h3>
              <p>${esc(ad.body || "")}</p>
              <small>${esc(ad.callToAction || "Learn more")}</small>
            </div>`;
          grid.appendChild(adCard);
        }
      }
    });
    setupDatapointPopouts(grid);
  }

  async function handleMinglAction(profile) {
    const targetUid = profile.uid || profile.id;
    const status = connectionStatusFor(targetUid);
    if (status.state === "mutual") {
      openMinglChat(status.connection);
      return;
    }
    return (window.FLOQRActionFeedback?.run || ((messages, action) => action()))({
      starting: status.state === "received" ? "Opening Mingl Chat..." : "Sending Let's Mingl request...",
      wait: status.state === "received" ? "We are confirming the mutual Mingl approval." : "We are sending your Friend or Mingl Request.",
      success: status.state === "received" ? "Mingl approved" : "Let's Mingl request sent",
      redirecting: status.state === "received" ? "Both patrons approved. Opening Mingl Chat." : "Friend or Mingl Request sent, returning to Mingl.",
      returnTo:"Mingl"
    }, async () => {
    const id = pairId(currentUser.uid, targetUid);
    const connectionRef = db.collection("minglConnections").doc(id);
    const sharedLabels = sharedDataPointLabels(cachedUserProfile || {}, profile).slice(0, 8);
    const summary = {
      [currentUser.uid]: {
        displayName: cachedUserProfile?.displayName || currentUser.displayName || currentUser.email || "Patron",
        photoURL: currentUser.photoURL || cachedUserProfile?.photoURL || ""
      },
      [targetUid]: {
        displayName: profile.displayName || profile.username || "Mingl Member",
        photoURL: profile.photoURL || ""
      }
    };
    const nextStatus = status.state === "received" ? "mutual" : "pending";
    const existing = status.connection || {};
    // Preserve existing participant order so Firestore rules / merges stay stable.
    const participants = Array.isArray(existing.participants) && existing.participants.length === 2
      ? existing.participants.slice()
      : [currentUser.uid, targetUid];
    if (!participants.includes(currentUser.uid)) participants[0] = currentUser.uid;
    if (!participants.includes(targetUid)) participants[1] = targetUid;
    const payload = {
      connectionId:id,
      participants,
      requestedBy: status.state === "received" ? (existing.requestedBy || targetUid) : currentUser.uid,
      requestedTo: status.state === "received" ? (existing.requestedTo || currentUser.uid) : targetUid,
      status: nextStatus,
      userSummaries: {...(existing.userSummaries || {}), ...summary},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (status.state === "received" || status.state === "sent") {
      await connectionRef.set(payload, {merge:true});
    } else {
      await connectionRef.set({
        ...payload,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    await recordMinglRequest({connectionId:id, targetUid, targetProfile:profile, nextStatus, sharedLabels});
    if (nextStatus === "mutual") {
      const roomId = await ensureMinglChatRoom(id, participants, summary);
      await addMinglSystemMessage(roomId, id, participants, minglRequestBody(profile, sharedLabels, "mutual"));
    }
    setStatus(nextStatus === "mutual" ? "You both Mingled back. Chat is now open." : "Mingl request sent.");
    await loadMingl();
    });
  }

  async function denyMinglRequest(connection, profile = {}) {
    const connectionId = connection?.connectionId || connection?.id;
    if (!currentUser || !connectionId) return;
    return (window.FLOQRActionFeedback?.run || ((messages, action) => action()))({
      starting:"Declining Mingl request…",
      wait:"FLOQR is updating this Friend or Mingl Request.",
      success:"Mingl request declined",
      redirecting:"The request status has been updated.",
      returnTo:"Mingl"
    }, async () => {
      const ref = db.collection("minglConnections").doc(connectionId);
      await ref.set({
        status:"denied",
        deniedByUid:currentUser.uid,
        deniedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      const otherUid = (connection.participants || []).find(uid => uid !== currentUser.uid) || connection.requestedBy || "";
      if (otherUid) {
        await db.collection("inboxNotifications").add({
          type:"minglRequestDenied",
          title:"Friend or Mingl Request Update",
          subject:"Friend or Mingl Request Update",
          body:`${cachedUserProfile?.displayName || currentUser.displayName || "A FLOQR patron"} declined the Friend or Mingl Request.`,
          recipientUid:otherUid,
          connectionId,
          read:false,
          createdAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await db.collection("minglAudit").add({
        type:"mingl_request_denied",
        actorUid:currentUser.uid,
        participants:connection.participants || [currentUser.uid, otherUid].filter(Boolean),
        connectionId,
        targetName:profile.displayName || profile.username || "Mingl Member",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await loadMingl();
    });
  }

  async function ensureMinglChatRoom(connectionId, participants, summaries) {
    const roomId = `mingl_${connectionId}`;
    await db.collection("chatRooms").doc(roomId).set({
      id: roomId,
      type: "mingl",
      title: "Mingl Chat",
      connectionId,
      participants,
      userSummaries: summaries || {},
      lastMessage: "",
      unreadCounts: {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    return roomId;
  }

  async function addMinglSystemMessage(roomId, connectionId, participants, body) {
    try {
      await db.collection("chatMessages").add({
        roomId,
        roomType:"mingl",
        messageType:"system",
        connectionId,
        participants,
        senderUid:"system",
        senderName:"System Message",
        body,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {
      console.warn("Could not write Mingl system message:", e.message);
    }
  }

  async function renderMinglChats() {
    const list = byId("minglChatList");
    if (!list || !currentUser) return;
    const fallbackRoomIds = minglConnections
      .filter(connection => connection.status === "mutual")
      .map(connection => `mingl_${connection.connectionId || connection.id}`)
      .filter(Boolean);
    const rooms = (await getParticipantCollectionSafe("chatRooms", currentUser.uid, 1000, fallbackRoomIds)).filter(x => x.type === "mingl");
    list.innerHTML = rooms.length ? "" : "<p class='sub'>No Mingl chats yet. Send a Mingl request and wait for them to Mingl back.</p>";
    rooms.forEach(room => {
      const otherUid = (room.participants || []).find(uid => uid !== currentUser.uid);
      const other = room.userSummaries?.[otherUid] || {};
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mingl-chat-item";
      item.innerHTML = `<strong>${esc(other.displayName || room.title || "Mingl Chat")}</strong><span>${esc(room.lastMessage || "Open chat")}</span>`;
      item.addEventListener("click", () => openMinglChat(room));
      list.appendChild(item);
    });
  }

  function renderMinglRequests() {
    const wrap = byId("minglRequestsList");
    if (!wrap || !currentUser) return;
    const rows = minglConnections
      .filter(connection => ["pending","sent","received"].includes(String(connection.status || "pending").toLowerCase()))
      .sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    const sentRows = rows.filter(connection => connectionStatusFor((connection.participants || []).find(uid => uid !== currentUser.uid) || connection.requestedTo || connection.requestedBy || "").state === "sent");
    const receivedRows = rows.filter(connection => connectionStatusFor((connection.participants || []).find(uid => uid !== currentUser.uid) || connection.requestedTo || connection.requestedBy || "").state === "received");
    const statusBtn = byId("minglRequestStatusBtn");
    if (statusBtn) statusBtn.textContent = `(${sentRows.length}/${receivedRows.length})`;
    renderMinglRequestStatusPopout(sentRows, receivedRows);
    wrap.innerHTML = rows.length ? "" : "<p class='sub'>No pending Mingl requests.</p>";
    const sections = [
      {title:"Sent Mingl/Friend Request", rows:sentRows, empty:"No sent requests waiting for a Mingl back."},
      {title:"Received Mingl/Friend Request", rows:receivedRows, empty:"No received requests waiting on you."}
    ];
    sections.forEach(section => {
      if (!section.rows.length) return;
      const heading = document.createElement("h3");
      heading.className = "mingl-request-section-title";
      heading.textContent = section.title;
      wrap.appendChild(heading);
      section.rows.forEach(connection => renderMinglRequestItem(wrap, connection));
    });
    if (!sentRows.length && !receivedRows.length && rows.length) rows.forEach(connection => renderMinglRequestItem(wrap, connection));
  }

  function renderMinglRequestItem(wrap, connection) {
      const otherUid = (connection.participants || []).find(uid => uid !== currentUser.uid) || connection.requestedTo || connection.requestedBy || "";
      const profile = minglCandidates.find(x => (x.uid || x.id) === otherUid) || connection.userSummaries?.[otherUid] || {};
      const state = connectionStatusFor(otherUid).state;
      const item = document.createElement("div");
      item.className = "queue-item mingl-request-item";
      const label = state === "received"
        ? "Received request"
        : state === "sent"
          ? "Sent request"
          : "Pending request";
      const detail = state === "received"
        ? "This patron wants to Mingl with you. Tap Mingl Back to approve."
        : state === "sent"
          ? "Waiting for this patron to Mingl back."
          : "Friend or Mingl Request is pending.";
      const action = state === "received"
        ? `<button class="primary" data-mingl-action="accept" type="button">Accept Mingl</button><button data-mingl-action="deny" type="button">Deny</button>`
        : state === "mutual" ? `<button class="primary" data-mingl-action="open" type="button">Open Mingl Chat</button>` : "";
      const shared = (connection.sharedDatapoints || []).slice(0,4).filter(Boolean);
      item.innerHTML = `<div class="mingl-request-copy">
        <strong>${esc(profile.displayName || profile.username || "Mingl Member")}</strong>
        <span>${esc(label)}</span>
        <small>${esc(detail)}</small>
        ${shared.length ? `<small class="mingl-request-shared">Shared: ${esc(shared.join(", "))}</small>` : ""}
      </div>
      ${action ? `<div class="mingl-request-actions">${action}</div>` : ""}`;
      item.querySelector("[data-mingl-action='accept']")?.addEventListener("click", () => handleMinglAction({...profile, uid:otherUid}));
      item.querySelector("[data-mingl-action='deny']")?.addEventListener("click", () => denyMinglRequest(connection, profile));
      item.querySelector("[data-mingl-action='open']")?.addEventListener("click", () => openMinglChat(connection));
      wrap.appendChild(item);
  }

  function renderMinglRequestStatusPopout(sentRows = [], receivedRows = []) {
    const popout = byId("minglRequestStatusPopout");
    if (!popout) return;
    const itemName = connection => {
      const otherUid = (connection.participants || []).find(uid => uid !== currentUser.uid) || connection.requestedTo || connection.requestedBy || "";
      const profile = minglCandidates.find(x => (x.uid || x.id) === otherUid) || connection.userSummaries?.[otherUid] || {};
      return profile.displayName || profile.username || "Mingl Member";
    };
    popout.innerHTML = `<div class="mingl-request-status-grid">
      <section><strong>Sent Mingl/Friend Request</strong><p>${sentRows.length} waiting for Mingl back.</p>${sentRows.slice(0,5).map(row => `<span>${esc(itemName(row))}</span>`).join("") || "<span>None</span>"}</section>
      <section><strong>Received Mingl/Friend Request</strong><p>${receivedRows.length} waiting for you.</p>${receivedRows.slice(0,5).map(row => `<span>${esc(itemName(row))}</span>`).join("") || "<span>None</span>"}</section>
    </div>`;
  }

  function minglLanguageSettings() {
    const settings = cachedUserProfile?.languageSettings || {};
    return {
      aiGrammarEnabled: settings.aiGrammarEnabled === true,
      correctionMode: settings.correctionMode || "approvalRequired",
      highlightSpellingErrors: settings.highlightSpellingErrors !== false,
      highlightGrammarSuggestions: settings.highlightGrammarSuggestions !== false,
      preferredLanguage: settings.preferredLanguage || "auto",
      tonePreference: settings.tonePreference || "keepTone"
    };
  }

  function updateMinglGrammarControls() {
    const settings = minglLanguageSettings();
    const button = byId("improveMinglMessageBtn");
    const hint = byId("minglGrammarHint");
    if (button) button.classList.toggle("hidden", !settings.aiGrammarEnabled);
    if (hint && !settings.aiGrammarEnabled) {
      hint.textContent = "Enable grammar help in My Profile and Settings > Language Settings.";
      hint.classList.add("hidden");
    }
  }

  function highlightMinglDraft() {
    const input = byId("minglMessageInput");
    const hint = byId("minglGrammarHint");
    if (!input) return;
    const settings = minglLanguageSettings();
    input.classList.remove("grammar-spelling-warning", "grammar-grammar-warning");
    if (!settings.aiGrammarEnabled || !window.FLOQRGrammar?.localDetectPossibleTypos) {
      if (hint) hint.classList.add("hidden");
      return;
    }
    const issues = window.FLOQRGrammar.localDetectPossibleTypos(input.value || "", settings.preferredLanguage);
    const hasSpelling = issues.some(issue => issue.type === "spelling");
    const hasGrammar = issues.some(issue => issue.type === "grammar");
    input.classList.toggle("grammar-spelling-warning", settings.highlightSpellingErrors && hasSpelling);
    input.classList.toggle("grammar-grammar-warning", settings.highlightGrammarSuggestions && hasGrammar);
    if (hint) {
      hint.textContent = issues.length ? "Possible typo or grammar issue found. Tap Fix Grammar to review a suggestion." : "";
      hint.classList.toggle("hidden", !issues.length);
    }
  }

  function appendMinglBubble(message = {}) {
    const wrap = byId("minglMessages");
    if (!wrap) return null;
    wrap.querySelector(".mingl-empty-state")?.remove();
    const bubble = document.createElement("div");
    bubble.className = `mingl-message ${message.mine ? "mine" : ""} ${message.system ? "system" : ""} ${message.pending ? "pending" : ""}`.trim();
    if (message.id) bubble.dataset.messageId = message.id;
    const label = message.system ? "System Message" : (message.mine ? "" : (message.senderName || "Member"));
    bubble.innerHTML = `${label ? `<strong>${esc(label)}</strong>` : ""}<p>${esc(message.body || "")}</p>${minglMessageMediaHtml(message)}<small>${esc(message.time || new Date().toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}))}${message.pending ? " - sending" : ""}</small>`;
    wrap.appendChild(bubble);
    wrap.scrollTop = wrap.scrollHeight;
    return bubble;
  }

  function showMinglGrammarSuggestion(original, result, input) {
    document.querySelector(".floqr-grammar-modal")?.remove();
    const modal = document.createElement("div");
    modal.className = "floqr-grammar-modal";
    modal.innerHTML = `<div class="floqr-grammar-dialog" role="dialog" aria-modal="true" aria-label="Suggested Correction">
      <h2>Suggested Correction</h2>
      <div class="grammar-compare">
        <div><strong>Original</strong><p>${esc(original)}</p></div>
        <div><strong>Suggested</strong><p>${esc(result.correctedText || original)}</p></div>
      </div>
      <p class="sub">${esc(result.explanation || "Review the suggestion before replacing your draft.")}</p>
      <div class="button-row">
        <button class="primary" type="button" data-grammar-use>Use Suggestion</button>
        <button type="button" data-grammar-keep>Keep Original</button>
        <button type="button" data-grammar-edit>Edit Manually</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-grammar-use]")?.addEventListener("click", () => {
      window.FLOQRGrammar?.applyCorrectionToInput?.(input, result.correctedText || original);
      modal.remove();
      highlightMinglDraft();
      input?.focus();
    });
    modal.querySelector("[data-grammar-keep]")?.addEventListener("click", () => {
      modal.remove();
      input?.focus();
    });
    modal.querySelector("[data-grammar-edit]")?.addEventListener("click", () => {
      modal.remove();
      input?.focus();
    });
  }

  async function openMinglChat(connectionOrRoom) {
    const roomId = connectionOrRoom.id?.startsWith("mingl_") ? connectionOrRoom.id : `mingl_${connectionOrRoom.connectionId || connectionOrRoom.id}`;
    window.location.href = portalChatUrl(roomId);
    return;
    activeMinglRoomId = roomId;
    const panel = byId("minglChatPanel");
    panel?.classList.remove("hidden");
    const roomDoc = await db.collection("chatRooms").doc(roomId).get();
    const room = roomDoc.exists ? {id:roomDoc.id, ...roomDoc.data()} : connectionOrRoom;
    const otherUid = (room.participants || []).find(uid => uid !== currentUser.uid);
    const other = room.userSummaries?.[otherUid] || {};
    const title = other.displayName || "Mingl Chat";
    setText("minglChatTitle", title);
    setText("minglChatStatus", "Mingl chat is open. Messages stay in this conversation.");
    const avatar = byId("minglChatAvatar");
    if (avatar) {
      avatar.innerHTML = other.photoURL || other.profilePhotoUrl
        ? `<img src="${esc(other.photoURL || other.profilePhotoUrl)}" alt="${esc(title)}">`
        : esc(title.slice(0, 1).toUpperCase() || "M");
    }
    updateMinglGrammarControls();
    loadMinglMessages();
  }

  function minglMessageAnimationClass(type = "") {
    const key = String(type || "").toLowerCase();
    if (key === "bounce") return "animate-bounce";
    if (key === "explode") return "animate-explode";
    if (key === "graffiti") return "animate-graffiti";
    return "";
  }

  function minglMessageMediaHtml(msg = {}) {
    if (!msg.mediaUrl || msg.unsent) return "";
    const fileName = esc(msg.mediaFileName || "Shared picture");
    return `<figure class="mingl-message-media"><img src="${esc(msg.mediaUrl)}" alt="${fileName}" loading="lazy"><figcaption>${fileName}</figcaption></figure>`;
  }

  function minglMessageReadByOther(msg = {}) {
    if (!currentUser || msg.senderUid !== currentUser.uid) return false;
    const readBy = msg.readBy || {};
    return (msg.participants || []).some(uid => uid && uid !== currentUser.uid && readBy[uid] === true);
  }

  function minglReadReceiptHtml(msg = {}, mine = false) {
    if (!mine || msg.senderUid === "system" || msg.messageType === "system" || msg.unsent) return "";
    return minglMessageReadByOther(msg)
      ? ` <span class="mingl-read-receipt" title="Read by recipient">👍 Read</span>`
      : ` <span class="mingl-read-receipt unread" title="Not read yet">Sent</span>`;
  }

  function markMinglMessagesRead(rows = []) {
    if (!currentUser || !activeMinglRoomId) return;
    const unreadIncoming = rows.filter(msg => (
      msg.id &&
      msg.senderUid &&
      msg.senderUid !== currentUser.uid &&
      msg.senderUid !== "system" &&
      (msg.participants || []).includes(currentUser.uid) &&
      !(msg.readBy || {})[currentUser.uid]
    ));
    if (!unreadIncoming.length) return;
    unreadIncoming.forEach(msg => {
      db.collection("chatMessages").doc(msg.id).set({
        readBy:{[currentUser.uid]:true},
        readAtBy:{[currentUser.uid]:firebase.firestore.FieldValue.serverTimestamp()},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(error => console.warn("Mingl read receipt skipped:", error.message));
    });
    db.collection("chatRooms").doc(activeMinglRoomId).set({
      unreadCounts:{[currentUser.uid]:0},
      lastReadAtBy:{[currentUser.uid]:firebase.firestore.FieldValue.serverTimestamp()},
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).catch(error => console.warn("Mingl unread reset skipped:", error.message));
  }

  function safeStorageFileName(name = "image") {
    return String(name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "image";
  }

  function clearMinglAttachment() {
    minglAttachmentFile = null;
    const input = byId("minglImageInput");
    const preview = byId("minglAttachmentPreview");
    if (input) input.value = "";
    if (preview) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
    }
  }

  function renderMinglAttachmentPreview() {
    const input = byId("minglImageInput");
    const preview = byId("minglAttachmentPreview");
    minglAttachmentFile = input?.files?.[0] || null;
    if (!preview) return;
    if (!minglAttachmentFile) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }
    if (!/^image\//.test(minglAttachmentFile.type)) {
      setStatus("Mingl chat picture sharing accepts image files only.");
      clearMinglAttachment();
      return;
    }
    const url = URL.createObjectURL(minglAttachmentFile);
    preview.classList.remove("hidden");
    preview.innerHTML = `<img src="${esc(url)}" alt=""><div><strong>${esc(minglAttachmentFile.name)}</strong><button type="button" data-clear-mingl-attachment>Remove Picture</button></div>`;
    preview.querySelector("[data-clear-mingl-attachment]")?.addEventListener("click", clearMinglAttachment);
  }

  async function uploadMinglAttachment(roomId, file) {
    if (!file) return {};
    if (!storage) throw new Error("Firebase Storage is not initialized for Mingl pictures.");
    if (!/^image\//.test(file.type)) throw new Error("Mingl chat picture sharing accepts image files only.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Mingl chat pictures must be 8MB or smaller.");
    const path = `mingl-chat/${currentUser.uid}/${roomId}/${Date.now()}-${safeStorageFileName(file.name)}`;
    const snap = await storage.ref().child(path).put(file, {contentType:file.type, customMetadata:{uploadedBy:currentUser.uid, roomId}});
    return {
      mediaUrl: await snap.ref.getDownloadURL(),
      mediaType: "image",
      mediaFileName: file.name,
      mediaStoragePath: path
    };
  }

  async function updateOwnMinglMessage(messageId, patch) {
    if (!currentUser || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    await db.collection("chatMessages").doc(messageId).set({
      ...patch,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  async function autoCorrectMinglMessage(messageId) {
    if (!currentUser || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    const original = snap.data().body || "";
    if (!original.trim()) return;
    let corrected = original;
    if (window.FLOQRGrammar?.suggestGrammarCorrection) {
      const result = await window.FLOQRGrammar.suggestGrammarCorrection(original, {
        uid:currentUser.uid,
        product:"mingl",
        inputType:"sent-message",
        correctionMode:"autoFixMinor"
      });
      corrected = result.correctedText || original;
    } else {
      corrected = original.replace(/\s+/g, " ").trim();
    }
    if (corrected !== original) {
      await updateOwnMinglMessage(messageId, {
        body:corrected,
        edited:true,
        aiGrammarApplied:true,
        editedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  async function animateMinglMessage(messageId, animationType) {
    await updateOwnMinglMessage(messageId, {
      animationType,
      animatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function unsendMinglMessage(messageId) {
    if (!currentUser || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    if (minglMessageReadByOther({id:snap.id, ...snap.data()})) {
      setStatus("This Mingl message has already been read and cannot be unsent.");
      return;
    }
    await updateOwnMinglMessage(messageId, {
      body:"Message unsent.",
      unsent:true,
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function markMinglDeleteAfterRead(messageId) {
    await updateOwnMinglMessage(messageId, {
      deleteAfterRead:true,
      deleteAfterReadSetAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function expireReadOnceMinglMessages(rows = []) {
    if (!currentUser) return;
    rows.filter(msg => msg.id && msg.deleteAfterRead === true && msg.deletedAfterRead !== true && msg.senderUid !== currentUser.uid && (msg.participants || []).includes(currentUser.uid)).forEach(msg => {
      db.collection("chatMessages").doc(msg.id).set({
        body:"Message deleted after read.",
        deletedAfterRead:true,
        expiredByUid:currentUser.uid,
        expiredAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(error => console.warn("Delete-after-read expiry skipped:", error.message));
    });
  }

  async function showMinglMessageActions(messageId, anchor) {
    if (!messageId) return;
    document.querySelector(".mingl-message-action-popout")?.remove();
    let message = null;
    try {
      const snap = await db.collection("chatMessages").doc(messageId).get();
      message = snap.exists ? {id:snap.id, ...snap.data()} : null;
    } catch (error) {}
    const readByRecipient = message ? minglMessageReadByOther(message) : false;
    const unsendDisabled = readByRecipient || message?.unsent === true;
    const unsendTitle = message?.unsent ? "Message already unsent" : readByRecipient ? "Recipient has already read this message" : "Unsend while unread";
    const popout = document.createElement("div");
    popout.className = "mingl-message-action-popout";
    popout.innerHTML = `<div class="mingl-message-action-menu" role="menu" aria-label="Mingl message actions">
      <button type="button" data-action="bounce">Bounce</button>
      <button type="button" data-action="explode">Explode</button>
      <button type="button" data-action="graffiti">Throw Graffiti</button>
      <button type="button" data-action="edit">Edit</button>
      <button type="button" data-action="autocorrect">Auto Correct</button>
      <button type="button" data-action="deleteAfterRead">Delete after read</button>
      <button type="button" data-action="unsend" ${unsendDisabled ? "disabled" : ""} title="${esc(unsendTitle)}">Unsend</button>
      ${readByRecipient ? `<small class="mingl-action-note">Recipient has read this message, so Unsend is locked.</small>` : ""}
    </div>`;
    document.body.appendChild(popout);
    const rect = anchor?.getBoundingClientRect?.() || {left:24, top:160, bottom:180};
    popout.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - 280)}px`;
    popout.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 260)}px`;
    popout.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      popout.remove();
      try {
        if (action === "edit") await editMinglMessage(messageId);
        else if (action === "autocorrect") await autoCorrectMinglMessage(messageId);
        else if (action === "unsend") await unsendMinglMessage(messageId);
        else if (action === "deleteAfterRead") await markMinglDeleteAfterRead(messageId);
        else await animateMinglMessage(messageId, action);
      } catch (error) {
        setStatus(`Mingl message action failed: ${error.message || error}`);
      }
    });
  }

  function renderMinglMessages(rows = []) {
    const wrap = byId("minglMessages");
    if (!wrap || !activeMinglRoomId) return;
    expireReadOnceMinglMessages(rows);
    markMinglMessagesRead(rows);
    rows.sort((a,b) => {
      const at = a.createdAt?.seconds || 0;
      const bt = b.createdAt?.seconds || 0;
      return at - bt;
    });
    wrap.innerHTML = rows.length ? rows.map(msg => {
      const mine = msg.senderUid === currentUser.uid;
      const system = msg.senderUid === "system" || msg.messageType === "system";
      const label = system ? "System Message" : (mine ? "" : (msg.senderName || "Member"));
      const actionHint = mine && !system && !msg.unsent ? " Tap for actions." : "";
      const deletedNote = msg.deleteAfterRead ? " - delete after read" : "";
      return `<div class="mingl-message ${mine ? "mine" : ""} ${system ? "system" : ""} ${msg.unsent ? "unsent" : ""} ${minglMessageAnimationClass(msg.animationType)}" data-message-id="${esc(msg.id || "")}" ${mine && !system && !msg.unsent ? 'tabindex="0" data-own-message="1"' : ""}>
        ${label ? `<strong>${esc(label)}</strong>` : ""}
        <p>${esc(msg.body || "")}</p>
        ${minglMessageMediaHtml(msg)}
        <small>${esc(msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString() : "")}${msg.edited ? " - edited" : ""}${msg.unsent ? " - unsent" : ""}${deletedNote}${minglReadReceiptHtml(msg, mine)}${actionHint}</small>
      </div>`;
    }).join("") : "<p class='mingl-empty-state'>Start the conversation.</p>";
    wrap.querySelectorAll("[data-own-message]").forEach(node => {
      node.addEventListener("click", () => showMinglMessageActions(node.dataset.messageId, node));
      node.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showMinglMessageActions(node.dataset.messageId, node);
        }
      });
    });
    wrap.scrollTop = wrap.scrollHeight;
  }

  function loadMinglMessages() {
    const wrap = byId("minglMessages");
    if (!wrap || !activeMinglRoomId) return;
    if (minglMessagesUnsubscribe) minglMessagesUnsubscribe();
    wrap.innerHTML = "<p class='sub'>Loading Mingl messages...</p>";
    try {
      minglMessagesUnsubscribe = db.collection("chatMessages")
        .where("roomId", "==", activeMinglRoomId)
        .where("participants", "array-contains", currentUser.uid)
        .onSnapshot(snap => renderMinglMessages(snap.docs.map(doc => ({id:doc.id, ...doc.data()}))), () => {
          getCollectionSafe("chatMessages", x => x.roomId === activeMinglRoomId, 1000).then(renderMinglMessages);
        });
    } catch(e) {
      getCollectionSafe("chatMessages", x => x.roomId === activeMinglRoomId, 1000).then(renderMinglMessages);
    }
  }

  async function sendMinglMessage() {
    const input = byId("minglMessageInput");
    const body = input?.value.trim();
    const attachmentFile = minglAttachmentFile || byId("minglImageInput")?.files?.[0] || null;
    if (!currentUser || !activeMinglRoomId || (!body && !attachmentFile)) return;
    const roomSnap = await db.collection("chatRooms").doc(activeMinglRoomId).get();
    if (!roomSnap.exists || !(roomSnap.data().participants || []).includes(currentUser.uid)) {
      setStatus("Mingl chat is available only after both patrons Mingl back.");
      return;
    }
    const room = roomSnap.data();
    const unreadCounts = {...(room.unreadCounts || {})};
    (room.participants || []).forEach(uid => { if (uid !== currentUser.uid) unreadCounts[uid] = Number(unreadCounts[uid] || 0) + 1; });
    let mediaPayload = {};
    let pending = null;
    try {
      if (attachmentFile) mediaPayload = await uploadMinglAttachment(activeMinglRoomId, attachmentFile);
      if (input) input.value = "";
      clearMinglAttachment();
      highlightMinglDraft();
      pending = appendMinglBubble({body:body || "Shared a picture.", mine:true, pending:true, mediaUrl:mediaPayload.mediaUrl, mediaFileName:mediaPayload.mediaFileName});
      await db.collection("chatMessages").add({
        roomId: activeMinglRoomId,
        roomType: "mingl",
        connectionId: room.connectionId || "",
        participants: room.participants || [],
        senderUid: currentUser.uid,
        senderName: cachedUserProfile?.displayName || currentUser.displayName || currentUser.email || "Member",
        body: body || "Shared a picture.",
        ...mediaPayload,
        edited:false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("chatRooms").doc(activeMinglRoomId).set({
        lastMessage: body || "Shared a picture.",
        unreadCounts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await renderMinglChats();
    } catch(e) {
      pending?.remove();
      if (input) input.value = body;
      minglAttachmentFile = attachmentFile;
      setStatus(`Could not send Mingl message: ${minglUploadErrorMessage(e)}`);
    }
  }

  async function editMinglMessage(messageId) {
    if (!currentUser || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    const next = prompt("Edit Mingl message", snap.data().body || "");
    if (next == null || !next.trim()) return;
    await db.collection("chatMessages").doc(messageId).set({
      body:next.trim(),
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  async function improveMinglDraft() {
    const input = byId("minglMessageInput");
    const draft = input?.value.trim();
    if (!input || !draft) return;
    const settings = minglLanguageSettings();
    if (window.FLOQRGrammar?.suggestGrammarCorrection) {
      const result = await window.FLOQRGrammar.suggestGrammarCorrection(draft, {
        uid:currentUser?.uid || "",
        product:"mingl",
        inputType:"chat",
        preferredLanguage:settings.preferredLanguage,
        tonePreference:settings.tonePreference,
        correctionMode:settings.correctionMode
      });
      const corrected = result?.correctedText || draft;
      if (settings.correctionMode === "autoFixMinor" && Number(result?.confidence || 0) >= 0.7) {
        window.FLOQRGrammar.applyCorrectionToInput(input, corrected);
        highlightMinglDraft();
        return;
      }
      showMinglGrammarSuggestion(draft, {...result, correctedText:corrected}, input);
      return;
    }
    input.value = draft.replace(/\bi\b/g, "I").replace(/\s+/g, " ").trim();
    highlightMinglDraft();
  }

  function insertMinglEmoji(emoji) {
    const input = byId("minglMessageInput");
    if (!input) return;
    input.value = `${input.value}${emoji}`;
    highlightMinglDraft();
    input.focus();
  }

  async function renderEventGrid() {
    const grid = byId("locationGrid");
    const s = byId("locationSearch")?.value || "";
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const sourceRecords = window.FLOQRAISearch ? window.FLOQRAISearch.eventsToRecords(events) : Object.entries(events).map(([id,e]) => ({id, data:e, title:e.eventName || id}));
    const searched = window.floqrSearch ? await window.floqrSearch(s, {records:sourceRecords, db, currentUser, profile:cachedUserProfile, role:"patron", source:"events"}) : sourceRecords;
    const context = await userLocationContext();
    context.query = s;
    const ranked = window.FLOQRLocationAI ? await window.FLOQRLocationAI.rankLocationsForUser(searched, context) : searched;
    setText("locationRankingStatus", `Ranking active: using ${context.source || context.locationSource || "profile/browser"} location plus preferred cities, genres, venue types, and interests. Deny browser location to confirm profile fallback.`);
    const matches = ranked
      .map(record => [record.id, record.data || events[record.id]])
      .filter(([id,e]) => e && (!country || e.country === country) && (!region || e.region === region) && (!city || e.city === city) && (!genre || (e.genres||[]).includes(genre)));
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching events found.</div>';
    matches.forEach(([id,e]) => {
      const loc = getLocation(e.locationId);
      const card = document.createElement("div");
      card.className = "club-option";
      const publicLocation = window.FLOQRAddress?.publicLocation?.(e) || [e.city, e.region || e.stateRegion || e.country].filter(Boolean).join(", ");
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(e.eventName)}</h3><p>${esc(loc.locationName || e.locationId)} • ${esc(publicLocation)}</p></div><strong>${esc(e.eventDay || "")}</strong></div><p class="dj">${esc((e.genres||[]).join(" • "))}</p><div class="badge-row"><span>${esc(e.eventDate || "")}</span><span>${esc(e.eventTime || "")}</span>${(e.artists||[]).slice(0,2).map(a=>`<span>${esc(a)}</span>`).join("")}</div></div><button class="primary" type="button">Buy Ticket / ShoutOut</button>`;
      card.querySelector("button").addEventListener("click", () => {
        const msg = "Ticket checkout will be connected in the next payment integration. For now, you can throw a ShoutOut at this event location.";
        alert(msg);
        selectLocationForShoutOut(e.locationId);
      });
      grid.appendChild(card);
    });
  }

  async function renderLocationGrid() {
    const grid = byId("locationGrid");
    const type = byId("listingType").value || "clubs";
    const s = byId("locationSearch")?.value || "";
    const country = byId("countryFilter")?.value || "", region = byId("regionFilter")?.value || "", city = byId("cityFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const sourceRecords = window.FLOQRAISearch ? window.FLOQRAISearch.locationsToRecords(locations) : Object.entries(locations).map(([id,l]) => ({id, data:l, title:l.locationName || id}));
    const searched = window.floqrSearch ? await window.floqrSearch(s, {records:sourceRecords, db, currentUser, profile:cachedUserProfile, role:"patron", source:"clubLocations"}) : sourceRecords;
    const context = await userLocationContext();
    context.query = s;
    const ranked = window.FLOQRLocationAI ? await window.FLOQRLocationAI.rankLocationsForUser(searched, context) : searched;
    setText("locationRankingStatus", `Ranking active: using ${context.source || context.locationSource || "profile/browser"} location plus preferred cities, genres, venue types, and interests. Deny browser location to confirm profile fallback.`);
    const matches = ranked.map(record => [record.id, record.data || locations[record.id]]).filter(([id,l]) => {
      if (!l) return false;
      const actionBase = byId("clubActionsPage")?.getAttribute("data-category-type") || "clubs";
      const effectiveType = type.startsWith("club-action:") ? actionBase : type;
      const typeOk =
        effectiveType === "lounges" ? (l.type === "lounge" || (l.categories||[]).includes("Lounges")) :
        effectiveType === "lounge-club" ? (l.type === "lounge-club" || (l.categories||[]).includes("Lounge-Club")) :
        effectiveType === "beach-clubs" ? (l.type === "beach-club" || (l.categories||[]).includes("Beach Clubs")) :
        effectiveType === "clubs" || effectiveType === "shoutout" ? (l.type === "club" || l.type === "lounge-club" || l.type === "beach-club" || (l.categories||[]).includes("Clubs")) :
        true;
      return l && typeOk && (!country || l.country === country) && (!region || l.region === region) && (!city || l.city === city) && (!genre || (l.genres||[]).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching results found.</div>';
    matches.forEach(([id,l]) => {
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(l.locationName)}</h3><p>${esc(l.locationLabel)}</p></div><strong>${esc(l.country)}</strong></div><p class="dj">${esc((l.genres||[]).join(" • "))}</p><div class="badge-row">${(l.activityDates||[]).slice(0,4).map(x => `<span>${esc(x)}</span>`).join("")}</div></div><div class="queue-actions"><a class="buttonlike" href="./club-profile.html?location=${encodeURIComponent(id)}&v=29.09.8">View Club</a><button class="primary" type="button">${type === "shoutout" ? "Throw ShoutOut Here" : type.startsWith("club-action:") ? "Continue" : "Select"}</button></div>`;
      card.querySelector("button").addEventListener("click", () => selectLocationForShoutOut(id));
      grid.appendChild(card);
    });
  }

  async function selectLocationForShoutOut(id) {
    selectedLocationId = await resolveLocationAlias(id);
    const loc = await loadLocationById(selectedLocationId);
    setText("selectedClubTitle", loc.locationName);
    setText("selectedClubMeta", `${loc.locationLabel} • ${(loc.genres||[]).join(" / ")}`);
    selectedTemplate = "blackwhite";
    selectedScreenFormatId = loc.primaryDisplayScreenFormatId || loc.displayScreenFormatIds?.[0] || "led-96x48";
    selectedTemplateVariant = null;
    await loadTemplateVariants();
    if (byId("templateSearch")) byId("templateSearch").value = "";
    renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage");
  }
  function showTemplateSelection(){ renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage"); }
  function templateSearchText(t) {
    return `${t.name || ""} ${t.category || ""} ${t.scope || ""} ${t.mediaMode || ""} ${t.description || ""} ${(t.tags || []).join(" ")} ${(t.searchKeywords || []).join(" ")} ${t.supportsMedia || t.supportsImage || t.supportsVideo ? "image video photo media placeholder upload" : "no image no video classic text only"}`.toLowerCase();
  }
  function templateContextQuery() {
    const explicitContext = window.FLOQR_TEMPLATE_CONTEXT_QUERY || document.body?.dataset?.templateContextQuery || "";
    return String(explicitContext || "").trim().toLowerCase();
  }
  function variantSearchText(variant = {}) {
    return `${variant.variantName || ""} ${variant.baseTemplateName || ""} ${variant.ownerDisplayName || ""} ${(variant.tags||[]).join(" ")} ${(variant.searchKeywords||[]).join(" ")} ${variant.promptShared ? variant.aiPrompt || "" : ""}`.toLowerCase();
  }
  function clubAllowsPatronBackgroundEditing() {
    return getLocation()?.patronTemplateBackgroundEditingEnabled !== false;
  }
  function templateBackgroundCanBeCustomized(template = {}) {
    return clubAllowsPatronBackgroundEditing() && template.backgroundEditable !== false;
  }
  function patronVariantAllowedAtClub(variant = {}) {
    return clubAllowsPatronBackgroundEditing() && getTemplate(variant.baseTemplateId || "blackwhite").backgroundEditable !== false;
  }
  async function openStudioForTemplate(template) {
    if (!clubAllowsPatronBackgroundEditing()) {
      alert("This club has disabled patron background customization. You can still use the original and club-curated templates.");
      return;
    }
    if (template.backgroundEditable === false) {
      alert("This template background is locked. You can still use its original approved design.");
      return;
    }
    if (!window.FLOQRStudio) {
      alert("FLOQR Studio is not loaded.");
      return;
    }
    await window.FLOQRStudio.openFloqrTemplateStudio({
      db,
      storage,
      currentUser,
      baseTemplateId:template.id,
      baseTemplate:template,
      onSaved:async variant => {
        await loadTemplateVariants();
        selectedTemplate = variant.baseTemplateId || template.id;
        selectedTemplateVariant = variant;
        renderTemplates();
        updateTemplateSummary();
      }
    });
  }
  function templateCard(template, options = {}) {
    const selected = !selectedTemplateVariant && template.id === selectedTemplate;
    const canCustomize = templateBackgroundCanBeCustomized(template);
    const venueFormats = getLocation()?.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || [];
    const supportedFormats = window.FLOQRTextLayout?.supportedFormatIds?.(template, venueFormats) || venueFormats;
    return `<div class="template ${esc(template.className || "neon")} ${selected ? "selected" : ""}" role="button" tabindex="0" data-template-id="${esc(template.id)}">
      <div class="template-mini-preview"><strong>${esc(template.defaultMain || "SHOUTOUT")}</strong><span>${esc(template.defaultSub || template.category || "")}</span></div>
      <div class="name">${esc(template.name)}</div>
      <div class="tag">${esc(template.mediaMode || (template.supportsMedia ? "Image/video placeholder" : "No image/video"))}</div>
      <div class="tag-row">${template.priceCents ? `<span>${esc(template.priceLabel || `$${(Number(template.priceCents) / 100).toFixed(2)}`)}</span>` : ""}<span>${supportedFormats.length}/${venueFormats.length} display sizes</span>${(template.tags || []).slice(0,3).map(tag => `<span>${esc(tag)}</span>`).join("")}</div>
      <div class="button-row template-card-actions">
        <button type="button" data-template-open="${esc(template.id)}">Use</button>
        ${canCustomize ? `<button type="button" data-template-customize="${esc(template.id)}">Customize Background</button>` : `<span class="template-background-lock">${template.backgroundEditable === false ? "Background locked" : "Club customization off"}</span>`}
      </div>
    </div>`;
  }
  function variantCard(variant = {}, scope = "community") {
    const base = getTemplate(variant.baseTemplateId || "blackwhite");
    const selected = selectedTemplateVariant && (selectedTemplateVariant.id || selectedTemplateVariant.variantId) === (variant.id || variant.variantId);
    const style = window.FLOQRStudio?.variantBackgroundStyle ? window.FLOQRStudio.variantBackgroundStyle(variant) : "";
    return `<div class="template ${esc(base.className || "neon")} ${selected ? "selected" : ""}" role="button" tabindex="0" data-variant-id="${esc(variant.id || variant.variantId || "")}" data-base-template-id="${esc(variant.baseTemplateId || base.id)}">
      <div class="template-mini-preview" style="${esc(style)}"><strong>${esc(base.defaultMain || "SHOUTOUT")}</strong><span>${esc(variant.variantName || base.category || "")}</span></div>
      <div class="name">${esc(variant.variantName || "Saved Background")}</div>
      <div class="tag">${esc(variant.baseTemplateName || base.name)}${scope === "mine" ? " - Mine" : scope === "club" ? " - Club approved" : ` - ${esc(variant.ownerDisplayName || "Community")}`}</div>
      <div class="tag-row">${(variant.tags || []).slice(0,4).map(tag => `<span>${esc(tag)}</span>`).join("")}</div>
      <button type="button" data-variant-open="${esc(variant.id || variant.variantId || "")}">Use Template</button>
    </div>`;
  }
  async function renderTemplates() {
    const grid = byId("templateGrid"); if (!grid) return; grid.innerHTML = "";
    const query = (byId("templateSearch")?.value || "").trim().toLowerCase();
    const discoveryQuery = query || templateContextQuery();
    const locationFormats = getLocation().displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || ["led-96x48"];
    const location = getLocation() || {};
    const venueSpecificIds = Object.values(templates || {}).filter(template => (template.venueIds || []).includes(locationId())).map(template => template.id).filter(Boolean);
    const standardTemplateIds = location.restrictTemplatesToLocationSet
      ? (window.SHOUTOUT_STANDARD_TEMPLATE_IDS || []).filter(id => String(id).startsWith("soccer"))
      : (window.SHOUTOUT_STANDARD_TEMPLATE_IDS || []);
    const alwaysInclude = location.restrictTemplatesToLocationSet ? [] : ["blackwhite"];
    const ids = Array.from(new Set([...alwaysInclude, ...(location.templates || []), ...venueSpecificIds, ...standardTemplateIds]));
    const official = ids.map(id => ({id, data:getTemplate(id), title:getTemplate(id).name, searchText:templateSearchText(getTemplate(id)), visibility:"public", type:"officialTemplate", sourceType:"approvedShoutOut"}))
      .filter(record => String(record.data.status || "active") === "active" && (record.data.screenFormatIds || locationFormats).some(id => locationFormats.includes(id) && window.FLOQRTextLayout?.resolve?.(record.data, id)?.supported !== false));
    const club = (templateVariants.club || []).filter(x => String(x.status || "active") === "active");
    const mine = (templateVariants.mine || []).filter(x => String(x.status || "active") === "active" && patronVariantAllowedAtClub(x));
    const community = (templateVariants.community || []).filter(x => String(x.visibility || "") === "public" && String(x.status || "active") === "active" && x.ownerUid !== currentUser?.uid && patronVariantAllowedAtClub(x));
    const allVariants = [...club, ...mine, ...community];
    if (!discoveryQuery) {
      const defaultRecord = official.find(record => record.id === "blackwhite") || official.find(record => !record.data.priceCents) || official[0];
      grid.innerHTML = `
        <section class="template-section template-section-default">
          <h3>Default Template</h3>
          <p class="sub small">Free Traditional Black and White Classic. Use FloqAi below (or search) for Sports, Jersey, VIP, Humor, Cars, Video, Pictures, and Ballers templates.</p>
          <div class="template-grid">${defaultRecord ? templateCard(defaultRecord.data) : '<div class="empty">No default template is available.</div>'}</div>
        </section>
        <section class="template-section template-section-floqai" id="templateFloqAiHost">
          <h3>FloqAi template search</h3>
          <p class="sub small">Ask FloqAi for paid templates — try Sports, Jersey, NBA, NFL, Cars, Humor, VIP, Video, Pictures, or Ballers.</p>
          <div id="templateFloqAiMount" class="template-floqai-mount"></div>
        </section>
        ${club.length ? `<section class="template-section"><h3>Club-Approved Backgrounds</h3><p class="sub small">Customized by this club's admins.</p><div class="template-grid">${club.map(variant => variantCard(variant, "club")).join("")}</div></section>` : ""}
        ${clubAllowsPatronBackgroundEditing() ? "" : '<p class="template-background-policy-note">This club has disabled patron background customization. Original and club-approved templates remain available.</p>'}`;
      window.FLOQRFloqAi?.ensureTemplateMode?.();
    } else {
      const [officialRecords, clubRecords, mineRecords, communityRecords] = window.floqrSearch ? await Promise.all([
        window.floqrSearch(discoveryQuery, {records:official, db, currentUser, profile:cachedUserProfile, role:"patron", source:"templates"}),
        window.floqrSearch(discoveryQuery, {records:club.map(x => ({id:x.id, data:x, title:x.variantName, searchText:variantSearchText(x), visibility:"club", ownerUid:x.ownerUid, type:"clubTemplateVariant", sourceType:"clubTemplateVariant"})), db, currentUser, profile:cachedUserProfile, role:"patron", source:"templates"}),
        window.floqrSearch(discoveryQuery, {records:mine.map(x => ({id:x.id, data:x, title:x.variantName, searchText:variantSearchText(x), visibility:"private", ownerUid:x.ownerUid, type:"publicTemplateVariant", sourceType:"publicTemplateVariant"})), db, currentUser, profile:cachedUserProfile, role:"patron", source:"templates"}),
        window.floqrSearch(discoveryQuery, {records:community.map(x => ({id:x.id, data:x, title:x.variantName, searchText:variantSearchText(x), visibility:"public", ownerUid:x.ownerUid, type:"publicTemplateVariant", sourceType:"publicTemplateVariant"})), db, currentUser, profile:cachedUserProfile, role:"patron", source:"templates"})
      ]) : [official.filter(record => record.searchText.includes(discoveryQuery)), club.filter(x => variantSearchText(x).includes(discoveryQuery)).map(x => ({id:x.id, data:x})), mine.filter(x => variantSearchText(x).includes(discoveryQuery)).map(x => ({id:x.id, data:x})), community.filter(x => variantSearchText(x).includes(discoveryQuery)).map(x => ({id:x.id, data:x}))];
      const officialHtml = officialRecords.map(record => templateCard(record.data)).join("");
      const clubHtml = clubRecords.map(record => variantCard(record.data, "club")).join("");
      const mineHtml = mineRecords.map(record => variantCard(record.data, "mine")).join("");
      const communityHtml = communityRecords.map(record => variantCard(record.data, "community")).join("");
      grid.innerHTML = `
        <section class="template-section"><h3>Matching Official FLOQR Templates</h3><div class="template-grid">${officialHtml || '<div class="empty">No official templates matched.</div>'}</div></section>
        ${clubHtml ? `<section class="template-section"><h3>Matching Club-Approved Backgrounds</h3><div class="template-grid">${clubHtml}</div></section>` : ""}
        ${clubAllowsPatronBackgroundEditing() && mineHtml ? `<section class="template-section"><h3>My Matching Backgrounds</h3><div class="template-grid">${mineHtml}</div></section>` : ""}
        ${clubAllowsPatronBackgroundEditing() && communityHtml ? `<section class="template-section"><h3>Matching Community Backgrounds</h3><div class="template-grid">${communityHtml}</div></section>` : ""}
        ${clubAllowsPatronBackgroundEditing() ? "" : '<p class="template-background-policy-note">This club has disabled patron background customization.</p>'}`;
    }
    grid.querySelectorAll("[data-template-open]").forEach(btn => btn.addEventListener("click", event => {
      event.stopPropagation();
      selectedTemplate = btn.dataset.templateOpen;
      selectedTemplateVariant = null;
      renderTemplates();
      updateTemplateSummary();
      goToEditor();
    }));
    grid.querySelectorAll("[data-template-customize]").forEach(btn => btn.addEventListener("click", event => {
      event.stopPropagation();
      openStudioForTemplate(getTemplate(btn.dataset.templateCustomize));
    }));
    grid.querySelectorAll("[data-variant-open]").forEach(btn => btn.addEventListener("click", event => {
      event.stopPropagation();
      const variant = allVariants.find(x => (x.id || x.variantId) === btn.dataset.variantOpen);
      if (!variant) return;
      selectedTemplate = variant.baseTemplateId || "blackwhite";
      selectedTemplateVariant = variant;
      renderTemplates();
      updateTemplateSummary();
      goToEditor();
    }));
    grid.querySelectorAll(".template[role='button']").forEach(item => {
      item.addEventListener("click", () => {
        if (item.dataset.templateId) {
          selectedTemplate = item.dataset.templateId;
          selectedTemplateVariant = null;
        } else if (item.dataset.variantId) {
          const variant = allVariants.find(x => (x.id || x.variantId) === item.dataset.variantId);
          selectedTemplate = variant?.baseTemplateId || "blackwhite";
          selectedTemplateVariant = variant || null;
        }
        renderTemplates(); updateTemplateSummary(); goToEditor();
      });
      item.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.click(); } });
    });
  }
  function updateTemplateSummary() {
    const t = getTemplate();
    document.body.dataset.selectedTemplate = t.id || selectedTemplate;
    document.body.classList.toggle("template-media-unavailable", !currentTemplateSupportsMedia());
    const variant = selectedTemplateVariant;
    const venueFormats = getLocation()?.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || [];
    const supportedFormats = window.FLOQRTextLayout?.supportedFormatIds?.(t, venueFormats) || venueFormats;
    const textCompatibility = `${supportedFormats.length} of ${venueFormats.length} venue display sizes supported; the exact text limit updates after you choose the display.`;
    const backgroundLabel = variant?.variantScope === "club" ? "Club-approved background" : t.backgroundEditable === false ? "Background locked" : clubAllowsPatronBackgroundEditing() ? "Background editable" : "Original background only";
    byId("selectedTemplateSummary").innerHTML = `<h3>${esc(variant?.variantName || t.name)}</h3><p>${esc(variant ? `Locked official layout: ${variant.baseTemplateName || t.name}. Background customized by ${variant.ownerDisplayName || "you"}.` : (t.description || "Template selected."))}</p><p class="sub small">${esc(textCompatibility)}</p><div class="badge-row"><span>${esc(t.category || "Shared")}</span><span>${esc(t.mediaMode || (t.supportsMedia ? "Image/video placeholder" : "No image/video"))}</span>${t.priceCents ? `<span>${esc(t.priceLabel || `$${(Number(t.priceCents) / 100).toFixed(2)}`)}</span>` : ""}<span>${esc(backgroundLabel)}</span>${variant ? `<span>${esc(variant.visibility || "private")}</span>` : ""}</div>`;
    updateMediaEditorForTemplate();
  }
  function displayUrl(payload, id=locationId()) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("location", id);
    if(payload){
      url.searchParams.set("main",payload.mainText||"");
      url.searchParams.set("sub",payload.subText||"");
      url.searchParams.set("template",payload.template||"neon");
      url.searchParams.set("media",payload.mediaUrl||"");
      url.searchParams.set("mediaType",payload.mediaType||"");
      url.searchParams.set("mediaFit",payload.mediaFit||"contain");
      url.searchParams.set("screenFormatId",payload.screenFormatId||"");
      url.searchParams.set("selectedMediaVersion",payload.selectedMediaVersion||"");
      url.searchParams.set("trimStart",payload.trimStart||"");
      url.searchParams.set("trimEnd",payload.trimEnd||"");
      url.searchParams.set("trimmedDuration",payload.trimmedDuration||"");
      url.searchParams.set("backgroundUrl",payload.backgroundUrl||"");
      url.searchParams.set("backgroundColor",payload.backgroundColor||"");
      url.searchParams.set("backgroundGradient",payload.backgroundGradient||"");
      if (Array.isArray(payload.teamMembers) && payload.teamMembers.length) url.searchParams.set("teamMembers", JSON.stringify(payload.teamMembers));
      if (payload.stadiumMessage) url.searchParams.set("stadiumMessage", payload.stadiumMessage);
    }
    return url.href;
  }
  function goToEditor() {
    const l=getLocation(), t=getTemplate();
    setText("editorClubTitle", l.locationName);
    setText("editorTemplateMeta", `${l.locationLabel} - Template: ${selectedTemplateVariant?.variantName || t.name}`);
    updateMediaEditorForTemplate();
    syncSoccerJerseyFields();
    updatePreview();
    showPage("editorPage");
  }
  function updatePreview() {
    const frame=byId("previewFrame");
    const mediaField = byId("shoutoutMediaUrl");
    const mediaUrl = mediaField?.value.trim() || mediaField?.dataset.previewUrl || byId("mediaUrl")?.value.trim() || "";
    const mediaType = byId("shoutoutMediaType")?.value.trim() || "";
    const textCaps = templateDisplayCaps();
    const themePayload = isFootballTeamIntro() ? footballThemePayload() : {};
    const backgroundPayload = isFootballTeamIntro() ? footballBackgroundPayload() : {};
    const previewPayload = {
      mainText:fitTemplateText(byId("mainText")?.value.trim()||"SHOUTOUT!", "main"),
      subText:fitTemplateText(byId("subText")?.value.trim()||"", "sub"),
      mediaUrl,
      mediaType,
      mediaFit:byId("shoutoutMediaFit")?.value || "contain",
      screenFormatId:byId("shoutoutScreenFormat")?.value || selectedScreenFormatId,
      selectedMediaVersion:byId("aiSelectedMediaVersion")?.value || "",
      trimStart:byId("aiTrimStart")?.value || "",
      trimEnd:byId("aiTrimEnd")?.value || "",
      trimmedDuration:byId("aiTrimmedDuration")?.value || "",
      template:selectedTemplate,
      textLayoutVersion:window.FLOQRTextLayout?.version || "",
      maxMainCharacters:textCaps.main,
      maxSubCharacters:textCaps.sub,
      lineCount:textCaps.lineCount,
      maxCharactersPerLine:textCaps.perLine,
      mainTextSizePercent:textCaps.mainTextSizePercent,
      subTextSizePercent:textCaps.subTextSizePercent,
      backgroundUrl:isFootballTeamIntro() ? (backgroundPayload.backgroundUrl || selectedTemplateVariant?.backgroundUrl || "") : (selectedTemplateVariant?.backgroundUrl || ""),
      backgroundColor:isFootballTeamIntro() ? (backgroundPayload.backgroundColor || selectedTemplateVariant?.backgroundColor || "") : (selectedTemplateVariant?.backgroundColor || ""),
      backgroundGradient:selectedTemplateVariant?.backgroundGradient || "",
      teamMembers:isFootballTeamIntro() ? footballTeamDraftMembers() : [],
      animationDurationSeconds:isFootballTeamIntro() ? 20 : null,
      stadiumMessage:isFootballTeamIntro() ? String(byId("footballTeamMessage")?.value || "").trim().slice(0, Number(textCaps.maxStadiumCharacters || 54)) : "",
      skipFinaleLineup:!!textCaps.skipFinaleLineup,
      aiPortraitMotion:!!byId("footballAiTreatment")?.checked,
      ...themePayload
    };
    if(frame) {
      const format = window.FLOQR_DISPLAY_FORMATS?.[previewPayload.screenFormatId];
      if (format) {
        frame.style.aspectRatio = `${format.pixelWidth} / ${format.pixelHeight}`;
        frame.style.height = "auto";
      }
      frame.onload = () => {
        try { frame.contentWindow?.renderShoutOutDisplay?.(previewPayload); } catch (error) {}
      };
      frame.src=displayUrl(previewPayload, locationId());
      try { frame.contentWindow?.renderShoutOutDisplay?.(previewPayload); } catch (error) {}
    }
  }
  window.updatePreview = updatePreview;

  let shoutoutPreviewTimer = null;
  function closeShoutoutPreviewModal() {
    const modal = byId("shoutoutPreviewModal");
    if (shoutoutPreviewTimer) clearTimeout(shoutoutPreviewTimer);
    shoutoutPreviewTimer = null;
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function openShoutoutPreviewModal() {
    const modal = byId("shoutoutPreviewModal");
    if (!modal) return;
    updatePreview();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    byId("closeShoutoutPreviewBtn")?.focus?.();
    if (shoutoutPreviewTimer) clearTimeout(shoutoutPreviewTimer);
    shoutoutPreviewTimer = setTimeout(closeShoutoutPreviewModal, isFootballTeamIntro() ? 20000 : 5000);
  }

  function clearConfirmationTimers() {
    if (confirmationReturnTimer) clearTimeout(confirmationReturnTimer);
    if (confirmationCountdownTimer) clearInterval(confirmationCountdownTimer);
    confirmationReturnTimer = null;
    confirmationCountdownTimer = null;
  }

  function returnToMainFromConfirmation() {
    clearConfirmationTimers();
    showPage("categoryPage");
  }

  function goToMinglFromConfirmation() {
    clearConfirmationTimers();
    setText("confirmationRedirectStatus", "Opening Mingl...");
    showMinglLanding();
  }

  function goToBartrFromConfirmation() {
    clearConfirmationTimers();
    window.location.href = "./commerce.html?v=29.09.33&from=search";
  }

  function editSubmittedShoutout() {
    clearConfirmationTimers();
    setText("confirmationRedirectStatus", "");
    goToEditor();
  }

  function showShoutoutConfirmation(payload, location, template) {
    setText("confirmRef", payload.referenceNumber);
    setText("confirmClub", location.locationName);
    setText("confirmTemplate", template.name);
    let secondsRemaining = 15;
    setText("confirmationCountdown", String(secondsRemaining));
    setText("confirmationRedirectStatus", `Returning to Search in ${secondsRemaining} seconds...`);
    showPage("confirmationPage");
    clearConfirmationTimers();
    confirmationCountdownTimer = setInterval(() => {
      secondsRemaining -= 1;
      setText("confirmationCountdown", String(Math.max(secondsRemaining, 0)));
      setText("confirmationRedirectStatus", `Returning to Search in ${Math.max(secondsRemaining, 0)} seconds...`);
      if (secondsRemaining <= 0) {
        returnToMainFromConfirmation();
      }
    }, 1000);
    confirmationReturnTimer = setTimeout(returnToMainFromConfirmation, 15000);
  }

  async function uploadShoutoutPhoto(referenceNumber) {
    if (!currentTemplateSupportsMedia()) return {};
    const file = byId("shoutoutPhoto")?.files?.[0];
    if (!file) return {};
    if (!storage) throw new Error("Firebase Storage is not initialized. Add firebase-storage-compat.js and enable Storage.");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Only JPG, PNG, and WEBP images are allowed.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be 8MB or smaller.");
    setText("uploadStatus", "Uploading photo...");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `shoutouts/${currentUser.uid}/${referenceNumber || Date.now()}/original/${Date.now()}-${safeName}`;
    const ref = storage.ref().child(path);
    const snap = await ref.put(file, { contentType: file.type, customMetadata: { uploadedBy: currentUser.uid, referenceNumber } });
    const url = await snap.ref.getDownloadURL();
    setText("uploadStatus", "Photo uploaded.");
    return {
      mediaUrl: url,
      mediaType: "image",
      mediaFileName: file.name,
      mediaStoragePath: path,
      mediaUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function uploadShoutoutMedia(referenceNumber) {
    if (!currentTemplateSupportsMedia()) return {};
    if (window.jadzUploadSelectedShoutoutMedia && byId("shoutoutMediaUpload")?.files?.[0]) {
      setText("uploadStatus", "Uploading media...");
      const media = await window.jadzUploadSelectedShoutoutMedia(referenceNumber);
      if (media?.mediaUrl) {
        setText("uploadStatus", `${media.mediaType === "video" ? "Video" : "Image"} uploaded.`);
        return media;
      }
    }
    return uploadShoutoutPhoto(referenceNumber);
  }

  function splitSuggestionValues(value) {
    if (Array.isArray(value)) return value.flatMap(splitSuggestionValues);
    if (value && typeof value === "object") return Object.values(value).flatMap(splitSuggestionValues);
    return String(value || "").split(/[,;|/]+/).map(x => x.trim()).filter(Boolean);
  }

  function profileSuggestionSignals() {
    const profile = cachedUserProfile || {};
    return {
      displayName:profile.displayName || currentUser?.displayName || "",
      city:profile.city || profile.locationCity || "",
      country:profile.country || "",
      interests:unique(splitSuggestionValues([profile.interests, profile.hobbies, profile.musicGenres, profile.favoriteMusic, profile.eventInterests, profile.favoriteBeverages, profile.travelInterests, profile.favoriteVenueTypes])).slice(0, 12)
    };
  }

  async function getPastShoutOutMemory() {
    if (!currentUser) return [];
    if (!pastShoutoutMemoryPromise) {
      pastShoutoutMemoryPromise = (async () => {
        try {
          const rows = await getCollectionSafe("shoutouts", item => item.submittedByUid === currentUser.uid || item.submittedBy === safeUser(), 60);
          return rows.slice(0, 12).map(item => ({
            mainText:item.mainText || "",
            subText:item.subText || "",
            tone:item.tone || item.aiTone || "",
            template:item.templateName || item.template || "",
            location:item.locationName || item.clubName || ""
          }));
        } catch (error) {
          return [];
        }
      })();
    }
    return pastShoutoutMemoryPromise;
  }

  function templateDisplayCaps(template = getTemplate()) {
    const t = template || {};
    const formatId = byId("shoutoutScreenFormat")?.value || selectedScreenFormatId || getLocation()?.primaryDisplayScreenFormatId || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS?.[0] || "p125-96x48";
    const resolved = window.FLOQRTextLayout?.resolve?.(t, formatId);
    if (resolved) return resolved;
    const cap = t.displayCaps || t.characterCaps || {};
    const isClassic = (t.id || selectedTemplate) === "blackwhite";
    const supportsMedia = !!(t.supportsMedia || t.supportsImage || t.supportsVideo);
    const main = Number(t.maxMainCharacters || cap.mainText || cap.main || (isClassic ? 45 : supportsMedia ? 48 : 60));
    const sub = Number(t.maxSubCharacters ?? cap.subText ?? cap.sub ?? (isClassic ? 15 : supportsMedia ? 42 : 60));
    const total = Number(t.maxMainCharacters || cap.total || (main + sub));
    return { supported:true, main, sub, total, lineCount:Number(t.lineCount || 1), perLine:Number(t.maxCharactersPerLine || main), maxMainCharacters:main, maxSubCharacters:sub, maxCharactersPerLine:Number(t.maxCharactersPerLine || main), mainTextSizePercent:Number(t.mainTextSizePercent || 20.8), subTextSizePercent:Number(t.subTextSizePercent || 7.8), formatId };
  }

  function cleanRecommendationText(value = "") {
    return String(value || "")
      .replace(/\b(?:tone|style)\s*:\s*[a-z0-9 /-]+\b/ig, "")
      .replace(/^\s*(?:tone|style)\s*[-:]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function fitTemplateText(value = "", type = "main") {
    const caps = templateDisplayCaps();
    const limit = Number(type === "sub" ? caps.sub : caps.main);
    const cleaned = cleanRecommendationText(value);
    if (caps.supported === false || limit <= 0) return "";
    if (isSoccerJerseyTemplate() && type === "sub") {
      // Soccer jersey mark: keep any characters, hard-cap at 2 glyphs.
      return glyphCap(cleaned, Math.min(2, limit));
    }
    if (isSoccerJerseyTemplate() && type === "main") {
      return glyphCap(cleaned.toUpperCase(), limit);
    }
    if (type !== "main" || caps.lineCount <= 1) return cleaned.slice(0, limit);
    const availableLines = caps.lineCount;
    const visibleLimit = Math.min(limit, caps.perLine * availableLines);
    const sourceLimit = visibleLimit + Math.max(0, availableLines - 1);
    const words = cleaned.slice(0, sourceLimit).split(/\s+/).filter(Boolean);
    const rows = [];
    let line = "";
    words.forEach(word => {
      const chunks = [];
      for (let i = 0; i < word.length; i += caps.perLine) chunks.push(word.slice(i, i + caps.perLine));
      chunks.forEach(chunk => {
        const next = line ? `${line} ${chunk}` : chunk;
        if (next.length <= caps.perLine) line = next;
        else {
          if (line && rows.length < caps.lineCount) rows.push(line);
          line = chunk;
        }
      });
    });
    if (line && rows.length < caps.lineCount) rows.push(line);
    return rows.slice(0, caps.lineCount).join("\n");
  }

  // Live typing must NOT run fitTemplateText: it trims and re-wraps, which deletes
  // spaces (and mid-word typing) on every keystroke. Only clamp raw length here.
  function clampMainTextWhileTyping(value = "") {
    const caps = templateDisplayCaps();
    if (caps.supported === false) return String(value || "");
    const maxRaw = Number(caps.main || 0) + Math.max(0, Number(caps.lineCount || 1) - 1);
    if (maxRaw <= 0) return String(value || "");
    return String(value || "").slice(0, maxRaw);
  }

  function applyFittedMainText(input) {
    if (!input) return;
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const fitted = fitTemplateText(input.value, "main");
    if (input.value === fitted) return;
    input.value = fitted;
    if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
      const cursor = Math.min(fitted.length, selectionStart);
      try { input.setSelectionRange(cursor, Math.min(fitted.length, selectionEnd)); } catch (_) {}
    }
  }

  function updateTemplateCharacterCapHint() {
    const hint = byId("templateCharacterCapHint");
    if (!hint) return;
    const caps = templateDisplayCaps();
    const t = getTemplate();
    const format = window.FLOQR_DISPLAY_FORMATS?.[caps.formatId] || {};
    const visibleCount = Array.from(String(byId("mainText")?.value || "").replace(/\r?\n/g, "")).length;
    if (caps.supported === false) {
      hint.textContent = `${format.label || caps.formatId}: not recommended for ${t.name || "this template"}. ${caps.advice || "Choose another display size."}`;
      hint.classList.add("text-limit-warning");
      return;
    }
    hint.classList.remove("text-limit-warning");
    hint.textContent = `${format.label || caps.formatId}: ${visibleCount}/${caps.main} visible main-message characters. Use up to ${caps.lineCount} line${caps.lineCount === 1 ? "" : "s"}, about ${caps.perLine} characters per line; attribution/subtext allows ${caps.sub}. Words wrap automatically and recommendations use the same limits. Minimum planned letter height: ${caps.minimumFontPixels || "reviewed"} px.`;
  }

  function suggestionEventContext() {
    const selected = byId("shoutoutEventType")?.value || "";
    const loc = getLocation() || {};
    const text = `${byId("mainText")?.value || ""} ${byId("subText")?.value || ""}`.toLowerCase();
    if (selected) return selected;
    if (/birthday|bday/.test(text)) return "birthday";
    if (/vip|table|bottle/.test(text)) return "vip-table";
    if (/(r&b|rnb|soul)/.test(text) || (loc.genres || []).some(g => /r&b|rnb|soul/i.test(g))) return "rnb";
    if (/afro|afrobeats|fufu/.test(text) || (loc.genres || []).some(g => /afro/i.test(g))) return "afrobeats";
    if (/latin|reggaeton|salsa|bachata/.test(text) || (loc.genres || []).some(g => /latin|reggaeton|salsa|bachata/i.test(g))) return "latin-reggaeton";
    return loc.type || "general-party";
  }

  function buildFallbackPersonalizedSuggestions(context = {}) {
    const tone = String(context.tone || "party").toLowerCase();
    const main = String(context.mainText || "").trim();
    const sub = String(context.subText || "").trim();
    const profile = context.profileSignals || {};
    const name = (profile.displayName || "").split(/\s+/)[0] || "";
    const venue = getLocation()?.locationName || "tonight";
    const genres = (getLocation()?.genres || []).join(" ");
    const eventType = String(context.eventType || suggestionEventContext()).toLowerCase();
    const interests = (profile.interests || []).slice(0, 3).join(", ");
    const past = (context.pastShoutouts || []).find(item => item.mainText || item.subText) || {};
    const occasion = /birthday|bday/i.test(`${main} ${sub} ${eventType}`) ? "birthday" : /r&b|rnb|soul/.test(`${eventType} ${genres}`.toLowerCase()) ? "rnb" : /afro|fufu/.test(`${main} ${sub} ${eventType} ${genres}`.toLowerCase()) ? "afrobeats" : /latin|reggaeton|salsa|bachata/.test(`${eventType} ${genres}`.toLowerCase()) ? "latin" : /romantic|love/i.test(`${tone} ${eventType}`) ? "romantic" : /graduation|grad/i.test(`${tone} ${eventType}`) ? "graduation" : /vip|classy|table/i.test(`${tone} ${eventType}`) ? "vip" : "party";
    const seed = main || past.mainText || (occasion === "birthday" ? `HAPPY BIRTHDAY${name ? ` ${name.toUpperCase()}` : ""}!` : occasion === "graduation" ? "CONGRATS GRAD!" : occasion === "romantic" ? "LOVE IS IN THE ROOM" : "BIG ShoutOut TONIGHT!");
    const linesByOccasion = {
      birthday:[seed, `BIRTHDAY ENERGY FOR ${name ? name.toUpperCase() : "THE STAR"}!`, "MAKE THIS BIRTHDAY UNFORGETTABLE!", "VIP BIRTHDAY MOMENT!", "TONIGHT BELONGS TO THE BIRTHDAY STAR!"],
      rnb:[seed, "SLOW GROOVE. BIG MOOD.", "R&B LIGHTS FOR THE TABLE", "LOVE SONGS AND VIP MOMENTS", "THIS GROOVE IS OURS"],
      afrobeats:[seed, "AFROBEATS ENERGY ALL NIGHT", "FUFU, FRIENDS, AND BIG VIBES", "THE RHYTHM HAS ARRIVED", "FROM THE TABLE TO THE DANCE FLOOR"],
      latin:[seed, "LATIN HEAT ON THE FLOOR", "REGGAETON NIGHT. BIG ENERGY.", "SALSA STEPS AND VIP LIGHTS", "THIS NIGHT MOVES WITH US"],
      romantic:[seed, "LOVE, LIGHTS, AND A PERFECT NIGHT", "A ROMANTIC ShoutOut FOR TWO", "THIS MOMENT IS ALL LOVE", "SOFT LIGHTS. BIG LOVE."],
      graduation:[seed, "THE FUTURE STARTS TONIGHT!", "CONGRATS ON THE BIG WIN!", "GRADUATION ENERGY ALL NIGHT", "NEXT LEVEL STARTS NOW!"],
      vip:[seed, "VIP MOMENT. VIP ENERGY.", "THE TABLE EVERYONE SEES TONIGHT", "LUXURY ENERGY ALL NIGHT", "MAKE ROOM FOR VIP"],
      party:[seed, "BIG ShoutOut ENERGY ALL NIGHT", "TONIGHT BELONGS TO THIS CREW", "LOUD NIGHT. BRIGHT MOMENT.", "FLOQR PUT THIS ON THE BOARD"]
    };
    const subBase = sub || (interests ? `${interests} at ${venue}` : `Live at ${venue}`);
    return (linesByOccasion[occasion] || linesByOccasion.party).map((line, index) => ({
      mainText:fitTemplateText(line, "main"),
      subText:fitTemplateText(index === 0 ? subBase : index === 1 ? `${venue} audience match` : "Celebrate loud. Keep it classy.", "sub"),
      providerMode:window.FLOQR_AI_ENABLED ? "gemini-contextual-or-fallback" : "local-personalized-fallback"
    }));
  }

  async function buildPersonalizedShoutOutSuggestions(toneOverride = "") {
    const caps = templateDisplayCaps();
    const context = {
      mainText:byId("mainText")?.value || "",
      subText:byId("subText")?.value || "",
      templateId:selectedTemplate,
      clubLocationId:locationId(),
      eventType:suggestionEventContext(),
      tone:toneOverride || byId("shoutoutTone")?.value || "party",
      mainLimit:caps.main,
      subLimit:caps.sub,
      displayCaps:caps,
      venueGenres:getLocation()?.genres || [],
      profileSignals:profileSuggestionSignals(),
      pastShoutouts:await getPastShoutOutMemory()
    };
    const fallback = buildFallbackPersonalizedSuggestions(context);
    try {
      const ai = window.floqrSuggestShoutOutAsync ? await window.floqrSuggestShoutOutAsync(context) : null;
      const first = ai ? [{...fallback[0], ...ai}] : [];
      const seen = new Set();
      return [...first, ...fallback].filter(item => {
        item.mainText = fitTemplateText(item.mainText || item.main || "", "main");
        item.subText = fitTemplateText(item.subText || item.sub || "", "sub");
        const key = `${item.mainText}|${item.subText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5);
    } catch (error) {
      return fallback.slice(0, 5);
    }
  }

  function applySuggestionItem(item = {}) {
    const mainInput = byId("mainText");
    if (mainInput) mainInput.value = fitTemplateText(item.mainText || item.main || "", "main");
    const subInput = byId("subText");
    if (subInput && item.subText && !byId("includeAttribution")?.checked) subInput.value = fitTemplateText(item.subText || "", "sub");
    syncAttribution();
    const box = byId("shoutoutSuggestionBox");
    if (box) {
      box.classList.remove("hidden");
      box.innerHTML = `<strong>Improve My ShoutOut</strong><p>${esc(item.mainText || item.main || "")} - ${esc(item.subText || item.sub || "")}</p><small>${esc(item.providerMode || item.provider || "contextual")}</small>`;
    }
    updatePreview();
  }

  function renderSuggestionButtons(targetId, suggestions = [], emptyText = "") {
    const list = byId(targetId);
    if (!list) return;
    const caps = templateDisplayCaps();
    list.innerHTML = suggestions.length ? suggestions.map((item, index) => `<button type="button" class="ghost ai-suggestion personalized-ai-suggestion" data-suggestion-target="${esc(targetId)}" data-suggestion-index="${index}"><strong>${esc(item.mainText || item.main || "")}</strong><span>${esc(item.subText || item.sub || "")}</span><small>${esc(item.providerMode || item.provider || "contextual")} - fits ${caps.lineCount} x ${caps.perLine}, ${caps.main} max</small></button>`).join("") : `<p class='sub small'>${esc(emptyText)}</p>`;
    list.querySelectorAll("[data-suggestion-index]").forEach(button => {
      button.addEventListener("click", () => applySuggestionItem(suggestions[Number(button.dataset.suggestionIndex)]));
    });
  }

  function buildTrendingShoutOutSuggestions() {
    const venue = getLocation()?.locationName || "tonight";
    return [
      {mainText:fitTemplateText("VIP ENERGY ALL NIGHT", "main"), subText:fitTemplateText(`Trending at ${venue}`, "sub"), providerMode:"trending"},
      {mainText:fitTemplateText("THIS CREW RUNS TONIGHT", "main"), subText:fitTemplateText("Selected by patrons", "sub"), providerMode:"trending"},
      {mainText:fitTemplateText("BIG MOMENT. BIG LIGHTS.", "main"), subText:fitTemplateText("Popular recommendation", "sub"), providerMode:"trending"}
    ];
  }

  async function loadApprovedRecommendationLibrary() {
    if (!approvedRecommendationLibraryPromise) {
      approvedRecommendationLibraryPromise = getCollectionSafe(
        "shoutoutRecommendations",
        item => String(item.status || "").toLowerCase() === "approved" && !!String(item.mainText || item.main || "").trim(),
        250
      ).then(rows => {
        approvedRecommendationLibrary = rows;
        return rows;
      }).catch(() => {
        approvedRecommendationLibrary = [];
        return [];
      });
    }
    return approvedRecommendationLibraryPromise;
  }

  function buildApprovedShoutOutSuggestions() {
    const eventType = String(suggestionEventContext() || "").toLowerCase();
    const venueGenres = (getLocation()?.genres || []).join(" ").toLowerCase();
    const wantsRnb = /r&b|rnb|hip hop|hiphop/.test(`${eventType} ${venueGenres}`);
    const wantsAfrobeats = /afro|amapiano/.test(`${eventType} ${venueGenres}`);
    const prioritized = approvedRecommendationLibrary
      .map(item => ({
        ...item,
        relevance:item.genre === "rnb-hiphop" && wantsRnb ? 2 : item.genre === "afrobeats" && wantsAfrobeats ? 2 : 1
      }))
      .sort((a,b) => b.relevance - a.relevance || String(a.sourceArtist || "").localeCompare(String(b.sourceArtist || "")) || String(a.mainText || "").localeCompare(String(b.mainText || "")));
    return prioritized.slice(0, 6).map(item => ({
      mainText:fitTemplateText(item.mainText || item.main || "", "main"),
      subText:fitTemplateText(item.subText || item.sub || "", "sub"),
      providerMode:`Master Admin approved${item.genre ? ` ${item.genre}` : ""}`,
      recommendationId:item.id || "",
      sourceArtist:item.sourceArtist || "",
      sourceTrack:item.sourceTrack || ""
    })).filter(item => item.mainText);
  }

  function buildGenericShoutOutSuggestions() {
    const now = new Date();
    const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const profile = cachedUserProfile || {};
    const birthMonth = String(profile.birthMonth || "").padStart(2, "0");
    const birthDay = String(profile.birthDay || "").padStart(2, "0");
    const isBirthday = birthMonth && birthDay && `${birthMonth}-${birthDay}` === monthDay;
    const items = [
      {mainText:fitTemplateText(isBirthday ? "HAPPY BIRTHDAY TO ME!" : "BIG ShoutOut TONIGHT!", "main"), subText:fitTemplateText(isBirthday ? "Birthday energy activated" : "Live on FLOQR", "sub"), providerMode:isBirthday ? "birthday context" : "generic"},
      {mainText:fitTemplateText("CELEBRATE THIS MOMENT", "main"), subText:fitTemplateText("Friends, lights, memories", "sub"), providerMode:"generic"},
      {mainText:fitTemplateText("TONIGHT IS OUR NIGHT", "main"), subText:fitTemplateText("Make it unforgettable", "sub"), providerMode:"generic"}
    ];
    return items;
  }

  async function refreshPersonalizedShoutOutRecommendations(options = {}) {
    const list = byId("aiSuggestionList");
    if (!list) return;
    const caps = templateDisplayCaps();
    if (caps.supported === false) {
      renderSuggestionButtons("aiSuggestionList", [], "Choose a supported display size to receive recommendations.");
      renderSuggestionButtons("trendingSuggestionList", [], "This template and display combination is not recommended.");
      renderSuggestionButtons("genericSuggestionList", [], "Select another display size.");
      return;
    }
    list.innerHTML = "<p class='sub small'>Building personalized ShoutOut ideas...</p>";
    const [suggestions] = await Promise.all([
      buildPersonalizedShoutOutSuggestions(options.toneOverride || ""),
      loadApprovedRecommendationLibrary()
    ]);
    renderSuggestionButtons("aiSuggestionList", suggestions.map(item => ({...item, providerMode:`${item.providerMode || item.provider || "contextual"} - ${suggestionEventContext()}`})), "Type a message or choose recommendation context to generate suggestions.");
    renderSuggestionButtons("trendingSuggestionList", [...buildApprovedShoutOutSuggestions(), ...buildTrendingShoutOutSuggestions()].slice(0, 8), "Master Admin-approved and trending ShoutOuts will appear here.");
    renderSuggestionButtons("genericSuggestionList", buildGenericShoutOutSuggestions(), "Generic occasion ideas will appear here.");
    if (options.applyFirst && suggestions[0]) applySuggestionItem(suggestions[0]);
  }

  function schedulePersonalizedShoutOutRecommendations() {
    if (personalizedSuggestionTimer) clearTimeout(personalizedSuggestionTimer);
    personalizedSuggestionTimer = setTimeout(() => refreshPersonalizedShoutOutRecommendations(), 500);
  }
  window.refreshPersonalizedShoutOutRecommendations = refreshPersonalizedShoutOutRecommendations;

  async function applyAiSuggestion(toneOverride = "") {
    await refreshPersonalizedShoutOutRecommendations({
      applyFirst:true,
      toneOverride:typeof toneOverride === "string" ? toneOverride : ""
    });
    return;
    const requestedTone = typeof toneOverride === "string" ? toneOverride : "";
    const fallbackSuggestion = () => window.floqrSuggestShoutOut ? window.floqrSuggestShoutOut({
      mainText:byId("mainText")?.value || "",
      subText:byId("subText")?.value || "",
      templateId:selectedTemplate,
      clubLocationId:locationId(),
      eventType:getLocation()?.type || "",
      tone:requestedTone || byId("shoutoutTone")?.value || "party",
      mainLimit:Number(byId("mainText")?.maxLength || 36)
    }) : null;
    let suggestion = null;
    try {
      suggestion = window.floqrSuggestShoutOutAsync ? await window.floqrSuggestShoutOutAsync({
        mainText:byId("mainText")?.value || "",
        subText:byId("subText")?.value || "",
        templateId:selectedTemplate,
        clubLocationId:locationId(),
        eventType:getLocation()?.type || "",
        tone:requestedTone || byId("shoutoutTone")?.value || "party",
        mainLimit:Number(byId("mainText")?.maxLength || 36)
      }) : fallbackSuggestion();
    } catch(e) {
      suggestion = fallbackSuggestion();
    }
    const pool = window.SHOUTOUT_AI_SUGGESTIONS || [];
    const item = suggestion || pool[Math.floor(Math.random() * pool.length)] || {main:"SHOUTOUT!", sub:"VIP vibes tonight."};
    const mainInput = byId("mainText");
    if (mainInput) mainInput.value = fitTemplateText(item.mainText || item.main || "", "main");
    syncAttribution();
    const box = byId("shoutoutSuggestionBox");
    if (box) {
      box.classList.remove("hidden");
      box.innerHTML = `<strong>Improve My ShoutOut</strong><p>${esc(item.mainText || item.main)} - ${esc(item.subText || item.sub || "")}</p><small>${esc(item.providerMode || item.provider || "curated-fallback")}</small>`;
      updatePreview();
      return;
    }
    if (box) { box.classList.remove("hidden"); box.innerHTML = `<strong>AI Suggestion</strong><p>${esc(item.main)} — ${esc(item.sub)}</p>`; }
    updatePreview();
  }

  async function loadPastShoutoutsForReuse() {
    const box = byId("shoutoutSuggestionBox");
    if (!box || !currentUser) return;
    box.classList.remove("hidden");
    box.innerHTML = "Loading past ShoutOuts...";
    try {
      const snap = await db.collection("shoutouts").where("submittedBy", "==", safeUser()).limit(10).get();
      const rows = [];
      snap.forEach(doc => rows.push({id:doc.id, ...doc.data()}));
      if (!rows.length) { box.innerHTML = "<p>No previous ShoutOuts found yet.</p>"; return; }
      box.innerHTML = rows.map((s,i)=>`<button type="button" class="reuse-shoutout" data-i="${i}">${esc(s.mainText||"ShoutOut")} — ${esc(s.subText||"")}</button>`).join("");
      box.querySelectorAll(".reuse-shoutout").forEach(btn => btn.addEventListener("click", () => {
        const s = rows[Number(btn.dataset.i)];
        const mainInput = byId("mainText");
        if (mainInput) mainInput.value = fitTemplateText(s.mainText || "", "main");
        if (byId("includeAttribution")) byId("includeAttribution").checked = !!s.subText;
        syncAttribution();
        if (s.mediaUrl) byId("mediaUrl").value = s.mediaUrl;
        if (s.mediaUrl && byId("shoutoutMediaUrl")) byId("shoutoutMediaUrl").value = s.mediaUrl;
        if (s.mediaType && byId("shoutoutMediaType")) byId("shoutoutMediaType").value = s.mediaType;
        updatePreview();
      }));
    } catch(e) { box.innerHTML = `<p>${esc(e.message)}</p>`; }
  }

  async function submitShoutout() {
    const status=byId("submitStatus");
    const correlationId = window.FLOQRLog?.correlationId?.("so") || `so_${Date.now().toString(36)}`;
    try {
      if(!currentUser){ status.textContent="Sign in first."; return; }
      if(!selectedLocationId){ status.textContent="Select a location first."; return; }
      const g = window.FLOQRFeatureGates;
      if (g && !g.patronMayUse("shoutOut", currentUser, cachedUserProfile)) {
        status.textContent = "ShoutOut is currently disabled for patrons.";
        return;
      }
      if (g) {
        const clubRow = await g.loadVenueRecord(db, locationId());
        if (!g.venueMayUse("shoutOut", clubRow)) {
          status.textContent = "ShoutOut is disabled for this venue.";
          return;
        }
      }
      const l=getLocation(), t=getTemplate();
      const caps = templateDisplayCaps(t);
      if (caps.supported === false) throw new Error(caps.advice || "Choose a supported display size for this template.");
      const footballIntro = isFootballTeamIntro();
      if (footballIntro && locationId() !== "zebbies-garden-washington-dc") throw new Error("This advanced football template is available only at Zebbies Garden DC.");
      if (window.FLOQRLog) {
        window.FLOQRLog.write({
          level: "info",
          category: "shoutout",
          action: "submit_start",
          message: `Submitting ${selectedTemplate || "shoutout"} for ${locationId()}`,
          correlationId,
          details: {
            template: selectedTemplate,
            locationId: locationId(),
            screenFormatId: caps.formatId || selectedScreenFormatId,
            footballIntro: !!footballIntro,
            paymentModel: Number(t.priceCents || 0) > 0 ? "floqr-platform" : "free"
          }
        });
      }
      const referenceNumber = `SO-${Date.now().toString().slice(-7)}`;
      const footballTeamMembers = footballIntro ? await uploadFootballTeamMembers(referenceNumber) : [];
      const themePayload = footballIntro ? footballThemePayload() : {};
      const backgroundPayload = footballIntro ? footballBackgroundPayload() : {};
      const uploadedMedia = !footballIntro && currentTemplateSupportsMedia() ? await uploadShoutoutMedia(referenceNumber) : {};
      const existingMediaUrl = byId("shoutoutMediaUrl")?.value.trim() || byId("mediaUrl")?.value.trim() || "";
      const existingMediaType = byId("shoutoutMediaType")?.value.trim() || "";
      const mediaPayload = footballIntro ? {
        mediaUrl:footballTeamMembers[0]?.mediaUrl || "",
        mediaType:"team-intro",
        mediaFit:"cover",
        mediaFileName:"four-player-lineup",
        mediaStoragePath:footballTeamMembers[0]?.mediaStoragePath || "",
        originalMediaStoragePath:footballTeamMembers[0]?.originalMediaStoragePath || "",
        enhancedMediaStoragePath:footballTeamMembers[0]?.enhancedMediaStoragePath || "",
        originalMediaUrl:footballTeamMembers[0]?.originalMediaUrl || "",
        enhancedMediaUrl:footballTeamMembers[0]?.enhancedMediaUrl || "",
        selectedMediaVersion:footballTeamMembers.some(member => member.selectedMediaVersion === "enhanced") ? "enhanced" : "original",
        aiEnhancementApplied:footballTeamMembers.some(member => member.aiEnhancementApplied),
        aiEnhancementType:byId("footballAiTreatment")?.checked ? "football-portrait-motion" : "none",
        aiEnhancementProvider:footballTeamMembers.some(member => member.aiEnhancementProvider === "gemini") ? "gemini" : "",
        aiEnhancementModel:footballTeamMembers.find(member => member.aiEnhancementModel)?.aiEnhancementModel || "",
        aiMediaSafetyStatus:footballTeamMembers.every(member => member.aiMediaSafetyStatus === "passed") ? "passed" : "original-fallback-allowed",
        aiMediaSafetyNotes:"Each roster image remains subject to club approval.",
        originalMediaUploaded:true,
        teamMembers:footballTeamMembers,
        animationDurationSeconds:20,
        collaborationMode:"four-person-roster",
        stadiumMessage:String(byId("footballTeamMessage")?.value || "TONIGHT, WE TAKE THE FIELD TOGETHER").trim().slice(0, Number(caps.maxStadiumCharacters || 54)),
        photoPermissionConfirmed:true,
        skipFinaleLineup:!!caps.skipFinaleLineup,
        aiPortraitMotion:!!byId("footballAiTreatment")?.checked,
        ...themePayload,
        ...backgroundPayload,
        priceCents:3000,
        mediaUploadedAt:null
      } : currentTemplateSupportsMedia() ? {
        mediaUrl: uploadedMedia.mediaUrl || existingMediaUrl,
        mediaType: uploadedMedia.mediaType || existingMediaType || "",
        mediaFit:byId("shoutoutMediaFit")?.value || "contain",
        mediaFileName: uploadedMedia.mediaFileName || "",
        mediaStoragePath: uploadedMedia.mediaStoragePath || "",
        originalMediaStoragePath: uploadedMedia.originalMediaStoragePath || "",
        enhancedMediaStoragePath: uploadedMedia.enhancedMediaStoragePath || "",
        originalMediaUrl: uploadedMedia.originalMediaUrl || uploadedMedia.mediaUrl || existingMediaUrl,
        enhancedMediaUrl: uploadedMedia.enhancedMediaUrl || "",
        trimmedMediaUrl: uploadedMedia.trimmedMediaUrl || "",
        selectedMediaVersion: uploadedMedia.selectedMediaVersion || "original",
        aiEnhancementApplied: !!uploadedMedia.aiEnhancementApplied,
        aiEnhancementType: uploadedMedia.aiEnhancementType || "none",
        aiEnhancementPrompt: uploadedMedia.aiEnhancementPrompt || "",
        aiEnhancementProvider: uploadedMedia.aiEnhancementProvider || "",
        aiEnhancementModel: uploadedMedia.aiEnhancementModel || "",
        originalDuration: uploadedMedia.originalDuration || null,
        trimmedDuration: uploadedMedia.trimmedDuration || null,
        trimStart: uploadedMedia.trimStart || null,
        trimEnd: uploadedMedia.trimEnd || null,
        trimProcessingMode: uploadedMedia.trimProcessingMode || "",
        trimWarning: uploadedMedia.trimWarning || "",
        originalMediaUploaded: uploadedMedia.originalMediaUploaded !== false,
        aiMediaSafetyStatus: uploadedMedia.aiMediaSafetyStatus || "notChecked",
        aiMediaSafetyNotes: uploadedMedia.aiMediaSafetyNotes || "",
        mediaUploadedAt: uploadedMedia.mediaUploadedAt || null
      } : { mediaUrl:"", mediaType:"", mediaFileName:"", mediaStoragePath:"", mediaUploadedAt:null };
      const variantPayload = selectedTemplateVariant ? {
        templateVariantId:selectedTemplateVariant.id || selectedTemplateVariant.variantId || "",
        templateVariantName:selectedTemplateVariant.variantName || "",
        lockedBaseTemplateId:selectedTemplateVariant.baseTemplateId || selectedTemplate,
        backgroundType:selectedTemplateVariant.backgroundType || "",
        backgroundUrl:selectedTemplateVariant.backgroundUrl || "",
        backgroundColor:selectedTemplateVariant.backgroundColor || "",
        backgroundGradient:selectedTemplateVariant.backgroundGradient || "",
        backgroundStoragePath:selectedTemplateVariant.backgroundStoragePath || "",
        templateVariantScope:selectedTemplateVariant.variantScope || "patron",
        backgroundSource:selectedTemplateVariant.variantScope === "club" ? "clubAdminVariant" : "patronVariant"
      } : {};
      syncSoccerJerseyFields();
      const payload={ location:locationId(), club:locationId(), clubLocationId:locationId(), brandName:l.brandName, locationName:l.locationName, clubName:l.locationName, country:l.country, region:l.region, city:l.city, locationLabel:l.locationLabel, template:selectedTemplate, templateName:t.name, templateClassName:t.className || "neon", templateSupportsMedia:!!(footballIntro || t.supportsMedia || t.supportsImage || t.supportsVideo), screenFormatId:caps.formatId || byId("shoutoutScreenFormat")?.value || selectedScreenFormatId, textLayoutVersion:window.FLOQRTextLayout?.version || "", textProfileId:caps.profileId || t.textProfileId || "full", maxMainCharacters:caps.main, maxSubCharacters:isSoccerJerseyTemplate() ? 2 : caps.sub, lineCount:caps.lineCount, maxCharactersPerLine:caps.perLine, minimumFontPixels:caps.minimumFontPixels || 0, mainTextSizePercent:caps.mainTextSizePercent, subTextSizePercent:caps.subTextSizePercent, ...variantPayload, mainText:fitTemplateText(byId("mainText").value.trim()||"SHOUTOUT!","main"), subText:fitTemplateText(byId("subText").value.trim()||"","sub"), ...mediaPayload, status:"pending", editable:true, submittedByUid:currentUser.uid, submittedBy:safeUser(), submittedAt:firebase.firestore.FieldValue.serverTimestamp(), referenceNumber };
      const priceCents = Math.max(0, Math.round(Number(t.priceCents || mediaPayload.priceCents || 0)));
      if (priceCents > 0) {
        const checkoutPayload = {...payload, priceCents, submittedAt:null, mediaUploadedAt:null};
        status.textContent = footballIntro
          ? `Zebbies four-player football intro: $${(priceCents / 100).toFixed(0)} FloqR checkout required.`
          : `Paid ShoutOut: $${(priceCents / 100).toFixed(2)} FloqR checkout required.`;
        await window.FLOQRPayments.startCheckout({orderType:"shoutout", payload:{clubLocationId:locationId(), shoutout:checkoutPayload, priceCents}, status:message => { status.textContent = message; }});
        return;
      }
      const shoutoutRef = await db.collection("shoutouts").add(payload);
      payload.shoutoutId = shoutoutRef.id;
      payload.modifyLink = `./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(payload.referenceNumber)}&id=${encodeURIComponent(shoutoutRef.id)}&v=29.09.8`;
      await db.collection("shoutoutAudit").add({shoutoutId:shoutoutRef.id, action:"submitted", referenceNumber:payload.referenceNumber, actorUid:currentUser.uid, actorEmail:safeUser(), createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      try { await db.collection("shoutoutRecommendations").add({source:"submission", sourceType:"patron-submission", status:"pending", rightsStatus:"review-required", rightsNote:"Patron-submitted wording; Master Admin review is required before reuse.", uid:currentUser.uid, template:payload.template, mainText:payload.mainText, subText:payload.subText, createdAt:firebase.firestore.FieldValue.serverTimestamp()}); } catch(e) {}
      if (window.createShoutOutSubmissionNotification) await window.createShoutOutSubmissionNotification(payload);
      showShoutoutConfirmation(payload, l, t);
    } catch(e) {
      status.textContent=e.message;
      if (window.FLOQRLog) {
        window.FLOQRLog.fromError(e, {
          category: "shoutout",
          action: "submit_failed",
          correlationId,
          details: {
            template: selectedTemplate,
            locationId: selectedLocationId || locationId?.() || "",
            screenFormatId: selectedScreenFormatId || ""
          }
        });
      }
    }
  }
  function startAnother(){ selectedTemplateVariant=null; byId("mainText").value=""; if(byId("includeAttribution"))byId("includeAttribution").checked=false; if(byId("soccerJerseyNumber"))byId("soccerJerseyNumber").value=""; if(byId("soccerManualName"))byId("soccerManualName").value=""; if(byId("soccerNameSource"))byId("soccerNameSource").value="displayName"; syncAttribution(); syncSoccerJerseyFields(); byId("mediaUrl").value=""; if(byId("shoutoutMediaUrl")) byId("shoutoutMediaUrl").value=""; if(byId("shoutoutMediaType")) byId("shoutoutMediaType").value=""; if(byId("shoutoutPhoto")) byId("shoutoutPhoto").value=""; if(byId("shoutoutMediaUpload")) byId("shoutoutMediaUpload").value=""; resetFootballTeamEditor(); showTemplateSelection(); }

  function updateMediaEditorForTemplate() {
    const t = getTemplate();
    const footballIntro = isFootballTeamIntro(t.id || selectedTemplate);
    const allowsMedia = currentTemplateSupportsMedia();
    const accepts = currentTemplateAccepts();
    const mainInput = byId("mainText");
    const caps = templateDisplayCaps(t);
    if (mainInput) {
      mainInput.maxLength = caps.main + Math.max(0, caps.lineCount - 1);
      mainInput.rows = Math.max(2, caps.lineCount || 2);
      mainInput.placeholder = caps.supported === false ? "Choose a supported display size" : `Enter ShoutOut Here - maximum ${caps.main} visible characters`;
      if (footballIntro && !mainInput.value.trim()) mainInput.value = t.defaultMain || "ZEBBIES ALL-STARS";
      mainInput.value = fitTemplateText(mainInput.value, "main");
    }
    const subInput = byId("subText");
    if (subInput) {
      subInput.maxLength = isSoccerJerseyTemplate(t.id || selectedTemplate) ? Math.min(2, caps.sub || 2) : caps.sub;
      if (isSoccerJerseyTemplate(t.id || selectedTemplate)) subInput.value = glyphCap(subInput.value, subInput.maxLength);
      else if (subInput.value.length > subInput.maxLength) subInput.value = subInput.value.slice(0, subInput.maxLength);
    }
    syncSoccerJerseyFields();
    document.querySelectorAll("[data-football-team-identity-value]").forEach(input => {
      input.maxLength = Math.max(1, Number(caps.maxPlayerNameCharacters || 14));
      if (input.value.length > input.maxLength) input.value = input.value.slice(0, input.maxLength);
    });
    const stadiumInput = byId("footballTeamMessage");
    if (stadiumInput) {
      stadiumInput.maxLength = Math.max(1, Number(caps.maxStadiumCharacters || 54));
      if (stadiumInput.value.length > stadiumInput.maxLength) stadiumInput.value = stadiumInput.value.slice(0, stadiumInput.maxLength);
    }
    if (byId("footballTextCapHint") && footballIntro) byId("footballTextCapHint").textContent = `For this display: ${caps.stadiumLineCount || 3} stadium-message lines, about ${caps.stadiumCharactersPerLine || 18} characters per line, ${caps.maxStadiumCharacters || 54} total; player names up to ${caps.maxPlayerNameCharacters || 14} characters.`;
    updateTemplateCharacterCapHint();
    document.body.dataset.selectedTemplate = t.id || selectedTemplate;
    document.body.classList.toggle("template-media-unavailable", !allowsMedia);
    byId("footballTeamIntroCard")?.classList.toggle("hidden", !footballIntro);
    if (byId("submitShoutoutBtn")) {
      const priced = Math.max(0, Math.round(Number(t.priceCents || 0))) > 0;
      byId("submitShoutoutBtn").textContent = footballIntro
        ? "Continue to $30 FloqR Checkout"
        : priced
          ? `Continue to $${(Number(t.priceCents) / 100).toFixed(2)} FloqR Checkout`
          : "Submit for Approval";
      byId("submitShoutoutBtn").disabled = caps.supported === false;
    }
    if (byId("previewDurationHint")) byId("previewDurationHint").textContent = footballIntro ? "Preview plays the complete 20-second stadium introduction." : "Preview opens in a popout and closes automatically after 5 seconds.";
    const photoWrap = byId("shoutoutPhotoWrap");
    const photoInput = byId("shoutoutPhoto");
    if (photoWrap) photoWrap.classList.toggle("hidden", !allowsMedia);
    if (photoInput) {
      photoInput.accept = accepts || "image/jpeg,image/png,image/webp";
      if (!allowsMedia) photoInput.value = "";
    }
    const mediaInput = byId("shoutoutMediaUpload");
    const mediaCard = mediaInput?.closest(".media-upload-card") || mediaInput?.closest(".card");
    if (mediaInput) {
      mediaInput.accept = accepts;
      if (!allowsMedia) mediaInput.value = "";
    }
    if (mediaCard) mediaCard.classList.toggle("hidden", footballIntro || !allowsMedia);
    const mediaUrl = byId("shoutoutMediaUrl"), mediaType = byId("shoutoutMediaType"), legacyUrl = byId("mediaUrl");
    if (!allowsMedia) {
      if (mediaUrl) mediaUrl.value = "";
      if (mediaType) mediaType.value = "";
      if (legacyUrl) legacyUrl.value = "";
    }
    if (window.jadzEnsureSingleMediaUploader) setTimeout(() => window.jadzEnsureSingleMediaUploader(), 0);
  }

  function configureTemplateScreenFormats(screenSelect, template, location) {
    const venueFormats = location.displayScreenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || ["led-96x48"];
    const templateFormats = template.screenFormatIds || window.FLOQR_DEFAULT_DISPLAY_FORMAT_IDS || venueFormats;
    const preferred = isFootballTeamIntro(template.id) ? (template.preferredP125FormatIds || []) : [];
    const available = Array.from(new Set([...preferred, ...venueFormats])).filter(id => venueFormats.includes(id) && templateFormats.includes(id));
    const supported = available.filter(id => window.FLOQRTextLayout?.resolve?.(template, id)?.supported !== false);
    screenSelect.innerHTML = available.map(id => {
      const format = window.FLOQR_DISPLAY_FORMATS?.[id] || {label:id,pixelWidth:"?",pixelHeight:"?"};
      const caps = window.FLOQRTextLayout?.resolve?.(template, id);
      const disabled = caps?.supported === false;
      const suffix = disabled ? " - not suitable for this template" : ` - ${caps?.lineCount || 1} lines / ${caps?.main || template.maxMainCharacters || 60} characters`;
      return `<option value="${esc(id)}"${disabled ? " disabled" : ""}>${esc(format.label)} - ${esc(format.pixelWidth)} x ${esc(format.pixelHeight)} px${esc(suffix)}</option>`;
    }).join("");
    selectedScreenFormatId = supported.includes(selectedScreenFormatId) ? selectedScreenFormatId : supported.includes(location.primaryDisplayScreenFormatId) ? location.primaryDisplayScreenFormatId : supported[0] || available[0];
    screenSelect.value = selectedScreenFormatId;
    screenSelect.disabled = !supported.length;
  }

  function goToEditor() {
    const l=getLocation(), t=getTemplate();
    const screenSelect = byId("shoutoutScreenFormat");
    if (screenSelect) configureTemplateScreenFormats(screenSelect, t, l);
    setText("editorClubTitle", l.locationName);
    setText("editorTemplateMeta", `${l.locationLabel} - Template: ${selectedTemplateVariant?.variantName || t.name}`);
    updateMediaEditorForTemplate();
    syncAttribution();
    updatePreview();
    showPage("editorPage");
  }


  function ensureProfileMenuEnhancements(user) {
    const menus = [
      byId("profileMenu"),
      byId("userMenu"),
      document.querySelector(".profile-menu"),
      document.querySelector(".user-menu"),
      document.querySelector(".account-menu")
    ].filter(Boolean);

    const menu = menus[0];
    if (!menu || !user) return;

    if (!menu.querySelector("[data-patron-menu='portal']")) {
      const signOutButton = Array.from(menu.querySelectorAll("button")).find(b => String(b.textContent || "").toLowerCase().includes("sign out")) || null;

      const portalLink = document.createElement("a");
      portalLink.href = window.FLOQRNav?.portalHome() || "./patron-portal.html?v=29.09.33";
      portalLink.textContent = "My Profile and Settings";
      portalLink.dataset.patronMenu = "portal";
      portalLink.className = "profile-menu-link";
      menu.insertBefore(portalLink, signOutButton);

      const level = document.createElement("div");
      level.textContent = "Member Level: Patron";
      level.dataset.patronMenu = "level";
      level.className = "profile-menu-line";
      menu.insertBefore(level, signOutButton);

      const messages = document.createElement("a");
      messages.href = window.FLOQRNav?.portalHome({ tab: "inbox" }) || "./patron-portal.html?tab=inbox&v=29.09.8";
      messages.textContent = "FLOQR Inbox (0/0)";
      messages.dataset.patronMenu = "messages";
      messages.className = "profile-menu-link";
      menu.insertBefore(messages, signOutButton);

      const chats = document.createElement("a");
      chats.href = window.FLOQRNav?.portalLink("./mingl-chat.html") || "./mingl-chat.html?v=29.09.33&from=portal";
      chats.textContent = "Mingl (0/0)";
      chats.dataset.patronMenu = "chats";
      chats.className = "profile-menu-link";
      menu.insertBefore(chats, signOutButton);
    }

    updateProfileMenuCounts(user.uid);
  }

  async function updateProfileMenuCounts(uid) {
    try {
      const profileDoc = await db.collection("users").doc(uid).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      const levelEl = document.querySelector("[data-patron-menu='level']");
      if (levelEl) levelEl.textContent = `Member Level: ${profile.memberLevel || "Patron"}`;

      let totalMessages = 0, unreadMessages = 0, totalChats = 0, unreadChats = 0;

      try {
        const msgSnap = await db.collection("messages").where("recipientUid", "==", uid).limit(1000).get();
        totalMessages = msgSnap.size;
        msgSnap.forEach(d => { if (!d.data().read) unreadMessages += 1; });
      } catch(e) {}
      try {
        const noteSnap = await db.collection("inboxNotifications").where("recipientUid", "==", uid).limit(1000).get();
        totalMessages += noteSnap.size;
        noteSnap.forEach(d => { if (!d.data().read) unreadMessages += 1; });
      } catch(e) {}

      try {
        const chatSnap = await db.collection("chatRooms").where("participants", "array-contains", uid).limit(1000).get();
        totalChats = chatSnap.size;
        chatSnap.forEach(d => {
          const unread = d.data().unreadCounts && d.data().unreadCounts[uid] ? Number(d.data().unreadCounts[uid]) : 0;
          unreadChats += unread;
        });
      } catch(e) {}

      const msgEl = document.querySelector("[data-patron-menu='messages']");
      if (msgEl) msgEl.textContent = `FLOQR Inbox (${unreadMessages}/${totalMessages})`;

      const chatEl = document.querySelector("[data-patron-menu='chats']");
      if (chatEl) chatEl.textContent = `Mingl (${unreadChats}/${totalChats})`;
    } catch(e) {
      console.warn("Could not update profile menu counts", e);
    }
  }


  document.addEventListener("DOMContentLoaded", function(){
    window.FLOQRAdCampaigns?.loadFirestoreSpotAds?.(db).catch(() => {});
    detectRenderContext();
    window.FLOQRI18n?.init?.({}).then(() => window.FLOQRI18n?.applyDom?.()).catch(() => {});
    window.addEventListener("resize", detectRenderContext);
    window.addEventListener("orientationchange", detectRenderContext);
    setStatus("");
    auth.getRedirectResult().then(result => {
      if (result?.user) setStatus(`Signed in with Microsoft as ${result.user.email || result.user.displayName || result.user.uid}`);
    }).catch(e => setStatus(microsoftAuthErrorMessage(e)));
    auth.onAuthStateChanged(async user => { currentUser=user; updateLoginUI(user); if(user) await afterLogin(); });
    bind("googleLoginBtn", loginGoogle); bind("facebookLoginBtn", loginFacebook); bind("microsoftLoginBtn", loginMicrosoft); bind("showEmailOtpBtn", showEmailOtpPanel); bind("requestEmailOtpBtn", requestEmailOtp); bind("verifyEmailOtpBtn", verifyEmailOtp); bind("showSmsOtpBtn", showSmsOtpPanel); bind("sendOtpBtn", sendPhoneCode); bind("verifyOtpBtn", verifyPhoneCode); bind("continueBtn", afterLogin);
    ["logoutBtn1","logoutBtn2","logoutBtn3","logoutBtn4","logoutBtn5","logoutBtn6","logoutBtnClubActions"].forEach(id => bind(id, logout));
    bind("eventsBtn", () => openCategory("events")); bind("clubsBtn", () => openCategory("clubs")); bind("loungesBtn", () => openCategory("lounges")); bind("loungeClubBtn", () => openCategory("lounge-club")); bind("beachClubsBtn", () => openCategory("beach-clubs")); bind("shoutoutBtn", () => openCategory("shoutout"));
    bind("eventsBtnCard", () => openCategory("events")); bind("clubsBtnCard", () => openCategory("clubs")); bind("loungesBtnCard", () => openCategory("lounges")); bind("loungeClubBtnCard", () => openCategory("lounge-club")); bind("beachClubsBtnCard", () => openCategory("beach-clubs")); bind("shoutoutBtnCard", showShoutoutLanding); bind("minglBtnCard", () => showAdSplash("mingl", () => showMinglLanding()));
    bind("backToWelcomeFromProfileBtn", () => showPage("landingPage"));
    bind("backToWelcomeBtn", () => showPage("landingPage"));
    bind("backToCategoriesFromShoutoutLandingBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromShoutoutLandingBtn2", () => showPage("categoryPage"));
    bind("startShoutoutFlowBtn", () => openCategory("shoutout"));
    bind("backToCategoriesFromMinglBtn", () => showPage("categoryPage"));
    byId("minglSearch")?.addEventListener("input", renderMinglPeople);
    byId("profileCountry")?.addEventListener("change", () => applyProfileHeightUnit());
    byId("profileCountry")?.addEventListener("input", () => applyProfileHeightUnit());
    byId("profileHeightUnit")?.addEventListener("change", event => {
      event.currentTarget.dataset.userSelected = "true";
      applyProfileHeightUnit(true);
    });
    applyProfileHeightUnit();
    byId("sendMinglMessageBtn")?.addEventListener("click", sendMinglMessage);
    byId("improveMinglMessageBtn")?.addEventListener("click", improveMinglDraft);
    byId("minglMessageInput")?.addEventListener("input", highlightMinglDraft);
    byId("minglMessageInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMinglMessage();
      }
    });
    updateMinglGrammarControls();
    document.querySelectorAll("[data-mingl-emoji]").forEach(button => {
      button.addEventListener("click", () => insertMinglEmoji(button.dataset.minglEmoji || ""));
    });
    byId("minglRequestStatusBtn")?.addEventListener("click", event => {
      event.stopPropagation();
      byId("minglRequestStatusPopout")?.classList.toggle("hidden");
    });
    document.addEventListener("click", event => {
      if (!event.target.closest("#minglRequestStatusPopout") && !event.target.closest("#minglRequestStatusBtn")) {
        byId("minglRequestStatusPopout")?.classList.add("hidden");
      }
      if (event.target.closest(".profile-datapoint")) return;
      document.querySelectorAll(".profile-datapoint[open]").forEach(detail => detail.removeAttribute("open"));
    });
    bind("backFromAdBtn", cancelAdSplash);
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("clubShoutoutBtn", () => showAdSplash("shoutout", () => openCategoryAfterAd("shoutout")));
    bind("backToCategoriesBtn", () => showPage("categoryPage"));
    bind("backToCategoriesFromActionsBtn", () => showPage("categoryPage"));
    bind("reserveTableBtn", () => showAdSplash("clubs", () => openCategoryAfterAd("club-action:reserve-a-table")));
    bind("joinGuestListBtn", () => showAdSplash("events", () => openCategoryAfterAd("club-action:join-guest-list")));
    bind("payVipEntryBtn", () => showAdSplash("lounge-club", () => openCategoryAfterAd("club-action:pay-vip-entry")));
    bind("payEventEntryBtn", () => showAdSplash("events", () => openCategoryAfterAd("club-action:pay-event-entry")));
    bind("payStdEntryBtn", () => showAdSplash("clubs", () => openCategoryAfterAd("club-action:pay-std-entry"))); bind("backToListingBtn", () => showListing()); bind("backToTemplatesBtn", showTemplateSelection); bind("goToEditorBtn", goToEditor); bind("previewShoutoutBtn", openShoutoutPreviewModal); bind("closeShoutoutPreviewBtn", closeShoutoutPreviewModal); bind("submitShoutoutBtn", submitShoutout); bind("aiSuggestBtn", () => applyAiSuggestion()); bind("pastShoutoutsBtn", loadPastShoutoutsForReuse); bind("editSubmittedShoutoutBtn", editSubmittedShoutout); bind("confirmGoMinglBtn", goToMinglFromConfirmation); bind("confirmGoBartrBtn", goToBartrFromConfirmation); bind("skipConfirmationBtn", returnToMainFromConfirmation); bind("minglQuickChatBtn", openMinglChatShortcut); bind("minglQuickSearchBtn", focusMinglPeopleSearch);
    document.querySelectorAll("[data-ai-tone]").forEach(btn => btn.addEventListener("click", () => applyAiSuggestion(btn.dataset.aiTone || "")));
    bind("userMenuBtn", toggleUserDropdown);
    bind("dropdownSignOutBtn", logout);
    bind("skipAdBtn", skipAdSplash);
    bind("saveProfileBtn", saveProfile);
    floqrId().bindInstagramInput?.(byId("profileInstagram"));
    floqrId().bindFloqrHandleInput?.(byId("profileUsername"));
    floqrId().attachHelpPopout?.(byId("profileFloqrHandleHelp"), floqrId().FLOQR_HANDLE_HELP);
    byId("templateSearch")?.addEventListener("input", renderTemplates);
    byId("minglImageInput")?.addEventListener("change", renderMinglAttachmentPreview);
    byId("includeAttribution")?.addEventListener("change", () => { syncAttribution(); schedulePersonalizedShoutOutRecommendations(); });
    byId("attributionChoice")?.addEventListener("change", () => { syncAttribution(); schedulePersonalizedShoutOutRecommendations(); });
    byId("soccerNameSource")?.addEventListener("change", () => { syncSoccerJerseyFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });
    byId("soccerManualName")?.addEventListener("input", () => { syncSoccerJerseyFields(); updatePreview(); schedulePersonalizedShoutOutRecommendations(); });
    byId("soccerJerseyNumber")?.addEventListener("input", event => {
      // Any character allowed; hard-cap at 2 glyphs for soccer templates.
      const next = glyphCap(event.currentTarget.value, 2);
      if (event.currentTarget.value !== next) event.currentTarget.value = next;
      syncSoccerJerseyFields();
      updatePreview();
      schedulePersonalizedShoutOutRecommendations();
    });
    byId("shoutoutTone")?.addEventListener("change", schedulePersonalizedShoutOutRecommendations);
    byId("shoutoutEventType")?.addEventListener("change", schedulePersonalizedShoutOutRecommendations);
    byId("shoutoutPreviewModal")?.addEventListener("click", event => {
      if (event.target?.id === "shoutoutPreviewModal") closeShoutoutPreviewModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeShoutoutPreviewModal();
    });
    document.addEventListener("click", closeUserDropdownOnOutsideClick);
    ["mainText","subText"].forEach(id => byId(id)?.addEventListener("input", schedulePersonalizedShoutOutRecommendations));
    byId("mainText")?.addEventListener("input", event => {
      const next = clampMainTextWhileTyping(event.currentTarget.value);
      if (event.currentTarget.value !== next) event.currentTarget.value = next;
      updateTemplateCharacterCapHint();
    });
    byId("mainText")?.addEventListener("blur", event => {
      applyFittedMainText(event.currentTarget);
      updateTemplateCharacterCapHint();
      updatePreview();
    });
    byId("shoutoutScreenFormat")?.addEventListener("change", event => { selectedScreenFormatId = event.currentTarget.value; updateMediaEditorForTemplate(); schedulePersonalizedShoutOutRecommendations(); updatePreview(); });
    ["mainText","subText","mediaUrl","shoutoutMediaUrl","shoutoutMediaType","shoutoutMediaFit"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
    bindFootballTeamEditor();
    window.FLOQRIntentSearch?.bindIntentSearch({
      onShoutout: () => showShoutoutLanding(),
      onMingl: () => showMinglLanding()
    });
    const floqAiPanel = byId("floqAiSearchPanel");
    const floqAiHelpBtn = byId("floqAiHelpBtn");
    const floqAiHelpPop = byId("floqAiHelpPopout");
    const floqAiHelpClose = byId("floqAiHelpClose");
    function setFloqAiHelpOpen(open) {
      if (!floqAiHelpPop || !floqAiHelpBtn) return;
      floqAiHelpPop.classList.toggle("hidden", !open);
      floqAiHelpPop.setAttribute("aria-hidden", open ? "false" : "true");
      floqAiHelpBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    floqAiHelpBtn?.addEventListener("click", event => {
      event.stopPropagation();
      setFloqAiHelpOpen(floqAiHelpPop?.classList.contains("hidden"));
    });
    floqAiHelpClose?.addEventListener("click", () => setFloqAiHelpOpen(false));
    document.addEventListener("click", event => {
      if (!floqAiHelpPop || floqAiHelpPop.classList.contains("hidden")) return;
      if (floqAiHelpPop.contains(event.target) || floqAiHelpBtn?.contains(event.target)) return;
      setFloqAiHelpOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setFloqAiHelpOpen(false);
    });
    window.FLOQRFloqAi?.bindFloqAi({
      onOpenSearch() {
        if (floqAiPanel) {
          floqAiPanel.classList.add("open");
          floqAiPanel.setAttribute("aria-hidden", "false");
        }
      }
    });
    window.FLOQRNav?.applyStartPage(showPage);
  });

  auth.onAuthStateChanged(user => {
    if (user) setTimeout(() => ensureProfileMenuEnhancements(user), 500);
  });

})();



/* v28.4 override: patron menu + guest-list routing */
(function(){
  function byId(id){ return document.getElementById(id); }
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function initials(user){
    const n = user?.displayName || user?.email || "Patron";
    return n.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase() || "P";
  }
  function selectedLocationId(){
    return window.selectedLocationId || window.locationId?.() || new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  }
  window.openGuestListForLocation = function(locationId){
    const url = new URL("./guest-list.html", location.href);
    url.searchParams.set("v", window.FLOQRNav?.appVersion || "29.09.8");
    url.searchParams.set("location", locationId || selectedLocationId());
    const promoter = new URL(location.href).searchParams.get("promoter");
    if (promoter) url.searchParams.set("promoter", promoter);
    location.href = url.toString();
  };

  async function counts(uid){
    const out = {tm:0, um:0, tc:0, uc:0};
    try{
      const db = firebase.firestore();
      const ms = await db.collection("messages").where("recipientUid","==",uid).limit(1000).get();
      out.tm = ms.size; ms.forEach(d => { if(!d.data().read) out.um++; });
    }catch(e){}
    try{
      const db = firebase.firestore();
      const ns = await db.collection("inboxNotifications").where("recipientUid","==",uid).limit(1000).get();
      out.tm += ns.size; ns.forEach(d => { if(!d.data().read) out.um++; });
    }catch(e){}
    try{
      const db = firebase.firestore();
      const cs = await db.collection("chatRooms").where("participants","array-contains",uid).limit(1000).get();
      out.tc = cs.size; cs.forEach(d => { out.uc += Number((d.data().unreadCounts || {})[uid] || 0); });
    }catch(e){}
    return out;
  }

  async function enhanceMenu(user){
    if(!user) return;
    const menu = byId("userDropdown") || byId("profileMenu") || byId("userMenu") || document.querySelector(".user-dropdown,.profile-menu,.user-menu,.account-menu");
    if(!menu) return;
    const c = await counts(user.uid);
    const photo = user.photoURL ? `<img class="menu-avatar" src="${esc(user.photoURL)}" alt="">` : `<span class="menu-avatar-fallback">${esc(initials(user))}</span>`;
    menu.innerHTML = `
      <div class="menu-user-row">${photo}<div><strong>${esc(user.displayName || user.email || "Patron")}</strong><p>${esc(user.email || user.phoneNumber || "")}</p></div></div>
      <a class="profile-menu-link" href="${window.FLOQRNav?.portalHome() || "./patron-portal.html?v=29.09.33"}">My Profile and Settings</a>
      <div class="profile-menu-line">Member Level: Patron</div>
      <a class="profile-menu-link" href="${window.FLOQRNav?.portalHome({ tab: "inbox" }) || "./patron-portal.html?tab=inbox&v=29.09.8"}">FLOQR Inbox (${c.um}/${c.tm})</a>
      <a class="profile-menu-link" href="${window.FLOQRNav?.portalLink("./mingl-chat.html") || "./mingl-chat.html?v=29.09.33&from=portal"}">Mingl (${c.uc}/${c.tc})</a>
      <button class="ghost full" type="button" data-patron-logout="1">Sign out</button>`;
  }

  document.addEventListener("click", function(e){
    if(e.target.closest("[data-patron-logout]")){
      e.preventDefault();
      e.stopPropagation();
      if(window.jadzPatronLogout) window.jadzPatronLogout();
      else if(window.firebase && firebase.auth) firebase.auth().signOut().then(()=>{location.href="./";});
      return;
    }
    const el = e.target.closest("button,a,[role='button']");
    if(!el) return;
    const text = String(el.textContent || el.getAttribute("aria-label") || "").toLowerCase();
    if(text.includes("guest list") || text.includes("join guest")){
      window.__jadzActionMode = "guest-list";
    }
    if(window.__jadzActionMode === "guest-list" && text.trim() === "continue"){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.openGuestListForLocation();
    }
  }, true);

  const waitAuth = setInterval(function(){
    try{
      if(window.firebase && firebase.auth){
        clearInterval(waitAuth);
        firebase.auth().onAuthStateChanged(user => {
          if(user) setTimeout(() => enhanceMenu(user), 350);
        });
      }
    }catch(e){}
  }, 250);
})();

/* v28.4 override: club service isolation + inbox notification */
(function(){
function qs(n){return new URL(location.href).searchParams.get(n)||"";}
function currentLoc(){return window.selectedLocationId||window.locationId?.()||qs("location")||qs("club")||"zebbies-garden-washington-dc";}
window.getEnabledServicesForLocation=function(id){return (window.SHOUTOUT_LOCATION_SERVICES||{})[id]||window.SHOUTOUT_DEFAULT_LOCATION_SERVICES||["shoutout","guestList"];};
window.openServiceForLocation=function(service,id){id=id||currentLoc();if(service==="guestList"){let u=new URL("./guest-list.html",location.href);u.searchParams.set("location",id);u.searchParams.set("v", window.FLOQRNav?.appVersion || "29.09.8");let pr=qs("promoter");if(pr)u.searchParams.set("promoter",pr);location.href=u.toString();return;} if(service!=="shoutout"){alert(((window.SHOUTOUT_SERVICE_LABELS||{})[service]||service)+" is not yet enabled in this demo workflow.");}};
async function note(payload){try{let u=firebase.auth().currentUser;if(!u)return;await firebase.firestore().collection("inboxNotifications").add({recipientUid:u.uid,recipientEmail:u.email||"",read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),...payload});}catch(e){}}
window.createShoutOutSubmissionNotification=async function(s){const link=s.modifyLink||`./patron-portal.html?tab=shoutouts&ref=${encodeURIComponent(s.referenceNumber||"")}&v=29.09.8`;await note({type:"shoutoutSubmitted",title:"ShoutOut Submitted",body:`Your ShoutOut was submitted for ${s.locationName||s.clubName||s.clubLocationId||"the selected venue"}.\n\nModify ShoutOut: ${link}`,referenceNumber:s.referenceNumber||"",shoutoutId:s.shoutoutId||"",clubLocationId:s.clubLocationId||s.location||currentLoc(),status:s.status||"pending",link});};
document.addEventListener("click",function(e){let b=e.target.closest("[data-service]");if(b){e.preventDefault();e.stopPropagation();window.openServiceForLocation(b.dataset.service,currentLoc());return;}let el=e.target.closest("button,a,[role='button']");if(!el)return;let t=String(el.textContent||el.getAttribute("aria-label")||"").toLowerCase();if(t.includes("guest list")||t.includes("join guest"))window.__jadzActionMode="guest-list";if(window.__jadzActionMode==="guest-list"&&t.trim()==="continue"){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.openServiceForLocation("guestList",currentLoc());}},true);
})();

/* v28.5 media upload templates override */
(function(){
"use strict";
function byId(id){return document.getElementById(id);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function templateAllowsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return !!(t.supportsMedia||t.supportsImage||t.supportsVideo);}
function templateAcceptsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};if(t.supportsVideo||t.supportsMedia)return "image/*,video/mp4,video/quicktime,video/webm";if(t.supportsImage)return "image/*";return "";}
function templateUploadLabel(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return (t.supportsVideo||t.supportsMedia)?"Upload Image or Video":"Upload Image";}
function editorHost(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
function templateHost(){return byId("templateList")||byId("templatesList")||document.querySelector(".template-list");}
function ensureMediaEditor(){
 const host=editorHost(); if(!host||byId("shoutoutMediaUpload")||!templateAllowsMedia())return;
 const box=document.createElement("div"); box.className="card media-upload-card"; box.innerHTML=`<h2>Media Upload</h2><p class="sub small">Add media only when this template supports it.</p><label>${templateUploadLabel()}<input id="shoutoutMediaUpload" type="file" accept="${templateAcceptsMedia()}"></label><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`; host.appendChild(box);
 byId("shoutoutMediaUpload").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0],prev=byId("shoutoutMediaPreview"); if(!f||!prev)return; const url=URL.createObjectURL(f); const isV=f.type.startsWith("video/"); prev.classList.remove("hidden"); prev.innerHTML=isV?`<video src="${url}" controls playsinline muted loop></video><p>${esc(f.name)}</p>`:`<img src="${url}" alt=""><p>${esc(f.name)}</p>`;});
}
async function uploadSelectedMedia(referenceNumber){
 const input=byId("shoutoutMediaUpload"), file=input&&input.files&&input.files[0]; if(!file)return {mediaUrl:"",mediaType:""};
 if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
 const user=firebase.auth().currentUser; if(!user)throw new Error("Sign in first.");
 const safeName=((referenceNumber||Date.now())+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
 const storagePath=`shoutouts/${user.uid}/${referenceNumber||Date.now()}/original/${safeName}`;
 const ref=firebase.storage().ref().child(storagePath);
 await ref.put(file,{contentType:file.type}); const mediaUrl=await ref.getDownloadURL(); const mediaType=file.type.startsWith("video/")?"video":"image";
 byId("shoutoutMediaUrl").value=mediaUrl; byId("shoutoutMediaType").value=mediaType; return {mediaUrl,mediaType,mediaFileName:file.name,mediaStoragePath:storagePath,mediaUploadedAt:firebase.firestore.FieldValue.serverTimestamp()};
}
function ensureTemplates(){
 const host=templateHost(); if(!host||host.dataset.v285==="1")return; host.dataset.v285="1";
 const lib=window.SHOUTOUT_MEDIA_TEMPLATE_LIBRARY||{};
 const wrap=document.createElement("div"); wrap.className="media-template-grid";
 wrap.innerHTML=Object.values(lib).map(t=>`<button class="media-template-card" data-template-id="${esc(t.id)}" type="button"><div class="template-preview-board tpl-${esc(t.previewStyle)}">${t.supportsVideo?'<div class="video-placeholder">VIDEO</div>':''}${t.supportsImage?'<div class="photo-placeholder">PHOTO</div>':''}<div><strong>${esc(t.mainText||t.name)}</strong><span>${esc(t.subText||t.category)}</span></div></div><h3>${esc(t.name)}</h3><p class="sub small">${esc(t.description||"")}</p></button>`).join("");
 host.prepend(wrap);
 wrap.addEventListener("click",e=>{const c=e.target.closest("[data-template-id]"); if(!c)return; wrap.querySelectorAll(".selected").forEach(x=>x.classList.remove("selected")); c.classList.add("selected"); window.selectedTemplate=c.dataset.templateId;});
}
function ensureSuggestions(){
 const host=editorHost(); if(!host||byId("aiSuggestionsBox")||byId("aiSuggestionList"))return;
 const box=document.createElement("div"); box.id="aiSuggestionsBox"; box.className="card"; box.innerHTML=`<h2>ShoutOut Recommendations</h2><details class="info-popout ai-recommendation-popout"><summary>How recommendations work</summary><div class="info-popout-bubble">FLOQR uses your own profile, selected tone, current ShoutOut draft, selected template, venue context, and your past ShoutOuts to build LED-safe suggestions. Gemini runs through Firebase Functions when available; otherwise FLOQR uses a local contextual fallback.</div></details><div id="aiSuggestionList" class="dynamic-recommendation-list"><p class="sub small">Type a message or choose a tone to generate personalized ideas.</p></div>`; host.appendChild(box);
 if(typeof window.refreshPersonalizedShoutOutRecommendations==="function") window.refreshPersonalizedShoutOutRecommendations();
}
window.jadzUploadSelectedShoutoutMedia=uploadSelectedMedia;
document.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},1000);setInterval(()=>{ensureTemplates();ensureMediaEditor();ensureSuggestions();},2500);});
})();


/* v28.6 single media input and live preview fix */
(function(){
  "use strict";
function byId(id){return document.getElementById(id);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function templateAllowsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return !!(t.supportsMedia||t.supportsImage||t.supportsVideo);}
  function templateAcceptsMedia(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};if(t.supportsVideo||t.supportsMedia)return "image/*,video/mp4,video/quicktime,video/webm";if(t.supportsImage)return "image/*";return "";}
  function templateUploadLabel(){const id=document.body?.dataset.selectedTemplate||"blackwhite";const t=(window.SHOUTOUT_TEMPLATES||{})[id]||{};return (t.supportsVideo||t.supportsMedia)?"Upload Image or Video":"Upload Image";}
  function findTextInput(){return byId("mainText")||byId("shoutoutText")||byId("messageText")||document.querySelector("textarea[name='mainText']")||document.querySelector("textarea")||document.querySelector("input[name='mainText']");}
  function findSubTextInput(){return byId("subText")||byId("shoutoutSubText")||document.querySelector("input[name='subText']")||document.querySelector("textarea[name='subText']");}
  function findEditor(){return byId("editorPage")||byId("screenEditor")||document.querySelector("#editor,.editor-page,[data-screen='editor']");}
  function controlsCard(){return byId("editorPage")?.querySelector(".composer > .card:not(.preview)")||byId("editorPage")?.querySelector(".composer .card")||findEditor();}
  function infoPopout(label,text,extraClass){
    return `<details class="info-popout ${extraClass||""}"><summary>${esc(label)}</summary><div class="info-popout-bubble">${esc(text)}</div></details>`;
  }
  function setVideoNotice(text,label){
    const notice=byId("videoTrimNotice");
    if(!notice)return;
    notice.innerHTML=text?infoPopout(label||"Video trim warning",text,"warning-popout"):"";
  }
  function placeMediaCard(card){
    const host=controlsCard(); if(!host||!card)return;
    const panel=byId("aiMediaPanel"), submit=byId("submitShoutoutBtn"), status=byId("submitStatus");
    const anchor=(panel&&panel.parentElement===host)?panel:(submit&&submit.parentElement===host)?submit:(status&&status.parentElement===host)?status:null;
    if(card.parentElement!==host||card.nextElementSibling!==anchor) host.insertBefore(card, anchor||null);
  }
  function clearSelectedMedia(){
    const input=byId("shoutoutMediaUpload"), preview=byId("shoutoutMediaPreview");
    if(input) input.value="";
    if(preview){preview.classList.add("hidden");preview.innerHTML="";}
    ["shoutoutMediaUrl","shoutoutMediaType","mediaUrl","aiSelectedMediaVersion","aiEnhancementType","aiEnhancementPrompt","aiOriginalDuration","aiTrimmedDuration","aiTrimStart","aiTrimEnd"].forEach(id=>{const el=byId(id);if(el){el.value=id==="aiTrimStart"?"0":"";if(id==="shoutoutMediaUrl")delete el.dataset.previewUrl;el.dispatchEvent(new Event("input",{bubbles:true}));}});
    setVideoNotice("");
    const status=byId("uploadStatus"); if(status)status.textContent="Media removed.";
    if(window.FLOQRAIMedia?.resetSelection) window.FLOQRAIMedia.resetSelection();
    if(typeof window.updatePreview==="function") window.updatePreview();
  }
  function hideLegacyPhotoInput(){
    const legacy=byId("shoutoutPhotoWrap");
    if(legacy) legacy.classList.add("hidden");
  }
  function removeDuplicateMediaInputs(){
    const fileInputs=Array.from(document.querySelectorAll("input[type='file']")).filter(i=>!i.matches("[data-football-team-photo]")&&/image|photo|video|media|upload/i.test(((i.closest("label")||{}).textContent||"")+" "+(i.id||"")+" "+(i.name||"")));
    if(fileInputs.length<=1)return;
    let keep=byId("shoutoutMediaUpload")||fileInputs[0];
    keep.id="shoutoutMediaUpload";
    keep.accept="image/*,video/mp4,video/quicktime,video/webm";
    fileInputs.forEach(input=>{if(input!==keep){const wrap=input.closest("label")||input.parentElement;if(wrap)wrap.style.display="none";}});
  }
  function ensureSingleMediaUploader(){
    const editor=findEditor(); if(!editor)return;
    const existingCard=(byId("shoutoutMediaUpload")?.closest(".media-upload-card"))||byId("shoutoutMediaCard");
    if(!templateAllowsMedia()){
      removeDuplicateMediaInputs();
      if(existingCard) existingCard.classList.add("hidden");
      setVideoNotice("");
      return;
    }
    removeDuplicateMediaInputs();
    hideLegacyPhotoInput();
    let input=byId("shoutoutMediaUpload");
    let card=input?.closest(".media-upload-card")||byId("shoutoutMediaCard");
    if(!input){
      card=document.createElement("div");
      card.className="media-upload-card";
      card.innerHTML=`<h2>Media Upload</h2><p class="single-media-upload-note">Add media only when this template supports it.</p><label>${templateUploadLabel()}<input id="shoutoutMediaUpload" type="file" accept="${templateAcceptsMedia()}"></label><div class="button-row"><button id="removeShoutoutMediaBtn" type="button">Remove file</button></div><div id="shoutoutMediaPreview" class="media-preview-box hidden"></div><input id="shoutoutMediaUrl" type="hidden"><input id="shoutoutMediaType" type="hidden">`;
      placeMediaCard(card);
      input=byId("shoutoutMediaUpload");
    }
    if(card) card.classList.remove("hidden");
    const note=card?.querySelector(".single-media-upload-note");
    if(note) note.textContent="Add an image or video for this media-capable template. Long videos warn and use only the first 7 seconds.";
    const label=card?.querySelector(".file-upload-label")||input?.closest("label");
    if(label&&label.firstChild) label.firstChild.textContent=`${templateUploadLabel()} `;
    if(card&&!byId("removeShoutoutMediaBtn")){
      const row=document.createElement("div");
      row.className="button-row";
      row.innerHTML=`<button id="removeShoutoutMediaBtn" type="button">Remove file</button>`;
      const preview=byId("shoutoutMediaPreview");
      card.insertBefore(row, preview||null);
    }
    if(card) placeMediaCard(card);
    input.accept=templateAcceptsMedia();
    input.onchange=renderLiveMediaPreview;
    const removeBtn=byId("removeShoutoutMediaBtn");
    if(removeBtn&&!removeBtn.dataset.bound){removeBtn.dataset.bound="1";removeBtn.addEventListener("click",clearSelectedMedia);}
  }
  function getCurrentText(){
    const main=findTextInput(), sub=findSubTextInput();
    return {mainText:main?main.value.trim():"", subText:sub?sub.value.trim():""};
  }
  function renderLiveMediaPreview(){
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!file||!preview)return;
    setVideoNotice("");
    const url=URL.createObjectURL(file);
    const isVideo=file.type.startsWith("video/");
    const text=getCurrentText();
    const mediaUrlField=byId("shoutoutMediaUrl");
    if(mediaUrlField)mediaUrlField.dataset.previewUrl=url;
    const mediaTypeField=byId("shoutoutMediaType");
    if(mediaTypeField)mediaTypeField.value=isVideo?"video":"image";
    preview.classList.remove("hidden");
    preview.innerHTML=`<div class="media-preview-stage">${isVideo?`<video src="${url}" autoplay muted loop playsinline controls></video>`:`<img src="${url}" alt="">`}<div class="media-preview-overlay"><strong>${esc(text.mainText||"YOUR SHOUTOUT")}</strong><span>${esc(text.subText||"LIVE ON THE DISPLAY")}</span></div></div>${infoPopout("Media details",`${file.name} - ${isVideo?"Video":"Image"} preview`,"media-details-popout")}`;
    if(typeof window.updatePreview==="function") window.updatePreview();
    if(isVideo){
      const video=preview.querySelector("video");
      video?.addEventListener("loadedmetadata",()=>{
        const duration=Number(video.duration||0);
        const trimEnd=Math.min(duration||7,7);
        const original=byId("aiOriginalDuration"), trimmed=byId("aiTrimmedDuration"), start=byId("aiTrimStart"), end=byId("aiTrimEnd"), version=byId("aiSelectedMediaVersion"), type=byId("aiEnhancementType"), prompt=byId("aiEnhancementPrompt");
        if(original)original.value=duration?String(duration):"";
        if(start)start.value="0";
        if(end)end.value=String(trimEnd);
        if(duration>7){
          if(trimmed)trimmed.value="7";
          if(version)version.value="trimmed";
          if(type)type.value="trim";
          if(prompt)prompt.value="Trim Video to 7 Seconds";
          setVideoNotice(`Warning: this video is ${duration.toFixed(1)} seconds. FLOQR will cut and use only the first 7 seconds.`);
          video.addEventListener("timeupdate",()=>{if(video.currentTime>=7){try{video.currentTime=0;}catch(e){} video.play?.().catch(()=>{});}});
        }else{
          if(trimmed)trimmed.value=duration?String(duration):"";
          if(version)version.value="original";
          setVideoNotice(duration?`Video duration ${duration.toFixed(1)} seconds. Ready.`:"Video ready.","Video details");
        }
        if(typeof window.updatePreview==="function") window.updatePreview();
      });
    }
  }
  function refreshPreviewText(){
    const preview=byId("shoutoutMediaPreview")||byId("liveShoutoutPreview");
    if(!preview||preview.classList.contains("hidden"))return;
    const text=getCurrentText();
    const strong=preview.querySelector(".media-preview-overlay strong");
    const span=preview.querySelector(".media-preview-overlay span");
    if(strong)strong.textContent=text.mainText||"YOUR SHOUTOUT";
    if(span)span.textContent=text.subText||"LIVE ON THE DISPLAY";
  }
  function patchAISuggestionButtons(){
    document.addEventListener("click",function(e){
      const btn=e.target.closest(".ai-suggestion,[data-ai-suggestion]");
      if(!btn)return;
      if(btn.classList.contains("personalized-ai-suggestion"))return;
      const input=findTextInput();
      if(input){
        input.value=btn.textContent.trim();
        input.dispatchEvent(new Event("input",{bubbles:true}));
        input.dispatchEvent(new Event("change",{bubbles:true}));
        refreshPreviewText();
      }
    },true);
  }
  function bindTextPreviewRefresh(){
    const main=findTextInput(), sub=findSubTextInput();
    if(main&&!main.dataset.v286Bound){main.dataset.v286Bound="1";main.addEventListener("input",refreshPreviewText);main.addEventListener("change",refreshPreviewText);}
    if(sub&&!sub.dataset.v286Bound){sub.dataset.v286Bound="1";sub.addEventListener("input",refreshPreviewText);sub.addEventListener("change",refreshPreviewText);}
  }
  async function uploadSingleSelectedMedia(referenceNumber){
    if(!templateAllowsMedia())return {mediaUrl:"",mediaType:""};
    const input=byId("shoutoutMediaUpload");
    const file=input&&input.files&&input.files[0];
    if(!file)return {mediaUrl:"",mediaType:""};
    if(!firebase.storage){alert("Firebase Storage SDK is not loaded.");return {mediaUrl:"",mediaType:""};}
    const user=firebase.auth().currentUser;
    if(!user)throw new Error("Please sign in before uploading media.");
    const safeName=((referenceNumber||Date.now())+"-"+file.name).replace(/[^a-zA-Z0-9._-]/g,"_");
    const storagePath=`shoutouts/${user.uid}/${referenceNumber||Date.now()}/original/${safeName}`;
    const ref=firebase.storage().ref().child(storagePath);
    await ref.put(file,{contentType:file.type});
    const mediaUrl=await ref.getDownloadURL();
    const mediaType=file.type.startsWith("video/")?"video":"image";
    const mediaUrlInput=byId("shoutoutMediaUrl"), mediaTypeInput=byId("shoutoutMediaType");
    if(mediaUrlInput)mediaUrlInput.value=mediaUrl;
    if(mediaTypeInput)mediaTypeInput.value=mediaType;
    const duration = byId("aiOriginalDuration")?.value || "";
    const trimmedDuration = byId("aiTrimmedDuration")?.value || "";
    const trimStart = byId("aiTrimStart")?.value || "";
    const trimEnd = byId("aiTrimEnd")?.value || "";
    const selectedMediaVersion = byId("aiSelectedMediaVersion")?.value || (mediaType==="video" && Number(duration)>7 ? "trimmed" : "original");
    return {
      mediaUrl,
      mediaType,
      mediaFileName:file.name,
      mediaStoragePath:storagePath,
      originalMediaUrl:mediaUrl,
      selectedMediaVersion,
      aiEnhancementApplied:selectedMediaVersion==="trimmed",
      aiEnhancementType:selectedMediaVersion==="trimmed" ? "trim" : "none",
      aiEnhancementPrompt:selectedMediaVersion==="trimmed" ? "Trim Video to 7 Seconds" : "",
      originalDuration:duration ? Number(duration) : null,
      trimmedDuration:trimmedDuration ? Number(trimmedDuration) : null,
      trimStart:trimStart ? Number(trimStart) : 0,
      trimEnd:trimEnd ? Number(trimEnd) : null,
      trimProcessingMode:selectedMediaVersion==="trimmed" ? "metadata-first-seven-seconds" : "",
      trimWarning:selectedMediaVersion==="trimmed" ? "FLOQR will cut and use only the first 7 seconds." : "",
      mediaUploadedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
  }
  window.jadzUploadSelectedShoutoutMedia=uploadSingleSelectedMedia;
  window.jadzEnsureSingleMediaUploader=ensureSingleMediaUploader;
  window.jadzRefreshShoutoutMediaPreview=refreshPreviewText;
  document.addEventListener("DOMContentLoaded",()=>{
    patchAISuggestionButtons();
    setInterval(()=>{ensureSingleMediaUploader();bindTextPreviewRefresh();removeDuplicateMediaInputs();},1000);
  });
})();
