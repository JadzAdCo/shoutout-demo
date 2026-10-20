/* Shared WebRTC helpers for floqCast (phone broadcaster ↔ venue display2.html).
 * iPhone multi-lens: Safari does NOT expose Apple’s fused camera to the web.
 * Prefer Front / FaceTime; skip Continuity / Telephoto / Ultra Wide; reset zoom. */
(function (global) {
  "use strict";

  const ICE_SERVERS = [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"}
  ];

  const VIDEO_BASE = Object.freeze({
    width: {ideal: 1280},
    height: {ideal: 720},
    frameRate: {ideal: 30, max: 30}
  });

  function db() {
    return firebase.firestore();
  }

  function createPeer() {
    return new RTCPeerConnection({iceServers: ICE_SERVERS});
  }

  function labelOf(device) {
    return String(device?.label || "").toLowerCase();
  }

  /** Score videoinput devices for selfie floqCast. Higher = better. */
  function scoreVideoDevice(device) {
    const label = labelOf(device);
    if (!label) return 1; // unlabeled until permission — keep as candidate
    // Skip Mac Continuity / Desk View and rear / zoom lenses (common “forehead telephoto” look).
    if (/continuity\s*camera|desk\s*view|iphone\s*continuity/.test(label)) return -100;
    if (/telephoto|ultra\s*-?\s*wide|ultrawide|triple|dual\s*wide/.test(label)) return -50;
    if (/\b(back|rear|environment|world)\b/.test(label)) return -20;
    if (/front|facetime|true\s*-?\s*depth|user|selfie/.test(label)) return 100;
    return 5;
  }

  function pickPreferredVideoDevice(devices, {preferDeviceId = "", avoidDeviceId = ""} = {}) {
    const cams = (Array.isArray(devices) ? devices : [])
      .filter((d) => d && d.kind === "videoinput" && d.deviceId);
    if (!cams.length) return null;
    if (preferDeviceId && cams.some((d) => d.deviceId === preferDeviceId)) {
      return cams.find((d) => d.deviceId === preferDeviceId);
    }
    const ranked = cams
      .filter((d) => d.deviceId !== avoidDeviceId)
      .map((d) => ({device: d, score: scoreVideoDevice(d)}))
      .sort((a, b) => b.score - a.score || labelOf(a.device).localeCompare(labelOf(b.device)));
    const best = ranked[0];
    if (best && best.score >= 0) return best.device;
    return cams.find((d) => d.deviceId !== avoidDeviceId) || cams[0];
  }

  async function resetTrackZoom(track) {
    if (!track || typeof track.getCapabilities !== "function" || typeof track.applyConstraints !== "function") {
      return;
    }
    try {
      const caps = track.getCapabilities() || {};
      if (caps.zoom == null) return;
      const minZoom = typeof caps.zoom === "object" ? Number(caps.zoom.min) : 1;
      const zoom = Number.isFinite(minZoom) ? minZoom : 1;
      await track.applyConstraints({advanced: [{zoom}]});
    } catch (_) {
      /* zoom not writable on this browser */
    }
  }

  function stopStream(stream) {
    try {
      (stream?.getTracks?.() || []).forEach((t) => t.stop());
    } catch (_) {}
  }

  async function openWithConstraints(videoConstraints, audio) {
    return navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audio ? {echoCancellation: true, noiseSuppression: true} : false
    });
  }

  /**
   * Open the selfie camera for floqCast.
   * 1) Brief facingMode:user grant (unlocks device labels on iOS)
   * 2) Re-open preferred Front/FaceTime deviceId when enumerable
   * 3) Reset digital zoom when the track exposes it
   */
  async function getCameraStream({audio = true, deviceId = ""} = {}) {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Camera API unavailable in this browser.");
    }

    let stream = null;
    const wantAudio = !!audio;

    if (deviceId) {
      stream = await openWithConstraints({...VIDEO_BASE, deviceId: {exact: deviceId}}, wantAudio);
    } else {
      try {
        stream = await openWithConstraints({
          ...VIDEO_BASE,
          facingMode: {ideal: "user"}
        }, wantAudio);
      } catch (_) {
        stream = await openWithConstraints({...VIDEO_BASE, facingMode: "user"}, wantAudio);
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const currentId = stream.getVideoTracks()[0]?.getSettings?.()?.deviceId || "";
        const preferred = pickPreferredVideoDevice(devices, {preferDeviceId: ""});
        if (preferred?.deviceId && preferred.deviceId !== currentId && scoreVideoDevice(preferred) >= 100) {
          stopStream(stream);
          stream = await openWithConstraints({
            ...VIDEO_BASE,
            deviceId: {exact: preferred.deviceId}
          }, wantAudio);
        } else if (currentId) {
          const currentScore = scoreVideoDevice({
            kind: "videoinput",
            deviceId: currentId,
            label: stream.getVideoTracks()[0]?.label || ""
          });
          if (currentScore < 0) {
            const better = pickPreferredVideoDevice(devices, {avoidDeviceId: currentId});
            if (better?.deviceId && better.deviceId !== currentId && scoreVideoDevice(better) > currentScore) {
              stopStream(stream);
              stream = await openWithConstraints({
                ...VIDEO_BASE,
                deviceId: {exact: better.deviceId}
              }, wantAudio);
            }
          }
        }
      } catch (_) {
        /* keep first stream */
      }
    }

    const track = stream.getVideoTracks()[0];
    await resetTrackZoom(track);
    return stream;
  }

  async function listVideoDevices() {
    if (!navigator?.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === "videoinput" && d.deviceId)
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || "Camera",
        score: scoreVideoDevice(d)
      }))
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }

  /** Cycle to the next usable videoinput (skips Continuity / telephoto when alternatives exist). */
  async function switchCameraStream(currentStream, {audio = true} = {}) {
    const devices = await listVideoDevices();
    const usable = devices.filter((d) => d.score >= 0);
    const pool = usable.length ? usable : devices;
    if (pool.length < 2) {
      return {stream: currentStream, switched: false, label: currentStream?.getVideoTracks?.()[0]?.label || ""};
    }
    const currentId = currentStream?.getVideoTracks?.()[0]?.getSettings?.()?.deviceId || "";
    const idx = Math.max(0, pool.findIndex((d) => d.deviceId === currentId));
    const next = pool[(idx + 1) % pool.length];
    const stream = await getCameraStream({audio, deviceId: next.deviceId});
    stopStream(currentStream);
    return {stream, switched: true, label: next.label || stream.getVideoTracks()[0]?.label || "Camera"};
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
      async replaceStream(nextStream) {
        if (!nextStream || !pc) return false;
        const nextVideo = nextStream.getVideoTracks()[0] || null;
        const nextAudio = nextStream.getAudioTracks()[0] || null;
        const senders = pc.getSenders?.() || [];
        for (const sender of senders) {
          const kind = sender.track?.kind;
          if (kind === "video" && nextVideo) await sender.replaceTrack(nextVideo);
          if (kind === "audio" && nextAudio) await sender.replaceTrack(nextAudio);
        }
        activeStream = nextStream;
        return true;
      },
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
    listVideoDevices,
    switchCameraStream,
    scoreVideoDevice,
    pickPreferredVideoDevice,
    resetTrackZoom,
    startBroadcast,
    joinAsDisplay
  };

  if (typeof module === "object" && module.exports) {
    module.exports = global.FLOQRFloqCastRtc;
  }
})(typeof window !== "undefined" ? window : globalThis);
