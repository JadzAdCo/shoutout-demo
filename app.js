/*
  Jadz AdCo ShoutOut - app.js v15 clean
  This is a clean rebuild to eliminate the syntax/module-load issue.
*/

import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const ADMIN_EMAILS = ["bans.don@gmail.com", "don.b@jadzholdings.com"];

const FALLBACK_CLUB = {
  name: "Jadz Demo",
  country: "",
  region: "",
  city: "",
  locationLabel: "Shared master demo",
  brand: "JADZ Ad Co",
  defaultMain: "DOWNLOAD THE SHOUT OUT APP",
  defaultSub: "",
  dj: "Jadz AdCo",
  schedule: {},
  templates: ["neon", "birthday", "vip"]
};

const FALLBACK_TEMPLATES = {
  neon: { id: "neon", name: "Neon ShoutOut", scope: "Shared", className: "neon" },
  birthday: { id: "birthday", name: "Birthday Glow", scope: "Shared", className: "neon" },
  vip: { id: "vip", name: "VIP Table", scope: "Shared", className: "gold" },
  bottle: { id: "bottle", name: "Bottle Service", scope: "Club", className: "fire" },
  gold: { id: "gold", name: "Gold Celebration", scope: "Shared", className: "gold" },
  ice: { id: "ice", name: "Ice Blue", scope: "Club", className: "ice" },
  fire: { id: "fire", name: "Fire Night", scope: "Club", className: "fire" },
  latin: { id: "latin", name: "Latin Night", scope: "Club", className: "gold" },
  hiphop: { id: "hiphop", name: "Hip Hop Night", scope: "Club", className: "fire" }
};

const SEED_CLUBS = {
  "zebbies-garden": { name: "Zebbies Garden", country: "United States", region: "District of Columbia", city: "Washington", locationLabel: "Washington, District of Columbia, United States", brand: "ZEBBIES GARDEN x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ZEBBIES", defaultSub: "", dj: "DJ Nova", schedule: { Monday: "Hip Hop", Wednesday: "EDM", Friday: "Afro Beats", Saturday: "International" }, templates: ["birthday", "vip", "bottle", "neon"], active: true },
  "st-yves": { name: "St. Yves", country: "United States", region: "District of Columbia", city: "Washington", locationLabel: "Washington, District of Columbia, United States", brand: "ST. YVES x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ST. YVES", defaultSub: "", dj: "DJ Saint", schedule: { Thursday: "EDM", Friday: "Hip Hop", Saturday: "International" }, templates: ["vip", "gold", "birthday", "neon"], active: true },
  "abigail": { name: "Abigail", country: "Spain", region: "Catalonia", city: "Barcelona", locationLabel: "Barcelona, Spain", brand: "ABIGAIL x JADZ ADCO", defaultMain: "USE SHOUT OUT @ ABIGAIL", defaultSub: "", dj: "DJ Luna", schedule: { Tuesday: "Latin", Thursday: "Cuban", Saturday: "EDM", Sunday: "International" }, templates: ["latin", "birthday", "vip", "ice"], active: true },
  "heist": { name: "Heist", country: "United States", region: "Georgia", city: "Atlanta", locationLabel: "Atlanta, Georgia, United States", brand: "HEIST x JADZ ADCO", defaultMain: "USE SHOUT OUT @ HEIST", defaultSub: "", dj: "DJ Cipher", schedule: { Monday: "Hip Hop", Friday: "Afro Beats", Saturday: "Hip Hop" }, templates: ["hiphop", "birthday", "bottle", "fire"], active: true },
  "decades": { name: "Decades", country: "United States", region: "California", city: "Los Angeles", locationLabel: "Los Angeles, California, United States", brand: "DECADES x JADZ ADCO", defaultMain: "USE SHOUT OUT @ DECADES", defaultSub: "", dj: "DJ Era", schedule: { Wednesday: "EDM", Friday: "Latin", Saturday: "International" }, templates: ["neon", "vip", "gold", "birthday"], active: true }
};

let currentUser = null;
let selectedClubId = null;
let selectedTemplate = "neon";
let confirmationResult = null;
let clubs = {};
let templates = { ...FALLBACK_TEMPLATES };
let pendingDirectClub = "";

function byId(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}

function setStatus(text) {
  setText("authStatus", text);
}

function qs(name, fallback = "") {
  return new URL(window.location.href).searchParams.get(name) || fallback;
}

