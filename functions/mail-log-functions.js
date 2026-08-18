/**
 * SendGrid Event Webhook → systemMailLogs delivery updates.
 * Public HTTPS; matches FLOQR custom_args.floqrMailLogId (or x-message-id).
 */
"use strict";

const {onRequest} = require("firebase-functions/v2/https");
const {applyMailEvents} = require("./mail-log");

function parseBody(req) {
  if (Array.isArray(req.body)) return req.body;
  if (req.body && typeof req.body === "object" && Array.isArray(req.body.events)) return req.body.events;
  if (typeof req.rawBody === "string" && req.rawBody.trim().startsWith("[")) {
    try { return JSON.parse(req.rawBody); } catch (_) { return []; }
  }
  return [];
}

exports.sendgridMailEvents = onRequest({
  region: "us-central1",
  timeoutSeconds: 30,
  memory: "256MiB",
  cors: true
}, async (req, res) => {
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      res.status(200).json({ok: true, service: "sendgridMailEvents"});
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }
    const events = parseBody(req);
    const result = await applyMailEvents(events);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ok: false, error: String(error?.message || error).slice(0, 300)});
  }
});
