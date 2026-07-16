/* FLOQR Stripe Checkout, Connect onboarding, follower campaigns, and Pickup client bridge v29.09.2. */
(function () {
  "use strict";

  function callable(name) {
    if (!window.firebase?.app) throw new Error("Firebase is not loaded on this page.");
    const app = firebase.app();
    if (!app?.functions) throw new Error("Firebase Functions is not loaded on this page.");
    return app.functions("us-central1").httpsCallable(name);
  }

  function requireUser() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("Sign in before continuing.");
    return user;
  }

  async function startCheckout({orderType, payload = {}, status} = {}) {
    requireUser();
    status?.("Opening secure Stripe checkout…");
    const returnBase = new URL(".", window.location.href).href;
    const response = await callable("createFloqrCheckoutSession")({orderType, payload, returnBase});
    const result = response?.data || {};
    if (!result.checkoutUrl) throw new Error("Stripe checkout did not return a secure payment link.");
    window.location.assign(result.checkoutUrl);
    return result;
  }

  async function getConnectStatus({entityType, entityId, status} = {}) {
    requireUser();
    if (!entityType || !entityId) throw new Error("Choose a FLOQR seller or club before checking payout status.");
    status?.("Checking Stripe payout readinessâ€¦");
    const response = await callable("getFloqrConnectStatus")({entityType, entityId});
    return response?.data || {};
  }

  async function startConnectOnboarding({entityType, entityId, status} = {}) {
    requireUser();
    if (!entityType || !entityId) throw new Error("Choose a FLOQR seller or club before starting payout onboarding.");
    status?.("Opening secure Stripe payout onboardingâ€¦");
    const returnBase = new URL(".", window.location.href).href;
    const response = await callable("createFloqrConnectOnboardingLink")({entityType, entityId, returnBase});
    const result = response?.data || {};
    if (!result.onboardingUrl || !/^https:\/\//i.test(result.onboardingUrl)) throw new Error("Stripe did not return a secure payout-onboarding link.");
    window.location.assign(result.onboardingUrl);
    return result;
  }

  async function publishFollowerCampaign({entityId, campaign = {}, status} = {}) {
    requireUser();
    status?.("Publishing to followers…");
    const response = await callable("publishFloqrFollowerCampaign")({entityId, campaign});
    return response?.data || {};
  }

  async function requestTeslaPickup(payload = {}) {
    requireUser();
    const response = await callable("requestTeslaRobotaxiPickup")(payload);
    return response?.data || {};
  }

  window.FLOQRPayments = {getConnectStatus, startCheckout, startConnectOnboarding, publishFollowerCampaign, requestTeslaPickup};
})();