function clubId() {
  return (selectedClubId || qs("club", "jadz")).toLowerCase();
}

function getClub(id = clubId()) {
  return clubs[id] || FALLBACK_CLUB;
}

function getTemplate(id = selectedTemplate) {
  return templates[id] || FALLBACK_TEMPLATES.neon;
}

function safeEmail() {
  return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase();
}

function isAdmin() {
  return !!currentUser && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(safeEmail());
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  byId(id)?.classList.add("active");
}

async function loadTemplates() {
  templates = { ...FALLBACK_TEMPLATES };
  try {
    const snap = await getDocs(collection(db, "templates"));
    snap.forEach(item => {
      templates[item.id] = { id: item.id, ...item.data() };
    });
  } catch (error) {
    console.warn("Using fallback templates:", error.message);
  }
}

async function loadClubs() {
  clubs = {};
  try {
    const q = query(collection(db, "clubs"), where("active", "==", true), orderBy("name", "asc"));
    const snap = await getDocs(q);
    snap.forEach(item => {
      clubs[item.id] = { id: item.id, ...item.data() };
    });
  } catch (error) {
    console.warn("Could not load Firestore clubs:", error.message);
  }

  if (Object.keys(clubs).length === 0) {
    clubs = { ...SEED_CLUBS };
  }
}

async function loadClubById(id) {
  if (clubs[id]) return clubs[id];

  try {
    const snap = await getDoc(doc(db, "clubs", id));
    if (snap.exists()) {
      clubs[id] = { id: snap.id, ...snap.data() };
      return clubs[id];
    }
  } catch (error) {
    console.warn("Could not load club:", id, error.message);
  }

  return FALLBACK_CLUB;
}

function updateLoginUI(user) {
  setText("signedInAs", user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in");

  if (user) {
    byId("signedInActions")?.classList.remove("hidden");
    byId("loginActions")?.classList.add("hidden");
  } else {
    byId("signedInActions")?.classList.add("hidden");
    byId("loginActions")?.classList.remove("hidden");
  }
}

function setupAuthWatcher() {
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    updateLoginUI(user);

    if (user) {
      await continueAfterLogin();
    }
  });
}

async function loginGoogle() {
  try {
    setStatus("Opening Google sign-in...");
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Google sign-in error:", error);
    setStatus(`${error.code || "error"}: ${error.message}`);
  }
}

async function loginFacebook() {
  try {
    setStatus("Opening Facebook sign-in...");
    await signInWithPopup(auth, new FacebookAuthProvider());
  } catch (error) {
    console.error("Facebook sign-in error:", error);
    setStatus(`${error.code || "error"}: ${error.message}`);
  }
}

async function loginMicrosoft() {
  try {
    setStatus("Opening Microsoft sign-in...");
    const provider = new OAuthProvider("microsoft.com");
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Microsoft sign-in error:", error);
    setStatus(`${error.code || "error"}: ${error.message}`);
  }
}

async function logout() {
  await signOut(auth);
  window.location.href = "./";
}

function setupPhoneAuth() {
  if (!byId("recaptcha-container") || window.recaptchaVerifier) return;
  window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" });
}

async function sendPhoneCode() {
  try {
    setupPhoneAuth();
    const phone = byId("phoneNumber").value.trim();
    if (!phone.startsWith("+")) {
      setStatus("Use international format, for example +12025550123.");
      return;
    }
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    setStatus("Code sent. Enter it below.");
    byId("phoneCodeBlock")?.classList.remove("hidden");
  } catch (error) {
    console.error("Phone sign-in error:", error);
    setStatus(`${error.code || "error"}: ${error.message}`);
  }
}

async function verifyPhoneCode() {
  try {
    if (!confirmationResult) {
      setStatus("Send the OTP first.");
      return;
    }
    const code = byId("phoneCode").value.trim();
    await confirmationResult.confirm(code);
    setStatus("Phone verified.");
  } catch (error) {
    console.error("OTP verification error:", error);
    setStatus(`${error.code || "error"}: ${error.message}`);
  }
}

async function continueAfterLogin() {
  await loadTemplates();
  await loadClubs();

  if (pendingDirectClub) {
    const club = await loadClubById(pendingDirectClub);
    selectedClubId = pendingDirectClub;
    showClubSelection();

    const notice = byId("qrForwardNotice");
    if (notice) {
      notice.classList.remove("hidden");
      notice.textContent = `QR code detected. Routing to ${club.name}.`;
    }

    setTimeout(() => selectClub(pendingDirectClub), 600);
    return;
  }

  showClubSelection();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))].sort();
}

