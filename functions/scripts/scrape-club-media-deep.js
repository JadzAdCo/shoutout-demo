/* Deeper scrape: unique full-size images + text snippets for events */
"use strict";

function cleanUrl(u) {
  return String(u || "")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/&quot;.*$/, "")
    .split("?")[0]; // strip query for dedupe base
}

function normalizeImage(u) {
  const raw = String(u || "").replace(/&amp;/g, "&").replace(/&#038;/g, "&");
  // Prefer high-res squarespace / wp originals
  if (raw.includes("squarespace-cdn.com") && !raw.includes("format=")) {
    return raw + (raw.includes("?") ? "&" : "?") + "format=1500w";
  }
  if (raw.includes("i0.wp.com") || raw.includes("wp-content")) {
    // strip resize params for cleaner gallery refs; keep ssl if present
    const base = raw.split("?")[0];
    if (raw.includes("ssl=1") || raw.includes("i0.wp.com")) return base + "?ssl=1";
    return base;
  }
  if (raw.includes("website-files.com") && raw.includes("-p-")) {
    return raw.replace(/-p-\d+\.(jpe?g|png|webp)/i, ".$1");
  }
  return raw;
}

function isJunk(u) {
  const s = u.toLowerCase();
  return (
    s.includes("favicon") ||
    s.includes("cropped-decades-d") ||
    s.includes("fit=32") ||
    s.includes("fit=180") ||
    s.includes("fit=192") ||
    s.includes("fit=270") ||
    s.includes("format=100w") ||
    s.includes("format=300w") ||
    s.includes("resize=240") ||
    s.includes("resize=300") ||
    s.includes("-p-500") ||
    s.includes("-p-800") ||
    s.endsWith(".ico") ||
    s.includes("gravatar")
  );
}

async function scrape(url) {
  const res = await fetch(url, {headers: {"user-agent": "Mozilla/5.0 FLOQR-onboard"}});
  const html = await res.text();
  const imgs = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\\\s>]*)?/gi)].map((m) => m[0]);
  const sq = [...html.matchAll(/https?:\/\/images\.squarespace-cdn\.com\/[^"'\\\s>]+/gi)].map((m) => m[0]);
  const cdn = [...html.matchAll(/https?:\/\/cdn\.prod\.website-files\.com\/[^"'\\\s>]+/gi)].map((m) => m[0]);
  const all = [...imgs, ...sq, ...cdn].map((u) => u.replace(/&amp;/g, "&").replace(/&#038;/g, "&"));
  const seen = new Set();
  const unique = [];
  for (const u of all) {
    if (isJunk(u)) continue;
    const key = cleanUrl(u);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalizeImage(u));
  }
  // event-ish text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 4000);
  return {url, count: unique.length, images: unique.slice(0, 20), textSnippet: text.slice(0, 1200)};
}

(async () => {
  const urls = [
    "https://decadesdc.com/",
    "https://decadesdc.com/weekly-events/",
    "https://decadesdc.com/events/",
    "https://www.themayflowerdc.com/",
    "https://www.themayflowerdc.com/private-events",
    "https://www.limatwist.com/",
    "https://www.limatwist.com/menu",
    "https://www.limatwist.com/contact"
  ];
  const out = {};
  for (const url of urls) {
    try {
      out[url] = await scrape(url);
      console.error("ok", url, out[url].count);
    } catch (e) {
      out[url] = {error: e.message};
      console.error("fail", url, e.message);
    }
  }
  console.log(JSON.stringify(out, null, 2));
})();
