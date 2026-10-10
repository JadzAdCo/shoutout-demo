#!/usr/bin/env node
/* s3.1.31 demo sign-in code: anchored, idempotent edits to files other work also touches
   (index.html, patron-app.js, floqr-i18n.js, floqai-help-repository.js, functions/package.json,
   functions/floqai-content-classes.json). Applied to the workspace, to a HEAD export for the commit,
   and to the staged main tree when publishing — never a whole-file copy.
   Usage: node scripts/apply-s3-1-31-demo-signin-edits.js [rootDir]
   Design notes: .cursor/rules/design-notes-demo-signin.mdc */
"use strict";

const fs = require("fs");
const path = require("path");

const V = "s3.1.31";

function insertAfter(src, anchor, addition, marker) {
  if (src.includes(marker)) return src;
  const at = src.indexOf(anchor);
  if (at < 0 || src.indexOf(anchor, at + 1) >= 0) throw new Error(`Anchor not unique: ${anchor.slice(0, 80)}`);
  return src.slice(0, at + anchor.length) + addition + src.slice(at + anchor.length);
}

function replaceOnce(src, find, replacement, marker) {
  if (src.includes(marker)) return src;
  const at = src.indexOf(find);
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`Anchor not unique: ${find.slice(0, 80)}`);
  return src.slice(0, at) + replacement + src.slice(at + find.length);
}

function bumpScript(src, file) {
  const re = new RegExp(`(src="\\./${file.replace(/\./g, "\\.")}\\?v=)[^"]+"`);
  if (!re.test(src)) throw new Error(`index.html does not load ${file}`);
  return src.replace(re, `$1${V}"`);
}

const I18N = {
  "Continue with your own Email": ["I already have a code", "Enter the 8-character code you were given, then press Verify and Continue.", "Type the email address the code is for, then enter the code."],
  "Continuer avec votre e-mail": ["J'ai déjà un code", "Saisissez le code à 8 caractères que vous avez reçu, puis appuyez sur Vérifier et continuer.", "Saisissez l'adresse e-mail associée au code, puis le code."],
  "Weiter mit deiner E-Mail": ["Ich habe schon einen Code", "Gib den 8-stelligen Code ein, den du erhalten hast, und tippe dann auf Bestätigen und weiter.", "Gib die E-Mail-Adresse ein, für die der Code gilt, und dann den Code."],
  "Continuar con tu propio Email": ["Ya tengo un código", "Introduce el código de 8 caracteres que recibiste y pulsa Verificar y continuar.", "Escribe el correo electrónico al que corresponde el código y luego el código."],
  "Doorgaan met je eigen e-mail": ["Ik heb al een code", "Voer de code van 8 tekens in die je hebt gekregen en tik op Verifiëren en doorgaan.", "Typ het e-mailadres waarvoor de code is en voer daarna de code in."],
  "Продолжить со своим Email": ["У меня уже есть код", "Введите полученный 8-символьный код и нажмите «Подтвердить и продолжить».", "Введите адрес электронной почты, для которого выдан код, затем сам код."],
  "Continua con la tua email": ["Ho già un codice", "Inserisci il codice di 8 caratteri che hai ricevuto, poi premi Verifica e continua.", "Scrivi l'indirizzo email a cui è destinato il codice, poi inserisci il codice."],
  "Continuar com seu email": ["Já tenho um código", "Digite o código de 8 caracteres que você recebeu e toque em Verificar e continuar.", "Digite o email ao qual o código se destina e depois o código."],
  "Συνεχίστε με το δικό σας email": ["Έχω ήδη κωδικό", "Εισαγάγετε τον κωδικό 8 χαρακτήρων που λάβατε και πατήστε Επαλήθευση και συνέχεια.", "Πληκτρολογήστε το email για το οποίο είναι ο κωδικός και μετά τον κωδικό."],
  "Kontynuuj przy użyciu własnego adresu e-mail": ["Mam już kod", "Wpisz otrzymany 8-znakowy kod, a następnie naciśnij Zweryfikuj i kontynuuj.", "Wpisz adres e-mail, którego dotyczy kod, a potem kod."],
  "التسجيل عن طريق بريدك الإلكتروني": ["لدي رمز بالفعل", "أدخل الرمز المكوّن من 8 أحرف الذي حصلت عليه، ثم اضغط تحقق ومتابعة.", "اكتب عنوان البريد الإلكتروني الخاص بالرمز، ثم أدخل الرمز."]
};

