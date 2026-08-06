/* Demo delivery redirect — temp_*@floqr-demo.com → bans.don@gmail.com; SMS → +12027330274 */
"use strict";

const DEMO_EMAIL_SINK = "bans.don@gmail.com";
const DEMO_SMS_SINK = "+12027330274";

function text(value = "", max = 500) {
  return String(value || "").trim().slice(0, max);
}

function isFloqrDemoEmail(email = "") {
  const e = text(email, 200).toLowerCase();
  return e.endsWith("@floqr-demo.com") && e.startsWith("temp_");
}

function isFloqrDemoPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  // Fictitious public numbers used on demo profiles still route to the sink.
  return digits.endsWith("7330274") || /^1202555\d{4}$/.test(digits) || /^447700900\d{3}$/.test(digits);
}

function redirectDemoEmail(toEmail = "", subject = "") {
  const intended = text(toEmail, 200);
  if (!isFloqrDemoEmail(intended)) {
    return {to: intended, subject: text(subject, 400), redirected: false, intended: ""};
  }
  const subj = text(subject, 350);
  return {
    to: DEMO_EMAIL_SINK,
    subject: `[FLOQR demo → ${intended}] ${subj}`.slice(0, 400),
    redirected: true,
    intended
  };
}

function redirectDemoSms(toPhone = "") {
  const intended = text(toPhone, 40);
  if (!intended) return {to: "", redirected: false, intended: ""};
  if (isFloqrDemoPhone(intended) || isFloqrDemoEmail(intended)) {
    return {to: DEMO_SMS_SINK, redirected: true, intended};
  }
  // Any E.164 attached to a temp_* user profile should already be the sink; keep explicit.
  return {to: intended, redirected: false, intended: ""};
}

module.exports = {
  DEMO_EMAIL_SINK,
  DEMO_SMS_SINK,
  isFloqrDemoEmail,
  isFloqrDemoPhone,
  redirectDemoEmail,
  redirectDemoSms
};
