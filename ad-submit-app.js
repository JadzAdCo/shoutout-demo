/* Public ad intake landing (link texted back after an SMS / WhatsApp flyer or video).
   Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc */
(function () {
  "use strict";

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

  const params = new URLSearchParams(location.search);
  const token = params.get("t") || "";
  const paidReturn = params.get("paid") === "1";
  const stripeSessionId = params.get("session_id") || "";
  const cancelled = params.get("cancelled") === "1";
  let intake = null;
  let busy = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function t(key, fallback, vars = {}) {
    const raw = window.FLOQRI18n?.t?.(key, vars);
    const value = raw && raw !== key ? raw : fallback;
    return String(value).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
  }

  function setStatus(message) {
    byId("adSubmitStatus").textContent = message || "";
  }

  function show(id, visible) {
    byId(id)?.classList.toggle("hidden", !visible);
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function errorText(error) {
    return String(error?.message || error || "").replace(/^.*?:\s(?=[A-Z])/, "") || t("adsubmit.error", "Something went wrong. Try again.");
  }

  function money(cents) {
    return `$${(Number(cents || 0) / 100).toFixed(2)}`;
  }

  function list(id) {
    return String(byId(id).value || "").split(",").map(v => v.trim()).filter(Boolean);
  }

  function priceTable() {
    return intake?.pricing || {};
  }

  function runDayOptions() {
    const fromServer = Array.isArray(intake?.runDayOptions) ? intake.runDayOptions : null;
    return fromServer || window.FLOQRAdPricing?.RUN_DAY_OPTIONS || [7, 14, 21, 31];
  }

  function currentPrice() {
    const placement = byId("adSubmitPlacement").value;
    const subscription = byId("adSubmitPaymentMode").value === "subscription";
    const days = subscription ? 31 : Number(byId("adSubmitRunDays").value);
    const table = priceTable()[placement];
    const cents = table ? Number(table[days] || 0) : Number(window.FLOQRAdPricing?.priceFor?.(placement, days) || 0);
    return {cents, days, subscription};
  }

  function renderPrice() {
    const {cents, days, subscription} = currentPrice();
    show("adSubmitRunDaysWrap", !subscription);
    byId("adSubmitPrice").textContent = subscription
      ? t("adsubmit.priceMonthly", "Total: {amount} per month", {amount: money(cents)})
      : t("adsubmit.price", "Total: {amount} for {days} days", {amount: money(cents), days});
  }

  function renderMedia(row) {
    const host = byId("adSubmitMedia");
    host.textContent = "";
    if (!row.mediaUrl) return;
    const el = document.createElement(row.creativeType === "video" ? "video" : "img");
    el.src = row.mediaUrl;
    el.className = "ad-submit-preview";
    if (row.creativeType === "video") {
      el.controls = true;
      el.muted = true;
      el.playsInline = true;
      el.preload = "metadata";
    } else {
      el.alt = "";
    }
    host.appendChild(el);
    if (row.durationSeconds) {
      const note = document.createElement("p");
      note.className = "sub small";
      note.textContent = t("adsubmit.videoLength", "Video length: {seconds} seconds", {seconds: Math.round(row.durationSeconds)});
      host.appendChild(note);
    }
    show("adSubmitMediaCard", true);
  }

  function invoiceHref() {
    return `./ad-invoice.html?t=${encodeURIComponent(token)}`;
  }

  function showDone(message, withInvoice) {
    show("adSubmitForm", false);
    byId("adSubmitDoneText").textContent = message;
    const link = byId("adSubmitInvoiceLink");
    link.href = invoiceHref();
    link.classList.toggle("hidden", !withInvoice);
    show("adSubmitDone", true);
  }

  function fillForm(row) {
    const select = byId("adSubmitRunDays");
    select.textContent = "";
    runDayOptions().forEach(days => {
      const option = document.createElement("option");
      option.value = String(days);
      option.textContent = t("ads.c.days", "{days} days", {days});
      select.appendChild(option);
    });
    byId("adSubmitStart").value = new Date().toISOString().slice(0, 10);
    byId("adSubmitStart").min = byId("adSubmitStart").value;
    if (row.caption && !byId("adSubmitTitle").value) byId("adSubmitTitle").value = String(row.caption).slice(0, 80);
    ["adSubmitPlacement", "adSubmitPaymentMode", "adSubmitRunDays"].forEach(id => byId(id).addEventListener("change", renderPrice));
    renderPrice();
    show("adSubmitForm", true);
  }

  function readDetails() {
    return {
      title: byId("adSubmitTitle").value.trim(),
      body: byId("adSubmitBody").value.trim(),
      advertiser: byId("adSubmitAdvertiser").value.trim(),
      ctaUrl: byId("adSubmitLink").value.trim(),
      placementType: byId("adSubmitPlacement").value,
      paymentMode: byId("adSubmitPaymentMode").value,
      runDays: Number(byId("adSubmitRunDays").value) || 7,
      startDate: byId("adSubmitStart").value,
      creativeType: intake?.creativeType || "image",
      demographics: {
        ageMin: Number(byId("adSubmitAgeMin").value) || 18,
        ageMax: Number(byId("adSubmitAgeMax").value) || 99,
        genders: [byId("adSubmitGender").value || "any"],
        cities: list("adSubmitCities"),
        countries: list("adSubmitCountries"),
        interests: list("adSubmitInterests"),
        musicGenres: list("adSubmitMusic")
      }
    };
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const details = readDetails();
    if (!details.title) {
      setStatus(t("ads.c.needHeadline", "Add a headline."));
      return;
    }
    if (details.ctaUrl && !/^https:\/\//i.test(details.ctaUrl)) {
      setStatus(t("adsubmit.needHttps", "The link must start with https://"));
      return;
    }
    busy = true;
    byId("adSubmitPayBtn").disabled = true;
    setStatus(t("ads.c.redirecting", "Opening secure checkout…"));
    try {
      const result = (await callable("startAdIntakeCheckout")({
        token,
        details,
        name: byId("adSubmitName").value.trim(),
        email: byId("adSubmitEmail").value.trim()
      }))?.data || {};
      if (!result.checkoutUrl) throw new Error(t("adsubmit.error", "Something went wrong. Try again."));
      location.href = result.checkoutUrl;
    } catch (error) {
      setStatus(errorText(error));
      busy = false;
      byId("adSubmitPayBtn").disabled = false;
    }
  }

  async function confirmPaid() {
    setStatus(t("adsubmit.confirming", "Confirming your payment…"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const result = (await callable("confirmAdIntakePayment")({token, sessionId: stripeSessionId}))?.data || {};
        if (result.ok) {
          setStatus("");
          showDone(t("adsubmit.paid", "Paid. Your ad is waiting for FLOQR approval. We will text you when it goes live."), true);
          return;
        }
        setStatus(result.message || t("adsubmit.confirming", "Confirming your payment…"));
      } catch (error) {
        setStatus(errorText(error));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  function campaignMessage(campaign) {
    if (campaign.status === "active") return t("adsubmit.live", "Your ad is live.");
    if (campaign.status === "rejected") return t("adsubmit.rejected", "FLOQR did not approve this ad. Check your messages for the reason.");
    return t("adsubmit.paid", "Paid. Your ad is waiting for FLOQR approval. We will text you when it goes live.");
  }

  async function load() {
    if (!token) {
      setStatus(t("adsubmit.missingLink", "This link is missing its code. Send your flyer or video again to get a new link."));
      return;
    }
    byId("adSubmitForm").addEventListener("submit", submit);
    try {
      intake = (await callable("getAdIntake")({token}))?.data || {};
    } catch (error) {
      setStatus(errorText(error));
      return;
    }
    renderMedia(intake);
    if (paidReturn) {
      await confirmPaid();
      return;
    }
    const campaign = intake.campaign;
    if (campaign && ["paid", "invoiced", "waived"].includes(campaign.paymentStatus)) {
      showDone(campaignMessage(campaign), !!campaign.invoiceNumber);
      return;
    }
    if (intake.expired) {
      setStatus(t("adsubmit.expired", "This link expired. Send your flyer or video again to get a new one."));
      return;
    }
    if (cancelled) setStatus(t("adsubmit.cancelled", "Payment cancelled. Nothing was charged. You can try again."));
    fillForm(intake);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
