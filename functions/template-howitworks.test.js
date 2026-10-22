"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadShared() {
  const ctx = {
    window: {},
    console,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    Date,
    JSON,
    RegExp,
    Error,
    Map,
    Set,
    Promise,
    document: {documentElement: {}, body: {}},
    navigator: {userAgent: ""}
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInNewContext(read("shared-data.js"), ctx, {timeout: 5000});
  return ctx.window;
}

test("Traditional template has revised description + per-size howitWorks", () => {
  const win = loadShared();
  const t = win.SHOUTOUT_TEMPLATES.blackwhite;
  assert.match(t.description, /antiquated club signs/);
  assert.doesNotMatch(t.description, /Default shared marquee lightbox/);
  assert.ok(t.howitWorks && typeof t.howitWorks === "object");
  for (const id of ["led-96x48", "led-64x48", "led-64x32"]) {
    assert.match(String(t.howitWorks[id] || ""), /PRESENTED BY FloqMedia/);
    assert.match(String(t.howitWorks[id] || ""), /6 seconds/);
  }
  assert.match(t.howitWorks["led-96x48"], /96×48/);
  assert.match(t.howitWorks["led-64x48"], /64×48/);
  assert.match(t.howitWorks["led-64x32"], /64×32/);
  assert.equal(typeof win.FLOQRTemplateCopy.howitWorks, "function");
  assert.match(win.FLOQRTemplateCopy.howitWorks(t, "led-64x32"), /10 characters/);
});

test("template select UI renders howitWorks datapoint", () => {
  const patron = read("patron-app.js");
  assert.match(patron, /FLOQRTemplateCopy\?\.howitWorks/);
  assert.match(patron, /template-select-howitworks/);
  assert.match(patron, /template\.howItWorks/);
  const css = read("styles.css");
  assert.match(css, /\.template-select-howitworks\{/);
  assert.match(css, /-webkit-line-clamp:2/);
  const i18n = read("floqr-i18n.js");
  assert.equal((i18n.match(/"template\.howItWorks":/g) || []).length, 11);
  const master = read("master-admin.html");
  assert.match(master, /id="templateManageHowitWorks96"/);
  assert.match(master, /id="templateManageHowitWorks64x48"/);
  assert.match(master, /id="templateManageHowitWorks64x32"/);
});
