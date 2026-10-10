#!/usr/bin/env node
/* s3.1.31 Master Admin → Entity Management → Demo Svc / Emp Mgmt tab: anchored, idempotent edits to files
   other work also touches (master-admin.html, master-admin-app.js, sos2fa.js, floqr-i18n.js,
   floqai-help-repository.js, functions/i18n-coverage.test.js). Applied to the workspace, to a HEAD export
   for the commit, and to the staged main tree when publishing — never a whole-file copy.
   Usage: node scripts/apply-s3-1-31-demo-employees-tab.js [rootDir]
   Design notes: .cursor/rules/design-notes-demo-signin.mdc */
"use strict";

const fs = require("fs");
const path = require("path");

const V = "s3.1.31";
const PANEL = "demoEmployees";
const TAB_KEY = "master.demoEmployees";

function insertAfter(src, anchor, addition, marker) {
  if (src.includes(marker)) return src;
  const at = src.indexOf(anchor);
  if (at < 0 || src.indexOf(anchor, at + 1) >= 0) throw new Error(`Anchor not unique: ${anchor.slice(0, 80)}`);
  return src.slice(0, at + anchor.length) + addition + src.slice(at + anchor.length);
}

function replaceOnce(src, find, replacement) {
  if (src.includes(replacement)) return src;
  const at = src.indexOf(find);
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`Anchor not unique: ${find.slice(0, 80)}`);
  return src.slice(0, at) + replacement + src.slice(at + find.length);
}

function bumpAsset(src, file, tag = "script") {
  const attr = tag === "link" ? "href" : "src";
  const re = new RegExp(`(${attr}="\\./${file.replace(/\./g, "\\.")}\\?v=)[^"]+"`);
  if (!re.test(src)) throw new Error(`master-admin.html does not load ${file}`);
  return src.replace(re, `$1${V}"`);
}

const SECTION = `
      <section id="demoEmployees" class="admin-panel-section" data-entity-mgmt-gated="true">
        <!-- Design notes: .cursor/rules/design-notes-demo-signin.mdc -->
        <div class="card">
          <p class="eyebrow">Entity management · demo employees</p>
          <h2
            data-floqr-help-id="help-master-demo-signin"
            data-floqr-help-title="Demo sign-in code"
            data-floqr-help-search="demo employee code|temp code|demo sign in|sign in as demo|demo sign-in code|demo service member|floqr-demo"
            data-floqr-help-body="Use this when email codes are not arriving and you need to sign in as a demo employee (temp_role_number@floqr-demo.com). Search or pick the demo employee, press Generate code and give a reason. The code is shown once, works for 10 minutes and only for that demo account. Then open a private (incognito) window, go to Search → Continue with your own Email, type the demo email, press I already have a code, enter the code and press Verify and Continue. Every code issued is written to the Features &amp; Services audit trail. Real patron accounts cannot get a code here."
          >Demo Svc / Emp Mgmt</h2>
          <p id="demoEmpStatus" class="status" aria-live="polite"></p>
          <div class="demo-emp-search-row">
            <label>Search demo employees
              <input id="demoEmpSearch" type="search" autocomplete="off" placeholder="Name, email, role, or club"/>
            </label>
            <label>Select demo employee
              <select id="demoEmpSelect"></select>
            </label>
            <button id="demoEmpGenerateSelectedBtn" class="primary" type="button">Generate code</button>
          </div>
          <p class="sub small">Showing <span id="demoEmpCount">0</span> demo employees. Click a row to select it.</p>
          <div id="demoEmpList" class="demo-emp-list"></div>
        </div>

        <div class="card">
          <h3>Not in the list?</h3>
          <p class="sub small">Pick the role and demo club number. The account is created the first time it signs in.</p>
          <div class="demo-emp-search-row">
            <label>Role<select id="demoEmpRole"></select></label>
            <label>Demo club<select id="demoEmpNumber"></select></label>
            <button id="demoEmpManualGenerateBtn" type="button">Generate code</button>
          </div>
          <p class="sub small">Signs in as <span id="demoEmpManualEmail" class="demo-emp-email"></span></p>
        </div>

        <div id="demoEmpResult" class="card hidden" aria-live="polite">
          <h3>Sign-in code for <span id="demoEmpResultEmail" class="demo-emp-email"></span></h3>
          <div id="demoEmpCode" class="demo-emp-code"></div>
          <p id="demoEmpCountdown" class="demo-emp-countdown"></p>
          <div class="queue-actions">
            <button id="demoEmpCopyCodeBtn" type="button">Copy code</button>
            <button id="demoEmpCopyEmailBtn" type="button">Copy email</button>
            <button id="demoEmpHideBtn" type="button">Hide code</button>
          </div>
          <ol class="demo-emp-steps">
            <li>Open a private (incognito) window so you stay signed in here.</li>
            <li>Go to <span id="demoEmpSearchUrl" class="demo-emp-url"></span></li>
            <li>Press <strong>Continue with your own Email</strong> and type the demo email.</li>
            <li>Press <strong>I already have a code</strong> (do not press Send), enter the code, then <strong>Verify and Continue</strong>.</li>
          </ol>
          <p class="sub small">The code works once, for 10 minutes, and only for this demo account. Generating a new code replaces it.</p>
        </div>

        <div class="card">
          <h3>Recent codes issued</h3>
          <p class="sub small">Who issued a code, for which demo account, and when. Codes are never stored or shown here.</p>
          <div id="demoEmpRecent" class="report-block"></div>
          <div class="queue-actions">
            <button id="demoEmpReloadBtn" type="button">Reload</button>
          </div>
        </div>
      </section>
`;

