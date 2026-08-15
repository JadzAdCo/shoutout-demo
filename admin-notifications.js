/* FLOQR Club Admin Notifications tab — compact SMS/WhatsApp ops alerts + $10 packs. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const locationId = String(params.get("location") || params.get("club") || "").trim();
  if (!window.firebase || !byId("panelNotifications")) return;
  let auth;
  let db;
  try {
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (error) {
    const status = byId("repMessagingStatus");
    if (status) status.textContent = error?.message || "Firebase is not initialized for Notifications.";
    return;
  }
  let notificationSettings = {};
  let messagingCredits = {};
  let subscription = {sms: false, whatsapp: false, smsPaidAt: null, whatsappPaidAt: null};

  const SMS_PACK = 466;
  const WA_PACK = 233;

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function statusEl() {
    return byId("repMessagingStatus");
  }

  function setStatus(message) {
    const status = statusEl();
    if (status) status.textContent = message || "";
  }

  function truthy(value) {
    return value === true || value === 1 || value === "1" || !!(value && typeof value === "object");
  }

  function paidStamp(settings = {}, credits = {}, channel = "sms") {
    if (channel === "whatsapp") {
      return settings.whatsappPaidAt || credits.whatsappLastPaidAt || null;
    }
    return settings.smsPaidAt || credits.smsLastPaidAt || null;
  }

  function channelSubscribed(settings = {}, credits = {}, channel = "sms") {
    if (channel === "whatsapp") {
      return truthy(settings.whatsappSubscribed)
        || truthy(settings.whatsappPaidAt)
        || truthy(settings.whatsappServiceOrderId)
        || truthy(credits.whatsappServiceEnabled)
        || truthy(credits.whatsappLastPaidAt)
        || Number(credits.whatsappBalance || 0) > 0
        || Number(credits.whatsappPurchasedTotal || 0) > 0;
    }
    return truthy(settings.smsSubscribed)
      || truthy(settings.smsPaidAt)
      || truthy(settings.smsServiceOrderId)
      || truthy(credits.smsServiceEnabled)
      || truthy(credits.smsLastPaidAt)
      || Number(credits.smsBalance || 0) > 0
      || Number(credits.smsPurchasedTotal || 0) > 0;
  }

  function stampToDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
    return null;
  }

  function formatStamp(value) {
    const date = stampToDate(value);
    if (!date) return "";
    return date.toLocaleString();
  }

  async function paidOrderFallback(channel) {
    const types = channel === "whatsapp"
      ? ["whatsappNotifications", "whatsappMessageBundle"]
      : ["smsNotifications", "smsMessageBundle"];
    try {
      const snap = await db.collection("serviceOrders")
        .where("clubLocationId", "==", locationId)
        .where("paymentStatus", "==", "paid")
        .limit(25)
        .get();
      return snap.docs.some(doc => types.includes(String(doc.data()?.orderType || "")));
    } catch (_error) {
      return false;
    }
  }

  async function readSubscriptionStatus() {
    const [settingsSnap, creditsSnap] = await Promise.all([
      db.collection("clubNotificationSettings").doc(locationId).get(),
      db.collection("clubMessagingCredits").doc(locationId).get()
    ]);
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const credits = creditsSnap.exists ? creditsSnap.data() || {} : {};
    let sms = channelSubscribed(settings, credits, "sms");
    let whatsapp = channelSubscribed(settings, credits, "whatsapp");
    if (!sms) sms = await paidOrderFallback("sms");
    if (!whatsapp) whatsapp = await paidOrderFallback("whatsapp");
    return {
      settings,
      credits,
      sms,
      whatsapp,
      smsPaidAt: paidStamp(settings, credits, "sms"),
      whatsappPaidAt: paidStamp(settings, credits, "whatsapp")
    };
  }

  function paintChannelCard(channel, subscribed) {
    const card = byId(channel === "whatsapp" ? "repNotifyWhatsappCard" : "repNotifySmsCard");
    if (!card) return;
    card.classList.toggle("is-subscribed", !!subscribed);
    card.classList.toggle("is-unsubscribed", !subscribed);
  }

  function channelHelpCopy(channel) {
    const isWa = channel === "whatsapp";
    const subscribed = isWa ? subscription.whatsapp : subscription.sms;
    const paidAt = isWa ? subscription.whatsappPaidAt : subscription.smsPaidAt;
    const pack = isWa ? WA_PACK : SMS_PACK;
    const remaining = Number((isWa ? messagingCredits.whatsappBalance : messagingCredits.smsBalance) || 0) || 0;
    const purchased = Number((isWa ? messagingCredits.whatsappPurchasedTotal : messagingCredits.smsPurchasedTotal) || 0) || 0;
    const label = isWa ? "WhatsApp" : "SMS";
    const orderType = isWa ? "whatsappNotifications" : "smsNotifications";
    if (subscribed) {
      const paid = formatStamp(paidAt);
      return {
        title: `${label} notification subscription`,
        body: [
          `${label} subscription status in Firebase is 1 (paid).`,
          "This is a prepaid $10 credit pack, not a monthly or yearly plan. Credits stay until they are used — there is no calendar expiry.",
          paid ? `Last paid: ${paid}.` : "Paid timestamp is on file.",
          `${label} credits remaining: ${remaining}${purchased ? ` of ${purchased} purchased` : ` (pack size ${pack})`}.`,
          "Uncheck the box and Save to pause alerts. That does not cancel the paid subscription or reopen Stripe."
        ].join(" "),
        searchPhrases: [`${label.toLowerCase()} credits`, `${label.toLowerCase()} subscribed`, "notification subscription"]
      };
    }
    return {
      title: `${label} notification subscription`,
      body: [
        `${label} subscription status in Firebase is 0 (not subscribed).`,
        `This is a prepaid $10 pack (${pack} ${label} credits), not monthly or yearly.`,
        "Use Subscribe below to pay once. After payment the pill turns green and Save will not reopen Stripe."
      ].join(" "),
      bodyHtml: `<p>${label} subscription status in Firebase is 0 (not subscribed).</p><p>This is a prepaid $10 pack (${pack} ${label} credits), not a monthly or yearly plan.</p><p><button type="button" data-notify-subscribe="${orderType}">Subscribe $10 — ${pack} ${label} credits</button></p>`,
      searchPhrases: [`${label.toLowerCase()} subscribe`, `${label.toLowerCase()} credits`, "notification subscription"]
    };
  }

  function attachChannelHelp(channel) {
    const card = byId(channel === "whatsapp" ? "repNotifyWhatsappCard" : "repNotifySmsCard");
    if (!card || !window.FLOQRHelpAttach?.attach) return;
    const copy = channelHelpCopy(channel);
    window.FLOQRHelpAttach.attach({
      target: card,
      title: copy.title,
      body: copy.body,
      bodyHtml: copy.bodyHtml || "",
      searchPhrases: copy.searchPhrases,
      id: channel === "whatsapp" ? "help-club-whatsapp-notification" : "help-club-sms-notification",
      links: [{label: "Club Admin Notifications", href: "./admin.html?from=floqai&tab=notifications"}],
      replace: true
    });
  }

  function renderSubscriptionUi() {
    paintChannelCard("sms", subscription.sms);
    paintChannelCard("whatsapp", subscription.whatsapp);
    attachChannelHelp("sms");
    attachChannelHelp("whatsapp");
  }

  async function startMessagingCheckout(orderType, openingMessage) {
    setStatus(openingMessage);
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL before buying messaging services.");
    if (!window.FLOQRPayments?.startCheckout) throw new Error("Stripe checkout is not loaded. Refresh the page and try again.");
    if (!auth.currentUser) throw new Error("Sign in as Club Admin or Master Admin before buying credits.");
    await window.FLOQRPayments.startCheckout({
      orderType,
      payload: {clubLocationId: locationId},
      status: setStatus
    });
  }

  async function loadNotifications() {
    if (!locationId) return;
    const live = await readSubscriptionStatus();
    notificationSettings = live.settings;
    messagingCredits = live.credits;
    subscription = {
      sms: live.sms,
      whatsapp: live.whatsapp,
      smsPaidAt: live.smsPaidAt,
      whatsappPaidAt: live.whatsappPaidAt
    };
    if (byId("repNotifyInApp")) byId("repNotifyInApp").checked = notificationSettings.inApp !== false;
    if (byId("repNotifyPush")) byId("repNotifyPush").checked = !!notificationSettings.push;
    if (byId("repNotifyEmail")) byId("repNotifyEmail").checked = !!notificationSettings.email;
    if (byId("repNotifySms")) {
      byId("repNotifySms").checked = subscription.sms
        ? notificationSettings.smsEnabled !== false && notificationSettings.smsRequested !== false
        : !!notificationSettings.smsRequested;
    }
    if (byId("repNotifyWhatsapp")) {
      byId("repNotifyWhatsapp").checked = subscription.whatsapp
        ? notificationSettings.whatsappEnabled !== false && notificationSettings.whatsappRequested !== false
        : !!notificationSettings.whatsappRequested;
    }
    if (byId("repAlertPhone")) byId("repAlertPhone").value = notificationSettings.alertPhone || notificationSettings.smsPhone || "";
    if (byId("repChannelPreference")) byId("repChannelPreference").value = notificationSettings.channelPreference || "sms";
    renderSubscriptionUi();
  }

  async function saveNotifications() {
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL before saving notification settings.");
    if (!auth.currentUser) throw new Error("Sign in before saving notification choices.");
    const live = await readSubscriptionStatus();
    notificationSettings = live.settings;
    messagingCredits = live.credits;
    subscription = {
      sms: live.sms,
      whatsapp: live.whatsapp,
      smsPaidAt: live.smsPaidAt,
      whatsappPaidAt: live.whatsappPaidAt
    };
    const wantsSms = !!byId("repNotifySms")?.checked;
    const wantsWhatsapp = !!byId("repNotifyWhatsapp")?.checked;
    const alertPhone = String(byId("repAlertPhone")?.value || "").trim();
    const channelPreference = byId("repChannelPreference")?.value || "sms";
    const patch = {
      inApp: !!byId("repNotifyInApp")?.checked,
      push: !!byId("repNotifyPush")?.checked,
      email: !!byId("repNotifyEmail")?.checked,
      smsRequested: wantsSms,
      smsEnabled: wantsSms && subscription.sms,
      smsSubscribed: subscription.sms,
      whatsappRequested: wantsWhatsapp,
      whatsappEnabled: wantsWhatsapp && subscription.whatsapp,
      whatsappSubscribed: subscription.whatsapp,
      alertPhone,
      channelPreference,
      updatedByUid: auth.currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (subscription.smsPaidAt) patch.smsPaidAt = subscription.smsPaidAt;
    if (subscription.whatsappPaidAt) patch.whatsappPaidAt = subscription.whatsappPaidAt;
    await db.collection("clubNotificationSettings").doc(locationId).set(patch, {merge: true});
    renderSubscriptionUi();
    if (wantsSms && !subscription.sms) {
      await startMessagingCheckout(
        "smsNotifications",
        "SMS is not subscribed yet. Opening the $10 SMS service checkout (466 message credits)…"
      );
      return;
    }
    if (wantsWhatsapp && !subscription.whatsapp) {
      await startMessagingCheckout(
        "whatsappNotifications",
        "WhatsApp is not subscribed yet. Opening the $10 WhatsApp service checkout (233 message credits)…"
      );
      return;
    }
    const bits = [];
    if (wantsSms && subscription.sms) bits.push("SMS on");
    if (wantsWhatsapp && subscription.whatsapp) bits.push("WhatsApp on");
    setStatus(bits.length ? `Notification choices saved. ${bits.join("; ")}.` : "Notification choices saved.");
    await loadNotifications();
  }

  async function showDailyAuthCode() {
    const status = statusEl();
    const codeEl = byId("repDailyAuthCode");
    try {
      if (status) status.textContent = "Loading today's club code…";
      const result = await callable("getClubDailyAuthCode")({clubLocationId: locationId});
      const data = result?.data || {};
      if (codeEl) codeEl.textContent = data.code ? `Today's club code (${data.dayKey || "today"}): ${data.code}` : "No code returned.";
      if (status) status.textContent = "Club daily auth code ready.";
    } catch (error) {
      if (codeEl) codeEl.textContent = "";
      if (status) status.textContent = error?.message || String(error);
    }
  }

  function formatTestResult(data = {}) {
    const attempted = Number(data.attempted || (data.results || []).length || 0);
    const delivered = Number(data.delivered || data.sent || 0);
    const errors = (data.errors || [])
      .concat((data.results || []).map(row => row?.error || (!row?.ok && row?.status) || ""))
      .map(item => String(item || "").trim())
      .filter(Boolean);
    const uniqueErrors = [...new Set(errors)];
    const okChannels = (data.results || [])
      .filter(row => row?.ok)
      .map(row => String(row.channel || "").trim())
      .filter(Boolean);
    const uniqueOk = [...new Set(okChannels)];
    if (data.dryRun) {
      return `Test logged as dry-run (${attempted || delivered} target(s)). Configure Twilio secrets to send live.`;
    }
    if (delivered > 0) {
      const inboxNote = uniqueOk.some(ch => ch === "inapp" || ch === "push")
        ? " In-app appears in FloqR Inbox as System Message."
        : "";
      return `Test alert sent on ${uniqueOk.join(", ") || `${delivered} channel(s)`}.${inboxNote}`;
    }
    if (attempted > 0) {
      const health = data.twilio || {};
      const sidHint = health.looksLikeApiKey
        ? " TWILIO_ACCOUNT_SID is an API Key (SK…); it must be the Account SID starting with AC."
        : health.looksLikeAccountSid === false && health.accountSidPrefix
          ? ` TWILIO_ACCOUNT_SID prefix is ${health.accountSidPrefix} (${health.accountSidLength || 0} chars); it must start with AC and be 34 characters.`
          : "";
      return `Test reached ${attempted} channel(s) but none delivered.${uniqueErrors.length ? " " + uniqueErrors.join("; ") : ""}${sidHint}`;
    }
    return "Test alert sent to 0 channel(s). Check In-app (FloqR Inbox), Email, and/or paid SMS/WhatsApp, then send the test.";
  }

  function selectedNotifyChannels() {
    return {
      inApp: !!byId("repNotifyInApp")?.checked,
      push: !!byId("repNotifyPush")?.checked,
      email: !!byId("repNotifyEmail")?.checked,
      sms: !!byId("repNotifySms")?.checked,
      whatsapp: !!byId("repNotifyWhatsapp")?.checked
    };
  }

  async function sendTestMessage() {
    const status = statusEl();
    try {
      if (status) status.textContent = "Sending test alert…";
      const channels = selectedNotifyChannels();
      if (!channels.inApp && !channels.push && !channels.email && !channels.sms && !channels.whatsapp) {
        if (status) status.textContent = "Check at least one notification option, then send the test.";
        return;
      }
      const result = await callable("sendClubTestMessage")({clubLocationId: locationId, channels});
      if (status) status.textContent = formatTestResult(result?.data || {});
    } catch (error) {
      if (status) status.textContent = error?.message || String(error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("saveRepNotificationsBtn")?.addEventListener("click", () => saveNotifications().catch(error => {
      const status = statusEl();
      if (status) status.textContent = error.message;
    }));
    byId("showClubDailyAuthCodeBtn")?.addEventListener("click", () => showDailyAuthCode());
    byId("sendClubTestMessageBtn")?.addEventListener("click", () => sendTestMessage());
    byId("panelNotifications")?.addEventListener("click", event => {
      const btn = event.target?.closest?.("[data-notify-subscribe]");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const orderType = btn.getAttribute("data-notify-subscribe");
      const label = orderType === "whatsappNotifications" ? "WhatsApp" : "SMS";
      startMessagingCheckout(orderType, `${label} is not subscribed. Opening the $10 checkout…`).catch(error => {
        setStatus(error.message);
      });
    });
    window.addEventListener("message", event => {
      const data = event?.data || {};
      if (data.type !== "floqr-notification-subscribed") return;
      if (data.clubLocationId && data.clubLocationId !== locationId) return;
      loadNotifications().catch(() => {});
    });
    window.addEventListener("focus", () => {
      if (auth.currentUser && locationId) loadNotifications().catch(() => {});
    });
    auth.onAuthStateChanged(user => {
      if (user) loadNotifications().catch(error => {
        const status = statusEl();
        if (status) status.textContent = error.message;
      });
    });
  });
})();
