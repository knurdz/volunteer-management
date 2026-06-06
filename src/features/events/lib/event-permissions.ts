import "server-only";

import { isAdminEmail } from "@/features/access-control/lib/rules";
import { getProfile } from "@/features/access-control/server/profiles";
import { getUserEventRole } from "@/features/events/server/committee-service";
import { getEventById } from "@/features/events/server/event-service";
import type {
  Event,
  EventCommittee,
  EventPermissions,
  EventRole,
  EventStatus,
} from "@/features/events/types";
import type { getAppwriteAdminServices } from "@/server/appwrite";
import { getServerEnv } from "@/lib/env";

const EDITABLE_STATUSES: EventStatus[] = ["draft", "planning"];
const PUBLICLY_VISIBLE_STATUSES: EventStatus[] = ["published", "ongoing", "closed"];

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

function isAdminUser(userSbRole: string) {
  return userSbRole === "Admin";
}

function hasCommitteeRole(userCommitteeRole?: EventRole | null) {
  return userCommitteeRole != null;
}

export function isEventVisibleToUser(
  userId: string,
  userSbRole: string,
  event: Event,
  userCommitteeRole?: EventRole | null,
) {
  void userId;

  if (isAdminUser(userSbRole)) {
    return true;
  }

  if (hasCommitteeRole(userCommitteeRole)) {
    return true;
  }

  return PUBLICLY_VISIBLE_STATUSES.includes(event.status);
}

export function getEventPermissions(
  userId: string,
  userSbRole: string,
  event: Event,
  userCommitteeRole?: EventRole | null,
): EventPermissions {
  void userId;

  if (isAdminUser(userSbRole)) {
    return ADMIN_PERMISSIONS;
  }

  if (userCommitteeRole === "chair") {
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

  return VIEW_ONLY_PERMISSIONS;
}

async function resolveUserSbRole(userId: string) {
  const env = getServerEnv();
  const profile = await getProfile(userId);

  if (profile && isAdminEmail(profile.googleEmail, env.ADMIN_EMAIL)) {
    return "Admin";
  }

  return "";
}

export async function resolveEventContext(
  userId: string,
  eventId: string,
  appwriteServerClient: ReturnType<typeof getAppwriteAdminServices>,
): Promise<{
  event: Event | null;
  permissions: EventPermissions;
  userRole: EventCommittee | null;
}> {
  void appwriteServerClient;

  const [event, userRole] = await Promise.all([
    getEventById(eventId),
    getUserEventRole(userId, eventId),
  ]);
  const userSbRole = await resolveUserSbRole(userId);
  const permissions = event
    ? getEventPermissions(userId, userSbRole, event, userRole?.role ?? null)
    : VIEW_ONLY_PERMISSIONS;

  return {
    event,
    permissions,
    userRole,
  };
}
