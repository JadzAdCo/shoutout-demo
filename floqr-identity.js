/* FLOQR identity helpers — FloqR handle = Mingl handle */
(function (global) {
  "use strict";

  const FLOQR_HANDLE_HELP =
    "FloqR / Mingl handle: letters, numbers, underscores (_), and dashes (-) only. No spaces, emoji, or other symbols. Shown as @your_handle on public profiles.";

  function stripAt(value) {
    return String(value || "").trim().replace(/^@+/, "");
  }

  function normalizeFloqrHandle(value, { requireAt = true } = {}) {
    const raw = stripAt(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 28);
    if (!raw) return "";
    return requireAt ? `@${raw}` : raw;
  }

  function isValidFloqrHandle(value) {
    const raw = stripAt(value);
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,27}$/.test(raw);
  }

  function normalizeInstagramHandle(value) {
    const raw = stripAt(value).replace(/[^a-zA-Z0-9._]/g, "").slice(0, 30);
    return raw ? `@${raw}` : "";
  }

  function instagramNeedsAtPrefix(value) {
    const trimmed = String(value || "").trim();
    return !!trimmed && !trimmed.startsWith("@");
  }

  function floqrHandleFromProfile(profile = {}, fallback = "") {
    return normalizeFloqrHandle(profile.floqrHandle || profile.username || fallback);
  }

  function resolvePlayerIdentityLabel(identityType, profile = {}, overrideValue = "", nameLimit = 14) {
    const type = String(identityType || "displayName");
    const limit = Math.max(1, Number(nameLimit || 14));
    if (type === "instagram") {
      const handle = normalizeInstagramHandle(overrideValue || profile.instagramHandle || "");
      return (handle || "@instagram").slice(0, limit);
    }
    if (type === "floqrHandle" || type === "minglHandle" || type === "username") {
      const handle = normalizeFloqrHandle(overrideValue || floqrHandleFromProfile(profile));
      return (handle || "@floqr").slice(0, limit);
    }
    const display = String(overrideValue || profile.displayName || profile.fullName || floqrHandleFromProfile(profile) || "PLAYER")
      .trim()
      .slice(0, limit);
    return display || "PLAYER";
  }

  function ensureToastHost() {
    let host = document.getElementById("floqrToastHost");
    if (host) return host;
    host = document.createElement("div");
    host.id = "floqrToastHost";
    host.className = "floqr-toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, { durationMs = 3000, tone = "warn" } = {}) {
    const host = ensureToastHost();
    const toast = document.createElement("div");
    toast.className = `floqr-toast floqr-toast-${tone}`;
    toast.innerHTML = `<span></span><button type="button" aria-label="Close">×</button>`;
    toast.querySelector("span").textContent = String(message || "");
    const close = () => {
      toast.classList.add("floqr-toast-leaving");
      setTimeout(() => toast.remove(), 180);
    };
    toast.querySelector("button").addEventListener("click", close);
    host.appendChild(toast);
    const timer = setTimeout(close, Math.max(800, Number(durationMs) || 3000));
    toast.addEventListener("click", (event) => {
      if (event.target === toast.querySelector("button")) clearTimeout(timer);
    });
    return toast;
  }

  function bindInstagramInput(input, { onNormalized } = {}) {
    if (!input || input.dataset.floqrIgBound === "1") return;
    input.dataset.floqrIgBound = "1";
    const normalizeAndWarn = () => {
      const value = input.value;
      if (instagramNeedsAtPrefix(value)) {
        showToast('Instagram handles should start with "@". We added it for you.', { durationMs: 3000, tone: "warn" });
      }
      const next = normalizeInstagramHandle(value);
      if (next !== value) input.value = next;
      if (typeof onNormalized === "function") onNormalized(next);
    };
    input.addEventListener("blur", normalizeAndWarn);
    input.addEventListener("change", normalizeAndWarn);
  }

  function bindFloqrHandleInput(input, { helpEl } = {}) {
    if (!input || input.dataset.floqrHandleBound === "1") return;
    input.dataset.floqrHandleBound = "1";
    if (helpEl) helpEl.textContent = FLOQR_HANDLE_HELP;
    const normalize = () => {
      const next = normalizeFloqrHandle(input.value);
      if (next !== input.value) input.value = next;
      if (input.value && !isValidFloqrHandle(input.value)) {
        showToast("FloqR / Mingl handles may only use letters, numbers, underscores, and dashes.", { durationMs: 3000, tone: "warn" });
      }
    };
    input.addEventListener("blur", normalize);
    input.addEventListener("change", normalize);
  }

  function attachHelpPopout(anchor, text) {
    if (!anchor || anchor.dataset.helpBound === "1") return;
    anchor.dataset.helpBound = "1";
    anchor.setAttribute("type", "button");
    anchor.setAttribute("aria-label", "Help");
    anchor.classList.add("floqr-help-popout");
    anchor.textContent = anchor.textContent || "?";
    const panel = document.createElement("span");
    panel.className = "floqr-help-panel hidden";
    panel.textContent = text;
    anchor.insertAdjacentElement("afterend", panel);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      panel.classList.toggle("hidden");
    });
    document.addEventListener("click", (event) => {
      if (event.target === anchor || panel.contains(event.target)) return;
      panel.classList.add("hidden");
    });
  }

  const FOOTBALL_COLOR_THEMES = {
    stadiumGold: { id: "stadiumGold", label: "Stadium gold", accent: "#dfff5a", ink: "#ffffff", field: "#06180f", frame: "#5c4700" },
    midnightBlue: { id: "midnightBlue", label: "Midnight blue", accent: "#7ec8ff", ink: "#ffffff", field: "#071525", frame: "#1a4a7a" },
    crimsonNight: { id: "crimsonNight", label: "Crimson night", accent: "#ff6b6b", ink: "#ffffff", field: "#1a0608", frame: "#7a1a22" },
    violetPulse: { id: "violetPulse", label: "Violet pulse", accent: "#d4a1ff", ink: "#ffffff", field: "#14081f", frame: "#5a2a7a" },
    monoWhite: { id: "monoWhite", label: "Mono white", accent: "#f4f4f4", ink: "#ffffff", field: "#0a0a0a", frame: "#777777" }
  };

  function footballTheme(themeId) {
    return FOOTBALL_COLOR_THEMES[themeId] || FOOTBALL_COLOR_THEMES.stadiumGold;
  }

  function isSmallFootballDisplay(formatId = "") {
    return /64x32$/i.test(String(formatId || ""));
  }

  global.FLOQRIdentity = {
    FLOQR_HANDLE_HELP,
    FOOTBALL_COLOR_THEMES,
    normalizeFloqrHandle,
    isValidFloqrHandle,
    normalizeInstagramHandle,
    instagramNeedsAtPrefix,
    floqrHandleFromProfile,
    resolvePlayerIdentityLabel,
    showToast,
    bindInstagramInput,
    bindFloqrHandleInput,
    attachHelpPopout,
    footballTheme,
    isSmallFootballDisplay
  };
})(window);