function populateFilters() {
  const countryFilter = byId("countryFilter");
  const cityFilter = byId("cityFilter");
  const dayFilter = byId("dayFilter");
  const genreFilter = byId("genreFilter");
  if (!countryFilter || !cityFilter || !dayFilter || !genreFilter) return;

  countryFilter.innerHTML = '<option value="">All countries</option>';
  cityFilter.innerHTML = '<option value="">All locations</option>';
  dayFilter.innerHTML = '<option value="">Any day</option>';
  genreFilter.innerHTML = '<option value="">All genres</option>';

  unique(Object.values(clubs).map(c => c.country)).forEach(x => countryFilter.append(new Option(x, x)));
  unique(Object.values(clubs).map(c => c.locationLabel)).forEach(x => cityFilter.append(new Option(x, x)));
  unique(Object.values(clubs).flatMap(c => Object.keys(c.schedule || {}))).forEach(x => dayFilter.append(new Option(x, x)));
  unique(Object.values(clubs).flatMap(c => Object.values(c.schedule || {}))).forEach(x => genreFilter.append(new Option(x, x)));
}

function bindFilters() {
  ["clubSearch", "countryFilter", "cityFilter", "dayFilter", "genreFilter"].forEach(id => {
    const el = byId(id);
    if (el && !el.dataset.bound) {
      el.addEventListener("input", renderClubGrid);
      el.addEventListener("change", renderClubGrid);
      el.dataset.bound = "1";
    }
  });
}

function showClubSelection() {
  showPage("clubPage");
  populateFilters();
  bindFilters();
  renderClubGrid();
}

