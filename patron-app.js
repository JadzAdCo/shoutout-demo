
/* patron-app.js v18 - Patron portal only */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const setStatus = value => setText("authStatus", value);
  const qs = (name, fallback = "") => new URL(window.location.href).searchParams.get(name) || fallback;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const unique = items => [...new Set(items.filter(Boolean))].sort();

  if (!window.firebaseConfig) { setStatus("firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let clubs = {};
  let templates = {};
  let selectedClubId = null;
  let selectedTemplate = "neon";
  let confirmationResult = null;
  let pendingDirectClub = qs("club", "");

  function clubId() { return (selectedClubId || pendingDirectClub || "zebbies-garden").toLowerCase(); }
  function getClub(id = clubId()) { return clubs[id] || window.SHOUTOUT_CLUBS[id] || window.SHOUTOUT_CLUBS["zebbies-garden"]; }
  function getTemplate(id = selectedTemplate) { return templates[id] || window.SHOUTOUT_TEMPLATES[id] || window.SHOUTOUT_TEMPLATES.neon; }
  function safeUser() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
  function showPage(id) { document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); byId(id)?.classList.add("active"); }
  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  async function loadTemplates() {
    templates = {...window.SHOUTOUT_TEMPLATES};
    try {
      const snap = await db.collection("templates").get();
      snap.forEach(doc => templates[doc.id] = {id: doc.id, ...doc.data()});
    } catch(e) { console.warn("Using fallback templates:", e.message); }
  }

  async function loadClubs() {
    clubs = {};
    try {
      const snap = await db.collection("clubs").where("active","==",true).orderBy("name","asc").get();
      snap.forEach(doc => clubs[doc.id] = {id: doc.id, ...doc.data()});
    } catch(e) { console.warn("Using fallback clubs:", e.message); }
    if (Object.keys(clubs).length === 0) clubs = {...window.SHOUTOUT_CLUBS};
  }

  async function loadClubById(id) {
    if (clubs[id]) return clubs[id];
    try {
      const doc = await db.collection("clubs").doc(id).get();
      if (doc.exists) { clubs[id] = {id: doc.id, ...doc.data()}; return clubs[id]; }
    } catch(e) { console.warn(e.message); }
    return window.SHOUTOUT_CLUBS[id] || window.SHOUTOUT_CLUBS["zebbies-garden"];
  }

  function updateLoginUI(user) {
    setText("signedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");
    byId("signedInActions")?.classList.toggle("hidden", !user);
    byId("loginActions")?.classList.toggle("hidden", !!user);
  }

  async function continueAfterLogin() {
    await loadTemplates();
    await loadClubs();
    if (pendingDirectClub) {
      const club = await loadClubById(pendingDirectClub);
      selectedClubId = pendingDirectClub;
      showClubSelection();
      const notice = byId("qrForwardNotice");
      if (notice) { notice.classList.remove("hidden"); notice.textContent = `QR code detected. Routing to ${club.name}.`; }
      setTimeout(() => selectClub(pendingDirectClub), 500);
      return;
    }
    showClubSelection();
  }

  async function loginGoogle() {
    try { setStatus("Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { console.error(e); setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function loginFacebook() {
    try { setStatus("Opening Facebook sign-in..."); await auth.signInWithPopup(new firebase.auth.FacebookAuthProvider()); }
    catch(e) { console.error(e); setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function loginMicrosoft() {
    try { const p = new firebase.auth.OAuthProvider("microsoft.com"); p.setCustomParameters({prompt:"select_account"}); setStatus("Opening Microsoft sign-in..."); await auth.signInWithPopup(p); }
    catch(e) { console.error(e); setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function logout() { await auth.signOut(); window.location.href = "./"; }

  function setupPhoneAuth() {
    if (!byId("recaptcha-container") || window.recaptchaVerifier) return;
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {size:"normal"});
  }
  async function sendPhoneCode() {
    try {
      setupPhoneAuth();
      const phone = byId("phoneNumber").value.trim();
      if (!phone.startsWith("+")) { setStatus("Use international format, for example +12025550123."); return; }
      confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      byId("phoneCodeBlock")?.classList.remove("hidden");
      setStatus("Code sent. Enter it below.");
    } catch(e) { console.error(e); setStatus(`${e.code || "error"}: ${e.message}`); }
  }
  async function verifyPhoneCode() {
    try { if (!confirmationResult) { setStatus("Send the OTP first."); return; } await confirmationResult.confirm(byId("phoneCode").value.trim()); }
    catch(e) { console.error(e); setStatus(`${e.code || "error"}: ${e.message}`); }
  }

  function populateFilters() {
    const country = byId("countryFilter"), city = byId("cityFilter"), day = byId("dayFilter"), genre = byId("genreFilter");
    if (!country || !city || !day || !genre) return;
    country.innerHTML = '<option value="">All countries</option>';
    city.innerHTML = '<option value="">All locations</option>';
    day.innerHTML = '<option value="">Any day</option>';
    genre.innerHTML = '<option value="">All genres</option>';
    unique(Object.values(clubs).map(c => c.country)).forEach(x => country.append(new Option(x,x)));
    unique(Object.values(clubs).map(c => c.locationLabel)).forEach(x => city.append(new Option(x,x)));
    unique(Object.values(clubs).flatMap(c => Object.keys(c.schedule || {}))).forEach(x => day.append(new Option(x,x)));
    unique(Object.values(clubs).flatMap(c => Object.values(c.schedule || {}))).forEach(x => genre.append(new Option(x,x)));
  }

  function bindFilters() {
    ["clubSearch","countryFilter","cityFilter","dayFilter","genreFilter"].forEach(id => {
      const el = byId(id);
      if (el && !el.dataset.bound) { el.addEventListener("input", renderClubGrid); el.addEventListener("change", renderClubGrid); el.dataset.bound = "1"; }
    });
  }

  function showClubSelection() { showPage("clubPage"); populateFilters(); bindFilters(); renderClubGrid(); }

  function renderClubGrid() {
    const grid = byId("clubGrid");
    if (!grid) return;
    const s = (byId("clubSearch")?.value || "").toLowerCase();
    const country = byId("countryFilter")?.value || "", city = byId("cityFilter")?.value || "", day = byId("dayFilter")?.value || "", genre = byId("genreFilter")?.value || "";
    const matches = Object.entries(clubs).filter(([id,c]) => {
      const sched = Object.entries(c.schedule || {}).map(([d,g]) => `${d} ${g}`).join(" ");
      const hay = `${c.name} ${c.country} ${c.region} ${c.city} ${c.locationLabel} ${c.dj} ${sched}`.toLowerCase();
      return (!s || hay.includes(s)) && (!country || c.country === country) && (!city || c.locationLabel === city) && (!day || Object.keys(c.schedule || {}).includes(day)) && (!genre || Object.values(c.schedule || {}).includes(genre));
    });
    grid.innerHTML = matches.length ? "" : '<div class="empty">No matching clubs found.</div>';
    matches.forEach(([id,c]) => {
      const card = document.createElement("div");
      card.className = "club-option";
      card.innerHTML = `<div><div class="club-option-head"><div><h3>${esc(c.name)}</h3><p>${esc(c.locationLabel)}</p></div><strong>${esc(c.country || "")}</strong></div><p class="dj">Resident: ${esc(c.dj || "")}</p><div class="badge-row">${Object.entries(c.schedule || {}).map(([d,g]) => `<span>${esc(d)} · ${esc(g)}</span>`).join("")}</div></div><button class="primary" type="button">Select Club</button>`;
      card.querySelector("button").addEventListener("click", () => selectClub(id));
      grid.appendChild(card);
    });
  }

  async function selectClub(id) {
    selectedClubId = id;
    const club = await loadClubById(id);
    setText("selectedClubTitle", club.name);
    setText("selectedClubMeta", `${club.locationLabel} • ${club.dj || ""}`);
    selectedTemplate = (club.templates && club.templates[0]) || "neon";
    renderTemplates();
    updateTemplateSummary();
    showPage("templateSelectPage");
  }

  function showTemplateSelection() { renderTemplates(); updateTemplateSummary(); showPage("templateSelectPage"); }
  function renderTemplates() {
    const grid = byId("templateGrid");
    if (!grid) return;
    grid.innerHTML = "";
    (getClub().templates || ["neon"]).forEach(id => {
      const t = getTemplate(id);
      const item = document.createElement("div");
      item.className = `template ${t.className || "neon"} ${t.id === selectedTemplate ? "selected" : ""}`;
      item.innerHTML = `<div class="name">${esc(t.name)}</div><div class="tag">${esc(t.scope || "Shared")} template</div>`;
      item.addEventListener("click", () => { selectedTemplate = t.id; renderTemplates(); updateTemplateSummary(); });
      grid.appendChild(item);
    });
  }
  function updateTemplateSummary() {
    const t = getTemplate();
    byId("selectedTemplateSummary").innerHTML = `<h3>${esc(t.name)}</h3><p>${esc(t.scope || "Shared")} template selected.</p>`;
  }

  function displayUrl(payload, id = clubId()) {
    const url = new URL("./display.html", window.location.href);
    url.searchParams.set("club", id);
    if (payload) { url.searchParams.set("main", payload.mainText || ""); url.searchParams.set("sub", payload.subText || ""); url.searchParams.set("template", payload.template || "neon"); url.searchParams.set("media", payload.mediaUrl || ""); }
    return url.href;
  }
  function goToEditor() {
    const c = getClub(), t = getTemplate();
    setText("editorClubTitle", c.name);
    setText("editorTemplateMeta", `${c.locationLabel} • Template: ${t.name}`);
    updatePreview();
    showPage("editorPage");
  }
  function updatePreview() {
    const frame = byId("previewFrame");
    if (!frame) return;
    frame.src = displayUrl({ mainText: byId("mainText")?.value.trim() || "SHOUTOUT!", subText: byId("subText")?.value.trim() || "", mediaUrl: byId("mediaUrl")?.value.trim() || "", template: selectedTemplate }, clubId());
  }

  async function submitShoutout() {
    const status = byId("submitStatus");
    try {
      if (!currentUser) { status.textContent = "Sign in first."; return; }
      if (!selectedClubId) { status.textContent = "Select a club first."; return; }
      const c = getClub(), t = getTemplate();
      const payload = { club: clubId(), clubName: c.name, country: c.country || "", city: c.city || "", locationLabel: c.locationLabel || "", template: selectedTemplate, templateName: t.name, mainText: byId("mainText").value.trim() || "SHOUTOUT!", subText: byId("subText").value.trim() || "", mediaUrl: byId("mediaUrl").value.trim(), status: "pending", submittedBy: safeUser(), submittedAt: firebase.firestore.FieldValue.serverTimestamp(), referenceNumber: `SO-${Date.now().toString().slice(-7)}` };
      await db.collection("shoutouts").add(payload);
      setText("confirmRef", payload.referenceNumber); setText("confirmClub", c.name); setText("confirmTemplate", t.name);
      showPage("confirmationPage");
    } catch(e) { console.error(e); status.textContent = e.message; }
  }
  function startAnother() { byId("mainText").value = "HAPPY BIRTHDAY MAYA!"; byId("subText").value = "VIP Table 4 sends love"; byId("mediaUrl").value = ""; showTemplateSelection(); }

  document.addEventListener("DOMContentLoaded", function () {
    setStatus("App loaded. Choose a sign-in option.");
    auth.onAuthStateChanged(async user => { currentUser = user; updateLoginUI(user); if (user) await continueAfterLogin(); });
    bind("googleLoginBtn", loginGoogle); bind("facebookLoginBtn", loginFacebook); bind("microsoftLoginBtn", loginMicrosoft); bind("sendOtpBtn", sendPhoneCode); bind("verifyOtpBtn", verifyPhoneCode); bind("continueBtn", continueAfterLogin);
    ["logoutBtn1","logoutBtn2","logoutBtn3","logoutBtn4","logoutBtn5"].forEach(id => bind(id, logout));
    bind("backToClubsBtn", showClubSelection); bind("backToTemplatesBtn", showTemplateSelection); bind("goToEditorBtn", goToEditor); bind("submitShoutoutBtn", submitShoutout); bind("startAnotherBtn", startAnother); bind("chooseAnotherClubBtn", showClubSelection);
    ["mainText","subText","mediaUrl"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
  });
})();
