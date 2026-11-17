"use strict";

const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const v2 = require("./botdee-smartview-v2-core");
const smart = require("./botdee-smartview-core");

function volunteered(over = {}) {
  const {datapoints: dpOver, ...rest} = over;
  return {
    sharedDatapoints: ["music", "events", "travel", "food", "meet", "media", "hobbies", "location"],
    datapoints: {
      music: ["Afrobeats", "Amapiano"],
      events: ["Concerts"],
      nightlifeStyle: "Rooftop lounges",
      food: ["Nigerian jollof", "sushi"],
      travel: ["Miami"],
      futureTravel: ["Mykonos"],
      hobbies: ["NBA basketball", "fashion"],
      location: {city: "Washington, DC"},
      lookingToMeet: "Friends first",
      photoCount: 1,
      ...dpOver
    },
    bio: "Public-within-FLOQR bio",
    ...rest
  };
}

test("supported locales match FLOQR i18n registry (11 langs)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "floqr-i18n.js"), "utf8");
  v2.SUPPORTED_LOCALES.forEach(code => {
    assert.match(src, new RegExp(`code: "${code}"`));
  });
  assert.equal(v2.SUPPORTED_LOCALES.length, 11);
  assert.ok(v2.SUPPORTED_LOCALES.includes("ar"));
});

test("Social default nested tab is Music; changing top-level picks default subtab", () => {
  assert.equal(v2.DEFAULT_SECONDARY || v2.DEFAULT_SOCIAL, "Music");
  const social = v2.selectTabs("Social");
  assert.equal(social.primary, "Social");
  assert.equal(social.secondary, "Music");
  const dining = v2.selectTabs("Dining", "Sports");
  assert.equal(dining.primary, "Dining");
  assert.equal(dining.secondary, "Cuisines");
  const travel = v2.selectTabs("Future Travels");
  assert.equal(travel.secondary, "Upcoming");
});

test("nested tab renders tags only; missing categories collapse; no invented data", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara J."}, volunteered({
    datapoints: {music: ["Afrobeats"], events: [], food: [], travel: [], futureTravel: [], hobbies: []}
  }));
  const cats = v2.categoriesFromSnapshot(snap);
  assert.deepEqual(cats.Social.Music, ["Afrobeats"]);
  assert.deepEqual(cats.Social.Events, []);
  assert.equal(v2.tagsFor(cats, "Social", "Music").length, 1);
  assert.equal(v2.tagsFor(cats, "Social", "Nightlife").length, 1);
  assert.match(v2.noteFor({categories: cats, primary: "Dating", datingVisible: false}), /opt-in/i);
  assert.match(v2.noteFor({categories: cats, primary: "Dining", datingVisible: false}), /No information/);
  const draft = v2.draftSummaryFromPublicFields(snap);
  assert.doesNotMatch(draft, /4\.8|rating/i);
  assert.doesNotMatch(draft, /Mykonos/);
  assert.doesNotMatch(draft, /Paris/);
});

test("usercharacter_analysis schema, source-version matching, owner edit, stale translation guard", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara", preferredLanguage: "en"}, volunteered());
  const doc = v2.emptyAnalysis("u1", snap, 1);
  assert.equal(doc.schemaVersion, v2.SCHEMA_VERSION);
  assert.equal(doc.sourceAuthoredBy, "gemini");
  const valid = v2.validateOwnerEdit({text: "Amara loves Afrobeats.", locale: "en", previous: doc});
  assert.equal(valid.ok, true);
  const saved = v2.applyOwnerSave(doc, {
    summary: valid.summary,
    sourceLocale: valid.sourceLocale,
    editorUid: "u1",
    now: 2
  });
  assert.equal(saved.revision, 2);
  assert.equal(saved.sourceAuthoredBy, "owner");
  assert.equal(saved.previousRevision.revision, 1);
  const jobs = v2.enqueueTranslationJobs({
    uid: "u1",
    revision: saved.revision,
    sourceHash: saved.sourceHash,
    sourceLocale: saved.sourceLocale,
    now: 3
  });
  assert.equal(jobs.length, 10);
  assert.ok(jobs.every(job => job.locale !== "en"));
  assert.ok(jobs.every(job => job.id === v2.translationJobId("u1", 2, job.locale, saved.sourceHash)));
  assert.equal(saved.translations.en.status, "source");
  assert.equal(saved.translations.en.text, "Amara loves Afrobeats.");
  const stale = v2.applyTranslationResult(saved, {...jobs[0], revision: 1, sourceHash: "old"}, {
    text: "stale french",
    engine: "gemini"
  });
  assert.equal(stale.applied, false);
  assert.equal(stale.reason, "stale_revision");
  const ok = v2.applyTranslationResult(saved, jobs.find(j => j.locale === "fr"), {
    text: "Amara aime l'Afrobeats.",
    engine: "gemini",
    usage: {totalTokens: 40, promptTokens: 20, candidatesTokens: 20}
  });
  assert.equal(ok.applied, true);
  const shownFr = v2.localeSummary(ok.doc, "fr");
  assert.equal(shownFr.status, "translated");
  const shownDe = v2.localeSummary(ok.doc, "de");
  assert.equal(shownDe.status, "fallback");
  assert.equal(shownDe.pending, true);
  assert.equal(shownDe.locale, "en");
});

