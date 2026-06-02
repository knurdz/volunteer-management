import { EVENT_ROLES, SB_ROLES, UOM_EMAIL_DOMAIN, isUomEmail } from "@/lib/config";
import type { EventRole, Profile, SbRole, SessionUser } from "@/features/access-control/types";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string, adminEmail: string) {
  return normalizeEmail(email) === normalizeEmail(adminEmail);
}

export function isSbRole(value: string): value is SbRole {
  return SB_ROLES.includes(value as SbRole);
}

export function isEventRole(value: string): value is EventRole {
  return normalizeEventRole(value) !== null;
}

export function normalizeEventRole(value: string): EventRole | null {
  const normalized = normalizeEventReference(value);
  const aliases: Record<string, EventRole> = {
    Lead: "Committee Lead",
    "OC Member": "Committee Member",
  };

  if (EVENT_ROLES.includes(normalized as EventRole)) {
    return normalized as EventRole;
  }

  return aliases[normalized] ?? null;
}

export function getEventRoleDisplayName(
  role: EventRole,
  { chairCount = 0 }: { chairCount?: number } = {},
) {
  if (role === "Chair" && chairCount > 1) {
    return "Co-chair";
  }

  return role;
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

export function hasEventRole(
  user: Pick<SessionUser, "isAdmin" | "eventRoles">,
  eventId: string,
  roles: EventRole | EventRole[],
) {
  if (user.isAdmin) {
    return true;
  }

  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  const normalizedEventId = normalizeEventReference(eventId);

  return user.eventRoles.some(
    (assignment) =>
      assignment.active &&
      normalizeEventReference(assignment.eventId) === normalizedEventId &&
      requiredRoles.includes(assignment.role),
  );
}

export function getEventRoleWeight(role: EventRole) {
  const weights: Record<EventRole, number> = {
    Chair: 4,
    "Vice Chair": 3,
    "Committee Lead": 2,
    "Committee Member": 1,
  };

  return weights[role];
}

export function normalizeEventReference(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeCommitteeName(value?: string) {
  const normalized = normalizeEventReference(value ?? "");
  return normalized || undefined;
}

export function requiresCommitteeName(role: EventRole) {
  return role === "Committee Lead" || role === "Committee Member";
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