const TAB_LABELS = {
  "Unapproved Recommendations": "Demo Svc / Emp Mgmt",
  "Recommandations non approuvées": "Démo serv. / employés",
  "Nicht freigegebene Empfehlungen": "Demo-Service / Mitarbeiter",
  "Recomendaciones no aprobadas": "Demo serv. / empleados",
  "Niet-goedgekeurde aanbevelingen": "Demo service / medewerkers",
  "Неутверждённые рекомендации": "Демо: сервис / сотрудники",
  "Raccomandazioni non approvate": "Demo serv. / dipendenti",
  "Recomendações não aprovadas": "Demo serv. / funcionários",
  "Μη εγκεκριμένες προτάσεις": "Demo υπηρ. / υπάλληλοι",
  "Niezatwierdzone rekomendacje": "Demo obsługa / pracownicy",
  "التوصيات غير المعتمدة": "إدارة موظفي العرض التجريبي"
};

const HELP_BODY = "Master Admin → Entity Management → Demo Svc / Emp Mgmt. Use this when email codes are not arriving and you need to sign in as a demo employee (temp_role_number@floqr-demo.com). Unlock SOS2FA, search or pick the demo employee, press Generate code and give a reason. The code is shown once, works for 10 minutes and only for that demo account. Then open a private (incognito) window, go to Search → Continue with your own Email, type the demo email, press I already have a code, enter the code and press Verify and Continue. Every code issued is written to the Features & Services audit trail and listed under Recent codes issued. Real patron accounts cannot get a code here.";

const HELP_PHRASES = `      searchPhrases: [
        "demo employee code", "temp code", "demo sign in", "sign in as demo", "demo sign-in code", "demo sign in code",
        "demo signin", "sign in as demo account", "log in as demo account", "demo svc emp mgmt", "demo employees",
        "demo service member", "temp waitress", "floqr-demo", "demo account login", "test account code",
        "email code not arriving", "sendgrid not working", "demo account password"
      ],`;

function editHelp(src) {
  const start = src.indexOf(`      id: "help-master-demo-signin",`);
  if (start < 0) throw new Error("floqai-help-repository.js: help-master-demo-signin entry missing (apply the s3.1.31 demo sign-in edits first)");
  const end = src.indexOf("\n    },", start);
  const entry = src.slice(start, end);
  if (entry.includes(`#${PANEL}`)) return src;
  const next = [
    `      id: "help-master-demo-signin",`,
    `      title: "Demo sign-in code",`,
    `      body: ${JSON.stringify(HELP_BODY)},`,
    HELP_PHRASES,
    `      links: [`,
    `        {label: "Demo Svc / Emp Mgmt", href: vUrl("./master-admin.html", {from: "floqai"}) + "#${PANEL}", search: "demo employee code"}`,
    `      ],`,
    `      audiences: ["masterAdmin"],`,
    `      source: "help-repository-seed",`,
    `      page: "master-admin.html#${PANEL}"`
  ].join("\n");
  return src.slice(0, start) + next + src.slice(end);
}

