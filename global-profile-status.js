/* global-profile-status.js — translated profile pill; admin hubs open patron apps in a new tab;
   feature links follow Features & Services (FLOQRFeatureServices.linkState).
   Inbox counts = non-deleted inboxNotifications + messages by recipientUid (match Search menu).
   Menu closes on in-card nav / pageshow; never toggles open until content is rendered. */
(function(){
  "use strict";
  if (window.__FLOQR_GLOBAL_PROFILE_STATUS__) return;
  window.__FLOQR_GLOBAL_PROFILE_STATUS__ = true;

  let lastUser;
  let menuReady = false;
  let renderToken = 0;

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
  let featureServicesLoading = null;
  function ensureFeatureServices() {
    if (window.FLOQRFeatureServices) return Promise.resolve(window.FLOQRFeatureServices);
    if (featureServicesLoading) return featureServicesLoading;
    featureServicesLoading = new Promise(resolve => {
      const script = document.createElement("script");
      const v = window.FLOQRNav?.appVersion || "";
      script.src = `./floqr-feature-services.js${v ? `?v=${encodeURIComponent(v)}` : ""}`;
      script.onload = () => resolve(window.FLOQRFeatureServices || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return featureServicesLoading;
  }
  // Feature links render hidden and stay hidden unless Features & Services allows them (fail closed).
  function featureLink(key, href, label, blank) {
    return `<a class="profile-menu-link hidden" hidden aria-hidden="true" data-floqr-feature-link="${esc(key)}" href="${esc(href)}"${blank}>${esc(label)}</a>`;
  }
  async function applyFeatureLinks(dropdown, db, user, profile) {
    const fs = await ensureFeatureServices();
    if (!fs?.linkState || !dropdown.isConnected) return;
    await fs.ensureLoaded({db, user, profile});
    fs.applyFeatureLinks(dropdown);
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
    shell.innerHTML = `<button id="floqrGlobalProfileBtn" class="user-menu-btn" type="button" aria-label="${esc(t("profile.menu.ariaLabel", "Profile status"))}" aria-expanded="false"><span class="avatar-circle">?</span><span class="menu-dots">&#8226;&#8226;&#8226;</span></button><div id="floqrGlobalProfileDropdown" class="user-dropdown hidden" aria-hidden="true"></div>`;
    document.body.appendChild(shell);
    return shell;
  }
  function dropdownEl() {
    return document.getElementById("floqrGlobalProfileDropdown");
  }
  function closeDropdown() {
    const dropdown = dropdownEl();
    if (!dropdown) return;
    dropdown.classList.add("hidden");
    dropdown.setAttribute("aria-hidden", "true");
    const btn = document.getElementById("floqrGlobalProfileBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function openDropdown() {
    const dropdown = dropdownEl();
    if (!dropdown || !menuReady || !dropdownHasContent(dropdown)) return false;
    dropdown.classList.remove("hidden");
    dropdown.setAttribute("aria-hidden", "false");
    const btn = document.getElementById("floqrGlobalProfileBtn");
    if (btn) btn.setAttribute("aria-expanded", "true");
    return true;
  }
  function dropdownHasContent(dropdown) {
    if (!dropdown) return false;
    return !!(dropdown.querySelector("strong") || dropdown.querySelector(".profile-menu-link") || dropdown.querySelector("button"));
  }
  async function counts(db, uid){
    const out = {messages:"0/0", chats:"0/0"};
    if (!db || !uid) return out;
    try {
      // Match Search + portal inbox: recipientUid rows that are not soft-deleted (dedupe by id).
      const seen = new Set();
      let unread = 0;
      let total = 0;
      const tally = (snap) => {
        snap.forEach(doc => {
          if (!doc?.id || seen.has(doc.id)) return;
          const data = doc.data() || {};
          if (data.deleted) return;
          seen.add(doc.id);
          total += 1;
          if (!data.read) unread += 1;
        });
      };
      tally(await db.collection("inboxNotifications").where("recipientUid","==",uid).limit(80).get());
      try { tally(await db.collection("messages").where("recipientUid","==",uid).limit(80).get()); } catch (_) {}
      out.messages = `${unread}/${total}`;
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
    const token = ++renderToken;
    menuReady = false;
    let profile = {};
    const db = window.firebase?.firestore ? firebase.firestore() : null;
    if (user && db) {
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        profile = snap.exists ? snap.data() : {};
      } catch(e) {}
    }
    if (token !== renderToken) return;
    const photo = profile.photoURL || user?.photoURL || "";
    const badge = photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(user, profile));
    const avatar = button?.querySelector(".avatar-circle");
    if (avatar) avatar.innerHTML = badge;
    if (!user) {
      dropdown.innerHTML = `<strong>${esc(t("profile.menu.notSignedIn", "Not signed in"))}</strong><a class="profile-menu-link" href="./index.html">${esc(t("portal.signInTitle", "Sign in"))}</a>`;
      menuReady = true;
      // Soft sign-out on satellite pages: keep Site chrome on last-used paint.
      try {
        window.FLOQRChromeScheme?.syncFromStorage?.({force: true});
        window.dispatchEvent(new CustomEvent("floqr:auth-signed-out"));
      } catch (_) {}
      return;
    }
    const c = await counts(db, user.uid);
    if (token !== renderToken) return;
    const blank = patronLinkAttrs();
    const hint = isAdminHub()
      ? `<p class="sub small profile-admin-patron-hint">${esc(t("profile.menu.adminPatronHint", "A new tab / new window is opening. The admin portal will stay open on this browser session. Please hold."))}</p>`
      : "";
    dropdown.innerHTML = `<strong>${esc(profile.displayName || user.displayName || user.email || t("profile.menu.member", "FLOQR Member"))}</strong>
      <small>${esc(user.email || "")}</small>
      ${hint}
      <a class="profile-menu-link" href="${esc(hrefPortal("profile"))}"${blank}>${esc(t("portal.title", "My Profile and Settings"))}</a>
      <a class="profile-menu-link" href="${esc(hrefPortal("inbox"))}"${blank}>${esc(t("nav.inbox", "FloqR Inbox"))} (${esc(c.messages)})</a>
      ${featureLink("mingl", hrefMingl(), `${t("nav.minglChat", "Mingl Chat")} (${c.chats})`, blank)}
      ${featureLink("bartr", hrefStamp("./commerce.html", { from: "search" }), t("nav.bartr", "BartR"), blank)}
      ${featureLink("rydr", hrefStamp("./rydr.html", { from: "search" }), t("cat.rydr", "RydR"), blank)}
      ${featureLink("floqCast", hrefStamp("./floqcast-search.html", { from: "search" }), t("cat.floqcast", "floqCast"), blank)}
      ${featureLink("vipReservations", hrefStamp("./vip.html", { from: "search" }), t("cat.vipreserv", "VIP reserV"), blank)}
      ${featureLink("floqAi", hrefFloqAi(), t("cat.floqai", "FloqAi"), blank)}
      <button id="floqrGlobalSignOutBtn" type="button">${esc(t("app.signOut", "Sign out"))}</button>`;
    dropdown.querySelector("#floqrGlobalSignOutBtn")?.addEventListener("click", () => {
      closeDropdown();
      firebase.auth().signOut();
    });
    menuReady = true;
    applyFeatureLinks(dropdown, db, user, profile).catch(error => console.warn("Profile menu feature links", error?.message || error));
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
  function ensureAuth() {
    try {
      const fb = window.firebase;
      if (!fb || typeof fb.auth !== "function") return null;
      // Satellite pages (e.g. beta-invite) load firebase-config without initializeApp — do it here.
      if (!fb.apps?.length && window.firebaseConfig) fb.initializeApp(window.firebaseConfig);
      return fb.auth();
    } catch (error) {
      console.warn("Global profile status: Firebase Auth unavailable", error?.message || error);
      return null;
    }
  }
  async function toggleDropdown(event) {
    event?.stopPropagation?.();
    const dropdown = dropdownEl();
    if (!dropdown) return;
    const willOpen = dropdown.classList.contains("hidden");
    if (!willOpen) {
      closeDropdown();
      return;
    }
    if (!menuReady || !dropdownHasContent(dropdown)) {
      closeDropdown();
      if (lastUser !== undefined) await render(lastUser);
      if (!menuReady || !dropdownHasContent(dropdownEl())) return;
    }
    openDropdown();
  }
  function init(){
    // The patron landing page owns its richer profile menu; avoid stacking a second global button on top of it.
    if (document.getElementById("userMenu")) return;
    const auth = ensureAuth();
    if (!auth) return;
    const shell = ensureShell();
    shell.querySelector("#floqrGlobalProfileBtn")?.addEventListener("click", event => {
      void toggleDropdown(event);
    });
    document.addEventListener("click", event => {
      if (!shell.contains(event.target)) closeDropdown();
    });
    shell.addEventListener("click", event => {
      const link = event.target?.closest?.(".profile-menu-link");
      if (!link || !shell.contains(link)) return;
      // Close before navigation so bfcache / return home never restores an open empty card.
      closeDropdown();
      if (isAdminHub() && link.getAttribute("target") === "_blank") warnAdminPatronTab();
    });
    window.addEventListener("floqr:ui-language", () => {
      if (lastUser !== undefined) render(lastUser);
    });
    window.addEventListener("pageshow", () => {
      closeDropdown();
      try { window.FLOQRChromeScheme?.syncFromStorage?.(); } catch (_) {}
      if (lastUser !== undefined) void render(lastUser);
    });
    window.addEventListener("floqr:auth-signed-out", () => {
      closeDropdown();
      try { window.FLOQRChromeScheme?.syncFromStorage?.({force: true}); } catch (_) {}
    });
    auth.onAuthStateChanged(user => {
      lastUser = user || null;
      closeDropdown();
      render(user);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
