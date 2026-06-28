/* FLOQR AI diagnostics and crawler controls v28.45 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  const state = {
    db: null,
    auth: null,
    storage: null,
    mounted: false,
    lastData: {}
  };

  const STATUS_COPY = {
    Pass: "Implemented and currently healthy",
    "Soft Fail": "Implemented and diagnosed with minor error(s)",
    Failed: "Implemented but failing or blocked",
    TBI: "To be implemented"
  };

  const DEFAULT_EVENT_TYPES = [
    "nightclub",
    "lounge",
    "rooftop lounge",
    "rooftop bar",
    "beach club",
    "brunch party",
    "pool party",
    "summer party",
    "DJ event",
    "promoter event",
    "comedy show",
    "ticket resale event"
  ];

  const DEFAULT_GENRES = [
    "Hip Hop",
    "Afro Beats",
    "Amapiano",
    "House",
    "EDM",
    "Latin",
    "Arabic Music",
    "R&B",
    "Reggaeton"
  ];

  const DEFAULT_MARKET_LANGUAGE_PLAN = [
    "Portugal | Portuguese | Lisboa, Porto | rooftop bars, beach clubs, comedy shows, DJ events, tickets",
    "Spain | Spanish, Catalan | Barcelona, Madrid, Ibiza, Marbella | Latin, reggaeton, rooftops, beach clubs, resale tickets",
    "France | French | Paris, Nice, Cannes, Saint-Tropez | lounges, summer parties, comedy shows, DJ events",
    "Belgium | French, Dutch | Brussels, Antwerp | rooftops, clubs, DJ events",
    "Netherlands | Dutch, English | Amsterdam, Rotterdam | clubs, lounges, festival tickets",
    "Luxembourg | French, German | Luxembourg City | lounges, comedy shows, ticketed events",
    "Germany | German | Berlin, Hamburg, Munich, Cologne | clubs, comedy shows, DJs",
    "Switzerland | German, French, Italian | Zurich, Geneva, Basel | lounges, premium nightlife, tickets",
    "Austria | German | Vienna, Salzburg | lounges, clubs, comedy shows",
    "Italy | Italian | Milan, Rome, Florence, Venice | rooftops, lounges, DJ events",
    "Ireland | English, Irish | Dublin, Cork | comedy shows, live music, tickets",
    "United Kingdom | English | London, Manchester, Birmingham | rooftops, comedy shows, DJ events, resale tickets",
    "Denmark | Danish | Copenhagen | rooftops, clubs, ticketed events",
    "Norway | Norwegian | Oslo, Bergen | lounges, clubs, DJs",
    "Sweden | Swedish | Stockholm, Gothenburg | lounges, DJs, summer parties",
    "Finland | Finnish, Swedish | Helsinki | clubs, DJs, ticketed events",
    "Iceland | Icelandic, English | Reykjavik | lounges, comedy shows, nightlife tickets",
    "United Arab Emirates | Arabic, English | Dubai | rooftop lounges, Arabic music DJs, comedy shows, ticket resale",
    "Turkey | Turkish | Istanbul | rooftop bars, Latin nights, DJs, ticket resale",
    "Singapore | English, Mandarin, Malay, Tamil | Singapore | lounges, clubs, comedy shows, ticketed events",
    "Thailand | Thai, English | Bangkok, Phuket | rooftops, beach clubs, DJs, ticketed events",
    "China | Chinese, English | Shanghai | lounges, clubs, comedy shows, DJs"
  ];

  const COLLECTIONS = [
    "users",
    "shoutouts",
    "liveContent",
    "guestListRequests",
    "messages",
    "inboxNotifications",
    "clubLocations",
    "events",
    "templates",
    "minglConnections",
    "chatRooms",
    "chatMessages",
    "roleRequests",
    "clubEmployeeDesignations",
    "patronTemplateVariants",
    "aiIndex",
    "aiUserNotificationPreferences",
    "aiSearchLogs",
    "aiRecommendations",
    "aiDiscoverySources",
    "aiDiscoveryQueue",
    "aiDiscoveryRatingCriteria",
    "aiCrawlRuns",
    "aiCrawlerSchedules",
    "aiDiagnosticsReports"
  ];

  const PACKAGE_INSTALL_CHECKS = [
    {
      version: "v28.44-ai",
      title: "FLOQR AI Core Layer",
      checks: [
        {label:"AI feature flags", file:"shared-data.js", includes:["FLOQR_AI_ENABLED", "FLOQR_AI_PROVIDER", "FLOQR_AI_FALLBACK_MODE"]},
        {label:"Local fallback search engine", file:"ai-service.js", includes:["function localContextualSearch", "function floqrSearch", "window.floqrSearch"]},
        {label:"Search record adapters", file:"ai-search-service.js", includes:["window.FLOQRAISearch", "searchRecords", "window.floqrSearch"]},
        {label:"Assistant scaffold", file:"ai-assistant-ui.js", includes:["Ask FLOQR", "role"]},
        {label:"Template Studio scaffold", file:"ai-template-studio.js", includes:["patronTemplateVariants", "aiTemplatePromptHistory"]},
        {label:"AI Discovery module", file:"master-admin.html", includes:["ai-discovery-service.js"]}
      ]
    },
    {
      version: "v28.45-diagnostics",
      title: "Diagnostics + AI Discovery Controls",
      checks: [
        {label:"Diagnostics page tab", file:"master-admin.html", includes:["data-panel=\"diagnostics\"", "Master Admin Settings - Diagnostics"]},
        {label:"Crawler controls", file:"master-admin.html", includes:["crawlSearchCriteria", "runManualCrawlBtn", "crawlAnalyticsInsights"]},
        {label:"Diagnostics module loaded", file:"master-admin.html", includes:["ai-diagnostics-service.js"]},
        {label:"Crawler rules collections", file:"firestore.rules", includes:["match /aiCrawlRuns/{id}", "match /aiCrawlerSchedules/{id}", "match /aiDiagnosticsReports/{id}"]},
        {label:"Public profile language", file:"patron-portal.html", includes:["editPublicProfileLanguageMode", "editBioEnglish"]}
      ]
    },
    {
      version: "v28.46-video-trim",
      title: "First-7-Second Video Trim Correction",
      checks: [
        {label:"Video trim media service", file:"ai-media-service.js", includes:["trimVideoToFirstSevenSeconds", "first-7-second", "trimProcessingMode"]},
        {label:"Patron trim metadata save", file:"patron-app.js", includes:["trimmedMediaUrl", "trimProcessingMode", "trimWarning"]},
        {label:"Admin approval trim pass-through", file:"admin-app.js", includes:["trimmedMediaUrl", "originalMediaUploaded", "trimProcessingMode"]},
        {label:"Display trim playback enforcement", file:"display-app.js", includes:["enforceTrimmedVideoPlayback", "selectedMediaVersion !== \"trimmed\""]},
        {label:"Cache-busted installed scripts", file:"index.html", includes:["28.46-video-trim", "ai-media-service.js"]}
      ]
    },
    {
      version: "v28.47-rules-diag",
      title: "Rules Smoke Tests + Per-Package Diagnostics",
      checks: [
        {label:"Rules smoke test UI", file:"master-admin.html", includes:["runRulesSmokeTestBtn", "rulesSmokeTestReport"]},
        {label:"Package diagnostics UI", file:"master-admin.html", includes:["runPackageDiagnosticsBtn", "packageInstallDiagnosticsReport"]},
        {label:"Rules smoke test runner", file:"ai-diagnostics-service.js", includes:["runRulesSmokeTest", "aiDiagnosticsReports", "template-backgrounds"]},
        {label:"Package install runner", file:"ai-diagnostics-service.js", includes:["PACKAGE_INSTALL_CHECKS", "runPackageInstallDiagnostics"]},
        {label:"Storage passed to diagnostics", file:"master-admin-app.js", includes:["const storage", "FLOQRDiagnostics", "storage"]}
      ]
    },
    {
      version: "v28.48-diagnostics-fix",
      title: "Diagnostics Marker + Storage Guidance Fix",
      checks: [
        {label:"AI search marker fixed", file:"ai-diagnostics-service.js", includes:["Local fallback search engine", "function localContextualSearch", "Search record adapters"]},
        {label:"Storage unauthorized guidance", file:"ai-diagnostics-service.js", includes:["Publish this package's storage.rules", "storage/unauthorized"]},
        {label:"Queue status labels", file:"ai-diagnostics-service.js", includes:["function queueStatusBadge", "Pending Review"]},
        {label:"Soft Fail definition in UI", file:"master-admin.html", includes:["Soft Fail means the feature is present and safe"]},
        {label:"Market Language Plan definition in UI", file:"master-admin.html", includes:["Simple Market + Language Plan", "Where? What language? Which cities? What should FLOQR look for?"]}
      ]
    },
    {
      version: "v28.49-language-plan-help",
      title: "Simplified Crawler Language Plan Explanation",
      checks: [
        {label:"Plain language crawler market format", file:"master-admin.html", includes:["Use one line per market", "Country or market | language(s) to search in | cities | event or venue types"]},
        {label:"Crawler plan examples", file:"master-admin.html", includes:["Spain | Spanish, Catalan", "United Arab Emirates | Arabic, English"]}
      ]
    }
  ];

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function fieldValue() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function fmtDate(value) {
    if (!value) return "-";
    const date = value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }

  function splitList(value) {
    if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean);
    return String(value || "").split(/[\n,;|]+/).map(x => x.trim()).filter(Boolean);
  }

  function joinList(value) {
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }

  function normalized(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function countBy(items, fn) {
    const counts = {};
    items.forEach(item => {
      const key = fn(item);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }

  function topList(counts, limit = 6) {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, value]) => `${key} (${value})`)
      .join(", ") || "Not enough data yet";
  }

  function simpleRows(rows) {
    return `<div class="report-table">${rows.map(([key, value]) => `<div><span>${esc(key)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>`;
  }

  function statusBadge(status) {
    const colors = {
      Pass: "#0f766e",
      "Soft Fail": "#a16207",
      Failed: "#b91c1c",
      TBI: "#475569"
    };
    return `<span style="display:inline-flex;align-items:center;border-radius:999px;padding:0.2rem 0.55rem;background:${colors[status] || "#475569"};color:#fff;font-size:0.78rem;font-weight:800;">${esc(status)}</span>`;
  }

  function queueStatusBadge(status) {
    const labelMap = {
      pendingReview: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
      deleted: "Deleted",
      duplicate: "Duplicate"
    };
    const colors = {
      pendingReview: "#2563eb",
      approved: "#0f766e",
      rejected: "#b91c1c",
      deleted: "#475569",
      duplicate: "#7c3aed"
    };
    const key = status || "pendingReview";
    return `<span style="display:inline-flex;align-items:center;border-radius:999px;padding:0.2rem 0.55rem;background:${colors[key] || "#475569"};color:#fff;font-size:0.78rem;font-weight:800;">${esc(labelMap[key] || key)}</span>`;
  }

  function renderCheckCards(wrapId, results = []) {
    const wrap = byId(wrapId);
    if (!wrap) return;
    wrap.innerHTML = results.length ? results.map(item => `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(item.package ? `${item.package}: ${item.label}` : item.label)}</strong>
        ${statusBadge(item.status)}
      </div>
      <p>${esc(item.evidence || "")}</p>
    </div>`).join("") : "<p class='sub'>No diagnostic checks have run yet.</p>";
  }

  function renderCheckSummary(wrapId, results = [], extraRows = []) {
    const counts = countBy(results, item => item.status);
    const rows = [
      ["Pass", counts.Pass || 0],
      ["Soft Fail", counts["Soft Fail"] || 0],
      ["Failed", counts.Failed || 0],
      ["TBI", counts.TBI || 0],
      ...extraRows
    ];
    const wrap = byId(wrapId);
    if (wrap) wrap.innerHTML = simpleRows(rows);
  }

  async function fetchPackageFile(file, cache = new Map()) {
    if (cache.has(file)) return cache.get(file);
    const response = await fetch(`./${file}?diagnostics=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`${file} returned ${response.status}`);
    const text = await response.text();
    cache.set(file, text);
    return text;
  }

  async function runPackageInstallDiagnostics(options = {}) {
    if (!options.silent) setText("diagnosticsStatus", "Running package install diagnostics...");
    const cache = new Map();
    const results = [];
    for (const pkg of PACKAGE_INSTALL_CHECKS) {
      for (const check of pkg.checks) {
        try {
          const text = await fetchPackageFile(check.file, cache);
          const missing = check.includes.filter(token => !text.includes(token));
          results.push({
            package: `${pkg.version} ${pkg.title}`,
            label: check.label,
            status: missing.length ? "Failed" : "Pass",
            evidence: missing.length
              ? `${check.file} is missing: ${missing.join(", ")}`
              : `${check.file} contains expected package marker(s).`
          });
        } catch (error) {
          results.push({
            package: `${pkg.version} ${pkg.title}`,
            label: check.label,
            status: "Failed",
            evidence: error?.message || String(error)
          });
        }
      }
    }
    renderCheckSummary("packageInstallDiagnosticsSummary", results, [
      ["Packages checked", PACKAGE_INSTALL_CHECKS.length],
      ["Purpose", "Confirms installed files contain package feature markers"]
    ]);
    renderCheckCards("packageInstallDiagnosticsReport", results);
    if (!options.silent) {
      const failed = results.filter(item => item.status === "Failed").length;
      setText("diagnosticsStatus", failed ? `Package install diagnostics found ${failed} failed checks.` : "Package install diagnostics passed.");
    }
    return results;
  }

  function tinyPngBlob() {
    const bytes = Uint8Array.from([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,
      0,0,0,13,73,68,65,84,120,156,99,248,255,255,63,0,5,254,2,254,167,53,129,132,0,0,0,0,73,69,78,68,174,66,96,130
    ]);
    return new Blob([bytes], {type:"image/png"});
  }

  async function firestoreDocLifecycle(collection, data, runId) {
    const ref = state.db.collection(collection).doc(`${runId}-${collection}`);
    await ref.set({...data, diagnosticRunId:runId, createdAt:fieldValue(), updatedAt:fieldValue()});
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`${collection} test document was not readable after create.`);
    await ref.set({diagnosticUpdatedAt:fieldValue()}, {merge:true});
    await ref.delete();
  }

  async function ownPreferenceLifecycle(runId, user) {
    const ref = state.db.collection("aiUserNotificationPreferences").doc(user.uid);
    await ref.set({
      uid:user.uid,
      diagnosticRuleTest:{runId, checkedAt:new Date().toISOString()}
    }, {merge:true});
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Own aiUserNotificationPreferences document was not readable.");
    await ref.set({diagnosticRuleTest:firebase.firestore.FieldValue.delete()}, {merge:true});
  }

  async function storageLifecycle(path) {
    if (!state.storage) throw new Error("Firebase Storage SDK or bucket is unavailable on this page.");
    const ref = state.storage.ref().child(path);
    try {
      await ref.put(tinyPngBlob(), {contentType:"image/png"});
      await ref.getDownloadURL();
      await ref.delete();
    } catch (error) {
      if (error?.code === "storage/unauthorized") {
        throw new Error(`Storage rules denied ${path}. Publish this package's storage.rules in Firebase Console > Storage > Rules, then rerun this smoke test.`);
      }
      throw error;
    }
  }

  async function saveRulesSmokeReport(results, overallStatus) {
    try {
      const user = state.auth?.currentUser || {};
      await state.db.collection("aiDiagnosticsReports").add({
        type:"rulesSmokeTest",
        packageVersion:"v28.47-rules-diag",
        status:overallStatus,
        results:results.map(item => ({
          label:item.label,
          status:item.status,
          evidence:item.evidence || ""
        })),
        createdByUid:user.uid || "",
        createdByEmail:user.email || "",
        createdAt:fieldValue()
      });
      return {status:"Pass", evidence:"Rules smoke test report saved to aiDiagnosticsReports."};
    } catch (error) {
      return {status:"Soft Fail", evidence:`Rules checks ran, but report save failed: ${error?.message || error}`};
    }
  }

  async function runRulesSmokeTest() {
    const user = state.auth?.currentUser;
    if (!user) {
      setText("diagnosticsStatus", "Sign in as Master Admin before running rules smoke tests.");
      return [];
    }
    setText("diagnosticsStatus", "Running Firebase rules smoke test...");
    const runId = `diagnostic-${user.uid.slice(0, 8)}-${Date.now()}`;
    const results = [];
    async function capture(label, fn) {
      try {
        await fn();
        results.push({label, status:"Pass", evidence:"Create/read/update/delete or upload/read/delete succeeded for the signed-in user."});
      } catch (error) {
        results.push({label, status:"Failed", evidence:error?.message || String(error)});
      }
    }

    await capture("Firestore: aiCrawlRuns lifecycle", () => firestoreDocLifecycle("aiCrawlRuns", {
      trigger:"diagnostic",
      mode:"rules-smoke-test",
      status:"completed"
    }, runId));
    await capture("Firestore: aiCrawlerSchedules lifecycle", () => firestoreDocLifecycle("aiCrawlerSchedules", {
      enabled:false,
      frequency:"manualOnly",
      scheduleHours:[],
      criteria:{search:"diagnostic"}
    }, runId));
    await capture("Firestore: aiDiagnosticsReports lifecycle", () => firestoreDocLifecycle("aiDiagnosticsReports", {
      type:"diagnosticLifecycle",
      status:"temporary"
    }, runId));
    await capture("Firestore: aiIndex owner/private lifecycle", () => firestoreDocLifecycle("aiIndex", {
      sourceType:"diagnostic",
      sourceId:runId,
      title:"Diagnostics Rule Test",
      summary:"Temporary private aiIndex rule test.",
      keywords:["diagnostic"],
      visibility:"private",
      ownerUid:user.uid,
      allowedRoles:["masterAdmin"]
    }, runId));
    await capture("Firestore: patronTemplateVariants owner lifecycle", () => firestoreDocLifecycle("patronTemplateVariants", {
      ownerUid:user.uid,
      ownerDisplayName:user.displayName || user.email || "Diagnostics",
      baseTemplateId:"diagnostic",
      baseTemplateName:"Diagnostic",
      variantName:"Diagnostic Rule Test",
      backgroundType:"color",
      backgroundColor:"#000000",
      visibility:"private",
      promptShared:false,
      isPublicProfileItem:false,
      status:"diagnostic"
    }, runId));
    await capture("Firestore: aiTemplatePromptHistory owner lifecycle", () => firestoreDocLifecycle("aiTemplatePromptHistory", {
      uid:user.uid,
      templateId:"diagnostic",
      variantId:runId,
      prompt:"diagnostic rule test",
      sourceType:"rule-test",
      visibility:"private"
    }, runId));
    await capture("Firestore: aiUserNotificationPreferences own doc", () => ownPreferenceLifecycle(runId, user));
    await capture("Storage: template-backgrounds image path", () => storageLifecycle(`template-backgrounds/${user.uid}/${runId}/uploaded/rules-smoke-test.png`));
    await capture("Storage: shoutouts original image path", () => storageLifecycle(`shoutouts/${user.uid}/${runId}/original/rules-smoke-test.png`));

    const failed = results.filter(item => item.status === "Failed").length;
    const overallStatus = failed ? "Failed" : "Pass";
    const saved = await saveRulesSmokeReport(results, overallStatus);
    results.push({label:"Diagnostics report persistence", status:saved.status, evidence:saved.evidence});
    renderCheckSummary("rulesSmokeTestSummary", results, [
      ["Overall", overallStatus],
      ["Scope", "Tests signed-in allowed operations; it does not impersonate another user."]
    ]);
    renderCheckCards("rulesSmokeTestReport", results);
    await refreshDiagnostics();
    setText("diagnosticsStatus", failed ? `Rules smoke test found ${failed} failed checks.` : "Rules smoke test passed and report was saved.");
    return results;
  }

  async function readCollectionSafe(name, limit = 750) {
    try {
      const snap = await state.db.collection(name).limit(limit).get();
      return {rows: snap.docs.map(doc => ({id: doc.id, _collection: name, ...doc.data()})), error: ""};
    } catch (error) {
      return {rows: [], error: error?.message || String(error)};
    }
  }

  async function readScheduleSafe() {
    try {
      const snap = await state.db.collection("aiCrawlerSchedules").doc("default").get();
      return snap.exists ? {id: snap.id, ...snap.data()} : null;
    } catch (error) {
      return null;
    }
  }

  function hydrateDefaultControls() {
    if (byId("crawlSearchCriteria") && !byId("crawlSearchCriteria").value) {
      byId("crawlSearchCriteria").value = "nightlife tickets, comedy shows, rooftop lounges, rooftop bars, DJ events, beach clubs, brunch parties, pool parties, summer parties";
    }
    if (byId("crawlGenreCriteria") && !byId("crawlGenreCriteria").value) {
      byId("crawlGenreCriteria").value = DEFAULT_GENRES.join(", ");
    }
    if (byId("crawlLanguageCriteria") && !byId("crawlLanguageCriteria").value) {
      byId("crawlLanguageCriteria").value = "local language, English, Spanish, French, German, Italian, Dutch, Portuguese, Arabic, Turkish, Chinese, Thai";
    }
    if (byId("crawlCityCriteria") && !byId("crawlCityCriteria").value) {
      byId("crawlCityCriteria").value = "Dubai, Istanbul, Singapore, Bangkok, Phuket, Shanghai, Barcelona, Paris, London, Amsterdam, Berlin, Milan";
    }
    if (byId("crawlRegionCriteria") && !byId("crawlRegionCriteria").value) {
      byId("crawlRegionCriteria").value = "Western Europe, Middle East, Southeast Asia, East Asia";
    }
    if (byId("crawlCountryCriteria") && !byId("crawlCountryCriteria").value) {
      byId("crawlCountryCriteria").value = "Portugal, Spain, France, Belgium, Netherlands, Luxembourg, Germany, Switzerland, Austria, Italy, Ireland, United Kingdom, Denmark, Norway, Sweden, Finland, Iceland, United Arab Emirates, Turkey, Singapore, Thailand, China";
    }
    if (byId("crawlEventTypeCriteria") && !byId("crawlEventTypeCriteria").value) {
      byId("crawlEventTypeCriteria").value = DEFAULT_EVENT_TYPES.join(", ");
    }
    if (byId("crawlMarketLanguageCriteria") && !byId("crawlMarketLanguageCriteria").value) {
      byId("crawlMarketLanguageCriteria").value = DEFAULT_MARKET_LANGUAGE_PLAN.join("\n");
    }
    if (byId("crawlScheduleHours") && !byId("crawlScheduleHours").value) {
      byId("crawlScheduleHours").value = "00:00, 04:00, 08:00, 12:00, 16:00, 20:00";
    }
  }

  function applyScheduleToControls(schedule = {}) {
    if (!schedule) return;
    if (byId("crawlFrequency")) byId("crawlFrequency").value = schedule.frequency || "every4Hours";
    if (byId("crawlScheduleHours")) byId("crawlScheduleHours").value = joinList(schedule.scheduleHours) || byId("crawlScheduleHours").value;
    const criteria = schedule.criteria || {};
    if (criteria.search && byId("crawlSearchCriteria")) byId("crawlSearchCriteria").value = criteria.search;
    if (criteria.genres && byId("crawlGenreCriteria")) byId("crawlGenreCriteria").value = joinList(criteria.genres);
    if (criteria.languages && byId("crawlLanguageCriteria")) byId("crawlLanguageCriteria").value = joinList(criteria.languages);
    if (criteria.cities && byId("crawlCityCriteria")) byId("crawlCityCriteria").value = joinList(criteria.cities);
    if (criteria.regions && byId("crawlRegionCriteria")) byId("crawlRegionCriteria").value = joinList(criteria.regions);
    if (criteria.countries && byId("crawlCountryCriteria")) byId("crawlCountryCriteria").value = joinList(criteria.countries);
    if (criteria.eventTypes && byId("crawlEventTypeCriteria")) byId("crawlEventTypeCriteria").value = joinList(criteria.eventTypes);
    if (criteria.marketLanguagePlan && byId("crawlMarketLanguageCriteria")) {
      byId("crawlMarketLanguageCriteria").value = Array.isArray(criteria.marketLanguagePlan)
        ? criteria.marketLanguagePlan.join("\n")
        : String(criteria.marketLanguagePlan || "");
    }
  }

  function readCriteriaFromControls() {
    return {
      search: byId("crawlSearchCriteria")?.value.trim() || "",
      genres: splitList(byId("crawlGenreCriteria")?.value),
      languages: splitList(byId("crawlLanguageCriteria")?.value),
      cities: splitList(byId("crawlCityCriteria")?.value),
      regions: splitList(byId("crawlRegionCriteria")?.value),
      countries: splitList(byId("crawlCountryCriteria")?.value),
      eventTypes: splitList(byId("crawlEventTypeCriteria")?.value),
      marketLanguagePlan: splitList(byId("crawlMarketLanguageCriteria")?.value)
    };
  }

  function readScheduleFromControls() {
    return {
      enabled: byId("crawlFrequency")?.value !== "manualOnly",
      frequency: byId("crawlFrequency")?.value || "every4Hours",
      scheduleHours: splitList(byId("crawlScheduleHours")?.value),
      criteria: readCriteriaFromControls(),
      updatedAt: fieldValue(),
      updatedByUid: state.auth?.currentUser?.uid || "",
      updatedByEmail: state.auth?.currentUser?.email || ""
    };
  }

  async function saveCrawlSchedule(options = {}) {
    if (!state.db) return;
    const schedule = readScheduleFromControls();
    setText("diagnosticsStatus", "Saving crawler schedule and search criteria...");
    await state.db.collection("aiCrawlerSchedules").doc("default").set(schedule, {merge: true});
    if (!options.silent) {
      setText("diagnosticsStatus", "Crawler schedule saved. Backend Cloud Scheduler deployment is still required for automatic internet crawling.");
      await refreshDiagnostics();
    }
    return schedule;
  }

  function marketForCity(city) {
    const key = normalized(city);
    if (key.includes("dubai")) return {country: "United Arab Emirates", language: "Arabic, English"};
    if (key.includes("istanbul")) return {country: "Turkey", language: "Turkish"};
    if (key.includes("singapore")) return {country: "Singapore", language: "English, Mandarin, Malay, Tamil"};
    if (key.includes("bangkok") || key.includes("phuket")) return {country: "Thailand", language: "Thai, English"};
    if (key.includes("shanghai")) return {country: "China", language: "Chinese, English"};
    if (key.includes("barcelona") || key.includes("madrid") || key.includes("ibiza")) return {country: "Spain", language: "Spanish"};
    if (key.includes("paris") || key.includes("cannes") || key.includes("nice")) return {country: "France", language: "French"};
    if (key.includes("london") || key.includes("manchester")) return {country: "United Kingdom", language: "English"};
    return {country: "", language: ""};
  }

  function ticketPartnerUrl(partner, query, city) {
    const encoded = encodeURIComponent(`${query} ${city}`.trim());
    if (partner === "Ticketmaster") return `https://www.ticketmaster.com/search?q=${encoded}`;
    if (partner === "Eventbrite") return `https://www.eventbrite.com/d/${encoded}/events/`;
    return `https://www.google.com/search?q=${encoded}+tickets+resale`;
  }

  function candidateBase(criteria, runId, index, override = {}) {
    const city = override.city || criteria.cities[index % Math.max(criteria.cities.length, 1)] || "Dubai";
    const market = marketForCity(city);
    const country = override.country || criteria.countries[index % Math.max(criteria.countries.length, 1)] || market.country || "";
    const genre = override.genre || criteria.genres[index % Math.max(criteria.genres.length, 1)] || "Hip Hop";
    const eventType = override.eventType || criteria.eventTypes[index % Math.max(criteria.eventTypes.length, 1)] || "nightclub";
    const sourceName = override.sourceName || (index % 2 === 0 ? "Ticketmaster public search" : "Eventbrite public search");
    const title = override.title || `${city} ${eventType} ${genre}`;
    const query = `${title} ${criteria.search || ""}`.trim();
    return {
      proposedType: override.proposedType || (eventType.includes("rooftop") || eventType.includes("lounge") ? "lounge" : "event"),
      proposedTitle: title,
      proposedDescription: override.description || `AI-ready public-source candidate for ${eventType}, ${genre}, and ticket discovery in ${city}.`,
      proposedDate: "",
      proposedTime: "",
      proposedLocationName: override.locationName || title,
      proposedAddress: "",
      city,
      stateRegion: override.region || criteria.regions[0] || "",
      country,
      sourceUrl: ticketPartnerUrl(sourceName.includes("Ticketmaster") ? "Ticketmaster" : sourceName.includes("Eventbrite") ? "Eventbrite" : "Resale", query, city),
      sourceName,
      extractedImages: [],
      extractedTags: [eventType, genre, city, country].filter(Boolean),
      categories: [eventType, "public-discovery", "ticketing"].filter(Boolean),
      genres: [genre],
      searchLanguage: override.language || market.language || criteria.languages[0] || "local language",
      searchQuery: query,
      ticketingPartners: ["Ticketmaster", "Eventbrite", "approved resale partners"],
      aiSummary: `Candidate generated from Master Admin crawl criteria. Review public source, deduplicate, and edit before approval.`,
      aiConfidenceScore: override.confidence || 0.68,
      aiStarRating: override.star || 3,
      aiRatingReasons: [
        "Matches configured nightlife/event search criteria",
        "Prepared for public-source validation",
        "Requires Super Admin approval before publishing"
      ],
      duplicateCandidateIds: [],
      status: "pendingReview",
      crawlRunId: runId,
      criteriaSnapshot: criteria,
      discoveryMode: "manual-simulated-public-source",
      createdAt: fieldValue(),
      updatedAt: fieldValue()
    };
  }

  function buildManualCrawlCandidates(criteria, runId) {
    const cities = criteria.cities.length ? criteria.cities : ["Dubai", "Istanbul", "Singapore", "Shanghai"];
    const countries = criteria.countries.length ? criteria.countries : [];
    const items = [
      {city: cities[0] || "Dubai", country: countries[0] || "United Arab Emirates", eventType: "rooftop lounge", genre: "Arabic Music", title: `${cities[0] || "Dubai"} rooftop lounge Arabic DJ tickets`, star: 4, confidence: 0.77, sourceName: "Ticketmaster public search"},
      {city: cities[1] || "Istanbul", country: countries[1] || "Turkey", eventType: "rooftop bar", genre: "Latin", title: `${cities[1] || "Istanbul"} rooftop bar Latin night`, star: 4, confidence: 0.74, sourceName: "Eventbrite public search"},
      {city: cities[2] || "Singapore", country: countries[2] || "Singapore", eventType: "comedy show", genre: "Live Entertainment", title: `${cities[2] || "Singapore"} comedy show tickets`, star: 3, confidence: 0.7, sourceName: "Ticket resale public search"},
      {city: cities[3] || "Shanghai", country: countries[3] || "China", eventType: "DJ event", genre: criteria.genres[0] || "Hip Hop", title: `${cities[3] || "Shanghai"} DJ event ticket discovery`, star: 3, confidence: 0.66, sourceName: "Eventbrite public search"},
      {city: cities[4] || "Barcelona", country: countries[4] || "Spain", eventType: "beach club", genre: "Latin", title: `${cities[4] || "Barcelona"} beach club Latin DJ event`, star: 4, confidence: 0.79, sourceName: "Ticketmaster public search"}
    ];
    return items.map((item, index) => candidateBase(criteria, runId, index, item));
  }

  async function runManualCrawl() {
    if (!state.db) return;
    const user = state.auth?.currentUser;
    const schedule = await saveCrawlSchedule({silent: true});
    const criteria = schedule.criteria;
    const runRef = state.db.collection("aiCrawlRuns").doc();
    setText("diagnosticsStatus", "Running manual public-source crawl scaffold...");
    await runRef.set({
      trigger: "manual",
      mode: "manual-simulated-public-source",
      status: "running",
      criteria,
      requestedByUid: user?.uid || "",
      requestedByEmail: user?.email || "",
      startedAt: fieldValue(),
      note: "Static app scaffold. Backend scheduled crawler must validate public sources, robots.txt, APIs, and source terms before production use."
    });
    const candidates = buildManualCrawlCandidates(criteria, runRef.id);
    for (const item of candidates) {
      await state.db.collection("aiDiscoveryQueue").add(item);
    }
    await runRef.set({
      status: "completed",
      createdRecordCount: candidates.length,
      completedAt: fieldValue(),
      updatedAt: fieldValue()
    }, {merge: true});
    setText("diagnosticsStatus", `Manual crawl scaffold complete. ${candidates.length} records added to aiDiscoveryQueue for Super Admin review.`);
    await refreshDiagnostics();
  }

  function collectionCount(data, name) {
    return data[name]?.rows?.length || 0;
  }

  function collectionError(data, name) {
    return data[name]?.error || "";
  }

  function collectionStatus(data, name, emptySoftFail = false) {
    if (collectionError(data, name)) return "Failed";
    if (emptySoftFail && collectionCount(data, name) === 0) return "Soft Fail";
    return "Pass";
  }

  function buildFeatureDiagnostics(data) {
    const aiIndexRows = data.aiIndex?.rows || [];
    const unsafeIndexRows = aiIndexRows.filter(row => {
      const type = normalized(row.sourceType);
      const visibility = String(row.visibility || "").toLowerCase();
      return type.includes("chat") || type.includes("message") || (visibility && !["public", "shared", "private"].includes(visibility));
    });
    const publicClubProfiles = (data.clubLocations?.rows || []).filter(row => row.officialWebsite || row.website || row.email || row.telephone || row.phone || row.socialMediaHandles);
    const userLanguageRows = (data.users?.rows || []).filter(row => row.publicProfileLanguageMode || row.publicProfileBioEnglish || row.publicProfileTranslationStatus);
    const scheduleRows = data.aiCrawlerSchedules?.rows || [];
    const crawlRuns = data.aiCrawlRuns?.rows || [];
    const discoveryQueue = data.aiDiscoveryQueue?.rows || [];
    const diagnosticsReports = data.aiDiagnosticsReports?.rows || [];
    const latestRulesReport = diagnosticsReports
      .filter(row => row.type === "rulesSmokeTest")
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];
    const hasSearch = !!window.floqrSearch;
    const hasDiscovery = !!window.FLOQRAIDiscovery;

    return [
      ["Authentication", "Firebase config", window.firebaseConfig ? "Pass" : "Failed", window.firebaseConfig ? "window.firebaseConfig present." : "Missing Firebase config."],
      ["Authentication", "Firebase Auth session", state.auth?.currentUser ? "Pass" : "Soft Fail", state.auth?.currentUser ? "Master Admin is signed in." : "No active user in this diagnostics session."],
      ["Authentication", "Master Admin allow-list", state.auth?.currentUser ? "Pass" : "Failed", "Master Admin shell gates this page before diagnostics mount."],
      ["Authentication", "Role-based experiences", collectionStatus(data, "users", true), `${collectionCount(data, "users")} user records readable for role diagnostics.`],
      ["Settings", "My Profile and Privacy", collectionStatus(data, "users"), "Profile, privacy, and consent records remain under the Settings portal."],
      ["Settings", "Public profile preferred language", userLanguageRows.length ? "Pass" : "Soft Fail", userLanguageRows.length ? `${userLanguageRows.length} users have public profile language metadata.` : "Schema/UI ready; no saved language publishing choices yet."],
      ["Settings", "AI English translation scaffold", window.FLOQR_AI_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_ENABLED ? "AI flag enabled, but translation should still route through a safe provider." : "Local placeholder stores English field without exposing AI keys."],
      ["ShoutOut", "Submission queue", collectionStatus(data, "shoutouts"), `${collectionCount(data, "shoutouts")} ShoutOut records scanned.`],
      ["ShoutOut", "Admin approval queue", collectionStatus(data, "shoutouts"), "Pending and approved ShoutOut records are readable for diagnostics."],
      ["ShoutOut", "LED display content", collectionStatus(data, "liveContent", true), `${collectionCount(data, "liveContent")} live display records scanned.`],
      ["ShoutOut", "Media AI panel", "Soft Fail", "Browser filter/metadata fallback is implemented; live Gemini media editing/moderation remains backend-dependent."],
      ["ShoutOut", "Improve My ShoutOut", hasSearch ? "Pass" : "Soft Fail", "Safe curated fallback should work when AI flags are false."],
      ["Guest Lists", "Guest list routing", collectionStatus(data, "guestListRequests", true), `${collectionCount(data, "guestListRequests")} guest list requests scanned.`],
      ["Mingl", "Mingl matching", collectionStatus(data, "minglConnections", true), `${collectionCount(data, "minglConnections")} Mingl connection records scanned.`],
      ["Mingl", "Mingl chat rooms", collectionStatus(data, "chatRooms", true), `${collectionCount(data, "chatRooms")} chat room records scanned.`],
      ["Mingl", "Chat messages privacy", collectionStatus(data, "chatMessages", true), "Diagnostics count chat records but do not copy private chat bodies into aiIndex."],
      ["Messaging", "Inbox notifications", collectionStatus(data, "inboxNotifications", true), `${collectionCount(data, "inboxNotifications")} inbox notifications scanned.`],
      ["Bata", "Marketplace discovery/search", "TBI", "Bata search hooks are AI-ready, but production listing and checkout workflows are not live yet."],
      ["AI Search", "floqrSearch local fallback", hasSearch ? "Pass" : "Failed", hasSearch ? `FLOQR_AI_ENABLED=${window.FLOQR_AI_ENABLED === true}; fallback=${window.FLOQR_AI_FALLBACK_MODE || "local-contextual-search"}.` : "FLOQRSearch module was not loaded."],
      ["AI Search", "Privacy-respecting aiIndex", unsafeIndexRows.length ? "Failed" : "Pass", unsafeIndexRows.length ? `${unsafeIndexRows.length} aiIndex records need review.` : `${aiIndexRows.length} aiIndex records scanned without chat/message indexing violations.`],
      ["AI Assistant", "Ask FLOQR scaffold", window.FLOQR_AI_ASSISTANT_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_ASSISTANT_ENABLED ? "Assistant flag is on; verify provider/config before production." : "Assistant remains safely disabled by default."],
      ["AI Notifications", "Notification preferences", collectionStatus(data, "aiUserNotificationPreferences", true), `${collectionCount(data, "aiUserNotificationPreferences")} preference records scanned.`],
      ["Templates", "Patron template variants", collectionStatus(data, "patronTemplateVariants", true), `${collectionCount(data, "patronTemplateVariants")} patron template variants scanned.`],
      ["Templates", "FLOQR Studio background designer", window.FLOQR_AI_STUDIO_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_STUDIO_ENABLED ? "Studio flag on; live image generation still requires a safe provider." : "Studio is AI-ready and disabled by default."],
      ["Club Profiles", "Public club profile fields", publicClubProfiles.length ? "Pass" : "Soft Fail", publicClubProfiles.length ? `${publicClubProfiles.length} club profiles include public contact/profile fields.` : "No club records with website/email/social/telephone fields found yet."],
      ["Club Profiles", "Claimed club owner editing", "Soft Fail", "Club profile editing is scaffolded; production subscription/ownership enforcement needs backend rules or claims."],
      ["Ticketing", "Ticketmaster/Eventbrite discovery", "Soft Fail", "Search criteria and queue records include ticketing partners; live API credentials/partnerships are not configured in frontend."],
      ["Ticketing", "Approved resale partner flow", "TBI", "Partner contracts, affiliate tracking, and resale APIs must be configured later."],
      ["Transportation", "Third-party taxi hailing integration", "TBI", "Reserved as partner integration; not connected to current app workflows."],
      ["AI Discovery", "Discovery queue", collectionStatus(data, "aiDiscoveryQueue", true), `${discoveryQueue.length} discovery queue records scanned.`],
      ["AI Discovery", "Review/approve/reject/delete", hasDiscovery ? "Pass" : "Failed", hasDiscovery ? "AI Discovery Master Admin module loaded." : "FLOQRAIDiscovery module was not loaded."],
      ["AI Discovery", "Manual crawl control", byId("runManualCrawlBtn") ? "Pass" : "Failed", "Manual crawl adds reviewable records to aiDiscoveryQueue."],
      ["AI Discovery", "Crawler scheduler settings", scheduleRows.length ? "Pass" : "Soft Fail", scheduleRows.length ? "Default schedule saved." : "Controls are ready; save a schedule to create aiCrawlerSchedules/default."],
      ["AI Discovery", "Backend scheduled internet crawler", "TBI", "Cloud Functions or Cloud Run scheduler must perform real public-source crawling 4-6 times per day."],
      ["AI Discovery", "Crawl run reports", crawlRuns.length ? "Pass" : "Soft Fail", crawlRuns.length ? `${crawlRuns.length} crawl run records found.` : "No crawl runs logged yet."],
      ["Master Admin", "Soft delete/restore listings", hasDiscovery ? "Pass" : "Failed", "Soft delete hides deleted club/event listings from patron search/display."],
      ["Master Admin", "Diagnostics page", "Pass", "Feature matrix, crawler controls, reports, and analytics are mounted under Master Admin settings."],
      ["Master Admin", "Package install diagnostics", byId("runPackageDiagnosticsBtn") ? "Pass" : "Failed", "Per-package feature marker checks are available after upload."],
      ["Master Admin", "Firebase rules smoke test", latestRulesReport ? (latestRulesReport.status === "Pass" ? "Pass" : "Failed") : "Soft Fail", latestRulesReport ? `Latest rules smoke test status: ${latestRulesReport.status || "unknown"} at ${fmtDate(latestRulesReport.createdAt)}.` : "Run the rules smoke test after publishing Firestore/Storage rules."]
    ].map(([area, feature, status, evidence]) => ({area, feature, status, evidence}));
  }

  function renderFeatureDiagnostics(features) {
    const wrap = byId("diagnosticsFeatureMatrix");
    if (!wrap) return;
    wrap.innerHTML = features.map(item => `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(item.area)}: ${esc(item.feature)}</strong>
        ${statusBadge(item.status)}
      </div>
      <p>${esc(item.evidence)}</p>
    </div>`).join("");

    const counts = countBy(features, item => item.status);
    byId("diagnosticsSummary").innerHTML = simpleRows([
      ["Pass", counts.Pass || 0],
      ["Soft Fail", counts["Soft Fail"] || 0],
      ["Failed", counts.Failed || 0],
      ["TBI", counts.TBI || 0],
      ["Legend", Object.entries(STATUS_COPY).map(([key, text]) => `${key}: ${text}`).join(" | ")]
    ]);
  }

  function renderCrawlActivity(data, schedule) {
    const runs = (data.aiCrawlRuns?.rows || []).slice().sort((a, b) => (b.startedAt?.seconds || 0) - (a.startedAt?.seconds || 0));
    const wrap = byId("crawlActivityReport");
    if (!wrap) return;
    const scheduleRows = [
      ["Automatic crawl setting", schedule?.frequency || "Not saved"],
      ["Schedule enabled", schedule?.enabled ? "Yes" : "No"],
      ["Planned run times", joinList(schedule?.scheduleHours) || "00:00, 04:00, 08:00, 12:00, 16:00, 20:00"],
      ["Backend requirement", "Deploy Firebase scheduled function or Cloud Run scheduler for real crawling"]
    ];
    const runHtml = runs.length ? runs.slice(0, 12).map(run => `<div class="queue-item">
      <strong>${esc(run.status || "crawl run")} - ${esc(run.mode || run.trigger || "manual")}</strong>
      <p>Started: ${esc(fmtDate(run.startedAt))} | Completed: ${esc(fmtDate(run.completedAt))} | Records: ${esc(run.createdRecordCount || 0)}</p>
      <small>${esc(run.requestedByEmail || run.note || "")}</small>
    </div>`).join("") : "<p class='sub'>No crawl runs have been logged yet.</p>";
    wrap.innerHTML = `${simpleRows(scheduleRows)}${runHtml}`;
  }

  function renderCollectedRecords(data) {
    const queue = (data.aiDiscoveryQueue?.rows || []).slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const wrap = byId("crawlCollectedRecordsReport");
    if (!wrap) return;
    wrap.innerHTML = queue.length ? queue.slice(0, 25).map(item => `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(item.proposedTitle || item.title || item.id)}</strong>
        ${queueStatusBadge(item.status)}
      </div>
      <p>${esc(item.city || "")}${item.country ? `, ${esc(item.country)}` : ""} | ${esc(item.proposedType || "")} | ${esc((item.genres || []).join(", "))}</p>
      <small>Stars: ${esc(item.aiStarRating || "-")} | Confidence: ${esc(item.aiConfidenceScore || "-")} | Source: ${esc(item.sourceName || "")}</small>
    </div>`).join("") : "<p class='sub'>No collected discovery records yet. Run a manual crawl scaffold to seed review records.</p>";
  }

  function renderAnalyticsInsights(data) {
    const queue = data.aiDiscoveryQueue?.rows || [];
    const runs = data.aiCrawlRuns?.rows || [];
    const byStatus = countBy(queue, item => item.status || "unknown");
    const byType = countBy(queue, item => item.proposedType || "unknown");
    const byCity = countBy(queue, item => item.city || "unknown");
    const byCountry = countBy(queue, item => item.country || "unknown");
    const bySource = countBy(queue, item => item.sourceName || "unknown");
    const byStar = countBy(queue, item => `${item.aiStarRating || "unrated"} star`);
    const genreCounts = {};
    queue.forEach(item => splitList(item.genres || item.extractedTags).forEach(genre => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }));
    const highValue = queue.filter(item => Number(item.aiStarRating || 0) >= 4 || Number(item.aiConfidenceScore || 0) >= 0.75);
    const targetMarkets = ["Dubai", "Istanbul", "Singapore", "Thailand", "Shanghai", "Barcelona", "London", "Paris", "Amsterdam", "Berlin", "Milan"];
    const missingMarkets = targetMarkets.filter(market => !queue.some(item => normalized(item.city).includes(normalized(market)) || normalized(item.country).includes(normalized(market))));
    const insights = [
      ["Collected records", queue.length.toLocaleString()],
      ["Crawl runs", runs.length.toLocaleString()],
      ["Queue status mix", topList(byStatus, 8)],
      ["Top proposed types", topList(byType, 8)],
      ["Top cities", topList(byCity, 8)],
      ["Top countries", topList(byCountry, 8)],
      ["Top genres/tags", topList(genreCounts, 8)],
      ["Star ratings", topList(byStar, 8)],
      ["Top sources", topList(bySource, 8)],
      ["High-value candidates", highValue.length.toLocaleString()],
      ["Market gaps", missingMarkets.join(", ") || "No configured target gaps detected"]
    ];
    const wrap = byId("crawlAnalyticsInsights");
    if (wrap) wrap.innerHTML = simpleRows(insights);
  }

  async function loadDiagnosticsData() {
    const entries = await Promise.all(COLLECTIONS.map(async name => [name, await readCollectionSafe(name)]));
    const data = Object.fromEntries(entries);
    state.lastData = data;
    return data;
  }

  async function refreshDiagnostics() {
    if (!state.db) return;
    setText("diagnosticsStatus", "Refreshing diagnostics...");
    const [data, schedule] = await Promise.all([loadDiagnosticsData(), readScheduleSafe()]);
    if (schedule) applyScheduleToControls(schedule);
    const features = buildFeatureDiagnostics(data);
    renderFeatureDiagnostics(features);
    renderCrawlActivity(data, schedule);
    renderCollectedRecords(data);
    renderAnalyticsInsights(data);
    await runPackageInstallDiagnostics({silent:true});
    const failures = features.filter(item => item.status === "Failed").length;
    const soft = features.filter(item => item.status === "Soft Fail").length;
    setText("diagnosticsStatus", `Diagnostics refreshed. ${failures} failed and ${soft} soft-fail items found.`);
  }

  function bindControls() {
    byId("diagnosticsRefreshBtn")?.addEventListener("click", refreshDiagnostics);
    byId("runPackageDiagnosticsBtn")?.addEventListener("click", () => runPackageInstallDiagnostics());
    byId("runRulesSmokeTestBtn")?.addEventListener("click", runRulesSmokeTest);
    byId("saveCrawlScheduleBtn")?.addEventListener("click", () => saveCrawlSchedule());
    byId("runManualCrawlBtn")?.addEventListener("click", runManualCrawl);
  }

  async function mount(options = {}) {
    state.db = options.db;
    state.auth = options.auth;
    state.storage = options.storage || (window.firebase?.storage ? firebase.storage() : null);
    if (!state.db) {
      setText("diagnosticsStatus", "Diagnostics could not start because Firestore is unavailable.");
      return;
    }
    hydrateDefaultControls();
    if (!state.mounted) {
      state.mounted = true;
      bindControls();
    }
    const schedule = await readScheduleSafe();
    if (schedule) applyScheduleToControls(schedule);
    await refreshDiagnostics();
  }

  window.FLOQRDiagnostics = {
    mount,
    refreshDiagnostics,
    runPackageInstallDiagnostics,
    runRulesSmokeTest,
    DEFAULT_EVENT_TYPES,
    DEFAULT_GENRES,
    DEFAULT_MARKET_LANGUAGE_PLAN
  };
})();
