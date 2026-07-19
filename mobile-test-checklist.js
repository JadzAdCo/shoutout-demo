/* FLOQR iPhone mobile test checklist — submit results via Cloud Function + optional Firestore. */
(function () {
  "use strict";

  const BASE = "https://jadzadco.github.io/shoutout-demo";
  const V_PORTAL = "29.09.19";
  const V_ADMIN = "29.09.18";
  const V_COMMERCE = "29.09.14";
  const V_MINGL = "29.09.17";
  const V_GIST = "29.09.14";
  const V_SEED = "29.09.14";
  const CASAMARA = "casamara-rooftop-washington-dc";

  const TESTS = [
    {
      id: "dc-casamara",
      title: "DC venues / Casamara",
      detail: "Open Casamara Club Admin. Spot-check events + Advertising tab loads. (Optional: another DC venue if you have time.)",
      href: `${BASE}/admin.html?location=${CASAMARA}&v=${V_ADMIN}`
    },
    {
      id: "adv-media-upload",
      title: "Advertising — device media upload",
      detail: "Advertising panel → template input: upload a local photo/video from the phone (not only a URL). Confirm preview sticks.",
      href: `${BASE}/admin.html?location=${CASAMARA}&v=${V_ADMIN}#panelAdvertising`
    },
    {
      id: "adv-stripe-10",
      title: "Advertising — $10 Buy → Stripe",
      detail: "Same Advertising panel. Tap Buy SMS or WhatsApp $10 service/bundle and confirm Stripe Checkout opens.",
      href: `${BASE}/admin.html?location=${CASAMARA}&v=${V_ADMIN}#panelAdvertising`
    },
    {
      id: "portal-tabs-wrap",
      title: "Profile tabs wrap on mobile",
      detail: "My Profile and Settings — tabs/labels stay readable and wrap (no clipped text) on iPhone Safari.",
      href: `${BASE}/patron-portal.html?v=${V_PORTAL}`
    },
    {
      id: "mingl-accept",
      title: "Mingl Accept",
      detail: "Search → Mingl → Requests. Accept a pending Friend/Mingl request (e.g. Anne). No permission-denied; chat can open.",
      href: `${BASE}/index.html?v=${V_MINGL}&start=search`
    },
    {
      id: "mingl-gist-ads",
      title: "Mingl Gist + spot ads",
      detail: "Open Mingl Gist; confirm stories load. Also check Mingl/search for splash or in-grid spot ads.",
      href: `${BASE}/mingl-gist.html?v=${V_GIST}&from=mingl`
    },
    {
      id: "bartr-cobra",
      title: "BartR — Cobra arts products",
      detail: "Search “art” or browse; open Cobra Callisto Arts; confirm catalog items; optional checkout smoke.",
      href: `${BASE}/commerce.html?v=${V_COMMERCE}`
    },
    {
      id: "floqr-branding",
      title: "FloqR branding note",
      detail: "On the pages you opened, branding should read FloqR / FLOQR (not Flocker). Mark Fail only if you still see Flocker.",
      href: `${BASE}/index.html?v=${V_MINGL}&start=search`
    },
    {
      id: "seed-optional",
      title: "Seed page (if catalog/ads empty)",
      detail: "Optional. Master Admin: run spot-ad pool + Lucy/Cobra BartR seed, then retest ads/BartR.",
      href: `${BASE}/seed-v29-09-14.html?v=${V_SEED}`
    }
  ];

  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const fn = firebase.app().functions("us-central1");

  const listEl = document.getElementById("mtcList");
  const statusEl = document.getElementById("mtcStatus");
  const whoEl = document.getElementById("mtcWho");
  const formEl = document.getElementById("mtcForm");
  const doneEl = document.getElementById("mtcDone");
  const submitBtn = document.getElementById("mtcSubmitBtn");
  const googleBtn = document.getElementById("mtcGoogleBtn");
  const signOutBtn = document.getElementById("mtcSignOutBtn");

  const state = {};
  TESTS.forEach((t) => { state[t.id] = { result: "", note: "" }; });

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  function render() {
    listEl.innerHTML = TESTS.map((t) => {
      const s = state[t.id];
      return `
        <article class="mtc-item" data-id="${t.id}">
          <h2>${escapeHtml(t.title)}</h2>
          <p>${escapeHtml(t.detail)}</p>
          <a class="mtc-open" href="${escapeAttr(t.href)}">Open test</a>
          <div class="mtc-toggles" role="group" aria-label="${escapeAttr(t.title)} result">
            <button type="button" class="pass" data-result="pass" aria-pressed="${s.result === "pass"}">Pass</button>
            <button type="button" class="fail" data-result="fail" aria-pressed="${s.result === "fail"}">Fail</button>
            <button type="button" class="skip" data-result="skip" aria-pressed="${s.result === "skip"}">Skip</button>
          </div>
          <label>Note (optional)
            <textarea data-note="${t.id}" placeholder="What you saw…" maxlength="500">${escapeHtml(s.note)}</textarea>
          </label>
        </article>`;
    }).join("");
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

  listEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-result]");
    if (!btn) return;
    const item = btn.closest(".mtc-item");
    if (!item) return;
    const id = item.getAttribute("data-id");
    const result = btn.getAttribute("data-result");
    state[id].result = state[id].result === result ? "" : result;
    item.querySelectorAll("button[data-result]").forEach((b) => {
      b.setAttribute("aria-pressed", b.getAttribute("data-result") === state[id].result ? "true" : "false");
    });
  });

  listEl.addEventListener("input", (ev) => {
    const ta = ev.target.closest("textarea[data-note]");
    if (!ta) return;
    state[ta.getAttribute("data-note")].note = ta.value.slice(0, 500);
  });

  googleBtn.addEventListener("click", () => {
    setStatus("Opening Google sign-in…");
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch((err) => {
      setStatus(err.message || String(err));
    });
  });

  signOutBtn.addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged((user) => {
    if (user) {
      whoEl.textContent = `Signed in as ${user.email || user.uid}`;
      googleBtn.classList.add("hidden");
      signOutBtn.classList.remove("hidden");
    } else {
      whoEl.textContent = "Not signed in — you can still submit.";
      googleBtn.classList.remove("hidden");
      signOutBtn.classList.add("hidden");
    }
  });

  function collectResults() {
    return TESTS.map((t) => ({
      id: t.id,
      title: t.title,
      result: state[t.id].result || "unset",
      note: (state[t.id].note || "").trim()
    }));
  }

  async function submit() {
    const results = collectResults();
    const marked = results.filter((r) => r.result !== "unset");
    if (!marked.length) {
      setStatus("Mark at least one test Pass / Fail / Skip before submitting.");
      return;
    }
    submitBtn.disabled = true;
    setStatus("Sending results…");
    const user = auth.currentUser;
    const payload = {
      results,
      submittedAtClient: new Date().toISOString(),
      userAgent: navigator.userAgent || "",
      pageUrl: location.href
    };

    let emailed = false;
    let runId = "";
    try {
      const call = fn.httpsCallable("submitMobileTestResults");
      const res = await call(payload);
      emailed = !!(res.data && res.data.ok);
      runId = (res.data && res.data.runId) || "";
    } catch (err) {
      setStatus(`Submit failed: ${err.message || err}`);
      submitBtn.disabled = false;
      return;
    }

    if (user) {
      try {
        const ref = runId ? db.collection("mobileTestRuns").doc(runId) : db.collection("mobileTestRuns").doc();
        await ref.set({
          ...payload,
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          emailed,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (_) {
        /* email already sent; Firestore is best-effort */
      }
    }

    formEl.classList.add("hidden");
    doneEl.classList.add("show");
    setStatus("");
  }

  submitBtn.addEventListener("click", () => {
    submit().catch((err) => {
      setStatus(err.message || String(err));
      submitBtn.disabled = false;
    });
  });

  render();
})();
