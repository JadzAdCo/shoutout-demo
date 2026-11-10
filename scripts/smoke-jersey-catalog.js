"use strict";
const fs = require("fs");
const vm = require("vm");
const sandbox = {window: {}, console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("jersey-catalog.js", "utf8"), sandbox);
const cat = sandbox.window.FLOQR_JERSEY_CATALOG;
const nfl = Object.values(cat).filter(t => t.sport === "nfl" && t.defaultBackgroundUrl);
const terps = cat.nbaMarylandTerps;
if (nfl.length < 33) throw new Error("nfl photos " + nfl.length);
if (!terps || !terps.jerseyStateField || terps.jerseyTeamLabel !== "MARYLAND") throw new Error("terps");
const need = ["nflAtlantaFalcons", "nflTennesseeTitans", "nflWashingtonCommanders", "nflLosAngelesChargers"];
for (const id of need) {
  if (!cat[id] || !cat[id].jerseyOverlayWordmark) throw new Error("missing " + id);
}
console.log("ok", nfl.length, "nfl photos;", terps.id, terps.defaultBackgroundUrl);
