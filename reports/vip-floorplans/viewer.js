// Phone-first VIP floor-map viewer (PROPOSAL demo). Reads decades.json / lima-twist.json / legend.json, or plans.js when opened from disk.
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);
  const stage = $("stage"), map = $("map"), mini = $("minimap"), info = $("info"), list = $("list"), chips = $("chips"), legendBar = $("legend");
  const params = new URLSearchParams(location.search);
  const phoneMq = matchMedia("(max-width: 600px)");
  const isPhone = () => phoneMq.matches;

  // Simulated booking states so the colors can be reviewed. Not real data.
  const DEMO_STATES = {
    "decades.json": {"decades-c2": "booked", "decades-c4": "booked", "decades-c8": "held", "decades-c10": "booked"},
    "lima-twist.json": {"lima-twist-203": "booked", "lima-twist-207": "held", "lima-twist-102": "booked", "lima-twist-401": "booked",
      "lima-twist-206": "held", "lima-twist-304": "booked", "lima-twist-502": "booked", "lima-twist-307": "held"}
  };
  const ICONS = {
    check: "M5 12.5l4.5 4.5L19 7.5",
    cross: "M7 7l10 10M17 7L7 17",
    clock: "M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16M12 8v4.5l3 2",
    lock: "M8 11V8.5a4 4 0 0 1 8 0V11M6 11h12v9H6z",
    music: "M10 17V6l9-2v11M10 17a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0M19 15a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0"
  };
  const DARK_ICON_ON = new Set(["available", "held", "notBookable"]);

  let legend = null, plan = null, planFile = "", states = {}, mode = "all", selectedId = null;
  let W = 0, H = 0, view = {cx: 0, cy: 0, s: 1}, lastScale = null;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  };
  const items = () => [...plan.sections, ...plan.nonBookable];
  const byId = id => items().find(m => m.id === id);
  const areaOf = id => plan.areas.find(a => a.sectionIds.includes(id) || a.nonBookableIds.includes(id));
  const currentArea = () => plan.areas.find(a => a.id === mode) || null;
  const stDef = name => legend.states.find(x => x.state === name);
  const itemState = item => item.bookable ? (states[item.id] || "available") : (item.state || (item.type === "djBooth" ? "djBooth" : "notBookable"));

  async function getJson(file) {
    try {
      const r = await fetch(file, {cache: "no-store"});
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch {
      return (window.FLOQR_VIP_PLANS || {})[file] || null;
    }
  }

  function iconSvg(st, size = 22) {
    if (st.state === "selected") return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="${st.stroke}" stroke-width="3"/></svg>`;
    const ink = DARK_ICON_ON.has(st.state) ? "#000" : "#fff";
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${st.color}" stroke="${st.stroke}"/>` +
      `<path d="${ICONS[st.icon] || ""}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function buildLegend() {
    legendBar.innerHTML = legend.states.map(st => `<span>${iconSvg(st, 18)}${esc(st.label)}</span>`).join("");
  }

  function buildChips() {
    const count = a => {
      const avail = a.sectionIds.filter(id => itemState(byId(id)) === "available").length;
      return `${avail}/${a.sectionIds.length} free`;
    };
    chips.innerHTML = `<button type="button" role="tab" data-area="all">Overview</button>` +
      plan.areas.map(a => `<button type="button" role="tab" data-area="${esc(a.id)}">${esc(a.name)} · ${count(a)}</button>`).join("");
    chips.querySelectorAll("button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.area)));
  }

  function buildMinimap() {
    mini.replaceChildren();
    mini.setAttribute("viewBox", `0 0 ${W} ${H}`);
    el("image", {href: plan.image.file, x: 0, y: 0, width: W, height: H}, mini);
    for (const a of plan.areas) {
      const [x0, y0, x1, y1] = a.pixelBox;
      el("rect", {class: "mm-area", "data-area": a.id, x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1}, mini);
    }
    el("rect", {class: "vp", id: "mmViewport"}, mini);
  }

  function updateMinimap(x, y, w, h) {
    mini.toggleAttribute("hidden", mode === "all");
    const vp = $("mmViewport");
    if (vp) { vp.setAttribute("x", x); vp.setAttribute("y", y); vp.setAttribute("width", w); vp.setAttribute("height", h); }
    mini.querySelectorAll(".mm-area").forEach(r => r.classList.toggle("current", r.dataset.area === mode));
  }

  function shapeEl(item, parent, cls, inflate = 0) {
    if (item.shape === "circle" && item.circle) {
      return el("ellipse", {class: cls, cx: item.circle.cx * W, cy: item.circle.cy * H, rx: item.circle.rx * W + inflate, ry: item.circle.ry * H + inflate}, parent);
    }
    if (item.shape === "polygon") {
      return el("polygon", {class: cls, points: item.polygon.map(([x, y]) => `${x * W},${y * H}`).join(" ")}, parent);
    }
    const [x0, y0, x1, y1] = item.pixelBox;
    return el("rect", {class: cls, x: x0 - inflate, y: y0 - inflate, width: x1 - x0 + 1 + 2 * inflate, height: y1 - y0 + 1 + 2 * inflate}, parent);
  }

  function patterns(defs, u) {
    const stripes = el("pattern", {id: "pat-diagonal-stripes", patternUnits: "userSpaceOnUse", width: u(8), height: u(8), patternTransform: "rotate(45)"}, defs);
    el("rect", {width: u(3), height: u(8), fill: "rgba(0,0,0,.5)"}, stripes);
    const hatch = el("pattern", {id: "pat-cross-hatch", patternUnits: "userSpaceOnUse", width: u(7), height: u(7), patternTransform: "rotate(45)"}, defs);
    el("rect", {width: u(2), height: u(7), fill: "rgba(0,0,0,.5)"}, hatch);
    el("rect", {width: u(7), height: u(2), fill: "rgba(0,0,0,.5)"}, hatch);
    const dots = el("pattern", {id: "pat-dots", patternUnits: "userSpaceOnUse", width: u(6), height: u(6)}, defs);
    el("circle", {cx: u(3), cy: u(3), r: u(1.2), fill: "rgba(255,255,255,.35)"}, dots);
  }

  function badge(parent, st, cx, cy, r) {
    if (!ICONS[st.icon]) return;
    el("circle", {cx, cy, r, fill: st.color, stroke: "#000", "stroke-width": r * 0.14}, parent);
    const k = (r * 1.45) / 24;
    el("path", {d: ICONS[st.icon], transform: `translate(${cx - 12 * k} ${cy - 12 * k}) scale(${k})`, fill: "none",
      stroke: DARK_ICON_ON.has(st.state) ? "#000" : "#fff", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round"}, parent);
  }

  function ariaLabel(item) {
    const st = stDef(itemState(item));
    const guests = item.bookable ? `, up to ${item.maxCapacity} guests` : "";
    return `${item.label ?? "Unlabeled"}${item.name ? " " + item.name : ""}, ${item.type}${guests}, ${st.text}`;
  }

  function drawItem(item, u, interactive, dimmed) {
    const st = stDef(itemState(item));
    const g = el("g", {class: dimmed ? "dimmed" : ""}, map);
    const deco = el("g", {class: "deco"}, g);
    const shp = shapeEl(item, deco, "shape");
    shp.setAttribute("fill", st.color);
    shp.setAttribute("fill-opacity", st.fillOpacity);
    shp.setAttribute("stroke", st.stroke);
    shp.setAttribute("stroke-width", 2);
    if (st.strokeDash) shp.setAttribute("stroke-dasharray", st.strokeDash);
    if (st.pattern !== "none") {
      const p = shapeEl(item, deco, "shape");
      p.setAttribute("fill", `url(#pat-${st.pattern})`);
    }
    const [x0, y0, x1, y1] = item.pixelBox;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    badge(deco, st, x1, y0, Math.min(u(isPhone() ? 10 : 8), 0.34 * Math.min(w, h)));
    if (item.name && item.type === "djBooth" && interactive) {
      el("text", {class: "caption", x: (x0 + x1) / 2, y: y1 + u(15), "text-anchor": "middle", fill: st.stroke, "font-size": u(12), "stroke-width": u(3)}, deco).textContent = item.name;
    }
    if (item.id === selectedId) shapeEl(item, deco, "selected-ring", u(4));
    if (!interactive) return;
    const min = u(isPhone() ? legend.tapTargetMinPx : 24);
    const hw = Math.max(w, min), hh = Math.max(h, min);
    const hit = el("rect", {class: "hit", x: (x0 + x1 + 1) / 2 - hw / 2, y: (y0 + y1 + 1) / 2 - hh / 2, width: hw, height: hh,
      tabindex: 0, role: "button", "aria-label": ariaLabel(item), "data-id": item.id, "data-dimmed": dimmed ? "1" : "0"}, g);
    hit.addEventListener("click", () => { if (!pointer.moved) select(item.id); });
    hit.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(item.id); } });
  }

  // Phone overview: one readable pill per area ("Area D · 7 free") instead of tiny table labels.
  function areaBadge(a, u) {
    const [x0, y0, x1, y1] = a.pixelBox;
    const free = a.sectionIds.filter(id => itemState(byId(id)) === "available").length;
    const text = `${a.name.split(" · ")[0]} · ${free} free`;
    const w = u(text.length * 7 + 16), h = u(24), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const g = el("g", {class: "area-badge"}, map);
    el("rect", {x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: h / 2, fill: "rgba(0,0,0,.82)", stroke: "#e5e7eb", "stroke-width": u(1)}, g);
    el("text", {x: cx, y: cy + u(4.5), "text-anchor": "middle", fill: "#fff", "font-size": u(13), "font-weight": 700}, g).textContent = text;
    const hw = Math.max(w, u(legend.tapTargetMinPx)), hh = u(legend.tapTargetMinPx);
    const hit = el("rect", {class: "hit area-hit", x: cx - hw / 2, y: cy - hh / 2, width: hw, height: hh, tabindex: 0, role: "button",
      "aria-label": `Open ${a.name}, ${free} free`, "data-dimmed": "0"}, map);
    hit.addEventListener("click", () => setMode(a.id));
    hit.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode(a.id); } });
  }

  function renderOverlay() {
    const u = px => px / view.s;
    map.replaceChildren();
    patterns(el("defs", {}, map), u);
    el("image", {href: plan.image.file, x: 0, y: 0, width: W, height: H}, map);
    const phoneOverview = isPhone() && mode === "all";
    const area = currentArea();
    for (const a of plan.areas) {
      const outline = shapeEl(a, map, "area-outline" + (a.id === mode ? " current" : "") + (phoneOverview ? " tappable" : ""));
      if (phoneOverview) {
        outline.setAttribute("role", "button");
        outline.setAttribute("tabindex", "0");
        outline.setAttribute("aria-label", `Open ${a.name}`);
        outline.addEventListener("click", () => setMode(a.id));
      }
      if (phoneOverview) continue;
      const [x0, y0] = a.pixelBox;
      const above = y0 - u(6) - u(13) >= 0;
      el("text", {class: "area-name", x: x0 + u(4), y: above ? y0 - u(6) : y0 + u(16), "font-size": u(13), "stroke-width": u(3)}, map).textContent = a.name;
    }
    const inArea = id => !area || area.sectionIds.includes(id) || area.nonBookableIds.includes(id);
    for (const n of plan.nonBookable) drawItem(n, u, !phoneOverview, phoneOverview || !inArea(n.id));
    for (const s of plan.sections) drawItem(s, u, !phoneOverview, phoneOverview || !inArea(s.id));
    if (phoneOverview) for (const a of plan.areas) areaBadge(a, u);
    requestAnimationFrame(measureTargets);
  }

  // Exposes the smallest on-screen tap target in the current area so QA can assert ≥ 44px on phones.
  function measureTargets() {
    const sizes = [...map.querySelectorAll('.hit[data-dimmed="0"]')].map(h => { const r = h.getBoundingClientRect(); return Math.min(r.width, r.height); });
    document.body.dataset.minTapPx = sizes.length ? String(Math.floor(Math.min(...sizes))) : "n/a";
    document.body.dataset.mode = mode;
  }

  function clampView() {
    const vw = stage.clientWidth / view.s, vh = stage.clientHeight / view.s;
    view.cx = vw >= W ? W / 2 : Math.min(W - vw / 2, Math.max(vw / 2, view.cx));
    view.cy = vh >= H ? H / 2 : Math.min(H - vh / 2, Math.max(vh / 2, view.cy));
  }

  function applyView(force) {
    clampView();
    const vw = stage.clientWidth / view.s, vh = stage.clientHeight / view.s;
    const x = view.cx - vw / 2, y = view.cy - vh / 2;
    map.setAttribute("viewBox", `${x} ${y} ${vw} ${vh}`);
    if (force || view.s !== lastScale) { lastScale = view.s; renderOverlay(); }
    updateMinimap(x, y, vw, vh);
  }

  function fit() {
    const sw = stage.clientWidth;
    if (mode === "all") {
      const s = sw / W;
      stage.style.height = `${Math.round(H * s)}px`;
      view = {s, cx: W / 2, cy: H / 2};
    } else {
      const a = currentArea();
      const [x0, y0, x1, y1] = a.viewPixelBox;
      const vw = x1 - x0 + 1, vh = y1 - y0 + 1;
      const narrowest = Math.min(...a.sectionIds.map(id => { const b = byId(id).pixelBox; return b[2] - b[0] + 1; }));
      const maxH = Math.round(innerHeight * (isPhone() ? 0.5 : 0.7));
      let s = sw / vw;
      if (isPhone()) s = Math.max(s, legend.tapTargetMinPx / narrowest);
      else s = Math.min(s, maxH / vh);
      stage.style.height = `${Math.min(maxH, Math.max(isPhone() ? 220 : 260, Math.round(vh * s)))}px`;
      view = {s, cx: x0 + Math.min(vw, sw / s) / 2, cy: y0 + vh / 2};
    }
    applyView(true);
  }

  function zoomAt(newScale, clientX, clientY) {
    const fitAll = stage.clientWidth / W;
    const s = Math.min(fitAll * 8, Math.max(fitAll * 0.9, newScale));
    const r = stage.getBoundingClientRect();
    const px = clientX - r.left, py = clientY - r.top;
    const ix = view.cx - r.width / (2 * view.s) + px / view.s, iy = view.cy - r.height / (2 * view.s) + py / view.s;
    view = {s, cx: ix - px / s + r.width / (2 * s), cy: iy - py / s + r.height / (2 * s)};
    applyView(false);
  }

  const pointer = {map: new Map(), moved: false, drag: null, pinch: null};
  const dist = () => { const [a, b] = [...pointer.map.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = [...pointer.map.values()]; return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}; };
  map.addEventListener("pointerdown", e => {
    pointer.map.set(e.pointerId, {x: e.clientX, y: e.clientY});
    pointer.moved = false;
    if (pointer.map.size === 1) pointer.drag = {x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy};
    if (pointer.map.size === 2) pointer.pinch = {d: dist(), s: view.s};
  });
  window.addEventListener("pointermove", e => {
    if (!pointer.map.has(e.pointerId)) return;
    pointer.map.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointer.map.size === 2 && pointer.pinch) {
      pointer.moved = true;
      const m = mid();
      zoomAt(pointer.pinch.s * dist() / pointer.pinch.d, m.x, m.y);
    } else if (pointer.map.size === 1 && pointer.drag) {
      const dx = e.clientX - pointer.drag.x, dy = e.clientY - pointer.drag.y;
      if (Math.hypot(dx, dy) > 6) pointer.moved = true;
      if (pointer.moved) { view.cx = pointer.drag.cx - dx / view.s; view.cy = pointer.drag.cy - dy / view.s; applyView(false); }
    }
  });
  const release = e => {
    pointer.map.delete(e.pointerId);
    if (pointer.map.size < 2) pointer.pinch = null;
    if (pointer.map.size === 1) { const [p] = pointer.map.values(); pointer.drag = {x: p.x, y: p.y, cx: view.cx, cy: view.cy}; }
    if (pointer.map.size === 0) { pointer.drag = null; setTimeout(() => { pointer.moved = false; }, 0); }
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  stage.addEventListener("wheel", e => { e.preventDefault(); zoomAt(view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, {passive: false});
  const centerZoom = k => { const r = stage.getBoundingClientRect(); zoomAt(view.s * k, r.left + r.width / 2, r.top + r.height / 2); };
  $("zin").addEventListener("click", () => centerZoom(1.3));
  $("zout").addEventListener("click", () => centerZoom(1 / 1.3));
  $("zfit").addEventListener("click", () => fit());
  mini.addEventListener("click", e => {
    const r = mini.getBoundingClientRect();
    view.cx = (e.clientX - r.left) / r.width * W;
    view.cy = (e.clientY - r.top) / r.height * H;
    applyView(false);
  });

  function renderList() {
    const groups = mode === "all" ? plan.areas : [currentArea()];
    list.innerHTML = groups.map(a => {
      const rows = [...a.sectionIds, ...a.nonBookableIds].map(byId).map(item => {
        const st = stDef(itemState(item));
        return `<li><button type="button" data-id="${esc(item.id)}" aria-label="${esc(ariaLabel(item))}">${iconSvg(st)}` +
          `<span><b>${esc(item.label ?? "Unlabeled")}</b>${item.name ? " · " + esc(item.name) : ""} <small>${esc(item.type)}${item.bookable ? ` · up to ${item.maxCapacity} guests` : ""}</small></span>` +
          `<span class="st">${esc(st.text)}</span></button></li>`;
      }).join("");
      return `<li><h3>${esc(a.name)}</h3></li>${rows}`;
    }).join("");
    list.querySelectorAll("button[data-id]").forEach(b => b.addEventListener("click", () => select(b.dataset.id, true)));
  }

  function showInfo(item) {
    if (!item) {
      info.hidden = isPhone();
      const c = plan.counts;
      info.innerHTML = `<h2>${esc(plan.venue.name)}</h2><p>${c.bookableSections} bookable · ${c.areas} areas · ${c.nonBookable} not bookable</p>` +
        `<p>${mode === "all" ? "Pick an area or tap a table." : esc(currentArea().description || "")}</p>`;
      return;
    }
    const state = itemState(item), st = stDef(state), area = areaOf(item.id);
    const canBook = item.bookable && state === "available";
    info.hidden = false;
    info.innerHTML = `<h2>${iconSvg(st)} ${esc(item.label ?? "Unlabeled")}${item.name ? " · " + esc(item.name) : ""}<button type="button" class="close" aria-label="Close">×</button></h2><dl>` +
      `<dt>Status</dt><dd>${esc(st.text)}</dd><dt>Area</dt><dd>${esc(area ? area.name : "—")}</dd><dt>Type</dt><dd>${esc(item.type)}</dd>` +
      (item.bookable ? `<dt>Guests</dt><dd>Up to ${item.maxCapacity} · minimum covers ${item.includedGuests}</dd>` : "") +
      (item.reason ? `<dt>Why not bookable</dt><dd>${esc(item.reason)}</dd>` : "") + `</dl>` +
      (canBook ? `<div class="party"><span id="partyLabel">Party size</span><div class="stepper" role="group" aria-labelledby="partyLabel">` +
        `<button type="button" data-step="-1" aria-label="Fewer guests">−</button><output id="partySize" aria-live="polite"></output>` +
        `<button type="button" data-step="1" aria-label="More guests">+</button></div></div><table class="fees" id="fees"></table>` : "") +
      (item.bookable ? `<button type="button" class="book" ${canBook ? "" : "disabled"}>${canBook ? "Book this table (demo)" : esc(st.text) + " — pick another table"}</button>` : "");
    info.querySelector(".close").addEventListener("click", () => { selectedId = null; renderOverlay(); showInfo(null); });
    if (canBook) bindParty(item);
  }

  // Demo amounts only — real minimums / fees come from the section's minimumAmount / extraGuestFee / deposit.
  function demoPrices(item) {
    const minimum = item.type === "vipTable" ? 1000 : item.maxCapacity >= 6 ? 500 : item.maxCapacity >= 4 ? 300 : 150;
    return {minimum, extraFee: item.extraGuestFee ? (item.type === "vipTable" ? 50 : 40) : 0, depositRate: 0.25};
  }

  function bindParty(item) {
    const p = demoPrices(item);
    const asked = item.id === params.get("sel") ? Number(params.get("party")) : NaN;
    let party = Number.isInteger(asked) ? Math.min(item.maxCapacity, Math.max(1, asked)) : item.includedGuests;
    const usd = n => "$" + n.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const draw = () => {
      const extra = Math.max(0, party - item.includedGuests), extraTotal = extra * p.extraFee, deposit = p.minimum * p.depositRate;
      info.querySelector("#partySize").textContent = `${party} of ${item.maxCapacity}`;
      info.querySelectorAll(".stepper button").forEach(b => { b.disabled = b.dataset.step === "-1" ? party <= 1 : party >= item.maxCapacity; });
      info.querySelector("#fees").innerHTML =
        `<tr><td>Minimum spend (covers ${item.includedGuests} guests)</td><td>${usd(p.minimum)}</td></tr>` +
        (p.extraFee ? `<tr><td>Extra guests: ${extra} × ${usd(p.extraFee)} VIP entry</td><td>${usd(extraTotal)}</td></tr>` : "") +
        `<tr class="sub"><td>Pay today: deposit (25% of minimum)${extraTotal ? " + extra-guest fees" : ""}</td><td>${usd(deposit + extraTotal)}</td></tr>` +
        `<tr class="sub"><td>Balance of minimum at the venue</td><td>${usd(p.minimum - deposit)}</td></tr>` +
        `<tr class="note"><td colspan="2">Demo amounts — the club sets the real ones.</td></tr>`;
    };
    info.querySelectorAll(".stepper button").forEach(b => b.addEventListener("click", () => {
      party = Math.min(item.maxCapacity, Math.max(1, party + Number(b.dataset.step)));
      draw();
    }));
    draw();
  }

  function select(id, center) {
    const item = byId(id);
    if (!item) return;
    if (isPhone() && mode === "all") { const a = areaOf(id); if (a) setMode(a.id); }
    selectedId = id;
    if (center && mode !== "all") {
      const [x0, y0, x1, y1] = item.pixelBox;
      view.cx = (x0 + x1) / 2;
      view.cy = (y0 + y1) / 2;
    }
    applyView(true);
    showInfo(item);
    // The phone bottom sheet covers the lower half of the screen; keep the map above it.
    if (isPhone()) legendBar.scrollIntoView({block: "start"});
  }

  function setMode(next) {
    mode = next === "all" || plan.areas.some(a => a.id === next) ? next : "all";
    chips.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.area === mode)));
    selectedId = null;
    renderList();
    showInfo(null);
    fit();
  }

  async function load(file, area, sel) {
    legend = legend || await getJson("legend.json");
    const next = await getJson(file);
    if (!legend || !next) { info.hidden = false; info.textContent = `Could not load ${file}.`; return; }
    plan = next; planFile = file; states = DEMO_STATES[file] || {};
    W = plan.image.widthPx; H = plan.image.heightPx;
    document.querySelectorAll("[data-plan]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.plan === file)));
    map.setAttribute("aria-label", `${plan.venue.name} floor map`);
    buildLegend();
    buildChips();
    buildMinimap();
    setMode(area || (isPhone() ? plan.areas[0].id : "all"));
    if (sel) select(sel, true);
  }

  document.querySelectorAll("[data-plan]").forEach(b => b.addEventListener("click", () => load(b.dataset.plan)));
  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => plan && fit(), 120); });
  // A page scrollbar appearing after the list renders narrows the stage; refit so phone targets stay ≥ 44px.
  let stageWidth = 0;
  new ResizeObserver(() => {
    if (!plan || stage.clientWidth === stageWidth) return;
    stageWidth = stage.clientWidth;
    fit();
  }).observe(stage);
  load(params.get("plan") || "decades.json", params.get("area"), params.get("sel"));
})();
