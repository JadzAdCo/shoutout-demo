/* Shared WebRTC helpers for floqCast (phone broadcaster ↔ venue display2.html).
 * iPhone multi-lens: Safari does NOT expose Apple’s fused camera to the web.
 * Prefer Front / FaceTime; skip Continuity / Telephoto / Ultra Wide; reset zoom.
 *
 * Signaling note: never leave session.status as "answered" — Firestore rules and
 * callee ICE only accept waiting|offering|connected (plus answered after s3.1.91
 * for in-flight sessions). Use "connected" after SDP answer is applied. */
(function (global) {
  "use strict";

  /**
   * STUN always. TURN from FLOQR-owned Twilio Network Traversal (callable
   * getFloqCastIceServers) — not public OpenRelay. Cached ~50m client-side.
   * STUN-only often connects briefly then drops (~10s) on hard NAT.
   */
  const STUN_SERVERS = [
    {urls: "stun:stun.l.google.com:19302"},
    {urls: "stun:stun1.l.google.com:19302"}
  ];
  /** Fallback when callable unavailable (tests / offline). Prefer resolved TURN. */
  const ICE_SERVERS = STUN_SERVERS.slice();
  let iceServersCache = null;
  let iceServersCacheUntil = 0;
  let iceServersInflight = null;

  async function resolveIceServers() {
    const now = Date.now();
    if (iceServersCache && now < iceServersCacheUntil) return iceServersCache;
    if (iceServersInflight) return iceServersInflight;
    iceServersInflight = (async () => {
      try {
        if (typeof firebase === "undefined" || !firebase.app) throw new Error("no-firebase");
        const callable = firebase.app().functions("us-central1").httpsCallable("getFloqCastIceServers");
        const res = await callable({});
        const servers = Array.isArray(res?.data?.iceServers) ? res.data.iceServers : [];
        const ttlMs = Math.max(60_000, Math.min(3_600_000, Number(res?.data?.ttlMs) || 3_000_000));
        if (!servers.length) throw new Error("empty-ice");
        iceServersCache = servers;
        iceServersCacheUntil = Date.now() + ttlMs;
        return iceServersCache;
      } catch (_) {
        return STUN_SERVERS;
      } finally {
        iceServersInflight = null;
      }
    })();
    return iceServersInflight;
  }

  /**
   * Do NOT force 1280×720 landscape. On iPhone Safari that crops a 16:9 strip
   * (often the TOP of the portrait selfie sensor) into the WebRTC bitstream —
   * local <video> can still look upright via orientation metadata while
   * display2 shows forehead/ceiling only.
   * resizeMode:"none" asks the UA not to crop-and-scale the track (when supported).
   */
  const VIDEO_BASE = Object.freeze({
    frameRate: {ideal: 24, max: 30},
    resizeMode: "none"
  });

  const RECONNECT_DEBOUNCE_MS = 1800;
  /** Brief ICE "disconnected" blips are common; do not tear down a stable peer quickly. */
  const DISCONNECT_REBUILD_MS = 18000;
  /** After a successful ICE connect, wait longer before rebuild — avoids freeze→storm. */
  const DISCONNECT_REBUILD_AFTER_STABLE_MS = 45000;
  /** Prefer ICE restart before killing the peer after a prior stable link. */
  const ICE_RESTART_BEFORE_REBUILD_MS = 8000;
  /** Ignore displayJoins storms while media is still flowing. */
  const DISPLAY_JOIN_DEBOUNCE_MS = 12000;

  function db() {
    return firebase.firestore();
  }

  async function createPeer() {
    const iceServers = await resolveIceServers();
    return new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 4
    });
  }

  /** True when RTP still moves — hold through "disconnected" UI states. */
  async function peerMediaAlive(pc) {
    try {
      if (!pc?.getStats) return false;
      const stats = await pc.getStats();
      let bytes = 0;
      stats.forEach((r) => {
        if (!r) return;
        if (r.type === "outbound-rtp" || r.type === "inbound-rtp") {
          bytes += Number(r.bytesSent || 0) + Number(r.bytesReceived || 0);
        }
      });
      return bytes > 0;
    } catch (_) {
      return false;
    }
  }

  /** Extract a=ice-ufrag from SDP (first match). */
  function sdpIceUfrag(sdp) {
    const m = String(sdp || "").match(/a=ice-ufrag:([^\s\r\n]+)/i);
    return m ? String(m[1] || "").trim() : "";
  }

  /** Trickle ICE from a killed peer must not poison the live answer/offer ufrag. */
  function candidateMatchesUfrag(data, expectedUfrag) {
    const want = String(expectedUfrag || "").trim();
    if (!want) return true;
    const frag = String(
      data?.usernameFragment
      || (String(data?.candidate || "").match(/\bufrag\s+(\S+)/i) || [])[1]
      || ""
    ).trim();
    if (!frag) return true;
    return frag === want;
  }

  function iceCandidatePayload(candidate) {
    try {
      const raw = candidate?.toJSON?.() || {};
      const out = {};
      if (typeof raw.candidate === "string") out.candidate = raw.candidate;
      if (raw.sdpMid != null) out.sdpMid = raw.sdpMid;
      if (raw.sdpMLineIndex != null) out.sdpMLineIndex = raw.sdpMLineIndex;
      if (raw.usernameFragment != null) out.usernameFragment = raw.usernameFragment;
      return out.candidate ? out : null;
    } catch (_) {
      return null;
    }
  }

  /** Phone (signed-in broadcaster) wipes stale trickle docs before a new offer. */
  async function clearIceCollections(sessionRef) {
    if (!sessionRef) return;
    try {
      for (const col of ["callerCandidates", "calleeCandidates"]) {
        // eslint-disable-next-line no-await-in-loop
        const snap = await sessionRef.collection(col).limit(400).get();
        if (snap.empty) continue;
        const batch = db().batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        // eslint-disable-next-line no-await-in-loop
        await batch.commit();
      }
    } catch (_) {
      // Rules may block until deployed; filtering by ufrag still protects the peer.
    }
  }

  /** Prefer VP8 / H264 Constrained Baseline for iPhone → Chrome LED decode. */
  function preferInteropVideoCodecs(pc) {
    try {
      if (!pc?.getTransceivers || typeof RTCRtpSender?.getCapabilities !== "function") return;
      const caps = RTCRtpSender.getCapabilities("video");
      if (!caps?.codecs?.length) return;
      const rank = (c) => {
        const mime = String(c.mimeType || "").toLowerCase();
        const fmtp = String(c.sdpFmtpLine || "").toLowerCase();
        if (mime === "video/vp8") return 10;
        if (mime === "video/h264" && /profile-level-id=42e0/.test(fmtp)) return 20;
        if (mime === "video/h264") return 30;
        if (mime === "video/vp9") return 40;
        return 100;
      };
      const ordered = caps.codecs.slice().sort((a, b) => rank(a) - rank(b));
      pc.getTransceivers().forEach((t) => {
        const kind = t.receiver?.track?.kind || t.sender?.track?.kind || "";
        if (kind && kind !== "video") return;
        try { t.setCodecPreferences?.(ordered); } catch (_) {}
      });
    } catch (_) {}
  }

  async function prepareVideoTrack(track) {
    if (!track) return;
    try { track.contentHint = "motion"; } catch (_) {}
    await resetTrackZoom(track);
    // Re-assert no digital zoom / no UA crop when the browser exposes them.
    try {
      const caps = typeof track.getCapabilities === "function" ? (track.getCapabilities() || {}) : {};
      const advanced = [];
      if (caps.zoom != null) {
        const minZoom = typeof caps.zoom === "object" ? Number(caps.zoom.min) : 1;
        advanced.push({zoom: Number.isFinite(minZoom) ? minZoom : 1});
      }
      const constr = {resizeMode: "none"};
      if (advanced.length) constr.advanced = advanced;
      await track.applyConstraints(constr);
    } catch (_) {}
  }

  /**
   * Bake what the patron *sees* into WebRTC pixels.
   * Prefer the visible preview <video> (videoEl) — a hidden 2×2 clone often skips
   * iOS orientation, so canvas still encoded the landscape forehead strip.
   * Safari cannot fuse multi-lens (no Apple Continuity / dual-camera API on web).
   */
  function createUprightSendStream(sourceStream, {fps = 24, videoEl = null} = {}) {
    const ownsVideo = !videoEl;
    let video = videoEl;
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("muted", "");
      // Keep the fallback element large enough that Safari still applies orientation.
      video.style.cssText = "position:fixed;left:0;top:0;width:64px;height:64px;opacity:0.01;pointer-events:none;z-index:-1";
      try { document.body.appendChild(video); } catch (_) {}
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", {alpha: false, desynchronized: true});
    let raf = 0;
    let stopped = false;
    let outStream = null;
    let source = sourceStream;

    function paint() {
      if (stopped) return;
      const vw = video.videoWidth | 0;
      const vh = video.videoHeight | 0;
      if (vw > 0 && vh > 0 && ctx) {
        // Prefer portrait canvas when the element reports landscape metadata but
        // the visible box is portrait (common iOS mismatch). Still draw full frame.
        if (canvas.width !== vw || canvas.height !== vh) {
          canvas.width = vw;
          canvas.height = vh;
        }
        try {
          // drawImage from a visible playing <video> applies iOS orientation.
          ctx.drawImage(video, 0, 0, vw, vh);
        } catch (_) {}
        // iOS can pause the element while WebRTC stays "connected" → frozen LED frames.
        try {
          if (video.paused || video.ended) forceVideoPlay(video);
        } catch (_) {}
      }
      raf = requestAnimationFrame(paint);
    }

    function syncAudioTracks(fromStream) {
      if (!outStream || !fromStream) return;
      outStream.getAudioTracks().forEach((t) => {
        try { outStream.removeTrack(t); } catch (_) {}
      });
      fromStream.getAudioTracks().forEach((t) => {
        try { outStream.addTrack(t); } catch (_) {}
      });
    }

    return {
      async start() {
        if (ownsVideo) {
          video.srcObject = source;
          forceVideoPlay(video);
          try { await video.play(); } catch (_) {}
        } else {
          // Preview already owns srcObject — just ensure it is playing.
          forceVideoPlay(video);
          try { await video.play(); } catch (_) {}
        }
        for (let i = 0; i < 80 && !(video.videoWidth && video.videoHeight); i++) {
          await new Promise((r) => setTimeout(r, 50));
        }
        paint();
        const rate = Number(fps) > 0 ? Number(fps) : 24;
        outStream = canvas.captureStream(rate);
        syncAudioTracks(source);
        const vTrack = outStream.getVideoTracks()[0];
        try { if (vTrack) vTrack.contentHint = "motion"; } catch (_) {}
        return outStream;
      },
      get stream() { return outStream; },
      async replaceSource(nextStream) {
        if (!nextStream) return false;
        source = nextStream;
        if (ownsVideo) {
          video.srcObject = nextStream;
          forceVideoPlay(video);
          try { await video.play(); } catch (_) {}
        } else {
          // Caller updates preview video srcObject first; we only refresh audio.
          forceVideoPlay(video);
        }
        syncAudioTracks(nextStream);
        return true;
      },
      stop() {
        stopped = true;
        try { cancelAnimationFrame(raf); } catch (_) {}
        if (ownsVideo) {
          try { video.pause(); } catch (_) {}
          try { video.srcObject = null; } catch (_) {}
          try { video.remove(); } catch (_) {}
        }
        try {
          (outStream?.getVideoTracks?.() || []).forEach((t) => t.stop());
        } catch (_) {}
        outStream = null;
      }
    };
  }

  function forceVideoPlay(videoEl) {
    if (!videoEl) return;
    try {
      videoEl.muted = true;
      videoEl.setAttribute("muted", "");
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      const p = videoEl.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
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
    await prepareVideoTrack(track);
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

  /**
   * Cameras Switch may cycle: Front + Back are both allowed.
   * Continuity / Telephoto / Ultra Wide (score <= -50) stay excluded.
   * Previously only score>=0 was cycled, so Front↔Back was a silent no-op while
   * the button still showed (list.length > 1).
   */
  function switchCameraPool(devices) {
    const list = Array.isArray(devices) ? devices : [];
    const nonExotic = list.filter((d) => Number(d?.score) > -50 && d?.deviceId);
    if (nonExotic.length >= 2) return nonExotic;
    const fronts = list.filter((d) => Number(d?.score) >= 100 && d?.deviceId);
    return fronts.length >= 2 ? fronts : nonExotic;
  }

  async function openFacingStream(facing, audio) {
    try {
      return await openWithConstraints({...VIDEO_BASE, facingMode: {exact: facing}}, audio);
    } catch (_) {
      return openWithConstraints({...VIDEO_BASE, facingMode: {ideal: facing}}, audio);
    }
  }

  /** Cycle Front ↔ Back (and facingMode fallback when iOS exposes a single deviceId). */
  async function switchCameraStream(currentStream, {audio = true} = {}) {
    const wantAudio = !!audio;
    const devices = await listVideoDevices();
    const pool = switchCameraPool(devices);
    const currentTrack = currentStream?.getVideoTracks?.()[0] || null;
    const currentId = currentTrack?.getSettings?.()?.deviceId || "";
    const currentFacing = String(currentTrack?.getSettings?.()?.facingMode || "user").toLowerCase();
    const nextFacing = currentFacing === "environment" ? "user" : "environment";

    async function openNextByDevice(deviceId) {
      // iOS often needs the previous camera released before another opens.
      stopStream(currentStream);
      const stream = await getCameraStream({audio: wantAudio, deviceId});
      return stream;
    }

    if (pool.length >= 2) {
      const idx = Math.max(0, pool.findIndex((d) => d.deviceId === currentId));
      const next = pool[(idx + 1) % pool.length];
      if (next?.deviceId && next.deviceId !== currentId) {
        try {
          const stream = await openNextByDevice(next.deviceId);
          return {
            stream,
            switched: true,
            label: next.label || stream.getVideoTracks()[0]?.label || "Camera"
          };
        } catch (_) {
          /* fall through to facingMode toggle */
        }
      }
    }

    // facingMode toggle — works when Front/Back share one deviceId or device switch failed.
    try {
      stopStream(currentStream);
      const stream = await openFacingStream(nextFacing, wantAudio);
      await prepareVideoTrack(stream.getVideoTracks()[0]);
      return {
        stream,
        switched: true,
        label: stream.getVideoTracks()[0]?.label || nextFacing
      };
    } catch (err) {
      try {
        const stream = await getCameraStream({audio: wantAudio});
        return {
          stream,
          switched: false,
          label: stream.getVideoTracks()[0]?.label || "",
          reason: err?.message || "switch-failed"
        };
      } catch (_) {
        return {
          stream: currentStream,
          switched: false,
          label: currentTrack?.label || "",
          reason: err?.message || "switch-failed"
        };
      }
    }
  }

  /**
   * Publish local ICE. When deferUntilEnabled is true, candidates are buffered until
   * the answer write succeeds — a failed write-once must not flood calleeCandidates
   * with a dead peer's ufrag (that leaves the board on "Connecting to patron…").
   * Returns { flush, stop } so the caller can release the buffer or abort.
   */
  function wireIce(pc, sessionRef, collectionName, opts = {}) {
    const deferUntilEnabled = !!opts.deferUntilEnabled;
    let enabled = !deferUntilEnabled;
    let stopped = false;
    const pending = [];

    function publish(payload) {
      if (!payload || stopped) return;
      sessionRef.collection(collectionName).add(payload).catch(() => {});
    }

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || stopped) return;
      const payload = iceCandidatePayload(ev.candidate);
      if (!payload) return;
      if (!enabled) {
        pending.push(payload);
        return;
      }
      publish(payload);
    };

    return {
      enableAndFlush() {
        if (stopped) return;
        enabled = true;
        while (pending.length) publish(pending.shift());
      },
      stop() {
        stopped = true;
        enabled = false;
        pending.length = 0;
        try { pc.onicecandidate = null; } catch (_) {}
      }
    };
  }

  /**
   * Broadcaster (phone): publish local stream; renegotiate when display reconnects with a new answer.
   * Duration clock must arm on real ICE/peer connected — never on SDP answer alone.
   */
  async function startBroadcast({sessionId, stream, onStatus, videoEl = null}) {
    let pc = await createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);
    let lastAnswerSdp = "";
    let unsubCallee = null;
    let unsubJoins = null;
    let rebuilding = false;
    let stopped = false;
    let activeStream = stream; // raw camera (preview / switch)
    let sendStream = stream; // upright canvas stream for WebRTC (may equal activeStream)
    let upright = null;
    let reconnectTimer = null;
    let iceRestartTimer = null;
    let everIceConnected = false;
    let lastDisplayJoinAt = 0;
    let lastMediaBytes = 0;
    let lastMediaCheckAt = 0;

    // Bake what the visible preview shows into WebRTC pixels (iOS orientation).
    if (typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined"
        && typeof HTMLCanvasElement.prototype.captureStream === "function") {
      try {
        upright = createUprightSendStream(stream, {fps: 24, videoEl: videoEl || null});
        sendStream = await upright.start();
        if (!sendStream?.getVideoTracks?.().length) {
          upright.stop();
          upright = null;
          sendStream = stream;
        } else {
          onStatus?.("upright-canvas", {
            connectionState: "new",
            iceConnectionState: "new",
            fromPreview: !!videoEl
          });
        }
      } catch (_) {
        try { upright?.stop(); } catch (_) {}
        upright = null;
        sendStream = stream;
      }
    }

    function attachLocalTracks(peer, media) {
      const use = media || sendStream || activeStream;
      use.getTracks().forEach(track => peer.addTrack(track, use));
      preferInteropVideoCodecs(peer);
    }

    function listenCalleeIce(peer) {
      if (unsubCallee) unsubCallee();
      unsubCallee = sessionRef.collection("calleeCandidates").onSnapshot((qs) => {
        qs.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const data = change.doc.data() || {};
          // Ignore trickle from killed display peers (wrong answer ufrag).
          const answerUfrag = sdpIceUfrag(lastAnswerSdp || peer?.remoteDescription?.sdp || "");
          if (!candidateMatchesUfrag(data, answerUfrag)) return;
          peer.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
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
        signalingState: signaling,
        everIceConnected
      });
    }

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (iceRestartTimer) {
        clearTimeout(iceRestartTimer);
        iceRestartTimer = null;
      }
    }

    async function mediaStillFlowing() {
      try {
        const alive = await peerMediaAlive(pc);
        if (!alive) return false;
        // Prefer getStats delta when available so we know traffic is recent.
        const stats = await pc.getStats();
        let bytes = 0;
        stats.forEach((r) => {
          if (r?.type === "outbound-rtp") bytes += Number(r.bytesSent || 0);
          if (r?.type === "inbound-rtp") bytes += Number(r.bytesReceived || 0);
        });
        const now = Date.now();
        const prev = lastMediaBytes;
        const prevAt = lastMediaCheckAt;
        lastMediaBytes = bytes;
        lastMediaCheckAt = now;
        if (!prevAt) return bytes > 0;
        return bytes > prev;
      } catch (_) {
        return false;
      }
    }

    function tryIceRestart(reason) {
      if (stopped || rebuilding || !pc) return false;
      if (typeof pc.restartIce !== "function") return false;
      try {
        pc.restartIce();
        onStatus?.("ice-restart", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          reason: String(reason || "ice-restart")
        });
        return true;
      } catch (_) {
        return false;
      }
    }

    function scheduleRebuild(reason, waitMs) {
      if (stopped || rebuilding) return;
      clearReconnectTimer();
      const why = String(reason || "rebuild");
      // displayJoins while already stable: debounce hard — Xibo refresh storms were
      // scheduling 1.8s rebuilds that killed working peers during brief ICE blips.
      if (/display-join|stale-answer|rejoin/i.test(why) && everIceConnected) {
        const now = Date.now();
        if (now - lastDisplayJoinAt < DISPLAY_JOIN_DEBOUNCE_MS) {
          onStatus?.("join-ignored", {
            connectionState: pc?.connectionState,
            iceConnectionState: pc?.iceConnectionState,
            reason: why
          });
          return;
        }
        lastDisplayJoinAt = now;
      }
      const delay = Number.isFinite(waitMs) ? waitMs : RECONNECT_DEBOUNCE_MS;
      // After a prior stable link, try ICE restart first; only full rebuild if still dead.
      if (everIceConnected && /disconnected|failed|display-join/i.test(why)) {
        iceRestartTimer = setTimeout(async () => {
          iceRestartTimer = null;
          try {
            const ice = String(pc?.iceConnectionState || "");
            const conn = String(pc?.connectionState || "");
            if (ice === "connected" || ice === "completed" || conn === "connected") return;
            if (await mediaStillFlowing()) {
              onStatus?.("hold-media-alive", {connectionState: conn, iceConnectionState: ice, reason: why});
              return;
            }
            if (tryIceRestart(why)) {
              // Give restart time to recover before a hard peer rebuild.
              reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                const ice2 = String(pc?.iceConnectionState || "");
                const conn2 = String(pc?.connectionState || "");
                if (ice2 === "connected" || ice2 === "completed" || conn2 === "connected") return;
                rebuildOffer(`${why}+after-ice-restart`).catch((e) => onStatus?.(`renegotiate-error:${e.message}`));
              }, Math.max(delay, ICE_RESTART_BEFORE_REBUILD_MS));
              return;
            }
          } catch (_) { /* fall through to rebuild */ }
          rebuildOffer(why).catch((e) => onStatus?.(`renegotiate-error:${e.message}`));
        }, Math.min(delay, ICE_RESTART_BEFORE_REBUILD_MS));
        return;
      }
      reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        // Skip if ICE recovered during the wait (common after a freeze blip).
        try {
          const ice = String(pc?.iceConnectionState || "");
          const conn = String(pc?.connectionState || "");
          if (ice === "connected" || ice === "completed" || conn === "connected") return;
          if (everIceConnected && await mediaStillFlowing()) {
            onStatus?.("hold-media-alive", {connectionState: conn, iceConnectionState: ice, reason: why});
            return;
          }
        } catch (_) {}
        rebuildOffer(why).catch((e) => onStatus?.(`renegotiate-error:${e.message}`));
      }, delay);
    }

    function disconnectRebuildDelay() {
      return everIceConnected ? DISCONNECT_REBUILD_AFTER_STABLE_MS : DISCONNECT_REBUILD_MS;
    }

    async function rebuildOffer(reason) {
      if (stopped || rebuilding) return;
      rebuilding = true;
      try {
        try { pc.close(); } catch (_) {}
        pc = await createPeer();
        attachLocalTracks(pc, sendStream || activeStream);
        await publishOffer(pc);
        onStatus?.("renegotiating", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          reason: String(reason || "rebuild")
        });
      } finally {
        rebuilding = false;
      }
    }

    function wirePeerState(peer) {
      peer.onconnectionstatechange = () => {
        const state = String(peer.connectionState || "");
        emitPeerState(peer, state);
        // failed → rebuild soon. disconnected → long hold, especially after a prior stable link
        // (freeze→disconnect→immediate rebuild was causing reconnect errors).
        if (state === "failed") scheduleRebuild(state, everIceConnected ? ICE_RESTART_BEFORE_REBUILD_MS : RECONNECT_DEBOUNCE_MS);
        else if (state === "disconnected") scheduleRebuild(state, disconnectRebuildDelay());
        else if (state === "connected") clearReconnectTimer();
      };
      peer.oniceconnectionstatechange = () => {
        const ice = String(peer.iceConnectionState || "");
        if (ice === "connected" || ice === "completed") {
          everIceConnected = true;
          clearReconnectTimer();
          if (peer.connectionState === "connected") emitPeerState(peer, "connected");
          else emitPeerState(peer, `ice-${ice}`);
        } else if (ice === "failed" || ice === "disconnected" || ice === "closed") {
          emitPeerState(peer, ice === "failed" ? "failed" : ice);
          if (ice === "failed") scheduleRebuild(ice, everIceConnected ? ICE_RESTART_BEFORE_REBUILD_MS : RECONNECT_DEBOUNCE_MS);
          else if (ice === "disconnected") scheduleRebuild(ice, disconnectRebuildDelay());
        } else {
          emitPeerState(peer, peer.connectionState || ice);
        }
      };
    }

    async function publishOffer(peer) {
      lastAnswerSdp = "";
      // Drop stale trickle from prior peers before minting a new offer/ufrag.
      await clearIceCollections(sessionRef);
      wireIce(peer, sessionRef, "callerCandidates");
      listenCalleeIce(peer);
      wirePeerState(peer);
      const offer = await peer.createOffer({offerToReceiveAudio: false, offerToReceiveVideo: false});
      await peer.setLocalDescription(offer);
      // Clear answer so display2 can write a fresh answer (rules: answer write-once).
      // Keep status in {waiting,offering,connected} — never "answered" (blocks callee ICE).
      await sessionRef.set({
        offer: {type: offer.type, sdp: offer.sdp},
        answer: null,
        status: "offering",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge: true});
      onStatus?.("offering", {
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        signalingState: peer.signalingState
      });
    }

    function listenDisplayJoins() {
      if (unsubJoins) unsubJoins();
      unsubJoins = sessionRef.collection("displayJoins").onSnapshot((qs) => {
        qs.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const reason = change.doc.data()?.reason || "display-join";
          // After stable ICE, use long delay so a kiosk refresh does not kill video.
          scheduleRebuild(reason, everIceConnected ? DISCONNECT_REBUILD_AFTER_STABLE_MS : RECONNECT_DEBOUNCE_MS);
        });
      });
    }

    attachLocalTracks(pc, sendStream || activeStream);
    await publishOffer(pc);
    listenDisplayJoins();

    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (!data.answer?.sdp) return;
      if (data.answer.sdp === lastAnswerSdp) return;
      if (rebuilding || stopped) return;

      // Display re-joined after an old answer was already applied — rebuild peer + offer.
      if (pc.currentRemoteDescription) {
        scheduleRebuild("new-answer-while-set");
        return;
      }

      try {
        lastAnswerSdp = data.answer.sdp;
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        // Stay on "connected" so trickle ICE + renegotiate stay allowed by rules.
        await sessionRef.set({
          status: "connected",
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
        activeStream = nextStream;
        if (upright) {
          // Keep the same canvas video track on the peer; only retarget the source.
          await upright.replaceSource(nextStream);
          sendStream = upright.stream || sendStream;
          const nextAudio = nextStream.getAudioTracks()[0] || null;
          const senders = pc.getSenders?.() || [];
          for (const sender of senders) {
            if (sender.track?.kind === "audio" && nextAudio) await sender.replaceTrack(nextAudio);
          }
          return true;
        }
        const nextVideo = nextStream.getVideoTracks()[0] || null;
        const nextAudio = nextStream.getAudioTracks()[0] || null;
        const senders = pc.getSenders?.() || [];
        for (const sender of senders) {
          const kind = sender.track?.kind;
          if (kind === "video" && nextVideo) await sender.replaceTrack(nextVideo);
          if (kind === "audio" && nextAudio) await sender.replaceTrack(nextAudio);
        }
        sendStream = nextStream;
        return true;
      },
      async renegotiate(reason) {
        await rebuildOffer(reason || "manual");
      },
      stop({stopTracks = false} = {}) {
        stopped = true;
        clearReconnectTimer();
        unsubSession();
        if (unsubCallee) unsubCallee();
        if (unsubJoins) unsubJoins();
        try { pc.close(); } catch (_) {}
        try { upright?.stop(); } catch (_) {}
        upright = null;
        if (stopTracks && activeStream) {
          try { activeStream.getTracks().forEach(t => t.stop()); } catch (_) {}
        }
      }
    };
  }

  /**
   * Display (venue display2.html): watch session, set remote offer, send answer + ICE.
   * Re-answers whenever the broadcaster publishes a new offer (answer cleared).
   * If an answer already exists for the current offer, requests a displayJoins renegotiate.
   *
   * Critical: do NOT publish callee ICE until the answer write succeeds. A reattach race
   * that setLocalDescription then fails write-once still gathers ICE and poisons the
   * session with foreign ufrags — phone never completes ICE → "Connecting to patron…".
   */
  async function joinAsDisplay({sessionId, videoEl, onStatus}) {
    const pc = await createPeer();
    const sessionRef = db().collection("suprstrSessions").doc(sessionId);
    let answeredOfferSdp = "";
    let answering = false;
    let joinRequestedForOffer = "";
    let offerUfrag = "";
    const icePub = wireIce(pc, sessionRef, "calleeCandidates", {deferUntilEnabled: true});

    preferInteropVideoCodecs(pc);
    forceVideoPlay(videoEl);

    pc.ontrack = (ev) => {
      const [remote] = ev.streams;
      if (videoEl && remote) {
        videoEl.srcObject = remote;
        forceVideoPlay(videoEl);
      }
      onStatus?.("track", {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState
      });
    };
    pc.onconnectionstatechange = () => onStatus?.(pc.connectionState, {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState
    });
    pc.oniceconnectionstatechange = () => {
      const ice = String(pc.iceConnectionState || "");
      if (ice === "connected" || ice === "completed") {
        onStatus?.(pc.connectionState === "connected" ? "connected" : `ice-${ice}`, {
          connectionState: pc.connectionState,
          iceConnectionState: ice
        });
      } else if (ice === "failed" || ice === "disconnected" || ice === "closed") {
        onStatus?.(ice, {
          connectionState: pc.connectionState,
          iceConnectionState: ice
        });
      }
    };

    async function requestDisplayJoin(reason, offerSdp) {
      if (offerSdp && joinRequestedForOffer === offerSdp) return;
      joinRequestedForOffer = offerSdp || joinRequestedForOffer;
      try {
        // Prefer client Timestamp — some kiosk WebViews mishandle serverTimestamp sentinels
        // against keys().hasOnly(["reason","at"]) rules.
        const at = firebase.firestore.Timestamp?.now?.()
          || firebase.firestore.FieldValue.serverTimestamp();
        await sessionRef.collection("displayJoins").add({
          reason: String(reason || "rejoin").slice(0, 64),
          at
        });
        onStatus?.("rejoin-requested", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState
        });
      } catch (e) {
        onStatus?.(`rejoin-error:${e.message}`);
      }
    }

    async function answerOffer(offer) {
      const offerSdp = String(offer?.sdp || "");
      if (!offerSdp || answering) return;
      if (answeredOfferSdp === offerSdp && pc.currentRemoteDescription) return;
      answering = true;
      try {
        if (pc.signalingState !== "stable" && pc.currentRemoteDescription) {
          // Need a fresh peer for a second offer — parent will stop + rejoin.
          onStatus?.("need-new-peer", {connectionState: pc.connectionState});
          return;
        }
        // Fresh read avoids double-answer race: two attaches both see answer=null.
        const fresh = await sessionRef.get();
        const freshData = fresh.data() || {};
        if (freshData.answer?.sdp) {
          await requestDisplayJoin("stale-answer", offerSdp);
          return;
        }
        offerUfrag = sdpIceUfrag(offerSdp);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        try {
          await sessionRef.set({
            answer: {type: answer.type, sdp: answer.sdp},
            status: "connected",
            answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, {merge: true});
        } catch (writeErr) {
          // Write-once lost the race — drop buffered ICE; never publish this ufrag.
          icePub.stop();
          answeredOfferSdp = "";
          onStatus?.(`offer-error:${writeErr.message}`);
          await requestDisplayJoin("answer-blocked", offerSdp);
          return;
        }
        answeredOfferSdp = offerSdp;
        icePub.enableAndFlush();
        // Signaling only — peer connected comes from connectionState.
        onStatus?.("answered", {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState
        });
      } catch (e) {
        icePub.stop();
        answeredOfferSdp = "";
        onStatus?.(`offer-error:${e.message}`);
        // Answer write-once: existing answer blocks us — ask phone to clear + republish.
        await requestDisplayJoin("answer-blocked", offerSdp);
      } finally {
        answering = false;
      }
    }

    const unsubSession = sessionRef.onSnapshot(async (snap) => {
      const data = snap.data() || {};
      if (data.status === "ended") {
        onStatus?.("ended");
        return;
      }
      const offer = data.offer;
      if (!offer?.sdp) return;
      const offerSdp = String(offer.sdp);
      const existingAnswer = data.answer?.sdp ? String(data.answer.sdp) : "";

      // Stale answer from a previous display instance — request renegotiate instead of failing rules.
      // Do not setLocalDescription (would gather foreign ICE ufrags).
      if (existingAnswer && answeredOfferSdp !== offerSdp && !pc.currentRemoteDescription) {
        await requestDisplayJoin("stale-answer", offerSdp);
        return;
      }

      if (!existingAnswer || answeredOfferSdp === offerSdp) {
        await answerOffer(offer);
      }
    });

    const unsubCaller = sessionRef.collection("callerCandidates").onSnapshot((qs) => {
      qs.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const data = change.doc.data() || {};
        const want = offerUfrag || sdpIceUfrag(pc?.remoteDescription?.sdp || "");
        if (!candidateMatchesUfrag(data, want)) return;
        pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
      });
    });

    return {
      get pc() { return pc; },
      stop() {
        icePub.stop();
        unsubSession();
        unsubCaller();
        try { pc.close(); } catch (_) {}
        if (videoEl) videoEl.srcObject = null;
      }
    };
  }

  global.FLOQRFloqCastRtc = {
    ICE_SERVERS,
    STUN_SERVERS,
    resolveIceServers,
    peerMediaAlive,
    getCameraStream,
    listVideoDevices,
    switchCameraStream,
    switchCameraPool,
    scoreVideoDevice,
    pickPreferredVideoDevice,
    resetTrackZoom,
    prepareVideoTrack,
    preferInteropVideoCodecs,
    createUprightSendStream,
    forceVideoPlay,
    sdpIceUfrag,
    candidateMatchesUfrag,
    clearIceCollections,
    startBroadcast,
    joinAsDisplay
  };

  if (typeof module === "object" && module.exports) {
    module.exports = global.FLOQRFloqCastRtc;
  }
})(typeof window !== "undefined" ? window : globalThis);
