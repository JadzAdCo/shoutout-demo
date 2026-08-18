/* global-profile-status.js s3.0.5 — translated profile pill; admin hubs open patron apps in a new tab */
(function(){
  "use strict";
  if (window.__FLOQR_GLOBAL_PROFILE_STATUS__) return;
  window.__FLOQR_GLOBAL_PROFILE_STATUS__ = true;

  let lastUser;

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function t(key, fallback) {
    try {
      const fn = window.FLOQRI18n?.t;
      if (typeof fn === "function") {
        const out = fn(key);
        if (out && out !== key) return out;
      }
    } catch (_) {}
    return fallback;
  }
  function pageFile() {
    try { return (location.pathname.split("/").pop() || "").toLowerCase(); }
    catch (_) { return ""; }
  }
  function isAdminHub() {
    const file = pageFile();
    return file === "admin.html" || file === "master-admin.html";
  }
  function patronLinkAttrs() {
    return isAdminHub() ? ' target="_blank" rel="noopener noreferrer"' : "";
  }
  function hrefPortal(tab) {
    return window.FLOQRNav?.portalHome?.({ tab }) || `./patron-portal.html?tab=${encodeURIComponent(tab)}`;
  }
  function hrefMingl() {
    return window.FLOQRNav?.portalLink?.("./mingl-chat.html") || "./mingl-chat.html?from=portal";
  }
  function hrefStamp(path, extra) {
    return window.FLOQRNav?.stampCurrentVersion?.(path, extra) || path;
  }
  function hrefFloqAi() {
    return window.FLOQRNav?.intentSearchHome?.() || "./?start=intent";
  }
  function initials(user, profile = {}){
    const name = profile.displayName || user?.displayName || user?.email || "Patron";
    return name.split(/[ @._-]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "P";
  }
  function ensureShell(){
    let shell = document.getElementById("floqrGlobalProfileStatus");
    if (shell) return shell;
    shell = document.createElement("div");
    shell.id = "floqrGlobalProfileStatus";
    shell.className = "user-menu floqr-global-profile-status";
    shell.innerHTML = `<button id="floqrGlobalProfileBtn" class="user-menu-btn" type="button" aria-label="${esc(t("profile.menu.ariaLabel", "Profile status"))}"><span class="avatar-circle">?</span><span class="menu-dots">&#8226;&#8226;&#8226;</span></button><div id="floqrGlobalProfileDropdown" class="user-dropdown hidden"></div>`;
    document.body.appendChild(shell);
    return shell;
  }
  async function counts(db, uid){
    const out = {messages:"0/0", chats:"0/0"};
    if (!db || !uid) return out;
    try {
      const messages = await db.collection("inboxNotifications").where("recipientUid","==",uid).limit(80).get();
      let unread = 0;
      messages.forEach(doc => { if (!doc.data().read) unread += 1; });
      out.messages = `${unread}/${messages.size}`;
    } catch(e) {}
    try {
      const chats = await db.collection("chatRooms").where("participants","array-contains",uid).limit(80).get();
      let unread = 0;
      chats.forEach(doc => { unread += Number(doc.data().unreadCounts?.[uid] || 0); });
      out.chats = `${unread}/${chats.size}`;
    } catch(e) {}
    return out;
  }
  async function render(user){
    const shell = ensureShell();
    const button = shell.querySelector("#floqrGlobalProfileBtn");
    const dropdown = shell.querySelector("#floqrGlobalProfileDropdown");
    const aria = t("profile.menu.ariaLabel", "Profile status");
    if (button) button.setAttribute("aria-label", aria);
    let profile = {};
    const db = window.firebase?.firestore ? firebase.firestore() : null;
    if (user && db) {
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        profile = snap.exists ? snap.data() : {};
      } catch(e) {}
    }
    const photo = profile.photoURL || user?.photoURL || "";
    const badge = photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(user, profile));
    const avatar = button?.querySelector(".avatar-circle");
    if (avatar) avatar.innerHTML = badge;
    if (!user) {
      dropdown.innerHTML = `<strong>${esc(t("profile.menu.notSignedIn", "Not signed in"))}</strong><a class="profile-menu-link" href="./index.html">${esc(t("portal.signInTitle", "Sign in"))}</a>`;
      return;
    }
    const c = await counts(db, user.uid);
    const blank = patronLinkAttrs();
    const hint = isAdminHub()
      ? `<p class="sub small profile-admin-patron-hint">${esc(t("profile.menu.adminPatronHint", "A new tab / new window is opening. The admin portal will stay open on this browser session. Please hold."))}</p>`
      : "";
    dropdown.innerHTML = `<strong>${esc(profile.displayName || user.displayName || user.email || t("profile.menu.member", "FLOQR Member"))}</strong>
      <small>${esc(user.email || "")}</small>
      ${hint}
      <a class="profile-menu-link" href="${esc(hrefPortal("profile"))}"${blank}>${esc(t("portal.title", "My Profile and Settings"))}</a>
      <a class="profile-menu-link" href="${esc(hrefPortal("inbox"))}"${blank}>${esc(t("nav.inbox", "FloqR Inbox"))} (${esc(c.messages)})</a>
      <a class="profile-menu-link" href="${esc(hrefMingl())}"${blank}>${esc(t("nav.minglChat", "Mingl Chat"))} (${esc(c.chats)})</a>
      <a class="profile-menu-link" href="${esc(hrefStamp("./commerce.html", { from: "search" }))}"${blank}>${esc(t("nav.bartr", "BartR"))}</a>
      <a class="profile-menu-link" href="${esc(hrefStamp("./rydr.html", { from: "search" }))}"${blank}>${esc(t("cat.rydr", "RydR"))}</a>
      <a class="profile-menu-link" href="${esc(hrefFloqAi())}"${blank}>${esc(t("cat.floqai", "FloqAi"))}</a>
      <button id="floqrGlobalSignOutBtn" type="button">${esc(t("app.signOut", "Sign out"))}</button>`;
    dropdown.querySelector("#floqrGlobalSignOutBtn")?.addEventListener("click", () => firebase.auth().signOut());
  }
  function warnAdminPatronTab() {
    const feedback = window.FLOQRActionFeedback;
    const title = t("profile.menu.openedTab", "A new tab / new window is opening");
    const body = t("profile.menu.adminPatronHold", "The admin portal will stay open on this browser session. Please hold.");
    if (feedback?.show) {
      feedback.show(title, body, {status: "success"});
      feedback.hide?.(4200);
      return;
    }
    const dropdown = document.getElementById("floqrGlobalProfileDropdown");
    if (!dropdown) return;
    let note = dropdown.querySelector("#floqrAdminTabHoldNote");
    if (!note) {
      note = document.createElement("p");
      note.id = "floqrAdminTabHoldNote";
      note.className = "status profile-admin-tab-hold";
      note.setAttribute("role", "status");
      note.setAttribute("aria-live", "polite");
      dropdown.insertBefore(note, dropdown.querySelector(".profile-menu-link"));
    }
    note.textContent = `${title}. ${body}`;
  }
  function init(){
    if (!window.firebase?.auth) return;
    // The patron landing page owns its richer profile menu; avoid stacking a second global button on top of it.
    if (document.getElementById("userMenu")) return;
    const shell = ensureShell();
    shell.querySelector("#floqrGlobalProfileBtn")?.addEventListener("click", event => {
      event.stopPropagation();
      shell.querySelector("#floqrGlobalProfileDropdown")?.classList.toggle("hidden");
    });
    document.addEventListener("click", event => {
      if (!shell.contains(event.target)) shell.querySelector("#floqrGlobalProfileDropdown")?.classList.add("hidden");
    });
    shell.addEventListener("click", event => {
      const link = event.target?.closest?.(".profile-menu-link");
      if (!link || !isAdminHub() || link.getAttribute("target") !== "_blank") return;
      warnAdminPatronTab();
    });
    window.addEventListener("floqr:ui-language", () => {
      if (lastUser !== undefined) render(lastUser);
    });
    firebase.auth().onAuthStateChanged(user => {
      lastUser = user || null;
      render(user);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
