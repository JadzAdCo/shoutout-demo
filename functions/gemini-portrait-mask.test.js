"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {PNG} = require("pngjs");
const mask = require("./gemini-portrait-mask");

test("gemini-portrait-mask defaults to gemini-3.8-flash (env overrideable)", () => {
  assert.match(mask.SEGMENTATION_MODEL, /gemini-3\.8-flash/);
  assert.match(mask.LIMITATION, /coarse/i);
  assert.match(mask.LIMITATION, /not professional/i);
  assert.deepEqual(mask.thinkingConfigForModel("gemini-3.8-flash"), {thinkingLevel: "LOW"});
  assert.deepEqual(mask.thinkingConfigForModel("gemini-3.7-flash"), {thinkingLevel: "LOW"});
  assert.deepEqual(mask.thinkingConfigForModel("gemini-3.5-flash"), {thinkingLevel: "LOW"});
  assert.deepEqual(mask.thinkingConfigForModel("gemini-2.5-flash"), {thinkingBudget: 0});
  assert.equal(
    mask.isThinkingConfigRejected({message: "Thinking level MINIMAL is not supported for this model."}),
    true
  );
  assert.equal(mask.isThinkingConfigRejected({message: "quota exceeded"}), false);
});

test("parseSegmentationJson accepts array and wrapped shapes", () => {
  const items = mask.parseSegmentationJson('[{"box_2d":[10,20,80,70],"mask":"AAAA","label":"person"}]');
  assert.equal(items.length, 1);
  assert.equal(items[0].label, "person");
  const wrapped = mask.parseSegmentationJson('{"boxes":[{"box_2d":[0,0,100,100],"label":"human"}]}');
  assert.equal(wrapped[0].label, "human");
});

test("parseSegmentationJson repairs truncated object and extracts box_2d", () => {
  const truncated = 'Here you go:\n{"box_2d":[12,34,56,78],"label":"person","mask":"AAAA';
  const items = mask.parseSegmentationJson(truncated);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].box_2d, [12, 34, 56, 78]);
  assert.equal(items[0].label, "person");
});

test("pickPrimaryPerson prefers person-like labels", () => {
  const pick = mask.pickPrimaryPerson([
    {label: "tree", box_2d: [0, 0, 1, 1]},
    {label: "person", box_2d: [10, 10, 90, 90]}
  ]);
  assert.equal(pick.label, "person");
});

test("placeMaskInFrame maps box_2d mask into full-frame alpha PNG", () => {
  const tiny = new PNG({width: 4, height: 4, colorType: 6});
  for (let i = 0; i < tiny.data.length; i += 4) {
    tiny.data[i] = 200;
    tiny.data[i + 1] = 200;
    tiny.data[i + 2] = 200;
    tiny.data[i + 3] = 255;
  }
  // box covering left half of a 100×100 frame (0–1000 normalized)
  const placed = mask.placeMaskInFrame({
    sourceWidth: 100,
    sourceHeight: 100,
    box2d: [0, 0, 1000, 500],
    maskPng: tiny
  });
  assert.equal(placed.png.width, 100);
  assert.equal(placed.png.height, 100);
  assert.equal(placed.softEdges, true);
  // pixel inside box should have alpha > 0
  const inside = (100 * 10 + 10) << 2;
  assert.ok(placed.png.data[inside + 3] > 0);
  // pixel outside box stays transparent
  const outside = (100 * 10 + 90) << 2;
  assert.equal(placed.png.data[outside + 3], 0);
  const buf = mask.encodePng(placed.png);
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
});

test("readImageSize reads PNG IHDR", () => {
  const png = new PNG({width: 32, height: 48, colorType: 6});
  png.data.fill(0);
  const buf = PNG.sync.write(png);
  const size = mask.readImageSize(buf, "image/png");
  assert.equal(size.width, 32);
  assert.equal(size.height, 48);
});
