/* FLOQR Club Admin — messaging credits + marketing campaigns. */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const locationId = new URL(location.href).searchParams.get("location")
    || new URL(location.href).searchParams.get("club")
    || "zebbies-garden-washington-dc";
  if (!window.firebase || !byId("panelAdvertising")) return;

  const auth = firebase.auth();
  const db = firebase.firestore();
  let credits = {smsBalance: 0, whatsappBalance: 0};
  let currentCampaignId = "";
  let selectedTemplateId = "";

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function statusEl() {
    return byId("marketingCampaignStatus");
  }

  function creditStatusEl() {
    return byId("messagingCreditsStatus");
  }

  function useConditionText() {
    return window.FLOQRMessagingCredits?.useCondition
      || "Each $10 pack funds $7.00 of Twilio delivery; FloqR keeps $3.00. SMS ≈ 466 msgs; WhatsApp ≈ 233 msgs.";
  }

  function renderCredits() {
    const sms = byId("creditSmsBalance");
    const wa = byId("creditWhatsappBalance");
    const pack = byId("creditPackSummary");
    if (sms) sms.textContent = String(credits.smsBalance || 0);
    if (wa) wa.textContent = String(credits.whatsappBalance || 0);
    if (pack) {
      const c = window.FLOQRMessagingCredits || {};
      pack.textContent = `Pack: $10 → ${c.SMS_MESSAGES_PER_PACK || 466} SMS or ${c.WHATSAPP_MESSAGES_PER_PACK || 233} WhatsApp ($${((c.TWILIO_BUDGET_CENTS || 700) / 100).toFixed(2)} Twilio / $${((c.FLOQR_PROFIT_CENTS || 300) / 100).toFixed(2)} FloqR).`;
    }
    const cond = byId("messagingUseCondition");
    if (cond) cond.textContent = useConditionText();
  }

  async function loadCredits() {
    try {
      const result = await callable("getClubMessagingCredits")({clubLocationId: locationId});
      credits = result?.data || credits;
      renderCredits();
    } catch (error) {
      const snap = await db.collection("clubMessagingCredits").doc(locationId).get();
      credits = snap.exists ? snap.data() || credits : credits;
      renderCredits();
      if (creditStatusEl()) creditStatusEl().textContent = error?.message || "";
    }
  }

  async function buyPack(orderType) {
    const status = creditStatusEl();
    if (status) status.textContent = "Opening $10 Stripe checkout…";
    await window.FLOQRPayments.startCheckout({
      orderType,
      payload: {clubLocationId: locationId},
      status: message => { if (status) status.textContent = message; }
    });
  }

  function industrySelect() {
    const sel = byId("marketingIndustry");
    if (!sel || !window.FLOQRMarketingTemplates) return;
    const industries = window.FLOQRMarketingTemplates.INDUSTRIES || [];
    sel.innerHTML = industries.map(i => `<option value="${i.id}">${i.label}</option>`).join("");
  }

  function renderTemplateOptions() {
    const industry = byId("marketingIndustry")?.value || "nightlife";
    const list = byId("marketingTemplateList");
    if (!list || !window.FLOQRMarketingTemplates) return;
    const templates = window.FLOQRMarketingTemplates.templatesForIndustry(industry);
    list.innerHTML = templates.map(t => {
      const layout = window.FLOQRMarketingTemplates.getLayout(t.layoutId);
      const active = t.id === selectedTemplateId ? " active" : "";
      return `<button type="button" class="template-pick${active}" data-template="${t.id}">
        <strong>${t.name}</strong>
        <span>${layout?.name || t.layoutId} · ${t.industry}</span>
      </button>`;
    }).join("") || "<p class='sub small'>No templates for this industry.</p>";
    list.querySelectorAll("[data-template]").forEach(btn => {
      btn.addEventListener("click", () => applyTemplate(btn.getAttribute("data-template")));
    });
  }

  function applyTemplate(templateId) {
    selectedTemplateId = templateId;
    const t = window.FLOQRMarketingTemplates?.getTemplate(templateId);
    if (!t) return;
    if (byId("marketingName")) byId("marketingName").value = t.name;
    if (byId("marketingEyebrow")) byId("marketingEyebrow").value = t.eyebrow || "";
    if (byId("marketingHeadline")) byId("marketingHeadline").value = t.headline || "";
    if (byId("marketingBody")) byId("marketingBody").value = t.body || "";
    if (byId("marketingCta")) byId("marketingCta").value = t.cta || "";
    if (byId("marketingSmsBody")) byId("marketingSmsBody").value = t.smsBody || "";
    if (byId("marketingWhatsappBody")) byId("marketingWhatsappBody").value = t.whatsappBody || "";
    if (byId("marketingLayoutId")) byId("marketingLayoutId").value = t.layoutId || "fullBleedHero";
    renderTemplateOptions();
    renderPreview();
  }

  function renderPreview() {
    const preview = byId("marketingPreview");
    if (!preview) return;
    const bg = byId("marketingBackgroundUrl")?.value || "";
    const img1 = byId("marketingImage1")?.value || "";
    const img2 = byId("marketingImage2")?.value || "";
    const layoutId = byId("marketingLayoutId")?.value || "fullBleedHero";
    const eyebrow = byId("marketingEyebrow")?.value || "";
    const headline = byId("marketingHeadline")?.value || "Campaign headline";
    const body = byId("marketingBody")?.value || "";
    const cta = byId("marketingCta")?.value || "";
    preview.className = `marketing-preview layout-${layoutId}`;
    preview.style.backgroundImage = bg ? `linear-gradient(rgba(8,10,18,.55), rgba(8,10,18,.72)), url("${bg.replace(/"/g, "")}")` : "";
    preview.innerHTML = `
      ${eyebrow ? `<p class="preview-eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
      <h3>${escapeHtml(headline)}</h3>
      <p>${escapeHtml(body)}</p>
      ${cta ? `<span class="preview-cta">${escapeHtml(cta)}</span>` : ""}
      <div class="preview-images">
        ${img1 ? `<img src="${escapeAttr(img1)}" alt="Campaign image 1"/>` : ""}
        ${img2 ? `<img src="${escapeAttr(img2)}" alt="Campaign image 2"/>` : ""}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function campaignPayload() {
    const imageUrls = [byId("marketingImage1")?.value, byId("marketingImage2")?.value]
      .map(v => String(v || "").trim())
      .filter(Boolean);
    return {
      clubLocationId: locationId,
      campaignId: currentCampaignId || undefined,
      channel: byId("marketingChannel")?.value || "sms",
      industry: byId("marketingIndustry")?.value || "",
      templateId: selectedTemplateId || "",
      layoutId: byId("marketingLayoutId")?.value || "fullBleedHero",
      name: byId("marketingName")?.value || "Marketing campaign",
      eyebrow: byId("marketingEyebrow")?.value || "",
      headline: byId("marketingHeadline")?.value || "",
      body: byId("marketingBody")?.value || "",
      cta: byId("marketingCta")?.value || "",
      smsBody: byId("marketingSmsBody")?.value || "",
      whatsappBody: byId("marketingWhatsappBody")?.value || "",
      backgroundImageUrl: byId("marketingBackgroundUrl")?.value || "",
      imageUrls,
      linkUrl: byId("marketingLinkUrl")?.value || "",
      estimatedRecipients: Math.max(1, Number(byId("marketingRecipients")?.value || 1))
    };
  }

  async function saveCampaign() {
    const status = statusEl();
    if (status) status.textContent = "Saving campaign draft…";
    const result = await callable("saveClubMarketingCampaign")(campaignPayload());
    currentCampaignId = result?.data?.campaignId || currentCampaignId;
    if (status) status.textContent = `Draft saved (${currentCampaignId}). Credits required ≈ estimated recipients on send.`;
    await loadCampaignList();
  }

  async function sendCampaign() {
    const status = statusEl();
    if (!currentCampaignId) await saveCampaign();
    if (!currentCampaignId) throw new Error("Save a draft before sending.");
    const testPhone = String(byId("marketingTestPhone")?.value || "").trim();
    if (!testPhone) throw new Error("Enter a test recipient phone (E.164) to send.");
    const channel = byId("marketingChannel")?.value || "sms";
    if (status) status.textContent = "Sending campaign (debits message credits)…";
    const result = await callable("sendClubMarketingCampaign")({
      clubLocationId: locationId,
      campaignId: currentCampaignId,
      recipients: [{phone: testPhone, channel: channel === "whatsapp" ? "whatsapp" : "sms"}]
    });
    const data = result?.data || {};
    if (status) {
      status.textContent = `Sent ${data.sent || 0}/${data.attempted || 0}. Remaining SMS ${data.remaining?.smsBalance ?? "—"}, WhatsApp ${data.remaining?.whatsappBalance ?? "—"}.`;
    }
    await loadCredits();
    await loadCampaignList();
  }

  async function loadCampaignList() {
    const report = byId("marketingCampaignReport");
    if (!report) return;
    const snap = await db.collection("clubMarketingCampaigns")
      .where("clubLocationId", "==", locationId)
      .limit(40)
      .get();
    const rows = snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
      .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    report.innerHTML = rows.length
      ? rows.map(row => `<div class="report-row"><strong>${escapeHtml(row.name || row.id)}</strong> · ${escapeHtml(row.status || "draft")} · ${escapeHtml(row.channel || "")} · ${escapeHtml(row.industry || "")}<br/><button type="button" data-load-campaign="${row.id}">Load</button></div>`).join("")
      : "<p class='sub small'>No campaigns yet.</p>";
    report.querySelectorAll("[data-load-campaign]").forEach(btn => {
      btn.addEventListener("click", () => loadCampaignIntoForm(btn.getAttribute("data-load-campaign"), rows));
    });
  }

  function loadCampaignIntoForm(id, rows) {
    const row = (rows || []).find(r => r.id === id);
    if (!row) return;
    currentCampaignId = id;
    selectedTemplateId = row.templateId || "";
    if (byId("marketingIndustry") && row.industry) byId("marketingIndustry").value = row.industry;
    if (byId("marketingChannel")) byId("marketingChannel").value = row.channel || "sms";
    if (byId("marketingName")) byId("marketingName").value = row.name || "";
    if (byId("marketingEyebrow")) byId("marketingEyebrow").value = row.eyebrow || "";
    if (byId("marketingHeadline")) byId("marketingHeadline").value = row.headline || "";
    if (byId("marketingBody")) byId("marketingBody").value = row.body || "";
    if (byId("marketingCta")) byId("marketingCta").value = row.cta || "";
    if (byId("marketingSmsBody")) byId("marketingSmsBody").value = row.smsBody || "";
    if (byId("marketingWhatsappBody")) byId("marketingWhatsappBody").value = row.whatsappBody || "";
    if (byId("marketingBackgroundUrl")) byId("marketingBackgroundUrl").value = row.backgroundImageUrl || "";
    if (byId("marketingImage1")) byId("marketingImage1").value = (row.imageUrls || [])[0] || "";
    if (byId("marketingImage2")) byId("marketingImage2").value = (row.imageUrls || [])[1] || "";
    if (byId("marketingLinkUrl")) byId("marketingLinkUrl").value = row.linkUrl || "";
    if (byId("marketingLayoutId")) byId("marketingLayoutId").value = row.layoutId || "fullBleedHero";
    if (byId("marketingRecipients")) byId("marketingRecipients").value = row.estimatedRecipients || 1;
    renderTemplateOptions();
    renderPreview();
    window.FLOQRUrlMediaField?.renderPreview?.(byId("marketingBackgroundPreview"), byId("marketingBackgroundUrl")?.value || "");
    window.FLOQRUrlMediaField?.renderPreview?.(byId("marketingImage1Preview"), byId("marketingImage1")?.value || "");
    window.FLOQRUrlMediaField?.renderPreview?.(byId("marketingImage2Preview"), byId("marketingImage2")?.value || "");
    if (statusEl()) statusEl().textContent = `Loaded campaign ${id}.`;
  }

  function bindMarketingMediaUploads() {
    const binder = window.FLOQRUrlMediaField;
    if (!binder?.bind) return;
    const pathPrefix = `clubMedia/${locationId}/marketing`;
    [
      {urlInputId:"marketingBackgroundUrl", fileInputId:"marketingBackgroundFile", previewId:"marketingBackgroundPreview"},
      {urlInputId:"marketingImage1", fileInputId:"marketingImage1File", previewId:"marketingImage1Preview"},
      {urlInputId:"marketingImage2", fileInputId:"marketingImage2File", previewId:"marketingImage2Preview"}
    ].forEach(field => {
      binder.bind({
        ...field,
        statusId:"marketingCampaignStatus",
        pathPrefix,
        allowVideo:false,
        maxBytes:12 * 1024 * 1024,
        onChange:renderPreview
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    industrySelect();
    renderTemplateOptions();
    renderPreview();
    renderCredits();
    bindMarketingMediaUploads();

    byId("marketingIndustry")?.addEventListener("change", () => {
      selectedTemplateId = "";
      renderTemplateOptions();
    });
    ["marketingBackgroundUrl", "marketingImage1", "marketingImage2", "marketingEyebrow", "marketingHeadline", "marketingBody", "marketingCta", "marketingLayoutId"]
      .forEach(id => byId(id)?.addEventListener("input", renderPreview));

    byId("buySmsServiceBtn")?.addEventListener("click", () => buyPack("smsNotifications").catch(err => {
      if (creditStatusEl()) creditStatusEl().textContent = err.message;
    }));
    byId("buyWhatsappServiceBtn")?.addEventListener("click", () => buyPack("whatsappNotifications").catch(err => {
      if (creditStatusEl()) creditStatusEl().textContent = err.message;
    }));
    byId("buySmsBundleBtn")?.addEventListener("click", () => buyPack("smsMessageBundle").catch(err => {
      if (creditStatusEl()) creditStatusEl().textContent = err.message;
    }));
    byId("buyWhatsappBundleBtn")?.addEventListener("click", () => buyPack("whatsappMessageBundle").catch(err => {
      if (creditStatusEl()) creditStatusEl().textContent = err.message;
    }));
    byId("refreshMessagingCreditsBtn")?.addEventListener("click", () => loadCredits());
    byId("saveMarketingCampaignBtn")?.addEventListener("click", () => saveCampaign().catch(err => {
      if (statusEl()) statusEl().textContent = err.message;
    }));
    byId("sendMarketingCampaignBtn")?.addEventListener("click", () => sendCampaign().catch(err => {
      if (statusEl()) statusEl().textContent = err.message;
    }));

    auth.onAuthStateChanged(user => {
      if (!user) return;
      loadCredits().catch(() => {});
      loadCampaignList().catch(() => {});
    });
  });
})();
