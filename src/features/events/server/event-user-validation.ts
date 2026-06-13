import "server-only";

import { getProfile } from "@/features/access-control/server/profiles";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { ValidationError } from "@/server/errors";

export async function validateAssignableEventUser(userId: string) {
  const { users } = getAppwriteAdminServices();

  let appwriteUser;

  try {
    appwriteUser = await users.get(userId);
  } catch {
    throw new ValidationError("User not found");
  }

  if (appwriteUser.status === false) {
    throw new ValidationError("User account is disabled");
  }

  const profile = await getProfile(userId);

  if (!profile) {
    throw new ValidationError("User not found");
  }

  if (profile.status !== "ACTIVE") {
    throw new ValidationError("User account is disabled");
  }

  if (!profile.uomVerified) {
    throw new ValidationError("User has not completed UoM email verification");
  }

  return profile;
}
