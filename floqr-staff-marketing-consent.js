/* Staff marketing media consent — opt-in checkbox, patron status, Club Admin labels.
   Design notes: .cursor/rules/design-notes-staff-marketing-consent.mdc */
(function (global) {
  "use strict";

  const VERSION = "mmc-2026-10";
  const FIELD = "marketingMediaConsent";
  const CALLABLE = "recordStaffMarketingConsent";
  const SOURCES = ["portal-elect", "portal-request", "role-request", "portal-manage"];
  const TEXT_KEYS = ["staffConsent.p1", "staffConsent.p2", "staffConsent.p3", "staffConsent.p4"];

  const EN = {
    "staffConsent.title": "Marketing use of your name and photos",
    "staffConsent.p1": "When you join a club, lounge, venue, or event team on FLOQR, you give each venue or event organizer you join, and its admins and managers, permission to use your FLOQR profile name, your role, and the photos and videos you have published or selected on FLOQR to promote that venue and its events.",
    "staffConsent.p2": "This covers their websites, flyers and posters, and social media campaigns on Instagram, Facebook, TikTok, YouTube, and similar platforms. While this consent is active, they do not need to ask you again for each new use. The permission is non-exclusive and royalty-free: you keep the rights to your own photos and videos, and no fee is owed to you.",
    "staffConsent.p3": "They may not publish your private contact details, such as your phone number or email address.",
    "staffConsent.p4": "You can withdraw this consent at any time in My Profile. Withdrawal stops new marketing use. Materials already printed or posted before you withdrew do not have to be recalled.",
    "staffConsent.checkbox": "I agree that the venues and event organizers I join may use my name, role, and published photos and videos for marketing as described above.",
    "staffConsent.required": "Tick the marketing consent box to continue.",
    "staffConsent.manageTitle": "Marketing consent",
    "staffConsent.statusGiven": "Active since {date}. The venues and event teams you join may use your name, role, and published photos and videos for marketing.",
    "staffConsent.statusWithdrawn": "Withdrawn on {date}. Venues may not start new marketing with your name or photos. You will be asked again before you join another venue or event team.",
    "staffConsent.statusNone": "Not given yet. You will be asked when you join a venue or event team.",
    "staffConsent.withdrawBtn": "Withdraw marketing consent",
    "staffConsent.giveBtn": "Give marketing consent",
    "staffConsent.withdrawConfirm": "Withdraw your marketing consent? Venues must stop starting new marketing with your name or photos. Materials already printed or posted do not have to be recalled.",
    "staffConsent.withdrawnDone": "Marketing consent withdrawn.",
    "staffConsent.givenDone": "Marketing consent saved.",
    "staffConsent.saveFailed": "Your consent could not be saved. Try again.",
    "staffConsent.adminGiven": "Marketing consent: given on {date}",
    "staffConsent.adminWithdrawn": "Marketing consent: withdrawn on {date}",
    "staffConsent.adminNone": "Marketing consent: not recorded"
  };

  const ENGLISH_TEXT = TEXT_KEYS.map(key => EN[key]).join("\n\n");
  /** SHA-256 of ENGLISH_TEXT; functions/staff-marketing-consent.test.js recomputes it. */
  const TEXT_HASH = "6ef48376b579a637baa1b859cb9a09a2ab56f64f1d92a9d3537b7a0381caf85b";

  const HELP = {
    id: "help-staff-marketing-consent",
    title: "Staff marketing consent",
    body: "When you join a venue or event team, you must tick the marketing consent box. It lets that venue or event organizer, and its admins and managers, use your FLOQR name, role, and published photos and videos on their websites, flyers, and social media (Instagram, Facebook, TikTok, YouTube and similar) without asking you again for each use. They may not publish your phone number or email. You can withdraw at any time in My Profile on the Services & Service Members tab. This stops new marketing; materials already printed or posted do not have to be recalled. Club Admins see each staff member's consent status in Employee / Worker Network and Featured service staff.",
    searchPhrases: ["marketing consent", "staff marketing consent", "use my photos", "club can use my photos", "withdraw marketing consent", "photo consent staff", "instagram consent", "flyer photo consent"]
  };

  function t(key, vars = {}) {
    const translated = global.FLOQRI18n?.t?.(key, vars);
    if (translated && translated !== key) return translated;
    return String(EN[key] || key).replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? ""));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]));
  }

  function toMs(value) {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatDate(ms) {
    return ms ? new Date(ms).toLocaleDateString() : "";
  }

  /** Live user record wins (it carries withdrawal); the designation stamp is the opt-in snapshot. */
  function statusOf(profile = {}, designation = null) {
    const record = profile && typeof profile[FIELD] === "object" && profile[FIELD] ? profile[FIELD] : null;
    if (record) {
      if (Number(record.accepted) === 1) {
        return {state: "given", atMs: toMs(record.acceptedAtMs || record.acceptedAtIso), version: String(record.version || ""), current: record.version === VERSION};
      }
      const withdrawnAtMs = toMs(record.withdrawnAtMs || record.withdrawnAtIso);
      if (withdrawnAtMs) return {state: "withdrawn", atMs: withdrawnAtMs, version: String(record.version || ""), current: false};
    }
    if (designation && Number(designation.marketingMediaConsentAccepted) === 1) {
      const version = String(designation.marketingMediaConsentVersion || "");
      return {state: "given", atMs: toMs(designation.marketingMediaConsentAtMs), version, current: version === VERSION};
    }
    return {state: "none", atMs: 0, version: "", current: false};
  }

  function isActive(profile = {}) {
    return statusOf(profile).state === "given";
  }

  function acceptedRecord({nowMs = Date.now(), source = "", lang = "en"} = {}) {
    return {
      accepted: 1,
      version: VERSION,
      textHash: TEXT_HASH,
      acceptedAtMs: nowMs,
      acceptedAtIso: new Date(nowMs).toISOString(),
      source: SOURCES.includes(source) ? source : "unknown",
      lang: String(lang || "en").slice(0, 8),
      withdrawnAtMs: 0,
      withdrawnAtIso: ""
    };
  }

  function withdrawnRecord({nowMs = Date.now()} = {}) {
    return {accepted: 0, withdrawnAtMs: nowMs, withdrawnAtIso: new Date(nowMs).toISOString()};
  }

  /** Fields stamped on roleRequests / workerAssociationRequests at opt-in (firestore.rules require them). */
  function requestStamp(record = {}) {
    return {
      marketingMediaConsentAccepted: Number(record.accepted) === 1 ? 1 : 0,
      marketingMediaConsentVersion: String(record.version || ""),
      marketingMediaConsentTextHash: String(record.textHash || ""),
      marketingMediaConsentAtMs: Number(record.acceptedAtMs) || 0
    };
  }

  /** Copied from the request onto clubEmployeeDesignations when a Club Admin approves. */
  function designationStamp(request = {}) {
    if (Number(request.marketingMediaConsentAccepted) !== 1) return {};
    return {
      marketingMediaConsentAccepted: 1,
      marketingMediaConsentVersion: String(request.marketingMediaConsentVersion || ""),
      marketingMediaConsentAtMs: Number(request.marketingMediaConsentAtMs) || 0
    };
  }

  function adminLabel(profile = {}, designation = null) {
    const status = statusOf(profile, designation);
    if (status.state === "given") return t("staffConsent.adminGiven", {date: formatDate(status.atMs)});
    if (status.state === "withdrawn") return t("staffConsent.adminWithdrawn", {date: formatDate(status.atMs)});
    return t("staffConsent.adminNone");
  }

  function patronStatusText(profile = {}) {
    const status = statusOf(profile);
    if (status.state === "given") return t("staffConsent.statusGiven", {date: formatDate(status.atMs)});
    if (status.state === "withdrawn") return t("staffConsent.statusWithdrawn", {date: formatDate(status.atMs)});
    return t("staffConsent.statusNone");
  }

  function helpAttrs() {
    return ` data-floqr-help-id="${esc(HELP.id)}" data-floqr-help-title="${esc(HELP.title)}" data-floqr-help-body="${esc(HELP.body)}" data-floqr-help-search="${esc(HELP.searchPhrases.join("|"))}"`;
  }

  /** Checkbox starts unticked on every render. */
  function blockHtml(idPrefix = "staff", {help = true} = {}) {
    const boxId = `${String(idPrefix).replace(/[^A-Za-z0-9_-]/g, "")}MarketingConsent`;
    return `<div class="staff-marketing-consent" data-staff-consent>
      <h3${help ? helpAttrs() : ""}><span data-i18n="staffConsent.title">${esc(t("staffConsent.title"))}</span></h3>
      ${TEXT_KEYS.map(key => `<p class="sub small" data-i18n="${key}">${esc(t(key))}</p>`).join("\n      ")}
      <label class="staff-marketing-consent-check" for="${boxId}"><input type="checkbox" id="${boxId}" data-staff-consent-box/> <span data-i18n="staffConsent.checkbox">${esc(t("staffConsent.checkbox"))}</span></label>
    </div>`;
  }

  /** Renders the consent block into host and keeps every gated button disabled until the box is ticked. */
  function mount(host, {idPrefix = "staff", buttons = [], help = true} = {}) {
    if (!host) return null;
    host.innerHTML = blockHtml(idPrefix, {help});
    const box = host.querySelector("[data-staff-consent-box]");
    const gated = (Array.isArray(buttons) ? buttons : [buttons]).filter(Boolean);
    const sync = () => gated.forEach(button => { button.disabled = !box.checked; });
    box.addEventListener("change", sync);
    sync();
    if (help) {
      try { global.FLOQRHelpAttach?.mountAll?.(host); } catch (_error) { /* help is optional */ }
    }
    return {
      box,
      isChecked: () => !!box.checked,
      reset() { box.checked = false; sync(); }
    };
  }

  function serverPayload(action, record = {}, {clubLocationIds = []} = {}) {
    return action === "withdraw"
      ? {action}
      : {action, version: record.version, textHash: record.textHash, source: record.source, lang: record.lang, clubLocationIds};
  }

  /** Best-effort server evidence log; the Firestore write already happened client-side. */
  async function recordOnServer(firebaseNs, action, record, opts = {}) {
    try {
      const app = firebaseNs?.app?.();
      if (!app || typeof app.functions !== "function") return {ok: false, skipped: true};
      const result = await app.functions("us-central1").httpsCallable(CALLABLE)(serverPayload(action, record, opts));
      return result?.data || {ok: true};
    } catch (error) {
      console.warn("Staff marketing consent server log failed:", error?.code || error?.message || error);
      return {ok: false, error: error?.code || error?.message || "failed"};
    }
  }

  const api = {
    VERSION, FIELD, CALLABLE, SOURCES, TEXT_KEYS, EN, ENGLISH_TEXT, TEXT_HASH, HELP,
    t, statusOf, isActive, acceptedRecord, withdrawnRecord, requestStamp, designationStamp,
    adminLabel, patronStatusText, blockHtml, mount, serverPayload, recordOnServer, formatDate
  };
  global.FLOQRStaffMarketingConsent = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
