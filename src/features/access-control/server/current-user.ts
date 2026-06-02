import "server-only";

import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { canVolunteer, hasEventRole, hasSbRole, isAdminEmail } from "@/features/access-control/lib/rules";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { bootstrapProfile } from "@/features/access-control/server/profiles";
import { getActiveEventRoleAssignments, getActiveSbRoles } from "@/features/access-control/server/roles";
import { getSessionSecret } from "@/server/session";
import type { EventRole, SbRole, SessionUser } from "@/features/access-control/types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const sessionSecret = await getSessionSecret();

  if (!sessionSecret) {
    return null;
  }

  try {
    const env = getServerEnv();
    const { account } = getAppwriteSessionServices(sessionSecret);
    const appwriteUser = await account.get();
    const profile = await bootstrapProfile(appwriteUser);
    const sbRoles = await getActiveSbRoles(appwriteUser.$id);
    const eventRoles = await getActiveEventRoleAssignments(appwriteUser.$id);

    return {
      authUser: {
        email: appwriteUser.email,
        id: appwriteUser.$id,
        name: appwriteUser.name ?? "",
      },
      eventRoles,
      isAdmin: isAdminEmail(appwriteUser.email, env.ADMIN_EMAIL),
      profile,
      sbRoles,
    };
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();

  if (!user.isAdmin) {
    throw new Error("Admin access required.");
  }

  return user;
}

export async function requireUomVerifiedVolunteer() {
  const user = await requireAuth();

  if (!canVolunteer(user.profile)) {
    throw new Error("Verified UoM email is required before volunteering.");
  }

  return user;
}

export async function requireSbRole(roles: SbRole | SbRole[]) {
  const user = await requireAuth();

  if (!hasSbRole(user, roles)) {
    throw new Error("Required Student Branch role is missing.");
  }

  return user;
}

export async function requireEventRole(eventId: string, roles: EventRole | EventRole[]) {
  const user = await requireAuth();

  if (!user.isAdmin && !canVolunteer(user.profile)) {
    throw new Error("Verified UoM email is required before event access.");
  }

  if (!hasEventRole(user, eventId, roles)) {
    throw new Error("Required event role is missing.");
  }

  return user;
}

export async function redirectIfUnauthenticated(to = "/login") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(to);
  }

  return user;
}
