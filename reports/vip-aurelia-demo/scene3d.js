// Procedural three.js model of a floqr.vipFloorPlan/2 plan (demo extensions: meters, model3d).
import * as THREE from "three";
import {OrbitControls} from "./vendor/OrbitControls.js";
import {LEGEND, ICON_PATHS} from "./plan-svg.mjs";

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.7, metalness: 0.1, ...extra});
const MATS = {
  floor: mat("#17141c"), wall: mat("#241f2b", {side: THREE.FrontSide}), leather: mat("#141416", {roughness: 0.45}),
  velvet: mat("#6b1220", {roughness: 0.9}), gold: mat("#c9a24a", {metalness: 0.8, roughness: 0.3}),
  wood: mat("#2b1d16"), steel: mat("#3a3f47", {metalness: 0.7, roughness: 0.35}), mezz: mat("#221c2c"),
  glass: new THREE.MeshStandardMaterial({color: "#a5b4fc", transparent: true, opacity: 0.18, roughness: 0.1}),
  carpet: mat("#8b0f1d", {roughness: 1}), counter: mat("#1d1a20", {roughness: 0.3, metalness: 0.4})
};

function blend(hexColor, alpha, bg = "#111111") {
  const a = new THREE.Color(hexColor), b = new THREE.Color(bg);
  return b.lerp(a, alpha).getStyle();
}

function patternTexture(stateKey) {
  const st = LEGEND[stateKey];
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = blend(st.color, Math.min(1, st.fillOpacity + 0.35));
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(10,10,10,.6)";
  g.fillStyle = "rgba(240,240,240,.6)";
  g.lineWidth = 8;
  if (st.pattern === "stripes") for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); }
  if (st.pattern === "hatch") for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  if (st.pattern === "dots") for (let x = 16; x < 128; x += 32) for (let y = 16; y < 128; y += 32) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function labelSprite(title, sub, stateKey, small = false) {
  const st = LEGEND[stateKey];
  const c = document.createElement("canvas");
  c.width = 512; c.height = 176;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(8,8,10,.86)";
  g.strokeStyle = st.stroke;
  g.lineWidth = 8;
  g.beginPath(); g.roundRect(6, 6, 500, 164, 28); g.fill(); g.stroke();
  g.save();
  g.translate(84, 88); g.scale(4, 4);
  g.strokeStyle = st.stroke; g.lineWidth = 2.2; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.stroke();
  g.stroke(new Path2D(ICON_PATHS[st.icon] || ""));
  g.restore();
  g.fillStyle = "#ffffff";
  g.font = `700 ${title.length > 9 ? 44 : 60}px system-ui, Segoe UI, Arial, sans-serif`;
  g.textBaseline = "middle";
  g.fillText(title, 150, 64, 340);
  g.fillStyle = "#e5e7eb";
  g.font = "500 36px system-ui, Segoe UI, Arial, sans-serif";
  g.fillText(sub, 150, 124, 340);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true}));
  const s = small ? 0.85 : 1.15;
  sprite.scale.set(2.6 * s, 0.9 * s, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  return sprite;
}

