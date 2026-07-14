/* patron-portal-app.js v29.07 */
(function(){
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const splitCSV = value => String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  const joinCSV = value => Array.isArray(value) ? value.join(", ") : String(value || "");
  function parsePersonalCorrections(value = "") {
    const seen = new Set();
    return String(value || "")
      .split(/\r?\n|,/)
      .map(line => {
        const match = line.match(/^\s*(.+?)\s*(?:->|=>|:)\s*(.+?)\s*$/);
        return match ? {from:match[1].trim(), to:match[2].trim()} : null;
      })
      .filter(Boolean)
      .filter(row => row.from && row.to && row.from.toLowerCase() !== row.to.toLowerCase())
      .filter(row => {
        const key = row.from.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 120);
  }
  const formatPersonalCorrections = rows => (Array.isArray(rows) ? rows : [])
    .map(row => `${row.from || ""} -> ${row.to || ""}`.trim())
    .filter(line => line !== "->")
    .join("\n");
  const linkify = value => esc(value).replace(/(https?:\/\/[^\s<]+|\.\/[^\s<]+)/g, match => `<a href="${match}" class="message-inline-link">${match}</a>`);
  const fmtDate = value => {
    if (!value) return "-";
    const d = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return isNaN(d) ? "-" : d.toLocaleString();
  };

  function countryUsesFeetInches(country = "") {
    const value = String(country || "").trim().toLowerCase();
    return ["us", "usa", "u.s.", "u.s.a.", "united states", "united states of america", "canada", "ca"].includes(value);
  }

  function preferredHeightUnit(country = "") {
    return countryUsesFeetInches(country) ? "ftin" : "m";
  }

  function applyEditHeightUnit(force = false) {
    const unit = byId("editHeightUnit");
    const height = byId("editHeight");
    if (!unit || !height) return;
    if (force || !unit.dataset.userSelected) unit.value = preferredHeightUnit(byId("editCountry")?.value || "");
    height.placeholder = unit.value === "ftin" ? "5'10\"" : "1.78";
  }

  function heightDisplay(profile = {}) {
    const value = String(profile.height || "").trim();
    if (!value) return "";
    const unit = profile.heightUnit || preferredHeightUnit(profile.country);
    return unit === "m" ? `${value} m` : value;
  }

  function minglUploadErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "storage/unauthorized" || /unauthorized|permission|storage rules/i.test(message)) {
      return "Mingl picture upload failed because Firebase Storage rules are blocking mingl-chat/{uid}/{roomId}. Publish this package's storage.rules, then try the picture again.";
    }
    return message;
  }

  const ROLE_LABELS = {
    patron: "Patron",
    promoter: "Promoter",
    dj: "DJ",
    hospitality: "Waiter / Waitress / Bottle Girl",
    clubAdmin: "Club Admin",
    masterAdmin: "Master Admin"
  };

  const PROFILE_TEMPLATES = {
    patron: {
      title: "Patron Social Profile",
      headline: "Nightlife, travel, music, and trusted follower visibility.",
      sections: ["Music interests", "Travel interests", "General hobbies", "Favorite nightlife style", "Looking to meet", "10 media slots: 8 photos and 2 short videos"]
    },
    promoter: {
      title: "Promoter Profile",
      headline: "Events, guest lists, VIP tables, music markets, and verified contact points.",
      sections: ["Active cities", "Upcoming events", "Guest list specialties", "VIP table style", "Approved venue relationships", "Public promo media"]
    },
    dj: {
      title: "DJ Profile",
      headline: "Sound, residency, booking identity, and show media.",
      sections: ["Genres", "Residencies", "Booking availability", "Mix links", "Crowd style", "Performance media"]
    },
    hospitality: {
      title: "Hospitality Profile",
      headline: "Bottle service, waiter/waitress, table support, and venue experience.",
      sections: ["Venue experience", "Service style", "Languages", "Available nights", "Bottle service specialties", "Professional media"]
    }
  };

  const LANGUAGE_LABELS = {
    en: "English",
    fr: "French",
    es: "Spanish",
    it: "Italian",
    de: "German",
    el: "Greek",
    pt: "Portuguese",
    nl: "Dutch",
    sv: "Swedish",
    da: "Danish",
    no: "Norwegian",
    fi: "Finnish",
    is: "Icelandic",
    ar: "Arabic",
    tr: "Turkish",
    zh: "Chinese",
    th: "Thai",
    ms: "Malay"
  };

  if (!window.firebaseConfig) { setText("portalStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  let currentProfile = {};
  let currentLanguageSettings = {};
  let currentMessages = [];
  let messageRecipients = [];
  let currentShoutouts = [];
  let activeShoutoutEditId = "";
  let activePortalMinglRoomId = "";
  let portalMinglUnsubscribe = null;
  let currentMinglConnections = [];
  let currentMinglFriendRows = [];
  let currentPortalUsers = [];
  let portalMinglAttachmentFile = null;
  let profileMediaDraft = [];

  const PUBLIC_MINGL_DATAPOINTS = [
    {key:"location", label:"City, state/region, and country"},
    {key:"gender", label:"Gender"},
    {key:"height", label:"Height"},
    {key:"music", label:"Music interests"},
    {key:"events", label:"Event and nightlife interests"},
    {key:"travel", label:"Travel interests"},
    {key:"hobbies", label:"General hobbies"},
    {key:"food", label:"Food choices"},
    {key:"beverage", label:"Favorite beverage choices"},
    {key:"meet", label:"Looking to meet"},
    {key:"media", label:"Public profile media"}
  ];

  function actionFeedback(messages, action) {
    if (window.FLOQRActionFeedback?.run) return window.FLOQRActionFeedback.run(messages, action);
    return action();
  }

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function showPortalPanel(panelId, tabPanelId = "") {
    document.querySelectorAll(".admin-tab").forEach(btn => btn.classList.toggle("active", !!tabPanelId && btn.dataset.panel === tabPanelId));
    document.querySelectorAll(".admin-panel-section").forEach(section => section.classList.remove("active"));
    byId(panelId)?.classList.add("active");
  }

  function setupTabs() {
    document.querySelectorAll(".admin-tab[data-panel]").forEach(btn => {
      btn.addEventListener("click", () => {
        showPortalPanel(btn.dataset.panel, btn.dataset.panel);
      });
    });
    const tab = new URL(window.location.href).searchParams.get("tab");
    if (tab) {
      if (["chats","mingl","mingl-chat"].includes(tab)) {
        const params = new URLSearchParams({v:"29.04"});
        const room = new URL(window.location.href).searchParams.get("room");
        if (room) params.set("room", room);
        window.location.href = `./mingl-chat.html?${params.toString()}`;
        return;
      }
      const map = {messages:"portalMessages", inbox:"portalMessages", help:"portalHelp", profile:"portalProfile", public:"portalPublicProfile", media:"portalPublicProfile", settings:"portalProfile", language:"portalLanguageSettings", "language-settings":"portalLanguageSettings", "my-privacy":"portalPrivacy", "ai-notifications":"portalAiNotifications", templates:"portalTemplateVariants", privacy:"portalPrivacy"};
      const btn = document.querySelector(`[data-panel='${map[tab] || ""}']`);
      if (btn) btn.click();
      else if (map[tab]) showPortalPanel(map[tab], tab === "mingl-chat" ? "portalChats" : "");
    }
  }

  async function loginGoogle() {
    try { setText("portalStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("portalStatus", `${e.code || "error"}: ${e.message}`); }
  }

  async function logout() { await auth.signOut(); window.location.href = "./?v=28.43-f"; }

  async function getCollectionSafe(name, filterFn, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, _collection:name, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) { return []; }
  }

  async function getParticipantCollectionSafe(name, uid, limit=1000) {
    try {
      const snap = await db.collection(name).where("participants", "array-contains", uid).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, _collection:name, ...d.data()}));
    } catch(e) { return []; }
  }

  async function queryCollectionSafe(name, field, value, limit=150) {
    if (!value) return [];
    try {
      const snap = await db.collection(name).where(field, "==", value).limit(limit).get();
      return snap.docs.map(d => ({id:d.id, _collection:name, ...d.data()}));
    } catch (e) { return []; }
  }

  function uniqueRows(rows = []) {
    const map = new Map();
    rows.flat().forEach(row => {
      if (!row) return;
      map.set(`${row._collection || "row"}:${row.id || row.referenceNumber || JSON.stringify(row)}`, row);
    });
    return Array.from(map.values());
  }

  async function getUserScopedRows(name, user, fields, limit=150) {
    const queries = fields.map(([field, source]) => queryCollectionSafe(name, field, source === "email" ? user.email : user.uid, limit));
    return uniqueRows(await Promise.all(queries));
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  function languageLabel(code) {
    if (code === "auto") return "Auto-detect";
    return LANGUAGE_LABELS[code] || code || "Not selected";
  }

  function publicProfileBio(profile = {}, template = PROFILE_TEMPLATES.patron) {
    const mode = profile.publicProfileLanguageMode || "preferred";
    if (mode === "english") {
      return profile.publicProfileBioEnglish || profile.bioEnglish || profile.publicProfileBioOriginal || profile.bio || template.headline;
    }
    return profile.publicProfileBioOriginal || profile.bio || template.headline;
  }

  function publicProfileLanguageLabel(profile = {}) {
    return (profile.publicProfileLanguageMode || "preferred") === "english"
      ? "English"
      : languageLabel(profile.preferredLanguage);
  }

  function buildProfileTranslationState(originalBio, englishBio, preferredLanguage) {
    const language = preferredLanguage || "en";
    const isEnglish = language === "en" || !language;
    const finalEnglishBio = englishBio || (isEnglish ? originalBio : "");
    return {
      publicProfileBioOriginal: originalBio,
      publicProfileBioEnglish: finalEnglishBio,
      publicProfileOriginalLanguage: language,
      publicProfileTranslationStatus: finalEnglishBio
        ? "provided"
        : "ai-ready-not-live",
      publicProfileTranslationProviderMode: window.FLOQR_AI_ENABLED ? "firebase-ai-logic-ready" : "local-placeholder"
    };
  }

  function defaultLanguageSettings(profile = {}) {
    return {
      aiGrammarEnabled:!!profile.languageSettings?.aiGrammarEnabled,
      correctionMode:profile.languageSettings?.correctionMode || "approvalRequired",
      highlightSpellingErrors:profile.languageSettings?.highlightSpellingErrors !== false,
      highlightGrammarSuggestions:profile.languageSettings?.highlightGrammarSuggestions !== false,
      preferredLanguage:profile.languageSettings?.preferredLanguage || profile.preferredLanguage || "auto",
      tonePreference:profile.languageSettings?.tonePreference || "keepTone",
      emojiSkinTone:profile.languageSettings?.emojiSkinTone || "yellow",
      personalDictionary:Array.isArray(profile.languageSettings?.personalDictionary) ? profile.languageSettings.personalDictionary : [],
      personalCorrections:Array.isArray(profile.languageSettings?.personalCorrections) ? profile.languageSettings.personalCorrections : []
    };
  }

  function fillLanguageSettings(profile = {}) {
    currentLanguageSettings = defaultLanguageSettings(profile);
    const settings = currentLanguageSettings;
    if (byId("languageAiGrammarEnabled")) byId("languageAiGrammarEnabled").checked = !!settings.aiGrammarEnabled;
    const mode = settings.correctionMode || "approvalRequired";
    document.querySelectorAll("input[name='languageCorrectionMode']").forEach(input => {
      input.checked = input.value === mode;
    });
    if (byId("languageHighlightSpellingErrors")) byId("languageHighlightSpellingErrors").checked = !!settings.highlightSpellingErrors;
    if (byId("languageHighlightGrammarSuggestions")) byId("languageHighlightGrammarSuggestions").checked = !!settings.highlightGrammarSuggestions;
    if (byId("languagePreferredLanguage")) byId("languagePreferredLanguage").value = settings.preferredLanguage || "auto";
    if (byId("languageTonePreference")) byId("languageTonePreference").value = settings.tonePreference || "keepTone";
    if (byId("languageEmojiSkinTone")) byId("languageEmojiSkinTone").value = settings.emojiSkinTone || "yellow";
    if (byId("languagePersonalDictionary")) byId("languagePersonalDictionary").value = (settings.personalDictionary || []).join(", ");
    if (byId("languagePersonalCorrections")) byId("languagePersonalCorrections").value = formatPersonalCorrections(settings.personalCorrections || []);
    renderLanguageSettingsReport(settings);
    updateChatGrammarControls();
  }

  function selectedCorrectionMode() {
    return document.querySelector("input[name='languageCorrectionMode']:checked")?.value || "approvalRequired";
  }

  function collectLanguageSettings() {
    return {
      aiGrammarEnabled:!!byId("languageAiGrammarEnabled")?.checked,
      correctionMode:selectedCorrectionMode(),
      highlightSpellingErrors:!!byId("languageHighlightSpellingErrors")?.checked,
      highlightGrammarSuggestions:!!byId("languageHighlightGrammarSuggestions")?.checked,
      preferredLanguage:byId("languagePreferredLanguage")?.value || "auto",
      tonePreference:byId("languageTonePreference")?.value || "keepTone",
      emojiSkinTone:byId("languageEmojiSkinTone")?.value || "yellow",
      personalDictionary:splitCSV(byId("languagePersonalDictionary")?.value || "").slice(0, 120),
      personalCorrections:parsePersonalCorrections(byId("languagePersonalCorrections")?.value || "")
    };
  }

  function renderLanguageSettingsReport(settings = currentLanguageSettings) {
    const report = byId("languageSettingsReport");
    if (!report) return;
    report.innerHTML = simpleRows([
      ["AI Grammar", settings.aiGrammarEnabled ? "Enabled" : "Disabled"],
      ["Correction Mode", settings.correctionMode || "approvalRequired"],
      ["Preferred Language", languageLabel(settings.preferredLanguage || "auto")],
      ["Tone Preference", settings.tonePreference || "keepTone"],
      ["Emoji Skin Tone", settings.emojiSkinTone || "yellow"],
      ["My Word List", `${(settings.personalDictionary || []).length} saved words`],
      ["My Personal Corrections", `${(settings.personalCorrections || []).length} saved typo fixes`],
      ["Draft Privacy", "Draft text is processed only when you request correction and is not indexed."]
    ]);
  }

  async function addPersonalDictionaryWord(word = "") {
    const user = auth.currentUser;
    const clean = String(word || "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
    if (!user || !clean) return false;
    const existing = splitCSV(byId("languagePersonalDictionary")?.value || "").concat(currentLanguageSettings.personalDictionary || []);
    const seen = new Set();
    const personalDictionary = existing.concat(clean)
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .filter(item => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 120);
    currentLanguageSettings = {...currentLanguageSettings, personalDictionary};
    if (byId("languagePersonalDictionary")) byId("languagePersonalDictionary").value = personalDictionary.join(", ");
    renderLanguageSettingsReport(currentLanguageSettings);
    await db.collection("users").doc(user.uid).set({
      languageSettings:{
        ...currentLanguageSettings,
        personalDictionary,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }
    }, {merge:true});
    return true;
  }

  async function addPersonalCorrection(from = "", to = "") {
    const user = auth.currentUser;
    const cleanFrom = String(from || "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
    const cleanTo = String(to || "").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
    if (!user || !cleanFrom || !cleanTo || cleanFrom.toLowerCase() === cleanTo.toLowerCase()) return false;
    const existing = parsePersonalCorrections(byId("languagePersonalCorrections")?.value || "")
      .concat(currentLanguageSettings.personalCorrections || []);
    const map = new Map();
    existing.forEach(row => {
      if (row?.from && row?.to) map.set(String(row.from).toLowerCase(), {from:row.from, to:row.to});
    });
    map.set(cleanFrom.toLowerCase(), {from:cleanFrom, to:cleanTo});
    const personalCorrections = Array.from(map.values()).slice(0, 120);
    currentLanguageSettings = {...currentLanguageSettings, personalCorrections};
    if (byId("languagePersonalCorrections")) byId("languagePersonalCorrections").value = formatPersonalCorrections(personalCorrections);
    renderLanguageSettingsReport(currentLanguageSettings);
    await db.collection("users").doc(user.uid).set({
      languageSettings:{
        ...currentLanguageSettings,
        personalCorrections,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }
    }, {merge:true});
    return true;
  }

  async function saveLanguageSettings() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Saving language settings...",
      wait:"We are saving your grammar and spelling preferences.",
      success:"Language settings saved",
      redirecting:"Language settings saved, returning to Language Settings.",
      returnTo:"Language Settings"
    }, async () => {
      const languageSettings = {
        ...collectLanguageSettings(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("users").doc(user.uid).set({languageSettings}, {merge:true});
      currentLanguageSettings = {...languageSettings};
      renderLanguageSettingsReport(currentLanguageSettings);
      updateChatGrammarControls();
      setText("portalStatus", "Language settings saved.");
    });
  }

  function getApprovedRoles(profile = currentProfile) {
    const roles = new Set();
    const raw = [
      profile.memberLevel,
      profile.role,
      profile.approvedRole,
      ...(Array.isArray(profile.approvedRoles) ? profile.approvedRoles : []),
      ...(Array.isArray(profile.roles) ? profile.roles : [])
    ].filter(Boolean).map(x => String(x).toLowerCase());
    raw.forEach(x => {
      if (x.includes("master")) roles.add("masterAdmin");
      if (x.includes("club")) roles.add("clubAdmin");
      if (x.includes("promoter")) roles.add("promoter");
      if (x.includes("dj")) roles.add("dj");
      if (x.includes("waiter") || x.includes("waitress") || x.includes("bottle") || x.includes("hospitality")) roles.add("hospitality");
    });
    if (!roles.size) roles.add("patron");
    return Array.from(roles);
  }

  function canSendDirectInbox(profile = currentProfile) {
    return getApprovedRoles(profile).some(role => ["masterAdmin","clubAdmin","promoter","dj","hospitality"].includes(role));
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function contextualTextMatch(query, value) {
    const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    const haystack = normalizeSearchText(value);
    return !tokens.length || tokens.every(token => haystack.includes(token));
  }

  function recipientText(recipient = {}) {
    return [
      recipient.label, recipient.displayName, recipient.username, recipient.email,
      recipient.roleLabel, recipient.locationName, recipient.clubLocationId
    ].join(" ");
  }

  function supportRecipientLabel(recipient = {}) {
    const role = recipient.roleLabel || "Internal Recipient";
    const location = recipient.locationName ? ` - ${recipient.locationName}` : "";
    return `${recipient.label || recipient.email || "Recipient"} (${role}${location})`;
  }

  function buildMessageRecipients(user, users = [], designations = []) {
    const canDirect = canSendDirectInbox(currentProfile);
    const byKey = new Map();
    const add = item => {
      const key = item.uid || item.email || item.label;
      if (!key || key === user.uid || item.email === user.email) return;
      byKey.set(key, item);
    };

    (window.SHOUTOUT_ADMIN_EMAILS || []).forEach(email => add({
      uid: "",
      email,
      label: "Club Admin",
      displayName: "Club Admin",
      roleLabel: "Club Admin",
      recipientType: "club_admin"
    }));

    designations.filter(x => x.isCSR !== false).forEach(item => add({
      uid: item.workerUid || "",
      email: item.workerEmail || "",
      label: item.workerName || item.workerUsername || "Customer Service Representative",
      username: item.workerUsername || "",
      roleLabel: "Customer Service Representative",
      recipientType: "club_csr",
      clubLocationId: item.clubLocationId || "",
      locationName: item.clubLocationName || item.clubLocationId || ""
    }));

    if (canDirect) {
      users.forEach(profile => add({
        uid: profile.uid || profile.id || "",
        email: profile.email || "",
        label: profile.displayName || profile.fullName || profile.username || profile.email || "Member",
        username: profile.username || "",
        roleLabel: getApprovedRoles(profile).map(x => ROLE_LABELS[x] || x).join(", ") || "Member",
        recipientType: "member"
      }));
    }

    return Array.from(byKey.values()).sort((a,b) => supportRecipientLabel(a).localeCompare(supportRecipientLabel(b)));
  }

  function selectMessageRecipient(recipient) {
    byId("composeRecipientUid").value = recipient.uid || "";
    byId("composeRecipientEmail").value = recipient.email || "";
    byId("composeRecipientLabel").value = supportRecipientLabel(recipient);
    byId("composeRecipientSearch").value = supportRecipientLabel(recipient);
    renderRecipientSearchResults();
  }

  function renderRecipientSearchResults() {
    const wrap = byId("recipientSearchResults");
    if (!wrap) return;
    const query = byId("composeRecipientSearch")?.value || "";
    const selectedUid = byId("composeRecipientUid")?.value || "";
    const selectedEmail = byId("composeRecipientEmail")?.value || "";
    const rows = messageRecipients
      .filter(x => contextualTextMatch(query, recipientText(x)))
      .slice(0, 12);
    wrap.innerHTML = rows.length ? rows.map((item, index) => `<button type="button" class="${(item.uid && item.uid === selectedUid) || (item.email && item.email === selectedEmail) ? "selected" : ""}" data-recipient-index="${index}">
      <strong>${esc(item.label || item.email || "Recipient")}</strong>
      <span>${esc(item.username ? `@${item.username}` : item.email || "")}</span>
      <small>${esc(item.roleLabel || "Internal Recipient")}${item.locationName ? ` - ${esc(item.locationName)}` : ""}</small>
    </button>`).join("") : "<p class='sub small'>No allowed internal recipients matched this search.</p>";
    wrap.querySelectorAll("button[data-recipient-index]").forEach(btn => {
      btn.addEventListener("click", () => selectMessageRecipient(rows[Number(btn.dataset.recipientIndex)]));
    });
  }

  function fillProfileForm(profile, user) {
    byId("editFirstName").value = profile.firstName || "";
    byId("editLastName").value = profile.lastName || "";
    byId("editDisplayName").value = profile.displayName || user.displayName || "";
    byId("editPhone").value = profile.phone || user.phoneNumber || "";
    if (byId("editTaxiPickupAddress")) byId("editTaxiPickupAddress").value = profile.taxiPickupAddress || profile.pickupAddress || "";
    byId("editCity").value = profile.city || "";
    byId("editCountry").value = profile.country || "";
    byId("editLanguage").value = profile.preferredLanguage || "";
    byId("editGender").value = profile.gender || "";
    byId("editHeight").value = profile.height || "";
    if (byId("editHeightUnit")) byId("editHeightUnit").value = profile.heightUnit || preferredHeightUnit(profile.country || "");
    applyEditHeightUnit(true);
    if (byId("editBirthMonth")) byId("editBirthMonth").value = profile.birthMonth || "";
    if (byId("editBirthDay")) byId("editBirthDay").value = profile.birthDay || "";
    byId("editInstagram").value = profile.instagramHandle || "";
    byId("editX").value = profile.xHandle || "";
    byId("editProfileType").value = profile.publicProfileType || "patron";
    byId("editProfileVisibility").value = profile.publicProfileVisibility || "followers";
    byId("editPublicProfileLanguageMode").value = profile.publicProfileLanguageMode || "preferred";
    byId("editMusicInterests").value = joinCSV(profile.musicInterests || profile.favoriteGenres);
    byId("editTravelInterests").value = joinCSV(profile.travelInterests);
    byId("editHobbies").value = joinCSV(profile.hobbies || profile.generalHobbies);
    byId("editFoodChoices").value = joinCSV(profile.foodChoices) || "Sushi, Tapas, Steakhouse";
    byId("editFavoriteBeverages").value = joinCSV(profile.favoriteBeverages) || "Champagne, Tequila, Mocktails";
    byId("editNightlifeStyle").value = profile.nightlifeStyle || joinCSV(profile.nightlifeInterests);
    byId("editLookingToMeet").value = profile.lookingToMeet || "";
    byId("editBio").value = profile.publicProfileBioOriginal || profile.bio || "";
    byId("editBioEnglish").value = profile.publicProfileBioEnglish || profile.bioEnglish || "";
    if (byId("editCommerceEnabled")) byId("editCommerceEnabled").checked = !!profile.commerceEnabled;
    if (byId("editCommerceStoreName")) byId("editCommerceStoreName").value = profile.commerceStoreName || `${profile.displayName || user.displayName || "My"} Shop`;
    if (byId("editStripeConnectAccountId")) byId("editStripeConnectAccountId").value = profile.stripeConnectAccountId || "";
    byId("privacyMarketing").checked = !!profile.marketingConsent;
    byId("privacyAnalytics").checked = !!profile.analyticsConsent;
    byId("privacySharing").checked = !!profile.dataSharingConsent;
    if (byId("privacyBirthdayNotifyOthers")) byId("privacyBirthdayNotifyOthers").checked = !!profile.birthdayNotifyOthers;
    if (byId("privacyBirthdayNotificationScope")) byId("privacyBirthdayNotificationScope").value = profile.birthdayNotificationScope || "none";
    renderPrivacyDatapoints(profile);
    fillLanguageSettings(profile);
  }

  function publicMinglDatapoints(profile = {}) {
    if (Array.isArray(profile.publicMinglDatapoints) && profile.publicMinglDatapoints.length) {
      return profile.publicMinglDatapoints;
    }
    return PUBLIC_MINGL_DATAPOINTS.map(point => point.key);
  }

  function renderPrivacyDatapoints(profile = {}) {
    const wrap = byId("privacyDatapointChoices");
    if (!wrap) return;
    const selected = new Set(publicMinglDatapoints(profile));
    wrap.innerHTML = PUBLIC_MINGL_DATAPOINTS.map(point => `<label>
      <input class="privacy-datapoint" type="checkbox" value="${esc(point.key)}" ${selected.has(point.key) ? "checked" : ""}/>
      <span>${esc(point.label)}</span>
    </label>`).join("");
  }

  function selectedPrivacyDatapoints() {
    return Array.from(document.querySelectorAll(".privacy-datapoint"))
      .filter(input => input.checked)
      .map(input => input.value);
  }

  function renderMinglFriendSettings(allUsers = []) {
    const wrap = byId("minglFriendManagementReport");
    if (!wrap) return;
    const settings = currentProfile.minglFriendSettings || {};
    const userByUid = new Map((allUsers || []).map(profile => [profile.uid || profile.id, profile]));
    currentMinglFriendRows = (currentMinglConnections || [])
      .filter(connection => String(connection.status || "").toLowerCase() === "mutual")
      .map(connection => {
        const uid = (connection.participants || []).find(item => item !== auth.currentUser?.uid) || connection.requestedBy || connection.requestedTo || "";
        const profile = userByUid.get(uid) || connection.userSummaries?.[uid] || {};
        return {uid, profile, settings:settings[uid] || {}};
      })
      .filter(row => row.uid);
    const query = String(byId("minglFriendSearchInput")?.value || "").trim().toLowerCase();
    const rows = currentMinglFriendRows.filter(row => {
      const haystack = `${row.profile.displayName || ""} ${row.profile.username || ""} ${row.profile.email || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    wrap.innerHTML = rows.length ? rows.map(row => {
      const name = row.profile.displayName || row.profile.username || row.profile.email || "Mingl Friend";
      return `<div class="queue-item mingl-friend-settings-row" data-friend-uid="${esc(row.uid)}">
        <strong>${esc(name)}</strong>
        <small>${esc(row.profile.username ? `@${row.profile.username}` : row.profile.email || "Mutual Mingl friend")}</small>
        <label><input type="checkbox" data-friend-setting="closeFriend" ${row.settings.closeFriend ? "checked" : ""}/> Close friend</label>
        <label><input type="checkbox" data-friend-setting="excludeViewing" ${row.settings.excludeViewing ? "checked" : ""}/> Exclude from viewing</label>
        <label><input type="checkbox" data-friend-setting="excludeContacting" ${row.settings.excludeContacting ? "checked" : ""}/> Exclude from contacting</label>
        <label><input type="checkbox" data-friend-setting="onlyDisappearingMessages" ${row.settings.onlyDisappearingMessages ? "checked" : ""}/> Only send disappearing messages</label>
      </div>`;
    }).join("") : "<p class='sub'>No mutual Mingl friends matched this search yet.</p>";
  }

  async function saveMinglFriendSettings() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Saving Mingl friend settings…",
      wait:"FLOQR is applying your viewing, contact and disappearing-message preferences.",
      success:"Mingl friend settings saved",
      redirecting:"Your Mingl friend preferences are now active.",
      returnTo:"Manage Mingl Friends"
    }, async () => {
    const next = {...(currentProfile.minglFriendSettings || {})};
    document.querySelectorAll(".mingl-friend-settings-row").forEach(row => {
      const uid = row.dataset.friendUid;
      if (!uid) return;
      next[uid] = {
        closeFriend:!!row.querySelector("[data-friend-setting='closeFriend']")?.checked,
        excludeViewing:!!row.querySelector("[data-friend-setting='excludeViewing']")?.checked,
        excludeContacting:!!row.querySelector("[data-friend-setting='excludeContacting']")?.checked,
        onlyDisappearingMessages:!!row.querySelector("[data-friend-setting='onlyDisappearingMessages']")?.checked,
        updatedAt:new Date().toISOString()
      };
    });
    await db.collection("users").doc(user.uid).set({
      minglFriendSettings:next,
      minglFriendSettingsUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    currentProfile.minglFriendSettings = next;
    setText("portalStatus", "Mingl friend settings saved.");
    });
  }

  async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Saving profile...",
      wait:"We are saving your profile. Please wait a few seconds.",
      success:"Profile saved",
      redirecting:"Profile save succeeded, redirecting back to My Profile.",
      returnTo:"My Profile"
    }, async () => {
    const preferredLanguage = byId("editLanguage").value;
    const originalBio = byId("editBio").value.trim();
    const englishBio = byId("editBioEnglish").value.trim();
    const translationState = buildProfileTranslationState(originalBio, englishBio, preferredLanguage);
    const updates = {
      firstName: byId("editFirstName").value.trim(),
      lastName: byId("editLastName").value.trim(),
      displayName: byId("editDisplayName").value.trim(),
      phone: byId("editPhone").value.trim(),
      taxiPickupAddress:byId("editTaxiPickupAddress")?.value.trim() || "",
      city: byId("editCity").value.trim(),
      country: byId("editCountry").value.trim(),
      preferredLanguage,
      gender: byId("editGender").value,
      height: byId("editHeight").value.trim(),
      heightUnit: byId("editHeightUnit")?.value || preferredHeightUnit(byId("editCountry").value),
      birthMonth: byId("editBirthMonth")?.value || "",
      birthDay: byId("editBirthDay")?.value || "",
      instagramHandle: byId("editInstagram").value.trim(),
      xHandle: byId("editX").value.trim(),
      publicProfileType: byId("editProfileType").value,
      publicProfileVisibility: byId("editProfileVisibility").value,
      publicProfileLanguageMode: byId("editPublicProfileLanguageMode").value,
      musicInterests: splitCSV(byId("editMusicInterests").value),
      travelInterests: splitCSV(byId("editTravelInterests").value),
      hobbies: splitCSV(byId("editHobbies").value),
      foodChoices: splitCSV(byId("editFoodChoices").value || "Sushi, Tapas, Steakhouse"),
      favoriteBeverages: splitCSV(byId("editFavoriteBeverages").value || "Champagne, Tequila, Mocktails"),
      nightlifeStyle: byId("editNightlifeStyle").value.trim(),
      lookingToMeet: byId("editLookingToMeet").value.trim(),
      bio: originalBio,
      commerceEnabled:!!byId("editCommerceEnabled")?.checked,
      commerceStoreName:byId("editCommerceStoreName")?.value.trim() || `${byId("editDisplayName").value.trim() || "My"} Shop`,
      stripeConnectAccountId:byId("editStripeConnectAccountId")?.value.trim() || "",
      ...translationState,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    updates.fullName = `${updates.firstName} ${updates.lastName}`.trim();
    await db.collection("users").doc(user.uid).set(updates, {merge:true});
    setText("portalStatus", "Profile updated.");
    await loadPortal(user);
    });
  }

  function prepareProfileTranslation() {
    const originalBio = byId("editBio")?.value.trim() || "";
    const language = byId("editLanguage")?.value || "en";
    if (!originalBio) {
      setText("portalStatus", "Add a profile bio before preparing an English translation.");
      return;
    }
    if (language === "en" || !language) {
      byId("editBioEnglish").value = originalBio;
      setText("portalStatus", "English bio prepared from your profile bio.");
      return;
    }
    if (window.FLOQR_AI_ENABLED) {
      setText("portalStatus", "AI translation is ready for a safe Firebase AI or Cloud Functions provider. No frontend AI key is used.");
      return;
    }
    setText("portalStatus", "English translation field is ready. Add the English version manually until live AI translation is configured.");
  }

  async function savePrivacy() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Saving privacy choices...",
      wait:"We are saving your My Privacy selections. Please wait a few seconds.",
      success:"Privacy choices saved",
      redirecting:"My Privacy choices saved, redirecting back to My Privacy.",
      returnTo:"My Privacy"
    }, async () => {
    const prefs = {
      marketingConsent: byId("privacyMarketing").checked,
      analyticsConsent: byId("privacyAnalytics").checked,
      dataSharingConsent: byId("privacySharing").checked,
      birthdayNotifyOthers: !!byId("privacyBirthdayNotifyOthers")?.checked,
      birthdayNotificationScope: byId("privacyBirthdayNotificationScope")?.value || "none",
      publicMinglDatapoints: selectedPrivacyDatapoints(),
      publicMinglDatapointsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      privacyUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("users").doc(user.uid).set(prefs, {merge:true});
    await db.collection("privacyConsents").add({uid:user.uid, email:user.email || "", ...prefs, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    setText("portalStatus", "Privacy preferences saved.");
    await loadPortal(user);
    });
  }

  function downloadData() {
    const blob = new Blob([JSON.stringify(currentProfile, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "floqr-patron-data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function requestDelete() {
    const user = auth.currentUser;
    if (!user || !confirm("Request deletion of your patron data?")) return;
    return actionFeedback({
      starting:"Submitting delete request...",
      wait:"We are submitting your data delete request. Please wait a few seconds.",
      success:"Delete request submitted",
      redirecting:"Delete request submitted, redirecting back to My Privacy.",
      returnTo:"My Privacy"
    }, async () => {
    await db.collection("privacyConsents").add({type:"deleteRequest", uid:user.uid, email:user.email || "", requestedAt: firebase.firestore.FieldValue.serverTimestamp(), status:"pending"});
    setText("portalStatus", "Data delete request submitted.");
    });
  }

  function mediaSlotDefaults(profile) {
    const existing = Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots : [];
    return Array.from({length:10}, (_, i) => {
      const previous = existing[i] || {};
      const type = i < 8 ? "image" : "video";
      return {slot:i + 1, type, url:"", storagePath:"", metadata:null, travelDatapointAdded:false, ...previous, type};
    });
  }

  function mediaUploadErrorMessage(error, user) {
    const code = error?.code || "";
    if (code === "storage/unauthorized") {
      return `Media upload blocked by Firebase Storage Rules. Allow signed-in user ${user?.uid || ""} to write under profileMedia/${user?.uid || "{uid}"}/images or videos.`;
    }
    if (code === "storage/canceled") return "Media upload was canceled.";
    if (code === "storage/quota-exceeded") return "Firebase Storage quota was exceeded.";
    return `Media upload failed: ${error?.message || "Unknown error"}`;
  }

  function rational(data, offset, littleEndian) {
    const numerator = data.getUint32(offset, littleEndian);
    const denominator = data.getUint32(offset + 4, littleEndian) || 1;
    return numerator / denominator;
  }

  function readIfdTag(data, tiffStart, ifdOffset, tagId, littleEndian) {
    if (!ifdOffset) return null;
    const entryCount = data.getUint16(tiffStart + ifdOffset, littleEndian);
    for (let i = 0; i < entryCount; i += 1) {
      const entry = tiffStart + ifdOffset + 2 + (i * 12);
      const tag = data.getUint16(entry, littleEndian);
      if (tag !== tagId) continue;
      return {
        type:data.getUint16(entry + 2, littleEndian),
        count:data.getUint32(entry + 4, littleEndian),
        valueOffset:data.getUint32(entry + 8, littleEndian),
        entry
      };
    }
    return null;
  }

  function gpsTriplet(data, tiffStart, tag, littleEndian) {
    if (!tag || tag.type !== 5 || tag.count < 3) return null;
    const start = tiffStart + tag.valueOffset;
    return rational(data, start, littleEndian) + (rational(data, start + 8, littleEndian) / 60) + (rational(data, start + 16, littleEndian) / 3600);
  }

  async function extractImageGpsMetadata(file) {
    if (!file || !/^image\/jpe?g$/i.test(file.type || "")) return null;
    const buffer = await file.arrayBuffer();
    const data = new DataView(buffer);
    if (data.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset < data.byteLength) {
      const marker = data.getUint16(offset);
      const size = data.getUint16(offset + 2);
      if (marker === 0xffe1) {
        const exifHeader = String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4));
        if (exifHeader !== "Exif") return null;
        const tiffStart = offset + 10;
        const littleEndian = data.getUint16(tiffStart) === 0x4949;
        const firstIfd = data.getUint32(tiffStart + 4, littleEndian);
        const gpsPointer = readIfdTag(data, tiffStart, firstIfd, 0x8825, littleEndian);
        if (!gpsPointer) return null;
        const gpsIfd = gpsPointer.valueOffset;
        const latRefTag = readIfdTag(data, tiffStart, gpsIfd, 1, littleEndian);
        const latTag = readIfdTag(data, tiffStart, gpsIfd, 2, littleEndian);
        const lonRefTag = readIfdTag(data, tiffStart, gpsIfd, 3, littleEndian);
        const lonTag = readIfdTag(data, tiffStart, gpsIfd, 4, littleEndian);
        const readRef = tag => tag ? String.fromCharCode(data.getUint8(tag.entry + 8)) : "";
        let latitude = gpsTriplet(data, tiffStart, latTag, littleEndian);
        let longitude = gpsTriplet(data, tiffStart, lonTag, littleEndian);
        if (!latitude || !longitude) return null;
        if (readRef(latRefTag) === "S") latitude *= -1;
        if (readRef(lonRefTag) === "W") longitude *= -1;
        return {
          latitude:Number(latitude.toFixed(6)),
          longitude:Number(longitude.toFixed(6)),
          source:"image-exif-gps",
          label:`Photo location ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`
        };
      }
      offset += 2 + size;
    }
    return null;
  }

  function encodeMetadata(metadata) {
    return metadata ? encodeURIComponent(JSON.stringify(metadata)) : "";
  }

  function decodeMetadata(value) {
    try { return value ? JSON.parse(decodeURIComponent(value)) : null; }
    catch(e) { return null; }
  }

  function appendTravelMetadata(currentValues, metadataItems) {
    const values = new Set(splitCSV(currentValues));
    metadataItems.filter(Boolean).forEach(item => values.add(item.label || `${item.latitude}, ${item.longitude}`));
    return Array.from(values).join(", ");
  }

  function renderMediaSlots(profile) {
    const wrap = byId("profileMediaSlots");
    if (!wrap) return;
    const slots = mediaSlotDefaults(profile);
    wrap.innerHTML = slots.map(slot => {
      const accept = slot.type === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp";
      const label = slot.type === "video" ? `Short Video ${slot.slot - 8}` : `Photo ${slot.slot}`;
      const preview = slot.url ? (slot.type === "video" ? `<video src="${esc(slot.url)}" muted loop playsinline></video>` : `<img src="${esc(slot.url)}" alt="${esc(label)}"/>`) : `<span>${esc(label)}</span>`;
      const metadata = slot.metadata || null;
      return `<div class="profile-media-slot" data-slot="${slot.slot}">
        <div class="profile-media-preview">${preview}</div>
        <label>${esc(label)}<input class="profile-media-file" type="file" accept="${accept}"/></label>
        <input class="profile-media-url" type="hidden" value="${esc(slot.url || "")}"/>
        <input class="profile-media-path" type="hidden" value="${esc(slot.storagePath || "")}"/>
        <input class="profile-media-metadata" type="hidden" value="${esc(encodeMetadata(metadata))}"/>
        <div class="media-metadata-prompt ${metadata ? "" : "hidden"}">${metadata ? `<label><input class="profile-media-add-travel" type="checkbox" ${slot.travelDatapointAdded ? "checked" : ""}/> Add ${esc(metadata.label)} to my travel datapoints.</label>` : ""}</div>
        <button class="primary save-one-media-slot" type="button">Save This Slot</button>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".profile-media-file").forEach(input => input.addEventListener("change", previewSelectedMedia));
    wrap.querySelectorAll(".save-one-media-slot").forEach(button => button.addEventListener("click", () => saveSingleMediaSlot(button.closest(".profile-media-slot"))));
  }

  async function saveMediaSlots() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Uploading media...",
      wait:"We are uploading your media. Please wait a few seconds.",
      success:"Media upload succeeded",
      redirecting:"Media upload succeeded, redirecting back to Public Media and Data Sharing.",
      returnTo:"Public Media and Data Sharing"
    }, async () => {
    try {
      const slotEls = Array.from(document.querySelectorAll(".profile-media-slot"));
      const slots = [];
      const travelMetadata = [];
      setText("portalStatus", "Saving profile media...");
      for (const slotEl of slotEls) {
        const slot = Number(slotEl.dataset.slot);
        const type = slot <= 8 ? "image" : "video";
        const file = slotEl.querySelector(".profile-media-file")?.files?.[0];
        let url = slotEl.querySelector(".profile-media-url")?.value || "";
        let storagePath = slotEl.querySelector(".profile-media-path")?.value || "";
        const metadata = decodeMetadata(slotEl.querySelector(".profile-media-metadata")?.value || "");
        const addTravel = !!slotEl.querySelector(".profile-media-add-travel")?.checked;
        if (file) {
          const folder = type === "video" ? "videos" : "images";
          const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-80);
          storagePath = `profileMedia/${user.uid}/${folder}/slot-${slot}-${Date.now()}-${safeName}`;
          const ref = storage.ref(storagePath);
          await ref.put(file, {contentType:file.type || (type === "video" ? "video/mp4" : "image/jpeg")});
          url = await ref.getDownloadURL();
        }
        slots.push({
          slot,
          type,
          url,
          storagePath,
          metadata,
          travelDatapointAdded:addTravel,
          updatedAt: new Date().toISOString()
        });
        if (addTravel && metadata) travelMetadata.push(metadata);
      }
      const update = {
        profileMediaSlots: slots,
        profileMediaUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (travelMetadata.length) {
        update.travelInterests = splitCSV(appendTravelMetadata(byId("editTravelInterests")?.value || joinCSV(currentProfile.travelInterests), travelMetadata));
        byId("editTravelInterests").value = joinCSV(update.travelInterests);
      }
      await db.collection("users").doc(user.uid).set(update, {merge:true});
      setText("portalStatus", "Profile media saved.");
      await loadPortal(user);
    } catch(e) {
      setText("portalStatus", mediaUploadErrorMessage(e, user));
      throw e;
    }
    });
  }

  async function previewSelectedMedia(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const slotEl = input.closest(".profile-media-slot");
    const preview = slotEl?.querySelector(".profile-media-preview");
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    preview.innerHTML = isVideo ? `<video src="${url}" muted loop playsinline controls></video>` : `<img src="${url}" alt="Selected profile media"/>`;
    const metadataWrap = slotEl.querySelector(".media-metadata-prompt");
    const metadataInput = slotEl.querySelector(".profile-media-metadata");
    if (!isVideo) {
      const metadata = await extractImageGpsMetadata(file);
      if (metadata && metadataWrap && metadataInput) {
        metadataInput.value = encodeMetadata(metadata);
        metadataWrap.classList.remove("hidden");
        metadataWrap.innerHTML = `<label><input class="profile-media-add-travel" type="checkbox"/> Add ${esc(metadata.label)} to my travel datapoints.</label>`;
        setText("portalStatus", "Preview ready. Photo location metadata found. Choose whether to add it to Travel before saving.");
        return;
      }
    }
    if (metadataInput) metadataInput.value = "";
    if (metadataWrap) {
      metadataWrap.classList.add("hidden");
      metadataWrap.innerHTML = "";
    }
    setText("portalStatus", "Preview ready. Save this slot to upload it.");
  }

  async function saveSingleMediaSlot(slotEl) {
    const user = auth.currentUser;
    if (!user || !slotEl) return;
    const profile = currentProfile || {};
    const slots = mediaSlotDefaults(profile);
    const slotNumber = Number(slotEl.dataset.slot);
    const slotIndex = Math.max(0, slotNumber - 1);
    const type = slotNumber <= 8 ? "image" : "video";
    const file = slotEl.querySelector(".profile-media-file")?.files?.[0];
    const metadata = decodeMetadata(slotEl.querySelector(".profile-media-metadata")?.value || "");
    const addTravel = !!slotEl.querySelector(".profile-media-add-travel")?.checked;
    let url = slotEl.querySelector(".profile-media-url")?.value || "";
    let storagePath = slotEl.querySelector(".profile-media-path")?.value || "";
    if (!file && !url) {
      setText("portalStatus", "Choose an image or video first, then save this slot.");
      return;
    }
    return actionFeedback({
      starting:"Uploading media...",
      wait:`We are uploading media slot ${slotNumber}. Please wait a few seconds.`,
      success:"Media upload succeeded",
      redirecting:`Media slot ${slotNumber} upload succeeded, redirecting back to Public Media and Data Sharing.`,
      returnTo:"Public Media and Data Sharing"
    }, async () => {
    try {
      setText("portalStatus", `Saving slot ${slotNumber}...`);
      if (file) {
        const folder = type === "video" ? "videos" : "images";
        const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-80);
        storagePath = `profileMedia/${user.uid}/${folder}/slot-${slotNumber}-${Date.now()}-${safeName}`;
        const ref = storage.ref(storagePath);
        await ref.put(file, {contentType:file.type || (type === "video" ? "video/mp4" : "image/jpeg")});
          url = await ref.getDownloadURL();
      }
      slots[slotIndex] = {slot:slotNumber, type, url, storagePath, metadata, travelDatapointAdded:addTravel, updatedAt:new Date().toISOString()};
      const update = {
        profileMediaSlots: slots,
        profileMediaUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (addTravel && metadata) {
        update.travelInterests = splitCSV(appendTravelMetadata(byId("editTravelInterests")?.value || joinCSV(currentProfile.travelInterests), [metadata]));
        byId("editTravelInterests").value = joinCSV(update.travelInterests);
      }
      await db.collection("users").doc(user.uid).set(update, {merge:true});
      setText("portalStatus", `Profile media slot ${slotNumber} saved.`);
      await loadPortal(user);
    } catch(e) {
      setText("portalStatus", mediaUploadErrorMessage(e, user));
      throw e;
    }
    });
  }

  function renderProfileMediaDraft() {
    const wrap = byId("profileMediaSlots");
    if (!wrap) return;
    wrap.innerHTML = profileMediaDraft.length ? profileMediaDraft.map((item, index) => {
      const preview = item.type === "video"
        ? `<video src="${esc(item.previewUrl || item.url || "")}" muted loop playsinline controls></video>`
        : `<img src="${esc(item.previewUrl || item.url || "")}" alt="Profile media ${index + 1}"/>`;
      return `<div class="profile-media-slot profile-media-order-card" data-media-index="${index}">
        <div class="profile-media-preview">${preview}</div>
        <strong>${index === 0 ? "Hero media" : `Position ${index + 1}`}</strong>
        <span class="sub small">${esc(item.file?.name || item.fileName || item.type)}</span>
        <div class="button-row">
          <button type="button" data-media-move="up" ${index === 0 ? "disabled" : ""}>Move up</button>
          <button type="button" data-media-move="down" ${index === profileMediaDraft.length - 1 ? "disabled" : ""}>Move down</button>
          <button type="button" data-media-remove>Remove</button>
        </div>
      </div>`;
    }).join("") : `<p class="sub small">No profile media selected yet.</p>`;
    wrap.querySelectorAll("[data-media-move]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.closest("[data-media-index]").dataset.mediaIndex);
      const next = button.dataset.mediaMove === "up" ? index - 1 : index + 1;
      if (next < 0 || next >= profileMediaDraft.length) return;
      [profileMediaDraft[index], profileMediaDraft[next]] = [profileMediaDraft[next], profileMediaDraft[index]];
      renderProfileMediaDraft();
    }));
    wrap.querySelectorAll("[data-media-remove]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.closest("[data-media-index]").dataset.mediaIndex);
      const removed = profileMediaDraft.splice(index, 1)[0];
      if (removed?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
      renderProfileMediaDraft();
    }));
  }

  function renderMediaSlots(profile) {
    profileMediaDraft.forEach(item => { if (item.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl); });
    profileMediaDraft = (Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots : [])
      .filter(item => item?.url).sort((a, b) => Number(a.order || a.slot || 0) - Number(b.order || b.slot || 0))
      .map(item => ({...item, existing:true, previewUrl:item.url}));
    renderProfileMediaDraft();
    const input = byId("profileMediaBatchInput");
    if (input) {
      input.value = "";
      input.onchange = event => {
        const files = Array.from(event.currentTarget.files || []);
        const proposed = [...profileMediaDraft, ...files.map(file => ({file, fileName:file.name, type:file.type.startsWith("video/") ? "video" : "image", previewUrl:URL.createObjectURL(file)}))];
        const images = proposed.filter(item => item.type === "image").length;
        const videos = proposed.filter(item => item.type === "video").length;
        if (images > 8 || videos > 2 || proposed.length > 10) {
          files.forEach(file => { const match = proposed.find(item => item.file === file); if (match?.previewUrl) URL.revokeObjectURL(match.previewUrl); });
          setText("portalStatus", "Profile media supports a maximum of 8 images and 2 short videos (10 total).");
          event.currentTarget.value = "";
          return;
        }
        profileMediaDraft = proposed;
        event.currentTarget.value = "";
        renderProfileMediaDraft();
      };
    }
  }

  async function saveMediaSlots() {
    const user = auth.currentUser;
    if (!user) return;
    return actionFeedback({
      starting:"Uploading profile media...",
      wait:"FLOQR is uploading the selected files and saving their order.",
      success:"Profile media saved",
      redirecting:"Your public-profile media order is updated.",
      returnTo:"Public Media and Data Sharing"
    }, async () => {
      try {
        const saved = [];
        for (let index = 0; index < profileMediaDraft.length; index += 1) {
          const item = profileMediaDraft[index];
          let url = item.url || "";
          let storagePath = item.storagePath || "";
          let metadata = item.metadata || null;
          if (item.file) {
            const folder = item.type === "video" ? "videos" : "images";
            const safeName = item.file.name.replace(/[^a-z0-9._-]/gi, "-").slice(-80);
            storagePath = `profileMedia/${user.uid}/${folder}/order-${index + 1}-${Date.now()}-${safeName}`;
            const ref = storage.ref(storagePath);
            await ref.put(item.file, {contentType:item.file.type || (item.type === "video" ? "video/mp4" : "image/jpeg")});
            url = await ref.getDownloadURL();
            if (item.type === "image") metadata = await extractImageGpsMetadata(item.file);
          }
          saved.push({slot:index + 1, order:index + 1, type:item.type, url, storagePath, fileName:item.fileName || "", metadata, travelDatapointAdded:!!item.travelDatapointAdded, updatedAt:new Date().toISOString()});
        }
        await db.collection("users").doc(user.uid).set({profileMediaSlots:saved, profileMediaUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
        setText("portalStatus", "Profile media and display order saved.");
        await loadPortal(user);
      } catch (error) {
        setText("portalStatus", mediaUploadErrorMessage(error, user));
        throw error;
      }
    });
  }

  function chips(items) {
    const values = Array.isArray(items) ? items : splitCSV(items);
    return values.length ? `<div class="profile-chip-row">${values.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : `<p class="sub small">Not added yet.</p>`;
  }

  function renderProfilePreview(profile, user) {
    const profileType = profile.publicProfileType || "patron";
    const template = PROFILE_TEMPLATES[profileType] || PROFILE_TEMPLATES.patron;
    const media = mediaSlotDefaults(profile).filter(x => x.url).slice(0, 10);
    const heroMedia = media[0];
    const hero = heroMedia ? (heroMedia.type === "video" ? `<video src="${esc(heroMedia.url)}" muted loop playsinline autoplay></video>` : `<img src="${esc(heroMedia.url)}" alt="Profile media"/>`) : `<span>${esc(template.title)}</span>`;
    const displayLanguage = publicProfileLanguageLabel(profile);
    const displayBio = publicProfileBio(profile, template);
    const gallery = media.length ? `<div class="public-profile-gallery">${media.map((item, index) => {
      const mediaEl = item.type === "video" ? `<video src="${esc(item.url)}" muted loop playsinline controls></video>` : `<img src="${esc(item.url)}" alt="Profile gallery ${index + 1}"/>`;
      return `<figure>${mediaEl}</figure>`;
    }).join("")}</div>` : `<p class="sub small">No public gallery media yet.</p>`;
    byId("profileTemplatePreview").innerHTML = `<article class="public-profile-card profile-${esc(profileType)}">
      <div class="public-profile-hero">${hero}</div>
      <div class="public-profile-body">
        <p class="eyebrow">${esc(ROLE_LABELS[profileType] || "Patron")} Profile - ${esc(displayLanguage)}</p>
        <h3>${esc(profile.displayName || user.displayName || user.email || "FLOQR Member")}</h3>
        <p>${esc(displayBio)}</p>
        <div class="profile-section"><strong>Height</strong><p>${esc(heightDisplay(profile) || "Not added yet.")}</p></div>
        <div class="profile-section"><strong>Music</strong>${chips(profile.musicInterests || profile.favoriteGenres)}</div>
        <div class="profile-section"><strong>Travel</strong>${chips(profile.travelInterests)}</div>
        <div class="profile-section"><strong>Hobbies</strong>${chips(profile.hobbies || profile.generalHobbies)}</div>
        <div class="profile-section"><strong>Food Choices</strong>${chips(profile.foodChoices)}</div>
        <div class="profile-section"><strong>Favorite Beverages</strong>${chips(profile.favoriteBeverages)}</div>
        <div class="profile-section"><strong>Nightlife Style</strong><p>${esc(profile.nightlifeStyle || "Not added yet.")}</p></div>
        <div class="profile-section"><strong>Looking To Meet</strong><p>${esc(profile.lookingToMeet || "Not added yet.")}</p></div>
      </div>
    </article><section class="public-profile-gallery-wrap"><h3>Image Gallery</h3>${gallery}</section>`;
  }

  function renderTemplateVariantCard(variant = {}, mine = false) {
    const templates = window.SHOUTOUT_TEMPLATES || {};
    const base = templates[variant.baseTemplateId] || templates.blackwhite || {};
    const style = window.FLOQRStudio?.variantBackgroundStyle ? window.FLOQRStudio.variantBackgroundStyle(variant) : "";
    return `<div class="template ${esc(base.className || "neon")}">
      <div class="template-mini-preview" style="${esc(style)}"><strong>${esc(base.defaultMain || "SHOUTOUT")}</strong><span>${esc(variant.variantName || base.category || "Variant")}</span></div>
      <div class="name">${esc(variant.variantName || "Saved Background")}</div>
      <div class="tag">${esc(variant.baseTemplateName || base.name || "Official template")} - ${esc(variant.visibility || "private")}</div>
      <div class="tag-row">${(variant.tags || []).slice(0,4).map(tag => `<span>${esc(tag)}</span>`).join("")}</div>
      <p class="sub small">${mine ? "Only the background is customized. Official layout remains locked." : `Created by ${esc(variant.ownerDisplayName || "FLOQR member")}.`}</p>
    </div>`;
  }

  async function renderTemplateVariantSettings(user, profile) {
    if (!window.FLOQRStudio || !user) return;
    const variants = await window.FLOQRStudio.loadPatronTemplateVariants({db, uid:user.uid});
    const mine = variants.mine || [];
    const community = (variants.community || []).filter(x => x.ownerUid !== user.uid);
    const mineWrap = byId("myTemplateVariants");
    const communityWrap = byId("communityTemplateVariants");
    if (mineWrap) mineWrap.innerHTML = mine.length ? mine.map(x => renderTemplateVariantCard(x, true)).join("") : "<div class='empty'>No saved ShoutOut template variants yet.</div>";
    if (communityWrap) communityWrap.innerHTML = community.length ? community.map(x => renderTemplateVariantCard(x, false)).join("") : "<div class='empty'>No community template variants yet.</div>";
    const publicMine = mine.filter(x => x.visibility === "public" && x.isPublicProfileItem !== false);
    const preview = byId("profileTemplatePreview");
    if (preview && publicMine.length) {
      preview.insertAdjacentHTML("beforeend", `<section class="public-profile-gallery-wrap"><h3>Public ShoutOut Templates</h3><div class="template-grid">${publicMine.map(x => renderTemplateVariantCard(x, true)).join("")}</div></section>`);
    }
    if (window.FLOQRAINotifications) {
      await window.FLOQRAINotifications.renderAiNotificationPreferences(byId("aiNotificationPreferencesMount"), {db, user, profile});
    }
  }

  function renderRoleGuide() {
    const guide = byId("roleTemplateGuide");
    if (!guide) return;
    guide.innerHTML = Object.entries(PROFILE_TEMPLATES).map(([key, item]) => `<div class="role-template-card">
      <p class="eyebrow">${esc(ROLE_LABELS[key])}</p>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.headline)}</p>
      <ul>${item.sections.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    </div>`).join("");
  }

  function normalizeMessage(x) {
    const isSystem = x.type === "notification" || x.messageType === "system" || x.senderUid === "system";
    return {
      ...x,
      senderName: isSystem ? "System Message" : (x.senderName || x.senderEmail || "Member"),
      subject: x.subject || x.title || "Message",
      body: x.body || x.preview || "",
      createdAt: x.createdAt || x.submittedAt || x.approvedAt || x.timestamp,
      read: !!x.read
    };
  }

  function renderMessages(messages, user) {
    currentMessages = messages.map(normalizeMessage).sort((a,b) => {
      const da = a.createdAt?.seconds || 0;
      const dbb = b.createdAt?.seconds || 0;
      return dbb - da;
    });
    byId("myMessages").innerHTML = currentMessages.length ? currentMessages.map((x, index) => {
      const connection = currentMinglConnections.find(item => (item.connectionId || item.id) === x.connectionId);
      const canAcceptMingl = x.messageType === "mingl_request"
        && x.recipientUid === user.uid
        && x.connectionId
        && (!connection || (connection.status !== "mutual" && (!connection.requestedTo || connection.requestedTo === user.uid)));
      const alreadyMutual = x.messageType === "mingl_request" && connection?.status === "mutual";
      return `<div class="queue-item message-envelope ${x.read ? "read" : "unread"}" data-message-index="${index}">
      <div class="message-envelope-head">
        <strong>${esc(x.subject)}</strong>
        <span>${esc(x.read ? "Read" : "Unread")}</span>
      </div>
      <p><b>Sender:</b> ${esc(x.senderName)}</p>
      <p><b>Timestamp:</b> ${esc(fmtDate(x.createdAt))}</p>
      <div class="message-body hidden">${linkify(x.body)}${x.link ? `<p><a href="${esc(x.link)}" class="buttonlike">Open Related ShoutOut</a></p>` : ""}
        ${canAcceptMingl ? `<p class="queue-actions"><button type="button" class="primary accept-mingl-inbox-btn" data-connection-id="${esc(connection?.connectionId || connection?.id || x.connectionId)}">Accept Mingl</button><button type="button" class="deny-mingl-inbox-btn" data-connection-id="${esc(connection?.connectionId || connection?.id || x.connectionId)}">Deny</button></p>` : ""}
        ${alreadyMutual ? `<p><a class="buttonlike" href="./mingl-chat.html?room=mingl_${esc(connection.id || connection.connectionId || "")}&v=29.04">Open Mingl Chat</a></p>` : ""}
      </div>
    </div>`;
    }).join("") : "<p class='sub'>No FLOQR Inbox messages yet.</p>";
    document.querySelectorAll(".message-envelope").forEach(el => {
      el.addEventListener("click", () => openMessage(el, user));
    });
    document.querySelectorAll(".message-envelope a").forEach(a => a.addEventListener("click", event => event.stopPropagation()));
    document.querySelectorAll(".accept-mingl-inbox-btn").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        acceptPortalMinglRequest(button.dataset.connectionId || "");
      });
    });
    document.querySelectorAll(".deny-mingl-inbox-btn").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        denyPortalMinglRequest(button.dataset.connectionId || "");
      });
    });
  }

  function pairId(a, b) {
    return [a, b].filter(Boolean).sort().join("_");
  }

  function fieldValue() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function portalUserSummary(user, profile = currentProfile) {
    return {
      displayName: profile.displayName || user.displayName || user.email || "Patron",
      photoURL: profile.photoURL || user.photoURL || ""
    };
  }

  function requestOtherUid(connection = {}, user) {
    return (connection.participants || []).find(uid => uid && uid !== user.uid) || connection.requesterUid || connection.targetUid || connection.requestedBy || connection.requestedTo || "";
  }

  async function getPortalMinglConnections(user, allUsers = [], queriedConnections = []) {
    if (queriedConnections.length) return queriedConnections.filter(row => (row.participants || []).includes(user.uid));
    const ids = allUsers
      .map(profile => profile.uid || profile.id)
      .filter(uid => uid && uid !== user.uid)
      .slice(0, 250)
      .map(uid => pairId(user.uid, uid));
    const rows = [];
    for (const id of ids) {
      try {
        const snap = await db.collection("minglConnections").doc(id).get();
        if (snap.exists && (snap.data().participants || []).includes(user.uid)) rows.push({id:snap.id, ...snap.data()});
      } catch(e) {}
    }
    return rows;
  }

  async function ensurePortalMinglChatRoom(connection = {}, user) {
    const connectionId = connection.connectionId || connection.id || pairId(connection.requestedBy, connection.requestedTo);
    const participants = connection.participants || [connection.requestedBy, connection.requestedTo].filter(Boolean);
    const roomId = `mingl_${connectionId}`;
    const summaries = {
      ...(connection.userSummaries || {}),
      [user.uid]: portalUserSummary(user)
    };
    await db.collection("chatRooms").doc(roomId).set({
      id:roomId,
      type:"mingl",
      title:"Mingl Chat",
      connectionId,
      participants,
      userSummaries:summaries,
      lastMessage:"Friend or Mingl Request approved.",
      unreadCounts:{},
      updatedAt:fieldValue(),
      createdAt:fieldValue()
    }, {merge:true});
    try {
      await db.collection("chatMessages").add({
        roomId,
        roomType:"mingl",
        messageType:"system",
        connectionId,
        participants,
        senderUid:"system",
        senderName:"System Message",
        body:"Friend or Mingl Request approved. Both patrons can now Mingl in this chat.",
        createdAt:fieldValue()
      });
    } catch(e) {}
    return roomId;
  }

  async function acceptPortalMinglRequest(connectionId) {
    const user = auth.currentUser;
    if (!user || !connectionId) return;
    return actionFeedback({
      starting:"Approving Mingl request...",
      wait:"We are approving this Friend or Mingl Request and opening Mingl Chat.",
      success:"Mingl request approved",
      redirecting:"Both patrons approved. Redirecting back to Mingl.",
      returnTo:"Mingl"
    }, async () => {
      const ref = db.collection("minglConnections").doc(connectionId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("Mingl request was not found.");
      const connection = {id:snap.id, ...snap.data()};
      if (!(connection.participants || []).includes(user.uid)) throw new Error("You are not a participant on this Mingl request.");
      await ref.set({
        status:"mutual",
        acceptedByUid:user.uid,
        acceptedAt:fieldValue(),
        updatedAt:fieldValue()
      }, {merge:true});
      const roomId = await ensurePortalMinglChatRoom({...connection, status:"mutual"}, user);
      await db.collection("inboxNotifications").add({
        type:"minglRequestAccepted",
        title:"Friend or Mingl Request Approved",
        subject:"Friend or Mingl Request Approved",
        body:"Both patrons approved. Mingl Chat is now open.",
        recipientUid:requestOtherUid(connection, user),
        connectionId,
        link:`./mingl-chat.html?room=${roomId}&v=29.04`,
        read:false,
        createdAt:fieldValue()
      });
      await loadPortal(user);
      const roomSnap = await db.collection("chatRooms").doc(roomId).get();
      if (roomSnap.exists) openPortalMinglChat({id:roomSnap.id, ...roomSnap.data()});
    });
  }

  async function denyPortalMinglRequest(connectionId) {
    const user = auth.currentUser;
    if (!user || !connectionId) return;
    return actionFeedback({
      starting:"Declining Mingl request…",
      wait:"FLOQR is updating this Friend or Mingl Request.",
      success:"Mingl request declined",
      redirecting:"The request status is updated in both patrons’ Mingl activity.",
      returnTo:"Mingl Requests"
    }, async () => {
      const ref = db.collection("minglConnections").doc(connectionId);
      const snap = await ref.get();
      if (!snap.exists) throw new Error("Mingl request was not found.");
      const connection = {id:snap.id, ...snap.data()};
      if (!(connection.participants || []).includes(user.uid)) throw new Error("You are not a participant on this Mingl request.");
      if (connection.requestedTo && connection.requestedTo !== user.uid) throw new Error("Only the receiving patron can deny this request.");
      await ref.set({
        status:"denied",
        deniedByUid:user.uid,
        deniedAt:fieldValue(),
        updatedAt:fieldValue()
      }, {merge:true});
      const requesterUid = connection.requestedBy || requestOtherUid(connection, user);
      if (requesterUid) {
        await db.collection("inboxNotifications").add({
          type:"minglRequestDenied",
          title:"Friend or Mingl Request Update",
          subject:"Friend or Mingl Request Update",
          body:`${currentProfile.displayName || user.displayName || "A FLOQR patron"} declined the Friend or Mingl Request.`,
          recipientUid:requesterUid,
          connectionId,
          read:false,
          createdAt:fieldValue()
        });
      }
      await loadPortal(user);
    });
  }

  async function getPortalMinglRooms(user, allUsers = [], queriedRooms = []) {
    if (queriedRooms.length) return queriedRooms.filter(room => room.type === "mingl");
    const possibleConnections = allUsers
      .map(profile => profile.uid || profile.id)
      .filter(uid => uid && uid !== user.uid)
      .slice(0, 250)
      .map(uid => pairId(user.uid, uid));
    const rooms = [];
    for (const connectionId of possibleConnections) {
      try {
        const connectionSnap = await db.collection("minglConnections").doc(connectionId).get();
        if (!connectionSnap.exists) continue;
        const connection = {id:connectionSnap.id, ...connectionSnap.data()};
        if (connection.status !== "mutual" || !(connection.participants || []).includes(user.uid)) continue;
        const roomSnap = await db.collection("chatRooms").doc(`mingl_${connectionId}`).get();
        if (roomSnap.exists) rooms.push({id:roomSnap.id, ...roomSnap.data()});
      } catch(e) {}
    }
    return rooms;
  }

  function renderPortalMinglChats(chats, user) {
    const wrap = byId("myChats");
    if (!wrap) return;
    wrap.innerHTML = chats.length ? "" : "<p class='sub'>No Mingl chats yet. Use the public Mingl room to send a Let's Mingl request, then both patrons must approve before chat opens.</p>";
    chats.forEach((room, index) => {
      const otherUid = (room.participants || []).find(uid => uid !== user.uid);
      const other = room.userSummaries?.[otherUid] || {};
      const item = document.createElement("button");
      item.type = "button";
      item.className = "queue-item mingl-chat-item";
      item.dataset.portalMinglIndex = String(index);
      item.innerHTML = `<strong>${esc(other.displayName || room.title || "Mingl Chat")}</strong><span>${esc(room.lastMessage || "Open chat history")}</span><small>Unread: ${esc(room.unreadCounts?.[user.uid] || 0)}</small>`;
      item.addEventListener("click", () => openPortalMinglChat(room));
      wrap.appendChild(item);
    });
  }

  function firestoreTimeMs(value) {
    if (!value) return 0;
    if (value.toDate) return value.toDate().getTime();
    if (value.seconds) return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function minglRequestStatus(connection = {}, user = {}) {
    const status = String(connection.status || "pending").toLowerCase();
    if (["mutual", "approved", "accepted"].includes(status)) return "Accepted";
    if (["denied", "rejected", "declined"].includes(status)) return "Denied";
    if (connection.requestedTo === user.uid) return "Mingl/Follow Back";
    return "Sent";
  }

  function shouldShowMinglRequest(connection = {}) {
    const status = String(connection.status || "pending").toLowerCase();
    const unresolved = !["mutual", "approved", "accepted", "denied", "rejected", "declined"].includes(status);
    const updatedMs = firestoreTimeMs(connection.updatedAt || connection.createdAt);
    const recent = updatedMs && updatedMs >= Date.now() - (10 * 24 * 60 * 60 * 1000);
    return unresolved || recent;
  }

  function updateMinglRequestSummary(requests = [], user = {}) {
    const summary = byId("minglRequestsSummaryButton");
    if (!summary) return;
    const counts = requests.reduce((acc, connection) => {
      const label = minglRequestStatus(connection, user);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    if (counts["Mingl/Follow Back"]) summary.textContent = `Mingl Requests: Mingl/Follow Back (${counts["Mingl/Follow Back"]})`;
    else if (counts.Sent) summary.textContent = `Mingl Requests: Sent (${counts.Sent})`;
    else if (counts.Accepted) summary.textContent = `Mingl Requests: Accepted (${counts.Accepted})`;
    else if (counts.Denied) summary.textContent = `Mingl Requests: Denied (${counts.Denied})`;
    else summary.textContent = "Mingl Requests: No recent requests";
  }

  function renderPortalMinglRequests(connections = [], user) {
    const wrap = byId("portalMinglRequests");
    if (!wrap) return;
    const requests = connections
      .filter(shouldShowMinglRequest)
      .sort((a,b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
    updateMinglRequestSummary(requests, user);
    wrap.innerHTML = requests.length ? "" : "<p class='sub'>No Mingl requests from the last 10 days and no unresolved requests.</p>";
    requests.forEach(connection => {
      const id = connection.connectionId || connection.id;
      const otherUid = requestOtherUid(connection, user);
      const other = connection.userSummaries?.[otherUid] || {};
      const received = connection.requestedTo === user.uid;
      const statusLabel = minglRequestStatus(connection, user);
      const personLabel = received ? "From" : "Sent to";
      const item = document.createElement("div");
      item.className = "queue-item";
      item.innerHTML = `<div class="message-envelope-head">
        <strong>${esc(other.displayName || connection.requesterName || connection.targetName || "Mingl Member")}</strong>
        <span>${esc(statusLabel)}</span>
      </div>
      <p>${esc(personLabel)}: ${esc(other.displayName || connection.requesterName || connection.targetName || "Mingl Member")}</p>
      <p>${esc(statusLabel === "Mingl/Follow Back" ? "Friend or Mingl Request received. Mingl back to open chat." : statusLabel === "Sent" ? "Friend or Mingl Request sent. Waiting for the other patron to Mingl back." : `Friend or Mingl Request status: ${statusLabel}.`)}</p>
      <small>Time: ${esc(fmtDate(connection.updatedAt || connection.createdAt))}</small>
      <div class="queue-actions">
        ${statusLabel === "Mingl/Follow Back" ? `<button type="button" class="primary accept-mingl-request-btn" data-connection-id="${esc(id)}">Accept Mingl</button><button type="button" class="deny-mingl-request-btn" data-connection-id="${esc(id)}">Deny</button>` : `<button type="button" disabled>${esc(statusLabel)}</button>`}
      </div>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll(".accept-mingl-request-btn").forEach(button => {
      button.addEventListener("click", () => acceptPortalMinglRequest(button.dataset.connectionId || ""));
    });
    wrap.querySelectorAll(".deny-mingl-request-btn").forEach(button => {
      button.addEventListener("click", () => denyPortalMinglRequest(button.dataset.connectionId || ""));
    });
  }

  function otherMinglUser(room = {}) {
    const user = auth.currentUser;
    const otherUid = (room.participants || []).find(uid => uid !== user?.uid);
    return {
      uid:otherUid || "",
      summary:room.userSummaries?.[otherUid] || {}
    };
  }

  function updateChatGrammarControls() {
    const enabled = !!currentLanguageSettings.aiGrammarEnabled;
    const button = byId("portalImproveMinglMessageBtn");
    const hint = byId("portalMinglGrammarHint");
    if (button) button.classList.toggle("hidden", !enabled);
    if (hint && !enabled) {
      hint.classList.add("hidden");
      hint.textContent = "";
    }
    highlightMinglDraft();
  }

  function highlightMinglDraft() {
    const input = byId("portalMinglMessageInput");
    const hint = byId("portalMinglGrammarHint");
    if (!input || !hint) return;
    input.classList.remove("grammar-spelling-warning", "grammar-grammar-warning");
    hint.classList.add("hidden");
    hint.textContent = "";
    if (!currentLanguageSettings.aiGrammarEnabled || !input.value.trim() || !window.FLOQRGrammar?.localDetectPossibleTypos) return;
    const issues = window.FLOQRGrammar.localDetectPossibleTypos(input.value, currentLanguageSettings.preferredLanguage || "auto", {
      personalDictionary:currentLanguageSettings.personalDictionary || [],
      personalCorrections:currentLanguageSettings.personalCorrections || []
    });
    if (!issues.length) return;
    const hasSpelling = issues.some(issue => issue.type === "spelling");
    const hasGrammar = issues.some(issue => issue.type !== "spelling");
    if (hasSpelling && currentLanguageSettings.highlightSpellingErrors) input.classList.add("grammar-spelling-warning");
    if (hasGrammar && currentLanguageSettings.highlightGrammarSuggestions) input.classList.add("grammar-grammar-warning");
    const summary = issues.slice(0, 3).map(issue => `${issue.original} -> ${issue.suggestion}`).join(", ");
    hint.textContent = `Possible correction: ${summary}`;
    hint.classList.remove("hidden");
  }

  function firstChangedPair(original = "", suggested = "") {
    const originalTokens = String(original || "").match(/[A-Za-z0-9@#'_-]+/g) || [];
    const suggestedTokens = String(suggested || "").match(/[A-Za-z0-9@#'_-]+/g) || [];
    for (let i = 0; i < originalTokens.length; i++) {
      if ((originalTokens[i] || "").toLowerCase() !== (suggestedTokens[i] || "").toLowerCase()) return {from:originalTokens[i] || "", to:suggestedTokens[i] || ""};
    }
    return {from:originalTokens[0] || "", to:suggestedTokens[0] || ""};
  }

  function firstChangedToken(original = "", suggested = "") {
    const originalTokens = String(original || "").match(/[\p{L}\p{N}@#'’_-]+/gu) || [];
    const suggestedTokens = String(suggested || "").match(/[\p{L}\p{N}@#'’_-]+/gu) || [];
    for (let i = 0; i < originalTokens.length; i++) {
      if ((originalTokens[i] || "").toLowerCase() !== (suggestedTokens[i] || "").toLowerCase()) return originalTokens[i];
    }
    return originalTokens[0] || "";
  }

  function showGrammarSuggestionModal({original, suggested, explanation, provider}) {
    return new Promise(resolve => {
      const correctionCandidate = firstChangedPair(original, suggested);
      const wordCandidate = correctionCandidate.from;
      const correctionTo = correctionCandidate.to;
      const modal = document.createElement("div");
      modal.className = "floqr-grammar-modal";
      modal.innerHTML = `<div class="floqr-grammar-dialog">
        <h2>Suggested Correction</h2>
        <div class="grammar-compare">
          <div><strong>Original</strong><p>${esc(original)}</p></div>
          <div><strong>Suggested</strong><p>${esc(suggested)}</p></div>
        </div>
        <p class="sub small">${esc(explanation || "")}${provider ? ` (${esc(provider)})` : ""}</p>
        <div class="button-row">
          <button class="primary" type="button" data-grammar-choice="use">Use Suggestion</button>
          <button type="button" data-grammar-choice="keep">Keep Original</button>
          ${wordCandidate ? `<button type="button" data-grammar-choice="add-word" data-word="${esc(wordCandidate)}">Add "${esc(wordCandidate)}" to My Word List</button>` : ""}
          ${wordCandidate && correctionTo ? `<button type="button" data-grammar-choice="add-correction" data-from="${esc(wordCandidate)}" data-to="${esc(correctionTo)}">Save "${esc(wordCandidate)} -> ${esc(correctionTo)}"</button>` : ""}
          <button type="button" data-grammar-choice="edit">Edit Manually</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", event => {
        const button = event.target.closest("[data-grammar-choice]");
        if (!button) return;
        const choice = button.dataset.grammarChoice;
        const word = button.dataset.word || "";
        const from = button.dataset.from || "";
        const to = button.dataset.to || "";
        modal.remove();
        resolve({choice, word, from, to});
      });
    });
  }

  function safeStorageFileName(name = "image") {
    return String(name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "image";
  }

  function portalMinglAnimationClass(type = "") {
    const key = String(type || "").toLowerCase();
    if (key === "bounce") return "animate-bounce";
    if (key === "explode") return "animate-explode";
    if (key === "graffiti") return "animate-graffiti";
    return "";
  }

  function portalMinglMediaHtml(msg = {}) {
    if (!msg.mediaUrl || msg.unsent) return "";
    const label = esc(msg.mediaFileName || "Shared picture");
    return `<figure class="mingl-message-media"><img src="${esc(msg.mediaUrl)}" alt="${label}" loading="lazy"><figcaption>${label}</figcaption></figure>`;
  }

  function portalMinglMessageReadByOther(msg = {}) {
    const user = auth.currentUser;
    if (!user || msg.senderUid !== user.uid) return false;
    const readBy = msg.readBy || {};
    return (msg.participants || []).some(uid => uid && uid !== user.uid && readBy[uid] === true);
  }

  function portalMinglReadReceiptHtml(msg = {}, mine = false) {
    if (!mine || msg.senderUid === "system" || msg.messageType === "system" || msg.unsent) return "";
    return portalMinglMessageReadByOther(msg)
      ? ` <span class="mingl-read-receipt" title="Read by recipient">👍 Read</span>`
      : ` <span class="mingl-read-receipt unread" title="Not read yet">Sent</span>`;
  }

  function markPortalMinglMessagesRead(rows = []) {
    const user = auth.currentUser;
    if (!user || !activePortalMinglRoomId) return;
    const unreadIncoming = rows.filter(msg => (
      msg.id &&
      msg.senderUid &&
      msg.senderUid !== user.uid &&
      msg.senderUid !== "system" &&
      (msg.participants || []).includes(user.uid) &&
      !(msg.readBy || {})[user.uid]
    ));
    if (!unreadIncoming.length) return;
    unreadIncoming.forEach(msg => {
      db.collection("chatMessages").doc(msg.id).set({
        readBy:{[user.uid]:true},
        readAtBy:{[user.uid]:firebase.firestore.FieldValue.serverTimestamp()},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(error => console.warn("Portal Mingl read receipt skipped:", error.message));
    });
    db.collection("chatRooms").doc(activePortalMinglRoomId).set({
      unreadCounts:{[user.uid]:0},
      lastReadAtBy:{[user.uid]:firebase.firestore.FieldValue.serverTimestamp()},
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).catch(error => console.warn("Portal Mingl unread reset skipped:", error.message));
  }

  function clearPortalMinglAttachment() {
    portalMinglAttachmentFile = null;
    const input = byId("portalMinglImageInput");
    const preview = byId("portalMinglAttachmentPreview");
    if (input) input.value = "";
    if (preview) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
    }
  }

  function renderPortalMinglAttachmentPreview() {
    const input = byId("portalMinglImageInput");
    const preview = byId("portalMinglAttachmentPreview");
    portalMinglAttachmentFile = input?.files?.[0] || null;
    if (!preview) return;
    if (!portalMinglAttachmentFile) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }
    if (!/^image\//.test(portalMinglAttachmentFile.type)) {
      setText("portalStatus", "Mingl chat picture sharing accepts image files only.");
      clearPortalMinglAttachment();
      return;
    }
    const url = URL.createObjectURL(portalMinglAttachmentFile);
    preview.classList.remove("hidden");
    preview.innerHTML = `<img src="${esc(url)}" alt=""><div><strong>${esc(portalMinglAttachmentFile.name)}</strong><button type="button" data-clear-portal-mingl-attachment>Remove Picture</button></div>`;
    preview.querySelector("[data-clear-portal-mingl-attachment]")?.addEventListener("click", clearPortalMinglAttachment);
  }

  async function uploadPortalMinglImage(roomId, file) {
    if (!file) return {};
    if (!/^image\//.test(file.type)) throw new Error("Mingl chat picture sharing accepts image files only.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Mingl chat pictures must be 8MB or smaller.");
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in before sharing a picture.");
    const path = `mingl-chat/${user.uid}/${roomId}/${Date.now()}-${safeStorageFileName(file.name)}`;
    const snap = await storage.ref().child(path).put(file, {contentType:file.type, customMetadata:{uploadedBy:user.uid, roomId}});
    return {
      mediaUrl:await snap.ref.getDownloadURL(),
      mediaType:"image",
      mediaFileName:file.name,
      mediaStoragePath:path
    };
  }

  async function updateOwnPortalMinglMessage(messageId, patch) {
    const user = auth.currentUser;
    if (!user || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== user.uid) return;
    await db.collection("chatMessages").doc(messageId).set({
      ...patch,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  async function autoCorrectPortalMinglMessage(messageId) {
    const user = auth.currentUser;
    if (!user || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== user.uid) return;
    const original = snap.data().body || "";
    if (!original.trim()) return;
    const result = window.FLOQRGrammar?.suggestGrammarCorrection
      ? await window.FLOQRGrammar.suggestGrammarCorrection(original, {
        uid:user.uid,
        product:"mingl",
        inputType:"sent-message",
        correctionMode:"autoFixMinor",
        personalDictionary:currentLanguageSettings.personalDictionary || [],
        personalCorrections:currentLanguageSettings.personalCorrections || []
      })
      : {correctedText:original.replace(/\s+/g, " ").trim()};
    const corrected = result.correctedText || original;
    if (corrected !== original) {
      await updateOwnPortalMinglMessage(messageId, {
        body:corrected,
        edited:true,
        aiGrammarApplied:true,
        editedAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  async function unsendPortalMinglMessage(messageId) {
    const user = auth.currentUser;
    if (!user || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== user.uid) return;
    if (portalMinglMessageReadByOther({id:snap.id, ...snap.data()})) {
      setText("portalStatus", "This Mingl message has already been read and cannot be unsent.");
      return;
    }
    await updateOwnPortalMinglMessage(messageId, {
      body:"Message unsent.",
      unsent:true,
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function showPortalMinglMessageActions(messageId, anchor) {
    if (!messageId) return;
    document.querySelector(".mingl-message-action-popout")?.remove();
    let message = null;
    try {
      const snap = await db.collection("chatMessages").doc(messageId).get();
      message = snap.exists ? {id:snap.id, ...snap.data()} : null;
    } catch (error) {}
    const readByRecipient = message ? portalMinglMessageReadByOther(message) : false;
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
    const rect = anchor?.getBoundingClientRect?.() || {left:24, bottom:160};
    popout.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - 280)}px`;
    popout.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 260)}px`;
    popout.addEventListener("click", async event => {
      const button = event.target.closest("[data-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      popout.remove();
      try {
        if (action === "edit") await editPortalMinglMessage(messageId);
        else if (action === "autocorrect") await autoCorrectPortalMinglMessage(messageId);
        else if (action === "unsend") await unsendPortalMinglMessage(messageId);
        else if (action === "deleteAfterRead") await updateOwnPortalMinglMessage(messageId, {deleteAfterRead:true, deleteAfterReadSetAt:firebase.firestore.FieldValue.serverTimestamp()});
        else await updateOwnPortalMinglMessage(messageId, {animationType:action, animatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      } catch (error) {
        setText("portalStatus", error?.message || "Mingl message action failed.");
      }
    });
  }

  function expireReadOncePortalMinglMessages(rows = []) {
    const user = auth.currentUser;
    if (!user) return;
    rows.filter(msg => msg.id && msg.deleteAfterRead === true && msg.deletedAfterRead !== true && msg.senderUid !== user.uid && (msg.participants || []).includes(user.uid)).forEach(msg => {
      db.collection("chatMessages").doc(msg.id).set({
        body:"Message deleted after read.",
        deletedAfterRead:true,
        expiredByUid:user.uid,
        expiredAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(error => console.warn("Portal delete-after-read expiry skipped:", error.message));
    });
  }

  async function uploadPortalMinglBackground() {
    const user = auth.currentUser;
    const file = byId("portalMinglBackgroundInput")?.files?.[0];
    if (!user || !activePortalMinglRoomId || !file) return;
    try {
      if (!/^image\//.test(file.type)) throw new Error("Chat background must be an image.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Chat background must be 8MB or smaller.");
      const roomSnap = await db.collection("chatRooms").doc(activePortalMinglRoomId).get();
      if (!roomSnap.exists) throw new Error("Mingl chat room was not found.");
      const room = {id:roomSnap.id, ...roomSnap.data()};
      if (!(room.participants || []).includes(user.uid)) throw new Error("Mingl chat is available only to approved participants.");
      const otherUid = (room.participants || []).find(uid => uid !== user.uid) || "";
      const path = `mingl-chat-backgrounds/${user.uid}/${activePortalMinglRoomId}/${Date.now()}-${safeStorageFileName(file.name)}`;
      const snap = await storage.ref().child(path).put(file, {contentType:file.type, customMetadata:{uploadedBy:user.uid, roomId:activePortalMinglRoomId}});
      const url = await snap.ref.getDownloadURL();
      await db.collection("chatRooms").doc(activePortalMinglRoomId).set({
        memberBackgrounds:{[user.uid]:url},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      if (otherUid) {
        const requesterName = currentProfile.displayName || user.displayName || user.email || "A Mingl member";
        await db.collection("chatMessages").add({
          roomId:activePortalMinglRoomId,
          roomType:"mingl",
          connectionId:room.connectionId || "",
          participants:room.participants || [],
          senderUid:"system",
          senderName:"System Message",
          messageType:"backgroundConsent",
          body:`${requesterName} wishes to change your mutual chat background. Please approve or decline the shared background.`,
          backgroundUrl:url,
          backgroundRequestedByUid:user.uid,
          backgroundTargetUid:otherUid,
          backgroundConsentStatus:"pending",
          createdAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      applyPortalMinglBackground(url);
      setText("portalStatus", otherUid ? "Your chat background was updated. The other patron was asked to consent before it becomes shared." : "Mingl chat background updated.");
    } catch (error) {
      setText("portalStatus", error?.message || "Could not update Mingl chat background.");
    }
  }

  function applyPortalMinglBackground(url = "") {
    const wrap = byId("portalMinglMessages");
    if (!wrap) return;
    wrap.style.backgroundImage = url ? `linear-gradient(rgba(7,12,32,.68),rgba(7,12,32,.82)), url("${String(url).replace(/"/g, "%22")}")` : "";
    wrap.style.backgroundSize = url ? "cover" : "";
    wrap.style.backgroundPosition = url ? "center" : "";
  }

  function appendPortalMinglBubble(msg, user, pending = false) {
    const wrap = byId("portalMinglMessages");
    if (!wrap || !user) return;
    const empty = wrap.querySelector(".mingl-empty-state");
    if (empty) empty.remove();
    const mine = msg.senderUid === user.uid;
    const system = msg.senderUid === "system" || msg.messageType === "system";
    const node = document.createElement("div");
    node.className = `mingl-message ${mine ? "mine" : ""} ${system ? "system" : ""} ${pending ? "pending" : ""} ${portalMinglAnimationClass(msg.animationType)}`;
    node.dataset.messageId = msg.id || "";
    if (mine && !system && !pending) {
      node.tabIndex = 0;
      node.dataset.ownMessage = "1";
    }
    node.innerHTML = system
      ? `<p>${esc(msg.body || "")}</p><small>${esc(pending ? "Sending..." : fmtDate(msg.createdAt))}</small>`
      : `<p>${esc(msg.body || "")}</p>${portalMinglMediaHtml(msg)}<small>${esc(pending ? "Sending..." : fmtDate(msg.createdAt))}${msg.edited ? " - edited" : ""}${msg.unsent ? " - unsent" : ""}${msg.deleteAfterRead ? " - delete after read" : ""}${mine && !pending ? " - tap for actions" : ""}</small>`;
    wrap.appendChild(node);
    wrap.scrollTop = wrap.scrollHeight;
    return node;
  }

  async function openPortalMinglChat(room) {
    if (!room?.id) return;
    activePortalMinglRoomId = room.id;
    showPortalPanel("portalMinglChatPage", "portalChats");
    const panel = byId("portalMinglChatPanel");
    panel?.classList.remove("hidden");
    const other = otherMinglUser(room);
    const displayName = other.summary.displayName || room.title || "Mingl Chat";
    setText("portalMinglChatTitle", displayName);
    setText("portalMinglChatStatus", "Mutual Mingl chat");
    const avatar = byId("portalMinglChatAvatar");
    if (avatar) {
      const photo = other.summary.photoURL || other.summary.profilePhotoUrl || "";
      avatar.innerHTML = photo ? `<img src="${esc(photo)}" alt="">` : esc(displayName.slice(0, 1).toUpperCase() || "M");
    }
    applyPortalMinglBackground(room.memberBackgrounds?.[auth.currentUser?.uid] || room.sharedBackgroundUrl || "");
    clearPortalMinglAttachment();
    updateChatGrammarControls();
    subscribePortalMinglMessages();
    byId("portalMinglChatPage")?.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function backToMinglDashboard() {
    showPortalPanel("portalChats", "portalChats");
  }

  function renderPortalMinglMessages(rows) {
    const user = auth.currentUser;
    const wrap = byId("portalMinglMessages");
    if (!wrap || !user) return;
    expireReadOncePortalMinglMessages(rows);
    markPortalMinglMessagesRead(rows);
    const sorted = rows.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    wrap.innerHTML = sorted.length ? sorted.map(msg => {
      const mine = msg.senderUid === user.uid;
      const system = msg.senderUid === "system" || msg.messageType === "system";
      const backgroundConsentActions = msg.messageType === "backgroundConsent" && msg.backgroundTargetUid === user.uid && (msg.backgroundConsentStatus || "pending") === "pending"
        ? `<div class="queue-actions background-consent-actions"><button class="primary" type="button" data-bg-consent="approve" data-message-id="${esc(msg.id || "")}">Approve Background</button><button type="button" data-bg-consent="decline" data-message-id="${esc(msg.id || "")}">Keep My Background</button></div>`
        : "";
      return `<div class="mingl-message ${mine ? "mine" : ""} ${system ? "system" : ""} ${msg.unsent ? "unsent" : ""} ${portalMinglAnimationClass(msg.animationType)}" data-message-id="${esc(msg.id || "")}" ${mine && !system && !msg.unsent ? 'tabindex="0" data-own-message="1"' : ""}>
        <p>${esc(msg.body || "")}</p>
        ${portalMinglMediaHtml(msg)}
        ${backgroundConsentActions}
        <small>${esc(fmtDate(msg.createdAt))}${msg.edited ? " - edited" : ""}${msg.unsent ? " - unsent" : ""}${msg.deleteAfterRead ? " - delete after read" : ""}${portalMinglReadReceiptHtml(msg, mine)}${mine && !system && !msg.unsent ? " - tap for actions" : ""}</small>
      </div>`;
    }).join("") : "<p class='sub mingl-empty-state'>Start the conversation.</p>";
    wrap.querySelectorAll("[data-own-message]").forEach(node => {
      node.addEventListener("click", () => showPortalMinglMessageActions(node.dataset.messageId, node));
      node.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showPortalMinglMessageActions(node.dataset.messageId, node);
        }
      });
    });
    wrap.querySelectorAll("[data-bg-consent]").forEach(button => {
      button.addEventListener("click", () => respondToPortalMinglBackgroundConsent(button.dataset.messageId || "", button.dataset.bgConsent === "approve"));
    });
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function respondToPortalMinglBackgroundConsent(messageId, approved) {
    const user = auth.currentUser;
    if (!user || !activePortalMinglRoomId || !messageId) return;
    try {
      const messageRef = db.collection("chatMessages").doc(messageId);
      const snap = await messageRef.get();
      if (!snap.exists) throw new Error("Background request was not found.");
      const msg = snap.data();
      if (msg.backgroundTargetUid !== user.uid) throw new Error("Only the requested patron can respond to this background request.");
      await messageRef.set({
        backgroundConsentStatus:approved ? "approved" : "declined",
        responseByUid:user.uid,
        respondedAt:firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      const roomSnap = await db.collection("chatRooms").doc(activePortalMinglRoomId).get();
      const room = roomSnap.exists ? roomSnap.data() : {};
      if (approved && msg.backgroundUrl) {
        await db.collection("chatRooms").doc(activePortalMinglRoomId).set({
          sharedBackgroundUrl:msg.backgroundUrl,
          memberBackgrounds:{[user.uid]:msg.backgroundUrl},
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        }, {merge:true});
        applyPortalMinglBackground(msg.backgroundUrl);
      }
      await db.collection("chatMessages").add({
        roomId:activePortalMinglRoomId,
        roomType:"mingl",
        connectionId:room.connectionId || msg.connectionId || "",
        participants:msg.participants || room.participants || [],
        senderUid:"system",
        senderName:"System Message",
        messageType:"system",
        body:approved ? "Shared chat background approved." : "Shared chat background declined. Each patron will keep their own chat background.",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      setText("portalStatus", approved ? "Shared Mingl chat background approved." : "Shared background declined. Your side stays unchanged.");
    } catch (error) {
      setText("portalStatus", error?.message || "Could not update background consent.");
    }
  }

  function subscribePortalMinglMessages() {
    const wrap = byId("portalMinglMessages");
    if (!wrap || !activePortalMinglRoomId) return;
    if (portalMinglUnsubscribe) portalMinglUnsubscribe();
    wrap.innerHTML = "<p class='sub'>Loading Mingl messages...</p>";
    try {
      portalMinglUnsubscribe = db.collection("chatMessages")
        .where("roomId", "==", activePortalMinglRoomId)
        .where("participants", "array-contains", auth.currentUser.uid)
        .onSnapshot(snap => renderPortalMinglMessages(snap.docs.map(doc => ({id:doc.id, ...doc.data()}))), () => {
          getCollectionSafe("chatMessages", msg => msg.roomId === activePortalMinglRoomId).then(renderPortalMinglMessages);
        });
    } catch(e) {
      getCollectionSafe("chatMessages", msg => msg.roomId === activePortalMinglRoomId).then(renderPortalMinglMessages);
    }
  }

  async function sendPortalMinglMessage() {
    const user = auth.currentUser;
    const input = byId("portalMinglMessageInput");
    const body = input?.value.trim();
    const attachmentFile = portalMinglAttachmentFile || byId("portalMinglImageInput")?.files?.[0] || null;
    if (!user || !activePortalMinglRoomId || (!body && !attachmentFile)) return;
    const tempId = `temp-${Date.now()}`;
    let mediaPayload = {};
    let pending = null;
    try {
      const roomSnap = await db.collection("chatRooms").doc(activePortalMinglRoomId).get();
      if (!roomSnap.exists) throw new Error("Mingl chat room was not found.");
      const room = roomSnap.data();
      if (!(room.participants || []).includes(user.uid)) throw new Error("Mingl chat is available only to approved participants.");
      const unreadCounts = {...(room.unreadCounts || {})};
      (room.participants || []).forEach(uid => { if (uid !== user.uid) unreadCounts[uid] = Number(unreadCounts[uid] || 0) + 1; });
      if (attachmentFile) mediaPayload = await uploadPortalMinglImage(activePortalMinglRoomId, attachmentFile);
      input.value = "";
      clearPortalMinglAttachment();
      highlightMinglDraft();
      pending = appendPortalMinglBubble({
        id:tempId,
        senderUid:user.uid,
        senderName:currentProfile.displayName || user.displayName || user.email || "Member",
        body:body || "Shared a picture.",
        createdAt:new Date(),
        ...mediaPayload
      }, user, true);
      await db.collection("chatMessages").add({
        roomId:activePortalMinglRoomId,
        roomType:"mingl",
        connectionId:room.connectionId || "",
        participants:room.participants || [],
        senderUid:user.uid,
        senderName:currentProfile.displayName || user.displayName || user.email || "Member",
        body:body || "Shared a picture.",
        ...mediaPayload,
        edited:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("chatRooms").doc(activePortalMinglRoomId).set({
        lastMessage:body || "Shared a picture.",
        unreadCounts,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      setText("portalStatus", "");
    } catch (error) {
      input.value = body;
      portalMinglAttachmentFile = attachmentFile;
      setText("portalStatus", minglUploadErrorMessage(error) || "Mingl message could not be sent.");
      if (pending) pending.remove();
      highlightMinglDraft();
    }
  }

  async function editPortalMinglMessage(messageId) {
    const user = auth.currentUser;
    if (!user || !messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== user.uid) return;
    const next = prompt("Edit Mingl message", snap.data().body || "");
    if (next == null || !next.trim()) return;
    await db.collection("chatMessages").doc(messageId).set({
      body:next.trim(),
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  async function improvePortalMinglDraft() {
    const input = byId("portalMinglMessageInput");
    const draft = input?.value.trim();
    if (!input || !draft) return;
    if (!window.FLOQRGrammar?.suggestGrammarCorrection) {
      setText("portalStatus", "AI grammar correction is not available yet.");
      return;
    }
    setText("portalStatus", "Checking draft grammar...");
    const result = await window.FLOQRGrammar.suggestGrammarCorrection(draft, {
      uid:auth.currentUser?.uid || "",
      product:"mingl",
      inputType:"chat",
      preferredLanguage:currentLanguageSettings.preferredLanguage || "auto",
      tonePreference:currentLanguageSettings.tonePreference || "keepTone",
      correctionMode:currentLanguageSettings.correctionMode || "approvalRequired",
      personalDictionary:currentLanguageSettings.personalDictionary || [],
      personalCorrections:currentLanguageSettings.personalCorrections || []
    });
    const suggestion = result.correctedText || draft;
    if (suggestion === draft) {
      setText("portalStatus", result.provider === "gemini-unavailable" || result.provider === "personal-fallback"
        ? "Gemini grammar correction is unavailable. FLOQR only used your saved personal corrections and Word List."
        : "No grammar change suggested.");
      highlightMinglDraft();
      return;
    }
    if (currentLanguageSettings.correctionMode === "autoFixMinor" && Number(result.confidence || 0) >= 0.7) {
      window.FLOQRGrammar.applyCorrectionToInput(input, suggestion);
      setText("portalStatus", "Minor typo fix applied. Tap Send when ready.");
      highlightMinglDraft();
      return;
    }
    const decision = await showGrammarSuggestionModal({
      original:draft,
      suggested:suggestion,
      explanation:result.explanation || "",
      provider:result.provider || ""
    });
    const choice = typeof decision === "string" ? decision : decision?.choice;
    if (choice === "use") {
      window.FLOQRGrammar.applyCorrectionToInput(input, suggestion);
      setText("portalStatus", "Suggestion applied. Tap Send when ready.");
    } else if (choice === "add-word") {
      const added = await addPersonalDictionaryWord(decision?.word || firstChangedToken(draft, suggestion));
      setText("portalStatus", added ? "Word added to My Word List. Original draft kept." : "Could not add word to My Word List.");
      input.focus();
    } else if (choice === "add-correction") {
      const pair = decision?.from && decision?.to ? decision : firstChangedPair(draft, suggestion);
      const added = await addPersonalCorrection(pair.from, pair.to);
      setText("portalStatus", added ? "Personal correction saved. It will be used when this typo appears again." : "Could not save personal correction.");
      input.focus();
    } else if (choice === "edit") {
      input.focus();
      setText("portalStatus", "Edit your draft, then tap Send when ready.");
    } else {
      setText("portalStatus", "Original draft kept.");
    }
    highlightMinglDraft();
  }

  function insertPortalEmoji(emoji) {
    const input = byId("portalMinglMessageInput");
    if (!input) return;
    input.value = `${input.value}${emoji}`;
    input.focus();
  }

  function shoutoutModifyUrl(item) {
    const url = new URL("./patron-portal.html", window.location.href);
    url.searchParams.set("tab", "shoutouts");
    url.searchParams.set("v", "28.43-f");
    if (item.referenceNumber) url.searchParams.set("ref", item.referenceNumber);
    if (item.id) url.searchParams.set("id", item.id);
    return url.toString();
  }

  function startShoutoutEdit(item) {
    activeShoutoutEditId = item.id || "";
    byId("editShoutoutMain").value = item.mainText || "";
    byId("editShoutoutSub").value = item.subText || "";
    setText("shoutoutEditStatus", `Editing ${item.referenceNumber || item.id || "pending ShoutOut"}. Changes apply only while the ShoutOut is pending.`);
    byId("shoutoutEditCard").classList.remove("hidden");
    byId("shoutoutEditCard").scrollIntoView({behavior:"smooth", block:"start"});
  }

  function showShoutoutDiagnostic(refOrId = "") {
    byId("shoutoutDiagnosticCard").classList.remove("hidden");
    byId("diagnosticShoutoutRef").value = refOrId || byId("diagnosticShoutoutRef").value || "";
    byId("shoutoutDiagnosticCard").scrollIntoView({behavior:"smooth", block:"start"});
  }

  function cancelShoutoutEdit() {
    activeShoutoutEditId = "";
    byId("editShoutoutMain").value = "";
    byId("editShoutoutSub").value = "";
    byId("shoutoutEditCard").classList.add("hidden");
  }

  async function saveShoutoutEdit(options = {}) {
    const user = auth.currentUser;
    if (!user || !activeShoutoutEditId) return;
    const item = currentShoutouts.find(x => x.id === activeShoutoutEditId);
    if (!item) { setText("shoutoutEditStatus", "Could not find that pending ShoutOut."); return; }
    const ownsItem = item.submittedByUid === user.uid || item.submittedBy === user.email;
    const pending = String(item.status || "pending").toLowerCase() === "pending" && item.editable !== false;
    if (!ownsItem || !pending) { setText("shoutoutEditStatus", "This ShoutOut can no longer be modified."); return; }
    const mainText = byId("editShoutoutMain").value.trim();
    const subText = byId("editShoutoutSub").value.trim();
    if (!mainText) { setText("shoutoutEditStatus", "Main message is required."); return; }
    const update = {
      mainText,
      subText,
      modifiedByUid:user.uid,
      modifiedAt:firebase.firestore.FieldValue.serverTimestamp()
    };
    if (options.resubmit) {
      update.status = "pending";
      update.editable = true;
      update.resubmittedAt = firebase.firestore.FieldValue.serverTimestamp();
      update.resubmittedByUid = user.uid;
    }
    await db.collection("shoutouts").doc(activeShoutoutEditId).set(update, {merge:true});
    try {
      await db.collection("shoutoutAudit").add({
        shoutoutId:activeShoutoutEditId,
        referenceNumber:item.referenceNumber || "",
        action:options.resubmit ? "modified_resubmitted" : "modified",
        actorUid:user.uid,
        actorEmail:user.email || "",
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {}
    setText("portalStatus", options.resubmit ? "ShoutOut updated and resubmitted for approval." : "ShoutOut updated and still pending for approval.");
    cancelShoutoutEdit();
    await loadPortal(user);
  }

  async function runShoutoutDiagnostic() {
    const user = auth.currentUser;
    if (!user) return;
    const needle = byId("diagnosticShoutoutRef").value.trim();
    if (!needle) { setText("shoutoutDiagnosticReport", "Enter a reference number or document id."); return; }
    setText("shoutoutDiagnosticReport", "Searching ShoutOut records...");
    const [pending, liveContent, notifications, audit] = await Promise.all([
      getCollectionSafe("shoutouts", x => x.id === needle || x.referenceNumber === needle || x.shoutoutId === needle),
      getCollectionSafe("liveContent", x => x.id === needle || x.referenceNumber === needle || x.shoutoutId === needle),
      getCollectionSafe("inboxNotifications", x => x.referenceNumber === needle || x.shoutoutId === needle || x.id === needle),
      getCollectionSafe("shoutoutAudit", x => x.referenceNumber === needle || x.shoutoutId === needle || x.id === needle)
    ]);
    const rows = [
      ["Pending ShoutOut queue", pending.length ? pending.map(x => `${x.referenceNumber || x.id} - ${x.status || "pending"} - ${x.locationName || x.clubLocationId || ""}`).join(" | ") : "Not found"],
      ["Live display content", liveContent.length ? liveContent.map(x => `${x.referenceNumber || x.id} - ${x.status || "live"} - ${x.locationName || x.clubLocationId || ""}`).join(" | ") : "Not found"],
      ["System messages", notifications.length ? notifications.map(x => `${x.title || x.subject || "Notification"} - ${fmtDate(x.createdAt)}`).join(" | ") : "Not found"],
      ["Audit trail", audit.length ? audit.map(x => `${x.action || "audit"} - ${fmtDate(x.createdAt)} - ${x.actorEmail || ""}`).join(" | ") : "Not found"]
    ];
    byId("shoutoutDiagnosticReport").innerHTML = simpleRows(rows);
  }

  async function openMessage(el, user) {
    const index = Number(el.dataset.messageIndex);
    const msg = currentMessages[index];
    el.querySelector(".message-body")?.classList.remove("hidden");
    if (!msg || msg.read || !msg.id || !msg._collection) return;
    const isRecipient = msg.recipientUid === user.uid || msg.recipientEmail === user.email;
    if (!isRecipient) return;
    const update = {
      read: true,
      readAt: firebase.firestore.FieldValue.serverTimestamp(),
      openedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!msg.firstOpenedAt) update.firstOpenedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
      await db.collection(msg._collection).doc(msg.id).set(update, {merge:true});
      msg.read = true;
      el.classList.remove("unread");
      el.classList.add("read");
      el.querySelector(".message-envelope-head span").textContent = "Read";
    } catch(e) {
      console.warn("Could not mark message read:", e.message);
    }
  }

  function renderPolicies(profile) {
    const roles = getApprovedRoles(profile).map(x => ROLE_LABELS[x] || x);
    const canDirect = canSendDirectInbox(profile);
    byId("messagePolicySummary").innerHTML = `<ul>
      <li>System notifications are internal FLOQR Inbox messages and use <strong>System Message</strong> as the sender.</li>
      <li>FLOQR Inbox messages store sender, timestamp, subject, body, read state, and opened/read timestamps.</li>
      <li>Patrons can send internal support messages to Club Admins or club-designated Customer Service Representatives.</li>
      <li>Patron-to-patron direct FLOQR Inbox messages remain blocked unless the sender is an approved Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress, or Bottle Girl.</li>
      <li>Your current approved role set: <strong>${esc(roles.join(", "))}</strong>.</li>
    </ul>`;
    byId("chatPolicySummary").innerHTML = `<ul>
      <li>Mingl Chat is separate from Inbox.</li>
      <li>Master Admin is excluded from member Mingl Chat.</li>
      <li>Patron-to-patron Mingl Chat requires both patrons to Mingl back.</li>
      <li>Role members cannot initiate Mingl Chat with patrons unless the thread is tied to a patron-originated action such as a payment, guest list request, ShoutOut purchase, reservation, or support question.</li>
      <li>Role-specific Mingl permissions must be enforced by Firestore rules or a server function before production launch.</li>
    </ul>`;
    byId("composePolicyNote").textContent = canDirect ? "Internal messaging is enabled for your approved role. Use patron-originated context before contacting a patron." : "Patrons can message Club Admins and designated Customer Service Representatives here. Patron-to-patron conversations use Mingl Chat after both patrons Mingl back.";
    byId("sendMessageBtn").disabled = false;
    byId("composeRecipientSearch").disabled = false;
    byId("composeSubject").disabled = false;
    byId("composeBody").disabled = false;
  }

  async function loadPortal(user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const profile = snap.exists ? snap.data() : {};
    currentProfile = {uid:user.uid, email:user.email || "", ...profile};

    if (!snap.exists) {
      await ref.set({displayName:user.displayName || "", email:user.email || "", photoURL:user.photoURL || "", memberLevel:"Patron", createdAt:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    }

    fillProfileForm(profile, user);
    renderMediaSlots(profile);
    renderProfilePreview(profile, user);
    await renderTemplateVariantSettings(user, profile);
    renderRoleGuide();
    renderPolicies(profile);
    setText("portalAccountName", profile.displayName || user.displayName || user.email || "Patron");
    setText("portalAccountEmail", user.email || "");
    setText("metricMemberLevel", profile.memberLevel || "Patron");
    setText("metricMemberSince", fmtDate(profile.createdAt));

    setText("portalStatus", "Loading your FLOQR Inbox…");
    const [shoutouts, guestLists, directMessages, inboxNotifications, queriedChats, queriedConnections, serviceOrders] = await Promise.all([
      getUserScopedRows("shoutouts", user, [["submittedByUid","uid"],["submittedBy","email"]]),
      getUserScopedRows("guestListRequests", user, [["submittedByUid","uid"],["guestEmail","email"]]),
      getUserScopedRows("messages", user, [["recipientUid","uid"],["senderUid","uid"],["recipientEmail","email"],["senderEmail","email"]]),
      getUserScopedRows("inboxNotifications", user, [["recipientUid","uid"],["recipientEmail","email"]]),
      getParticipantCollectionSafe("chatRooms", user.uid),
      getParticipantCollectionSafe("minglConnections", user.uid),
      getCollectionSafe("serviceOrders", row => row.ownerUid === user.uid, 300)
    ]);
    currentMinglConnections = await getPortalMinglConnections(user, [], queriedConnections);
    currentPortalUsers = [];
    const chats = await getPortalMinglRooms(user, [], queriedChats);
    renderMinglFriendSettings([]);
    messageRecipients = [];

    const messages = [
      ...directMessages,
      ...inboxNotifications.map(x => ({...x, senderUid:"system", senderName:"System Message", messageType:"system", subject:x.subject || x.title || "System Message", body:x.body || x.preview || "", type:x.type || "notification"}))
    ];
    const unreadMessages = messages.filter(x => (x.recipientUid === user.uid || x.recipientEmail === user.email) && !x.read).length;
    const unreadChats = chats.reduce((sum,x) => sum + Number(x.unreadCounts?.[user.uid] || 0), 0);

    setText("metricMessages", `${unreadMessages}/${messages.length}`);
    setText("metricChats", `${unreadChats}/${chats.length}`);
    setText("messageCountLabel", `(${unreadMessages}/${messages.length})`);
    setText("chatCountLabel", `(${unreadChats}/${chats.length})`);

    byId("profileSummary").innerHTML = simpleRows([
      ["Name", profile.fullName || profile.displayName || user.displayName || "-"],
      ["Email", user.email || "-"],
      ["City", profile.city || "-"],
      ["Country", profile.country || "-"],
      ["Gender", profile.gender || "-"],
      ["Height", heightDisplay(profile) || "-"],
      ["Food Choices", joinCSV(profile.foodChoices) || "-"],
      ["Favorite Beverages", joinCSV(profile.favoriteBeverages) || "-"],
      ["Preferred Language", profile.preferredLanguage || "-"],
      ["Public Profile Language", publicProfileLanguageLabel(profile)],
      ["English Translation", profile.publicProfileTranslationStatus || "not prepared"],
      ["Member Level", profile.memberLevel || "Patron"],
      ["Public Profile", ROLE_LABELS[profile.publicProfileType || "patron"]],
      ["Visibility", profile.publicProfileVisibility || "followers"]
    ]);
    if (byId("portalCommerceLink")) byId("portalCommerceLink").href = `./commerce.html?seller=${encodeURIComponent(user.uid)}&v=29.07`;
    if (byId("paidServicesReport")) byId("paidServicesReport").innerHTML = serviceOrders.length ? serviceOrders.sort((a,b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0)).map(order => `<div class="queue-item"><div class="message-envelope-head"><strong>${esc(order.itemName || order.orderType || "FLOQR service")}</strong><span>${esc(order.paymentStatus || order.status || "pending")}</span></div><p>${esc(order.invoiceNumber || order.id)}</p><small>Total: $${(Number(order.amountCents || 0)/100).toFixed(2)} - Fulfillment: ${esc(order.fulfillmentStatus || order.shippingStatus || "pending")}${order.trackingNumber ? ` - Tracking: ${esc(order.trackingNumber)}` : ""}</small></div>`).join("") : "<p class='sub'>No paid services or Commerce orders yet.</p>";

    currentShoutouts = shoutouts;
    byId("myShoutouts").innerHTML = shoutouts.length ? shoutouts.map((x, index) => {
      const canModify = x.editable !== false && String(x.status || "pending").toLowerCase() === "pending";
      return `<div class="queue-item ${new URL(window.location.href).searchParams.get("ref") === x.referenceNumber ? "highlight-item" : ""}">
        <strong>${esc(x.mainText || "ShoutOut")}</strong>
        <p>${esc(x.locationName || x.clubName || "")} - ${esc(x.status || "pending")}</p>
        <small>${esc(fmtDate(x.submittedAt))}${x.referenceNumber ? ` - Ref: ${esc(x.referenceNumber)}` : ""}</small>
        <p class="queue-actions">
          ${canModify ? `<button class="buttonlike modify-shoutout-btn" type="button" data-shoutout-index="${index}">Modify ShoutOut</button>` : ""}
          <button class="buttonlike diagnose-shoutout-btn" type="button" data-shoutout-ref="${esc(x.referenceNumber || x.id || "")}">Diagnose</button>
        </p>
      </div>`;
    }).join("") : "<p class='sub'>No ShoutOuts yet.</p>";
    document.querySelectorAll(".modify-shoutout-btn").forEach(btn => {
      btn.addEventListener("click", () => startShoutoutEdit(currentShoutouts[Number(btn.dataset.shoutoutIndex)]));
    });
    document.querySelectorAll(".diagnose-shoutout-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        showShoutoutDiagnostic(btn.dataset.shoutoutRef || "");
        runShoutoutDiagnostic();
      });
    });
    const params = new URL(window.location.href).searchParams;
    const requestedId = params.get("id");
    const requestedRef = params.get("ref");
    const requestedItem = currentShoutouts.find(x => (requestedId && x.id === requestedId) || (requestedRef && x.referenceNumber === requestedRef));
    if (requestedItem && !activeShoutoutEditId && requestedItem.editable !== false && String(requestedItem.status || "pending").toLowerCase() === "pending") {
      startShoutoutEdit(requestedItem);
    } else if ((requestedId || requestedRef) && !requestedItem) {
      showShoutoutDiagnostic(requestedRef || requestedId);
      runShoutoutDiagnostic();
    }
    byId("myGuestLists").innerHTML = guestLists.length ? guestLists.map(x => `<div class="queue-item"><strong>${esc(x.locationName || x.clubLocationId || "Guest List")}</strong><p>${esc(x.eventOrDay || "")} - Party of ${esc(x.partySize || 1)} - ${esc(x.status || "pending")}</p><small>Promoter: ${esc(x.promoterName || x.promoterId || "")}</small></div>`).join("") : "<p class='sub'>No guest list requests yet.</p>";
    renderMessages(messages, user);
    renderPortalMinglRequests(currentMinglConnections, user);
    renderPortalMinglChats(chats, user);
    setText("portalStatus", "FLOQR Inbox ready. Loading directory tools in the background…");
    Promise.all([
      getCollectionSafe("users", null, 500),
      getCollectionSafe("clubEmployeeDesignations", x => x.isCSR !== false, 300)
    ]).then(async ([allUsers, employeeDesignations]) => {
      currentPortalUsers = allUsers;
      if (!currentMinglConnections.length) currentMinglConnections = await getPortalMinglConnections(user, allUsers, queriedConnections);
      renderMinglFriendSettings(allUsers);
      renderPortalMinglRequests(currentMinglConnections, user);
      if (!queriedChats.length) {
        const legacyChats = await getPortalMinglRooms(user, allUsers, queriedChats);
        renderPortalMinglChats(legacyChats, user);
      }
      messageRecipients = buildMessageRecipients(user, allUsers, employeeDesignations);
      renderRecipientSearchResults();
      setText("portalStatus", "FLOQR Inbox and directory tools are ready.");
    }).catch(() => setText("portalStatus", "FLOQR Inbox is ready. Some directory tools may still be loading."));
    const requestedRoom = params.get("room");
    if (requestedRoom && !activePortalMinglRoomId) {
      const room = chats.find(x => x.id === requestedRoom);
      if (room) openPortalMinglChat(room);
      else setText("portalStatus", "Requested Mingl Chat was not found or is not available for this account.");
    }
    byId("privacyReport").innerHTML = simpleRows([
      ["Marketing Consent", profile.marketingConsent ? "Yes" : "No"],
      ["Analytics Consent", profile.analyticsConsent ? "Yes" : "No"],
      ["Data Sharing Consent", profile.dataSharingConsent ? "Yes" : "No"],
      ["Public Mingl Datapoints", publicMinglDatapoints(profile).map(key => PUBLIC_MINGL_DATAPOINTS.find(point => point.key === key)?.label || key).join(", ") || "None"]
    ]);
  }

  async function sendPortalMessage() {
    const user = auth.currentUser;
    if (!user) return;
    const recipientUid = byId("composeRecipientUid")?.value.trim();
    const recipientEmail = byId("composeRecipientEmail")?.value.trim().toLowerCase();
    const recipientLabel = byId("composeRecipientLabel")?.value.trim();
    const selectedRecipient = messageRecipients.find(x => (recipientUid && x.uid === recipientUid) || (recipientEmail && x.email === recipientEmail));
    const subject = byId("composeSubject")?.value.trim() || "Message";
    const body = byId("composeBody")?.value.trim();
    if ((!recipientUid && !recipientEmail) || !selectedRecipient || !body) { setText("portalStatus", "Select an internal recipient from search and enter a message."); return; }
    return actionFeedback({
      starting:"Sending message...",
      wait:"We are sending your message. Please wait a few seconds.",
      success:"Message sent",
      redirecting:"Message sent, redirecting back to FLOQR Inbox.",
      returnTo:"FLOQR Inbox"
    }, async () => {
    await db.collection("messages").add({
      messageType:selectedRecipient.recipientType === "club_csr" || selectedRecipient.recipientType === "club_admin" ? "patron_support" : "role_direct",
      senderUid:user.uid,
      senderEmail:user.email || "",
      senderName:currentProfile.displayName || user.displayName || user.email || "Member",
      senderRoles:getApprovedRoles(currentProfile),
      recipientUid:recipientUid || "",
      recipientEmail,
      recipientName:recipientLabel || selectedRecipient.label || recipientEmail || "Recipient",
      recipientType:selectedRecipient.recipientType || "member",
      clubLocationId:selectedRecipient.clubLocationId || "",
      locationName:selectedRecipient.locationName || "",
      subject,
      body,
      read:false,
      openedAt:null,
      firstOpenedAt:null,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    setText("portalStatus", "Message sent.");
    byId("composeBody").value = "";
    byId("composeSubject").value = "";
    byId("composeRecipientSearch").value = "";
    byId("composeRecipientUid").value = "";
    byId("composeRecipientEmail").value = "";
    byId("composeRecipientLabel").value = "";
    await loadPortal(user);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    bind("portalGoogleLoginBtn", loginGoogle);
    bind("portalLogoutBtn", logout);
    bind("saveProfileBtn", saveProfile);
    bind("prepareProfileTranslationBtn", prepareProfileTranslation);
    bind("saveMediaSlotsBtn", saveMediaSlots);
    bind("savePrivacyBtn", savePrivacy);
    bind("saveLanguageSettingsBtn", saveLanguageSettings);
    bind("saveMinglFriendSettingsBtn", saveMinglFriendSettings);
    bind("exportDataBtn", downloadData);
    bind("deleteDataBtn", requestDelete);
    bind("sendMessageBtn", sendPortalMessage);
    bind("portalSendMinglMessageBtn", sendPortalMinglMessage);
    bind("portalImproveMinglMessageBtn", improvePortalMinglDraft);
    bind("backToMinglDashboardBtn", backToMinglDashboard);
    bind("portalClearMinglImageBtn", clearPortalMinglAttachment);
    bind("saveShoutoutEditBtn", () => saveShoutoutEdit({resubmit:false}));
    bind("resubmitShoutoutEditBtn", () => saveShoutoutEdit({resubmit:true}));
    bind("cancelShoutoutEditBtn", cancelShoutoutEdit);
    bind("runShoutoutDiagnosticBtn", runShoutoutDiagnostic);
    byId("composeRecipientSearch")?.addEventListener("input", () => {
      byId("composeRecipientUid").value = "";
      byId("composeRecipientEmail").value = "";
      byId("composeRecipientLabel").value = "";
      renderRecipientSearchResults();
    });
    byId("portalMinglMessageInput")?.addEventListener("input", highlightMinglDraft);
    byId("editCountry")?.addEventListener("change", () => applyEditHeightUnit());
    byId("editCountry")?.addEventListener("input", () => applyEditHeightUnit());
    byId("editHeightUnit")?.addEventListener("change", event => {
      event.currentTarget.dataset.userSelected = "true";
      applyEditHeightUnit(true);
    });
    byId("portalMinglImageInput")?.addEventListener("change", renderPortalMinglAttachmentPreview);
    byId("portalMinglBackgroundInput")?.addEventListener("change", uploadPortalMinglBackground);
    byId("portalMinglMessageInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendPortalMinglMessage();
      }
    });
    byId("minglFriendSearchInput")?.addEventListener("input", () => renderMinglFriendSettings(currentPortalUsers));
    ["languageAiGrammarEnabled","languageHighlightSpellingErrors","languageHighlightGrammarSuggestions","languagePreferredLanguage","languageTonePreference","languageEmojiSkinTone","languagePersonalDictionary","languagePersonalCorrections"].forEach(id => {
      byId(id)?.addEventListener("change", () => {
        currentLanguageSettings = collectLanguageSettings();
        renderLanguageSettingsReport(currentLanguageSettings);
        updateChatGrammarControls();
      });
    });
    document.querySelectorAll("input[name='languageCorrectionMode']").forEach(input => {
      input.addEventListener("change", () => {
        currentLanguageSettings = collectLanguageSettings();
        renderLanguageSettingsReport(currentLanguageSettings);
        updateChatGrammarControls();
      });
    });
    document.querySelectorAll("[data-portal-mingl-emoji]").forEach(button => {
      button.addEventListener("click", () => insertPortalEmoji(button.dataset.portalMinglEmoji || ""));
    });

    auth.onAuthStateChanged(user => {
      setText("portalSignedInAs", user ? `Signed in as ${user.displayName || user.email}` : "Not signed in");
      if (!user) {
        byId("portalLogin").classList.remove("hidden");
        byId("portalPanel").classList.add("hidden");
        setText("portalStatus", "Please sign in to continue.");
        return;
      }
      byId("portalLogin").classList.add("hidden");
      byId("portalPanel").classList.remove("hidden");
      setText("portalStatus", "Patron portal loaded.");
      loadPortal(user);
    });
  });
})();
