import "server-only";

import { writeAuditLog } from "@/server/audit";
import type { AuditAction } from "@/features/access-control/types";

export async function safeEventAuditLog({
  action,
  actorUserId,
  metadata,
  targetId,
  targetType,
}: {
  action: AuditAction;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
  targetId: string;
  targetType: string;
}) {
  try {
    await writeAuditLog({
      action,
      actorUserId,
      metadata,
      targetId,
      targetType,
    });
  } catch (error) {
    console.error(`Audit log failed for action "${action}":`, error);
  }
}
