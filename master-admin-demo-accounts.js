/* Temporal Demo Accounts panel — removable after QA (temp_*@floqr-demo.com). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const META = "system/demoAccounts";
  const CALLABLE_TIMEOUT_MS = 300000;
  let seedBusy = false;

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg) {
    const text = msg || "";
    const el = byId("demoAccountsStatus");
    if (el) el.textContent = text;
    const feedback = byId("masterActionFeedback");
    if (feedback && text) feedback.textContent = text;
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name, {timeout: CALLABLE_TIMEOUT_MS});
  }

  function formatError(err, context) {
    const code = err?.code || err?.details?.code || "";
    const message = err?.message || String(err || "Unknown error");
    if (/deadline-exceeded|timeout/i.test(code) || /timeout/i.test(message)) {
      return "Seed timed out. Wait a minute, click Refresh codes — partial data may already exist. If empty, retry Seed.";
    }
    if (/not-found|NOT_FOUND/i.test(code) || /not found/i.test(message)) {
      return "seedTempDemoPack is not deployed. Deploy Firebase Functions, then retry Seed.";
    }
    if (/permission-denied/i.test(code)) {
      if (context === "manifest") {
        return "Seed may have finished but login codes cannot be read. Deploy Firestore rules (system/{docId} Master Admin read), hard-refresh, then click Refresh codes.";
      }
      if (/Missing or insufficient permissions/i.test(message)) {
        return "Cannot read system/demoAccounts. Deploy updated Firestore rules, hard-refresh, then click Refresh codes.";
      }
      return "Master Admin only — sign in with an approved Master Admin email, then retry Seed.";
    }
    if (/internal/i.test(code)) {
      return `Seed failed on server: ${message}. Check Firebase Functions logs for seedTempDemoPack.`;
    }
    return message;
  }

  function renderManifest(data) {
    if (!data) return null;
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    byId("demoAccountsMeta").innerHTML = [
      `<div class="metric-card metric-card-text"><span>Pack</span><strong>${esc(data.pack || "—")}</strong></div>`,
      `<div class="metric-card metric-card-text"><span>Email sink</span><strong>${esc(data.sinkEmail || "bans.don@gmail.com")}</strong></div>`,
      `<div class="metric-card metric-card-text"><span>SMS sink</span><strong>${esc(data.sinkSms || "+12027330274")}</strong></div>`,
      `<div class="metric-card metric-card-text"><span>Schedule club</span><strong>${esc(data.scheduleLocationId || "temp-democlub-1")}</strong></div>`,
      `<div class="metric-card"><span>Shifts</span><strong>${esc(String(data.shiftCount ?? "—"))}</strong></div>`
    ].join("");
    byId("demoAccountsTable").innerHTML = accounts.length
      ? `<table class="report-table compact">
        <thead><tr><th>Role</th><th>Email</th><th>Login code</th><th>Genre / club</th></tr></thead>
        <tbody>
          ${accounts.map(a => `<tr>
            <td>${esc(a.role)}</td>
            <td><code>${esc(a.email)}</code></td>
            <td><strong>${esc(a.loginCode)}</strong></td>
            <td>${esc(a.genre || a.locationId || "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
      : "<p class='sub'>Empty.</p>";
    setStatus(`Loaded ${accounts.length} temp demo accounts. Default password FloqrDemo2026! · mail/SMS → sinks.`);
    return data;
  }

  async function loadManifest() {
    if (seedBusy) return null;
    if (!window.firebase) throw new Error("Firebase not loaded");
    const db = firebase.firestore();
    const snap = await db.doc(META).get();
    if (!snap.exists) {
      setStatus("No demo pack found. Click Seed / refresh demo pack (Master Admin).");
      byId("demoAccountsTable").innerHTML = "<p class='sub'>Empty.</p>";
      byId("demoAccountsMeta").innerHTML = "";
      return null;
    }
    return renderManifest(snap.data() || {});
  }

  async function seedPack() {
    seedBusy = true;
    setStatus("Seeding temp demo pack (Auth + clubs + schedule). This can take 1–3 minutes…");
    try {
      const result = await callable("seedTempDemoPack")({action: "seed"});
      const data = result?.data || {};
      const count = data.accounts?.length || 0;
      const shifts = data.shiftCount || 0;
      renderManifest(data);
      setStatus(`Seeded ${count} accounts · ${shifts} shifts on temp-democlub-1. Default password FloqrDemo2026!`);
      try {
        await loadManifest();
      } catch (err) {
        if (count > 0) {
          setStatus(`Seeded ${count} accounts · ${shifts} shifts. ${formatError(err, "manifest")}`);
        } else {
          throw err;
        }
      }
    } finally {
      seedBusy = false;
    }
  }

  async function purgePack() {
    if (!window.confirm("Purge all temp_*@floqr-demo.com Auth users, clubs, events, and shifts?")) return;
    seedBusy = true;
    setStatus("Purging demo pack…");
    try {
      await callable("seedTempDemoPack")({action: "purge"});
      setStatus("Purged. Click Seed to recreate.");
      byId("demoAccountsTable").innerHTML = "<p class='sub'>Empty.</p>";
      byId("demoAccountsMeta").innerHTML = "";
    } finally {
      seedBusy = false;
    }
  }

  function wire() {
    byId("refreshDemoAccountsBtn")?.addEventListener("click", () => {
      loadManifest().catch(err => setStatus(formatError(err, "manifest")));
    });
    byId("seedDemoAccountsBtn")?.addEventListener("click", () => {
      seedPack().catch(err => setStatus(formatError(err)));
    });
    byId("purgeDemoAccountsBtn")?.addEventListener("click", () => {
      purgePack().catch(err => setStatus(formatError(err)));
    });
    document.querySelector('button.admin-tab[data-panel="demoAccounts"]')?.addEventListener("click", () => {
      if (!seedBusy) loadManifest().catch(err => setStatus(formatError(err, "manifest")));
    });
    if (window.firebase?.auth) {
      firebase.auth().onAuthStateChanged(user => {
        if (seedBusy) return;
        if (user && document.getElementById("demoAccounts")?.classList.contains("active")) {
          loadManifest().catch(() => {});
        }
      });
    }
    if (location.hash === "#demoAccounts" && document.getElementById("demoAccounts")?.classList.contains("active")) {
      loadManifest().catch(() => {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
