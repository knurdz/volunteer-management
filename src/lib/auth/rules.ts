import { SB_ROLES, UOM_EMAIL_DOMAIN, isUomEmail } from "@/lib/config";
import type { Profile, SbRole, SessionUser } from "@/types/auth";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string, adminEmail: string) {
  return normalizeEmail(email) === normalizeEmail(adminEmail);
}

export function isSbRole(value: string): value is SbRole {
  return SB_ROLES.includes(value as SbRole);
}

export function hasSbRole(
  user: Pick<SessionUser, "isAdmin" | "sbRoles">,
  roles: SbRole | SbRole[],
) {
  if (user.isAdmin) {
    return true;
  }

  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  return requiredRoles.some((role) => user.sbRoles.includes(role));
}

export function canVolunteer(profile: Pick<Profile, "status" | "uomVerified">) {
  return profile.status === "ACTIVE" && profile.uomVerified;
}

export function normalizeUomEmail(email: string) {
  const normalized = normalizeEmail(email);

  if (!isUomEmail(normalized)) {
    throw new Error(`Email must be a @${UOM_EMAIL_DOMAIN} address.`);
  }

  return normalized;
}