function renderClubGrid() {
  const grid = byId("clubGrid");
  if (!grid) return;

  const search = (byId("clubSearch")?.value || "").toLowerCase();
  const country = byId("countryFilter")?.value || "";
  const location = byId("cityFilter")?.value || "";
  const day = byId("dayFilter")?.value || "";
  const genre = byId("genreFilter")?.value || "";

  const matches = Object.entries(clubs).filter(([id, club]) => {
    const scheduleText = Object.entries(club.schedule || {}).map(([d, g]) => `${d} ${g}`).join(" ");
    const haystack = `${club.name} ${club.country} ${club.region} ${club.city} ${club.locationLabel} ${club.dj} ${scheduleText}`.toLowerCase();

    return (!search || haystack.includes(search)) &&
      (!country || club.country === country) &&
      (!location || club.locationLabel === location) &&
      (!day || Object.keys(club.schedule || {}).includes(day)) &&
      (!genre || Object.values(club.schedule || {}).includes(genre));
  });

  grid.innerHTML = matches.length ? "" : "<div class='empty'>No matching clubs found.</div>";

  matches.forEach(([id, club]) => {
    const card = document.createElement("div");
    card.className = "club-option";
    card.innerHTML = `
      <div>
        <div class="club-option-head">
          <div>
            <h3>${escapeHTML(club.name)}</h3>
            <p>${escapeHTML(club.locationLabel)}</p>
          </div>
          <strong>${escapeHTML(club.country || "")}</strong>
        </div>
        <p class="dj">Resident: ${escapeHTML(club.dj || "")}</p>
        <div class="badge-row">
          ${Object.entries(club.schedule || {}).map(([d, g]) => `<span>${escapeHTML(d)} · ${escapeHTML(g)}</span>`).join("")}
        </div>
      </div>
      <button class="primary" type="button">Select Club</button>
    `;
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

function showTemplateSelection() {
  renderTemplates();
  updateTemplateSummary();
  showPage("templateSelectPage");
}

function renderTemplates() {
  const grid = byId("templateGrid");
  if (!grid) return;

  grid.innerHTML = "";

  (getClub().templates || ["neon"]).forEach(templateId => {
    const template = getTemplate(templateId);
    const item = document.createElement("div");
    item.className = `template ${template.className || "neon"} ${template.id === selectedTemplate ? "selected" : ""}`;
    item.innerHTML = `
      <div class="name">${escapeHTML(template.name)}</div>
      <div class="tag">${escapeHTML(template.scope || "Shared")} template</div>
    `;
    item.addEventListener("click", () => {
      selectedTemplate = template.id;
      renderTemplates();
      updateTemplateSummary();
    });
    grid.appendChild(item);
  });
}

function updateTemplateSummary() {
  const template = getTemplate();
  const box = byId("selectedTemplateSummary");
  if (box) {
    box.innerHTML = `<h3>${escapeHTML(template.name)}</h3><p>${escapeHTML(template.scope || "Shared")} template selected.</p>`;
  }
}

function goToEditor() {
  const club = getClub();
  const template = getTemplate();
  setText("editorClubTitle", club.name);
  setText("editorTemplateMeta", `${club.locationLabel} • Template: ${template.name}`);
  updatePreview();
  showPage("editorPage");
}

function displayUrl(payload, id = clubId()) {
  const url = new URL("./display.html", window.location.href);
  url.searchParams.set("club", id);
  if (payload) {
    url.searchParams.set("main", payload.mainText || "");
    url.searchParams.set("sub", payload.subText || "");
    url.searchParams.set("template", payload.template || "neon");
    url.searchParams.set("media", payload.mediaUrl || "");
  }
  return url.href;
}

function updatePreview() {
  const frame = byId("previewFrame");
  if (!frame) return;

  frame.src = displayUrl({
    mainText: byId("mainText")?.value.trim() || "SHOUTOUT!",
    subText: byId("subText")?.value.trim() || "",
    mediaUrl: byId("mediaUrl")?.value.trim() || "",
    template: selectedTemplate
  }, clubId());
}

async function submitShoutout() {
  const status = byId("submitStatus");

  try {
    if (!currentUser) {
      if (status) status.textContent = "Sign in first.";
      return;
    }

    if (!selectedClubId) {
      if (status) status.textContent = "Select a club first.";
      return;
    }

    const club = getClub();
    const template = getTemplate();
    const payload = {
      club: clubId(),
      clubName: club.name,
      country: club.country || "",
      city: club.city || "",
      locationLabel: club.locationLabel || "",
      template: selectedTemplate,
      templateName: template.name,
      mainText: byId("mainText").value.trim() || "SHOUTOUT!",
      subText: byId("subText").value.trim() || "",
      mediaUrl: byId("mediaUrl").value.trim(),
      status: "pending",
      submittedBy: safeEmail(),
      submittedAt: serverTimestamp(),
      referenceNumber: `SO-${Date.now().toString().slice(-7)}`
    };

    await addDoc(collection(db, "shoutouts"), payload);

    setText("confirmRef", payload.referenceNumber);
    setText("confirmClub", club.name);
    setText("confirmTemplate", template.name);
    showPage("confirmationPage");
  } catch (error) {
    console.error("Submit error:", error);
    if (status) status.textContent = error.message;
  }
}

function startAnother() {
  byId("mainText").value = "HAPPY BIRTHDAY MAYA!";
  byId("subText").value = "VIP Table 4 sends love";
  byId("mediaUrl").value = "";
  showTemplateSelection();
}

function bind(id, fn) {
  byId(id)?.addEventListener("click", fn);
}

function initClientPortal() {
  pendingDirectClub = qs("club", "");
  setStatus("App loaded. Choose a sign-in option.");
  setupAuthWatcher();

  bind("googleLoginBtn", loginGoogle);
  bind("facebookLoginBtn", loginFacebook);
  bind("microsoftLoginBtn", loginMicrosoft);
  bind("sendOtpBtn", sendPhoneCode);
  bind("verifyOtpBtn", verifyPhoneCode);
  bind("continueBtn", continueAfterLogin);

  ["logoutBtn1", "logoutBtn2", "logoutBtn3", "logoutBtn4", "logoutBtn5"].forEach(id => bind(id, logout));
  bind("backToClubsBtn", showClubSelection);
  bind("backToTemplatesBtn", showTemplateSelection);
  bind("goToEditorBtn", goToEditor);
  bind("submitShoutoutBtn", submitShoutout);
  bind("startAnotherBtn", startAnother);
  bind("chooseAnotherClubBtn", showClubSelection);

  ["mainText", "subText", "mediaUrl"].forEach(id => byId(id)?.addEventListener("input", updatePreview));
}

window.addEventListener("DOMContentLoaded", initClientPortal);
console.log("Jadz ShoutOut app.js v15 loaded");
