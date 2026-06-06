import type { EventRole, EventRoleAssignment } from "@/features/access-control/types";
import type { Event, EventStatus } from "@/features/events/types";

const RESTRICTED_COMMITTEE_VIEW_STATUSES: EventStatus[] = ["draft", "planning"];

const CHAIR_ASSIGNABLE_ROLES: EventRole[] = [
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
];

const CHAIR_REMOVABLE_ROLES: EventRole[] = [
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
];

export function canViewEventCommittees(
  userIsAdmin: boolean,
  event: Event,
  userEventRole: EventRole | null,
  userId: string,
) {
  if (!RESTRICTED_COMMITTEE_VIEW_STATUSES.includes(event.status)) {
    return true;
  }

  if (userIsAdmin) {
    return true;
  }

  return userEventRole != null || event.created_by === userId;
}

export function canAssignCommitteeRole({
  actorEventRole,
  isAdmin,
  targetRole,
}: {
  actorEventRole: EventRole | null;
  isAdmin: boolean;
  targetRole: EventRole;
}) {
  if (isAdmin) {
    return true;
  }

  if (actorEventRole !== "Chair") {
    return false;
  }

  return CHAIR_ASSIGNABLE_ROLES.includes(targetRole);
}

export function canRemoveCommitteeRole({
  actorEventRole,
  actorUserId,
  isAdmin,
  targetAssignment,
}: {
  actorEventRole: EventRole | null;
  actorUserId: string;
  isAdmin: boolean;
  targetAssignment: EventRoleAssignment;
}) {
  if (isAdmin) {
    return true;
  }

  if (actorEventRole !== "Chair") {
    return false;
  }

  if (targetAssignment.userId === actorUserId) {
    return false;
  }

  if (targetAssignment.role === "Chair") {
    return false;
  }

  return CHAIR_REMOVABLE_ROLES.includes(targetAssignment.role);
}
