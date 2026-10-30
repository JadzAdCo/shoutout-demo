#!/usr/bin/env node
/* Accounts management profile seeder.
 * Design notes: .cursor/rules/design-notes-accounts-profile.mdc
 *
 *   node scripts/seed-accounts-profile.js                    dry run (default): validate + masked plan
 *   node scripts/seed-accounts-profile.js --apply --confirm-project shoutoutdemo-5b402
 *   node scripts/seed-accounts-profile.js --write-example    regenerate config/accounts-profile.example.json
 *
 * Options: --profile <path> (default config/accounts-profile.local.json), --env-file <path>
 * (default functions/.env), --only <account,account>, --by <email>.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PROFILE_VERSION = 1;
const DEFAULT_PROJECT = "shoutoutdemo-5b402";
const DEFAULT_GITHUB_REPO = "jadzadco/shoutout-demo";
const STATUS_COLLECTION = "platformAccountsProfile";
const STATUS_DOC = "current";
const PUBLIC_CONFIG_DOC = "publicConfig";

const FORMATS = {
  twilioAccountSid: {re: /^AC[0-9a-f]{32}$/, hint: "AC + 32 hex characters"},
  twilioAuthToken: {re: /^[0-9a-f]{32}$/, hint: "32 hex characters"},
  twilioContentSid: {re: /^HX[0-9a-f]{32}$/i, hint: "HX + 32 hex characters (Content Template SID)"},
  e164: {re: /^\+[1-9]\d{7,14}$/, hint: "E.164 phone, e.g. +12025550100"},
  whatsappE164: {re: /^whatsapp:\+[1-9]\d{7,14}$/, hint: "whatsapp:+<E.164>, e.g. whatsapp:+12025550100"},
  sendgridKey: {re: /^SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}$/, hint: "SG.<id>.<secret>"},
  email: {re: /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/, hint: "email address"},
  hostname: {re: /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, hint: "lower-case host name, e.g. www.floqr.app"},
  httpsOrigin: {re: /^https:\/\/([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, hint: "https://host with no path or trailing slash"},
  httpsUrl: {re: /^https:\/\/[^\s]+$/, hint: "https:// URL"},
  stripeSecretKey: {re: /^(sk|rk)_(live|test)_[A-Za-z0-9]{16,}$/, hint: "sk_live_… / rk_live_… (or _test_ in test mode)"},
  stripePublishableKey: {re: /^pk_(live|test)_[A-Za-z0-9]{16,}$/, hint: "pk_live_… / pk_test_…"},
  stripeWebhookSecret: {re: /^whsec_[A-Za-z0-9]{16,}$/, hint: "whsec_…"},
  stripeConnectClientId: {re: /^ca_[A-Za-z0-9]{16,}$/, hint: "ca_…"},
  stripeMode: {re: /^(live|test)$/, hint: "live or test"},
  posEnvironment: {re: /^(sandbox|production)$/, hint: "sandbox or production"},
  tsaProvider: {re: /^(digicert|sectigo)$/, hint: "digicert or sectigo (VIP-P-04)"},
  uuid: {re: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, hint: "GUID"},
  digits: {re: /^\d{6,20}$/, hint: "numeric id"},
  recaptchaSiteKey: {re: /^[A-Za-z0-9_-]{30,60}$/, hint: "reCAPTCHA / App Check site key (public)"},
  gcpServiceAccount: {re: /^[a-z0-9-]+@[a-z0-9-]+(\.iam)?\.gserviceaccount\.com$/, hint: "name@project.iam.gserviceaccount.com"},
  turnUrls: {re: /^(turns?|stuns?):[^\s,]+(,(turns?|stuns?):[^\s,]+)*$/, hint: "comma list of turn:/turns: URLs"},
  token: {re: /^[^\s]{8,4096}$/, hint: "single-line token, 8+ characters, no spaces"},
  text: {re: /^[^\r\n]{1,200}$/, hint: "single line, up to 200 characters"},
  confirmed: {re: /^(true|false)$/, hint: "true once done in the Console"}
};

const SECRET_LOOKING = [/^(sk|rk)_(live|test)_/, /^whsec_/, /^SG\./, /-----BEGIN/, /^EAA[A-Za-z0-9]{20,}/];

/* Target types: firebaseSecret (Secret Manager via firebase CLI, stdin) · functionsEnv (plain key in
 * functions/.env) · githubSecret (gh secret set, stdin) · firestoreDoc (platformAccountsProfile/publicConfig,
 * non-secret only) · manual (Console step, recorded as 0|1 only). */
function f(key, label, opts) {
  return {key, label, required: true, wired: true, ...opts};
}

