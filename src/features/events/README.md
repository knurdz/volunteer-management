# Events Feature

## Role assignments

Event roles are stored **only** in the `event_role_assignments` table (shared with access-control).
Canonical role values come from `EVENT_ROLES` in `src/lib/config.ts`.

Structural committees (`event_committees`) and membership (`event_committee_members`) are separate from roles.

## API surface

| Route | Purpose |
| --- | --- |
| `GET/POST /api/events/[eventId]/roles` | List / assign role assignments |
| `DELETE /api/events/[eventId]/roles/[assignmentId]` | Remove role assignment |
| `GET/POST /api/events/[eventId]/committees` | List / create structural committees |
| `DELETE /api/events/[eventId]/committees/[committeeId]` | Delete committee |
| `GET/POST /api/events/[eventId]/committees/[committeeId]/members` | List / add members |
| `DELETE .../members/[memberId]` | Remove member |
| `PATCH /api/events/[eventId]/conclude` | Conclusion workflow only |
| `PATCH /api/events/[eventId]/status` | Operational status only (no conclusion bypass) |

## Conclusion workflow

`pending_conclusion` and `closed` cannot be set through the generic status API or event PATCH.
Use `PATCH /api/events/[eventId]/conclude` with `{ action: "submit" | "approve" | "reject" }`.

Approval writes audit action `EVENT_CONCLUSION_APPROVED` with scoring-ready metadata.

## Committee bootstrap

Every new event automatically receives a `General` committee so Committee Lead/Member assignments work immediately.

## Visibility

Committee and role endpoints apply the same visibility rules as events. Closed events are hidden from users without an active role or creator access.

## Role replacement

Role replacement creates the new assignment first. If deleting the old assignment fails, the new assignment is revoked and the operation fails without leaving duplicate privileged roles.

## Validation

- IEEE terms must match `IEEE_TERMS` in `src/lib/config.ts`
- Event years must be between `EVENT_YEAR_MIN` and `EVENT_YEAR_MAX`
- Partial date updates are validated against stored event dates server-side
- Committee Lead/Member roles require an existing committee name on the event
