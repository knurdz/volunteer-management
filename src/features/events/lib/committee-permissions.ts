import type { EventRole, EventRoleAssignment } from "@/features/access-control/types";
import { isEventVisibleToUser } from "@/features/events/lib/event-permissions";
import type { Event } from "@/features/events/types";

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
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole: EventRole | null,
) {
  return isEventVisibleToUser(userId, isAdmin, event, userEventRole);
}

export function canManageStructuralCommittees({
  isAdmin,
  userEventRole,
}: {
  isAdmin: boolean;
  userEventRole: EventRole | null;
}) {
  return isAdmin || userEventRole === "Chair";
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
