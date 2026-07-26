/* Shared WebRTC helpers for SupRstR (phone broadcaster ↔ venue display.html). */
(function (global) {
  "use strict";

  const ICE_SERVERS = [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"}
  ];

  function db() {
    return firebase.firestore();
  }

  function createPeer() {
    return new RTCPeerConnection({iceServers: ICE_SERVERS});
  }

  async function getCameraStream({audio = true} = {}) {
    return navigator.mediaDevices.getUserMedia({
      video: {facingMode: "user", width: {ideal: 1280}, height: {ideal: 720}},
      audio: !!audio
    });
  }

  /**
   * Broadcaster (phone): publish local stream to session; write offer; wait for answer + ICE.
   */
  async function startBroadcast({sessionId, stream, onStatus}) {
    const pc = createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sessionRef.collection("callerCandidates").add(ev.candidate.toJSON()).catch(() => {});
    };
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState);

    const offer = await pc.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
    await pc.setLocalDescription(offer);
    await sessionRef.set({
      offer: {type: offer.type, sdp: offer.sdp},
      status: "offering",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});

    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (!data.answer || pc.currentRemoteDescription) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await sessionRef.set({
          status: "connected",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge: true});
        onStatus?.("connected");
      } catch (e) {
        onStatus?.(`answer-error:${e.message}`);
      }
    });

    const unsubCallee = sessionRef.collection("calleeCandidates").onSnapshot((qs) => {
      qs.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      });
    });

    return {
      pc,
      stop() {
        unsubSession();
        unsubCallee();
        try { pc.close(); } catch (_) {}
      }
    };
  }

  /**
   * Display (venue display.html): watch session, set remote offer, send answer + ICE.
   */
  async function joinAsDisplay({sessionId, videoEl, onStatus}) {
    const pc = createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);

    pc.ontrack = (ev) => {
      const [remote] = ev.streams;
      if (videoEl && remote) {
        videoEl.srcObject = remote;
        videoEl.play?.().catch(() => {});
      }
      onStatus?.("track");
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sessionRef.collection("calleeCandidates").add(ev.candidate.toJSON()).catch(() => {});
    };
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState);

    let answered = false;
    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (data.status === "ended") {
        onStatus?.("ended");
        return;
      }
      if (!data.offer || answered) return;
      answered = true;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sessionRef.set({
          answer: {type: answer.type, sdp: answer.sdp},
          status: "connected",
          answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge: true});
        onStatus?.("answered");
      } catch (e) {
        answered = false;
        onStatus?.(`offer-error:${e.message}`);
      }
    });

    const unsubCaller = sessionRef.collection("callerCandidates").onSnapshot((qs) => {
      qs.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
      });
    });

    return {
      pc,
      stop() {
        unsubSession();
        unsubCaller();
        try { pc.close(); } catch (_) {}
        if (videoEl) videoEl.srcObject = null;
      }
    };
  }

  global.FLOQRSuprstrRtc = {
    ICE_SERVERS,
    getCameraStream,
    startBroadcast,
    joinAsDisplay
  };
})(window);
