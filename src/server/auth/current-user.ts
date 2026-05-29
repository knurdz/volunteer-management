import "server-only";

import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { canVolunteer, hasSbRole, isAdminEmail } from "@/lib/auth/rules";
import { getAppwriteSessionServices } from "@/server/appwrite";
import { bootstrapProfile } from "@/server/profiles";
import { getActiveSbRoles } from "@/server/roles";
import { getSessionSecret } from "@/server/session";
import type { SbRole, SessionUser } from "@/types/auth";

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

    return {
      authUser: {
        email: appwriteUser.email,
        id: appwriteUser.$id,
        name: appwriteUser.name ?? "",
      },
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

export async function redirectIfUnauthenticated(to = "/login") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(to);
  }

  return user;
}
