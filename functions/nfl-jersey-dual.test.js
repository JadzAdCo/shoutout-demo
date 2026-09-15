"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("NFL photo CSS uses real-kit wider scale lock (+15% again)", () => {
  const css = fs.readFileSync(path.join(root, "display.css"), "utf8");
  assert.match(css, /background-size:\s*auto 93\.15%/);
  assert.match(css, /transform:\s*scaleX\(1\.520875\)/);
  assert.match(css, /height:\s*7\.04%/);
  assert.match(css, /height:\s*27%/);
  assert.match(css, /top:calc\(28% \+ var\(--nfl-photo-stack-y\)\)/);
  assert.match(css, /@keyframes\s+nflFloqrCardPulse/);
  assert.match(css, /animation:\s*nflFloqrCardPulse/);
});

test("display-app always dual-loops NFL photo kits and FloqR brand cycle", () => {
  const js = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
  assert.match(js, /const nflDualActive = sport === "nfl" && usePhotoBack/);
  assert.match(js, /baseName = Math\.min\(7\.04/);
  assert.match(js, /baseNumber = Math\.min\(27/);
  assert.match(js, /cycleWithBrand: !isIdleCta && \(nflDualActive \|\| !!cardValue\)/);
  assert.match(js, /startFrameLoop\(canvas, refitNflShoutOnCopy\)/);
  assert.match(js, /rail\.parentElement !== canvas/);
  assert.match(js, /canvas\.appendChild\(rail\)/);
});

test("Club Admin approve stamps NFL photo background from packaged catalog", () => {
  const js = fs.readFileSync(path.join(root, "admin-app.js"), "utf8");
  assert.match(js, /resolvedBackgroundUrl = item\.backgroundUrl \|\| packaged\.defaultBackgroundUrl/);
  assert.match(js, /nflDualLayout: isNflDual/);
  assert.match(js, /layout: isNflDual \? "nfl-jersey"/);
});

test("display pages cache-bust NFL FloqR + FrameLoop fix", () => {
  const display = fs.readFileSync(path.join(root, "display.html"), "utf8");
  const display2 = fs.readFileSync(path.join(root, "display2.html"), "utf8");
  assert.match(display, /display\.css\?v=s3\.0\.74/);
  assert.match(display, /display-app\.js\?v=s3\.0\.74/);
  assert.match(display, /floqr-frame-loop\.js\?v=s3\.0\.74/);
  assert.match(display2, /display\.css\?v=s3\.0\.74/);
  assert.match(display2, /display-app\.js\?v=s3\.0\.74/);
  assert.match(display2, /floqr-frame-loop\.js\?v=s3\.0\.74/);
});

test("FLOQRFrameLoop rebinds interval so media↔copy cannot stall", () => {
  const js = fs.readFileSync(path.join(root, "floqr-frame-loop.js"), "utf8");
  assert.match(js, /Always rebind the interval/);
  assert.match(js, /activeCanvas/);
  assert.match(js, /resumePhase/);
  // Factory must receive root — bare `root` inside factory() was ReferenceError and killed dual + FloqR.
  assert.match(js, /factory\(root\)/);
  assert.match(js, /function \(root\)/);
});

test("display-app FrameLoop start is try/caught so FloqR still paints", () => {
  const js = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
  assert.match(js, /FLOQRFrameLoop\.start failed; using fallback/);
  assert.match(js, /paint BEFORE FrameLoop/);
});