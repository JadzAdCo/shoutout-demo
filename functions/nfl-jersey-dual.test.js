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

test("NBA / Terps FloqMedia rail sits under the kit like NFL (never mid-jersey)", () => {
  const css = fs.readFileSync(path.join(root, "display.css"), "utf8");
  assert.match(css, /\.display-canvas\.soccer-jersey-template\.jersey-sport-nba\.jersey-photo-back \.display-identity-rail\.soccer-jersey-rail/);
  assert.match(css, /jersey-sport-nba[\s\S]{0,900}?bottom:1\.2%!important/);
  // Portrait tanks fit by height so the hem stays on-board and FloqMedia is not mid-kit.
  assert.match(css, /soccer-jersey-template\.jersey-sport-nba\.jersey-photo-back \.display-background/);
  assert.match(css, /background-size:\s*auto var\(--nba-kit-h/);
  assert.match(css, /--nba-kit-h:\s*86%/);
  const js = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
  assert.match(js, /clearClassicBoardRemnantsOnJersey/);
  assert.match(js, /isSeasonalBoardRemnantText/);
  assert.match(js, /function nbaPhotoKitLayout/);
  assert.match(js, /function pinJerseyFloqMediaRail/);
  assert.match(js, /function clearNbaPhotoKitInlineLayout/);
  assert.match(js, /pinJerseyFloqMediaRail\(rail,\s*\{sport\}/);
  assert.match(js, /kit\.kitTop \+ nameSpec\.top \* kit\.kitH/);
  // Soccer must clear a prior NBA/NFL inline FloqMedia pin.
  assert.match(js, /Soccer \(and any non-NBA\/NFL kit\) must drop a prior/);
  // Do not destroy the text overlay that owns the FloqMedia rail.
  assert.doesNotMatch(js, /halloween-finale,\s*\.display-text-overlay/);
});

test("display-app always dual-loops NFL photo kits and FloqR brand cycle", () => {
  const js = fs.readFileSync(path.join(root, "display-app.js"), "utf8");
  assert.match(js, /const nflDualActive = sport === "nfl" && usePhotoBack/);
  assert.match(js, /baseName = Math\.min\(7\.04/);
  assert.match(js, /baseNumber = Math\.min\(27/);
  assert.match(js, /baseClass: "display-identity-rail classic-bw-identity soccer-jersey-rail floqr-card-bottom"/);
  assert.match(js, /startFrameLoop\(canvas, refitNflShoutOnCopy\)/);
  assert.match(js, /rail\.parentElement !== canvas/);
  assert.match(js, /canvas\.appendChild\(rail\)/);
});

test("Club Admin approve stamps NFL photo background from packaged catalog", () => {
  const js = fs.readFileSync(path.join(root, "admin-app.js"), "utf8");
  assert.match(js, /resolvedBackgroundUrl = boardUrl\(item\.backgroundUrl\) \|\| boardUrl\(packaged\.defaultBackgroundUrl\)/);
  assert.match(js, /nflDualLayout: isNflDual/);
  assert.match(js, /layout: isNflDual \? "nfl-jersey"/);
});

test("display pages cache-bust NFL FloqR + FrameLoop fix", () => {
  const display = fs.readFileSync(path.join(root, "display.html"), "utf8");
  const display2 = fs.readFileSync(path.join(root, "display2.html"), "utf8");
  assert.match(display, /display\.css\?v=s3\.\d+\.\d+/);
  assert.match(display, /display-app\.js\?v=s3\.\d+\.\d+/);
  assert.match(display, /floqr-frame-loop\.js\?v=s3\.\d+\.\d+/);
  assert.match(display2, /display\.css\?v=s3\.\d+\.\d+/);
  assert.match(display2, /display-app\.js\?v=s3\.\d+\.\d+/);
  assert.match(display2, /floqr-frame-loop\.js\?v=s3\.\d+\.\d+/);
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