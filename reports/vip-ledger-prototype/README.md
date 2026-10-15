# VIP ledger prototype (pending owner approval)

**Status: PROTOTYPE only.** Not wired into any production page, Firebase Function, Firestore rule or deploy. VIP Reservations is still at proposal stage (`design-notes-vip-reservations.mdc`).

Pure Node module with no Firebase dependency. Run:

```bash
node --test vip-ledger-core.test.js
```

## What it proves

Double-entry books with integer cents, balanced journals, immutable hash-chained entries (`prevHash` / SHA-256), and idempotent posting. Covers the Oct 15 2026 owner decisions: patron pays the Stripe service fee on path (a), full refunds only (funded by the club/venue), and promoter commissions paid by corporate check with an AP ledger.

## Files

| File | Role |
|---|---|
| `vip-ledger-core.js` | UMD / CommonJS core (`createLedger`, charts, postings, aging, statements) |
| `vip-ledger-core.test.js` | `node:test` coverage for every money scenario + invariants |
| `README.md` | This map to future Firestore / Functions |

## Map to future Firestore (when built)

| Prototype | Future collection / field |
|---|---|
| `PLATFORM_CHART` / `CLUB_CHART` | `vipLedgerAccounts/{bookId}_{code}` |
| Journal entry (`seq`, `lines`, `prevHash`, `hash`, `idempotencyKey`) | `vipLedgerEntries/{entryId}` + `vipLedgerHeads/{bookId}` |
| `approvePromoterInvoice` | `vipInvoices/{invoiceId}` (`documentType` `promoterInvoice` \| `selfBillingStatement`) |
| `recordCheckPayout` / cleared / void / reissue | `vipPayouts/{id}` with `method: "check" \| "stripe"`, plus `checkNumber`, `bankName`, `checkDateMs`, `payee`, `memo`, `stubSha256`, `clearedAtMs`, `status` |
| Commission registry | `vipCommissions/{id}` |
| `balances` / `aging` / `statement` | `vipLedgerBalances`, `vipAgingSnapshots`, `vipStatements` |

## Map to future Functions callables (when built)

| Prototype method | Likely callable |
|---|---|
| Stripe / POS / venue booking posts | Webhooks (`stripeFloqrWebhook`, `vipPosWebhook`) and `markVipPaidAtVenue` |
| `refundFull` / `recordNoShow` | `cancelVipReservation`, `recordVipNoShow` |
| `approvePromoterInvoice` | `approveVipPromoterInvoice` (Owner / Club Admin; Master Admin needs SOS2FA + `FLOQRReasonPrompt`) |
| `recordCheckPayout` | `recordVipCheckPayout` (AP clerk; SoD vs approver on the FloqMedia book) |
| `recordCheckCleared` / `voidCheck` / `reissueCheck` | `clearVipCheck`, `voidVipCheck`, `reissueVipCheck` |
| Nightly aging / verify | `snapshotVipAging`, `verifyVipLedger` |

See `reports/vip-notifications-billing.md` §4–§7 and §9 for the full proposal.
