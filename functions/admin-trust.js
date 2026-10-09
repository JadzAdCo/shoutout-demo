/* Server-side Master / Super Admin trust: token claims, or the server email list with a verified email.
   Never reads users/{uid} fields — those are patron-editable.
   Design notes: .cursor/rules/design-notes-feature-services.mdc */
"use strict";

const DEFAULT_ADMIN_EMAILS = ["bans.don@gmail.com", "don.b@jadzholdings.com"];

function parseEmailList(raw) {
  return String(raw || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

const SERVER_ADMIN_EMAILS = Object.freeze([...new Set([
  ...DEFAULT_ADMIN_EMAILS,
  ...parseEmailList(process.env.FLOQR_MASTER_ADMIN_EMAILS),
  ...parseEmailList(process.env.FLOQR_SUPER_ADMIN_EMAILS)
])]);

function isServerAdminEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return !!normalized && SERVER_ADMIN_EMAILS.includes(normalized);
}

function isServerAdminAuth(auth) {
  const token = auth && auth.token;
  if (!token) return false;
  if (token.masterAdmin === true || token.superAdmin === true) return true;
  // An unverified token email (password sign-up, some IdPs) is only a claim, not proof of the inbox.
  return token.email_verified === true && isServerAdminEmail(token.email);
}

module.exports = {SERVER_ADMIN_EMAILS, isServerAdminEmail, isServerAdminAuth};
