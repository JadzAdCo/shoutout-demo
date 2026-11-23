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
  let selectedId = "";
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
    const rows = assets().filter(a => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (!q) return true;
      const hay = [a.id, a.name, a.category, ...(a.tags || []), ...(a.aliases || [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
    host.innerHTML = rows.map(a => `
      <button type="button" class="sv-studio-card" data-sv-asset="${esc(a.id)}">
        <img src="./${esc(a.path)}" alt="${esc(a.name)}"/>
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

  function showDetail(id) {
    const asset = assets().find(a => a.id === id);
    const box = byId("svStudioDetail");
    if (!box || !asset) return;
    box.innerHTML = `
      <h3 data-floqr-help-id="help-smartvisuals-create"
        data-floqr-help-title="Create / Edit SMARTvisuals"
        data-floqr-help-search="milan preview|smartbackground preview|art upload|create edit"
        data-floqr-help-body="Create or edit a SMARTstencil or SMARTbackground draft. Name is required. SMARTstencils must be SVG. SMARTbackgrounds accept SVG, JPEG, PNG, or WebP. Files are sanitized on the server. Drafts stay off patrons until an audited publish. Scenic art is FLOQR illustration, not photography and not an official destination or Fashion Week mark.">${esc(asset.name)}</h3>
      <p class="sub small">${esc(asset.id)} · rev ${esc(String(catalog.revision || 1))} · ${esc(asset.approvalStatus)}</p>
      <img src="./${esc(asset.path)}" alt="${esc(asset.name)}" class="sv-studio-preview"/>
      <p>${esc((asset.tags || []).join(", "))}</p>
      <p class="sub small" data-keep-visible="true">${esc(t("sv.licenseNote", "Original FLOQR illustration. Not a photograph or official mark."))}</p>
      <p class="sub small">${esc(t("sv.studioPlaceHint", "Place SMARTview cards use a published SMARTbackground, not an empty photo well. SOS2FA and a reason are required to save."))}</p>
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
      </p>
      <p class="button-row">
        <button type="button" class="buttonlike" data-sv-preview="notify">${esc(t("sv.previewNotify", "Preview in Search SMARTnotification"))}</button>
        <button type="button" class="buttonlike" data-sv-preview="room">${esc(t("sv.previewRoom", "Preview in Room SMARTview"))}</button>
        <button type="button" class="buttonlike" data-sv-preview="place">${esc(t("sv.previewPlace", "Preview in Place SMARTview"))}</button>
        ${asset.type === "background" ? `<button type="button" class="buttonlike primary" data-sv-assign-place="1">${esc(t("sv.assignPlaceBg", "Use as Place SMARTview background"))}</button>` : ""}
      </p>
      <p id="svStudioPlaceStatus" class="status" aria-live="polite"></p>`;
    box.querySelectorAll("[data-sv-preview]").forEach(btn => {
      btn.addEventListener("click", () => previewSurface(btn.getAttribute("data-sv-preview"), asset));
    });
    box.querySelector("[data-sv-assign-place]")?.addEventListener("click", () => assignPlaceBackground(asset));
    try { root.FLOQRHelpAttach?.mountAll?.(box); } catch (_) { /* optional */ }
  }

  function previewSurface(kind, asset) {
    const host = byId("svStudioLivePreview");
    if (!host) return;
    host.hidden = false;
    if (kind === "place") {
      previewPlaceCard(asset, host);
      return;
    }
    const payload = Object.assign(root.FLOQRSmartVisuals?.syntheticCancun?.() || {title: "Cancun Trip", demo: true}, {
      override: {backgroundId: asset.type === "background" ? asset.id : "bg-bali", stencilId: asset.type === "stencil" ? asset.id : "st-flight", authorized: true}
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
    const kind = byId("svStudioPlaceKind")?.value || "venue";
    const backgroundId = asset.type === "background" ? asset.id : "";
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
      floqrPublicData: {city: "Washington, DC", smartBackgroundId: backgroundId}
    });
    host.innerHTML = `<div class="sv-studio-place-preview">${html}</div>`;
    try { root.FLOQRChromeScheme?.applyDocument?.(); } catch (_) { /* ignore */ }
  }

  async function assignPlaceBackground(asset) {
    const status = byId("svStudioPlaceStatus");
    if (!asset || asset.type !== "background") {
      if (status) status.textContent = t("sv.studioDenied", "Publish denied.");
      return;
    }
    const reasonPrompt = root.FLOQRReasonPrompt;
    if (!reasonPrompt?.ask) {
      if (status) status.textContent = t("sv.studioNeedReason", "Reason prompt module missing — nothing was saved.");
      return;
    }
    if (needSos2fa(status)) return;
    const kind = byId("svStudioPlaceKind")?.value || "venue";
    const reason = await reasonPrompt.ask({
      summary: t("sv.studioPlaceSummary", "SMARTvisuals: set Place SMARTview background"),
      minLength: 8
    });
    if (reason == null) {
      if (status) status.textContent = t("sv.cancelled", "Cancelled — nothing was saved.");
      return;
    }
    try {
      const stencilId = asset.pairedStencilId
        ? (String(asset.pairedStencilId).startsWith("st-") ? asset.pairedStencilId : `st-${asset.pairedStencilId}`)
        : "st-location";
      const result = await studioCallable("setSmartVisualOverride", {
        roomKey: `placeSmartView:${kind}`,
        backgroundId: asset.id,
        stencilId,
        reason
      });
      if (status) status.textContent = t("sv.placeBgSaved", "Place SMARTview background saved.")
        + ` (${result.data?.backgroundId || asset.id})`;
      previewPlaceCard(asset, byId("svStudioLivePreview") || document.createElement("div"));
    } catch (err) {
      if (status) status.textContent = err?.message || t("sv.studioDenied", "Publish denied.");
    }
  }

  function renderTagging() {
    const host = byId("svStudioExamples");
    if (!host || !root.FLOQRSmartVisualsResolver) return;
    const policy = root.FLOQRSmartVisualsResolver.adPolicy();
    host.innerHTML = EXAMPLES.map(ex => {
      const out = root.FLOQRSmartVisualsResolver.resolve(ex, catalog);
      const ad = root.FLOQRSmartVisualsResolver.selectAd(out, policy);
      return `<div class="sv-studio-example">
        <strong>${esc(ex.title)}</strong>
        <span>${esc(out.reasonCode)} · ${esc(out.backgroundId)} · ${esc(out.stencilId)} · ${esc(String(Math.round((out.confidence || 0) * 100)))}%</span>
        <span>${esc(ad.fill ? ad.reasonCode : ad.reasonCode)} · ${esc(ad.headlineKey || "empty")}${ad.placeLabel ? " · " + esc(ad.placeLabel) : ""}</span>
      </div>`;
    }).join("");
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

  async function renderReview() {
    const host = byId("svStudioReview");
    if (!host) return;
    const seq = ++reviewSeq;
    const hint = `<p class="sub small">${esc(t("sv.studioReviewHint", "Git-backed registry.json is the published source of truth. SOS2FA + reason required. Drafts stay off Search and Room SMARTview."))}</p>`;
    host.innerHTML = hint;
    try {
      const snap = await firebase.firestore().collection("smartVisualDrafts").limit(40).get();
      if (seq !== reviewSeq) return;
      const rows = snap.docs.map(doc => ({id: doc.id, ...(doc.data() || {})}));
      const body = !rows.length
        ? `<p class="sub small">${esc(t("sv.studioEmpty", "No assets match."))}</p>`
        : rows.map(row => {
          const svg = String(row.svgXml || "");
          const raster = String(row.imageBase64 || "");
          const type = String(row.contentType || (svg ? "image/svg+xml" : ""));
          const src = svg
            ? svgPreviewSrc(svg)
            : (raster ? `data:${esc(type || "image/jpeg")};base64,${raster.replace(/[^A-Za-z0-9+/=]/g, "")}` : "");
          const img = src
            ? `<img class="sv-studio-preview" src="${esc(src)}" alt="${esc(row.name || row.id)}"/>`
            : "";
          return `<article class="sv-studio-draft" data-sv-draft="${esc(row.id)}">
          <b>${esc(row.name || row.id)}</b>
          <small>${esc(row.approvalStatus || "review")} · ${esc(String(row.bytes || 0))} bytes · ${esc(row.type || "")} · ${esc(type)}</small>
          ${img}
          <p class="sub small" data-keep-visible="true">${esc(row.license || "")}</p>
        </article>`;
        }).join("");
      host.innerHTML = hint + body;
    } catch (err) {
      if (seq !== reviewSeq) return;
      host.innerHTML = hint + `<p class="status">${esc(err?.message || t("sv.studioDenied", "Publish denied."))}</p>`;
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