const HELP_ENTRY = `
    {
      id: "help-master-demo-signin",
      title: "Demo sign-in code",
      body: "Use this when email codes are not arriving and you need to sign in as a FLOQR demo account (temp_role_number@floqr-demo.com). Unlock SOS2FA, pick the role and number, press Generate and give a reason. The code is shown once, works for 10 minutes and only for that demo account. Then open a private (incognito) window, go to Search → Continue with your own Email, type the demo email, press I already have a code, enter the code and press Verify and Continue. Every code issued is written to the Features & Services audit trail. Real patron accounts cannot get a code here.",
      searchPhrases: [
        "demo sign-in code", "demo sign in code", "demo signin", "sign in as demo account", "log in as demo account",
        "temp waitress", "floqr-demo", "demo account login", "test account code", "email code not arriving",
        "sendgrid not working", "demo account password"
      ],
      links: [
        {label: "Demo sign-in code", href: vUrl("./demo-signin.html", {from: "floqai"}), search: "demo sign-in code"}
      ],
      audiences: ["masterAdmin"],
      source: "help-repository-seed",
      page: "demo-signin.html"
    },`;

const PATRON_APP_EDITS = [
  {
    marker: "function useExistingEmailOtpCode()",
    find: `      byId("emailOtpCode")?.focus();
    } catch (error) {
      setText("emailOtpStatus", error?.message || "The email code could not be sent.");
    }
  }
  async function verifyEmailOtp() {
    const email = String(byId("emailOtpAddress")?.value || "").trim().toLowerCase();
    const code = String(byId("emailOtpCode")?.value || "").trim().toUpperCase();
    if (!functions || !emailOtpChallengeId) { setText("emailOtpStatus", "Request a new code first."); return; }
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      setText("emailOtpStatus", "Enter the 8-character code from the email (not the Master Admin QA ref).");
      return;
    }
    try {
      setText("emailOtpStatus", "Verifying code...");
      const response = await functions.httpsCallable("verifyEmailOtp")({email, code, challengeId:emailOtpChallengeId});`,
    replacement: `      byId("emailOtpCode")?.focus();
    } catch (error) {
      const message = error?.message || "The email code could not be sent.";
      setText("emailOtpStatus", email.endsWith("@floqr-demo.com") ? \`\${message} \${emailHaveCodeHint()}\` : message);
    }
  }
  function emailHaveCodeHint() {
    return otpText("app.emailHaveCodeHint", "Enter the 8-character code you were given, then press Verify and Continue.");
  }
  /* Same id the server uses for the challenge (sha256 of the email), so a code issued elsewhere can be verified here. */
  async function emailOtpChallengeIdFor(email) {
    if (!window.crypto?.subtle || !window.TextEncoder) return emailOtpChallengeId;
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }
  function useExistingEmailOtpCode() {
    const email = String(byId("emailOtpAddress")?.value || "").trim().toLowerCase();
    if (!email) {
      setText("emailOtpStatus", otpText("app.emailHaveCodeNeedEmail", "Type the email address the code is for, then enter the code."));
      byId("emailOtpAddress")?.focus?.();
      return;
    }
    const demoHint = brokenDemoEmailHint(email);
    if (demoHint) { setText("emailOtpStatus", demoHint); byId("emailOtpAddress")?.focus?.(); return; }
    clearInterval(emailOtpTimer);
    emailOtpTimer = null;
    emailOtpExpiresAt = 0;
    setText("emailOtpStatus", emailHaveCodeHint());
    byId("emailOtpCode")?.focus?.();
  }
  async function verifyEmailOtp() {
    const email = String(byId("emailOtpAddress")?.value || "").trim().toLowerCase();
    const code = String(byId("emailOtpCode")?.value || "").trim().toUpperCase();
    if (!functions) { setText("emailOtpStatus", "Firebase Functions is unavailable on this page."); return; }
    if (!email) { setText("emailOtpStatus", "Enter your email address first."); byId("emailOtpAddress")?.focus?.(); return; }
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      setText("emailOtpStatus", "Enter the 8-character code from the email (not the Master Admin QA ref).");
      return;
    }
    try {
      const challengeId = await emailOtpChallengeIdFor(email);
      if (!challengeId) { setText("emailOtpStatus", "Request a new code first."); return; }
      setText("emailOtpStatus", "Verifying code...");
      const response = await functions.httpsCallable("verifyEmailOtp")({email, code, challengeId});`
  },
  {
    marker: `bind("emailOtpHaveCodeBtn", useExistingEmailOtpCode)`,
    find: `bind("requestEmailOtpBtn", requestEmailOtp); bind("verifyEmailOtpBtn", verifyEmailOtp);`,
    replacement: `bind("requestEmailOtpBtn", requestEmailOtp); bind("emailOtpHaveCodeBtn", useExistingEmailOtpCode); bind("verifyEmailOtpBtn", verifyEmailOtp);`
  }
];

