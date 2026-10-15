// Shared 2D renderer for floqr.vipFloorPlan/2 plans. Pure string output: runs in Node (plan.svg) and the browser (2D view).
// Legend mirrors reports/vip-floorplans/legend.json (floqr.vipLegend/1).

export const LEGEND = {
  available: {label: "Available", color: "#22c55e", stroke: "#4ade80", fillOpacity: 0.35, icon: "check", pattern: null},
  held: {label: "Held", color: "#f59e0b", stroke: "#fbbf24", fillOpacity: 0.5, icon: "clock", pattern: "stripes"},
  booked: {label: "Booked", color: "#ef4444", stroke: "#f87171", fillOpacity: 0.55, icon: "cross", pattern: "hatch"},
  notBookable: {label: "Not bookable", color: "#9ca3af", stroke: "#9ca3af", fillOpacity: 0.22, icon: "lock", pattern: "dots", dash: "4 3"},
  djBooth: {label: "DJ Booth", color: "#3b82f6", stroke: "#60a5fa", fillOpacity: 0.45, icon: "music", pattern: null},
  selected: {label: "Selected", color: "#ffffff", stroke: "#fde047", strokeWidth: 4}
};

export const AREA_OUTLINE = {stroke: "#e5e7eb", dash: "8 5", labelColor: "#ffffff"};
export const MAP_BG = "#111111";

// Stroke-only icon paths centred on 0,0 in a 16×16 box. Path2D-compatible (also used for 3D label sprites).
export const ICON_PATHS = {
  check: "M-6 0L-2 4L6 -5",
  clock: "M0 -7A7 7 0 1 1 0 7A7 7 0 1 1 0 -7M0 -4V0L3 2",
  cross: "M-5 -5L5 5M5 -5L-5 5",
  lock: "M-5 -1H5V7H-5Z M-3 -1V-4A3 3 0 0 1 3 -4V-1",
  music: "M-4 5A2 2 0 1 0 -4 5.01M-2 5V-6L6 -7V3M6 3A2 2 0 1 0 6 3.01"
};

export function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
}

export function elementState(el, overrides = {}) {
  if (overrides[el.id]) return overrides[el.id];
  if (el.bookable === false) return el.type === "djBooth" ? "djBooth" : "notBookable";
  return el.demoState || "available";
}

function px(plan, n, axis) {
  return n * (axis === "x" ? plan.image.widthPx : plan.image.heightPx);
}

