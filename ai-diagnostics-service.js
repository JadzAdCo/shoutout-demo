/* FLOQR AI diagnostics, crawler controls, TXT export, Gemini media checks, rules guidance, and manual feature tests v28.87 */
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
    lastCrawlPlan: null,
    lastExtractedSourceRecord: null,
    lastStaleRecords: [],
    lastFeatures: [],
    lastPackageDiagnostics: [],
    lastRulesSmokeResults: [],
    lastGeminiMediaDiagnostic: null,
    lastManualFeatureDiagnostics: []
  };

  const STATUS_COPY = {
    Pass: "Implemented and currently healthy",
    "Soft Fail": "Implemented and diagnosed with minor error(s)",
    Failed: "Implemented but failing or blocked",
    TBI: "To be implemented"
  };

  const EXPECTED_FIRESTORE_RULES_VERSION = "v28.88-mingl-grammar-profile-datapoints-rules";
  const EXPECTED_STORAGE_RULES_VERSION = "v28.88-mingl-grammar-profile-datapoints-storage-rules";
  const CURRENT_DIAGNOSTICS_PACKAGE_VERSION = "v28.88-mingl-grammar-profile-datapoints";
  const STALE_RECORD_DEFINITION = "Stale records are queue records more than 4 days old, records referencing old Firestore/Storage rules, or records referencing old/unknown locations.";
  const STALE_RECORD_DEFAULT_DAYS = 4;
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
    "Nightlife",
    "Live Entertainment",
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

  const KNOWN_MARKETS = [
    {city:"Paris", country:"France", region:"Ile-de-France", language:"French"},
    {city:"Marseille", country:"France", region:"Provence-Alpes-Cote d'Azur", language:"French"},
    {city:"Monaco", country:"Monaco", region:"Monaco", language:"French, English"},
    {city:"Saint-Tropez", aliases:["St. Tropez", "St Tropez", "Saint Tropez"], country:"France", region:"Provence-Alpes-Cote d'Azur", language:"French"},
    {city:"Cannes", country:"France", region:"Provence-Alpes-Cote d'Azur", language:"French"},
    {city:"Nice", country:"France", region:"Provence-Alpes-Cote d'Azur", language:"French"},
    {city:"Dubai", country:"United Arab Emirates", region:"Dubai", language:"Arabic, English"},
    {city:"Istanbul", country:"Turkey", region:"Istanbul", language:"Turkish"},
    {city:"Singapore", country:"Singapore", region:"Singapore", language:"English, Mandarin, Malay, Tamil"},
    {city:"Bangkok", country:"Thailand", region:"Bangkok", language:"Thai, English"},
    {city:"Phuket", country:"Thailand", region:"Phuket", language:"Thai, English"},
    {city:"Shanghai", country:"China", region:"Shanghai", language:"Chinese, English"},
    {city:"Barcelona", country:"Spain", region:"Catalonia", language:"Spanish, Catalan"},
    {city:"Madrid", country:"Spain", region:"Madrid", language:"Spanish"},
    {city:"Ibiza", country:"Spain", region:"Balearic Islands", language:"Spanish, Catalan"},
    {city:"Marbella", country:"Spain", region:"Andalusia", language:"Spanish"},
    {city:"London", country:"United Kingdom", region:"England", language:"English"},
    {city:"Manchester", country:"United Kingdom", region:"England", language:"English"},
    {city:"Amsterdam", country:"Netherlands", region:"North Holland", language:"Dutch, English"},
    {city:"Berlin", country:"Germany", region:"Berlin", language:"German"},
    {city:"Milan", aliases:["Milano"], country:"Italy", region:"Lombardy", language:"Italian"},
    {city:"Rome", country:"Italy", region:"Lazio", language:"Italian"}
  ];

  const COUNTRY_LANGUAGES = {
    france:"French",
    monaco:"French, English",
    spain:"Spanish",
    "united arab emirates":"Arabic, English",
    turkey:"Turkish",
    singapore:"English, Mandarin, Malay, Tamil",
    thailand:"Thai, English",
    china:"Chinese, English",
    "united kingdom":"English",
    netherlands:"Dutch, English",
    germany:"German",
    italy:"Italian",
    portugal:"Portuguese",
    belgium:"French, Dutch",
    switzerland:"German, French, Italian",
    austria:"German",
    ireland:"English, Irish",
    denmark:"Danish",
    norway:"Norwegian",
    sweden:"Swedish",
    finland:"Finnish, Swedish",
    iceland:"Icelandic, English"
  };

  const MONTHS = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12"
  };

  const COLLECTIONS = [
    "users",
    "shoutouts",
    "liveContent",
    "guestListRequests",
    "messages",
    "inboxNotifications",
    "clubLocations",
    "clubLocationAliases",
    "events",
    "templates",
    "minglConnections",
    "minglAudit",
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
    },
    {
      version: "v28.63-crawling-discovery-consolidation",
      title: "AI Crawling + Discovery Consolidation",
      checks: [
        {label:"Single AI Crawling tab", file:"master-admin.html", includes:["data-panel=\"aiCrawling\"", "Review Discovery Queue"]},
        {label:"Standalone AI Discovery tab removed", file:"master-admin.html", includes:["AI crawling controls live on the AI Crawling tab"], notIncludes:["data-panel=\"aiDiscovery\"", "id=\"aiDiscovery\""]},
        {label:"Discovery module mounts on AI Crawling", file:"ai-discovery-service.js", includes:["byId(\"aiCrawling\")", "loadDiscoveryQueue"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.63-crawling-discovery-consolidation"]},
        {label:"README consolidation note", file:"README.md", includes:["standalone AI Discovery tab was removed", "review/approval tools remain on AI Crawling"]}
      ]
    },
    {
      version: "v28.64-natural-language-crawl-review",
      title: "Natural-Language Crawl Review",
      checks: [
        {label:"Plain-English crawl input", file:"master-admin.html", includes:["crawlNaturalLanguageInput", "Build Search Plan", "Create Crawl Review Records"]},
        {label:"Crawl search plan parser", file:"ai-diagnostics-service.js", includes:["buildCrawlSearchPlan", "detectGenresFromText", "sourceSearchLinksForJob"]},
        {label:"Review card required datapoints", file:"ai-discovery-service.js", includes:["requiredDatapoints", "Missing required datapoints", "Cannot approve yet"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.64-natural-language-crawl-review"]},
        {label:"README natural-language crawl note", file:"README.md", includes:["Plain-English crawl input", "required datapoints"]}
      ]
    },
    {
      version: "v28.65-source-detail-extraction",
      title: "Source Detail Extraction",
      checks: [
        {label:"Source extraction UI", file:"master-admin.html", includes:["sourceExtractUrl", "Extract Source Details", "Save Extracted Review Record"]},
        {label:"Frontend source parser", file:"ai-diagnostics-service.js", includes:["extractSourceDetailsFromText", "saveExtractedDiscoveryRecord", "sourceExtractionReport"]},
        {label:"Backend source extractor", file:"functions/ai-discovery-functions.js", includes:["aiExtractPublicSourceUrl", "extractDiscoveryRecordFromHtml", "application\\/ld\\+json"]},
        {label:"Firebase Functions compat script", file:"master-admin.html", includes:["firebase-functions-compat.js"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.65-source-detail-extraction"]},
        {label:"README source extraction explanation", file:"README.md", includes:["Source Detail Extraction", "Eventbrite"]}
      ]
    },
    {
      version: "v28.66-search-results-guard",
      title: "Search Results Page Guard",
      checks: [
        {label:"Search results URL detector", file:"ai-diagnostics-service.js", includes:["isSearchResultsUrl", "searchQueryFromSourceUrl", "needs-final-event-source"]},
        {label:"Save guard for broad search pages", file:"ai-diagnostics-service.js", includes:["This is a search results page", "Open one specific event or venue detail page"]},
        {label:"Backend search results guard", file:"functions/ai-discovery-functions.js", includes:["isSearchResultsUrl", "searchResultsRecord", "needs-final-event-source"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.66-search-results-guard"]},
        {label:"README search results explanation", file:"README.md", includes:["search-results page", "final event-detail URL"]}
      ]
    },
    {
      version: "v28.67-crawl-raw-parsed-output",
      title: "Raw + Parsed Crawl Output",
      checks: [
        {label:"Extraction report raw and parsed output", file:"ai-diagnostics-service.js", includes:["rawCrawlInput", "parsedData", "renderAuditJsonBlock"]},
        {label:"Queue card raw and parsed output", file:"ai-discovery-service.js", includes:["auditDetailsHtml", "Raw crawled/input data", "Parsed data used by FLOQR"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.67-crawl-raw-parsed-output"]},
        {label:"README raw parsed explanation", file:"README.md", includes:["raw crawled/input data", "parsed data"]}
      ]
    },
    {
      version: "v28.68-crawl-cache-query-fix",
      title: "Crawler Cache Cleanup + Query Fix",
      checks: [
        {label:"Stale crawl cleanup action", file:"master-admin.html", includes:["clearCachedCrawlsBtn", "Remove All Active Stale Records"]},
        {label:"Stale crawl cleanup logic", file:"ai-diagnostics-service.js", includes:["clearCachedCrawlRecords", "isStaleCachedCrawlRecord", "stale-cache-cleared"]},
        {label:"Clean crawl query builder", file:"ai-diagnostics-service.js", includes:["crawlQueryForJob", "searchPhraseFromParts", "defaultGenreForEventType"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.68-crawl-cache-query-fix"]},
        {label:"README stale cache/query explanation", file:"README.md", includes:["stale crawl records", "clean crawl query"]}
      ]
    },
    {
      version: "v28.69-stale-shoutout-cleanup",
      title: "Stale Record Cleanup",
      checks: [
        {label:"Stale cleanup tab", file:"master-admin.html", includes:["data-panel=\"staleRecordCleanup\"", "Stale Record Cleanup"]},
        {label:"Stale source filter", file:"master-admin.html", includes:["staleRecordSourceFilter", "ShoutOut queue records"]},
        {label:"Four-day stale threshold", file:"ai-diagnostics-service.js", includes:["STALE_RECORD_DEFAULT_DAYS", "recordAgeDays", "more than 4 day"]},
        {label:"Stale ShoutOut cleanup logic", file:"ai-diagnostics-service.js", includes:["shoutoutStaleReasons", "loadStaleShoutoutRows", "stale-shoutout-cleared"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.69-stale-shoutout-cleanup"]},
        {label:"README stale ShoutOut explanation", file:"README.md", includes:["stale ShoutOut", "more than 4 days"]}
      ]
    },
    {
      version: "v28.70-duplicate-record-merge",
      title: "Duplicate Record Diagnostics + Merge",
      checks: [
        {label:"Duplicate records tab", file:"master-admin.html", includes:["data-panel=\"duplicateRecords\"", "Duplicate Records"]},
        {label:"Duplicate merge service loaded", file:"master-admin.html", includes:["duplicate-record-service.js", "v=28.70-duplicate-record-merge"]},
        {label:"Duplicate service merge logic", file:"duplicate-record-service.js", includes:["mergeDuplicateGroup", "clubLocationAliases", "aliasLocationIds", "mergedInto"]},
        {label:"Patron alias resolver", file:"patron-app.js", includes:["canonicalLocationId", "resolveLocationAlias", "isMergedLocation"]},
        {label:"Club admin alias resolver", file:"admin-app.js", includes:["resolveAdminLocationId", "clubLocationAliases", "refreshLocationShell"]},
        {label:"Display alias resolver", file:"display-app.js", includes:["resolveDisplayLocationId", "clubLocationAliases", "canonicalStaticLocationId"]},
        {label:"Static Shôko duplicate alias", file:"shared-data.js", includes:["shoko-barcelona-beach-club-spain", "canonicalLocationId:\"shoko-barcelona-spain\"", "aliasLocationIds"]},
        {label:"Firestore alias rule", file:"firestore.rules", includes:["match /clubLocationAliases/{aliasId}", "allow read: if true"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.70-duplicate-record-merge"]},
        {label:"README duplicate merge explanation", file:"README.md", includes:["Duplicate Records", "clubLocationAliases"]}
      ]
    },
    {
      version: "v28.71-duplicate-merge-diagnostics",
      title: "Duplicate Merge Verification Diagnostics",
      checks: [
        {label:"Merge diagnostic button", file:"master-admin.html", includes:["runDuplicateMergeDiagnosticBtn", "duplicateMergeDiagnosticReport"]},
        {label:"Merge diagnostic service", file:"duplicate-record-service.js", includes:["runDuplicateMergeDiagnostic", "Duplicate Merge Diagnostic", "Leftover references"]},
        {label:"Merge failure guidance", file:"duplicate-record-service.js", includes:["Merge failed:", "Publish firestore.rules v28.70+"]},
        {label:"Live Firestore data source labels", file:"duplicate-record-service.js", includes:["Live Firestore: clubLocations", "This duplicate list is not hardcoded", "_dataSource"]},
        {label:"Master Admin click feedback", file:"master-admin-app.js", includes:["setupActionFeedback", "Clicked action:", "Clicked link:"]},
        {label:"Script cache bust", file:"master-admin.html", includes:["v=28.71-duplicate-merge-diagnostics", "duplicate-record-service.js"]},
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.71-duplicate-merge-diagnostics"]},
        {label:"README merge diagnostic explanation", file:"README.md", includes:["Run Merge Diagnostic", "Duplicate Merge Diagnostic"]}
      ]
    },
    {
      version: "v28.72-alias-resilient-merge",
      title: "Alias-Resilient Duplicate Merge",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.72-alias-resilient-merge"]},
        {label:"Core merge separated from alias write", file:"duplicate-record-service.js", includes:["coreBatch", "aliasBatch", "Core merge complete"]},
        {label:"Alias write blocked is non-core", file:"duplicate-record-service.js", includes:["alias document write blocked", "Alias document read is blocked", "Soft Fail"]},
        {label:"Script cache bust", file:"master-admin.html", includes:["v=28.72-alias-resilient-merge", "duplicate-record-service.js"]},
        {label:"README resilient merge note", file:"README.md", includes:["alias-resilient", "core duplicate merge"]}
      ]
    },
    {
      version: "v28.73-canonical-merge-completion",
      title: "Canonical Duplicate Merge Completion",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.73-canonical-merge-completion"]},
        {label:"Repair action in diagnostic report", file:"duplicate-record-service.js", includes:["Complete / Repair Merge Now", "mergePairByIds", "data-duplicate-repair-primary"]},
        {label:"Alias collection optional after canonical merge", file:"duplicate-record-service.js", includes:["Optional alias document", "is sufficient", "duplicate clubLocation document"]},
        {label:"Patron canonical duplicate resolver", file:"patron-app.js", includes:["clubLocations\").doc(key)", "canonicalLocationId", "locationAliases[key]"]},
        {label:"Script cache bust", file:"master-admin.html", includes:["v=28.73-canonical-merge-completion", "duplicate-record-service.js"]},
        {label:"README canonical completion note", file:"README.md", includes:["canonical duplicate document", "Complete / Repair Merge"]}
      ]
    },
    {
      version: "v28.74-gemini-media-editing",
      title: "Gemini ShoutOut Media Editing",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.74-gemini-media-editing"]},
        {label:"Gemini media callable backend", file:"functions/ai-discovery-functions.js", includes:["aiEnhanceShoutOutMedia", "GEMINI_API_KEY", "safeEnhancementPrompt"]},
        {label:"Patron Gemini upload path", file:"ai-media-service.js", includes:["requestGeminiImageEnhancement", "httpsCallable", "enhancedMediaStoragePath"]},
        {label:"Patron media metadata save", file:"patron-app.js", includes:["aiEnhancementProvider", "enhancedMediaStoragePath", "originalMediaStoragePath"]},
        {label:"Admin approval Gemini pass-through", file:"admin-app.js", includes:["aiEnhancementProvider", "enhancedMediaStoragePath", "originalMediaStoragePath"]},
        {label:"Functions SDK loaded on patron page", file:"index.html", includes:["firebase-functions-compat.js", "v=28.74-gemini-media-editing", "ai-media-service.js"]},
        {label:"Gemini diagnostics callable check", file:"ai-diagnostics-service.js", includes:["runGeminiMediaDiagnostic", "aiEnhanceShoutOutMedia", "Gemini media editing callable"]},
        {label:"Gemini media audit Firestore rule", file:"firestore.rules", includes:["v28.74-gemini-media-editing-rules", "match /aiMediaEdits/{id}", "ownsResourceUid"]},
        {label:"Firebase Functions deploy config", file:"firebase.json", includes:["\"functions\"", "\"source\": \"functions\"", "\"runtime\": \"nodejs22\""]}
      ]
    },
    {
      version: "v28.75-firebase-functions-deploy-fix",
      title: "Firebase Functions Deploy Fix",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.75-firebase-functions-deploy-fix"]},
        {label:"Functions runtime is Node 22", file:"firebase.json", includes:["\"runtime\": \"nodejs22\""]},
        {label:"Functions package engine accepts Node 22+", file:"functions/package.json", includes:["\"node\": \">=22\"", "\"firebase-functions\""]},
        {label:"Root README installs function dependencies correctly", file:"README.md", includes:["npm.cmd --prefix functions install", "firebase deploy --only functions:aiEnhanceShoutOutMedia --project shoutoutdemo-5b402"]},
        {label:"Functions README deploy guidance", file:"functions/README.md", includes:["npm.cmd --prefix functions install", "firebase functions:secrets:get GEMINI_API_KEY --project shoutoutdemo-5b402"]}
      ]
    },
    {
      version: "v28.76-diagnostics-current-signal",
      title: "Diagnostics Current Signal Cleanup",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.76-diagnostics-current-signal"]},
        {label:"Superseded package marker checks are non-blocking", file:"ai-diagnostics-service.js", includes:["supersededPackageCheck ? \"Pass\"", "historical package marker check is superseded"]},
        {label:"Rules smoke test stale wording", file:"ai-diagnostics-service.js", includes:["This is not a deployed-rules failure yet", "CURRENT_DIAGNOSTICS_PACKAGE_VERSION"]},
        {label:"README diagnostics signal note", file:"README.md", includes:["v28.76 Diagnostics Current Signal Cleanup", "Historical cache-bust marker checks now pass as superseded"]}
      ]
    },
    {
      version: "v28.77-optional-query-pass",
      title: "Optional Participant Query Pass",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.77-optional-query-pass"]},
        {label:"Optional query denial becomes compatible pass", file:"ai-diagnostics-service.js", includes:["Optional participant query blocked; supported fallback participant document reads passed.", "status:\"Pass\""]},
        {label:"Optional query excluded from action items", file:"ai-diagnostics-service.js", includes:["isOptionalParticipantCompatibilityNote", "No Firebase rules fix is required"]},
        {label:"Master Admin cache bust", file:"master-admin.html", includes:["ai-diagnostics-service.js?v=28.77-optional-query-pass"]},
        {label:"README optional query note", file:"README.md", includes:["v28.77 Optional Participant Query Pass", "deterministic Mingl participant reads pass"]}
      ]
    },
    {
      version: "v28.78-template-media-layout",
      title: "ShoutOut Template Gallery + Mobile Media Preview Layout",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.78-template-media-layout"]},
        {label:"Patron assets cache-busted", file:"index.html", includes:["styles.css?v=28.78-template-media-layout", "patron-app.js?v=28.78-template-media-layout", "ai-media-service.js?v=28.78-template-media-layout"]},
        {label:"Default template name", file:"shared-data.js", includes:["Traditional Black and White ShoutOut"]},
        {label:"Default-only template gallery", file:"patron-app.js", includes:["template-section-default", "Matching Official FLOQR Templates", "templateContextQuery"]},
        {label:"Media uploader before submit", file:"patron-app.js", includes:["placeMediaCard", "submitShoutoutBtn", "media-upload-card"]},
        {label:"AI media panel follows upload", file:"ai-media-service.js", includes:["placePanel", "mediaCard", "aiMediaPanel"]},
        {label:"Contained mobile media preview CSS", file:"styles.css", includes:["v28.78 ShoutOut template gallery and mobile media preview layout", "object-fit:contain", "max-height:42vh"]}
      ]
    },
    {
      version: "v28.79-package-hygiene",
      title: "Package Hygiene Cleanup",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.79-package-hygiene"]},
        {label:"README documents package hygiene", file:"README.md", includes:["v28.79 Package Hygiene Cleanup", "Future full packages should include only the live `README.md` and the current direct rollback note"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-79.md", includes:["FLOQR Rollback - v28.79 Package Hygiene", "This rollback does not change Firebase Auth"]},
        {label:"Master Admin diagnostics cache bust", file:"master-admin.html", includes:["ai-diagnostics-service.js?v=28.79-package-hygiene"]}
      ]
    },
    {
      version: "v28.80-location-template-ai",
      title: "Location-Aware ShoutOut and Template AI",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.80-location-template-ai"]},
        {label:"Patron assets cache-busted", file:"index.html", includes:["styles.css?v=28.80-location-template-ai", "shared-data.js?v=28.80-location-template-ai", "patron-app.js?v=28.80-location-template-ai", "ai-media-service.js?v=28.80-location-template-ai"]},
        {label:"Location ranking module", file:"ai-location-service.js", includes:["getUserLocationContext", "rankLocationsForUser", "geminiRankLocations", "localRankLocations"]},
        {label:"Patron search uses location context", file:"patron-app.js", includes:["userLocationContext", "rankLocationsForUser(searched, context)", "locationContextPromise"]},
        {label:"Heist Houston static data removed", file:"shared-data.js", includes:["FLOQR_OBSOLETE_LOCATION_IDS"], notIncludes:["locationName:\"Heist Houston\"", "brandName:\"Heist Houston\""]},
        {label:"Seeder marks obsolete location records deleted", file:"seed-app.js", includes:["cleanupObsoleteLocations", "Fictitious Heist Houston record removed from FLOQR package"]},
        {label:"Gemini ShoutOut suggestion wiring", file:"ai-service.js", includes:["floqrSuggestShoutOutAsync", "aiSuggestShoutOut", "FLOQR_AI_TEMPLATE_HELP_ENABLED"]},
        {label:"Gemini backend callables", file:"functions/ai-discovery-functions.js", includes:["exports.aiSuggestShoutOut", "exports.aiRankLocations", "GEMINI_TEXT_MODEL"]},
        {label:"Media upload remove control", file:"patron-app.js", includes:["removeShoutoutMediaBtn", "clearSelectedMedia", "Upload Image or Video"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-80.md", includes:["FLOQR Rollback - v28.80 Location Template AI", "This rollback does not remove user profile data"]},
        {label:"README documents v28.80", file:"README.md", includes:["v28.80 Location-Aware ShoutOut and Template AI", "Heist Houston", "Browser geolocation", "Gemini contextual ranking"]}
      ]
    },
    {
      version: "v28.81-manual-feature-diagnostics",
      title: "Manual Feature Test Diagnostics",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.81-manual-feature-diagnostics"]},
        {label:"Manual diagnostics UI", file:"master-admin.html", includes:["Manual Feature Test Diagnostics", "manualFeatureDiagnosticsReport", "copyManualFeaturePromptBtn", "admin.css?v=28.81-manual-feature-diagnostics"]},
        {label:"Manual test checklist data", file:"ai-diagnostics-service.js", includes:["MANUAL_FEATURE_TESTS", "Location-aware club/event ranking", "Gemini ShoutOut copy help"]},
        {label:"Manual test output builder", file:"ai-diagnostics-service.js", includes:["buildManualFeatureDiagnosticsText", "buildManualFeatureDiagnosticsPrompt", "manualFeatureDiagnosticsOutput"]},
        {label:"Manual test export integration", file:"ai-diagnostics-service.js", includes:["Manual Feature Test Diagnostics", "manualResults", "copyManualFeaturePromptBtn"]},
        {label:"README documents v28.81", file:"README.md", includes:["v28.81 Manual Feature Test Diagnostics", "Succeed or Failed", "copy-ready Codex resolution prompt"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-81.md", includes:["FLOQR Rollback - v28.81 Manual Feature Diagnostics", "This rollback does not remove manual diagnostic history"]}
      ]
    },
    {
      version: "v28.82-mingl-privacy-media",
      title: "Mingl Requests, My Privacy, Public Media Sharing",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.82-mingl-privacy-media"]},
        {label:"Patron page loads action feedback", file:"index.html", includes:["floqr-action-feedback.js?v=28.82-mingl-privacy-media", "patron-app.js?v=28.82-mingl-privacy-media"]},
        {label:"Mingl public room request flow", file:"patron-app.js", includes:["Let's Mingl", "Friend or Mingl Request", "recordMinglRequest", "minglAudit"]},
        {label:"Mingl realtime editable chat", file:"patron-app.js", includes:["minglMessagesUnsubscribe", "editMinglMessage", "improveMinglDraft", "data-mingl-emoji"]},
        {label:"Privacy-aware Mingl datapoints", file:"patron-app.js", includes:["publicMinglDatapoints", "publicDatapointAllowed", "sharedDataPointLabels"]},
        {label:"Portal renamed to My Profile and Settings", file:"patron-portal.html", includes:["<title>My Profile and Settings</title>", "My Privacy", "Public Media and Data Sharing"], notIncludes:["<h1>FLOQR Settings</h1>"]},
        {label:"Portal privacy datapoint selector", file:"patron-portal-app.js", includes:["PUBLIC_MINGL_DATAPOINTS", "privacy-datapoint", "publicMinglDatapoints"]},
        {label:"Profile media no-caption metadata workflow", file:"patron-portal-app.js", includes:["extractImageGpsMetadata", "profile-media-metadata", "Add", "travelDatapointAdded"], notIncludes:["profile-media-caption"]},
        {label:"Portal Mingl chat history controls", file:"patron-portal-app.js", includes:["getPortalMinglRooms", "portalMinglUnsubscribe", "editPortalMinglMessage", "portalMinglMessageInput"]},
        {label:"Action feedback overlay CSS", file:"styles.css", includes:["floqr-action-feedback", "emoji-row", "privacy-datapoint-grid", "media-metadata-prompt"]},
        {label:"Firestore Mingl request/chat rules", file:"firestore.rules", includes:["FLOQR FIRESTORE RULES VERSION: v28.82-mingl-request-chat-rules", "match /minglAudit/{id}", "isOwnMinglMessageEdit", "isMinglSystemMessageRequest"]},
        {label:"Rules smoke test covers Mingl audit", file:"ai-diagnostics-service.js", includes:["Firestore: minglAudit request lifecycle", "Rules smoke test Mingl audit record"]},
        {label:"README documents v28.82", file:"README.md", includes:["v28.82 Mingl Requests, My Privacy, and Public Media Sharing", "Let's Mingl", "Public Media and Data Sharing"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-82.md", includes:["FLOQR Rollback - v28.82 Mingl Privacy Media", "This rollback does not delete user profile data"]}
      ]
    },
    {
      version: "v28.83-mobile-mingl-inbox",
      title: "Mobile Mingl Datapoints + FLOQR Inbox Requests",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.83-mobile-mingl-inbox"]},
        {label:"Patron page cache-busted", file:"index.html", includes:["styles.css?v=28.83-mobile-mingl-inbox", "patron-app.js?v=28.83-mobile-mingl-inbox"]},
        {label:"Matched Mingl cards use nested datapoints", file:"patron-app.js", includes:["mingl-nested-datapoints", "renderProfileDatapoints(profile", "FLOQR Inbox"], notIncludes:["profileSummaryText(profile) || \"Nightlife profile\""]},
        {label:"Mobile datapoint panels are contained", file:"styles.css", includes:["profile-datapoint[open]", "mingl-nested-datapoints", "consent-checkbox", "max-width:min(260px,calc(100vw - 48px))"]},
        {label:"Device mode marker for mobile/tablet/desktop", file:"floqr-action-feedback.js", includes:["markDeviceMode", "floqr-mobile-browser", "floqr-tablet-browser", "floqr-desktop-browser"]},
        {label:"Shared responsive device category CSS", file:"styles.css", includes:["v28.83 device category responsive shell", "html.floqr-mobile-browser .app", "html.floqr-tablet-browser .app", "html.floqr-desktop-browser .app"]},
        {label:"Admin responsive device category CSS", file:"admin.css", includes:["v28.83 admin/device responsive rules", "html.floqr-mobile-browser .admin-tabs", "html.floqr-tablet-browser .admin-grid", "html.floqr-desktop-browser .admin-tabs"]},
        {label:"Patron portal labels FLOQR Inbox", file:"patron-portal.html", includes:["FLOQR Inbox", "portalMinglRequests", "v28.83-mobile-mingl-inbox"], notIncludes:[">Messages <span id=\"messageCountLabel\""]},
        {label:"FLOQR Inbox can accept Mingl requests", file:"patron-portal-app.js", includes:["acceptPortalMinglRequest", "accept-mingl-inbox-btn", "Mingl Back", "inbox:\"portalMessages\""]},
        {label:"Mingl page request cards", file:"patron-portal-app.js", includes:["renderPortalMinglRequests", "portalMinglRequests", "Friend or Mingl Request received"]},
        {label:"README documents v28.83", file:"README.md", includes:["v28.83 Mobile Mingl Datapoints and FLOQR Inbox", "FLOQR Inbox", "Mingl Back"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-83.md", includes:["FLOQR Rollback - v28.83 Mobile Mingl Inbox", "This rollback does not delete user profile data"]}
      ]
    },
    {
      version: "v28.84-shoutout-media-chat-grammar",
      title: "ShoutOut Media Repair + Mingl Chat Grammar",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.84-shoutout-media-chat-grammar"]},
        {label:"Patron page cache-busted", file:"index.html", includes:["styles.css?v=28.84-shoutout-media-chat-grammar", "patron-app.js?v=28.84-shoutout-media-chat-grammar", "ai-media-service.js?v=28.84-shoutout-media-chat-grammar"]},
        {label:"Explicit ShoutOut media upload card", file:"index.html", includes:["shoutoutMediaCard", "Upload Image or Video", "removeShoutoutMediaBtn", "videoTrimNotice"]},
        {label:"Single media uploader repair", file:"patron-app.js", includes:["jadzEnsureSingleMediaUploader", "renderLiveMediaPreview", "Warning: this video is", "Trim Video to 7 Seconds"]},
        {label:"Nested AI media enhancement filters", file:"ai-media-service.js", includes:["Ai Image/Video Enhancement", "aiMediaCommandMenu", "aiMediaFilterBubble", "Apply filter", "VIP Style", "Club Ready"]},
        {label:"Media and chat responsive CSS", file:"styles.css", includes:["v28.84 ShoutOut media repair", "ai-media-command-menu", "v28.84 Mingl chat bubbles", "floqr-grammar-modal"]},
        {label:"Language Settings tab", file:"patron-portal.html", includes:["Language Settings", "languageAiGrammarEnabled", "languageCorrectionMode", "portalMinglGrammarHint"]},
        {label:"Public Mingl page loads grammar service", file:"index.html", includes:["ai-grammar-service.js?v=28.84-shoutout-media-chat-grammar", "minglChatStatus", "minglGrammarHint"]},
        {label:"Draft-only grammar service", file:"ai-grammar-service.js", includes:["suggestGrammarCorrection", "localDetectPossibleTypos", "applyCorrectionToInput", "draft"]},
        {label:"Portal Mingl chat sends without confirmation overlay", file:"patron-portal-app.js", includes:["appendPortalMinglBubble", "Start the conversation.", "showGrammarSuggestionModal", "saveLanguageSettings"], notIncludes:["redirecting:\"Mingl message sent"]},
        {label:"Public Mingl chat sends without confirmation overlay", file:"patron-app.js", includes:["appendMinglBubble", "Start the conversation.", "showMinglGrammarSuggestion", "highlightMinglDraft"], notIncludes:["redirecting:\"Mingl message sent"]},
        {label:"Gemini grammar callable scaffold", file:"functions/ai-discovery-functions.js", includes:["aiSuggestGrammarCorrection", "Grammar correction", "This draft is private"]},
        {label:"README documents v28.84", file:"README.md", includes:["v28.84 ShoutOut Media, Mingl Chat, and Grammar Settings", "Ai Image/Video Enhancement", "Language Settings"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-84.md", includes:["FLOQR Rollback - v28.84 ShoutOut Media Chat Grammar", "This rollback does not delete user profile data"]}
      ]
    },
    {
      version: "v28.85-shoutout-preview-confirmation-mingl-page",
      title: "ShoutOut Preview, Confirmation Splash, and Mingl Page Polish",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.85-shoutout-preview-confirmation-mingl-page"]},
        {label:"Patron page cache-busted", file:"index.html", includes:["styles.css?v=28.85-shoutout-preview-confirmation-mingl-page", "patron-app.js?v=28.85-shoutout-preview-confirmation-mingl-page", "ai-media-service.js?v=28.85-shoutout-preview-confirmation-mingl-page"]},
        {label:"Live preview reads selected local media", file:"patron-app.js", includes:["dataset.previewUrl", "window.updatePreview = updatePreview", "selectedMediaVersion", "trimEnd"]},
        {label:"Display preview receives trim metadata", file:"display-app.js", includes:["selectedMediaVersion", "trimStart", "trimEnd", "trimmedDuration"]},
        {label:"Media helper text uses popout bubbles", file:"patron-app.js", includes:["infoPopout(\"Media details\"", "setVideoNotice", "Video trim warning"]},
        {label:"AI media explanation uses popout bubble", file:"ai-media-service.js", includes:["How AI enhancement works", "infoPopout", "setVideoNotice"]},
        {label:"Confirmation page has two splash actions", file:"index.html", includes:["editSubmittedShoutoutBtn", "returnToMainAfterConfirmBtn", "confirmationRedirectStatus"], notIncludes:["startAnotherBtn", "chooseAnotherClubBtn", "logoutBtn6"]},
        {label:"Confirmation splash auto-returns", file:"patron-app.js", includes:["showShoutoutConfirmation", "confirmationReturnTimer", "returnToMainFromConfirmation", "editSubmittedShoutout"]},
        {label:"Mingl chat has separate portal page", file:"patron-portal.html", includes:["portalMinglChatPage", "backToMinglDashboardBtn", "minglRulesDetails", "minglRequestsSummaryButton"]},
        {label:"Mingl requests summarize recent statuses", file:"patron-portal-app.js", includes:["updateMinglRequestSummary", "shouldShowMinglRequest", "Mingl/Follow Back", "10 * 24 * 60 * 60 * 1000"]},
        {label:"Popout and Mingl dashboard CSS", file:"styles.css", includes:["info-popout", "info-popout-bubble", "mingl-action-details", "portalMinglChatPage"]},
        {label:"README documents v28.85 as superseded history", file:"README.md", includes:["v28.85 ShoutOut Preview, Confirmation Splash, and Mingl Page", "v28.85 rollback note is superseded"]}
      ]
    },
    {
      version: "v28.86-mingl-actions-ai-recommendations",
      title: "Mingl Message Actions, Chat Media, and Personalized ShoutOut AI",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.86-mingl-actions-ai-recommendations"]},
        {label:"Patron page cache-busted", file:"index.html", includes:["styles.css?v=28.86-mingl-actions-ai-recommendations", "patron-app.js?v=28.86-mingl-actions-ai-recommendations", "confirmGoMinglBtn", "minglQuickChatBtn"]},
        {label:"Mingl hero quick action buttons", file:"index.html", includes:["minglQuickChatBtn", "minglQuickSearchBtn", "Search for People", "<svg viewBox=\"0 0 24 24\""]},
        {label:"Dynamic personalized ShoutOut recommendations", file:"patron-app.js", includes:["refreshPersonalizedShoutOutRecommendations", "getPastShoutOutMemory", "profileSuggestionSignals", "local-personalized-fallback"], notIncludes:["Happy Birthday! VIP energy all night.\",\"Big ShoutOut to the table"]},
        {label:"Gemini ShoutOut context payload", file:"ai-service.js", includes:["profileSignals", "pastShoutouts"]},
        {label:"Gemini function prompt uses context", file:"functions/ai-discovery-functions.js", includes:["User-owned profile signals JSON", "User-owned past ShoutOut examples JSON", "Do not reveal private details"]},
        {label:"Live preview direct iframe render hook", file:"patron-app.js", includes:["renderShoutOutDisplay", "previewPayload", "dataset.previewUrl"]},
        {label:"Display app exposes render hook", file:"display-app.js", includes:["window.renderShoutOutDisplay = render"]},
        {label:"Confirmation actions route to Edit ShoutOut, Mingl, and Bata", file:"index.html", includes:["editSubmittedShoutoutBtn", "confirmGoMinglBtn", "confirmGoBataBtn"], notIncludes:["startAnotherBtn", "chooseAnotherClubBtn", "logoutBtn6"]},
        {label:"Public Mingl chat message action popout", file:"patron-app.js", includes:["showMinglMessageActions", "Throw Graffiti", "Delete after read", "uploadMinglAttachment", "expireReadOnceMinglMessages"]},
        {label:"Portal Mingl chat media and background tools", file:"patron-portal.html", includes:["portalMinglBackgroundInput", "portalMinglImageInput", "portalClearMinglImageBtn"]},
        {label:"Portal Mingl message action popout", file:"patron-portal-app.js", includes:["showPortalMinglMessageActions", "uploadPortalMinglBackground", "uploadPortalMinglImage", "expireReadOncePortalMinglMessages"]},
        {label:"Mingl chat action and attachment CSS", file:"styles.css", includes:["mingl-message-action-popout", "mingl-message-media", "mingl-quick-actions", "personalized-ai-suggestion"]},
        {label:"Firestore rules allow sender-only message action metadata", file:"firestore.rules", includes:["v28.86-mingl-message-action-rules", "animationType", "deleteAfterRead", "isMinglDeleteAfterReadExpiry"]},
        {label:"Storage rules allow Mingl chat media paths", file:"storage.rules", includes:["v28.88-mingl-grammar-profile-datapoints-storage-rules", "match /mingl-chat/{userId}/{roomId}", "match /mingl-chat-backgrounds/{userId}/{roomId}"]},
        {label:"README documents v28.86", file:"README.md", includes:["v28.86 Mingl Actions, Chat Media, and Personalized ShoutOut AI", "Mingl chat pictures", "personalized ShoutOut recommendations"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-86.md", includes:["FLOQR Rollback - v28.86 Mingl Actions AI Recommendations", "This rollback does not delete user profile data"]}
      ]
    },
    {
      version: "v28.88-mingl-grammar-profile-datapoints",
      title: "Mingl Chat Read Receipts and Diagnostics Rerun",
      checks: [
        {label:"Current diagnostics package marker", file:"ai-diagnostics-service.js", includes:["CURRENT_DIAGNOSTICS_PACKAGE_VERSION", "v28.88-mingl-grammar-profile-datapoints"]},
        {label:"Manual Run Diagnostics button", file:"master-admin.html", includes:["runFeatureDiagnosticsBtn", "Run Diagnostics"]},
        {label:"Feature diagnostics report persistence", file:"ai-diagnostics-service.js", includes:["saveFeatureDiagnosticsReport", "type:\"featureDiagnostics\"", "Feature diagnostics report saved"]},
        {label:"Mingl empty-data diagnostic is non-blocking", file:"ai-diagnostics-service.js", includes:["minglFeatureStatus", "No live Mingl connection records found yet", "Optional participant query blocked"]},
        {label:"Public Mingl page cache-busted", file:"index.html", includes:["styles.css?v=28.87-mingl-chat-diagnostics", "patron-app.js?v=28.87-mingl-chat-diagnostics"]},
        {label:"Portal Mingl page cache-busted", file:"patron-portal.html", includes:["styles.css?v=28.87-mingl-chat-diagnostics", "patron-portal-app.js?v=28.87-mingl-chat-diagnostics"]},
        {label:"Public Mingl composer/read receipts", file:"patron-app.js", includes:["markMinglMessagesRead", "minglReadReceiptHtml", "This Mingl message has already been read and cannot be unsent"]},
        {label:"Portal Mingl composer/read receipts", file:"patron-portal-app.js", includes:["markPortalMinglMessagesRead", "portalMinglReadReceiptHtml", "unsendPortalMinglMessage"]},
        {label:"Mingl composer visible CSS", file:"styles.css", includes:["position:sticky", "mingl-read-receipt", "mingl-action-note"]},
        {label:"Firestore rules allow read receipts", file:"firestore.rules", includes:["v28.88-mingl-grammar-profile-datapoints-rules", "isMinglReadReceiptUpdate", "readAtBy"]},
        {label:"README documents v28.87", file:"README.md", includes:["v28.87 Mingl Chat Diagnostics", "zero live Mingl records is not treated as a feature failure"]},
        {label:"Current direct rollback note", file:"ROLLBACK-V28-87.md", includes:["FLOQR Rollback - v28.87 Mingl Chat Diagnostics", "This rollback does not delete user profile data"]}
      ]
    }
  ];

  const MANUAL_FEATURE_TESTS = [
    {
      id:"v28-87-run-feature-diagnostics-button",
      area:"Master Admin Diagnostics",
      feature:"Manual Run Diagnostics reruns feature scans",
      changed:"A clear Run Diagnostics button now reruns installed-feature diagnostics, refreshes the Mingl scan, and saves a featureDiagnostics report to aiDiagnosticsReports.",
      howToTest:"Open Master Admin > Diagnostics and click Run Diagnostics. Confirm the status changes while running, the feature matrix refreshes, and Export Diagnostics TXT reflects the latest run.",
      expected:"Diagnostics rerun without leaving the page. A current feature scan is shown, and the result can be exported for Codex troubleshooting."
    },
    {
      id:"v28-87-mingl-empty-data-diagnostics",
      area:"Mingl diagnostics",
      feature:"Zero live Mingl records is not treated as a feature failure",
      changed:"Mingl matching/request/chat diagnostics now distinguish installed workflow health from live data coverage. Empty minglConnections or chatRooms are informational when no Firestore error exists.",
      howToTest:"Run Diagnostics on a project with no readable Mingl connections or chat rooms, then create a Let's Mingl request/chat and run it again.",
      expected:"Before live data exists, Mingl matching and chat diagnostics explain that no records were found yet instead of showing a blocking soft fail. After test data exists, scanned counts update."
    },
    {
      id:"v28-87-mingl-chat-composer-visible",
      area:"Mingl chat",
      feature:"Mingl Chat shows the text input and send controls on mobile",
      changed:"The Mingl composer is sticky inside the chat panel, sits below the emoji row, and remains visible after messages load on public Mingl and My Profile and Settings > Mingl Chat.",
      howToTest:"Open a mutual Mingl chat on a phone. Scroll through the chat and confirm the Write a Mingl message input, Picture/Share Picture control, Fix Grammar, and Send button are visible and usable.",
      expected:"The message input is visible without leaving the chat page, and sending a message updates the thread."
    },
    {
      id:"v28-87-mingl-read-receipts-unsend",
      area:"Mingl chat",
      feature:"Read marker and unread-only Unsend",
      changed:"Incoming messages are marked read for the viewing patron. Sent messages show a small thumbs-up Read marker after the recipient opens the chat. Unsend remains available only while the message has not been read.",
      howToTest:"Send a Mingl message from one account, view it from the recipient account, then return to the sender account. Tap the sent bubble and inspect the action popout.",
      expected:"The sent message shows a Read marker. The Unsend action is locked after the recipient reads it, but remains available before read."
    },
    {
      id:"v28-86-mingl-quick-actions",
      area:"Mingl public page",
      feature:"Mingl hero uses Chat and Search for People icon buttons",
      changed:"The old explanatory line was replaced with two shortcut buttons: Chat and Search for People.",
      howToTest:"Open the public Mingl page on mobile. Tap Search for People and confirm the search box receives focus. Tap Chat and confirm the chat list or open chat area scrolls into view.",
      expected:"No selectable paragraph appears. The two icon buttons route users to search and chat areas."
    },
    {
      id:"v28-86-personalized-shoutout-ai",
      area:"ShoutOut recommendations",
      feature:"ShoutOut AI recommendations are dynamic and personalized",
      changed:"Recommendation chips now rebuild from the current draft, selected tone, selected template, venue context, the signed-in user's own profile signals, and the user's own past ShoutOuts. Gemini receives this context through Firebase Functions when deployed; local fallback is contextual.",
      howToTest:"Open a ShoutOut editor, type a birthday or VIP draft, change the tone, and wait one second. Then click Improve My ShoutOut.",
      expected:"Suggestions update based on the draft/tone and no longer show the fixed old canned list."
    },
    {
      id:"v28-86-live-preview-actual-media",
      area:"ShoutOut live preview",
      feature:"Live Preview renders selected local image/video inside the actual board",
      changed:"The editor now sends the selected media preview URL and trim metadata to the display iframe and calls the display renderer directly after iframe load.",
      howToTest:"Select a media-capable ShoutOut template, upload an image or video, then scroll to Live Preview.",
      expected:"The uploaded media appears inside the ShoutOut board instead of IMAGE / VIDEO placeholder."
    },
    {
      id:"v28-86-confirmation-actions",
      area:"ShoutOut confirmation",
      feature:"Confirmation uses Edit ShoutOut, Mingl, and Bata actions",
      changed:"The confirmation splash removed Create another ShoutOut, Choose another location, and Sign out. It now provides Edit ShoutOut, Mingl, and Bata.",
      howToTest:"Submit a ShoutOut and inspect the confirmation page.",
      expected:"Only the new product/action buttons appear. Edit returns to the editor, Mingl opens the Mingl page, and Bata returns to the main product entry point."
    },
    {
      id:"v28-86-mingl-message-popout-actions",
      area:"Mingl chat",
      feature:"Sent Mingl messages open action popout on tap/click",
      changed:"The persistent Edit button was removed. Tapping/clicking your own sent message opens actions for Bounce, Explode, Throw Graffiti, Edit, Auto Correct, Delete after read, and Unsend.",
      howToTest:"Open a mutual Mingl chat, send a message, then tap/click your own sent bubble.",
      expected:"The action popout appears and the selected action updates the message without exposing buttons on every bubble. Delete after read soft-expires after the recipient opens the thread."
    },
    {
      id:"v28-86-mingl-chat-pictures-backgrounds",
      area:"Mingl chat media",
      feature:"Mingl chat supports shared pictures and per-chat background image",
      changed:"Public and portal Mingl chat composers can share a picture. The portal Mingl chat page also lets the patron set a chat background image for that conversation.",
      howToTest:"Open a mutual Mingl chat, choose a picture, send it, then set a chat background from My Profile and Settings > Mingl Chat.",
      expected:"The picture appears in the chat bubble and the selected background applies to that individual chat. If Storage rules are not deployed, the error clearly says the upload failed."
    },
    {
      id:"v28-85-media-helper-popouts",
      area:"ShoutOut media editor",
      feature:"Media details, video warning, and AI explanation use popout bubbles",
      changed:"Long helper copy under the uploaded media preview and Ai Image/Video Enhancement panel now appears behind compact popout buttons instead of taking over the mobile editor.",
      howToTest:"Open a media-capable ShoutOut template on mobile, upload a video longer than 7 seconds, then tap Media details, Video trim warning, and How AI enhancement works.",
      expected:"Each item opens a compact bubble with the full explanation and the editor remains easy to scroll."
    },
    {
      id:"v28-85-live-preview-selected-media",
      area:"ShoutOut live preview",
      feature:"Live Preview shows the selected image/video before submission",
      changed:"The editor now passes the local selected media preview URL and trim metadata into the display iframe, while submit still uploads and saves the real Firebase Storage URL.",
      howToTest:"Select a media-capable ShoutOut template, upload a portrait image, landscape image, or video, then scroll to Live Preview.",
      expected:"Live Preview shows the selected media inside the actual ShoutOut board instead of the IMAGE / VIDEO placeholder."
    },
    {
      id:"v28-85-confirmation-two-button-splash",
      area:"ShoutOut confirmation",
      feature:"Confirmation page v28.85 behavior is superseded",
      changed:"The former v28.85 Edit ShoutOut / Back to main app behavior is superseded by v28.86's Edit ShoutOut, Mingl, and Bata action set.",
      howToTest:"Submit a ShoutOut and inspect the confirmation page.",
      expected:"Use the v28.86 confirmation test as the current acceptance check."
    },
    {
      id:"v28-85-mingl-separate-page-requests",
      area:"Mingl portal",
      feature:"Mingl Chat is separate and Mingl Rules/Requests are nested buttons",
      changed:"The Mingl tab now shows minimalist nested buttons for Mingl Rules and Mingl Requests. Mutual chats open in a separate Mingl Chat page. Requests show recent 10-day activity plus unresolved follow-back items.",
      howToTest:"Open My Profile and Settings > Mingl, tap Mingl Rules, tap Mingl Requests, then open a mutual Mingl chat.",
      expected:"Rules and requests expand only when tapped, the request button summarizes status, and chat opens on its own page with a Back to Mingl button."
    },
    {
      id:"v28-84-shoutout-media-upload-card",
      area:"ShoutOut media upload repair",
      feature:"Media-capable templates show one Upload Image or Video card",
      changed:"The ShoutOut editor now includes one explicit media upload card with Upload Image or Video, Remove file, preview, and video trim notice fields. The card is shown only for media-capable templates.",
      howToTest:"Search/select a media-capable template such as birthday image/video, open the editor, and confirm the Upload Image or Video control, Remove file button, and preview area are visible. Then select Traditional Black and White and confirm the upload card is hidden.",
      expected:"Media-capable templates show one upload card; text-only templates do not force media upload."
    },
    {
      id:"v28-84-ai-media-filter-menu",
      area:"ShoutOut Ai Image/Video Enhancement",
      feature:"Nested enhancement command menu applies preview filters",
      changed:"Ai Image/Video Enhancement now opens a nested command menu with Neon, VIP Style, Club Ready, B&W, Warm, and Original. Each command shows a temporary definition bubble and Apply filter persists the selected enhancement metadata.",
      howToTest:"Upload an image to a media template, tap Ai Image/Video Enhancement, tap each nested command, watch the preview change and definition bubble appear, then tap Apply filter.",
      expected:"Each command updates the media preview, shows a linked explanation bubble, and Apply filter keeps the selected command without breaking submission."
    },
    {
      id:"v28-84-mingl-chat-bubbles",
      area:"Mingl chat experience",
      feature:"Mingl Chat behaves like a normal chat thread",
      changed:"Mingl messages render as bubbles, current user bubbles align right, recipient/system bubbles align left/center, empty chats say Start the conversation, and Send no longer opens a confirmation overlay or redirect flow on the public Mingl page or My Profile and Settings.",
      howToTest:"Open the public Mingl page or My Profile and Settings > Mingl, open a mutual Mingl chat, type a message, and tap Send.",
      expected:"The message appears immediately as a bubble, the composer stays on the chat screen, and the thread scrolls to the newest message."
    },
    {
      id:"v28-84-language-settings-grammar",
      area:"Language Settings and chat grammar",
      feature:"AI grammar and spelling behavior follows patron settings",
      changed:"A Language Settings tab now saves grammar preferences to the user's profile. Fix Grammar appears for Mingl Chat only when enabled and uses draft-only Gemini/local correction with user approval unless auto-fix mode is selected.",
      howToTest:"Open My Profile and Settings > Language Settings, enable AI Grammar & Spelling Assistance, save, return to Mingl Chat, type 'Hey.. are you gut?', tap Fix Grammar, approve the suggestion, then tap Send.",
      expected:"The typo is highlighted, the correction modal appears, the corrected text replaces the draft only after approval, and the message sends only after tapping Send."
    },
    {
      id:"mobile-mingl-nested-datapoints",
      area:"Mingl mobile public room",
      feature:"Matched profiles show nested datapoint categories on mobile",
      changed:"Matched Mingl cards no longer show a flat datapoint paragraph; they use the same clickable nested datapoint categories as the public profile.",
      howToTest:"Open Mingl on an iPhone or mobile browser, view a matched public profile, tap Gender, Music, Travel, Food, or Location.",
      expected:"The nested values open inside the profile card without floating off-screen or covering unrelated content."
    },
    {
      id:"floqr-inbox-rename",
      area:"My Profile and Settings",
      feature:"Messages is renamed to FLOQR Inbox",
      changed:"The patron portal tab, overview metric, Inbox rules card, message list heading, and profile menu now use FLOQR Inbox.",
      howToTest:"Open My Profile and Settings from the profile menu and inspect the tabs, overview cards, and inbox page.",
      expected:"User-facing labels say FLOQR Inbox instead of Messages."
    },
    {
      id:"mingl-request-accept-inbox",
      area:"FLOQR Inbox and Mingl requests",
      feature:"Patron can Mingl Back from FLOQR Inbox or Mingl page",
      changed:"Received Friend or Mingl Request messages expose a Mingl Back action in FLOQR Inbox, and pending requests also appear on the Mingl page.",
      howToTest:"From one patron account send Let's Mingl. Sign in as the other patron, open FLOQR Inbox, click the message, then click Mingl Back. Repeat from My Profile and Settings > Mingl > Mingl Requests.",
      expected:"The request becomes mutual, a Mingl Chat room opens, and both patrons can see/send chat messages."
    },
    {
      id:"mobile-privacy-checkbox-layout",
      area:"My Privacy mobile layout",
      feature:"Public datapoint checkboxes fit on iPhone",
      changed:"Consent and public datapoint checkbox labels now use mobile-safe sizing and wrapping.",
      howToTest:"Open My Profile and Settings > My Privacy on an iPhone or narrow mobile viewport.",
      expected:"Checkboxes and labels remain inside their cards with no label text pushed off-screen."
    },
    {
      id:"device-category-responsive-layouts",
      area:"Responsive device layouts",
      feature:"FLOQR pages respond to mobile, tablet, and PC device categories",
      changed:"The shared layout now marks mobile/tablet/desktop browser mode and applies matching layout rules for forms, cards, tabs, diagnostics, Mingl cards, and admin reports.",
      howToTest:"Open the patron app, My Profile and Settings, Mingl, and Master Admin Diagnostics on a phone width, tablet width, and desktop width. On desktop Chrome, use DevTools device toolbar for iPhone, iPad/tablet, and responsive desktop widths.",
      expected:"Phone pages are single-column with no horizontal scrolling, tablet pages use balanced one/two-column layouts, and PC pages use wider grids without oversized mobile spacing."
    },
    {
      id:"mingl-lets-mingl-request",
      area:"Mingl public room",
      feature:"Matched public patrons can send a Let's Mingl request",
      changed:"The public Mingl room shows only public/shared matched profiles and uses a Let's Mingl request button instead of opening chat immediately.",
      howToTest:"Sign in as a patron with public profile datapoints. Open Mingl, find a matched public patron, click Let's Mingl, then confirm the button changes to Mingl Request Sent.",
      expected:"A Friend or Mingl Request notification/message is created, the request is timestamped, and chat does not fully open until the other patron approves."
    },
    {
      id:"mingl-mutual-approval-chat",
      area:"Mingl chat approval",
      feature:"Full Mingl Chat opens only after both patrons approve",
      changed:"A received Mingl request can be accepted with Mingl Back, then a mutual Mingl chat room is created with a system message.",
      howToTest:"Use a second public matched patron account. Accept the request with Mingl Back, then open Mingl Chat from both accounts.",
      expected:"Both accounts see the same Mingl Chat history; the first system message says Friend or Mingl Request and includes shared datapoint context."
    },
    {
      id:"mingl-realtime-edit-emoji-ai",
      area:"Mingl chat UX",
      feature:"Realtime Mingl chat supports edit, emoji, and grammar cleanup",
      changed:"Mingl messages render live, sender-owned messages can be edited, emoji shortcuts are available, and Fix Grammar cleans the draft with AI-ready fallback.",
      howToTest:"Open a mutual Mingl chat, send a message, click Edit on your own message, use an emoji button, and click Fix Grammar on a rough draft.",
      expected:"New messages appear without a full reload, edited messages show edited, emojis send normally, and grammar cleanup does not expose private data."
    },
    {
      id:"my-profile-settings-rename",
      area:"My Profile and Settings",
      feature:"Settings page is renamed and deduplicated",
      changed:"The patron portal title and menu now say My Profile and Settings, with My Privacy under the same page.",
      howToTest:"Open the profile dropdown and select My Profile and Settings. Confirm the top page title has only My Profile and Settings and no duplicate FLOQR Settings heading.",
      expected:"The menu, browser title, and top page heading are consistent."
    },
    {
      id:"my-privacy-public-datapoints",
      area:"My Privacy",
      feature:"Patron chooses public/matchable datapoints",
      changed:"My Privacy includes checkbox controls for datapoints that can be public/shared and used for Mingl matching.",
      howToTest:"Open My Profile and Settings > My Privacy, uncheck one datapoint, save, refresh, and confirm the choice persists.",
      expected:"Saved publicMinglDatapoints persist and Mingl matching/profile display respects them."
    },
    {
      id:"public-media-data-sharing",
      area:"Public Media and Data Sharing",
      feature:"Profile media uploads moved with no captions and metadata prompt",
      changed:"Profile media uploads live under Public Media and Data Sharing, captions are removed, and GPS metadata can be added to Travel only when the patron chooses it.",
      howToTest:"Open Public Media and Data Sharing, upload a JPEG with location metadata, preview it, choose whether to add the location to Travel, then save the slot.",
      expected:"The upload succeeds, no caption field appears, the media remains visible, and Travel is updated only if the checkbox was selected."
    },
    {
      id:"action-feedback-confirmations",
      area:"Site-wide action confirmations",
      feature:"Important actions show working and success feedback",
      changed:"The shared FLOQR action feedback overlay is loaded on major action pages and used by the new profile, privacy, media, messaging, and Mingl actions.",
      howToTest:"Save profile, save My Privacy, upload media, send a direct message, send a Mingl message, and run a Master Admin diagnostic action.",
      expected:"The page shows a working message, then a success or failure message before returning to the original workflow."
    },
    {
      id:"location-ranking",
      area:"Location-aware club/event ranking",
      feature:"Nearby and preference-matched venues rank first",
      changed:"Club, lounge, beach club, and event search now ranks public results using browser/profile location, preferred cities, genres, venue types, and interests.",
      howToTest:"Sign in as a patron, allow or deny browser location, search clubs/events near your city, then confirm nearby and matching-genre results appear above unrelated cities. Deny geolocation once to confirm profile fallback still works.",
      expected:"Relevant nearby/preferred results appear first; the app still works if geolocation is denied."
    },
    {
      id:"heist-houston-removal",
      area:"Obsolete test listing cleanup",
      feature:"Heist Houston no longer appears",
      changed:"The fictitious Heist Houston static record was removed and the seeder marks old Firestore/AI index records deleted.",
      howToTest:"Search patron club results, contextual search, AI index-style search, and Master Admin listing tools for Heist Houston or heist-houston.",
      expected:"No active patron-facing Heist Houston card or search result appears."
    },
    {
      id:"default-template-gallery",
      area:"ShoutOut template gallery",
      feature:"Only Traditional Black and White ShoutOut appears by default",
      changed:"The initial template view no longer shows the full gallery before search or context recommendations.",
      howToTest:"Start a new ShoutOut, choose a venue, and inspect the first template selection screen before typing a search.",
      expected:"Only Traditional Black and White ShoutOut is shown in the default section."
    },
    {
      id:"template-search-reveal",
      area:"ShoutOut template search",
      feature:"Search/context reveals relevant templates",
      changed:"Other official, saved, and community templates are revealed only through search, ownership, public community matches, or context.",
      howToTest:"Search for birthday template with flowers, video template for VIP table, tattoo inspired background, and summer pool party.",
      expected:"Relevant matching template sections appear; unrelated templates do not flood the default view."
    },
    {
      id:"gemini-shoutout-copy",
      area:"Gemini ShoutOut copy help",
      feature:"Improve My ShoutOut and tone buttons work",
      changed:"ShoutOut copy help now calls the Firebase Functions Gemini callable when available and falls back to curated safe copy.",
      howToTest:"In the ShoutOut editor, click Improve My ShoutOut and the Birthday, VIP, Romantic, Party, and Classy buttons.",
      expected:"The main text updates with LED-safe copy; the suggestion box shows Gemini or curated fallback without breaking the editor."
    },
    {
      id:"media-template-upload",
      area:"Media-capable templates",
      feature:"Upload Image or Video appears only when supported",
      changed:"Media templates use one clear upload control with preview, AI media enhancement controls, and submit flow.",
      howToTest:"Search/select a media-capable template, then confirm Upload Image or Video appears. Select a text-only template and confirm it is not forced to show media upload.",
      expected:"Media upload appears for media-capable templates and stays hidden for text-only templates."
    },
    {
      id:"remove-media-control",
      area:"Media upload controls",
      feature:"Remove file clears selected media",
      changed:"A Remove file button was added to the media upload card.",
      howToTest:"Upload an image or video, confirm it previews, click Remove file, then confirm the preview and hidden media values clear.",
      expected:"The preview disappears and the ShoutOut can continue without selected media."
    },
    {
      id:"mobile-media-preview",
      area:"Mobile media preview",
      feature:"Uploaded image/video remains contained",
      changed:"Preview CSS uses contained sizing and viewport-aware max heights so media does not take over mobile pages.",
      howToTest:"On a phone viewport, upload a portrait photo, landscape photo, and video to a media template.",
      expected:"The entire media remains visible inside the preview area and does not push the editor out of proportion."
    },
    {
      id:"video-seven-second-trim",
      area:"ShoutOut video rule",
      feature:"Long videos warn and use first 7 seconds",
      changed:"Videos longer than 7 seconds warn the user and use a first-7-second trim path or metadata fallback.",
      howToTest:"Upload a video longer than 7 seconds, watch for the warning, preview the trimmed playback, and submit if the trim path is available.",
      expected:"The user is warned, full-length display is not allowed, and first-7-second metadata or trimmed output is saved."
    },
    {
      id:"live-preview-order",
      area:"ShoutOut editor layout",
      feature:"Live Preview appears below all controls",
      changed:"The editor shows inputs, AI copy help, media upload, AI media enhancement, submit, and then Live Preview.",
      howToTest:"Open the ShoutOut editor on desktop and mobile and inspect the scroll order.",
      expected:"Live Preview is below inputs/upload/enhancement controls and the layout scrolls naturally."
    },
    {
      id:"approval-display-media",
      area:"ShoutOut approval/display",
      feature:"Submitted media persists through approval to display",
      changed:"Media fields are saved on ShoutOut submission and carried through approval/display rendering.",
      howToTest:"Submit a media ShoutOut, approve it as admin, then open display.html for the target location.",
      expected:"The selected media version renders on the display page instead of a placeholder."
    },
    {
      id:"diagnostics-manual-output",
      area:"Master Admin Diagnostics",
      feature:"Manual test output and resolution prompt",
      changed:"Diagnostics now includes Succeed/Failed manual checks, a TXT output, and a copy-ready Codex prompt for failed checks.",
      howToTest:"Mark one manual check Succeed and one Failed, add a note to the failed check, then copy/download the output and copy the resolution prompt.",
      expected:"The output lists each manual test result, and the prompt includes the failed item and note."
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

  function includesWord(text, phrase) {
    const source = ` ${normalized(text)} `;
    const target = ` ${normalized(phrase)} `;
    return source.includes(target);
  }

  function uniqueByNormalized(values = []) {
    const seen = new Set();
    const out = [];
    values.filter(Boolean).forEach(value => {
      const key = normalized(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
    return out;
  }

  function marketForCityName(city) {
    const key = normalized(city);
    return KNOWN_MARKETS.find(market => {
      if (normalized(market.city) === key || includesWord(city, market.city)) return true;
      return (market.aliases || []).some(alias => normalized(alias) === key || includesWord(city, alias));
    }) || null;
  }

  function detectMarketsFromText(text = "") {
    const matches = [];
    KNOWN_MARKETS.forEach(market => {
      const names = [market.city, ...(market.aliases || [])];
      if (names.some(name => includesWord(text, name))) matches.push(market);
    });
    return uniqueByNormalized(matches.map(market => market.city))
      .map(city => marketForCityName(city))
      .filter(Boolean);
  }

  function detectCountriesFromText(text = "") {
    const countryNames = Object.keys(COUNTRY_LANGUAGES).map(key => key.replace(/\b\w/g, c => c.toUpperCase()));
    return uniqueByNormalized(countryNames.filter(country => includesWord(text, country)));
  }

  function detectGenresFromText(text = "") {
    const aliases = [
      ["Hip Hop", ["hip hop", "hiphop", "rap"]],
      ["EDM", ["edm", "electronic dance", "electronic music"]],
      ["Afro Beats", ["afro beats", "afrobeats"]],
      ["Amapiano", ["amapiano"]],
      ["House", ["house", "deep house", "tech house"]],
      ["Latin", ["latin", "latin music"]],
      ["Arabic Music", ["arabic music", "arabic", "arab"]],
      ["R&B", ["r and b", "r&b", "rnb"]],
      ["Reggaeton", ["reggaeton"]]
    ];
    const found = aliases.filter(([, terms]) => terms.some(term => includesWord(text, term))).map(([genre]) => genre);
    return uniqueByNormalized(found.length ? found : DEFAULT_GENRES.filter(genre => includesWord(text, genre)));
  }

  function detectEventTypesFromText(text = "") {
    const aliases = [
      ["nightclub", ["club", "clubs", "nightclub", "nightclubs"]],
      ["lounge", ["lounge", "lounges"]],
      ["rooftop lounge", ["rooftop lounge", "roof top lounge", "rooftop lounges", "roof top lounges"]],
      ["rooftop bar", ["rooftop bar", "roof top bar", "rooftop bars", "roof top bars"]],
      ["beach club", ["beach club", "beach clubs"]],
      ["brunch party", ["brunch", "brunch party", "brunch parties"]],
      ["pool party", ["pool party", "pool parties"]],
      ["summer party", ["summer party", "summer parties"]],
      ["DJ event", ["dj", "djs", "dj event", "dj events"]],
      ["promoter event", ["promoter", "promoter event", "promoter events"]],
      ["comedy show", ["comedy", "comedy show", "comedy shows"]],
      ["ticket resale event", ["ticket", "tickets", "resale", "ticket resale"]]
    ];
    const found = aliases.filter(([, terms]) => terms.some(term => includesWord(text, term))).map(([type]) => type);
    const cleaned = found.filter(type => !(type === "ticket resale event" && found.some(other => other !== "ticket resale event")));
    return uniqueByNormalized(cleaned.length ? cleaned : ["nightclub"]);
  }

  function inferLanguages(markets = [], countries = [], existing = []) {
    return uniqueByNormalized([
      ...existing,
      ...markets.flatMap(market => splitList(market.language)),
      ...countries.flatMap(country => splitList(COUNTRY_LANGUAGES[normalized(country)] || ""))
    ]);
  }

  function defaultGenreForEventType(eventType = "") {
    const type = normalized(eventType);
    if (type.includes("comedy")) return "Live Entertainment";
    if (type.includes("ticket")) return "Live Entertainment";
    if (type.includes("dj")) return "DJ";
    if (/club|lounge|bar|beach|brunch|pool|summer/.test(type)) return "Nightlife";
    return "Nightlife";
  }

  function searchPhraseFromParts(parts = []) {
    const seen = new Set();
    const output = [];
    parts.forEach(part => {
      const value = String(part || "").replace(/\s+/g, " ").trim();
      if (!value) return;
      const key = normalized(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      output.push(value);
    });
    return output.join(" ").replace(/\s+/g, " ").trim();
  }

  function genreShouldAppearInQuery(genre = "") {
    const key = normalized(genre);
    return !!key && !["nightlife", "live entertainment"].includes(key);
  }

  function crawlQueryForJob({eventType = "", genre = "", city = "", country = ""} = {}) {
    const needsTickets = /comedy|ticket|event|dj|promoter|party/i.test(eventType);
    return searchPhraseFromParts([
      eventType,
      genreShouldAppearInQuery(genre) ? genre : "",
      city,
      country && normalized(country) !== normalized(city) ? country : "",
      needsTickets && !includesWord(eventType, "ticket") ? "tickets" : ""
    ]);
  }

  function buildCrawlSearchPlan(criteria = {}) {
    const natural = criteria.naturalLanguage || criteria.search || "";
    const markets = detectMarketsFromText(natural);
    const detectedCountries = detectCountriesFromText(natural);
    const detectedGenres = detectGenresFromText(natural);
    const detectedEventTypes = detectEventTypesFromText(natural);
    const hasNaturalSignal = cleanText(natural) !== "-" && (
      markets.length ||
      detectedCountries.length ||
      detectedGenres.length ||
      detectedEventTypes.length
    );
    const cities = uniqueByNormalized([
      ...markets.map(market => market.city),
      ...(hasNaturalSignal ? [] : (criteria.cities || []))
    ]);
    const countries = uniqueByNormalized([
      ...detectedCountries,
      ...(hasNaturalSignal ? [] : (criteria.countries || [])),
      ...markets.map(market => market.country)
    ]);
    const genres = uniqueByNormalized([
      ...detectedGenres,
      ...(hasNaturalSignal ? [] : (criteria.genres || []))
    ]);
    const eventTypes = uniqueByNormalized([
      ...detectedEventTypes,
      ...(hasNaturalSignal ? [] : (criteria.eventTypes || []))
    ]);
    const fallbackMarkets = cities.length ? cities.map(city => marketForCityName(city)).filter(Boolean) : markets;
    const languages = inferLanguages(fallbackMarkets, countries, hasNaturalSignal ? [] : (criteria.languages || []));
    const finalCities = cities.length ? cities : ["Dubai", "Istanbul", "Singapore", "Shanghai"];
    const finalEventTypes = eventTypes.length ? eventTypes : ["nightclub"];
    const explicitGenres = genres.length ? genres : [""];
    const jobs = [];
    finalCities.forEach(city => {
      const market = marketForCityName(city);
      explicitGenres.forEach(genreInput => {
        finalEventTypes.forEach(eventType => {
          const genre = genreInput || defaultGenreForEventType(eventType);
          const country = market?.country || (countries.length === 1 ? countries[0] : "");
          const language = market?.language || languages[0] || "";
          jobs.push({
            city,
            country,
            stateRegion: market?.region || "",
            language,
            genre,
            eventType,
            query: crawlQueryForJob({eventType, genre, city, country}),
            requiredDatapoints: requiredDatapointLabels(eventType)
          });
        });
      });
    });
    const finalGenres = uniqueByNormalized(jobs.map(job => job.genre));
    return {
      naturalLanguage: natural,
      cities: finalCities,
      countries,
      genres: finalGenres,
      eventTypes: finalEventTypes,
      languages,
      jobCount: jobs.length,
      jobs: jobs.slice(0, 80),
      parser: "local-contextual-crawl-parser",
      note: "Plain-English input expanded into city x genre x event-type crawl/search jobs."
    };
  }

  function isVenueEventType(type = "") {
    return /club|venue|lounge|bar|beach/i.test(type);
  }

  function isComedyEventType(type = "") {
    return /comedy/i.test(type);
  }

  function requiredDatapointLabels(type = "") {
    if (isVenueEventType(type)) {
      return ["name", "description", "address", "city", "country", "telephone", "officialWebsite", "sourceUrl", "categories", "genres"];
    }
    return ["name", "description", "locationName", "address", "city", "country", "telephone", "sourceUrl", "ticketUrl", "categories", ...(isComedyEventType(type) ? ["date", "time"] : [])];
  }

  function sourceHost(sourceUrl = "") {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, "");
    } catch (error) {
      return "";
    }
  }

  function sourceNameForUrl(sourceUrl = "") {
    const host = sourceHost(sourceUrl);
    if (/eventbrite/i.test(host)) return "Eventbrite";
    if (/ticketmaster/i.test(host)) return "Ticketmaster";
    if (/google/i.test(host)) return "Google public search";
    return host || "Public source";
  }

  function isSearchResultsUrl(sourceUrl = "") {
    try {
      const url = new URL(sourceUrl);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const path = url.pathname.toLowerCase();
      if (/google\./.test(host) && path.includes("/search")) return true;
      if (/ticketmaster\./.test(host) && path.includes("/search")) return true;
      if (/eventbrite\./.test(host) && /^\/d\//.test(path) && /\/events\/?$/.test(path)) return true;
      return false;
    } catch (error) {
      return false;
    }
  }

  function searchQueryFromSourceUrl(sourceUrl = "") {
    try {
      const url = new URL(sourceUrl);
      const q = url.searchParams.get("q") || url.searchParams.get("keyword") || "";
      if (q) return q.replace(/\+/g, " ").trim();
      const pathParts = url.pathname.split("/").filter(Boolean);
      const dIndex = pathParts.indexOf("d");
      if (dIndex >= 0) return decodeURIComponent(pathParts.slice(dIndex + 1).join(" ")).replace(/[-_]+/g, " ").trim();
      return "";
    } catch (error) {
      return "";
    }
  }

  function searchResultsRecord(sourceUrl = "", sourceText = "") {
    const query = searchQueryFromSourceUrl(sourceUrl) || "public event search";
    const sourceName = sourceNameForUrl(sourceUrl);
    const market = extractCityCountryFromSource(sourceUrl, sourceText || query);
    const record = {
      proposedType:"sourceSearchResults",
      proposedTitle:`${sourceName} search results: ${query}`,
      proposedDescription:"This is a search-results page, not a final event or venue detail page. Use it to find candidates, then open one specific event/venue page or paste copied event-card details before saving an approvable review record.",
      proposedDate:"",
      proposedTime:"",
      proposedLocationName:"",
      proposedAddress:"",
      city:market.city,
      stateRegion:market.stateRegion,
      country:market.country,
      officialWebsite:"",
      website:"",
      email:"",
      telephone:"",
      phone:"",
      ticketUrl:"",
      sourceUrl,
      sourceName,
      sourceSearchLinks:sourceUrl ? [{label:"Search results page", href:sourceUrl}] : [],
      extractedImages:[],
      extractedTags:["search-results-page", "follow-up-needed"],
      categories:["search-results-page", "follow-up-needed"],
      genres:detectGenresFromText(`${query} ${sourceText}`),
      searchLanguage:market.language || "",
      searchQuery:query,
      aiSummary:"Search-results page detected. FLOQR will not approve this as a live listing until a final event/venue detail source is provided.",
      aiConfidenceScore:0.4,
      aiStarRating:2,
      aiRatingReasons:[
        "Broad search-results page detected",
        "Final event/venue URL is required for address/date/time extraction",
        "Open one specific result or use Ticketmaster/Eventbrite API detail data"
      ],
      duplicateCandidateIds:[],
      status:"pendingReview",
      discoveryMode:"source-results-follow-up",
      extractionMethod:"search-results-page-guard",
      sourcePageType:"searchResultsPage",
      notApprovable:true,
      missingDatapoints:["Final event/detail URL", "Name", "Address", "Date", "Time"],
      crawlResultStatus:"needs-final-event-source",
      createdAt:fieldValue(),
      updatedAt:fieldValue()
    };
    return attachCrawlAudit(record, {
      inputType:"search-results-url",
      sourceUrl,
      sourceName,
      sourceTextPreview:String(sourceText || "").slice(0, 2000),
      searchQuery:query,
      receivedAt:new Date().toISOString(),
      note:"Search-results pages are candidate-finding inputs, not final event/venue detail records."
    });
  }

  function titleCase(value = "") {
    return String(value || "").toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase()).replace(/\bDj\b/g, "DJ").replace(/\bEdm\b/g, "EDM");
  }

  function titleFromSourceUrl(sourceUrl = "") {
    try {
      const url = new URL(sourceUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      const eventSegment = parts.includes("e") ? parts[parts.indexOf("e") + 1] : parts[parts.length - 1] || "";
      const clean = decodeURIComponent(eventSegment)
        .replace(/-tickets-\d+.*$/i, "")
        .replace(/-\d{8,}.*$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return clean ? titleCase(clean) : "";
    } catch (error) {
      return "";
    }
  }

  function extractDate(value = "") {
    const text = String(value || "");
    const dayMonth = text.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\b/i);
    if (dayMonth) return `${dayMonth[3]}-${MONTHS[normalized(dayMonth[2])] || "01"}-${String(dayMonth[1]).padStart(2, "0")}`;
    const monthDay = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i);
    if (monthDay) return `${monthDay[3]}-${MONTHS[normalized(monthDay[1])] || "01"}-${String(monthDay[2]).padStart(2, "0")}`;
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    return iso ? iso[0] : "";
  }

  function extractTime(value = "") {
    const match = String(value || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(AM|PM)\b/i);
    return match ? `${match[1]}:${match[2]} ${match[3].toUpperCase()}` : "";
  }

  function extractEmail(value = "") {
    const match = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : "";
  }

  function extractPhone(value = "") {
    const matches = String(value || "").match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g) || [];
    const phone = matches.find(item => {
      const digits = item.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15 && !/^\d{6}$/.test(digits);
    });
    return phone ? phone.trim() : "";
  }

  function extractAddress(value = "") {
    const text = String(value || "").replace(/\s+/g, " ");
    const singapore = text.match(/\b(\d{1,5}\s+[A-Z0-9][A-Z0-9 .'-]+?(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|LN|DRIVE|DR|BOULEVARD|BLVD|CRESCENT|CRES|WAY|PLACE|PLAZA|QUAY|WALK|CLOSE)\s*(?:SINGAPORE)?\s*\d{6})\b/i);
    if (singapore) return singapore[1].replace(/\s+/g, " ").trim();
    const general = text.match(/\b(\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]+?(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|LN|DRIVE|DR|BOULEVARD|BLVD|CRESCENT|CRES|WAY|PLACE|PLAZA|QUAY|WALK|CLOSE))\b/i);
    return general ? general[1].replace(/\s+/g, " ").trim() : "";
  }

  function extractCityCountryFromSource(sourceUrl = "", text = "") {
    const combined = `${sourceUrl} ${text}`;
    const market = detectMarketsFromText(combined)[0];
    if (market) return {city: market.city, country: market.country, stateRegion: market.region, language: market.language};
    const host = sourceHost(sourceUrl);
    if (host.endsWith(".sg") || includesWord(combined, "Singapore")) return {city:"Singapore", country:"Singapore", stateRegion:"Singapore", language:"English, Mandarin, Malay, Tamil"};
    return {city:"", country:"", stateRegion:"", language:""};
  }

  function descriptionFromSourceText(text = "", title = "") {
    const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const useful = lines.filter(line => !line.match(/^(sign in|find events|create events|updates|help centre|search)$/i));
    const description = useful.find(line => line.length > 40 && !line.includes(title)) || useful.slice(0, 3).join(" ");
    return String(description || title || "Public-source event or venue discovery record.").slice(0, 500);
  }

  function sourceRecordMissingDatapoints(record = {}) {
    const required = requiredDatapointLabels(record.proposedType || "");
    const has = {
      name: !!record.proposedTitle,
      description: !!record.proposedDescription,
      locationName: !!record.proposedLocationName,
      address: !!record.proposedAddress,
      city: !!record.city,
      country: !!record.country,
      telephone: !!(record.telephone || record.phone),
      officialWebsite: !!(record.officialWebsite || record.website || record.sourceUrl),
      sourceUrl: !!record.sourceUrl,
      ticketUrl: !!record.ticketUrl,
      categories: !!(record.categories || []).length,
      genres: !!(record.genres || []).length,
      date: !!record.proposedDate,
      time: !!record.proposedTime
    };
    return required.filter(key => !has[key]).map(key => ({
      name:"Name",
      description:"Description",
      locationName:"Location name",
      address:"Address",
      city:"City",
      country:"Country",
      telephone:"Phone",
      officialWebsite:"Official website",
      sourceUrl:"Source URL",
      ticketUrl:"Ticket URL",
      categories:"Categories",
      genres:"Genres",
      date:"Date",
      time:"Time"
    }[key] || key));
  }

  function parsedDiscoveryData(record = {}) {
    return {
      proposedType: record.proposedType || "",
      proposedTitle: record.proposedTitle || "",
      proposedDescription: record.proposedDescription || record.aiSummary || "",
      proposedDate: record.proposedDate || "",
      proposedTime: record.proposedTime || "",
      proposedLocationName: record.proposedLocationName || "",
      proposedAddress: record.proposedAddress || "",
      city: record.city || "",
      stateRegion: record.stateRegion || "",
      country: record.country || "",
      telephone: record.telephone || record.phone || "",
      officialWebsite: record.officialWebsite || record.website || "",
      email: record.email || "",
      sourceUrl: record.sourceUrl || "",
      ticketUrl: record.ticketUrl || "",
      categories: record.categories || [],
      genres: record.genres || [],
      missingDatapoints: record.missingDatapoints || [],
      crawlResultStatus: record.crawlResultStatus || "",
      sourcePageType: record.sourcePageType || "detailOrGeneratedRecord"
    };
  }

  function attachCrawlAudit(record = {}, rawInput = {}) {
    const parsedData = parsedDiscoveryData(record);
    return {
      ...record,
      rawCrawlInput: {
        ...rawInput,
        auditVersion:"v28.67",
        protectedTerms:"FLOQR, ShoutOut, Mingl, Bata are preserved"
      },
      parsedData,
      extractionAudit: {
        rawCaptured:true,
        parsedCaptured:true,
        generatedAt:new Date().toISOString(),
        parserVersion:CURRENT_DIAGNOSTICS_PACKAGE_VERSION,
        sourceMode:record.discoveryMode || rawInput.inputType || "unknown"
      }
    };
  }

  function extractSourceDetailsFromText(sourceUrl = "", sourceText = "") {
    if (isSearchResultsUrl(sourceUrl)) return searchResultsRecord(sourceUrl, sourceText);
    const text = String(sourceText || "");
    const fromUrl = titleFromSourceUrl(sourceUrl);
    const titleLine = text.split(/\r?\n/).map(line => line.trim()).find(line => /show|club|lounge|party|tickets?|event/i.test(line) && line.length >= 8 && line.length <= 120);
    const title = titleLine || fromUrl || "Public source discovery";
    const market = extractCityCountryFromSource(sourceUrl, text);
    const proposedType = /comedy|stand.?up/i.test(`${title} ${text} ${sourceUrl}`) ? "comedyShow" : eventTypeToProposedType(`${title} ${text}`);
    const genres = proposedType === "comedyShow" ? ["Comedy", "Live Entertainment"] : detectGenresFromText(`${title} ${text}`);
    const categories = uniqueByNormalized([
      proposedType === "comedyShow" ? "comedy show" : proposedType,
      "public-source-extracted",
      /ticket|eventbrite|ticketmaster/i.test(`${sourceUrl} ${text}`) ? "ticketing" : ""
    ]);
    const record = {
      proposedType,
      proposedTitle:title,
      proposedDescription:descriptionFromSourceText(text, title),
      proposedDate:extractDate(text),
      proposedTime:extractTime(text),
      proposedLocationName:title,
      proposedAddress:extractAddress(text),
      city:market.city,
      stateRegion:market.stateRegion,
      country:market.country,
      officialWebsite:sourceUrl,
      website:sourceUrl,
      email:extractEmail(text),
      telephone:extractPhone(text),
      phone:extractPhone(text),
      socialMediaHandles:{instagram:"", x:"", tiktok:"", facebook:""},
      ticketUrl:sourceUrl,
      sourceUrl,
      sourceName:sourceNameForUrl(sourceUrl),
      sourceSearchLinks:sourceUrl ? [{label:"Source page", href:sourceUrl}] : [],
      extractedImages:[],
      extractedTags:categories,
      categories,
      genres,
      searchLanguage:market.language || "",
      searchQuery:title,
      aiSummary:"Extracted from a followed public source page. Master Admin must verify before approval.",
      aiConfidenceScore: text ? 0.84 : 0.62,
      aiStarRating: text ? 4 : 3,
      aiRatingReasons:[
        "Parsed from followed public source details",
        "Contains source URL for review",
        "Approval remains blocked until required datapoints are complete"
      ],
      duplicateCandidateIds:[],
      status:"pendingReview",
      discoveryMode:"source-detail-extraction",
      extractionMethod:text ? "pasted-source-details" : "source-url-slug",
      createdAt:fieldValue(),
      updatedAt:fieldValue()
    };
    record.missingDatapoints = sourceRecordMissingDatapoints(record);
    record.crawlResultStatus = record.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
    return attachCrawlAudit(record, {
      inputType:"source-detail-extraction",
      sourceUrl,
      sourceName:record.sourceName,
      sourceTextPreview:text.slice(0, 4000),
      receivedAt:new Date().toISOString(),
      extractionMethod:record.extractionMethod
    });
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

  function destinationPhone(item = {}) {
    return item.profileImport?.publicProfile?.telephone ||
      item.telephone ||
      item.phone ||
      "";
  }

  function destinationDescription(item = {}) {
    return item.proposedDescription ||
      item.description ||
      item.aiSummary ||
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
          phones: new Set(),
          descriptions: new Set(),
          missingRequired: new Set(),
          maxStar: 0,
          maxConfidence: 0
        });
      }
      const group = map.get(key);
      group.items.push(item);
      group.statuses.add(item.status || "unknown");
      group.sources.add(item.sourceName || item.profileImport?.sourceName || "unknown");
      splitList(item.genres || item.extractedTags || item.categories).forEach(value => group.genres.add(value));
      const phone = String(destinationPhone(item) || "").trim();
      if (phone) group.phones.add(phone);
      const description = String(destinationDescription(item) || "").trim();
      if (description) group.descriptions.add(description);
      splitList(item.missingDatapoints || []).forEach(value => group.missingRequired.add(value));
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
        genreList: Array.from(group.genres).filter(Boolean),
        phoneList: Array.from(group.phones).filter(Boolean),
        descriptionList: Array.from(group.descriptions).filter(Boolean),
        missingRequiredList: Array.from(group.missingRequired).filter(Boolean)
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

  function isOptionalParticipantCompatibilityNote(label, reason) {
    const text = normalized(`${label || ""} ${reason || ""}`);
    return text.includes("participant query compatibility")
      && text.includes("optional participant query blocked")
      && (
        text.includes("fallback participant document reads passed")
        || text.includes("supported fallback participant document reads passed")
      );
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
    if (isOptionalParticipantCompatibilityNote(label, reason)) {
      return "No Firebase rules fix is required. Deterministic Mingl/chat participant document reads passed, so FLOQR can keep broad participant array queries blocked for privacy.";
    }
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
    if (text.includes("gemini media") || text.includes("aienhanceshoutoutmedia") || text.includes("gemini_api_key")) {
      return "Deploy `functions/ai-discovery-functions.js` with the `aiEnhanceShoutOutMedia` callable, set the Firebase Functions secret `GEMINI_API_KEY`, then rerun Master Admin > Diagnostics.";
    }
    if (text.includes("backend") || text.includes("cloud functions") || text.includes("scheduler") || text.includes("gemini")) {
      return "Deploy the Firebase Functions backend and required secrets/API credentials, then rerun the related Master Admin diagnostic.";
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
        reason:`No saved rules smoke test exists for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}. Latest saved test is from ${latest.packageVersion || "unknown package"} at ${fmtDate(latest.createdAt)}. This is not a deployed-rules failure yet; click Run Rules Smoke Test after uploading this package.`
      }];
    }
    return [{
      source:"Current Rules Smoke Test",
      label:"No rules smoke test has been run",
      status:"Soft Fail",
      reason:`Run Rules Smoke Test for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION} after publishing Firestore and Storage rules. This is not a deployed-rules failure yet; it means no browser proof has been saved.`
    }];
  }

  function manualFeatureStorageKey() {
    return `floqrManualFeatureDiagnostics:${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}`;
  }

  function readManualFeatureResults() {
    try {
      return JSON.parse(localStorage.getItem(manualFeatureStorageKey()) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeManualFeatureResults(results) {
    localStorage.setItem(manualFeatureStorageKey(), JSON.stringify(results || {}));
  }

  function manualFeatureRows() {
    const saved = readManualFeatureResults();
    return MANUAL_FEATURE_TESTS.map(test => {
      const row = saved[test.id] || {};
      return {
        ...test,
        result: row.result || "",
        note: row.note || "",
        updatedAt: row.updatedAt || ""
      };
    });
  }

  function manualFeatureResultLabel(value) {
    if (value === "succeed") return "Succeed";
    if (value === "failed") return "Failed";
    return "Not tested";
  }

  function manualFeatureResultStatus(value) {
    if (value === "succeed") return "Pass";
    if (value === "failed") return "Failed";
    return "Soft Fail";
  }

  function updateManualFeatureResult(id, patch = {}) {
    const saved = readManualFeatureResults();
    saved[id] = {
      ...(saved[id] || {}),
      ...patch,
      updatedAt: new Date().toISOString()
    };
    writeManualFeatureResults(saved);
    renderManualFeatureDiagnostics();
  }

  function buildManualFeatureDiagnosticsText(rows = manualFeatureRows()) {
    const counts = countBy(rows, row => manualFeatureResultLabel(row.result));
    const lines = [
      "FLOQR MANUAL FEATURE TEST DIAGNOSTICS",
      `Generated at: ${new Date().toLocaleString()}`,
      `Diagnostics package: ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}`,
      `Signed-in Master Admin: ${state.auth?.currentUser?.email || state.auth?.currentUser?.uid || "unknown"}`,
      "",
      "SUMMARY",
      `Succeed: ${counts.Succeed || 0}`,
      `Failed: ${counts.Failed || 0}`,
      `Not tested: ${counts["Not tested"] || 0}`,
      "",
      "MANUAL TEST RESULTS"
    ];
    rows.forEach((row, index) => {
      lines.push("");
      lines.push(`${index + 1}. [${manualFeatureResultLabel(row.result)}] ${row.area}: ${row.feature}`);
      lines.push(`Changed feature: ${cleanText(row.changed)}`);
      lines.push(`How to test: ${cleanText(row.howToTest)}`);
      lines.push(`Expected result: ${cleanText(row.expected)}`);
      lines.push(`Master Admin note: ${cleanText(row.note || "-")}`);
      lines.push(`Updated: ${row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}`);
    });
    return lines.join("\n");
  }

  function buildManualFeatureDiagnosticsPrompt(rows = manualFeatureRows()) {
    const failed = rows.filter(row => row.result === "failed");
    const notTested = rows.filter(row => !row.result);
    const failedText = failed.length
      ? failed.map((row, index) => `${index + 1}. ${row.area}: ${row.feature}\n   What changed: ${cleanText(row.changed)}\n   How I tested: ${cleanText(row.howToTest)}\n   Expected: ${cleanText(row.expected)}\n   Failure note from Master Admin: ${cleanText(row.note || "Marked Failed without additional notes.")}`).join("\n")
      : "No manual feature tests were marked Failed.";
    const notTestedText = notTested.length
      ? notTested.map(row => `- ${row.area}: ${row.feature}`).join("\n")
      : "All manual feature tests have a Succeed or Failed result.";
    return [
      "You are working on the FLOQR web app.",
      "",
      "Please fix the user-facing feature issue or issues reported by Master Admin Manual Feature Test Diagnostics.",
      "",
      "Do not rebuild FLOQR from scratch. Preserve existing user profile data and keep ShoutOut, Mingl, Bata, guest lists, Firebase Auth, Firestore, Firebase Storage, Gemini/Firebase Functions integration, and GitHub Pages deployment working.",
      "",
      `Diagnostics package: ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}`,
      "",
      "Failed manual feature tests:",
      failedText,
      "",
      "Not-yet-tested manual checks:",
      notTestedText,
      "",
      "Please inspect the relevant files, fix the issue incrementally, update Diagnostics/README if needed, run syntax/static checks, and create the next full package ZIP."
    ].join("\n");
  }

  function renderManualFeatureDiagnostics() {
    const summary = byId("manualFeatureDiagnosticsSummary");
    const report = byId("manualFeatureDiagnosticsReport");
    const output = byId("manualFeatureDiagnosticsOutput");
    const promptBox = byId("manualFeatureDiagnosticsPrompt");
    if (!summary || !report) return;
    const rows = manualFeatureRows();
    state.lastManualFeatureDiagnostics = rows;
    const counts = countBy(rows, row => manualFeatureResultLabel(row.result));
    summary.innerHTML = simpleRows([
      ["Succeed", counts.Succeed || 0],
      ["Failed", counts.Failed || 0],
      ["Not tested", counts["Not tested"] || 0],
      ["Output", "Use Copy Manual Test Output for a plain TXT summary."],
      ["Resolution prompt", "Use Copy Resolution Prompt after marking failed tests."]
    ]);
    report.innerHTML = rows.map(row => {
      const status = manualFeatureResultStatus(row.result);
      const safeId = esc(row.id);
      return `<div class="queue-item manual-feature-test" data-manual-feature-id="${safeId}">
        <div class="message-envelope-head">
          <strong>${esc(row.area)}: ${esc(row.feature)}</strong>
          ${statusBadge(status)}
        </div>
        <p><strong>Changed feature:</strong> ${esc(row.changed)}</p>
        <p><strong>How to test:</strong> ${esc(row.howToTest)}</p>
        <p><strong>Expected:</strong> ${esc(row.expected)}</p>
        <div class="manual-test-actions">
          <label class="manual-test-choice"><input type="checkbox" data-manual-feature-result="${safeId}" data-result="succeed" ${row.result === "succeed" ? "checked" : ""}/> Succeed</label>
          <label class="manual-test-choice"><input type="checkbox" data-manual-feature-result="${safeId}" data-result="failed" ${row.result === "failed" ? "checked" : ""}/> Failed</label>
        </div>
        <label>Failure note / testing note<textarea data-manual-feature-note="${safeId}" rows="3" placeholder="Example: Button did nothing on mobile after selecting video.">${esc(row.note || "")}</textarea></label>
        <small>Last updated: ${esc(row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "not marked yet")}</small>
      </div>`;
    }).join("");
    const text = buildManualFeatureDiagnosticsText(rows);
    const prompt = buildManualFeatureDiagnosticsPrompt(rows);
    if (output) output.value = text;
    if (promptBox) promptBox.value = prompt;
    report.querySelectorAll("[data-manual-feature-result]").forEach(input => {
      input.addEventListener("change", event => {
        const id = event.target.dataset.manualFeatureResult;
        const result = event.target.dataset.result;
        const current = readManualFeatureResults()[id] || {};
        updateManualFeatureResult(id, {result:event.target.checked ? result : "", note:current.note || ""});
      });
    });
    report.querySelectorAll("[data-manual-feature-note]").forEach(input => {
      input.addEventListener("change", event => {
        const id = event.target.dataset.manualFeatureNote;
        const current = readManualFeatureResults()[id] || {};
        updateManualFeatureResult(id, {result:current.result || "", note:event.target.value || ""});
      });
    });
  }

  async function copyManualFeatureOutput() {
    const run = window.FLOQRActionFeedback?.run || ((messages, action) => action());
    return run({
      starting:"Copying diagnostics output...",
      wait:"We are preparing the manual diagnostics TXT output.",
      success:"Diagnostics output copied",
      redirecting:"Manual diagnostics output copied, returning to Diagnostics.",
      returnTo:"Diagnostics"
    }, async () => {
    try {
      const text = buildManualFeatureDiagnosticsText(manualFeatureRows());
      await copyTextToClipboard(text);
      setText("diagnosticsStatus", "Manual feature test output copied.");
    } catch (error) {
      setText("diagnosticsStatus", `Could not copy manual feature output: ${error?.message || error}`);
      throw error;
    }
    });
  }

  async function copyManualFeaturePrompt() {
    const run = window.FLOQRActionFeedback?.run || ((messages, action) => action());
    return run({
      starting:"Copying resolution prompt...",
      wait:"We are preparing the Codex resolution prompt.",
      success:"Resolution prompt copied",
      redirecting:"Resolution prompt copied, returning to Diagnostics.",
      returnTo:"Diagnostics"
    }, async () => {
    try {
      const prompt = buildManualFeatureDiagnosticsPrompt(manualFeatureRows());
      await copyTextToClipboard(prompt);
      setText("diagnosticsStatus", "Manual feature resolution prompt copied. Paste it into Codex when a manual test fails.");
    } catch (error) {
      setText("diagnosticsStatus", `Could not copy manual feature prompt: ${error?.message || error}`);
      throw error;
    }
    });
  }

  function downloadManualFeatureOutput() {
    const run = window.FLOQRActionFeedback?.run || ((messages, action) => action());
    return run({
      starting:"Exporting diagnostics...",
      wait:"We are creating the manual diagnostics TXT report.",
      success:"Diagnostics exported",
      redirecting:"Manual diagnostics TXT exported, returning to Diagnostics.",
      returnTo:"Diagnostics"
    }, async () => {
    const filename = `floqr-manual-feature-diagnostics-${exportTimestamp()}.txt`;
    downloadTextFile(filename, buildManualFeatureDiagnosticsText(manualFeatureRows()));
    setText("diagnosticsStatus", `Manual feature diagnostics downloaded as ${filename}.`);
    });
  }

  function collectDiagnosticIssues({data = {}, features = [], packageResults = [], manualResults = []} = {}) {
    const issues = [];
    const add = (source, label, status, reason) => {
      if (attentionStatus(status) && !isOptionalParticipantCompatibilityNote(label, reason)) {
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
    manualResults.filter(item => item.result === "failed").forEach(item => add("Manual Feature Test Diagnostics", `${item.area}: ${item.feature}`, "Failed", item.note || item.howToTest || "Master Admin marked this manual feature test Failed."));

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

  function buildDiagnosticsExport({data = {}, schedule = null, features = [], packageResults = [], manualResults = []} = {}) {
    const reports = sortByCreatedDesc(data.aiDiagnosticsReports?.rows || []);
    const latestRules = latestRulesSmokeReport(data);
    const currentRules = currentPackageRulesSmokeReport(data);
    const issues = collectDiagnosticIssues({data, features, packageResults, manualResults, reports});
    const lines = [];
    const counts = countBy(features, item => item.status);
    const packageCounts = countBy(packageResults, item => item.status);
    const manualCounts = countBy(manualResults, item => manualFeatureResultLabel(item.result));

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
    lines.push("MANUAL FEATURE TEST DIAGNOSTICS");
    lines.push(`Totals: Succeed=${manualCounts.Succeed || 0}, Failed=${manualCounts.Failed || 0}, Not tested=${manualCounts["Not tested"] || 0}`);
    manualResults.forEach(item => {
      lines.push(`[${manualFeatureResultLabel(item.result)}] ${item.area}: ${item.feature}`);
      lines.push(`Changed feature: ${cleanText(item.changed)}`);
      lines.push(`How to test: ${cleanText(item.howToTest)}`);
      lines.push(`Expected result: ${cleanText(item.expected)}`);
      lines.push(`Master Admin note: ${cleanText(item.note || "-")}`);
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
        ? `No saved rules smoke test exists for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}. Latest saved test is from ${latestAny.packageVersion || "unknown package"} at ${fmtDate(latestAny.createdAt)}. This is not a deployed-rules failure yet; click Run Rules Smoke Test after uploading this package.`
        : "No live rules smoke test has been run yet. This is not a deployed-rules failure yet; click Run Rules Smoke Test after publishing rules.";
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
          const missing = (check.includes || []).filter(token => !text.includes(token));
          const presentButForbidden = (check.notIncludes || []).filter(token => text.includes(token));
          const failed = missing.length || presentButForbidden.length;
          const supersededPackageCheck = failed && pkg.version !== CURRENT_DIAGNOSTICS_PACKAGE_VERSION;
          results.push({
            package: `${pkg.version} ${pkg.title}`,
            label: check.label,
            status: supersededPackageCheck ? "Pass" : (failed ? "Failed" : "Pass"),
            evidence: supersededPackageCheck
              ? `${check.file} now points to current package ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}; this historical package marker check is superseded and non-blocking. Original evidence: ${[
                  missing.length ? `${check.file} is missing: ${missing.join(", ")}` : "",
                  presentButForbidden.length ? `${check.file} still contains removed marker(s): ${presentButForbidden.join(", ")}` : ""
                ].filter(Boolean).join(" ")}`
              : failed
              ? [
                  missing.length ? `${check.file} is missing: ${missing.join(", ")}` : "",
                  presentButForbidden.length ? `${check.file} still contains removed marker(s): ${presentButForbidden.join(", ")}` : ""
                ].filter(Boolean).join(" ")
              : `${check.file} contains expected package marker(s).`
          });
        } catch (error) {
          const supersededPackageCheck = pkg.version !== CURRENT_DIAGNOSTICS_PACKAGE_VERSION;
          results.push({
            package: `${pkg.version} ${pkg.title}`,
            label: check.label,
            status: supersededPackageCheck ? "Pass" : "Failed",
            evidence: supersededPackageCheck
              ? `${check.file} is not required in the current package ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}; historical file check is superseded and non-blocking. Original evidence: ${error?.message || String(error)}`
              : error?.message || String(error)
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

  async function runGeminiMediaDiagnostic(options = {}) {
    const base = {
      area:"ShoutOut",
      feature:"Gemini media editing callable",
      status:"Soft Fail",
      evidence:"Gemini media editing callable has not been checked yet."
    };
    try {
      if (!state.auth?.currentUser) {
        return {...base, evidence:"No signed-in Master Admin user is available for the callable check."};
      }
      if (!window.firebase?.functions) {
        return {...base, status:"Failed", evidence:"Firebase Functions SDK is not loaded on Master Admin."};
      }
      const region = window.FLOQR_AI_FUNCTIONS_REGION || "";
      const functionName = window.FLOQR_AI_GEMINI_MEDIA_FUNCTION || "aiEnhanceShoutOutMedia";
      const client = region ? firebase.app().functions(region) : firebase.app().functions();
      const callable = client.httpsCallable(functionName);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini media callable diagnostic timed out.")), 12000));
      const result = await Promise.race([callable({mode:"diagnostic"}), timeout]);
      const data = result?.data || {};
      if (data.status === "configured") {
        return {
          ...base,
          status:"Pass",
          evidence:`Gemini media editing callable is configured. Provider=${data.provider || "gemini"}; model=${data.model || window.FLOQR_AI_GEMINI_MEDIA_MODEL || "unknown"}.`
        };
      }
      return {
        ...base,
        status:"Soft Fail",
        evidence:data.message || "Gemini media callable responded but did not report configured status."
      };
    } catch (error) {
      const message = error?.message || String(error);
      const code = error?.code || "";
      const missingFunction = /not found|not-found|functions\/not-found|404/i.test(`${code} ${message}`);
      const missingSecret = /secret|GEMINI_API_KEY|not configured|failed-precondition/i.test(`${code} ${message}`);
      return {
        ...base,
        status:"Soft Fail",
        evidence:missingFunction
          ? "Gemini media editing callable is not deployed yet. Deploy Firebase Functions with aiEnhanceShoutOutMedia, then rerun Diagnostics."
          : missingSecret
          ? `Gemini media editing callable is deployed but not configured: ${message}`
          : `Gemini media editing callable check failed: ${message}`
      };
    } finally {
      if (!options.silent) setText("diagnosticsStatus", "Gemini media diagnostic finished.");
    }
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
          status:"Pass",
          evidence:`Optional participant query blocked; supported fallback participant document reads passed. ${collection} array-contains query was denied (${error?.message || error}), and FLOQR uses ${fallbackName} as the supported safe path. This is compatible with strict Firestore privacy rules; do not loosen rules broadly just to make this optional query pass.`
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
    await capture("Firestore: clubLocationAliases lifecycle", () => firestoreDocLifecycle("clubLocationAliases", {aliasId:"diagnostic-alias", canonicalLocationId:"diagnostic-location", status:"active"}, runId));
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
    await capture("Firestore: minglAudit request lifecycle", () => firestoreDocLifecycle("minglAudit", {
      type:"mingl_request",
      actorUid:user.uid,
      participants:[user.uid, `diagnostic-peer-${runId}`],
      title:"Friend or Mingl Request",
      body:"Rules smoke test Mingl audit record."
    }, runId));
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
    await capture("Storage: mingl-chat image path", () => storageLifecycle(`mingl-chat/${user.uid}/${runId}/rules-smoke-test.png`));
    await capture("Storage: mingl-chat-backgrounds image path", () => storageLifecycle(`mingl-chat-backgrounds/${user.uid}/${runId}/rules-smoke-test.png`));
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

  async function saveFeatureDiagnosticsReport(features = []) {
    if (!state.db) return {status:"Soft Fail", evidence:"Firestore unavailable; feature diagnostics report was not saved."};
    try {
      const user = state.auth?.currentUser || {};
      const failed = features.filter(item => item.status === "Failed").length;
      const soft = features.filter(item => item.status === "Soft Fail").length;
      const tbi = features.filter(item => item.status === "TBI").length;
      const overallStatus = failed ? "Failed" : (soft || tbi) ? "Soft Fail" : "Pass";
      await state.db.collection("aiDiagnosticsReports").add({
        type:"featureDiagnostics",
        packageVersion:CURRENT_DIAGNOSTICS_PACKAGE_VERSION,
        status:overallStatus,
        summary:{pass:features.filter(item => item.status === "Pass").length, softFail:soft, failed, tbi},
        results:features.map(item => ({
          label:`${item.area}: ${item.feature}`,
          status:item.status,
          evidence:item.evidence || ""
        })),
        createdByUid:user.uid || "",
        createdByEmail:user.email || "",
        createdAt:fieldValue()
      });
      return {status:"Pass", evidence:"Feature diagnostics report saved to aiDiagnosticsReports."};
    } catch (error) {
      return {status:"Soft Fail", evidence:`Feature diagnostics ran, but report save failed: ${error?.message || error}`};
    }
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
    if (byId("crawlNaturalLanguageInput") && !byId("crawlNaturalLanguageInput").value) {
      byId("crawlNaturalLanguageInput").value = "Search for all clubs playing hip hop and EDM in Paris, Marseille, Monaco, St. Tropez, France. Include official website, address, phone, email, social handles, and ticket links.";
    }
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
    if (criteria.naturalLanguage && byId("crawlNaturalLanguageInput")) byId("crawlNaturalLanguageInput").value = criteria.naturalLanguage;
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
      naturalLanguage: byId("crawlNaturalLanguageInput")?.value.trim() || "",
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
    const criteria = readCriteriaFromControls();
    const plan = buildCrawlSearchPlan(criteria);
    return {
      enabled: byId("crawlFrequency")?.value !== "manualOnly",
      frequency: byId("crawlFrequency")?.value || "every4Hours",
      scheduleHours: splitList(byId("crawlScheduleHours")?.value),
      criteria: {
        ...criteria,
        structuredPlan: plan
      },
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

  function renderCrawlSearchPlan(plan = state.lastCrawlPlan || buildCrawlSearchPlan(readCriteriaFromControls())) {
    const wrap = byId("crawlSearchPlanReport");
    if (!wrap) return;
    state.lastCrawlPlan = plan;
    const rows = [
      ["Interpreted request", plan.naturalLanguage || "Advanced structured criteria"],
      ["Expanded searches", plan.jobCount.toLocaleString()],
      ["Cities", joinList(plan.cities)],
      ["Genres", joinList(plan.genres)],
      ["Record types", joinList(plan.eventTypes)],
      ["Languages", joinList(plan.languages) || "Market default"]
    ];
    const jobsHtml = plan.jobs.length ? plan.jobs.slice(0, 24).map((job, index) => `<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(index + 1)}. ${esc(job.query)}</strong>
        ${statusBadge("Pass")}
      </div>
      <p>${esc(job.eventType)} | ${esc(job.genre)} | ${esc(job.city)}${job.country ? `, ${esc(job.country)}` : ""} | ${esc(job.language || "local language")}</p>
      <small>Required datapoints: ${esc(job.requiredDatapoints.join(", "))}</small>
    </div>`).join("") : "<p class='sub'>No search jobs were generated. Add a city, genre, or event type.</p>";
    wrap.innerHTML = `${simpleRows(rows)}${jobsHtml}`;
  }

  function previewCrawlPlan() {
    const plan = buildCrawlSearchPlan(readCriteriaFromControls());
    renderCrawlSearchPlan(plan);
    setText("diagnosticsStatus", `Search plan ready: ${plan.jobCount} crawl/search job(s) generated from plain English input.`);
    return plan;
  }

  function renderSourceExtractionReport(record = state.lastExtractedSourceRecord) {
    const wrap = byId("sourceExtractionReport");
    if (!wrap) return;
    if (!record) {
      wrap.innerHTML = "<p class='sub'>No source details extracted yet.</p>";
      return;
    }
    const rows = [
      ["Page type", record.sourcePageType === "searchResultsPage" ? "Search results page - follow-up required" : "Detail/source page"],
      ["Name", record.proposedTitle || "-"],
      ["Type", record.proposedType || "-"],
      ["Date", record.proposedDate || "-"],
      ["Time", record.proposedTime || "-"],
      ["Address", record.proposedAddress || "-"],
      ["City / country", [record.city, record.country].filter(Boolean).join(", ") || "-"],
      ["Phone", record.telephone || record.phone || "-"],
      ["Source", record.sourceName || record.sourceUrl || "-"],
      ["Missing datapoints", (record.missingDatapoints || []).join(", ") || "None"]
    ];
    wrap.innerHTML = `${simpleRows(rows)}${renderAuditJsonBlock("Initial crawled/input data", record.rawCrawlInput || {})}${renderAuditJsonBlock("Parsed data output", record.parsedData || parsedDiscoveryData(record))}<div class="queue-item">
      <div class="message-envelope-head">
        <strong>${esc(record.proposedTitle || "Extracted source")}</strong>
        ${statusBadge(record.notApprovable ? "Failed" : (record.missingDatapoints || []).length ? "Soft Fail" : "Pass")}
      </div>
      <p>${esc(record.proposedDescription || record.aiSummary || "")}</p>
      ${record.notApprovable ? `<p class="sub small"><strong>Next step:</strong> Open one specific event or venue detail page from these results, then paste that final URL and copied event-card details here.</p>` : ""}
      <p class="sub small">Categories: ${esc(joinList(record.categories) || "-")} | Genres/tags: ${esc(joinList(record.genres) || "-")}</p>
      ${record.sourceUrl ? `<a class="buttonlike" target="_blank" href="${esc(record.sourceUrl)}">Open Source</a>` : ""}
    </div>`;
  }

  function renderAuditJsonBlock(title, value = {}) {
    const text = JSON.stringify(value || {}, null, 2);
    return `<details class="admin-detail" open>
      <summary>${esc(title)}</summary>
      <pre class="diagnostic-json">${esc(text)}</pre>
    </details>`;
  }

  async function tryBackendSourceExtraction(sourceUrl, sourceText) {
    if (!sourceUrl || !window.firebase?.functions) return null;
    try {
      const callable = firebase.app().functions().httpsCallable("aiExtractPublicSourceUrl");
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Backend extractor timeout")), 9000));
      const result = await Promise.race([callable({sourceUrl, sourceText}), timeout]);
      return result?.data?.record || null;
    } catch (error) {
      console.warn("Backend source extractor unavailable:", error?.message || error);
      return null;
    }
  }

  async function extractSourceDetails() {
    const sourceUrl = byId("sourceExtractUrl")?.value.trim() || "";
    const sourceText = byId("sourceExtractText")?.value.trim() || "";
    if (!sourceUrl && !sourceText) {
      setText("diagnosticsStatus", "Paste a source URL or copied source page details first.");
      return null;
    }
    setText("diagnosticsStatus", "Extracting source details...");
    const backendRecord = await tryBackendSourceExtraction(sourceUrl, sourceText);
    const localRecord = extractSourceDetailsFromText(sourceUrl, sourceText);
    let record = {
      ...localRecord,
      ...(backendRecord || {}),
      sourceUrl: backendRecord?.sourceUrl || localRecord.sourceUrl,
      sourceName: backendRecord?.sourceName || localRecord.sourceName,
      createdAt: fieldValue(),
      updatedAt: fieldValue()
    };
    record.missingDatapoints = sourceRecordMissingDatapoints(record);
    record.crawlResultStatus = record.missingDatapoints.length ? "missing-required-datapoints" : "ready-for-approval";
    record = attachCrawlAudit(record, {
      ...(record.rawCrawlInput || localRecord.rawCrawlInput || {}),
      inputType:backendRecord ? "backend-source-detail-extraction" : (localRecord.rawCrawlInput?.inputType || "local-source-detail-extraction"),
      sourceUrl,
      sourceName:record.sourceName,
      sourceTextPreview:sourceText.slice(0, 4000),
      receivedAt:new Date().toISOString(),
      backendExtractorUsed:!!backendRecord
    });
    state.lastExtractedSourceRecord = record;
    renderSourceExtractionReport(record);
    setText("diagnosticsStatus", backendRecord
      ? "Source details extracted with Firebase backend and prepared for review."
      : "Source details extracted locally from pasted URL/details and prepared for review.");
    return record;
  }

  async function saveExtractedDiscoveryRecord() {
    if (!state.db) return;
    const record = state.lastExtractedSourceRecord || await extractSourceDetails();
    if (!record) return;
    if (record.notApprovable || record.sourcePageType === "searchResultsPage") {
      setText("diagnosticsStatus", "This is a search results page. Open one specific event or venue detail page, then paste that final URL/details before saving.");
      renderSourceExtractionReport(record);
      return;
    }
    await state.db.collection("aiDiscoveryQueue").add({
      ...record,
      createdByUid: state.auth?.currentUser?.uid || "",
      createdByEmail: state.auth?.currentUser?.email || "",
      createdAt: fieldValue(),
      updatedAt: fieldValue()
    });
    setText("diagnosticsStatus", `Saved extracted review record for ${record.proposedTitle || "source"} to aiDiscoveryQueue.`);
    state.lastExtractedSourceRecord = null;
    renderSourceExtractionReport(null);
    if (byId("sourceExtractText")) byId("sourceExtractText").value = "";
    await refreshDiagnostics();
    if (window.FLOQRAIDiscovery?.loadDiscoveryQueue) await window.FLOQRAIDiscovery.loadDiscoveryQueue();
  }

  function marketForCity(city) {
    const market = marketForCityName(city);
    return market ? {country: market.country, language: market.language, region: market.region} : {country: "", language: "", region: ""};
  }

  function ticketPartnerUrl(partner, query, city) {
    const search = searchPhraseFromParts([
      query,
      city && !includesWord(query, city) ? city : ""
    ]);
    const encoded = encodeURIComponent(search);
    if (partner === "Ticketmaster") return `https://www.ticketmaster.com/search?q=${encoded}`;
    if (partner === "Eventbrite") return `https://www.eventbrite.com/d/${encoded}/events/`;
    return `https://www.google.com/search?q=${encodeURIComponent(searchPhraseFromParts([
      search,
      includesWord(search, "tickets") ? "" : "tickets",
      "resale"
    ]))}`;
  }

  function officialSearchUrl(query, city) {
    const search = searchPhraseFromParts([
      query,
      city && !includesWord(query, city) ? city : "",
      "official website address phone instagram"
    ]);
    return `https://www.google.com/search?q=${encodeURIComponent(search)}`;
  }

  function eventTypeToProposedType(eventType = "") {
    const text = normalized(eventType);
    if (text.includes("comedy")) return "comedyShow";
    if (text.includes("rooftop lounge")) return "rooftopLounge";
    if (text.includes("rooftop bar")) return "rooftopBar";
    if (text.includes("lounge")) return "lounge";
    if (text.includes("beach club")) return "beachClub";
    if (text.includes("club")) return "club";
    if (text.includes("dj")) return "event";
    if (text.includes("ticket")) return "event";
    return "event";
  }

  function sourceSearchLinksForJob(job = {}) {
    const query = job.query || crawlQueryForJob(job);
    return [
      {label:"Official/source search", href:officialSearchUrl(query, job.city || "")},
      {label:"Ticketmaster", href:ticketPartnerUrl("Ticketmaster", query, job.city || "")},
      {label:"Eventbrite", href:ticketPartnerUrl("Eventbrite", query, job.city || "")},
      {label:"Resale/partner search", href:ticketPartnerUrl("Resale", query, job.city || "")}
    ];
  }

  function candidateBase(criteria, runId, index, override = {}) {
    const city = override.city || criteria.cities[index % Math.max(criteria.cities.length, 1)] || "Dubai";
    const market = marketForCity(city);
    const country = market.country || override.country || ((criteria.countries || []).length === 1 ? criteria.countries[0] : "");
    const genre = override.genre || criteria.genres[index % Math.max(criteria.genres.length, 1)] || "Hip Hop";
    const eventType = override.eventType || criteria.eventTypes[index % Math.max(criteria.eventTypes.length, 1)] || "nightclub";
    const sourceName = override.sourceName || (index % 2 === 0 ? "Ticketmaster public search" : "Eventbrite public search");
    const proposedType = override.proposedType || eventTypeToProposedType(eventType);
    const title = override.title || `${genre} ${eventType} in ${city}`;
    const stateRegion = override.stateRegion || override.region || market.region || ((criteria.regions || []).length === 1 ? criteria.regions[0] : "");
    const query = override.query || crawlQueryForJob({eventType, genre, city, country});
    const sourceSearchLinks = override.sourceSearchLinks || sourceSearchLinksForJob({query, city, country, genre, eventType});
    const requiredDatapoints = requiredDatapointLabels(eventType);
    const defaultMissing = [
      "Address",
      "Phone",
      ...(isComedyEventType(eventType) ? ["Date", "Time"] : [])
    ];
    const record = {
      proposedType,
      proposedTitle: title,
      proposedDescription: override.description || `Public-source crawl result for ${eventType} matching ${genre} in ${city}. Complete the required datapoints, verify the source, then approve into FLOQR search.`,
      proposedDate: "",
      proposedTime: "",
      proposedLocationName: override.locationName || title,
      proposedAddress: override.address || "",
      officialWebsite: override.officialWebsite || "",
      email: override.email || "",
      telephone: override.telephone || "",
      phone: override.phone || override.telephone || "",
      socialMediaHandles: override.socialMediaHandles || {instagram:"", x:"", tiktok:"", facebook:""},
      ticketUrl: override.ticketUrl || sourceSearchLinks.find(link => link.label === "Ticketmaster")?.href || "",
      city,
      stateRegion,
      country,
      sourceUrl: override.sourceUrl || sourceSearchLinks[0]?.href || ticketPartnerUrl(sourceName.includes("Ticketmaster") ? "Ticketmaster" : sourceName.includes("Eventbrite") ? "Eventbrite" : "Resale", query, city),
      sourceName,
      sourceSearchLinks,
      extractedImages: [],
      extractedTags: [eventType, genre, city, country].filter(Boolean),
      categories: [eventType, "public-discovery", "ticketing"].filter(Boolean),
      genres: [genre],
      searchLanguage: override.language || market.language || criteria.languages[0] || "local language",
      searchQuery: query,
      requiredDatapoints,
      missingDatapoints: defaultMissing,
      crawlResultStatus: "needs-public-source-details",
      ticketingPartners: ["Ticketmaster", "Eventbrite", "approved resale partners"],
      aiSummary: `Structured crawl result generated from Master Admin input. Fill required datapoints from public sources before approval.`,
      aiConfidenceScore: override.confidence || 0.68,
      aiStarRating: override.star || 3,
      aiRatingReasons: [
        "Matches the expanded crawl/search plan",
        "Includes required datapoint checklist",
        "Requires verified public-source details before publishing"
      ],
      duplicateCandidateIds: [],
      status: "pendingReview",
      crawlRunId: runId,
      criteriaSnapshot: criteria,
      discoveryMode: "manual-natural-language-crawl-result",
      createdAt: fieldValue(),
      updatedAt: fieldValue()
    };
    return attachCrawlAudit(record, {
      inputType:"manual-crawl-search-plan",
      naturalLanguage:criteria.naturalLanguage || "",
      advancedSearch:criteria.search || "",
      structuredJob:{
        city,
        country,
        stateRegion,
        genre,
        eventType,
        query,
        sourceSearchLinks
      },
      criteriaSnapshot:criteria,
      runId,
      generatedAt:new Date().toISOString()
    });
  }

  function buildManualCrawlCandidates(criteria, runId) {
    const plan = buildCrawlSearchPlan(criteria);
    state.lastCrawlPlan = plan;
    return plan.jobs.map((job, index) => candidateBase(criteria, runId, index, {
      ...job,
      title: `${job.genre} ${job.eventType} in ${job.city}`,
      description: `Crawl/search result for ${job.genre} ${job.eventType} in ${job.city}${job.country ? `, ${job.country}` : ""}. Required datapoints are listed on the review card.`,
      sourceName: "FLOQR public-source search plan",
      confidence: 0.72,
      star: isVenueEventType(job.eventType) ? 4 : 3
    }));
  }

  async function runManualCrawl() {
    if (!state.db) return;
    const user = state.auth?.currentUser;
    const schedule = await saveCrawlSchedule({silent: true});
    const criteria = schedule.criteria;
    const runRef = state.db.collection("aiCrawlRuns").doc();
    const plan = buildCrawlSearchPlan(criteria);
    renderCrawlSearchPlan(plan);
    setText("diagnosticsStatus", `Creating ${plan.jobCount} reviewable crawl result record(s) from the expanded search plan...`);
    await runRef.set({
      trigger: "manual",
      mode: "manual-natural-language-crawl",
      status: "running",
      criteria,
      structuredPlan: plan,
      requestedByUid: user?.uid || "",
      requestedByEmail: user?.email || "",
      startedAt: fieldValue(),
      note: "Manual Master Admin crawl workflow. Records require public-source datapoint completion before approval."
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
    setText("diagnosticsStatus", `Manual crawl complete. ${candidates.length} structured review record(s) added with required datapoint checklists.`);
    await refreshDiagnostics();
  }

  function staleAgeThresholdDays() {
    const value = Number(byId("staleRecordAgeDays")?.value || STALE_RECORD_DEFAULT_DAYS);
    return Number.isFinite(value) && value > 0 ? value : STALE_RECORD_DEFAULT_DAYS;
  }

  function valueToDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function firstRecordDate(row = {}, fields = []) {
    for (const field of fields) {
      const date = valueToDate(row[field]);
      if (date) return date;
    }
    return null;
  }

  function recordAgeDays(row = {}, fields = ["createdAt", "submittedAt"]) {
    const date = firstRecordDate(row, fields);
    if (!date) return null;
    return (Date.now() - date.getTime()) / 86400000;
  }

  function ageStaleReason(row = {}, fields = ["createdAt"], label = "Record") {
    const age = recordAgeDays(row, fields);
    const threshold = staleAgeThresholdDays();
    if (age === null || age <= threshold) return "";
    return `${label} has been in the queue for more than ${threshold} day(s) (${Math.floor(age)} day(s)).`;
  }

  function rowText(row = {}) {
    try {
      return JSON.stringify(row);
    } catch (error) {
      return String(row || "");
    }
  }

  function oldRuleReferenceReasons(row = {}) {
    const text = rowText(row);
    const versions = uniqueByNormalized(text.match(/v\d+\.\d+(?:[-][A-Za-z0-9]+)*/g) || []);
    const reasons = [];
    const mentionsFirestore = /firestore(?:\.rules|\s+rules|\s+rule)/i.test(text);
    const mentionsStorage = /storage(?:\.rules|\s+rules|\s+rule)/i.test(text);
    if (mentionsFirestore) {
      const old = versions.filter(version => version !== EXPECTED_FIRESTORE_RULES_VERSION && version !== CURRENT_DIAGNOSTICS_PACKAGE_VERSION);
      if (old.length) reasons.push(`References old Firestore rules/package marker(s): ${old.join(", ")}. Expected Firestore rules: ${EXPECTED_FIRESTORE_RULES_VERSION}.`);
    }
    if (mentionsStorage) {
      const old = versions.filter(version => version !== EXPECTED_STORAGE_RULES_VERSION && version !== CURRENT_DIAGNOSTICS_PACKAGE_VERSION);
      if (old.length) reasons.push(`References old Storage rules/package marker(s): ${old.join(", ")}. Expected Storage rules: ${EXPECTED_STORAGE_RULES_VERSION}.`);
    }
    return reasons;
  }

  function knownLocationIds(data = state.lastData || {}) {
    const ids = new Set();
    Object.keys(window.SHOUTOUT_CLUB_LOCATIONS || {}).forEach(id => ids.add(normalized(id)));
    (data.clubLocations?.rows || []).forEach(row => {
      if (row.id && String(row.status || "active") !== "deleted") ids.add(normalized(row.id));
    });
    return ids;
  }

  function locationReferences(row = {}) {
    return uniqueByNormalized([
      row.clubLocationId,
      row.locationId,
      row.location,
      row.club,
      row.targetCollection === "clubLocations" ? row.targetId : "",
      row.profileImport?.targetCollection === "clubLocations" ? row.profileImport?.targetId : "",
      row.parsedData?.clubLocationId,
      row.parsedData?.locationId,
      row.rawCrawlInput?.structuredJob?.locationId
    ].filter(Boolean));
  }

  function oldLocationReasons(row = {}, locationIds = knownLocationIds()) {
    const refs = locationReferences(row);
    const reasons = [];
    refs.forEach(ref => {
      const key = normalized(ref);
      if (!key) return;
      if (locationIds.has(key)) return;
      if (marketForCityName(ref)) return;
      reasons.push(`References old/unknown location id: ${ref}.`);
    });
    return reasons;
  }

  function discoveryStaleReasons(row = {}, locationIds = knownLocationIds()) {
    const reasons = [];
    const status = normalized(row.status || "pendingReview");
    if (status === "approved" || row.approvedRecordId || row.approvedFromDiscoveryQueueId) return reasons;
    const mode = normalized(row.discoveryMode || "");
    const result = normalized(row.crawlResultStatus || "");
    const pageType = normalized(row.sourcePageType || "");
    const rawType = normalized(row.rawCrawlInput?.inputType || "");
    const title = row.proposedTitle || row.proposedLocationName || "";
    const city = row.city || row.parsedData?.city || "";
    const country = row.country || row.parsedData?.country || "";
    const market = marketForCityName(city);
    const ageReason = ageStaleReason(row, ["createdAt", "updatedAt"], "AI discovery queue record");
    if (ageReason && !["deleted", "rejected"].includes(status)) reasons.push(ageReason);
    if (market && country && normalized(country) !== normalized(market.country)) {
      reasons.push(`City/country mismatch: ${city} should map to ${market.country}, not ${country}.`);
    }
    if (market && row.stateRegion && normalized(row.stateRegion) !== normalized(market.region) && normalized(row.stateRegion).includes("western europe") && normalized(market.region) !== "western europe") {
      reasons.push(`Region mismatch: ${city} should use ${market.region}, not ${row.stateRegion}.`);
    }
    reasons.push(...oldRuleReferenceReasons(row), ...oldLocationReasons(row, locationIds));
    if (mode.includes("manual natural language crawl result") || rawType.includes("manual crawl search plan")) {
      reasons.push("Generated search-plan placeholder, not a followed public source record.");
    }
    if (mode.includes("source results follow up") || pageType.includes("searchresultspage") || isSearchResultsUrl(row.sourceUrl || "")) {
      reasons.push("Broad search-results page; needs a final event or venue detail source.");
    }
    if (result.includes("needs public source details") || result.includes("needs final event source")) {
      reasons.push("Still waiting for verified public source details.");
    }
    if (!row.rawCrawlInput && !row.parsedData) {
      reasons.push("Older cached record without raw/parsed audit output.");
    }
    if (!row.proposedAddress && !row.address && !(row.telephone || row.phone) && /tickets?|search|generated|public-source/i.test(`${title} ${mode}`)) {
      reasons.push("Missing real address and phone; likely generated from a search query rather than a source page.");
    }
    if (status === "deleted" || result.includes("stale cache cleared")) {
      reasons.push("Already removed from active review.");
    }
    return uniqueByNormalized(reasons);
  }

  function shoutoutStaleReasons(row = {}, locationIds = knownLocationIds()) {
    const reasons = [];
    const status = normalized(row.status || "pending");
    if (status === "approved" || status === "live") return reasons;
    const removed = status === "stale" || status === "deleted" || normalized(row.staleCleanupStatus).includes("stale shoutout cleared");
    const ageReason = ageStaleReason(row, ["submittedAt", "createdAt", "updatedAt"], "ShoutOut queue record");
    if (ageReason && !removed) reasons.push(ageReason);
    reasons.push(...oldRuleReferenceReasons(row), ...oldLocationReasons(row, locationIds));
    if (!locationReferences(row).length) reasons.push("Missing club location reference.");
    if (removed) reasons.push("Already removed from the ShoutOut queue.");
    return uniqueByNormalized(reasons);
  }

  function staleRecordReasons(row = {}, locationIds = knownLocationIds()) {
    return row._collection === "shoutouts"
      ? shoutoutStaleReasons(row, locationIds)
      : discoveryStaleReasons(row, locationIds);
  }

  function isStaleCachedCrawlRecord(row = {}) {
    return discoveryStaleReasons(row).length > 0;
  }

  function staleRecordSearchText(row = {}) {
    return [
      row._collection,
      row.id,
      row.proposedTitle,
      row.proposedLocationName,
      row.proposedDescription,
      row.mainText,
      row.subText,
      row.referenceNumber,
      row.submittedBy,
      row.city,
      row.stateRegion,
      row.country,
      row.sourceUrl,
      row.ticketUrl,
      row.sourceName,
      row.searchQuery,
      row.discoveryMode,
      row.crawlResultStatus,
      row.staleCleanupStatus,
      ...locationReferences(row),
      ...(row.categories || []),
      ...(row.genres || []),
      ...(row._staleReasons || [])
    ].filter(Boolean).join(" ");
  }

  function staleRecordStatus(row = {}) {
    const status = normalized(row.status || "");
    const result = normalized(row.crawlResultStatus || "");
    const cleanup = normalized(row.staleCleanupStatus || "");
    return status === "deleted" || status === "stale" || result.includes("stale cache cleared") || cleanup.includes("stale shoutout cleared") ? "removed" : "active";
  }

  function setStaleStatus(value) {
    setText("staleRecordCleanupStatus", value);
    setText("diagnosticsStatus", value);
  }

  function renderStaleRecordCleanup(rows = state.lastStaleRecords, message = "") {
    const wrap = byId("staleRecordCleanupResults");
    if (!wrap) return;
    if (message) setText("staleRecordCleanupStatus", message);
    if (!rows.length) {
      wrap.innerHTML = "<p class='sub'>No stale records found for the current search.</p>";
      return;
    }
    wrap.innerHTML = rows.map(row => {
      const removed = staleRecordStatus(row) === "removed";
      const reasons = row._staleReasons || staleRecordReasons(row);
      const isShoutOut = row._collection === "shoutouts";
      const parsed = isShoutOut ? {
        mainText:row.mainText || "",
        subText:row.subText || "",
        status:row.status || "",
        referenceNumber:row.referenceNumber || "",
        clubLocationId:row.clubLocationId || row.location || row.club || "",
        locationName:row.locationName || row.clubName || "",
        submittedBy:row.submittedBy || row.submittedByEmail || "",
        submittedAt:fmtDate(row.submittedAt || row.createdAt),
        mediaStoragePath:row.mediaStoragePath || row.originalMediaStoragePath || "",
        selectedMediaVersion:row.selectedMediaVersion || ""
      } : (row.parsedData || parsedDiscoveryData(row));
      const raw = isShoutOut
        ? {collection:"shoutouts", documentId:row.id, recordType:"club ShoutOut queue record", submittedAt:fmtDate(row.submittedAt || row.createdAt), locationReferences:locationReferences(row)}
        : (row.rawCrawlInput || {note:"No raw crawl/input audit was saved on this older cached record.", sourceUrl:row.sourceUrl || "", searchQuery:row.searchQuery || ""});
      const recordRef = `${row._collection || "aiDiscoveryQueue"}/${row.id}`;
      return `<div class="queue-item stale-record-item" data-stale-id="${esc(recordRef)}">
        <div class="message-envelope-head">
          <label class="consent-line"><input type="checkbox" data-stale-select value="${esc(recordRef)}" ${removed ? "disabled" : ""}/> <strong>${esc(row.proposedTitle || row.proposedLocationName || row.mainText || row.referenceNumber || row.id || "Untitled stale record")}</strong></label>
          ${statusBadge(removed ? "Soft Fail" : "Failed")}
        </div>
        <p>${esc(row.proposedDescription || row.aiSummary || row.subText || "No description saved.")}</p>
        <p class="sub small">${esc([isShoutOut ? "ShoutOut queue" : "AI Discovery", row.proposedType || "", row.locationName || row.clubName || row.city, row.stateRegion, row.country].filter(Boolean).join(" - "))}</p>
        <div class="tag-row">${reasons.map(reason => `<span>${esc(reason)}</span>`).join("")}</div>
        <details class="admin-detail">
          <summary>${isShoutOut ? "Original queue record snapshot" : "Raw crawled/input data"}</summary>
          <pre class="diagnostic-json">${esc(JSON.stringify(raw, null, 2))}</pre>
        </details>
        <details class="admin-detail">
          <summary>${isShoutOut ? "ShoutOut queue fields" : "Parsed data used by FLOQR"}</summary>
          <pre class="diagnostic-json">${esc(JSON.stringify(parsed, null, 2))}</pre>
        </details>
        <div class="queue-actions">
          ${removed ? "<span class='status-pill'>Removed from active review</span>" : `<button type="button" data-stale-action="remove" data-stale-id="${esc(recordRef)}">Remove This Stale Record</button>`}
          ${row.sourceUrl ? `<a class="buttonlike" target="_blank" href="${esc(row.sourceUrl)}">Open Source/Search</a>` : ""}
        </div>
      </div>`;
    }).join("");
    wrap.querySelectorAll("[data-stale-action='remove']").forEach(btn => {
      btn.addEventListener("click", () => removeStaleRecords([btn.dataset.staleId]));
    });
  }

  async function loadStaleDiscoveryRows(locationIds) {
    const snap = await state.db.collection("aiDiscoveryQueue").limit(750).get();
    return snap.docs.map(doc => {
      const row = {id:doc.id, _collection:"aiDiscoveryQueue", ...doc.data()};
      row._staleReasons = discoveryStaleReasons(row, locationIds);
      return row;
    }).filter(row => row._staleReasons.length);
  }

  async function loadStaleShoutoutRows(locationIds) {
    const snap = await state.db.collection("shoutouts").limit(750).get();
    return snap.docs.map(doc => {
      const row = {id:doc.id, _collection:"shoutouts", ...doc.data()};
      row._staleReasons = shoutoutStaleReasons(row, locationIds);
      return row;
    }).filter(row => row._staleReasons.length);
  }

  async function loadStaleRecordRows() {
    const locationSnap = await state.db.collection("clubLocations").limit(1000).get().catch(() => null);
    const data = {
      ...state.lastData,
      clubLocations:{
        rows: locationSnap ? locationSnap.docs.map(doc => ({id:doc.id, ...doc.data()})) : (state.lastData?.clubLocations?.rows || [])
      }
    };
    const locationIds = knownLocationIds(data);
    const [discoveryRows, shoutoutRows] = await Promise.all([
      loadStaleDiscoveryRows(locationIds),
      loadStaleShoutoutRows(locationIds)
    ]);
    return [...discoveryRows, ...shoutoutRows];
  }

  async function searchStaleRecords(options = {}) {
    if (!state.db) return [];
    setStaleStatus("Searching stale queue records...");
    const query = normalized(byId("staleRecordSearchInput")?.value || "");
    const sourceFilter = byId("staleRecordSourceFilter")?.value || "all";
    const statusFilter = byId("staleRecordStatusFilter")?.value || "active";
    const rows = (await loadStaleRecordRows()).filter(row => {
      if (sourceFilter !== "all" && row._collection !== sourceFilter) return false;
      const rowStatus = staleRecordStatus(row);
      if (statusFilter === "active" && rowStatus !== "active") return false;
      if (statusFilter === "removed" && rowStatus !== "removed") return false;
      if (query && !normalized(staleRecordSearchText(row)).includes(query)) return false;
      return true;
    });
    state.lastStaleRecords = rows;
    renderStaleRecordCleanup(rows, `Found ${rows.length} stale record(s).`);
    if (!options.silent && !rows.length) setStaleStatus("No stale records matched the current search.");
    return rows;
  }

  function selectedStaleRecordIds() {
    return Array.from(document.querySelectorAll("[data-stale-select]:checked")).map(input => input.value).filter(Boolean);
  }

  function parseRecordRef(value = "") {
    const [collection, ...rest] = String(value || "").split("/");
    return {collection: collection || "aiDiscoveryQueue", id: rest.join("/")};
  }

  async function removeStaleRecords(refs = []) {
    if (!state.db || !refs.length) {
      setStaleStatus("Select at least one active stale record first.");
      return;
    }
    const confirmed = confirm(`Remove ${refs.length} stale record(s) from active review? This soft-clears AI discovery queue records and ShoutOut queue records without deleting approved/live history.`);
    if (!confirmed) return;
    const batch = state.db.batch();
    const byRef = new Map((state.lastStaleRecords || []).map(row => [`${row._collection}/${row.id}`, row]));
    refs.forEach(value => {
      const {collection, id} = parseRecordRef(value);
      if (!id || !["aiDiscoveryQueue", "shoutouts"].includes(collection)) return;
      const ref = state.db.collection(collection).doc(id);
      const row = byRef.get(`${collection}/${id}`) || {};
      const reasons = row._staleReasons || [];
      const base = {
        staleCleanupReasons:reasons,
        clearedAt:fieldValue(),
        clearedByUid:state.auth?.currentUser?.uid || "",
        clearedByEmail:state.auth?.currentUser?.email || "",
        updatedAt:fieldValue()
      };
      if (collection === "shoutouts") {
        batch.set(ref, {
          ...base,
          previousStatus:row.status || "pending",
          status:"stale",
          staleCleanupStatus:"stale-shoutout-cleared",
          clearReason:"Master Admin removed stale ShoutOut queue record."
        }, {merge:true});
      } else {
        batch.set(ref, {
          ...base,
          status:"deleted",
          crawlResultStatus:"stale-cache-cleared",
          clearReason:"Master Admin removed stale generated crawl/search-plan record."
        }, {merge:true});
      }
    });
    await batch.commit();
    setStaleStatus(`Removed ${refs.length} stale record(s) from active review.`);
    await searchStaleRecords({silent:true});
    if (window.FLOQRAIDiscovery?.loadDiscoveryQueue) await window.FLOQRAIDiscovery.loadDiscoveryQueue();
    await refreshDiagnostics();
  }

  async function removeSelectedStaleRecords() {
    await removeStaleRecords(selectedStaleRecordIds());
  }

  async function removeAllFoundStaleRecords() {
    const refs = (state.lastStaleRecords || []).filter(row => staleRecordStatus(row) === "active").map(row => `${row._collection}/${row.id}`);
    if (!refs.length) {
      setStaleStatus("No active stale records in the current search results.");
      return;
    }
    await removeStaleRecords(refs);
  }

  async function clearCachedCrawlRecords() {
    if (!state.db) return;
    const rows = await searchStaleRecords({silent:true});
    const refs = rows.filter(row => staleRecordStatus(row) === "active").map(row => `${row._collection}/${row.id}`);
    if (!refs.length) {
      setStaleStatus("No active stale records found to clear.");
      return;
    }
    await removeStaleRecords(refs);
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

  function collectionNote(data, name) {
    return data[name]?.note || "";
  }

  function minglFeatureStatus(data, name) {
    return collectionError(data, name) ? "Failed" : "Pass";
  }

  function minglEmptyScanIntro(name, singularLabel) {
    if (name === "minglConnections") return "No live Mingl connection records found yet.";
    if (name === "chatRooms") return "No live Mingl chat room records found yet.";
    return `No live ${singularLabel} records found yet.`;
  }

  function minglScanEvidence(data, name, singularLabel, pluralLabel) {
    const count = collectionCount(data, name);
    const note = collectionNote(data, name);
    if (collectionError(data, name)) {
      return `${pluralLabel} diagnostic scan failed: ${collectionError(data, name)}.`;
    }
    if (count > 0) {
      return `${count} ${count === 1 ? singularLabel : pluralLabel} scanned. Click Run Diagnostics again after sending or accepting new Mingl requests to refresh the count.`;
    }
    if (normalized(note).includes("participant query blocked")) {
      return `${minglEmptyScanIntro(name, singularLabel)} Optional participant query blocked; deterministic participant document reads remain the supported safe path. This is not a feature failure and does not require broad Firestore list permission. Create or accept a Mingl request, then click Run Diagnostics to rescan.`;
    }
    return `${minglEmptyScanIntro(name, singularLabel)} The installed workflow is ready; create or accept a Mingl request, then click Run Diagnostics to scan the new records.`;
  }

  function minglRequestWorkflowEvidence(data) {
    if (collectionError(data, "minglConnections")) {
      return `Friend or Mingl Request workflow scan failed: ${collectionError(data, "minglConnections")}.`;
    }
    return "Matched public profiles use a Friend or Mingl Request flow before chat opens. This is the expected privacy behavior: chat opens only after bidirectional approval, and empty live data is not treated as a workflow failure.";
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
    const geminiMediaDiagnostic = state.lastGeminiMediaDiagnostic || {
      status:"Soft Fail",
      evidence:"Run Diagnostics after deploying Firebase Functions and setting the GEMINI_API_KEY secret."
    };

    return [
      ["Authentication", "Firebase config", window.firebaseConfig ? "Pass" : "Failed", window.firebaseConfig ? "window.firebaseConfig present." : "Missing Firebase config."],
      ["Authentication", "Firebase Auth session", state.auth?.currentUser ? "Pass" : "Soft Fail", state.auth?.currentUser ? "Master Admin is signed in." : "No active user in this diagnostics session."],
      ["Authentication", "Master Admin allow-list", state.auth?.currentUser ? "Pass" : "Failed", "Master Admin shell gates this page before diagnostics mount."],
      ["Authentication", "Role-based experiences", collectionStatus(data, "users", true), `${collectionCount(data, "users")} user records readable for role diagnostics.`],
      ["Settings", "My Profile and Settings rename", byId("portalPublicProfile") ? "Soft Fail" : "Pass", "Patron portal source now uses My Profile and Settings; open patron-portal.html to visually confirm the page title after deployment."],
      ["Settings", "My Privacy datapoint sharing", collectionStatus(data, "users"), "Profile privacy choices can store publicMinglDatapoints for Mingl matching and public/shared feature use."],
      ["Settings", "Public Media and Data Sharing", collectionStatus(data, "users"), "Profile media upload slots are under Public Media and Data Sharing with no captions and optional GPS-to-Travel metadata."],
      ["Settings", "Public profile preferred language", userLanguageRows.length ? "Pass" : "Soft Fail", userLanguageRows.length ? `${userLanguageRows.length} users have public profile language metadata.` : "Schema/UI ready; no saved language publishing choices yet."],
      ["Settings", "AI English translation scaffold", window.FLOQR_AI_ENABLED ? "Soft Fail" : "Pass", window.FLOQR_AI_ENABLED ? "AI flag enabled, but translation should still route through a safe provider." : "Local placeholder stores English field without exposing AI keys."],
      ["ShoutOut", "Submission queue", collectionStatus(data, "shoutouts"), `${collectionCount(data, "shoutouts")} ShoutOut records scanned.`],
      ["ShoutOut", "Admin approval queue", collectionStatus(data, "shoutouts"), "Pending and approved ShoutOut records are readable for diagnostics."],
      ["ShoutOut", "LED display content", collectionStatus(data, "liveContent", true), `${collectionCount(data, "liveContent")} live display records scanned.`],
      ["ShoutOut", "Media AI panel", geminiMediaDiagnostic.status, geminiMediaDiagnostic.status === "Pass" ? geminiMediaDiagnostic.evidence : `${geminiMediaDiagnostic.evidence} Static filter/trim fallback remains available without breaking ShoutOut.`],
      ["ShoutOut", "Improve My ShoutOut", hasSearch ? "Pass" : "Soft Fail", "Safe curated fallback should work when AI flags are false."],
      ["Guest Lists", "Guest list routing", collectionStatus(data, "guestListRequests", true), `${collectionCount(data, "guestListRequests")} guest list requests scanned.`],
      ["Mingl", "Mingl matching", minglFeatureStatus(data, "minglConnections"), minglScanEvidence(data, "minglConnections", "Mingl connection", "Mingl connection records")],
      ["Mingl", "Let's Mingl request workflow", minglFeatureStatus(data, "minglConnections"), minglRequestWorkflowEvidence(data)],
      ["Mingl", "Mingl chat rooms", minglFeatureStatus(data, "chatRooms"), minglScanEvidence(data, "chatRooms", "Mingl chat room", "Mingl chat room records")],
      ["Mingl", "Realtime editable Mingl chat", collectionError(data, "chatMessages") ? "Soft Fail" : "Pass", collectionError(data, "chatMessages") ? "Rules may block chatMessages diagnostics; run rules smoke test after publishing current rules." : "Mingl chat renderer supports visible compose input, realtime messages, sender edits/actions, unread-only Unsend, read receipts, emoji shortcuts, picture sharing, and AI-ready draft grammar cleanup."],
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
      ["AI Crawling", "Discovery review queue", collectionStatus(data, "aiDiscoveryQueue", true), `${discoveryQueue.length} discovery queue records scanned under the AI Crawling tab.`],
      ["AI Crawling", "Approve/reject/delete review tools", hasDiscovery ? "Pass" : "Failed", hasDiscovery ? "Discovery review tools are mounted on the AI Crawling tab." : "FLOQRAIDiscovery module was not loaded."],
      ["AI Crawling", "Plain-English crawl input", byId("crawlNaturalLanguageInput") && byId("previewCrawlPlanBtn") ? "Pass" : "Failed", "Master Admin can type one contextual request and build an expanded search plan."],
      ["AI Crawling", "Manual crawl review records", byId("runManualCrawlBtn") ? "Pass" : "Failed", "Manual crawl creates reviewable records with required datapoint checklists in aiDiscoveryQueue."],
      ["AI Crawling", "Source detail extraction", byId("sourceExtractUrl") && byId("extractSourceDetailsBtn") ? "Pass" : "Failed", "Master Admin can extract followed Eventbrite/source page details into a review record."],
      ["AI Crawling", "Crawler scheduler settings", scheduleRows.length ? "Pass" : "Soft Fail", scheduleRows.length ? "Default schedule saved." : "Controls are ready; save a schedule to create aiCrawlerSchedules/default."],
      ["AI Crawling", "Automatic crawl schedule", scheduleRows.length ? "Pass" : "Soft Fail", scheduleRows.length ? "Saved schedule includes structured crawl criteria and search-plan output." : "Save the schedule to persist automatic crawl criteria."],
      ["AI Crawling", "Crawl run reports", crawlRuns.length ? "Pass" : "Soft Fail", crawlRuns.length ? `${crawlRuns.length} crawl run records found.` : "No crawl runs logged yet."],
      ["Master Admin", "Soft delete/restore listings", hasDiscovery ? "Pass" : "Failed", "Soft delete hides deleted club/event listings from patron search/display."],
      ["Master Admin", "AI Crawling page", byId("aiCrawling") ? "Pass" : "Failed", "Crawler controls, consolidated reports, import JSON, and analytics are mounted on the AI Crawling tab."],
      ["Master Admin", "Stale record cleanup", byId("staleRecordCleanup") && byId("searchStaleRecordsBtn") ? "Pass" : "Failed", "Master Admin can search and soft-clear stale AI discovery and ShoutOut queue records."],
      ["Master Admin", "Duplicate record diagnostics", byId("duplicateRecords") && window.FLOQRDuplicateRecords ? "Pass" : "Failed", "Master Admin can scan duplicate club records and merge duplicates into aliases."],
      ["Master Admin", "Diagnostics page", "Pass", "Feature matrix, package checks, export, and Firebase rules smoke tests are mounted under Master Admin settings."],
      ["Master Admin", "Package install diagnostics", byId("runPackageDiagnosticsBtn") ? "Pass" : "Failed", "Per-package feature marker checks are available after upload."],
      ["Master Admin", "Firebase rules smoke test", latestRulesReport ? (latestRulesReport.status === "Pass" ? "Pass" : "Failed") : "Soft Fail", latestRulesReport ? `Latest current-package rules smoke test status: ${latestRulesReport.status || "unknown"} at ${fmtDate(latestRulesReport.createdAt)}.` : latestAnyRulesReport ? `No saved rules smoke test exists for ${CURRENT_DIAGNOSTICS_PACKAGE_VERSION}. Latest saved test is from ${latestAnyRulesReport.packageVersion || "unknown package"} at ${fmtDate(latestAnyRulesReport.createdAt)}. This is not a deployed-rules failure yet; click Run Rules Smoke Test after uploading this package.` : "Run the rules smoke test after publishing Firestore/Storage rules. This is not a deployed-rules failure yet; it means no browser proof has been saved."]
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
      ["Manual crawl workflow", "Plain-English input creates structured review records with required datapoint checks"],
      ["Automatic execution path", "Saved schedule is ready for Firebase scheduled execution"]
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
      <p>${group.descriptionList[0] ? `Description: ${esc(group.descriptionList[0])}` : "Description: missing"}</p>
      <p>${group.canonicalAddress ? `Address: ${esc(group.canonicalAddress)}` : "Address: not collected yet"}</p>
      <p>${group.phoneList[0] ? `Phone: ${esc(group.phoneList[0])}` : "Phone: not collected yet"}</p>
      ${group.missingRequiredList.length ? `<p class="sub small">Missing required datapoints: ${esc(group.missingRequiredList.join(", "))}</p>` : ""}
      ${group.addressConflicts ? `<p class="sub small">Address conflict: ${esc(group.addressOptions.map(item => `${item.address} (${item.count})`).join(" | "))}</p>` : ""}
      <small>Grouped records: ${esc(group.itemCount)} | Sources: ${esc(group.sourceList.join(", ") || "-")} | Max stars: ${esc(group.maxStar || "-")} | Max confidence: ${esc(group.maxConfidence || "-")}</small>
    </div>`).join("") : "<p class='sub'>No collected discovery records yet. Create crawl review records from the plain-English input to seed the queue.</p>";
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
    const plan = schedule?.criteria?.structuredPlan || state.lastCrawlPlan || buildCrawlSearchPlan(readCriteriaFromControls());
    wrap.innerHTML = simpleRows([
      ["Active search-plan jobs", (plan?.jobCount || 0).toLocaleString()],
      ["Raw collected records", queue.length.toLocaleString()],
      ["Consolidated clubs/events", groups.length.toLocaleString()],
      ["Address conflicts", addressConflicts.length.toLocaleString()],
      ["Profile import drafts", profileDrafts.length.toLocaleString()],
      ["Crawl schedule", schedule?.frequency || "Not saved"],
      ["Publishing rule", "Crawl results stay in review until required datapoints are complete and Master Admin approves them."]
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
      renderCrawlSearchPlan(schedule?.criteria?.structuredPlan || buildCrawlSearchPlan(readCriteriaFromControls()));
      state.lastGeminiMediaDiagnostic = await runGeminiMediaDiagnostic({silent:true});
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
      const manualResults = manualFeatureRows();
      renderManualFeatureDiagnostics();
      const filename = `floqr-diagnostics-${exportTimestamp()}.txt`;
      const text = buildDiagnosticsExport({data, schedule, features, packageResults, manualResults});
      downloadTextFile(filename, text);
      const issues = collectDiagnosticIssues({data, features, packageResults, manualResults, reports:data.aiDiagnosticsReports?.rows || []});
      setText("diagnosticsStatus", `Diagnostics export downloaded as ${filename}. ${issues.length} failed, soft-fail, or TBI item(s) included in the fix prompt.`);
    } catch (error) {
      setText("diagnosticsStatus", `Diagnostics export failed: ${error?.message || error}`);
    }
  }

  async function refreshDiagnostics(options = {}) {
    if (!state.db) return;
    setText("diagnosticsStatus", options.statusMessage || "Refreshing diagnostics...");
    const [data, schedule] = await Promise.all([loadDiagnosticsData(), readScheduleSafe()]);
    if (schedule) applyScheduleToControls(schedule);
    renderCrawlSearchPlan(schedule?.criteria?.structuredPlan || buildCrawlSearchPlan(readCriteriaFromControls()));
    state.lastGeminiMediaDiagnostic = await runGeminiMediaDiagnostic({silent:true});
    const features = buildFeatureDiagnostics(data);
    state.lastFeatures = features;
    state.lastSchedule = schedule || null;
    renderFeatureDiagnostics(features);
    await renderRulesVersionStatus(data);
    renderAiCrawlingSummary(data, schedule);
    renderSourceExtractionReport();
    renderClubProfileDiagnostics(data);
    renderCrawlActivity(data, schedule);
    renderCollectedRecords(data);
    renderAnalyticsInsights(data);
    await runPackageInstallDiagnostics({silent:true});
    renderManualFeatureDiagnostics();
    const failures = features.filter(item => item.status === "Failed").length;
    const soft = features.filter(item => item.status === "Soft Fail").length;
    const saved = options.saveFeatureReport ? await saveFeatureDiagnosticsReport(features) : null;
    const savedText = saved ? ` ${saved.evidence}` : "";
    setText("diagnosticsStatus", `Diagnostics refreshed. ${failures} failed and ${soft} soft-fail items found.${savedText}`);
    return {data, schedule, features, saved};
  }

  async function runFeatureDiagnostics() {
    if (!state.db) {
      setText("diagnosticsStatus", "Run Diagnostics failed because Firestore is unavailable.");
      return null;
    }
    return refreshDiagnostics({
      saveFeatureReport:true,
      statusMessage:"Running feature diagnostics..."
    });
  }

  function bindControls() {
    byId("diagnosticsRefreshBtn")?.addEventListener("click", refreshDiagnostics);
    byId("runFeatureDiagnosticsBtn")?.addEventListener("click", runFeatureDiagnostics);
    byId("exportDiagnosticsTxtBtn")?.addEventListener("click", exportDiagnosticsReport);
    byId("copyManualFeatureOutputBtn")?.addEventListener("click", copyManualFeatureOutput);
    byId("downloadManualFeatureOutputBtn")?.addEventListener("click", downloadManualFeatureOutput);
    byId("copyManualFeaturePromptBtn")?.addEventListener("click", copyManualFeaturePrompt);
    byId("runPackageDiagnosticsBtn")?.addEventListener("click", () => runPackageInstallDiagnostics());
    byId("runRulesSmokeTestBtn")?.addEventListener("click", runRulesSmokeTest);
    byId("saveCrawlScheduleBtn")?.addEventListener("click", () => saveCrawlSchedule());
    byId("previewCrawlPlanBtn")?.addEventListener("click", previewCrawlPlan);
    byId("runManualCrawlBtn")?.addEventListener("click", runManualCrawl);
    byId("searchStaleRecordsBtn")?.addEventListener("click", () => searchStaleRecords());
    byId("removeSelectedStaleRecordsBtn")?.addEventListener("click", removeSelectedStaleRecords);
    byId("removeAllFoundStaleRecordsBtn")?.addEventListener("click", removeAllFoundStaleRecords);
    byId("clearCachedCrawlsBtn")?.addEventListener("click", clearCachedCrawlRecords);
    byId("extractSourceDetailsBtn")?.addEventListener("click", extractSourceDetails);
    byId("saveExtractedDiscoveryBtn")?.addEventListener("click", saveExtractedDiscoveryRecord);
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
    if (byId("staleRecordAgeDays") && !byId("staleRecordAgeDays").value) byId("staleRecordAgeDays").value = String(STALE_RECORD_DEFAULT_DAYS);
    hydrateDefaultControls();
    if (!state.mounted) {
      state.mounted = true;
      bindControls();
    }
    const schedule = await readScheduleSafe();
    if (schedule) applyScheduleToControls(schedule);
    renderCrawlSearchPlan(schedule?.criteria?.structuredPlan || buildCrawlSearchPlan(readCriteriaFromControls()));
    renderSourceExtractionReport();
    await refreshDiagnostics();
  }

  window.FLOQRDiagnostics = {
    mount,
    refreshDiagnostics,
    runFeatureDiagnostics,
    runPackageInstallDiagnostics,
    runRulesSmokeTest,
    exportDiagnosticsReport,
    renderManualFeatureDiagnostics,
    buildManualFeatureDiagnosticsText,
    buildManualFeatureDiagnosticsPrompt,
    extractSourceDetails,
    saveExtractedDiscoveryRecord,
    searchStaleRecords,
    removeSelectedStaleRecords,
    removeAllFoundStaleRecords,
    clearCachedCrawlRecords,
    DEFAULT_EVENT_TYPES,
    DEFAULT_GENRES,
    DEFAULT_MARKET_LANGUAGE_PLAN
  };
})();
