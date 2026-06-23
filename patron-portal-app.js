/* patron-portal-app.js v28 */
(function(){
  "use strict";
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmtDate = value => {
    if (!value) return "—";
    const d = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return isNaN(d) ? "—" : d.toLocaleDateString();
  };

  if (!window.firebaseConfig) { setText("portalStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  let currentProfile = {};

  function bind(id, fn) { byId(id)?.addEventListener("click", fn); }

  function setupTabs() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
        document.querySelectorAll(".admin-panel-section").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        byId(btn.dataset.panel)?.classList.add("active");
      });
    });
    const tab = new URL(window.location.href).searchParams.get("tab");
    if (tab) {
      const map = {messages:"portalMessages", chats:"portalChats", profile:"portalProfile"};
      const btn = document.querySelector(`[data-panel='${map[tab] || ""}']`);
      if (btn) btn.click();
    }
  }

  async function loginGoogle() {
    try { setText("portalStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("portalStatus", `${e.code || "error"}: ${e.message}`); }
  }

  async function logout() { await auth.signOut(); window.location.href = "./?v=28.7"; }

  async function getCollectionSafe(name, filterFn, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) { return []; }
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  }

  function fillProfileForm(profile, user) {
    byId("editFirstName").value = profile.firstName || "";
    byId("editLastName").value = profile.lastName || "";
    byId("editDisplayName").value = profile.displayName || user.displayName || "";
    byId("editPhone").value = profile.phone || user.phoneNumber || "";
    byId("editCity").value = profile.city || "";
    byId("editCountry").value = profile.country || "";
    byId("editLanguage").value = profile.preferredLanguage || "";
    byId("editInstagram").value = profile.instagramHandle || "";
    byId("editX").value = profile.xHandle || "";
    byId("privacyMarketing").checked = !!profile.marketingConsent;
    byId("privacyAnalytics").checked = !!profile.analyticsConsent;
    byId("privacySharing").checked = !!profile.dataSharingConsent;
  }

  async function saveProfile() {
    const user = auth.currentUser;
    if (!user) return;
    const updates = {
      firstName: byId("editFirstName").value.trim(),
      lastName: byId("editLastName").value.trim(),
      displayName: byId("editDisplayName").value.trim(),
      phone: byId("editPhone").value.trim(),
      city: byId("editCity").value.trim(),
      country: byId("editCountry").value.trim(),
      preferredLanguage: byId("editLanguage").value,
      instagramHandle: byId("editInstagram").value.trim(),
      xHandle: byId("editX").value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    updates.fullName = `${updates.firstName} ${updates.lastName}`.trim();
    await db.collection("users").doc(user.uid).set(updates, {merge:true});
    setText("portalStatus", "Profile updated.");
    await loadPortal(user);
  }

  async function savePrivacy() {
    const user = auth.currentUser;
    if (!user) return;
    const prefs = {
      marketingConsent: byId("privacyMarketing").checked,
      analyticsConsent: byId("privacyAnalytics").checked,
      dataSharingConsent: byId("privacySharing").checked,
      privacyUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("users").doc(user.uid).set(prefs, {merge:true});
    await db.collection("privacyConsents").add({uid:user.uid, email:user.email || "", ...prefs, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
    setText("portalStatus", "Privacy preferences saved.");
    await loadPortal(user);
  }

  function downloadData() {
    const blob = new Blob([JSON.stringify(currentProfile, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jadz-patron-data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function requestDelete() {
    const user = auth.currentUser;
    if (!user || !confirm("Request deletion of your patron data?")) return;
    await db.collection("privacyConsents").add({type:"deleteRequest", uid:user.uid, email:user.email || "", requestedAt: firebase.firestore.FieldValue.serverTimestamp(), status:"pending"});
    setText("portalStatus", "Data delete request submitted.");
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
    setText("portalAccountName", profile.displayName || user.displayName || user.email || "Patron");
    setText("portalAccountEmail", user.email || "");
    setText("metricMemberLevel", profile.memberLevel || "Patron");
    setText("metricMemberSince", fmtDate(profile.createdAt));

    const [shoutouts, guestLists, messages, chats] = await Promise.all([
      getCollectionSafe("shoutouts", x => x.submittedByUid === user.uid || x.submittedBy === user.email),
      getCollectionSafe("guestListRequests", x => x.submittedByUid === user.uid || x.guestEmail === user.email),
      getCollectionSafe("messages", x => x.recipientUid === user.uid || x.senderUid === user.uid || x.recipientEmail === user.email || x.senderEmail === user.email),
      getCollectionSafe("chatRooms", x => Array.isArray(x.participants) && x.participants.includes(user.uid))
    ]);

    const unreadMessages = messages.filter(x => (x.recipientUid === user.uid || x.recipientEmail === user.email) && !x.read).length;
    const unreadChats = chats.reduce((sum,x) => sum + Number(x.unreadCounts?.[user.uid] || 0), 0);

    setText("metricMessages", `${unreadMessages}/${messages.length}`);
    setText("metricChats", `${unreadChats}/${chats.length}`);
    setText("messageCountLabel", `(${unreadMessages}/${messages.length})`);
    setText("chatCountLabel", `(${unreadChats}/${chats.length})`);

    byId("profileSummary").innerHTML = simpleRows([
      ["Name", profile.fullName || profile.displayName || user.displayName || "—"],
      ["Email", user.email || "—"],
      ["City", profile.city || "—"],
      ["Country", profile.country || "—"],
      ["Preferred Language", profile.preferredLanguage || "—"],
      ["Member Level", profile.memberLevel || "Patron"]
    ]);

    byId("myShoutouts").innerHTML = shoutouts.length ? shoutouts.map(x => `<div class="queue-item"><strong>${esc(x.mainText || "ShoutOut")}</strong><p>${esc(x.locationName || x.clubName || "")} • ${esc(x.status || "pending")}</p><small>${esc(fmtDate(x.submittedAt))}</small></div>`).join("") : "<p class='sub'>No ShoutOuts yet.</p>";
    byId("myGuestLists").innerHTML = guestLists.length ? guestLists.map(x => `<div class="queue-item"><strong>${esc(x.locationName || x.clubLocationId || "Guest List")}</strong><p>${esc(x.eventOrDay || "")} • Party of ${esc(x.partySize || 1)} • ${esc(x.status || "pending")}</p><small>Promoter: ${esc(x.promoterName || x.promoterId || "")}</small></div>`).join("") : "<p class='sub'>No guest list requests yet.</p>";
    byId("myMessages").innerHTML = messages.length ? messages.map(x => `<div class="queue-item"><strong>${esc(x.subject || "Message")}</strong><p>${esc(x.body || x.preview || "")}</p><small>${esc(x.read ? "Read" : "Unread")}</small></div>`).join("") : "<p class='sub'>No messages yet.</p>";
    byId("myChats").innerHTML = chats.length ? chats.map(x => `<div class="queue-item"><strong>${esc(x.title || "Chat")}</strong><p>${esc(x.lastMessage || "")}</p><small>Unread: ${esc(x.unreadCounts?.[user.uid] || 0)}</small></div>`).join("") : "<p class='sub'>No chats yet.</p>";
    byId("privacyReport").innerHTML = simpleRows([["Marketing Consent", profile.marketingConsent ? "Yes" : "No"],["Analytics Consent", profile.analyticsConsent ? "Yes" : "No"],["Data Sharing Consent", profile.dataSharingConsent ? "Yes" : "No"]]);
  }


  async function sendPortalMessage() {
    const user = auth.currentUser;
    if (!user) return;
    const recipientEmail = byId("composeRecipientEmail")?.value.trim().toLowerCase();
    const subject = byId("composeSubject")?.value.trim() || "Message";
    const body = byId("composeBody")?.value.trim();
    if (!recipientEmail || !body) { setText("portalStatus", "Recipient email and message are required."); return; }
    await db.collection("messages").add({type:"patronMessage",senderUid:user.uid,senderEmail:user.email||"",recipientEmail,subject,body,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    setText("portalStatus", "Message sent.");
    byId("composeBody").value = "";
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    bind("portalGoogleLoginBtn", loginGoogle);
    bind("portalLogoutBtn", logout);
    bind("saveProfileBtn", saveProfile);
    bind("savePrivacyBtn", savePrivacy);
    bind("exportDataBtn", downloadData);
    bind("deleteDataBtn", requestDelete);
    bind("sendMessageBtn", sendPortalMessage);

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
