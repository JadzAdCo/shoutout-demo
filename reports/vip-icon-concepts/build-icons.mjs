// VIP / table-reservation icon concepts (design only — not wired into the app).
// Generates hand-built SVGs (viewBox 0 0 64 64, no fonts, no raster) + preview.html.
// Usage: node build-icons.mjs   then   node render.mjs
import {writeFileSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const PINK = "#ff4fd8", CYAN = "#5ee7ff", GOLD = "#ffd45a", GOLD_DARK = "#c48f22", INK_TOP = "#24175a", INK_BOTTOM = "#0c0a2a";
const SIZES = [16, 24, 32, 48, 96, 180];
const r = n => Math.round(n * 100) / 100;

const el = (tag, attrs) => `<${tag} ${Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== "")
  .map(([k, v]) => `${k}="${v}"`).join(" ")}/>`;

// ---------- hand-built letterforms (10 units tall) ----------
const GLYPHS = {
  regular: {w: 20.6, V: [[0, 0], [2.7, 0], [4, 5.9], [5.3, 0], [8, 0], [5.35, 10], [2.65, 10]], I: [9.3, 11.9],
    P: {x: 13.2, t: 2.6, xa: 17.4, b: 6.4, ht: 2.3, hb: 4.1, hx: 17.3}},
  heavy: {w: 23.3, V: [[0, 0], [3.2, 0], [4.3, 5.2], [5.4, 0], [8.6, 0], [5.85, 10], [2.75, 10]], I: [10.4, 13.6],
    P: {x: 15.4, t: 3.2, xa: 20, b: 6.6, ht: 2.4, hb: 4.2, hx: 19.7}}
};

function vip(set, cx, cy, s) {
  const g = GLYPHS[set];
  const ox = cx - (g.w * s) / 2, oy = cy - 5 * s;
  const X = v => r(ox + v * s), Y = v => r(oy + v * s);
  const poly = pts => "M" + pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L") + "Z";
  const [i0, i1] = g.I;
  const P = g.P, R = r((P.b / 2) * s), hr = r(((P.hb - P.ht) / 2) * s);
  return [
    poly(g.V),
    poly([[i0, 0], [i1, 0], [i1, 10], [i0, 10]]),
    `M${X(P.x)} ${Y(0)}H${X(P.xa)}A${R} ${R} 0 0 1 ${X(P.xa)} ${Y(P.b)}H${X(P.x + P.t)}V${Y(10)}H${X(P.x)}Z`,
    `M${X(P.x + P.t)} ${Y(P.ht)}H${X(P.hx)}A${hr} ${hr} 0 0 1 ${X(P.hx)} ${Y(P.hb)}H${X(P.x + P.t)}Z`
  ].join("");
}

const vipText = (set, cx, cy, s, fill) => el("path", {d: vip(set, cx, cy, s), fill, "fill-rule": "evenodd"});

function crown(cx, top, s, fill, jewels) {
  const pts = [[0, 7], [0, 1.6], [2.7, 4.2], [5, 0], [7.3, 4.2], [10, 1.6], [10, 7]];
  const X = v => r(cx - 5 * s + v * s), Y = v => r(top + v * s);
  let out = el("path", {d: "M" + pts.map(([x, y]) => `${X(x)} ${Y(y)}`).join("L") + "Z", fill});
  if (jewels) out += [[0, 1.6], [5, 0], [10, 1.6]].map(([x, y]) => el("circle", {cx: X(x), cy: Y(y), r: r(0.95 * s), fill})).join("");
  return out;
}

function star(cx, cy, R, ri) {
  let d = "";
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? ri : R;
    d += (k ? "L" : "M") + r(cx + rr * Math.cos(a)) + " " + r(cy + rr * Math.sin(a));
  }
  return d + "Z";
}

// Table top + two splayed legs (a center pedestal reads as a monitor stand).
function table(fill, {x, y, w, h, legTop, legBottom, legY, legEnd}) {
  const [t0, t1] = legTop, [b0, b1] = legBottom;
  const leg = side => side < 0
    ? `M${t0} ${legY}H${t1}L${b1} ${legEnd}H${b0}Z`
    : `M${64 - t0} ${legY}H${64 - t1}L${64 - b1} ${legEnd}H${64 - b0}Z`;
  return el("rect", {x, y, width: w, height: h, rx: h / 2, fill}) + el("path", {d: leg(-1) + leg(1), fill});
}

