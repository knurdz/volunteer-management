import "server-only";

import { listProfiles } from "@/features/access-control/server/profiles";
import {
  listActiveEventRoleAssignments,
  listActiveRoleAssignments,
} from "@/features/access-control/server/roles";

export async function listAdminUsers() {
  const profiles = await listProfiles();
  const roles = await listActiveRoleAssignments();
  const eventRoles = await listActiveEventRoleAssignments();

  return profiles.map((profile) => ({
    ...profile,
    eventRoles: eventRoles.filter(
      (assignment) => assignment.userId === profile.authUserId,
    ),
    sbRoles: roles
      .filter((assignment) => assignment.userId === profile.authUserId)
      .map((assignment) => assignment.role),
  }));
}
