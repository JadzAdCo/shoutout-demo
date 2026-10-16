const fs = require("fs");
const path = require("path");
const r = require("./reports/instant-crawl-onboard-report.json");
const rows = r.rows.map(x => ({
  name: x.name,
  type: x.type,
  country: x.country,
  city: x.city,
  genre: x.genre,
  ready: !!x.onboardReady,
  missing: (x.missingDatapoints || []).join("; ")
}));
const out = {
  crawlCompletedAt: r.crawlCompletedAt,
  sampled: r.sampled,
  onboardReadyCount: r.onboardReadyCount,
  onboardReadyPct: r.onboardReadyPct,
  contactCompleteAfterPct: r.contactCompleteAfterPct,
  missingDatapointFrequency: r.missingDatapointFrequency,
  rows
};
fs.writeFileSync(path.join("reports", "instant-crawl-rows-compact.json"), JSON.stringify(out));
process.stdout.write(JSON.stringify({
  crawlCompletedAt: out.crawlCompletedAt,
  sampled: out.sampled,
  ready: out.onboardReadyCount,
  readyPct: out.onboardReadyPct,
  contactAfter: out.contactCompleteAfterPct,
  missing: out.missingDatapointFrequency,
  readyNames: rows.filter(x => x.ready).map(x => `${x.city}: ${x.name}`)
}) + "\n");
