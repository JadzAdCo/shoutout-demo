"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("./help-verbiage-core");
const fns = require("./help-verbiage-functions");
const dc = require("./data-classification-core");
const catalog = require("./botdee-whats-new-catalog");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function memoryDb() {
  const docs = new Map();
  let n = 0;
  function ref(name, id) {
    const key = `${name}/${id}`;
    return {
      id,
      async get() {
        const data = docs.get(key);
        return {id, exists: data != null, data: () => data};
      },
      async set(value) {
        docs.set(key, JSON.parse(JSON.stringify(value)));
      }
    };
  }
  return {
    docs,
    getAll(...refs) {
      return Promise.all(refs.map(item => item.get()));
    },
    collection(name) {
      return {
        doc(id) {
          return ref(name, id || `auto${n += 1}`);
        }
      };
    }
  };
}

function localesFor(title, body) {
  const locales = {};
  core.TRANSLATION_LANGS.forEach(code => {
    locales[code] = {title: `${title}`, body: `${body}`};
  });
  return locales;
}

test("flag is 0 or 1 from the hash, and translations gate patron help", () => {
  const entry = {id: "help-sample", title: "Book", body: "Ask BOT DEE.", audiences: ["patron"]};
  const hash = core.sourceHash(entry.title, entry.body);
  const english = {title: "Book", body: "Ask BOT DEE."};
  assert.equal(core.flagFor({
    entry, rawHash: hash, storedHash: hash, lasttextenhun: english, locales: {}
  }), 1);
  assert.equal(core.flagFor({
    entry, rawHash: hash, storedHash: "other", lasttextenhun: english, locales: localesFor("Book", "Ask BOT DEE.")
  }), 1);
  assert.equal(core.flagFor({
    entry, rawHash: hash, storedHash: hash, lasttextenhun: english, locales: localesFor("Book", "Ask BOT DEE.")
  }), 0);
  const master = {id: "help-master-only", title: "Studio", body: "Save in Master Admin.", audiences: ["masterAdmin"]};
  const masterHash = core.sourceHash(master.title, master.body);
  assert.equal(core.flagFor({
    entry: master,
    rawHash: masterHash,
    storedHash: masterHash,
    lasttextenhun: {title: master.title, body: master.body},
    locales: {}
  }), 0);
});

test("legal help is never prompted and never selected", () => {
  const legal = {id: "help-vip-terms-consent", title: "VIP reserV terms", body: "Read the terms.", audiences: ["patron"]};
  assert.equal(core.isLegalVerbiage(legal), true);
  assert.equal(core.enhancementPrompt(legal), "");
  assert.equal(core.selectNext([legal], {}), null);
  assert.equal(core.isLegalVerbiage({id: "help-vip-door-ops", title: "Door", body: "Check in.", audiences: ["venueAdmin"]}), false);
});

test("one prompt holds one entry and no patron profile, secret, or IP", () => {
  const entry = {id: "help-one", title: "Room SMARTview", body: "Open Room SMARTview in BOT DEE.", audiences: ["patron", "masterAdmin"]};
  const other = "this other body must not leak";
  const prompt = core.enhancementPrompt(entry);
  assert.match(prompt, /Open Room SMARTview in BOT DEE/);
  assert.equal(prompt.includes(other), false);
  assert.doesNotMatch(prompt, /clientIp|x-forwarded-for|chat history|sk_live|password/i);
  assert.equal(core.audienceLabel(entry.audiences).audienceLabel, "patron");
});

test("checks reject dropped brands, invented features, and jargon, and drop a repeated sentence", () => {
  const doubled = "Book a VIP reserV table with BOT DEE. Book a VIP reserV table with BOT DEE.";
  assert.equal(core.dropRepeatedSentences(doubled), "Book a VIP reserV table with BOT DEE.");
  const repeat = core.reviewOutput({
    id: "help-one",
    title: "Book",
    body: "Book a VIP reserV table with BOT DEE.",
    audiences: ["masterAdmin"]
  }, {title: "Book", body: doubled});
  assert.equal(repeat.ok, true);
  assert.equal(repeat.lasttextenhun.body, "Book a VIP reserV table with BOT DEE.");
  const dropped = core.reviewOutput({
    id: "help-one",
    title: "Book",
    body: "Book a VIP reserV table with BOT DEE.",
    audiences: ["masterAdmin"]
  }, {
    title: "Book",
    body: "Book a table."
  });
  assert.equal(dropped.ok, false);
  assert.ok(dropped.reasons.some(reason => reason.startsWith("brand:")));
  const invented = core.reviewOutput({
    id: "help-plain",
    title: "Hours",
    body: "The club opens at nine.",
    audiences: ["masterAdmin"]
  }, {
    title: "Hours",
    body: "The club opens at nine. Try floqCast."
  });
  assert.equal(invented.ok, false);
  assert.ok(invented.reasons.some(reason => reason.startsWith("invented:")));
  const jargon = core.reviewOutput({
    id: "help-plain",
    title: "Version",
    body: "Type Version.",
    audiences: ["masterAdmin"]
  }, {
    title: "Version",
    body: "Type Version. It will unmount the dock."
  });
  assert.equal(jargon.ok, false);
  assert.ok(jargon.reasons.some(reason => reason.startsWith("jargon:")));
});

