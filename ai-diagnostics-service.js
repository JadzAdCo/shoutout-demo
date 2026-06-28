/* FLOQR AI diagnostics, crawler controls, TXT export, and rules guidance v28.62 */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  const state = {
    db: null,
    auth: null,
    storage: null,
    mounted: false,
    lastData: {},
    lastSchedule: null,
    lastFeatures: [],
    lastPackageDiagnostics: [],
    lastRulesSmokeResults: []
  };

  const STATUS_COPY = {
    Pass: "Implemented and currently healthy",
    "Soft Fail": "Implemented and diagnosed with minor error(s)",
    Failed: "Implemented but failing or blocked",
    TBI: "To be implemented"
  };

  const EXPECTED_FIRESTORE_RULES_VERSION = "v28.59-diagnostic-cleanup-rules";
  const EXPECTED_STORAGE_RULES_VERSION = "v28.59-storage-lifecycle-rules";
  const CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "v28.62-ai-crawling-page";
  // Previous diagnostics package marker retained for package checks: v28.61-crawler-profile-import

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
    },
    {
      version: "v28.50-profile-rules-diagnostic",
      title: "Profile Save Permission Diagnostic",
      checks: [
        {label:"Profile permission helper", file:"patron-app.js", includes:["profileSaveErrorMessage", "users/{uid} allows the signed-in user"]},
        {label:"Profile rules smoke test", file:"ai-diagnostics-service.js", includes:["ownUserProfileLifecycle", "Firestore: users/{uid} profile save path"]},
        {label:"User profile Firestore rule", file:"firestore.rules", includes:["match /users/{userId}", "allow create: if isSelf(userId)", "allow update: if isSelf(userId)"]}
      ]
    },
    {
      version: "v28.51-profile-data-protection",
      title: "Existing Profile Data Protection",
      checks: [
        {label:"Blocked profile read stays off onboarding", file:"patron-app.js", includes:["profileReadErrorMessage", "showPage(\"landingPage\")"]},
        {label:"Existing profile blank-field protection", file:"patron-app.js", includes:["preserveExistingProfileData", "delete protectedUpdates[key]"]},
        {label:"CreatedAt preserved for existing users", file:"patron-app.js", includes:["existingSnap.exists", "createdAt: firebase.firestore.FieldValue.serverTimestamp()"]}
      ]
    },
    {
      version: "v28.52-rules-version-note",
      title: "Firestore Rules Version Note",
      checks: [
        {label:"Firestore rules version note", file:"firestore.rules", includes:["FLOQR FIRESTORE RULES VERSION:", "EXPECTED DEPLOYED RULES VERSION"]},
        {label:"Profile rules called out in note", file:"firestore.rules", includes:["users/{uid} self create/read/update support"]},
        {label:"Diagnostics rules called out in note", file:"firestore.rules", includes:["aiCrawlRuns, aiCrawlerSchedules, aiDiagnosticsReports"]}
      ]
    },
    {
      version: "v28.53-rules-diagnostics-status",
      title: "Rules Version + Compatibility Status",
      checks: [
        {label:"Rules version status UI", file:"master-admin.html", includes:["rulesVersionStatus", "Firebase Rules Smoke Test"]},
        {label:"Rules version status renderer", file:"ai-diagnostics-service.js", includes:["EXPECTED_FIRESTORE_RULES_VERSION", "renderRulesVersionStatus"]},
        {label:"Rules diagnostics status marker", file:"ai-diagnostics-service.js", includes:["v28.53-rules-diagnostics-status", "renderRulesVersionStatus"]}
      ]
    },
    {
      version: "v28.54-app-rules-compatibility",
      title: "Full App Rules Compatibility Diagnostics",
      checks: [
        {label:"Rules smoke test covers core collections", file:"ai-diagnostics-service.js", includes:["runCoreFirestoreRuleTests", "Firestore: users collection read for Mingl/profile discovery"]},
        {label:"Rules smoke test covers AI collections", file:"ai-diagnostics-service.js", includes:["runAiFirestoreRuleTests", "Firestore: aiAssistantMessages owner lifecycle"]},
        {label:"Rules smoke test covers Mingl/chat queries", file:"ai-diagnostics-service.js", includes:["runMinglChatRuleTests", "participants\", \"array-contains\""]},
        {label:"Rules smoke test covers Storage paths", file:"ai-diagnostics-service.js", includes:["runStorageRuleTests", "profileMedia", "template-backgrounds"]},
        {label:"App rules compatibility marker", file:"ai-diagnostics-service.js", includes:["v28.54-app-rules-compatibility", "runCoreFirestoreRuleTests"]}
      ]
    },
    {
      version: "v28.55-diagnostics-export",
      title: "Diagnostic Report TXT Export",
      checks: [
        {label:"Diagnostics export button", file:"master-admin.html", includes:["exportDiagnosticsTxtBtn", "Export Diagnostics TXT"]},
        {label:"Diagnostics export builder", file:"ai-diagnostics-service.js", includes:["buildDiagnosticsExport", "exportDiagnosticsReport", "downloadTextFile"]},
        {label:"Fix prompt included in export", file:"ai-diagnostics-service.js", includes:["COPY/PASTE FIX PROMPT", "Do not rebuild FLOQR from scratch"]}
      ]
    },
    {
      version: "v28.56-plain-diagnostics-guidance",
      title: "Plain Diagnostics Guidance + Fix Suggestions",
      checks: [
        {label:"Plain rules explanation", file:"ai-diagnostics-service.js", includes:["Plain English meaning", "Package file is current, but deployed Firebase rules failed live testing"]},
        {label:"Suggested fix field", file:"ai-diagnostics-service.js", includes:["suggestDiagnosticFix", "Suggested fix"]},
        {label:"Copy prompt action", file:"ai-diagnostics-service.js", includes:["copyRulesFixPromptBtn", "Copy Fix Prompt"]}
      ]
    },
    {
      version: "v28.57-mingl-storage-rules-fix",
      title: "Mingl Diagnostics + Storage Rules Fix",
      checks: [
        {label:"Firestore rules version bumped", file:"firestore.rules", includes:["FLOQR FIRESTORE RULES VERSION: v28.57-mingl-diagnostic-rules", "diagnosticRunId-scoped cleanup"]},
        {label:"Storage rules version note", file:"storage.rules", includes:["FLOQR STORAGE RULES VERSION: v28.57-storage-media-rules", "template-backgrounds/{uid}/{variantId}"]},
        {label:"Mingl deterministic rule diagnostics", file:"ai-diagnostics-service.js", includes:["minglConnectionRuleLifecycle", "participant query blocked"]},
        {label:"Patron Mingl fallback reads", file:"patron-app.js", includes:["getDocsByIdsSafe", "fallbackIds"]}
      ]
    },
    {
      version: "v28.58-diagnostics-signal-cleanup",
      title: "Diagnostics Signal Cleanup",
      checks: [
        {label:"Current-package rules report logic", file:"ai-diagnostics-service.js", includes:["currentPackageRulesSmokeReport", "Latest saved rules smoke test is stale"]},
        {label:"Protected collection scoped reads", file:"ai-diagnostics-service.js", includes:["readProtectedCollectionSafe", "Protected collection uses scoped diagnostics"]},
        {label:"Historical report issue filter", file:"ai-diagnostics-service.js", includes:["collectCurrentRulesReportIssues", "Historical saved reports are exported for reference"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.58-diagnostics-signal-cleanup"]}
      ]
    },
    {
      version: "v28.59-rules-step-diagnostics",
      title: "Rules Cleanup + Step Diagnostics",
      checks: [
        {label:"Firestore diagnostic cleanup rule", file:"firestore.rules", includes:["FLOQR FIRESTORE RULES VERSION: v28.59-diagnostic-cleanup-rules", "allow delete: if isDiagnosticParticipantResource()"]},
        {label:"Storage delete lifecycle rule", file:"storage.rules", includes:["FLOQR STORAGE RULES VERSION: v28.59-storage-lifecycle-rules", "allow delete: if request.auth != null"]},
        {label:"Rules smoke step labels", file:"ai-diagnostics-service.js", includes:["runDiagnosticStep", "delete diagnostic Mingl connection"]},
        {label:"Storage smoke step labels", file:"ai-diagnostics-service.js", includes:["runStorageStep", "delete uploaded smoke-test media"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.59-rules-step-diagnostics"]}
      ]
    },
    {
      version: "v28.60-optional-mingl-query-guidance",
      title: "Optional Mingl Query Guidance",
      checks: [
        {label:"Optional Mingl query wording", file:"ai-diagnostics-service.js", includes:["Optional participant query blocked; fallback participant document reads passed", "deterministicFallbackPassed"]},
        {label:"Capture returns rule rows", file:"ai-diagnostics-service.js", includes:["return row", "const minglConnectionResult = await capture"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.60-optional-mingl-query-guidance"]},
        {label:"README optional Mingl explanation", file:"README.md", includes:["optional compatibility check", "Do not loosen Firestore rules broadly"]}
      ]
    },
    {
      version: "v28.61-crawler-profile-import",
      title: "AI Crawler Profile Import",
      checks: [
        {label:"Crawler profile import card", file:"master-admin.html", includes:["AI Crawler Profile Import", "clubProfileImportJson", "saveClubProfileImportDraftsBtn"]},
        {label:"Club profile backfill action", file:"ai-diagnostics-service.js", includes:["backfillClubProfileFields", "Backfill Missing Club Profile Fields"]},
        {label:"Crawler JSON generator", file:"ai-diagnostics-service.js", includes:["generateCrawlerProfileJson", "profile-import-draft", "clubAdminImportUrl"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.61-crawler-profile-import"]},
        {label:"Club admin import link loader", file:"admin-app.js", includes:["profileImportDraft", "applyProfileImportDraftToForm"]},
        {label:"README crawler import explanation", file:"README.md", includes:["AI Crawler Profile Import", "Club Admin import link"]}
      ]
    },
    {
      version: "v28.62-ai-crawling-page",
      title: "AI Crawling Page + Consolidated Reports",
      checks: [
        {label:"AI Crawling master tab", file:"master-admin.html", includes:["data-panel=\"aiCrawling\"", "Consolidated Discovery Records"]},
        {label:"Diagnostics separated from crawler UI", file:"master-admin.html", includes:["AI crawling controls live on the AI Crawling tab", "id=\"diagnostics\""]},
        {label:"Consolidated crawler report logic", file:"ai-diagnostics-service.js", includes:["consolidateCrawlRecords", "addressConflicts", "canonicalAddress"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.62-ai-crawling-page"]},
        {label:"README AI Crawling page explanation", file:"README.md", includes:["Master Admin > AI Crawling", "consolidates duplicate clubs/events"]}
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

  function diagnosticErrorMessage(error) {
    return error?.message || String(error);
  }

  async function runDiagnosticStep(label, fn) {
    try {
      return await fn();
    } catch (error) {
      throw new Error(`${label} failed: ${diagnosticErrorMessage(error)}`);
    }
  }

  async function runStorageStep(label, path, fn) {
    try {
      return await fn();
    } catch (error) {
      if (error?.code === "storage/unauthorized") {
        throw new Error(`${label} failed: Storage rules denied ${path} (storage/unauthorized). Expected Storage rules ${EXPECTED_STORAGE_RULES_VERSION}. Publish this package's storage.rules in Firebase Console > Storage > Rules, then rerun this smoke test.`);
      }
      throw new Error(`${label} failed: ${diagnosticErrorMessage(error)}`);
    }
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

  function proposedFamily(item = {}) {
    const draftCollection = item.profileImport?.targetCollection || item.targetCollection || "";
    const text = normalized(`${draftCollection} ${item.proposedType || ""} ${item.targetType || ""}`);
    if (text.includes("event")) return "event";
    return "club";
  }

  function destinationName(item = {}) {
    return item.profileImport?.displayName ||
      item.profileImport?.proposedLocationName ||
      item.proposedLocationName ||
      item.locationName ||
      item.proposedTitle ||
      item.title ||
      item.eventName ||
      item.id ||
      "Unknown destination";
  }

  function destinationCity(item = {}) {
    return item.profileImport?.publicProfile?.city || item.city || "";
  }

  function destinationCountry(item = {}) {
    return item.profileImport?.publicProfile?.country || item.country || "";
  }

  function destinationAddress(item = {}) {
    return item.profileImport?.publicProfile?.address ||
      item.proposedAddress ||
      item.address ||
      "";
  }

  function destinationKey(item = {}) {
    return [
      proposedFamily(item),
      normalized(destinationName(item)),
      normalized(destinationCity(item)),
      normalized(destinationCountry(item))
    ].join("|");
  }

  function consolidateCrawlRecords(records = []) {
    const map = new Map();
    records.forEach(item => {
      const key = destinationKey(item);
      if (!map.has(key)) {
        map.set(key, {
          key,
          family: proposedFamily(item),
          name: destinationName(item),
          city: destinationCity(item),
          country: destinationCountry(item),
          items: [],
          addresses: new Map(),
          statuses: new Set(),
          sources: new Set(),
          genres: new Set(),
          maxStar: 0,
          maxConfidence: 0
        });
      }
      const group = map.get(key);
      group.items.push(item);
      group.statuses.add(item.status || "unknown");
      group.sources.add(item.sourceName || item.profileImport?.sourceName || "unknown");
      splitList(item.genres || item.extractedTags || item.categories).forEach(value => group.genres.add(value));
      group.maxStar = Math.max(group.maxStar, Number(item.aiStarRating || 0));
      group.maxConfidence = Math.max(group.maxConfidence, Number(item.aiConfidenceScore || 0));
      const address = String(destinationAddress(item) || "").trim();
      const addressKey = normalized(address);
      if (addressKey) {
        const current = group.addresses.get(addressKey) || {address, count:0, sources:new Set()};
        current.count += 1;
        current.sources.add(item.sourceName || "unknown");
        group.addresses.set(addressKey, current);
      }
    });
    return Array.from(map.values()).map(group => {
      const addressRows = Array.from(group.addresses.values()).sort((a, b) => b.count - a.count);
      const addressConflicts = addressRows.length > 1;
      return {
        ...group,
        canonicalAddress: addressRows[0]?.address || "",
        addressOptions: addressRows,
        addressConflicts,
        itemCount: group.items.length,
        sourceList: Array.from(group.sources).filter(Boolean),
        statusList: Array.from(group.statuses).filter(Boolean),
        genreList: Array.from(group.genres).filter(Boolean)
      };
    }).sort((a, b) => {
      if (a.addressConflicts !== b.addressConflicts) return a.addressConflicts ? -1 : 1;
      return b.itemCount - a.itemCount;
    });
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

  function cleanText(value) {
    return String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "-";
  }

  function exportTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  function attentionStatus(status) {
    return ["Failed", "Soft Fail", "TBI"].includes(status);
  }

  function sortByCreatedDesc(rows = []) {
    return rows.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }

  function rulesSmokeReports(data = state.lastData || {}) {
    return sortByCreatedDesc(data.aiDiagnosticsReports?.rows || [])
      .filter(row => row.type === "rulesSmokeTest");
  }

  function latestRulesSmokeReport(data = state.lastData || {}) {
    return rulesSmokeReports(data)[0] || null;
  }

  function currentPackageRulesSmokeReport(data = state.lastData || {}) {
    return rulesSmokeReports(data)
      .find(row => row.packageVersion === CURRENT_DIAGNOSTICS_PACKAGE_VERSION) || null;
  }

  function suggestDiagnosticFix(source, label, reason, status) {
    const text = normalized(`${source} ${label} ${reason}`);
    if (text.includes("storage") || text.includes("storage unauthorized") || text.includes("template backgrounds") || text.includes("shoutouts original image path")) {
      return "Publish the package `storage.rules` in Firebase Console > Storage > Rules. This package separates upload checks from owner delete rules so the smoke test can upload/read/delete media. Then rerun Master Admin > Diagnostics > Run Rules Smoke Test.";
    }
    if (text.includes("firestore") || text.includes("missing or insufficient permissions") || text.includes("permission denied")) {
      return "Publish the package `firestore.rules` in Firebase Console > Firestore Database > Rules, then rerun Master Admin > Diagnostics > Run Rules Smoke Test.";
    }
    if (text.includes("package install") || text.includes("is missing") || text.includes("package marker")) {
      return "Upload the latest full package ZIP to the GitHub repo root, use the README cache-busted URL, then rerun Package Install Diagnostics.";
    }
    if (text.includes("no saved rules smoke test") || text.includes("run the rules smoke test")) {
      return "Click `Run Rules Smoke Test`. If it fails, click `Export Diagnostics TXT` and paste the exported fix prompt back into Codex.";
    }
    if (text.includes("backend") || text.includes("cloud functions") || text.includes("scheduler") || text.includes("gemini")) {
      return "This is expected until backend Firebase/AI services are configured. Leave it as TBI or schedule it as a future backend package.";
    }
    if (status === "TBI") {
      return "No emergency fix required. This means the feature is planned but not implemented yet; choose it for a future package when ready.";
    }
    if (status === "Soft Fail") {
      return "Usually non-blocking. Add the missing setup/data or keep the fallback behavior if production can continue safely.";
    }
    return "Use the failure reason and exported diagnostic prompt to request a focused fix package from Codex.";
  }

  function collectCurrentRulesReportIssues(data = {}) {
    const latest = latestRulesSmokeReport(data);
    const current = currentPackageRulesSmokeReport(data);
    if (current) {
      const reportName = `${current.type || "rulesSmokeTest"} ${current.packageVersion || current.id || ""}`.trim();
      const rows = [{
        source:"Current Rules Smoke Test",
        label:reportName,
        status:current.status,
        reason:`Saved report status ${current.status || "unknown"} at ${fmtDate(current.createdAt)}.`
      }];
      (Array.isArray(current.results) ? current.results : []).forEach(result => {
        rows.push({
          source:`Current Rules Smoke Test: ${reportName}`,
          label:result.label,
          status:result.status,
          reason:result.evidence
        });
      });
      return rows;
    }
    if (latest) {
      return [{
        source:"Current Rules Smoke Test",
        label:"No current-package rules smoke test",
        status:"Soft Fail",
        reason:`Latest saved rules smoke test is stale: ${latest.packageVersion || "unknown package"} at ${fmtDate(latest.createdAt)}. Run Rules Smoke Test for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}.`
      }];
    }
    return [{
      source:"Current Rules Smoke Test",
      label:"No rules smoke test has been run",
      status:"Soft Fail",
      reason:`Run Rules Smoke Test for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION} after publishing Firestore and Storage rules.`
    }];
  }

  function collectDiagnosticIssues({data = {}, features = [], packageResults = []} = {}) {
    const issues = [];
    const add = (source, label, status, reason) => {
      if (attentionStatus(status)) {
        issues.push({
          source: cleanText(source),
          label: cleanText(label),
          status: cleanText(status),
          reason: cleanText(reason),
          suggestedFix: suggestDiagnosticFix(source, label, reason, status)
        });
      }
    };

    features.forEach(item => add("Feature Diagnostics", `${item.area}: ${item.feature}`, item.status, item.evidence));
    packageResults.forEach(item => add("Package Install Diagnostics", `${item.package || "Package"}: ${item.label}`, item.status, item.evidence));

    Object.entries(data).forEach(([name, value]) => {
      if (value?.error) add("Firestore Read", name, "Failed", value.error);
    });

    collectCurrentRulesReportIssues(data).forEach(item => {
      add(item.source, item.label, item.status, item.reason);
    });

    return issues;
  }

  function buildDiagnosticsFixPrompt(issues = []) {
    const issueText = issues.length
      ? issues.map((item, index) => `${index + 1}. ${item.source}: [${item.status}] ${item.label}. Failure reason: ${item.reason}. Suggested fix: ${item.suggestedFix || "Review and fix this item."}`).join("\n")
      : "No Failed, Soft Fail, or TBI items were found in this export. Please review the full report for anything unusual.";

    return [
      "You are working on the FLOQR web app.",
      "",
      "I exported Master Admin Diagnostics. Please use the diagnostic report below to fix the issue or issues incrementally and safely.",
      "",
      "Rules:",
      "- Do not rebuild FLOQR from scratch.",
      "- Preserve existing user profile data and do not overwrite already-onboarded users with blank profile fields.",
      "- Keep ShoutOut, Mingl, Bata, guest list routing, Firebase Auth, Firestore, Firebase Storage, and GitHub Pages deployment working.",
      "- If the issue is a Firebase rule issue, update the relevant rule file and keep the rules-version note clear.",
      "- If the issue is a Diagnostics issue, update Master Admin Diagnostics so the next package can verify the fix.",
      "- Run available syntax/static checks and create the next full package ZIP.",
      "",
      "Issues to prioritize:",
      issueText
    ].join("\n");
  }

  function buildDiagnosticsExport({data = {}, schedule = null, features = [], packageResults = []} = {}) {
    const reports = sortByCreatedDesc(data.aiDiagnosticsReports?.rows || []);
    const latestRules = latestRulesSmokeReport(data);
    const currentRules = currentPackageRulesSmokeReport(data);
    const issues = collectDiagnosticIssues({data, features, packageResults, reports});
    const lines = [];
    const counts = countBy(features, item => item.status);
    const packageCounts = countBy(packageResults, item => item.status);

    lines.push("FLOQR MASTER ADMIN DIAGNOSTICS EXPORT");
    lines.push(`Exported at: ${new Date().toLocaleString()}`);
    lines.push(`Diagnostics package: ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}`);
    lines.push(`Expected Firestore rules version: ${EXPECTED_FIRESTORE_RULES_VERSION}`);
    lines.push(`Expected Storage rules version: ${EXPECTED_STORAGE_RULES_VERSION}`);
    lines.push(`Signed-in Master Admin: ${state.auth?.currentUser?.email || state.auth?.currentUser?.uid || "unknown"}`);
    lines.push(`FLOQR_AI_ENABLED: ${window.FLOQR_AI_ENABLED === true}`);
    lines.push(`FLOQR_AI_ASSISTANT_ENABLED: ${window.FLOQR_AI_ASSISTANT_ENABLED === true}`);
    lines.push(`FLOQR_AI_STUDIO_ENABLED: ${window.FLOQR_AI_STUDIO_ENABLED === true}`);

    lines.push("");
    lines.push("STATUS LEGEND");
    Object.entries(STATUS_COPY).forEach(([status, text]) => lines.push(`${status}: ${text}`));

    lines.push("");
    lines.push("ATTENTION SUMMARY");
    if (issues.length) {
      issues.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.source}: [${item.status}] ${item.label}`);
        lines.push(`   Failure reason: ${item.reason}`);
        lines.push(`   Suggested fix: ${item.suggestedFix}`);
      });
    } else {
      lines.push("No Failed, Soft Fail, or TBI items were found in the exported diagnostics.");
    }

    lines.push("");
    lines.push("CURRENT FEATURE DIAGNOSTICS");
    lines.push(`Totals: Pass=${counts.Pass || 0}, Soft Fail=${counts["Soft Fail"] || 0}, Failed=${counts.Failed || 0}, TBI=${counts.TBI || 0}`);
    features.forEach(item => {
      lines.push(`[${item.status}] ${item.area}: ${item.feature}`);
      lines.push(`Reason: ${cleanText(item.evidence)}`);
      if (attentionStatus(item.status)) lines.push(`Suggested fix: ${suggestDiagnosticFix("Feature Diagnostics", `${item.area}: ${item.feature}`, item.evidence, item.status)}`);
    });

    lines.push("");
    lines.push("PACKAGE INSTALL DIAGNOSTICS");
    lines.push(`Totals: Pass=${packageCounts.Pass || 0}, Soft Fail=${packageCounts["Soft Fail"] || 0}, Failed=${packageCounts.Failed || 0}, TBI=${packageCounts.TBI || 0}`);
    packageResults.forEach(item => {
      lines.push(`[${item.status}] ${item.package || "Package"}: ${item.label}`);
      lines.push(`Reason: ${cleanText(item.evidence)}`);
      if (attentionStatus(item.status)) lines.push(`Suggested fix: ${suggestDiagnosticFix("Package Install Diagnostics", `${item.package || "Package"}: ${item.label}`, item.evidence, item.status)}`);
    });

    lines.push("");
    lines.push("FIREBASE RULES STATUS");
    lines.push(`Current-package rules smoke test: ${currentRules ? `${currentRules.status || "unknown"} at ${fmtDate(currentRules.createdAt)}` : "Not run yet"}`);
    lines.push(`Latest saved rules smoke test: ${latestRules ? `${latestRules.status || "unknown"} from ${latestRules.packageVersion || "unknown package"} at ${fmtDate(latestRules.createdAt)}` : "No saved rules smoke test found"}`);
    lines.push("Note: Browser diagnostics cannot read Firebase Console deployed rules source. Deployed rules are verified by live Firestore/Storage operations.");

    lines.push("");
    lines.push("CRAWLER AND DISCOVERY SNAPSHOT");
    lines.push(`Schedule frequency: ${schedule?.frequency || "not saved"}`);
    lines.push(`Schedule enabled: ${schedule?.enabled ? "yes" : "no"}`);
    lines.push(`Schedule hours: ${joinList(schedule?.scheduleHours) || "-"}`);
    lines.push(`Discovery queue records visible: ${collectionCount(data, "aiDiscoveryQueue")}`);
    lines.push(`Crawl run records visible: ${collectionCount(data, "aiCrawlRuns")}`);
    lines.push(`Diagnostics report records visible: ${reports.length}`);

    lines.push("");
    lines.push("SAVED aiDiagnosticsReports");
    lines.push("Historical saved reports are exported for reference and are not counted as current package failures.");
    if (!reports.length) {
      lines.push("No saved aiDiagnosticsReports records were readable.");
    }
    reports.forEach((report, index) => {
      lines.push("");
      lines.push(`Report ${index + 1}: ${report.id || "-"}`);
      lines.push(`Type: ${report.type || "-"}`);
      lines.push(`Package version: ${report.packageVersion || "-"}`);
      lines.push(`Status: ${report.status || "-"}`);
      lines.push(`Created: ${fmtDate(report.createdAt)}`);
      lines.push(`Created by: ${report.createdByEmail || report.createdByUid || "-"}`);
      const results = Array.isArray(report.results) ? report.results : [];
      if (!results.length) {
        lines.push("Results: no embedded check results.");
      } else {
        results.forEach(result => {
          lines.push(`- [${result.status || "-"}] ${cleanText(result.label)}`);
          lines.push(`  Failure reason/evidence: ${cleanText(result.evidence)}`);
          if (attentionStatus(result.status)) lines.push(`  Suggested fix: ${suggestDiagnosticFix(`Saved Diagnostic Report: ${report.type || "diagnosticReport"}`, result.label, result.evidence, result.status)}`);
        });
      }
    });

    lines.push("");
    lines.push("COPY/PASTE FIX PROMPT");
    lines.push(buildDiagnosticsFixPrompt(issues));

    return lines.join("\n");
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function ruleStatusMeaning(packageRulesStatus, smokeStatus, latest) {
    if (packageRulesStatus === "Pass" && smokeStatus === "Pass") {
      return "The package file contains the expected rules note, and the live Firebase project allowed the app-required test operations.";
    }
    if (packageRulesStatus === "Pass" && smokeStatus === "Failed") {
      return "Package file is current, but deployed Firebase rules failed live testing. This usually means Firestore rules or Storage rules still need to be published in Firebase Console, or one live rule path is still too strict.";
    }
    if (packageRulesStatus === "Pass" && !latest) {
      return "The package file looks current, but no live deployed-rules test has been run yet. Click Run Rules Smoke Test.";
    }
    if (packageRulesStatus === "Failed") {
      return "The website package does not appear to contain the expected `firestore.rules` note. Upload the latest full package before testing deployed rules.";
    }
    return "Diagnostics needs a live smoke test result before it can confirm deployed Firebase rules.";
  }

  function ruleNextSteps(packageRulesStatus, smokeStatus, failedChecks = []) {
    if (packageRulesStatus === "Failed") {
      return [
        "Upload the latest full package ZIP to GitHub.",
        "Open the README cache-busted URL so the browser loads the new diagnostics files.",
        "Rerun Package Install Diagnostics."
      ];
    }
    if (!failedChecks.length && smokeStatus === "Soft Fail") {
      return [
        "Click Run Rules Smoke Test.",
        "If it fails, review the failed check names under the rules report.",
        "Click Export Diagnostics TXT and paste the COPY/PASTE FIX PROMPT back into Codex."
      ];
    }
    const hasStorageFailure = failedChecks.some(item => normalized(`${item.label} ${item.evidence}`).includes("storage"));
    const hasFirestoreFailure = failedChecks.some(item => normalized(`${item.label} ${item.evidence}`).includes("firestore") || normalized(item.evidence).includes("permission"));
    const steps = [];
    if (hasFirestoreFailure) steps.push("Publish the package `firestore.rules` in Firebase Console > Firestore Database > Rules.");
    if (hasStorageFailure) steps.push("Publish the package `storage.rules` in Firebase Console > Storage > Rules.");
    if (!steps.length && smokeStatus === "Failed") steps.push("Open the detailed failed check below and use its failure reason to decide whether Firestore rules, Storage rules, or the package upload needs the fix.");
    steps.push("Rerun Run Rules Smoke Test.");
    steps.push("Click Export Diagnostics TXT and paste the COPY/PASTE FIX PROMPT into Codex if anything still fails.");
    return steps;
  }

  function buildRulesPanelPrompt({packageRulesStatus, smokeStatus, latest, failedChecks = []}) {
    const issues = failedChecks.length
      ? failedChecks.map((item, index) => `${index + 1}. [${item.status || "Failed"}] ${cleanText(item.label)}. Failure reason: ${cleanText(item.evidence)}. Suggested fix: ${suggestDiagnosticFix("Firebase Rules Smoke Test", item.label, item.evidence, item.status || "Failed")}`).join("\n")
      : `No detailed failed rule checks are available yet. Current package rules note status: ${packageRulesStatus}. Live deployed rules status: ${smokeStatus}.`;
    return [
      "You are working on the FLOQR web app.",
      "",
      "Please fix the Firebase rules/diagnostics issue shown by Master Admin Diagnostics.",
      "",
      "Do not rebuild FLOQR from scratch. Preserve existing user profile data and keep ShoutOut, Mingl, Bata, guest lists, Firebase Auth, Firestore, Firebase Storage, and GitHub Pages working.",
      "",
      `Expected Firestore rules version: ${EXPECTED_FIRESTORE_RULES_VERSION}`,
      `Expected Storage rules version: ${EXPECTED_STORAGE_RULES_VERSION}`,
      `Current diagnostics package: ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}`,
      `Package firestore.rules note status: ${packageRulesStatus}`,
      `Live deployed rules compatibility status: ${smokeStatus}`,
      `Latest smoke test: ${latest ? `${latest.status || "unknown"} at ${fmtDate(latest.createdAt)}` : "none"}`,
      "",
      "Failed checks / context:",
      issues,
      "",
      "Please update the relevant rule file or diagnostics code, update README if needed, run syntax/static checks, and create the next full package ZIP."
    ].join("\n");
  }

  async function fetchPackageFile(file, cache = new Map()) {
    if (cache.has(file)) return cache.get(file);
    const response = await fetch(`./${file}?diagnostics=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`${file} returned ${response.status}`);
    const text = await response.text();
    cache.set(file, text);
    return text;
  }

  async function renderRulesVersionStatus(data = state.lastData || {}) {
    const wrap = byId("rulesVersionStatus");
    if (!wrap) return;
    let packageRulesStatus = "Failed";
    let packageRulesEvidence = "Could not read firestore.rules from the installed package.";
    let packageStorageStatus = "Failed";
    let packageStorageEvidence = "Could not read storage.rules from the installed package.";
    try {
      const text = await fetchPackageFile("firestore.rules");
      const hasExpected = text.includes(`FLOQR FIRESTORE RULES VERSION: ${EXPECTED_FIRESTORE_RULES_VERSION}`)
        && text.includes(`EXPECTED DEPLOYED RULES VERSION: ${EXPECTED_FIRESTORE_RULES_VERSION}`);
      packageRulesStatus = hasExpected ? "Pass" : "Failed";
      packageRulesEvidence = hasExpected
        ? `Installed firestore.rules contains expected rules note: ${EXPECTED_FIRESTORE_RULES_VERSION}.`
        : `Installed firestore.rules does not contain expected rules note: ${EXPECTED_FIRESTORE_RULES_VERSION}.`;
    } catch (error) {
      packageRulesEvidence = error?.message || String(error);
    }
    try {
      const text = await fetchPackageFile("storage.rules");
      const hasExpected = text.includes(`FLOQR STORAGE RULES VERSION: ${EXPECTED_STORAGE_RULES_VERSION}`)
        && text.includes(`EXPECTED DEPLOYED STORAGE RULES VERSION: ${EXPECTED_STORAGE_RULES_VERSION}`);
      packageStorageStatus = hasExpected ? "Pass" : "Failed";
      packageStorageEvidence = hasExpected
        ? `Installed storage.rules contains expected rules note: ${EXPECTED_STORAGE_RULES_VERSION}.`
        : `Installed storage.rules does not contain expected rules note: ${EXPECTED_STORAGE_RULES_VERSION}.`;
    } catch (error) {
      packageStorageEvidence = error?.message || String(error);
    }

    const latestAny = latestRulesSmokeReport(data);
    const latest = currentPackageRulesSmokeReport(data);
    const smokeStatus = latest ? (latest.status === "Pass" ? "Pass" : "Failed") : "Soft Fail";
    const smokeEvidence = latest
      ? `Latest current-package live deployed-rules smoke test: ${latest.status || "unknown"} at ${fmtDate(latest.createdAt)}.`
      : latestAny
        ? `Latest saved rules smoke test is stale: ${latestAny.packageVersion || "unknown package"} at ${fmtDate(latestAny.createdAt)}. Rerun Rules Smoke Test for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}.`
        : "No live rules smoke test has been run yet. Click Run Rules Smoke Test after publishing rules.";
    const overall = packageRulesStatus === "Pass" && packageStorageStatus === "Pass" && smokeStatus === "Pass" ? "Pass" : smokeStatus === "Soft Fail" ? "Soft Fail" : "Failed";
    const failedChecks = (Array.isArray(latest?.results) ? latest.results : []).filter(item => item.status === "Failed");
    const meaning = ruleStatusMeaning(packageRulesStatus, smokeStatus, latest);
    const nextSteps = ruleNextSteps(packageRulesStatus, smokeStatus, failedChecks);
    const prompt = buildRulesPanelPrompt({packageRulesStatus, smokeStatus, latest, failedChecks});
    const failedHtml = failedChecks.length
      ? failedChecks.slice(0, 8).map(item => `<div style="border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:0.75rem;margin-top:0.75rem;">
        <div class="message-envelope-head"><strong>${esc(item.label || "Failed rule check")}</strong>${statusBadge(item.status || "Failed")}</div>
        <p><strong>Failure reason:</strong> ${esc(item.evidence || "")}</p>
        <p><strong>Suggested fix:</strong> ${esc(suggestDiagnosticFix("Firebase Rules Smoke Test", item.label, item.evidence, item.status || "Failed"))}</p>
      </div>`).join("")
      : "<p class='sub'>No detailed failed rule checks are available yet. Run the smoke test to see exact failing paths.</p>";

    wrap.innerHTML = `${simpleRows([
      ["Expected Firestore rules version", EXPECTED_FIRESTORE_RULES_VERSION],
      ["Expected Storage rules version", EXPECTED_STORAGE_RULES_VERSION],
      ["Current Diagnostics package", CURRENT_DIAGNOSTICS_PACKAGE_VERSION],
      ["Package firestore.rules note", `${packageRulesStatus}: ${packageRulesEvidence}`],
      ["Package storage.rules note", `${packageStorageStatus}: ${packageStorageEvidence}`],
      ["Live deployed rules compatibility", `${smokeStatus}: ${smokeEvidence}`],
      ["Overall rules status", overall],
      ["How this is tested", "Package note is read from firestore.rules; deployed rules are verified by live Firestore/Storage operations."]
    ])}
    <div class="queue-item">
      <div class="message-envelope-head"><strong>Plain English meaning</strong>${statusBadge(overall)}</div>
      <p>${esc(meaning)}</p>
    </div>
    <div class="queue-item">
      <strong>What to do next</strong>
      <ol>${nextSteps.map(step => `<li>${esc(step)}</li>`).join("")}</ol>
    </div>
    <div class="queue-item">
      <strong>Failed rule checks and suggested fixes</strong>
      ${failedHtml}
    </div>
    <div class="queue-item">
      <div class="message-envelope-head">
        <strong>Prompt to paste into Codex</strong>
        <button id="copyRulesFixPromptBtn" type="button">Copy Fix Prompt</button>
      </div>
      <textarea id="rulesFixPromptText" rows="9" readonly>${esc(prompt)}</textarea>
      <p class="sub small">For the fullest report, click Export Diagnostics TXT and paste the COPY/PASTE FIX PROMPT section back into Codex.</p>
    </div>`;
    byId("copyRulesFixPromptBtn")?.addEventListener("click", async () => {
      try {
        await copyTextToClipboard(prompt);
        setText("diagnosticsStatus", "Rules fix prompt copied. Paste it into Codex with the exported diagnostics if the issue remains.");
      } catch (error) {
        setText("diagnosticsStatus", `Could not copy prompt automatically: ${error?.message || error}`);
      }
    });
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
    state.lastPackageDiagnostics = results;
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

  async function firestoreCollectionRead(collection, limit = 1) {
    const snap = await state.db.collection(collection).limit(limit).get();
    return `${collection} read/query succeeded (${snap.size} doc(s) visible to this signed-in account).`;
  }

  async function firestoreQueryRead(collection, buildQuery) {
    const query = buildQuery(state.db.collection(collection));
    const snap = await query.limit(1).get();
    return `${collection} app-style query succeeded (${snap.size} doc(s) visible to this signed-in account).`;
  }

  async function participantQuerySoftCheck(collection, user, options = {}) {
    const deterministicFallbackPassed = options.deterministicFallbackPassed === true;
    const fallbackName = options.fallbackName || "fallback participant document reads";
    try {
      return await firestoreQueryRead(collection, query => query.where("participants", "array-contains", user.uid));
    } catch (error) {
      if (deterministicFallbackPassed) {
        return {
          status:"Soft Fail",
          evidence:`Optional participant query blocked; fallback participant document reads passed. ${collection} array-contains query was denied (${error?.message || error}), but FLOQR uses ${fallbackName} as the supported safe path. Do not loosen Firestore rules broadly just to make this optional query pass.`
        };
      }
      return {
        status:"Soft Fail",
        evidence:`Optional ${collection} participant query blocked (${error?.message || error}). Run the deterministic Mingl/chat lifecycle checks above; FLOQR treats this query as optional and uses participant document fallback reads when those checks pass.`
      };
    }
  }

  async function minglConnectionRuleLifecycle(runId, user) {
    const peerUid = `diagnostic-peer-${runId}`;
    const connectionId = `${runId}-mingl`;
    const ref = state.db.collection("minglConnections").doc(connectionId);
    await runDiagnosticStep("create diagnostic Mingl connection", () => ref.set({
      connectionId,
      participants:[user.uid, peerUid],
      requestedBy:user.uid,
      requestedTo:peerUid,
      status:"mutual",
      diagnosticRunId:runId,
      userSummaries:{
        [user.uid]:{displayName:user.displayName || user.email || "Diagnostics"},
        [peerUid]:{displayName:"Diagnostics Peer"}
      },
      createdAt:fieldValue(),
      updatedAt:fieldValue()
    }));
    const snap = await runDiagnosticStep("read diagnostic Mingl connection", () => ref.get());
    if (!snap.exists || !(snap.data().participants || []).includes(user.uid)) {
      throw new Error("Temporary Mingl connection was not readable by its participant.");
    }
    await runDiagnosticStep("update diagnostic Mingl connection", () => ref.set({diagnosticUpdatedAt:fieldValue()}, {merge:true}));
    await runDiagnosticStep("delete diagnostic Mingl connection", () => ref.delete());
    return "Temporary Mingl participant connection create/read/update/delete succeeded.";
  }

  async function minglChatRoomRuleLifecycle(runId, user) {
    const peerUid = `diagnostic-peer-${runId}`;
    const connectionId = `${runId}-room-connection`;
    const roomId = `mingl_${connectionId}`;
    const connectionRef = state.db.collection("minglConnections").doc(connectionId);
    const roomRef = state.db.collection("chatRooms").doc(roomId);
    let connectionCleanupError = null;
    await runDiagnosticStep("create diagnostic Mingl connection for chat room", () => connectionRef.set({
      connectionId,
      participants:[user.uid, peerUid],
      requestedBy:user.uid,
      requestedTo:peerUid,
      status:"mutual",
      diagnosticRunId:runId,
      createdAt:fieldValue(),
      updatedAt:fieldValue()
    }));
    try {
      await runDiagnosticStep("create diagnostic Mingl chat room", () => roomRef.set({
        id:roomId,
        type:"mingl",
        title:"Diagnostics Mingl Chat",
        connectionId,
        participants:[user.uid, peerUid],
        userSummaries:{
          [user.uid]:{displayName:user.displayName || user.email || "Diagnostics"},
          [peerUid]:{displayName:"Diagnostics Peer"}
        },
        diagnosticRunId:runId,
        lastMessage:"",
        unreadCounts:{},
        createdAt:fieldValue(),
        updatedAt:fieldValue()
      }));
      const snap = await runDiagnosticStep("read diagnostic Mingl chat room", () => roomRef.get());
      if (!snap.exists || !(snap.data().participants || []).includes(user.uid)) {
        throw new Error("Temporary Mingl chat room was not readable by its participant.");
      }
      await runDiagnosticStep("update diagnostic Mingl chat room", () => roomRef.set({diagnosticUpdatedAt:fieldValue()}, {merge:true}));
      await runDiagnosticStep("delete diagnostic Mingl chat room", () => roomRef.delete());
    } finally {
      try { await connectionRef.delete(); } catch (error) { connectionCleanupError = error; }
    }
    if (connectionCleanupError) {
      throw new Error(`delete diagnostic Mingl connection for chat room failed: ${diagnosticErrorMessage(connectionCleanupError)}`);
    }
    return "Temporary Mingl chat room create/read/update/delete succeeded for its participant.";
  }

  async function ownFieldLifecycle(collection, docId, fieldName, value) {
    const ref = state.db.collection(collection).doc(docId);
    await ref.set({[fieldName]: value, updatedAt:fieldValue()}, {merge:true});
    const snap = await ref.get();
    if (!snap.exists || !snap.data()?.[fieldName]) throw new Error(`${collection}/${docId} diagnostic field was not readable after update.`);
    await ref.set({[fieldName]:firebase.firestore.FieldValue.delete(), updatedAt:fieldValue()}, {merge:true});
    return `${collection}/${docId} owner read/write succeeded without deleting the document.`;
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

  async function ownUserProfileLifecycle(runId, user) {
    const ref = state.db.collection("users").doc(user.uid);
    const before = await ref.get();
    await ref.set({
      uid:user.uid,
      email:user.email || "",
      diagnosticProfileRuleTest:{runId, checkedAt:new Date().toISOString()},
      updatedAt:fieldValue(),
      ...(before.exists ? {} : {
        displayName:user.displayName || user.email || "Diagnostics User",
        profileCompleted:false,
        createdAt:fieldValue()
      })
    }, {merge:true});
    const after = await ref.get();
    if (!after.exists || after.data()?.diagnosticProfileRuleTest?.runId !== runId) {
      throw new Error("Own users/{uid} profile document was not readable after create/update.");
    }
    await ref.set({diagnosticProfileRuleTest:firebase.firestore.FieldValue.delete()}, {merge:true});
    return before.exists
      ? "Own users/{uid} profile update/read succeeded."
      : "Own users/{uid} profile create/read succeeded. A minimal signed-in user profile record was left in place because user document deletes are intentionally blocked.";
  }

  async function storageLifecycle(path) {
    if (!state.storage) throw new Error("Firebase Storage SDK or bucket is unavailable on this page.");
    const ref = state.storage.ref().child(path);
    await runStorageStep("upload smoke-test image", path, () => ref.put(tinyPngBlob(), {contentType:"image/png"}));
    await runStorageStep("read smoke-test image download URL", path, () => ref.getDownloadURL());
    await runStorageStep("delete uploaded smoke-test media", path, () => ref.delete());
  }

  async function storageLifecycleWithBlob(path, blob, contentType) {
    if (!state.storage) throw new Error("Firebase Storage SDK or bucket is unavailable on this page.");
    const ref = state.storage.ref().child(path);
    await runStorageStep("upload smoke-test media", path, () => ref.put(blob, {contentType}));
    await runStorageStep("read smoke-test media download URL", path, () => ref.getDownloadURL());
    await runStorageStep("delete uploaded smoke-test media", path, () => ref.delete());
  }

  function tinyVideoBlob() {
    return new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50])], {type:"video/mp4"});
  }

  async function runCoreFirestoreRuleTests(capture, runId, user) {
    await capture("Firestore: users/{uid} profile save path", () => ownUserProfileLifecycle(runId, user));
    await capture("Firestore: users collection read for Mingl/profile discovery", () => firestoreCollectionRead("users"));
    await capture("Firestore: clubs lifecycle", () => firestoreDocLifecycle("clubs", {name:"Diagnostics Club", status:"diagnostic"}, runId));
    await capture("Firestore: clubLocations lifecycle", () => firestoreDocLifecycle("clubLocations", {locationName:"Diagnostics Location", visibility:"public", status:"active"}, runId));
    await capture("Firestore: events lifecycle", () => firestoreDocLifecycle("events", {title:"Diagnostics Event", active:true, status:"active"}, runId));
    await capture("Firestore: templates lifecycle", () => firestoreDocLifecycle("templates", {name:"Diagnostics Template", visibility:"public"}, runId));
    await capture("Firestore: shoutouts lifecycle", () => firestoreDocLifecycle("shoutouts", {
      uid:user.uid,
      submittedByUid:user.uid,
      mainText:"Diagnostics ShoutOut",
      status:"pending"
    }, runId));
    await capture("Firestore: liveContent lifecycle", () => firestoreDocLifecycle("liveContent", {mainText:"Diagnostics Live", status:"diagnostic"}, runId));
    await capture("Firestore: guestListRequests lifecycle", () => firestoreDocLifecycle("guestListRequests", {
      uid:user.uid,
      submittedByUid:user.uid,
      clubLocationId:"diagnostic",
      status:"pending"
    }, runId));
    await capture("Firestore: messages lifecycle", () => firestoreDocLifecycle("messages", {
      senderUid:user.uid,
      recipientUid:user.uid,
      subject:"Diagnostics",
      body:"Diagnostics message",
      read:false
    }, runId));
    await capture("Firestore: privacyConsents lifecycle", () => firestoreDocLifecycle("privacyConsents", {uid:user.uid, type:"diagnostic"}, runId));
    await capture("Firestore: friendRequests lifecycle", () => firestoreDocLifecycle("friendRequests", {fromUid:user.uid, toUid:user.uid, status:"diagnostic"}, runId));
    await capture("Firestore: friendships lifecycle", () => firestoreDocLifecycle("friendships", {participants:[user.uid], status:"diagnostic"}, runId));
    await capture("Firestore: notifications lifecycle", () => firestoreDocLifecycle("notifications", {recipientUid:user.uid, title:"Diagnostics", read:false}, runId));
    await capture("Firestore: roleRequests lifecycle", () => firestoreDocLifecycle("roleRequests", {uid:user.uid, requestedRole:"diagnostic", status:"pending"}, runId));
    await capture("Firestore: clubEmployeeDesignations lifecycle", () => firestoreDocLifecycle("clubEmployeeDesignations", {workerUid:user.uid, clubLocationId:"diagnostic", isCSR:true}, runId));
    await capture("Firestore: patronRanks lifecycle", () => firestoreDocLifecycle("patronRanks", {uid:user.uid, rank:"diagnostic"}, runId));
    await capture("Firestore: approvedShoutOutLibrary lifecycle", () => firestoreDocLifecycle("approvedShoutOutLibrary", {mainText:"Diagnostics", visibility:"public"}, runId));
    await capture("Firestore: translationSettings lifecycle", () => firestoreDocLifecycle("translationSettings", {language:"en", enabled:true, status:"diagnostic"}, runId));
    await capture("Firestore: inboxNotifications lifecycle", () => firestoreDocLifecycle("inboxNotifications", {recipientUid:user.uid, title:"Diagnostics", read:false}, runId));
    await capture("Firestore: shoutoutAudit lifecycle", () => firestoreDocLifecycle("shoutoutAudit", {actorUid:user.uid, action:"diagnostic"}, runId));
    await capture("Firestore: djProfiles lifecycle", () => firestoreDocLifecycle("djProfiles", {uid:user.uid, visibility:"public", displayName:"Diagnostics DJ"}, runId));
    await capture("Firestore: promoterProfiles lifecycle", () => firestoreDocLifecycle("promoterProfiles", {uid:user.uid, visibility:"public", displayName:"Diagnostics Promoter"}, runId));
    await capture("Firestore: shoutoutRecommendations lifecycle", () => firestoreDocLifecycle("shoutoutRecommendations", {uid:user.uid, title:"Diagnostics"}, runId));
  }

  async function runAiFirestoreRuleTests(capture, runId, user) {
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
    await capture("Firestore: aiUserNotificationPreferences own doc", () => ownPreferenceLifecycle(runId, user));
    await capture("Firestore: aiUserSignals owner lifecycle", () => firestoreDocLifecycle("aiUserSignals", {uid:user.uid, type:"diagnostic"}, runId));
    await capture("Firestore: aiSearchLogs owner lifecycle", () => firestoreDocLifecycle("aiSearchLogs", {uid:user.uid, query:"diagnostic"}, runId));
    await capture("Firestore: aiRecommendations recipient lifecycle", () => firestoreDocLifecycle("aiRecommendations", {
      uid:user.uid,
      recipientUid:user.uid,
      title:"Diagnostics Recommendation"
    }, runId));
    await capture("Firestore: aiDiscoverySources lifecycle", () => firestoreDocLifecycle("aiDiscoverySources", {sourceName:"Diagnostics", enabled:false}, runId));
    await capture("Firestore: aiDiscoveryQueue lifecycle", () => firestoreDocLifecycle("aiDiscoveryQueue", {proposedTitle:"Diagnostics Discovery", status:"pendingReview"}, runId));
    await capture("Firestore: aiDiscoveryRatingCriteria lifecycle", () => firestoreDocLifecycle("aiDiscoveryRatingCriteria", {criteriaName:"Diagnostics", active:false}, runId));
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
    await capture("Firestore: aiAssistantSessions owner doc", () => ownFieldLifecycle("aiAssistantSessions", user.uid, "diagnosticAssistantRuleTest", {runId}));
    await capture("Firestore: aiAssistantMessages owner lifecycle", () => firestoreDocLifecycle("aiAssistantMessages", {uid:user.uid, body:"diagnostic"}, runId));
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
  }

  async function runMinglChatRuleTests(capture, runId, user) {
    const minglConnectionResult = await capture("Firestore: minglConnections deterministic participant lifecycle", () => minglConnectionRuleLifecycle(runId, user));
    const chatRoomResult = await capture("Firestore: chatRooms deterministic Mingl participant lifecycle", () => minglChatRoomRuleLifecycle(runId, user));
    const deterministicMinglPassed = minglConnectionResult?.status === "Pass";
    const deterministicChatPassed = chatRoomResult?.status === "Pass";
    await capture("Firestore: minglConnections participant query compatibility", () => participantQuerySoftCheck("minglConnections", user, {
      deterministicFallbackPassed:deterministicMinglPassed,
      fallbackName:"deterministic Mingl participant document reads"
    }));
    await capture("Firestore: chatRooms participant query compatibility", () => participantQuerySoftCheck("chatRooms", user, {
      deterministicFallbackPassed:deterministicChatPassed,
      fallbackName:"deterministic Mingl chat room participant reads"
    }));
    await capture("Firestore: chatMessages participant query compatibility", () => participantQuerySoftCheck("chatMessages", user, {
      deterministicFallbackPassed:deterministicChatPassed,
      fallbackName:"deterministic Mingl chat participant reads"
    }));
    await capture("Firestore: non-Mingl chatRooms lifecycle", () => firestoreDocLifecycle("chatRooms", {
      type:"diagnostic",
      participants:[user.uid],
      title:"Diagnostics Room"
    }, runId));
    await capture("Firestore: non-Mingl chatMessages lifecycle", () => firestoreDocLifecycle("chatMessages", {
      roomType:"diagnostic",
      roomId:`${runId}-room`,
      participants:[user.uid],
      senderUid:user.uid,
      body:"Diagnostics chat message"
    }, runId));
  }

  async function runStorageRuleTests(capture, runId, user) {
    await capture("Storage: template-backgrounds image path", () => storageLifecycle(`template-backgrounds/${user.uid}/${runId}/uploaded/rules-smoke-test.png`));
    await capture("Storage: shoutouts original image path", () => storageLifecycle(`shoutouts/${user.uid}/${runId}/original/rules-smoke-test.png`));
    await capture("Storage: shoutouts enhanced image path", () => storageLifecycle(`shoutouts/${user.uid}/${runId}/enhanced/rules-smoke-test.png`));
    await capture("Storage: shoutouts trimmed video path", () => storageLifecycleWithBlob(`shoutouts/${user.uid}/${runId}/trimmed/rules-smoke-test.mp4`, tinyVideoBlob(), "video/mp4"));
    await capture("Storage: profileMedia image path", () => storageLifecycle(`profileMedia/${user.uid}/images/rules-smoke-test.png`));
    await capture("Storage: profileMedia video path", () => storageLifecycleWithBlob(`profileMedia/${user.uid}/videos/rules-smoke-test.mp4`, tinyVideoBlob(), "video/mp4"));
  }

  async function saveRulesSmokeReport(results, overallStatus) {
    try {
      const user = state.auth?.currentUser || {};
      await state.db.collection("aiDiagnosticsReports").add({
        type:"rulesSmokeTest",
        packageVersion:CURRENT_DIAGNOSTICS_PACKAGE_VERSION,
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
        const evidence = await fn();
        if (evidence && typeof evidence === "object" && evidence.status) {
          const row = {
            label,
            status:evidence.status,
            evidence:evidence.evidence || "Diagnostic completed with a non-blocking note."
          };
          results.push(row);
          return row;
        }
        const row = {label, status:"Pass", evidence:evidence || "Create/read/update/delete or upload/read/delete succeeded for the signed-in user."};
        results.push(row);
        return row;
      } catch (error) {
        const row = {label, status:"Failed", evidence:error?.message || String(error)};
        results.push(row);
        return row;
      }
    }

    await runCoreFirestoreRuleTests(capture, runId, user);
    await runAiFirestoreRuleTests(capture, runId, user);
    await runMinglChatRuleTests(capture, runId, user);
    await runStorageRuleTests(capture, runId, user);
    state.lastRulesSmokeResults = results;

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
    await renderRulesVersionStatus(state.lastData);
    setText("diagnosticsStatus", failed ? `Rules smoke test found ${failed} failed checks.` : "Rules smoke test passed and report was saved.");
    return results;
  }

  async function scopedQueryRows(name, buildQuery, limit = 750) {
    const snap = await buildQuery(state.db.collection(name)).limit(limit).get();
    return snap.docs.map(doc => ({id: doc.id, _collection: name, ...doc.data()}));
  }

  function uniqueRows(rows = []) {
    const seen = new Set();
    return rows.filter(row => {
      const key = `${row._collection || ""}/${row.id || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function readOwnDocAsCollection(name, docId) {
    if (!docId) return {rows: [], error: "", note:"Signed-in user is required for scoped diagnostics."};
    const snap = await state.db.collection(name).doc(docId).get();
    return {
      rows: snap.exists ? [{id:snap.id, _collection:name, ...snap.data()}] : [],
      error:"",
      note:"Protected collection uses scoped diagnostics instead of broad collection reads."
    };
  }

  async function readProtectedCollectionSafe(name, limit = 750) {
    const user = state.auth?.currentUser;
    const uid = user?.uid || "";
    try {
      if (name === "aiUserNotificationPreferences") {
        return await readOwnDocAsCollection(name, uid);
      }
      if (["aiUserSignals", "aiSearchLogs"].includes(name)) {
        return {
          rows: await scopedQueryRows(name, query => query.where("uid", "==", uid), limit),
          error:"",
          note:"Protected collection uses scoped diagnostics by uid."
        };
      }
      if (name === "aiRecommendations") {
        const rows = [
          ...await scopedQueryRows(name, query => query.where("uid", "==", uid), limit),
          ...await scopedQueryRows(name, query => query.where("recipientUid", "==", uid), limit)
        ];
        return {
          rows: uniqueRows(rows),
          error:"",
          note:"Protected collection uses scoped diagnostics by uid/recipientUid."
        };
      }
      if (name === "patronTemplateVariants") {
        const rows = [
          ...await scopedQueryRows(name, query => query.where("ownerUid", "==", uid), limit),
          ...await scopedQueryRows(name, query => query.where("visibility", "==", "public"), limit)
        ];
        return {
          rows: uniqueRows(rows),
          error:"",
          note:"Protected collection uses owner/public scoped diagnostics."
        };
      }
      if (name === "aiIndex") {
        const rows = [
          ...await scopedQueryRows(name, query => query.where("visibility", "==", "public"), limit),
          ...await scopedQueryRows(name, query => query.where("ownerUid", "==", uid), limit)
        ];
        return {
          rows: uniqueRows(rows),
          error:"",
          note:"Protected index uses public/owner scoped diagnostics."
        };
      }
      if (["minglConnections", "chatRooms", "chatMessages"].includes(name)) {
        try {
          return {
            rows: await scopedQueryRows(name, query => query.where("participants", "array-contains", uid), limit),
            error:"",
            note:"Protected Mingl/chat collection uses participant-scoped diagnostics."
          };
        } catch (error) {
          return {
            rows: [],
            error:"",
            note:`Protected Mingl/chat participant query blocked by deployed rules: ${error?.message || error}. App fallback reads deterministic participant docs; run Rules Smoke Test for live proof.`
          };
        }
      }
    } catch (error) {
      return {rows: [], error: error?.message || String(error)};
    }
    return null;
  }

  async function readCollectionSafe(name, limit = 750) {
    const protectedResult = await readProtectedCollectionSafe(name, limit);
    if (protectedResult) return protectedResult;
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

  function hasOwnField(row = {}, key) {
    return Object.prototype.hasOwnProperty.call(row, key);
  }

  function socialHandleValues(row = {}) {
    const socials = row.socialMediaHandles || row.socialHandles || {};
    return [
      socials.instagram,
      socials.x,
      socials.tiktok,
      socials.facebook,
      socials.twitter,
      socials.youtube
    ].filter(value => String(value || "").trim());
  }

  function hasPublicClubProfileSchema(row = {}) {
    return [
      "address",
      "officialWebsite",
      "website",
      "email",
      "telephone",
      "phone",
      "socialMediaHandles",
      "socialHandles",
      "publicProfileType",
      "clubOwnershipStatus",
      "subscriptionRequiredForPublicProfileEdits"
    ].some(key => hasOwnField(row, key));
  }

  function hasPublicClubContactValue(row = {}) {
    return [
      row.address,
      row.officialWebsite || row.website,
      row.email,
      row.telephone || row.phone,
      ...socialHandleValues(row)
    ].some(value => String(value || "").trim());
  }

  function staticClubProfileDefaultsReady() {
    const rows = Object.values(window.SHOUTOUT_CLUB_LOCATIONS || {});
    return rows.length > 0 && rows.some(hasPublicClubProfileSchema);
  }

  function clubProfileDiagnostics(data = {}) {
    const rows = data.clubLocations?.rows || [];
    const schemaRows = rows.filter(hasPublicClubProfileSchema);
    const contentRows = rows.filter(hasPublicClubContactValue);
    const adminUiReady = !!(
      document.getElementById("backfillClubProfileFieldsBtn") &&
      window.SHOUTOUT_CLUB_LOCATIONS &&
      staticClubProfileDefaultsReady()
    );
    return {
      rows,
      schemaRows,
      contentRows,
      adminUiReady,
      fieldSupportReady: adminUiReady || schemaRows.length > 0
    };
  }

  function renderClubProfileDiagnostics(data = state.lastData || {}) {
    const wrap = byId("clubProfileDiagnosticsReport");
    if (!wrap) return;
    const details = clubProfileDiagnostics(data);
    wrap.innerHTML = simpleRows([
      ["Firestore club records scanned", details.rows.length.toLocaleString()],
      ["Records with public profile schema fields", details.schemaRows.length.toLocaleString()],
      ["Records with filled contact values", details.contentRows.length.toLocaleString()],
      ["Static club defaults include profile fields", staticClubProfileDefaultsReady() ? "Yes" : "No"],
      ["Safe setup action", "Backfill only adds missing keys; it does not overwrite existing club profile values."]
    ]);
  }

  function missingClubProfilePayload(row = {}) {
    const payload = {};
    const setMissing = (key, value) => {
      if (!hasOwnField(row, key)) payload[key] = value;
    };
    const socials = row.socialMediaHandles || row.socialHandles || {};
    setMissing("address", row.address || "");
    setMissing("officialWebsite", row.officialWebsite || row.website || "");
    setMissing("email", row.email || "");
    setMissing("telephone", row.telephone || row.phone || "");
    if (!hasOwnField(row, "socialMediaHandles")) {
      payload.socialMediaHandles = {
        instagram:socials.instagram || "",
        x:socials.x || socials.twitter || "",
        tiktok:socials.tiktok || "",
        facebook:socials.facebook || ""
      };
    }
    setMissing("visibility", row.visibility || "public");
    setMissing("publicProfileType", "club");
    setMissing("clubOwnershipStatus", row.clubOwnershipStatus || "unclaimed");
    setMissing("subscriptionRequiredForPublicProfileEdits", row.subscriptionRequiredForPublicProfileEdits ?? true);
    if (!hasOwnField(row, "publicSearchKeywords")) {
      payload.publicSearchKeywords = Array.from(new Set([
        row.locationName,
        row.brandName,
        row.city,
        row.stateRegion || row.region || row.state,
        row.country,
        ...(Array.isArray(row.categories) ? row.categories : []),
        ...(Array.isArray(row.genres) ? row.genres : [])
      ].filter(Boolean)));
    }
    return payload;
  }

  function slugId(value = "") {
    return normalized(value).replace(/\s+/g, "-").slice(0, 90) || `profile-${Date.now()}`;
  }

  function publicSourceProfileFromRow(row = {}) {
    const socials = row.socialMediaHandles || row.socialHandles || {};
    return {
      address: row.address || row.proposedAddress || "",
      officialWebsite: row.officialWebsite || row.website || "",
      email: row.email || "",
      telephone: row.telephone || row.phone || "",
      socialMediaHandles: {
        instagram: socials.instagram || "",
        x: socials.x || socials.twitter || "",
        tiktok: socials.tiktok || "",
        facebook: socials.facebook || ""
      },
      city: row.city || "",
      stateRegion: row.stateRegion || row.region || row.state || "",
      country: row.country || "",
      sourceUrl: row.sourceUrl || "",
      sourceName: row.sourceName || "AI crawler public source",
      sourceLanguage: row.searchLanguage || row.language || "",
      tags: [
        ...(Array.isArray(row.extractedTags) ? row.extractedTags : []),
        ...(Array.isArray(row.categories) ? row.categories : []),
        ...(Array.isArray(row.genres) ? row.genres : [])
      ].filter(Boolean)
    };
  }

  function crawlerProfileDraftFromRecord(row = {}, index = 0) {
    const proposedType = normalized(row.proposedType || row.type || row.collection || "");
    const isEvent = proposedType.includes("event") || proposedType.includes("ticket") || row.eventName;
    const targetCollection = isEvent ? "events" : "clubLocations";
    const title = row.proposedTitle || row.locationName || row.proposedLocationName || row.eventName || row.title || `Crawler profile ${index + 1}`;
    const targetId = row.approvedRecordId || row.targetId || row.clubLocationId || row.locationId || row.id || slugId(`${title} ${row.city || ""} ${row.country || ""}`);
    return {
      targetCollection,
      targetId,
      targetType: isEvent ? "eventDestination" : "clubLocation",
      displayName: title,
      proposedLocationName: row.proposedLocationName || row.locationName || title,
      proposedType: row.proposedType || (isEvent ? "event" : "club"),
      sourceQueueId: row.id || "",
      sourceUrl: row.sourceUrl || "",
      sourceName: row.sourceName || "AI crawler public source",
      aiSummary: row.aiSummary || "AI crawler public-source profile draft.",
      aiConfidenceScore: row.aiConfidenceScore || 0,
      aiStarRating: row.aiStarRating || 0,
      publicProfile: publicSourceProfileFromRow(row),
      importPolicy: {
        publicDataOnly: true,
        requiresReview: true,
        applyMode: "missingOnly",
        neverOverwriteExisting: true
      }
    };
  }

  function profileImportEnvelope(records = []) {
    return {
      schemaVersion: "floqr-ai-crawler-profile-import-v1",
      generatedAt: new Date().toISOString(),
      generatedBy: state.auth?.currentUser?.email || state.auth?.currentUser?.uid || "",
      source: "ai-crawler-public-source-review",
      privacyRule: "Public source data only. Review required before live profile update.",
      records
    };
  }

  function buildProfileImportRecords(data = state.lastData || {}) {
    const queueRows = (data.aiDiscoveryQueue?.rows || [])
      .filter(row => String(row.status || "pendingReview") !== "deleted")
      .filter(row => row.discoveryMode !== "profile-import-draft");
    const clubRows = (data.clubLocations?.rows || []).filter(row => !hasPublicClubContactValue(row));
    const eventRows = (data.events?.rows || []).filter(row => row.sourceUrl || row.ticketUrl || row.officialWebsite || row.website);
    const sourceRows = [
      ...queueRows,
      ...clubRows.map((row, index) => ({...row, collection:"clubLocations", proposedType:"club", proposedTitle:row.locationName || row.brandName || row.id, _profileImportSourceIndex:index})),
      ...eventRows.map((row, index) => ({...row, collection:"events", proposedType:"event", proposedTitle:row.eventName || row.title || row.id, _profileImportSourceIndex:index}))
    ];
    const drafts = consolidateCrawlRecords(sourceRows).map((group, index) => {
      const source = group.items[0] || {};
      const draft = crawlerProfileDraftFromRecord({
        ...source,
        proposedLocationName: group.name,
        proposedTitle: group.name,
        city: group.city,
        country: group.country,
        proposedAddress: group.addressConflicts ? "" : group.canonicalAddress
      }, index);
      draft.consolidation = {
        groupedRecordCount: group.itemCount,
        addressConflict: group.addressConflicts,
        addressOptions: group.addressOptions.map(item => ({
          address:item.address,
          count:item.count,
          sources:Array.from(item.sources)
        })),
        sourceNames: group.sourceList
      };
      if (group.addressConflicts) {
        draft.aiSummary = `${draft.aiSummary} Address conflict detected across crawler sources. Master Admin must choose the correct address before import.`;
        draft.importPolicy.requiresAddressReview = true;
      }
      return draft;
    });
    const seen = new Set();
    return drafts.filter(draft => {
      const key = `${draft.targetCollection}/${draft.targetId}/${draft.sourceQueueId || draft.sourceUrl || draft.displayName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 100);
  }

  function generateCrawlerProfileJson() {
    const records = buildProfileImportRecords(state.lastData || {});
    const envelope = profileImportEnvelope(records);
    const text = JSON.stringify(envelope, null, 2);
    if (byId("clubProfileImportJson")) byId("clubProfileImportJson").value = text;
    renderClubProfileImportDrafts(records, "Generated crawler JSON from current discovery, club, and event records. Review or edit before saving import drafts.");
    setText("diagnosticsStatus", `Generated crawler profile JSON with ${records.length} record(s).`);
    return envelope;
  }

  function parseProfileImportJson() {
    const raw = byId("clubProfileImportJson")?.value.trim() || "";
    if (!raw) return profileImportEnvelope([]);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return profileImportEnvelope(parsed);
    return {
      ...parsed,
      records: Array.isArray(parsed.records) ? parsed.records : []
    };
  }

  function cleanProfileImportDraft(draft = {}) {
    const publicProfile = draft.publicProfile || {};
    return {
      targetCollection: draft.targetCollection === "events" ? "events" : "clubLocations",
      targetId: String(draft.targetId || slugId(draft.displayName || draft.proposedLocationName || "profile")).trim(),
      targetType: draft.targetType || (draft.targetCollection === "events" ? "eventDestination" : "clubLocation"),
      displayName: String(draft.displayName || draft.proposedLocationName || draft.targetId || "Crawler profile draft").trim(),
      proposedLocationName: draft.proposedLocationName || draft.displayName || "",
      proposedType: draft.proposedType || (draft.targetCollection === "events" ? "event" : "club"),
      sourceQueueId: draft.sourceQueueId || "",
      sourceUrl: draft.sourceUrl || publicProfile.sourceUrl || "",
      sourceName: draft.sourceName || publicProfile.sourceName || "AI crawler public source",
      aiSummary: draft.aiSummary || "Public-source club/event destination profile data formatted by the AI crawler workflow.",
      aiConfidenceScore: Number(draft.aiConfidenceScore || 0),
      aiStarRating: Number(draft.aiStarRating || 0),
      publicProfile: {
        address: publicProfile.address || "",
        officialWebsite: publicProfile.officialWebsite || publicProfile.website || "",
        email: publicProfile.email || "",
        telephone: publicProfile.telephone || publicProfile.phone || "",
        socialMediaHandles: {
          instagram: publicProfile.socialMediaHandles?.instagram || "",
          x: publicProfile.socialMediaHandles?.x || publicProfile.socialMediaHandles?.twitter || "",
          tiktok: publicProfile.socialMediaHandles?.tiktok || "",
          facebook: publicProfile.socialMediaHandles?.facebook || ""
        },
        city: publicProfile.city || "",
        stateRegion: publicProfile.stateRegion || publicProfile.region || "",
        country: publicProfile.country || "",
        sourceUrl: publicProfile.sourceUrl || draft.sourceUrl || "",
        sourceName: publicProfile.sourceName || draft.sourceName || "AI crawler public source",
        sourceLanguage: publicProfile.sourceLanguage || "",
        tags: Array.isArray(publicProfile.tags) ? publicProfile.tags.filter(Boolean) : []
      },
      importPolicy: {
        publicDataOnly: true,
        requiresReview: true,
        applyMode: "missingOnly",
        neverOverwriteExisting: true,
        ...(draft.importPolicy || {})
      }
    };
  }

  function clubAdminImportUrl(draftId, targetId) {
    const url = new URL("./admin.html", window.location.href);
    url.searchParams.set("location", targetId);
    url.searchParams.set("profileImportDraft", draftId);
    url.searchParams.set("v", "28.61-crawler-profile-import");
    return url.href;
  }

  async function saveClubProfileImportDrafts() {
    if (!state.db) return;
    let envelope;
    try {
      envelope = parseProfileImportJson();
    } catch (error) {
      setText("diagnosticsStatus", `Crawler JSON could not be parsed: ${error?.message || error}`);
      return;
    }
    const drafts = envelope.records.map(cleanProfileImportDraft).filter(draft => draft.targetId);
    if (!drafts.length) {
      setText("diagnosticsStatus", "No crawler profile import records were found in the JSON.");
      return;
    }
    const saved = [];
    for (const draft of drafts) {
      const ref = state.db.collection("aiDiscoveryQueue").doc();
      const importUrl = draft.targetCollection === "clubLocations" ? clubAdminImportUrl(ref.id, draft.targetId) : "";
      await ref.set({
        proposedType: draft.targetCollection === "events" ? "eventDestinationProfile" : "clubProfile",
        proposedTitle: draft.displayName,
        proposedDescription: draft.aiSummary,
        proposedLocationName: draft.proposedLocationName || draft.displayName,
        proposedAddress: draft.publicProfile.address || "",
        city: draft.publicProfile.city || "",
        stateRegion: draft.publicProfile.stateRegion || "",
        country: draft.publicProfile.country || "",
        sourceUrl: draft.sourceUrl || draft.publicProfile.sourceUrl || "",
        sourceName: draft.sourceName || draft.publicProfile.sourceName || "AI crawler public source",
        extractedTags: draft.publicProfile.tags || [],
        categories: ["profile-import-draft", draft.targetType],
        aiSummary: draft.aiSummary,
        aiConfidenceScore: draft.aiConfidenceScore,
        aiStarRating: draft.aiStarRating || 3,
        aiRatingReasons: [
          "Public-source profile/contact data requires review",
          "Applies missing fields only",
          "Ready for Master Admin import or Club Admin import link"
        ],
        duplicateCandidateIds: [],
        status: "pendingReview",
        discoveryMode: "profile-import-draft",
        profileImport: draft,
        clubAdminImportUrl: importUrl,
        createdByUid: state.auth?.currentUser?.uid || "",
        createdByEmail: state.auth?.currentUser?.email || "",
        createdAt: fieldValue(),
        updatedAt: fieldValue()
      });
      saved.push({id: ref.id, ...draft, clubAdminImportUrl: importUrl});
    }
    await refreshDiagnostics();
    renderClubProfileImportDrafts(saved, `Saved ${saved.length} crawler profile import draft(s) to aiDiscoveryQueue.`);
    setText("diagnosticsStatus", `Saved ${saved.length} crawler profile import draft(s).`);
  }

  function mergeMissingProfileFields(existing = {}, profile = {}) {
    const payload = {};
    const setIfMissing = (key, value) => {
      const clean = String(value || "").trim();
      if (clean && !String(existing[key] || "").trim()) payload[key] = clean;
    };
    setIfMissing("address", profile.address);
    setIfMissing("officialWebsite", profile.officialWebsite || profile.website);
    setIfMissing("email", profile.email);
    setIfMissing("telephone", profile.telephone || profile.phone);
    if (profile.city && !existing.city) payload.city = profile.city;
    if (profile.stateRegion && !existing.stateRegion && !existing.region) payload.stateRegion = profile.stateRegion;
    if (profile.country && !existing.country) payload.country = profile.country;
    const existingSocials = existing.socialMediaHandles || existing.socialHandles || {};
    const incomingSocials = profile.socialMediaHandles || {};
    const mergedSocials = {...existingSocials};
    ["instagram", "x", "tiktok", "facebook"].forEach(key => {
      if (!String(mergedSocials[key] || "").trim() && String(incomingSocials[key] || "").trim()) {
        mergedSocials[key] = incomingSocials[key].trim();
      }
    });
    if (Object.keys(mergedSocials).length) payload.socialMediaHandles = mergedSocials;
    payload.visibility = existing.visibility || "public";
    payload.publicProfileType = existing.publicProfileType || (profile.targetCollection === "events" ? "eventDestination" : "club");
    payload.publicProfileImportUpdatedAt = fieldValue();
    payload.publicProfileImportSourceUrl = profile.sourceUrl || "";
    payload.publicProfileImportMode = "missingOnly";
    payload.updatedAt = fieldValue();
    payload.updatedByUid = state.auth?.currentUser?.uid || "";
    payload.updatedByEmail = state.auth?.currentUser?.email || "";
    return payload;
  }

  async function applyProfileImportDraft(draftId) {
    if (!state.db || !draftId) return;
    const ref = state.db.collection("aiDiscoveryQueue").doc(draftId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Crawler profile import draft was not found.");
    const row = {id:snap.id, ...snap.data()};
    const draft = cleanProfileImportDraft(row.profileImport || {});
    const targetRef = state.db.collection(draft.targetCollection).doc(draft.targetId);
    const targetSnap = await targetRef.get();
    const existing = targetSnap.exists ? targetSnap.data() : {};
    const payload = mergeMissingProfileFields(existing, {...draft.publicProfile, targetCollection:draft.targetCollection, sourceUrl:draft.sourceUrl});
    await targetRef.set(payload, {merge:true});
    await ref.set({
      status:"approved",
      appliedAt:fieldValue(),
      appliedByUid:state.auth?.currentUser?.uid || "",
      appliedByEmail:state.auth?.currentUser?.email || "",
      appliedCollection:draft.targetCollection,
      appliedRecordId:draft.targetId,
      updatedAt:fieldValue()
    }, {merge:true});
    setText("diagnosticsStatus", `Applied crawler profile import to ${draft.targetCollection}/${draft.targetId}. Existing values were preserved.`);
    await refreshDiagnostics();
  }

  function renderClubProfileImportDrafts(records = [], note = "") {
    const wrap = byId("clubProfileDiagnosticsReport");
    if (!wrap) return;
    const rows = records.slice(0, 20);
    const cards = rows.map(item => {
      const id = item.id || "";
      const url = item.clubAdminImportUrl || "";
      const target = `${item.targetCollection || "clubLocations"}/${item.targetId || ""}`;
      return `<div class="queue-item">
        <div class="message-envelope-head">
          <strong>${esc(item.displayName || item.proposedTitle || item.targetId || "Crawler profile draft")}</strong>
          ${statusBadge(item.status || "Soft Fail")}
        </div>
        <p>${esc(target)} ${item.sourceName ? `- ${item.sourceName}` : ""}</p>
        <small>${esc(item.sourceUrl || item.publicProfile?.sourceUrl || "")}</small>
        <div class="queue-actions">
          ${id ? `<button type="button" data-profile-import-action="apply" data-id="${esc(id)}">Apply Missing Fields</button>` : ""}
          ${url ? `<button type="button" data-profile-import-action="copy" data-url="${esc(url)}">Copy Club Admin Import Link</button>` : ""}
        </div>
      </div>`;
    }).join("");
    wrap.innerHTML = `${note ? `<p class="sub small">${esc(note)}</p>` : ""}${cards || simpleRows([
      ["Crawler profile import drafts", "No drafts generated yet."],
      ["Next step", "Click Generate Crawler JSON after running or importing public-source crawl records."]
    ])}`;
    wrap.querySelectorAll("[data-profile-import-action='apply']").forEach(btn => {
      btn.addEventListener("click", () => applyProfileImportDraft(btn.dataset.id).catch(error => {
        setText("diagnosticsStatus", `Profile import failed: ${error?.message || error}`);
      }));
    });
    wrap.querySelectorAll("[data-profile-import-action='copy']").forEach(btn => {
      btn.addEventListener("click", async () => {
        await copyTextToClipboard(btn.dataset.url || "");
        setText("diagnosticsStatus", "Club Admin import link copied.");
      });
    });
  }

  async function backfillClubProfileFields() {
    if (!state.db) return;
    setText("diagnosticsStatus", "Backfill Missing Club Profile Fields: scanning clubLocations...");
    const snap = await state.db.collection("clubLocations").limit(1000).get();
    let updated = 0;
    for (const doc of snap.docs) {
      const row = {id:doc.id, ...doc.data()};
      const payload = missingClubProfilePayload(row);
      if (Object.keys(payload).length) {
        payload.updatedAt = fieldValue();
        await doc.ref.set(payload, {merge:true});
        updated += 1;
      }
    }
    setText("diagnosticsStatus", `Backfill Missing Club Profile Fields complete. ${updated} club record(s) received missing field keys. Existing values were not overwritten.`);
    await refreshDiagnostics();
  }

  function buildFeatureDiagnostics(data) {
    const aiIndexRows = data.aiIndex?.rows || [];
    const unsafeIndexRows = aiIndexRows.filter(row => {
      const type = normalized(row.sourceType);
      const visibility = String(row.visibility || "").toLowerCase();
      return type.includes("chat") || type.includes("message") || (visibility && !["public", "shared", "private"].includes(visibility));
    });
    const clubProfile = clubProfileDiagnostics(data);
    const userLanguageRows = (data.users?.rows || []).filter(row => row.publicProfileLanguageMode || row.publicProfileBioEnglish || row.publicProfileTranslationStatus);
    const scheduleRows = data.aiCrawlerSchedules?.rows || [];
    const crawlRuns = data.aiCrawlRuns?.rows || [];
    const discoveryQueue = data.aiDiscoveryQueue?.rows || [];
    const latestRulesReport = currentPackageRulesSmokeReport(data);
    const latestAnyRulesReport = latestRulesSmokeReport(data);
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
      ["Mingl", "Chat messages privacy", collectionError(data, "chatMessages") ? "Failed" : "Pass", "Diagnostics checks chat access without copying private chat bodies into aiIndex."],
      ["Messaging", "Inbox notifications", collectionStatus(data, "inboxNotifications", true), `${collectionCount(data, "inboxNotifications")} inbox notifications scanned.`],
      ["Bata", "Marketplace discovery/search", "TBI", "Bata search hooks are AI-ready, but production listing and checkout workflows are not live yet."],
      ["AI Search", "floqrSearch local fallback", hasSearch ? "Pass" : "Failed", hasSearch ? `FLOQR_AI_ENABLED=${window.FLOQR_AI_ENABLED === true}; fallback=${window.FLOQR_AI_FALLBACK_MODE || "local-contextual-search"}.` : "FLOQRSearch module was not loaded."],
      ["AI Search", "Privacy-respecting aiIndex", unsafeIndexRows.length ? "Failed" : "Pass", unsafeIndexRows.length ? `${unsafeIndexRows.length} aiIndex records need review.` : `${aiIndexRows.length} aiIndex records scanned without chat/message indexing violations.`],
      ["AI Assistant", "Ask FLOQR scaffold", window.FLOQR_AI_ASSISTANT_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_ASSISTANT_ENABLED ? "Assistant flag is on; verify provider/config before production." : "Assistant remains safely disabled by default."],
      ["AI Notifications", "Notification preferences", collectionStatus(data, "aiUserNotificationPreferences", true), `${collectionCount(data, "aiUserNotificationPreferences")} preference records scanned.`],
      ["Templates", "Patron template variants", collectionStatus(data, "patronTemplateVariants", true), `${collectionCount(data, "patronTemplateVariants")} patron template variants scanned.`],
      ["Templates", "FLOQR Studio background designer", window.FLOQR_AI_STUDIO_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_STUDIO_ENABLED ? "Studio flag on; live image generation still requires a safe provider." : "Studio is AI-ready and disabled by default."],
      ["Club Profiles", "Public club profile field support", clubProfile.fieldSupportReady ? "Pass" : "Soft Fail", clubProfile.fieldSupportReady ? "Club profile schema/UI and crawler import support are available." : "Club profile schema fields are not present yet; use Master Admin > AI Crawling > Backfill Missing Field Keys."],
      ["Club Profiles", "Filled public contact values", clubProfile.contentRows.length ? "Pass" : "Soft Fail", clubProfile.contentRows.length ? `${clubProfile.contentRows.length} club profiles include filled public contact values.` : "No club records have filled website/email/social/telephone values yet. Use AI Crawling profile import drafts or Club Admin public profile editing."],
      ["Club Profiles", "Claimed club owner editing", "Soft Fail", "Club profile editing is scaffolded; production subscription/ownership enforcement needs backend rules or claims."],
      ["Ticketing", "Ticketmaster/Eventbrite discovery", "Soft Fail", "Search criteria and queue records include ticketing partners; live API credentials/partnerships are not configured in frontend."],
      ["Ticketing", "Approved resale partner flow", "TBI", "Partner contracts, affiliate tracking, and resale APIs must be configured later."],
      ["Transportation", "Third-party taxi hailing integration", "TBI", "Reserved as partner integration; not connected to current app workflows."],
      ["AI Discovery", "Discovery queue", collectionStatus(data, "aiDiscoveryQueue", true), `${discoveryQueue.length} discovery queue records scanned.`],
      ["AI Discovery", "Review/approve/reject/delete", hasDiscovery ? "Pass" : "Failed", hasDiscovery ? "AI Discovery Master Admin module loaded." : "FLOQRAIDiscovery module was not loaded."],
      ["AI Crawling", "Manual crawl control", byId("runManualCrawlBtn") ? "Pass" : "Failed", "Manual crawl adds reviewable records to aiDiscoveryQueue from the AI Crawling tab."],
      ["AI Crawling", "Crawler scheduler settings", scheduleRows.length ? "Pass" : "Soft Fail", scheduleRows.length ? "Default schedule saved." : "Controls are ready; save a schedule to create aiCrawlerSchedules/default."],
      ["AI Crawling", "Backend scheduled internet crawler", "TBI", "Cloud Functions or Cloud Run scheduler must perform real public-source crawling 4-6 times per day."],
      ["AI Crawling", "Crawl run reports", crawlRuns.length ? "Pass" : "Soft Fail", crawlRuns.length ? `${crawlRuns.length} crawl run records found.` : "No crawl runs logged yet."],
      ["Master Admin", "Soft delete/restore listings", hasDiscovery ? "Pass" : "Failed", "Soft delete hides deleted club/event listings from patron search/display."],
      ["Master Admin", "AI Crawling page", byId("aiCrawling") ? "Pass" : "Failed", "Crawler controls, consolidated reports, import JSON, and analytics are mounted on the AI Crawling tab."],
      ["Master Admin", "Diagnostics page", "Pass", "Feature matrix, package checks, export, and Firebase rules smoke tests are mounted under Master Admin settings."],
      ["Master Admin", "Package install diagnostics", byId("runPackageDiagnosticsBtn") ? "Pass" : "Failed", "Per-package feature marker checks are available after upload."],
      ["Master Admin", "Firebase rules smoke test", latestRulesReport ? (latestRulesReport.status === "Pass" ? "Pass" : "Failed") : "Soft Fail", latestRulesReport ? `Latest current-package rules smoke test status: ${latestRulesReport.status || "unknown"} at ${fmtDate(latestRulesReport.createdAt)}.` : latestAnyRulesReport ? `Latest saved rules smoke test is stale: ${latestAnyRulesReport.packageVersion || "unknown package"} at ${fmtDate(latestAnyRulesReport.createdAt)}. Run the rules smoke test for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}.` : "Run the rules smoke test after publishing Firestore/Storage rules."]
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
    const groups = consolidateCrawlRecords(queue);
    wrap.innerHTML = groups.length ? groups.slice(0, 25).map(group => `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(group.name)}</strong>
        ${statusBadge(group.addressConflicts ? "Soft Fail" : "Pass")}
      </div>
      <p>${esc(group.city || "")}${group.country ? `, ${esc(group.country)}` : ""} | ${esc(group.family)} | ${esc(group.genreList.slice(0, 5).join(", "))}</p>
      <p>${group.canonicalAddress ? `Address: ${esc(group.canonicalAddress)}` : "Address: not collected yet"}</p>
      ${group.addressConflicts ? `<p class="sub small">Address conflict: ${esc(group.addressOptions.map(item => `${item.address} (${item.count})`).join(" | "))}</p>` : ""}
      <small>Grouped records: ${esc(group.itemCount)} | Sources: ${esc(group.sourceList.join(", ") || "-")} | Max stars: ${esc(group.maxStar || "-")} | Max confidence: ${esc(group.maxConfidence || "-")}</small>
    </div>`).join("") : "<p class='sub'>No collected discovery records yet. Run a manual crawl scaffold to seed review records.</p>";
  }

  function renderAnalyticsInsights(data) {
    const queue = data.aiDiscoveryQueue?.rows || [];
    const runs = data.aiCrawlRuns?.rows || [];
    const groups = consolidateCrawlRecords(queue);
    const addressConflicts = groups.filter(group => group.addressConflicts);
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
      ["Raw collected records", queue.length.toLocaleString()],
      ["Consolidated destinations", groups.length.toLocaleString()],
      ["Address conflicts to review", addressConflicts.length.toLocaleString()],
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

  function renderAiCrawlingSummary(data, schedule) {
    const wrap = byId("aiCrawlingSummary");
    if (!wrap) return;
    const queue = data.aiDiscoveryQueue?.rows || [];
    const groups = consolidateCrawlRecords(queue);
    const addressConflicts = groups.filter(group => group.addressConflicts);
    const profileDrafts = queue.filter(item => item.discoveryMode === "profile-import-draft");
    wrap.innerHTML = simpleRows([
      ["Raw collected records", queue.length.toLocaleString()],
      ["Consolidated clubs/events", groups.length.toLocaleString()],
      ["Address conflicts", addressConflicts.length.toLocaleString()],
      ["Profile import drafts", profileDrafts.length.toLocaleString()],
      ["Crawl schedule", schedule?.frequency || "Not saved"],
      ["Publishing rule", "Crawler results stay in review/import drafts until Master Admin or Club Admin approves them."]
    ]);
  }

  async function loadDiagnosticsData() {
    const entries = await Promise.all(COLLECTIONS.map(async name => [name, await readCollectionSafe(name)]));
    const data = Object.fromEntries(entries);
    state.lastData = data;
    return data;
  }

  async function exportDiagnosticsReport() {
    if (!state.db) {
      setText("diagnosticsStatus", "Diagnostics export failed because Firestore is unavailable.");
      return;
    }
    try {
      setText("diagnosticsStatus", "Preparing diagnostics TXT export...");
      const [data, schedule] = await Promise.all([loadDiagnosticsData(), readScheduleSafe()]);
      if (schedule) applyScheduleToControls(schedule);
      const features = buildFeatureDiagnostics(data);
      state.lastFeatures = features;
      state.lastSchedule = schedule || null;
      renderFeatureDiagnostics(features);
      await renderRulesVersionStatus(data);
      renderAiCrawlingSummary(data, schedule);
      renderClubProfileDiagnostics(data);
      renderCrawlActivity(data, schedule);
      renderCollectedRecords(data);
      renderAnalyticsInsights(data);
      const packageResults = await runPackageInstallDiagnostics({silent:true});
      const filename = `floqr-diagnostics-${exportTimestamp()}.txt`;
      const text = buildDiagnosticsExport({data, schedule, features, packageResults});
      downloadTextFile(filename, text);
      const issues = collectDiagnosticIssues({data, features, packageResults, reports:data.aiDiagnosticsReports?.rows || []});
      setText("diagnosticsStatus", `Diagnostics export downloaded as ${filename}. ${issues.length} failed, soft-fail, or TBI item(s) included in the fix prompt.`);
    } catch (error) {
      setText("diagnosticsStatus", `Diagnostics export failed: ${error?.message || error}`);
    }
  }

  async function refreshDiagnostics() {
    if (!state.db) return;
    setText("diagnosticsStatus", "Refreshing diagnostics...");
    const [data, schedule] = await Promise.all([loadDiagnosticsData(), readScheduleSafe()]);
    if (schedule) applyScheduleToControls(schedule);
    const features = buildFeatureDiagnostics(data);
    state.lastFeatures = features;
    state.lastSchedule = schedule || null;
    renderFeatureDiagnostics(features);
    await renderRulesVersionStatus(data);
    renderAiCrawlingSummary(data, schedule);
    renderClubProfileDiagnostics(data);
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
    byId("exportDiagnosticsTxtBtn")?.addEventListener("click", exportDiagnosticsReport);
    byId("runPackageDiagnosticsBtn")?.addEventListener("click", () => runPackageInstallDiagnostics());
    byId("runRulesSmokeTestBtn")?.addEventListener("click", runRulesSmokeTest);
    byId("saveCrawlScheduleBtn")?.addEventListener("click", () => saveCrawlSchedule());
    byId("runManualCrawlBtn")?.addEventListener("click", runManualCrawl);
    byId("generateClubProfileJsonBtn")?.addEventListener("click", generateCrawlerProfileJson);
    byId("saveClubProfileImportDraftsBtn")?.addEventListener("click", saveClubProfileImportDrafts);
    byId("backfillClubProfileFieldsBtn")?.addEventListener("click", backfillClubProfileFields);
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
    exportDiagnosticsReport,
    DEFAULT_EVENT_TYPES,
    DEFAULT_GENRES,
    DEFAULT_MARKET_LANGUAGE_PLAN
  };
})();
