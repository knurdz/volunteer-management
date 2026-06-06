import type { EVENT_ROLES, SB_ROLES } from "@/lib/config";

export type SbRole = (typeof SB_ROLES)[number];
export type EventRole = (typeof EVENT_ROLES)[number];

export type ProfileStatus = "ACTIVE" | "DISABLED";
export type UomVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "EXPIRED"
  | "CANCELLED";

export type AuditAction =
  | "PROFILE_BOOTSTRAPPED"
  | "PROFILE_LOGIN_UPDATED"
  | "UOM_VERIFICATION_REQUESTED"
  | "UOM_VERIFICATION_CONFIRMED"
  | "SB_ROLE_ASSIGNED"
  | "SB_ROLE_REVOKED"
  | "EVENT_ROLE_ASSIGNED"
  | "EVENT_ROLE_REVOKED"
  | "IEEE_TERM_CREATED"
  | "IEEE_TERM_UPDATED"
  | "IEEE_TERM_ACTIVATED"
  | "TOP_BOARD_EXCLUSION_ADDED"
  | "TOP_BOARD_EXCLUSION_REMOVED"
  | "SYSTEM_SETTING_UPDATED";

export type Profile = {
  $id: string;
  authUserId: string;
  googleEmail: string;
  name?: string;
  uomEmail?: string;
  uomVerified: boolean;
  uomVerifiedAt?: string;
  status: ProfileStatus;
  lastLoginAt?: string;
};

export type RoleAssignment = {
  $id: string;
  userId: string;
  role: SbRole;
  assignedBy: string;
  assignedAt: string;
  revokedAt?: string;
  active: boolean;
};

export type EventRoleAssignment = {
  $id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  committeeName?: string;
  role: EventRole;
  eventChairCount?: number;
  assignedBy: string;
  assignedAt: string;
  revokedAt?: string;
  active: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type SessionUser = {
  authUser: AuthUser;
  profile: Profile;
  isAdmin: boolean;
  sbRoles: SbRole[];
  eventRoles: EventRoleAssignment[];
};