test("a passing rewrite publishes and a Gemini failure keeps the previous text", async () => {
  const entry = {id: "help-book", title: "Book", body: "Ask BOT DEE to book VIP reserV.", audiences: ["patron"]};
  const seed = core.seedRecord(entry, {title: "Book", body: "Ask BOT DEE to book VIP reserV."});
  const db = memoryDb();
  const good = {
    title: "Book a table",
    body: "Ask BOT DEE to book VIP reserV.",
    locales: localesFor("Book a table", "Ask BOT DEE to book VIP reserV.")
  };
  let calls = 0;
  const published = await fns.runScheduledEnhance({
    db,
    apiKey: "test-key",
    catalog: {entries: [entry], seeds: [seed]},
    fetchImpl: async () => {
      calls += 1;
      return {ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(good)}]}}]})};
    },
    logGemini: async () => {}
  });
  assert.equal(calls, 1);
  assert.equal(published.outcome, "published");
  const saved = [...db.docs.values()].find(row => row.id === "help-book");
  assert.equal(saved.beenModsincelasttextenhun, 0);
  assert.equal(saved.lasttextenhun.title, "Book a table");
  assert.equal(saved.locales.de.body.includes("BOT DEE"), true);
  assert.equal(JSON.stringify(saved).includes("clientIp"), false);

  const downDb = memoryDb();
  const down = await fns.runScheduledEnhance({
    db: downDb,
    apiKey: "test-key",
    catalog: {entries: [entry], seeds: [seed]},
    fetchImpl: async () => {
      throw new Error("down");
    }
  });
  assert.equal(down.outcome, "gemini-down");
  const kept = [...downDb.docs.values()].find(row => row.id === "help-book");
  assert.equal(kept.lasttextenhun.body, "Ask BOT DEE to book VIP reserV.");
  assert.equal(kept.beenModsincelasttextenhun, 1);
});

test("the job calls Gemini once and skips a second entry in the same run", async () => {
  const a = {id: "help-a", title: "A", body: "Ask BOT DEE.", audiences: ["masterAdmin"]};
  const b = {id: "help-b", title: "B", body: "Open Mingl.", audiences: ["masterAdmin"]};
  const db = memoryDb();
  let calls = 0;
  await fns.runScheduledEnhance({
    db,
    apiKey: "test-key",
    catalog: {entries: [b, a], seeds: []},
    fetchImpl: async () => {
      calls += 1;
      return {ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify({title: "A", body: "Ask BOT DEE."})}]}}]})};
    }
  });
  assert.equal(calls, 1);
  const ids = [...db.docs.keys()].filter(key => key.startsWith("helpVerbiage/"));
  assert.ok(ids.includes("helpVerbiage/help-a"));
  assert.ok(ids.includes("helpVerbiage/help-b"));
});

test("seeded What's New and Version sentences are the first lasttextenhun", () => {
  const changelog = require("./botdee-version-changelog.json");
  const publicRows = require("./help-verbiage-public-source.json");
  const version = core.versionSeedRecords(publicRows).find(row => row.id === "help-botdee-version-smartview");
  assert.ok(version);
  assert.equal(version.beenModsincelasttextenhun, 1);
  assert.match(version.lasttextenhun.body, /Type Ver, Vers, or Version/);
  const line = core.whatsNewSeedRecords(changelog, catalog).find(row => row.id === "whatsnew-s3.3.055");
  assert.ok(line);
  assert.match(line.lasttextenhun.body, /book or hold a table/);
  assert.doesNotMatch(line.lasttextenhun.body, /unmount|headless|night rail/i);
  assert.equal(line.audienceLabel, "patron");
  const snapshot = core.pagesSnapshot([
    line,
    {id: "help-features-services", audiences: ["masterAdmin"], audienceLabel: "masterAdmin", lasttextenhun: {title: "Secret", body: "Master only."}, beenModsincelasttextenhun: 1}
  ]);
  assert.equal(snapshot.some(row => row.id === "help-features-services"), false);
  assert.equal(snapshot.some(row => row.id === "whatsnew-s3.3.055"), true);
});