const EDITS = {
  "index.html": src => {
    let out = replaceOnce(src,
      `<div class="button-row"><button id="requestEmailOtpBtn" type="button">Send 6-minute code</button></div>`,
      `<div class="button-row"><button id="requestEmailOtpBtn" type="button">Send 6-minute code</button><button id="emailOtpHaveCodeBtn" type="button" data-i18n="app.emailHaveCode">I already have a code</button></div>`,
      `id="emailOtpHaveCodeBtn"`);
    for (const file of ["patron-app.js", "floqr-i18n.js", "floqai-help-repository.js"]) out = bumpScript(out, file);
    return out;
  },
  "patron-app.js": src => PATRON_APP_EDITS.reduce((out, edit) => replaceOnce(out, edit.find, edit.replacement, edit.marker), src),
  "floqr-i18n.js": src => Object.entries(I18N).reduce((out, [emailContinue, [button, hint, needEmail]]) => {
    const anchor = `      "app.emailContinue": ${JSON.stringify(emailContinue)},`;
    const at = out.indexOf(anchor);
    if (at < 0) throw new Error(`floqr-i18n.js: no pack anchor ${emailContinue}`);
    const next = out.indexOf("\n", at + anchor.length + 1);
    if (out.slice(at, next).includes("app.emailHaveCode")) return out;
    const addition = `\n      "app.emailHaveCode": ${JSON.stringify(button)},\n      "app.emailHaveCodeHint": ${JSON.stringify(hint)},\n      "app.emailHaveCodeNeedEmail": ${JSON.stringify(needEmail)},`;
    return out.slice(0, at + anchor.length) + addition + out.slice(at + anchor.length);
  }, src),
  "floqai-help-repository.js": src => {
    const anchor = `\n    {\n      id: "help-master-completed-log",`;
    if (src.includes(`id: "help-master-demo-signin"`)) return src;
    const at = src.indexOf(anchor);
    if (at < 0) throw new Error("floqai-help-repository.js: help-master-completed-log anchor missing");
    return src.slice(0, at) + HELP_ENTRY + src.slice(at);
  },
  "functions/package.json": src => {
    const match = src.match(/"test": "node --test ([^"]*)"/);
    if (!match) throw new Error("functions/package.json has no node --test script");
    const list = match[1].split(" ").filter(Boolean);
    if (!list.includes("demo-signin.test.js")) list.push("demo-signin.test.js");
    const out = src.replace(match[0], `"test": "node --test ${list.join(" ")}"`);
    JSON.parse(out);
    return out;
  },
  "functions/floqai-content-classes.json": src => {
    const manifest = JSON.parse(src);
    manifest.help["help-master-demo-signin"] = ["masterAdmin"];
    manifest.help = Object.fromEntries(Object.entries(manifest.help).sort(([a], [b]) => a.localeCompare(b)));
    return `${JSON.stringify(manifest, null, 2)}\n`;
  }
};

/* The chrome key count is pinned in the test; raise it only when this run added the three keys. */
function bumpChromeKeyCount(src) {
  const match = src.match(/assert\.equal\(chrome\.enKeys, (\d+)\);/);
  if (!match) throw new Error("functions/i18n-coverage.test.js: enKeys assertion missing");
  return src.replace(match[0], `assert.equal(chrome.enKeys, ${Number(match[1]) + Object.values(I18N)[0].length});`);
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
    if (!editFile(root, rel, edit)) continue;
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
