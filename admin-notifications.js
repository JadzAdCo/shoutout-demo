/* FLOQR Club Admin Notifications tab — SMS/WhatsApp ops alerts + $10 service packs. */
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
  let subscription = {sms: false, whatsapp: false, smsPaidAt: null, whatsappPaidAt: null};

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

  function renderSubscriptionLabels() {
    const smsHint = byId("repNotifySmsSubStatus");
    const waHint = byId("repNotifyWhatsappSubStatus");
    if (smsHint) smsHint.textContent = subscription.sms ? " — subscribed (already paid)" : "";
    if (waHint) waHint.textContent = subscription.whatsapp ? " — subscribed (already paid)" : "";
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
    renderSubscriptionLabels();
  }

  async function saveNotifications() {
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL before saving notification settings.");
    if (!auth.currentUser) throw new Error("Sign in before saving notification choices.");
    const live = await readSubscriptionStatus();
    notificationSettings = live.settings;
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
    renderSubscriptionLabels();
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
    if (wantsSms && subscription.sms) bits.push("SMS subscribed");
    if (wantsWhatsapp && subscription.whatsapp) bits.push("WhatsApp subscribed");
    setStatus(bits.length ? `Notification choices saved. ${bits.join("; ")} — checkout skipped.` : "Notification choices saved.");
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

  async function sendTestMessage() {
    const status = statusEl();
    try {
      if (status) status.textContent = "Sending test alert…";
      const result = await callable("sendClubTestMessage")({clubLocationId: locationId});
      const data = result?.data || {};
      if (status) {
        status.textContent = data.dryRun
          ? `Test logged as dry-run (${data.delivered || data.sent || 0} target(s)). Configure Twilio secrets to send live.`
          : `Test alert sent to ${data.delivered || data.sent || 0} channel(s).`;
      }
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
