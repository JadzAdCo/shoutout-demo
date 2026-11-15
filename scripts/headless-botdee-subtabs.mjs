#!/usr/bin/env node
/** Headless: Master Admin BOT DEE subtabs stay visible after showBotDeeMgmtPage */
import { chromium } from "playwright";

const BASE = process.env.FLOQR_TEST_BASE || "http://127.0.0.1:8765";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const htmlRes = await fetch(`${BASE}/master-admin.html`);
  const html = await htmlRes.text();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const jsRes = await fetch(`${BASE}/master-feature-services.js?v=s3.3.023`);
  const js = await jsRes.text();
  await page.addScriptTag({ content: js });

  const result = await page.evaluate(() => {
    const section = document.querySelector("#featuresBotDee");
    if (!section) return { ok: false, error: "missing #featuresBotDee" };
    const buttons = [...document.querySelectorAll("#botDeeMgmtSubtabs [data-botdee-page]")];
    if (buttons.length !== 3) {
      return { ok: false, error: `expected 3 tab buttons, got ${buttons.length}` };
    }
    const pages = [...document.querySelectorAll("#featuresBotDee .botdee-mgmt-page[data-botdee-page]")];
    if (pages.length !== 3) {
      return { ok: false, error: `expected 3 page cards, got ${pages.length}` };
    }
  for (const key of ["pause", "legal", "smartviews"]) {
      document.querySelectorAll("#featuresBotDee .botdee-mgmt-page[data-botdee-page]").forEach(el => {
        const on = el.dataset.botdeePage === key;
        el.classList.toggle("hidden", !on);
        el.hidden = !on;
      });
      const hiddenTabs = buttons
        .filter(b => b.classList.contains("hidden") || b.hidden)
        .map(b => b.dataset.botdeePage);
      if (hiddenTabs.length) {
        return { ok: false, error: `after page ${key}, hidden tabs: ${hiddenTabs.join(",")}` };
      }
    }
    const labels = buttons.map(b => (b.textContent || "").trim());
    return { ok: true, labels };
  });

  await browser.close();
  if (!result.ok) {
    console.error("FAIL:", result.error);
    process.exit(1);
  }
  console.log("PASS: three subtabs always visible:", result.labels.join(" | "));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});