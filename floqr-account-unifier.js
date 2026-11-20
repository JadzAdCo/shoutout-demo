/* Client helper: required E.164 mobile is the FLOQR account unifier. */
(function (root) {
  "use strict";

  function t(key, fallback) {
    return root.FLOQRI18n?.t?.(key) || fallback;
  }

  function callable(name) {
    return root.firebase.app().functions("us-central1").httpsCallable(name);
  }

  function claimErrorCode(error) {
    return String(error?.details?.code || error?.code || "").replace(/^functions\//, "");
  }

  function isPhoneInUse(error) {
    const code = claimErrorCode(error);
    return code === "phone_in_use" || code === "already-exists";
  }

  function isMergedAccount(errorOrProfile) {
    if (errorOrProfile && typeof errorOrProfile.accountStatus === "string") {
      return errorOrProfile.accountStatus === "merged" || !!errorOrProfile.mergedInto;
    }
    const code = claimErrorCode(errorOrProfile);
    return code === "account_merged" || code === "failed-precondition";
  }

  function signInHref(flag) {
    const query = new URLSearchParams({profileRequired: "sign-in"});
    if (flag) query.set(flag, "1");
    return `./?${query.toString()}`;
  }

  async function redirectExistingSignIn(flag, message) {
    try {
      await root.firebase.auth().signOut();
    } catch (_) {}
    root.location.replace(signInHref(flag));
    return {ok: false, redirected: true, message};
  }

  async function claimRequiredPhone(phoneE164, statusEl) {
    const phone = String(phoneE164 || "").trim();
    if (!phone) {
      const message = t("profile.phone.required", "Mobile is required. Enter your mobile number in international format.");
      if (statusEl) statusEl.textContent = message;
      return {ok: false, message};
    }
    try {
      const result = await callable("claimPatronPhone")({phone});
      return {ok: true, phoneE164: result?.data?.phoneE164 || phone};
    } catch (error) {
      if (isPhoneInUse(error)) {
        const message = t("profile.phone.inUse", "This mobile is already on a FLOQR account. Sign in with that account. Same phone means the same person.");
        if (statusEl) statusEl.textContent = message;
        return redirectExistingSignIn("phoneInUse", message);
      }
      if (isMergedAccount(error) && /merged/i.test(String(error?.message || ""))) {
        const message = t("profile.phone.merged", "This sign-in was merged into another FLOQR account. Sign in with that account.");
        if (statusEl) statusEl.textContent = message;
        return redirectExistingSignIn("accountMerged", message);
      }
      const message = error?.message || t("portal.phone.invalid", "Enter a valid mobile number for SMS and WhatsApp.");
      if (statusEl) statusEl.textContent = message;
      return {ok: false, message};
    }
  }

  root.FLOQRAccountUnifier = {
    claimRequiredPhone,
    isMergedAccount,
    signInHref
  };
})(typeof window !== "undefined" ? window : this);
