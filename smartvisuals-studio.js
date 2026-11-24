/* Master Admin SMARTvisual Studio — Library, create, tagging, review, diagnostics, ad policy.
   Packaged registry is source of truth. Drafts stay off patron surfaces until Functions publish. */
(function (root) {
  "use strict";
  if (root.FLOQRSmartVisualStudio) return;

  const t = (key, fallback) => {
    try {
      const out = root.FLOQRI18n?.t?.(key);
      if (out && out !== key) return out;
    } catch (_) {}
    return fallback;
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const EXAMPLES = [
    {id: "cancun", title: "Cancun Trip", description: "Let's plan our Cancun trip together with BOT-DEE."},
    {id: "paris-fw", title: "Paris Fashion Week", description: "Runway night in Paris."},
    {id: "dining", title: "Dinner reservations", description: "Pick a restaurant for Saturday."},
    {id: "seattle-la", title: "Seattle LA", description: ""},
    {id: "san-dego", title: "San Dego weekend", description: ""},
    {id: "burningman", title: "Burningman", description: "Packing list only."},
    {id: "saturday", title: "Saturday", description: ""}
  ];

  let catalog = null;
  let page = "library";
  let filter = "";
  let typeFilter = "all";
  let tagFilter = "";
  let selectedId = "";
  let selectedDraftId = "";
  let reviewDrafts = [];
  let reviewSeq = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  const SOS_SCOPE = "entityManagement";

  function sosSessionId() {
    return String(root.FLOQRSOS2FA?.getSessionId?.(SOS_SCOPE) || "");
  }

  function needSos2fa(status) {
    if (sosSessionId()) return false;
    try { root.FLOQRSOS2FA?.requireUnlock?.(SOS_SCOPE); } catch (_) {}
    if (status) {
      status.textContent = t(
        "sv.studioNeedSos2fa",
        "Entity Management requires a valid SOS2FA session. Request a new SOS2FA code."
      );
    }
    return true;
  }

  async function refreshAuthToken() {
    const user = root.firebase?.auth?.()?.currentUser;
    if (user?.getIdToken) await user.getIdToken(true);
  }

  async function studioCallable(name, data) {
    const sos2faSessionId = sosSessionId();
    if (!sos2faSessionId) {
      const err = new Error(t(
        "sv.studioNeedSos2fa",
        "Entity Management requires a valid SOS2FA session. Request a new SOS2FA code."
      ));
      err.code = "sos2fa-missing";
      throw err;
    }
    await refreshAuthToken();
    return firebase.app().functions("us-central1").httpsCallable(name)({
      ...data,
      sos2faSessionId
    });
  }

  function assets() {
    return (catalog && catalog.assets) || [];
  }

  function publishedOf(type) {
    return assets().filter(a => a.type === type && a.approvalStatus === "published");
  }

  function slugName(name) {
    return String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function matchCatalogAsset(draft) {
    const type = String(draft?.type || "background");
    const name = String(draft?.name || "").trim();
    const slug = slugName(name);
    const wantId = type === "stencil" ? `st-${slug}` : `bg-${slug}`;
    const lower = name.toLowerCase();
    return assets().find(a => a.id === wantId)
      || assets().find(a => a.type === type && String(a.name || "").toLowerCase() === lower)
      || assets().find(a => (a.aliases || []).map(x => String(x).toLowerCase()).includes(slug))
      || null;
  }

  function draftPreviewSrc(row) {
    const svg = String(row?.svgXml || "");
    const raster = String(row?.imageBase64 || "");
    const type = String(row?.contentType || (svg ? "image/svg+xml" : "image/jpeg"));
    if (svg) return svgPreviewSrc(svg);
    if (raster) return `data:${type};base64,${raster.replace(/[^A-Za-z0-9+/=]/g, "")}`;
    return "";
  }

  function assetImageSrc(asset) {
    if (asset?.studioPreviewSrc) return asset.studioPreviewSrc;
    return `./${asset?.path || ""}`;
  }

  function applyDraftToCatalog(draft) {
    if (!draft || String(draft.approvalStatus || "") !== "published") return null;
    const match = assets().find(a => a.id === draft.catalogAssetId) || matchCatalogAsset(draft);
    if (!match) return null;
    const src = draftPreviewSrc(draft);
    if (src) match.studioPreviewSrc = src;
    match.studioDraftId = draft.id;
    return match;
  }

  function uniqueAssetTags() {
    const set = new Set();
    assets().forEach(a => (a.tags || []).forEach(tag => {
      const v = String(tag || "").trim();
      if (v) set.add(v);
    }));
    return [...set].sort();
  }

  function normalizeTags(raw) {
    const api = root.FLOQRSmartVisualsResolver;
    if (api?.normalizeSmartViewTags) return api.normalizeSmartViewTags(raw);
    return String(raw || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  }

  function optionList(rows, selected) {
    return rows.map(a =>
      `<option value="${esc(a.id)}"${a.id === selected ? " selected" : ""}>${esc(a.name)} (${esc(a.id)})</option>`
    ).join("");
  }

  function setPage(name) {
    page = name;
    document.querySelectorAll("[data-sv-studio-page]").forEach(btn => {
      const on = btn.getAttribute("data-sv-studio-page") === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-sv-studio-panel]").forEach(panel => {
      const on = panel.getAttribute("data-sv-studio-panel") === name;
      panel.hidden = !on;
    });
    if (name === "library") renderLibrary();
    if (name === "tagging") renderTagging();
    if (name === "diagnostics") renderDiagnostics();
    if (name === "review") renderReview();
    if (name === "ads") renderAds();
  }

  function renderLibrary() {
    const host = byId("svStudioLibrary");
    if (!host) return;
    const q = filter.trim().toLowerCase();
    const tagWant = tagFilter.trim().toLowerCase();
    const rows = assets().filter(a => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      const tags = (a.tags || []).map(x => String(x).toLowerCase());
      if (tagWant && !tags.includes(tagWant) && a.category !== tagWant) return false;
      if (!q) return true;
      const hay = [a.id, a.name, a.category, ...(a.tags || []), ...(a.aliases || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const chipHost = byId("svStudioTagRow");
    if (chipHost) {
      const chips = uniqueAssetTags().map(tag =>
        `<button type="button" class="sv-studio-tag${tag === tagFilter ? " is-active" : ""}" data-sv-tag="${esc(tag)}">${esc(tag)}</button>`
      ).join("");
      chipHost.innerHTML = `<button type="button" class="sv-studio-tag${tagFilter ? "" : " is-active"}" data-sv-tag="">${esc(t("sv.placeTagFilterAll", "All tags"))}</button>${chips}`;
      chipHost.querySelectorAll("[data-sv-tag]").forEach(btn => {
        btn.addEventListener("click", () => {
          tagFilter = btn.getAttribute("data-sv-tag") || "";
          renderLibrary();
        });
      });
    }
    host.innerHTML = rows.map(a => `
      <button type="button" class="sv-studio-card" data-sv-asset="${esc(a.id)}">
        <img src="${esc(assetImageSrc(a))}" alt="${esc(a.name)}"/>
        <b>${esc(a.name)}</b>
        <small>${esc(a.type)} · ${esc(a.approvalStatus)} · ${esc(a.category || "")}</small>
      </button>`).join("") || `<p class="sub small">${esc(t("sv.studioEmpty", "No assets match."))}</p>`;
    host.querySelectorAll("[data-sv-asset]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedId = btn.getAttribute("data-sv-asset");
        showDetail(selectedId);
      });
    });
    const count = byId("svStudioCount");
    if (count) count.textContent = t("sv.studioCount", "{n} packaged published assets").replace("{n}", String(rows.length));
  }

  function defaultPlacePick(asset) {
    const bgs = publishedOf("background");
    const sts = publishedOf("stencil");
    const backgroundId = asset?.type === "background"
      ? asset.id
      : (bgs[0] && bgs[0].id) || "bg-vip-nightlife";
    let stencilId = asset?.type === "stencil" ? asset.id : "";
    if (!stencilId && asset?.pairedStencilId) {
      stencilId = String(asset.pairedStencilId).startsWith("st-")
        ? asset.pairedStencilId
        : `st-${asset.pairedStencilId}`;
    }
    if (!stencilId) stencilId = (sts.find(s => s.id === "st-location") || sts[0] || {}).id || "st-people";
    const tags = (asset?.tags || []).join(", ");
    return {backgroundId, stencilId, tags};
  }

  function showDetail(id) {
    const asset = assets().find(a => a.id === id);
    const box = byId("svStudioDetail");
    if (!box || !asset) return;
    const pick = defaultPlacePick(asset);
    box.innerHTML = `
      <h3 data-floqr-help-id="help-smartvisuals-create"
        data-floqr-help-title="Create / Edit SMARTvisuals"
        data-floqr-help-search="milan preview|smartbackground preview|art upload|create edit"
        data-floqr-help-body="Create or edit a SMARTstencil or SMARTbackground draft. Name is required. SMARTstencils must be SVG. SMARTbackgrounds accept SVG, JPEG, PNG, or WebP. Files are sanitized on the server. Drafts stay off patrons until an audited publish. Scenic art is FLOQR illustration, not photography and not an official destination or Fashion Week mark.">${esc(asset.name)}</h3>
      <p class="sub small">${esc(asset.id)} · rev ${esc(String(catalog.revision || 1))} · ${esc(asset.approvalStatus)}</p>
      <img src="${esc(assetImageSrc(asset))}" alt="${esc(asset.name)}" class="sv-studio-preview"/>
      <p>${esc((asset.tags || []).join(", "))}</p>
      <p class="sub small" data-keep-visible="true">${esc(t("sv.licenseNote", "Original FLOQR illustration. Not a photograph or official mark."))}</p>
      <h4 class="sv-studio-assign-head"
        data-floqr-help-id="help-smartvisuals-place-assign"
        data-floqr-help-title="Place SMARTview stencil, background, and tags"
        data-floqr-help-search="place smartview stencil|smartbackground assignment|smartview tags"
        data-floqr-help-body="Assign a published SMARTstencil and SMARTbackground to Place SMARTview cards of one type (venue, restaurant, hotel, event, travel). Tags stay with that assignment so operators can filter cards. SOS2FA and a reason are required to save. Patrons still only see published registry art. This is not Features SMARTview.">${esc(t("sv.assignPlaceCard", "Save Place SMARTview assignment"))}</h4>
      <p class="sub small">${esc(t("sv.placeAssignHint", "Choose a published SMARTstencil and SMARTbackground for this place type. Tags stay with the assignment. SOS2FA and a reason are required to save."))}</p>
      <p class="button-row sv-studio-place-row">
        <label class="sv-studio-place-kind">${esc(t("sv.placeBgKind", "Place card type"))}
          <select id="svStudioPlaceKind">
            <option value="venue">${esc(t("botdee.sv.kindVenue", "Venue"))}</option>
            <option value="restaurant">${esc(t("botdee.sv.kindRestaurant", "Restaurant"))}</option>
            <option value="hotel">${esc(t("botdee.sv.kindHotel", "Hotel"))}</option>
            <option value="event">${esc(t("botdee.sv.kindEvent", "Event"))}</option>
            <option value="travel">${esc(t("botdee.sv.kindTravel", "Travel"))}</option>
          </select>
        </label>
        <label class="sv-studio-place-kind">${esc(t("sv.placeBackground", "SMARTbackground"))}
          <select id="svStudioPlaceBackground">${optionList(publishedOf("background"), pick.backgroundId)}</select>
        </label>
        <label class="sv-studio-place-kind">${esc(t("sv.placeStencil", "SMARTstencil"))}
          <select id="svStudioPlaceStencil">${optionList(publishedOf("stencil"), pick.stencilId)}</select>
        </label>
      </p>
      <p class="sv-studio-place-row">
        <label class="sv-studio-place-kind">${esc(t("sv.placeTags", "Tags"))}
          <input id="svStudioPlaceTags" value="${esc(pick.tags)}" maxlength="200" placeholder="nightlife, dc, venue"/>
        </label>
      </p>
      <p class="sub small">${esc(t("sv.placeTagsHint", "Comma-separated tags on this Place SMARTview (assign, filter, persist)."))}</p>
      <p class="button-row">
        <button type="button" class="buttonlike" data-sv-preview="notify">${esc(t("sv.previewNotify", "Preview in Search SMARTnotification"))}</button>
        <button type="button" class="buttonlike" data-sv-preview="room">${esc(t("sv.previewRoom", "Preview in Room SMARTview"))}</button>
        <button type="button" class="buttonlike" data-sv-preview="place">${esc(t("sv.previewPlace", "Preview in Place SMARTview"))}</button>
        <button type="button" class="buttonlike primary" data-sv-assign-place="1">${esc(t("sv.assignPlaceCard", "Save Place SMARTview assignment"))}</button>
      </p>
      <p id="svStudioPlaceStatus" class="status" aria-live="polite"></p>`;
    box.querySelectorAll("[data-sv-preview]").forEach(btn => {
      btn.addEventListener("click", () => previewSurface(btn.getAttribute("data-sv-preview"), asset));
    });
    box.querySelector("[data-sv-assign-place]")?.addEventListener("click", () => assignPlaceVisual(asset));
    byId("svStudioPlaceKind")?.addEventListener("change", () => fillPlaceOverride(asset));
    try { root.FLOQRHelpAttach?.mountAll?.(box); } catch (_) { /* optional */ }
    fillPlaceOverride(asset);
  }

  function placeAssignFields() {
    return {
      kind: byId("svStudioPlaceKind")?.value || "venue",
      backgroundId: byId("svStudioPlaceBackground")?.value || "",
      stencilId: byId("svStudioPlaceStencil")?.value || "",
      tags: normalizeTags(byId("svStudioPlaceTags")?.value || "")
    };
  }

  async function fillPlaceOverride(asset) {
    const kind = byId("svStudioPlaceKind")?.value || "venue";
    const db = root.firebase?.firestore?.();
    if (!db) return;
    try {
      const snap = await db.collection("smartVisualOverrides").doc(`placeSmartView:${kind}`).get();
      if (!snap.exists) return;
      const row = snap.data() || {};
      if (row.backgroundId && byId("svStudioPlaceBackground")) {
        byId("svStudioPlaceBackground").value = row.backgroundId;
      }
      if (row.stencilId && byId("svStudioPlaceStencil")) {
        byId("svStudioPlaceStencil").value = row.stencilId;
      }
      if (Array.isArray(row.tags) && byId("svStudioPlaceTags")) {
        byId("svStudioPlaceTags").value = row.tags.join(", ");
      }
    } catch (_) {
      /* Master Admin read of overrides is optional until signed in */
      if (asset) return;
    }
  }

  function previewSurface(kind, asset) {
    const host = byId("svStudioLivePreview");
    if (!host) return;
    host.hidden = false;
    if (kind === "place") {
      previewPlaceCard(asset, host);
      return;
    }
    const pick = placeAssignFields();
    const payload = Object.assign(root.FLOQRSmartVisuals?.syntheticCancun?.() || {title: "Cancun Trip", demo: true}, {
      override: {
        backgroundId: pick.backgroundId || (asset.type === "background" ? asset.id : "bg-bali"),
        stencilId: pick.stencilId || (asset.type === "stencil" ? asset.id : "st-flight"),
        authorized: true
      }
    });
    if (!root.FLOQRSmartVisuals) return;
    if (kind === "notify") root.FLOQRSmartVisuals.mountNotification(host, payload, {onView() { root.FLOQRSmartVisuals.mountRoom(host, payload, {}); }});
    else root.FLOQRSmartVisuals.mountRoom(host, payload, {});
  }

  function previewPlaceCard(asset, host) {
    const api = root.FLOQRBotDeeSmartView;
    if (!api?.renderCard) {
      host.innerHTML = `<p class="status">${esc(t("sv.previewPlaceNeedRenderer", "Place SMARTview renderer is missing."))}</p>`;
      return;
    }
    if (catalog) root.FLOQRSmartVisualsCatalog = catalog;
    const pick = placeAssignFields();
    const kind = pick.kind || "venue";
    const html = api.renderCard({
      kind,
      title: kind === "venue" ? "Aurelia" : t("sv.untitled", "Mingl Room"),
      summary: kind === "venue"
        ? "FLOQR demo club. SmartView is a compact wrapper — the club public page is canonical."
        : "",
      ratings: [{provider: "FLOQR", value: 4.8}],
      actions: [{id: "open-public-page", href: "./club-profile.html?location=temp-democlub-1", label: "Open FLOQR Public Page"}],
      sources: [{provider: "FLOQR", reuseRights: "approved"}],
      canonicalFloqrPageId: "temp-democlub-1",
      tags: pick.tags,
      floqrPublicData: {
        city: "Washington, DC",
        smartBackgroundId: pick.backgroundId,
        smartStencilId: pick.stencilId,
        smartTags: pick.tags
      }
    });
    host.hidden = false;
    host.innerHTML = `<div class="sv-studio-place-preview">${html}</div>`;
    try { root.FLOQRChromeScheme?.applyDocument?.(); } catch (_) { /* ignore */ }
  }

  async function assignPlaceVisual(asset) {
    const status = byId("svStudioPlaceStatus");
    const pick = placeAssignFields();
    if (!pick.backgroundId || !pick.stencilId) {
      if (status) status.textContent = t("sv.studioDenied", "Publish denied.");
      return;
    }
    const reasonPrompt = root.FLOQRReasonPrompt;
    if (!reasonPrompt?.ask) {
      if (status) status.textContent = t("sv.studioNeedReason", "Reason prompt module missing — nothing was saved.");
      return;
    }
    if (needSos2fa(status)) return;
    const reason = await reasonPrompt.ask({
      summary: t("sv.studioPlaceSummary", "SMARTvisuals: set Place SMARTview stencil, background, and tags"),
      minLength: 8
    });
    if (reason == null) {
      if (status) status.textContent = t("sv.cancelled", "Cancelled — nothing was saved.");
      return;
    }
    try {
      const result = await studioCallable("setSmartVisualOverride", {
        roomKey: `placeSmartView:${pick.kind}`,
        backgroundId: pick.backgroundId,
        stencilId: pick.stencilId,
        tags: pick.tags,
        reason
      });
      if (status) {
        const saved = [result.data?.backgroundId || pick.backgroundId, result.data?.stencilId || pick.stencilId]
          .concat(result.data?.tags || pick.tags)
          .join(" · ");
        status.textContent = t("sv.placeAssignSaved", "Place SMARTview stencil, background, and tags saved.")
          + ` (${saved})`;
      }
      const previewHost = byId("svStudioLivePreview");
      if (previewHost) previewPlaceCard(asset, previewHost);
    } catch (err) {
      if (status) status.textContent = err?.message || t("sv.studioDenied", "Publish denied.");
    }
  }

  function renderTagging() {
    const host = byId("svStudioExamples");
    if (!host || !root.FLOQRSmartVisualsResolver) return;
    const policy = root.FLOQRSmartVisualsResolver.adPolicy();
    const filterEl = byId("svStudioTaggingFilter");
    const want = normalizeTags(filterEl?.value || "")[0] || "";
    const rows = EXAMPLES.map(ex => {
      const out = root.FLOQRSmartVisualsResolver.resolve(ex, catalog);
      const ad = root.FLOQRSmartVisualsResolver.selectAd(out, policy);
      return {ex, out, ad};
    }).filter(row => {
      if (!want) return true;
      const tags = root.FLOQRSmartVisualsResolver.normalizeSmartViewTags(row.out.tags || []);
      return tags.includes(want);
    });
    host.innerHTML = rows.map(({ex, out, ad}) => {
      const tags = (out.tags || []).join(", ");
      return `<div class="sv-studio-example">
        <strong>${esc(ex.title)}</strong>
        <span>${esc(out.reasonCode)} · ${esc(out.backgroundId)} · ${esc(out.stencilId)} · ${esc(String(Math.round((out.confidence || 0) * 100)))}%</span>
        <span>${esc(tags)}</span>
        <span>${esc(ad.fill ? ad.reasonCode : ad.reasonCode)} · ${esc(ad.headlineKey || "empty")}${ad.placeLabel ? " · " + esc(ad.placeLabel) : ""}</span>
      </div>`;
    }).join("") || `<p class="sub small">${esc(t("sv.studioEmpty", "No assets match."))}</p>`;
  }

  function renderAds() {
    const host = byId("svStudioAdsLive");
    const policyHost = byId("svStudioAdsPolicy");
    const policy = root.FLOQRSmartVisualsResolver?.adPolicy?.() || {};
    if (policyHost) {
      policyHost.innerHTML = `<ul class="sv-studio-dl">
        <li>AdSense: ${esc(String(policy.adsenseApproved === true))} · adsEnabled: ${esc(String(policy.adsEnabled === true))}</li>
        <li>mockFill: ${esc(String(policy.mockFill === true))} · ${esc(policy.mockFillKind || "")}</li>
        <li>${esc(policy.note || "")}</li>
      </ul>`;
    }
    if (!host || !root.FLOQRSmartVisuals) return;
    host.innerHTML = "";
    EXAMPLES.slice(0, 4).forEach(ex => {
      const wrap = document.createElement("div");
      wrap.className = "sv-studio-ad-example";
      const visual = root.FLOQRSmartVisuals.resolveVisual(ex);
      wrap.innerHTML = `<h4>${esc(ex.title)}</h4>${root.FLOQRSmartVisuals.renderAdSlot(ex, visual)}`;
      host.appendChild(wrap);
    });
  }

  function svgPreviewSrc(svgXml) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(svgXml || ""))}`;
  }

  function reviewToolbarHtml(canPublish) {
    const publishLabel = t("sv.studioPublish", "Publish");
    return `<div class="sv-studio-review-toolbar">
      <p class="sub small" data-keep-visible="true">${esc(t("sv.studioSelectDraft", "Select a queued draft. Publish becomes available after you select a row. SOS2FA and a reason are required; the button stays visible."))}</p>
      <p class="button-row">
        <button type="button" class="primary sv-studio-publish" id="svStudioPublishBtn"${canPublish ? "" : " disabled"}>${esc(publishLabel)}</button>
      </p>
      <p id="svStudioReviewStatus" class="status" aria-live="polite"></p>
    </div>`;
  }

  function bindReviewRows(host) {
    host.querySelectorAll("[data-sv-draft]").forEach(node => {
      const pick = () => selectReviewDraft(node.getAttribute("data-sv-draft"));
      node.addEventListener("click", event => {
        if (event.target.closest("[data-sv-publish-draft]")) return;
        pick();
      });
      node.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        pick();
      });
    });
    host.querySelectorAll("[data-sv-publish-draft]").forEach(btn => {
      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        selectReviewDraft(btn.getAttribute("data-sv-publish-draft"));
        publishSelectedDraft();
      });
    });
    byId("svStudioPublishBtn")?.addEventListener("click", () => publishSelectedDraft());
  }

  function selectReviewDraft(id) {
    selectedDraftId = String(id || "");
    const row = reviewDrafts.find(r => r.id === selectedDraftId);
    document.querySelectorAll("[data-sv-draft]").forEach(node => {
      const on = node.getAttribute("data-sv-draft") === selectedDraftId;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
    });
    const publishBtn = byId("svStudioPublishBtn");
    const queued = row && String(row.approvalStatus || "review") !== "published";
    if (publishBtn) publishBtn.disabled = !queued;
    if (row) showDraftDetail(row);
  }

  function showDraftDetail(row) {
    const box = byId("svStudioDetail");
    if (!box || !row) return;
    const src = draftPreviewSrc(row);
    const queued = String(row.approvalStatus || "review") !== "published";
    const img = src
      ? `<img src="${esc(src)}" alt="${esc(row.name || row.id)}" class="sv-studio-preview"/>`
      : "";
    const match = assets().find(a => a.id === row.catalogAssetId) || matchCatalogAsset(row);
    box.innerHTML = `
      <h3>${esc(row.name || row.id)}</h3>
      <p class="sub small">${esc(row.id)} · ${esc(row.approvalStatus || "review")} · ${esc(row.type || "")} · ${esc(row.contentType || "")}</p>
      ${img}
      <p class="sub small">${esc(String(row.bytes || 0))} bytes${match ? ` · ${esc(match.id)}` : ""}</p>
      <p class="button-row">
        <button type="button" class="primary sv-studio-publish" id="svStudioDetailPublish"${queued ? "" : " disabled"}>${esc(t("sv.studioPublish", "Publish"))}</button>
      </p>
      <p id="svStudioDetailPublishStatus" class="status" aria-live="polite"></p>`;
    byId("svStudioDetailPublish")?.addEventListener("click", () => publishSelectedDraft());
  }

  async function publishSelectedDraft() {
    const status = byId("svStudioReviewStatus") || byId("svStudioDetailPublishStatus");
    const row = reviewDrafts.find(r => r.id === selectedDraftId);
    if (!row) {
      if (status) status.textContent = t("sv.studioPublishNeedDraft", "Select a queued draft first.");
      return;
    }
    if (String(row.approvalStatus || "") === "published") {
      if (status) status.textContent = t("sv.studioAlreadyPublished", "Already published.");
      showDraftDetail(row);
      return;
    }
    const reasonPrompt = root.FLOQRReasonPrompt;
    if (!reasonPrompt?.ask) {
      if (status) status.textContent = t("sv.studioNeedReason", "Reason prompt module missing — nothing was saved.");
      return;
    }
    if (needSos2fa(status)) return;
    const reason = await reasonPrompt.ask({
      summary: t("sv.studioApproveSummary", "SMARTvisuals: publish queued SMARTbackground"),
      minLength: 8
    });
    if (reason == null) {
      if (status) status.textContent = t("sv.cancelled", "Cancelled — nothing was saved.");
      return;
    }
    try {
      const result = await studioCallable("approveSmartVisualDraft", {draftId: row.id, reason});
      row.approvalStatus = "published";
      row.catalogAssetId = result.data?.catalogAssetId || row.catalogAssetId || "";
      const match = applyDraftToCatalog(row);
      const msg = t("sv.studioPublishedOk", "Published {id}. Asset detail shows this file.")
        .replace("{id}", result.data?.id || row.id);
      await renderReview();
      if (match) showDetail(match.id);
      const statusAfter = byId("svStudioReviewStatus");
      if (statusAfter) statusAfter.textContent = msg;
      const detailStatus = byId("svStudioDetailPublishStatus");
      if (detailStatus) detailStatus.textContent = msg;
    } catch (err) {
      if (status) status.textContent = err?.message || t("sv.studioDenied", "Publish denied.");
    }
  }

  async function overlayPublishedDrafts() {
    try {
      const snap = await firebase.firestore().collection("smartVisualDrafts").limit(40).get();
      reviewDrafts = snap.docs.map(doc => ({id: doc.id, ...(doc.data() || {})}));
      reviewDrafts.filter(row => String(row.approvalStatus || "") === "published").forEach(applyDraftToCatalog);
    } catch (_) { /* Master Admin read of drafts is optional until signed in */ }
  }

  async function renderReview() {
    const host = byId("svStudioReview");
    if (!host) return;
    const seq = ++reviewSeq;
    host.innerHTML = reviewToolbarHtml(false);
    try {
      const snap = await firebase.firestore().collection("smartVisualDrafts").limit(40).get();
      if (seq !== reviewSeq) return;
      reviewDrafts = snap.docs.map(doc => ({id: doc.id, ...(doc.data() || {})}));
      reviewDrafts.filter(row => String(row.approvalStatus || "") === "published").forEach(applyDraftToCatalog);
      if (!selectedDraftId && reviewDrafts.length === 1) selectedDraftId = reviewDrafts[0].id;
      const selected = reviewDrafts.find(r => r.id === selectedDraftId);
      const canPublish = !!(selected && String(selected.approvalStatus || "review") !== "published");
      const body = !reviewDrafts.length
        ? `<p class="sub small">${esc(t("sv.studioEmpty", "No assets match."))}</p>`
        : reviewDrafts.map(row => {
          const src = draftPreviewSrc(row);
          const type = String(row.contentType || (row.svgXml ? "image/svg+xml" : ""));
          const img = src
            ? `<img class="sv-studio-preview" src="${esc(src)}" alt="${esc(row.name || row.id)}"/>`
            : "";
          const queued = String(row.approvalStatus || "review") !== "published";
          const selectedClass = row.id === selectedDraftId ? " is-selected" : "";
          const rowPublish = queued
            ? `<button type="button" class="primary sv-studio-publish" data-sv-publish-draft="${esc(row.id)}">${esc(t("sv.studioPublish", "Publish"))}</button>`
            : `<span class="sub small">${esc(t("sv.studioAlreadyPublished", "Already published."))}</span>`;
          return `<article class="sv-studio-draft${selectedClass}" data-sv-draft="${esc(row.id)}" tabindex="0" aria-selected="${row.id === selectedDraftId ? "true" : "false"}">
          <b>${esc(row.name || row.id)}</b>
          <small>${esc(row.approvalStatus || "review")} · ${esc(String(row.bytes || 0))} bytes · ${esc(row.type || "")} · ${esc(type)}</small>
          ${img}
          <p class="sub small" data-keep-visible="true">${esc(row.license || "")}</p>
          <p class="button-row">${rowPublish}</p>
        </article>`;
        }).join("");
      host.innerHTML = reviewToolbarHtml(canPublish) + body;
      bindReviewRows(host);
      if (selected) showDraftDetail(selected);
    } catch (err) {
      if (seq !== reviewSeq) return;
      host.innerHTML = reviewToolbarHtml(false) + `<p class="status">${esc(err?.message || t("sv.studioDenied", "Publish denied."))}</p>`;
      bindReviewRows(host);
    }
  }

  function renderDiagnostics() {
    const host = byId("svStudioDiagnostics");
    if (!host) return;
    host.innerHTML = `<ul class="sv-studio-dl">
      <li>${esc(t("sv.diagRevision", "Registry revision"))}: ${esc(String(catalog?.revision || 1))}</li>
      <li>${esc(t("sv.diagGemini", "Gemini on view"))}: ${esc(String(root.FLOQRSmartVisualsResolver?.geminiAllowed?.() === true))}</li>
      <li>${esc(t("sv.diagAds", "Ads enabled"))}: AdSense ${esc(String(root.FLOQRSmartVisuals?.ADS_ENABLED === true))} · mockFill ${esc(String(root.FLOQRSmartVisualsResolver?.adPolicy?.().mockFill === true))}</li>
      <li>${esc(t("sv.diagAssets", "Published assets"))}: ${esc(String(assets().length))}</li>
    </ul>
    <p class="sub small">${esc(t("sv.diagPii", "Diagnostics never include private BOT DEE history, member profiles, or SMARTsummary."))}</p>`;
  }

  function bindCreate() {
    const form = byId("svStudioCreateForm");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const status = byId("svStudioCreateStatus");
      const file = byId("svStudioSvg")?.files?.[0];
      const name = byId("svStudioName")?.value || "";
      const assetType = byId("svStudioType")?.value || "stencil";
      const reasonPrompt = root.FLOQRReasonPrompt;
      if (!name.trim()) {
        if (status) status.textContent = t("sv.studioNeedMeta", "Name is required.");
        return;
      }
      const media = await readUpload(file, assetType);
      if (!media.ok) {
        if (status) status.textContent = t("sv.studioSvgDenied", "File rejected: {reason}").replace("{reason}", media.reason);
        return;
      }
      if (!reasonPrompt?.ask) {
        if (status) status.textContent = t("sv.studioNeedReason", "Reason prompt module missing — nothing was saved.");
        return;
      }
      if (needSos2fa(status)) return;
      const reason = await reasonPrompt.ask({
        summary: t("sv.studioPublishSummary", "SMARTvisuals: submit draft for review"),
        minLength: 8
      });
      if (reason == null) {
        if (status) status.textContent = t("sv.cancelled", "Cancelled — nothing was saved.");
        return;
      }
      try {
        const payload = {
          name,
          description: byId("svStudioDesc")?.value || "",
          type: assetType,
          tags: String(byId("svStudioTags")?.value || "").split(",").map(s => s.trim()).filter(Boolean),
          reason
        };
        if (media.svg) payload.svg = media.svg;
        if (media.imageBase64) {
          payload.imageBase64 = media.imageBase64;
          payload.contentType = media.contentType;
        }
        const result = await studioCallable("publishSmartVisualDraft", payload);
        if (status) status.textContent = t("sv.studioQueued", "Draft queued for review ({id}). Not visible to patrons.").replace("{id}", result.data?.id || "");
      } catch (err) {
        if (status) status.textContent = err?.message || t("sv.studioDenied", "Publish denied.");
      }
    });
  }

  function sniffRasterBytes(bytes) {
    if (!bytes || bytes.length < 3) return {ok: false, reason: "empty"};
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return {ok: true, contentType: "image/jpeg"};
    if (
      bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) return {ok: true, contentType: "image/png"};
    const head = String.fromCharCode(...bytes.slice(0, 4));
    const webp = bytes.length >= 12 ? String.fromCharCode(...bytes.slice(8, 12)) : "";
    if (head === "RIFF" && webp === "WEBP") return {ok: true, contentType: "image/webp"};
    return {ok: false, reason: "unsupported-type"};
  }

  function importSanitize(svg) {
    const src = String(svg || "");
    const bad = /<\s*(script|foreignObject|iframe)|on[a-z]+\s*=|https?:\/\//i.test(src);
    return {ok: !bad && /<svg[\s>]/i.test(src), reason: bad ? "forbidden-tag" : (/<svg[\s>]/i.test(src) ? "ok" : "not-svg")};
  }

  function isSvgFile(file) {
    const name = String(file?.name || "").toLowerCase();
    const mime = String(file?.type || "").toLowerCase();
    return mime.includes("svg") || name.endsWith(".svg");
  }

  async function readUpload(file, assetType) {
    if (!file) return {ok: false, reason: "empty"};
    if (isSvgFile(file)) {
      const svg = await file.text();
      const sanit = importSanitize(svg);
      return sanit.ok ? {ok: true, svg} : sanit;
    }
    if (assetType === "stencil") return {ok: false, reason: "stencil-requires-svg"};
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length > 500 * 1024) return {ok: false, reason: "too-large"};
    const sniff = sniffRasterBytes(buf);
    if (!sniff.ok) return sniff;
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
    }
    return {ok: true, imageBase64: btoa(binary), contentType: sniff.contentType};
  }

  async function load() {
    if (!catalog) {
      catalog = root.FLOQRSmartVisualsCatalog;
      if (!catalog) {
        const res = await fetch("./smartvisuals/catalog.json", {credentials: "same-origin"});
        catalog = await res.json();
        root.FLOQRSmartVisualsCatalog = catalog;
      }
    }
    bindCreate();
    await overlayPublishedDrafts();
    setPage(page);
    const search = byId("svStudioSearch");
    search?.addEventListener("input", () => {
      filter = search.value || "";
      renderLibrary();
    });
    byId("svStudioTypeFilter")?.addEventListener("change", event => {
      typeFilter = event.target.value;
      renderLibrary();
    });
    byId("svStudioTaggingFilter")?.addEventListener("input", () => {
      if (page === "tagging") renderTagging();
    });
    document.querySelectorAll("[data-sv-studio-page]").forEach(btn => {
      btn.addEventListener("click", () => setPage(btn.getAttribute("data-sv-studio-page")));
    });
    byId("svStudioOpenSearchDemo")?.addEventListener("click", () => {
      const href = root.FLOQRNav?.searchHome?.() || "./";
      const url = new URL(href, location.href);
      url.searchParams.set("start", "search");
      url.searchParams.set("smartvisualInvite", "cancun");
      window.open(url.pathname + url.search, "_blank", "noopener");
    });
  }

  root.FLOQRSmartVisualStudio = {load, setPage, studioCallable, classify: payload => studioCallable("classifySmartVisual", payload || {})};

  document.addEventListener("DOMContentLoaded", () => {
    if (byId("smartvisualStudio")) load().catch(err => console.warn("SMARTvisual Studio", err));
  });
})(typeof window !== "undefined" ? window : this);
