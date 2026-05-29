import "server-only";

import { ID } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import type { AuditAction } from "@/types/auth";

export async function writeAuditLog({
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
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  await tables.createRow(env.NEXT_PUBLIC_APPWRITE_DATABASE_ID, APPWRITE_TABLES.auditLogs, ID.unique(), {
    action,
    actorUserId: actorUserId ?? "",
    createdAt: new Date().toISOString(),
    metadata: metadata ? JSON.stringify(metadata) : "",
    targetId,
    targetType,
  });
}
