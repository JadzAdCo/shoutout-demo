/* Temporal Demo Accounts panel — removable after QA (temp_*@floqr-demo.com). */
(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const META = "system/demoAccounts";
  // Seed creates dozens of Auth users; match Cloud Function timeout (300s).
  const CALLABLE_TIMEOUT_MS = 300000;

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

  function formatCallableError(err) {
    const code = err?.code || err?.details?.code || "";
    const message = err?.message || String(err || "Unknown error");
    if (/deadline-exceeded|timeout/i.test(code) || /timeout/i.test(message)) {
      return "Seed timed out. Wait a minute, click Refresh codes — partial data may already exist. If empty, retry Seed.";
    }
    if (/not-found|NOT_FOUND/i.test(code) || /not found/i.test(message)) {
      return "seedTempDemoPack is not deployed. Deploy Firebase Functions, then retry Seed.";
    }
    if (/permission-denied/i.test(code)) {
      return "Master Admin only — sign in with an approved Master Admin email.";
    }
    return message;
  }

  async function loadManifest() {
    if (!window.firebase) throw new Error("Firebase not loaded");
    const db = firebase.firestore();
    const snap = await db.doc(META).get();
    if (!snap.exists) {
      setStatus("No demo pack found. Click Seed / refresh demo pack (Master Admin).");
      byId("demoAccountsTable").innerHTML = "<p class='sub'>Empty.</p>";
      byId("demoAccountsMeta").innerHTML = "";
      return null;
    }
    const data = snap.data() || {};
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    byId("demoAccountsMeta").innerHTML = [
      `<div class="metric-card"><span>Pack</span><strong>${esc(data.pack || "—")}</strong></div>`,
      `<div class="metric-card"><span>Email sink</span><strong>${esc(data.sinkEmail || "bans.don@gmail.com")}</strong></div>`,
      `<div class="metric-card"><span>SMS sink</span><strong>${esc(data.sinkSms || "+12027330274")}</strong></div>`,
      `<div class="metric-card"><span>Schedule club</span><strong>${esc(data.scheduleLocationId || "temp-democlub-1")}</strong></div>`,
      `<div class="metric-card"><span>Shifts</span><strong>${esc(String(data.shiftCount ?? "—"))}</strong></div>`
    ].join("");
    byId("demoAccountsTable").innerHTML = `
      <table class="report-table compact">
        <thead><tr><th>Role</th><th>Email</th><th>Login code</th><th>Genre / club</th></tr></thead>
        <tbody>
          ${accounts.map(a => `<tr>
            <td>${esc(a.role)}</td>
            <td><code>${esc(a.email)}</code></td>
            <td><strong>${esc(a.loginCode)}</strong></td>
            <td>${esc(a.genre || a.locationId || "—")}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
    setStatus(`Loaded ${accounts.length} temp demo accounts. Default password FloqrDemo2026! · mail/SMS → sinks.`);
    return data;
  }

  async function seedPack() {
    setStatus("Seeding temp demo pack (Auth + clubs + schedule). This can take 1–3 minutes…");
    const result = await callable("seedTempDemoPack")({action: "seed"});
    const data = result?.data || {};
    setStatus(`Seeded ${data.accounts?.length || 0} accounts · ${data.shiftCount || 0} shifts on temp-democlub-1.`);
    await loadManifest();
  }

  async function purgePack() {
    if (!window.confirm("Purge all temp_*@floqr-demo.com Auth users, clubs, events, and shifts?")) return;
    setStatus("Purging demo pack…");
    await callable("seedTempDemoPack")({action: "purge"});
    setStatus("Purged. Click Seed to recreate.");
    byId("demoAccountsTable").innerHTML = "<p class='sub'>Empty.</p>";
    byId("demoAccountsMeta").innerHTML = "";
  }

  function wire() {
    byId("refreshDemoAccountsBtn")?.addEventListener("click", () => {
      loadManifest().catch(err => setStatus(formatCallableError(err)));
    });
    byId("seedDemoAccountsBtn")?.addEventListener("click", () => {
      seedPack().catch(err => setStatus(formatCallableError(err)));
    });
    byId("purgeDemoAccountsBtn")?.addEventListener("click", () => {
      purgePack().catch(err => setStatus(formatCallableError(err)));
    });
    document.querySelector('[data-panel="demoAccounts"]')?.addEventListener("click", () => {
      loadManifest().catch(err => setStatus(formatCallableError(err)));
    });
    if (window.firebase?.auth) {
      firebase.auth().onAuthStateChanged(user => {
        if (user && document.getElementById("demoAccounts")?.classList.contains("active")) {
          loadManifest().catch(() => {});
        }
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
