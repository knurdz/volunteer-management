import "server-only";

import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments, listActiveRoleAssignments } from "@/features/access-control/server/roles";
import type { VolunteerProfileExport } from "@/features/reports/types";

export async function listVolunteerProfiles(): Promise<VolunteerProfileExport[]> {
  const [profiles, sbAssignments, eventAssignments] = await Promise.all([
    listProfiles(),
    listActiveRoleAssignments(),
    listActiveEventRoleAssignments(),
  ]);

  const sbRolesByUser = new Map<string, VolunteerProfileExport["sbRoles"]>();

  for (const assignment of sbAssignments) {
    const current = sbRolesByUser.get(assignment.userId) ?? [];
    sbRolesByUser.set(assignment.userId, [...current, assignment.role]);
  }

  const participationsByUser = new Map<string, VolunteerProfileExport["participations"]>();

  for (const assignment of eventAssignments) {
    const current = participationsByUser.get(assignment.userId) ?? [];
    participationsByUser.set(assignment.userId, [
      ...current,
      {
        assignedAt: assignment.assignedAt,
        committeeName: assignment.committeeName,
        eventId: assignment.eventId,
        eventTitle: assignment.eventTitle,
        role: assignment.role,
      },
    ]);
  }

  return profiles
    .filter((profile) => profile.status === "ACTIVE")
    .map((profile) => ({
      googleEmail: profile.googleEmail,
      name: profile.name ?? profile.googleEmail,
      participations: participationsByUser.get(profile.authUserId) ?? [],
      recommendations: [],
      sbRoles: sbRolesByUser.get(profile.authUserId) ?? [],
      uomEmail: profile.uomEmail,
      userId: profile.authUserId,
    }));
}

export async function getVolunteerProfile(userId: string) {
  const profiles = await listVolunteerProfiles();
  return profiles.find((profile) => profile.userId === userId) ?? null;
}

export async function assertVolunteerProfileExportable(userId: string) {
  const profile = await getVolunteerProfile(userId);

  if (!profile) {
    throw new Error("Volunteer profile was not found.");
  }

  return profile;
}
