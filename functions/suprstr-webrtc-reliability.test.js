"use strict";

/**
 * Workspace contract for unpublished supRstar WebRTC reliability work.
 * Do not treat this as a Pages/main gate until those files are published.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("phone broadcaster renegotiates when display2 reconnects with a new answer", () => {
  const rtc = read("suprstr-webrtc.js");
  assert.match(rtc, /async function startBroadcast/);
  assert.match(rtc, /if \(pc\.currentRemoteDescription\)/);
  assert.match(rtc, /rebuilding = true/);
  assert.match(rtc, /await publishOffer\(pc\)/);
  assert.match(rtc, /lastAnswerSdp/);
  assert.match(rtc, /answer: null/);
  assert.match(rtc, /phone broadcaster ↔ venue display2/);
});

test("display2 re-answers when the offer SDP changes after a board reconnect", () => {
  const rtc = read("suprstr-webrtc.js");
  assert.match(rtc, /async function joinAsDisplay/);
  assert.match(rtc, /async function answerOffer\(offer\)/);
  assert.match(rtc, /lastOfferSdp/);
  assert.match(rtc, /pc\.addTransceiver\("video", \{direction: "recvonly"\}\)/);
  assert.match(rtc, /pc\.addTransceiver\("audio", \{direction: "recvonly"\}\)/);
  assert.match(rtc, /if \(data\.offer\.sdp === lastOfferSdp\) return/);
});

test("kiosk muted autoplay is forced on the live video element", () => {
  const rtc = read("suprstr-webrtc.js");
  const display = read("display-suprstr.js");
  assert.match(rtc, /function forceVideoPlay\(videoEl\)/);
  assert.match(rtc, /videoEl\.muted = true/);
  assert.match(rtc, /webkit-playsinline/);
  assert.match(rtc, /forceVideoPlay/);
  assert.match(display, /webkit-playsinline/);
  assert.match(display, /FLOQRSuprstrRtc\.forceVideoPlay/);
  assert.match(display, /document\.addEventListener\("touchstart", unlock/);
});

test("display2 overlay reports Connecting, Linked, and errors", () => {
  const display = read("display-suprstr.js");
  const html = read("display2.html");
  assert.match(html, /<meta name="floqr-display-board" content="secondary"\/>/);
  assert.match(html, /display-suprstr\.js/);
  assert.match(html, /suprstr-webrtc\.js/);
  assert.match(display, /id="suprstrLiveStatus"/);
  assert.match(display, /Connecting…/);
  assert.match(display, /Connecting to patron…/);
  assert.match(display, /Linked — waiting for video…/);
  assert.match(display, /setLiveStatus\(String\(s\)\)/);
  assert.match(display, /meta\[name="floqr-display-board"\]/);
  assert.match(display, /Venue display2/);
  assert.match(display, /file === "display2\.html"/);
});

test("Go live stage button uses full-width stage-action CSS", () => {
  const css = read("suprstr-search.css");
  const preview = read("suprstar-preview.html");
  assert.match(css, /\.suprstar-stage-actions\{/);
  assert.match(css, /\.suprstar-stage-actions \.category-card\{/);
  assert.match(css, /max-width:420px/);
  assert.match(css, /\.suprstar-stage-actions \.category-card:disabled\{/);
  assert.match(preview, /class="queue-actions suprstar-stage-actions"/);
  assert.match(preview, /id="suprstarStageBtn"/);
});

test("supRstar functions default master-admin email list omits bands.don", () => {
  const fn = read("functions/suprstr-functions.js");
  assert.match(fn, /FLOQR_MASTER_ADMIN_EMAILS \|\| "bans\.don@gmail\.com,don\.b@jadzholdings\.com"/);
  assert.doesNotMatch(fn, /bands\.don@gmail\.com/);
});