// Open book seen from the front, standing on `base` (spine bottom), each page `w` wide.
function bookPages(cx, base, w) {
  const k = w / 14;
  const side = dir => `M${cx} ${base - 17.5}C${r(cx + dir * 4 * k)} ${base - 21} ${r(cx + dir * 9 * k)} ${base - 21.5} ${r(cx + dir * w)} ${base - 20}` +
    `V${base - 2.5}C${r(cx + dir * (w - 5 * k))} ${base - 4} ${r(cx + dir * (w - 10 * k))} ${base - 3.5} ${cx} ${base}Z`;
  return [side(-1), side(1)];
}

function paint(mode, id) {
  return mode === "color"
    ? {line: `url(#${id}-g)`, ink: `url(#${id}-ink)`, ink2: "#0b0a24", text: "#ffffff", gold: GOLD, goldDark: GOLD_DARK, pink: PINK, onGold: "#15103a"}
    : {line: "currentColor", ink: "none", ink2: "none", text: "currentColor", gold: "currentColor", goldDark: "currentColor", pink: "currentColor", onGold: "none"};
}

// Soft neon halo (plain wide stroke, no SVG filter — survives Canva / Figma import).
const glow = (mode, id, geoms, width) => mode !== "color" ? "" :
  `<g fill="none" stroke="url(#${id}-g)" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" opacity=".22">${geoms.map(([t, a]) => el(t, a)).join("")}</g>`;

