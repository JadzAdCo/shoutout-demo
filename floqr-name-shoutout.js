/* Name-only ShoutOut templates: one name / @handle field with suggestions.
   Design notes: .cursor/rules/design-notes-template-discovery-idle.mdc */
(function (global) {
  "use strict";

  const MAX_SUGGESTIONS = 8;
  const DEFAULT_MAX_NAME = 14;

  function isNameOnly(template) {
    return !!template && template.nameOnly === true;
  }

  function maxName(template) {
    return Math.max(1, Number(template?.maxNameCharacters || DEFAULT_MAX_NAME));
  }

  function graphemes(value) {
    const text = String(value ?? "");
    try {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        return [...new Intl.Segmenter(undefined, {granularity: "grapheme"}).segment(text)].map(part => part.segment);
      }
    } catch (_) {}
    return Array.from(text);
  }

  function capName(value, limit) {
    return graphemes(String(value || "").replace(/\s+/g, " ").trimStart()).slice(0, limit).join("");
  }

  function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^@+/, "").trim();
  }

  function option(value, kind, label) {
    const clean = String(value || "").trim();
    return clean ? {value: clean, kind, label: String(label || "").trim()} : null;
  }

  function ownOptions(profile = {}, identity = {}, user = {}) {
    const displayName = profile.displayName || user.displayName || "";
    return [
      option(identity.floqrHandleFromProfile?.(profile), "ownMingl", displayName),
      option(identity.normalizeInstagramHandle?.(profile.instagramHandle || ""), "ownInstagram", displayName),
      option(displayName, "ownName", "")
    ].filter(Boolean);
  }

  function publicOptions(pool = [], identity = {}) {
    return pool.flatMap(profile => {
      const name = profile.displayName || "";
      return [
        option(identity.floqrHandleFromProfile?.(profile), "mingl", name),
        option(identity.normalizeInstagramHandle?.(profile.instagramHandle || ""), "instagram", name)
      ].filter(Boolean);
    });
  }

  function suggestions(query, context = {}) {
    const q = fold(query);
    const seen = new Set();
    const rows = [...ownOptions(context.profile, context.identity, context.user), ...publicOptions(context.pool, context.identity)]
      .filter(row => {
        const key = fold(row.value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return !q || key.includes(q) || fold(row.label).includes(q);
      })
      .map((row, index) => ({row, index, starts: q && (fold(row.value).startsWith(q) || fold(row.label).startsWith(q)) ? 0 : 1}));
    return rows
      .sort((a, b) => a.starts - b.starts || a.index - b.index)
      .slice(0, context.limit || MAX_SUGGESTIONS)
      .map(item => item.row);
  }

  function bind({input, list, maxLength, getContext, loadPool, kindLabel, onChange}) {
    if (!input || !list || input.dataset.nameShoutoutBound === "1") return;
    input.dataset.nameShoutoutBound = "1";
    let pool = null;
    let active = -1;
    let rows = [];

    const close = () => {
      list.classList.add("hidden");
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    };
    const pick = row => {
      input.value = capName(row.value, maxLength());
      close();
      onChange?.();
    };
    const render = () => {
      rows = suggestions(input.value, {...(getContext?.() || {}), pool: pool || []});
      if (!rows.length) return close();
      list.innerHTML = "";
      rows.forEach((row, index) => {
        const item = document.createElement("li");
        item.id = `${list.id}-opt-${index}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", index === active ? "true" : "false");
        item.className = index === active ? "is-active" : "";
        const value = document.createElement("strong");
        value.textContent = row.value;
        const meta = document.createElement("small");
        meta.textContent = [kindLabel?.(row.kind), row.label].filter(Boolean).join(" · ");
        item.append(value, meta);
        item.addEventListener("mousedown", event => { event.preventDefault(); pick(row); });
        list.appendChild(item);
      });
      list.classList.remove("hidden");
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", `${list.id}-opt-${active}`);
    };
    const ensurePool = async () => {
      if (pool || !loadPool) return;
      pool = [];
      try { pool = (await loadPool()) || []; } catch (_) { pool = []; }
      if (document.activeElement === input) render();
    };

    input.addEventListener("focus", () => { render(); ensurePool(); });
    input.addEventListener("input", () => {
      const capped = capName(input.value, maxLength());
      if (capped !== input.value) input.value = capped;
      active = -1;
      render();
      onChange?.();
    });
    input.addEventListener("keydown", event => {
      if (list.classList.contains("hidden") || !rows.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        active = (active + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
        render();
      } else if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        pick(rows[active]);
      } else if (event.key === "Escape") {
        close();
      }
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  global.FLOQRNameShoutout = {isNameOnly, maxName, capName, suggestions, bind};
})(typeof window !== "undefined" ? window : globalThis);
