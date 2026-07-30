/* Shared WebRTC helpers for supRstar (phone broadcaster ↔ venue display2). */
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

  function isMobileLike() {
    try {
      if (navigator.userAgentData?.mobile === true) return true;
    } catch (_) {}
    const ua = String(navigator.userAgent || "");
    return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)
      || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
  }

  async function getCameraStream({audio = true, facingMode = "user", deviceId = ""} = {}) {
    const video = deviceId
      ? {deviceId: {exact: deviceId}, width: {ideal: 1280}, height: {ideal: 720}, aspectRatio: {ideal: 16 / 9}}
      : {
          facingMode: {ideal: facingMode || "user"},
          width: {ideal: 1280},
          height: {ideal: 720},
          aspectRatio: {ideal: 16 / 9}
        };
    return navigator.mediaDevices.getUserMedia({
      video,
      audio: !!audio
    });
  }

  async function switchCameraFacing(currentStream, {facingMode = "environment", audio = true} = {}) {
    const next = await getCameraStream({audio, facingMode});
    if (currentStream) {
      currentStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
    }
    return next;
  }

  async function replaceBroadcastTracks(pc, stream) {
    if (!pc || !stream) return;
    const senders = pc.getSenders?.() || [];
    for (const track of stream.getTracks()) {
      const sender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, stream);
    }
  }

  function stopStream(stream) {
    if (!stream) return;
    try {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
    } catch (_) {}
  }

  function wireIce(pc, sessionRef, collectionName) {
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sessionRef.collection(collectionName).add(ev.candidate.toJSON()).catch(() => {});
    };
  }

  /**
   * Broadcaster (phone): publish local stream; renegotiate when display reconnects with a new answer.
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

    async function publishOffer(peer) {
      wireIce(peer, sessionRef, "callerCandidates");
      listenCalleeIce(peer);
      peer.onconnectionstatechange = () => onStatus?.(peer.connectionState);
      const offer = await peer.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
      await peer.setLocalDescription(offer);
      await sessionRef.set({
        offer: {type: offer.type, sdp: offer.sdp},
        answer: null,
        status: "offering",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      lastAnswerSdp = "";
      onStatus?.("offering");
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
          status: "connected",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, {merge: true});
        onStatus?.("connected");
      } catch (e) {
        lastAnswerSdp = "";
        onStatus?.(`answer-error:${e.message}`);
      }
    });

    return {
      get pc() { return pc; },
      get stream() { return activeStream; },
      async replaceStream(nextStream) {
        activeStream = nextStream;
        await replaceBroadcastTracks(pc, nextStream);
      },
      stop({stopTracks = false} = {}) {
        unsubSession();
        if (unsubCallee) unsubCallee();
        try { pc.close(); } catch (_) {}
        if (stopTracks) stopStream(activeStream);
      }
    };
  }

  function forceVideoPlay(videoEl) {
    if (!videoEl) return;
    videoEl.muted = true;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("muted", "");
    videoEl.setAttribute("autoplay", "");
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");
    videoEl.controls = false;
    const tryPlay = () => videoEl.play?.().catch(() => {});
    tryPlay();
    videoEl.onloadedmetadata = tryPlay;
    videoEl.oncanplay = tryPlay;
  }

  /**
   * Display (venue display2.html): receive offer, answer, render remote stream.
   */
  async function joinAsDisplay({sessionId, videoEl, onStatus}) {
    let pc = createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);
    let lastOfferSdp = "";
    let unsubCaller = null;

    function bindTrack(peer) {
      peer.ontrack = (ev) => {
        const remote = ev.streams?.[0] || new MediaStream([ev.track]);
        if (videoEl && remote) {
          videoEl.srcObject = remote;
          forceVideoPlay(videoEl);
        }
        onStatus?.("track");
      };
    }

    function listenCallerIce(peer) {
      if (unsubCaller) unsubCaller();
      unsubCaller = sessionRef.collection("callerCandidates").onSnapshot((qs) => {
        qs.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          peer.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
        });
      });
    }

    async function answerOffer(offer) {
      try { pc.close(); } catch (_) {}
      pc = createPeer();
      // Ensure we can receive A/V even if offer m-lines are sparse.
      try {
        pc.addTransceiver("video", {direction: "recvonly"});
        pc.addTransceiver("audio", {direction: "recvonly"});
      } catch (_) {}
      bindTrack(pc);
      wireIce(pc, sessionRef, "calleeCandidates");
      listenCallerIce(pc);
      pc.onconnectionstatechange = () => onStatus?.(pc.connectionState);

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sessionRef.set({
        answer: {type: answer.type, sdp: answer.sdp},
        status: "connected",
        answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      onStatus?.("answered");
    }

    bindTrack(pc);
    wireIce(pc, sessionRef, "calleeCandidates");
    listenCallerIce(pc);
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState);
    forceVideoPlay(videoEl);

    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (data.status === "ended") {
        onStatus?.("ended");
        return;
      }
      if (!data.offer?.sdp) return;
      if (data.offer.sdp === lastOfferSdp) return;
      lastOfferSdp = data.offer.sdp;
      try {
        await answerOffer(data.offer);
      } catch (e) {
        lastOfferSdp = "";
        onStatus?.(`offer-error:${e.message}`);
      }
    });

    return {
      get pc() { return pc; },
      stop() {
        unsubSession();
        if (unsubCaller) unsubCaller();
        try { pc.close(); } catch (_) {}
        if (videoEl) videoEl.srcObject = null;
      }
    };
  }

  global.FLOQRSuprstrRtc = {
    ICE_SERVERS,
    isMobileLike,
    getCameraStream,
    switchCameraFacing,
    replaceBroadcastTracks,
    stopStream,
    startBroadcast,
    joinAsDisplay,
    forceVideoPlay
  };
})(window);
