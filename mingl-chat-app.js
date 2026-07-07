/* mingl-chat-app.js v28.91-helper-popouts-mingl-requests */
(function(){
  "use strict";

  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const el = byId(id); if (el) el.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const qs = name => new URL(window.location.href).searchParams.get(name) || "";

  if (!window.firebaseConfig) { setText("minglChatStatus", "firebase-config.js missing window.firebaseConfig."); return; }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  let currentUser = null;
  let currentProfile = {};
  let rooms = [];
  let activeRoomId = "";
  let unsubscribeMessages = null;
  let attachmentFile = null;

  function fmtDate(value) {
    if (!value) return "";
    const d = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return isNaN(d) ? "" : d.toLocaleString();
  }

  function splitCSV(value) {
    return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  function safeStorageFileName(name = "image") {
    return String(name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "image";
  }

  function pairId(a, b) {
    return [a, b].sort().join("__");
  }

  async function getCollectionSafe(name, predicate = null, limit = 1000) {
    try {
      const snap = await db.collection(name).limit(limit).get();
      const rows = snap.docs.map(doc => ({id:doc.id, ...doc.data()}));
      return predicate ? rows.filter(predicate) : rows;
    } catch(e) {
      console.warn(`Could not read ${name}:`, e.message);
      return [];
    }
  }

  async function getParticipantCollectionSafe(name, uid, limit = 1000, fallbackIds = []) {
    try {
      const snap = await db.collection(name).where("participants", "array-contains", uid).limit(limit).get();
      return snap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    } catch(e) {
      const rows = [];
      for (const id of fallbackIds) {
        try {
          const snap = await db.collection(name).doc(id).get();
          if (snap.exists) rows.push({id:snap.id, ...snap.data()});
        } catch(err) {}
      }
      return rows.filter(row => (row.participants || []).includes(uid));
    }
  }

  function otherSummary(room = {}) {
    const otherUid = (room.participants || []).find(uid => uid !== currentUser?.uid);
    return room.userSummaries?.[otherUid] || {};
  }

  function mediaHtml(msg = {}) {
    if (!msg.mediaUrl || msg.unsent) return "";
    const fileName = esc(msg.mediaFileName || "Shared picture");
    return `<figure class="mingl-message-media"><img src="${esc(msg.mediaUrl)}" alt="${fileName}" loading="lazy"><figcaption>${fileName}</figcaption></figure>`;
  }

  function readReceiptHtml(msg = {}, mine = false) {
    if (!mine || msg.senderUid === "system") return "";
    const readBy = msg.readBy || {};
    const otherRead = Object.keys(readBy).some(uid => uid !== currentUser.uid && readBy[uid]);
    return otherRead ? " - Read" : "";
  }

  function renderMessages(rows = []) {
    const wrap = byId("minglStandaloneMessages");
    if (!wrap || !activeRoomId) return;
    rows.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    markRead(rows);
    wrap.innerHTML = rows.length ? rows.map(msg => {
      const mine = msg.senderUid === currentUser.uid;
      const system = msg.senderUid === "system" || msg.messageType === "system";
      const label = system ? "System Message" : (mine ? "" : (msg.senderName || "Member"));
      return `<div class="mingl-message ${mine ? "mine" : ""} ${system ? "system" : ""}">
        ${label ? `<strong>${esc(label)}</strong>` : ""}
        <p>${esc(msg.body || "")}</p>
        ${mediaHtml(msg)}
        <small>${esc(fmtDate(msg.createdAt))}${msg.edited ? " - edited" : ""}${readReceiptHtml(msg, mine)}</small>
      </div>`;
    }).join("") : "<p class='mingl-empty-state'>Start the conversation.</p>";
    wrap.scrollTop = wrap.scrollHeight;
  }

  function subscribeMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const wrap = byId("minglStandaloneMessages");
    if (wrap) wrap.innerHTML = "<p class='sub'>Loading Mingl messages...</p>";
    try {
      unsubscribeMessages = db.collection("chatMessages")
        .where("roomId", "==", activeRoomId)
        .where("participants", "array-contains", currentUser.uid)
        .onSnapshot(snap => renderMessages(snap.docs.map(doc => ({id:doc.id, ...doc.data()}))), () => {
          getCollectionSafe("chatMessages", msg => msg.roomId === activeRoomId).then(renderMessages);
        });
    } catch(e) {
      getCollectionSafe("chatMessages", msg => msg.roomId === activeRoomId).then(renderMessages);
    }
  }

  function markRead(rows = []) {
    const unread = rows.filter(msg => msg.senderUid !== currentUser.uid && msg.senderUid !== "system" && !(msg.readBy || {})[currentUser.uid]);
    unread.forEach(msg => {
      db.collection("chatMessages").doc(msg.id).set({
        readBy:{[currentUser.uid]:true},
        readAtBy:{[currentUser.uid]:firebase.firestore.FieldValue.serverTimestamp()},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(() => {});
    });
    if (unread.length) {
      db.collection("chatRooms").doc(activeRoomId).set({
        unreadCounts:{[currentUser.uid]:0},
        lastReadAtBy:{[currentUser.uid]:firebase.firestore.FieldValue.serverTimestamp()},
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).catch(() => {});
    }
  }

  function renderRooms() {
    const wrap = byId("minglStandaloneList");
    if (!wrap) return;
    const unread = rooms.reduce((sum, room) => sum + Number(room.unreadCounts?.[currentUser.uid] || 0), 0);
    setText("minglStandaloneCount", `(${unread}/${rooms.length})`);
    wrap.innerHTML = rooms.length ? "" : "<p class='sub'>No Mingl chats yet. Use the Mingl page to find people and send a Mingl request.</p>";
    rooms.forEach(room => {
      const other = otherSummary(room);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `queue-item mingl-chat-item ${room.id === activeRoomId ? "selected" : ""}`;
      btn.innerHTML = `<strong>${esc(other.displayName || room.title || "Mingl Chat")}</strong><span>${esc(room.lastMessage || "Open chat history")}</span><small>Unread: ${esc(room.unreadCounts?.[currentUser.uid] || 0)}</small>`;
      btn.addEventListener("click", () => openRoom(room.id));
      wrap.appendChild(btn);
    });
  }

  async function openRoom(roomId) {
    const room = rooms.find(x => x.id === roomId);
    if (!room) return;
    activeRoomId = roomId;
    const other = otherSummary(room);
    const title = other.displayName || room.title || "Mingl Chat";
    setText("minglStandaloneTitle", title);
    setText("minglStandaloneRoomStatus", "Mutual Mingl chat");
    const avatar = byId("minglStandaloneAvatar");
    if (avatar) {
      avatar.innerHTML = other.photoURL || other.profilePhotoUrl
        ? `<img src="${esc(other.photoURL || other.profilePhotoUrl)}" alt="${esc(title)}">`
        : esc(title.slice(0, 1).toUpperCase() || "M");
    }
    applyBackground(room.localBackgrounds?.[currentUser.uid] || room.sharedBackgroundUrl || "");
    renderRooms();
    subscribeMessages();
  }

  async function loadRooms() {
    const users = await getCollectionSafe("users");
    const fallbackIds = users
      .map(profile => profile.uid || profile.id)
      .filter(uid => uid && uid !== currentUser.uid)
      .map(uid => `mingl_${pairId(currentUser.uid, uid)}`);
    rooms = (await getParticipantCollectionSafe("chatRooms", currentUser.uid, 1000, fallbackIds)).filter(room => room.type === "mingl");
    renderRooms();
    const requested = qs("room");
    if (requested && rooms.some(room => room.id === requested)) openRoom(requested);
    else if (rooms[0]) openRoom(rooms[0].id);
  }

  function clearAttachment() {
    attachmentFile = null;
    const input = byId("minglStandaloneImageInput");
    const preview = byId("minglStandaloneAttachmentPreview");
    if (input) input.value = "";
    if (preview) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
    }
  }

  function renderAttachmentPreview() {
    const input = byId("minglStandaloneImageInput");
    const preview = byId("minglStandaloneAttachmentPreview");
    attachmentFile = input?.files?.[0] || null;
    if (!preview) return;
    if (!attachmentFile) return clearAttachment();
    if (!/^image\//.test(attachmentFile.type)) {
      setText("minglChatStatus", "Mingl chat picture sharing accepts image files only.");
      return clearAttachment();
    }
    const url = URL.createObjectURL(attachmentFile);
    preview.classList.remove("hidden");
    preview.innerHTML = `<img src="${esc(url)}" alt=""><div><strong>${esc(attachmentFile.name)}</strong><button type="button" data-clear-mingl-attachment>Remove Picture</button></div>`;
    preview.querySelector("[data-clear-mingl-attachment]")?.addEventListener("click", clearAttachment);
  }

  function uploadErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "storage/unauthorized" || /unauthorized|permission|storage rules/i.test(message)) {
      return "Mingl picture upload failed because Firebase Storage rules are blocking mingl-chat/{uid}/{roomId}. Publish this package's storage.rules, then try the picture again.";
    }
    return message;
  }

  async function uploadImage(roomId, file) {
    if (!file) return {};
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

  async function sendMessage() {
    const input = byId("minglStandaloneMessageInput");
    const body = input?.value.trim();
    const file = attachmentFile || byId("minglStandaloneImageInput")?.files?.[0] || null;
    if (!activeRoomId || (!body && !file)) return;
    try {
      const roomSnap = await db.collection("chatRooms").doc(activeRoomId).get();
      if (!roomSnap.exists) throw new Error("Mingl chat room was not found.");
      const room = roomSnap.data();
      if (!(room.participants || []).includes(currentUser.uid)) throw new Error("Mingl chat is available only to approved participants.");
      const mediaPayload = file ? await uploadImage(activeRoomId, file) : {};
      const unreadCounts = {...(room.unreadCounts || {})};
      (room.participants || []).forEach(uid => { if (uid !== currentUser.uid) unreadCounts[uid] = Number(unreadCounts[uid] || 0) + 1; });
      input.value = "";
      clearAttachment();
      await db.collection("chatMessages").add({
        roomId:activeRoomId,
        roomType:"mingl",
        connectionId:room.connectionId || "",
        participants:room.participants || [],
        senderUid:currentUser.uid,
        senderName:currentProfile.displayName || currentUser.displayName || currentUser.email || "Member",
        body:body || "Shared a picture.",
        ...mediaPayload,
        edited:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("chatRooms").doc(activeRoomId).set({
        lastMessage:body || "Shared a picture.",
        unreadCounts,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      setText("minglChatStatus", "");
    } catch(e) {
      setText("minglChatStatus", uploadErrorMessage(e));
    }
  }

  async function improveDraft() {
    const input = byId("minglStandaloneMessageInput");
    const draft = input?.value.trim();
    if (!input || !draft) return;
    if (!window.FLOQRGrammar?.suggestGrammarCorrection) {
      setText("minglChatStatus", "AI grammar correction is not available yet.");
      return;
    }
    setText("minglChatStatus", "Checking draft grammar...");
    const settings = currentProfile.languageSettings || {};
    const result = await window.FLOQRGrammar.suggestGrammarCorrection(draft, {
      uid:currentUser.uid,
      product:"mingl",
      inputType:"chat",
      preferredLanguage:settings.preferredLanguage || "auto",
      tonePreference:settings.tonePreference || "keepTone",
      correctionMode:settings.correctionMode || "approvalRequired",
      personalDictionary:settings.personalDictionary || [],
      personalCorrections:settings.personalCorrections || []
    });
    const suggestion = result.correctedText || draft;
    if (suggestion === draft) {
      setText("minglChatStatus", "No grammar change suggested.");
      return;
    }
    if (confirm(`Use this correction?\n\n${suggestion}`)) {
      input.value = suggestion;
      setText("minglChatStatus", "Grammar suggestion applied. Tap Send when ready.");
    } else {
      setText("minglChatStatus", "Kept original draft.");
    }
  }

  function applyBackground(url = "") {
    const wrap = byId("minglStandaloneMessages");
    if (!wrap) return;
    wrap.style.backgroundImage = url ? `linear-gradient(rgba(7,12,32,.68),rgba(7,12,32,.82)), url("${String(url).replace(/"/g, "%22")}")` : "";
    wrap.style.backgroundSize = url ? "cover" : "";
    wrap.style.backgroundPosition = url ? "center" : "";
  }

  async function uploadBackground() {
    const file = byId("minglStandaloneBackgroundInput")?.files?.[0];
    if (!file || !activeRoomId) return;
    try {
      if (!/^image\//.test(file.type)) throw new Error("Chat background accepts image files only.");
      const path = `mingl-chat-backgrounds/${currentUser.uid}/${activeRoomId}/${Date.now()}-${safeStorageFileName(file.name)}`;
      const snap = await storage.ref().child(path).put(file, {contentType:file.type, customMetadata:{uploadedBy:currentUser.uid, roomId:activeRoomId}});
      const url = await snap.ref.getDownloadURL();
      await db.collection("chatRooms").doc(activeRoomId).set({
        localBackgrounds:{[currentUser.uid]:url},
        backgroundConsentPending:true,
        backgroundConsentRequestedBy:currentUser.uid,
        backgroundConsentUrl:url,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      await db.collection("chatMessages").add({
        roomId:activeRoomId,
        roomType:"mingl",
        participants:rooms.find(room => room.id === activeRoomId)?.participants || [currentUser.uid],
        senderUid:"system",
        senderName:"System Message",
        messageType:"system",
        body:`${currentProfile.displayName || currentUser.displayName || "A patron"} wants to change the shared Mingl chat background. The background stays local until the other patron consents.`,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      applyBackground(url);
      setText("minglChatStatus", "Your chat background was updated. The other patron was asked to consent before it becomes shared.");
    } catch(e) {
      setText("minglChatStatus", uploadErrorMessage(e));
    }
  }

  function loginGoogle() {
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(error => setText("minglChatStatus", error.message));
  }

  function loginMicrosoft() {
    const provider = new firebase.auth.OAuthProvider("microsoft.com");
    auth.signInWithPopup(provider).catch(error => setText("minglChatStatus", error.message));
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("minglChatGoogleLoginBtn")?.addEventListener("click", loginGoogle);
    byId("minglChatMicrosoftLoginBtn")?.addEventListener("click", loginMicrosoft);
    byId("minglStandaloneSendBtn")?.addEventListener("click", sendMessage);
    byId("minglStandaloneImproveBtn")?.addEventListener("click", improveDraft);
    byId("minglStandaloneImageInput")?.addEventListener("change", renderAttachmentPreview);
    byId("minglStandaloneClearImageBtn")?.addEventListener("click", clearAttachment);
    byId("minglStandaloneBackgroundInput")?.addEventListener("change", uploadBackground);
    byId("minglStandaloneMessageInput")?.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  });

  auth.onAuthStateChanged(async user => {
    currentUser = user;
    byId("minglChatLogin")?.classList.toggle("hidden", !!user);
    byId("minglChatShell")?.classList.toggle("hidden", !user);
    if (!user) {
      setText("minglChatSignedInAs", "Not signed in");
      return;
    }
    setText("minglChatSignedInAs", `Signed in as ${user.displayName || user.email || user.phoneNumber || "Member"}`);
    const profileSnap = await db.collection("users").doc(user.uid).get().catch(() => null);
    currentProfile = profileSnap?.exists ? profileSnap.data() : {};
    await loadRooms();
  });
})();