export function createScene({canvas, plan, stateOf, onPick, reducedMotion}) {
  const M = plan.model3d, W = M.roomWidthM, D = M.roomDepthM;
  const toX = mx => mx - W / 2, toZ = mz => mz - D / 2;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#07070a");
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.rotation.order = "YXZ";
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {enableDamping: !reducedMotion, maxPolarAngle: Math.PI * 0.48, minDistance: 3, maxDistance: 75});

  scene.add(new THREE.HemisphereLight("#ffe7c2", "#1a1020", 1.1));
  scene.add(new THREE.AmbientLight("#ffffff", 0.35));
  const sun = new THREE.DirectionalLight("#ffffff", 0.8);
  sun.position.set(-8, 20, 10);
  scene.add(sun);

  const box = (w, h, d, material, mx, y, mz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(toX(mx), y, toZ(mz));
    scene.add(m);
    return m;
  };

  // Floor + inward-facing wall planes (back-face culled from outside → dollhouse overview).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MATS.floor);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const H = M.wallHeightM;
  const walls = {north: [W, 0, H / 2, 0, 0], south: [W, 0, H / 2, D, Math.PI], west: [D, 0, H / 2, 0, Math.PI / 2], east: [D, W, H / 2, 0, -Math.PI / 2]};
  for (const [name, [len, x, y, z, ry]] of Object.entries(walls)) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, H), MATS.wall);
    const onX = name === "west" || name === "east";
    p.position.set(onX ? toX(x) : 0, y, onX ? 0 : toZ(z));
    p.rotation.y = ry;
    scene.add(p);
  }
  const wallPlane = (wall, centerM, bottomM, w, h, material, inset = 0.03) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    const y = bottomM + h / 2;
    if (wall === "north") { p.position.set(toX(centerM), y, toZ(inset)); }
    if (wall === "south") { p.position.set(toX(centerM), y, toZ(D - inset)); p.rotation.y = Math.PI; }
    if (wall === "west") { p.position.set(toX(inset), y, toZ(centerM)); p.rotation.y = Math.PI / 2; }
    if (wall === "east") { p.position.set(toX(W - inset), y, toZ(centerM)); p.rotation.y = -Math.PI / 2; }
    scene.add(p);
    return p;
  };

  // Club photos as framed wall panels.
  const loader = new THREE.TextureLoader();
  for (const wp of M.wallPhotos) {
    wallPlane(wp.wall, wp.centerM, wp.bottomM - 0.12, wp.widthM + 0.24, wp.heightM + 0.24, MATS.gold, 0.02);
    const tex = loader.load(wp.photo);
    tex.colorSpace = THREE.SRGBColorSpace;
    wallPlane(wp.wall, wp.centerM, wp.bottomM, wp.widthM, wp.heightM, new THREE.MeshBasicMaterial({map: tex, toneMapped: false}), 0.04);
  }
  for (const door of M.doors) {
    const m = door.meters;
    const exit = door.kind === "exit";
    const material = new THREE.MeshBasicMaterial({color: exit ? "#16a34a" : "#fbbf24"});
    if (m.d <= 0.5) wallPlane(m.z < 1 ? "north" : "south", m.x + m.w / 2, 0, m.w, 2.4, material, 0.035);
    else wallPlane(m.x > W / 2 ? "east" : "west", m.z + m.d / 2, 0, m.d, 2.4, material, 0.035);
  }

  // Mezzanine platform, glass rail (open at the stairs), stairs.
  const mz = M.mezzanine.meters, elev = M.mezzanine.elevationM;
  box(mz.w, elev, mz.d, MATS.mezz, mz.x + mz.w / 2, elev / 2, mz.z + mz.d / 2);
  const stairs = plan.nonBookable.find(n => n.type === "stairs")?.meters;
  const railEnd = stairs ? stairs.z : mz.z + mz.d;
  box(0.06, 1.0, railEnd - mz.z, MATS.glass, mz.x, elev + 0.5, mz.z + (railEnd - mz.z) / 2);
  box(mz.w, 1.0, 0.06, MATS.glass, mz.x + mz.w / 2, elev + 0.5, mz.z + mz.d);
  if (stairs) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const h = elev * (i + 1) / steps, sw = stairs.w / steps;
      box(sw, h, stairs.d, MATS.steel, stairs.x + sw * (i + 0.5), h / 2, stairs.z + stairs.d / 2);
    }
  }

  // Decor: chandeliers + dance-floor beams.
  const crystal = new THREE.MeshStandardMaterial({color: "#f7d58b", emissive: "#f5c66b", emissiveIntensity: 1, metalness: 0.6, roughness: 0.2});
  for (const [mx, mzz] of [[16, 8.3], [7.6, 6.75], [16, 20.4]]) {
    const ch = new THREE.Group();
    ch.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), crystal));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), crystal);
      drop.position.set(Math.cos(a) * 0.6, -0.35, Math.sin(a) * 0.6);
      ch.add(drop);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), MATS.gold);
    rod.position.y = 0.6;
    ch.add(rod);
    ch.position.set(toX(mx), 5.1, toZ(mzz));
    scene.add(ch);
    const pl = new THREE.PointLight("#ffd28a", 18, 16, 1.6);
    pl.position.set(toX(mx), 3.6, toZ(mzz));
    scene.add(pl);
  }

  const groups = new Map();
  const pickables = [];
  const register = (id, obj) => { obj.traverse(o => { if (o.isMesh) { o.userData.pickId = id; pickables.push(o); } }); };

  function furniture(el, group, y0) {
    const m = el.meters;
    const cx = m.cx ?? m.x + m.w / 2, cz = m.cz ?? m.z + m.d / 2;
    const add = (geo, material, x, y, z) => { const o = new THREE.Mesh(geo, material); o.position.set(toX(x), y0 + y, toZ(z)); group.add(o); return o; };
    if (el.type === "booth" || el.type === "vipTable") {
      const upholstery = el.type === "vipTable" ? MATS.velvet : MATS.leather;
      const backOnEast = cx > W / 2;
      const bx = backOnEast ? m.x + m.w - 0.25 : m.x + 0.25;
      add(new THREE.BoxGeometry(0.5, 1.1, m.d - 0.2), upholstery, bx, 0.55, cz);
      add(new THREE.BoxGeometry(m.w - 0.6, 0.45, 0.5), upholstery, cx, 0.22, m.z + 0.35);
      add(new THREE.BoxGeometry(m.w - 0.6, 0.45, 0.5), upholstery, cx, 0.22, m.z + m.d - 0.35);
      add(new THREE.BoxGeometry(m.w * 0.45, 0.55, m.d * 0.35), MATS.wood, cx + (backOnEast ? -0.3 : 0.3), 0.28, cz);
      add(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 14), MATS.gold, cx + (backOnEast ? -0.3 : 0.3), 0.7, cz);
    } else if (el.type === "vipArea") {
      add(new THREE.BoxGeometry(0.6, 0.9, m.d - 0.4), MATS.velvet, m.x + 0.4, 0.45, cz);
      add(new THREE.BoxGeometry(m.w - 0.8, 0.9, 0.6), MATS.velvet, cx, 0.45, m.z + 0.4);
      add(new THREE.BoxGeometry(1.4, 0.4, 2.4), MATS.wood, cx + 0.2, 0.2, cz);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.15, 0.12, 0.32, 14), MATS.gold, cx + 0.2, 0.56, cz - 0.8 + i * 0.8);
    } else if (el.type === "round") {
      add(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 28), MATS.wood, cx, 0.74, cz);
      add(new THREE.CylinderGeometry(0.08, 0.2, 0.72, 12), MATS.gold, cx, 0.36, cz);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 14), MATS.leather, cx + Math.cos(a) * 0.82, 0.22, cz + Math.sin(a) * 0.82); }
    } else {
      const tall = el.type === "table" ? 1.05 : 1.1, r = el.type === "table" ? 0.4 : 0.32;
      add(new THREE.CylinderGeometry(r, r, 0.05, 24), MATS.counter, cx, tall, cz);
      add(new THREE.CylinderGeometry(0.05, 0.22, tall, 12), MATS.steel, cx, tall / 2, cz);
      if (el.type === "table") for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; add(new THREE.CylinderGeometry(0.17, 0.17, 0.75, 12), MATS.leather, cx + Math.cos(a) * 0.62, 0.37, cz + Math.sin(a) * 0.62); }
    }
    return [cx, cz];
  }

  function padMesh(el, y0, stateKey) {
    const m = el.meters;
    const geo = el.shape === "circle" ? new THREE.CylinderGeometry(m.r, m.r, 0.05, 40) : new THREE.BoxGeometry(m.w, 0.05, m.d);
    const tex = patternTexture(stateKey);
    if (el.shape !== "circle") tex.repeat.set(Math.max(1, m.w / 1.2), Math.max(1, m.d / 1.2));
    const pad = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map: tex, emissive: LEGEND[stateKey].color, emissiveIntensity: 0.18, roughness: 0.8}));
    pad.position.set(toX(m.cx ?? m.x + m.w / 2), y0 + 0.03, toZ(m.cz ?? m.z + m.d / 2));
    return pad;
  }

  function selectionRing(el, y0) {
    const m = el.meters;
    const material = new THREE.MeshBasicMaterial({color: LEGEND.selected.stroke, transparent: true, opacity: 1});
    const g = new THREE.Group();
    const cx = m.cx ?? m.x + m.w / 2, cz = m.cz ?? m.z + m.d / 2;
    if (el.shape === "circle") {
      const ring = new THREE.Mesh(new THREE.RingGeometry(m.r + 0.05, m.r + 0.25, 48), material);
      ring.rotation.x = -Math.PI / 2;
      g.add(ring);
    } else {
      const t = 0.18, w = m.w + 0.3, d = m.d + 0.3;
      for (const [sx, sz, px, pz] of [[w, t, 0, -d / 2], [w, t, 0, d / 2], [t, d, -w / 2, 0], [t, d, w / 2, 0]]) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(px, 0, pz);
        g.add(bar);
      }
    }
    g.position.set(toX(cx), y0 + 0.08, toZ(cz));
    g.visible = false;
    return g;
  }

  function buildSection(el) {
    const y0 = el.elevationM || 0;
    const group = new THREE.Group();
    const stateKey = stateOf(el);
    const pad = padMesh(el, y0, stateKey);
    group.add(pad);
    const [cx, cz] = furniture(el, group, y0);
    const label = labelSprite(el.label === "AURELIA SUITE" ? "SUITE" : el.label, `${LEGEND[stateKey].label} · ${el.maxCapacity} max`, stateKey);
    label.position.set(toX(cx), y0 + 2.3, toZ(cz));
    group.add(label);
    const ring = selectionRing(el, y0);
    group.add(ring);
    scene.add(group);
    register(el.id, group);
    groups.set(el.id, {el, group, pad, label, ring, cx, cz, y0});
  }

  function buildFixture(el) {
    const m = el.meters, y0 = el.elevationM || 0;
    const cx = m.x + m.w / 2, cz = m.z + m.d / 2;
    const st = el.type === "djBooth" ? "djBooth" : "notBookable";
    if (el.type === "djBooth") {
      box(m.w, 1.2, m.d, new THREE.MeshStandardMaterial({color: "#1e3a8a", emissive: "#3b82f6", emissiveIntensity: 0.55}), cx, 0.6, cz);
      box(1.8, 0.08, 0.7, MATS.steel, cx, 1.24, cz + 0.3);
    } else if (el.type === "walkway") {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const g = c.getContext("2d");
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 3 === 0 ? "#7c3aed" : (i + j) % 3 === 1 ? "#db2777" : "#1e1b4b"; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2.5);
      const df = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.d), new THREE.MeshStandardMaterial({map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35}));
      df.rotation.x = -Math.PI / 2; df.position.set(toX(cx), 0.012, toZ(cz)); scene.add(df);
    } else if (el.type === "bar") {
      box(m.w, 1.1, 0.7, MATS.counter, cx, y0 + 0.55, m.z + 0.35);
      box(m.w, 0.06, 0.8, MATS.gold, cx, y0 + 1.12, m.z + 0.35);
      box(m.w, 2.2, 0.4, MATS.wood, cx, y0 + 1.1, m.z + m.d - 0.2);
    } else if (el.type === "entrance") {
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.6, m.d), MATS.carpet);
      carpet.rotation.x = -Math.PI / 2; carpet.position.set(toX(cx + 0.4), 0.015, toZ(cz)); scene.add(carpet);
      box(0.6, 1.1, 0.5, MATS.wood, m.x + 0.7, 0.55, cz - 0.6);
      for (let i = 0; i < 4; i++) box(0.08, 1.0, 0.08, MATS.gold, cx - 0.6, 0.5, m.z + 0.5 + i * 0.8);
    } else if (el.type === "coatCheck") {
      box(m.w - 0.4, 1.1, 0.6, MATS.counter, cx, 0.55, m.z + 0.4);
    } else if (el.type === "restroom") {
      box(m.w, 2.6, 0.12, MATS.wall, cx, 1.3, m.z + m.d);
    }
    const sprite = labelSprite(el.label, LEGEND[st].label, st, true);
    const top = el.type === "djBooth" ? 2.0 : el.type === "exit" ? 2.9 : el.type === "walkway" ? 0.8 : 2.4;
    sprite.position.set(toX(cx), y0 + top, toZ(cz));
    scene.add(sprite);
  }

  plan.nonBookable.forEach(buildFixture);
  plan.sections.forEach(buildSection);

  // ---- camera helpers ----
  let anim = null;
  function flyTo(pos, target, ms = 900) {
    walk.on && setWalk(false);
    if (reducedMotion || ms === 0) { camera.position.copy(pos); controls.target.copy(target); controls.update(); return; }
    anim = {from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, t0: performance.now(), ms};
  }
  const aspectBoost = () => (camera.aspect < 1 ? 1.75 / Math.max(camera.aspect, 0.45) : 1);
  function overview() {
    const k = aspectBoost();
    flyTo(new THREE.Vector3(0, 24 * k, 22 * k), new THREE.Vector3(0, 0, 1));
  }
  function focusArea(area) {
    const b = area.bounds;
    const x = (b.x + b.w / 2) * W, z = (b.y + b.h / 2) * D, size = Math.max(b.w * W, b.h * D);
    const y0 = area.type === "vipArea" ? elev : 0, k = aspectBoost();
    flyTo(new THREE.Vector3(toX(x), y0 + (size * 0.75 + 4) * k, toZ(z) + (size * 0.55 + 4) * k), new THREE.Vector3(toX(x), y0, toZ(z)));
  }
  // Frames the table clear of the sheet: right-side sheet → table left of centre; bottom sheet → table in the upper half.
  function focusSection(id, {sheet = "right"} = {}) {
    const s = groups.get(id);
    if (!s || walk.on) return;
    const k = Math.min(aspectBoost(), 1.6);
    const dx = sheet === "right" ? 3.2 : 0, dz = sheet === "bottom" ? 3.5 : 0;
    const tx = toX(s.cx) + dx, tz = toZ(s.cz) + dz;
    flyTo(new THREE.Vector3(tx + 1.5, s.y0 + 9 * k, tz + 9.5 * k), new THREE.Vector3(tx, s.y0, tz));
  }

  // ---- state + selection ----
  let selectedId = null;
  function refreshState(id) {
    const s = groups.get(id);
    if (!s) return;
    const key = stateOf(s.el);
    s.pad.material.map.dispose();
    s.pad.material.map = patternTexture(key);
    if (s.el.shape !== "circle") s.pad.material.map.repeat.set(Math.max(1, s.el.meters.w / 1.2), Math.max(1, s.el.meters.d / 1.2));
    s.pad.material.emissive.set(LEGEND[key].color);
    s.pad.material.needsUpdate = true;
    const fresh = labelSprite(s.el.label === "AURELIA SUITE" ? "SUITE" : s.el.label, `${LEGEND[key].label} · ${s.el.maxCapacity} max`, key);
    fresh.position.copy(s.label.position);
    s.group.remove(s.label);
    s.label.material.map.dispose();
    s.group.add(fresh);
    s.label = fresh;
  }
  function select(id, {focus = true, sheet = "right"} = {}) {
    if (selectedId && groups.get(selectedId)) groups.get(selectedId).ring.visible = false;
    selectedId = id;
    const s = id && groups.get(id);
    if (s) { s.ring.visible = true; if (focus) focusSection(id, {sheet}); }
  }

  // Walk mode: only nearby labels, smaller, so they do not stack along a row.
  function updateLabels() {
    for (const s of groups.values()) {
      const base = s.label.userData.baseScale;
      if (!walk.on) { s.label.visible = true; s.label.scale.copy(base); continue; }
      const dist = Math.hypot(walk.x - s.cx, walk.z - s.cz);
      s.label.visible = dist < 8 || s.el.id === selectedId;
      s.label.scale.copy(base).multiplyScalar(0.55);
    }
  }

  // ---- walk mode ----
  const walk = {on: false, x: 7, z: 19.6, yaw: 0, pitch: -0.08, keys: new Set(), joy: {x: 0, y: 0}};
  const inRect = (x, z, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && z >= r.z - pad && z <= r.z + r.d + pad;
  function floorAt(x, z) {
    if (stairs && inRect(x, z, stairs)) return elev * Math.min(1, Math.max(0, (x - stairs.x) / stairs.w));
    if (inRect(x, z, mz)) return elev;
    return 0;
  }
  function setWalk(on) {
    walk.on = on;
    controls.enabled = !on;
    anim = null;
    if (on) { walk.x = 7; walk.z = 19.6; walk.yaw = 0; walk.pitch = -0.08; walk.y = 0; }
  }
  function stepWalk(dt) {
    const k = walk.keys;
    let f = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) - walk.joy.y;
    let r = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + walk.joy.x;
    walk.yaw += ((k.has("arrowleft") ? 1 : 0) - (k.has("arrowright") ? 1 : 0)) * dt * 1.8;
    f = Math.max(-1, Math.min(1, f)); r = Math.max(-1, Math.min(1, r));
    const speed = 3.4 * dt;
    const nx = walk.x + (-Math.sin(walk.yaw) * f + Math.cos(walk.yaw) * r) * speed;
    const nz = walk.z + (-Math.cos(walk.yaw) * f - Math.sin(walk.yaw) * r) * speed;
    const cx = Math.max(0.5, Math.min(W - 0.5, nx)), cz = Math.max(0.5, Math.min(D - 0.5, nz));
    if (Math.abs(floorAt(cx, cz) - floorAt(walk.x, walk.z)) < 0.5) { walk.x = cx; walk.z = cz; }
    const target = floorAt(walk.x, walk.z);
    walk.y = reducedMotion ? target : walk.y + (target - walk.y) * Math.min(1, dt * 10);
    camera.position.set(toX(walk.x), walk.y + M.eyeHeightM, toZ(walk.z));
    camera.rotation.set(walk.pitch, walk.yaw, 0);
  }

  // ---- input: click to pick, drag to look in walk mode ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener("pointerdown", e => { down = {x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY}; });
  canvas.addEventListener("pointermove", e => {
    if (!down || !walk.on) return;
    walk.yaw -= (e.clientX - down.lx) * 0.005;
    walk.pitch = Math.max(-1.2, Math.min(0.8, walk.pitch - (e.clientY - down.ly) * 0.004));
    down.lx = e.clientX; down.ly = e.clientY;
  });
  canvas.addEventListener("pointerup", e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) onPick(hit.object.userData.pickId);
  });

  // ---- loop ----
  const clock = new THREE.Clock();
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  overview();
  if (anim) { camera.position.copy(anim.to); controls.target.copy(anim.tTo); anim = null; controls.update(); }
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (anim) {
      const t = Math.min(1, (performance.now() - anim.t0) / anim.ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(anim.from, anim.to, e);
      controls.target.lerpVectors(anim.tFrom, anim.tTo, e);
      if (t >= 1) anim = null;
    }
    if (walk.on) stepWalk(dt); else controls.update();
    updateLabels();
    if (selectedId && !reducedMotion) {
      const s = groups.get(selectedId);
      if (s) s.ring.children.forEach(c => { c.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 3)); });
    }
    renderer.render(scene, camera);
    frames++;
  });

  return {
    select, refreshState, overview, focusArea, setWalk, resize,
    get walking() { return walk.on; },
    get frames() { return frames; },
    keyDown: k => walk.keys.add(k), keyUp: k => walk.keys.delete(k),
    setJoystick: (x, y) => { walk.joy.x = x; walk.joy.y = y; },
    nudgeWalk: (seconds = 1, key = "w") => { walk.keys.add(key); setTimeout(() => walk.keys.delete(key), seconds * 1000); },
    turn: rad => { walk.yaw += rad; }
  };
}
