import "server-only";

import { createHash } from "node:crypto";
import type { Models } from "node-appwrite";
import { Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteNotFound } from "@/server/errors";
import { getProfile } from "@/features/access-control/server/profiles";
import { getIeeeTerm } from "@/features/system-settings/server/settings";
import { runTablesTransaction } from "@/features/system-settings/server/transactions";
import type { TopBoardExclusion } from "@/features/system-settings/types";

type AppRow = Models.Row & Record<string, unknown>;

function topBoardExclusionRowId(termId: string, userId: string) {
  const seed = `${termId}:${userId}`;

  return `tbe_${createHash("sha1").update(seed).digest("hex").slice(0, 28)}`;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

export function toTopBoardExclusion(row: AppRow): TopBoardExclusion {
  return {
    $id: row.$id,
    active: Boolean(row.active),
    createdAt: String(row.createdAt),
    createdBy: String(row.createdBy),
    reason: String(row.reason),
    revokedAt: toOptionalString(row.revokedAt),
    revokedBy: toOptionalString(row.revokedBy),
    termId: String(row.termId),
    userId: String(row.userId),
  };
}

async function requireExcludableProfile(userId: string) {
  const profile = await getProfile(userId);

  if (!profile) {
    throw new Error("Target profile was not found.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("Only active profiles can be excluded from Top Board rankings.");
  }

  return profile;
}

export async function listTopBoardExclusions(termId?: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const queries = [Query.orderDesc("createdAt"), Query.limit(500)];

  if (termId) {
    queries.push(Query.equal("termId", termId));
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.topBoardExclusions,
    queries,
    undefined,
    false,
  );

  return result.rows.map((row) => toTopBoardExclusion(row as AppRow));
}

export async function addTopBoardExclusion({
  actorUserId,
  reason,
  termId,
  userId,
}: {
  actorUserId: string;
  reason: string;
  termId: string;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const rowId = topBoardExclusionRowId(termId, userId);
  const now = new Date().toISOString();

  await getIeeeTerm(termId);
  await requireExcludableProfile(userId);

  let existingRow: AppRow | undefined;

  try {
    existingRow = await tables.getRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.topBoardExclusions,
      rowId,
    );
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }
  }

  if (existingRow) {
    const existingExclusion = toTopBoardExclusion(existingRow);

    if (existingExclusion.active && !existingExclusion.revokedAt) {
      return existingExclusion;
    }
  }

  return runTablesTransaction(tables, async (transactionId) => {
    const payload = {
      active: true,
      createdAt: now,
      createdBy: actorUserId,
      reason,
      revokedAt: null,
      revokedBy: "",
      termId,
      userId,
    };
    const row = existingRow
      ? await tables.updateRow<AppRow>({
          data: payload,
          databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          rowId,
          tableId: APPWRITE_TABLES.topBoardExclusions,
          transactionId,
        })
      : await tables.createRow<AppRow>({
          data: payload,
          databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          rowId,
          tableId: APPWRITE_TABLES.topBoardExclusions,
          transactionId,
        });

    await writeAuditLog({
      action: "TOP_BOARD_EXCLUSION_ADDED",
      actorUserId,
      metadata: { reason, termId },
      targetId: userId,
      targetType: "profile",
      transactionId,
    });

    return toTopBoardExclusion(row);
  });
}

export async function revokeTopBoardExclusion({
  actorUserId,
  exclusionId,
}: {
  actorUserId: string;
  exclusionId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const existingRow = await tables.getRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.topBoardExclusions,
    exclusionId,
  );
  const existingExclusion = toTopBoardExclusion(existingRow);

  if (!existingExclusion.active || existingExclusion.revokedAt) {
    return existingExclusion;
  }

  return runTablesTransaction(tables, async (transactionId) => {
    const row = await tables.updateRow<AppRow>({
      data: {
        active: false,
        revokedAt: new Date().toISOString(),
        revokedBy: actorUserId,
      },
      databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      rowId: exclusionId,
      tableId: APPWRITE_TABLES.topBoardExclusions,
      transactionId,
    });
    const exclusion = toTopBoardExclusion(row);

    await writeAuditLog({
      action: "TOP_BOARD_EXCLUSION_REMOVED",
      actorUserId,
      metadata: { exclusionId, reason: exclusion.reason, termId: exclusion.termId },
      targetId: exclusion.userId,
      targetType: "profile",
      transactionId,
    });

    return exclusion;
  });
}
