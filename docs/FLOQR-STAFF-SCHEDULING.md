# FLOQR Staff & Talent Scheduling

Product and engineering spec for dynamic work schedules used by **Clubs / lounges**, **Promoting companies**, and **DJs**. **Events are out of scope** (event calendars stay on guest-list / campaign flows).

## Who pays

| Subscriber | Monthly price | Stripe order type |
|---|---|---|
| Club / lounge (Club Admin or elected scheduler) | **$20 / month** | `staffSchedulingSubscription` |
| Promoting company | **$20 / month** | same |
| DJ (personal booking calendar) | **$20 / month** | same |

Billing is FloqR MoR via Stripe Checkout `mode: subscription` (recurring Price created inline). Access is gated by `schedulingSubscriptions/{ownerKey}` with `status: active`.

`ownerKey` format:

- `club:{clubLocationId}`
- `promoterCompany:{companyId}`
- `dj:{uid}`

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

- `schedulingSubscriptions/{ownerKey}` — entitlement + Stripe ids
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

- [ ] Unsubscribed club cannot publish shifts (subscribe CTA opens $20 Checkout)
- [ ] Paid club can assign a designated worker a shift and see pending → approved
- [ ] Worker receives in-app notification; SMS/WhatsApp when enabled + credits remain
- [ ] Promoting company and DJ portals share the same shift model with their own ownerKey
- [ ] Cancelling Stripe subscription flips entitlement to `inactive` / `canceled`