// ---------- concepts ----------
const CONCEPTS = [
  {
    key: "a", slug: "vip-a-ledger", name: "A · VIP Ledger (recommended)",
    blurb: "Closed reservation book: crown + VIP on the cover, page block on the right, pink ribbon bookmark. Most literal \"book a VIP\" read.",
    app: {cx: 32.1, cy: 33, s: 0.72, tile: 0.84},
    draw(mode, id, size) {
      const p = paint(mode, id);
      if (size === "small") {
        return [
          el("path", {d: "M48 12h3a3 3 0 0 1 3 3v32a3 3 0 0 1-3 3h-3", fill: p.ink2, stroke: p.line, "stroke-width": 4, "stroke-linejoin": "round"}),
          el("rect", {x: 10, y: 7, width: 38, height: 46, rx: 5, fill: p.ink, stroke: p.line, "stroke-width": 4.5}),
          crown(29, 15.5, 1.4, p.gold, false),
          vipText("heavy", 29, 35.5, 1.2, p.text)
        ].join("");
      }
      const cover = ["rect", {x: 11, y: 6, width: 36, height: 46, rx: 4}];
      const pages = ["path", {d: "M47 11.5h3.5a3 3 0 0 1 3 3v33a3 3 0 0 1-3 3H47"}];
      return [
        glow(mode, id, [cover, pages], 7),
        el("path", {d: mode === "color" ? "M37 50v11l2.75-2.6L42.5 61V50z" : "M37 54.6V61l2.75-2.6L42.5 61v-6.4z", fill: p.pink}),
        el("path", {...pages[1], fill: p.ink2, stroke: p.line, "stroke-width": 2.5, "stroke-linejoin": "round"}),
        el("path", {d: "M50.4 15v32", fill: "none", stroke: p.line, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0.6}),
        el("rect", {...cover[1], fill: p.ink, stroke: p.line, "stroke-width": 3}),
        el("path", {d: "M17 6v46", fill: "none", stroke: p.line, "stroke-width": 2}),
        crown(32, 13, 1.2, p.gold, true),
        vipText("regular", 32, 30.5, 1.1, p.text),
        el("path", {d: "M22.5 41.5H42", fill: "none", stroke: p.line, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.6})
      ].join("");
    }
  },
  {
    key: "b", slug: "vip-b-table-book", name: "B · Book + Reserved Table",
    blurb: "Open reservation book (gold check = booked) on a bistro table beside a crowned RESERVED tent card. Strongest \"table\" read; no letters, so it stays clean when small.",
    app: {cx: 32, cy: 32.3, s: 0.8, tile: 0.88},
    draw(mode, id, size) {
      const p = paint(mode, id);
      if (size === "small") {
        const [L, R] = bookPages(20, 43, 14);
        return `<g transform="translate(0 -4.5)">` + [
          el("path", {d: L, fill: p.ink, stroke: p.line, "stroke-width": 4, "stroke-linejoin": "round"}),
          el("path", {d: R, fill: p.ink, stroke: p.line, "stroke-width": 4, "stroke-linejoin": "round"}),
          el("path", {d: "M23.6 32.2l2.9 2.9 4.6-6", fill: "none", stroke: p.gold, "stroke-width": 3.4, "stroke-linecap": "round", "stroke-linejoin": "round"}),
          el("path", {d: "M53 24h2l4 19h-2.5z", fill: p.goldDark, opacity: mode === "color" ? 1 : 0.5}),
          el("path", {d: "M39.5 43L43 24h10l3.5 19z" + star(48, 34, 5, 2.2), fill: p.gold, "fill-rule": "evenodd"}),
          crown(48, 14, 1, p.gold, false),
          table(p.line, {x: 4, y: 43, w: 56, h: 6, legY: 48, legEnd: 59, legTop: [8, 14], legBottom: [6.5, 11.5]})
        ].join("") + "</g>";
      }
      const [L, R] = bookPages(23, 42, 14);
      return `<g transform="translate(0 -5)">` + [
        glow(mode, id, [["path", {d: L}], ["path", {d: R}]], 6.5),
        el("path", {d: L, fill: p.ink, stroke: p.line, "stroke-width": 2.5, "stroke-linejoin": "round"}),
        el("path", {d: R, fill: p.ink, stroke: p.line, "stroke-width": 2.5, "stroke-linejoin": "round"}),
        el("path", {d: "M12 27.3l8 1.4M12 31.6l8 1.2M12 35.9l6 1", fill: "none", stroke: mode === "color" ? "#ffffff" : "currentColor", "stroke-width": 1.4, "stroke-linecap": "round", opacity: 0.7}),
        el("path", {d: "M26.5 31.5l3 3 5-6.5", fill: "none", stroke: p.gold, "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round"}),
        el("path", {d: "M52 26h1.6l3.9 16H55z", fill: p.goldDark, opacity: mode === "color" ? 1 : 0.5}),
        el("path", {d: "M41 42l3-16h8l3 16z" + star(48, 34.5, 4, 1.7), fill: p.gold, "fill-rule": "evenodd"}),
        crown(48, 18.5, 0.8, p.gold, false),
        table(p.line, {x: 6, y: 42, w: 52, h: 4.5, legY: 46, legEnd: 56, legTop: [10, 14], legBottom: [8.5, 12]})
      ].join("") + "</g>";
    }
  },
  {
    key: "c", slug: "vip-c-ticket", name: "C · VIP Reservation Ticket",
    blurb: "Ticket / reservation tag: crown + VIP on the main body, perforation dots, gold booked-check stub. Reads as \"VIP pass\" first, booking second.",
    app: {cx: 32, cy: 32, s: 0.76, tile: 0.86},
    draw(mode, id, size) {
      const p = paint(mode, id);
      if (size === "small") {
        return [
          el("path", {d: "M8 14h34.5a4.5 4.5 0 0 0 9 0H56a5 5 0 0 1 5 5v26a5 5 0 0 1-5 5h-4.5a4.5 4.5 0 0 0-9 0H8a5 5 0 0 1-5-5V19a5 5 0 0 1 5-5z",
            fill: p.ink, stroke: p.line, "stroke-width": 4.5, "stroke-linejoin": "round"}),
          vipText("heavy", 24.75, 32, 1.35, p.text),
          mode === "color"
            ? el("circle", {cx: 54.2, cy: 32, r: 4.3, fill: p.gold})
            : el("circle", {cx: 54.2, cy: 32, r: 3.6, fill: "none", stroke: "currentColor", "stroke-width": 1.6}),
          el("path", {d: "M51.9 32.2l1.6 1.6 2.9-3.4", fill: "none", stroke: mode === "color" ? p.onGold : "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round"})
        ].join("");
      }
      const ticket = ["path", {d: "M9 13h32a4 4 0 0 0 8 0h6a5 5 0 0 1 5 5v28a5 5 0 0 1-5 5h-6a4 4 0 0 0-8 0H9a5 5 0 0 1-5-5V18a5 5 0 0 1 5-5z"}];
      return [
        glow(mode, id, [ticket], 7),
        el("path", {...ticket[1], fill: p.ink, stroke: p.line, "stroke-width": 3, "stroke-linejoin": "round"}),
        el("path", {d: "M45 20v24.5", fill: "none", stroke: p.line, "stroke-width": 2.2, "stroke-linecap": "round", "stroke-dasharray": "0 4.1"}),
        crown(24.5, 20, 0.75, p.gold, false),
        vipText("regular", 24.5, 35, 1.3, p.text),
        mode === "color"
          ? el("circle", {cx: 52.5, cy: 32, r: 4.6, fill: p.gold})
          : el("circle", {cx: 52.5, cy: 32, r: 4, fill: "none", stroke: "currentColor", "stroke-width": 1.8}),
        el("path", {d: "M50.3 32.2l1.6 1.6 3-3.5", fill: "none", stroke: mode === "color" ? p.onGold : "currentColor", "stroke-width": 1.9, "stroke-linecap": "round", "stroke-linejoin": "round"})
      ].join("");
    }
  },
  {
    key: "d", slug: "vip-d-reserved-book", name: "D · Reserved Book-Tent (combo runner-up)",
    blurb: "A book opened face-down so it stands like a RESERVED tent card on a VIP table: banded spine = ridge, page edges on the side, ribbon bookmark hanging over the table edge, crown + VIP on the face. Book + VIP + table in one silhouette.",
    app: {cx: 32, cy: 31, s: 0.67, tile: 0.8},
    draw(mode, id, size) {
      const p = paint(mode, id);
      if (size === "small") {
        return [
          crown(32, 3, 1.5, p.gold, false),
          el("path", {d: "M15.5 20.5h33l5 23h-43z", fill: p.ink, stroke: p.line, "stroke-width": 4.5, "stroke-linejoin": "round"}),
          el("rect", {x: 13, y: 15, width: 38, height: 5.5, rx: 2.75, fill: p.line}),
          vipText("heavy", 32, 32.5, 1.15, p.text),
          table(p.line, {x: 1.5, y: 43.5, w: 61, h: 5.5, legY: 48, legEnd: 59, legTop: [4, 9.5], legBottom: [4, 9.5]})
        ].join("");
      }
      const face = ["path", {d: "M17.5 21h29l5 23h-39z"}];
      const side = ["path", {d: "M46.5 21H49l6 23h-3.5z"}];
      const bands = "M21 17.6h1.2v2.3H21zM41.8 17.6H43v2.3h-1.2z";
      return [
        glow(mode, id, [face, side], 7),
        crown(32, 5, 1.3, p.gold, true),
        el("path", {...side[1], fill: p.ink2, stroke: p.line, "stroke-width": 2.5, "stroke-linejoin": "round"}),
        el("path", {d: "M48.6 24.5l4 17", fill: "none", stroke: p.line, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0.6}),
        el("path", {...face[1], fill: p.ink, stroke: p.line, "stroke-width": 3, "stroke-linejoin": "round"}),
        el("path", {d: "M17.25 16.5h29.5a2.25 2.25 0 0 1 0 4.5h-29.5a2.25 2.25 0 0 1 0-4.5z" + bands, fill: p.line, "fill-rule": "evenodd"}),
        vipText("regular", 32, 32, 1.15, p.text),
        el("path", {d: "M25 40.5h14", fill: "none", stroke: p.line, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.6}),
        table(p.line, {x: 3, y: 44, w: 58, h: 4.5, legY: 48, legEnd: 58, legTop: [5, 9.5], legBottom: [5, 9.5]}),
        el("path", {d: "M37.5 43v10.5l1.8-1.7 1.8 1.7V43z", fill: p.pink})
      ].join("");
    }
  }
];