test("Pages stage omits the master help file the scheduled function still reads", () => {
  const {stagePagesSite, OMITTED_FILES} = require("../scripts/stage-pages-site");
  assert.deepEqual([...OMITTED_FILES], ["functions/help-verbiage-master-source.json"]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "floqr-pages-"));
  const repo = path.join(tmp, "repo");
  const dest = path.join(tmp, "site");
  fs.mkdirSync(path.join(repo, "functions"), {recursive: true});
  fs.writeFileSync(path.join(repo, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(repo, "functions", "help-verbiage-master-source.json"), "[{\"id\":\"help-features-services\"}]");
  stagePagesSite(repo, dest);
  assert.equal(fs.existsSync(path.join(dest, "functions", "help-verbiage-master-source.json")), false);
  assert.equal(fs.readFileSync(path.join(dest, "index.html"), "utf8"), "<html></html>");
  const master = JSON.parse(read("functions/help-verbiage-master-source.json"));
  assert.ok(master.some(row => row.id === "help-features-services"));
  assert.match(read("functions/help-verbiage-functions.js"), /require\("\.\/help-verbiage-master-source\.json"\)/);
  const workflow = read(".github/workflows/publish-github-pages.yml");
  assert.match(workflow, /node scripts\/stage-pages-site\.js/);
  assert.match(workflow, /help-verbiage-master-source\.json/);
  assert.doesNotMatch(workflow, /floqmediaOidcExchange|firebase deploy/);
});

test("public Pages files do not carry master-only help or a Gemini paint call", () => {
  const repo = read("botdee-help-repository.js");
  const snapshot = read("help-verbiage-snapshot.js");
  assert.doesNotMatch(repo, /audiences:\s*\[\s*"masterAdmin"\s*\]/);
  assert.doesNotMatch(snapshot, /help-features-services|help-master-demo-signin/);
  assert.doesNotMatch(snapshot, /generativelanguage|generateContent/);
  for (const file of ["botdee-version-smartview.js", "floqr-i18n-help.js", "help-attach.js", "botdee-whats-new-catalog.js"]) {
    const src = file.startsWith("botdee-version") || file.startsWith("botdee-whats")
      ? read(`functions/${file}`)
      : read(file);
    assert.doesNotMatch(src, /generativelanguage\.googleapis/, file);
  }
  const rules = read("firestore.rules");
  assert.match(rules, /match \/helpVerbiage\/\{id\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/helpVerbiageAudit\/\{id\} \{\s*allow read: if isMasterAdmin\(\);\s*allow create, update, delete: if false;/);
});

test("system job refuses patron collections and the agent probe is not a patron", async () => {
  assert.throws(() => dc.systemJob("helpVerbiageEnhance", "users"));
  assert.equal(dc.normalize("helpVerbiage", null).isPublicAccessible, 0);
  assert.equal(dc.normalize("helpVerbiageAudit", null).isMasterAdminAccessible, 1);
  const actor = fns.auditActorFromRequest({
    auth: {uid: "u1", token: {email: "person@example.com"}},
    data: {clientKind: "agent"},
    rawRequest: {headers: {"user-agent": "curl/8.0"}}
  }, "patron");
  assert.equal(actor.role, "agent");
  assert.equal(actor.email, "agent");
  const db = memoryDb();
  const manifest = {help: {"help-features-services": ["masterAdmin"], "help-book": ["patron"]}, intents: {}};
  const denied = await fns.readHelpForViewer({
    ids: ["help-features-services"],
    viewer: {role: "patron"},
    actor,
    db,
    manifest
  });
  assert.equal(denied.results.length, 0);
  const audit = [...db.docs.values()].find(row => row.outcome === "denied");
  assert.equal(audit.actorRole, "agent");
  assert.equal(audit.actorEmail, "agent");
  assert.equal(JSON.stringify(audit).includes("clientIp"), false);
  assert.equal(JSON.stringify(audit).includes("person@example.com"), false);
});

test("published search text follows lasttextenhun and skips master-only copy", () => {
  const results = core.applyPublishedVerbiage([
    {id: "help-book", label: "raw", blurb: "raw body"},
    {id: "help-features-services", label: "raw master", blurb: "raw master body"}
  ], {
    "help-book": {audiences: ["patron"], lasttextenhun: {title: "Book", body: "Ask BOT DEE."}},
    "help-features-services": {audiences: ["masterAdmin"], lasttextenhun: {title: "Hidden", body: "Master only."}}
  });
  assert.equal(results[0].blurb, "Ask BOT DEE.");
  assert.equal(results[1].blurb, "raw master body");
});