const CATALOG = [
  {
    id: "twilio",
    label: "Twilio (SMS + WhatsApp)",
    fields: [
      f("accountSid", "Account SID", {secret: true, format: "twilioAccountSid", target: {type: "firebaseSecret", name: "TWILIO_ACCOUNT_SID"}, where: "Twilio Console → Account → API keys & tokens"}),
      f("authToken", "Auth token", {secret: true, format: "twilioAuthToken", target: {type: "firebaseSecret", name: "TWILIO_AUTH_TOKEN"}, where: "Twilio Console → Account → API keys & tokens → Auth token"}),
      f("smsFrom", "SMS sender number", {secret: true, format: "e164", target: {type: "firebaseSecret", name: "TWILIO_FROM_NUMBER"}, where: "Twilio Console → Phone Numbers → Active numbers"}),
      f("whatsappFrom", "WhatsApp production sender", {secret: true, format: "whatsappE164", target: {type: "firebaseSecret", name: "TWILIO_WHATSAPP_FROM"}, where: "Twilio Console → Messaging → Senders → WhatsApp senders (approved FLOQR number, not the sandbox +14155238886)"}),
      f("whatsappOtpContentSid", "WhatsApp OTP Authentication template SID", {secret: false, format: "twilioContentSid", target: {type: "functionsEnv", name: "TWILIO_WHATSAPP_OTP_CONTENT_SID"}, where: "Twilio Console → Messaging → Content Template Builder → approved WhatsApp Authentication template (HX…)"})
    ],
    manual: [
      {key: "whatsappSenderRegistered", label: "Production WhatsApp sender registered with Meta Business verification, display name FLOQR"},
      {key: "otpTemplateApproved", label: "Authentication template (copy-code, {{1}} = 6-digit code) approved by Meta for en (+ fr, es, de, pt, it, ar)"}
    ],
    after: "Redeploy requestWhatsAppOtp + verifyWhatsAppOtp from a clean archive of origin/main (copy functions/.env into the export), then prove delivery to the owner's number."
  },
  {
    id: "sendgrid",
    label: "SendGrid (email OTP, receipts, SOS2FA)",
    fields: [
      f("apiKey", "API key (Mail Send)", {secret: true, format: "sendgridKey", target: {type: "firebaseSecret", name: "SENDGRID_API_KEY"}, where: "SendGrid → Settings → API Keys → Create (restricted: Mail Send)"}),
      f("fromEmail", "OTP / receipt sender address", {secret: false, format: "email", target: {type: "functionsEnv", name: "FLOQR_EMAIL_OTP_FROM"}, where: "A verified sender on the authenticated domain (e.g. login@floqr.app)"}),
      f("receiptFrom", "Ad receipt sender address", {secret: false, required: false, format: "email", target: {type: "functionsEnv", name: "FLOQR_RECEIPT_FROM"}, where: "Same verified domain; defaults to the OTP sender when empty"}),
      f("senderDomain", "Authenticated sender domain", {secret: false, format: "hostname", target: {type: "firestoreDoc"}, where: "SendGrid → Settings → Sender Authentication"})
    ],
    manual: [
      {key: "domainAuthenticated", label: "Sender domain authenticated (SendGrid CNAMEs added to DNS) and link branding on"}
    ]
  },
  {
    id: "stripe",
    label: "Stripe (platform keys, Connect, webhooks)",
    fields: [
      f("mode", "Key mode", {secret: false, format: "stripeMode", target: {type: "firestoreDoc"}, where: "live for production, test for staging"}),
      f("secretKey", "Secret or restricted key", {secret: true, format: "stripeSecretKey", target: {type: "firebaseSecret", name: "STRIPE_SECRET_KEY"}, where: "Stripe Dashboard → Developers → API keys (prefer a restricted rk_ key)"}),
      f("webhookSecret", "Platform webhook signing secret", {secret: true, format: "stripeWebhookSecret", target: {type: "firebaseSecret", name: "STRIPE_WEBHOOK_SECRET"}, where: "Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret"}),
      f("publishableKey", "Publishable key", {secret: false, format: "stripePublishableKey", target: {type: "firestoreDoc"}, where: "Stripe Dashboard → Developers → API keys"}),
      f("connectClientId", "Connect client id", {secret: false, required: false, wired: false, format: "stripeConnectClientId", target: {type: "firestoreDoc"}, where: "Stripe Dashboard → Connect → Settings → OAuth (ca_…)"}),
      f("connectWebhookSecret", "Connect webhook signing secret", {secret: true, required: false, wired: false, format: "stripeWebhookSecret", target: {type: "firebaseSecret", name: "STRIPE_CONNECT_WEBHOOK_SECRET"}, where: "Stripe Dashboard → Webhooks → Connect endpoint → Signing secret"})
    ],
    manual: [
      {key: "returnUrlsAllowed", label: "Checkout / Customer Portal return URLs and Connect redirect URIs allow https://www.floqr.app"},
      {key: "connectPlatformProfile", label: "Connect platform profile complete (destination charges + on_behalf_of, VIP-B-01)"}
    ]
  },
  {
    id: "firebaseAuth",
    label: "Firebase Auth provider settings (Console only)",
    fields: [],
    manual: [
      {key: "emailPasswordDisabled", label: "Authentication → Sign-in method → Email/Password → Disable"},
      {key: "authorizedDomains", label: "Authentication → Settings → Authorized domains: www.floqr.app, floqr.app (+ admin / master / staging when used)"},
      {key: "smsRegionPolicyUsCa", label: "Authentication → Settings → SMS region policy = Allow US + CA"}
    ]
  },
  {
    id: "azure",
    label: "Azure (subscription, Static Web Apps, DNS)",
    fields: [
      f("subscriptionId", "Subscription id", {secret: false, format: "uuid", target: {type: "firestoreDoc"}, where: "Azure Portal → Subscriptions"}),
      f("tenantId", "Tenant id", {secret: false, format: "uuid", target: {type: "firestoreDoc"}, where: "Azure Portal → Microsoft Entra ID → Overview"}),
      f("resourceGroup", "Resource group", {secret: false, format: "text", target: {type: "firestoreDoc"}, where: "Azure Portal → Resource groups"}),
      f("staticWebAppName", "Static Web App name", {secret: false, format: "text", target: {type: "firestoreDoc"}, where: "Azure Portal → Static Web Apps"}),
      f("staticWebAppDeployToken", "Static Web Apps deployment token", {secret: true, wired: false, format: "token", target: {type: "githubSecret", name: "AZURE_STATIC_WEB_APPS_API_TOKEN"}, where: "Static Web App → Overview → Manage deployment token"}),
      f("dnsZone", "DNS zone", {secret: false, format: "hostname", target: {type: "firestoreDoc"}, where: "Azure Portal → DNS zones (floqr.app)"})
    ],
    manual: [
      {key: "customDomains", label: "Custom domains bound with TLS: www.floqr.app, admin.floqr.app, master.floqr.app, staging.floqr.app"},
      {key: "apexRedirect", label: "Apex floqr.app → https://www.floqr.app 301"}
    ]
  },
  {
    id: "domain",
    label: "Domain, OAuth redirects, App Check (www.floqr.app)",
    fields: [
      f("canonicalOrigin", "Canonical origin", {secret: false, format: "httpsOrigin", target: {type: "firestoreDoc"}, where: "Owner decision Oct 29 2026: https://www.floqr.app"}),
      f("adminHost", "Admin host", {secret: false, required: false, format: "hostname", target: {type: "firestoreDoc"}, where: "admin.floqr.app (admin fork)"}),
      f("masterHost", "Master Admin host", {secret: false, required: false, format: "hostname", target: {type: "firestoreDoc"}, where: "master.floqr.app"}),
      f("stagingHost", "Staging host", {secret: false, required: false, format: "hostname", target: {type: "firestoreDoc"}, where: "staging.floqr.app"}),
      f("recaptchaSiteKey", "reCAPTCHA Enterprise / App Check site key", {secret: false, wired: false, format: "recaptchaSiteKey", target: {type: "firestoreDoc"}, where: "Google Cloud → Security → reCAPTCHA → key for www.floqr.app (site keys are public)"}),
      f("functionsPublicOrigin", "Functions link origin (cutover only)", {secret: false, required: false, format: "httpsOrigin", target: {type: "functionsEnv", name: "FLOQR_PUBLIC_ORIGIN"}, where: "Leave empty while GitHub Pages is staging; set https://www.floqr.app on cutover day"}),
      f("functionsDisplayBaseUrl", "Display link base (cutover only)", {secret: false, required: false, format: "httpsOrigin", target: {type: "functionsEnv", name: "FLOQR_DISPLAY_BASE_URL"}, where: "Leave empty until cutover; then https://www.floqr.app (Display URLs change host only)"})
    ],
    manual: [
      {key: "oauthRedirects", label: "Google, Microsoft, Facebook OAuth JS origins + redirect URIs include https://www.floqr.app"},
      {key: "appCheckRegistered", label: "App Check: reCAPTCHA Enterprise provider registered for the web app with the www.floqr.app key"}
    ]
  },
  {
    id: "floqcastTurn",
    label: "TURN server for floqCast",
    fields: [
      f("urls", "TURN URLs", {secret: false, wired: false, format: "turnUrls", target: {type: "functionsEnv", name: "FLOQCAST_TURN_URLS"}, where: "TURN provider dashboard (e.g. turns:turn.example.com:443?transport=tcp)"}),
      f("username", "TURN username", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "FLOQCAST_TURN_USERNAME"}, where: "TURN provider dashboard"}),
      f("credential", "TURN credential", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "FLOQCAST_TURN_CREDENTIAL"}, where: "TURN provider dashboard"})
    ],
    manual: []
  },
  {
    id: "gcpDisplaySigner",
    label: "Google Cloud IAM — display token signer",
    fields: [
      f("runtimeServiceAccount", "Functions runtime service account", {secret: false, format: "gcpServiceAccount", target: {type: "firestoreDoc"}, where: "Google Cloud → Cloud Run / Functions → service account of getFloqCastDisplaySession"})
    ],
    manual: [
      {key: "tokenCreatorGranted", label: "IAM: grant roles/iam.serviceAccountTokenCreator to the runtime service account on itself (createCustomToken without a key file)"}
    ]
  },
  {
    id: "squarePos",
    label: "Square POS partner app",
    fields: [
      f("applicationId", "Application id", {secret: false, wired: false, format: "text", target: {type: "functionsEnv", name: "POS_SQUARE_APP_ID"}, where: "Square Developer → Applications → Credentials"}),
      f("environment", "Environment", {secret: false, wired: false, format: "posEnvironment", target: {type: "functionsEnv", name: "POS_SQUARE_ENVIRONMENT"}, where: "sandbox until certified"}),
      f("appSecret", "Application secret", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_SQUARE_APP_SECRET"}, where: "Square Developer → OAuth → Application secret"}),
      f("webhookKey", "Webhook signature key", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_SQUARE_WEBHOOK_KEY"}, where: "Square Developer → Webhooks → subscription → Signature key"})
    ],
    manual: [{key: "redirectRegistered", label: "OAuth redirect URI registered on https://www.floqr.app/… and the current Functions URL"}]
  },
  {
    id: "toastPos",
    label: "Toast POS partner",
    fields: [
      f("clientId", "Client id", {secret: false, wired: false, format: "text", target: {type: "functionsEnv", name: "POS_TOAST_CLIENT_ID"}, where: "Toast partner portal → integration credentials"}),
      f("clientSecret", "Client secret", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_TOAST_CLIENT_SECRET"}, where: "Toast partner portal"}),
      f("webhookSecretOrders", "Orders webhook secret", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_TOAST_WEBHOOK_SECRET_ORDERS"}, where: "Toast partner portal → webhooks"}),
      f("webhookSecretPartners", "Partners webhook secret", {secret: true, wired: false, required: false, format: "token", target: {type: "firebaseSecret", name: "POS_TOAST_WEBHOOK_SECRET_PARTNERS"}, where: "Toast partner portal → webhooks"})
    ],
    manual: [{key: "partnerApproved", label: "Toast partner integration approved for the FLOQR app"}]
  },
  {
    id: "spotonPos",
    label: "SpotOn POS partner",
    fields: [
      f("clientId", "Client id", {secret: false, wired: false, format: "text", target: {type: "functionsEnv", name: "POS_SPOTON_CLIENT_ID"}, where: "SpotOn partner / developer portal"}),
      f("clientSecret", "Client secret", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_SPOTON_CLIENT_SECRET"}, where: "SpotOn partner / developer portal"}),
      f("webhookKey", "Webhook key", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_SPOTON_WEBHOOK_KEY"}, where: "SpotOn partner portal → webhooks"})
    ],
    manual: []
  },
  {
    id: "cloverPos",
    label: "Clover POS app",
    fields: [
      f("appId", "App id", {secret: false, wired: false, format: "text", target: {type: "functionsEnv", name: "POS_CLOVER_APP_ID"}, where: "Clover Developer Dashboard → Your apps → App settings"}),
      f("environment", "Environment", {secret: false, wired: false, format: "posEnvironment", target: {type: "functionsEnv", name: "POS_CLOVER_ENVIRONMENT"}, where: "sandbox until approved"}),
      f("appSecret", "App secret", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_CLOVER_APP_SECRET"}, where: "Clover Developer Dashboard → App settings"}),
      f("webhookAuth", "Webhook auth code", {secret: true, wired: false, format: "token", target: {type: "firebaseSecret", name: "POS_CLOVER_WEBHOOK_AUTH"}, where: "Clover Developer Dashboard → Webhooks"})
    ],
    manual: [{key: "redirectRegistered", label: "Site URL / redirect registered on https://www.floqr.app"}]
  },
  {
    id: "tsa",
    label: "Trusted timestamp authority (VIP signatures)",
    fields: [
      f("provider", "Provider", {secret: false, wired: false, format: "tsaProvider", target: {type: "firestoreDoc"}, where: "VIP-P-04: paid DigiCert or Sectigo"}),
      f("url", "RFC 3161 endpoint", {secret: false, wired: false, format: "httpsUrl", target: {type: "functionsEnv", name: "VIP_TSA_URL"}, where: "Provider account → timestamp service URL"}),
      f("username", "Account username", {secret: true, wired: false, required: false, format: "token", target: {type: "firebaseSecret", name: "VIP_TSA_USERNAME"}, where: "Provider account (only for authenticated TSA plans)"}),
      f("password", "Account password / API key", {secret: true, wired: false, required: false, format: "token", target: {type: "firebaseSecret", name: "VIP_TSA_PASSWORD"}, where: "Provider account (only for authenticated TSA plans)"})
    ],
    manual: []
  },
  {
    id: "metaBusiness",
    label: "Meta Business (WhatsApp)",
    fields: [
      f("businessId", "Business portfolio id", {secret: false, format: "digits", target: {type: "firestoreDoc"}, where: "Meta Business Suite → Settings → Business info"}),
      f("whatsappBusinessAccountId", "WhatsApp Business Account id", {secret: false, format: "digits", target: {type: "firestoreDoc"}, where: "Meta Business Suite → WhatsApp accounts (or Twilio sender details)"}),
      f("displayName", "WhatsApp display name", {secret: false, format: "text", target: {type: "firestoreDoc"}, where: "Approved display name (FLOQR)"})
    ],
    manual: [{key: "businessVerified", label: "Meta Business verification complete"}]
  }
];

function accountById(id) {
  return CATALOG.find(account => account.id === id) || null;
}

function rawValue(entry) {
  if (entry === null || entry === undefined) return "";
  if (typeof entry === "object" && !Array.isArray(entry)) return rawValue(entry.value);
  if (typeof entry === "boolean") return entry ? "true" : "false";
  return String(entry).trim();
}

function mask(value, secret) {
  const text = String(value || "");
  if (!text) return "(empty)";
  if (!secret) return text.length > 60 ? `${text.slice(0, 57)}…` : text;
  return text.length >= 16 ? `••••${text.slice(-4)}` : "•••• (set)";
}

function lastFour(value, secret) {
  const text = String(value || "");
  return secret && text.length >= 16 ? `••••${text.slice(-4)}` : "";
}

function validateField(field, value, context = {}) {
  if (!value) return field.required ? {status: "missing"} : {status: "empty"};
  const format = FORMATS[field.format];
  if (!format) return {status: "invalid", error: `unknown format ${field.format}`};
  if (!format.re.test(value)) return {status: "invalid", error: `expected ${format.hint}`};
  if (!field.secret && SECRET_LOOKING.some(re => re.test(value))) {
    return {status: "invalid", error: "looks like a secret but this field is not secret — check the field"};
  }
  if (field.format === "stripeSecretKey" || field.format === "stripePublishableKey") {
    const mode = /_live_/.test(value) ? "live" : "test";
    if (context.stripeMode && context.stripeMode !== mode) {
      return {status: "invalid", error: `key is ${mode} but stripe.mode is ${context.stripeMode}`};
    }
  }
  return {status: "ok"};
}

function validateManual(value) {
  if (!value) return {status: "missing"};
  if (!FORMATS.confirmed.re.test(value)) return {status: "invalid", error: FORMATS.confirmed.hint};
  return {status: value === "true" ? "ok" : "missing"};
}

/* Returns {errors, accounts: [{id, label, provided, fields: [...], manual: [...]}]}. */
function validateProfile(profile, {only} = {}) {
  const errors = [];
  if (!profile || typeof profile !== "object") return {errors: ["profile is not a JSON object"], accounts: []};
  if (Number(profile.profileVersion) !== PROFILE_VERSION) errors.push(`profileVersion must be ${PROFILE_VERSION}`);
  const input = profile.accounts && typeof profile.accounts === "object" ? profile.accounts : {};
  Object.keys(input).forEach(id => {
    const account = accountById(id);
    if (!account) { errors.push(`unknown account "${id}"`); return; }
    const known = new Set([...account.fields.map(x => x.key), ...account.manual.map(x => x.key)]);
    const entry = input[id] || {};
    const values = entry.fields || entry;
    Object.keys(values).forEach(key => {
      if (key === "manual" || key.startsWith("_")) return;
      if (!known.has(key)) errors.push(`${id}.${key}: unknown field`);
    });
    Object.keys(entry.manual || {}).forEach(key => {
      if (!known.has(key)) errors.push(`${id}.manual.${key}: unknown step`);
    });
  });
  const stripeEntry = input.stripe || {};
  const stripeMode = rawValue((stripeEntry.fields || stripeEntry).mode);
  const accounts = CATALOG.filter(account => !only || only.includes(account.id)).map(account => {
    const entry = input[account.id] || {};
    const values = entry.fields || entry;
    const manualValues = entry.manual || {};
    const fields = account.fields.map(field => {
      const value = rawValue(values[field.key]);
      const result = validateField(field, value, {stripeMode: FORMATS.stripeMode.re.test(stripeMode) ? stripeMode : ""});
      if (result.status === "invalid") errors.push(`${account.id}.${field.key}: ${result.error}`);
      return {...field, value, ...result};
    });
    const manual = account.manual.map(step => {
      const result = validateManual(rawValue(manualValues[step.key]));
      if (result.status === "invalid") errors.push(`${account.id}.manual.${step.key}: ${result.error}`);
      return {...step, ...result};
    });
    const provided = fields.some(x => x.status === "ok") || manual.some(x => x.status === "ok");
    return {id: account.id, label: account.label, after: account.after || "", provided, fields, manual};
  });
  return {errors, accounts};
}

function targetLabel(target) {
  if (target.type === "firebaseSecret") return `Firebase secret ${target.name}`;
  if (target.type === "functionsEnv") return `functions/.env ${target.name}`;
  if (target.type === "githubSecret") return `GitHub Actions secret ${target.name}`;
  if (target.type === "firestoreDoc") return `Firestore ${STATUS_COLLECTION}/${PUBLIC_CONFIG_DOC}`;
  return "manual";
}

function formatPlan(validation, {projectId, apply}) {
  const lines = [];
  lines.push(`Accounts profile — project ${projectId} — ${apply ? "APPLY" : "DRY RUN (nothing is written)"}`);
  validation.accounts.forEach(account => {
    lines.push("", `## ${account.label} [${account.id}]${account.provided ? "" : " — nothing provided, skipped"}`);
    account.fields.forEach(field => {
      const state = field.status === "ok" ? "set" : field.status;
      const note = field.wired ? "" : " (not read by code yet)";
      lines.push(`  ${state === "set" ? "✓" : field.status === "invalid" ? "✗" : "·"} ${field.key} = ${field.status === "ok" ? mask(field.value, field.secret) : `(${state})`} → ${targetLabel(field.target)}${field.secret ? " [secret]" : ""}${note}${field.error ? ` — ${field.error}` : ""}`);
    });
  });
  const manual = validation.accounts.flatMap(account => account.manual.map(step => ({account, step})));
  if (manual.length) {
    lines.push("", "## Console-only manual steps (tick in the profile with true once done)");
    manual.forEach(({account, step}) => lines.push(`  [${step.status === "ok" ? "x" : " "}] ${account.id}: ${step.label}`));
  }
  const after = validation.accounts.filter(account => account.provided && account.after);
  if (after.length) {
    lines.push("", "## After apply");
    after.forEach(account => lines.push(`  - ${account.id}: ${account.after}`));
  }
  if (validation.accounts.some(account => account.fields.some(x => x.status === "ok" && x.target.type === "functionsEnv"))) {
    lines.push("  - functions/.env is gitignored: copy it into the clean origin/main export before `firebase deploy`.");
  }
  if (validation.errors.length) {
    lines.push("", `## ${validation.errors.length} error(s) — fix before --apply`);
    validation.errors.forEach(error => lines.push(`  ✗ ${error}`));
  }
  return lines.join("\n");
}

function envLine(key, value) {
  return /[\s#"'=]/.test(value) ? `${key}="${value.replace(/["\\]/g, "\\$&")}"` : `${key}=${value}`;
}

/* Replaces or appends only the given keys; every other line is kept byte-for-byte. */
function updateEnvText(text, updates) {
  const pending = new Map(Object.entries(updates));
  const eol = /\r\n/.test(text) ? "\r\n" : "\n";
  const lines = text ? text.split(/\r?\n/) : [];
  const out = lines.map(line => {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return envLine(match[1], value);
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  pending.forEach((value, key) => out.push(envLine(key, value)));
  return out.join(eol) + eol;
}

function statusDoc(validation, previous, {updatedBy, nowMs, failed = new Set()}) {
  const prevAccounts = (previous && previous.accounts) || {};
  const accounts = {...prevAccounts};
  validation.accounts.filter(account => account.provided).forEach(account => {
    const before = prevAccounts[account.id] || {};
    const fields = {...(before.fields || {})};
    account.fields.forEach(field => {
      if (field.status !== "ok" || failed.has(field.target.name)) return;
      const row = {set: 1, target: targetLabel(field.target), secret: field.secret ? 1 : 0};
      const tail = lastFour(field.value, field.secret);
      if (tail) row.last4 = tail;
      fields[field.key] = row;
    });
    const manual = {...(before.manual || {})};
    account.manual.forEach(step => { if (step.status === "ok") manual[step.key] = 1; else if (!(step.key in manual)) manual[step.key] = 0; });
    const requiredSet = account.fields.filter(x => x.required).every(x => fields[x.key] && fields[x.key].set === 1);
    const manualDone = account.manual.every(x => manual[x.key] === 1);
    accounts[account.id] = {configured: requiredSet && manualDone ? 1 : 0, fields, manual, updatedAtMs: nowMs};
  });
  return {profileVersion: PROFILE_VERSION, accounts, updatedAtMs: nowMs, updatedBy};
}

function publicConfigDoc(validation, {updatedBy, nowMs}) {
  const doc = {updatedAtMs: nowMs, updatedBy};
  validation.accounts.forEach(account => {
    account.fields.filter(x => x.status === "ok" && x.target.type === "firestoreDoc" && !x.secret).forEach(field => {
      doc[account.id] = {...(doc[account.id] || {}), [field.key]: field.value};
    });
  });
  return doc;
}

function redact(text, secrets) {
  let out = String(text || "");
  secrets.filter(Boolean).forEach(secret => { out = out.split(secret).join("[redacted]"); });
  return out;
}

function defaultRunner(command, args, input) {
  const isWin = process.platform === "win32";
  const result = childProcess.spawnSync(isWin ? `${command}.cmd` : command, args, {
    input, encoding: "utf8", shell: isWin, windowsHide: true, stdio: ["pipe", "pipe", "pipe"]
  });
  return {status: result.status, output: `${result.stdout || ""}${result.stderr || ""}${result.error ? result.error.message : ""}`};
}

async function applyProfile(validation, opts) {
  const {projectId, githubRepo, envFile, runner = defaultRunner, firestore, updatedBy, nowMs = Date.now(), log = console.log} = opts;
  const secretValues = validation.accounts.flatMap(a => a.fields.filter(x => x.secret && x.value).map(x => x.value));
  const fields = validation.accounts.filter(a => a.provided).flatMap(a => a.fields.map(x => ({...x, account: a.id}))).filter(x => x.status === "ok");
  const failures = [];
  for (const field of fields.filter(x => x.target.type === "firebaseSecret")) {
    const result = runner("firebase", ["functions:secrets:set", field.target.name, "--project", projectId, "--non-interactive"], field.value);
    const ok = result.status === 0;
    log(`  ${ok ? "✓" : "✗"} Firebase secret ${field.target.name} (${mask(field.value, true)})${ok ? "" : ` — ${redact(result.output, secretValues).trim().split(/\r?\n/).pop()}`}`);
    if (!ok) failures.push(field.target.name);
  }
  for (const field of fields.filter(x => x.target.type === "githubSecret")) {
    const result = runner("gh", ["secret", "set", field.target.name, "--repo", githubRepo], field.value);
    const ok = result.status === 0;
    log(`  ${ok ? "✓" : "✗"} GitHub secret ${field.target.name} (${mask(field.value, true)})${ok ? "" : ` — ${redact(result.output, secretValues).trim().split(/\r?\n/).pop()}`}`);
    if (!ok) failures.push(field.target.name);
  }
  const envUpdates = {};
  fields.filter(x => x.target.type === "functionsEnv" && !x.secret).forEach(x => { envUpdates[x.target.name] = x.value; });
  if (Object.keys(envUpdates).length) {
    const before = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
    fs.writeFileSync(envFile, updateEnvText(before, envUpdates), "utf8");
    log(`  ✓ ${path.relative(ROOT, envFile) || envFile}: ${Object.keys(envUpdates).join(", ")}`);
  }
  if (firestore) {
    const ref = firestore.collection(STATUS_COLLECTION);
    const previous = await ref.doc(STATUS_DOC).get();
    const status = statusDoc(validation, previous.exists ? previous.data() : null, {updatedBy, nowMs, failed: new Set(failures)});
    const publicConfig = publicConfigDoc(validation, {updatedBy, nowMs});
    if (Object.keys(publicConfig).length > 2) await ref.doc(PUBLIC_CONFIG_DOC).set(publicConfig, {merge: true});
    await ref.doc(STATUS_DOC).set(status, {merge: true});
    log(`  ✓ Firestore ${STATUS_COLLECTION}/${STATUS_DOC} (status, masked) + ${PUBLIC_CONFIG_DOC} (non-secret values)`);
  }
  return {failures};
}

function exampleProfile() {
  return {
    _readme: [
      "Copy this file to config/accounts-profile.local.json (gitignored) and fill each value.",
      "Leave a value empty to skip it — empty values never clear an existing secret.",
      "Set a manual step to true once you have done it in the Console.",
      "Dry run: node scripts/seed-accounts-profile.js   Apply: add --apply --confirm-project <projectId>",
      "Only value / manual entries are read; target, secret, and format come from the script catalog."
    ],
    profileVersion: PROFILE_VERSION,
    projectId: DEFAULT_PROJECT,
    githubRepo: DEFAULT_GITHUB_REPO,
    accounts: Object.fromEntries(CATALOG.map(account => [account.id, {
      _label: account.label,
      fields: Object.fromEntries(account.fields.map(field => [field.key, {
        value: "",
        description: field.label,
        whereToGet: field.where,
        secret: field.secret,
        required: field.required,
        format: FORMATS[field.format].hint,
        target: targetLabel(field.target),
        readByCodeToday: field.wired
      }])),
      manual: Object.fromEntries(account.manual.map(step => [step.key, {value: false, description: step.label, target: "Console-only manual step"}]))
    }]))
  };
}

function parseArgs(argv) {
  const args = {apply: false, writeExample: false};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg === "--write-example") args.writeExample = true;
    else if (["--profile", "--env-file", "--only", "--by", "--confirm-project"].includes(arg)) args[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else throw new Error(`unknown option ${arg}`);
  }
  return args;
}

async function firestoreFromCli(projectId) {
  const admin = require(path.join(ROOT, "functions/node_modules/firebase-admin"));
  let adcPath = "";
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const cli = path.join(process.env.APPDATA || "", "npm/node_modules/firebase-tools/lib");
    const fauth = require(path.join(cli, "auth"));
    const scopes = require(path.join(cli, "scopes"));
    const api = require(path.join(cli, "api"));
    const account = fauth.getGlobalDefaultAccount();
    const refreshToken = account && account.tokens && account.tokens.refresh_token;
    if (!refreshToken) throw new Error("Firebase CLI has no refresh token. Run: firebase login");
    await fauth.getAccessToken(refreshToken, [scopes.CLOUD_PLATFORM, scopes.FIREBASE_PLATFORM]);
    adcPath = path.join(os.tmpdir(), `floqr-accounts-adc-${process.pid}.json`);
    fs.writeFileSync(adcPath, JSON.stringify({type: "authorized_user", client_id: api.clientId(), client_secret: api.clientSecret(), refresh_token: refreshToken}), {encoding: "utf8", mode: 0o600});
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
  }
  const app = admin.initializeApp({projectId, credential: admin.credential.applicationDefault()}, `accounts-profile-${process.pid}`);
  return {db: app.firestore(), cleanup: async () => { await app.delete(); if (adcPath) fs.rmSync(adcPath, {force: true}); }};
}

function gitEmail() {
  try {
    return childProcess.execFileSync("git", ["config", "user.email"], {cwd: ROOT, encoding: "utf8"}).trim();
  } catch (_) {
    return "";
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.writeExample) {
    const out = path.join(ROOT, "config/accounts-profile.example.json");
    fs.mkdirSync(path.dirname(out), {recursive: true});
    fs.writeFileSync(out, `${JSON.stringify(exampleProfile(), null, 2)}\n`, "utf8");
    console.log(`Wrote ${path.relative(ROOT, out)}`);
    return 0;
  }
  const profilePath = path.resolve(ROOT, args.profile || "config/accounts-profile.local.json");
  if (!fs.existsSync(profilePath)) {
    console.error(`No profile at ${path.relative(ROOT, profilePath)}. Copy config/accounts-profile.example.json to config/accounts-profile.local.json and fill it.`);
    return 2;
  }
  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  } catch (err) {
    console.error(`Profile is not valid JSON (${err.message.replace(/".*"/g, "…")}).`);
    return 2;
  }
  const projectId = String(profile.projectId || DEFAULT_PROJECT);
  const only = args.only ? args.only.split(",").map(x => x.trim()).filter(Boolean) : null;
  const validation = validateProfile(profile, {only});
  console.log(formatPlan(validation, {projectId, apply: args.apply}));
  if (validation.errors.length) return 1;
  if (!args.apply) {
    console.log("\nDry run only. Re-run with --apply --confirm-project <projectId> to write.");
    return 0;
  }
  if (args.confirmProject !== projectId) {
    console.error(`\n--apply needs --confirm-project ${projectId} (must match profile.projectId).`);
    return 2;
  }
  const updatedBy = args.by || gitEmail() || os.userInfo().username;
  console.log("\nApplying…");
  const {db, cleanup} = await firestoreFromCli(projectId);
  try {
    const {failures} = await applyProfile(validation, {
      projectId,
      githubRepo: String(profile.githubRepo || DEFAULT_GITHUB_REPO),
      envFile: path.resolve(ROOT, args.envFile || "functions/.env"),
      firestore: db,
      updatedBy
    });
    if (failures.length) {
      console.error(`\n${failures.length} write(s) failed: ${failures.join(", ")}. They are not marked set in the status doc — fix and re-run.`);
      return 1;
    }
  } finally {
    await cleanup();
  }
  console.log("\nDone. Redeploy the Functions that read changed secrets / env keys from a clean origin/main export.");
  return 0;
}

module.exports = {
  CATALOG, FORMATS, PROFILE_VERSION, STATUS_COLLECTION, STATUS_DOC, PUBLIC_CONFIG_DOC,
  mask, lastFour, validateField, validateProfile, formatPlan, updateEnvText, statusDoc, publicConfigDoc,
  applyProfile, exampleProfile, parseArgs, redact
};

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, err => {
    console.error(`seed-accounts-profile failed: ${err.message}`);
    process.exitCode = 1;
  });
}
