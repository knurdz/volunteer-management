import "server-only";

import { ID } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import type { AuditAction } from "@/features/access-control/types";

export async function writeAuditLog({
  action,
  actorUserId,
  metadata,
  targetId,
  targetType,
  transactionId,
}: {
  action: AuditAction;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
  targetId: string;
  targetType: string;
  transactionId?: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  await tables.createRow({
    data: {
      action,
      actorUserId: actorUserId ?? "",
      createdAt: new Date().toISOString(),
      metadata: metadata ? JSON.stringify(metadata) : "",
      targetId,
      targetType,
    },
    databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    rowId: ID.unique(),
    tableId: APPWRITE_TABLES.auditLogs,
    transactionId,
  });
}
