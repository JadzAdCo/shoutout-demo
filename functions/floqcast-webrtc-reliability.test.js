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
