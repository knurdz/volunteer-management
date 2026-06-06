# Events Feature

## Role assignments

Event roles are stored **only** in the `event_role_assignments` table (shared with access-control).
Canonical role values come from `EVENT_ROLES` in `src/lib/config.ts`:

- Chair
- Vice Chair
- Committee Lead
- Committee Member

The legacy `event_committees` table stores **structural committee data only** (name, description, `event_id`).
Membership without roles lives in `event_committee_members`.

## Conclusion workflow

| Action | Who | Preconditions | Result |
| --- | --- | --- | --- |
| Submit | Chair or Admin | `status = ongoing`, `conclusion_status` is `not_submitted` or `rejected` | `status = pending_conclusion`, `conclusion_status = submitted` |
| Approve | Admin | `conclusion_status = submitted` | `status = closed`, `conclusion_status = approved` |
| Reject | Admin | `conclusion_status = submitted` | `status = ongoing`, `conclusion_status = rejected` |

API: `PATCH /api/events/[eventId]/conclude` with body `{ "action": "submit" | "approve" | "reject" }`.

## Admin verification bypass

Admins (`isAdmin` from session) skip UoM verification gates in committee APIs and on `/my-events`.
Non-admin users must have `profile.uomVerified === true`.

## Safe role replacement

`updateEventRole` creates the new `event_role_assignments` document first, then deletes the old one.
If deletion fails, the new assignment remains canonical and an `event_role.orphan_cleanup_needed` audit entry is written.

## Event visibility

- Admin: all events
- Everyone: `published`, `ongoing`, `pending_conclusion`
- Draft/planning: creator (`created_by`) or anyone with an active role assignment

## Audit logging

All event mutations write non-blocking audit records via `safeEventAuditLog`.
Audit failures are logged to the console and do not block the primary operation.
