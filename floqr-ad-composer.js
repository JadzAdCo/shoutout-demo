/* FLOQR ad composer — shared by Club Admin and My Profile (service members, delegates, promotion groups, FloqQ).
 * Design notes: .cursor/rules/design-notes-ad-campaigns-business.mdc
 */
(function (root) {
  "use strict";

  const VERSION = "s3.1.0";
  const MAX_VIDEO_SECONDS = 30;
  const VIDEO_TOLERANCE_SECONDS = 0.5;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
  const IMAGE_TYPES = /^image\/(jpeg|png|gif|webp)$/i;
  const VIDEO_TYPES = /^video\/(mp4|quicktime|3gpp)$/i;

  function T(key, fallback, vars = {}) {
    let text = root.FLOQRI18n?.t?.(key, vars);
    if (!text || text === key) {
      text = String(fallback || key);
      Object.keys(vars).forEach(name => { text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(vars[name])); });
    }
    return text;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[ch]));
  }

  function callable(name) {
    return root.firebase.app().functions("us-central1").httpsCallable(name);
  }

  async function call(name, data = {}) {
    const result = await callable(name)(data);
    return result?.data || {};
  }

  function errorText(error) {
    return String(error?.message || error || "Request failed.").replace(/^.*?:\s(?=[A-Z])/, "");
  }

  function splitList(value) {
    return String(value || "").split(/[,;|]+/).map(x => x.trim()).filter(Boolean);
  }

  function money(cents) {
    return root.FLOQRAdPricing?.priceLabel?.(cents) || `$${(Number(cents || 0) / 100).toFixed(2)}`;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function statusLabel(status) {
    const map = {
      awaiting_payment: "Awaiting payment",
      pending_approval: "Awaiting FLOQR approval",
      active: "Live",
      paused: "Paused",
      rejected: "Not approved",
      expired: "Ended",
      cancelled: "Cancelled"
    };
    return T(`ads.status.${status}`, map[status] || status || "—");
  }

  /** Reads the real duration in the browser; the server re-checks the file (mp4 mvhd) before it accepts the ad. */
  function videoDurationSeconds(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      const done = fn => value => { URL.revokeObjectURL(url); fn(value); };
      video.onloadedmetadata = done(() => resolve(Number(video.duration || 0)));
      video.onerror = done(() => reject(new Error(T("ads.c.videoUnreadable", "This video could not be read. Use MP4 or MOV."))));
      video.src = url;
    });
  }

  async function checkMedia(file) {
    if (!file) throw new Error(T("ads.c.mediaRequired", "Upload a flyer image or a video."));
    const type = String(file.type || "").toLowerCase();
    if (IMAGE_TYPES.test(type)) {
      if (file.size > MAX_IMAGE_BYTES) throw new Error(T("ads.c.imageTooBig", "Images must be 8 MB or smaller."));
      return {kind: "image", type};
    }
    if (VIDEO_TYPES.test(type)) {
      if (file.size > MAX_VIDEO_BYTES) throw new Error(T("ads.c.videoTooBig", "Videos must be 60 MB or smaller."));
      const seconds = await videoDurationSeconds(file);
      if (!seconds || seconds > MAX_VIDEO_SECONDS + VIDEO_TOLERANCE_SECONDS) {
        throw new Error(T("ads.c.videoTooLong", "This video is {seconds} seconds long. Ads can be 30 seconds at most — trim it and upload again.", {seconds: Math.round(seconds)}));
      }
      return {kind: "video", type, seconds};
    }
    throw new Error(T("ads.c.mediaType", "Use a JPEG, PNG, GIF or WebP image, or an MP4 / MOV video."));
  }

  async function uploadMedia(file, uid, type) {
    const safe = String(file.name || "creative").replace(/[^\w.-]+/g, "_").slice(-60);
    const path = `adMedia/${uid}/${Date.now()}-${safe}`;
    await root.firebase.storage().ref().child(path).put(file, {contentType: type});
    return path;
  }

  function formHtml(prefix) {
    const id = name => `${prefix}${name}`;
    const genders = [["any", T("ads.c.genderAny", "Everyone")], ["female", T("ads.c.genderFemale", "Women")], ["male", T("ads.c.genderMale", "Men")], ["nonbinary", T("ads.c.genderNonbinary", "Non-binary")]];
    return `
      <p class="sub small">${esc(T("ads.c.intro", "Post a flyer or a video up to 30 seconds. Pay, then FLOQR reviews it before it runs. Rejected ads are refunded."))}</p>
      <p id="${id("NoIdentity")}" class="sub small hidden">${esc(T("ads.c.noIdentity", "Your account cannot post ads yet. Club admins, club ad posters, promoters, promotion groups, DJs, photographers and service members can post ads."))}</p>
      <div id="${id("Form")}" class="profile-grid">
        <label>${esc(T("ads.c.postAs", "Post as"))}<select id="${id("PostAs")}"></select></label>
        <label>${esc(T("ads.c.headline", "Headline"))}<input id="${id("Title")}" maxlength="80"/></label>
        <label class="profile-grid-wide">${esc(T("ads.c.body", "Short message"))}<textarea id="${id("Body")}" rows="2" maxlength="240"></textarea></label>
        <label>${esc(T("ads.c.advertiser", "Advertiser name"))}<input id="${id("Advertiser")}" maxlength="80"/></label>
        <label class="profile-grid-wide">${esc(T("ads.c.media", "Flyer image or video (30 seconds max)"))}
          <input id="${id("Media")}" type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/3gpp"/>
          <small>${esc(T("ads.c.mediaHint", "JPEG, PNG, GIF or WebP up to 8 MB, or MP4 / MOV up to 60 MB and 30 seconds."))}</small>
        </label>
        <div id="${id("Preview")}" class="ad-creative-preview profile-grid-wide"></div>
        <label>${esc(T("ads.c.placement", "Placement"))}<select id="${id("Placement")}">
          <option value="inline">${esc(T("ads.c.placementInline", "Inline — Search loading splash and feature screens"))}</option>
          <option value="minglGist">${esc(T("ads.c.placementGist", "Mingl Gist — story scroll"))}</option>
        </select></label>
        <label>${esc(T("ads.c.payment", "Payment"))}<select id="${id("Payment")}">
          <option value="payg">${esc(T("ads.c.payg", "Pay now (card)"))}</option>
          <option value="subscription">${esc(T("ads.c.subscription", "Monthly subscription (card)"))}</option>
          <option value="invoice">${esc(T("ads.c.invoice", "Invoice (approved accounts)"))}</option>
        </select></label>
        <label>${esc(T("ads.c.runDays", "Run length"))}<select id="${id("RunDays")}"></select></label>
        <label>${esc(T("ads.c.startDate", "Start date"))}<input id="${id("Start")}" type="date" min="${todayKey()}" value="${todayKey()}"/></label>
        <label>${esc(T("ads.c.link", "Link (https://)"))}<input id="${id("Link")}" type="url" maxlength="600" placeholder="https://"/></label>
        <label>${esc(T("ads.c.ctaLabel", "Button label"))}<input id="${id("Cta")}" maxlength="40"/></label>
        <label>${esc(T("ads.c.eventName", "Event name"))}<input id="${id("EventName")}" maxlength="120"/></label>
        <label>${esc(T("ads.c.eventDate", "Event date"))}<input id="${id("EventDate")}" type="date"/></label>
        <label>${esc(T("ads.c.venueName", "Venue"))}<input id="${id("Venue")}" maxlength="120"/></label>
        <label>${esc(T("ads.c.ticketUrl", "Ticket link (https://)"))}<input id="${id("Ticket")}" type="url" maxlength="600" placeholder="https://"/></label>
      </div>
      <fieldset id="${id("Audience")}" class="ad-target-fieldset">
        <legend>${esc(T("ads.c.audience", "Who should see it"))}</legend>
        <div class="profile-grid">
          <label>${esc(T("ads.c.ageMin", "Minimum age"))}<input id="${id("AgeMin")}" type="number" min="18" max="99" value="21"/></label>
          <label>${esc(T("ads.c.ageMax", "Maximum age"))}<input id="${id("AgeMax")}" type="number" min="18" max="99" value="99"/></label>
          <label>${esc(T("ads.c.genders", "Gender"))}<select id="${id("Gender")}">${genders.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
          <label>${esc(T("ads.c.cities", "Cities (comma-separated)"))}<input id="${id("Cities")}" maxlength="600"/></label>
          <label>${esc(T("ads.c.countries", "Countries (comma-separated)"))}<input id="${id("Countries")}" maxlength="600"/></label>
          <label>${esc(T("ads.c.interests", "Interests (comma-separated)"))}<input id="${id("Interests")}" maxlength="800"/></label>
          <label>${esc(T("ads.c.music", "Music genres (comma-separated)"))}<input id="${id("Music")}" maxlength="800"/></label>
        </div>
      </fieldset>
      <p id="${id("Price")}" class="sub"></p>
      <div class="queue-actions"><button id="${id("Submit")}" class="primary" type="button">${esc(T("ads.c.submit", "Continue to payment"))}</button></div>
      <p id="${id("Status")}" class="status" role="status" aria-live="polite"></p>
      <h3>${esc(T("ads.c.mine", "My ads"))} <button id="${id("Refresh")}" type="button">${esc(T("ads.c.refresh", "Refresh"))}</button></h3>
      <div id="${id("Mine")}" class="report-block"></div>`;
  }

  function createComposer(host, options = {}) {
    const prefix = options.prefix || "adc";
    const $ = name => document.getElementById(`${prefix}${name}`);
    let identities = [];
    let runDayOptions = [7, 14, 21, 31];

    host.innerHTML = formHtml(prefix);

    const setStatus = message => { const el = $("Status"); if (el) el.textContent = message || ""; };

    function selectedIdentity() {
      return identities.find(item => item.key === $("PostAs")?.value) || null;
    }

    function syncPayment() {
      const identity = selectedIdentity();
      const invoiceOption = $("Payment")?.querySelector("option[value='invoice']");
      if (invoiceOption) invoiceOption.disabled = !identity?.invoiceEnabled;
      if ($("Payment").value === "invoice" && !identity?.invoiceEnabled) $("Payment").value = "payg";
      const subscription = $("Payment").value === "subscription";
      $("RunDays").disabled = subscription;
      if (subscription) $("RunDays").value = "31";
      $("Submit").textContent = $("Payment").value === "invoice"
        ? T("ads.c.submitInvoice", "Submit on invoice")
        : T("ads.c.submit", "Continue to payment");
      syncPrice();
    }

    function syncPrice() {
      const placement = $("Placement")?.value || "inline";
      const days = $("Payment")?.value === "subscription" ? 31 : Number($("RunDays")?.value || 7);
      const cents = root.FLOQRAdPricing?.priceFor?.(placement, days) || 0;
      const el = $("Price");
      if (el) el.textContent = T("ads.c.price", "Price: {price}", {price: money(cents)});
    }

    async function previewMedia() {
      const file = $("Media")?.files?.[0];
      const box = $("Preview");
      if (!box) return;
      box.innerHTML = "";
      if (!file) return;
      try {
        const check = await checkMedia(file);
        const url = URL.createObjectURL(file);
        box.innerHTML = check.kind === "video"
          ? `<video src="${esc(url)}" muted playsinline controls style="max-width:320px;max-height:220px;border-radius:12px"></video><small>${esc(Math.round(check.seconds))}s</small>`
          : `<img src="${esc(url)}" alt="" style="max-width:320px;max-height:220px;border-radius:12px"/>`;
        setStatus("");
      } catch (error) {
        $("Media").value = "";
        setStatus(errorText(error));
      }
    }

    function collectCampaign() {
      return {
        title: $("Title").value.trim(),
        body: $("Body").value.trim(),
        advertiser: $("Advertiser").value.trim(),
        placementType: $("Placement").value,
        runDays: Number($("RunDays").value || 7),
        paymentMode: $("Payment").value,
        startDate: $("Start").value,
        ctaUrl: $("Link").value.trim(),
        ctaLabel: $("Cta").value.trim(),
        eventName: $("EventName").value.trim(),
        eventDate: $("EventDate").value,
        venueName: $("Venue").value.trim(),
        ticketUrl: $("Ticket").value.trim(),
        demographics: {
          ageMin: Number($("AgeMin").value || 18),
          ageMax: Number($("AgeMax").value || 99),
          genders: [$("Gender").value],
          cities: splitList($("Cities").value),
          countries: splitList($("Countries").value),
          interests: splitList($("Interests").value),
          musicGenres: splitList($("Music").value)
        }
      };
    }

    async function submit() {
      const user = root.firebase.auth().currentUser;
      const identity = selectedIdentity();
      if (!user || !identity) return setStatus(T("ads.c.noIdentity", "Your account cannot post ads yet."));
      const campaign = collectCampaign();
      if (!campaign.title) return setStatus(T("ads.c.needHeadline", "Add a headline."));
      $("Submit").disabled = true;
      try {
        const file = $("Media")?.files?.[0];
        const check = await checkMedia(file);
        setStatus(T("ads.c.uploading", "Uploading…"));
        const mediaStoragePath = await uploadMedia(file, user.uid, check.type);
        setStatus(T("ads.c.submitting", "Creating your ad…"));
        const result = await call("createAdCampaign", {
          posterType: identity.posterType,
          posterId: identity.posterId,
          campaign: {...campaign, creativeType: check.kind, mediaStoragePath}
        });
        if (result.checkoutUrl) {
          setStatus(T("ads.c.redirecting", "Opening secure checkout…"));
          root.location.assign(result.checkoutUrl);
          return;
        }
        setStatus(T("ads.c.invoiced", "Submitted on invoice. Invoice {invoice} — FLOQR will review the ad.", {invoice: result.invoiceNumber || ""}));
        await refreshMine();
      } catch (error) {
        setStatus(errorText(error));
      } finally {
        $("Submit").disabled = false;
      }
    }

    function mineRow(row) {
      const when = row.startsAtMs ? `${new Date(row.startsAtMs).toISOString().slice(0, 10)} → ${row.endsAtMs ? new Date(row.endsAtMs).toISOString().slice(0, 10) : "…"}` : "";
      const invoiceHref = row.invoiceNumber ? root.FLOQRNav?.stampCurrentVersion?.("./ad-invoice.html", {n: row.invoiceNumber}) || `./ad-invoice.html?n=${encodeURIComponent(row.invoiceNumber)}` : "";
      return `<div class="queue-item" data-ad-row="${esc(row.id)}">
        <div class="message-envelope-head"><strong>${esc(row.title || "Ad")}</strong><span>${esc(statusLabel(row.status))}</span></div>
        <p class="sub small">${esc(row.posterLabel || "")} · ${esc(row.placementType === "minglGist" ? "Mingl Gist" : "Inline")} · ${esc(row.creativeType || "image")} · ${esc(money(row.priceCents))} · ${esc(row.paymentStatus || "")}${when ? ` · ${esc(when)}` : ""}</p>
        <p class="sub small">${esc(T("ads.c.stats", "{impressions} views · {clicks} clicks", {impressions: Number(row.impressions || 0).toLocaleString(), clicks: Number(row.clicks || 0).toLocaleString()}))}</p>
        ${row.rejectReason ? `<p class="sub small">${esc(row.rejectReason)}</p>` : ""}
        <div class="queue-actions">
          ${row.status === "awaiting_payment" && row.mine ? `<button type="button" class="primary" data-ad-pay="${esc(row.id)}">${esc(T("ads.c.payNow", "Pay now"))}</button>` : ""}
          ${invoiceHref ? `<a class="button-link" href="${esc(invoiceHref)}" target="_blank" rel="noopener">${esc(T("ads.c.viewInvoice", "Invoice"))}</a>` : ""}
        </div>
      </div>`;
    }

    async function refreshMine() {
      const box = $("Mine");
      if (!box) return;
      try {
        const {campaigns = []} = await call("listMyAdCampaigns");
        box.innerHTML = campaigns.length ? campaigns.map(mineRow).join("") : `<p class="sub">${esc(T("ads.c.none", "No ads yet."))}</p>`;
      } catch (error) {
        box.innerHTML = `<p class="sub">${esc(errorText(error))}</p>`;
      }
    }

    async function payExisting(campaignId) {
      setStatus(T("ads.c.redirecting", "Opening secure checkout…"));
      try {
        const result = await call("startAdCampaignCheckout", {campaignId});
        if (result.checkoutUrl) root.location.assign(result.checkoutUrl);
      } catch (error) {
        setStatus(errorText(error));
      }
    }

    async function load() {
      try {
        const data = await call("getAdPostingIdentities");
        identities = Array.isArray(data.identities) ? data.identities : [];
        runDayOptions = Array.isArray(data.runDayOptions) && data.runDayOptions.length ? data.runDayOptions : runDayOptions;
      } catch (error) {
        identities = [];
        setStatus(errorText(error));
      }
      const preferKey = options.preferPosterKey || "";
      $("PostAs").innerHTML = identities.map(item => `<option value="${esc(item.key)}"${item.key === preferKey ? " selected" : ""}>${esc(item.label)}</option>`).join("");
      $("RunDays").innerHTML = runDayOptions.map(days => `<option value="${days}">${esc(T("ads.c.days", "{days} days", {days}))}</option>`).join("");
      const none = !identities.length;
      $("NoIdentity")?.classList.toggle("hidden", !none);
      $("Form")?.classList.toggle("hidden", none);
      $("Audience")?.classList.toggle("hidden", none);
      $("Submit")?.classList.toggle("hidden", none);
      $("Price")?.classList.toggle("hidden", none);
      syncPayment();
      await refreshMine();
      return identities;
    }

    $("PostAs").addEventListener("change", syncPayment);
    $("Payment").addEventListener("change", syncPayment);
    $("Placement").addEventListener("change", syncPrice);
    $("RunDays").addEventListener("change", syncPrice);
    $("Media").addEventListener("change", previewMedia);
    $("Submit").addEventListener("click", submit);
    $("Refresh").addEventListener("click", refreshMine);
    host.addEventListener("click", event => {
      const pay = event.target.closest("[data-ad-pay]");
      if (pay) payExisting(pay.dataset.adPay);
    });

    return {load, refreshMine, identities: () => identities.slice()};
  }

  /* ---------- Club Admin: who may post ads for this club ---------- */

  function mountClubPosters(host, clubLocationId) {
    if (!host) return null;
    host.innerHTML = `
      <h3>${esc(T("ads.posters.title", "Club ad posters"))}</h3>
      <p class="sub small">${esc(T("ads.posters.intro", "Let a team member post ads for this club. They get the Club Ad Poster role."))}</p>
      <div class="profile-grid">
        <label>${esc(T("ads.posters.email", "Team member email"))}<input data-poster-email type="email" maxlength="200"/></label>
      </div>
      <div class="queue-actions"><button type="button" class="primary" data-poster-add>${esc(T("ads.posters.add", "Allow posting"))}</button></div>
      <p class="status" data-poster-status role="status"></p>
      <div class="report-block" data-poster-list></div>`;
    const status = message => { host.querySelector("[data-poster-status]").textContent = message || ""; };
    async function refresh() {
      const list = host.querySelector("[data-poster-list]");
      try {
        const {posters = []} = await call("listClubAdPosters", {clubLocationId});
        const active = posters.filter(p => p.status === "active");
        list.innerHTML = active.length ? active.map(p => `<div class="queue-item"><strong>${esc(p.name || p.email)}</strong> <small>${esc(p.email || "")}</small>
          <button type="button" data-poster-revoke="${esc(p.uid)}">${esc(T("ads.posters.revoke", "Remove"))}</button></div>`).join("")
          : `<p class="sub">${esc(T("ads.posters.none", "No ad posters yet."))}</p>`;
      } catch (error) {
        list.innerHTML = `<p class="sub">${esc(errorText(error))}</p>`;
      }
    }
    host.addEventListener("click", async event => {
      const add = event.target.closest("[data-poster-add]");
      const revoke = event.target.closest("[data-poster-revoke]");
      try {
        if (add) {
          const email = host.querySelector("[data-poster-email]").value.trim();
          if (!email) return;
          await call("setClubAdPoster", {clubLocationId, email, enabled: true});
          host.querySelector("[data-poster-email]").value = "";
        } else if (revoke) {
          await call("setClubAdPoster", {clubLocationId, uid: revoke.dataset.posterRevoke, enabled: false});
        } else {
          return;
        }
        status("");
        await refresh();
      } catch (error) {
        status(errorText(error));
      }
    });
    refresh();
    return {refresh};
  }

  /* ---------- My Profile: promotion groups ---------- */

  function mountPromotionGroups(host, {canCreate = false} = {}) {
    if (!host) return null;
    host.innerHTML = `
      <h3>${esc(T("ads.groups.title", "Promotion groups"))}</h3>
      <p class="sub small">${esc(T("ads.groups.intro", "Promoters can create a group and choose which members may post ads for it."))}</p>
      <div class="profile-grid ${canCreate ? "" : "hidden"}" data-group-create>
        <label>${esc(T("ads.groups.name", "Group name"))}<input data-group-name maxlength="80"/></label>
        <div class="queue-actions"><button type="button" data-group-create-btn>${esc(T("ads.groups.create", "Create group"))}</button></div>
      </div>
      <p class="status" data-group-status role="status"></p>
      <div class="report-block" data-group-list></div>`;
    const status = message => { host.querySelector("[data-group-status]").textContent = message || ""; };
    function groupHtml(group) {
      const members = group.isOwner ? group.members.filter(m => m.role !== "owner").map(m => `<div class="queue-item">
          ${esc(m.name || m.email)} <small>${esc(m.email || "")}</small>
          <label class="toggle-inline"><input type="checkbox" data-member-canpost="${esc(group.id)}|${esc(m.uid)}" ${m.canPostAds ? "checked" : ""}/> ${esc(T("ads.groups.canPost", "May post ads"))}</label>
          <button type="button" data-member-remove="${esc(group.id)}|${esc(m.uid)}">${esc(T("ads.groups.remove", "Remove"))}</button>
        </div>`).join("") : "";
      const add = group.isOwner ? `<div class="profile-grid">
          <label>${esc(T("ads.groups.memberEmail", "Member email"))}<input type="email" data-member-email="${esc(group.id)}" maxlength="200"/></label>
          <label class="toggle-inline"><input type="checkbox" data-member-new-canpost="${esc(group.id)}"/> ${esc(T("ads.groups.canPost", "May post ads"))}</label>
          <div class="queue-actions"><button type="button" data-member-add="${esc(group.id)}">${esc(T("ads.groups.save", "Save member"))}</button></div>
        </div>` : "";
      return `<div class="queue-item"><strong>${esc(group.name)}</strong> <small>${esc(group.isOwner ? "owner" : (group.canPostAds ? T("ads.groups.canPost", "May post ads") : ""))}</small>${members}${add}</div>`;
    }
    async function refresh() {
      const list = host.querySelector("[data-group-list]");
      try {
        const {groups = []} = await call("listMyPromotionGroups");
        list.innerHTML = groups.length ? groups.map(groupHtml).join("") : `<p class="sub">${esc(T("ads.groups.none", "You are not in a promotion group."))}</p>`;
      } catch (error) {
        list.innerHTML = `<p class="sub">${esc(errorText(error))}</p>`;
      }
    }
    host.addEventListener("click", async event => {
      const create = event.target.closest("[data-group-create-btn]");
      const addBtn = event.target.closest("[data-member-add]");
      const remove = event.target.closest("[data-member-remove]");
      try {
        if (create) {
          const name = host.querySelector("[data-group-name]").value.trim();
          if (!name) return;
          await call("upsertPromotionGroup", {name});
          host.querySelector("[data-group-name]").value = "";
        } else if (addBtn) {
          const groupId = addBtn.dataset.memberAdd;
          const email = host.querySelector(`[data-member-email="${CSS.escape(groupId)}"]`).value.trim();
          const canPostAds = !!host.querySelector(`[data-member-new-canpost="${CSS.escape(groupId)}"]`)?.checked;
          if (!email) return;
          await call("setPromotionGroupMember", {groupId, email, canPostAds});
        } else if (remove) {
          const [groupId, uid] = remove.dataset.memberRemove.split("|");
          await call("setPromotionGroupMember", {groupId, uid, remove: true});
        } else {
          return;
        }
        status("");
        await refresh();
      } catch (error) {
        status(errorText(error));
      }
    });
    host.addEventListener("change", async event => {
      const box = event.target.closest("[data-member-canpost]");
      if (!box) return;
      const [groupId, uid] = box.dataset.memberCanpost.split("|");
      try {
        await call("setPromotionGroupMember", {groupId, uid, canPostAds: box.checked});
        status("");
      } catch (error) {
        box.checked = !box.checked;
        status(errorText(error));
      }
    });
    refresh();
    return {refresh};
  }

  root.FLOQRAdComposer = {
    VERSION,
    MAX_VIDEO_SECONDS,
    createComposer,
    mountClubPosters,
    mountPromotionGroups,
    checkMedia,
    statusLabel
  };
})(window);
