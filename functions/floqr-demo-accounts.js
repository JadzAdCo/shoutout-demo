"use strict";

const DEMO_EMAIL_DOMAIN = "floqr-demo.com";
const DEMO_EMAIL_PATTERN = /^temp_[a-z0-9]+_\d+@floqr-demo\.com$/;
const DEMO_OTP_REDIRECT_EMAIL = String(
  process.env.FLOQR_DEMO_OTP_REDIRECT_EMAIL || "bans.don@gmail.com"
).trim().toLowerCase();

function normalizeDemoEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isFloqrDemoEmail(email = "") {
  return DEMO_EMAIL_PATTERN.test(normalizeDemoEmail(email));
}

function looksLikeBrokenDemoEmail(email = "") {
  const normalized = normalizeDemoEmail(email);
  if (!normalized.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) return false;
  return !isFloqrDemoEmail(normalized);
}

function brokenDemoEmailMessage(email = "") {
  const normalized = normalizeDemoEmail(email);
  const local = normalized.split("@")[0] || "";
  if (/^temp_[a-z0-9]+_n$/i.test(local)) {
    return "Demo accounts use a club number 1–10, not the letter N. Example: temp_waitress_1@floqr-demo.com";
  }
  return "Enter a valid demo email such as temp_waitress_1@floqr-demo.com (number 1–10).";
}

function demoEmailOtpDelivery(intendedEmail = "") {
  const intended = normalizeDemoEmail(intendedEmail);
  if (!isFloqrDemoEmail(intended)) {
    return {
      intendedEmail: intended,
      deliveredTo: intended,
      redirected: false,
      subject: "Your FLOQR sign-in code",
      bodyPrefix: ""
    };
  }
  const deliveredTo = DEMO_OTP_REDIRECT_EMAIL;
  return {
    intendedEmail: intended,
    deliveredTo,
    redirected: deliveredTo !== intended,
    subject: `[FLOQR demo → ${intended}] Your FLOQR sign-in code`,
    bodyPrefix: `Demo sign-in for ${intended}. Enter this code on the page where you typed that address.\n\n`
  };
}

module.exports = {
  DEMO_EMAIL_DOMAIN,
  DEMO_OTP_REDIRECT_EMAIL,
  isFloqrDemoEmail,
  looksLikeBrokenDemoEmail,
  brokenDemoEmailMessage,
  demoEmailOtpDelivery
};
