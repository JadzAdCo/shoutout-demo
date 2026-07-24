/* global-profile-status.js v29.09.45 */
(function(){
  "use strict";
  if (window.__FLOQR_GLOBAL_PROFILE_STATUS__) return;
  window.__FLOQR_GLOBAL_PROFILE_STATUS__ = true;
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
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
    shell.innerHTML = `<button id="floqrGlobalProfileBtn" class="user-menu-btn" type="button" aria-label="Profile status"><span class="avatar-circle">?</span><span class="menu-dots">&#8226;&#8226;&#8226;</span></button><div id="floqrGlobalProfileDropdown" class="user-dropdown hidden"></div>`;
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
    button.querySelector(".avatar-circle").innerHTML = badge;
    if (!user) {
      dropdown.innerHTML = `<strong>Not signed in</strong><a class="profile-menu-link" href="./index.html">Sign in</a>`;
      return;
    }
    const c = await counts(db, user.uid);
    dropdown.innerHTML = `<strong>${esc(profile.displayName || user.displayName || user.email || "FLOQR Member")}</strong>
      <small>${esc(user.email || "")}</small>
      <a class="profile-menu-link" href="./patron-portal.html?tab=profile&v=29.09.8">My Profile and Settings</a>
      <a class="profile-menu-link" href="./patron-portal.html?tab=messages&v=29.09.8">FloqR Inbox (${esc(c.messages)})</a>
      <a class="profile-menu-link" href="./mingl-chat.html?v=29.09.9&from=portal">Mingl Chat (${esc(c.chats)})</a>
      <a class="profile-menu-link" href="./commerce.html?v=29.09.9&from=search">BartR</a>
      <a class="profile-menu-link" href="./rydr.html?v=29.09.9&from=search">RydR</a>
      <a class="profile-menu-link" href="./?v=29.09.39&start=intent">FloqAi</a>
      <button id="floqrGlobalSignOutBtn" type="button">Sign out</button>`;
    dropdown.querySelector("#floqrGlobalSignOutBtn")?.addEventListener("click", () => firebase.auth().signOut());
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
    firebase.auth().onAuthStateChanged(render);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