// ---------- documents ----------
const colorDefs = id =>
  `<linearGradient id="${id}-g" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PINK}"/><stop offset="1" stop-color="${CYAN}"/></linearGradient>` +
  `<linearGradient id="${id}-ink" x1="0" y1="4" x2="0" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${INK_TOP}"/><stop offset="1" stop-color="${INK_BOTTOM}"/></linearGradient>`;

const appDefs = id => colorDefs(id) +
  `<linearGradient id="${id}-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1b0f45"/><stop offset=".6" stop-color="#0a0f33"/><stop offset="1" stop-color="#060918"/></linearGradient>` +
  `<radialGradient id="${id}-hp" cx="12" cy="10" r="34" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${PINK}" stop-opacity=".38"/><stop offset="1" stop-color="${PINK}" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="${id}-hc" cx="54" cy="56" r="34" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${CYAN}" stop-opacity=".3"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></radialGradient>`;

function svgDoc(id, title, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="${id}-t">\n` +
    `<title id="${id}-t">${title}</title>\n${defs ? `<defs>${defs}</defs>\n` : ""}${body}\n</svg>\n`;
}

function appDoc(c, maskable) {
  const id = `${c.slug}-${maskable ? "maskable" : "app"}`;
  const rx = maskable ? 0 : 14;
  const {cx, cy} = c.app;
  const s = maskable ? c.app.s : c.app.tile;
  const body = [
    el("rect", {width: 64, height: 64, rx, fill: `url(#${id}-bg)`}),
    el("rect", {width: 64, height: 64, rx, fill: `url(#${id}-hp)`}),
    el("rect", {width: 64, height: 64, rx, fill: `url(#${id}-hc)`}),
    maskable ? "" : el("rect", {x: 0.5, y: 0.5, width: 63, height: 63, rx: 13.5, fill: "none", stroke: "#ffffff", "stroke-opacity": 0.1}),
    `<g transform="translate(32 32) scale(${s}) translate(${-cx} ${-cy})">${c.draw("color", id, "regular")}</g>`
  ].join("");
  return svgDoc(id, `FLOQR VIP booking app icon ${maskable ? "(maskable) " : ""}— concept ${c.key.toUpperCase()}`, appDefs(id), body);
}

