/* Template preview — sample ShoutOut on the real board renderer.
   Design notes: .cursor/rules/design-notes-template-discovery-idle.mdc */
(function (global) {
  "use strict";

  const IMG = "./images/template-preview/";
  const SIZE_LABELS = {"led-96x48": "96×48", "led-64x48": "64×48", "led-64x32": "64×32"};
  const FORMAT_ORDER = ["led-96x48", "led-64x48", "led-64x32"];
  const SPLIT_SAMPLES = {
    birthdayMedia: {main: "HAPPY BIRTHDAY MAYA!", sub: "FROM THE CREW", media: "sample-birthday.jpg"},
    anniversaryMedia: {main: "HAPPY 10 YEARS BABE!", sub: "TABLE 12", media: "sample-romance.jpg"},
    engagementMedia: {main: "SHE SAID YES!", sub: "CONGRATS NYX + JAY", media: "sample-romance.jpg"},
    fianceMedia: {main: "TO MY FIANCÉ JAY", sub: "FOREVER STARTS NOW", media: "sample-romance.jpg"}
  };
  const FOOTBALL_PLAYERS = [
    {name: "NYX", position: "QUARTERBACK"},
    {name: "MAYA", position: "WIDE RECEIVER"},
    {name: "JAY", position: "RUNNING BACK"},
    {name: "ROCKO", position: "LINEBACKER"}
  ];

  function kindOf(template = {}) {
    return global.FLOQRTextLayout?.profileId?.(template) || "full";
  }

  function brandOf(location = {}) {
    return String(location.brandName || location.locationName || "FLOQR").trim().toUpperCase();
  }

  function jerseyFields(template = {}) {
    const id = String(template.id || "");
    if (/^(nba|nfl)/i.test(id)) {
      const label = template.jerseyTeamLabel || String(template.teamName || template.name || "").replace(/^(NBA|NFL)\s+/i, "").toUpperCase();
      const nflDual = !!template.nflDualLayout || template.layout === "nfl-jersey";
      return {
        template: id,
        main: nflDual ? "LET'S GO! TABLE 12 IN THE HOUSE" : "NYX",
        sub: "99",
        extra: {
          jerseyTeamLabel: label,
          jerseyPrimary: template.jerseyPrimary || "",
          jerseySecondary: template.jerseySecondary || "",
          jerseyAccent: template.jerseyAccent || template.jerseySecondary || "",
          jerseyCssBack: template.defaultBackgroundUrl ? "0" : "1",
          backgroundUrl: template.defaultBackgroundUrl || "",
          sport: template.sport || (id.startsWith("nfl") ? "nfl" : "nba"),
          jerseyPatronName: "NYX",
          nflDualLayout: nflDual ? "1" : ""
        }
      };
    }
    const team = template.defaultBackgroundUrl ? template : ((global.FLOQRSoccerPhotoTeams?.() || [])[0] || {});
    return {
      template: "soccerJersey",
      main: "NYX",
      sub: "10",
      extra: {
        jerseyTeamId: team.id || "",
        jerseyTeamLabel: team.jerseyTeamLabel || String(team.teamName || team.name || "").replace(/^Soccer\s+/i, "").toUpperCase(),
        jerseyPrimary: team.jerseyPrimary || "",
        jerseySecondary: team.jerseySecondary || "",
        jerseyAccent: team.jerseyAccent || team.jerseySecondary || "",
        jerseyCssBack: team.defaultBackgroundUrl ? "0" : "1",
        backgroundUrl: team.defaultBackgroundUrl || "",
        sport: "soccer",
        jerseyPatronName: "NYX"
      }
    };
  }

  /** Made-up text + graphics for a template, picked by its layout kind. */
  function sampleFor(template = {}, location = {}) {
    const id = String(template.id || "");
    const kind = kindOf(template);
    if (kind === "soccerJersey" || kind === "nflJersey") return {kind, ...jerseyFields(template)};
    if (template.nameOnly) return {kind, template: id, main: "@FloqrStar", sub: "", extra: {}};
    if (kind === "splitMedia") {
      const s = SPLIT_SAMPLES[id] || SPLIT_SAMPLES.birthdayMedia;
      return {kind, template: id, main: s.main, sub: s.sub, extra: {media: IMG + s.media, mediaType: "image", mediaFit: "cover"}};
    }
    if (kind === "christine") {
      return {kind, template: id, main: "TONIGHT WE CELEBRATE", sub: "VIP TABLE 7", extra: {media: IMG + "sample-club-night.jpg", mediaType: "image", mediaFit: "cover"}};
    }
    if (kind === "footballIntro") {
      return {
        kind, template: id, main: `${brandOf(location)} FOOTBALL INTRO`, sub: "GAME NIGHT LINEUP",
        extra: {
          teamMembers: JSON.stringify(FOOTBALL_PLAYERS.map((p, i) => ({...p, mediaUrl: `${IMG}football-player-${i + 1}.svg`}))),
          stadiumMessage: "TONIGHT, WE TAKE THE FIELD TOGETHER"
        }
      };
    }
    if (kind === "car") return {kind, template: id, main: "RIDIN' RARI", sub: "PULL UP SEASON", extra: {}};
    if (kind === "classicBoard") return {kind, template: id, main: "CONGRATS NYX! TABLE 12 IS LIT", sub: "", extra: {}};
    if (kind === "textOverlayFrame") return {kind, template: id, main: "CAUGHT IN THE VAULT", sub: "", extra: {}};
    return {kind, template: id, main: "HAPPY BIRTHDAY MAYA! 🎉", sub: "FROM THE CREW", extra: {}};
  }

  /** Board sizes this template can play at this venue, largest first. */
  function formatsFor(template = {}, location = {}) {
    const sd = global.FLOQRScreenDatapoints;
    const overlap = sd?.overlappingFormatIds?.(template, location) || template.screenFormatIds || FORMAT_ORDER;
    const supported = [...overlap].filter(fid => global.FLOQRTextLayout?.resolve?.(template, fid)?.supported !== false);
    const list = supported.length ? supported : [...(template.screenFormatIds || ["led-96x48"])];
    return FORMAT_ORDER.filter(fid => list.includes(fid)).concat(list.filter(fid => !FORMAT_ORDER.includes(fid)));
  }

  /** display.html URL-preview link. Never carries ?v= (Display URLs stay cache-key free). */
  function previewUrl(template = {}, {locationId = "", location = {}, formatId = "", base = global.location?.href} = {}) {
    const sample = sampleFor(template, location);
    const url = new URL("./display.html", base);
    url.searchParams.set("location", locationId || location.id || "");
    url.searchParams.set("template", sample.template || template.id || "neon");
    url.searchParams.set("main", sample.main || "");
    if (sample.sub) url.searchParams.set("sub", sample.sub);
    if (formatId) url.searchParams.set("screen", formatId);
    Object.entries(sample.extra || {}).forEach(([key, value]) => {
      if (value !== "" && value != null) url.searchParams.set(key, String(value));
    });
    url.searchParams.set("preview", "1");
    return url.href;
  }

  const tt = (key, vars, fallback) => {
    const out = global.FLOQRI18n?.t?.(key, vars);
    return out && out !== key ? out : String(fallback).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  };

  let modal = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "template-preview-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="template-preview-dialog">
      <div class="template-preview-head"><h3 data-preview-title></h3><button type="button" class="secondary" data-preview-close></button></div>
      <div class="template-preview-sizes" data-preview-sizes></div>
      <div class="template-preview-stage"><iframe title="Template preview" data-preview-frame loading="lazy"></iframe></div>
      <p class="sub small" data-preview-note></p>
    </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.classList.add("hidden"); modal.querySelector("[data-preview-frame]").src = "about:blank"; };
    modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-preview-close]")) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });
    return modal;
  }

  function open(template = {}, options = {}) {
    const location = options.location || {};
    const root = ensureModal();
    const formats = formatsFor(template, location);
    const frame = root.querySelector("[data-preview-frame]");
    const sizes = root.querySelector("[data-preview-sizes]");
    root.querySelector("[data-preview-title]").textContent = tt("templatePreview.title", {name: template.name || template.id}, "Preview: {name}");
    root.querySelector("[data-preview-close]").textContent = tt("templatePreview.close", {}, "Close");
    root.querySelector("[data-preview-note]").textContent = tt("templatePreview.note", {}, "Sample text and pictures. Your ShoutOut shows your own words and photos.");
    const show = formatId => {
      const fmt = global.FLOQR_DISPLAY_FORMATS?.[formatId];
      frame.style.aspectRatio = fmt ? `${fmt.pixelWidth} / ${fmt.pixelHeight}` : "2 / 1";
      frame.src = previewUrl(template, {...options, formatId});
      sizes.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.previewFormat === formatId));
    };
    sizes.innerHTML = formats.map(fid => `<button type="button" class="secondary" data-preview-format="${fid}">${SIZE_LABELS[fid] || fid}</button>`).join("");
    sizes.querySelectorAll("button").forEach(b => b.addEventListener("click", () => show(b.dataset.previewFormat)));
    root.classList.remove("hidden");
    show(formats[0]);
    root.querySelector("[data-preview-close]").focus();
  }

  global.FLOQRTemplatePreview = {sampleFor, formatsFor, previewUrl, open};
})(typeof window !== "undefined" ? window : globalThis);
