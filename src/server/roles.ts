import "server-only";

import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { isSbRole } from "@/lib/auth/rules";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteNotFound } from "@/server/errors";
import type { RoleAssignment, SbRole } from "@/types/auth";

type AppRow = Models.Row & Record<string, unknown>;

function roleRowId(userId: string, role: SbRole) {
  return `${userId}_${role.toLowerCase().replaceAll(" ", "_")}`;
}

export function toRoleAssignment(row: AppRow): RoleAssignment {
  return {
    $id: row.$id,
    active: Boolean(row.active),
    assignedAt: String(row.assignedAt),
    assignedBy: String(row.assignedBy),
    revokedAt:
      typeof row.revokedAt === "string" && row.revokedAt ? row.revokedAt : undefined,
    role: String(row.role) as SbRole,
    userId: String(row.userId),
  };
}

export function parseSbRole(role: string) {
  if (!isSbRole(role)) {
    throw new Error("Invalid Student Branch role.");
  }

  return role;
}

export async function getActiveSbRoles(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    [Query.equal("userId", userId), Query.equal("active", true), Query.limit(25)],
    undefined,
    false,
  );

  return result.rows.map((row) => String((row as AppRow).role) as SbRole);
}

export async function listActiveRoleAssignments() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    [Query.equal("active", true), Query.limit(500)],
    undefined,
    false,
  );

  return result.rows.map((row) => toRoleAssignment(row as AppRow));
}

export async function assignSbRole({
  actorUserId,
  role,
  userId,
}: {
  actorUserId: string;
  role: SbRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = roleRowId(userId, role);
  const assignedAt = new Date().toISOString();

  let row: AppRow;

  try {
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
    );

    row = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
      {
        active: true,
        assignedAt,
        assignedBy: actorUserId,
        revokedAt: "",
      },
    );
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.sbRoleAssignments,
      rowId,
      {
        active: true,
        assignedAt,
        assignedBy: actorUserId,
        revokedAt: "",
        role,
        userId,
      },
    );
  }

  await writeAuditLog({
    action: "SB_ROLE_ASSIGNED",
    actorUserId,
    metadata: { role },
    targetId: userId,
    targetType: "profile",
  });

  return toRoleAssignment(row);
}

export async function revokeSbRole({
  actorUserId,
  role,
  userId,
}: {
  actorUserId: string;
  role: SbRole;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = roleRowId(userId, role);
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.sbRoleAssignments,
    rowId,
    {
      active: false,
      revokedAt: new Date().toISOString(),
    },
  );

  await writeAuditLog({
    action: "SB_ROLE_REVOKED",
    actorUserId,
    metadata: { role },
    targetId: userId,
    targetType: "profile",
  });

  return toRoleAssignment(row);
}
