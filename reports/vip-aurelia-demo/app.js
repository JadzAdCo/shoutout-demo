import {LEGEND, ICON_PATHS, renderPlanSvg, elementState, escapeXml} from "./plan-svg.mjs";

const $ = sel => document.querySelector(sel);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const HOLD_MS = 10 * 60 * 1000;
const money = cents => new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}).format(cents / 100);
const ui = {plan: null, scene: null, view: "3d", areaId: "overview", selectedId: null, overrides: {}, holdUntil: {}, party: {}, invoker: null, tick: null};
const debug = window.__aurelia = {ready: false, errors: []};
window.addEventListener("error", e => debug.errors.push(String(e.message)));
window.addEventListener("unhandledrejection", e => debug.errors.push(String(e.reason)));

const stateOf = el => elementState(el, ui.overrides);
const sectionById = id => ui.plan.sections.find(s => s.id === id);
const areaById = id => ui.plan.areas.find(a => a.id === id);

function iconSvg(key) {
  const st = LEGEND[key];
  const glyph = ICON_PATHS[st.icon] ? `<path d="${ICON_PATHS[st.icon]}" fill="none" stroke="${st.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  return `<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="10" fill="#111" stroke="${st.stroke}" stroke-width="${key === "selected" ? 3 : 1.6}"/>${glyph}</svg>`;
}

function toast(message) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
}

function renderLegend() {
  $("#legend").innerHTML = ["available", "held", "booked", "notBookable", "djBooth", "selected"]
    .map(k => `<span class="legend-item">${iconSvg(k)}${escapeXml(LEGEND[k].label)}</span>`).join("");
}

function renderChips() {
  const chips = $("#chips");
  chips.insertAdjacentHTML("beforeend", ui.plan.areas.map(a => `<button type="button" class="chip" data-area="${a.id}">${escapeXml(a.name)}</button>`).join(""));
  chips.addEventListener("click", e => {
    const btn = e.target.closest("[data-area]");
    if (btn) goArea(btn.dataset.area);
  });
  syncChips();
}

function syncChips() {
  document.querySelectorAll("#chips [data-area]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.area === ui.areaId)));
}

function goArea(areaId) {
  ui.areaId = areaId;
  syncChips();
  if (ui.view === "walk") setView("3d");
  if (ui.view === "2d" || !ui.scene) return render2d();
  if (areaId === "overview") ui.scene.overview();
  else ui.scene.focusArea(areaById(areaId));
}

function renderList() {
  $("#listBody").innerHTML = ui.plan.areas.map(a => `<div class="list-area"><h3>${escapeXml(a.name)}</h3><ul>${
    a.sectionIds.map(id => {
      const s = sectionById(id), key = stateOf(s), st = LEGEND[key];
      const aria = `${s.label}, ${s.typeLabel}, ${st.label}, up to ${s.maxCapacity} guests, minimum ${money(s.minimumAmount.amountCents)}`;
      return `<li><button type="button" class="row-btn" data-id="${s.id}" aria-label="${escapeXml(aria)}" aria-current="${s.id === ui.selectedId}">${iconSvg(key)}<span><strong>${escapeXml(s.label)}</strong> · ${escapeXml(s.typeLabel)}<br><span class="row-meta">Up to ${s.maxCapacity} · min ${money(s.minimumAmount.amountCents)}</span></span><span class="row-meta">${escapeXml(st.label)}</span></button></li>`;
    }).join("")}</ul></div>`).join("");
}

function render2d() {
  if (ui.view !== "2d") return;
  const host = $("#plan2d");
  const focusedId = document.activeElement?.closest?.("#plan2d .section")?.dataset.id;
  const area = ui.areaId === "overview" ? null : areaById(ui.areaId);
  host.innerHTML = renderPlanSvg(ui.plan, {interactive: true, stateOverrides: ui.overrides, selectedId: ui.selectedId, viewBox: area?.viewBox || null});
  if (focusedId) host.querySelector(`.section[data-id="${focusedId}"]`)?.focus();
}

function partyFor(s) {
  return ui.party[s.id] ?? Math.min(s.includedGuests, s.maxCapacity);
}

function priceLines(s, party) {
  const extra = Math.max(0, party - s.includedGuests);
  const fee = s.extraGuestFee?.amountCents ?? 0;
  return {extra, fee, extraTotal: extra * fee, total: s.minimumAmount.amountCents + extra * fee};
}

function sheetHtml(s) {
  const key = stateOf(s), st = LEGEND[key], area = areaById(s.areaId);
  const photo = area.photos[s.type === "vipArea" && area.photos[1] ? 1 : 0];
  const party = partyFor(s), p = priceLines(s, party);
  const mine = !!ui.holdUntil[s.id];
  const feeLine = s.extraGuestFee
    ? `<dt>Extra guests × VIP entry fee</dt><dd>${p.extra} × ${money(p.fee)} = ${money(p.extraTotal)}</dd>`
    : `<dt>Extra guests</dt><dd>None (minimum covers up to ${s.maxCapacity})</dd>`;
  let action;
  if (mine) action = `<button type="button" class="hold-btn" disabled>Held for you · <span id="holdCountdown"></span></button><button type="button" class="secondary-btn" id="releaseBtn">Release hold</button>`;
  else if (key === "available") action = `<button type="button" class="hold-btn" id="holdBtn">Hold this table · deposit ${money(s.deposit.amountCents)}</button>`;
  else action = `<button type="button" class="hold-btn" disabled>${key === "booked" ? "Already booked tonight" : "On hold by another guest"}</button>`;
  return `
    ${photo ? `<img src="${escapeXml(photo.file)}" alt="${escapeXml(photo.title)} — Aurelia public photo"><p class="photo-cap">${escapeXml(photo.note)}</p>` : ""}
    <p><span class="state-badge" style="border-color:${st.stroke}">${iconSvg(key)}${escapeXml(mine ? "Held by you (demo)" : st.label)}</span></p>
    <p>${escapeXml(s.description)}</p>
    <dl class="facts">
      <dt>Area</dt><dd>${escapeXml(area.name)}</dd>
      <dt>Type</dt><dd>${escapeXml(s.typeLabel)}</dd>
      <dt>Max capacity</dt><dd>${s.maxCapacity} guests</dd>
      <dt>Included in minimum</dt><dd>${s.includedGuests} guests</dd>
      <dt>Step-free access</dt><dd>${s.isAccessible ? "Yes" : "To confirm"}</dd>
    </dl>
    <div class="stepper" role="group" aria-label="Party size">
      <button type="button" id="partyMinus" aria-label="Fewer guests" ${party <= 1 ? "disabled" : ""}>−</button>
      <output id="partyOut" aria-live="polite" aria-label="Party size">${party}</output>
      <button type="button" id="partyPlus" aria-label="More guests" ${party >= s.maxCapacity ? "disabled" : ""}>+</button>
      <span class="muted">guests (max ${s.maxCapacity})</span>
    </div>
    <dl class="facts">
      <dt>Minimum spend</dt><dd>${money(s.minimumAmount.amountCents)}</dd>
      ${feeLine}
      <dt class="total">Estimated total</dt><dd class="total" id="totalOut">${money(p.total)}</dd>
      <dt>Deposit to hold</dt><dd>${money(s.deposit.amountCents)}</dd>
    </dl>
    ${action}
    <p class="fine">Demo only: holds are simulated in this page. Nothing is booked, no payment is taken, prices are demo values.</p>`;
}

function renderSheet(focusId) {
  const s = sectionById(ui.selectedId);
  if (!s) return;
  $("#sheetTitle").textContent = `${s.label} · ${s.typeLabel}`;
  $("#sheetBody").innerHTML = sheetHtml(s);
  updateCountdown();
  if (focusId) document.getElementById(focusId)?.focus();
}

function updateCountdown() {
  const el = document.getElementById("holdCountdown");
  if (!el || !ui.selectedId) return;
  const left = Math.max(0, (ui.holdUntil[ui.selectedId] || 0) - Date.now());
  el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
  if (left === 0) releaseHold(ui.selectedId, "Demo hold expired.");
}

function setSectionState(id) {
  ui.scene?.refreshState(id);
  renderList();
  render2d();
}

function holdTable(id) {
  ui.overrides[id] = "held";
  ui.holdUntil[id] = Date.now() + HOLD_MS;
  setSectionState(id);
  renderSheet("releaseBtn");
  toast("Held for 10 minutes (simulated, no backend).");
}

function releaseHold(id, message = "Hold released.") {
  delete ui.overrides[id];
  delete ui.holdUntil[id];
  setSectionState(id);
  if (ui.selectedId === id) renderSheet("holdBtn");
  toast(message);
}

function select(id, {invoker} = {}) {
  if (!sectionById(id)) return;
  ui.selectedId = id;
  ui.invoker = invoker || document.activeElement;
  ui.scene?.select(id, {focus: ui.view === "3d", sheet: window.innerWidth <= 600 ? "bottom" : "right"});
  renderList();
  render2d();
  $("#sheet").hidden = false;
  renderSheet();
  if (!invoker || !invoker.closest?.("#plan2d")) $("#sheetTitle").focus({preventScroll: true});
}

function closeSheet() {
  $("#sheet").hidden = true;
  ui.selectedId = null;
  ui.scene?.select(null);
  renderList();
  render2d();
  const inv = ui.invoker, id = inv?.dataset?.id;
  if (inv?.isConnected) inv.focus();
  else if (id) document.querySelector(`#plan2d .section[data-id="${id}"], #listBody .row-btn[data-id="${id}"]`)?.focus();
}

