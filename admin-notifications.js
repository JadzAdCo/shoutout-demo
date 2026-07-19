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
    const snap = await db.collection("clubNotificationSettings").doc(locationId).get();
    notificationSettings = snap.exists ? snap.data() || {} : {};
    if (byId("repNotifyInApp")) byId("repNotifyInApp").checked = notificationSettings.inApp !== false;
    if (byId("repNotifyPush")) byId("repNotifyPush").checked = !!notificationSettings.push;
    if (byId("repNotifyEmail")) byId("repNotifyEmail").checked = !!notificationSettings.email;
    if (byId("repNotifySms")) byId("repNotifySms").checked = !!notificationSettings.smsEnabled || !!notificationSettings.smsRequested;
    if (byId("repNotifyWhatsapp")) byId("repNotifyWhatsapp").checked = !!notificationSettings.whatsappEnabled || !!notificationSettings.whatsappRequested;
    if (byId("repAlertPhone")) byId("repAlertPhone").value = notificationSettings.alertPhone || notificationSettings.smsPhone || "";
    if (byId("repChannelPreference")) byId("repChannelPreference").value = notificationSettings.channelPreference || "sms";
  }

  async function saveNotifications() {
    if (!locationId) throw new Error("Add ?location=<club-id> to the Club Admin URL before saving notification settings.");
    if (!auth.currentUser) throw new Error("Sign in before saving notification choices.");
    const wantsSms = !!byId("repNotifySms")?.checked;
    const wantsWhatsapp = !!byId("repNotifyWhatsapp")?.checked;
    const alertPhone = String(byId("repAlertPhone")?.value || "").trim();
    const channelPreference = byId("repChannelPreference")?.value || "sms";
    await db.collection("clubNotificationSettings").doc(locationId).set({
      inApp: !!byId("repNotifyInApp")?.checked,
      push: !!byId("repNotifyPush")?.checked,
      email: !!byId("repNotifyEmail")?.checked,
      smsRequested: wantsSms,
      smsEnabled: wantsSms && !!notificationSettings.smsPaidAt,
      whatsappRequested: wantsWhatsapp,
      whatsappEnabled: wantsWhatsapp && !!notificationSettings.whatsappPaidAt,
      alertPhone,
      channelPreference,
      updatedByUid: auth.currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge: true});
    if (wantsSms && !notificationSettings.smsPaidAt) {
      await startMessagingCheckout(
        "smsNotifications",
        "SMS selected. Opening the $10 SMS service checkout (466 message credits)…"
      );
      return;
    }
    if (wantsWhatsapp && !notificationSettings.whatsappPaidAt) {
      await startMessagingCheckout(
        "whatsappNotifications",
        "WhatsApp selected. Opening the $10 WhatsApp service checkout (233 message credits)…"
      );
      return;
    }
    setStatus("Notification choices saved.");
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
    auth.onAuthStateChanged(user => {
      if (user) loadNotifications().catch(error => {
        const status = statusEl();
        if (status) status.textContent = error.message;
      });
    });
  });
})();
