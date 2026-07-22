"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sharedDataPath = path.resolve(__dirname, "..", "shared-data.js");
const source = fs.readFileSync(sharedDataPath, "utf8");
const context = {window:{}};
vm.runInNewContext(source, context, {filename:sharedDataPath});

const recommendations = context.window.FLOQR_RECOMMENDATION_SEED_QUEUE || [];
const templates = Object.values(context.window.SHOUTOUT_TEMPLATES || {});

test("music-inspired recommendations are unique and await approval", () => {
  assert.equal(recommendations.length, 32);
  assert.equal(new Set(recommendations.map(item => item.id)).size, recommendations.length);
  recommendations.forEach(item => {
    assert.equal(item.status, "pending");
    assert.equal(item.rightsStatus, "original-non-lyrical");
    assert.match(item.rightsNote, /no song lyrics/i);
  });
});

test("recommendations fit every supported template's smallest shared ceiling", () => {
  recommendations.forEach(item => {
    assert.ok(item.mainText.length <= 20, `${item.id} main text is ${item.mainText.length} characters`);
    assert.ok(item.subText.length <= 16, `${item.id} subtext is ${item.subText.length} characters`);
  });
});

test("every published template allows patron background changes", () => {
  assert.ok(templates.length >= 30, `expected >= 30 templates, got ${templates.length}`);
  templates.forEach(template => {
    // Heist club exclusives and Soccer jersey backs lock art backgrounds.
    if ((template.scope === "Club" && String(template.id || "").startsWith("heist"))
      || template.layout === "soccer-jersey"
      || String(template.id || "").startsWith("soccer")) {
      assert.equal(template.backgroundEditable, false, `${template.id} art background must stay locked`);
      return;
    }
    assert.equal(template.backgroundEditable, true, `${template.id} background must be editable`);
  });
});
