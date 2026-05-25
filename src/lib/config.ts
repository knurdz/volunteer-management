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

export const SB_ROLES = ["ExCom", "SB Lead", "SB Member"] as const;

export const EVENT_ROLES = ["Chair", "Co Chair", "Event Member"] as const;

export const SCORING_ROLES = ["Chair", "Vice Chair", "Lead", "Member"] as const;

export const ROLE_BASE_POINTS = {
  Chair: 60,
  "Vice Chair": 40,
  Lead: 25,
  Member: 10,
} as const;

export function isUomEmail(email: string) {
  return email.toLowerCase().endsWith(`@${UOM_EMAIL_DOMAIN}`);
}
