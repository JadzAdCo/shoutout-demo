/* FLOQR app-wide help repository — source of truth for BOT DEE contextual search.
 * Every "?" help popout verbiage must be registered here (static seed and/or runtime).
 */
(function (global) {
  "use strict";

  const byId = new Map();
  /** Canonical BOT DEE help partitions (one audience key each). */
  const HELP_PARTITIONS = {
    patron: "patronHelpverbiage",
    serviceMember: "serviceMemberHelpverbiage",
    venueAdmin: "venueAdminHelpverbiage",
    masterAdmin: "masterAdminHelpverbiage"
  };
  const AUDIENCES = Object.keys(HELP_PARTITIONS);
  const MASTER_ADMIN_EMAILS = new Set(
    String(global.FLOQR_MASTER_ADMIN_EMAILS || "bans.don@gmail.com,don.b@jadzholdings.com")
      .split(",")
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );
  let viewerAudience = "patron";
  let viewerAccessFlags = {
    IsPatron: 0,
    IsServiceMember: 0,
    IsVenueAdmin: 0,
    IsMasterAdmin: 0
  };

  function pageUrl(path, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return qs ? `${path}?${qs}` : path;
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

  function flagOn(value) {
    return /^(1|true|yes)$/i.test(String(value ?? "").trim());
  }

  function normalizeAudiences(raw) {
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const cleaned = list.map(value => {
      const key = String(value || "").trim();
      if (AUDIENCES.includes(key)) return key;
      const fromPartition = Object.entries(HELP_PARTITIONS).find(([, name]) => name === key);
      return fromPartition ? fromPartition[0] : "";
    }).filter(Boolean);
    return cleaned.length ? Array.from(new Set(cleaned)) : [];
  }

  /** Infer audience when a seed/popout omits audiences — one partition per entry. */
  function inferAudiences(entry = {}) {
    const explicit = normalizeAudiences(entry.audiences || entry.audience || entry.helpPartition || entry.partition);
    if (explicit.length) return explicit;
    const blob = `${entry.id || ""} ${entry.title || ""} ${entry.page || ""} ${entry.body || ""} ${entry.source || ""}`.toLowerCase();
    if (/sos2fa|social os|entity management|master-admin|master admin|purge queue|venue links|diagnostics|mail log|heist.*64\s*x\s*48|64x48.*heist|display setup|privilege admin|masteradminhelpverbiage/.test(blob)) {
      return ["masterAdmin"];
    }
    if (/admin\.html|club admin|venue admin|club public profile|display screens|venuesupports|scheduling|suprstar queue|template catalog|message template|venueadminhelpverbiage/.test(blob)) {
      return ["venueAdmin"];
    }
    if (/service member|work calendar|staff worksheet|role-request|become a dj|become a promoter|bartender|waitress|busboy|elect.*service|servicememberhelpverbiage/.test(blob)) {
      return ["serviceMember"];
    }
    return ["patron"];
  }

  /**
   * Partition access — design notes: .cursor/rules/design-notes-botdee-partitions.mdc
   */
  function canAccessPartition(audienceKey, flags = viewerAccessFlags) {
    const f = flags || {};
    if (flagOn(f.IsMasterAdmin)) return true;
    switch (audienceKey) {
      case "patron": return flagOn(f.IsPatron);
      case "serviceMember": return flagOn(f.IsServiceMember);
      case "venueAdmin": return flagOn(f.IsVenueAdmin);
      case "masterAdmin": return false;
      default: return false;
    }
  }

  function canAccessHelpEntry(entry, flags = viewerAccessFlags) {
    const audiences = normalizeAudiences(entry?.audiences || entry?.audience);
    const keys = audiences.length ? audiences : ["patron"];
    return keys.some(key => canAccessPartition(key, flags));
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
    const steps = Array.isArray(entry.steps)
      ? entry.steps.map(normalize).filter(Boolean)
      : (existing.steps || []);
    const audiences = normalizeAudiences(entry.audiences || entry.audience || entry.helpPartition || entry.partition).length
      ? normalizeAudiences(entry.audiences || entry.audience || entry.helpPartition || entry.partition)
      : (existing.audiences?.length ? existing.audiences : inferAudiences({...existing, ...entry, id, title}));
    const helpPartition = HELP_PARTITIONS[audiences[0]] || HELP_PARTITIONS.patron;
    const next = {
      id,
      title: title || existing.title || id,
      body: normalize(entry.body || existing.body || ""),
      steps,
      links: links.length ? links : (existing.links || []),
      searchPhrases,
      audiences,
      helpPartition,
      source: entry.source || existing.source || "help-repository",
      page: entry.page || existing.page || "",
      kind: entry.kind || existing.kind || "help",
      locales: entry.locales != null ? entry.locales : existing.locales
    };
    byId.set(id, next);
    return next;
  }

  function resolveUiLanguage() {
    try {
      if (global.FLOQRI18n?.getLanguage) return global.FLOQRI18n.getLanguage() || "en";
      if (global.FLOQRI18n?.current) return global.FLOQRI18n.current;
      return localStorage.getItem("floqr.uiLanguage") || "en";
    } catch (_) {
      return "en";
    }
  }

  /* Public lasttextenhun only. Master Admin copy is not in this script.
     help-verbiage-snapshot:start */
  const HELP_VERBIAGE_SNAPSHOT = {
  "help-botdee-version-smartview": {
    "id": "help-botdee-version-smartview",
    "audiences": [
      "patron",
      "serviceMember",
      "venueAdmin"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "Version SMARTview",
      "body": "Type Ver, Vers, or Version — capitals do not matter. BOT DEE shows the version card. A longer question like “what is your version?” still shows that card."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "help-botdee-version-smartview-status": {
    "id": "help-botdee-version-smartview-status",
    "audiences": [
      "patron",
      "serviceMember",
      "venueAdmin"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "Version SMARTview status is a live probe",
      "body": "Service status is probed on this Version request: Functions and package reachable with Gemini configured → Operational; Functions and package up but Gemini not configured → Degraded; Functions not in this request → Unavailable. It is never a static Not checked label. AI model shows the configured Gemini model id for this deployment even when this turn did not generate. Frontend and backend package stamps can differ; both are labeled. Master Admin may see extra diagnostics after Technical Details — patrons do not."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "help-botdee-version-smartview-tabs": {
    "id": "help-botdee-version-smartview-tabs",
    "audiences": [
      "patron",
      "serviceMember",
      "venueAdmin"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "Version SMARTview tabs",
      "body": "Overview describes BOT DEE and opens Technical Details without leaving chat. What's New lists verified BOT DEE and Gemini changes only — not Master Admin, beta tester tools, or other FLOQR product notes. Help repeats the Ver / Vers / Version command. Switching tabs or expanding details keeps your unsent draft and scroll. The card uses your Site Chrome — there is no second theme."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.085": {
    "id": "whatsnew-s3.3.085",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.085",
      "body": "s3.3.085: BOT DEE city and place tokens in all 11 languages"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.083": {
    "id": "whatsnew-s3.3.083",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.083",
      "body": "s3.3.083: Let's plan for Bali opens Bali Place SMARTview with the published SMARTbackground"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.082": {
    "id": "whatsnew-s3.3.082",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.082",
      "body": "s3.3.082: Miami Place SMARTview uses the published SMARTbackground, not leftover Bali art"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.081": {
    "id": "whatsnew-s3.3.081",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.081",
      "body": "s3.3.081: After Invite sent, type in this BOT DEE room; Search Join Now stays botdee.html?room="
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.080": {
    "id": "whatsnew-s3.3.080",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.080",
      "body": "s3.3.080: BOT DEE VIP reserV map at Aurelia plus Miami Place SMARTview on mixed VIP input"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.079": {
    "id": "whatsnew-s3.3.079",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.079",
      "body": "s3.3.079: Search Join Now attaches the existing BOT DEE Room SMARTview group chat (Don + Lorna names + shared turns)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.078": {
    "id": "whatsnew-s3.3.078",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.078",
      "body": "s3.3.078: Search SMARTnotification for a Miami-tagged room uses Place SMARTview cards"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.077": {
    "id": "whatsnew-s3.3.077",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.077",
      "body": "s3.3.077: BOT DEE Room SMARTview Invite chip stays greyed with Invite sent (Lorna / MsLorna)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.076": {
    "id": "whatsnew-s3.3.076",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.076",
      "body": "s3.3.076: BOT DEE named Invite lorna + Search SMARTnotification for scheduled rooms + Miami-tagged Place SMARTview on Room SMARTview city asks"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.075": {
    "id": "whatsnew-s3.3.075",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.075",
      "body": "s3.3.075: Room SMARTview shared picks + 60% host election, VIP session popouts"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.074": {
    "id": "whatsnew-s3.3.074",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.074",
      "body": "s3.3.074: BOT DEE can throw a ShoutOut from chat using each template's listed inputs"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.072": {
    "id": "whatsnew-s3.3.072",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.072",
      "body": "s3.3.072: BOT DEE Search SMARTnotification compact Mingl Room Invitation matches the original Cancun phone card"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.071": {
    "id": "whatsnew-s3.3.071",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.071",
      "body": "s3.3.071: Room SMARTview Join Now or Set a schedule. A schedule is when the BOT DEE room starts and can appear on Search for invited Mingl friends. Join Now does not."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.070": {
    "id": "whatsnew-s3.3.070",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.070",
      "body": "s3.3.070: BOT DEE Room SMARTview: invite chips say That's you or Already in this session"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.055": {
    "id": "whatsnew-s3.3.055",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.055",
      "body": "s3.3.055: VIP reserV — book or hold a table interactively with BOT DEE, including the night you want, the 2D floor map, and cancel, which removes the booking panel."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.054": {
    "id": "whatsnew-s3.3.054",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.054",
      "body": "s3.3.054: BOT DEE people search matches names and handles only, not bios, and shows smaller cards when several people match."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.051": {
    "id": "whatsnew-s3.3.051",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.051",
      "body": "s3.3.051: Talk about a Cancun trip with BOT DEE and Room SMARTview opens — the same card as Open Room SMARTview Cancun Trip."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.050": {
    "id": "whatsnew-s3.3.050",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.050",
      "body": "s3.3.050: BOT DEE Mingl session invites (friends only, host plus 7 guests, guests can invite) + FloqR Stripe shared tab"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.046": {
    "id": "whatsnew-s3.3.046",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.046",
      "body": "s3.3.046: People SMARTview spacing is tighter, you can book VIP reserV from BOT DEE chat, and you can join a Room SMARTview."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.045": {
    "id": "whatsnew-s3.3.045",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.045",
      "body": "s3.3.045: ShoutOut SMARTpreview shows the live LED template and updates as you edit"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.044": {
    "id": "whatsnew-s3.3.044",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.044",
      "body": "s3.3.044: ShoutOut SMARTpreview in BOT DEE asks for the template, the @handle, and a photo or video."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.043": {
    "id": "whatsnew-s3.3.043",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.043",
      "body": "s3.3.043: Throw a ShoutOut in BOT DEE chat. It uses the same ShoutOut page, Club Admin inbox, and LED."
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.041": {
    "id": "whatsnew-s3.3.041",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.041",
      "body": "s3.3.041: BOT DEE + FloqR headless ShoutOut (club + message → Stripe or pending)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.040": {
    "id": "whatsnew-s3.3.040",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.040",
      "body": "s3.3.040: People lookup matches legal name, display name, handle, what-about"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.039": {
    "id": "whatsnew-s3.3.039",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.039",
      "body": "s3.3.039: People card stacked layout (photo, name+handle, compact SMARTsummary)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.038": {
    "id": "whatsnew-s3.3.038",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.038",
      "body": "s3.3.038: BOT DEE throw a ShoutOut from chat (no stacked help dump)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.037": {
    "id": "whatsnew-s3.3.037",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.037",
      "body": "s3.3.037: BOT DEE SMARTview transcript scroll + rename saved chats"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.036": {
    "id": "whatsnew-s3.3.036",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.036",
      "body": "s3.3.036: BOT DEE history collapse (+ / − Chats nest, Back to Search, recall kept)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.034": {
    "id": "whatsnew-s3.3.034",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.034",
      "body": "s3.3.034: Version SMARTview card only; real Gemini model id"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.033": {
    "id": "whatsnew-s3.3.033",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.033",
      "body": "s3.3.033: BOT DEE Room SMARTview intent routing (confirmation card; group rooms not live)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.032": {
    "id": "whatsnew-s3.3.032",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.032",
      "body": "s3.3.032: BOT DEE Version SMARTview (Ver / Vers / Version aliases, honest stamps)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.031": {
    "id": "whatsnew-s3.3.031",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.031",
      "body": "s3.3.031: SMARTview spelling + public-page Profile Media on People cards"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.030": {
    "id": "whatsnew-s3.3.030",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.030",
      "body": "s3.3.030: My BOT DEE View my SMARTview (real patron card, mocks stay on Master Admin)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.029": {
    "id": "whatsnew-s3.3.029",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.029",
      "body": "s3.3.029: My BOT DEE iOS demeanor radios (custom 22px grid, cache-bust from s3.3.028)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.028": {
    "id": "whatsnew-s3.3.028",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.028",
      "body": "s3.3.028: People SMARTview v2 (inline patron card, owner edit, translation queue, Site Chrome)"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.027": {
    "id": "whatsnew-s3.3.027",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.027",
      "body": "s3.3.027: BOT DEE recall after 300s pause — retrieve stored events, recap last two turns, discussed vs booked"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.026": {
    "id": "whatsnew-s3.3.026",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.026",
      "body": "s3.3.026: BOT DEE first-use overlay + My BOT DEE prefs"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  },
  "whatsnew-s3.3.025": {
    "id": "whatsnew-s3.3.025",
    "audiences": [
      "patron"
    ],
    "audienceLabel": "patron",
    "lasttextenhun": {
      "title": "What's New s3.3.025",
      "body": "s3.3.025: BOT DEE personalization (name/demeanor/recap), short composer, Hello sir greeting, privacy Help"
    },
    "locales": {},
    "beenModsincelasttextenhun": 1
  }
};
  /* help-verbiage-snapshot:end */

  function publishedHelpCopy(entry, lang) {
    if (!entry || !entry.id) return null;
    const row = HELP_VERBIAGE_SNAPSHOT[entry.id];
    if (!row || !row.lasttextenhun) return null;
    const audiences = Array.isArray(row.audiences) ? row.audiences : [];
    if (audiences.length === 1 && audiences[0] === "masterAdmin") return null;
    const code = String(lang || "en").toLowerCase().split(/[-_]/)[0] || "en";
    if (code !== "en") {
      const locale = row.locales && row.locales[code];
      if (!locale || !locale.title || !locale.body) return null;
      return {title: locale.title, body: locale.body};
    }
    if (!row.lasttextenhun.title || !row.lasttextenhun.body) return null;
    return {title: row.lasttextenhun.title, body: row.lasttextenhun.body};
  }

  function localizeEntry(entry) {
    if (!entry) return entry;
    const lang = resolveUiLanguage();
    const base = global.FLOQRI18nHelp?.localize
      ? (global.FLOQRI18nHelp.localize(entry, lang) || entry)
      : (() => {
        const code = String(lang || "en").toLowerCase().split(/[-_]/)[0];
        const row = entry.locales && entry.locales[code];
        if (!row) return entry;
        return Object.assign({}, entry, {
          title: row.title || entry.title,
          body: row.body || entry.body
        });
      })();
    const published = publishedHelpCopy(entry, lang);
    if (!published) return base;
    return Object.assign({}, base, published);
  }

  function registerMany(entries) {
    (entries || []).forEach(register);
  }

  function registerFromHelpNode(node, meta = {}) {
    if (!node || node.nodeType !== 1) return null;
    if (node.dataset?.botdeeHelpRegistered === "1" || node.dataset?.floqaiHelpRegistered === "1") {
      return byId.get(node.dataset.botdeeHelpId || node.dataset.floqaiHelpId || "") || null;
    }
    const title = normalize(meta.title || node.getAttribute("aria-label") || node.querySelector?.("summary")?.getAttribute("aria-label") || "Help");
    const bodyRoot = node.querySelector?.(".botdee-help-body, .help-popout-body, div:not(summary)") || node;
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
    node.dataset.botdeeHelpRegistered = "1";
    node.dataset.botdeeHelpId = id;
    return entry;
  }

  function registerDomHelpPopouts(root = global.document) {
    if (!root || typeof root.querySelectorAll !== "function") return [];
    const nodes = [
      ...root.querySelectorAll("#botDeeHelpPopout"),
      ...root.querySelectorAll("details.help-popout"),
      ...root.querySelectorAll(".botdee-help-popout"),
      ...root.querySelectorAll("[data-botdee-help-entry]")
    ];
    return nodes.map(node => registerFromHelpNode(node, {
      title: node.getAttribute("aria-label") || node.querySelector("summary")?.getAttribute("aria-label") || node.querySelector(".eyebrow")?.textContent || "Help",
      page: global.location?.pathname || ""
    })).filter(Boolean);
  }

  function entries(filterAudience) {
    const all = Array.from(byId.values());
    if (!filterAudience) return all;
    if (filterAudience === true || filterAudience === "accessible") {
      return all.filter(entry => canAccessHelpEntry(entry, viewerAccessFlags));
    }
    return all.filter(entry => (entry.audiences || []).includes(filterAudience));
  }

  function setViewerAudience(audience) {
    viewerAudience = AUDIENCES.includes(audience) ? audience : "patron";
    return viewerAudience;
  }

  function getViewerAudience() {
    return viewerAudience;
  }

  function getViewerAccessFlags() {
    return {...viewerAccessFlags};
  }

  function setViewerAccessFlags(flags = {}) {
    viewerAccessFlags = {
      IsPatron: flagOn(flags.IsPatron) ? 1 : 0,
      IsServiceMember: flagOn(flags.IsServiceMember) ? 1 : 0,
      IsVenueAdmin: flagOn(flags.IsVenueAdmin) ? 1 : 0,
      IsMasterAdmin: flagOn(flags.IsMasterAdmin) ? 1 : 0
    };
    if (viewerAccessFlags.IsMasterAdmin) viewerAudience = "masterAdmin";
    else if (viewerAccessFlags.IsVenueAdmin) viewerAudience = "venueAdmin";
    else if (viewerAccessFlags.IsServiceMember) viewerAudience = "serviceMember";
    else if (viewerAccessFlags.IsPatron) viewerAudience = "patron";
    else viewerAudience = "patron";
    return getViewerAccessFlags();
  }

  function resolveAccessFlagsFromProfile({authUser = null, userDoc = null, tokenClaims = null} = {}) {
    const user = authUser || global.firebase?.auth?.()?.currentUser || null;
    const profile = userDoc || {};
    const email = String(user?.email || profile.email || "").trim().toLowerCase();
    let claims = tokenClaims || {};
    const isMaster = !!(
      flagOn(profile.IsMasterAdmin)
      || flagOn(profile.isMasterAdmin)
      || claims.masterAdmin === true
      || claims.IsMasterAdmin === true
      || (email && MASTER_ADMIN_EMAILS.has(email))
    );
    const isVenue = !!(
      flagOn(profile.IsVenueAdmin)
      || flagOn(profile.isVenueAdmin)
      || flagOn(profile.IsClubAdmin)
      || flagOn(profile.isClubAdmin)
      || flagOn(profile.clubAdmin)
      || claims.clubAdmin === true
      || claims.IsVenueAdmin === true
      || (Array.isArray(profile.adminClubIds) && profile.adminClubIds.length > 0)
    );
    const isService = !!(
      flagOn(profile.IsServiceMember)
      || flagOn(profile.IsserviceMember)
      || flagOn(profile.serviceMember)
      || claims.serviceMember === true
    );
    // Patrons: explicit IsPatron=1, or signed-in user who has not elected service member.
    let isPatron = flagOn(profile.IsPatron);
    if (!isPatron && user && !isService && !isVenue && !isMaster && profile.IsPatron == null && profile.IsServiceMember == null) {
      isPatron = true;
    }
    return {
      IsPatron: isPatron ? 1 : 0,
      IsServiceMember: isService ? 1 : 0,
      IsVenueAdmin: isVenue ? 1 : 0,
      IsMasterAdmin: isMaster ? 1 : 0
    };
  }

  async function resolveViewerAudience({authUser = null, userDoc = null, tokenClaims = null} = {}) {
    const user = authUser || global.firebase?.auth?.()?.currentUser || null;
    let claims = tokenClaims;
    if (user && !claims && typeof user.getIdTokenResult === "function") {
      try { claims = (await user.getIdTokenResult()).claims || {}; } catch (_) { claims = {}; }
    }
    const flags = resolveAccessFlagsFromProfile({authUser: user, userDoc, tokenClaims: claims || {}});
    setViewerAccessFlags(flags);
    return viewerAudience;
  }

  function toSearchIntents(audienceOrFlags) {
    let list;
    if (audienceOrFlags && typeof audienceOrFlags === "object" && !Array.isArray(audienceOrFlags)) {
      list = Array.from(byId.values()).filter(entry => canAccessHelpEntry(entry, audienceOrFlags));
    } else if (typeof audienceOrFlags === "string" && AUDIENCES.includes(audienceOrFlags)) {
      // Legacy single-audience calls: still apply datapoint gate for the current viewer.
      list = entries(audienceOrFlags).filter(entry => canAccessHelpEntry(entry, viewerAccessFlags));
    } else {
      list = entries("accessible");
    }
    return list.map(entry => {
      const localized = localizeEntry(entry) || entry;
      const searchPhrases = Array.from(new Set([
        ...(entry.searchPhrases || []),
        ...(localized.searchPhrases || []),
        localized.title,
        localized.body
      ].map(normalize).filter(Boolean)));
      return {
        id: entry.id,
        kind: "help",
        source: entry.source,
        label: localized.title || entry.title,
        blurb: localized.body || entry.body || entry.title,
        steps: entry.steps || [],
        audiences: entry.audiences || ["patron"],
        helpPartition: entry.helpPartition || HELP_PARTITIONS[(entry.audiences || ["patron"])[0]] || HELP_PARTITIONS.patron,
        links: (entry.links || []).length
          ? entry.links
          : [{label: localized.title || entry.title, href: pageUrl("./botdee.html")}],
        searchPhrases,
        patterns: []
      };
    });
  }

  /* Seed: BOT DEE "?" popout + core onboarding / role help (must stay in sync with UI). */
  registerMany([]);

  function boot() {
    try { registerDomHelpPopouts(global.document); } catch (error) {}
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.FLOQRHelpRepository = {
    AUDIENCES,
    HELP_PARTITIONS,
    register,
    registerMany,
    registerFromHelpNode,
    registerDomHelpPopouts,
    entries,
    toSearchIntents,
    localizeEntry,
    setViewerAudience,
    getViewerAudience,
    getViewerAccessFlags,
    setViewerAccessFlags,
    resolveAccessFlagsFromProfile,
    resolveViewerAudience,
    canAccessPartition,
    canAccessHelpEntry,
    inferAudiences,
    pageUrl
  };
})(window);
