/* FLOQR app-wide help repository — source of truth for FloqAi contextual search.
 * Every "?" help popout verbiage must be registered here (static seed and/or runtime).
 */
(function (global) {
  "use strict";

  const APP_V = (global.FLOQRNav && global.FLOQRNav.appVersion) || "29.09.49";
  const byId = new Map();

  function vUrl(path, params = {}) {
    const qs = new URLSearchParams({v: APP_V, ...params});
    return `${path}?${qs.toString()}`;
  }

  function normalize(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function slug(value) {
    return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "help";
  }

  function register(entry = {}) {
    const title = normalize(entry.title || entry.label || "");
    if (!title && !normalize(entry.body)) return null;
    const id = String(entry.id || `help-${slug(title)}`).trim();
    const existing = byId.get(id) || {};
    const links = Array.isArray(entry.links) ? entry.links.filter(link => link && link.href) : (existing.links || []);
    const searchPhrases = Array.from(new Set([
      ...(existing.searchPhrases || []),
      ...(entry.searchPhrases || []),
      title,
      ...links.map(link => normalize(link.label))
    ].map(normalize).filter(Boolean)));
    const next = {
      id,
      title: title || existing.title || id,
      body: normalize(entry.body || existing.body || ""),
      links: links.length ? links : (existing.links || []),
      searchPhrases,
      source: entry.source || existing.source || "help-repository",
      page: entry.page || existing.page || "",
      kind: entry.kind || existing.kind || "help"
    };
    byId.set(id, next);
    return next;
  }

  function registerMany(entries) {
    (entries || []).forEach(register);
  }

  function registerFromHelpNode(node, meta = {}) {
    if (!node || node.nodeType !== 1) return null;
    if (node.dataset?.floqaiHelpRegistered === "1") return byId.get(node.dataset.floqaiHelpId || "") || null;
    const title = normalize(meta.title || node.getAttribute("aria-label") || node.querySelector?.("summary")?.getAttribute("aria-label") || "Help");
    const bodyRoot = node.querySelector?.(".floqai-help-body, .help-popout-body, div:not(summary)") || node;
    const body = normalize(meta.body || bodyRoot?.innerText || node.innerText || "");
    const links = [...(node.querySelectorAll?.("a[href]") || [])].map(anchor => ({
      label: normalize(anchor.textContent),
      href: anchor.getAttribute("href") || "",
      searchPhrases: String(anchor.getAttribute("data-search") || "").split("|").map(normalize).filter(Boolean),
      blurb: normalize(anchor.getAttribute("data-blurb") || "")
    })).filter(link => link.href && link.label);
    const id = meta.id || `popout-${slug(title)}-${slug(body).slice(0, 24)}`;
    const entry = register({
      id,
      title,
      body,
      links: links.map(link => ({label: link.label, href: link.href})),
      searchPhrases: [
        title,
        body,
        ...(meta.searchPhrases || []),
        ...links.flatMap(link => [link.label, ...(link.searchPhrases || [])])
      ],
      source: meta.source || "help-popout",
      page: meta.page || (global.location && global.location.pathname) || ""
    });
    // Also register each link as its own searchable help row.
    links.forEach((link, index) => {
      register({
        id: `${id}-link-${index}`,
        title: link.label,
        body: link.blurb || body || `Open “${link.label}” from in-app help.`,
        links: [{label: link.label, href: link.href}],
        searchPhrases: [link.label, ...(link.searchPhrases || [])],
        source: "help-popout-link",
        page: entry.page
      });
    });
    node.dataset.floqaiHelpRegistered = "1";
    node.dataset.floqaiHelpId = id;
    return entry;
  }

  function registerDomHelpPopouts(root = global.document) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    const nodes = [
      ...root.querySelectorAll("#floqAiHelpPopout"),
      ...root.querySelectorAll("details.help-popout"),
      ...root.querySelectorAll(".floqai-help-popout"),
      ...root.querySelectorAll("[data-floqai-help-entry]")
    ];
    return nodes.map(node => registerFromHelpNode(node, {
      title: node.getAttribute("aria-label") || node.querySelector("summary")?.getAttribute("aria-label") || node.querySelector(".eyebrow")?.textContent || "Help",
      page: global.location?.pathname || ""
    })).filter(Boolean);
  }

  function entries() {
    return Array.from(byId.values());
  }

  function toSearchIntents() {
    return entries().map(entry => ({
      id: entry.id,
      kind: "help",
      source: entry.source,
      label: entry.title,
      blurb: entry.body || entry.title,
      links: (entry.links || []).length
        ? entry.links
        : [{label: entry.title, href: `./?v=${APP_V}&start=intent`}],
      searchPhrases: entry.searchPhrases || [],
      patterns: []
    }));
  }

  /* Seed: FloqAi "?" popout + core onboarding / role help (must stay in sync with UI). */
  registerMany([
    {
      id: "floqai-ask-floqr",
      title: "Ask FloqR with FloqAi",
      body: "Ask FloqR with FloqAi — tap the animated mark or wait for the prompt, then type what you want in plain words. Products: Mingl, RydR, BartR, ShoutOut, clubs. Goals: say “I want to be able to…” (e.g. become a Club Admin) for steps and links. Type any help-link phrase — including Onboarding.",
      searchPhrases: ["ask floqr", "floqai", "plain words", "i want to be able to", "help"],
      links: [
        {label: "Open FloqAi", href: `./?v=${APP_V}&start=intent`}
      ],
      source: "help-repository-seed",
      page: "index.html#floqAiHelpPopout"
    },
    {
      id: "help-become-club-admin",
      title: "Become a Club Admin",
      body: "Request Club Admin access, then get venue approval.",
      searchPhrases: ["become a club admin", "club admin", "be an admin", "I want to be a club admin"],
      links: [{label: "Request Club Admin access", href: vUrl("./role-request.html", {from: "floqai", type: "clubAdmin"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-become-dj",
      title: "Become a DJ",
      body: "Elect DJ as your service role and associate with clubs.",
      searchPhrases: ["become a dj", "dj access", "I want to be a dj", "disc jockey"],
      links: [{label: "Request DJ access", href: vUrl("./role-request.html", {from: "floqai", type: "dj"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-become-promoter",
      title: "Become a Promoter",
      body: "Request Promoter access for guest lists and campaigns.",
      searchPhrases: ["become a promoter", "promoter access", "promotion company"],
      links: [{label: "Request Promoter access", href: vUrl("./role-request.html", {from: "floqai", type: "promoter"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-role-profiles",
      title: "Role profiles overview",
      body: "See how Club Admin, DJ, Promoter, and hospitality roles work.",
      searchPhrases: ["role profiles", "role profiles overview", "how roles work", "service roles"],
      links: [{label: "Role profiles overview", href: vUrl("./role-profiles.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-my-profile",
      title: "My Profile & Settings",
      body: "Open My Profile & Settings for roles, seller tools, and account options.",
      searchPhrases: ["my profile", "profile and settings", "settings", "account", "my profile & settings"],
      links: [{label: "My Profile & Settings", href: vUrl("./patron-portal.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-onboarding",
      title: "Onboarding",
      body: "Patron / service-member onboarding — request Club Admin, DJ, Promoter, or hospitality access. Master Admins can also onboard venues.",
      searchPhrases: [
        "onboarding", "link to onboarding", "onboard", "patron onboarding",
        "role onboarding", "service member onboarding", "request access", "get started"
      ],
      links: [
        {label: "Role / service onboarding", href: vUrl("./role-request.html", {from: "floqai"})},
        {label: "Venue onboarding (Master Admin)", href: vUrl("./onboard-dc-venues.html", {from: "floqai"})}
      ],
      source: "help-repository-seed"
    },
    {
      id: "help-venue-onboarding",
      title: "Venue onboarding (Master Admin)",
      body: "Master Admin venue onboarding — push crawled club profiles into Firestore.",
      searchPhrases: ["venue onboarding", "onboard clubs", "onboard venues", "dc venues", "link to onboarding venues", "master admin onboarding"],
      links: [{label: "Venue onboarding", href: vUrl("./onboard-dc-venues.html", {from: "floqai"})}],
      source: "help-repository-seed"
    },
    {
      id: "help-mingl-search",
      title: "About Mingl search",
      body: "Search public profiles by shared interests, lifestyle, music, travel, food, events, cars, city, username, or who you want to meet.",
      searchPhrases: ["mingl search", "search people", "mingl social playground", "find people"],
      links: [{label: "Open Mingl", href: `./?v=${APP_V}&start=mingl`}],
      source: "help-repository-seed",
      page: "index.html#mingl"
    },
    {
      id: "help-mingl-requests",
      title: "About Mingl Requests",
      body: "Sent and received Friend or Mingl Requests appear here. Requests stay on the main Mingl page; accepted conversations open in Mingl Chat.",
      searchPhrases: ["mingl requests", "friend request", "mingl chat"],
      links: [{label: "Open Mingl", href: `./?v=${APP_V}&start=mingl`}],
      source: "help-repository-seed",
      page: "index.html#mingl"
    }
  ]);

  function boot() {
    try { registerDomHelpPopouts(global.document); } catch (error) {}
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.FLOQRHelpRepository = {
    register,
    registerMany,
    registerFromHelpNode,
    registerDomHelpPopouts,
    entries,
    toSearchIntents,
    vUrl
  };
})(window);
