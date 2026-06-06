import type { SessionUser } from "@/features/access-control/types";
import type { Event, EventCommittee, EventRole, EventStatus } from "@/features/events/types";

const RESTRICTED_COMMITTEE_VIEW_STATUSES: EventStatus[] = ["draft", "planning"];

const CHAIR_ASSIGNABLE_ROLES: EventRole[] = [
  "vice_chair",
  "committee_lead",
  "committee_member",
];

const CHAIR_REMOVABLE_ROLES: EventRole[] = [
  "vice_chair",
  "committee_lead",
  "committee_member",
];

export function canViewEventCommittees(
  user: SessionUser,
  event: Event,
  userCommitteeRole: EventRole | null,
) {
  if (!RESTRICTED_COMMITTEE_VIEW_STATUSES.includes(event.status)) {
    return true;
  }

  if (user.isAdmin) {
    return true;
  }

  return userCommitteeRole != null;
}

export function canAssignCommitteeRole({
  actorCommitteeRole,
  isAdmin,
  targetRole,
}: {
  actorCommitteeRole: EventRole | null;
  isAdmin: boolean;
  targetRole: EventRole;
}) {
  if (isAdmin) {
    return true;
  }

  if (actorCommitteeRole !== "chair") {
    return false;
  }

  return CHAIR_ASSIGNABLE_ROLES.includes(targetRole);
}

export function canRemoveCommitteeRole({
  actorCommitteeRole,
  actorUserId,
  isAdmin,
  targetCommittee,
}: {
  actorCommitteeRole: EventRole | null;
  actorUserId: string;
  isAdmin: boolean;
  targetCommittee: EventCommittee;
}) {
  if (isAdmin) {
    return true;
  }

  if (actorCommitteeRole !== "chair") {
    return false;
  }

  if (targetCommittee.user_id === actorUserId) {
    return false;
  }

  if (targetCommittee.role === "chair") {
    return false;
  }

  return CHAIR_REMOVABLE_ROLES.includes(targetCommittee.role);
}
