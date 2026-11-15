"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const smart = require("./botdee-smartview-core");

test("mock catalog action hrefs are relative app paths without ?v=", () => {
  const catalog = smart.mockCatalog();
  const hrefs = [];
  catalog.forEach(row => (row.actions || []).forEach(action => hrefs.push(action.href)));
  assert.ok(hrefs.length >= 3, "expected actionable SmartViews");
  hrefs.forEach(href => {
    assert.doesNotMatch(href, /[?&]v=/, href);
    if (href.startsWith("http://") || href.startsWith("https://")) return;
    assert.match(href, /^\.\//, href);
    assert.doesNotMatch(href, /^https:\/\/www\.floqr\.app\/images\//, href);
  });
});

test("mock catalog venue + event link club public page", () => {
  const catalog = smart.mockCatalog();
  const expected = "./club-profile.html?location=temp-democlub-1";
  ["venue", "event"].forEach(kind => {
    const row = catalog.find(item => item.kind === kind);
    assert.ok(row?.actions?.some(a => a.href === expected), kind);
  });
});

test("botdee-smartview-mock.json matches live mockCatalog()", () => {
  const file = path.join(root, "botdee-smartview-mock.json");
  assert.ok(fs.existsSync(file), "commit botdee-smartview-mock.json");
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(payload.views, smart.mockCatalog());
});

test("client resolver and portal/master hosts wired", () => {
  assert.match(read("botdee-smartview.js"), /resolveSameOriginHref/);
  assert.match(read("botdee-smartview.js"), /wireActionLinks/);
  assert.match(read("botdee-upgrade-ui.js"), /botdee-smartview-mock\.json/);
  assert.match(read("patron-portal.html"), /id="botDeeSmartViewDemo"/);
  assert.match(read("master-admin.html"), /id="botDeeMasterSmartViewDemo"/);
  assert.match(read("master-admin-app.js"), /botDeeMasterSmartViewDemo/);
  assert.match(read("functions/botdee-upgrade-functions.js"), /isServerAdminAuth\(request\.auth\)/);
});