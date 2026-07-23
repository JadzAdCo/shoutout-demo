/* scrape club site media URLs */
"use strict";
async function scrape(url) {
  const res = await fetch(url, {headers: {"user-agent": "Mozilla/5.0 FLOQR-onboard"}});
  const html = await res.text();
  const decode = (u) => String(u || "").replace(/&amp;/g, "&").replace(/\\u002F/g, "/");
  const imgs = [...html.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\\\s>]*)?/gi)].map((m) => decode(m[0]));
  const sq = [...html.matchAll(/https?:\/\/images\.squarespace-cdn\.com\/[^"'\\\s>]+/gi)].map((m) => decode(m[0]));
  const wp = [...html.matchAll(/https?:\/\/[^"'\\\s>]*wp-content\/uploads\/[^"'\\\s>]+/gi)].map((m) => decode(m[0]));
  const cdn = [...html.matchAll(/https?:\/\/(?:cdn|images|static)\.[^"'\\\s>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s>]*)?/gi)].map((m) => decode(m[0]));
  const ogMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i)
    || html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const og = decode(ogMatch && ogMatch[1] || "");
  const uniq = [...new Set([...imgs, ...sq, ...wp, ...cdn, og].filter(Boolean))];
  return {url, og, count: uniq.length, images: uniq.slice(0, 24)};
}

(async () => {
  const urls = [
    "https://decadesdc.com/",
    "https://decadesdc.com/weekly-events/",
    "https://www.themayflowerdc.com/",
    "https://www.limatwist.com/",
    "https://www.limatwist.com/contact"
  ];
  for (const url of urls) {
    try {
      const row = await scrape(url);
      console.log(JSON.stringify(row, null, 2));
    } catch (error) {
      console.error(url, error.message);
    }
  }
})();
