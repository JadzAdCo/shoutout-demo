"use strict";

/**
 * floqCast WebRTC / display wiring contract (workspace).
 * Reliability enhancements beyond this file are unpublished until asked.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = relativePath => fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

test("phone broadcaster and display2 share FLOQRFloqCastRtc helpers", () => {
  const rtc = read("floqcast-webrtc.js");
  assert.match(rtc, /async function startBroadcast/);
  assert.match(rtc, /async function joinAsDisplay/);
  assert.match(rtc, /global\.FLOQRFloqCastRtc\s*=/);
  assert.match(rtc, /collection\("suprstrSessions"\)/);
  assert.match(rtc, /Do NOT report "connected" here/);
  assert.match(rtc, /onStatus\?\.\("answered"/);
  assert.match(rtc, /renegotiate-error/);
  // After SDP answer, session.status must stay "connected" (not "answered") so callee ICE is allowed.
  assert.match(rtc, /status:\s*"connected"/);
  assert.doesNotMatch(rtc, /status:\s*"answered"/);
  assert.match(rtc, /displayJoins/);
  assert.match(rtc, /scheduleRebuild/);
  assert.match(rtc, /forceVideoPlay/);
  assert.match(rtc, /createUprightSendStream/);
  assert.match(rtc, /captureStream/);
});

test("display2 reattaches when peer dies and shows connecting status", () => {
  const display = read("display-floqcast.js");
  assert.match(display, /scheduleReattach/);
  assert.match(display, /floqcastLiveStatus/);
  assert.match(display, /Connecting to patron/);
  assert.match(display, /forceVideoPlay/);
  assert.match(display, /need-new-peer/);
});

test("preview warns when tab is hidden while live", () => {
  const preview = read("floqcast-preview.js");
  assert.match(preview, /visibilitychange/);
  assert.match(preview, /keep this phone tab open/);
  assert.match(preview, /renegotiate/);
});

test("floqCast preview arms duration only after stable ICE", () => {
  const preview = read("floqcast-preview.js");
  assert.match(preview, /armFloqCastLiveDuration/);
  assert.match(preview, /live_timer_arm_request/);
  assert.match(preview, /stable-ice-connected/);
  assert.match(preview, /CONNECT_ARM_DEBOUNCE_MS\s*=\s*2500/);
  assert.doesNotMatch(preview, /await endLive\(\{silent: true\}\)/);
});

test("floqCast Search mark SVG is well-formed UTF-8 (img-safe)", () => {
  const fs = require("node:fs");
  const bytes = fs.readFileSync(path.resolve(__dirname, "..", "images/floqcast-icon.svg"));
  assert.equal(bytes.includes(0x97), false, "must not contain Windows-1252 0x97 (breaks SVG-as-img)");
  assert.doesNotThrow(() => bytes.toString("utf8"));
  const svg = bytes.toString("utf8");
  assert.match(svg, /inlined, img-safe/);
  assert.match(svg, /viewBox="0 0 64 64"/);
});

test("display2 loads floqcast webrtc + display modules (location-only URL)", () => {
  const html = read("display2.html");
  assert.match(html, /Xibo URL: display2\.html\?location=/);
  assert.match(html, /floqcast-webrtc\.js\?v=/);
  assert.match(html, /display-floqcast\.js\?v=/);
  assert.match(html, /floqr-display-board" content="secondary"/);
  assert.doesNotMatch(html, /href=["'][^"']*display2\.html\?[^"']*v=/);
});

test("Display 1 never loads floqCast answer path (display2-only)", () => {
  const primary = read("display.html");
  assert.doesNotMatch(primary, /display-floqcast\.js/);
  assert.doesNotMatch(primary, /floqcast-webrtc\.js/);
  assert.match(primary, /display2-only/);
});

test("server + client force secondary live pointer for every site", () => {
  const fn = read("functions/floqcast-functions.js");
  const display = read("display-floqcast.js");
  const search = read("floqcast-search.js");
  const preview = read("floqcast-preview.js");
  assert.match(fn, /function boardFromRaw[\s\S]*?return "secondary"/);
  assert.match(fn, /function liveDocId[\s\S]*?__secondary/);
  assert.match(fn, /function displayPageForBoard[\s\S]*?return "display2\.html"/);
  assert.match(display, /\$\{id\}__secondary/);
  assert.match(display, /isFloqCastBoard/);
  assert.match(search, /displayBoard:\s*"secondary"/);
  assert.match(preview, /displayBoard:\s*"secondary"/);
});

test("display module watches legacy suprstrLive pointer and joins via FLOQRFloqCastRtc", () => {
  const display = read("display-floqcast.js");
  assert.match(display, /collection\("suprstrLive"\)/);
  assert.match(display, /FLOQRFloqCastRtc\.joinAsDisplay/);
  assert.match(display, /floqcastLiveOverlay/);
  assert.match(display, /id="floqcastLiveVideo"/);
  assert.match(display, /LIVE · floqCast/);
});

test("Go live stage button uses full-width stage-action CSS", () => {
  const css = read("floqcast-search.css");
  const preview = read("floqcast-preview.html");
  assert.match(css, /\.floqcast-stage-actions\s*\{/);
  assert.match(css, /\.floqcast-stage-actions\s+\.category-card\s*\{/);
  assert.match(css, /max-width:\s*420px/);
  assert.match(css, /\.floqcast-stage-actions\s+\.category-card:disabled\s*\{/);
  assert.match(preview, /class="queue-actions floqcast-stage-actions"/);
  assert.match(preview, /id="floqcastStageBtn"/);
});

test("floqCast functions keep deprecated callable aliases for one deploy cycle", () => {
  const fn = read("functions/floqcast-functions.js");
  assert.match(fn, /exports\.createFloqCastRequest/);
  assert.match(fn, /exports\.createSuprstarRequest\s*=\s*exports\.createFloqCastRequest/);
  assert.match(fn, /exports\.startSuprstrLive\s*=\s*exports\.startFloqCastLive/);
  assert.match(fn, /exports\.endSuprstrLive\s*=\s*exports\.endFloqCastLive/);
  assert.doesNotMatch(fn, /bands\.don@gmail\.com/);
});

test("legacy search/preview paths redirect to floqcast pages", () => {
  const search = read("suprstr-search.html");
  const preview = read("suprstar-preview.html");
  assert.match(search, /floqcast-search\.html/);
  assert.match(preview, /floqcast-preview\.html/);
});
