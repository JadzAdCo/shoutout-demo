/* SMS Consent Grant page — records smsNotificationConsent on the signed-in user. */
(function () {
  "use strict";

  const auth = firebase.auth();
  const db = firebase.firestore();

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    const el = byId("smsConsentStatus");
    if (el) el.textContent = message || "";
  }

  function setControlsEnabled(user) {
    const signedIn = !!user;
    if (byId("smsConsentSaveBtn")) byId("smsConsentSaveBtn").disabled = !signedIn;
    if (byId("smsConsentWithdrawBtn")) byId("smsConsentWithdrawBtn").disabled = !signedIn;
    if (byId("smsConsentSignInBtn")) byId("smsConsentSignInBtn").classList.toggle("hidden", signedIn);
    if (byId("smsConsentGrantCheck")) byId("smsConsentGrantCheck").disabled = !signedIn;
  }

  async function loadConsent(user) {
    if (!user) {
      setStatus("Sign in to grant or withdraw SMS notification consent.");
      setControlsEnabled(null);
      return;
    }
    setControlsEnabled(user);
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const profile = snap.exists ? snap.data() || {} : {};
      const on = !!profile.smsNotificationConsent;
      if (byId("smsConsentGrantCheck")) byId("smsConsentGrantCheck").checked = on;
      setStatus(on
        ? `SMS consent is ON for ${user.email || "this account"}. Manage it anytime under My Privacy.`
        : `Signed in as ${user.email || "user"}. Check the box and save to opt in for SMS notifications.`);
    } catch (error) {
      setStatus(error?.message || "Could not load consent status.");
    }
  }

  async function saveConsent(enabled) {
    const user = auth.currentUser;
    if (!user) {
      setStatus("Sign in required.");
      return;
    }
    if (enabled && !byId("smsConsentGrantCheck")?.checked) {
      setStatus("Check the consent box before saving.");
      return;
    }
    try {
      setStatus(enabled ? "Saving SMS consent…" : "Withdrawing SMS consent…");
      const payload = {
        smsNotificationConsent: !!enabled,
        smsNotificationConsentAt: firebase.firestore.FieldValue.serverTimestamp(),
        smsNotificationConsentSource: "sms-consent.html",
        privacyUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (enabled) {
        payload.marketingSmsConsent = true;
      }
      await db.collection("users").doc(user.uid).set(payload, {merge: true});
      await db.collection("privacyConsents").add({
        uid: user.uid,
        email: user.email || "",
        smsNotificationConsent: !!enabled,
        source: "sms-consent.html",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (byId("smsConsentGrantCheck")) byId("smsConsentGrantCheck").checked = !!enabled;
      setStatus(enabled
        ? "SMS consent saved. You can change this anytime on My Privacy."
        : "SMS consent withdrawn. You will no longer be targeted for optional SMS notifications.");
    } catch (error) {
      setStatus(error?.message || "Could not save SMS consent.");
    }
  }

  function bind() {
    byId("smsConsentSignInBtn")?.addEventListener("click", async () => {
      try {
        setStatus("Opening Google sign-in…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (error) {
        setStatus(error?.message || "Sign-in failed.");
      }
    });
    byId("smsConsentSaveBtn")?.addEventListener("click", () => saveConsent(true));
    byId("smsConsentWithdrawBtn")?.addEventListener("click", () => saveConsent(false));
    auth.onAuthStateChanged((user) => loadConsent(user));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
