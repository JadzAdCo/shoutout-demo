"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const fit = require("../floqr-board-fit.js");
const frame = require("../floqr-board-frame.js");

const read = rel => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

test("A: Firestore board size wins over packaged shared-data values", () => {
  const packaged = {
    locationName: "Zebbies",
    primaryDisplayScreenFormatId: "led-96x48",
    secondaryDisplayScreenFormatId: "led-96x48",
    displayScreenFormatIds: ["led-96x48", "led-64x48"],
    VenueSupports96x48: 1,
    VenueSupports64x48: 1,
    VenueSupports64x32: 0
  };
  const live = {
    primaryDisplayScreenFormatId: "led-64x32",
    secondaryDisplayScreenFormatId: "led-64x48",
    displayScreenFormatIds: ["led-64x32", "led-64x48"],
    VenueSupports96x48: 0,
    VenueSupports64x32: "1"
  };
  const merged = fit.mergeVenueForDisplay(packaged, live);
  assert.equal(merged.primaryDisplayScreenFormatId, "led-64x32");
  assert.equal(merged.secondaryDisplayScreenFormatId, "led-64x48");
  assert.deepEqual(merged.displayScreenFormatIds, ["led-64x32", "led-64x48"]);
  assert.equal(merged.VenueSupports96x48, 0);
  assert.equal(merged.VenueSupports64x32, 1);
  assert.equal(merged.VenueSupports64x48, 1, "packaged fills a flag Firestore does not set");
  assert.equal(merged.locationName, "Zebbies");
  assert.deepEqual(fit.effectiveBoardSize(packaged, live), {formatId: "led-64x32", source: "firestore"});
});

test("A: packaged values only fill gaps", () => {
  const packaged = {primaryDisplayScreenFormatId: "led-96x48", displayScreenFormatIds: ["led-96x48"], VenueSupports96x48: 1};
  const merged = fit.mergeVenueForDisplay(packaged, {displayScreenFormatIds: [], VenueSupports96x48: null});
  assert.equal(merged.primaryDisplayScreenFormatId, "led-96x48");
  assert.equal(merged.secondaryDisplayScreenFormatId, "led-96x48", "secondary falls back to primary");
  assert.deepEqual(merged.displayScreenFormatIds, ["led-96x48"]);
  assert.equal(merged.VenueSupports96x48, 1);
  assert.equal(fit.effectiveBoardSize(packaged, {}).source, "packaged");
  assert.equal(fit.mergeVenueForDisplay({}, {displayType: "led-64x48"}).primaryDisplayScreenFormatId, "led-64x48");
});

test("B: only approved/live ShoutOuts with copy or media render", () => {
  assert.equal(fit.liveContentDecision({status: "approved", mainText: "HI"}), "live");
  assert.equal(fit.liveContentDecision({status: "LIVE", mediaUrl: "https://x/y.jpg"}), "live");
  for (const status of ["pending", "rejected", "played", "expired", "preview", "default", "", undefined]) {
    assert.equal(fit.liveContentDecision({status, mainText: "HI"}), "idle", `status ${status}`);
  }
  assert.equal(fit.liveContentDecision({status: "approved", mainText: "   "}), "idle");
  assert.equal(fit.liveContentDecision(null), "idle");
});

test("B: expiry fallback chain", () => {
  const ts = ms => ({toMillis: () => ms});
  assert.deepEqual(fit.liveExpiryMillis({expiresAt: ts(5000), approvedAt: ts(1000)}), {expiresMs: 5000, source: "explicit"});
  assert.deepEqual(fit.liveExpiryMillis({liveUntil: {seconds: 7}}), {expiresMs: 7000, source: "explicit"});
  assert.deepEqual(fit.liveExpiryMillis({playedUntil: 9000}), {expiresMs: 9000, source: "explicit"});
  assert.deepEqual(fit.liveExpiryMillis({approvedAt: ts(1000), displayDurationSeconds: 30}), {expiresMs: 31000, source: "approvedAt"});
  assert.deepEqual(fit.liveExpiryMillis({updatedAt: ts(2000)}), {expiresMs: 2000 + 600000, source: "updatedAt"});
  assert.deepEqual(fit.liveExpiryMillis({createdAt: "1970-01-01T00:00:03Z"}), {expiresMs: 3000 + 600000, source: "updatedAt"});
  assert.deepEqual(fit.liveExpiryMillis({}, 4000), {expiresMs: 4000 + 600000, source: "firstSeen"});
  assert.equal(fit.DEFAULT_LIVE_SECONDS, 600);
});

test("E: packWordsWithoutSplitting never splits or drops a word and fits maxRows", () => {
  const cases = [
    ["HAPPY BIRTHDAY TO MY GORGEOUS WIFE D", 3, 16],
    ["SUPERCALIFRAGILISTICEXPIALIDOCIOUS NIGHT", 3, 16],
    ["A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", 2, 10],
    ["CONGRATULATIONS", 1, 8]
  ];
  for (const [text, rows, soft] of cases) {
    const words = text.split(" ");
    const out = fit.packWordsWithoutSplitting(words, rows, soft);
    assert.ok(out.length <= rows, `${text} → ${out.length} rows`);
    assert.deepEqual(out.join(" ").split(" "), words, `${text} keeps every word whole and in order`);
  }
  assert.deepEqual(fit.packWordsWithoutSplitting([], 3, 16), [""]);
});

