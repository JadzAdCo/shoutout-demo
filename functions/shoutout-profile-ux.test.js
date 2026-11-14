"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const FL = require(path.join(root, "floqr-feature-landing.js"));

function labelBlock(html, inputId) {
  const input = html.indexOf(`id="${inputId}"`);
  assert.ok(input > 0, `${inputId} present`);
  const start = html.lastIndexOf("<label", input);
  const end = html.indexOf("</label>", input);
  assert.ok(start >= 0 && end > start, `${inputId} lives in a label`);
  return html.slice(start, end);
}

test("openDaysLabel sorts weekdays and uses Oxford and", () => {
  const venue = FL.normalizeVenue("nights", {
    hoursStructured: { thu: "10pm", wed: "10pm", sat: "10pm", fri: "10pm" }
  });
  assert.equal(FL.openDaysLabel(venue), "Wed, Thu, Fri, and Sat");
  assert.equal(FL.joinAndList(["Wed", "Sat"]), "Wed and Sat");
  assert.equal(FL.weekdayIndex("thursday"), 4);
});

test("venue-picked splash skips the 5s hold when there is no paid creative", () => {
  const src = read("patron-app.js");
  const show = src.slice(src.indexOf("function showAdSplash("), src.indexOf("function renderSplashVenue("));
  assert.match(show, /if \(ad \|\| !venuePicked\)/);
  assert.match(show, /startSplashHold\(\)/);
  assert.match(src, /html\.floqr-shoutout-direct|#adSplashPage/);
});

test("index.html paints splash immediately for venue ShoutOut deep links", () => {
  const html = read("index.html");
  assert.match(html, /floqr-shoutout-direct/);
  assert.match(html, /__start==="shoutout"/);
  const css = read("styles.css");
  assert.match(css, /html\.floqr-shoutout-direct #landingPage\{display:none!important\}/);
  assert.match(css, /html\.floqr-shoutout-direct #adSplashPage\{display:block\}/);
});

test("showPage resets scroll and editor focus stays at the first input", () => {
  const src = read("patron-app.js");
  assert.match(src, /function resetPageScroll\(/);
  const show = src.slice(src.indexOf("function showPage("), src.indexOf("function showPage(") + 1600);
  assert.match(show, /resetPageScroll\(\)/);
  assert.match(show, /id === "editorPage"/);
  assert.match(show, /focusFirstEditorInput/);
  assert.match(src, /preventScroll:\s*true/);
});

test("FloqR / Mingl handle ? sits on the label row, not in the input bubble", () => {
  for (const [file, inputId] of [
    ["index.html", "profileUsername"],
    ["patron-portal.html", "editFloqrHandle"]
  ]) {
    const block = labelBlock(read(file), inputId);
    assert.match(block, /class="label-inline-row"/);
    assert.match(block, /data-floqr-help-id="help-floqr-handle"/);
    assert.match(block, /portal\.field\.floqrHandle/);
    assert.match(
      block,
      /<span class="label-inline-row">[\s\S]*data-floqr-help-id="help-floqr-handle"[\s\S]*<\/span>\s*<input id="/,
      `${file}: handle ? is on the label row; input is the next field`
    );
    assert.doesNotMatch(block, /id="(profileFloqrHandleHelp|editFloqrHandleHelp)"/);
  }
  const attach = read("help-attach.js");
  assert.match(attach, /function hydrateInlineHelpButtons\(/);
  assert.match(attach, /button\.floqr-help-popout\[data-floqr-help-id\]/);
  assert.match(read("botdee-help-repository.js"), /id:\s*"help-floqr-handle"/);
  assert.doesNotMatch(read("patron-app.js"), /attachHelpPopout\([^)]*HandleHelp/);
  assert.doesNotMatch(read("patron-portal-app.js"), /attachHelpPopout\([^)]*HandleHelp/);
});