function shapeMarkup(plan, el, attrs) {
  const W = plan.image.widthPx, H = plan.image.heightPx;
  if (el.shape === "circle" && el.circle) {
    const c = el.circle;
    return `<ellipse cx="${(c.cx * W).toFixed(1)}" cy="${(c.cy * H).toFixed(1)}" rx="${(c.rx * W).toFixed(1)}" ry="${(c.ry * H).toFixed(1)}" ${attrs}/>`;
  }
  if (el.shape === "polygon" && el.polygon?.length) {
    const pts = el.polygon.map(([x, y]) => `${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join(" ");
    return `<polygon points="${pts}" ${attrs}/>`;
  }
  const r = el.rect;
  return `<rect x="${px(plan, r.x, "x").toFixed(1)}" y="${px(plan, r.y, "y").toFixed(1)}" width="${px(plan, r.w, "x").toFixed(1)}" height="${px(plan, r.h, "y").toFixed(1)}" rx="6" ${attrs}/>`;
}

export function centerOf(plan, el) {
  if (el.shape === "circle" && el.circle) return [el.circle.cx * plan.image.widthPx, el.circle.cy * plan.image.heightPx];
  const b = el.bounds || el.rect;
  return [(b.x + b.w / 2) * plan.image.widthPx, (b.y + b.h / 2) * plan.image.heightPx];
}

function defsMarkup() {
  return `<defs>
  <pattern id="pat-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="none"/><line x1="0" y1="0" x2="0" y2="10" stroke="#111" stroke-opacity=".55" stroke-width="4"/></pattern>
  <pattern id="pat-hatch" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" stroke="#111" stroke-opacity=".5" stroke-width="2"/></pattern>
  <pattern id="pat-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.6" fill="#e5e7eb" fill-opacity=".55"/></pattern>
</defs>`;
}

function iconMarkup(icon, x, y, color, scale = 1.25) {
  const d = ICON_PATHS[icon];
  if (!d) return "";
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})" aria-hidden="true"><circle r="10" fill="#111" fill-opacity=".85" stroke="${color}" stroke-width="1.5"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

function elementMarkup(plan, el, {stateOverrides, selectedId, interactive, areaName}) {
  const state = elementState(el, stateOverrides);
  const st = LEGEND[state];
  const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : "";
  const base = shapeMarkup(plan, el, `fill="${st.color}" fill-opacity="${st.fillOpacity}" stroke="${st.stroke}" stroke-width="3"${dash}`);
  const pattern = st.pattern ? shapeMarkup(plan, el, `fill="url(#pat-${st.pattern})" stroke="none"`) : "";
  const isSel = selectedId === el.id;
  const sel = isSel ? shapeMarkup(plan, el, `class="sel-ring" fill="none" stroke="${LEGEND.selected.stroke}" stroke-width="${LEGEND.selected.strokeWidth}"`) : "";
  const [cx, cy] = centerOf(plan, el);
  const label = escapeXml(el.label || el.name || "");
  const small = el.bookable === false;
  const fs = small ? 15 : 20;
  const text = `<text x="${cx.toFixed(1)}" y="${(cy + (small ? 5 : -2)).toFixed(1)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${label}</text>`;
  const stateText = small ? "" : `<text x="${cx.toFixed(1)}" y="${(cy + 18).toFixed(1)}" text-anchor="middle" font-size="13" fill="#f3f4f6" stroke="#000" stroke-width="3" paint-order="stroke">${escapeXml(st.label)}</text>`;
  const icon = small ? "" : iconMarkup(st.icon, cx + (el.shape === "circle" ? 0 : 0), cy - 30, st.stroke, 0.95);
  if (!interactive || el.bookable === false) {
    return `<g class="el el-${escapeXml(el.type)}" data-state="${state}">${base}${pattern}${sel}${icon}${text}${stateText}</g>`;
  }
  const aria = `${label}, ${escapeXml(el.typeLabel || el.type)}, ${escapeXml(areaName || "")}, ${escapeXml(st.label)}, up to ${el.maxCapacity} guests`;
  return `<g class="el section${isSel ? " is-selected" : ""}" data-id="${escapeXml(el.id)}" data-state="${state}" role="button" tabindex="0" aria-pressed="${isSel}" aria-label="${aria}">${base}${pattern}${sel}${icon}${text}${stateText}</g>`;
}

export function renderPlanSvg(plan, opts = {}) {
  const {stateOverrides = {}, selectedId = null, interactive = false, viewBox = null, title = true} = opts;
  const W = plan.image.widthPx, H = plan.image.heightPx;
  const vb = viewBox ? `${viewBox.x * W} ${viewBox.y * H} ${viewBox.w * W} ${viewBox.h * H}` : `0 0 ${W} ${H}`;
  const areaById = Object.fromEntries(plan.areas.map(a => [a.id, a]));
  const m = plan.model3d;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="${interactive ? "group" : "img"}" aria-label="${escapeXml(plan.venue.name)} floor plan (demo)" font-family="system-ui, Segoe UI, Arial, sans-serif">`);
  if (title) parts.push(`<title>${escapeXml(plan.venue.name)} — VIP floor plan (demo)</title>`);
  parts.push(defsMarkup());
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${MAP_BG}"/>`);
  const wallT = 10;
  parts.push(`<rect x="${wallT / 2}" y="${wallT / 2}" width="${W - wallT}" height="${H - wallT}" fill="#1b1d24" stroke="#d1d5db" stroke-width="${wallT}"/>`);
  if (m?.mezzanine) {
    const r = m.mezzanine.rect;
    parts.push(`<rect x="${r.x * W}" y="${r.y * H}" width="${r.w * W}" height="${r.h * H}" fill="#2a2433" stroke="#a78bfa" stroke-width="2"/>`);
    parts.push(`<text x="${(r.x + r.w / 2) * W}" y="${(r.y + r.h) * H - 10}" text-anchor="middle" font-size="13" fill="#c4b5fd">MEZZANINE +${m.mezzanine.elevationM} m</text>`);
  }
  for (const door of m?.doors || []) {
    const r = door.rect;
    parts.push(`<rect x="${r.x * W}" y="${r.y * H}" width="${r.w * W}" height="${r.h * H}" fill="${door.kind === "exit" ? "#16a34a" : "#fde68a"}"/>`);
  }
  for (const area of plan.areas) {
    const b = area.bounds;
    parts.push(`<rect x="${b.x * W}" y="${b.y * H}" width="${b.w * W}" height="${b.h * H}" fill="none" stroke="${AREA_OUTLINE.stroke}" stroke-dasharray="${AREA_OUTLINE.dash}" stroke-width="2" rx="10"/>`);
    parts.push(`<text x="${b.x * W + 10}" y="${b.y * H + 20}" font-size="15" font-weight="600" fill="${AREA_OUTLINE.labelColor}" stroke="#000" stroke-width="3" paint-order="stroke">${escapeXml(area.name)}</text>`);
  }
  for (const el of plan.nonBookable) parts.push(elementMarkup(plan, el, {stateOverrides, selectedId, interactive}));
  for (const el of plan.sections) parts.push(elementMarkup(plan, el, {stateOverrides, selectedId, interactive, areaName: areaById[el.areaId]?.name}));
  parts.push(`<text x="${W - 14}" y="${H - 16}" text-anchor="end" font-size="13" fill="#9ca3af">DEMO · modeled layout, not a survey · N ↑</text>`);
  parts.push(`</svg>`);
  return parts.join("\n");
}
