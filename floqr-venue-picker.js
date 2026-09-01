/* Searchable multi-select venue picker — paginated Firestore index + in-memory filter. */
(function (root) {
  "use strict";

  function esc(value = "") {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function venueLabel(row = {}) {
    const parts = [
      row.locationName || row.brandName || row.name || row.locationLabel,
      row.city,
      row.region || row.stateRegion || row.state,
      row.country
    ].map(part => String(part || "").trim()).filter(Boolean);
    return parts.join(" · ") || String(row.id || "").trim() || "Venue";
  }

  function searchBlob(row = {}) {
    return [
      row.id,
      row.locationName,
      row.brandName,
      row.name,
      row.city,
      row.region,
      row.stateRegion,
      row.state,
      row.country,
      row.locationLabel,
      row.fullAddress
    ].join(" ").toLowerCase();
  }

  async function loadVenueIndex(db, staticCatalog = {}) {
    const map = new Map();
    Object.entries(staticCatalog || {}).forEach(([id, row]) => {
      if (!id) return;
      map.set(id, {id, ...row});
    });
    if (!db) return [...map.values()];

    let last = null;
    for (;;) {
      let query = db.collection("clubLocations").orderBy(firebase.firestore.FieldPath.documentId()).limit(400);
      if (last) query = query.startAfter(last);
      const snap = await query.get();
      if (!snap.docs.length) break;
      snap.docs.forEach(doc => {
        const data = doc.data() || {};
        map.set(doc.id, {id: doc.id, ...data});
      });
      last = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 400) break;
    }
    return [...map.values()].sort((a, b) => venueLabel(a).localeCompare(venueLabel(b)));
  }

  function mount(options = {}) {
    const {
      container,
      db,
      staticCatalog = root.SHOUTOUT_CLUB_LOCATIONS || {},
      selectedIds = [],
      maxResults = 25,
      minSearchLength = 2,
      placeholder = "Search club or venue name, city, region…"
    } = options;
    if (!container) return null;

    const selected = new Map();
    const labelCache = new Map();
    let index = [];
    let indexReady = false;
    let indexLoading = false;
    let debounceTimer = null;

    container.classList.add("floqr-venue-picker");
    container.innerHTML = `
      <div class="floqr-venue-picker-selected" data-venue-selected></div>
      <input type="search" class="floqr-venue-picker-search" data-venue-search placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"/>
      <p class="sub small floqr-venue-picker-hint" data-venue-hint>Type at least ${minSearchLength} characters to search. Select one or more clubs.</p>
      <div class="floqr-venue-picker-results hidden" data-venue-results></div>
    `;

    const selectedEl = container.querySelector("[data-venue-selected]");
    const searchEl = container.querySelector("[data-venue-search]");
    const resultsEl = container.querySelector("[data-venue-results]");
    const hintEl = container.querySelector("[data-venue-hint]");

    function renderSelected() {
      if (!selectedEl) return;
      if (!selected.size) {
        selectedEl.innerHTML = "<p class='sub small'>No clubs selected yet.</p>";
        return;
      }
      selectedEl.innerHTML = [...selected.entries()].map(([id, label]) => `
        <button type="button" class="floqr-venue-chip" data-venue-remove="${esc(id)}">
          <span>${esc(label)}</span>
          <small>Remove</small>
        </button>
      `).join("");
      selectedEl.querySelectorAll("[data-venue-remove]").forEach(btn => {
        btn.addEventListener("click", () => {
          selected.delete(btn.getAttribute("data-venue-remove"));
          renderSelected();
          options.onChange?.(getSelectedIds());
        });
      });
    }

    function renderResults(rows = []) {
      if (!resultsEl) return;
      if (!rows.length) {
        resultsEl.classList.remove("hidden");
        resultsEl.innerHTML = "<p class='sub small'>No matching clubs. Try a different search.</p>";
        return;
      }
      resultsEl.classList.remove("hidden");
      resultsEl.innerHTML = rows.map(row => {
        const id = row.id;
        const picked = selected.has(id);
        return `<button type="button" class="floqr-venue-result${picked ? " is-picked" : ""}" data-venue-pick="${esc(id)}" ${picked ? "disabled" : ""}>
          <strong>${esc(venueLabel(row))}</strong>
          <small>${esc(id)}</small>
        </button>`;
      }).join("");
      resultsEl.querySelectorAll("[data-venue-pick]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-venue-pick");
          if (!id || selected.has(id)) return;
          const row = index.find(item => item.id === id) || {id};
          const label = labelCache.get(id) || venueLabel(row);
          labelCache.set(id, label);
          selected.set(id, label);
          renderSelected();
          renderResults(filterIndex(searchEl?.value || ""));
          options.onChange?.(getSelectedIds());
        });
      });
    }

    function filterIndex(query = "") {
      const q = String(query || "").trim().toLowerCase();
      if (q.length < minSearchLength) return [];
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = index.filter(row => {
        const blob = searchBlob(row);
        return tokens.every(token => blob.includes(token));
      });
      return matches.slice(0, maxResults);
    }

    async function ensureIndex() {
      if (indexReady || indexLoading) return;
      indexLoading = true;
      if (hintEl) hintEl.textContent = "Loading venue directory…";
      try {
        index = await loadVenueIndex(db, staticCatalog);
        index.forEach(row => labelCache.set(row.id, venueLabel(row)));
        indexReady = true;
        if (hintEl) hintEl.textContent = `Directory ready (${index.length} venues). Type at least ${minSearchLength} characters to search.`;
      } catch (error) {
        if (hintEl) hintEl.textContent = "Could not load venue directory. Try again.";
      } finally {
        indexLoading = false;
      }
    }

    function queueSearch() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        await ensureIndex();
        const q = searchEl?.value || "";
        if (String(q).trim().length < minSearchLength) {
          resultsEl?.classList.add("hidden");
          if (resultsEl) resultsEl.innerHTML = "";
          return;
        }
        renderResults(filterIndex(q));
      }, 180);
    }

    searchEl?.addEventListener("input", queueSearch);
    searchEl?.addEventListener("focus", () => ensureIndex().then(queueSearch));

    function hydrateSelected(ids = []) {
      ids.forEach(id => {
        if (!id) return;
        const row = index.find(item => item.id === id) || staticCatalog[id] || {id};
        const label = venueLabel(row);
        labelCache.set(id, label);
        selected.set(id, label);
      });
      renderSelected();
    }

    hydrateSelected(selectedIds);
    ensureIndex().catch(() => {});

    function getSelectedIds() {
      return [...selected.keys()];
    }

    function setSelectedIds(ids = []) {
      selected.clear();
      hydrateSelected(ids);
      options.onChange?.(getSelectedIds());
    }

    return {getSelectedIds, setSelectedIds, venueLabel};
  }

  root.FLOQRVenuePicker = {mount, venueLabel, loadVenueIndex};
  if (typeof module !== "undefined" && module.exports) module.exports = root.FLOQRVenuePicker;
})(typeof window !== "undefined" ? window : globalThis);
