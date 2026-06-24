/* patron-portal-app.js v28.27-f */
(function(){
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const splitCSV = value => String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  const joinCSV = value => Array.isArray(value) ? value.join(", ") : String(value || "");
  const linkify = value => esc(value).replace(/(https?:\/\/[^\s<]+|\.\/[^\s<]+)/g, match => `<a href="${match}" class="message-inline-link">${match}</a>`);
  const fmtDate = value => {
    if (!value) return "-";
    const d = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return isNaN(d) ? "-" : d.toLocaleString();
  };

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

  if (!window.firebaseConfig) { setText("portalStatus", "firebase-config.js missing window.firebaseConfig."); return; }

  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  let currentProfile = {};
  let currentMessages = [];

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
      const map = {messages:"portalMessages", chats:"portalChats", profile:"portalProfile", public:"portalPublicProfile"};
      const btn = document.querySelector(`[data-panel='${map[tab] || ""}']`);
      if (btn) btn.click();
    }
  }

  async function loginGoogle() {
    try { setText("portalStatus", "Opening Google sign-in..."); await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { setText("portalStatus", `${e.code || "error"}: ${e.message}`); }
  }

  async function logout() { await auth.signOut(); window.location.href = "./?v=28.27-f"; }

  async function getCollectionSafe(name, filterFn, limit=1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(d => ({id:d.id, _collection:name, ...d.data()}));
      return filterFn ? rows.filter(filterFn) : rows;
    } catch(e) { return []; }
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([k,v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div>`;
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
    byId("editProfileType").value = profile.publicProfileType || "patron";
    byId("editProfileVisibility").value = profile.publicProfileVisibility || "followers";
    byId("editMusicInterests").value = joinCSV(profile.musicInterests || profile.favoriteGenres);
    byId("editTravelInterests").value = joinCSV(profile.travelInterests);
    byId("editHobbies").value = joinCSV(profile.hobbies || profile.generalHobbies);
    byId("editNightlifeStyle").value = profile.nightlifeStyle || joinCSV(profile.nightlifeInterests);
    byId("editLookingToMeet").value = profile.lookingToMeet || "";
    byId("editBio").value = profile.bio || "";
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
      publicProfileType: byId("editProfileType").value,
      publicProfileVisibility: byId("editProfileVisibility").value,
      musicInterests: splitCSV(byId("editMusicInterests").value),
      travelInterests: splitCSV(byId("editTravelInterests").value),
      hobbies: splitCSV(byId("editHobbies").value),
      nightlifeStyle: byId("editNightlifeStyle").value.trim(),
      lookingToMeet: byId("editLookingToMeet").value.trim(),
      bio: byId("editBio").value.trim(),
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

  function mediaSlotDefaults(profile) {
    const existing = Array.isArray(profile.profileMediaSlots) ? profile.profileMediaSlots : [];
    return Array.from({length:10}, (_, i) => {
      const previous = existing[i] || {};
      const type = i < 8 ? "image" : "video";
      return {slot:i + 1, type, url:"", storagePath:"", caption:"", ...previous, type};
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

  function renderMediaSlots(profile) {
    const wrap = byId("profileMediaSlots");
    if (!wrap) return;
    const slots = mediaSlotDefaults(profile);
    wrap.innerHTML = slots.map(slot => {
      const accept = slot.type === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp";
      const label = slot.type === "video" ? `Short Video ${slot.slot - 8}` : `Photo ${slot.slot}`;
      const preview = slot.url ? (slot.type === "video" ? `<video src="${esc(slot.url)}" muted loop playsinline></video>` : `<img src="${esc(slot.url)}" alt="${esc(label)}"/>`) : `<span>${esc(label)}</span>`;
      return `<div class="profile-media-slot" data-slot="${slot.slot}">
        <div class="profile-media-preview">${preview}</div>
        <label>${esc(label)}<input class="profile-media-file" type="file" accept="${accept}"/></label>
        <label>Caption<input class="profile-media-caption" value="${esc(slot.caption || "")}" maxlength="60"/></label>
        <input class="profile-media-url" type="hidden" value="${esc(slot.url || "")}"/>
        <input class="profile-media-path" type="hidden" value="${esc(slot.storagePath || "")}"/>
        <button class="primary save-one-media-slot" type="button">Save This Slot</button>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".profile-media-file").forEach(input => input.addEventListener("change", previewSelectedMedia));
    wrap.querySelectorAll(".save-one-media-slot").forEach(button => button.addEventListener("click", () => saveSingleMediaSlot(button.closest(".profile-media-slot"))));
  }

  async function saveMediaSlots() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const slotEls = Array.from(document.querySelectorAll(".profile-media-slot"));
      const slots = [];
      setText("portalStatus", "Saving profile media...");
      for (const slotEl of slotEls) {
        const slot = Number(slotEl.dataset.slot);
        const type = slot <= 8 ? "image" : "video";
        const file = slotEl.querySelector(".profile-media-file")?.files?.[0];
        let url = slotEl.querySelector(".profile-media-url")?.value || "";
        let storagePath = slotEl.querySelector(".profile-media-path")?.value || "";
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
          caption: slotEl.querySelector(".profile-media-caption")?.value.trim() || "",
          updatedAt: new Date().toISOString()
        });
      }
      await db.collection("users").doc(user.uid).set({
        profileMediaSlots: slots,
        profileMediaUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      setText("portalStatus", "Profile media saved.");
      await loadPortal(user);
    } catch(e) {
      setText("portalStatus", mediaUploadErrorMessage(e, user));
    }
  }

  function previewSelectedMedia(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const slotEl = input.closest(".profile-media-slot");
    const preview = slotEl?.querySelector(".profile-media-preview");
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    preview.innerHTML = isVideo ? `<video src="${url}" muted loop playsinline controls></video>` : `<img src="${url}" alt="Selected profile media"/>`;
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
    const caption = slotEl.querySelector(".profile-media-caption")?.value.trim() || "";
    let url = slotEl.querySelector(".profile-media-url")?.value || "";
    let storagePath = slotEl.querySelector(".profile-media-path")?.value || "";
    if (!file && !url) {
      setText("portalStatus", "Choose an image or video first, then save this slot.");
      return;
    }
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
      slots[slotIndex] = {slot:slotNumber, type, url, storagePath, caption, updatedAt:new Date().toISOString()};
      await db.collection("users").doc(user.uid).set({
        profileMediaSlots: slots,
        profileMediaUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      setText("portalStatus", `Profile media slot ${slotNumber} saved.`);
      await loadPortal(user);
    } catch(e) {
      setText("portalStatus", mediaUploadErrorMessage(e, user));
    }
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
    const gallery = media.length ? `<div class="public-profile-gallery">${media.map((item, index) => {
      const mediaEl = item.type === "video" ? `<video src="${esc(item.url)}" muted loop playsinline controls></video>` : `<img src="${esc(item.url)}" alt="Profile gallery ${index + 1}"/>`;
      return `<figure>${mediaEl}<figcaption>${esc(item.caption || (item.type === "video" ? "Short video" : "Photo"))}</figcaption></figure>`;
    }).join("")}</div>` : `<p class="sub small">No public gallery media yet.</p>`;
    byId("profileTemplatePreview").innerHTML = `<article class="public-profile-card profile-${esc(profileType)}">
      <div class="public-profile-hero">${hero}</div>
      <div class="public-profile-body">
        <p class="eyebrow">${esc(ROLE_LABELS[profileType] || "Patron")} Profile</p>
        <h3>${esc(profile.displayName || user.displayName || user.email || "Jadz Member")}</h3>
        <p>${esc(profile.bio || template.headline)}</p>
        <div class="profile-section"><strong>Music</strong>${chips(profile.musicInterests || profile.favoriteGenres)}</div>
        <div class="profile-section"><strong>Travel</strong>${chips(profile.travelInterests)}</div>
        <div class="profile-section"><strong>Hobbies</strong>${chips(profile.hobbies || profile.generalHobbies)}</div>
        <div class="profile-section"><strong>Nightlife Style</strong><p>${esc(profile.nightlifeStyle || "Not added yet.")}</p></div>
        <div class="profile-section"><strong>Looking To Meet</strong><p>${esc(profile.lookingToMeet || "Not added yet.")}</p></div>
      </div>
    </article><section class="public-profile-gallery-wrap"><h3>Image Gallery</h3>${gallery}</section>`;
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
    byId("myMessages").innerHTML = currentMessages.length ? currentMessages.map((x, index) => `<div class="queue-item message-envelope ${x.read ? "read" : "unread"}" data-message-index="${index}">
      <div class="message-envelope-head">
        <strong>${esc(x.subject)}</strong>
        <span>${esc(x.read ? "Read" : "Unread")}</span>
      </div>
      <p><b>Sender:</b> ${esc(x.senderName)}</p>
      <p><b>Timestamp:</b> ${esc(fmtDate(x.createdAt))}</p>
      <div class="message-body hidden">${linkify(x.body)}${x.link ? `<p><a href="${esc(x.link)}" class="buttonlike">Open Related ShoutOut</a></p>` : ""}</div>
    </div>`).join("") : "<p class='sub'>No messages yet.</p>";
    document.querySelectorAll(".message-envelope").forEach(el => {
      el.addEventListener("click", () => openMessage(el, user));
    });
    document.querySelectorAll(".message-envelope a").forEach(a => a.addEventListener("click", event => event.stopPropagation()));
  }

  function shoutoutModifyUrl(item) {
    const url = new URL("./patron-portal.html", window.location.href);
    url.searchParams.set("tab", "shoutouts");
    url.searchParams.set("v", "28.27-f");
    if (item.referenceNumber) url.searchParams.set("ref", item.referenceNumber);
    if (item.id) url.searchParams.set("id", item.id);
    return url.toString();
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
      <li>System notifications are internal inbox messages and use <strong>System Message</strong> as the sender.</li>
      <li>Inbox messages store sender, timestamp, subject, body, read state, and opened/read timestamps.</li>
      <li>Patron-to-patron direct inbox messages are blocked unless the sender is an approved Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress, or Bottle Girl.</li>
      <li>Your current approved role set: <strong>${esc(roles.join(", "))}</strong>.</li>
    </ul>`;
    byId("chatPolicySummary").innerHTML = `<ul>
      <li>Chat is separate from Inbox.</li>
      <li>Master Admin is excluded from member chat.</li>
      <li>Patron-to-patron chat requires mutual follow.</li>
      <li>Role members cannot initiate chat with patrons unless the thread is tied to a patron-originated action such as a payment, guest list request, ShoutOut purchase, reservation, or support question.</li>
      <li>Role-specific chat permissions must be enforced by Firestore rules or a server function before production launch.</li>
    </ul>`;
    byId("composePolicyNote").textContent = canDirect ? "Direct inbox messaging is enabled for your approved role. Patron-originated context should still be used before contacting a patron." : "Direct inbox messaging is disabled for standard Patron accounts. Use Chat after mutual follow when that feature is enabled.";
    byId("sendMessageBtn").disabled = !canDirect;
    byId("composeRecipientEmail").disabled = !canDirect;
    byId("composeSubject").disabled = !canDirect;
    byId("composeBody").disabled = !canDirect;
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
    renderRoleGuide();
    renderPolicies(profile);
    setText("portalAccountName", profile.displayName || user.displayName || user.email || "Patron");
    setText("portalAccountEmail", user.email || "");
    setText("metricMemberLevel", profile.memberLevel || "Patron");
    setText("metricMemberSince", fmtDate(profile.createdAt));

    const [shoutouts, guestLists, directMessages, inboxNotifications, chats] = await Promise.all([
      getCollectionSafe("shoutouts", x => x.submittedByUid === user.uid || x.submittedBy === user.email),
      getCollectionSafe("guestListRequests", x => x.submittedByUid === user.uid || x.guestEmail === user.email),
      getCollectionSafe("messages", x => x.recipientUid === user.uid || x.senderUid === user.uid || x.recipientEmail === user.email || x.senderEmail === user.email),
      getCollectionSafe("inboxNotifications", x => x.recipientUid === user.uid || x.recipientEmail === user.email),
      getCollectionSafe("chatRooms", x => Array.isArray(x.participants) && x.participants.includes(user.uid))
    ]);

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
      ["Preferred Language", profile.preferredLanguage || "-"],
      ["Member Level", profile.memberLevel || "Patron"],
      ["Public Profile", ROLE_LABELS[profile.publicProfileType || "patron"]],
      ["Visibility", profile.publicProfileVisibility || "followers"]
    ]);

    byId("myShoutouts").innerHTML = shoutouts.length ? shoutouts.map(x => {
      const canModify = x.editable !== false && String(x.status || "pending").toLowerCase() === "pending";
      return `<div class="queue-item ${new URL(window.location.href).searchParams.get("ref") === x.referenceNumber ? "highlight-item" : ""}">
        <strong>${esc(x.mainText || "ShoutOut")}</strong>
        <p>${esc(x.locationName || x.clubName || "")} - ${esc(x.status || "pending")}</p>
        <small>${esc(fmtDate(x.submittedAt))}${x.referenceNumber ? ` - Ref: ${esc(x.referenceNumber)}` : ""}</small>
        ${canModify ? `<p><a class="buttonlike" href="${esc(shoutoutModifyUrl(x))}">Modify ShoutOut</a></p>` : ""}
      </div>`;
    }).join("") : "<p class='sub'>No ShoutOuts yet.</p>";
    byId("myGuestLists").innerHTML = guestLists.length ? guestLists.map(x => `<div class="queue-item"><strong>${esc(x.locationName || x.clubLocationId || "Guest List")}</strong><p>${esc(x.eventOrDay || "")} - Party of ${esc(x.partySize || 1)} - ${esc(x.status || "pending")}</p><small>Promoter: ${esc(x.promoterName || x.promoterId || "")}</small></div>`).join("") : "<p class='sub'>No guest list requests yet.</p>";
    renderMessages(messages, user);
    byId("myChats").innerHTML = chats.length ? chats.map(x => `<div class="queue-item"><strong>${esc(x.title || "Chat")}</strong><p>${esc(x.lastMessage || "")}</p><small>Unread: ${esc(x.unreadCounts?.[user.uid] || 0)}</small></div>`).join("") : "<p class='sub'>No chats yet.</p>";
    byId("privacyReport").innerHTML = simpleRows([["Marketing Consent", profile.marketingConsent ? "Yes" : "No"],["Analytics Consent", profile.analyticsConsent ? "Yes" : "No"],["Data Sharing Consent", profile.dataSharingConsent ? "Yes" : "No"]]);
  }

  async function sendPortalMessage() {
    const user = auth.currentUser;
    if (!user) return;
    if (!canSendDirectInbox(currentProfile)) {
      setText("portalStatus", "Direct inbox messaging is available only to approved Master Admin, Club Admin, Promoter, DJ, Waiter, Waitress, or Bottle Girl roles.");
      return;
    }
    const recipientEmail = byId("composeRecipientEmail")?.value.trim().toLowerCase();
    const subject = byId("composeSubject")?.value.trim() || "Message";
    const body = byId("composeBody")?.value.trim();
    if (!recipientEmail || !body) { setText("portalStatus", "Recipient email and message are required."); return; }
    await db.collection("messages").add({
      messageType:"role_direct",
      senderUid:user.uid,
      senderEmail:user.email || "",
      senderName:currentProfile.displayName || user.displayName || user.email || "Member",
      senderRoles:getApprovedRoles(currentProfile),
      recipientEmail,
      subject,
      body,
      read:false,
      openedAt:null,
      firstOpenedAt:null,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    setText("portalStatus", "Message sent.");
    byId("composeBody").value = "";
    await loadPortal(user);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    bind("portalGoogleLoginBtn", loginGoogle);
    bind("portalLogoutBtn", logout);
    bind("saveProfileBtn", saveProfile);
    bind("saveMediaSlotsBtn", saveMediaSlots);
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
