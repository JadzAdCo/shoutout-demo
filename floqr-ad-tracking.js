/* FLOQR ad measurement — impressions and clicks are counted server-side by recordAdEvent (deduped + throttled).
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (root) {
  "use strict";

  const VERSION = "s3.1.0";
  let recordFn = null;

  function callable() {
    if (recordFn) return recordFn;
    if (!root.firebase?.app || typeof root.firebase.app().functions !== "function") return null;
    try {
      recordFn = root.firebase.app().functions("us-central1").httpsCallable("recordAdEvent");
    } catch (_) {
      recordFn = null;
    }
    return recordFn;
  }

  function record(ad, event, slot = "default") {
    const campaignId = String(ad?.campaignId || ad?.id || "").trim();
    const fn = callable();
    if (!campaignId || !fn) return Promise.resolve(null);
    return fn({campaignId, event, slot: String(slot || "default"), packaged: ad?.packaged === true})
      .then(result => result?.data || null)
      .catch(() => null);
  }

  function impression(ad, slot) {
    return record(ad, "impression", slot);
  }

  function click(ad, slot) {
    return record(ad, "click", slot);
  }

  /** Counts a click on any element that opens the ad link. Bind once per rendered element. */
  function bindClick(el, ad, slot) {
    if (!el || !ad || el.dataset.floqrAdClickBound === "1") return;
    el.dataset.floqrAdClickBound = "1";
    el.addEventListener("click", () => { click(ad, slot); });
  }

  root.FLOQRAdTracking = {VERSION, record, impression, click, bindClick};
})(window);
