import "server-only";

import type { EventRole } from "@/features/access-control/types";
import type { Event, EventPermissions, EventStatus } from "@/features/events/types";

const EDITABLE_STATUSES: EventStatus[] = ["draft", "planning"];
const PUBLICLY_VISIBLE_STATUSES: EventStatus[] = [
  "published",
  "ongoing",
  "pending_conclusion",
];
const RESTRICTED_STATUSES: EventStatus[] = ["draft", "planning"];

const VIEW_ONLY_PERMISSIONS: EventPermissions = {
  canApproveConclusion: false,
  canAssignRoles: false,
  canDelete: false,
  canEdit: false,
  canManageCommittee: false,
  canPublish: false,
  canSubmitConclusion: false,
};

const ADMIN_PERMISSIONS: EventPermissions = {
  canApproveConclusion: true,
  canAssignRoles: true,
  canDelete: true,
  canEdit: true,
  canManageCommittee: true,
  canPublish: true,
  canSubmitConclusion: true,
};

export function isEventVisibleToUser(
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole?: EventRole | null,
) {
  if (isAdmin) {
    return true;
  }

  if (PUBLICLY_VISIBLE_STATUSES.includes(event.status)) {
    return true;
  }

  if (RESTRICTED_STATUSES.includes(event.status)) {
    return event.created_by === userId || userEventRole != null;
  }

  return false;
}

export function getEventPermissions(
  userId: string,
  isAdmin: boolean,
  event: Event,
  userEventRole?: EventRole | null,
): EventPermissions {
  if (isAdmin) {
    return ADMIN_PERMISSIONS;
  }

  if (userEventRole === "Chair") {
    return {
      canApproveConclusion: false,
      canAssignRoles: true,
      canDelete: false,
      canEdit: EDITABLE_STATUSES.includes(event.status),
      canManageCommittee: true,
      canPublish: false,
      canSubmitConclusion: event.status === "ongoing",
    };
  }

  void userId;
  return VIEW_ONLY_PERMISSIONS;
}
