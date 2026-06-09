import type { EventRole, SessionUser } from "@/features/access-control/types";

export const EVENT_LEAD_ROLES = ["Chair", "Vice Chair"] as const satisfies readonly EventRole[];

export function hasAnyEventLeadRole(user: Pick<SessionUser, "eventRoles">) {
  return user.eventRoles.some(
    (assignment) =>
      assignment.active &&
      EVENT_LEAD_ROLES.includes(assignment.role as (typeof EVENT_LEAD_ROLES)[number]),
  );
}

export function canAccessConclusionsTab(user: SessionUser) {
  return user.isAdmin || hasAnyEventLeadRole(user);
}