const files = {};
for (const c of CONCEPTS) {
  for (const size of ["regular", "small"]) {
    for (const mode of ["color", "mono"]) {
      const id = `${c.slug}-${mode}${size === "small" ? "-small" : ""}`;
      const title = `FLOQR VIP booking icon — concept ${c.key.toUpperCase()} (${mode === "color" ? "full color" : "monochrome"}${size === "small" ? ", small" : ""})`;
      files[`${id}.svg`] = svgDoc(id, title, mode === "color" ? colorDefs(id) : "", c.draw(mode, id, size));
    }
  }
  files[`${c.slug}-app.svg`] = appDoc(c, false);
  files[`${c.slug}-maskable.svg`] = appDoc(c, true);
}
for (const [name, svg] of Object.entries(files)) writeFileSync(join(OUT, name), svg);

// ---------- preview sheet ----------
const inlineMono = (name, px) => files[name]
  .replace(/ width="64" height="64" role="img" aria-labelledby="[^"]+"/, ` width="${px}" height="${px}" aria-hidden="true"`)
  .replace(/<title[^>]*>.*?<\/title>\n/, "").trim();
const dataUrl = (name, color) => "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(color ? files[name].replace(/currentColor/g, color) : files[name]);

const img = (name, px) => `<img src="./${name}" width="${px}" height="${px}" alt="">`;
const cell = (inner, px) => `<div class="cell"><div class="slot" style="width:${Math.max(px, 24)}px;height:${px}px">${inner}</div><small>${px}</small></div>`;