const EDITS = {
  "master-admin.html": src => {
    let out = insertAfter(src,
      `            <button class="admin-subtab" data-panel="recommendationModeration" type="button" data-i18n="master.recommendations">Unapproved Recommendations</button>`,
      `\n            <button class="admin-subtab" data-panel="${PANEL}" type="button" data-i18n="${TAB_KEY}">Demo Svc / Emp Mgmt</button>`,
      `data-panel="${PANEL}"`);
    return insertAfter(out,
      `          <div id="recommendationModerationList" class="report-block"></div>\n        </div>\n      </section>\n`,
      SECTION,
      `<section id="${PANEL}"`);
  },
  "master-admin-app.js": src => {
    let out = insertAfter(src, `    "recommendationModeration",`, `\n    "${PANEL}",`, `    "${PANEL}",`);
    out = insertAfter(out, `    recommendationModeration: "Unapproved Recommendations",`, `\n    ${PANEL}: "Demo Svc / Emp Mgmt",`, `${PANEL}: "Demo Svc / Emp Mgmt"`);
    out = insertAfter(out,
      `      if (panelId === "featuresServices") {\n        window.FLOQRMasterFeatureServices?.mount?.();\n      }`,
      `\n      if (panelId === "${PANEL}") {\n        window.FLOQRMasterDemoEmployees?.mount?.();\n      }`,
      "FLOQRMasterDemoEmployees");
    return out;
  },
  "sos2fa.js": src => insertAfter(src, `    "recommendationModeration",`, `\n    "${PANEL}",`, `    "${PANEL}",`),
  "floqr-i18n.js": src => Object.entries(TAB_LABELS).reduce((out, [recommendations, label]) => {
    const anchor = `      "master.recommendations": ${JSON.stringify(recommendations)},`;
    const at = out.indexOf(anchor);
    if (at < 0) throw new Error(`floqr-i18n.js: no pack anchor ${recommendations}`);
    const next = out.indexOf("\n", at + anchor.length + 1);
    if (out.slice(at, next).includes(TAB_KEY)) return out;
    return out.slice(0, at + anchor.length) + `\n      "${TAB_KEY}": ${JSON.stringify(label)},` + out.slice(at + anchor.length);
  }, src),
  "floqai-help-repository.js": editHelp,
  /* Exact ?v= pins break on every cache-bust; these keep "this release or newer". */
  "functions/sos2fa-master-admin.test.js": src => replaceOnce(src,
    `  assert.match(read("master-admin.html"), /sos2fa\\.js\\?v=s3\\.1\\.28/);`,
    `  assert.match(read("master-admin.html"), /sos2fa\\.js\\?v=s3\\.1\\.(2[89]|[3-9]\\d)"/);`),
  "functions/master-admin-claim-ui.test.js": src => replaceOnce(src,
    `  assert.match(read("master-admin.html"), /master-admin-app\\.js\\?v=s3\\.1\\.27/);`,
    `  assert.match(read("master-admin.html"), /master-admin-app\\.js\\?v=s3\\.1\\.(2[7-9]|[3-9]\\d)"/);`),
  "functions/master-admin-audit-hero-help.test.js": src => replaceOnce(src,
    "    assert.match(html, new RegExp(`\\\\./${file.replace(/\\./g, \"\\\\.\")}\\\\?v=s3\\\\.1\\\\.30`));",
    "    assert.match(html, new RegExp(`\\\\./${file.replace(/\\./g, \"\\\\.\")}\\\\?v=s3\\\\.1\\\\.[3-9]\\\\d\"`));")
};

function editMasterAdminAssets(src) {
  let out = src;
  if (!out.includes("master-demo-employees.css")) {
    const anchor = out.match(/<link rel="stylesheet" href="\.\/floqr-reason-prompt\.css\?v=[^"]+"\/>/);
    if (!anchor) throw new Error("master-admin.html does not load floqr-reason-prompt.css");
    out = insertAfter(out, anchor[0], `\n  <link rel="stylesheet" href="./master-demo-employees.css?v=${V}"/>`, "master-demo-employees.css");
  }
  if (!out.includes("master-demo-employees.js")) {
    const anchor = out.match(/<script src="\.\/master-feature-services\.js\?v=[^"]+"><\/script>/);
    if (!anchor) throw new Error("master-admin.html does not load master-feature-services.js");
    out = insertAfter(out, anchor[0], `\n<script src="./master-demo-employees.js?v=${V}"></script>`, "master-demo-employees.js");
  }
  for (const file of ["floqr-i18n.js", "sos2fa.js", "floqai-help-repository.js", "master-admin-app.js"]) out = bumpAsset(out, file);
  return out;
}

/* The chrome key count is pinned in the test; raise it only when this run added the tab key. */
function bumpChromeKeyCount(src) {
  const match = src.match(/assert\.equal\(chrome\.enKeys, (\d+)\);/);
  if (!match) throw new Error("functions/i18n-coverage.test.js: enKeys assertion missing");
  return src.replace(match[0], `assert.equal(chrome.enKeys, ${Number(match[1]) + 1});`);
}

function editFile(root, rel, edit) {
  const file = path.join(root, rel);
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  const src = raw.replace(/\r\n/g, "\n");
  const out = edit(src);
  if (out === src) return false;
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, "\r\n") : out);
  return true;
}

function applyAll(root) {
  const changed = [];
  for (const [rel, edit] of Object.entries(EDITS)) {
    const full = rel === "master-admin.html" ? src => editMasterAdminAssets(edit(src)) : edit;
    if (!editFile(root, rel, full)) continue;
    changed.push(rel);
    if (rel === "floqr-i18n.js" && editFile(root, "functions/i18n-coverage.test.js", bumpChromeKeyCount)) {
      changed.push("functions/i18n-coverage.test.js");
    }
  }
  return changed;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
  const changed = applyAll(root);
  console.log(changed.length ? `Updated: ${changed.join(", ")}` : "Already applied");
}

module.exports = {applyAll, FILES: [...Object.keys(EDITS), "functions/i18n-coverage.test.js"], V};
