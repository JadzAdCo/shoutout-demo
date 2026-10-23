/* FLOQR Club Admin — Passes (QR door) issue / list / check-in. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const t = (key, fallback) => {
    try {
      return window.FLOQRI18n?.t?.(key) || fallback || key;
    } catch (_) {
      return fallback || key;
    }
  };
  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function localYmd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function fillNights(selectEl) {
    if (!selectEl || selectEl.options.length) return;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(today.getTime() + i * 86400000);
      const opt = document.createElement("option");
      opt.value = localYmd(d);
      opt.textContent = d.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"});
      selectEl.appendChild(opt);
    }
  }

  function setStatus(msg) {
    const el = byId("passesAdminStatus");
    if (el) el.textContent = msg || "";
  }

  function locationId() {
    const fromAdmin = window.FLOQRAdmin?.getLocationId?.()
      || window.FLOQRAdmin?.locationId
      || "";
    return String(fromAdmin || new URLSearchParams(location.search).get("location") || "").trim();
  }

  async function refreshList() {
    const list = byId("passesAdminList");
    const clubLocationId = locationId();
    if (!list || !clubLocationId) return;
    const night = byId("passesAdminNight")?.value || "";
    setStatus(t("admin.passesLoading", "Loading passes…"));
    list.innerHTML = `<p class="sub">${esc(t("admin.passesLoading", "Loading passes…"))}</p>`;
    try {
      const res = await callable("listClubPasses")({clubLocationId, night: night || undefined});
      const rows = res.data?.passes || [];
      if (!rows.length) {
        list.innerHTML = `<p class="sub">${esc(t("admin.passesEmpty", "No passes for this night yet."))}</p>`;
        setStatus(t("admin.passesReady", "Ready."));
        return;
      }
      list.innerHTML = rows.map(r => {
        const id = esc(r.passId || r.id || "");
        const guest = esc(r.guestName || r.label || "Guest");
        const kind = esc(r.kind || "guestEntry");
        const status = esc(r.status || "active");
        const nightLabel = esc(r.night || "—");
        return `<div class="report-row" data-pass-id="${id}">
          <strong>${guest}</strong>
          <span>${kind} · ${nightLabel} · ${status}</span>
          <span class="button-row">
            <button type="button" class="buttonlike" data-pass-reveal="${id}">${esc(t("admin.passesReveal", "Show QR"))}</button>
            <button type="button" class="primary" data-pass-checkin="${id}">${esc(t("admin.passesCheckIn", "Check in"))}</button>
          </span>
          <div class="passes-admin-qr hidden" data-pass-qr="${id}"></div>
        </div>`;
      }).join("");
      list.querySelectorAll("[data-pass-reveal]").forEach(btn => {
        btn.addEventListener("click", () => revealPass(btn.getAttribute("data-pass-reveal")));
      });
      list.querySelectorAll("[data-pass-checkin]").forEach(btn => {
        btn.addEventListener("click", () => checkInPass(btn.getAttribute("data-pass-checkin")));
      });
      setStatus(t("admin.passesReady", "Ready."));
    } catch (err) {
      const msg = err?.message || String(err);
      list.innerHTML = `<p class="sub">${esc(msg)}</p>`;
      setStatus(msg);
    }
  }

  async function revealPass(passId) {
    if (!passId) return;
    setStatus(t("admin.passesRevealing", "Loading QR…"));
    try {
      const res = await callable("revealPass")({passId});
      const token = res.data?.passToken || "";
      const url = res.data?.passUrl || (token ? `./pass.html?t=${encodeURIComponent(token)}` : "");
      const safeId = String(passId).replace(/"/g, "");
      const host = document.querySelector(`[data-pass-qr="${safeId}"]`);
      if (host) {
        host.classList.remove("hidden");
        host.innerHTML = url
          ? `<p class="sub"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(t("admin.passesOpenFull", "Open full pass"))}</a></p><div class="floqr-qr" data-qr-host></div>`
          : `<p class="sub">No token</p>`;
        const qrHost = host.querySelector("[data-qr-host]");
        if (qrHost && token && window.FLOQRQr?.render) {
          window.FLOQRQr.render(qrHost, token, {size: 160});
        }
      }
      setStatus(t("admin.passesReady", "Ready."));
    } catch (err) {
      setStatus(err?.message || String(err));
    }
  }

  async function checkInPass(passId) {
    const clubLocationId = locationId();
    if (!passId || !clubLocationId) return;
    if (!byId("passesAdminId21")?.checked) {
      setStatus(t("admin.passesNeedId21", "Confirm ID 21+ before check-in."));
      return;
    }
    setStatus(t("admin.passesCheckingIn", "Checking in…"));
    try {
      await callable("checkInPass")({
        clubLocationId,
        passId,
        id21Checked: true
      });
      setStatus(t("admin.passesCheckedIn", "Checked in."));
      await refreshList();
    } catch (err) {
      setStatus(err?.message || String(err));
    }
  }

  async function issuePass() {
    const clubLocationId = locationId();
    if (!clubLocationId) return;
    const guestName = byId("passesAdminGuestName")?.value?.trim() || "";
    const guestPhone = byId("passesAdminGuestPhone")?.value?.trim() || "";
    const guestEmail = byId("passesAdminGuestEmail")?.value?.trim() || "";
    const night = byId("passesAdminIssueNight")?.value || byId("passesAdminNight")?.value || localYmd();
    const kind = byId("passesAdminKind")?.value || "guestEntry";
    const label = byId("passesAdminLabel")?.value?.trim() || "";
    setStatus(t("admin.passesIssuing", "Issuing pass…"));
    try {
      const res = await callable("issuePass")({
        clubLocationId,
        kind,
        night,
        label,
        guestName,
        guestPhone,
        guestEmail
      });
      const token = res.data?.passToken || "";
      const url = res.data?.passUrl || (token ? `./pass.html?t=${encodeURIComponent(token)}` : "");
      const out = byId("passesAdminIssueResult");
      if (out) {
        out.innerHTML = url
          ? `<p class="sub">${esc(t("admin.passesIssued", "Pass issued."))} <a href="${esc(url)}" target="_blank" rel="noopener">${esc(t("admin.passesOpenFull", "Open full pass"))}</a></p>`
          : `<p class="sub">${esc(t("admin.passesIssued", "Pass issued."))}</p>`;
      }
      setStatus(t("admin.passesIssued", "Pass issued."));
      await refreshList();
    } catch (err) {
      setStatus(err?.message || String(err));
    }
  }

  function bind() {
    if (bind._done || !byId("panelPasses")) return;
    bind._done = true;
    fillNights(byId("passesAdminNight"));
    fillNights(byId("passesAdminIssueNight"));
    byId("passesAdminRefresh")?.addEventListener("click", () => refreshList());
    byId("passesAdminNight")?.addEventListener("change", () => refreshList());
    byId("passesAdminIssue")?.addEventListener("click", () => issuePass());
    const door = byId("passesAdminDoorLink");
    if (door) {
      const loc = locationId();
      door.href = `./vip-door.html?location=${encodeURIComponent(loc)}`;
    }
  }

  function render() {
    if (!byId("panelPasses")) return;
    bind();
    refreshList();
  }

  window.FLOQRAdminPasses = {render, refreshList, bind};
})();
