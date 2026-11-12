/* Collegiate varsity block numerals. Angular corners. The 1 is a slanted flag, stem, and modest foot. */
(function (root) {
  "use strict";

  const H = 108;

  function poly(points) {
    return "M" + points.map(function (p) { return p[0] + " " + p[1]; }).join("L") + "Z";
  }

  function mirrorX(points, w) {
    return points.map(function (p) { return [w - p[0], p[1]]; });
  }

  function rot180(points, w, h) {
    return points.map(function (p) { return [w - p[0], h - p[1]]; });
  }

  const two = [[16, 8], [56, 8], [68, 20], [68, 65], [28, 65], [28, 78], [68, 78], [68, 88], [56, 100], [16, 100], [4, 88], [4, 43], [48, 43], [48, 30], [4, 30], [4, 20]];
  const six = [[16, 8], [52, 8], [64, 20], [64, 30], [28, 30], [28, 43], [68, 43], [68, 88], [56, 100], [16, 100], [4, 88], [4, 20]];
  const sixHole = [[28, 65], [48, 65], [48, 78], [28, 78]];
  const zeroHole = [[26, 32], [46, 32], [46, 76], [26, 76]];
  const eightTop = [[26, 28], [46, 28], [46, 44], [26, 44]];
  const eightBot = [[26, 64], [46, 64], [46, 80], [26, 80]];

  const GLYPH = {
    "0": { w: 72, d: poly([[16, 8], [56, 8], [68, 20], [68, 88], [56, 100], [16, 100], [4, 88], [4, 20]]) + poly(zeroHole) },
    "1": { w: 72, d: poly([[8, 28], [32, 8], [54, 8], [54, 88], [62, 88], [62, 100], [24, 100], [24, 88], [32, 88], [32, 30], [8, 50]]) },
    "2": { w: 72, d: poly(two) },
    "3": { w: 72, d: poly([[16, 8], [56, 8], [68, 20], [68, 88], [56, 100], [16, 100], [4, 88], [4, 78], [44, 78], [44, 65], [24, 65], [24, 43], [44, 43], [44, 30], [4, 30], [4, 20]]) },
    "4": { w: 76, d: poly([[8, 8], [30, 8], [30, 43], [46, 43], [46, 8], [68, 8], [68, 100], [46, 100], [46, 65], [8, 65]]) },
    "5": { w: 72, d: poly(mirrorX(two, 72)) },
    "6": { w: 72, d: poly(six) + poly(sixHole) },
    "7": { w: 72, d: poly([[12, 8], [60, 8], [68, 16], [68, 30], [46, 100], [24, 100], [46, 30], [8, 30], [8, 16]]) },
    "8": { w: 72, d: poly([[16, 8], [56, 8], [68, 20], [68, 88], [56, 100], [16, 100], [4, 88], [4, 20]]) + poly(eightTop) + poly(eightBot) },
    "9": { w: 72, d: poly(rot180(six, 72, H)) + poly(rot180(sixHole, 72, H)) }
  };

  function hex(value, fallback) {
    const s = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : fallback;
  }

  function luma(value) {
    const s = hex(value, "");
    if (!s) return 0;
    const n = parseInt(s.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  function outline(fill, accent, primary) {
    const ink = hex(fill, "#FFFFFF");
    const body = hex(primary, "#111111");
    const team = hex(accent, "");
    const candidates = ["#FFFFFF", team, "#111111", body].filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      const color = candidates[i];
      if (Math.abs(luma(color) - luma(ink)) < 0.18) continue;
      if (Math.abs(luma(color) - luma(body)) < 0.18) continue;
      return color;
    }
    return "#111111";
  }

  function svg(text, fill, stroke) {
    const digits = String(text || "").replace(/\D/g, "").slice(0, 2).split("");
    if (!digits.length) return "";
    const gap = 6;
    let x = 0;
    const parts = digits.map(function (digit) {
      const glyph = GLYPH[digit] || GLYPH["0"];
      const chunk = '<g transform="translate(' + x + ' 0)"><path d="' + glyph.d + '"/></g>';
      x += glyph.w + gap;
      return chunk;
    });
    const total = x - gap;
    const ink = hex(fill, "#FFFFFF");
    const keyline = hex(stroke, "#FFFFFF");
    return '<svg class="varsity-num" viewBox="0 0 ' + total + ' ' + H + '" height="1em" focusable="false" aria-hidden="true">' +
      '<g fill="' + ink + '" stroke="' + keyline + '" stroke-width="11" stroke-linejoin="miter" stroke-miterlimit="4" stroke-linecap="butt" fill-rule="evenodd" paint-order="stroke fill">' +
      parts.join("") + "</g></svg>";
  }

  root.FLOQRVarsityNumbers = { svg: svg, outline: outline, luma: luma };
})(typeof window !== "undefined" ? window : globalThis);
