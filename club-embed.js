/* Public iframe for club websites — events, DJs, featured staff, gallery via venuePublicFeed. */
// Design notes: .cursor/rules/design-notes-club-website-feed.mdc
(function () {
  "use strict";
  const API = "https://us-central1-shoutoutdemo-5b402.cloudfunctions.net/venuePublicFeed";
  const SECTIONS = ["events", "djs", "staff", "gallery"];
  const byId = id => document.getElementById(id);
  const params = new URL(location.href).searchParams;
  const locationId = String(params.get("location") || params.get("locationId") || "").trim();
  const secret = String(params.get("secret") || params.get("k") || "").trim();
  const wanted = String(params.get("sections") || "").split(",").map(s => s.trim()).filter(s => SECTIONS.includes(s));
  const sections = wanted.length ? wanted : SECTIONS;

  const t = (key, vars, fallback) => {
    const value = window.FLOQRI18n?.t(key, vars || {});
    return value && value !== key ? value : fallback;
  };
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
  const safeUrl = value => /^https:\/\//i.test(String(value || "")) ? String(value) : "";

  function setStatus(message) {
    const el = byId("clubEmbedStatus");
    el.removeAttribute("data-i18n");
    el.textContent = message || "";
    el.hidden = !message;
  }

  function eventWhen(event) {
    if (event.startsAt) {
      const date = new Date(event.startsAt);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(window.FLOQRI18n?.getLanguage?.() || undefined, {weekday: "short", month: "short", day: "numeric", hour: event.time ? "numeric" : undefined, minute: event.time ? "2-digit" : undefined});
      }
    }
    return [event.date, event.time].filter(Boolean).join(" · ");
  }

  function eventHtml(event) {
    const img = safeUrl(event.imageUrl);
    const ticket = safeUrl(event.ticketUrl);
    return `<article class="club-embed-event">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy"/>` : `<span class="club-embed-flyer"></span>`}
      <div><strong>${esc(event.name)}</strong>
        <small>${esc(eventWhen(event))}</small>
        ${event.artists?.length ? `<small>${esc(event.artists.join(" · "))}</small>` : ""}
        ${ticket ? `<a href="${esc(ticket)}" target="_blank" rel="noopener">${esc(t("page.clubEmbed.tickets", {}, "Tickets"))}</a>` : ""}
      </div>
    </article>`;
  }

  function personHtml(person) {
    const photo = safeUrl(person.photoUrl);
    return `<article class="club-embed-person">
      ${photo ? `<img src="${esc(photo)}" alt="${esc(person.name)}" loading="lazy"/>` : `<span class="club-embed-initial">${esc(person.name.slice(0, 1).toUpperCase())}</span>`}
      <strong>${esc(person.name)}</strong>
      ${person.role ? `<small>${esc(person.role)}</small>` : ""}
      ${person.instagram ? `<small>${esc(person.instagram)}</small>` : ""}
    </article>`;
  }

  function mediaHtml(item) {
    const url = safeUrl(item.url);
    if (!url) return "";
    return item.type === "video"
      ? `<video src="${esc(url)}" muted loop playsinline autoplay aria-label="${esc(item.title)}"></video>`
      : `<img src="${esc(url)}" alt="${esc(item.title)}" loading="lazy"/>`;
  }

  function fill(id, rows, render, emptyText) {
    const section = byId(id);
    const list = section.querySelector("[data-embed-list]");
    if (!rows.length && !emptyText) return;
    list.innerHTML = rows.length ? rows.map(render).join("") : `<p class="club-embed-status">${esc(emptyText)}</p>`;
    section.hidden = false;
  }

  function render(data) {
    const profile = data.profile || {};
    if (profile.name) {
      byId("clubEmbedName").removeAttribute("data-i18n");
      byId("clubEmbedName").textContent = profile.name;
    }
    byId("clubEmbedTagline").textContent = profile.tagline || [profile.city, profile.country].filter(Boolean).join(", ");
    const logo = safeUrl(profile.logoUrl);
    if (logo) Object.assign(byId("clubEmbedLogo"), {src: logo, hidden: false});
    const pageUrl = safeUrl(profile.publicPageUrl);
    if (pageUrl) Object.assign(byId("clubEmbedOpen"), {href: pageUrl, hidden: false});
    if (sections.includes("events")) fill("clubEmbedEvents", data.events || [], eventHtml, t("page.clubEmbed.noEvents", {}, "No upcoming events yet."));
    if (sections.includes("djs")) fill("clubEmbedDjs", data.djs || [], personHtml);
    if (sections.includes("staff")) fill("clubEmbedStaff", data.staff || [], personHtml);
    if (sections.includes("gallery")) fill("clubEmbedGallery", (data.gallery || []).filter(item => safeUrl(item.url)), mediaHtml);
    setStatus("");
  }

  async function load() {
    if (!locationId || !secret) {
      setStatus(t("page.clubEmbed.needsSecret", {}, "This embed needs a venue location and feed key."));
      return;
    }
    const url = `${API}?location=${encodeURIComponent(locationId)}&secret=${encodeURIComponent(secret)}&format=json&dataset=club`;
    const res = await fetch(url, {headers: {"X-Floqr-Ingest-Secret": secret}});
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      setStatus(t("page.clubEmbed.loadFailed", {status: res.status}, `Could not load club info (${res.status}).`));
      return;
    }
    if (data.published === false) {
      setStatus(t("page.clubEmbed.unpublished", {}, "This club page is not published yet."));
      return;
    }
    render(data);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (params.get("theme") === "light") document.body.classList.add("theme-light");
    const lang = window.FLOQRI18n?.normalizeCode?.(params.get("lang"));
    if (lang) await window.FLOQRI18n.setLanguage(lang, {persist: false, markPrompt: false});
    load().catch(() => setStatus(t("page.clubEmbed.loadFailed", {status: 0}, "Could not load club info (0).")));
  });
})();
