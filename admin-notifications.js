/* FLOQR Club Admin Notifications tab — SMS/WhatsApp ops alerts + $10 service packs. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const locationId = new URL(location.href).searchParams.get("location") || new URL(location.href).searchParams.get("club") || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("panelNotifications")) return;
  const auth = firebase.auth(), db = firebase.firestore();
  let notificationSettings = {};

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function statusEl() {
    return byId("repMessagingStatus");
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
    const status = statusEl();
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
      if (status) status.textContent = "SMS selected. Opening the $10 SMS service checkout (466 message credits)…";
      await window.FLOQRPayments.startCheckout({
        orderType: "smsNotifications",
        payload: {clubLocationId: locationId},
        status: message => { if (status) status.textContent = message; }
      });
      return;
    }
    if (wantsWhatsapp && !notificationSettings.whatsappPaidAt) {
      if (status) status.textContent = "WhatsApp selected. Opening the $10 WhatsApp service checkout (233 message credits)…";
      await window.FLOQRPayments.startCheckout({
        orderType: "whatsappNotifications",
        payload: {clubLocationId: locationId},
        status: message => { if (status) status.textContent = message; }
      });
      return;
    }
    if (status) status.textContent = "Notification choices saved.";
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
