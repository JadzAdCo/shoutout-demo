/* mingl-chat-app.js v29.02 */
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
  const HIDDEN_ROOM_NAMES = new Set(["diagnostics peer", "mingl chat"]);

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

  function otherUid(room = {}) {
    return (room.participants || []).find(uid => uid !== currentUser?.uid) || "";
  }

  function visibleRoomName(room = {}) {
    const other = otherSummary(room);
    return String(other.displayName || other.name || room.title || "").trim();
  }

  function isVisiblePatronRoom(room = {}) {
    const participants = normalizedParticipants(room);
    if (!participants.includes(currentUser?.uid) || participants.length < 2 || !isMinglRoom(room)) return false;
    const name = visibleRoomName({...room, participants}).toLowerCase();
    if (!name || HIDDEN_ROOM_NAMES.has(name)) return false;
    if (/diagnostic|test peer|package install/i.test(name)) return false;
    return true;
  }

  async function summaryForUid(uid) {
    if (!uid) return {};
    try {
      const snap = await db.collection("users").doc(uid).get();
      if (!snap.exists) return {};
      const user = snap.data() || {};
      return {
        uid,
        displayName:user.displayName || user.publicName || user.username || user.email || "Member",
        photoURL:user.photoURL || user.profilePhotoUrl || user.mainPhotoUrl || ""
      };
    } catch(e) {
      return {};
    }
  }

  async function hydrateRoomSummary(room = {}) {
    const participants = normalizedParticipants(room);
    const normalized = {...room, participants, userSummaries:{...(room.userSummaries || {})}};
    const other = participants.find(uid => uid !== currentUser?.uid);
    if (other && !normalized.userSummaries[other]?.displayName) {
      normalized.userSummaries[other] = await summaryForUid(other);
    }
    return normalized;
  }

  function isMinglRoom(room = {}) {
    return room.type === "mingl" || room.roomType === "mingl" || String(room.id || "").startsWith("mingl_") || !!room.connectionId;
  }

  function normalizedParticipants(row = {}) {
    const direct = row.participants || row.members || row.memberUids || row.userIds || [];
    if (direct.length) return direct;
    return [row.requestedBy, row.requestedTo, row.senderUid, row.receiverUid].filter(Boolean);
  }

  function roomIdForConnection(connection = {}) {
    return `mingl_${connection.connectionId || connection.id || pairId(...normalizedParticipants(connection).slice(0, 2))}`;
  }

  function ensureCleanComposer() {
    const composer = document.querySelector(".mingl-compose");
    if (!composer || composer.dataset.floqrCleanComposer === "1") return;
    const input = byId("minglStandaloneMessageInput");
    const send = byId("minglStandaloneSendBtn");
    if (!input || !send) return;
    document.querySelector(".mingl-chat-tools")?.remove();
    byId("minglStandaloneImproveBtn")?.remove();
    document.querySelector(".chat-plus-button")?.remove();
    composer.classList.add("mingl-compose-clean");
    composer.innerHTML = "";
    composer.appendChild(input);
    composer.appendChild(send);
    const menu = document.createElement("details");
    menu.id = "minglStandaloneActionMenu";
    menu.className = "mingl-compose-menu";
    menu.innerHTML = `<summary aria-label="Mingl message actions">+</summary>
      <div class="mingl-compose-menu-panel">
        <strong>Emoji Actions</strong>
        <div class="emoji-row compact-emoji-row" aria-label="Mingl emoji shortcuts">
          <button type="button" data-mingl-emoji-code="128522" data-mingl-emoji-effect="smile">Smile</button>
          <button type="button" data-mingl-emoji-code="128293" data-mingl-emoji-effect="fire">Fire</button>
          <button type="button" data-mingl-emoji-code="127881" data-mingl-emoji-effect="confetti">Party</button>
          <button type="button" data-mingl-emoji-code="10084" data-mingl-emoji-effect="heart">Heart</button>
          <button type="button" data-mingl-emoji-code="128514" data-mingl-emoji-effect="laugh">Laugh</button>
          <button type="button" id="minglMoreEmojiActionsBtn" class="emoji-more-btn">+</button>
        </div>
        <div id="minglAdvancedEmojiActions" class="emoji-row compact-emoji-row hidden" aria-label="More Mingl emoji actions">
          <button type="button" data-mingl-emoji-value="💙" data-mingl-emoji-effect="heart-blue">Blue heart</button>
          <button type="button" data-mingl-emoji-value="❤️" data-mingl-emoji-effect="heart-red">Red heart</button>
          <button type="button" data-mingl-emoji-value="💗" data-mingl-emoji-effect="heart-pink">Pink heart</button>
          <button type="button" data-mingl-emoji-value="💔" data-mingl-emoji-effect="broken-heart">Broken heart</button>
          <button type="button" data-mingl-emoji-value="🌹" data-mingl-emoji-effect="rose-red">Red rose</button>
          <button type="button" data-mingl-emoji-value="🤍🌹" data-mingl-emoji-effect="rose-white">White rose</button>
          <button type="button" data-mingl-emoji-value="💙🌹" data-mingl-emoji-effect="rose-blue">Blue rose</button>
          <button type="button" data-mingl-emoji-human="middle-finger" data-mingl-emoji-effect="middle-finger">Middle finger</button>
        </div>
        <strong>Add Photo/Video</strong>
        <label class="chat-file-button" for="minglStandaloneImageInput">Choose Photo/Video</label>
        <button id="minglStandaloneClearImageBtn" type="button">Remove Photo/Video</button>
        <strong>Edit</strong>
        <button id="minglStandaloneImproveBtn" type="button">Correct Grammar/Spelling</button>
        <strong>Chat Background</strong>
        <label class="chat-file-button" for="minglStandaloneBackgroundInput">Change Background</label>
      </div>`;
    composer.appendChild(menu);
    composer.dataset.floqrCleanComposer = "1";
  }

  function bindComposerActions() {
    byId("minglStandaloneImproveBtn")?.addEventListener("click", improveDraft);
    byId("minglStandaloneClearImageBtn")?.addEventListener("click", clearAttachment);
    byId("minglMoreEmojiActionsBtn")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      byId("minglAdvancedEmojiActions")?.classList.toggle("hidden");
    });
    document.querySelectorAll("[data-mingl-emoji-code],[data-mingl-emoji-value],[data-mingl-emoji-human]").forEach(button => {
      const code = Number(button.dataset.minglEmojiCode || 0);
      const emoji = emojiForButton(button, code);
      if (emoji) {
        button.textContent = emoji;
        button.title = button.getAttribute("aria-label") || button.dataset.minglEmojiEffect || "Emoji action";
      }
      button.addEventListener("click", () => {
        sendEmojiAction(emojiForButton(button, code), button.dataset.minglEmojiEffect || "emoji");
      });
    });
    document.querySelector(".mingl-compose-menu-panel")?.addEventListener("click", event => {
      const target = event.target;
      if (target?.tagName === "BUTTON" || target?.tagName === "LABEL") {
        setTimeout(closeComposeMenu, 80);
      }
    });
  }

  function closeComposeMenu() {
    const menu = byId("minglStandaloneActionMenu");
    if (menu) menu.open = false;
  }

  function bindGlobalPopoutDismissal() {
    document.addEventListener("click", event => {
      const menu = byId("minglStandaloneActionMenu");
      if (menu?.open && !menu.contains(event.target)) closeComposeMenu();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeComposeMenu();
    });
  }

  function insertEmoji(emoji) {
    const input = byId("minglStandaloneMessageInput");
    if (!input || !emoji) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`;
    input.focus();
    input.setSelectionRange(start + emoji.length, start + emoji.length);
  }

  function emojiSkinModifier() {
    const tone = currentProfile?.languageSettings?.emojiSkinTone || "yellow";
    if (tone === "light-brown") return "\u{1F3FD}";
    if (tone === "dark-brown") return "\u{1F3FF}";
    return "";
  }

  function emojiForButton(button, code = 0) {
    if (!button) return "";
    if (button.dataset.minglEmojiHuman === "middle-finger") return `🖕${emojiSkinModifier()}`;
    if (button.dataset.minglEmojiValue) return button.dataset.minglEmojiValue;
    return code ? String.fromCodePoint(code) : "";
  }

  async function sendEmojiAction(emoji, effect = "emoji") {
    if (!emoji) return;
    if (!activeRoomId) {
      insertEmoji(emoji);
      return;
    }
    await sendMessage({bodyOverride:emoji, emojiEffect:effect});
  }

  function mediaHtml(msg = {}) {
    if (!msg.mediaUrl || msg.unsent) return "";
    const fileName = esc(msg.mediaFileName || (msg.mediaType === "video" ? "Shared video" : "Shared picture"));
    const media = msg.mediaType === "video"
      ? `<video src="${esc(msg.mediaUrl)}" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(msg.mediaUrl)}" alt="${fileName}" loading="lazy">`;
    return `<figure class="mingl-message-media">${media}<figcaption>${fileName}</figcaption></figure>`;
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
      const backgroundConsent = msg.messageType === "backgroundConsent";
      const label = system ? "System Message" : (mine ? "" : (msg.senderName || "Member"));
      const emojiClass = shouldAnimateEmoji(msg) ? emojiEffectClass(msg.emojiEffect) : "";
      return `<div class="mingl-message ${mine ? "mine" : ""} ${system ? "system" : ""} ${messageAnimationClass(msg.animationType)} ${emojiClass} ${msg.unsent ? "unsent" : ""} ${msg.doNotForward ? "no-forward" : ""}" data-message-id="${esc(msg.id || "")}" ${mine && !system && !msg.unsent ? 'data-own-message="1"' : ""}>
        ${label ? `<strong>${esc(label)}</strong>` : ""}
        <p>${esc(msg.body || "")}</p>
        ${mediaHtml(msg)}
        ${backgroundConsent ? backgroundConsentHtml(msg) : ""}
        <small>${esc(fmtDate(msg.createdAt))}${msg.edited ? " - edited" : ""}${msg.doNotForward ? " - do not forward" : ""}${msg.deleteAfterRead ? " - disappearing" : ""}${readReceiptHtml(msg, mine)}${mine && !system && !msg.unsent ? " - tap for actions" : ""}</small>
      </div>`;
    }).join("") : "<p class='mingl-empty-state'>Start the conversation.</p>";
    wrap.querySelectorAll("[data-own-message='1']").forEach(node => {
      node.addEventListener("click", () => showMessageActions(node.dataset.messageId, node));
    });
    wrap.querySelectorAll("[data-background-consent]").forEach(button => {
      button.addEventListener("click", () => respondToBackgroundConsent(button.dataset.backgroundConsent, button.dataset.response));
    });
    wrap.scrollTop = wrap.scrollHeight;
    setTimeout(() => { wrap.scrollTop = wrap.scrollHeight; }, 80);
  }

  function messageAnimationClass(type = "") {
    if (type === "bounce") return "animate-bounce";
    if (type === "explode") return "animate-explode";
    if (type === "scroll") return "animate-scroll";
    if (type === "disappear") return "animate-disappear";
    return "";
  }

  function emojiEffectClass(type = "") {
    if (!type) return "";
    if (type === "heart") return "emoji-effect-heart";
    if (type === "heart-blue") return "emoji-effect-heart emoji-effect-heart-blue";
    if (type === "heart-red") return "emoji-effect-heart emoji-effect-heart-red";
    if (type === "heart-pink") return "emoji-effect-heart emoji-effect-heart-pink";
    if (type === "broken-heart") return "emoji-effect-broken-heart";
    if (type === "confetti") return "emoji-effect-confetti";
    if (type === "fire") return "emoji-effect-fire";
    if (type === "laugh") return "emoji-effect-laugh";
    if (type === "smile") return "emoji-effect-smile";
    if (type === "rose-red") return "emoji-effect-rose emoji-effect-rose-red";
    if (type === "rose-white") return "emoji-effect-rose emoji-effect-rose-white";
    if (type === "rose-blue") return "emoji-effect-rose emoji-effect-rose-blue";
    if (type === "middle-finger") return "emoji-effect-middle-finger";
    return "";
  }

  function shouldAnimateEmoji(msg = {}) {
    if (!msg.emojiEffect || msg.unsent) return false;
    const value = msg.createdAt?.toDate ? msg.createdAt.toDate() : msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : null;
    if (!value) return true;
    return Date.now() - value.getTime() < 7000;
  }

  function backgroundConsentHtml(msg = {}) {
    const status = msg.backgroundConsentStatus || "pending";
    if (status !== "pending") return `<div class="mingl-consent-status">Background ${esc(status)}.</div>`;
    if (msg.backgroundTargetUid !== currentUser.uid) return `<div class="mingl-consent-status">Waiting for the other patron to approve the shared background. They will see Approve Background or Keep Mine Private inside this system message.</div>`;
    return `<div class="mingl-consent-actions">
      <p>Tap Approve Background to share this chat background, or keep your current background private.</p>
      <button type="button" class="primary" data-background-consent="${esc(msg.id || "")}" data-response="approved">Approve Background</button>
      <button type="button" data-background-consent="${esc(msg.id || "")}" data-response="declined">Keep Mine Private</button>
    </div>`;
  }

  async function respondToBackgroundConsent(messageId, response) {
    if (!messageId || !["approved","declined"].includes(response)) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists) return;
    const msg = {id:snap.id, ...snap.data()};
    if (msg.backgroundTargetUid !== currentUser.uid) {
      setText("minglChatStatus", "Only the requested patron can answer this background request.");
      return;
    }
    await db.collection("chatMessages").doc(messageId).set({
      backgroundConsentStatus:response,
      responseByUid:currentUser.uid,
      respondedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    if (response === "approved" && msg.backgroundUrl && activeRoomId) {
      await db.collection("chatRooms").doc(activeRoomId).set({
        sharedBackgroundUrl:msg.backgroundUrl,
        backgroundConsentPending:false,
        backgroundConsentApprovedBy:currentUser.uid,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      applyBackground(msg.backgroundUrl);
    }
    if (response === "declined" && activeRoomId) {
      await db.collection("chatRooms").doc(activeRoomId).set({
        backgroundConsentPending:false,
        backgroundConsentDeclinedBy:currentUser.uid,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }
    setText("minglChatStatus", response === "approved" ? "Shared background approved." : "Shared background declined. The other patron keeps it locally.");
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
    const chatCard = byId("minglStandaloneChatCard");
    if (chatCard) {
      chatCard.classList.remove("hidden");
      chatCard.setAttribute("aria-hidden", "false");
    }
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
    chatCard?.scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function closeRoom() {
    activeRoomId = "";
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    const chatCard = byId("minglStandaloneChatCard");
    if (chatCard) {
      chatCard.classList.add("hidden");
      chatCard.setAttribute("aria-hidden", "true");
    }
    const wrap = byId("minglStandaloneMessages");
    if (wrap) wrap.innerHTML = "";
    clearAttachment();
    setText("minglStandaloneTitle", "Select a Mingl Chat");
    setText("minglStandaloneRoomStatus", "Choose a mutual chat from the list.");
    renderRooms();
  }

  async function loadConnections() {
    let rows = await getParticipantCollectionSafe("minglConnections", currentUser.uid, 1000, []);
    if (!rows.length) {
      const requestedBy = await db.collection("minglConnections").where("requestedBy", "==", currentUser.uid).limit(1000).get().then(snap => snap.docs.map(doc => ({id:doc.id, ...doc.data()}))).catch(() => []);
      const requestedTo = await db.collection("minglConnections").where("requestedTo", "==", currentUser.uid).limit(1000).get().then(snap => snap.docs.map(doc => ({id:doc.id, ...doc.data()}))).catch(() => []);
      rows = [...requestedBy, ...requestedTo];
    }
    const byIdMap = new Map();
    rows.forEach(row => byIdMap.set(row.id || row.connectionId || pairId(...normalizedParticipants(row).slice(0, 2)), row));
    return [...byIdMap.values()];
  }

  async function ensureRoomFromConnection(connection = {}) {
    const participants = normalizedParticipants(connection);
    if (!participants.includes(currentUser.uid) || String(connection.status || "").toLowerCase() !== "mutual") return null;
    const roomId = roomIdForConnection(connection);
    const userSummaries = {...(connection.userSummaries || {})};
    const other = participants.find(uid => uid !== currentUser.uid);
    if (other && !userSummaries[other]?.displayName) {
      userSummaries[other] = await summaryForUid(other);
    }
    const payload = {
      id: roomId,
      type: "mingl",
      title: "Mingl Chat",
      connectionId: connection.connectionId || connection.id || "",
      participants,
      userSummaries,
      unreadCounts: {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await db.collection("chatRooms").doc(roomId).set(payload, {merge:true});
    } catch(e) {
      console.warn("Could not normalize Mingl room:", e.message);
    }
    return {id:roomId, ...payload};
  }

  async function loadRooms() {
    setText("minglChatStatus", "Loading Mingl chats...");
    const rawRooms = await getParticipantCollectionSafe("chatRooms", currentUser.uid, 1000, []);
    const existingRooms = [];
    for (const room of rawRooms) {
      const hydrated = await hydrateRoomSummary(room);
      if (isVisiblePatronRoom(hydrated)) existingRooms.push(hydrated);
    }
    rooms = existingRooms;
    renderRooms();
    setText("minglChatStatus", existingRooms.length ? "Mingl chats loaded. Checking older connections..." : "Checking older Mingl connections...");
    const connections = await loadConnections();
    const createdRooms = [];
    for (const connection of connections) {
      const row = await ensureRoomFromConnection(connection);
      if (row && isVisiblePatronRoom(row)) createdRooms.push(row);
    }
    const byRoom = new Map();
    [...existingRooms, ...createdRooms].forEach(room => {
      const normalized = {...room, participants:normalizedParticipants(room)};
      if (isVisiblePatronRoom(normalized)) byRoom.set(room.id, normalized);
    });
    rooms = [...byRoom.values()].sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    renderRooms();
    const requested = qs("room");
    if (requested && rooms.some(room => room.id === requested)) openRoom(requested);
    setText("minglChatStatus", rooms.length ? "Mingl chats ready." : "No mutual Mingl chats found yet.");
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
    if (!/^(image|video)\//.test(attachmentFile.type)) {
      setText("minglChatStatus", "Mingl chat media accepts image or video files only.");
      return clearAttachment();
    }
    const url = URL.createObjectURL(attachmentFile);
    closeComposeMenu();
    preview.classList.remove("hidden");
    const thumb = attachmentFile.type.startsWith("video/")
      ? `<video src="${esc(url)}" muted playsinline preload="metadata"></video>`
      : `<img src="${esc(url)}" alt="">`;
    preview.innerHTML = `${thumb}<div><strong>${esc(attachmentFile.name)}</strong><button type="button" data-clear-mingl-attachment>Remove Photo/Video</button></div>`;
    preview.querySelector("[data-clear-mingl-attachment]")?.addEventListener("click", clearAttachment);
  }

  function uploadErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Unknown error");
    if (code === "storage/unauthorized" || /unauthorized|permission|storage rules/i.test(message)) {
      return "Mingl media upload failed because Firebase Storage rules are blocking mingl-chat/{uid}/{roomId}. Publish this package's storage.rules, then try again.";
    }
    return message;
  }

  async function uploadMedia(roomId, file) {
    if (!file) return {};
    if (!/^(image|video)\//.test(file.type)) throw new Error("Mingl chat media accepts image or video files only.");
    const max = file.type.startsWith("video/") ? 30 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > max) throw new Error(file.type.startsWith("video/") ? "Mingl chat videos must be 30MB or smaller." : "Mingl chat pictures must be 8MB or smaller.");
    const path = `mingl-chat/${currentUser.uid}/${roomId}/${Date.now()}-${safeStorageFileName(file.name)}`;
    const snap = await storage.ref().child(path).put(file, {contentType:file.type, customMetadata:{uploadedBy:currentUser.uid, roomId}});
    return {
      mediaUrl: await snap.ref.getDownloadURL(),
      mediaType: file.type.startsWith("video/") ? "video" : "image",
      mediaFileName: file.name,
      mediaStoragePath: path
    };
  }

  async function sendMessage(options = {}) {
    const input = byId("minglStandaloneMessageInput");
    const usedBodyOverride = typeof options.bodyOverride === "string";
    const body = usedBodyOverride ? options.bodyOverride : input?.value.trim();
    const file = attachmentFile || byId("minglStandaloneImageInput")?.files?.[0] || null;
    if (!activeRoomId || (!body && !file)) return;
    try {
      const roomSnap = await db.collection("chatRooms").doc(activeRoomId).get();
      if (!roomSnap.exists) throw new Error("Mingl chat room was not found.");
      const room = roomSnap.data();
      if (!(room.participants || []).includes(currentUser.uid)) throw new Error("Mingl chat is available only to approved participants.");
      const mediaPayload = file ? await uploadMedia(activeRoomId, file) : {};
      const unreadCounts = {...(room.unreadCounts || {})};
      (room.participants || []).forEach(uid => { if (uid !== currentUser.uid) unreadCounts[uid] = Number(unreadCounts[uid] || 0) + 1; });
      if (!usedBodyOverride && input) input.value = "";
      clearAttachment();
      await db.collection("chatMessages").add({
        roomId:activeRoomId,
        roomType:"mingl",
        connectionId:room.connectionId || "",
        participants:room.participants || [],
        senderUid:currentUser.uid,
        senderName:currentProfile.displayName || currentUser.displayName || currentUser.email || "Member",
        body:body || (mediaPayload.mediaType === "video" ? "Shared a video." : "Shared a picture."),
        emojiEffect:options.emojiEffect || "",
        ...mediaPayload,
        edited:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("chatRooms").doc(activeRoomId).set({
        lastMessage:body || (mediaPayload.mediaType === "video" ? "Shared a video." : "Shared a picture."),
        unreadCounts,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
      setText("minglChatStatus", "");
    } catch(e) {
      setText("minglChatStatus", uploadErrorMessage(e));
    }
  }

  async function updateOwnMessage(messageId, patch) {
    if (!messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) throw new Error("Only your own Mingl messages can be edited.");
    await db.collection("chatMessages").doc(messageId).set({
      ...patch,
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  async function patchOwnMessage(messageId, patch) {
    if (!messageId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) throw new Error("Only your own Mingl messages can be changed.");
    await db.collection("chatMessages").doc(messageId).set({
      ...patch,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }

  function removeMessageActionPopouts() {
    document.querySelector(".mingl-message-action-popout")?.remove();
    document.querySelector(".mingl-inline-edit-popout")?.remove();
    document.querySelector(".mingl-forward-popout")?.remove();
  }

  function placeFloatingPopout(popout, anchor, width = 320) {
    const rect = anchor.getBoundingClientRect();
    popout.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    popout.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 260))}px`;
  }

  async function editMessage(messageId, anchor) {
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    removeMessageActionPopouts();
    const popout = document.createElement("div");
    popout.className = "mingl-inline-edit-popout";
    popout.innerHTML = `<div class="mingl-inline-edit-card">
      <strong>Edit Mingl Message</strong>
      <textarea id="minglInlineEditText" rows="3">${esc(snap.data().body || "")}</textarea>
      <div class="button-row">
        <button type="button" data-inline-edit-save>Save</button>
        <button type="button" data-inline-edit-cancel>Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(popout);
    placeFloatingPopout(popout, anchor || byId("minglStandaloneChatCard") || document.body, 340);
    const textarea = popout.querySelector("#minglInlineEditText");
    textarea?.focus();
    textarea?.select();
    popout.querySelector("[data-inline-edit-cancel]")?.addEventListener("click", () => popout.remove());
    popout.querySelector("[data-inline-edit-save]")?.addEventListener("click", async () => {
      const next = textarea?.value.trim() || "";
      await updateOwnMessage(messageId, {body:next});
      popout.remove();
    });
    setTimeout(() => {
      document.addEventListener("click", function close(event) {
        if (!popout.contains(event.target) && event.target !== anchor) {
          popout.remove();
          document.removeEventListener("click", close);
        }
      });
    }, 0);
  }

  async function correctMessage(messageId) {
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists || snap.data().senderUid !== currentUser.uid) return;
    const body = snap.data().body || "";
    if (!body.trim() || !window.FLOQRGrammar?.suggestGrammarCorrection) return;
    const settings = currentProfile.languageSettings || {};
    const result = await window.FLOQRGrammar.suggestGrammarCorrection(body, {
      uid:currentUser.uid,
      product:"mingl",
      inputType:"chat-edit",
      preferredLanguage:settings.preferredLanguage || "auto",
      tonePreference:settings.tonePreference || "keepTone",
      correctionMode:settings.correctionMode || "approvalRequired",
      personalDictionary:settings.personalDictionary || [],
      personalCorrections:settings.personalCorrections || []
    });
    const suggestion = result.correctedText || body;
    if (suggestion !== body && confirm(`Use this correction?\n\n${suggestion}`)) {
      await updateOwnMessage(messageId, {body:suggestion});
    }
  }

  async function unsendMessage(messageId) {
    await patchOwnMessage(messageId, {
      body:"Message unsent.",
      unsent:true,
      edited:true,
      editedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function animateMessage(messageId, animationType) {
    await patchOwnMessage(messageId, {
      animationType,
      animatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function disappearMessage(messageId) {
    await patchOwnMessage(messageId, {
      animationType:"disappear",
      deleteAfterRead:true,
      deleteAfterReadSetAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function makeDisappearImmediately(messageId) {
    await patchOwnMessage(messageId, {
      animationType:"disappear",
      deleteAfterRead:true,
      deleteImmediately:true,
      hiddenAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function markDoNotForward(messageId) {
    await patchOwnMessage(messageId, {
      doNotForward:true,
      doNotForwardSetAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function forwardMessage(messageId, targetRoomId) {
    if (!messageId || !targetRoomId) return;
    const snap = await db.collection("chatMessages").doc(messageId).get();
    if (!snap.exists) return;
    const msg = snap.data();
    if (msg.doNotForward) {
      setText("minglChatStatus", "This message is marked do not forward.");
      return;
    }
    const roomSnap = await db.collection("chatRooms").doc(targetRoomId).get();
    if (!roomSnap.exists || !(roomSnap.data().participants || []).includes(currentUser.uid)) return;
    const room = roomSnap.data();
    await db.collection("chatMessages").add({
      roomId:targetRoomId,
      roomType:"mingl",
      participants:room.participants || [],
      senderUid:currentUser.uid,
      senderName:currentProfile.displayName || currentUser.displayName || currentUser.email || "Member",
      body:msg.body || "Forwarded Mingl message.",
      mediaUrl:msg.mediaUrl || "",
      mediaType:msg.mediaType || "",
      mediaFileName:msg.mediaFileName || "",
      forwardedFrom:messageId,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    setText("minglChatStatus", "Message forwarded.");
  }

  function showForwardBubble(messageId, anchor) {
    removeMessageActionPopouts();
    const popout = document.createElement("div");
    popout.className = "mingl-forward-popout";
    const choices = rooms.filter(room => room.id !== activeRoomId).slice(0, 8);
    popout.innerHTML = `<div class="mingl-forward-card">
      <strong>Forward To</strong>
      ${choices.length ? choices.map(room => {
        const other = otherSummary(room);
        return `<button type="button" data-forward-room="${esc(room.id)}">${esc(other.displayName || room.title || "Mingl Chat")}</button>`;
      }).join("") : "<p class='sub small'>No other Mingl chats available.</p>"}
    </div>`;
    document.body.appendChild(popout);
    placeFloatingPopout(popout, anchor || byId("minglStandaloneChatCard") || document.body, 320);
    popout.querySelectorAll("[data-forward-room]").forEach(button => {
      button.addEventListener("click", async () => {
        await forwardMessage(messageId, button.dataset.forwardRoom);
        popout.remove();
      });
    });
  }

  function showMessageActions(messageId, anchor) {
    removeMessageActionPopouts();
    const popout = document.createElement("div");
    popout.className = "mingl-message-action-popout";
    placeFloatingPopout(popout, anchor, 292);
    popout.innerHTML = `<div class="mingl-message-action-menu" role="menu" aria-label="Mingl message actions">
      <strong>Edit</strong>
      <button type="button" data-action="unsend">Unsend</button>
      <button type="button" data-action="correct">AutoFix</button>
      <button type="button" data-action="edit">Edit</button>
      <button type="button" data-action="no-forward">Do Not Forward</button>
      <button type="button" data-action="forward">Forward</button>
      <strong>Text Animation</strong>
      <button type="button" data-action="bounce">Bounce</button>
      <button type="button" data-action="explode">Explode</button>
      <button type="button" data-action="scroll">Scroll</button>
      <button type="button" data-action="disappear">Disappear</button>
      <button type="button" data-action="disappear-now">Make Disappearing Immediately</button>
    </div>`;
    document.body.appendChild(popout);
    popout.addEventListener("click", async event => {
      const action = event.target?.dataset?.action;
      if (!action) return;
      try {
        if (action === "edit") { await editMessage(messageId, event.target); return; }
        else if (action === "correct") await correctMessage(messageId);
        else if (action === "unsend") await unsendMessage(messageId);
        else if (action === "no-forward") await markDoNotForward(messageId);
        else if (action === "forward") { showForwardBubble(messageId, event.target); return; }
        else if (action === "disappear") await disappearMessage(messageId);
        else if (action === "disappear-now") await makeDisappearImmediately(messageId);
        else await animateMessage(messageId, action);
      } catch(e) {
        setText("minglChatStatus", e.message || String(e));
      }
      popout.remove();
    });
    setTimeout(() => {
      document.addEventListener("click", function close(event) {
        if (!popout.contains(event.target) && event.target !== anchor) {
          popout.remove();
          document.removeEventListener("click", close);
        }
      });
    }, 0);
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
      const participants = rooms.find(room => room.id === activeRoomId)?.participants || [currentUser.uid];
      const targetUid = participants.find(uid => uid !== currentUser.uid) || "";
      await db.collection("chatMessages").add({
        roomId:activeRoomId,
        roomType:"mingl",
        participants,
        senderUid:"system",
        senderName:"System Message",
        messageType:"backgroundConsent",
        backgroundTargetUid:targetUid,
        backgroundUrl:url,
        backgroundConsentStatus:"pending",
        body:`${currentProfile.displayName || currentUser.displayName || "A patron"} wants to change the shared Mingl chat background. Tap Approve Background to use it for both patrons, or Keep Mine Private to leave it only on their side.`,
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
    ensureCleanComposer();
    bindComposerActions();
    bindGlobalPopoutDismissal();
    byId("minglChatGoogleLoginBtn")?.addEventListener("click", loginGoogle);
    byId("minglChatMicrosoftLoginBtn")?.addEventListener("click", loginMicrosoft);
    byId("minglStandaloneCloseChatBtn")?.addEventListener("click", closeRoom);
    byId("minglStandaloneSendBtn")?.addEventListener("click", sendMessage);
    byId("minglStandaloneImageInput")?.addEventListener("change", renderAttachmentPreview);
    byId("minglStandaloneBackgroundInput")?.addEventListener("change", event => {
      closeComposeMenu();
      uploadBackground(event);
    });
    document.querySelectorAll("[data-mingl-emoji]").forEach(button => {
      button.addEventListener("click", () => insertEmoji(button.dataset.minglEmoji || ""));
    });
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
    if (!user) return;
    const profileSnap = await db.collection("users").doc(user.uid).get().catch(() => null);
    currentProfile = profileSnap?.exists ? profileSnap.data() : {};
    await loadRooms();
  });
})();
