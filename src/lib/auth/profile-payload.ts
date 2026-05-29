import type { AuthUser } from "@/types/auth";

export function buildInitialProfilePayload(authUser: AuthUser, now: string) {
  return {
    authUserId: authUser.id,
    googleEmail: authUser.email,
    lastLoginAt: now,
    name: authUser.name,
    status: "ACTIVE",
    uomVerified: false,
  };
}
