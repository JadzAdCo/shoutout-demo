// VIP Reservations ledger — PROTOTYPE pending owner approval. Not wired into any page or Function.
// Design notes: .cursor/rules/design-notes-vip-reservations.mdc · reports/vip-notifications-billing.md §7
"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("node:crypto"));
  } else {
    root.FLOQRVipLedger = factory(null);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (nodeCrypto) {
  const DAY_MS = 86400000;
  const GENESIS_HASH = "0".repeat(64);
  const REASON_MIN = 8;
  const STALE_CHECK_DAYS = 180;
  const DEFAULT_TERMS_DAYS = 30;
  const MAX_FEE_BPS = 5000;
  const DEFAULT_STRIPE_PRICING = Object.freeze({ bps: 290, fixedCents: 30 });
  const VENUE_METHODS = Object.freeze(["cash", "card-terminal", "pos-ref"]);
  const NORMAL_SIDE = Object.freeze({
    asset: "debit", expense: "debit", contraRevenue: "debit",
    liability: "credit", equity: "credit", revenue: "credit"
  });

  class LedgerError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = "LedgerError";
      this.code = code;
    }
  }
  function fail(code, message) { throw new LedgerError(code, message); }

  function chartOf(rows) {
    return Object.freeze(Object.fromEntries(rows.map(([code, name, type, partyDimension]) => [code, Object.freeze({
      code, name, type, normalSide: NORMAL_SIDE[type], partyDimension: partyDimension || null
    })])));
  }

  const PLATFORM_CHART = chartOf([
    ["1000", "Stripe balance (clearing)", "asset"],
    ["1020", "Operating bank", "asset"],
    ["1100", "Accounts receivable — clubs", "asset", "club"],
    ["1110", "Accounts receivable — promoters", "asset", "promoter"],
    ["1150", "Recoverable from clubs (refund / chargeback losses)", "asset", "club"],
    ["2010", "Accounts payable — promoters", "liability", "promoter"],
    ["2015", "Accrued promoter commissions (not yet invoiced)", "liability", "promoter"],
    ["2050", "Outstanding checks", "liability", "promoter"],
    ["2400", "Customer credit balances", "liability", "club"],
    ["2500", "Accounts payable — club payouts (in transit)", "liability", "club"],
    ["4010", "FLOQR fee revenue", "revenue", "club"],
    ["4030", "Patron service fee (processing pass-through)", "revenue"],
    ["5000", "Stripe processing fees", "expense"],
    ["5010", "Chargebacks and dispute fees", "expense", "club"],
    ["5030", "Promoter commissions (FloqMedia-paid)", "expense", "promoter"]
  ]);

  const CLUB_CHART = chartOf([
    ["1000", "Connected account balance (Stripe)", "asset"],
    ["1010", "POS clearing", "asset"],
    ["1020", "Cash / terminal at venue", "asset"],
    ["1030", "Operating bank", "asset"],
    ["2000", "Deposits held (apply to tab)", "liability", "reservation"],
    ["2010", "Accounts payable — promoters", "liability", "promoter"],
    ["2015", "Accrued promoter commissions (not yet invoiced)", "liability", "promoter"],
    ["2020", "Due to FloqMedia", "liability"],
    ["2050", "Outstanding checks", "liability", "promoter"],
    ["4000", "Entry fee revenue", "revenue"],
    ["4100", "Forfeited deposits (no-show, no refund)", "revenue"],
    ["4900", "Refunds to patrons", "contraRevenue"],
    ["5000", "Fees to FloqMedia", "expense"],
    ["5010", "Refund processing cost (recharged by FloqMedia)", "expense"],
    ["5030", "Promoter commissions", "expense", "promoter"]
  ]);

  const AGING_ACCOUNTS = Object.freeze({
    platform: Object.freeze({ AR: ["1100", "1110", "1150"], AP: ["2010"] }),
    club: Object.freeze({ AR: [], AP: ["2010", "2020"] })
  });
  const BANK_ACCOUNT = Object.freeze({ platform: "1020", club: "1030" });
  const APPROVER_ROLES = Object.freeze({ platform: ["masterAdmin"], club: ["clubOwner", "clubAdmin"] });
  const AP_CLERK_ROLES = Object.freeze({ platform: ["apClerk", "masterAdmin"], club: ["apClerk", "clubOwner", "clubAdmin"] });

  // ---------- pure helpers ----------

  function isCents(n) { return Number.isSafeInteger(n) && n >= 0; }
  function requireCents(n, field, allowZero) {
    if (!isCents(n) || (!allowZero && n === 0)) {
      fail("INVALID_AMOUNT", `${field} must be a ${allowZero ? "non-negative" : "positive"} integer number of cents`);
    }
    return n;
  }
  function requireText(value, field, minLength) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text.length < (minLength || 1)) fail(minLength ? "REASON_REQUIRED" : "MISSING_FIELD", `${field} is required${minLength ? ` (at least ${minLength} characters)` : ""}`);
    return text;
  }
  function requireBps(bps) {
    const value = bps === undefined ? 0 : bps;
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FEE_BPS) fail("INVALID_FEE", `feeBps must be an integer between 0 and ${MAX_FEE_BPS}`);
    return value;
  }
  function percentOf(amountCents, bps) { return Math.floor((amountCents * bps + 5000) / 10000); }
  function stripeFeeCents(chargeCents, pricing) {
    const p = pricing || DEFAULT_STRIPE_PRICING;
    return percentOf(chargeCents, p.bps) + p.fixedCents;
  }
  /** Patron service fee that grosses the charge up so the booking amount survives the Stripe fee. */
  function serviceFeeCents(bookingCents, pricing) {
    const p = pricing || DEFAULT_STRIPE_PRICING;
    let total = Math.ceil(((bookingCents + p.fixedCents) * 10000) / (10000 - p.bps));
    while (total - stripeFeeCents(total, p) < bookingCents) total += 1;
    while (total > bookingCents && total - 1 - stripeFeeCents(total - 1, p) >= bookingCents) total -= 1;
    return total - bookingCents;
  }
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().filter(k => value[k] !== undefined)
        .map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
  }
  function sha256(text) {
    if (!nodeCrypto) fail("NO_CRYPTO", "The prototype hashes with node:crypto; the server build owns hashing");
    return nodeCrypto.createHash("sha256").update(text, "utf8").digest("hex");
  }
  function hashEntry(body) { return sha256(canonical(body)); }
  function deepFreeze(obj) {
    Object.values(obj).forEach(v => { if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v); });
    return Object.freeze(obj);
  }
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function sumBy(lines, field) { return lines.reduce((total, line) => total + line[field], 0); }
  function journalBalances(lines) {
    return lines.length >= 2 && sumBy(lines, "debitCents") === sumBy(lines, "creditCents") && sumBy(lines, "debitCents") > 0;
  }
  function bookType(bookId) {
    if (bookId === "platform") return "platform";
    if (/^club:[a-z0-9-]{1,80}$/i.test(String(bookId || ""))) return "club";
    return fail("INVALID_BOOK", `Unknown book ${bookId}`);
  }
  function chartFor(bookId) { return bookType(bookId) === "platform" ? PLATFORM_CHART : CLUB_CHART; }
  function clubBookId(clubId) {
    if (!/^[a-z0-9-]{1,80}$/i.test(String(clubId || ""))) fail("INVALID_CLUB", "clubId must be 1-80 letters, digits or dashes");
    return `club:${clubId}`;
  }
  function dr(account, cents, party, dueAtMs) { return cents ? { account, debit: cents, ...(party || {}), dueAtMs } : null; }
  function cr(account, cents, party, dueAtMs) { return cents ? { account, credit: cents, ...(party || {}), dueAtMs } : null; }
  function party(partyType, partyId) { return { partyType, partyId }; }
  function agingBucket(dueAtMs, asOfMs) {
    if (dueAtMs > asOfMs) return "current";
    const days = Math.floor((asOfMs - dueAtMs) / DAY_MS);
    if (days <= 30) return "d0_30";
    if (days <= 60) return "d31_60";
    if (days <= 90) return "d61_90";
    return "d90p";
  }

  function normalizeLines(chart, lines) {
    if (!Array.isArray(lines) || lines.length < 2) fail("UNBALANCED", "A journal needs at least two lines");
    const out = lines.map((line, i) => {
      const acct = chart[line.account];
      if (!acct) fail("UNKNOWN_ACCOUNT", `line ${i}: account ${line.account} is not in this book's chart`);
      const debitCents = line.debit || 0;
      const creditCents = line.credit || 0;
      if (!isCents(debitCents) || !isCents(creditCents) || (debitCents > 0) === (creditCents > 0)) {
        fail("INVALID_LINE", `line ${i}: exactly one of debit / credit must be a positive integer of cents`);
      }
      if (acct.partyDimension && (line.partyType !== acct.partyDimension || !line.partyId)) {
        fail("PARTY_REQUIRED", `line ${i}: account ${acct.code} needs a ${acct.partyDimension} party`);
      }
      return {
        account: acct.code, debitCents, creditCents,
        partyType: acct.partyDimension ? line.partyType : null,
        partyId: acct.partyDimension ? String(line.partyId) : null,
        dueAtMs: Number.isSafeInteger(line.dueAtMs) ? line.dueAtMs : null
      };
    });
    if (!journalBalances(out)) fail("UNBALANCED", "Debits must equal credits");
    return out;
  }

  function verifyChain(entries) {
    let prev = GENESIS_HASH;
    for (let i = 0; i < entries.length; i += 1) {
      const { hash, ...body } = entries[i];
      if (body.seq !== i + 1) return { ok: false, brokenAtSeq: i + 1, reason: "seq-gap" };
      if (body.prevHash !== prev) return { ok: false, brokenAtSeq: i + 1, reason: "prev-hash-mismatch" };
      if (hashEntry(body) !== hash) return { ok: false, brokenAtSeq: i + 1, reason: "hash-mismatch" };
      if (!journalBalances(body.lines)) return { ok: false, brokenAtSeq: i + 1, reason: "unbalanced" };
      prev = hash;
    }
    return { ok: true, entries: entries.length, head: prev };
  }

  // ---------- ledger ----------

  function createLedger(options) {
    const opts = options || {};
    const now = opts.now || (() => Date.now());
    const pricing = opts.stripePricing || DEFAULT_STRIPE_PRICING;
    const books = new Map();
    const byKey = new Map();
    const registries = {
      reservations: new Map(), commissions: new Map(), invoices: new Map(), payouts: new Map()
    };

    function setRecord(kind, id, record) {
      const frozen = deepFreeze({ ...record });
      registries[kind].set(id, frozen);
      return frozen;
    }
    function getRecord(kind, id, code) {
      const record = registries[kind].get(id);
      if (!record) fail(code, `${kind}: ${id} not found`);
      return record;
    }
    function bookEntries(bookId) { return (books.get(bookId) || { entries: [] }).entries; }

    function post(input) {
      const key = requireText(input.idempotencyKey, "idempotencyKey");
      const chart = chartFor(input.book);
      const fingerprint = sha256(canonical({
        book: input.book, lines: input.lines, memo: input.memo || "", refs: input.refs || {},
        reversesEntryId: input.reversesEntryId || null
      }));
      const prior = byKey.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail("IDEMPOTENCY_CONFLICT", `idempotencyKey ${key} was already used for a different journal`);
        return prior.entry;
      }
      const lines = normalizeLines(chart, input.lines);
      const book = books.get(input.book) || { entries: [], head: GENESIS_HASH };
      const seq = book.entries.length + 1;
      const postedAtMs = now();
      const actor = input.actor ? {
        uid: input.actor.uid || null, role: input.actor.role || null, sos2faSessionHash: input.actor.sos2faSessionHash || null
      } : null;
      const body = {
        id: `${input.book}#${String(seq).padStart(8, "0")}`, book: input.book, seq,
        effectiveAtMs: Number.isSafeInteger(input.effectiveAtMs) ? input.effectiveAtMs : postedAtMs,
        postedAtMs, memo: String(input.memo || ""), lines, refs: { ...(input.refs || {}) },
        idempotencyKey: key, reversesEntryId: input.reversesEntryId || null,
        actor, reason: input.reason || null, prevHash: book.head
      };
      const entry = deepFreeze({ ...body, hash: hashEntry(body) });
      books.set(input.book, { entries: Object.freeze([...book.entries, entry]), head: entry.hash });
      byKey.set(key, { fingerprint, entry });
      return entry;
    }

    /** Drops zero lines; posts nothing when no money moved. */
    function postIfAny(input) {
      const lines = input.lines.filter(Boolean);
      return lines.length ? post({ ...input, lines }) : null;
    }

    // ----- bookings -----

    function bookingAmounts(input) {
      requireText(input.reservationId, "reservationId");
      const clubBook = clubBookId(input.clubId);
      const depositCents = requireCents(input.depositCents || 0, "depositCents", true);
      const entryFeeCents = requireCents(input.entryFeeCents || 0, "entryFeeCents", true);
      const bookingCents = requireCents(depositCents + entryFeeCents, "bookingCents");
      const floqrFeeCents = percentOf(bookingCents, requireBps(input.feeBps));
      return { clubBook, depositCents, entryFeeCents, bookingCents, floqrFeeCents };
    }

    function existingBooking(reservationId) {
      const existing = registries.reservations.get(reservationId);
      if (existing && existing.status === "uncollected") fail("RESERVATION_UNCOLLECTED", "Reservation was recorded as uncollected");
      return existing || null;
    }

    function recordStripeBooking(input) {
      const existing = existingBooking(input.reservationId);
      if (existing) return { reservation: existing, entries: [] };
      const a = bookingAmounts(input);
      const service = input.serviceFeeCents === undefined ? serviceFeeCents(a.bookingCents, pricing) : requireCents(input.serviceFeeCents, "serviceFeeCents", true);
      const patronTotalCents = a.bookingCents + service;
      const stripeFee = input.stripeFeeCents === undefined ? stripeFeeCents(patronTotalCents, pricing) : requireCents(input.stripeFeeCents, "stripeFeeCents", true);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const id = input.reservationId;
      const club = party("club", input.clubId);
      const refs = { reservationId: id, paymentPath: "stripe", stripeChargeId: input.stripeChargeId || null };
      const k = `vip:${id}:stripe`;
      const entries = [
        postIfAny({ book: "platform", idempotencyKey: `${k}:charge`, effectiveAtMs: at, refs, memo: "Patron payment (destination charge incl. service fee)",
          lines: [dr("1000", patronTotalCents), cr("2500", a.bookingCents, club), cr("4030", service)] }),
        postIfAny({ book: "platform", idempotencyKey: `${k}:transfer`, effectiveAtMs: at, refs, memo: "Transfer to club connected account, FLOQR fee retained",
          lines: [dr("2500", a.bookingCents, club), cr("1000", a.bookingCents - a.floqrFeeCents), cr("4010", a.floqrFeeCents, club)] }),
        postIfAny({ book: "platform", idempotencyKey: `${k}:stripe-fee`, effectiveAtMs: at, refs, memo: "Stripe processing fee",
          lines: [dr("5000", stripeFee), cr("1000", stripeFee)] }),
        postIfAny({ book: a.clubBook, idempotencyKey: `${k}:club`, effectiveAtMs: at, refs, memo: "VIP booking paid via FLOQR / Stripe",
          lines: [dr("1000", a.bookingCents - a.floqrFeeCents), dr("5000", a.floqrFeeCents),
            cr("2000", a.depositCents, party("reservation", id)), cr("4000", a.entryFeeCents)] })
      ].filter(Boolean);
      const reservation = setRecord("reservations", id, {
        reservationId: id, clubId: input.clubId, path: "stripe", ...a,
        serviceFeeCents: service, stripeFeeCents: stripeFee, patronTotalCents, status: "collected", bookedAtMs: at
      });
      return { reservation, entries };
    }

    function recordOffPlatformBooking(input, path) {
      const existing = existingBooking(input.reservationId);
      if (existing) return { reservation: existing, entries: [] };
      if (path === "venue" && !VENUE_METHODS.includes(input.method)) {
        fail("INVALID_METHOD", `Pay-at-venue method must be one of ${VENUE_METHODS.join(", ")}; comps are recorded as uncollected`);
      }
      const a = bookingAmounts(input);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const id = input.reservationId;
      const club = party("club", input.clubId);
      const dueAtMs = Number.isSafeInteger(input.feeDueAtMs) ? input.feeDueAtMs : at + DEFAULT_TERMS_DAYS * DAY_MS;
      const clearing = path === "pos" ? "1010" : "1020";
      const refs = { reservationId: id, paymentPath: path, paymentRef: input.paymentRef || input.method || null };
      const k = `vip:${id}:${path}`;
      const entries = [
        postIfAny({ book: "platform", idempotencyKey: `${k}:fee-accrual`, effectiveAtMs: at, refs, memo: "FLOQR fee receivable (invoiced monthly)",
          lines: [dr("1100", a.floqrFeeCents, club, dueAtMs), cr("4010", a.floqrFeeCents, club)] }),
        postIfAny({ book: a.clubBook, idempotencyKey: `${k}:club`, effectiveAtMs: at, refs,
          memo: path === "pos" ? "VIP booking paid via club POS" : "VIP booking paid at venue",
          lines: [dr(clearing, a.bookingCents), cr("2000", a.depositCents, party("reservation", id)), cr("4000", a.entryFeeCents)] }),
        postIfAny({ book: a.clubBook, idempotencyKey: `${k}:club-fee`, effectiveAtMs: at, refs, memo: "FLOQR fee owed to FloqMedia",
          lines: [dr("5000", a.floqrFeeCents), cr("2020", a.floqrFeeCents, null, dueAtMs)] })
      ].filter(Boolean);
      const reservation = setRecord("reservations", id, {
        reservationId: id, clubId: input.clubId, path, ...a, serviceFeeCents: 0, stripeFeeCents: 0,
        patronTotalCents: a.bookingCents, status: "collected", bookedAtMs: at, feeDueAtMs: dueAtMs
      });
      return { reservation, entries };
    }

    function recordUncollected(input) {
      const id = requireText(input.reservationId, "reservationId");
      clubBookId(input.clubId);
      const existing = registries.reservations.get(id);
      if (existing && existing.status !== "uncollected") fail("ALREADY_COLLECTED", "A payment was already recorded for this reservation");
      const reservation = existing || setRecord("reservations", id, {
        reservationId: id, clubId: input.clubId, path: input.path || null, status: "uncollected",
        reason: input.reason || null, bookedAtMs: Number.isSafeInteger(input.atMs) ? input.atMs : now()
      });
      return { reservation, entries: [] };
    }

    // ----- refunds / no-shows -----

    function reverseCommissions(reservationId, at, reason) {
      return [...registries.commissions.values()]
        .filter(c => c.reservationId === reservationId && c.status !== "reversed")
        .map(c => {
          const promoter = party("promoter", c.promoterUid);
          const fromAccount = c.status === "accrued" ? "2015" : "2010";
          const entry = post({ book: c.book, idempotencyKey: `vip:${reservationId}:commission:${c.commissionId}:reverse`, effectiveAtMs: at,
            refs: { reservationId, commissionId: c.commissionId }, reason, memo: c.status === "accrued" ? "Commission reversed (full refund)" : "Commission clawback, netted on next payout",
            lines: [dr(fromAccount, c.amountCents, promoter), cr("5030", c.amountCents, promoter)] });
          setRecord("commissions", c.commissionId, { ...c, status: "reversed", reversedAtMs: at });
          return entry;
        });
    }

    function stripeRefundEntries(r, k, at, refs, reason, recoverFee) {
      const club = party("club", r.clubId);
      const net = r.bookingCents - r.floqrFeeCents;
      return [
        postIfAny({ book: "platform", idempotencyKey: `${k}:platform`, effectiveAtMs: at, refs, reason, memo: "Full refund: service fee and FLOQR fee reversed (reverse_transfer + refund_application_fee)",
          lines: [dr("4030", r.serviceFeeCents), dr("4010", r.floqrFeeCents, club), cr("1000", r.serviceFeeCents + r.floqrFeeCents)] }),
        recoverFee ? postIfAny({ book: "platform", idempotencyKey: `${k}:fee-recharge`, effectiveAtMs: at, refs, reason, memo: "Stripe fee not returned by Stripe, recharged to the club",
          lines: [dr("1150", r.stripeFeeCents, club, at + DEFAULT_TERMS_DAYS * DAY_MS), cr("5000", r.stripeFeeCents)] }) : null,
        postIfAny({ book: `club:${r.clubId}`, idempotencyKey: `${k}:club`, effectiveAtMs: at, refs, reason, memo: "Full refund funded by the club",
          lines: [dr("2000", r.depositCents, party("reservation", r.reservationId)), dr("4900", r.entryFeeCents),
            cr("1000", net), cr("5000", r.floqrFeeCents)] }),
        recoverFee ? postIfAny({ book: `club:${r.clubId}`, idempotencyKey: `${k}:club-fee-recharge`, effectiveAtMs: at, refs, reason, memo: "Refund processing cost owed to FloqMedia",
          lines: [dr("5010", r.stripeFeeCents), cr("2020", r.stripeFeeCents, null, at + DEFAULT_TERMS_DAYS * DAY_MS)] }) : null
      ];
    }

    function offPlatformRefundEntries(r, k, at, refs, reason) {
      const club = party("club", r.clubId);
      const clearing = r.path === "pos" ? "1010" : "1020";
      return [
        postIfAny({ book: "platform", idempotencyKey: `${k}:platform`, effectiveAtMs: at, refs, reason, memo: "Full refund: FLOQR fee credited on next invoice",
          lines: [dr("4010", r.floqrFeeCents, club), cr("1100", r.floqrFeeCents, club)] }),
        postIfAny({ book: `club:${r.clubId}`, idempotencyKey: `${k}:club`, effectiveAtMs: at, refs, reason, memo: "Full refund funded by the club",
          lines: [dr("2000", r.depositCents, party("reservation", r.reservationId)), dr("4900", r.entryFeeCents), cr(clearing, r.bookingCents)] }),
        postIfAny({ book: `club:${r.clubId}`, idempotencyKey: `${k}:club-fee`, effectiveAtMs: at, refs, reason, memo: "FLOQR fee no longer owed",
          lines: [dr("2020", r.floqrFeeCents), cr("5000", r.floqrFeeCents)] })
      ];
    }

    function refundFull(input) {
      const r = getRecord("reservations", requireText(input.reservationId, "reservationId"), "UNKNOWN_RESERVATION");
      if (r.status === "uncollected") fail("NOTHING_COLLECTED", "Nothing was collected, so nothing is refunded and nobody earns a fee");
      if (r.status === "refunded") return { reservation: r, entries: [] };
      if (r.status === "forfeited") fail("ALREADY_FORFEITED", "No-show was settled under a no-refund policy");
      if (input.amountCents !== undefined && input.amountCents !== r.patronTotalCents) {
        fail("PARTIAL_REFUND_FORBIDDEN", "VIP refunds are full refunds only (owner decision Oct 15 2026)");
      }
      const reason = requireText(input.reason, "reason", REASON_MIN);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const refs = { reservationId: r.reservationId, paymentPath: r.path, kind: input.kind || "refund" };
      const k = `vip:${r.reservationId}:refund`;
      const moneyEntries = r.path === "stripe"
        ? stripeRefundEntries(r, k, at, refs, reason, input.recoverProcessingFee !== false)
        : offPlatformRefundEntries(r, k, at, refs, reason);
      const entries = [...moneyEntries.filter(Boolean), ...reverseCommissions(r.reservationId, at, reason)];
      const reservation = setRecord("reservations", r.reservationId, { ...r, status: "refunded", refundedAtMs: at, refundReason: reason });
      return { reservation, entries };
    }

    function recordNoShow(input) {
      const r = getRecord("reservations", requireText(input.reservationId, "reservationId"), "UNKNOWN_RESERVATION");
      if (input.policy === "fullRefund") return refundFull({ ...input, kind: "no-show-full-refund" });
      if (input.policy !== "noRefund") fail("INVALID_POLICY", "policy must be noRefund or fullRefund (club / venue policy)");
      if (r.status === "uncollected") fail("NOTHING_COLLECTED", "Nothing was collected for this no-show");
      if (r.status === "forfeited") return { reservation: r, entries: [] };
      if (r.status !== "collected") fail("INVALID_STATE", `Reservation is ${r.status}`);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = postIfAny({ book: `club:${r.clubId}`, idempotencyKey: `vip:${r.reservationId}:no-show`, effectiveAtMs: at,
        refs: { reservationId: r.reservationId, kind: "no-show-no-refund" }, memo: "No-show: deposit forfeited per club policy",
        lines: [dr("2000", r.depositCents, party("reservation", r.reservationId)), cr("4100", r.depositCents)] });
      const reservation = setRecord("reservations", r.reservationId, { ...r, status: "forfeited", forfeitedAtMs: at });
      return { reservation, entries: entry ? [entry] : [] };
    }

    // ----- promoter commissions, invoices and check payouts -----

    function accrueCommission(input) {
      const r = getRecord("reservations", requireText(input.reservationId, "reservationId"), "UNKNOWN_RESERVATION");
      const promoterUid = requireText(input.promoterUid, "promoterUid");
      if (!["club", "floqmedia"].includes(input.payer)) fail("INVALID_PAYER", "payer must be club or floqmedia");
      const commissionId = `${r.reservationId}:${input.payer}:${promoterUid}`;
      const existing = registries.commissions.get(commissionId);
      if (existing) return { commission: existing, entries: [] };
      if (r.status === "uncollected") fail("NOT_COLLECTED", "No payment was collected, so no commission is earned");
      if (r.status === "refunded") fail("REFUNDED", "A fully refunded reservation earns no commission");
      const amountCents = input.amountCents !== undefined
        ? requireCents(input.amountCents, "amountCents")
        : requireCents(percentOf(r.depositCents, requireBps(input.percentOfDepositBps)), "commission");
      const book = input.payer === "club" ? `club:${r.clubId}` : "platform";
      const promoter = party("promoter", promoterUid);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = post({ book, idempotencyKey: `vip:${r.reservationId}:commission:${commissionId}`, effectiveAtMs: at,
        refs: { reservationId: r.reservationId, commissionId }, memo: "Promoter commission accrued (earned on settlement)",
        lines: [dr("5030", amountCents, promoter), cr("2015", amountCents, promoter)] });
      const commission = setRecord("commissions", commissionId, {
        commissionId, reservationId: r.reservationId, promoterUid, payer: input.payer, book, amountCents, status: "accrued", accruedAtMs: at
      });
      return { commission, entries: [entry] };
    }

    function assertRole(table, book, actor, action) {
      const roles = table[bookType(book)];
      if (!actor || !actor.uid || !roles.includes(actor.role)) fail("FORBIDDEN", `${action} needs one of: ${roles.join(", ")}`);
      if (actor.role === "masterAdmin" && !actor.sos2faSessionHash) fail("SOS2FA_REQUIRED", "Master Admin actions need an SOS2FA session");
    }

    function approvePromoterInvoice(input) {
      const invoiceId = requireText(input.invoiceId, "invoiceId");
      const existing = registries.invoices.get(invoiceId);
      if (existing) return { invoice: existing, entries: [] };
      const ids = Array.isArray(input.commissionIds) ? input.commissionIds : [];
      if (!ids.length) fail("MISSING_FIELD", "commissionIds is required");
      const commissions = ids.map(id => getRecord("commissions", id, "UNKNOWN_COMMISSION"));
      const { book, promoterUid } = commissions[0];
      if (commissions.some(c => c.book !== book || c.promoterUid !== promoterUid)) fail("MIXED_INVOICE", "One invoice covers one promoter in one book");
      if (commissions.some(c => c.status !== "accrued")) fail("COMMISSION_NOT_OPEN", "Every commission on the invoice must be accrued and not yet invoiced");
      if (input.documentType === "promoterInvoice") requireText(input.promoterInvoiceNumber, "promoterInvoiceNumber");
      else if (input.documentType === "selfBillingStatement") requireText(input.selfBillingAgreementId, "selfBillingAgreementId");
      else fail("INVALID_DOCUMENT", "documentType must be promoterInvoice or selfBillingStatement");
      assertRole(APPROVER_ROLES, book, input.actor, "Approving a promoter invoice");
      const reason = requireText(input.reason, "reason", REASON_MIN);
      const dueAtMs = Number.isSafeInteger(input.dueAtMs) ? input.dueAtMs : now() + DEFAULT_TERMS_DAYS * DAY_MS;
      const amountCents = commissions.reduce((total, c) => total + c.amountCents, 0);
      const promoter = party("promoter", promoterUid);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = post({ book, idempotencyKey: `vip:invoice:${invoiceId}:approve`, effectiveAtMs: at, actor: input.actor, reason,
        refs: { invoiceId, documentType: input.documentType }, memo: `Promoter invoice approved (${ids.length} commission${ids.length === 1 ? "" : "s"})`,
        lines: [dr("2015", amountCents, promoter), cr("2010", amountCents, promoter, dueAtMs)] });
      commissions.forEach(c => setRecord("commissions", c.commissionId, { ...c, status: "invoiced", invoiceId }));
      const invoice = setRecord("invoices", invoiceId, {
        invoiceId, book, promoterUid, commissionIds: [...ids], documentType: input.documentType,
        promoterInvoiceNumber: input.promoterInvoiceNumber || null, selfBillingAgreementId: input.selfBillingAgreementId || null,
        amountCents, dueAtMs, status: "approved", approvedByUid: input.actor.uid, approvedAtMs: at, reason
      });
      return { invoice, entries: [entry] };
    }

    function validateCheck(input, invoice) {
      if (!/^[0-9]{1,12}$/.test(String(input.checkNumber || ""))) fail("INVALID_CHECK", "checkNumber must be 1-12 digits");
      const bankName = requireText(input.bankName, "bankName");
      requireText(input.payee, "payee");
      if (!Number.isSafeInteger(input.checkDateMs)) fail("MISSING_FIELD", "checkDateMs is required");
      if (input.stubSha256 !== undefined && !/^[a-f0-9]{64}$/.test(input.stubSha256)) fail("INVALID_STUB", "stubSha256 must be a SHA-256 hex digest");
      if (input.amountCents !== invoice.amountCents) fail("AMOUNT_MISMATCH", "A check pays the whole approved invoice");
      const duplicate = [...registries.payouts.values()].some(p => p.book === invoice.book && p.bankName === bankName && p.checkNumber === String(input.checkNumber));
      if (duplicate) fail("DUPLICATE_CHECK", `Check ${input.checkNumber} on ${bankName} is already recorded`);
    }

    function recordCheckPayout(input) {
      const payoutId = requireText(input.payoutId, "payoutId");
      const existing = registries.payouts.get(payoutId);
      if (existing) return { payout: existing, entries: [] };
      const invoice = getRecord("invoices", requireText(input.invoiceId, "invoiceId"), "UNKNOWN_INVOICE");
      if (invoice.status !== "approved") fail("INVOICE_NOT_OPEN", `Invoice is ${invoice.status}`);
      assertRole(AP_CLERK_ROLES, invoice.book, input.actor, "Recording a check payout");
      if (invoice.book === "platform" && input.actor.uid === invoice.approvedByUid) {
        fail("SEGREGATION_OF_DUTIES", "The approver of a FloqMedia invoice cannot record its payout");
      }
      validateCheck(input, invoice);
      const promoter = party("promoter", invoice.promoterUid);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = post({ book: invoice.book, idempotencyKey: `vip:payout:${payoutId}:issue`, effectiveAtMs: at, actor: input.actor,
        refs: { invoiceId: invoice.invoiceId, payoutId, method: "check", checkNumber: String(input.checkNumber) },
        memo: `Corporate check #${input.checkNumber} to ${input.payee.trim()}`,
        lines: [dr("2010", invoice.amountCents, promoter), cr("2050", invoice.amountCents, promoter)] });
      const payout = setRecord("payouts", payoutId, {
        payoutId, method: "check", book: invoice.book, invoiceId: invoice.invoiceId, promoterUid: invoice.promoterUid,
        checkNumber: String(input.checkNumber), bankName: input.bankName.trim(), checkDateMs: input.checkDateMs,
        amountCents: invoice.amountCents, payee: input.payee.trim(), memo: input.memo || null, stubSha256: input.stubSha256 || null,
        status: "issued", recordedByUid: input.actor.uid, recordedAtMs: at, reissueOf: input.reissueOf || null
      });
      setRecord("invoices", invoice.invoiceId, { ...invoice, status: "paid", payoutId });
      return { payout, entries: [entry] };
    }

    function recordCheckCleared(input) {
      const p = getRecord("payouts", requireText(input.payoutId, "payoutId"), "UNKNOWN_PAYOUT");
      if (p.status === "cleared") return { payout: p, entries: [] };
      if (p.status !== "issued") fail("CHECK_NOT_OUTSTANDING", `Check is ${p.status}`);
      if (!Number.isSafeInteger(input.clearedAtMs)) fail("MISSING_FIELD", "clearedAtMs is required");
      const promoter = party("promoter", p.promoterUid);
      const entry = post({ book: p.book, idempotencyKey: `vip:payout:${p.payoutId}:cleared`, effectiveAtMs: input.clearedAtMs,
        refs: { payoutId: p.payoutId, bankReference: input.bankReference || null }, memo: `Check #${p.checkNumber} cleared the bank`,
        lines: [dr("2050", p.amountCents, promoter), cr(BANK_ACCOUNT[bookType(p.book)], p.amountCents)] });
      const payout = setRecord("payouts", p.payoutId, { ...p, status: "cleared", clearedAtMs: input.clearedAtMs });
      return { payout, entries: [entry] };
    }

    function voidCheck(input) {
      const p = getRecord("payouts", requireText(input.payoutId, "payoutId"), "UNKNOWN_PAYOUT");
      if (p.status === "void") return { payout: p, entries: [] };
      if (p.status !== "issued") fail("CHECK_NOT_OUTSTANDING", `Only an outstanding check can be voided (check is ${p.status})`);
      assertRole(APPROVER_ROLES, p.book, input.actor, "Voiding a check");
      const reason = requireText(input.reason, "reason", REASON_MIN);
      const invoice = getRecord("invoices", p.invoiceId, "UNKNOWN_INVOICE");
      const promoter = party("promoter", p.promoterUid);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = post({ book: p.book, idempotencyKey: `vip:payout:${p.payoutId}:void`, effectiveAtMs: at, actor: input.actor, reason,
        refs: { payoutId: p.payoutId, invoiceId: p.invoiceId, staleDated: !!input.staleDated },
        memo: `Check #${p.checkNumber} ${input.staleDated ? "stale-dated and voided" : "voided"}; payable reopened`,
        lines: [dr("2050", p.amountCents, promoter), cr("2010", p.amountCents, promoter, invoice.dueAtMs)] });
      const payout = setRecord("payouts", p.payoutId, { ...p, status: "void", voidedAtMs: at, voidReason: reason, staleDated: !!input.staleDated });
      setRecord("invoices", invoice.invoiceId, { ...invoice, status: "approved", payoutId: null });
      return { payout, entries: [entry] };
    }

    function reissueCheck(input) {
      const original = getRecord("payouts", requireText(input.originalPayoutId, "originalPayoutId"), "UNKNOWN_PAYOUT");
      if (original.status !== "void") fail("NOT_VOIDED", "Void the original check before reissuing");
      return recordCheckPayout({ ...input, invoiceId: original.invoiceId, reissueOf: original.payoutId });
    }

    function staleChecks(asOfMs, days) {
      const limit = (days === undefined ? STALE_CHECK_DAYS : days) * DAY_MS;
      return [...registries.payouts.values()].filter(p => p.status === "issued" && asOfMs - p.checkDateMs >= limit);
    }

    // ----- chargebacks (path a) -----

    function recordChargeback(input) {
      const r = getRecord("reservations", requireText(input.reservationId, "reservationId"), "UNKNOWN_RESERVATION");
      if (r.path !== "stripe") fail("INVALID_PATH", "Chargebacks on POS / venue payments are borne by that processor");
      const amount = requireCents(input.amountCents, "amountCents");
      const fee = requireCents(input.disputeFeeCents || 0, "disputeFeeCents", true);
      const club = party("club", r.clubId);
      const at = Number.isSafeInteger(input.atMs) ? input.atMs : now();
      const entry = post({ book: "platform", idempotencyKey: `vip:${r.reservationId}:dispute:${requireText(input.disputeId, "disputeId")}`,
        effectiveAtMs: at, refs: { reservationId: r.reservationId, disputeId: input.disputeId }, memo: "Chargeback debited from platform balance",
        lines: [dr("1150", amount, club, at + DEFAULT_TERMS_DAYS * DAY_MS), dr("5010", fee, club), cr("1000", amount + fee)].filter(Boolean) });
      return { entries: [entry] };
    }

    function recordChargebackRecovered(input) {
      const r = getRecord("reservations", requireText(input.reservationId, "reservationId"), "UNKNOWN_RESERVATION");
      const amount = requireCents(input.amountCents, "amountCents");
      const entry = post({ book: "platform", idempotencyKey: `vip:${r.reservationId}:dispute:${requireText(input.disputeId, "disputeId")}:recovered`,
        effectiveAtMs: Number.isSafeInteger(input.atMs) ? input.atMs : now(), refs: { reservationId: r.reservationId, disputeId: input.disputeId },
        memo: "Chargeback recovered from the club (transfer reversal)", lines: [dr("1000", amount), cr("1150", amount, party("club", r.clubId))] });
      return { entries: [entry] };
    }

    // ----- reports -----

    function balances(bookId) {
      const chart = chartFor(bookId);
      const rows = {};
      bookEntries(bookId).forEach(e => e.lines.forEach(l => {
        const row = rows[l.account] || { debitCents: 0, creditCents: 0 };
        rows[l.account] = { debitCents: row.debitCents + l.debitCents, creditCents: row.creditCents + l.creditCents };
      }));
      return Object.fromEntries(Object.entries(rows).map(([code, row]) => [code, {
        ...row, name: chart[code].name,
        balanceCents: (() => {
          const signed = chart[code].normalSide === "debit" ? row.debitCents - row.creditCents : row.creditCents - row.debitCents;
          return signed === 0 ? 0 : signed;
        })()
      }]));
    }

    function balance(bookId, account, partyId) {
      const chart = chartFor(bookId);
      const net = bookEntries(bookId).reduce((total, e) => total + e.lines
        .filter(l => l.account === account && (partyId === undefined || l.partyId === partyId))
        .reduce((t, l) => t + l.debitCents - l.creditCents, 0), 0);
      const signed = chart[account].normalSide === "debit" ? net : -net;
      return signed === 0 ? 0 : signed;
    }

    function trialBalance(bookId) {
      const rows = balances(bookId);
      const totals = Object.values(rows).reduce((t, r) => {
        const net = r.debitCents - r.creditCents;
        return net >= 0 ? { ...t, debitCents: t.debitCents + net } : { ...t, creditCents: t.creditCents - net };
      }, { debitCents: 0, creditCents: 0 });
      return { book: bookId, ...totals, balanced: totals.debitCents === totals.creditCents, rows };
    }

    function aging(bookId, kind, asOfMs) {
      const codes = AGING_ACCOUNTS[bookType(bookId)][kind];
      if (!codes) fail("INVALID_KIND", "kind must be AR or AP");
      const chart = chartFor(bookId);
      const groups = new Map();
      bookEntries(bookId).forEach(e => e.lines.filter(l => codes.includes(l.account)).forEach(l => {
        const key = `${l.account}|${l.partyType}|${l.partyId}`;
        const group = groups.get(key) || { account: l.account, partyType: l.partyType, partyId: l.partyId, items: [], unappliedCents: 0 };
        const increase = chart[l.account].normalSide === "debit" ? l.debitCents - l.creditCents : l.creditCents - l.debitCents;
        groups.set(key, applyAgingLine(group, increase, l.dueAtMs !== null ? l.dueAtMs : e.effectiveAtMs));
      }));
      const rows = [...groups.values()].map(g => g.items.reduce((row, item) => ({
        ...row, [agingBucket(item.dueAtMs, asOfMs)]: row[agingBucket(item.dueAtMs, asOfMs)] + item.amountCents,
        totalCents: row.totalCents + item.amountCents
      }), { account: g.account, partyType: g.partyType, partyId: g.partyId, current: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90p: 0, totalCents: 0, unappliedCents: g.unappliedCents }))
        .filter(row => row.totalCents || row.unappliedCents);
      return { book: bookId, kind, asOfMs, rows };
    }

    /** FIFO: settlements close the oldest open items first; excess settlement is unapplied credit. */
    function applyAgingLine(group, increase, dueAtMs) {
      if (increase > 0) {
        const applied = Math.min(increase, group.unappliedCents);
        const rest = increase - applied;
        return { ...group, unappliedCents: group.unappliedCents - applied, items: rest ? [...group.items, { amountCents: rest, dueAtMs }] : group.items };
      }
      let remaining = -increase;
      const items = [];
      group.items.forEach(item => {
        const take = Math.min(item.amountCents, remaining);
        remaining -= take;
        if (item.amountCents - take > 0) items.push({ ...item, amountCents: item.amountCents - take });
      });
      return { ...group, items, unappliedCents: group.unappliedCents + remaining };
    }

    /** Signed debit-positive: > 0 the party owes the book, < 0 the book owes the party. */
    function statement(bookId, partyType, partyId, range) {
      const fromMs = (range && range.fromMs) || 0;
      const toMs = (range && range.toMs) || Number.MAX_SAFE_INTEGER;
      const matching = bookEntries(bookId).flatMap(e => e.lines
        .filter(l => l.partyType === partyType && l.partyId === partyId)
        .map(l => ({ entryId: e.id, effectiveAtMs: e.effectiveAtMs, memo: e.memo, account: l.account, debitCents: l.debitCents, creditCents: l.creditCents })));
      const openingCents = matching.filter(l => l.effectiveAtMs < fromMs).reduce((t, l) => t + l.debitCents - l.creditCents, 0);
      let running = openingCents;
      const lines = matching.filter(l => l.effectiveAtMs >= fromMs && l.effectiveAtMs <= toMs).map(l => {
        running += l.debitCents - l.creditCents;
        return { ...l, runningCents: running };
      });
      return { book: bookId, partyType, partyId, fromMs, toMs, openingCents, closingCents: running, lines };
    }

    return Object.freeze({
      post, recordStripeBooking,
      recordPosBooking: input => recordOffPlatformBooking(input, "pos"),
      recordVenuePayment: input => recordOffPlatformBooking(input, "venue"),
      recordUncollected, refundFull, recordNoShow, accrueCommission, approvePromoterInvoice,
      recordCheckPayout, recordCheckCleared, voidCheck, reissueCheck, staleChecks,
      recordChargeback, recordChargebackRecovered,
      balances, balance, trialBalance, aging, statement,
      entries: bookId => bookEntries(bookId),
      exportBook: bookId => clone(bookEntries(bookId)),
      books: () => [...books.keys()],
      verify: bookId => verifyChain(bookEntries(bookId)),
      reservation: id => registries.reservations.get(id) || null,
      commission: id => registries.commissions.get(id) || null,
      invoice: id => registries.invoices.get(id) || null,
      payout: id => registries.payouts.get(id) || null
    });
  }

  return Object.freeze({
    createLedger, verifyChain, serviceFeeCents, stripeFeeCents, percentOf, agingBucket, canonical, LedgerError,
    PLATFORM_CHART, CLUB_CHART, DAY_MS, GENESIS_HASH, STALE_CHECK_DAYS, REASON_MIN
  });
});
