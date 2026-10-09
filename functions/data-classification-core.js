/* FLOQR data classification — packaged register, access model, rules exposure check.
   Same file is served to the browser as floqr-data-classification.js (byte-identical; a test enforces it).
   Design notes: .cursor/rules/design-notes-data-classification.mdc */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FLOQRDataClassification = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COLLECTION = "dataClassification";
  const TIERS = ["isPatronAccessible", "isRegularEmployeeAccessible", "isPrivilegedEmployeeAccessible", "isClubAdminAccessible", "isMasterAdminAccessible"];
  const FLAGS = ["isPublicAccessible", ...TIERS, "ownRecordReadable", "containsPII"];
  /** Platform server identity (Admin SDK jobs, FloqAi resolver). Always 1, never editable, never a client role. */
  const SYSTEM_FLAG = "isSystemAccessible";
  const LEVELS = ["public", "internal", "clubConfidential", "restricted", "secret"];
  const ROLES = ["anonymous", "patron", "regular", "privileged", "clubAdmin", "master", "system"];
  const CLIENT_ROLES = ROLES.filter(role => role !== "system");
  const ROLE_RANK = {patron: 1, regular: 2, privileged: 3, clubAdmin: 4};
  const MAX_RETENTION_DAYS = 3650;

  // public, patron, regular, privileged, clubAdmin, master, own
  const PRESETS = {
    public: [1, 1, 1, 1, 1, 1, 0],
    internal: [0, 1, 1, 1, 1, 1, 0],
    clubStaff: [0, 0, 1, 1, 1, 1, 0],
    clubPrivileged: [0, 0, 0, 1, 1, 1, 0],
    clubAdmin: [0, 0, 0, 0, 1, 1, 0],
    master: [0, 0, 0, 0, 0, 1, 0],
    secret: [0, 0, 0, 0, 0, 0, 0],
    ownMaster: [0, 0, 0, 0, 0, 1, 1],
    ownClubStaff: [0, 0, 1, 1, 1, 1, 1],
    ownClubPrivileged: [0, 0, 0, 1, 1, 1, 1],
    ownClubAdmin: [0, 0, 0, 0, 1, 1, 1]
  };
  const CLUB_PRESETS = new Set(["clubStaff", "clubPrivileged", "clubAdmin", "ownClubStaff", "ownClubPrivileged", "ownClubAdmin"]);

  // [collection, preset, containsPII, description]
  const ROWS = [
    ["adAuditLogs", "master", 0, "Ad Management audit trail"],
    ["adCampaignPrivate", "master", 0, "Private ad campaign settings"],
    ["adEventDedupe", "secret", 0, "Ad event de-duplication keys"],
    ["adEventThrottle", "secret", 0, "Ad event rate limits"],
    ["adIntakeOptOuts", "master", 1, "Advertisers who opted out of SMS / WhatsApp intake"],
    ["adIntakeSubmissions", "master", 1, "Ad requests received by SMS / WhatsApp"],
    ["adInvoiceAccounts", "master", 1, "Advertiser billing accounts"],
    ["adInvoices", "master", 1, "Advertiser invoices"],
    ["adPosterDelegations", "master", 0, "Who may post ads for an advertiser"],
    ["adSettings", "public", 0, "Published ad prices"],
    ["adStats", "master", 0, "Ad impression totals"],
    ["adStatsDaily", "master", 0, "Daily ad impression totals"],
    ["aiAssistantMessages", "ownMaster", 1, "Patron conversations with the FLOQR assistant"],
    ["aiAssistantSessions", "ownMaster", 0, "Assistant conversation sessions"],
    ["aiCrawlerSchedules", "master", 0, "AI Crawling schedule"],
    ["aiCrawlRuns", "master", 0, "AI Crawling run history"],
    ["aiDiagnosticsReports", "master", 0, "Diagnostics reports"],
    ["aiDiscoveryQueue", "master", 1, "AI Crawling review queue (venue contacts)"],
    ["aiDiscoveryRatingCriteria", "master", 0, "AI Crawling rating weights"],
    ["aiDiscoverySources", "master", 0, "AI Crawling source websites"],
    ["aiIndex", "internal", 0, "Search index of published venues and events"],
    ["aiMediaEdits", "ownMaster", 0, "AI photo edits made by a patron"],
    ["aiRecommendations", "ownMaster", 0, "Personal recommendations"],
    ["aiSearchLogs", "master", 0, "FloqAi search history"],
    ["aiTemplatePromptHistory", "ownMaster", 0, "Patron AI template prompts"],
    ["aiUserNotificationPreferences", "ownMaster", 0, "Patron notification choices"],
    ["aiUserSignals", "ownMaster", 0, "Patron interest signals"],
    ["appLogs", "master", 0, "Application logs"],
    ["approvedShoutOutLibrary", "public", 0, "Approved ShoutOut ideas"],
    ["audienceCampaigns", "clubAdmin", 0, "Club audience campaigns"],
    ["betaInvites", "master", 1, "Beta tester invitations"],
    ["betaTesters", "ownMaster", 0, "Beta testers and their features"],
    ["chatMessages", "ownMaster", 1, "Private chat messages (participants only)"],
    ["chatRooms", "ownMaster", 0, "Private chat rooms (participants only)"],
    ["clubAdminAssignments", "clubAdmin", 1, "Who administers each club"],
    ["clubAdminNotifications", "clubAdmin", 0, "Club Admin alerts"],
    ["clubDailyAuthCodes", "clubPrivileged", 0, "Daily door / staff codes"],
    ["clubEmployeeDesignations", "ownClubPrivileged", 1, "Club staff roster and roles"],
    ["clubLocationAliases", "public", 0, "Merged venue aliases"],
    ["clubLocations", "public", 0, "Published venue profiles"],
    ["clubMarketingCampaigns", "clubAdmin", 0, "Club marketing campaigns"],
    ["clubMedia", "public", 0, "Published venue photos and videos"],
    ["clubMessageDeliveries", "clubAdmin", 1, "Messages a club sent to patrons"],
    ["clubMessageInbound", "clubAdmin", 1, "Replies patrons sent to a club"],
    ["clubMessagingCredits", "clubAdmin", 0, "Club messaging credits"],
    ["clubNotificationSettings", "clubAdmin", 0, "Club notification settings and templates"],
    ["clubOnboardingRecords", "clubAdmin", 1, "Club onboarding paperwork"],
    ["clubRoleActivity", "clubPrivileged", 0, "Staff role activity"],
    ["clubRolePolicies", "clubStaff", 0, "Club staff role policies"],
    ["clubs", "public", 0, "Published clubs"],
    ["clubTemplateVariants", "public", 0, "Club ShoutOut template versions"],
    ["commerceProducts", "public", 0, "BartR store products"],
    ["dataClassification", "master", 0, "This classification register"],
    ["displayAccessLogs", "clubAdmin", 0, "Display board access logs"],
    ["displayBoardSecrets", "secret", 0, "Display board keys"],
    ["displayDevices", "public", 0, "Registered display devices (display boards read them without sign-in)"],
    ["djProfiles", "public", 0, "Published DJ profiles"],
    ["emailOtpChallenges", "secret", 1, "Email sign-in codes (hashed)"],
    ["entityFollows", "ownMaster", 0, "Venues and people a patron follows"],
    ["events", "public", 0, "Published events"],
    ["featureServiceAccessThrottle", "secret", 0, "Feature access rate limits"],
    ["featureServiceAuditHead", "master", 0, "Audit chain head"],
    ["featureServiceAuditLogs", "master", 1, "Tamper-evident security audit trail"],
    ["featureServices", "internal", 0, "Feature switches"],
    ["floqAiAccessThrottle", "secret", 0, "FloqAi access-denial log rate limits"],
    ["friendRequests", "ownMaster", 0, "Friend requests"],
    ["friendships", "ownMaster", 0, "Friend connections"],
    ["guestListCampaigns", "public", 0, "Published guest list offers"],
    ["guestListRequests", "ownClubStaff", 1, "Guest list sign-ups"],
    ["inboxNotifications", "ownMaster", 1, "Patron Inbox messages"],
    ["liveContent", "public", 0, "Content playing on display boards"],
    ["messages", "ownMaster", 1, "Mingl messages (participants only)"],
    ["minglAudit", "master", 0, "Mingl moderation audit"],
    ["minglConnections", "ownMaster", 0, "Mingl connections"],
    ["minglGists", "public", 0, "Public Mingl posts"],
    ["mobileTestRuns", "master", 0, "Mobile test runs"],
    ["notifications", "ownMaster", 0, "Patron notifications"],
    ["patronRanks", "public", 0, "Patron leaderboard"],
    ["patronShoutoutArchives", "ownMaster", 0, "A patron's ShoutOut history"],
    ["patronTemplateVariants", "ownMaster", 0, "A patron's saved templates"],
    ["paymentLedger", "clubAdmin", 1, "Payments and payouts"],
    ["pickupRequests", "ownMaster", 1, "RydR pickup requests"],
    ["platformSettings", "public", 0, "Public platform settings"],
    ["privacyConsents", "ownMaster", 1, "Privacy consent records"],
    ["promoterOnboardingRecords", "ownMaster", 1, "Promoter onboarding paperwork"],
    ["promoterProfiles", "public", 0, "Published promoter profiles"],
    ["promotionGroups", "internal", 0, "Promotion groups"],
    ["roleRequests", "ownClubAdmin", 1, "Requests to join a club role"],
    ["scheduleNotifyQueue", "clubPrivileged", 1, "Pending staff schedule notifications"],
    ["scheduleShiftAudit", "clubPrivileged", 0, "Staff schedule change history"],
    ["scheduleShifts", "ownClubStaff", 0, "Staff schedule shifts"],
    ["schedulingSubscriptions", "clubAdmin", 0, "Club scheduling subscription"],
    ["serviceOrders", "ownClubAdmin", 1, "Paid service orders"],
    ["shoutoutAudit", "clubAdmin", 0, "ShoutOut moderation history"],
    ["shoutoutComplianceLogs", "master", 1, "ShoutOut compliance logs"],
    ["shoutoutComplianceMeta", "master", 0, "ShoutOut compliance settings"],
    ["shoutoutRecommendations", "internal", 0, "ShoutOut suggestions"],
    ["shoutouts", "ownClubStaff", 1, "ShoutOut requests (board text shows on the venue display)"],
    ["sos2faChallenges", "secret", 1, "SOS2FA sign-in challenges"],
    ["sos2faRecoveryAttempts", "secret", 0, "SOS2FA recovery code attempts"],
    ["sos2faSessions", "secret", 0, "SOS2FA unlocked sessions"],
    ["sos2faTotp", "secret", 0, "SOS2FA authenticator secrets"],
    ["spotAdCampaigns", "public", 0, "Ads shown on display boards"],
    ["staffMarketingConsentLogs", "ownClubAdmin", 1, "Staff marketing media consent evidence"],
    ["staffMarketingConsentThrottle", "secret", 0, "Staff consent change rate limits"],
    ["stripeConnectAccounts", "clubAdmin", 1, "Club payout accounts"],
    ["stripeWebhookEvents", "secret", 0, "Payment processor events"],
    ["suprstarRequests", "ownClubAdmin", 1, "supRstar live video requests"],
    ["suprstrEntitlements", "ownMaster", 0, "supRstar purchases"],
    ["suprstrLive", "public", 0, "supRstar live pointer for display boards"],
    ["suprstrSessions", "public", 0, "supRstar live sessions for display boards"],
    ["suprstrSessions/calleeCandidates", "public", 0, "supRstar display connection details"],
    ["suprstrSessions/callerCandidates", "public", 0, "supRstar phone connection details"],
    ["system", "master", 0, "System records"],
    ["systemMailLogs", "master", 1, "Email delivery logs"],
    ["templates", "public", 0, "ShoutOut templates"],
    ["translationOverrides", "public", 0, "Translation corrections"],
    ["translationSettings", "public", 0, "Translation settings"],
    ["twilioComplianceLogs", "master", 1, "SMS / WhatsApp compliance logs"],
    ["twilioDebuggerEvents", "master", 0, "Messaging error events"],
    ["twilioFeatureLogs", "master", 0, "Messaging feature logs"],
    ["twilioSmsLogs", "clubAdmin", 1, "SMS delivery logs"],
    ["twilioWhatsAppLogs", "clubAdmin", 1, "WhatsApp delivery logs"],
    ["userBlocks", "ownMaster", 0, "Blocked people"],
    ["users", "ownMaster", 1, "Patron accounts (name, email, phone, preferences)"],
    ["venueTemplateRoles", "clubAdmin", 0, "Who may manage a venue's templates"],
    ["venueTemplateTags", "public", 0, "Venue template tags"],
    ["workerAssociationRequests", "ownClubAdmin", 1, "Staff requests to join a club"]
  ];

  function flag(value) {
    return value === 1 || value === true || value === "1" ? 1 : 0;
  }

  function presetRow([collection, preset, pii, description]) {
    const p = PRESETS[preset];
    return {
      collection,
      description,
      scope: CLUB_PRESETS.has(preset) ? "club" : "platform",
      isPublicAccessible: p[0],
      isPatronAccessible: p[1],
      isRegularEmployeeAccessible: p[2],
      isPrivilegedEmployeeAccessible: p[3],
      isClubAdminAccessible: p[4],
      isMasterAdminAccessible: p[5],
      ownRecordReadable: p[6],
      containsPII: pii ? 1 : 0,
      retentionDays: 0
    };
  }

  // Field-level overrides inside a broader collection: [collection, field, preset, containsPII, description]
  const FIELD_ROWS = [
    ["users", "marketingMediaConsent", "ownClubAdmin", 1, "Staff consent to appear in a club's marketing media (Club Admins of the affiliated club)"],
    ["users", "email", "ownMaster", 1, "Account email"],
    ["users", "phone", "ownMaster", 1, "Account phone number"],
    ["clubEmployeeDesignations", "workerEmail", "ownClubAdmin", 1, "Staff member email"],
    ["clubEmployeeDesignations", "workerPhone", "ownClubAdmin", 1, "Staff member phone number"]
  ];

  const CATALOG = ROWS.map(presetRow);
  const FIELD_CATALOG = FIELD_ROWS.map(([collection, field, preset, pii, description]) => {
    const row = cumulative(presetRow([`${collection}.${field}`, preset, pii, description]));
    return {...row, parent: collection, field, [SYSTEM_FLAG]: 1, classificationLevel: deriveLevel(row)};
  });
  const BY_COLLECTION = Object.fromEntries(CATALOG.map(row => [row.collection, row]));
  const COLLECTIONS = CATALOG.map(row => row.collection);

  /** Tiers are cumulative upward: anything a lower tier reads, every higher tier reads. Public implies every tier. */
  function cumulative(row) {
    const out = {...row};
    if (out.isPublicAccessible) TIERS.forEach(key => { out[key] = 1; });
    for (let i = 1; i < TIERS.length; i += 1) {
      if (out[TIERS[i - 1]]) out[TIERS[i]] = 1;
    }
    if (out.ownRecordReadable && !out.isMasterAdminAccessible) out.isMasterAdminAccessible = 1;
    return out;
  }

  function deriveLevel(row) {
    if (!TIERS.some(key => row[key]) && !row.ownRecordReadable) return "secret";
    if (row.isPublicAccessible) return "public";
    if (row.isPatronAccessible) return "internal";
    if (row.isRegularEmployeeAccessible || row.isPrivilegedEmployeeAccessible) return "clubConfidential";
    return "restricted";
  }

  function docIdFor(collection) {
    return String(collection || "").split("/").join("__");
  }

  function collectionFromDocId(docId) {
    return String(docId || "").split("__").join("/");
  }

  function retention(value) {
    const n = Math.floor(Number(value) || 0);
    return Math.min(Math.max(n, 0), MAX_RETENTION_DAYS);
  }

  function normalize(collection, doc) {
    const base = BY_COLLECTION[collection];
    if (!base) return null;
    const data = doc || {};
    const row = {...base};
    FLAGS.forEach(key => { if (data[key] !== undefined) row[key] = flag(data[key]); });
    if (data.retentionDays !== undefined) row.retentionDays = retention(data.retentionDays);
    const out = cumulative(row);
    out[SYSTEM_FLAG] = 1;
    out.classificationLevel = deriveLevel(out);
    out.revision = Math.max(0, Math.floor(Number(data.revision) || 0));
    out.updatedByEmail = String(data.updatedByEmail || "");
    out.updatedAtMs = Number(data.updatedAtMs || 0);
    out.lastChangeReason = String(data.lastChangeReason || "");
    return out;
  }

  function invalid(message) {
    const error = new Error(message);
    error.code = "invalid-argument";
    return error;
  }

  /** Validates a Master Admin edit. Returns {collection, next, reason} with normalized flags. */
  function validateChange(data) {
    const collection = String(data?.collection || "").trim();
    if (!BY_COLLECTION[collection]) throw invalid("Unknown collection.");
    const reason = String(data?.reason || "").trim();
    if (reason.length < 8) throw invalid("Enter a reason of at least 8 characters.");
    if (reason.length > 500) throw invalid("Keep the reason under 500 characters.");
    const raw = {};
    FLAGS.forEach(key => { raw[key] = flag(data?.[key]); });
    raw.retentionDays = retention(data?.retentionDays);
    const anyTier = TIERS.some(key => raw[key]) || raw.ownRecordReadable || raw.isPublicAccessible;
    if (anyTier && !raw.isMasterAdminAccessible) {
      throw invalid("Master Admins can read anything other people can read. To hide a collection from everyone, turn every switch off (Secret).");
    }
    const next = {...cumulative(raw), [SYSTEM_FLAG]: 1};
    return {collection, next, reason};
  }

  const COMPARE_KEYS = [...FLAGS, "retentionDays"];

  function diff(before, after) {
    return COMPARE_KEYS.filter(key => Number(before[key] || 0) !== Number(after[key] || 0));
  }

  /** Firestore transactions allow 500 writes; Save all writes every row plus the audit record and chain head. */
  const MAX_TX_WRITES = 500;

  /** Validates a Save all request: every listed row must be a known, unique collection. Returns {next: {collection: row}, reason}. */
  function validateSaveAll(data) {
    const reason = String(data?.reason || "").trim();
    if (reason.length < 8) throw invalid("Enter a reason of at least 8 characters.");
    if (reason.length > 500) throw invalid("Keep the reason under 500 characters.");
    const list = Array.isArray(data?.rows) ? data.rows : [];
    if (!list.length) throw invalid("Nothing to save.");
    if (list.length > COLLECTIONS.length) throw invalid("Too many rows.");
    const next = {};
    list.forEach(row => {
      const {collection, next: values} = validateChange({...row, reason});
      if (next[collection]) throw invalid(`${collection} is listed twice.`);
      next[collection] = values;
    });
    return {next, reason};
  }

  /**
   * Plans a Save all against the stored register (saved: {collection: doc|undefined}).
   * Rows never saved are created (from the request, else the packaged default); saved rows are written only when they change.
   */
  function planSaveAll(next, saved) {
    const writes = [];
    const unchanged = [];
    COLLECTIONS.forEach(collection => {
      const doc = saved?.[collection] || null;
      const before = normalize(collection, doc);
      const wanted = next?.[collection] || (doc ? null : before);
      if (!wanted) {
        unchanged.push(collection);
        return;
      }
      const after = normalize(collection, {...wanted, revision: before.revision + 1});
      const changed = diff(before, after);
      if (doc && !changed.length) unchanged.push(collection);
      else writes.push({collection, created: !doc, before, after, changed});
    });
    if (writes.length + 2 > MAX_TX_WRITES) throw invalid("Too many rows for one save.");
    return {writes, unchanged};
  }

  // ---- Owner review guidance ----

  /** Packaged defaults that depend on how the venue uses the data; each has a recommendation key (dataClass.rec.<key>). */
  const REVIEW_RECOMMENDATIONS = {
    shoutouts: "shoutouts",
    patronRanks: "patronRanks",
    displayDevices: "displayDevices",
    suprstrSessions: "suprstrSessions",
    "suprstrSessions/calleeCandidates": "suprstrSessions",
    "suprstrSessions/callerCandidates": "suprstrSessions",
    minglGists: "minglGists",
    guestListRequests: "guestListRequests",
    clubEmployeeDesignations: "clubEmployeeDesignations",
    featureServices: "featureServices",
    aiIndex: "aiIndex",
    paymentLedger: "paymentLedger"
  };

  /**
   * decide: owner judgment (personal data opened to everyone / all patrons, or a default that depends on venue use).
   * fix: live rules broader than the register (fixed by a rules release, not on the screen).
   */
  function reviewNotes(row, issues = []) {
    const decide = [];
    const fix = [];
    if (!row) return {decide, fix, recommendation: ""};
    if (row.containsPII && row.isPublicAccessible) decide.push("piiPublic");
    else if (row.containsPII && row.isPatronAccessible) decide.push("piiPatron");
    const recommendation = REVIEW_RECOMMENDATIONS[row.collection] || "";
    if (recommendation) decide.push("judgment");
    (issues || []).filter(issue => issue.collection === row.collection).forEach(issue => {
      const code = issue.kind === "writeOpen" ? "rulesWrite" : "rulesRead";
      if (!fix.includes(code)) fix.push(code);
    });
    return {decide, fix, recommendation};
  }

  /** Row status for the grid: edited (unsaved changes) > default (never saved) > saved; needsReview while owner judgment is unconfirmed. */
  function rowStatus({saved, edited, notes}) {
    const status = edited ? "edited" : saved ? "saved" : "default";
    const decide = notes?.decide || [];
    const needsReview = decide.some(code => code !== "judgment") || (decide.includes("judgment") && status !== "saved");
    return {status, needsReview};
  }

  /** Groups exposure issues into the fix list shown to the owner. */
  const FIX_GROUPS = ["piiRead", "restrictedWrite", "clubRead", "publicWrite", "openWrite"];

  function fixGroupFor(issue) {
    if (issue.kind === "writeOpen") {
      if (issue.rule === "public") return "openWrite";
      return issue.level === "public" || issue.level === "internal" ? "publicWrite" : "restrictedWrite";
    }
    return issue.severity === "high" ? "piiRead" : "clubRead";
  }

  function fixList(issues) {
    const groups = Object.fromEntries(FIX_GROUPS.map(key => [key, []]));
    (issues || []).forEach(issue => {
      const list = groups[fixGroupFor(issue)];
      if (!list.includes(issue.collection)) list.push(issue.collection);
    });
    return FIX_GROUPS.map(key => ({group: key, collections: groups[key].sort()})).filter(entry => entry.collections.length);
  }

  /** viewer: {role, sameClub, own}. Returns "yes" | "own" | "no". */
  function access(row, viewer) {
    if (!row) return "no";
    const role = ROLES.includes(viewer?.role) ? viewer.role : "anonymous";
    if (role === "system") return viewer?.server === true ? "yes" : "no";
    if (row.classificationLevel === "secret" || deriveLevel(row) === "secret") return "no";
    if (role === "master") return row.isMasterAdminAccessible ? "yes" : "no";
    if (row.isPublicAccessible) return "yes";
    if (role === "anonymous") return "no";
    if (row.isPatronAccessible) return "yes";
    const rank = ROLE_RANK[role] || 1;
    const clubOk = row.scope !== "club" || viewer?.sameClub !== false;
    if (clubOk) {
      if (rank >= 2 && row.isRegularEmployeeAccessible) return "yes";
      if (rank >= 3 && row.isPrivilegedEmployeeAccessible) return "yes";
      if (rank >= 4 && row.isClubAdminAccessible) return "yes";
    }
    return viewer?.own && row.ownRecordReadable ? "own" : "no";
  }

  function simulate(rows, viewer) {
    return rows.map(row => ({collection: row.collection, level: row.classificationLevel || deriveLevel(row), access: access(row, viewer)}));
  }

  // ---- Security rules breadth (static read of firestore.rules) ----

  const BREADTH_RANK = {none: 0, master: 1, scoped: 2, signedIn: 3, public: 4};
  const SIGNED_IN = new Set(["signedIn()", "isSignedIn()", "request.auth != null", "request.auth!=null"]);
  const MASTER = new Set(["isMasterAdmin()"]);

  function splitTopLevelOr(expr) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (ch === "(" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "]") depth -= 1;
      else if (depth === 0 && ch === "|" && expr[i + 1] === "|") {
        parts.push(expr.slice(start, i));
        start = i + 2;
        i += 1;
      }
    }
    parts.push(expr.slice(start));
    return parts.map(part => part.trim().replace(/^\((.*)\)$/s, "$1").trim()).filter(Boolean);
  }

  function exprBreadth(expr) {
    const e = String(expr || "").replace(/\s+/g, " ").trim();
    if (!e || e === "true") return "public";
    if (e === "false") return "none";
    const parts = splitTopLevelOr(e);
    if (parts.some(part => part === "true")) return "public";
    if (parts.some(part => SIGNED_IN.has(part))) return "signedIn";
    if (parts.every(part => MASTER.has(part))) return "master";
    if (parts.every(part => part === "false")) return "none";
    return "scoped";
  }

  function broader(a, b) {
    return BREADTH_RANK[a] >= BREADTH_RANK[b] ? a : b;
  }

  /** Parses firestore.rules into {collectionPath: {read, write}} using top-level `allow` statements per match block. */
  function parseRulesAccess(rulesText) {
    const src = String(rulesText || "").replace(/\/\/[^\n]*/g, "");
    const out = {};
    const stack = [];
    let depth = 0;
    let i = 0;
    const matchRe = /match\s+\/([A-Za-z_][A-Za-z0-9_]*)\/\{[^}]*\}[^{]*\{/y;
    const allowRe = /allow\s+([a-z,\s]+?)\s*(?::\s*if\s+([\s\S]*?))?;/y;
    const at = re => {
      if (/[A-Za-z0-9_.]/.test(src[i - 1] || "")) return null;
      re.lastIndex = i;
      return re.exec(src);
    };
    while (i < src.length) {
      const match = src[i] === "m" ? at(matchRe) : null;
      if (match) {
        depth += 1;
        const parent = stack.filter(entry => entry.name).map(entry => entry.name);
        const name = match[1] === "databases" || match[1] === "documents" ? "" : [...parent, match[1]].join("/");
        stack.push({name, depth});
        if (name && !out[name]) out[name] = {read: "none", write: "none"};
        i += match[0].length;
        continue;
      }
      const allow = src[i] === "a" ? at(allowRe) : null;
      if (allow) {
        const top = stack[stack.length - 1];
        const current = top && top.depth === depth && top.name ? top : null;
        if (current) {
          const ops = allow[1].split(",").map(op => op.trim());
          const breadth = exprBreadth(allow[2] === undefined ? "true" : allow[2]);
          if (ops.some(op => op === "read" || op === "get" || op === "list")) out[current.name].read = broader(out[current.name].read, breadth);
          if (ops.some(op => ["write", "create", "update", "delete"].includes(op))) out[current.name].write = broader(out[current.name].write, breadth);
        }
        i += allow[0].length;
        continue;
      }
      const ch = src[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        const top = stack[stack.length - 1];
        if (top && top.depth === depth) stack.pop();
        depth -= 1;
      }
      i += 1;
    }
    return out;
  }

  /** Collections where published rules allow more than the register. */
  function exposureReport(rows, rulesAccess) {
    const issues = [];
    rows.forEach(row => {
      const rule = rulesAccess[row.collection];
      if (!rule) return;
      const level = row.classificationLevel || deriveLevel(row);
      const readAllowed = row.isPublicAccessible ? "public" : row.isPatronAccessible ? "signedIn" : "scoped";
      if (BREADTH_RANK[rule.read] > BREADTH_RANK[readAllowed]) {
        issues.push({collection: row.collection, kind: "readBroader", rule: rule.read, level, severity: row.containsPII ? "high" : "medium"});
      }
      const writeOpen = rule.write === "public" || rule.write === "signedIn";
      if (writeOpen && level !== "internal") {
        issues.push({collection: row.collection, kind: "writeOpen", rule: rule.write, level, severity: level === "restricted" || level === "secret" || row.containsPII ? "high" : "medium"});
      }
    });
    const order = {high: 0, medium: 1};
    return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.collection.localeCompare(b.collection));
  }

  // ---- Server identity (System tier) ----

  /** Least-privilege manifest: each server job states its purpose and the only collections it may read as System. */
  const SYSTEM_JOBS = {
    floqAiAccess: {purpose: "Resolve the caller's tier so FloqAi shows only results their classification allows", collections: ["users", "clubAdminAssignments", "clubLocations", "clubEmployeeDesignations", "floqAiAccessThrottle", "betaTesters"]},
    venuePublicFeed: {purpose: "Publish a club's public profile, events and consented staff to its own website", collections: ["clubLocations", "events", "clubMedia", "scheduleShifts", "clubEmployeeDesignations"]},
    dataClassificationAdmin: {purpose: "Seed, save and edit the classification register for Master Admins", collections: ["dataClassification", "featureServiceAuditLogs", "featureServiceAuditHead"]},
    peopleDirectory: {purpose: "Show other members' profiles without private fields; club contacts only to that club's admins", collections: ["users", "clubLocations", "clubAdminAssignments", "clubEmployeeDesignations", "workerAssociationRequests", "minglConnections", "chatRooms"]},
    shoutoutStories: {purpose: "Show approved ShoutOuts as Mingl Gist stories without the submitter's contact details", collections: ["shoutouts"]}
  };

  function systemJob(job, collection) {
    const entry = SYSTEM_JOBS[job];
    if (!entry) throw invalid(`Unknown system job: ${job}`);
    if (!entry.collections.includes(collection)) throw invalid(`System job ${job} may not read ${collection}`);
    return {job, purpose: entry.purpose, collection, level: (normalize(collection, null) || {}).classificationLevel || "unclassified"};
  }

  /**
   * Caller tier from server-verified facts only. Never returns "system": the platform identity is not a role a
   * request can hold. facts: {signedIn, isMasterAdmin, clubAdminClubIds[], designations[{clubId, status, rolePermissions, roleElectionType}]}
   */
  function resolveViewerRole(facts = {}) {
    if (!facts.signedIn) return {role: "anonymous", clubIds: []};
    if (facts.isMasterAdmin === true) return {role: "master", clubIds: []};
    const adminClubs = new Set((facts.clubAdminClubIds || []).filter(Boolean).map(String));
    const staffClubs = new Set();
    let privileged = false;
    (facts.designations || []).forEach(row => {
      if (!row || String(row.status || "").toLowerCase() === "rejected") return;
      const clubId = String(row.clubId || "");
      if (/club admin/i.test(String(row.roleElectionType || ""))) {
        if (clubId) adminClubs.add(clubId);
        return;
      }
      if (clubId) staffClubs.add(clubId);
      if (Array.isArray(row.rolePermissions) && row.rolePermissions.some(Boolean)) privileged = true;
    });
    if (adminClubs.size) return {role: "clubAdmin", clubIds: [...adminClubs]};
    if (staffClubs.size) return {role: privileged ? "privileged" : "regular", clubIds: [...staffClubs]};
    return {role: "patron", clubIds: []};
  }

  // ---- FloqAi content (help entries, intents). Translations inherit the source id's class. ----

  const AUDIENCE_FLAG = {
    public: "isPublicAccessible",
    patron: "isPatronAccessible",
    serviceMember: "isRegularEmployeeAccessible",
    privilegedEmployee: "isPrivilegedEmployeeAccessible",
    venueAdmin: "isClubAdminAccessible",
    masterAdmin: "isMasterAdminAccessible"
  };
  const SOURCE_ID = /^(help|intent):[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

  /** Builds a classification row from FloqAi audiences; null when unclassified (fail closed). */
  function classifyAudiences(audiences, sourceId = "") {
    const list = (Array.isArray(audiences) ? audiences : []).filter(key => AUDIENCE_FLAG[key]);
    if (!list.length) return null;
    const row = {collection: sourceId, scope: "platform", ownRecordReadable: 0, containsPII: 0, retentionDays: 0};
    ["isPublicAccessible", ...TIERS].forEach(key => { row[key] = 0; });
    list.forEach(key => { row[AUDIENCE_FLAG[key]] = 1; });
    const out = cumulative(row);
    out[SYSTEM_FLAG] = 1;
    out.classificationLevel = deriveLevel(out);
    return out;
  }

  /** manifest: {help: {id: audiences}, intents: {id: audiences}}. Accepts "help:id", "intent:id", or a localized copy's id. */
  function contentRow(sourceId, manifest) {
    const id = String(sourceId || "");
    if (!SOURCE_ID.test(id)) return null;
    const [kind, key] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
    const table = kind === "help" ? manifest?.help : manifest?.intents;
    if (!table || !Object.prototype.hasOwnProperty.call(table, key)) return null;
    return classifyAudiences(table[key], id);
  }

  /** Filters FloqAi source ids for a viewer; unknown or malformed ids are denied. */
  function filterContent(sourceIds, manifest, viewer) {
    const allowed = [];
    const denied = [];
    (Array.isArray(sourceIds) ? sourceIds : []).forEach(id => {
      const row = contentRow(id, manifest);
      if (row && access(row, viewer) === "yes") allowed.push(id);
      else denied.push({id, level: row ? row.classificationLevel : "unclassified"});
    });
    return {allowed, denied};
  }

  const MAX_CONTENT_IDS = 60;
  const LOGGED_DENIAL_LEVELS = ["restricted", "secret", "unclassified"];

  /** Unique string ids, capped in count and length; anything else is dropped before classification. */
  function sanitizeSourceIds(raw, max = MAX_CONTENT_IDS) {
    const out = [];
    (Array.isArray(raw) ? raw : []).forEach(value => {
      if (typeof value !== "string") return;
      const id = value.trim().slice(0, 140);
      if (id && !out.includes(id) && out.length < max) out.push(id);
    });
    return out;
  }

  /** Denials worth an audit row: restricted / secret content, or ids the register does not know (probing). */
  function denialsToLog(denied) {
    return (Array.isArray(denied) ? denied : []).filter(row => LOGGED_DENIAL_LEVELS.includes(row?.level));
  }

  const CSV_COLUMNS = ["collection", "classificationLevel", "scope", ...FLAGS, SYSTEM_FLAG, "retentionDays", "description", "revision", "updatedByEmail", "updatedAtMs", "lastChangeReason"];

  function csvCell(value) {
    const s = String(value == null ? "" : value);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, "\"\"")}"` : safe;
  }

  function toCsv(rows) {
    return [CSV_COLUMNS.join(","), ...rows.map(row => CSV_COLUMNS.map(key => csvCell(row[key])).join(","))].join("\n");
  }

  return {
    COLLECTION, TIERS, FLAGS, SYSTEM_FLAG, LEVELS, ROLES, CLIENT_ROLES, PRESETS, CATALOG, FIELD_CATALOG, COLLECTIONS, SYSTEM_JOBS, AUDIENCE_FLAG,
    flag, normalize, cumulative, deriveLevel, validateChange, diff, docIdFor, collectionFromDocId,
    MAX_TX_WRITES, validateSaveAll, planSaveAll, REVIEW_RECOMMENDATIONS, reviewNotes, rowStatus, FIX_GROUPS, fixGroupFor, fixList,
    access, simulate, exprBreadth, parseRulesAccess, exposureReport, toCsv,
    systemJob, resolveViewerRole, classifyAudiences, contentRow, filterContent,
    MAX_CONTENT_IDS, sanitizeSourceIds, denialsToLog
  };
});
