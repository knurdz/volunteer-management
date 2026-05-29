import "server-only";

import { listProfiles } from "@/server/profiles";
import { listActiveRoleAssignments } from "@/server/roles";

export async function listAdminUsers() {
  const profiles = await listProfiles();
  const roles = await listActiveRoleAssignments();

  return profiles.map((profile) => ({
    ...profile,
    sbRoles: roles
      .filter((assignment) => assignment.userId === profile.authUserId)
      .map((assignment) => assignment.role),
  }));
}
