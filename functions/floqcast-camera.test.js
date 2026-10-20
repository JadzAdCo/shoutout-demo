/**
 * floqCast camera preference — Front/FaceTime over Continuity / telephoto / ultra-wide.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

// Browser IIFE also assigns module.exports when present.
const Rtc = require(path.join(__dirname, "..", "floqcast-webrtc.js"));

test("scores Front / FaceTime highest and Continuity / telephoto lowest", () => {
  assert.ok(Rtc.scoreVideoDevice({kind: "videoinput", deviceId: "1", label: "Front Camera"}) >= 100);
  assert.ok(Rtc.scoreVideoDevice({kind: "videoinput", deviceId: "2", label: "FaceTime HD Camera"}) >= 100);
  assert.ok(Rtc.scoreVideoDevice({kind: "videoinput", deviceId: "3", label: "Continuity Camera"}) < 0);
  assert.ok(Rtc.scoreVideoDevice({kind: "videoinput", deviceId: "4", label: "Back Dual Wide Camera"}) < 0);
  assert.ok(Rtc.scoreVideoDevice({kind: "videoinput", deviceId: "5", label: "Back Telephoto Camera"}) < 0);
});

test("pickPreferredVideoDevice prefers FaceTime over Continuity", () => {
  const pick = Rtc.pickPreferredVideoDevice([
    {kind: "videoinput", deviceId: "c", label: "Continuity Camera"},
    {kind: "videoinput", deviceId: "f", label: "Front Camera"},
    {kind: "audioinput", deviceId: "a", label: "Mic"}
  ]);
  assert.equal(pick.deviceId, "f");
});

test("preview + board CSS use object-fit contain (no cover crop)", () => {
  const previewCss = fs.readFileSync(path.join(__dirname, "..", "floqcast-search.css"), "utf8");
  const displayCss = fs.readFileSync(path.join(__dirname, "..", "display.css"), "utf8");
  assert.match(previewCss, /\.floqcast-preview\s*\{[\s\S]*?object-fit:\s*contain/i);
  assert.doesNotMatch(previewCss, /\.floqcast-preview\s*\{[\s\S]*?object-fit:\s*cover/i);
  assert.match(displayCss, /\.floqcast-live-video\s*\{[\s\S]*?object-fit:\s*contain/i);
});

test("preview page exposes Switch camera and camera helper exports", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "floqcast-preview.html"), "utf8");
  const previewJs = fs.readFileSync(path.join(__dirname, "..", "floqcast-preview.js"), "utf8");
  assert.match(html, /floqcastSwitchCameraBtn/);
  assert.match(previewJs, /switchCameraStream/);
  assert.match(previewJs, /replaceStream/);
  assert.equal(typeof Rtc.getCameraStream, "function");
  assert.equal(typeof Rtc.switchCameraStream, "function");
});

test("preview HTML has no mojibake arrows", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "floqcast-preview.html"), "utf8");
  assert.doesNotMatch(html, /â†’|â€”|â€/);
  assert.match(html, /preview → pay/);
});
