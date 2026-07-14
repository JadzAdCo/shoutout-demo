/* FLOQR Stripe Checkout, follower campaigns, and Pickup client bridge v29.07. */
(function () {
  "use strict";

  function callable(name) {
    if (!window.firebase?.functions) throw new Error("Firebase Functions is not loaded on this page.");
    return firebase.functions("us-central1").httpsCallable(name);
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

  window.FLOQRPayments = {startCheckout, publishFollowerCampaign, requestTeslaPickup};
})();
