"use strict";
const fs = require("fs");
const vm = require("vm");
const sandbox = {window: {}, console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("jersey-catalog.js", "utf8"), sandbox);
const cat = sandbox.window.FLOQR_JERSEY_CATALOG;
const nfl = Object.values(cat).filter(t => t.sport === "nfl" && t.defaultBackgroundUrl);
const nba = Object.values(cat).filter(t => t.sport === "nba" && t.league === "NBA" && t.defaultBackgroundUrl && t.jerseyOverlayWordmark && !t.nbaDualFaces);
const terps = cat.nbaMarylandTerps;
if (nfl.length < 33) throw new Error("nfl photos " + nfl.length);
if (nba.length !== 30) throw new Error("nba photos " + nba.length);
if (!terps || !terps.jerseyStateField || terps.jerseyTeamLabel !== "MARYLAND") throw new Error("terps");
const need = ["nflAtlantaFalcons", "nbaLosAngelesLakers", "nbaBostonCeltics", "nbaUtahJazz", "nbaMiamiHeat", "nbaHoustonRockets", "nbaPhiladelphia76ers", "nbaPhiladelphia76ersPhila"];
for (const id of need) {
  if (!cat[id] || !cat[id].jerseyOverlayWordmark) throw new Error("missing " + id);
}
if (cat.nbaLosAngelesLakers.jerseyTeamLabel !== "LAKERS") throw new Error("lakers label");
if (cat.nbaPhiladelphia76ers.jerseyTeamLabel !== "76ERS") throw new Error("sixers label");
if (!cat.nbaPhiladelphia76ersPhila.nbaDualFaces) throw new Error("phila dual faces");
if (!cat.nbaPhiladelphia76ersPhila.nbaJerseyPair) throw new Error("phila jersey pair");
if (cat.nbaPhiladelphia76ersPhila.jerseySceneMs !== 7000) throw new Error("phila jersey 7s");
if (cat.nbaPhiladelphia76ersPhila.messageSceneMs !== 5000) throw new Error("phila message 5s");
if (cat.nbaPhiladelphia76ersPhila.jerseyTeamLabel !== "PHILA") throw new Error("phila label");
if (!/nba-76ers-phila-front-blank\.png/.test(cat.nbaPhiladelphia76ersPhila.frontBackgroundUrl || "")) throw new Error("phila front blank url");
if (!/nba-76ers-phila-back-blank\.png/.test(cat.nbaPhiladelphia76ersPhila.backBackgroundUrl || "")) throw new Error("phila back blank url");
if (cat.nbaPhiladelphia76ersPhila.jerseyCssBack !== false) throw new Error("phila photo blanks must win over css hanger");
const terpsPair = cat.nbaMarylandTerpsThrowbackPair;
if (!terpsPair || !terpsPair.nbaJerseyPair) throw new Error("terps pair");
if (terpsPair.stableTemplateId !== "ncaa-umd-2026-27-2002-throwback-white-v2") throw new Error("terps pair stable id");
if (terpsPair.jerseyTeamLabel !== "MARYLAND") throw new Error("terps pair wordmark");
if (terpsPair.catalogPublished !== false || terpsPair.productionAssetsReady !== false) throw new Error("terps pair must stay unpublished");
if (terpsPair.frontBackgroundUrl) throw new Error("terps pair front must be empty until plates ready");
if (terpsPair.pairMessageTheme !== "maryland") throw new Error("terps pair message theme");
if ((sandbox.window.FLOQR_JERSEY_TEMPLATE_IDS || []).includes("nbaMarylandTerpsThrowbackPair")) {
  throw new Error("unpublished terps pair must not be in FLOQR_JERSEY_TEMPLATE_IDS");
}
const out = cat.nbaMarylandTerps.jerseyOutput;
if (!out || out.number.one !== 0.4968 || out.number.two !== 0.36432 || out.number.top !== 0.32355 || out.number.style !== "alumni-collegiate" || out.name.top !== 0.2315) throw new Error("output number");
if (out.word.wrapAtSpace !== true || out.word.wrapLines !== 2 || out.word.top !== 0.103 || out.word.liftCm !== 4 || out.word.archDegrees !== 25) throw new Error("wrap");
if (out.word.longAt !== 10 || "TIMBERWOLVES".length < out.word.longAt) throw new Error("long state");
if (!/LOS ANGELES/.test(cat.nbaMarylandTerps.description) || !/OKLAHOMA CITY/.test(cat.nbaMarylandTerps.description)) throw new Error("city wrap copy");
if (!cat.nbaLosAngelesLakers.jerseyOutput || !/OKLAHOMA CITY/.test(cat.nbaMarylandTerps.description)) throw new Error("output on template");
if (cat.nbaOklahomaCityThunder.jerseyPlateLabel !== "THUNDER") throw new Error("thunder plate");
console.log("ok", nfl.length, "nfl photos;", nba.length, "nba photos;", terps.id, terps.defaultBackgroundUrl);
