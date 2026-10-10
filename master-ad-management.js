/* Master Admin — Ad Management (approval queue, live campaigns, stats, SMS/WhatsApp intake, settings).
   Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc */
(function (root) {
  "use strict";

  const SCOPE = "entityManagement";
  const QUEUE_STATUSES = ["pending_approval", "awaiting_payment"];
  const LIVE_STATUSES = ["active", "paused"];
  const INTAKE_LIMIT = 100;
  const AUDIT_LIMIT = 50;
  const DAILY_DAYS = 14;
  const INTAKE_WEBHOOK = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/adIntakeWebhook";

  const mounted = new Set();
  let unlockBound = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]));
  }

  function db() {
    return root.firebase.firestore();
  }

  function isUnlocked() {
    return !!root.FLOQRSOS2FA?.isUnlocked?.(SCOPE);
  }

  async function call(name, data = {}) {
    const sessionId = root.FLOQRSOS2FA?.getSessionId?.(SCOPE) || "";
    const result = await root.firebase.app().functions("us-central1").httpsCallable(name)({...data, sos2faSessionId: sessionId});
    return result?.data || {};
  }

  function errorText(error) {
    return String(error?.message || error || "Request failed.").replace(/^.*?:\s(?=[A-Z])/, "");
  }

  function formatWhen(ms) {
    const value = Number(ms || 0);
    return value ? new Date(value).toISOString().replace("T", " ").slice(0, 16) : "—";
  }

  function dateInput(ms) {
    const value = Number(ms || 0);
    return value ? new Date(value).toISOString().slice(0, 10) : "";
  }

  function money(cents, currency = "usd") {
    const value = Number(cents || 0) / 100;
    try {
      return new Intl.NumberFormat("en-US", {style: "currency", currency: String(currency || "usd").toUpperCase()}).format(value);
    } catch (_) {
      return `$${value.toFixed(2)}`;
    }
  }

  function ctr(impressions, clicks) {
    const i = Number(impressions || 0);
    return i ? `${((Number(clicks || 0) / i) * 100).toFixed(2)}%` : "—";
  }

  function setStatus(host, message, tone = "") {
    const el = host?.querySelector?.("[data-ad-status]");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.tone = tone;
  }

  function askReason(label, min = 8) {
    const value = root.prompt(`${label}\n(at least ${min} characters, kept in the audit log)`) || "";
    if (value.trim().length < min) {
      if (value) root.alert(`Reason must be at least ${min} characters.`);
      return "";
    }
    return value.trim();
  }

  function lockedHtml() {
    return '<p class="sub small">Unlock Entity Management with SOS2FA to manage ads.</p>';
  }

  function creativeHtml(c) {
    if (c.videoUrl) {
      return `<video class="ad-mgmt-media" src="${esc(c.videoUrl)}" muted playsinline controls preload="metadata"></video>`;
    }
    const url = c.image || c.imageUrl || "";
    return url ? `<img class="ad-mgmt-media" src="${esc(url)}" alt="" loading="lazy">` : '<div class="ad-mgmt-media ad-mgmt-media-empty">No media</div>';
  }

  function demographicsText(c) {
    const d = c.demographics || {};
    const parts = [];
    if (d.ageMin || d.ageMax) parts.push(`Age ${d.ageMin || 18}–${d.ageMax || 99}`);
    if (Array.isArray(d.genders) && d.genders.length && !d.genders.includes("any")) parts.push(d.genders.join(", "));
    ["cities", "countries", "interests", "musicGenres"].forEach(key => {
      if (Array.isArray(d[key]) && d[key].length) parts.push(d[key].join(", "));
    });
    if (!parts.length && Array.isArray(c.targetTags) && c.targetTags.length) parts.push(c.targetTags.join(", "));
    return parts.join(" · ") || "Everyone (no targeting)";
  }

  function listToText(list) {
    return Array.isArray(list) ? list.join(", ") : "";
  }

  function textToList(value) {
    return String(value || "").split(",").map(v => v.trim()).filter(Boolean);
  }

  async function loadCampaigns(statuses) {
    const snap = await db().collection("spotAdCampaigns").where("status", "in", statuses).limit(200).get();
    return snap.docs.map(doc => ({id: doc.id, ...doc.data()}))
      .sort((a, b) => Number(b.updatedAtMs || b.createdAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || 0));
  }

  async function loadPrivate(ids) {
    const out = {};
    await Promise.all(ids.map(async id => {
      try {
        const snap = await db().collection("adCampaignPrivate").doc(id).get();
        if (snap.exists) out[id] = snap.data() || {};
      } catch (_) { /* contact block shows blank */ }
    }));
    return out;
  }

  async function loadStats(ids) {
    const out = {};
    await Promise.all(ids.map(async id => {
      try {
        const snap = await db().collection("adStats").doc(id).get();
        if (snap.exists) out[id] = snap.data() || {};
      } catch (_) { /* stats show zero */ }
    }));
    return out;
  }

  function editFormHtml(c) {
    const d = c.demographics || {};
    const genders = Array.isArray(d.genders) ? d.genders : ["any"];
    return `<details class="ad-mgmt-edit"><summary>Edit targeting &amp; dates</summary>
      <div class="ad-mgmt-grid">
        <label>Headline <input data-f="title" maxlength="80" value="${esc(c.title)}"></label>
        <label>Body <input data-f="body" maxlength="240" value="${esc(c.body)}"></label>
        <label>Link (https) <input data-f="sourceUrl" maxlength="600" value="${esc(c.sourceUrl)}"></label>
        <label>Min age <input data-f="ageMin" type="number" min="18" max="99" value="${esc(d.ageMin || 18)}"></label>
        <label>Max age <input data-f="ageMax" type="number" min="18" max="99" value="${esc(d.ageMax || 99)}"></label>
        <label>Gender <select data-f="gender">
          ${["any", "female", "male", "nonbinary"].map(g => `<option value="${g}"${genders[0] === g ? " selected" : ""}>${g}</option>`).join("")}
        </select></label>
        <label>Cities <input data-f="cities" value="${esc(listToText(d.cities))}"></label>
        <label>Countries <input data-f="countries" value="${esc(listToText(d.countries))}"></label>
        <label>Interests <input data-f="interests" value="${esc(listToText(d.interests))}"></label>
        <label>Music genres <input data-f="musicGenres" value="${esc(listToText(d.musicGenres))}"></label>
        <label>Audience notes <input data-f="notes" maxlength="400" value="${esc(d.notes || "")}"></label>
        <label>Start <input data-f="startDate" type="date" value="${esc(dateInput(c.startsAtMs || c.proposedStartsAtMs))}"></label>
        <label>End <input data-f="endDate" type="date" value="${esc(dateInput(c.endsAtMs || c.proposedEndsAtMs))}"></label>
      </div>
      <button type="button" class="secondary" data-act="save">Save changes</button>
    </details>`;
  }

  function readEdit(card) {
    const v = key => card.querySelector(`[data-f="${key}"]`)?.value ?? "";
    return {
      title: v("title"),
      body: v("body"),
      sourceUrl: v("sourceUrl").trim(),
      startDate: v("startDate"),
      endDate: v("endDate"),
      demographics: {
        ageMin: Number(v("ageMin")) || 18,
        ageMax: Number(v("ageMax")) || 99,
        genders: [v("gender") || "any"],
        cities: textToList(v("cities")),
        countries: textToList(v("countries")),
        interests: textToList(v("interests")),
        musicGenres: textToList(v("musicGenres")),
        notes: v("notes")
      }
    };
  }

  function campaignCardHtml(c, priv, stats, mode) {
    const paid = ["paid", "invoiced", "waived"].includes(c.paymentStatus);
    const contact = [priv?.contactName, priv?.contactEmail, priv?.contactPhone ? `${priv.contactChannel || "phone"} ${priv.contactPhone}` : ""].filter(Boolean).join(" · ");
    const actions = mode === "queue"
      ? `${c.status === "pending_approval" && paid ? '<button type="button" data-act="approve">Approve &amp; schedule</button>' : ""}
         ${!paid ? '<button type="button" class="secondary" data-act="waive">Approve without payment…</button>' : ""}
         ${c.paymentMode === "invoice" && c.paymentStatus !== "paid" ? '<button type="button" class="secondary" data-act="invoicePaid">Mark invoice paid…</button>' : ""}
         <button type="button" class="danger" data-act="reject">Reject…</button>`
      : `${c.status === "active" ? '<button type="button" class="secondary" data-act="pause">Pause…</button>' : '<button type="button" data-act="resume">Resume…</button>'}
         <button type="button" class="danger" data-act="end">End now…</button>
         <button type="button" class="secondary" data-act="resetStats">Clear stats…</button>`;
    return `<article class="ad-mgmt-card card" data-campaign="${esc(c.id)}">
      <div class="ad-mgmt-row">
        ${creativeHtml(c)}
        <div class="ad-mgmt-info">
          <h4>${esc(c.title || "Untitled ad")}</h4>
          <p class="small">${esc(c.body || "")}</p>
          <p class="small"><strong>Status:</strong> ${esc(c.status)} · <strong>Payment:</strong> ${esc(c.paymentStatus || "unpaid")} (${esc(c.paymentMode || "—")}) · ${esc(money(c.priceCents))}${c.invoiceNumber ? ` · <a href="./ad-invoice.html?n=${encodeURIComponent(c.invoiceNumber)}" target="_blank" rel="noopener">${esc(c.invoiceNumber)}</a>` : ""}</p>
          <p class="small"><strong>Posted by:</strong> ${esc(c.posterLabel || c.advertiser || "—")} (${esc(c.posterType || "—")}) · <strong>Source:</strong> ${esc(c.source || "portal")}${c.intakeChannel ? ` via ${esc(c.intakeChannel)}` : ""}</p>
          <p class="small"><strong>Placement:</strong> ${esc(c.placementType || "inline")} · ${esc(c.runDays || "—")} days · ${esc(formatWhen(c.startsAtMs || c.proposedStartsAtMs))} → ${esc(formatWhen(c.endsAtMs || c.proposedEndsAtMs))}</p>
          <p class="small"><strong>Audience:</strong> ${esc(demographicsText(c))}</p>
          ${contact ? `<p class="small"><strong>Contact (private):</strong> ${esc(contact)}</p>` : ""}
          ${c.sourceUrl ? `<p class="small"><strong>Link:</strong> <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.sourceUrl)}</a></p>` : ""}
          ${mode === "live" ? `<p class="small"><strong>Measured:</strong> ${Number(stats?.impressions || 0)} impressions · ${Number(stats?.clicks || 0)} clicks · CTR ${ctr(stats?.impressions, stats?.clicks)}</p>` : ""}
        </div>
      </div>
      ${editFormHtml(c)}
      <div class="row ad-mgmt-actions">${actions}</div>
    </article>`;
  }

  async function runAction(host, card, act, campaign, reload) {
    const campaignId = campaign.id;
    try {
      if (act === "approve") {
        const edit = readEdit(card);
        await call("approveAdCampaign", {campaignId, startDate: edit.startDate, endDate: edit.endDate});
        setStatus(host, `Approved “${campaign.title}”. It is now live in rotation.`, "ok");
      } else if (act === "waive") {
        const reason = askReason("Why is this ad approved without payment?");
        if (!reason) return;
        const edit = readEdit(card);
        await call("approveAdCampaign", {campaignId, waivePayment: true, reason, startDate: edit.startDate, endDate: edit.endDate});
        setStatus(host, `Approved “${campaign.title}” with payment waived.`, "ok");
      } else if (act === "invoicePaid") {
        const reference = (root.prompt("Payment reference (check number, wire id…)") || "").trim();
        if (reference.length < 3) return;
        await call("markAdInvoicePaid", {campaignId, reference});
        setStatus(host, "Invoice marked paid. Approve it to put it live.", "ok");
      } else if (act === "reject") {
        const reason = askReason("Why is this ad rejected? The poster sees this reason.");
        if (!reason) return;
        const refund = campaign.paymentStatus === "paid" ? root.confirm("Refund the card payment through Stripe?") : false;
        const res = await call("rejectAdCampaign", {campaignId, reason, refund});
        setStatus(host, `Rejected. Refund: ${res?.refund?.status || "not applicable"}.`, "ok");
      } else if (["pause", "resume", "end"].includes(act)) {
        const reason = askReason(`Reason to ${act} this ad`);
        if (!reason) return;
        await call("setAdCampaignState", {campaignId, state: act, reason});
        setStatus(host, `Ad ${act === "end" ? "ended" : act + "d"}.`, "ok");
      } else if (act === "resetStats") {
        const reason = askReason("Why clear this ad's impressions and clicks?");
        if (!reason || !root.confirm(`Clear all measured stats for “${campaign.title}”? This cannot be undone.`)) return;
        const res = await call("resetAdStats", {campaignId, reason});
        setStatus(host, `Cleared ${res.deleted || 0} stat records.`, "ok");
      } else if (act === "save") {
        const edit = readEdit(card);
        await call("updateAdCampaign", {campaignId, patch: edit, reason: "Master Admin edit"});
        setStatus(host, "Saved.", "ok");
      }
      await reload();
    } catch (error) {
      setStatus(host, errorText(error), "error");
    }
  }

  function bindCards(host, list, campaigns, reload) {
    list.querySelectorAll("[data-campaign]").forEach(card => {
      const campaign = campaigns.find(c => c.id === card.dataset.campaign);
      card.querySelectorAll("[data-act]").forEach(btn => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          await runAction(host, card, btn.dataset.act, campaign, reload);
          btn.disabled = false;
        });
      });
    });
  }

  async function renderCampaignList(host, statuses, mode) {
    const list = host.querySelector("[data-ad-list]");
    if (!list) return;
    list.innerHTML = '<p class="sub small">Loading…</p>';
    try {
      const campaigns = await loadCampaigns(statuses);
      const ids = campaigns.map(c => c.id);
      const [priv, stats] = await Promise.all([loadPrivate(ids), mode === "live" ? loadStats(ids) : Promise.resolve({})]);
      if (!campaigns.length) {
        list.innerHTML = `<p class="sub small">${mode === "queue" ? "Nothing waiting. Paid ads appear here for approval." : "No live or paused ads."}</p>`;
        return;
      }
      list.innerHTML = campaigns.map(c => campaignCardHtml(c, priv[c.id], stats[c.id], mode)).join("");
      bindCards(host, list, campaigns, () => renderCampaignList(host, statuses, mode));
    } catch (error) {
      list.innerHTML = `<p class="sub small">Could not load ads: ${esc(errorText(error))}</p>`;
    }
  }

  function shell(host, toolbarHtml) {
    host.innerHTML = `<div class="row ad-mgmt-toolbar">${toolbarHtml}</div>
      <p class="sub small" data-ad-status role="status" aria-live="polite"></p>
      <div data-ad-list></div>`;
  }

  function mountQueue(host) {
    shell(host, '<button type="button" class="secondary" data-refresh>Refresh</button>');
    host.querySelector("[data-refresh]").addEventListener("click", () => renderCampaignList(host, QUEUE_STATUSES, "queue"));
    return renderCampaignList(host, QUEUE_STATUSES, "queue");
  }

  function mountLive(host) {
    shell(host, '<button type="button" class="secondary" data-refresh>Refresh</button>');
    host.querySelector("[data-refresh]").addEventListener("click", () => renderCampaignList(host, LIVE_STATUSES, "live"));
    return renderCampaignList(host, LIVE_STATUSES, "live");
  }

  async function loadAllStats() {
    const snap = await db().collection("adStats").limit(500).get();
    return snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
  }

  async function campaignTitles(ids) {
    const out = {};
    await Promise.all(ids.map(async id => {
      try {
        const snap = await db().collection("spotAdCampaigns").doc(id).get();
        if (snap.exists) out[id] = snap.data()?.title || id;
      } catch (_) { /* fall back to id */ }
    }));
    return out;
  }

  function packagedTitle(id) {
    const row = (root.FLOQRAdCampaigns?.campaigns?.() || []).find(c => c.id === id);
    return row ? `${row.title} (packaged demo)` : `${id} (packaged demo)`;
  }

  async function renderStats(host) {
    const list = host.querySelector("[data-ad-list]");
    list.innerHTML = '<p class="sub small">Loading…</p>';
    try {
      const rows = (await loadAllStats()).sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0));
      const titles = await campaignTitles(rows.filter(r => !r.packaged).map(r => r.id));
      const totalI = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
      const totalC = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
      const sinceMs = Date.now() - DAILY_DAYS * 86400000;
      const sinceDay = new Date(sinceMs).toISOString().slice(0, 10);
      const dailySnap = await db().collection("adStatsDaily").where("day", ">=", sinceDay).limit(1000).get();
      const byDay = {};
      dailySnap.forEach(doc => {
        const d = doc.data() || {};
        byDay[d.day] = byDay[d.day] || {i: 0, c: 0};
        byDay[d.day].i += Number(d.impressions || 0);
        byDay[d.day].c += Number(d.clicks || 0);
      });
      const days = Object.keys(byDay).sort().reverse();
      list.innerHTML = `
        <p><strong>${totalI}</strong> impressions · <strong>${totalC}</strong> clicks · CTR <strong>${ctr(totalI, totalC)}</strong> (measured, de-duplicated per viewer)</p>
        <table class="ad-mgmt-table"><thead><tr><th>Ad</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Last event</th><th></th></tr></thead><tbody>
        ${rows.map(r => `<tr><td>${esc(r.packaged ? packagedTitle(r.id) : (titles[r.id] || r.id))}</td><td>${Number(r.impressions || 0)}</td><td>${Number(r.clicks || 0)}</td><td>${ctr(r.impressions, r.clicks)}</td><td>${esc(formatWhen(r.lastEventAtMs))}</td><td><button type="button" class="secondary" data-reset="${esc(r.id)}">Clear</button></td></tr>`).join("") || '<tr><td colspan="6">No impressions recorded yet.</td></tr>'}
        </tbody></table>
        <h4>Last ${DAILY_DAYS} days</h4>
        <table class="ad-mgmt-table"><thead><tr><th>Day (UTC)</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>
        ${days.map(day => `<tr><td>${esc(day)}</td><td>${byDay[day].i}</td><td>${byDay[day].c}</td><td>${ctr(byDay[day].i, byDay[day].c)}</td></tr>`).join("") || '<tr><td colspan="4">No daily data yet.</td></tr>'}
        </tbody></table>`;
      list.querySelectorAll("[data-reset]").forEach(btn => btn.addEventListener("click", async () => {
        const reason = askReason("Why clear this ad's stats?");
        if (!reason || !root.confirm("Clear these stats? This cannot be undone.")) return;
        try {
          const res = await call("resetAdStats", {campaignId: btn.dataset.reset, reason});
          setStatus(host, `Cleared ${res.deleted || 0} stat records.`, "ok");
          renderStats(host);
        } catch (error) {
          setStatus(host, errorText(error), "error");
        }
      }));
    } catch (error) {
      list.innerHTML = `<p class="sub small">Could not load stats: ${esc(errorText(error))}</p>`;
    }
  }

  function mountStats(host) {
    shell(host, '<button type="button" class="secondary" data-refresh>Refresh</button> <button type="button" class="danger" data-reset-all>Clear all ad stats…</button>');
    host.querySelector("[data-refresh]").addEventListener("click", () => renderStats(host));
    host.querySelector("[data-reset-all]").addEventListener("click", async () => {
      const reason = askReason("Why clear ALL ad impressions and clicks?");
      if (!reason) return;
      const typed = root.prompt("Type CLEAR to erase every ad stat record.") || "";
      if (typed.trim() !== "CLEAR") return;
      try {
        const res = await call("resetAdStats", {campaignId: "all", reason});
        setStatus(host, `Cleared ${res.deleted || 0} stat records.`, "ok");
        renderStats(host);
      } catch (error) {
        setStatus(host, errorText(error), "error");
      }
    });
    return renderStats(host);
  }

  async function renderIntake(host) {
    const list = host.querySelector("[data-ad-list]");
    list.innerHTML = '<p class="sub small">Loading…</p>';
    try {
      const snap = await db().collection("adIntakeSubmissions").orderBy("createdAtMs", "desc").limit(INTAKE_LIMIT).get();
      const rows = snap.docs.map(doc => doc.data() || {});
      list.innerHTML = `<table class="ad-mgmt-table"><thead><tr><th>Received</th><th>Channel</th><th>From</th><th>Media</th><th>Caption</th><th>Status</th><th>Ad</th></tr></thead><tbody>
        ${rows.map(r => `<tr>
          <td>${esc(formatWhen(r.createdAtMs))}</td>
          <td>${esc(r.channel || "sms")}</td>
          <td>${esc(r.phoneMasked || "—")}</td>
          <td>${r.mediaUrl ? `<a href="${esc(r.mediaUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.creativeType || "media")}${r.durationSeconds ? ` ${Number(r.durationSeconds).toFixed(0)}s` : ""}</a>` : "—"}</td>
          <td>${esc(String(r.caption || "").slice(0, 80))}</td>
          <td>${esc(r.status || "")}${Number(r.expiresAtMs || 0) < Date.now() && !r.campaignId ? " (expired)" : ""}</td>
          <td>${esc(r.campaignId || "—")}</td>
        </tr>`).join("") || '<tr><td colspan="7">No texts or WhatsApp messages received yet.</td></tr>'}
        </tbody></table>`;
    } catch (error) {
      list.innerHTML = `<p class="sub small">Could not load intake: ${esc(errorText(error))}</p>`;
    }
  }

  function mountIntake(host) {
    shell(host, `<button type="button" class="secondary" data-refresh>Refresh</button>
      <button type="button" class="secondary" data-purge="expired">Delete expired unpaid…</button>
      <button type="button" class="danger" data-purge="all-unpaid">Delete all unpaid…</button>`);
    host.insertAdjacentHTML("afterbegin", `<p class="sub small">Twilio inbound webhook for the advertising number (SMS and WhatsApp): <code>${esc(INTAKE_WEBHOOK)}</code>. Messages with a photo or a video of 30 seconds or less get a payment link back.</p>`);
    host.querySelector("[data-refresh]").addEventListener("click", () => renderIntake(host));
    host.querySelectorAll("[data-purge]").forEach(btn => btn.addEventListener("click", async () => {
      const scope = btn.dataset.purge;
      const reason = askReason(scope === "expired" ? "Why delete expired unpaid submissions?" : "Why delete ALL unpaid submissions (including links still open)?");
      if (!reason || !root.confirm("Delete the matching submissions and their media? This cannot be undone.")) return;
      try {
        const res = await call("purgeAdIntake", {scope, reason});
        setStatus(host, `Deleted ${res.deleted || 0} submissions.`, "ok");
        renderIntake(host);
      } catch (error) {
        setStatus(host, errorText(error), "error");
      }
    }));
    return renderIntake(host);
  }

  function settingsFormHtml(s) {
    const box = (key, label) => `<label class="ad-mgmt-check"><input type="checkbox" data-s="${key}"${Number(s[key]) === 1 ? " checked" : ""}> ${label}</label>`;
    return `<div class="ad-mgmt-grid">
      ${box("splashEnabled", "Show ads on the search loading splash")}
      <label>Splash seconds (3–10) <input type="number" min="3" max="10" data-s="splashSeconds" value="${esc(s.splashSeconds || 5)}"></label>
      ${box("packagedAdsEnabled", "Rotate packaged house ads when no paid ad matches")}
      ${box("showDemoAds", "Include demo / preview ads")}
      ${box("intakeEnabled", "Accept ads by SMS and WhatsApp")}
      <label>Max intake messages per phone per day <input type="number" min="1" max="50" data-s="maxIntakePerPhonePerDay" value="${esc(s.maxIntakePerPhonePerDay || 5)}"></label>
    </div>
    <button type="button" data-save-settings>Save settings</button>
    <p class="sub small">Last changed ${esc(formatWhen(s.updatedAtMs))}${s.updatedByEmail ? ` by ${esc(s.updatedByEmail)}` : ""}.</p>`;
  }

  async function renderSettings(host) {
    const list = host.querySelector("[data-ad-list]");
    list.innerHTML = '<p class="sub small">Loading…</p>';
    try {
      const [settingsSnap, accountsSnap, auditSnap] = await Promise.all([
        db().collection("adSettings").doc("global").get(),
        db().collection("adInvoiceAccounts").limit(100).get(),
        db().collection("adAuditLogs").orderBy("createdAtMs", "desc").limit(AUDIT_LIMIT).get()
      ]);
      const s = {...(root.FLOQRAdCampaigns?.settings?.() || {}), ...(settingsSnap.exists ? settingsSnap.data() : {})};
      const accounts = accountsSnap.docs.map(doc => doc.data() || {});
      const audit = auditSnap.docs.map(doc => doc.data() || {});
      list.innerHTML = `
        <h4>Rotation</h4>${settingsFormHtml(s)}
        <h4>Invoice accounts (pay later, net terms)</h4>
        <p class="sub small">Only posters listed here can choose “Invoice me”. Poster key looks like <code>club:&lt;locationId&gt;</code>, <code>promoter:&lt;uid&gt;</code> or <code>promotionGroup:&lt;groupId&gt;</code>.</p>
        <div class="ad-mgmt-grid">
          <label>Poster key <input data-a="posterKey" placeholder="club:heist-dc"></label>
          <label>Contract ref <input data-a="contractRef" maxlength="120"></label>
          <label>Net days <input data-a="netDays" type="number" min="0" max="90" value="30"></label>
          <label>Billing email <input data-a="billingEmail" type="email"></label>
          <label class="ad-mgmt-check"><input type="checkbox" data-a="enabled" checked> Invoicing allowed</label>
        </div>
        <button type="button" class="secondary" data-save-account>Save invoice account</button>
        <table class="ad-mgmt-table"><thead><tr><th>Poster</th><th>Allowed</th><th>Net</th><th>Billing email</th><th>Contract</th></tr></thead><tbody>
        ${accounts.map(a => `<tr><td>${esc(a.posterKey)}</td><td>${a.enabled ? "Yes" : "No"}</td><td>${esc(a.netDays)}</td><td>${esc(a.billingEmail || "")}</td><td>${esc(a.contractRef || "")}</td></tr>`).join("") || '<tr><td colspan="5">No invoice accounts.</td></tr>'}
        </tbody></table>
        <h4>Ad audit log (latest ${AUDIT_LIMIT})</h4>
        <table class="ad-mgmt-table"><thead><tr><th>When (UTC)</th><th>Event</th><th>By</th><th>Ad</th><th>Reason</th></tr></thead><tbody>
        ${audit.map(a => `<tr><td>${esc(formatWhen(a.createdAtMs))}</td><td>${esc(a.eventType)}</td><td>${esc(a.actorEmail || a.actorUid || "system")}</td><td>${esc(a.campaignId || "")}</td><td>${esc(a.reason || "")}</td></tr>`).join("") || '<tr><td colspan="5">No audit events yet.</td></tr>'}
        </tbody></table>`;
      list.querySelector("[data-save-settings]").addEventListener("click", async () => {
        const settings = {};
        list.querySelectorAll("[data-s]").forEach(el => {
          settings[el.dataset.s] = el.type === "checkbox" ? (el.checked ? 1 : 0) : Number(el.value);
        });
        try {
          await call("setAdSettings", {settings, reason: "Master Admin settings"});
          setStatus(host, "Settings saved. Patrons pick them up on their next search.", "ok");
          renderSettings(host);
        } catch (error) {
          setStatus(host, errorText(error), "error");
        }
      });
      list.querySelector("[data-save-account]").addEventListener("click", async () => {
        const v = key => list.querySelector(`[data-a="${key}"]`);
        const reason = askReason("Why change this invoice account?");
        if (!reason) return;
        try {
          await call("setAdInvoiceAccount", {
            posterKey: v("posterKey").value.trim(),
            contractRef: v("contractRef").value.trim(),
            netDays: Number(v("netDays").value),
            billingEmail: v("billingEmail").value.trim(),
            enabled: v("enabled").checked,
            reason
          });
          setStatus(host, "Invoice account saved.", "ok");
          renderSettings(host);
        } catch (error) {
          setStatus(host, errorText(error), "error");
        }
      });
    } catch (error) {
      list.innerHTML = `<p class="sub small">Could not load settings: ${esc(errorText(error))}</p>`;
    }
  }

  function mountSettings(host) {
    shell(host, '<button type="button" class="secondary" data-refresh>Refresh</button>');
    host.querySelector("[data-refresh]").addEventListener("click", () => renderSettings(host));
    return renderSettings(host);
  }

  const MOUNTERS = {
    adApprovalQueue: ["adApprovalQueueHost", mountQueue],
    adLiveCampaigns: ["adLiveCampaignsHost", mountLive],
    adStatsPanel: ["adStatsHost", mountStats],
    adIntakePanel: ["adIntakeHost", mountIntake],
    adSettingsPanel: ["adSettingsHost", mountSettings]
  };

  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    document.addEventListener("floqr:sos2fa-unlocked", event => {
      if (event.detail?.scope && event.detail.scope !== SCOPE) return;
      [...mounted].forEach(panelId => {
        const host = byId(MOUNTERS[panelId][0]);
        if (host && host.dataset.mounted !== "1") mount(panelId);
      });
    });
  }

  function mount(panelId) {
    const entry = MOUNTERS[panelId];
    if (!entry) return;
    const host = byId(entry[0]);
    if (!host) return;
    bindUnlock();
    mounted.add(panelId);
    if (!isUnlocked()) {
      host.innerHTML = lockedHtml();
      return;
    }
    if (host.dataset.mounted === "1") return;
    host.dataset.mounted = "1";
    Promise.resolve(entry[1](host)).catch(error => {
      host.dataset.mounted = "";
      host.innerHTML = `<p class="sub small">${esc(errorText(error))}</p>`;
    });
  }

  async function renderNetworkAdReport(targetId) {
    const target = byId(targetId);
    if (!target) return;
    target.textContent = "Loading measured ad stats…";
    try {
      const [rows, paidSnap] = await Promise.all([
        loadAllStats(),
        db().collection("spotAdCampaigns").where("paymentStatus", "==", "paid").limit(500).get()
      ]);
      const totalI = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
      const totalC = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
      const revenue = paidSnap.docs.reduce((s, doc) => s + Number(doc.data()?.priceCents || 0), 0);
      const top = rows.sort((a, b) => Number(b.impressions || 0) - Number(a.impressions || 0)).slice(0, 5);
      const titles = await campaignTitles(top.filter(r => !r.packaged).map(r => r.id));
      target.innerHTML = `<p><strong>${totalI}</strong> impressions · <strong>${totalC}</strong> clicks · CTR <strong>${ctr(totalI, totalC)}</strong> · Paid ad revenue <strong>${esc(money(revenue))}</strong> (${paidSnap.size} paid ads)</p>
        <ul class="small">${top.map(r => `<li>${esc(r.packaged ? packagedTitle(r.id) : (titles[r.id] || r.id))}: ${Number(r.impressions || 0)} impressions, ${Number(r.clicks || 0)} clicks (${ctr(r.impressions, r.clicks)})</li>`).join("") || "<li>No impressions recorded yet.</li>"}</ul>`;
    } catch (error) {
      target.textContent = `Ad stats unavailable: ${errorText(error)}`;
    }
  }

  root.FLOQRMasterAdManagement = {mount, renderNetworkAdReport};
})(window);
