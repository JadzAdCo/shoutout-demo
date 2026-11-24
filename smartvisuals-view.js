/* SMARTvisuals renderer — Search SMARTnotification + Room SMARTview.
   Scenic art via <img>. Stencils via <img> (currentColor not inherited on img — CSS filter).
   Ads: labeled mock fill from authorized tags via getSmartVisualAdPolicy / resolver.selectAd.
   AdSense is never loaded. */
(function (root) {
  "use strict";
  if (root.FLOQRSmartVisuals) return;

  const t = (key, fallback, vars) => {
    try {
      const out = root.FLOQRI18n?.t?.(key, vars);
      if (out && out !== key) return out;
    } catch (_) {}
    let text = fallback;
    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach(name => {
        text = String(text).replace(new RegExp("\\{" + name + "\\}", "g"), String(vars[name]));
      });
    }
    return text;
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  const DEMO_QUERY = "smartvisualInvite";
  const ADS_ENABLED = false;

  function resolver() {
    return root.FLOQRSmartVisualsResolver;
  }

  function catalog() {
    return root.FLOQRSmartVisualsCatalog || resolver()?.loadCatalog?.();
  }

  function ensureCatalog() {
    if (root.FLOQRSmartVisualsCatalog) return Promise.resolve(root.FLOQRSmartVisualsCatalog);
    return fetch("./smartvisuals/catalog.json", {credentials: "same-origin"})
      .then(res => {
        if (!res.ok) throw new Error("catalog");
        return res.json();
      })
      .then(data => {
        root.FLOQRSmartVisualsCatalog = data;
        return data;
      })
      .catch(() => null);
  }

  function syntheticCancun() {
    return {
      demo: true,
      sourceKind: "authorized-room",
      title: "Cancun Trip",
      description: t("sv.cancunBlurb", "Let's plan our Cancun trip together with BOT-DEE."),
      hostName: "Damon",
      hostInitials: "D",
      inviteeLine: t("sv.invitedYou", "{name} invited you to join a Mingl Room.").replace("{name}", "Damon"),
      scheduledLabel: t("sv.todayTime", "Today, 7:00 PM ET"),
      participantCount: 5,
      liveInRoom: true,
      capabilities: ["itinerary", "reservations", "tickets", "friends", "services"],
      participants: [
        {name: "Damon", initials: "D", status: "accepted", you: false},
        {name: t("sv.you", "You"), initials: "Y", status: "live", you: true},
        {name: "Lisa K.", initials: "LK", status: "accepted"},
        {name: "Mike T.", initials: "MT", status: "pending"},
        {name: "Sarah J.", initials: "SJ", status: "declined"}
      ]
    };
  }

  function statusLabel(status) {
    const map = {
      accepted: t("sv.statusAccepted", "Accepted"),
      live: t("sv.statusLive", "Live"),
      pending: t("sv.statusPending", "Pending"),
      declined: t("sv.statusDeclined", "Declined")
    };
    return map[status] || status;
  }

  function resolveVisual(payload) {
    const r = resolver();
    if (!r) {
      return {
        backgroundUrl: "./smartvisuals/backgrounds/mingl-room.svg",
        stencilUrl: "./smartvisuals/stencils/people.svg",
        backgroundId: "bg-mingl-room",
        stencilId: "st-people",
        tags: [],
        reasonCode: "resolver-missing",
        modelCalls: 0
      };
    }
    const selection = r.resolve({
      title: payload.title,
      description: payload.description,
      sourceKind: payload.sourceKind || "authorized-room",
      override: payload.override
    }, catalog());
    const urls = r.urlsFor(selection, catalog());
    const bust = url => {
      if (!url || /[?&]v=/.test(url)) return url;
      return `${url}${url.includes("?") ? "&" : "?"}v=s3.3.072`;
    };
    urls.backgroundUrl = bust(urls.backgroundUrl);
    urls.stencilUrl = bust(urls.stencilUrl);
    return {...selection, ...urls};
  }

  function pillHtml(visual) {
    const tags = Array.isArray(visual.tags) ? visual.tags : [];
    const show = [];
    if (visual.category === "travel" || tags.includes("travel")) {
      show.push({label: t("sv.tagTravel", "Travel"), icon: visual.stencilUrl});
    }
    if (visual.category === "fashion" || tags.includes("fashion")) {
      show.push({label: t("sv.tagFashion", "Fashion"), icon: "./smartvisuals/stencils/fashion.svg"});
    }
    if (tags.includes("planning") || visual.category === "travel") {
      show.push({label: t("sv.tagPlanning", "Planning"), icon: "./smartvisuals/stencils/calendar.svg"});
    }
    if (tags.includes("reservation") || tags.includes("reservations")) {
      show.push({label: t("sv.tagReservations", "Reservations"), icon: "./smartvisuals/stencils/reservation.svg"});
    }
    if (!show.length) {
      show.push({label: t("sv.tagRoom", "Mingl Room"), icon: "./smartvisuals/stencils/people.svg"});
    }
    return show.slice(0, 3).map(row => (
      `<span class="sv-pill"><img src="${esc(row.icon)}" alt=""/>${esc(row.label)}</span>`
    )).join("");
  }

  function peopleHtml(payload) {
    const people = Array.isArray(payload.participants) ? payload.participants : [];
    if (!people.length) {
      return `<p class="sv-blurb">${esc(t("sv.noParticipants", "Participant names appear only for room members."))}</p>`;
    }
    return `<div class="sv-people">${people.map(p => `
      <div class="sv-person" data-status="${esc(p.status || "pending")}">
        <div class="sv-avatar" aria-hidden="true">${p.photoUrl ? `<img src="${esc(p.photoUrl)}" alt=""/>` : esc(p.initials || "?")}</div>
        <span>${esc(p.name || "")}</span>
        <span class="sv-status">${esc(statusLabel(p.status))}</span>
      </div>`).join("")}</div>`;
  }

  function capabilityHtml() {
    const chips = [
      {id: "itinerary", label: t("sv.capItinerary", "Plan Itinerary"), icon: "calendar"},
      {id: "reservations", label: t("sv.capReservations", "Make Reservations"), icon: "reservation"},
      {id: "tickets", label: t("sv.capTickets", "Get Tickets"), icon: "ticket"},
      {id: "friends", label: t("sv.capFriends", "Coordinate with Friends"), icon: "people"},
      {id: "services", label: t("sv.capServices", "Execute More Services"), icon: "route"}
    ];
    return `<div class="sv-chips">${chips.map(c => `
      <button type="button" class="sv-chip" data-sv-cap="${esc(c.id)}" disabled>
        <img src="./smartvisuals/stencils/${esc(c.icon)}.svg" alt=""/>
        ${esc(c.label)}
      </button>`).join("")}</div>`;
  }

  function packagedAdPolicy() {
    return resolver()?.adPolicy?.() || {
      adsEnabled: false,
      adsenseApproved: false,
      mockFill: true,
      emptyWhen: ["private-source-denied", "prompt-injection-ignored", "private-chat", "privateChat"]
    };
  }

  function selectAdFor(visual, payload) {
    const r = resolver();
    const policy = (payload && payload.adPolicy) || packagedAdPolicy();
    if (!r || typeof r.selectAd !== "function") {
      return {fill: false, reasonCode: "ad-resolver-missing", mock: true, liveInventory: false, advertiser: null};
    }
    return r.selectAd(visual || {}, policy);
  }

  function adSlotHtml(payload, visual, opts) {
    if (payload && payload.hideAd === true) return "";
    const ad = selectAdFor(visual, payload);
    const compact = opts && opts.compact === true;
    if (!ad || ad.fill !== true) {
      return `<aside class="sv-ad is-empty" data-sv-ad data-sv-ad-reason="${esc(ad && ad.reasonCode || "ad-policy-empty")}" hidden>
        <span class="sv-ad-label">${esc(t("sv.adLabel", "Ad"))}</span>
      </aside>`;
    }
    const urls = resolver()?.urlsFor?.({
      backgroundId: ad.backgroundId || (visual && visual.backgroundId),
      stencilId: ad.stencilId || (visual && visual.stencilId)
    }, catalog()) || {};
    const kicker = t(ad.kickerKey, ad.category === "travel" ? t("sv.adTravelPartner", "Travel partner") : "Mingl Room");
    const headline = t(ad.headlineKey, ad.placeLabel ? `Fly to ${ad.placeLabel}` : "Plan together", ad.headlineVars);
    const sub = t(ad.subKey, "Exclusive Mingl Room Deals");
    const disclaimer = t(ad.disclaimerKey, "Sample placement — not a live offer or booked inventory.");
    const thumb = urls.backgroundUrl || (visual && visual.backgroundUrl) || "./smartvisuals/backgrounds/mingl-room.svg";
    const stencil = urls.stencilUrl || "./smartvisuals/stencils/people.svg";
    return `<aside class="sv-ad${compact ? " is-compact" : ""}" data-sv-ad data-sv-ad-reason="${esc(ad.reasonCode || "")}" data-sv-ad-cat="${esc(ad.category || "")}" aria-label="${esc(t("sv.adLabel", "Ad"))}">
      <span class="sv-ad-label">${esc(t("sv.adLabel", "Ad"))}</span>
      <div class="sv-ad-art" aria-hidden="true">
        <img class="sv-ad-bg" src="${esc(thumb)}" alt=""/>
        <img class="sv-ad-stencil" src="${esc(stencil)}" alt=""/>
      </div>
      <div class="sv-ad-body">
        <span class="sv-ad-kicker">${esc(kicker)}</span>
        <strong class="sv-ad-headline">${esc(headline)}</strong>
        <span class="sv-ad-sub">${esc(sub)}</span>
        <small class="sv-ad-disclaimer">${esc(disclaimer)}</small>
      </div>
    </aside>`;
  }

  function renderNotification(payload) {
    const visual = resolveVisual(payload);
    const count = Number(payload.participantCount) || (payload.participants || []).length || 0;
    /* Compact Search card matches the original phone SMARTnotification:
       header, thumbnail + title/blurb, time/participants, View Invitation / Not Now.
       No labeled Ad on this compact card (Room overlay keeps it). Damon is demo-only. */
    return `<article class="sv-notify" data-sv="notification" data-reason="${esc(visual.reasonCode || "")}" data-bg="${esc(visual.backgroundId || "")}">
      <div class="sv-notify-head">
        <div class="sv-kicker">
          <span class="sv-people-mark" aria-hidden="true">
            <img class="sv-icon" src="./smartvisuals/stencils/people.svg" alt=""/>
          </span>
          <div>
            <div class="sv-kicker-title">${esc(t("sv.notifyTitle", "Mingl Room Invitation"))}</div>
            <span class="sv-kicker-sub">${esc(payload.inviteeLine || t("sv.youAreInvited", "You are invited to join a Mingl Room."))}</span>
          </div>
        </div>
        <button type="button" class="sv-close" data-sv-dismiss aria-label="${esc(t("sv.dismiss", "Close"))}">×</button>
      </div>
      ${payload.demo ? `<p class="sv-demo-flag sv-demo-flag-compact">${esc(t("sv.demoFlag", "Demo / synthetic — not a live invitation"))}</p>` : ""}
      <div class="sv-notify-body">
        <div class="sv-hero">
          <img class="sv-bg" src="${esc(visual.backgroundUrl)}" alt="${esc(t("sv.scenicAlt", "Scenic illustration for this room. Not a photograph."))}"/>
          <div class="sv-hero-scrim" aria-hidden="true"></div>
          <div class="sv-hero-copy">
            <div class="sv-pills">${pillHtml(visual)}</div>
            <h2 class="sv-title">${esc(payload.title || t("sv.untitled", "Mingl Room"))}</h2>
          </div>
        </div>
        <div class="sv-notify-copy">
          <p class="sv-blurb">${esc(payload.description || "")}</p>
        </div>
      </div>
      <div class="sv-meta">
        <span class="sv-meta-item"><img src="./smartvisuals/stencils/calendar.svg" alt=""/><b>${esc(payload.scheduledLabel || t("sv.unscheduled", "Time to be confirmed"))}</b></span>
        <span class="sv-meta-item"><img src="./smartvisuals/stencils/people.svg" alt=""/><b>${esc(String(count))} ${esc(t("sv.participants", "Participants"))}</b></span>
      </div>
      <div class="sv-actions">
        <button type="button" class="sv-btn sv-btn-primary" data-sv-view>${esc(t("sv.viewInvitation", "View Invitation"))} →</button>
        <button type="button" class="sv-btn sv-btn-ghost" data-sv-later>${esc(t("sv.notNow", "Not Now"))}</button>
      </div>
    </article>`;
  }

  function renderRoom(payload) {
    const visual = resolveVisual(payload);
    const host = payload.hostName || t("sv.host", "Host");
    const count = Number(payload.participantCount) || (payload.participants || []).length || 0;
    return `<article class="sv-room" data-sv="room" data-reason="${esc(visual.reasonCode || "")}">
      <div class="sv-room-head">
        <div class="sv-kicker">
          <img class="sv-icon" src="./smartvisuals/stencils/people.svg" alt=""/>
          <div>
            <div class="sv-kicker-title">${esc(t("sv.roomTitle", "Mingl Room Invitation"))}</div>
            <span class="sv-kicker-sub">${esc(t("sv.youAreInvited", "You are invited to join a Mingl Room."))}</span>
          </div>
        </div>
        <button type="button" class="sv-close" data-sv-dismiss aria-label="${esc(t("sv.dismiss", "Close"))}">×</button>
      </div>
      ${payload.demo ? `<p class="sv-demo-flag">${esc(t("sv.demoFlag", "Demo / synthetic — not a live invitation"))}</p>` : ""}
      <div class="sv-hero">
        <img class="sv-bg" src="${esc(visual.backgroundUrl)}" alt="${esc(t("sv.scenicAlt", "Scenic illustration for this room. Not a photograph."))}"/>
        <img class="sv-stencil" src="${esc(visual.stencilUrl)}" alt=""/>
        <div class="sv-hero-scrim" aria-hidden="true"></div>
        <div class="sv-hero-copy">
          <div class="sv-pills">${pillHtml(visual)}
            <span class="sv-pill"><img src="./smartvisuals/stencils/calendar.svg" alt=""/>${esc(t("sv.scheduled", "Scheduled"))}</span>
          </div>
          <h2 class="sv-title">${esc(payload.title || t("sv.untitled", "Mingl Room"))}</h2>
          <p class="sv-blurb">${esc([t("sv.tagPlanning", "Planning"), t("sv.tagReservations", "Reservations"), t("sv.tagItinerary", "Itinerary")].join(" · "))}</p>
        </div>
      </div>
      <div class="sv-room-invitee">
        <div class="sv-avatar">${esc(payload.hostInitials || host.slice(0, 1))}</div>
        <div class="sv-invitee-copy">
          <b>${esc(host)} ${esc(t("sv.isInviting", "is inviting you to a Mingl Room."))}</b>
          <span>${esc(payload.description || "")}</span>
        </div>
      </div>
      <div class="sv-part-head">
        <h3>${esc(t("sv.participants", "Participants"))} (${esc(String(count))})</h3>
        ${payload.liveInRoom ? `<span class="sv-live">${esc(t("sv.liveInRoom", "Live in Room"))}</span>` : ""}
        <button type="button" class="sv-btn sv-btn-ghost" data-sv-invite disabled>${esc(t("sv.invite", "Invite"))}</button>
      </div>
      ${peopleHtml(payload)}
      <section class="sv-botdee">
        <div class="sv-botdee-head">
          <img src="./smartvisuals/stencils/ai.svg" width="22" height="22" alt=""/>
          ${esc(t("sv.botdeePrompt", "Use Mingl chat to work with BOT DEE to:"))}
        </div>
        ${capabilityHtml()}
      </section>
      <div class="sv-join-row">
        <button type="button" class="sv-btn sv-btn-primary" data-sv-join>${esc(t("sv.joinNow", "Join Now"))}</button>
        <span class="sv-join-or">${esc(t("sv.or", "or"))}</span>
        <span class="sv-scheduled">📅 ${esc(t("sv.joinScheduled", "Join at Scheduled Time"))}<br>${esc(payload.scheduledLabel || "")}</span>
      </div>
      ${adSlotHtml(payload, visual)}
    </article>`;
  }

  function bindCard(rootEl, payload, handlers) {
    if (!rootEl) return;
    const h = handlers || {};
    rootEl.querySelector("[data-sv-dismiss]")?.addEventListener("click", () => h.onDismiss?.(payload));
    rootEl.querySelector("[data-sv-later]")?.addEventListener("click", () => h.onDismiss?.(payload));
    rootEl.querySelector("[data-sv-view]")?.addEventListener("click", () => h.onView?.(payload));
    rootEl.querySelector("[data-sv-join]")?.addEventListener("click", () => h.onJoin?.(payload));
  }

  function mountNotification(host, payload, handlers) {
    if (!host) return null;
    host.innerHTML = renderNotification(payload);
    bindCard(host, payload, handlers);
    host.hidden = false;
    return host.querySelector(".sv-notify");
  }

  function mountRoom(host, payload, handlers) {
    if (!host) return null;
    host.innerHTML = renderRoom(payload);
    host.hidden = false;
    bindCard(host, payload, handlers);
    return host.querySelector(".sv-room");
  }

  function dismissKey() {
    try { return sessionStorage.getItem("floqr.smartvisual.notifyDismissed") === "1"; }
    catch (_) { return false; }
  }

  function rememberDismiss() {
    try { sessionStorage.setItem("floqr.smartvisual.notifyDismissed", "1"); }
    catch (_) {}
  }

  function requestedDemo() {
    try {
      const q = new URLSearchParams(location.search);
      const hash = String(location.hash || "").replace(/^#/, "");
      const val = String(q.get(DEMO_QUERY) || q.get("smartvisual") || "").toLowerCase();
      if (val === "cancun" || val === "1" || hash === "smartvisual-cancun") return "cancun";
      if (sessionStorage.getItem("floqr.smartvisual.preview") === "cancun") return "cancun";
    } catch (_) {}
    return "";
  }

  function openRoomOverlay(payload) {
    let overlay = document.getElementById("smartvisualRoomHost");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "smartvisualRoomHost";
      overlay.className = "sv-room-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("sv.roomTitle", "Mingl Room Invitation"));
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    mountRoom(overlay, payload, {
      onDismiss() { overlay.hidden = true; overlay.innerHTML = ""; },
      onJoin() {
        overlay.hidden = true;
        overlay.innerHTML = "";
        const room = payload && payload.roomId ? String(payload.roomId) : "";
        const token = payload && payload.token ? String(payload.token) : "";
        const explicit = payload && payload.joinHref ? String(payload.joinHref) : "";
        let href = explicit;
        if (!href && room) {
          href = root.FLOQRNav?.pageUrl?.("./botdee.html", token ? {room, t: token} : {room})
            || `./botdee.html?room=${encodeURIComponent(room)}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
        }
        if (!href) {
          href = root.FLOQRNav?.pageUrl?.("./botdee.html", {from: "smartvisual"}) || "./botdee.html?from=smartvisual";
        }
        if (/mingl-chat\.html/i.test(href)) {
          href = root.FLOQRNav?.pageUrl?.("./botdee.html", {from: "smartvisual"}) || "./botdee.html?from=smartvisual";
        }
        location.href = href;
      }
    });
  }

  function notificationHandlers(host, payload) {
    return {
      onDismiss() {
        rememberDismiss();
        host.hidden = true;
        host.innerHTML = "";
      },
      onView() { openRoomOverlay(payload); }
    };
  }

  function mountLiveNotifications(host) {
    if (!host || requestedDemo() || dismissKey()) return;
    const auth = root.firebase?.auth?.();
    if (!auth) return;
    const run = user => {
      if (!user) return;
      const gated = root.FLOQRFeatureServices;
      const show = !gated || gated.canAccess?.("botDee") || gated.canAccess?.("mingl");
      if (gated && gated.canAccess && !gated.canAccess("botDee")) return;
      if (!show) return;
      let fns;
      try { fns = root.firebase.functions(); } catch (_) { return; }
      const call = fns?.httpsCallable?.("listBotDeeRoomNotifications");
      if (!call) return;
      call({}).then(res => {
        const rows = Array.isArray(res?.data?.notifications) ? res.data.notifications : [];
        const payload = rows[0];
        if (!payload || payload.demo === true) return;
        if (dismissKey()) return;
        ensureCatalog().then(() => {
          mountNotification(host, payload, notificationHandlers(host, payload));
        });
      }).catch(() => {});
    };
    if (auth.currentUser) run(auth.currentUser);
    else {
      const unsub = auth.onAuthStateChanged(user => {
        if (typeof unsub === "function") unsub();
        run(user);
      });
    }
  }

  function bootSearch() {
    const host = document.getElementById("smartvisualNotificationHost");
    if (!host) return;
    const demo = requestedDemo();
    if (demo && !dismissKey()) {
      ensureCatalog().then(() => {
        const payload = syntheticCancun();
        mountNotification(host, payload, notificationHandlers(host, payload));
      });
      return;
    }
    mountLiveNotifications(host);
  }

  root.FLOQRSmartVisuals = {
    DEMO_QUERY,
    ADS_ENABLED,
    ensureCatalog,
    syntheticCancun,
    resolveVisual,
    selectAdFor,
    packagedAdPolicy,
    adSlotHtml,
    renderAdSlot: adSlotHtml,
    renderNotification,
    renderRoom,
    mountNotification,
    mountRoom,
    openRoomOverlay,
    bootSearch
  };

  /* Catalog is required on BOT DEE Room SMARTview as well as Search.
     Fetch immediately — do not wait for #smartvisualNotificationHost. */
  ensureCatalog();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootSearch);
  } else {
    bootSearch();
  }
})(typeof window !== "undefined" ? window : this);
