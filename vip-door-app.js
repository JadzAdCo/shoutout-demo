/* VIP reserV door — satellite session shell, list + check-in / no-show. */
(function () {
  "use strict";

  const statusEl = document.getElementById("vipDoorStatus");
  const gateEl = document.getElementById("vipDoorGate");
  const appEl = document.getElementById("vipDoorApp");
  const listEl = document.getElementById("vipDoorList");
  const locEl = document.getElementById("vipDoorLocation");
  const nightEl = document.getElementById("vipDoorNight");

  function t(key, fallback) {
    try {
      const v = window.FLOQRI18n?.t?.(key);
      if (v && v !== key) return v;
    } catch (_) { /* ignore */ }
    return fallback;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function callable(name) {
    return firebase.app().functions("us-central1").httpsCallable(name);
  }

  function fillNights() {
    if (!nightEl) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nightEl.innerHTML = "";
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today.getTime() + i * 86400000);
      const opt = document.createElement("option");
      opt.value = d.toISOString().slice(0, 10);
      opt.textContent = d.toLocaleDateString(undefined, {weekday: "short", month: "short", day: "numeric"});
      nightEl.appendChild(opt);
    }
  }

  function money(cents) {
    return "$" + (Number(cents || 0) / 100).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }

  async function refreshList() {
    if (!locEl || !nightEl) return;
    setStatus(t("page.vipDoor.loading", "Loading reservations…"));
    try {
      const res = await callable("listVipReservations")({
        clubLocationId: locEl.value,
        night: nightEl.value
      });
      const rows = res.data?.reservations || [];
      if (!listEl) return;
      if (!rows.length) {
        listEl.innerHTML = `<li class="sub">${t("page.vipDoor.empty", "No reservations for this night yet.")}</li>`;
        setStatus(t("page.vipDoor.ready", "Ready."));
        return;
      }
      listEl.innerHTML = rows.map(r => {
        const st = r.IsCheckedIn ? "checked in" : (r.IsNoShow ? "no-show" : (r.status || ""));
        return `<li data-id="${r.reservationId}">` +
          `<strong>${r.sectionLabel || r.sectionId}</strong> · ${r.partySize || "?"} guests · ${st}` +
          ` · ${money(r.amounts?.chargedCents)}` +
          (r.status === "confirmed" && !r.IsCheckedIn
            ? ` <button type="button" data-check="${r.reservationId}">${t("page.vipDoor.doCheckIn", "Check in")}</button>` +
              ` <button type="button" data-noshow="${r.reservationId}">${t("page.vipDoor.noShow", "No-show")}</button>`
            : "") +
          `</li>`;
      }).join("");
      listEl.querySelectorAll("[data-check]").forEach(btn => {
        btn.addEventListener("click", () => checkIn({reservationId: btn.getAttribute("data-check")}));
      });
      listEl.querySelectorAll("[data-noshow]").forEach(btn => {
        btn.addEventListener("click", () => markNoShow(btn.getAttribute("data-noshow")));
      });
      setStatus(t("page.vipDoor.ready", "Ready."));
    } catch (err) {
      setStatus((err?.message || String(err)).replace(/^.*?:\s*/, ""));
    }
  }

  async function checkIn({reservationId, token} = {}) {
    try {
      await callable("checkInVipReservation")({
        clubLocationId: locEl.value,
        reservationId: reservationId || "",
        token: token || document.getElementById("vipDoorToken")?.value || "",
        id21Checked: !!document.getElementById("vipDoorId21")?.checked
      });
      setStatus(t("page.vipDoor.checkedIn", "Checked in."));
      const tokenEl = document.getElementById("vipDoorToken");
      if (tokenEl) tokenEl.value = "";
      refreshList();
    } catch (err) {
      setStatus((err?.message || String(err)).replace(/^.*?:\s*/, ""));
    }
  }

  async function markNoShow(reservationId) {
    try {
      await callable("markVipNoShow")({reservationId});
      setStatus(t("page.vipDoor.markedNoShow", "Marked no-show."));
      refreshList();
    } catch (err) {
      setStatus((err?.message || String(err)).replace(/^.*?:\s*/, ""));
    }
  }

  function showApp() {
    if (gateEl) gateEl.classList.add("hidden");
    if (appEl) appEl.classList.remove("hidden");
    fillNights();
    const params = new URLSearchParams(location.search);
    const loc = params.get("location");
    if (loc && locEl) locEl.value = loc;
    refreshList();
  }

  function boot() {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    try { window.FLOQRI18n?.apply?.(document); } catch (_) { /* ignore */ }
    const profileLink = document.getElementById("vipDoorOpenProfile");
    if (profileLink && window.FLOQRNav?.portalLink) {
      profileLink.href = window.FLOQRNav.portalLink({tab: "profile"});
    }
    document.getElementById("vipDoorRefresh")?.addEventListener("click", refreshList);
    document.getElementById("vipDoorCheckIn")?.addEventListener("click", () => checkIn({}));
    locEl?.addEventListener("change", refreshList);
    nightEl?.addEventListener("change", refreshList);

    if (!window.FLOQRSessionShell?.bind) {
      setStatus(t("page.vip.shellMissing", "Session shell missing — hard refresh and try again."));
      return;
    }
    window.FLOQRSessionShell.bind({
      auth: firebase.auth(),
      chrome: "[data-floqr-auth-chrome]",
      loginButtons: "[data-floqr-login-btn]",
      statusEl: "#vipDoorStatus",
      onUser: user => {
        if (!user) {
          if (appEl) appEl.classList.add("hidden");
          if (gateEl) gateEl.classList.remove("hidden");
          setStatus(t("page.vipDoor.needSignIn", "Sign in to use VIP reserV door."));
          return;
        }
        showApp();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
