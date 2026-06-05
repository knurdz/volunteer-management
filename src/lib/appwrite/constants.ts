export const APPWRITE_SESSION_COOKIE = "vm_appwrite_session";

export const APPWRITE_TABLES = {
  profiles: "profiles",
  profileDetails: "profile_details",
  recommendationRequests: "recommendation_requests",
  recommendations: "recommendations",
  uomVerificationRequests: "uom_verification_requests",
  sbRoleAssignments: "sb_role_assignments",
  eventRoleAssignments: "event_role_assignments",
  auditLogs: "audit_logs",
} as const;

export const UOM_VERIFICATION_CODE_TTL_MINUTES = 15;
export const UOM_VERIFICATION_MAX_ATTEMPTS = 5;
