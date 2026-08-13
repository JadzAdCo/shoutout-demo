# FLOQR Staff & Talent Scheduling

Product and engineering spec for dynamic work schedules used by **Clubs / lounges**, **Promoting companies**, and **DJs**. **Events are out of scope** (event calendars stay on guest-list / campaign flows).

## Who pays

| Subscriber | Monthly price | Stripe order type |
|---|---|---|
| Club / lounge (Club Admin or elected scheduler) | **$20 / month** | `staffSchedulingSubscription` |
| Promoting company | **$20 / month** | same |
| DJ (personal booking calendar) | **$20 / month** | same |

Billing is FloqR MoR via Stripe Checkout `mode: subscription` (recurring Price created inline).

## Entitlement gate

| Field | Values | Role |
|---|---|---|
| `clubLocations/{id}.staffSchedulingPaid` | `0` \| `1` | Venue UI gate |
| `schedulingSubscriptions/{ownerKey}.status` / `.monthStatus` | `paid this month` \| `not paid this month` | Billing period status |
| `schedulingSubscriptions/{ownerKey}.paid` | `0` \| `1` | Mirror of paid flag |
| `everSubscribed` | boolean | Prior subscriber → **Resubscribe** CTA |

**Portal / Club Admin CTA**

| Condition | UI |
|---|---|
| `staffSchedulingPaid=1` / `paid this month` | Hide Subscribe; show calendar + portal link |
| `staffSchedulingPaid=0` + never subscribed | **Subscribe $20/mo** |
| `staffSchedulingPaid=0` + ever subscribed / `not paid this month` | **Resubscribe $20/mo** |

Demo venues (shoutoutdemo): first access auto-writes `staffSchedulingPaid: 1` and status `paid this month`.

Callable `getSchedulingAccess` returns `{ staffSchedulingPaid, paid, status, monthStatus, everSubscribed, cta: "subscribe"|"resubscribe"|"none", … }`.

## Who can create schedules

| Owner | Creators |
|---|---|
| Club | Club Admins; Master/Super; elected members with REP permission `manageSchedules` |
| Promoting company | Company managers / owners of the subscription (not individual events) |
| DJ | The DJ account that owns the subscription |

## Shift lifecycle

1. **Draft / published** — creator builds a shift (role, assignee, start/end, venue notes).
2. **Pending approval** — assignee notified (in-app + Email / SMS / WhatsApp per prefs & credits).
3. **Approved / Declined** — assignee responds in Scheduling portal (or inbound SMS later).
4. **Cancelled / Completed** — creator or system updates status.

Collections:

- `schedulingSubscriptions/{ownerKey}` — entitlement + Stripe ids (`paid` 0|1, `status`)
- `clubLocations/{id}.staffSchedulingPaid` — club UI gate (0|1)
- `scheduleShifts/{shiftId}` — one shift / booking slot
- `scheduleShiftNotifications/{id}` — delivery audit (optional; also uses `clubMessageDeliveries` / `inboxNotifications`)

## Notification & approval channels

Reuses Notification Fabric:

- **In-app** → `inboxNotifications`
- **Email** → SendGrid (when club/user email prefs allow)
- **SMS / WhatsApp** → Twilio; clubs burn `clubMessagingCredits` when club-owned; DJ/promoter company may use alert phone on their subscription doc until per-entity credit wallets exist

Deep link for responses: `scheduling.html?owner=…&shift=…`

## Explicit non-goals (v1)

- Event production calendars
- Payroll / tip pooling
- Auto-publishing to public club profile (optional later)
- Multi-location enterprise seat packs (single $20 seat per ownerKey)

## UI surfaces

- Club Admin → **Scheduling** tab (`admin.html` + `admin-scheduling.js`)
- Shared portal → `scheduling.html` for DJs and promoting companies (and worker approve/decline)
- Role profiles → links into the portal

## Acceptance checks

- [ ] Unpaid club (`staffSchedulingPaid=0`) cannot publish shifts; Subscribe CTA opens $20 Checkout
- [ ] After payment, venue shows `staffSchedulingPaid=1` and calendar workspace (Subscribe hidden)
- [ ] Demo venues resolve to `staffSchedulingPaid=1` without Checkout
- [ ] Paid club can assign a designated worker a shift and see pending → approved
- [ ] Worker receives in-app notification; SMS/WhatsApp when enabled + credits remain
- [ ] Promoting company and DJ portals share the same shift model with their own ownerKey
- [ ] Cancelling Stripe subscription flips entitlement to `staffSchedulingPaid=0` / canceled