test("sourceLocale is patron uiLanguage; French save fans out including English", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara", uiLanguage: "fr"}, volunteered());
  assert.equal(snap.sourceLocale, "fr");
  const drafted = v2.emptyAnalysis("u1", snap, 1);
  assert.equal(drafted.sourceLocale, "fr");
  assert.equal(drafted.translations.fr.status, "source");
  assert.equal(drafted.translations.fr.text, drafted.sourceText);
  const prompt = v2.geminiAnalysisPrompt(snap);
  assert.match(prompt, /French \(fr\)/);
  assert.match(prompt, /SMARTsummary/);
  assert.match(prompt, /Do not write English unless the source language is English/);
  const enPrompt = v2.geminiAnalysisPrompt({...snap, sourceLocale: "en"});
  assert.match(enPrompt, /English \(en\)/);
  const valid = v2.validateOwnerEdit({
    text: "Amara aime l'Afrobeats et les rooftops.",
    locale: "fr",
    previous: drafted
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.sourceLocale, "fr");
  const saved = v2.applyOwnerSave(drafted, {
    summary: valid.summary,
    sourceLocale: valid.sourceLocale,
    editorUid: "u1",
    now: 2
  });
  assert.equal(saved.sourceLocale, "fr");
  assert.equal(saved.sourceAuthoredBy, "owner");
  assert.equal(saved.translations.fr.status, "source");
  assert.equal(saved.translations.fr.text, valid.summary);
  assert.equal(saved.translations.en, undefined);
  const jobs = v2.enqueueTranslationJobs({
    uid: "u1",
    revision: saved.revision,
    sourceHash: saved.sourceHash,
    sourceLocale: saved.sourceLocale,
    now: 3
  });
  assert.equal(jobs.length, 10);
  assert.ok(jobs.some(job => job.locale === "en"));
  assert.ok(jobs.every(job => job.locale !== "fr"));
  assert.deepEqual(jobs.map(job => job.locale).sort(), v2.fanOutLocales("fr").slice().sort());
  jobs.forEach(job => {
    assert.equal(job.id, v2.translationJobId("u1", saved.revision, job.locale, saved.sourceHash));
    assert.match(job.id, new RegExp(`^u1_${saved.revision}_${job.locale}_[a-f0-9]{1,16}$`));
    assert.equal(job.sourceLocale, "fr");
  });
  const enJob = jobs.find(job => job.locale === "en");
  const en = v2.translationLocalePatch(saved, enJob, {
    text: "Amara loves Afrobeats and rooftops.",
    engine: "gemini"
  });
  assert.equal(en.applied, true);
  assert.equal(en.update["translations.en"].text, "Amara loves Afrobeats and rooftops.");
  assert.ok(!("translations.fr" in en.update));
  const deJob = jobs.find(job => job.locale === "de");
  const de = v2.translationLocalePatch(saved, deJob, {text: "Amara mag Afrobeats.", engine: "gemini"});
  const merged = v2.applyLocalePatches(saved, [en, de]);
  assert.equal(merged.translations.fr.status, "source");
  assert.equal(merged.translations.fr.text, valid.summary);
  assert.equal(merged.translations.en.text, "Amara loves Afrobeats and rooftops.");
  assert.equal(merged.translations.de.text, "Amara mag Afrobeats.");
  const shownEn = v2.localeSummary(merged, "en");
  assert.equal(shownEn.status, "translated");
  assert.equal(shownEn.locale, "en");
  assert.equal(shownEn.text, "Amara loves Afrobeats and rooftops.");
  const shownFr = v2.localeSummary(merged, "fr");
  assert.equal(shownFr.status, "source");
  assert.equal(shownFr.text, valid.summary);
  const pending = v2.localeSummary(saved, "en");
  assert.equal(pending.status, "fallback");
  assert.equal(pending.pending, true);
  assert.equal(pending.text, valid.summary);
  assert.match(drafted.sourceText, /aime /);
  assert.doesNotMatch(drafted.sourceText, /\benjoys\b|\bgoes out for\b|public-within-app profile/);
  v2.SUPPORTED_LOCALES.forEach(locale => {
    const localSnap = v2.publicFieldsSnapshot({displayName: "Amara", uiLanguage: locale}, volunteered({
      datapoints: {music: ["Afrobeats"], events: [], food: [], travel: [], futureTravel: [], hobbies: []}
    }));
    const draft = v2.draftSummaryFromPublicFields(localSnap);
    if (locale === "en") assert.match(draft, /enjoys Afrobeats/);
    else assert.doesNotMatch(draft, /\benjoys\b|public-within-app profile/);
  });
});

