/* SupRstR Master-only search module — purchase live-stream slots via Stripe */
(function (global) {
  "use strict";

  const APP_V = "29.09.61";
  const SLOT_PRICE_LABEL = "$20";

  const MASTER_ADMIN_EMAILS = (global.SHOUTOUT_MASTER_ADMIN_EMAILS || global.SHOUTOUT_ADMIN_EMAILS || [])
    .map(x => String(x).toLowerCase());
  const ALLOWED_PROVIDERS = (global.SHOUTOUT_MASTER_ADMIN_ALLOWED_PROVIDERS || ["google.com", "microsoft.com"])
    .map(x => String(x).toLowerCase());
  const REQUIRE_VERIFIED = global.SHOUTOUT_MASTER_ADMIN_REQUIRE_VERIFIED_EMAIL !== false;

  const INTENTS = [
    {
      id: "purchase",
      title: `Purchase a SupRstR slot (${SLOT_PRICE_LABEL})`,
      blurb: "Buy one live-stream entitlement. Stripe Checkout → slots credited to your account.",
      keywords: ["buy", "purchase", "pay", "slot", "entitlement", "checkout", "20"],
      action: "buy"
    },
    {
      id: "live",
      title: "Live stream to a ShoutOut display",
      blurb: "Needs an unused slot. Camera/WebRTC go-live is not enabled yet.",
      keywords: ["live", "stream", "go live", "camera", "video", "display", "broadcast", "suprstr"],
      soon: true
    },
    {
      id: "lan",
      title: "Same-LAN peer-to-peer",
      blurb: "When phone and display share Wi‑Fi/LAN, prefer direct WebRTC. Off-LAN needs TURN/relay.",
      keywords: ["lan", "wifi", "p2p", "peer", "direct", "local network", "same network"],
      soon: true
    },
    {
      id: "display",
      title: "Pick a venue display",
      blurb: "Choose which club location / display board receives the SupRstR feed (after go-live ships).",
      keywords: ["display", "venue", "club", "location", "board", "led", "pick"],
      soon: true
    },
    {
      id: "security",
      title: "Security, consent & recording",
      blurb: "Signed-in buyer, Master gate (v1), camera consent, and encrypted media paths before go-live.",
      keywords: ["security", "consent", "privacy", "encrypt", "e2e", "end to end", "recording", "auth"],
      soon: true
    },
    {
      id: "master",
      title: "Back to Master Admin",
      blurb: "Return to the Network Intelligence Center.",
      keywords: ["master", "admin", "back", "portal", "network"],
      href: `./master-admin.html?v=${APP_V}&from=suprstr`
    }
  ];

  let entitlementUnsub = null;
  let slotsRemaining = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(msg) {
    const el = byId("suprstrGateStatus");
    if (el) el.textContent = msg;
  }

  function setEntitlementStatus(msg) {
    const el = byId("suprstrEntitlementStatus");
    if (el) el.textContent = msg;
  }

  function providerIds(user) {
    return (user?.providerData || []).map(p => String(p.providerId || "").toLowerCase()).filter(Boolean);
  }

  function masterCheck(user) {
    if (!user) return { ok: false, reason: "Sign in with a Master Admin account." };
    const email = String(user.email || "").toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false, reason: "Master Admin requires email-based Google or Microsoft sign-in." };
    }
    if (!MASTER_ADMIN_EMAILS.includes(email)) {
      return { ok: false, reason: `${email} is not listed in SHOUTOUT_MASTER_ADMIN_EMAILS.` };
    }
    const providers = providerIds(user);
    const providerOk = providers.some(p => ALLOWED_PROVIDERS.includes(p) || /google|microsoft|windowslive/i.test(p));
    if (!providerOk) {
      return { ok: false, reason: `Master Admin must sign in with ${ALLOWED_PROVIDERS.join(" or ")}.` };
    }
    if (REQUIRE_VERIFIED && user.emailVerified === false) {
      return { ok: false, reason: "Master Admin email must be verified by the provider." };
    }
    return { ok: true, email };
  }

  function showGate(show) {
    byId("suprstrGate")?.classList.toggle("hidden", !show);
    byId("suprstrGate")?.classList.toggle("active", show);
    byId("suprstrSearchPage")?.classList.toggle("hidden", show);
    byId("suprstrSearchPage")?.classList.toggle("active", !show);
  }

  function matchIntents(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return INTENTS.slice(0, 4);
    return INTENTS.filter(row => {
      const hay = `${row.title} ${row.blurb} ${(row.keywords || []).join(" ")}`.toLowerCase();
      return q.split(/\s+/).every(part => !part || hay.includes(part) || (row.keywords || []).some(k => k.includes(part)));
    });
  }

  function renderResults(query) {
    const root = byId("suprstrSearchResults");
    if (!root) return;
    const rows = matchIntents(query);
    if (!rows.length) {
      root.innerHTML = `<p class="sub small">No SupRstR matches. Try “purchase”, “go live”, or “LAN”.</p>`;
      return;
    }
    root.innerHTML = rows.map(row => {
      const soon = row.soon ? " is-soon" : "";
      const disabled = row.soon ? " disabled" : "";
      return `<button type="button" class="intent-result${soon}" data-intent="${row.id}"${disabled}>
        <strong>${row.title}${row.soon ? " · soon" : ""}</strong>
        <p class="sub small">${row.blurb}</p>
      </button>`;
    }).join("");
  }

  async function startPurchase() {
    if (!global.FLOQRPayments?.startCheckout) {
      setEntitlementStatus("Payment service failed to load. Refresh and try again.");
      return;
    }
    const buyBtn = byId("suprstrBuyBtn");
    if (buyBtn) buyBtn.disabled = true;
    try {
      setEntitlementStatus("Opening secure Stripe checkout for one SupRstR slot ($20)…");
      await global.FLOQRPayments.startCheckout({
        orderType: "suprstrSlot",
        payload: { slots: 1 },
        status: setEntitlementStatus,
        redirect: true
      });
    } catch (err) {
      setEntitlementStatus(err?.message || "Checkout failed.");
      if (buyBtn) buyBtn.disabled = false;
    }
  }

  function watchEntitlement(uid) {
    if (entitlementUnsub) {
      entitlementUnsub();
      entitlementUnsub = null;
    }
    if (!uid || !global.firebase?.firestore) {
      setEntitlementStatus("Sign in to see slot balance.");
      return;
    }
    const ref = firebase.firestore().collection("suprstrEntitlements").doc(uid);
    entitlementUnsub = ref.onSnapshot(snap => {
      const data = snap.exists ? snap.data() || {} : {};
      slotsRemaining = Math.max(0, Math.floor(Number(data.slotsRemaining || 0)));
      const purchased = Math.max(0, Math.floor(Number(data.slotsPurchased || 0)));
      if (!snap.exists) {
        setEntitlementStatus(`No slots yet — purchase a SupRstR live-stream slot (${SLOT_PRICE_LABEL}).`);
      } else {
        setEntitlementStatus(
          `${slotsRemaining} slot${slotsRemaining === 1 ? "" : "s"} remaining` +
          (purchased ? ` (${purchased} purchased lifetime).` : ".")
        );
      }
      const liveBtn = byId("suprstrGoLiveBtn");
      if (liveBtn) {
        liveBtn.disabled = true;
        liveBtn.title = slotsRemaining > 0
          ? "You have a slot — live video (WebRTC) is not enabled yet."
          : "Purchase a SupRstR slot before go-live.";
      }
    }, err => {
      setEntitlementStatus(err?.message || "Could not load entitlement.");
    });
  }

  function bindHelp() {
    const btn = byId("suprstrHelpBtn");
    const pop = byId("suprstrHelpPopout");
    const close = byId("suprstrHelpClose");
    function setOpen(open) {
      if (!pop || !btn) return;
      pop.classList.toggle("hidden", !open);
      pop.setAttribute("aria-hidden", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn?.addEventListener("click", () => setOpen(pop?.classList.contains("hidden")));
    close?.addEventListener("click", () => setOpen(false));
    pop?.querySelectorAll("a[data-search]")?.forEach(a => {
      a.addEventListener("click", (e) => {
        const phrase = String(a.getAttribute("data-search") || "").split("|")[0];
        const href = a.getAttribute("href") || "";
        if (phrase && href.startsWith("#")) {
          e.preventDefault();
          const input = byId("suprstrSearchInput");
          if (input) {
            input.value = phrase;
            renderResults(phrase);
          }
          setOpen(false);
        }
      });
    });
  }

  function bindSearch() {
    const input = byId("suprstrSearchInput");
    input?.addEventListener("input", () => renderResults(input.value));
    byId("suprstrSearchResults")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-intent]");
      if (!btn || btn.disabled) return;
      const id = btn.getAttribute("data-intent");
      const row = INTENTS.find(x => x.id === id);
      if (row?.action === "buy") {
        startPurchase();
        return;
      }
      if (row?.href) location.href = row.href;
    });
    byId("suprstrBuyBtn")?.addEventListener("click", () => startPurchase());
    byId("suprstrGoLiveBtn")?.addEventListener("click", () => {
      const note = byId("suprstrLiveNote");
      if (note) {
        note.textContent = slotsRemaining > 0
          ? "Slot on file — live stream UI is intentionally disabled until WebRTC + consent ship."
          : "Purchase a $20 SupRstR slot first, then go-live can unlock when streaming is ready.";
      }
    });
    renderResults("");
  }

  function bindAuth(auth) {
    byId("suprstrGoogleLoginBtn")?.addEventListener("click", async () => {
      try {
        setStatus("Opening Google…");
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        setStatus(err?.message || "Google sign-in failed.");
      }
    });
    byId("suprstrMicrosoftLoginBtn")?.addEventListener("click", async () => {
      try {
        setStatus("Opening Microsoft…");
        await auth.signInWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
      } catch (err) {
        setStatus(err?.message || "Microsoft sign-in failed.");
      }
    });
    byId("suprstrLogoutBtn")?.addEventListener("click", () => auth.signOut());

    auth.onAuthStateChanged(user => {
      const check = masterCheck(user);
      if (!check.ok) {
        showGate(true);
        setStatus(user ? `Access denied: ${check.reason}` : "Sign in as Master Admin to open SupRstR.");
        watchEntitlement(null);
        return;
      }
      setStatus(`Signed in as ${check.email}`);
      showGate(false);
      watchEntitlement(user.uid);
    });
  }

  function boot() {
    global.FLOQRNav?.applyGlobalBack("floqrGlobalBack");
    if (!global.firebase?.apps?.length) {
      if (global.firebaseConfig) firebase.initializeApp(global.firebaseConfig);
    }
    if (!global.firebase?.auth) {
      setStatus("Firebase Auth failed to load.");
      return;
    }
    bindHelp();
    bindSearch();
    bindAuth(firebase.auth());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
