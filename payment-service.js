/* FLOQR Stripe Checkout, Connect onboarding, follower campaigns, and Pickup client bridge v29.09.4. */
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

  function unwrapCallableError(error) {
    const code = error?.code || "";
    const message = error?.message || String(error || "Request failed");
    // Firebase callable errors often look like "FirebaseError: ..." with a useful message.
    const cleaned = message.replace(/^FirebaseError:\s*/i, "").replace(/^functions\/[\w-]+\s*/i, "").trim();
    const err = new Error(cleaned || message);
    err.code = code;
    err.details = error?.details || null;
    return err;
  }

  async function logClient(level, action, message, details, correlationId) {
    if (!window.FLOQRLog?.write) return;
    try {
      await window.FLOQRLog.write({
        level,
        category: "checkout",
        action,
        message,
        details,
        correlationId,
        source: "payment-service",
        appVersion: "29.09.4"
      });
    } catch (_) {}
  }

  async function startCheckout({orderType, payload = {}, status, redirect = true} = {}) {
    requireUser();
    const correlationId = window.FLOQRLog?.correlationId?.("chk") || `chk_${Date.now().toString(36)}`;
    status?.("Opening secure Stripe checkout…");
    await logClient("info", "checkout_start", `Starting ${orderType || "order"} checkout`, {
      orderType,
      clubLocationId: payload?.clubLocationId || payload?.shoutout?.clubLocationId || "",
      template: payload?.shoutout?.template || ""
    }, correlationId);
    try {
      const returnBase = new URL(".", window.location.href).href;
      const response = await callable("createFloqrCheckoutSession")({orderType, payload, returnBase, correlationId});
      const result = response?.data || {};
      if (!result.checkoutUrl) throw new Error("Stripe checkout did not return a secure payment link.");
      await logClient("info", "checkout_redirect", redirect ? "Redirecting to Stripe Checkout" : "Checkout session ready (deferred redirect)", {
        orderId: result.orderId || "",
        amountCents: result.amountCents || 0
      }, result.correlationId || correlationId);
      if (redirect !== false) window.location.assign(result.checkoutUrl);
      return result;
    } catch (error) {
      const unwrapped = unwrapCallableError(error);
      await logClient("error", "checkout_failed", unwrapped.message, {
        orderType,
        code: unwrapped.code || "",
        template: payload?.shoutout?.template || "",
        clubLocationId: payload?.clubLocationId || payload?.shoutout?.clubLocationId || ""
      }, correlationId);
      throw unwrapped;
    }
  }

  async function getConnectStatus({entityType, entityId, status} = {}) {
    requireUser();
    if (!entityType || !entityId) throw new Error("Choose a FLOQR seller or club before checking payout status.");
    status?.("Checking Stripe payout readiness…");
    try {
      const response = await callable("getFloqrConnectStatus")({entityType, entityId});
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function getClubCheckoutReadiness({clubLocationId, status} = {}) {
    requireUser();
    if (!clubLocationId) throw new Error("Choose a club before checking paid-checkout readiness.");
    status?.("Checking whether this club can accept paid ShoutOuts…");
    try {
      const response = await callable("getFloqrClubCheckoutReadiness")({clubLocationId});
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function startConnectOnboarding({entityType, entityId, status} = {}) {
    requireUser();
    if (!entityType || !entityId) throw new Error("Choose a FLOQR seller or club before starting payout onboarding.");
    status?.("Opening secure Stripe payout onboarding…");
    try {
      const returnBase = new URL(".", window.location.href).href;
      const response = await callable("createFloqrConnectOnboardingLink")({entityType, entityId, returnBase});
      const result = response?.data || {};
      if (!result.onboardingUrl || !/^https:\/\//i.test(result.onboardingUrl)) throw new Error("Stripe did not return a secure payout-onboarding link.");
      window.location.assign(result.onboardingUrl);
      return result;
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function cancelCheckoutOrder({orderId, reason} = {}) {
    requireUser();
    if (!orderId) throw new Error("Choose a checkout order to cancel.");
    try {
      const response = await callable("cancelFloqrCheckoutOrder")({orderId, reason: reason || "user-cancelled"});
      await logClient("info", "checkout_cancelled_client", `Cancelled checkout ${orderId}`, {orderId, reason});
      return response?.data || {};
    } catch (error) {
      const unwrapped = unwrapCallableError(error);
      await logClient("error", "checkout_cancel_failed", unwrapped.message, {orderId});
      throw unwrapped;
    }
  }

  async function clearUnpaidCheckouts(options = {}) {
    requireUser();
    try {
      const response = await callable("clearUnpaidFloqrCheckouts")(options || {});
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function purgeTestPayments(options = {}) {
    requireUser();
    try {
      const response = await callable("purgeFloqrTestPayments")(options || {});
      await logClient("info", "purge_test_payments", "Requested purge of Stripe test payments", response?.data || {});
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function publishFollowerCampaign({entityId, campaign = {}, status} = {}) {
    requireUser();
    status?.("Publishing to followers…");
    try {
      const response = await callable("publishFloqrFollowerCampaign")({entityId, campaign});
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  async function requestTeslaPickup(payload = {}) {
    requireUser();
    try {
      const response = await callable("requestTeslaRobotaxiPickup")(payload);
      return response?.data || {};
    } catch (error) {
      throw unwrapCallableError(error);
    }
  }

  window.FLOQRPayments = {
    getConnectStatus,
    getClubCheckoutReadiness,
    startCheckout,
    startConnectOnboarding,
    cancelCheckoutOrder,
    clearUnpaidCheckouts,
    purgeTestPayments,
    publishFollowerCampaign,
    requestTeslaPickup
  };
})();
