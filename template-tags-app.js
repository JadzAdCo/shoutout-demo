/* Template tags page — Club Admin, Template Administrator, Template Manager.
   Design notes: .cursor/rules/design-notes-template-discovery-idle.mdc */
(function () {
  "use strict";

  const TT = window.FLOQRTemplateTags;
  const auth = firebase.auth();
  const db = firebase.firestore();
  const params = new URLSearchParams(location.search);
  const locationId = String(params.get("location") || params.get("club") || "").trim();
  const state = {user: null, role: TT.NO_ROLE, venue: {}, templates: [], tags: {}, busy: false};

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"}[c]));
  const t = (key, fallback, vars = {}) => {
    const out = window.FLOQRI18n?.t?.(key, vars);
    return out && out !== key ? out : String(fallback).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  };
  const setStatus = message => { const el = byId("templateTagsStatus"); if (el) el.textContent = message || ""; };

  async function isClubAdmin(user) {
    const email = String(user.email || "").toLowerCase();
    if ((window.SHOUTOUT_MASTER_ADMIN_EMAILS || []).map(x => String(x).toLowerCase()).includes(email)) return true;
    try {
      const token = await user.getIdTokenResult();
      if (token?.claims?.masterAdmin === true) return true;
    } catch (_) {}
    try {
      const assignment = await db.collection("clubAdminAssignments").doc(`${locationId}_${user.uid}`).get();
      if (assignment.exists && String(assignment.data()?.status || "").toLowerCase() === "active") return true;
    } catch (_) {}
    const venue = state.venue || {};
    return (venue.adminUids || []).includes(user.uid)
      || (venue.masterAdminUids || []).includes(user.uid)
      || (venue.adminEmails || []).map(x => String(x).toLowerCase()).includes(email);
  }

  async function loadVenue() {
    const packaged = window.SHOUTOUT_CLUB_LOCATIONS?.[locationId] || {};
    let live = {};
    try {
      const snap = await db.collection("clubLocations").doc(locationId).get();
      live = snap.exists ? snap.data() || {} : {};
    } catch (_) {}
    const merged = JSON.parse(JSON.stringify({...packaged, ...live, id: locationId}));
    return window.FLOQRScreenDatapoints?.applyVenue?.(merged) || merged;
  }

  function roleLabel(role) {
    if (role.key === "administrator") return t("templateTags.roleAdministrator", "You are a Template Administrator here: you can add and remove tags.");
    return t("templateTags.roleManager", "You are a Template Manager here: you can add tags. Ask a Template Administrator or Club Admin to remove one.");
  }

  function templateRow(template) {
    const venueTags = state.tags[template.id] || [];
    const builtIn = (template.tags || []).slice(0, 8);
    const chips = venueTags.map(tag => `<span class="template-tag-chip">${esc(tag)}${state.role.canDelete ? ` <button type="button" class="ghost" data-tag-remove="${esc(template.id)}" data-tag="${esc(tag)}" aria-label="${esc(t("templateTags.remove", "Remove tag {tag}", {tag}))}">×</button>` : ""}</span>`).join("");
    return `<article class="queue-item template-tags-row" data-template-row="${esc(template.id)}">
      <div class="message-envelope-head"><strong>${esc(template.name || template.id)}</strong><span>${esc(template.category || "")}</span></div>
      <p class="sub small">${esc(t("templateTags.builtIn", "FLOQR tags:"))} ${esc(builtIn.join(", "))}</p>
      <div class="template-tag-chips">${chips || `<span class="sub small">${esc(t("templateTags.none", "No venue tags yet."))}</span>`}</div>
      <form class="template-tag-add" data-tag-add="${esc(template.id)}">
        <input type="text" maxlength="${TT.MAX_TAG_LENGTH}" placeholder="${esc(t("templateTags.placeholder", "Add a tag, e.g. game night"))}" aria-label="${esc(t("templateTags.placeholder", "Add a tag, e.g. game night"))}"/>
        <button type="submit" class="primary">${esc(t("templateTags.add", "Add tag"))}</button>
      </form>
    </article>`;
  }

  function render() {
    const q = String(byId("templateTagsSearch")?.value || "").trim().toLowerCase();
    const rows = state.templates.filter(template => !q || `${template.name} ${template.category} ${(template.tags || []).join(" ")} ${(state.tags[template.id] || []).join(" ")}`.toLowerCase().includes(q));
    byId("templateTagsList").innerHTML = rows.map(templateRow).join("") || `<p class="sub">${esc(t("templateTags.noMatch", "No templates match."))}</p>`;
  }

  async function commit(templateId, nextTags) {
    if (state.busy) return;
    state.busy = true;
    setStatus(t("templateTags.saving", "Saving…"));
    try {
      await TT.saveVenueTags(db, {locationId, templateId, tags: nextTags, user: state.user});
      state.tags = {...state.tags, [templateId]: nextTags};
      setStatus(t("templateTags.saved", "Tags saved."));
      render();
    } catch (error) {
      console.warn("Template tag save failed", error?.code || "", error?.message || error);
      setStatus(t("templateTags.denied", "You can't change that tag. Ask your Club Admin for the Template Administrator role."));
    } finally {
      state.busy = false;
    }
  }

  function bindList() {
    const list = byId("templateTagsList");
    list.addEventListener("submit", event => {
      const form = event.target.closest("[data-tag-add]");
      if (!form) return;
      event.preventDefault();
      const id = form.dataset.tagAdd;
      const input = form.querySelector("input");
      try {
        const next = TT.addTag(state.tags[id] || [], input.value, state.role);
        if (next.length !== (state.tags[id] || []).length) commit(id, next);
        input.value = "";
      } catch (error) {
        setStatus(error.message === "too-many-tags" ? t("templateTags.tooMany", "A template can have up to 30 venue tags.") : t("templateTags.denied", "You can't change that tag. Ask your Club Admin for the Template Administrator role."));
      }
    });
    list.addEventListener("click", event => {
      const button = event.target.closest("[data-tag-remove]");
      if (!button) return;
      const id = button.dataset.tagRemove;
      try {
        commit(id, TT.removeTag(state.tags[id] || [], button.dataset.tag, state.role));
      } catch (_) {
        setStatus(t("templateTags.denied", "You can't change that tag. Ask your Club Admin for the Template Administrator role."));
      }
    });
    byId("templateTagsSearch")?.addEventListener("input", render);
  }

  async function start(user) {
    state.user = user;
    if (!locationId) {
      setStatus(t("templateTags.noVenue", "Open this page from Club Admin or your Inbox link so FLOQR knows the venue."));
      return;
    }
    setStatus(t("templateTags.loading", "Loading templates…"));
    state.venue = await loadVenue();
    byId("templateTagsVenue").textContent = state.venue.brandName || state.venue.locationName || locationId;
    state.role = TT.roleFor({isClubAdmin: await isClubAdmin(user), roleDoc: await TT.loadRoleDoc(db, locationId, user.uid)});
    if (!state.role.canRead) {
      setStatus(t("templateTags.noRole", "You don't have a template role at this venue. Ask your Club Admin for Manage Templates or Administer Templates."));
      return;
    }
    state.templates = TT.templatesForVenue(locationId, state.venue);
    state.tags = await TT.loadVenueTags(db, locationId);
    byId("templateTagsRole").textContent = roleLabel(state.role);
    byId("templateTagsPanel").classList.remove("hidden");
    setStatus("");
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.FLOQRNav?.applyGlobalBack?.("floqrGlobalBack");
    bindList();
    window.FLOQRSessionShell?.bind?.({
      auth,
      chrome: "[data-floqr-auth-chrome]",
      statusEl: "#templateTagsStatus",
      onUser: user => start(user).catch(error => {
        console.warn("Template tags failed to load", error?.code || "", error?.message || error);
        setStatus(t("templateTags.loadFailed", "Templates could not be loaded. Refresh and try again."));
      })
    });
  });
})();
