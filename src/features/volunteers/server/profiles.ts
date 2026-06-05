import "server-only";

import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import { writeAuditLog } from "@/server/audit";
import { getActiveEventRoleAssignments, getActiveSbRoles } from "@/features/access-control/server/roles";
import { getProfile } from "@/features/access-control/server/profiles";
import type { SessionUser } from "@/features/access-control/types";
import type {
  VolunteerProfileDetails,
  VolunteerProfileSummary,
} from "@/features/volunteers/types";
import type { VolunteerProfileDetailsInput } from "@/features/volunteers/lib/profile-details";

type AppRow = Record<string, unknown> & { $id: string };

function toVolunteerProfileDetails(row: AppRow): VolunteerProfileDetails {
  return {
    $id: row.$id,
    bio: typeof row.bio === "string" && row.bio ? row.bio : undefined,
    createdAt: String(row.createdAt),
    headline: typeof row.headline === "string" && row.headline ? row.headline : undefined,
    linkedinUrl:
      typeof row.linkedinUrl === "string" && row.linkedinUrl ? row.linkedinUrl : undefined,
    skills: typeof row.skills === "string" && row.skills ? row.skills : undefined,
    updatedAt: String(row.updatedAt),
    userId: String(row.userId),
  };
}

export async function getVolunteerProfileDetails(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profileDetails,
      userId,
    );

    return toVolunteerProfileDetails(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function upsertMyVolunteerProfileDetails({
  details,
  user,
}: {
  details: VolunteerProfileDetailsInput;
  user: SessionUser;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const existing = await getVolunteerProfileDetails(user.authUser.id);
  const payload = {
    bio: details.bio,
    headline: details.headline,
    linkedinUrl: details.linkedinUrl,
    skills: details.skills,
    updatedAt: now,
    userId: user.authUser.id,
  };

  const row = existing
    ? await tables.updateRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.profileDetails,
        user.authUser.id,
        payload,
      )
    : await tables.createRow(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.profileDetails,
        user.authUser.id,
        {
          ...payload,
          createdAt: now,
        },
      );

  await writeAuditLog({
    action: "VOLUNTEER_PROFILE_UPDATED",
    actorUserId: user.authUser.id,
    metadata: { changedFields: Object.keys(details) },
    targetId: user.authUser.id,
    targetType: "volunteer_profile",
  });

  return toVolunteerProfileDetails(row as AppRow);
}

export async function getVolunteerProfileSummary(
  userId: string,
): Promise<VolunteerProfileSummary | null> {
  const profile = await getProfile(userId);

  if (!profile) {
    return null;
  }

  const [details, sbRoles, eventRoles] = await Promise.all([
    getVolunteerProfileDetails(userId),
    getActiveSbRoles(userId),
    getActiveEventRoleAssignments(userId),
  ]);

  return {
    details,
    eventRoles: eventRoles.map((role) => ({
      committeeName: role.committeeName,
      eventId: role.eventId,
      eventTitle: role.eventTitle,
      role: role.role,
    })),
    googleEmail: profile.googleEmail,
    name: profile.name,
    sbRoles,
    uomEmail: profile.uomEmail,
    uomVerified: profile.uomVerified,
    userId,
  };
}
