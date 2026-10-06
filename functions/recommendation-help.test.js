const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const IDS = ["help-shoutout-recommendations", "help-ai-recommendations", "help-trending-shoutouts", "help-generic-shoutouts"];

function recommendationsSection(html) {
  const start = html.indexOf("shoutout-recommendations-card");
  assert.ok(start > 0, "recommendations card present");
  const end = html.indexOf('id="shoutoutSuggestionBox"', start);
  assert.ok(end > start, "recommendations card end");
  return html.slice(start, end);
}

test("each recommendation card has exactly one declarative help and no legacy info-popout", () => {
  const section = recommendationsSection(read("index.html"));
  assert.doesNotMatch(section, /info-popout/);
  assert.doesNotMatch(section, /details[^>]*help-popout/);
  for (const id of IDS) {
    assert.equal(section.split(`data-floqr-help-id="${id}"`).length - 1, 1, id);
  }
});

test("recommendation status paragraphs opt out of helper-popout conversion", () => {
  const app = read("patron-app.js");
  assert.match(app, /data-keep-visible='true'>\$\{esc\(emptyText\)\}/);
  assert.match(app, /data-keep-visible='true'>Building personalized ShoutOut ideas/);
  assert.doesNotMatch(app, /How recommendations work/);
  const section = recommendationsSection(read("index.html"));
  for (const para of section.match(/<p class="sub small"[^>]*>/g) || []) {
    assert.match(para, /data-keep-visible="true"/, para);
  }
});

test("recommendation help is registered for FloqAi and localized", () => {
  const repo = read("floqai-help-repository.js");
  const packs = read("floqr-i18n-help.js");
  for (const id of IDS) {
    assert.match(repo, new RegExp(`id: "${id}"`), `repository ${id}`);
    assert.ok(packs.split(`"${id}"`).length - 1 >= 10, `help packs ${id}`);
  }
});
