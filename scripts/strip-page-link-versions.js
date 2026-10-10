#!/usr/bin/env node
/* Removes `v=` from page / navigation links (owner decision Oct 10 2026: page links never carry a version).
 * Asset tags (`*.js?v=`, `*.css?v=`, images) are left alone — the bump script cache-busts those.
 * Idempotent. Usage: node scripts/strip-page-link-versions.js <file>... (paths relative to cwd)
 * Library: require(...).stripPageLinkVersions(src) */
"use strict";

const fs = require("fs");

const STOP = new Set(['"', "'", "`", " ", "\t", "\n", "\r", "<", ">", "(", ","]);
const ASSET_PATH = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|mp4|webm|mp3|json|woff2?|ttf|pdf)$/i;

/** Path part of the URL that owns the query starting at `q` (index of "?"), or null when it is not a page link. */
function pagePathBefore(src, q) {
  let i = q - 1;
  let depth = 0;
  while (i >= 0) {
    const ch = src[i];
    if (ch === "}") depth += 1;
    else if (ch === "{" && depth > 0) depth -= 1;
    else if (depth === 0 && STOP.has(ch)) break;
    i -= 1;
  }
  const pathPart = src.slice(i + 1, q);
  if (!pathPart) return null;
  if (/watch$/i.test(pathPart) || ASSET_PATH.test(pathPart)) return null;
  if (/\.html$/i.test(pathPart) || /(?:^|\/)$/.test(pathPart) || /\}$/.test(pathPart)) return pathPart;
  return null;
}

/** Index where the `?` of the query containing position `at` begins (same URL token), or -1. */
function queryStart(src, at) {
  let i = at;
  let depth = 0;
  while (i >= 0) {
    const ch = src[i];
    if (ch === "}") depth += 1;
    else if (ch === "{" && depth > 0) depth -= 1;
    else if (depth === 0) {
      if (ch === "?") return i;
      if (STOP.has(ch)) return -1;
    }
    i -= 1;
  }
  return -1;
}

function valueEnd(src, start) {
  if (src.startsWith("${", start)) {
    let depth = 0;
    for (let i = start + 1; i < src.length; i += 1) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return src.length;
  }
  let i = start;
  while (i < src.length && !/[&#"'`\s<>)\\,;]/.test(src[i])) i += 1;
  while (i > start && src[i - 1] === ".") i -= 1;
  return i;
}

function stripQueryV(src) {
  let out = src;
  const re = /(\?|&amp;|&)v=/g;
  let m;
  while ((m = re.exec(out))) {
    const sep = m[1];
    const sepAt = m.index;
    const qAt = sep === "?" ? sepAt : queryStart(out, sepAt - 1);
    if (qAt < 0 || !pagePathBefore(out, qAt)) continue;
    const vStart = sepAt + sep.length + 2;
    const vEnd = valueEnd(out, vStart);
    let cutStart = sepAt;
    let cutEnd = vEnd;
    if (sep === "?") {
      const next = out.startsWith("&amp;", vEnd) ? "&amp;" : out[vEnd] === "&" ? "&" : "";
      if (next) {
        cutStart = sepAt + 1;
        cutEnd = vEnd + next.length;
      }
    }
    out = out.slice(0, cutStart) + out.slice(cutEnd);
    re.lastIndex = cutStart;
  }
  return out;
}

const COND = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`;
const SET_V = String.raw`\w+\.searchParams\.set\(\s*["']v["']\s*,[^;\n]*\);`;

function stripSearchParamsV(src) {
  return src
    .replace(new RegExp(String.raw`if \(!(\w+)\.searchParams\.get\(["']v["']\)[^)\n]*\) \1\.searchParams\.set\(\s*["']v["']\s*,[^;\n]*\);`, "g"), '$1.searchParams.delete("v");')
    .replace(new RegExp(String.raw`^[ \t]*(?:if\s*${COND}\s*)?${SET_V}[ \t]*\r?\n`, "gm"), "")
    .replace(new RegExp(String.raw`(?:if\s*${COND}\s*)?${SET_V}`, "g"), "");
}

function stripPageLinkVersions(src) {
  let out = stripQueryV(src);
  out = out.replace(/(new URLSearchParams\(\{\s*)v\s*:\s*(?:"[^"]*"|'[^']*'|[\w.?$]+(?:\s*\|\|\s*"[^"]*")?)\s*,\s*/g, "$1");
  out = stripSearchParamsV(out);
  return out;
}

if (require.main === module) {
  for (const file of process.argv.slice(2)) {
    const before = fs.readFileSync(file, "utf8");
    const after = stripPageLinkVersions(before);
    if (after !== before) {
      fs.writeFileSync(file, after);
      console.log("stripped", file);
    }
  }
}

module.exports = {stripPageLinkVersions};
