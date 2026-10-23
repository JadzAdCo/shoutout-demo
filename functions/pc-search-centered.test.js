"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("PC Search field and composition are centered", () => {
  const searchCss = read("floqai-search.css");
  assert.match(searchCss, /\.category-floqai-search\{[\s\S]*?margin:\s*0 auto 18px/);
  const css = read("styles.css");
  assert.match(css, /html\.floqr-desktop-browser #categoryPage\.page\.active/);
  assert.match(css, /html\.floqr-desktop-browser \.app\{/);
  assert.match(css, /margin-left:\s*auto/);
  assert.match(css, /justify-content:\s*center/);
  assert.match(css, /@media\(min-width:1181px\)/);
  // Desktop must not keep the phone bottom-pin for the icon row
  const desktopBlock = css.slice(css.indexOf("html.floqr-desktop-browser #categoryPage.page.active .category-grid"));
  assert.match(desktopBlock, /margin-top:28px!important/);
  assert.doesNotMatch(desktopBlock.slice(0, 400), /margin-top:auto!important/);
  const adminCss = read("admin.css");
  assert.match(adminCss, /html\.floqr-desktop-browser \.admin-shell\{/);
  assert.match(adminCss, /max-width:\s*1180px/);
});
