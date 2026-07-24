/* FLOQR UnMingl / userBlocks helpers — shared client gate for profile, services, chat, gist. */
(function (root) {
  "use strict";

  function pairId(a, b) {
    return [String(a || ""), String(b || "")].filter(Boolean).sort().join("_");
  }

  function otherUid(participants = [], selfUid = "") {
    return (participants || []).find(uid => uid && uid !== selfUid) || "";
  }

  async function loadActiveBlocks(db, uid, limit = 500) {
    if (!db || !uid) return [];
    try {
      const snap = await db.collection("userBlocks").where("participants", "array-contains", uid).limit(limit).get();
      return snap.docs
        .map(doc => ({id: doc.id, ...doc.data()}))
        .filter(row => row.active !== false);
    } catch (error) {
      console.warn("userBlocks query failed", error?.message || error);
      return [];
    }
  }

  function blockedUidSet(blocks = [], selfUid = "") {
    const set = new Set();
    (blocks || []).forEach(block => {
      if (block.active === false) return;
      const other = block.blockedUid === selfUid
        ? block.blockedBy
        : (block.blockedUid || otherUid(block.participants, selfUid));
      if (other) set.add(other);
      (block.participants || []).forEach(uid => {
        if (uid && uid !== selfUid) set.add(uid);
      });
    });
    return set;
  }

  function isBlockedEitherWay(blocksOrSet, selfUid, other) {
    if (!other) return false;
    if (blocksOrSet instanceof Set) return blocksOrSet.has(other);
    return blockedUidSet(blocksOrSet, selfUid).has(other);
  }

  async function isBlockedPair(db, uidA, uidB) {
    if (!db || !uidA || !uidB || uidA === uidB) return false;
    const id = pairId(uidA, uidB);
    try {
      const snap = await db.collection("userBlocks").doc(id).get();
      return snap.exists && snap.data()?.active !== false;
    } catch (_) {
      return false;
    }
  }

  /**
   * UnMingl: block target from public profile discovery, public services, Mingl Chat, and Mingl Gist.
   * Ends mutual Mingl connection and closes the chat room.
   */
  async function unMinglBlock(db, {blockerUid, blockedUid, blockerProfile = {}, blockedProfile = {}, reason = "unmingl"} = {}) {
    if (!db || !blockerUid || !blockedUid || blockerUid === blockedUid) {
      throw new Error("Choose a Mingl friend to UnMingl.");
    }
    const id = pairId(blockerUid, blockedUid);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const participants = [blockerUid, blockedUid].sort();
    const summaries = {
      [blockerUid]: {
        displayName: blockerProfile.displayName || blockerProfile.username || "Patron",
        photoURL: blockerProfile.photoURL || ""
      },
      [blockedUid]: {
        displayName: blockedProfile.displayName || blockedProfile.username || "Patron",
        photoURL: blockedProfile.photoURL || ""
      }
    };

    await db.collection("userBlocks").doc(id).set({
      blockId: id,
      participants,
      blockedBy: blockerUid,
      blockedUid,
      active: true,
      reason: String(reason || "unmingl").slice(0, 80),
      userSummaries: summaries,
      createdAt: now,
      updatedAt: now
    }, {merge: true});

    await db.collection("minglConnections").doc(id).set({
      connectionId: id,
      participants,
      status: "blocked",
      blockedByUid: blockerUid,
      blockedAt: now,
      updatedAt: now,
      userSummaries: summaries
    }, {merge: true});

    const roomId = `mingl_${id}`;
    await db.collection("chatRooms").doc(roomId).set({
      id: roomId,
      type: "mingl",
      connectionId: id,
      participants,
      status: "closed",
      blocked: true,
      blockedByUid: blockerUid,
      blockedAt: now,
      lastMessage: "UnMingl: this chat is closed.",
      updatedAt: now
    }, {merge: true});

    try {
      await db.collection("chatMessages").add({
        roomId,
        roomType: "mingl",
        messageType: "system",
        connectionId: id,
        participants,
        senderUid: "system",
        senderName: "System Message",
        body: "UnMingl applied. This Mingl Chat is closed and public access is blocked both ways.",
        createdAt: now
      });
    } catch (_) {}

    try {
      await db.collection("minglAudit").add({
        type: "unmingl_block",
        actorUid: blockerUid,
        targetUid: blockedUid,
        participants,
        connectionId: id,
        createdAt: now
      });
    } catch (_) {}

    try {
      await db.collection("inboxNotifications").add({
        recipientUid: blockerUid,
        type: "unminglConfirm",
        title: "UnMingl applied",
        body: `You UnMingl'd ${summaries[blockedUid].displayName}. They can no longer use your public profile, public services, Mingl Chat, or Mingl Gist.`,
        connectionId: id,
        read: false,
        createdAt: now
      });
    } catch (_) {}

    return {blockId: id, roomId};
  }

  async function unblockUser(db, {blockerUid, blockedUid} = {}) {
    if (!db || !blockerUid || !blockedUid) throw new Error("Choose who to unblock.");
    const id = pairId(blockerUid, blockedUid);
    await db.collection("userBlocks").doc(id).set({
      active: false,
      unblockedBy: blockerUid,
      unblockedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    return {blockId: id};
  }

  root.FLOQRBlocks = {
    pairId,
    loadActiveBlocks,
    blockedUidSet,
    isBlockedEitherWay,
    isBlockedPair,
    unMinglBlock,
    unblockUser
  };
})(typeof window !== "undefined" ? window : globalThis);
