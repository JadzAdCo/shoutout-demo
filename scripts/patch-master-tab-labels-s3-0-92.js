"use strict";
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "floqr-i18n.js");
let s = fs.readFileSync(file, "utf8");

const inserts = [
  ['"master.security": "Security",', '"master.security": "Security",\n      "master.shoutouts": "ShoutOut Mgmt",\n      "master.twilio": "Twilio / SendGrid Mgmt",'],
  ['"master.security": "Sécurité",', '"master.security": "Sécurité",\n      "master.shoutouts": "Gestion ShoutOut",\n      "master.twilio": "Gestion Twilio / SendGrid",'],
  ['"master.security": "Sicherheit",', '"master.security": "Sicherheit",\n      "master.shoutouts": "ShoutOut-Verwaltung",\n      "master.twilio": "Twilio / SendGrid-Verwaltung",'],
  ['"master.security": "Seguridad",', '"master.security": "Seguridad",\n      "master.shoutouts": "Gestión ShoutOut",\n      "master.twilio": "Gestión Twilio / SendGrid",'],
  ['"master.security": "Beveiliging",', '"master.security": "Beveiliging",\n      "master.shoutouts": "ShoutOut-beheer",\n      "master.twilio": "Twilio / SendGrid-beheer",'],
  ['"master.security": "Безопасность",', '"master.security": "Безопасность",\n      "master.shoutouts": "Управление ShoutOut",\n      "master.twilio": "Управление Twilio / SendGrid",'],
  ['"master.security": "Sicurezza",', '"master.security": "Sicurezza",\n      "master.shoutouts": "Gestione ShoutOut",\n      "master.twilio": "Gestione Twilio / SendGrid",'],
  ['"master.security": "Segurança",', '"master.security": "Segurança",\n      "master.shoutouts": "Gestão ShoutOut",\n      "master.twilio": "Gestão Twilio / SendGrid",'],
  ['"master.security": "Ασφάλεια",', '"master.security": "Ασφάλεια",\n      "master.shoutouts": "Διαχείριση ShoutOut",\n      "master.twilio": "Διαχείριση Twilio / SendGrid",'],
  ['"master.security": "Bezpieczeństwo informacji",', '"master.security": "Bezpieczeństwo informacji",\n      "master.shoutouts": "Zarządzanie ShoutOut",\n      "master.twilio": "Zarządzanie Twilio / SendGrid",'],
  ['"master.security": "السند المالي",', '"master.security": "السند المالي",\n      "master.shoutouts": "إدارة ShoutOut",\n      "master.twilio": "إدارة Twilio / SendGrid",']
];

let updated = 0;
for (const [from, to] of inserts) {
  if (!s.includes(from)) throw new Error("missing " + from);
  if (s.includes(from + '\n      "master.shoutouts"')) continue;
  s = s.replace(from, to);
  updated += 1;
}

fs.writeFileSync(file, s);
const shout = (s.match(/"master\.shoutouts"/g) || []).length;
const twilio = (s.match(/"master\.twilio":/g) || []).length;
console.log(JSON.stringify({ updated, shout, twilio }));
if (shout !== 11 || twilio !== 11) process.exit(1);