function rows(c) {
  const list = [
    ["Full color", px => img(`${c.slug}-color.svg`, px)],
    ["Full color · small", px => img(`${c.slug}-color-small.svg`, px)],
    ["Mono (currentColor)", px => inlineMono(`${c.slug}-mono.svg`, px)],
    ["Mono · small", px => inlineMono(`${c.slug}-mono-small.svg`, px)],
    ["App icon (iOS / PWA)", px => img(`${c.slug}-app.svg`, px)],
    ["Size-aware ★", px => img(`${c.slug}-color${px <= 24 ? "-small" : ""}.svg`, px)]
  ];
  return list.map(([label, fn]) => `<div class="row"><span class="lbl">${label}</span>${SIZES.map(px => cell(fn(px), px)).join("")}</div>`).join("");
}

function loupe(c) {
  const items = [
    ["color 16", `${c.slug}-color.svg`, 16], ["color·small 16", `${c.slug}-color-small.svg`, 16],
    ["color 24", `${c.slug}-color.svg`, 24], ["color·small 24", `${c.slug}-color-small.svg`, 24],
    ["mono·small 16", `${c.slug}-mono-small.svg`, 16, true], ["mono·small 24", `${c.slug}-mono-small.svg`, 24, true]
  ];
  const strip = (bg, ink) => items.map(([label, name, px, mono]) =>
    `<figure><canvas width="${px}" height="${px}" data-bg="${bg}" data-src="${dataUrl(name, mono ? ink : null)}" style="width:${px * 5}px;height:${px * 5}px"></canvas><figcaption>${label}</figcaption></figure>`).join("");
  return `<div class="loupe dark">${strip("#0b1030", "#f4f6ff")}</div><div class="loupe light">${strip("#f4f6fb", "#10132a")}</div>`;
}

function safeZone(c) {
  return `<div class="safe"><div class="safe-box">${img(`${c.slug}-maskable.svg`, 180)}<span class="ring"></span></div><small>Maskable 180 + 80% safe circle</small></div>` +
    `<div class="safe"><div class="safe-box circle">${img(`${c.slug}-maskable.svg`, 180)}</div><small>Android circle mask</small></div>`;
}

const shoutout = "../../images/shoutout-logo.png";
const iconCards = CONCEPTS.map(c =>
  `<button class="icon-card" type="button"><img class="icon-img vip" src="./${c.slug}-app.svg" alt=""><span class="icon-title">Book VIP · ${c.key.toUpperCase()}</span></button>`).join("");
const vipTiles = CONCEPTS.map(c =>
  `<a class="category-card vip-card" href="#"><span class="tile-ico">${inlineMono(`${c.slug}-mono${"-small"}.svg`, 24)}</span>VIP Tables · ${c.key.toUpperCase()}</a>`).join("");
const menuItems = CONCEPTS.map(c =>
  `<li><span class="mi">${inlineMono(`${c.slug}-mono-small.svg`, 20)}</span>Book VIP <em>${c.key.toUpperCase()}</em></li>`).join("");
const homeIcons = `<div class="home-ico"><img src="${shoutout}" alt=""><span>ShoutOut</span></div>` +
  CONCEPTS.map(c => `<div class="home-ico"><img src="./${c.slug}-app.svg" alt=""><span>VIP ${c.key.toUpperCase()}</span></div>`).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FLOQR · VIP / Table Reservation icon concepts</title>
