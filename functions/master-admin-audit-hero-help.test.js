"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const HELP_ID = "help-master-network-intelligence";

function loadRepository() {
  const win = {
    FLOQRNav: {appVersion: "test"},
    location: {href: "https://test.local/master-admin.html", pathname: "/master-admin.html"},
    localStorage: {getItem() { return null; }, setItem() {}},
    navigator: {language: "en"},
    addEventListener() {},
    document: null,
    URLSearchParams,
    URL,
    console,
    setTimeout
  };
  win.window = win;
  vm.runInContext(read("floqai-help-repository.js"), vm.createContext(win), {filename: "floqai-help-repository.js"});
  return win.FLOQRHelpRepository;
}

function loadAuditRenderer() {
  const win = {firebase: {}, open() {}};
  vm.runInNewContext(`(function (window) { ${read("master-feature-services.js")} })(this);`, win);
  return win.FLOQRMasterFeatureServices.auditRowHtml;
}

function heroHtml() {
  const html = read("master-admin.html");
  const start = html.indexOf("<header class=\"topbar admin-topbar\">");
  const end = html.indexOf("</header>", start);
  assert.ok(start > 0 && end > start, "Master Admin hero header must exist");
  return html.slice(start, end);
}

test("Feature & beta activity uses the responsive audit table, not inline table styles", () => {
  const html = read("master-admin.html");
  assert.match(html, /<div class="report-block audit-log-wrap">\s*<table class="admin-table audit-log-table">/);
  assert.match(html, /<tbody id="featureAuditRows"><\/tbody>/);
  const css = read("admin.css");
  assert.match(css, /\.report-block table th,\s*\.report-block table td\{overflow-wrap:break-word;word-break:normal\}/);
  assert.match(css, /\.audit-log-table\{[^}]*table-layout:fixed/);
  assert.match(css, /\.audit-trunc\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
  assert.match(css, /@media \(max-width:900px\)\{[\s\S]*?\.audit-log-table td::before\{content:attr\(data-label\)/);
  assert.match(css, /@media \(max-width:480px\)\{[\s\S]*?\.audit-log-table td\{grid-template-columns:minmax\(0,1fr\)/);
});

test("audit rows carry labels, truncate long ids with a title, and fold before/after JSON", () => {
  const render = loadAuditRenderer();
  const hash = "a".repeat(64);
  const html = render({
    createdAtIso: "2026-10-09T08:12:40.303Z",
    chained: true,
    seq: 3,
    hash,
    eventType: "dataClass.savedAll",
    actorEmail: "ops@example.com",
    actorRole: "masterAdmin",
    sourceIpTruncated: "2601:4d:8700::/48",
    targetType: "dataClassification",
    targetId: "all",
    outcome: "denied",
    reason: "Quarterly review",
    before: {users: {isPatronAccessible: 1}},
    after: {users: {isPatronAccessible: 0}}
  });
  for (const label of ["When (UTC)", "Event", "Who", "Target", "Outcome", "Reason"]) {
    assert.match(html, new RegExp(`data-label="${label.replace(/[()]/g, "\\$&")}"`));
  }
  assert.match(html, />2026-10-09 08:12:40Z</);
  assert.match(html, /class="audit-seq">#3</);
  assert.match(html, new RegExp(`class="audit-trunc audit-mono" title="${hash}"`));
  assert.match(html, /title="2601:4d:8700::\/48"/);
  assert.match(html, /<details class="audit-change"><summary>Before → after<\/summary><pre class="audit-json">/);
  assert.match(html, /audit-outcome is-denied/);
  assert.doesNotMatch(html, /<br\/><small>\{/);
});

test("Master Admin hero has no orphan help; All Locations carries the help", () => {
  const hero = heroHtml();
  assert.match(hero, /<h1>Network Intelligence Center<\/h1>/);
  assert.doesNotMatch(hero, /<h1[^>]*data-floqr-help/);
  assert.doesNotMatch(hero, /details class="help-popout/);
  assert.doesNotMatch(hero, /<p class="sub small">/);
  const h2 = hero.match(/<h2([\s\S]*?)>All Locations<\/h2>/);
  assert.ok(h2, "All Locations heading must exist");
  assert.match(h2[1], new RegExp(`data-floqr-help-id="${HELP_ID}"`));
  assert.match(h2[1], /data-floqr-help-title="All Locations"/);
  assert.match(h2[1], /data-floqr-help-search="[^"]*all locations[^"]*network intelligence center/);
});

test("help popouts reset heading typography in the shared help-attach module", () => {
  const css = read("help-attach.js");
  assert.match(css, /\.help-popout \.help-popout-body,\s*\.help-popout > div:not\(summary\)\{\s*text-transform:none;\s*letter-spacing:normal;/);
  assert.match(css, /font-size:14px;\s*font-weight:500;\s*line-height:1\.45;/);
  assert.match(css, /:where\(\.card,\.notice,\.login-card,\.queue-item\):where\(:has\(details\.help-popout\[open\]\)\)\{position:relative;z-index:40\}/);
});

test("All Locations help is Master Admin only in the repository and the server content classes", () => {
  const repo = loadRepository();
  const entry = repo.entries().find(row => row.id === HELP_ID);
  assert.ok(entry, "repository entry must exist");
  assert.equal(entry.title, "All Locations");
  assert.deepEqual([...entry.audiences], ["masterAdmin"]);
  assert.match(entry.body, /Total Locations/);
  assert.doesNotMatch(entry.body, /design notes|\.mdc|hash/i);
  for (const phrase of ["all locations", "network intelligence center", "location picker", "network dashboard locations", "which venue am i looking at"]) {
    assert.ok(entry.searchPhrases.includes(phrase), `missing search phrase ${phrase}`);
  }
  assert.equal(repo.canAccessHelpEntry(entry, {IsMasterAdmin: 1}), true);
  for (const flags of [{IsPatron: 1}, {IsServiceMember: 1}, {IsVenueAdmin: 1}, {}]) {
    assert.equal(repo.canAccessHelpEntry(entry, flags), false, JSON.stringify(flags));
  }
  repo.register({id: HELP_ID, title: "All Locations", body: entry.body, source: "help-attach"});
  assert.deepEqual([...repo.entries().find(row => row.id === HELP_ID).audiences], ["masterAdmin"], "DOM registration must keep the seeded audience");
  const classes = JSON.parse(read("functions/floqai-content-classes.json"));
  assert.deepEqual(classes.help[HELP_ID], ["masterAdmin"]);
});

test("Master Admin audit/hero assets are cache-busted (s3.1.29 help-attach, s3.1.30 F&S)", () => {
  const html = read("master-admin.html");
  assert.match(html, /\.\/help-attach\.js\?v=s3\.1\.(?:29|[3-9]\d)"/);
  for (const file of ["admin.css", "floqai-help-repository.js", "master-feature-services.js"]) {
    assert.match(html, new RegExp(`\\./${file.replace(/\./g, "\\.")}\\?v=s3\\.1\\.[3-9]\\d"`));
  }
  assert.doesNotMatch(html, /display2?\.html\?location=[^"'\s<>]*[?&]v=/);
});
