/* Shared WebRTC helpers for floqCast (phone broadcaster ↔ venue display2.html). */
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

  function wireIce(pc, sessionRef, collectionName) {
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sessionRef.collection(collectionName).add(ev.candidate.toJSON()).catch(() => {});
    };
  }

  /**
   * Broadcaster (phone): publish local stream; renegotiate when display reconnects with a new answer.
   * Duration clock must arm on real ICE/peer connected — never on SDP answer alone.
   */
  async function startBroadcast({sessionId, stream, onStatus}) {
    let pc = createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);
    let lastAnswerSdp = "";
    let unsubCallee = null;
    let rebuilding = false;
    let activeStream = stream;

    function attachLocalTracks(peer, media) {
      (media || activeStream).getTracks().forEach(track => peer.addTrack(track, media || activeStream));
    }

    function listenCalleeIce(peer) {
      if (unsubCallee) unsubCallee();
      unsubCallee = sessionRef.collection("calleeCandidates").onSnapshot((qs) => {
        qs.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
        });
      });
    }

    function emitPeerState(peer, label) {
      const connectionState = String(peer?.connectionState || "");
      const ice = String(peer?.iceConnectionState || "");
      const signaling = String(peer?.signalingState || "");
      onStatus?.(label || connectionState || "unknown", {
        connectionState,
        iceConnectionState: ice,
        signalingState: signaling
      });
    }

    function wirePeerState(peer) {
      peer.onconnectionstatechange = () => emitPeerState(peer, peer.connectionState);
      peer.oniceconnectionstatechange = () => {
        const ice = String(peer.iceConnectionState || "");
        if (ice === "connected" || ice === "completed") {
          if (peer.connectionState === "connected") emitPeerState(peer, "connected");
          else emitPeerState(peer, `ice-${ice}`);
        } else if (ice === "failed" || ice === "disconnected" || ice === "closed") {
          emitPeerState(peer, ice === "failed" ? "failed" : ice);
        } else {
          emitPeerState(peer, peer.connectionState || ice);
        }
      };
    }

    async function publishOffer(peer) {
      wireIce(peer, sessionRef, "callerCandidates");
      listenCalleeIce(peer);
      wirePeerState(peer);
      const offer = await peer.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
      await peer.setLocalDescription(offer);
      await sessionRef.set({
        offer: {type: offer.type, sdp: offer.sdp},
        answer: null,
        status: "offering",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      lastAnswerSdp = "";
      onStatus?.("offering", {
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        signalingState: peer.signalingState
      });
    }

    attachLocalTracks(pc, activeStream);
    await publishOffer(pc);

    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (!data.answer?.sdp) return;
      if (data.answer.sdp === lastAnswerSdp) return;
      if (rebuilding) return;

      // Display re-joined after an old answer was already applied — rebuild peer + offer.
      if (pc.currentRemoteDescription) {
        rebuilding = true;
        try {
          try { pc.close(); } catch (_) {}
          pc = createPeer();
          attachLocalTracks(pc, activeStream);
          await publishOffer(pc);
        } catch (e) {
          onStatus?.(`renegotiate-error:${e.message}`);
        } finally {
          rebuilding = false;
        }
        return;
      }

      try {
        lastAnswerSdp = data.answer.sdp;
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await sessionRef.set({
          status: "answered",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge: true});
        // Signaling answer applied — ICE may still be connecting. Do NOT report "connected" here.
        onStatus?.("answered", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          signalingState: pc.signalingState
        });
      } catch (e) {
        lastAnswerSdp = "";
        onStatus?.(`answer-error:${e.message}`);
      }
    });

    return {
      get pc() { return pc; },
      get stream() { return activeStream; },
      stop({stopTracks = false} = {}) {
        unsubSession();
        if (unsubCallee) unsubCallee();
        try { pc.close(); } catch (_) {}
        if (stopTracks && activeStream) {
          try { activeStream.getTracks().forEach(t => t.stop()); } catch (_) {}
        }
      }
    };
  }

  /**
   * Display (venue display2.html): watch session, set remote offer, send answer + ICE.
   */
  async function joinAsDisplay({sessionId, videoEl, onStatus}) {
    const pc = createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);

    pc.ontrack = (ev) => {
      const [remote] = ev.streams;
      if (videoEl && remote) {
        videoEl.srcObject = remote;
        videoEl.muted = true;
        videoEl.play?.().catch(() => {});
      }
      onStatus?.("track", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState
      });
    };
    wireIce(pc, sessionRef, "calleeCandidates");
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState, {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState
    });

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
        // Signaling only — peer connected comes from connectionState.
        onStatus?.("answered", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState
        });
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
      get pc() { return pc; },
      stop() {
        unsubSession();
        unsubCaller();
        try { pc.close(); } catch (_) {}
        if (videoEl) videoEl.srcObject = null;
      }
    };
  }

  global.FLOQRFloqCastRtc = {
    ICE_SERVERS,
    getCameraStream,
    startBroadcast,
    joinAsDisplay
  };
})(window);