test("E: shrinkFactor keeps size when it fits inside the safe margin", () => {
  assert.equal(fit.SAFE_X, 0.04);
  assert.equal(fit.SAFE_Y, 0.06);
  assert.equal(fit.shrinkFactor(90, 40, 100, 100), 1);
  assert.equal(fit.shrinkFactor(92, 40, 100, 100), 1);
  assert.ok(Math.abs(fit.shrinkFactor(184, 40, 100, 100) - 0.5) < 1e-9, "92% usable width");
  assert.ok(Math.abs(fit.shrinkFactor(10, 176, 100, 100) - 0.5) < 1e-9, "88% usable height");
  assert.equal(fit.shrinkFactor(10000, 40, 100, 100), fit.MIN_SCALE);
});

test("preview: native board pixel sizes and centered scale", () => {
  assert.deepEqual(frame.sizeOf("led-96x48"), {formatId: "led-96x48", width: 624, height: 312});
  assert.deepEqual(frame.sizeOf("led-64x48"), {formatId: "led-64x48", width: 416, height: 312});
  assert.deepEqual(frame.sizeOf("p125-64x32"), {formatId: "led-64x32", width: 416, height: 208});
  assert.equal(frame.sizeOf("").formatId, "led-96x48");
  const half = frame.scaleFor(312, 400, 624, 312);
  assert.equal(half.scale, 0.5);
  assert.equal(half.offsetX, 0);
  assert.equal(half.offsetY, (400 - 156) / 2);
  const tall = frame.scaleFor(1000, 312, 416, 208);
  assert.equal(tall.scale, 1.5);
  assert.equal(tall.offsetX, (1000 - 624) / 2);
});

test("display-app wires board fit, live gate and Firestore-first venue merge", () => {
  const src = read("display-app.js");
  assert.match(src, /FLOQRBoardFit\.mergeVenueForDisplay\(packagedLoc, live\)/);
  assert.match(src, /loc = mergeLiveVenue\(packagedLoc, clubDoc\.data\(\) \|\| \{\}\)/);
  assert.doesNotMatch(src, /primaryDisplayScreenFormatId: packagedLoc\.primaryDisplayScreenFormatId \|\|/);
  assert.match(src, /FLOQRBoardFit\.liveContentDecision\(data\) === "live"/);
  assert.match(src, /const isIdleDoc = !doc\.exists \|\| isIdlePayload\(payload\) \|\| !isRenderableLiveContent\(payload\)/);
  assert.match(src, /floqr\.liveFirstSeen\.\$\{liveContentDocId\(locationId\)\}/);
  assert.match(src, /FLOQRBoardFit\.liveExpiryMillis\(/);
  assert.match(src, /FLOQRBoardFit\?\.scheduleFit\(canvas\)/);
  assert.match(src, /boardRowHtml\(row, classicFitStyle\(row, rows, mainSize\)\)/);
  assert.match(src, /hydrateUrlPreviewFromFirestore\(\)/);
  assert.doesNotMatch(src, /chars\.slice\(i, i \+ maxChars\)/, "words are never chopped into fixed-width pieces");
});

test("C stays untouched: classicFitStyle compact 64x32 sizing", () => {
  const src = read("display-app.js");
  assert.match(src, /const compact = \/64x32\/\.test\(screenFormatOverride \|\| loc\.primaryDisplayScreenFormatId \|\| ""\);/);
  assert.match(src, /\(compact \? 0\.82 : 1\)/);
});

test("display pages load board fit before display-app; Xibo URLs carry no ?v=", () => {
  for (const page of ["display.html", "display2.html"]) {
    const html = read(page);
    const fitAt = html.indexOf("floqr-board-fit.js");
    assert.ok(fitAt > 0, `${page} loads floqr-board-fit.js`);
    assert.ok(fitAt < html.indexOf("display-app.js"), `${page} loads it before display-app.js`);
    assert.doesNotMatch(html, /display2?\.html\?location=[^"'\s]*[?&]v=/);
  }
  assert.match(read("display.css"), /\.board-fit-run\{/);
});

test("preview frames use the board frame helper", () => {
  assert.match(read("patron-app.js"), /FLOQRBoardFrame\.mount\(frame, previewPayload\.screenFormatId\)/);
  assert.match(read("floqr-template-preview.js"), /FLOQRBoardFrame\.mount\(frame, formatId/);
  const index = read("index.html");
  assert.ok(index.indexOf("floqr-board-frame.js") > 0);
  assert.ok(index.indexOf("floqr-board-frame.js") < index.indexOf("patron-app.js"));
  assert.ok(index.indexOf("floqr-board-frame.js") < index.indexOf("floqr-template-preview.js"));
});
