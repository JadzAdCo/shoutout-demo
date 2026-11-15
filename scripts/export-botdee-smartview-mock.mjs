#!/usr/bin/env node
/** Regenerate botdee-smartview-mock.json from functions/botdee-smartview-core.js mockCatalog(). */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smart = require(path.join(root, "functions/botdee-smartview-core.js"));
const views = smart.mockCatalog();
const out = {
  schemaVersion: "floqr.smartViewMock/export",
  updatedAt: new Date().toISOString().slice(0, 10),
  views
};
writeFileSync(path.join(root, "botdee-smartview-mock.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`botdee-smartview-mock.json: ${views.length} views`);