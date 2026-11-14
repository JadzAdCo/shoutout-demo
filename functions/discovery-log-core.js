/**
 * Categorized AI Crawling application logs.
 * One size does not fit all: each crawl family has its own action set so
 * Diagnostics can filter Runs, Discoveries, Duplicates, Auto-publish, CSV,
 * Past events, and Publish separately.
 */
"use strict";

const CATEGORY = "aiCrawl";

const LOG_FAMILIES = {
  run: {label: "Runs", actions: ["run_start", "run_complete", "run_failed"]},
  discover: {label: "Discoveries", actions: ["discover", "queue_write"]},
  duplicate: {label: "Duplicates", actions: ["duplicate_flag"]},
  autoPublish: {label: "Auto-publish", actions: ["auto_publish", "auto_publish_denied"]},
  csv: {label: "CSV", actions: ["csv_import", "csv_export", "csv_template"]},
  pastEvent: {label: "Past events", actions: ["past_event_ignored", "past_event_cleaned"]},
  publish: {label: "Publish", actions: ["publish", "publish_blocked"]}
};

function familyOf(action = "") {
  const key = String(action || "");
  return Object.keys(LOG_FAMILIES).find(family => LOG_FAMILIES[family].actions.includes(key)) || "run";
}

function buildCrawlLog({
  action = "run_complete",
  message = "",
  level = "info",
  details = null,
  correlationId = "",
  uid = "system",
  email = "",
  runId = ""
} = {}) {
  const family = familyOf(action);
  return {
    level: ["debug", "info", "warn", "error"].includes(level) ? level : "info",
    category: CATEGORY,
    family,
    action: String(action).slice(0, 120),
    message: String(message || `${LOG_FAMILIES[family].label}: ${action}`).slice(0, 2000),
    details: details && typeof details === "object" ? details : null,
    correlationId: String(correlationId || "").slice(0, 80),
    runId: String(runId || "").slice(0, 80),
    uid: String(uid || "system").slice(0, 120),
    email: String(email || "").slice(0, 200),
    source: "functions",
    logCategory: "diagnostic"
  };
}

module.exports = {
  CATEGORY,
  LOG_FAMILIES,
  familyOf,
  buildCrawlLog
};
