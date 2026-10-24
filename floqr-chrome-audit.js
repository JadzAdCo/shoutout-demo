/**
 * FLOQR Site chrome follow-through audit (Master Admin).
 * When a Master Admin switches Site chrome, pages they open are probed:
 * expected (from the switch / localStorage) vs actual html[data-floqr-chrome].
 * Diagnostics → Site chrome audit reads the session and builds a fix prompt.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "floqr.chromeAudit";
  const MASTER_HINT_KEY = "floqr.chromeAudit.masterHint";
  const MAX_PAGES = 80;
  const VERSION = "s3.2.60";

  const CHROME_MAP = Object.freeze({
    0: "nightlife",
    1: "traditional",
    2: "blackTiffany",
    3: "whiteBlack",
    4: "purpleWhite",
    5: "blackDarkGreen"
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function pathOf(href) {
    try {
      const u = new URL(href || global.location.href, global.location.origin);
      return (u.pathname.split("/").pop() || "index.html") + (u.search || "") + (u.hash || "");
    } catch (_) {
      return String(href || "");
    }
  }

  function readSession() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function writeSession(session) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (_) { /* ignore quota */ }
  }

  function clearSession() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* ignore */ }
  }

  function expectedFromStorage() {
    const schemeApi = global.FLOQRChromeScheme;
    if (schemeApi?.getChrome) return schemeApi.getChrome();
    try {
      const code = global.localStorage.getItem("floqr.isSiteChrome");
      if (code != null && CHROME_MAP[code] != null) return CHROME_MAP[code];
      const legacy = String(global.localStorage.getItem("floqr.uiChrome") || "").trim();
      if (Object.values(CHROME_MAP).includes(legacy)) return legacy;
    } catch (_) { /* ignore */ }
    return "nightlife";
  }

  function actualChrome() {
    const el = global.document?.documentElement;
    return String(el?.getAttribute("data-floqr-chrome") || "").trim() || "(missing)";
  }

  function markMasterHint(on) {
    try {
      if (on) global.localStorage.setItem(MASTER_HINT_KEY, "1");
      else global.localStorage.removeItem(MASTER_HINT_KEY);
    } catch (_) { /* ignore */ }
  }

  function hasMasterHint() {
    try {
      return global.localStorage.getItem(MASTER_HINT_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  async function resolveIsMasterAdmin() {
    if (hasMasterHint()) return true;
    try {
      const user = global.firebase?.auth?.()?.currentUser;
      if (!user) return false;
      const token = await user.getIdTokenResult();
      if (token?.claims?.masterAdmin === true || token?.claims?.isMasterAdmin === true) {
        markMasterHint(true);
        return true;
      }
      const snap = await global.firebase.firestore().collection("users").doc(user.uid).get();
      const data = snap.exists ? snap.data() : {};
      const roles = []
        .concat(data.approvedRoles || [])
        .concat(data.roles || [])
        .map(r => String(r || "").toLowerCase());
      const isMaster =
        data.isMasterAdmin === true ||
        data.IsMasterAdmin === 1 ||
        data.IsMasterAdmin === true ||
        roles.some(r => r.includes("master"));
      if (isMaster) markMasterHint(true);
      return isMaster;
    } catch (_) {
      return hasMasterHint();
    }
  }

  function noteSwitch(detail = {}) {
    const chrome = String(detail.chrome || expectedFromStorage());
    const code = detail.isSiteChrome != null
      ? Number(detail.isSiteChrome)
      : Object.keys(CHROME_MAP).find(k => CHROME_MAP[k] === chrome);
    resolveIsMasterAdmin().then(isMaster => {
      if (!isMaster) return;
      const user = global.firebase?.auth?.()?.currentUser;
      const session = {
        active: true,
        version: VERSION,
        startedAt: nowIso(),
        switchedAt: nowIso(),
        switchedByUid: user?.uid || "",
        switchedByEmail: user?.email || "",
        expectedChrome: chrome,
        expectedCode: code != null && !Number.isNaN(Number(code)) ? Number(code) : null,
        switchPage: pathOf(global.location.href),
        pages: []
      };
      writeSession(session);
      // Immediate probe of the switch page
      probePage({reason: "switch"});
    });
  }

  function probePage(opts = {}) {
    const session = readSession();
    if (!session?.active) return null;
    const expected = session.expectedChrome || expectedFromStorage();
    const actual = actualChrome();
    const pass = actual === expected;
    const page = pathOf(global.location.href);
    const entry = {
      at: nowIso(),
      page,
      href: String(global.location.href || ""),
      expected,
      actual,
      pass,
      reason: opts.reason || "navigate",
      hasChromeModule: !!(global.FLOQRChromeScheme && typeof global.FLOQRChromeScheme.applyDocument === "function"),
      dataAttrPresent: global.document?.documentElement?.hasAttribute("data-floqr-chrome") === true
    };
    const pages = Array.isArray(session.pages) ? session.pages.slice() : [];
    // Collapse rapid duplicates of the same page+result
    const last = pages[pages.length - 1];
    if (last && last.page === entry.page && last.expected === entry.expected && last.actual === entry.actual) {
      last.at = entry.at;
      last.reason = entry.reason;
    } else {
      pages.push(entry);
    }
    if (pages.length > MAX_PAGES) pages.splice(0, pages.length - MAX_PAGES);
    session.pages = pages;
    session.lastProbedAt = entry.at;
    session.failCount = pages.filter(p => !p.pass).length;
    session.passCount = pages.filter(p => p.pass).length;
    writeSession(session);
    return entry;
  }

  function summarize(session) {
    const s = session || readSession();
    if (!s) {
      return {
        active: false,
        message: "No Site chrome audit session. Switch chrome in My Profile → Appearance as Master Admin, then open pages to probe."
      };
    }
    const pages = Array.isArray(s.pages) ? s.pages : [];
    const fails = pages.filter(p => !p.pass);
    const passes = pages.filter(p => p.pass);
    return {
      active: !!s.active,
      expectedChrome: s.expectedChrome,
      expectedCode: s.expectedCode,
      switchedAt: s.switchedAt,
      switchedByEmail: s.switchedByEmail,
      switchPage: s.switchPage,
      passCount: passes.length,
      failCount: fails.length,
      pages,
      fails,
      passes
    };
  }

  function buildReportText(session) {
    const sum = summarize(session);
    if (!sum.active) return sum.message;
    const lines = [
      `FLOQR Site chrome audit ${VERSION}`,
      `Expected: ${sum.expectedChrome} (isSiteChrome=${sum.expectedCode})`,
      `Switched: ${sum.switchedAt || "—"} by ${sum.switchedByEmail || "—"} on ${sum.switchPage || "—"}`,
      `Results: ${sum.passCount} pass / ${sum.failCount} fail (${sum.pages.length} probes)`,
      ""
    ];
    for (const p of sum.pages) {
      lines.push(`${p.pass ? "PASS" : "FAIL"}  ${p.page}`);
      lines.push(`  expected=${p.expected}  actual=${p.actual}  chromeModule=${p.hasChromeModule}  dataAttr=${p.dataAttrPresent}`);
      lines.push(`  at=${p.at}  reason=${p.reason}`);
    }
    if (sum.failCount) {
      lines.push("");
      lines.push("Failed pages:");
      for (const p of sum.fails) lines.push(`- ${p.page} (actual ${p.actual})`);
    }
    return lines.join("\n");
  }

  function buildFixPrompt(session) {
    const sum = summarize(session);
    if (!sum.active) {
      return [
        "FLOQR Site chrome audit — no session yet.",
        "1) Sign in as Master Admin.",
        "2) My Profile → Appearance → Site chrome → pick a non-Nightlife look.",
        "3) Open Search, payment-return, pass, VIP, ad invoice, etc.",
        "4) Master Admin → Diagnostics → Read Site chrome audit."
      ].join("\n");
    }
    if (!sum.failCount) {
      return [
        `Site chrome audit PASS for expected=${sum.expectedChrome}.`,
        "No failed pages in this session. If a surface still looks wrong visually, hard-refresh that page's ?v= cache-bust and confirm styles.css theme blocks for the scheme."
      ].join("\n");
    }
    const failedPages = sum.fails.map(p => p.page).join(", ");
    const missingModule = sum.fails.filter(p => !p.hasChromeModule).map(p => p.page);
    const missingAttr = sum.fails.filter(p => !p.dataAttrPresent).map(p => p.page);
    return [
      "FIX PROMPT — Site chrome did not follow through (Master Admin audit)",
      "",
      `Expected chrome: ${sum.expectedChrome} (isSiteChrome=${sum.expectedCode})`,
      `Failed pages: ${failedPages}`,
      "",
      "Root cause checklist:",
      "1) Page must early-paint data-floqr-chrome from localStorage floqr.isSiteChrome (same snippet as index.html / patron-portal.html).",
      "2) Page must load floqr-chrome-scheme.js after firebase-config and call applyDocument / hydrateFromProfile(users/{uid}).",
      "3) Receipt satellites (payment-return.html, ad-invoice.html, pass.html) must NOT rely on Nightlife defaults when attr is missing.",
      "4) applyBrandLogos must run so FloqR wordmarks match the scheme.",
      "5) Cache-bust floqr-chrome-scheme.js + styles.css + the page HTML ?v=; Xibo display URLs stay without ?v=.",
      "",
      missingModule.length
        ? `Pages missing FLOQRChromeScheme module: ${missingModule.join(", ")} — add <script src="./floqr-chrome-scheme.js"> + early paint.`
        : "All failed probes had FLOQRChromeScheme loaded — check hydrateFromProfile / localStorage overwrite / CSS specificity.",
      missingAttr.length
        ? `Pages missing data-floqr-chrome attr: ${missingAttr.join(", ")} — early paint or applyDocument never ran.`
        : "data-floqr-chrome was present but mismatched expected — localStorage/profile desync or force-to-Nightlife gate.",
      "",
      "Probe log:",
      buildReportText(sum)
    ].join("\n");
  }

  function bind() {
    if (global.document) {
      const run = () => {
        // Delay so chrome-scheme boot + hydrate can finish
        setTimeout(() => probePage({reason: "load"}), 50);
        setTimeout(() => probePage({reason: "load-late"}), 600);
      };
      if (global.document.readyState === "loading") {
        global.document.addEventListener("DOMContentLoaded", run);
      } else {
        run();
      }
    }
    global.addEventListener("floqr-chrome-change", ev => {
      noteSwitch(ev.detail || {});
    });
    // Visibility / SPA-ish returns
    global.addEventListener("pageshow", () => probePage({reason: "pageshow"}));
  }

  global.FLOQRChromeAudit = {
    STORAGE_KEY,
    VERSION,
    noteSwitch,
    probePage,
    readSession,
    clearSession,
    summarize,
    buildReportText,
    buildFixPrompt,
    resolveIsMasterAdmin,
    markMasterHint,
    expectedFromStorage,
    actualChrome
  };

  bind();
})(typeof window !== "undefined" ? window : globalThis);
