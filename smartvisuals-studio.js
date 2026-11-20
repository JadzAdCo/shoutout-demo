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
      <h3>${esc(asset.name)}</h3>
      <p class="sub small">${esc(asset.id)} · rev ${esc(String(catalog.revision || 1))} · ${esc(asset.approvalStatus)}</p>
      <img src="./${esc(asset.path)}" alt="${esc(asset.name)}" class="sv-studio-preview"/>
      <p>${esc((asset.tags || []).join(", "))}</p>
      <p class="sub small">${esc(t("sv.licenseNote", "Original FLOQR illustration. Not a photograph or official mark."))}</p>
      <p class="button-row">
        <button type="button" class="buttonlike" data-sv-preview="notify">${esc(t("sv.previewNotify", "Preview in Search SMARTnotification"))}</button>
        <button type="button" class="buttonlike" data-sv-preview="room">${esc(t("sv.previewRoom", "Preview in Room SMARTview"))}</button>
      </p>`;
    box.querySelectorAll("[data-sv-preview]").forEach(btn => {
      btn.addEventListener("click", () => previewSurface(btn.getAttribute("data-sv-preview"), asset));
    });
  }

  function previewSurface(kind, asset) {
    const payload = Object.assign(root.FLOQRSmartVisuals?.syntheticCancun?.() || {title: "Cancun Trip", demo: true}, {
      override: {backgroundId: asset.type === "background" ? asset.id : "bg-bali", stencilId: asset.type === "stencil" ? asset.id : "st-flight", authorized: true}
    });
    const host = byId("svStudioLivePreview");
    if (!host || !root.FLOQRSmartVisuals) return;
    host.hidden = false;
    if (kind === "notify") root.FLOQRSmartVisuals.mountNotification(host, payload, {onView() { root.FLOQRSmartVisuals.mountRoom(host, payload, {}); }});
    else root.FLOQRSmartVisuals.mountRoom(host, payload, {});
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
          const img = svg
            ? `<img class="sv-studio-preview" src="${esc(svgPreviewSrc(svg))}" alt="${esc(row.name || row.id)}"/>`
            : "";
          return `<article class="sv-studio-draft" data-sv-draft="${esc(row.id)}">
          <b>${esc(row.name || row.id)}</b>
          <small>${esc(row.approvalStatus || "review")} · ${esc(String(row.bytes || 0))} bytes · ${esc(row.type || "")}</small>
          ${img}
          <p class="sub small">${esc(row.license || "")}</p>
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
      const license = byId("svStudioLicense")?.value || "";
      const reasonPrompt = root.FLOQRReasonPrompt;
      if (!name.trim() || !license.trim()) {
        if (status) status.textContent = t("sv.studioNeedMeta", "Name and license are required.");
        return;
      }
      let svg = "";
      if (file) svg = await file.text();
      const sanit = svg ? (await importSanitize(svg)) : {ok: false, reason: "empty"};
      if (svg && !sanit.ok) {
        if (status) status.textContent = t("sv.studioSvgDenied", "SVG rejected: {reason}").replace("{reason}", sanit.reason);
        return;
      }
      if (!reasonPrompt?.ask) {
        if (status) status.textContent = t("sv.studioNeedReason", "Reason prompt module missing — nothing was saved.");
        return;
      }
      const reason = await reasonPrompt.ask({
        summary: t("sv.studioPublishSummary", "SMARTvisuals: submit draft for review"),
        minLength: 8
      });
      if (reason == null) {
        if (status) status.textContent = t("sv.cancelled", "Cancelled — nothing was saved.");
        return;
      }
      try {
        const callable = firebase.app().functions("us-central1").httpsCallable("publishSmartVisualDraft");
        const sos = root.FLOQRSOS2FA?.sessionId?.();
        const result = await callable({
          name,
          license,
          description: byId("svStudioDesc")?.value || "",
          type: byId("svStudioType")?.value || "stencil",
          tags: String(byId("svStudioTags")?.value || "").split(",").map(s => s.trim()).filter(Boolean),
          svg,
          reason,
          sos2faSessionId: sos,
          clientKind: "agent"
        });
        if (status) status.textContent = t("sv.studioQueued", "Draft queued for review ({id}). Not visible to patrons.").replace("{id}", result.data?.id || "");
      } catch (err) {
        if (status) status.textContent = err?.message || t("sv.studioDenied", "Publish denied.");
      }
    });
  }

  function importSanitize(svg) {
    const src = String(svg || "");
    const bad = /<\s*(script|foreignObject|iframe)|on[a-z]+\s*=|https?:\/\//i.test(src);
    return {ok: !bad && /<svg[\s>]/i.test(src), reason: bad ? "forbidden-tag" : (/<svg[\s>]/i.test(src) ? "ok" : "not-svg")};
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

  root.FLOQRSmartVisualStudio = {load, setPage};

  document.addEventListener("DOMContentLoaded", () => {
    if (byId("smartvisualStudio")) load().catch(err => console.warn("SMARTvisual Studio", err));
  });
})(typeof window !== "undefined" ? window : this);
