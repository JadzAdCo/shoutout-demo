/**
 * Add friendly Twilio log tab labels + rename Ad Campaign Mgmt in every CHROME pack.
 * Pack order for master.twilio matches: en, fr, de, es, nl, ru, it, pt, el, pl, ar
 */
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "floqr-i18n.js");
let src = fs.readFileSync(file, "utf8");

const packs = [
  { ad: "Ad Campaign Mgmt", sms: "SMS Logs", wa: "WhatsApp Logs", feature: "Feature Logs", compliance: "Compliance Logs", mail: "SendGrid Mail Logs" },
  { ad: "Gestion campagnes pub", sms: "Journaux SMS", wa: "Journaux WhatsApp", feature: "Journaux fonctionnalité", compliance: "Journaux conformité", mail: "Journaux mail SendGrid" },
  { ad: "Werbekampagnen-Mgmt", sms: "SMS-Protokolle", wa: "WhatsApp-Protokolle", feature: "Feature-Protokolle", compliance: "Compliance-Protokolle", mail: "SendGrid-Mail-Protokolle" },
  { ad: "Gestión campañas pubs", sms: "Registros SMS", wa: "Registros WhatsApp", feature: "Registros de funciones", compliance: "Registros de cumplimiento", mail: "Registros de correo SendGrid" },
  { ad: "Advertentiecampagnes", sms: "SMS-logboeken", wa: "WhatsApp-logboeken", feature: "Functielogboeken", compliance: "Compliance-logboeken", mail: "SendGrid-maillogboeken" },
  { ad: "Упр. рекламными кампаниями", sms: "Журналы SMS", wa: "Журналы WhatsApp", feature: "Журналы функций", compliance: "Журналы соответствия", mail: "Журналы почты SendGrid" },
  { ad: "Gestione campagne ads", sms: "Log SMS", wa: "Log WhatsApp", feature: "Log funzionalità", compliance: "Log conformità", mail: "Log mail SendGrid" },
  { ad: "Gestão de campanhas", sms: "Logs de SMS", wa: "Logs de WhatsApp", feature: "Logs de funcionalidade", compliance: "Logs de conformidade", mail: "Logs de e-mail SendGrid" },
  { ad: "Διαχείριση καμπανιών", sms: "Αρχεία καταγραφής SMS", wa: "Αρχεία WhatsApp", feature: "Αρχεία λειτουργιών", compliance: "Αρχεία συμμόρφωσης", mail: "Αρχεία αλληλογραφίας SendGrid" },
  { ad: "Zarządzanie kampaniami", sms: "Dzienniki SMS", wa: "Dzienniki WhatsApp", feature: "Dzienniki funkcji", compliance: "Dzienniki zgodności", mail: "Dzienniki poczty SendGrid" },
  { ad: "إدارة الحملات الإعلانية", sms: "سجلات SMS", wa: "سجلات WhatsApp", feature: "سجلات الميزات", compliance: "سجلات الامتثال", mail: "سجلات بريد SendGrid" }
];

let adIdx = 0;
src = src.replace(/"master\.adCampaigns":\s*"[^"]*",/g, () => {
  const t = packs[adIdx] || packs[0];
  adIdx += 1;
  return `"master.adCampaigns": "${t.ad}",`;
});

let idx = 0;
src = src.replace(/"master\.twilio":\s*"[^"]*",/g, match => {
  const t = packs[idx] || packs[0];
  idx += 1;
  if (src.includes(`"master.twilioSmsLogs"`) && match.includes("already")) return match;
  // Skip if this pack already has the keys immediately after (idempotent re-run)
  return `${match}
      "master.twilioSmsLogs": "${t.sms}",
      "master.twilioWhatsAppLogs": "${t.wa}",
      "master.twilioFeatureLogs": "${t.feature}",
      "master.twilioComplianceLogs": "${t.compliance}",
      "master.twilioSendgridMailLogs": "${t.mail}",`;
});

if (adIdx !== 11 || idx !== 11) {
  console.error(`Expected 11 inserts each; ad=${adIdx} twilio=${idx}`);
  process.exit(1);
}

fs.writeFileSync(file, src);
console.log("Patched Ad Campaign Mgmt + Twilio log chrome labels in 11 packs");
