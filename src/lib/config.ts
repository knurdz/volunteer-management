export const APP_NAME = "Volunteer Management";
export const ORGANIZATION_NAME = "IEEE Student Branch University of Moratuwa";
export const UOM_EMAIL_DOMAIN = "uom.lk";

export const EVENT_STATUSES = [
  "DRAFT",
  "PLANNING",
  "PUBLISHED",
  "ONGOING",
  "PENDING_CONCLUSION",
  "CLOSED",
] as const;

/** Canonical IEEE year terms from Core System Settings. */
export const IEEE_TERMS = ["2024/2025", "2025/2026", "2026/2027"] as const;

export const EVENT_YEAR_MIN = 2000;
export const EVENT_YEAR_MAX = 2100;

export const SB_ROLES = ["ExCom", "SB Lead", "SB Member"] as const;

export const EVENT_ROLES = [
  "Chair",
  "Vice Chair",
  "Committee Lead",
  "Committee Member",
] as const;

export const SCORING_ROLES = EVENT_ROLES;

export const ROLE_BASE_POINTS = {
  Chair: 60,
  "Vice Chair": 40,
  "Committee Lead": 25,
  "Committee Member": 10,
} as const;

export function isUomEmail(email: string) {
  return email.toLowerCase().endsWith(`@${UOM_EMAIL_DOMAIN}`);
}
