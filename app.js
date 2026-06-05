import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// UPDATE THIS with your real admin email(s).
const ADMIN_EMAILS = ["don.b@jadzholdings.com"];

const CLUBS = {
  "club-a": { name: "Club A", hint: "Downtown demo venue", brand: "CLUB A x JADZ ADCO", defaultMain: "USE SHOUT OUT @ CLUB A", defaultSub: "" },
  "club-b": { name: "Club B", hint: "VIP lounge demo venue", brand: "CLUB B x JADZ ADCO", defaultMain: "USE SHOUT OUT @ CLUB B", defaultSub: "" },
  "jadz": { name: "Jadz Demo", hint: "Shared master demo", brand: "JADZ ADCO", defaultMain: "USE SHOUT OUT", defaultSub: "" }
};
const TEMPLATES = [
  { id: "neon", name: "Neon Birthday", scope: "Shared", className: "neon" },
  { id: "gold", name: "Gold VIP", scope: "Shared", className: "gold" },
  { id: "ice", name: "Ice Bottle Service", scope: "Club-specific", className: "ice" },
  { id: "fire", name: "Fire Celebration", scope: "Club-specific", className: "fire" }
];

let currentUser = null, selectedTemplate = "neon", confirmationResult = null;
function qs(name, fallback = "") { return new URL(window.location.href).searchParams.get(name) || fallback; }
function clubId() { return qs("club", "jadz").toLowerCase(); }
function getClub() { return CLUBS[clubId()] || CLUBS.jadz; }
function safeEmail() { return (currentUser?.email || currentUser?.phoneNumber || "unknown").toLowerCase(); }
function isAdmin() { return !!currentUser && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(safeEmail()); }
function displayUrl(payload) {
  const u = new URL("./display.html", window.location.href);
  u.searchParams.set("club", clubId());
  if (payload) {
    u.searchParams.set("main", payload.mainText || "");
    u.searchParams.set("sub", payload.subText || "");
    u.searchParams.set("template", payload.template || "neon");
    u.searchParams.set("media", payload.mediaUrl || "");
  }
  return u.href;
}
function setupAuthWatcher(afterLogin) {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    const el = document.getElementById("signedInAs");
    if (el) el.textContent = user ? `Signed in as ${user.displayName || user.email || user.phoneNumber}` : "Not signed in";
    if (user && typeof afterLogin === "function") afterLogin(user);
  });
}
async function loginGoogle(){ await signInWithPopup(auth, new GoogleAuthProvider()); }
async function loginFacebook(){ await signInWithPopup(auth, new FacebookAuthProvider()); }
async function loginMicrosoft(){ const p = new OAuthProvider("microsoft.com"); p.setCustomParameters({ prompt: "select_account" }); await signInWithPopup(auth, p); }
async function logout(){ await signOut(auth); location.reload(); }
function setupPhoneAuth(){ if (!document.getElementById("recaptcha-container") || window.recaptchaVerifier) return; window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "normal" }); }
async function sendPhoneCode(){
  try { setupPhoneAuth(); const phone = document.getElementById("phoneNumber").value.trim(); if (!phone.startsWith("+")) { document.getElementById("authStatus").textContent = "Use international format, for example +12025550123."; return; } confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier); document.getElementById("authStatus").textContent = "Code sent. Enter it below."; document.getElementById("phoneCodeBlock").classList.remove("hidden"); }
  catch(e){ document.getElementById("authStatus").textContent = e.message; }
}
async function verifyPhoneCode(){
  try { if (!confirmationResult) { document.getElementById("authStatus").textContent = "Send the OTP first."; return; } await confirmationResult.confirm(document.getElementById("phoneCode").value.trim()); document.getElementById("authStatus").textContent = "Phone verified."; }
  catch(e){ document.getElementById("authStatus").textContent = e.message; }
}
function renderTemplates(){
  const grid = document.getElementById("templateGrid"); if (!grid) return; grid.innerHTML = "";
  TEMPLATES.forEach(t => { const div = document.createElement("div"); div.className = `template ${t.className} ${t.id === selectedTemplate ? "selected" : ""}`; div.innerHTML = `<div class="name">${escapeHTML(t.name)}</div><div class="tag">${escapeHTML(t.scope)}</div>`; div.onclick = () => { selectedTemplate = t.id; renderTemplates(); updatePreview(); }; grid.appendChild(div); });
}
function collectPayload(status = "pending"){
  return { club: clubId(), template: selectedTemplate, mainText: document.getElementById("mainText").value.trim() || "SHOUTOUT!", subText: document.getElementById("subText").value.trim() || "", mediaUrl: document.getElementById("mediaUrl").value.trim(), status, submittedBy: safeEmail(), submittedAt: serverTimestamp() };
}
function updatePreview(){
  const frame = document.getElementById("previewFrame"); if (!frame) return;
  frame.src = displayUrl({ mainText: document.getElementById("mainText")?.value.trim() || "SHOUTOUT!", subText: document.getElementById("subText")?.value.trim() || "", mediaUrl: document.getElementById("mediaUrl")?.value.trim() || "", template: selectedTemplate });
}
async function submitShoutout(){
  const status = document.getElementById("submitStatus");
  try { if (!currentUser) { status.textContent = "Sign in first."; return; } await addDoc(collection(db, "shoutouts"), collectPayload("pending")); status.textContent = "Submitted. Waiting for club admin approval."; }
  catch(e){ status.textContent = e.message; }
}
function initClientPortal(){
  const c = getClub(); document.getElementById("clubName").textContent = c.name; document.getElementById("clubHint").textContent = c.hint;
  setupAuthWatcher(() => { document.getElementById("authCard").classList.add("hidden"); document.getElementById("composer").classList.remove("hidden"); });
  renderTemplates(); updatePreview(); ["mainText","subText","mediaUrl"].forEach(id => document.getElementById(id)?.addEventListener("input", updatePreview));
}
function initAdminPortal(){
  const c = getClub(); document.getElementById("clubName").textContent = c.name;
  setupAuthWatcher(() => { if (isAdmin()) { document.getElementById("adminLogin").classList.add("hidden"); document.getElementById("adminPanel").classList.remove("hidden"); renderAdminQueue(); } else { document.getElementById("adminStatus").textContent = `Signed in as ${safeEmail()}, but this email is not listed in ADMIN_EMAILS in app.js.`; } });
}
function renderAdminQueue(){
  document.getElementById("displayLink").href = `./display.html?club=${clubId()}`; document.getElementById("liveFrame").src = `./display.html?club=${clubId()}`;
  const q = query(collection(db, "shoutouts"), where("club", "==", clubId()), where("status", "==", "pending"), orderBy("submittedAt", "desc"));
  onSnapshot(q, snap => { const list = document.getElementById("queueList"); list.innerHTML = ""; if (snap.empty) { list.innerHTML = `<p class="sub">No pending shoutouts yet.</p>`; return; } snap.forEach(d => { const item = d.data(); const div = document.createElement("div"); div.className = "queue-item"; div.innerHTML = `<strong>${escapeHTML(item.mainText)}</strong><p>${escapeHTML(item.subText || "")}</p><small>Template: ${escapeHTML(item.template || "neon")} • Submitted by: ${escapeHTML(item.submittedBy || "unknown")}</small><div class="queue-actions"><button class="approve">Approve & Push Live</button><button class="reject">Reject</button><a class="buttonlike" target="_blank" rel="noopener" href="${displayUrl(item)}">Preview</a></div>`; div.querySelector(".approve").onclick = () => approveItem(d.id, item); div.querySelector(".reject").onclick = () => rejectItem(d.id); list.appendChild(div); }); }, e => document.getElementById("queueList").innerHTML = `<p class="status">${escapeHTML(e.message)}</p>`);
}
async function approveItem(id, item){
  await setDoc(doc(db, "liveContent", clubId()), { club: clubId(), template: item.template || "neon", mainText: item.mainText || "SHOUTOUT!", subText: item.subText || "", mediaUrl: item.mediaUrl || "", status: "approved", submittedBy: item.submittedBy || "unknown", approvedBy: safeEmail(), approvedAt: serverTimestamp() });
  await deleteDoc(doc(db, "shoutouts", id));
}
async function rejectItem(id){ await deleteDoc(doc(db, "shoutouts", id)); }
function initDisplayPage(){
  const c = getClub(); document.getElementById("displayBrand").textContent = c.brand;
  function render(p){ const canvas = document.getElementById("displayCanvas"); canvas.classList.remove("gold","ice","fire"); if (p.template && p.template !== "neon") canvas.classList.add(p.template); document.getElementById("displayMain").textContent = p.mainText || c.defaultMain; document.getElementById("displaySub").textContent = p.subText || ""; const slot = document.getElementById("mediaSlot"); if (p.mediaUrl) { slot.classList.remove("hidden"); const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(p.mediaUrl); slot.innerHTML = isVideo ? `<video src="${escapeAttr(p.mediaUrl)}" autoplay muted loop playsinline></video>` : `<img src="${escapeAttr(p.mediaUrl)}" alt="ShoutOut media">`; } else { slot.classList.add("hidden"); slot.innerHTML = ""; } }
  if (qs("main", "")) { render({ mainText: qs("main"), subText: qs("sub"), template: qs("template", "neon"), mediaUrl: qs("media", "") }); return; }
  onSnapshot(doc(db, "liveContent", clubId()), snap => snap.exists() ? render(snap.data()) : render({ mainText: c.defaultMain, subText: c.defaultSub, template: "neon", mediaUrl: "" }), e => render({ mainText: "DISPLAY ERROR", subText: e.message, template: "fire", mediaUrl: "" }));
}
function escapeHTML(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function escapeAttr(v){ return escapeHTML(v).replace(/`/g, "&#096;"); }
Object.assign(window, { initClientPortal, initAdminPortal, initDisplayPage, loginGoogle, loginFacebook, loginMicrosoft, logout, sendPhoneCode, verifyPhoneCode, submitShoutout });