function setView(view) {
  ui.view = view;
  ["3d", "walk", "2d"].forEach(v => $(`#view${v === "3d" ? "3d" : v === "walk" ? "Walk" : "2d"}`).setAttribute("aria-pressed", String(v === view)));
  const show3d = view !== "2d" && !!ui.scene;
  $("#c3d").style.visibility = show3d ? "visible" : "hidden";
  $("#plan2d").hidden = show3d;
  $("#walkHint").hidden = view !== "walk";
  const touchy = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 820;
  $("#joystick").hidden = !(view === "walk" && touchy);
  if (ui.scene) {
    ui.scene.setWalk(view === "walk");
    if (view === "3d") (ui.areaId === "overview" ? ui.scene.overview() : ui.scene.focusArea(areaById(ui.areaId)));
    if (view === "walk") $("#c3d").focus({preventScroll: true});
  }
  if (view === "2d") render2d();
}

function wireJoystick() {
  const pad = $("#joystick"), knob = pad.querySelector(".knob");
  let active = null;
  const move = e => {
    const r = pad.getBoundingClientRect(), rad = r.width / 2;
    let dx = (e.clientX - r.left - rad) / rad, dy = (e.clientY - r.top - rad) / rad;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * rad * 0.55}px, ${dy * rad * 0.55}px)`;
    ui.scene?.setJoystick(dx, dy);
  };
  pad.addEventListener("pointerdown", e => { active = e.pointerId; pad.setPointerCapture(e.pointerId); move(e); });
  pad.addEventListener("pointermove", e => { if (active === e.pointerId) move(e); });
  const end = () => { active = null; knob.style.transform = ""; ui.scene?.setJoystick(0, 0); };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
}

function wireEvents() {
  $("#view3d").addEventListener("click", () => setView("3d"));
  $("#viewWalk").addEventListener("click", () => setView(ui.scene ? "walk" : "2d"));
  $("#view2d").addEventListener("click", () => setView("2d"));
  $("#viewList").addEventListener("click", () => toggleList());
  $("#closeList").addEventListener("click", () => toggleList(false));
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#listBody").addEventListener("click", e => { const b = e.target.closest(".row-btn"); if (b) select(b.dataset.id, {invoker: b}); });
  $("#plan2d").addEventListener("click", e => { const g = e.target.closest(".section"); if (g) select(g.dataset.id, {invoker: g}); });
  $("#plan2d").addEventListener("keydown", e => {
    const g = e.target.closest(".section");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(g.dataset.id, {invoker: g}); }
  });
  $("#sheetBody").addEventListener("click", e => {
    const s = sectionById(ui.selectedId);
    if (!s) return;
    if (e.target.closest("#partyMinus")) { ui.party[s.id] = Math.max(1, partyFor(s) - 1); renderSheet("partyMinus"); }
    if (e.target.closest("#partyPlus")) { ui.party[s.id] = Math.min(s.maxCapacity, partyFor(s) + 1); renderSheet("partyPlus"); }
    if (e.target.closest("#holdBtn")) holdTable(s.id);
    if (e.target.closest("#releaseBtn")) releaseHold(s.id);
  });
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (ui.view === "walk" && !e.target.closest?.("input, textarea, #sheet, #listPanel")) {
      if (k === "escape") return setView("3d");
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { e.preventDefault(); ui.scene.keyDown(k); }
      return;
    }
    if (k === "escape") { if (!$("#sheet").hidden) closeSheet(); else if (!$("#listPanel").hidden) toggleList(false); }
  });
  document.addEventListener("keyup", e => ui.scene?.keyUp(e.key.toLowerCase()));
  window.addEventListener("blur", () => ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].forEach(k => ui.scene?.keyUp(k)));
  wireJoystick();
}

function toggleList(force) {
  const panel = $("#listPanel");
  const open = force ?? panel.hidden;
  panel.hidden = !open;
  $("#viewList").setAttribute("aria-pressed", String(open));
  if (open) panel.querySelector(".row-btn")?.focus();
  else $("#viewList").focus();
}

async function init() {
  ui.plan = await (await fetch("./aurelia.json")).json();
  renderLegend();
  renderChips();
  renderList();
  wireEvents();
  try {
    const {webglAvailable, createScene} = await import("./scene3d.js");
    if (!webglAvailable()) throw new Error("WebGL unavailable");
    ui.scene = createScene({canvas: $("#c3d"), plan: ui.plan, stateOf, reducedMotion, onPick: id => select(id, {invoker: $("#c3d")})});
  } catch (err) {
    console.warn("3D disabled:", err.message);
    $("#fallback").hidden = false;
    ["#view3d", "#viewWalk"].forEach(s => { $(s).disabled = true; });
  }
  setView(ui.scene ? "3d" : "2d");
  ui.tick = setInterval(updateCountdown, 1000);
  Object.assign(debug, {
    ready: true, has3d: !!ui.scene, select, setView, goArea, holdTable, closeSheet, toggleList,
    get scene() { return ui.scene; }, get plan() { return ui.plan; }
  });
}

init().catch(err => { debug.errors.push(String(err)); console.error(err); });