test("owner editor uses source text; save rejects a translation as the new source", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara", uiLanguage: "fr"}, volunteered());
  let doc = v2.emptyAnalysis("u1", snap, 1);
  doc = v2.applyOwnerSave(doc, {
    summary: "Amara aime l'Afrobeats.",
    sourceLocale: "fr",
    editorUid: "u1",
    now: 2
  });
  const enJob = v2.enqueueTranslationJobs({
    uid: "u1", revision: doc.revision, sourceHash: doc.sourceHash, sourceLocale: "fr", now: 3
  }).find(job => job.locale === "en");
  const patched = v2.translationLocalePatch(doc, enJob, {
    text: "Amara loves Afrobeats.",
    engine: "gemini"
  });
  const merged = v2.applyLocalePatches(doc, [patched]);
  const ownerEnChrome = v2.peopleV2Payload({
    subjectUid: "u1",
    snap,
    analysis: merged,
    viewerUid: "u1",
    viewerMaySee: true,
    viewerLocale: "en"
  });
  assert.equal(ownerEnChrome.summary.text, "Amara loves Afrobeats.");
  assert.equal(ownerEnChrome.summary.editLocale, "fr");
  assert.equal(ownerEnChrome.summary.editText, "Amara aime l'Afrobeats.");
  assert.equal(ownerEnChrome.summary.sourceText, "Amara aime l'Afrobeats.");
  const stranger = v2.peopleV2Payload({
    subjectUid: "u1",
    snap,
    analysis: merged,
    viewerUid: "u2",
    viewerMaySee: true,
    viewerLocale: "en"
  });
  assert.equal(stranger.summary.editText, undefined);
  assert.equal(v2.resolveOwnerSaveLocale({
    previous: merged,
    uiLanguage: "fr",
    requestLocale: "fr",
    submittedText: "Amara loves Afrobeats."
  }).error, "translation_not_source");
  assert.equal(v2.resolveOwnerSaveLocale({
    previous: merged,
    uiLanguage: "en",
    requestLocale: "en",
    submittedText: "Amara aime l'Afrobeats."
  }).error, "rewrite_in_new_language");
  assert.equal(v2.resolveOwnerSaveLocale({
    previous: merged,
    uiLanguage: "fr",
    requestLocale: "en",
    submittedText: "Nouveau texte en français."
  }).error, "locale_mismatch");
  const ok = v2.resolveOwnerSaveLocale({
    previous: merged,
    uiLanguage: "fr",
    requestLocale: "fr",
    submittedText: "Amara aime l'Afrobeats et les rooftops."
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.sourceLocale, "fr");
  const switched = v2.peopleV2Payload({
    subjectUid: "u1",
    snap: v2.publicFieldsSnapshot({displayName: "Amara", uiLanguage: "en"}, volunteered()),
    analysis: merged,
    viewerUid: "u1",
    viewerMaySee: true,
    viewerLocale: "en"
  });
  assert.equal(switched.summary.editLocale, "en");
  assert.equal(switched.summary.editText, "");
  const client = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  assert.match(client, /summary\?\.editText/);
  assert.match(client, /callable\(\{summary: value, locale:/);
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /resolveOwnerSaveLocale/);
  assert.match(src, /request\.data\?\.locale/);
});

test("persistAnalysis merge:false is a new revision only; fan-out uses dotted locale patches", () => {
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /persistAnalysis[\s\S]{0,900}\{merge: false\}/);
  const persist = src.slice(src.indexOf("async function persistAnalysis"), src.indexOf("async function persistTranslationLocale"));
  assert.match(persist, /stampSourceTranslation/);
  assert.match(persist, /NEW source revision/);
  const runFn = src.slice(src.indexOf("async function runTranslationJob"), src.indexOf("exports.processSmartViewTranslationJob"));
  assert.doesNotMatch(runFn, /persistAnalysis\(/);
  assert.match(runFn, /persistTranslationLocale\(/);
  assert.match(src, /request\.data\?\.uiLanguage \|\| viewerData\.uiLanguage/);
  assert.match(src, /data\.uiLanguage \|\| data\.preferredLanguage/);
  assert.doesNotMatch(src, /viewerLocale = v2\.normalizeLocale\(request\.data\?\.uiLanguage \|\| data\.uiLanguage/);
});

test("owner-authored summary is not silently regenerated; profile change flags conflict", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara"}, volunteered());
  let doc = v2.emptyAnalysis("u1", snap, 1);
  doc = v2.applyOwnerSave(doc, {summary: "Owner text.", sourceLocale: "en", editorUid: "u1", now: 2});
  const nextSnap = v2.publicFieldsSnapshot({displayName: "Amara"}, volunteered({
    datapoints: {music: ["Afrobeats", "Jazz"]}
  }));
  assert.equal(v2.shouldRegenerate(doc, nextSnap), false);
  assert.equal(v2.shouldFlagConflict(doc, nextSnap), true);
  assert.equal(v2.shouldRegenerate(null, snap), true);
  const geminiDoc = v2.emptyAnalysis("u1", snap, 1);
  assert.equal(v2.shouldRegenerate(geminiDoc, nextSnap), true);
});

test("moderation and length validation; HTML rejected", () => {
  assert.equal(v2.validateOwnerEdit({text: "", locale: "en"}).ok, false);
  assert.equal(v2.validateOwnerEdit({text: "<script>x</script>", locale: "en"}).ok, false);
  assert.equal(v2.validateOwnerEdit({text: "x".repeat(v2.SUMMARY_MAX + 1), locale: "en"}).ok, false);
  assert.equal(v2.validateOwnerEdit({text: "Hello @amaraj", locale: "fr"}).sourceLocale, "fr");
});

test("handles sanitized; javascript hrefs dropped", () => {
  assert.equal(v2.sanitizeHandle("amaraj"), "amaraj");
  assert.equal(v2.sanitizeHandle("@bad handle"), "");
  assert.equal(v2.sanitizeHref("javascript:alert(1)"), "");
  assert.equal(v2.sanitizeHref("./patron-portal.html?tab=profile"), "./patron-portal.html?tab=profile");
});

test("blocked or private viewer never gets peopleV2 payload or private fields", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Hidden", email: "x@y.z"}, volunteered());
  assert.equal(v2.peopleV2Payload({
    subjectUid: "u2",
    snap,
    analysis: v2.emptyAnalysis("u2", snap),
    viewerUid: "u1",
    viewerBlocked: true,
    viewerMaySee: true
  }), null);
  assert.equal(v2.peopleV2Payload({
    subjectUid: "u2",
    snap,
    analysis: v2.emptyAnalysis("u2", snap),
    viewerUid: "u1",
    viewerMaySee: false
  }), null);
  const hiddenSnap = v2.publicFieldsSnapshot({displayName: "Hidden", email: "private@x"}, {
    sharedDatapoints: [],
    datapoints: {}
  });
  assert.equal(hiddenSnap.music.length, 0);
  assert.equal(hiddenSnap.datingOptIn, false);
  assert.equal(hiddenSnap.instagram, "");
});

test("non-owner cannot be marked ownerMayEdit; dating hidden without opt-in", () => {
  const noMeet = v2.publicFieldsSnapshot({displayName: "Amara"}, {
    sharedDatapoints: ["music"],
    datapoints: {music: ["Afrobeats"], lookingToMeet: "secret"}
  });
  assert.equal(noMeet.datingOptIn, false);
  assert.equal(noMeet.lookingToMeet, "");
  const payload = v2.peopleV2Payload({
    subjectUid: "u2",
    snap: noMeet,
    analysis: v2.emptyAnalysis("u2", noMeet),
    viewerUid: "u1",
    viewerMaySee: true,
    viewerLocale: "en"
  });
  assert.equal(payload.ownerMayEdit, false);
  assert.equal(payload.datingVisible, false);
});

test("parallel locale patches keep sibling translations; stale saveSmartSummary wins", () => {
  const snap = v2.publicFieldsSnapshot({displayName: "Amara", preferredLanguage: "en"}, volunteered());
  const doc = v2.emptyAnalysis("u1", snap, 1);
  const jobs = v2.enqueueTranslationJobs({
    uid: "u1", revision: doc.revision, sourceHash: doc.sourceHash, sourceLocale: "en", now: 2
  });
  const frJob = jobs.find(j => j.locale === "fr");
  const deJob = jobs.find(j => j.locale === "de");
  const fr = v2.translationLocalePatch(doc, frJob, {text: "Bonjour Amara", engine: "gemini"});
  const de = v2.translationLocalePatch(doc, deJob, {text: "Hallo Amara", engine: "gemini"});
  assert.equal(fr.applied, true);
  assert.equal(de.applied, true);
  assert.equal(fr.update["translations.fr"].text, "Bonjour Amara");
  assert.equal(de.update["translations.de"].text, "Hallo Amara");
  assert.ok(!("translations.de" in fr.update));
  assert.ok(!("translations.fr" in de.update));
  const merged = v2.applyLocalePatches(doc, [fr, de]);
  assert.equal(merged.translations.fr.text, "Bonjour Amara");
  assert.equal(merged.translations.de.text, "Hallo Amara");
  const saved = v2.applyOwnerSave(doc, {summary: "Owner rewrite.", sourceLocale: "en", editorUid: "u1", now: 9});
  const stale = v2.translationLocalePatch(saved, frJob, {text: "too late", engine: "gemini"});
  assert.equal(stale.applied, false);
  assert.equal(stale.reason, "stale_revision");
});

test("translation job retries process on write, not only on create", () => {
  const queued = {status: "queued", attempts: 0};
  assert.equal(v2.shouldProcessTranslationWrite(null, queued), true);
  assert.equal(v2.shouldProcessTranslationWrite(queued, queued), false);
  const retried = v2.retryOrDeadLetter(queued, "translator_outage", 2);
  assert.equal(retried.status, "queued");
  assert.equal(v2.shouldProcessTranslationWrite(queued, retried), true);
  assert.equal(v2.shouldProcessTranslationWrite(retried, {status: "done", attempts: retried.attempts}), false);
  assert.equal(v2.shouldProcessTranslationWrite({status: "failed", attempts: 1}, queued), true);
  const regenerated = {...queued, sourceHash: "newhash", generation: "newhash", attempts: 0};
  assert.equal(v2.shouldProcessTranslationWrite({...queued, sourceHash: "oldhash", generation: "oldhash"}, regenerated), true);
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /onDocumentWritten\(\{\s*document: `\$\{v2\.JOBS_COLLECTION\}/);
  const runFn = src.slice(src.indexOf("async function runTranslationJob"), src.indexOf("exports.processSmartViewTranslationJob"));
  assert.doesNotMatch(runFn, /persistAnalysis\(/);
  assert.match(runFn, /persistTranslationLocale\(/);
  assert.match(src, /shouldProcessTranslationWrite/);
});

test("regenerated Gemini jobs get a new id and process even when attempts stay 0", () => {
  const first = v2.enqueueTranslationJobs({
    uid: "u1", revision: 1, sourceHash: "aaa111", sourceLocale: "en", now: 1
  });
  const second = v2.enqueueTranslationJobs({
    uid: "u1", revision: 1, sourceHash: "bbb222", sourceLocale: "en", now: 2
  });
  const fr1 = first.find(j => j.locale === "fr");
  const fr2 = second.find(j => j.locale === "fr");
  assert.notEqual(fr1.id, fr2.id);
  assert.match(fr1.id, /aaa111|aaa1/);
  assert.equal(fr1.id, v2.translationJobId("u1", 1, "fr", "aaa111"));
  assert.equal(fr2.id, v2.translationJobId("u1", 1, "fr", "bbb222"));
  assert.equal(v2.shouldProcessTranslationWrite(fr1, fr2), true);
  assert.equal(v2.jobStillMatchesGeneration(fr2, fr1), false);
  assert.equal(v2.jobStillMatchesGeneration(fr1, fr1), true);
  assert.equal(v2.shouldProcessTranslationWrite(fr1, {...fr1}), false);
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /cancelJobIfStillThisGeneration/);
});

test("peopleV2 paints live public fields; hidden and dating-off tags do not stick", () => {
  const publicSnap = v2.publicFieldsSnapshot({displayName: "Amara"}, volunteered());
  const analysis = v2.emptyAnalysis("u1", publicSnap, 1);
  analysis.categories.Dating.Preferences = ["stale secret"];
  analysis.categories.Social.Music = ["stale Jazz"];
  const hiddenSnap = v2.publicFieldsSnapshot({displayName: "Amara"}, {
    sharedDatapoints: ["food"],
    datapoints: {food: ["sushi"], lookingToMeet: "secret"}
  });
  const payload = v2.peopleV2Payload({
    subjectUid: "u1",
    snap: hiddenSnap,
    analysis,
    viewerUid: "u2",
    viewerMaySee: true,
    viewerLocale: "en"
  });
  assert.equal(payload.datingVisible, false);
  assert.deepEqual(payload.categories.Dating.Preferences, []);
  assert.deepEqual(payload.categories.Social.Music, []);
  assert.deepEqual(payload.categories.Dining.Cuisines, ["sushi"]);
  assert.equal(v2.tagsFor(payload.categories, "Dating", "Preferences").length, 0);
});

test("translation retry then dead-letter; diagnostics omit summary text", () => {
  let job = v2.enqueueTranslationJobs({
    uid: "u1", revision: 2, sourceHash: "abc", sourceLocale: "en", now: 1
  })[0];
  for (let i = 0; i < v2.JOB_MAX_ATTEMPTS - 1; i += 1) {
    job = v2.retryOrDeadLetter(job, "translator_outage", i + 2);
    assert.equal(job.status, "queued");
  }
  job = v2.retryOrDeadLetter(job, "translator_outage", 99);
  assert.equal(job.status, "dead_letter");
  const event = v2.diagnosticEvent({
    kind: "smartview_translate",
    uid: "u1",
    revision: 2,
    locale: "fr",
    usage: {totalTokens: 11},
    jobStatus: "dead_letter",
    error: "translator_outage"
  });
  assert.equal(event.summaryTextLogged, false);
  assert.equal(event.totalTokens, 11);
  assert.equal(event.costUnknown, false);
  assert.ok(!JSON.stringify(event).includes("Amara"));
});

test("Gemini usage unknown when metadata missing; known counts once", () => {
  assert.equal(v2.usageFromGemini({}).costUnknown, true);
  const usage = v2.usageFromGemini({usageMetadata: {promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15}});
  assert.equal(usage.totalTokens, 15);
  assert.equal(usage.costUnknown, false);
});

test("patronSmartView still validates; peopleV2 lives under floqrPublicData", () => {
  const catalog = smart.mockCatalog();
  catalog.forEach(row => assert.deepEqual(smart.validatePayload(row), []));
  const patron = catalog.find(row => row.kind === "patron");
  assert.ok(patron);
  assert.equal(patron.publicWebResearch.enabled, false);
  assert.equal(patron.floqrPublicData.peopleV2.presentation, "peopleV2");
  assert.equal(patron.floqrPublicData.peopleV2.defaultSecondary, "Music");
  assert.equal(patron.floqrPublicData.peopleV2.handles[0].handle, "@amaraj");
  const hidden = smart.patronSmartView({
    displayName: "Hidden",
    volunteered: {datapoints: {food: ["Nigerian"]}},
    viewerMaySee: false
  });
  assert.deepEqual(hidden.floqrPublicData, {});
});

test("no Gemini on view: peopleV2 payload uses stored analysis only", () => {
  const src = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-functions.js"), "utf8");
  assert.match(src, /getPeopleSmartView/);
  assert.doesNotMatch(src, /generateContent[\s\S]{0,80}getPeopleSmartView/);
  assert.match(src, /volunteered\.profileMediaSlots = data\.profileMediaSlots/);
  const fn = fs.readFileSync(path.join(__dirname, "botdee-smartview-v2-core.js"), "utf8");
  assert.match(fn, /No Gemini on view/);
  assert.match(fn, /function publicPageMedia\(/);
});

test("people card renderer: tabs, shrink tags, overlays restore draft helpers exist", () => {
  const client = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  assert.match(client, /SMARTsummary/);
  assert.doesNotMatch(client, /"Smart Summary"/);
  assert.match(client, /renderPeopleCard/);
  assert.match(client, /captureChatState/);
  assert.match(client, /restoreChatState/);
  assert.match(client, /floqr-chrome-change/);
  assert.match(client, /currentOverlaySession/);
  assert.match(client, /rememberOverlaySession/);
  assert.match(client, /bindOverlayDocument/);
  assert.match(client, /editLocale/);
  assert.doesNotMatch(client, /activePeople = people/);
  const css = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.css"), "utf8");
  assert.match(css, /var\(--accent/);
  assert.doesNotMatch(css, /#20d9d8/);
  const html = fs.readFileSync(path.join(__dirname, "..", "botdee.html"), "utf8");
  assert.match(html, /botdee-smartview\.js/);
  assert.match(html, /botdee-smartview\.css/);
});

test("overlay handlers follow the current card session, not the first bind", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  const sandbox = {
    window: {
      FLOQRI18n: {t: (k, f) => f},
      FLOQRNav: null,
      location: {href: "https://example.test/x"},
      document: {},
      addEventListener() {}
    }
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(code.replace("(window)", "(window)"), sandbox);
  const api = sandbox.window.FLOQRBotDeeSmartView;
  const first = {people: {displayName: "First", media: {photos: [{url: "./one.png"}]}}, mediaIndex: 0, mediaType: "photos"};
  const second = {people: {displayName: "Second", media: {photos: [{url: "./two-a.png"}, {url: "./two-b.png"}]}}, mediaIndex: 0, mediaType: "photos"};
  api.rememberOverlaySession(first);
  api.advanceOverlayMedia(1);
  assert.equal(api.currentOverlaySession().people.displayName, "First");
  api.rememberOverlaySession(second);
  const moved = api.advanceOverlayMedia(1);
  assert.equal(moved.people.displayName, "Second");
  assert.equal(moved.mediaIndex, 1);
  assert.equal(moved.people.media.photos[1].url, "./two-b.png");
  assert.equal(api.tagsForPeople({
    datingVisible: false,
    categories: {Dating: {Preferences: ["secret"]}}
  }, "Dating", "Preferences").length, 0);
  assert.equal(api.tagsForPeople({
    datingVisible: true,
    categories: {Dating: {Preferences: ["Friends first"]}}
  }, "Dating", "Preferences")[0], "Friends first");
});

test("Master Admin SMARTviews subtab preserved", () => {
  const master = fs.readFileSync(path.join(__dirname, "..", "master-admin.html"), "utf8");
  assert.match(master, /data-botdee-page="smartviews"/);
  assert.match(master, /id="botDeeMasterSmartViewDemo"/);
  assert.match(master, /id="botDeeMasterLoadSmartViews"/);
  const app = fs.readFileSync(path.join(__dirname, "..", "master-admin-app.js"), "utf8");
  assert.match(app, /botDeeMasterSmartViewDemo/);
  assert.match(app, /featuresBotDee\[-_:\]/);
});

test("BOT DEE Functions deploy tag includes People SmartView v2 callables", () => {
  const wf = fs.readFileSync(path.join(__dirname, "..", ".github/workflows/functions-ci.yml"), "utf8");
  ["getPeopleSmartView", "saveSmartSummary", "queuePeopleSmartViewAnalysis",
    "processSmartViewTranslationJob", "onUserProfileSmartViewWrite", "onSmartViewTranslationJobCreated"]
    .forEach(name => assert.match(wf, new RegExp(name)));
});

test("analysis and translation jobs are Functions-write", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  assert.match(rules, /match \/usercharacter_analysis\/\{uid\}[\s\S]*allow write: if false;/);
  assert.match(rules, /match \/smartViewTranslationJobs\/\{jobId\}[\s\S]*allow write: if false;/);
  assert.match(rules, /match \/botDeeSmartViewDiagnostics\/\{id\}[\s\S]*allow write: if false;/);
});

test("public-page Profile Media is the SMARTview hero, gallery, and videos", () => {
  const hero = "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/profileMedia%2Fhero.jpg?alt=media";
  const extra = "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/profileMedia%2Ftwo.jpg?alt=media";
  const clip = "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/profileMedia%2Fclip.mp4?alt=media";
  const google = "https://lh3.googleusercontent.com/a/legacy-auth";
  const media = v2.publicPageMedia({
    displayName: "Don Papi",
    photoURL: google,
    profileMediaSlots: [
      {slot: 1, type: "image", url: hero},
      {slot: 2, type: "image", url: extra},
      {}, {}, {}, {}, {}, {},
      {slot: 9, type: "video", url: clip}
    ]
  });
  assert.equal(media.photoUrl, hero);
  assert.deepEqual(media.photos.map(row => row.url), [hero, extra]);
  assert.deepEqual(media.videos.map(row => row.url), [clip]);
  const snap = v2.publicFieldsSnapshot({
    displayName: "Don Papi",
    photoURL: google,
    profileMediaSlots: [
      {slot: 1, type: "image", url: hero},
      {slot: 2, type: "image", url: extra},
      {}, {}, {}, {}, {}, {},
      {slot: 9, type: "video", url: clip}
    ]
  }, {sharedDatapoints: ["music"], datapoints: {music: ["Afrobeats"]}});
  assert.equal(snap.photoUrl, hero);
  assert.equal(snap.photos.length, 2);
  assert.equal(snap.videos.length, 1);
  const payload = v2.peopleV2Payload({
    subjectUid: "don",
    snap,
    analysis: v2.emptyAnalysis("don", snap),
    viewerUid: "don",
    viewerMaySee: true
  });
  assert.equal(payload.photo.url, hero);
  assert.equal(payload.photo.kind, "image");
  assert.equal(payload.media.photos.length, 2);
  assert.equal(payload.media.videos[0].url, clip);
  const emptySlots = v2.publicPageMedia({displayName: "Don Papi", photoURL: google, profileMediaSlots: []});
  assert.equal(emptySlots.photoUrl, google);
  const extrasIgnored = v2.publicPageMedia({
    displayName: "Don Papi",
    profileMediaSlots: [{type: "image", url: hero}],
    publicPhotos: ["https://example.test/extra-public.jpg"],
    galleryUrls: ["https://example.test/extra-gallery.jpg"],
    publicGallery: [{url: "https://example.test/extra-gallery-obj.jpg"}]
  });
  assert.deepEqual(extrasIgnored.photos.map(row => row.url), [hero]);
  const emptySlot0 = v2.publicPageMedia({
    displayName: "Don Papi",
    photoURL: google,
    profileMediaSlots: [{type: "image", url: ""}, {type: "image", url: extra}]
  });
  assert.equal(emptySlot0.hero.url, extra);
  assert.equal(emptySlot0.photoUrl, extra);
  assert.equal(emptySlot0.ordered.length, 1);
  const videoOnly = v2.publicPageMedia({
    displayName: "Don Papi",
    profileMediaSlots: [{}, {}, {}, {}, {}, {}, {}, {}, {type: "video", url: clip}]
  });
  assert.equal(videoOnly.hero.url, clip);
  assert.equal(videoOnly.hero.kind, "video");
  const videoSnap = v2.publicFieldsSnapshot({
    displayName: "Don Papi",
    profileMediaSlots: [{}, {}, {}, {}, {}, {}, {}, {}, {type: "video", url: clip}]
  }, {sharedDatapoints: ["music"], datapoints: {music: ["Afrobeats"]}});
  const videoPayload = v2.peopleV2Payload({
    subjectUid: "don",
    snap: videoSnap,
    analysis: v2.emptyAnalysis("don", videoSnap),
    viewerUid: "don",
    viewerMaySee: true
  });
  assert.equal(videoPayload.photo.url, clip);
  assert.equal(videoPayload.photo.kind, "video");
  const hidden = v2.peopleV2Payload({
    subjectUid: "don",
    snap,
    analysis: v2.emptyAnalysis("don", snap),
    viewerUid: "other",
    viewerMaySee: false
  });
  assert.equal(hidden, null);
});

test("people-directory photoOf prefers public-page slot 0 over Auth photoURL", () => {
  const people = require("./people-directory-core");
  const hero = "https://example.test/public-hero.jpg";
  assert.equal(people.photoOf({
    photoURL: "https://lh3.googleusercontent.com/a/auth",
    profileMediaSlots: [{type: "image", url: hero}]
  }), hero);
  assert.equal(people.photoOf({
    photoURL: "https://lh3.googleusercontent.com/a/auth",
    profileMediaSlots: []
  }), "https://lh3.googleusercontent.com/a/auth");
  assert.equal(people.photoOf({
    photoURL: "https://lh3.googleusercontent.com/a/auth",
    profileMediaSlots: [{type: "image", url: ""}, {type: "image", url: hero}]
  }), hero);
});

test("chrome and help use SMARTview spelling, not SmartView", () => {
  const i18n = fs.readFileSync(path.join(__dirname, "..", "floqr-i18n.js"), "utf8");
  const help = fs.readFileSync(path.join(__dirname, "..", "floqr-i18n-help.js"), "utf8");
  const repo = fs.readFileSync(path.join(__dirname, "..", "botdee-help-repository.js"), "utf8");
  assert.match(i18n, /"botdee\.sv\.person": "SMARTview — Person"/);
  assert.match(i18n, /"botdee\.sv\.videoIndex": "Video"/);
  assert.doesNotMatch(i18n, /SmartView/);
  assert.doesNotMatch(help, /SmartView/);
  assert.doesNotMatch(repo, /SmartView/);
  assert.match(repo, /same hero as your FLOQR public profile/);
  assert.match(repo, /same Profile Media as your FLOQR public page/);
});

test("vm people card HTML has no duplicate Music heading and uses escaped text", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  const sandbox = {window: {FLOQRI18n: {t: (k, f) => f}, FLOQRNav: null, location: {href: "https://example.test/x"}}, document: {}};
  sandbox.global = sandbox.window;
  vm.runInNewContext(code.replace("(window)", "(window)"), sandbox);
  const payload = smart.mockCatalog().find(row => row.kind === "patron");
  const html = sandbox.window.FLOQRBotDeeSmartView.renderCard(payload);
  assert.match(html, /botdee-sv-people/);
  assert.doesNotMatch(html, /<h3>\s*Music/i);
  assert.match(html, /Afrobeats/);
  assert.doesNotMatch(html, /<script>/);
});

test("SMARTview overlay pages videos and paints a video element", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  assert.match(code, /<video src=/);
  assert.match(code, /overlayMediaList/);
  const sandbox = {
    window: {
      FLOQRI18n: {t: (k, f) => f},
      FLOQRNav: null,
      location: {href: "https://example.test/x"},
      document: {},
      addEventListener() {}
    }
  };
  sandbox.global = sandbox.window;
  vm.runInNewContext(code.replace("(window)", "(window)"), sandbox);
  const api = sandbox.window.FLOQRBotDeeSmartView;
  const session = {
    people: {
      displayName: "Don Papi",
      media: {
        photos: [{url: "https://example.test/hero.jpg"}],
        videos: [{url: "https://example.test/one.mp4"}, {url: "https://example.test/two.mp4"}]
      }
    },
    mediaType: "videos",
    mediaIndex: 0
  };
  api.rememberOverlaySession(session);
  const moved = api.advanceOverlayMedia(1);
  assert.equal(moved.mediaType, "videos");
  assert.equal(moved.mediaIndex, 1);
  assert.equal(moved.people.media.videos[1].url, "https://example.test/two.mp4");
  assert.match(code, /botdee\.sv\.videoIndex/);
  assert.match(code, /if \(session\.mediaType !== "videos"\) session\.mediaType = "photos"/);
  assert.doesNotMatch(code, /session\.mediaType = "photos";\s*session\.mediaIndex = 0/);
});

test("compact SMARTview paints a video hero when the first filled public slot is a video", () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "botdee-smartview.js"), "utf8");
  const sandbox = {window: {FLOQRI18n: {t: (k, f) => f}, FLOQRNav: null, location: {href: "https://example.test/x"}}, document: {}};
  sandbox.global = sandbox.window;
  vm.runInNewContext(code.replace("(window)", "(window)"), sandbox);
  const html = sandbox.window.FLOQRBotDeeSmartView.renderCard({
    kind: "patron",
    floqrPublicData: {
      peopleV2: {
        displayName: "Don Papi",
        photo: {url: "https://example.test/clip.mp4", count: 1, kind: "video"},
        media: {photos: [], videos: [{url: "https://example.test/clip.mp4", alt: "Don Papi"}]},
        summary: {text: "Public clip first."},
        categories: {Social: {Music: ["Afrobeats"], Nightlife: [], Sports: [], Events: []}},
        defaultPrimary: "Social",
        defaultSecondary: "Music",
        handles: [],
        profileHref: "./patron-portal.html?tab=profile",
        minglHref: "./?start=search"
      }
    }
  });
  assert.match(html, /<video src="https:\/\/example\.test\/clip\.mp4"/);
  assert.doesNotMatch(html, /<img src="https:\/\/example\.test\/clip\.mp4"/);
});