<style>
:root{--text:#f4f6ff;--muted:#c9cee5;--lime:#dfff5a;--line:rgba(255,255,255,.18)}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,Segoe UI,Arial,sans-serif;color:var(--text);background:#080b1c}
h1{font-size:28px;margin:0 0 6px}h2{font-size:22px;margin:0 0 4px}p{margin:4px 0 14px;color:var(--muted);max-width:980px;line-height:1.45}
.wrap{padding:28px 32px}
.app-bg{background:radial-gradient(circle at 18% 8%,rgba(244,58,191,.32),transparent 32%),radial-gradient(circle at 82% 18%,rgba(38,216,255,.34),transparent 36%),linear-gradient(135deg,#07101c,#071b63 68%,#090b12)}
.mock{padding:28px 32px 34px}
.brand{display:block;width:220px;max-height:70px;object-fit:contain;margin:0 0 6px}
.category-or{color:var(--lime);font-weight:1000;letter-spacing:.12em;text-transform:uppercase;margin:14px 0 8px}
.icon-row{display:flex;flex-wrap:wrap;gap:22px 26px;align-items:flex-start}
.icon-card{display:grid;justify-items:center;gap:6px;padding:0;border:0;background:none;color:var(--text);cursor:pointer;font:inherit}
.icon-img{display:block;width:132px;height:132px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(38,216,255,.48))}
.icon-img.vip{filter:drop-shadow(0 0 16px rgba(255,79,216,.35)) drop-shadow(0 0 18px rgba(38,216,255,.3))}
.icon-title{font-size:16px;font-weight:900;white-space:nowrap}
.tile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:22px;max-width:980px}
.category-card{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:10px 12px;border-radius:14px;font-size:15px;font-weight:900;color:#fff;text-decoration:none;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.07));box-shadow:0 22px 70px rgba(0,0,0,.35)}
.mingl-card{background:linear-gradient(90deg,#101724,#263b63 48%,#f43abf)}
.bartr-card{color:#06101c;background:linear-gradient(90deg,#ff4fc9 0%,#ff64d8 42%,#dfff5a 100%)}
.rydr-card{color:#e8f7ff;background:linear-gradient(90deg,#0a1628 0%,#14304f 45%,#3de7ff 100%)}
.vip-card{color:#fff;background:linear-gradient(90deg,#1b0f45 0%,#3a1a78 50%,#ff4fd8 100%);border-color:rgba(255,212,90,.45)}
.tile-ico{display:inline-flex;color:#ffd45a}
.mock-bottom{display:flex;flex-wrap:wrap;gap:24px;margin-top:24px;align-items:flex-start}
.menu{list-style:none;margin:0;padding:8px;width:240px;border-radius:16px;background:#0d1230;border:1px solid var(--line);box-shadow:0 18px 50px rgba(0,0,0,.45)}
.menu li{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;font-weight:800;font-size:14px}
.menu li:nth-child(odd){background:rgba(255,255,255,.05)}.menu em{margin-left:auto;font-style:normal;color:var(--muted);font-size:12px}
.mi{display:inline-flex;color:#f4f6ff}
.home{display:grid;grid-template-columns:repeat(5,60px);gap:14px 16px;padding:18px;border-radius:26px;background:linear-gradient(160deg,#2a3355,#121933);border:1px solid var(--line)}
.home-ico{display:grid;justify-items:center;gap:5px;font-size:11px;font-weight:700}.home-ico img{width:60px;height:60px;border-radius:14px}
.light-strip{display:flex;flex-wrap:wrap;max-width:100%;gap:18px;align-items:center;padding:14px 18px;border-radius:18px;background:#f4f6fb;color:#10132a}
.light-strip .mi{color:#10132a}
.concept{padding:26px 32px;border-top:1px solid rgba(255,255,255,.08)}
.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.panel{border-radius:18px;padding:14px 16px}
.panel.dark{background:radial-gradient(circle at 15% 0%,rgba(244,58,191,.18),transparent 40%),linear-gradient(135deg,#0a1230,#0a1b5c 70%,#090b12);color:#f4f6ff}
.panel.light{background:#f4f6fb;color:#10132a}
.panel h3{margin:0 0 6px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
.row{display:flex;align-items:flex-end;gap:12px;padding:8px 0;border-bottom:1px solid rgba(128,128,160,.18)}
.lbl{width:118px;flex:0 0 118px;font-size:12px;font-weight:800;opacity:.8;align-self:center}
.cell{display:grid;justify-items:center;gap:3px}.cell small{font-size:10px;opacity:.55}
.slot{display:flex;align-items:center;justify-content:center}.slot img,.slot svg{display:block}
.loupes{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}
.loupe{display:flex;gap:14px;padding:12px 14px;border-radius:14px;align-items:flex-end}
.loupe.dark{background:#0b1030}.loupe.light{background:#f4f6fb;color:#10132a}
.loupe figure{margin:0;display:grid;justify-items:center;gap:4px}.loupe canvas{image-rendering:pixelated;border-radius:2px}
.loupe figcaption{font-size:10px;opacity:.7}
.safe{display:grid;justify-items:center;gap:4px;font-size:11px;color:var(--muted)}
.safe-box{position:relative;width:180px;height:180px}.safe-box img{display:block}
.safe-box.circle{border-radius:50%;overflow:hidden}
.ring{position:absolute;left:18px;top:18px;width:144px;height:144px;border-radius:50%;border:2px dashed #dfff5a;pointer-events:none}
.extras{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;margin-top:14px}
body.view-mock .concept,body.view-mock .intro{display:none}
@media(max-width:520px){.mock{padding:20px 16px 26px}.icon-row{gap:16px 14px;justify-content:center}.icon-img{width:116px;height:116px}
 .tile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home{grid-template-columns:repeat(5,48px);gap:12px 10px;padding:14px}.home-ico img{width:48px;height:48px;border-radius:11px}
 .light-strip{gap:14px;padding:12px 14px}
 .brand{width:170px;max-height:58px}h2{font-size:19px}}
</style></head>
<body>
<section class="mock app-bg" id="mock">
  <h2>Mock placement — Search category area</h2>
  <p>VIP app-icon variants at the ShoutOut icon-card size (132px desktop / 116px phone), compact tiles with the mono icon, a profile menu, and a phone home screen.</p>
  <img class="brand" src="../../images/floqr-color.png" alt="FLOQR" onerror="this.remove()">
  <div class="category-or">Or</div>
  <div class="icon-row">
    <button class="icon-card" type="button"><img class="icon-img" src="${shoutout}" alt=""><span class="icon-title">Throw a ShoutOut</span></button>
    ${iconCards}
  </div>
  <div class="tile-grid">
    <a class="category-card mingl-card" href="#">Mingl</a><a class="category-card bartr-card" href="#">Trade by BartR</a><a class="category-card rydr-card" href="#">RydR</a><a class="category-card" href="#">supRstar</a>
    ${vipTiles}
  </div>
  <div class="mock-bottom">
    <ul class="menu"><li>My Profile</li><li>Inbox</li>${menuItems}</ul>
    <div class="home">${homeIcons}</div>
    <div class="light-strip">${CONCEPTS.map(c => `<span class="mi">${inlineMono(`${c.slug}-mono-small.svg`, 24)}</span><span class="mi">${inlineMono(`${c.slug}-mono.svg`, 32)}</span>`).join("")}</div>
  </div>
</section>
<section class="wrap intro">
  <h1>FLOQR · VIP / Table Reservation icon concepts</h1>
  <p>Design concepts only — not wired into the app. Hand-built SVG (viewBox 0 0 64 64, no fonts, no raster). Gradient pink #ff4fd8 → cyan #5ee7ff, gold #ffd45a accents, dark ink plate so white “VIP” letters stay legible on light backgrounds too. <b>Size-aware ★</b> uses the <i>small</i> variant at 16/24 px and the full variant at 32 px and up.</p>
</section>
${CONCEPTS.map(c => `<section class="concept" id="concept-${c.key}">
  <h2>${c.name}</h2><p>${c.blurb}</p>
  <div class="panels"><div class="panel dark"><h3>Dark background</h3>${rows(c)}</div><div class="panel light"><h3>Light background</h3>${rows(c)}</div></div>
  <div class="extras">${safeZone(c)}<div><div class="loupes">${loupe(c)}</div><small style="opacity:.6;font-size:11px">Loupe: true 16/24 px raster, magnified 5× (pixelated)</small></div></div>
</section>`).join("\n")}
<script>
if (new URLSearchParams(location.search).get("view") === "mock") document.body.classList.add("view-mock");
const canvases = [...document.querySelectorAll("canvas[data-src]")];
const imgs = [...document.images];
Promise.all([
  ...imgs.map(i => i.complete ? Promise.resolve() : new Promise(ok => { i.onload = i.onerror = ok; })),
  ...canvases.map(c => new Promise(ok => {
    const im = new Image();
    im.onload = () => { const x = c.getContext("2d"); x.fillStyle = c.dataset.bg; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(); };
    im.onerror = ok; im.src = c.dataset.src;
  }))
]).then(() => { window.__ready = true; });
</script>
</body></html>
`;
writeFileSync(join(OUT, "preview.html"), html);
console.log(`wrote ${Object.keys(files).length} SVGs + preview.html`);
