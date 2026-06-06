import type { EventRole, SbRole } from "@/features/access-control/types";

export type IeeeTermStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export type IeeeTerm = {
  $id: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  endDate: string;
  label: string;
  notes?: string;
  startDate: string;
  status: IeeeTermStatus;
  updatedAt: string;
  updatedBy: string;
};

export type SystemSetting = {
  $id: string;
  key: string;
  updatedAt: string;
  updatedBy: string;
  value?: string;
};

export type TopBoardExclusion = {
  $id: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
  reason: string;
  revokedAt?: string;
  revokedBy?: string;
  termId: string;
  userId: string;
};

export type PermissionOverview = {
  adminEmail: string;
  adminSource: "ADMIN_EMAIL";
  eventRoles: Array<{
    notes: string;
    role: EventRole;
    scope: "event";
  }>;
  notes: string[];
  sbRoles: Array<{
    notes: string;
    role: SbRole;
    scope: "student-branch";
  }>;
};

export type AuditLog = {
  $id: string;
  action: string;
  actorUserId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  targetId: string;
  targetType: string;
};

export type AuditLogPage = {
  auditLogs: AuditLog[];
  nextCursor?: string;
  total: number;
};
