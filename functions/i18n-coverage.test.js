/**
 * i18n coverage: chrome parity vs en + help packs vs canonical 33 ids.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const reportPath = path.join(__dirname, "..", "scripts", "i18n-coverage-report.js");
const { analyze, CHROME_LANGS, HELP_LANGS } = require(reportPath);

test("chrome packs match en key count for every supported language", () => {
  const { chrome } = analyze();
  assert.equal(chrome.enKeys, 192);
  for (const row of chrome.rows) {
    assert.equal(row.keys, chrome.enKeys, `chrome ${row.lang} keys`);
    assert.equal(row.missing, 0, `chrome ${row.lang} missing`);
    assert.equal(row.extra, 0, `chrome ${row.lang} extra`);
  }
  assert.deepEqual(
    chrome.rows.map((r) => r.lang),
    CHROME_LANGS
  );
  assert.equal(chrome.gaps.length, 0, JSON.stringify(chrome.gaps));
});

test("help packs cover the canonical 33 ids for every localized language", () => {
  const { help } = analyze();
  assert.equal(help.canonical, 33);
  for (const code of HELP_LANGS) {
    assert.ok(help.packsPresent.includes(code), `missing help pack ${code}`);
  }
  for (const row of help.rows) {
    assert.equal(row.ids, help.canonical, `help ${row.lang} ids`);
    assert.equal(row.missing, 0, `help ${row.lang} missing`);
    assert.equal(row.empty, 0, `help ${row.lang} empty`);
    assert.equal(row.extra, 0, `help ${row.lang} extra`);
  }
  assert.equal(help.gaps.length, 0, JSON.stringify(help.gaps));
});

test("floqr-i18n and help VERSION are s3.0.28", () => {
  const fs = require("fs");
  const root = path.join(__dirname, "..");
  const i18n = fs.readFileSync(path.join(root, "floqr-i18n.js"), "utf8");
  const help = fs.readFileSync(path.join(root, "floqr-i18n-help.js"), "utf8");
  assert.match(i18n, /const VERSION\s*=\s*"s3\.0\.28"/);
  assert.match(help, /const VERSION\s*=\s*"s3\.0\.28"/);
});
