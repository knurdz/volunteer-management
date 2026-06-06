import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteConflict, isAppwriteNotFound } from "@/server/errors";
import {
  assertNoOverlappingTerms,
  assertTermCanBeActivated,
  assertTermCanBeUpdated,
  assertValidTermLabel,
  assertValidTermDates,
  buildPermissionOverview,
  resolveActiveTermState,
} from "@/features/system-settings/lib/rules";
import { runTablesTransaction } from "@/features/system-settings/server/transactions";
import type {
  AuditLogPage,
  AuditLog,
  IeeeTerm,
  IeeeTermStatus,
  PermissionOverview,
  SystemSetting,
} from "@/features/system-settings/types";

type AppRow = Models.Row & Record<string, unknown>;

const ACTIVE_TERM_SETTING_KEY = "active_term_id";

function toOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

export function toIeeeTerm(row: AppRow): IeeeTerm {
  return {
    $id: row.$id,
    active: Boolean(row.active),
    createdAt: String(row.createdAt),
    createdBy: String(row.createdBy),
    endDate: String(row.endDate),
    label: String(row.label),
    notes: toOptionalString(row.notes),
    startDate: String(row.startDate),
    status: String(row.status) as IeeeTermStatus,
    updatedAt: String(row.updatedAt),
    updatedBy: String(row.updatedBy),
  };
}

export function toSystemSetting(row: AppRow): SystemSetting {
  return {
    $id: row.$id,
    key: String(row.key),
    updatedAt: String(row.updatedAt),
    updatedBy: String(row.updatedBy),
    value: toOptionalString(row.value),
  };
}

export function toAuditLog(row: AppRow): AuditLog {
  let metadata: Record<string, unknown> | undefined;

  if (typeof row.metadata === "string" && row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = { raw: row.metadata };
    }
  }

  return {
    $id: row.$id,
    action: String(row.action),
    actorUserId: toOptionalString(row.actorUserId),
    createdAt: String(row.createdAt),
    metadata,
    targetId: String(row.targetId),
    targetType: String(row.targetType),
  };
}

export async function listIeeeTerms() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.ieeeTerms,
    [Query.orderDesc("startDate"), Query.limit(100)],
    undefined,
    false,
  );

  return result.rows.map((row) => toIeeeTerm(row as AppRow));
}

export async function getIeeeTerm(termId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = await tables.getRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.ieeeTerms,
    termId,
  );

  return toIeeeTerm(row);
}

async function upsertSystemSetting({
  actorUserId,
  key,
  transactionId,
  value,
}: {
  actorUserId: string;
  key: string;
  transactionId: string;
  value: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const payload = {
    key,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUserId,
    value,
  };
  let row: AppRow;

  try {
    row = await tables.updateRow<AppRow>({
      data: payload,
      databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      rowId: key,
      tableId: APPWRITE_TABLES.systemSettings,
      transactionId,
    });
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    row = await tables.createRow<AppRow>({
      data: payload,
      databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      rowId: key,
      tableId: APPWRITE_TABLES.systemSettings,
      transactionId,
    });
  }

  await writeAuditLog({
    action: "SYSTEM_SETTING_UPDATED",
    actorUserId,
    metadata: { key, value },
    targetId: key,
    targetType: "system_setting",
    transactionId,
  });

  return toSystemSetting(row);
}

export async function getActiveTermSetting() {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      ACTIVE_TERM_SETTING_KEY,
    );

    return toSystemSetting(row);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function createIeeeTerm({
  actorUserId,
  endDate,
  label,
  notes,
  startDate,
}: {
  actorUserId: string;
  endDate: string;
  label: string;
  notes?: string;
  startDate: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const existingTerms = await listIeeeTerms();

  assertValidTermDates({ endDate, startDate });
  assertValidTermLabel(label, startDate);
  assertNoOverlappingTerms({ endDate, startDate }, existingTerms);

  const now = new Date().toISOString();
  const termId = ID.unique();

  try {
    return await runTablesTransaction(tables, async (transactionId) => {
      const row = await tables.createRow<AppRow>({
        data: {
          active: false,
          createdAt: now,
          createdBy: actorUserId,
          endDate,
          label,
          notes: notes ?? "",
          startDate,
          status: "DRAFT",
          updatedAt: now,
          updatedBy: actorUserId,
        },
        databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        rowId: termId,
        tableId: APPWRITE_TABLES.ieeeTerms,
        transactionId,
      });
      const term = toIeeeTerm(row);

      await writeAuditLog({
        action: "IEEE_TERM_CREATED",
        actorUserId,
        metadata: { endDate, label, startDate },
        targetId: term.$id,
        targetType: "ieee_term",
        transactionId,
      });

      return term;
    });
  } catch (error) {
    if (isAppwriteConflict(error)) {
      throw new Error("An IEEE term with this label or date range already exists.");
    }

    throw error;
  }
}

export async function updateIeeeTerm({
  actorUserId,
  endDate,
  label,
  notes,
  startDate,
  status,
  termId,
}: {
  actorUserId: string;
  endDate: string;
  label: string;
  notes?: string;
  startDate: string;
  status: Exclude<IeeeTermStatus, "ACTIVE">;
  termId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const existingTerms = await listIeeeTerms();
  const currentTerm = await getIeeeTerm(termId);

  assertTermCanBeUpdated(currentTerm);

  const nextStatus: IeeeTermStatus =
    currentTerm.active && status !== "CLOSED" ? "ACTIVE" : status;

  assertValidTermDates({ endDate, startDate });
  assertValidTermLabel(label, startDate);
  assertNoOverlappingTerms({ $id: termId, endDate, startDate }, existingTerms);

  const activeTermSetting =
    nextStatus === "CLOSED" ? await getActiveTermSetting() : null;

  return runTablesTransaction(tables, async (transactionId) => {
    const row = await tables.updateRow<AppRow>({
      data: {
        active: nextStatus === "ACTIVE",
        endDate,
        label,
        notes: notes ?? "",
        startDate,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUserId,
      },
      databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      rowId: termId,
      tableId: APPWRITE_TABLES.ieeeTerms,
      transactionId,
    });
    const term = toIeeeTerm(row);

    if (nextStatus === "CLOSED" && activeTermSetting?.value === termId) {
      await upsertSystemSetting({
        actorUserId,
        key: ACTIVE_TERM_SETTING_KEY,
        transactionId,
        value: "",
      });
    }

    await writeAuditLog({
      action:
        nextStatus === "CLOSED" ? "IEEE_TERM_CLOSED" : "IEEE_TERM_UPDATED",
      actorUserId,
      metadata:
        nextStatus === "CLOSED"
          ? {
              after: { active: false, status: "CLOSED" },
              before: {
                active: currentTerm.active,
                status: currentTerm.status,
              },
              reason: "ADMIN_CLOSED",
            }
          : { endDate, label, startDate, status: nextStatus },
      targetId: term.$id,
      targetType: "ieee_term",
      transactionId,
    });

    return term;
  });
}

export async function activateIeeeTerm({
  actorUserId,
  termId,
}: {
  actorUserId: string;
  termId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const terms = await listIeeeTerms();
  const selectedTerm = terms.find((term) => term.$id === termId) ?? await getIeeeTerm(termId);

  assertTermCanBeActivated(selectedTerm);

  assertValidTermDates(selectedTerm);
  assertValidTermLabel(selectedTerm.label, selectedTerm.startDate);
  assertNoOverlappingTerms(
    {
      $id: termId,
      endDate: selectedTerm.endDate,
      startDate: selectedTerm.startDate,
    },
    terms,
  );

  if (selectedTerm.active && selectedTerm.status === "ACTIVE") {
    await reconcileActiveTermState(actorUserId, terms);
    return selectedTerm;
  }

  const now = new Date().toISOString();

  return runTablesTransaction(tables, async (transactionId) => {
    for (const term of terms.filter(
      (term) =>
        term.$id !== termId && (term.active || term.status === "ACTIVE"),
    )) {
      const isDraftRepair = term.status === "DRAFT";
      const isClosedRepair = term.status === "CLOSED";
      const nextStatus = isDraftRepair ? "DRAFT" : "CLOSED";

      await tables.updateRow({
        data: {
          active: false,
          status: nextStatus,
          updatedAt: now,
          updatedBy: actorUserId,
        },
        databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        rowId: term.$id,
        tableId: APPWRITE_TABLES.ieeeTerms,
        transactionId,
      });
      await writeAuditLog({
        action:
          isDraftRepair || isClosedRepair
            ? "IEEE_TERM_STATE_REPAIRED"
            : "IEEE_TERM_CLOSED",
        actorUserId,
        metadata: {
          after: { active: false, status: nextStatus },
          before: { active: term.active, status: term.status },
          reason: isDraftRepair
            ? "DRAFT_ACTIVE_FLAG_CLEARED"
            : isClosedRepair
              ? "CLOSED_ACTIVE_FLAG_CLEARED"
              : "ACTIVE_TERM_REPLACED",
          replacementTermId: termId,
        },
        targetId: term.$id,
        targetType: "ieee_term",
        transactionId,
      });
    }

    const row = await tables.updateRow<AppRow>({
      data: {
        active: true,
        status: "ACTIVE",
        updatedAt: now,
        updatedBy: actorUserId,
      },
      databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      rowId: termId,
      tableId: APPWRITE_TABLES.ieeeTerms,
      transactionId,
    });
    const term = toIeeeTerm(row);

    await upsertSystemSetting({
      actorUserId,
      key: ACTIVE_TERM_SETTING_KEY,
      transactionId,
      value: term.$id,
    });

    await writeAuditLog({
      action: "IEEE_TERM_ACTIVATED",
      actorUserId,
      metadata: { label: term.label },
      targetId: term.$id,
      targetType: "ieee_term",
      transactionId,
    });

    return term;
  });
}

export async function reconcileActiveTermState(
  actorUserId = "system",
  suppliedTerms?: IeeeTerm[],
) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const [terms, activeTermSetting] = await Promise.all([
    suppliedTerms ? Promise.resolve(suppliedTerms) : listIeeeTerms(),
    getActiveTermSetting(),
  ]);
  const resolution = resolveActiveTermState(
    terms,
    activeTermSetting ? activeTermSetting.value ?? "" : null,
  );
  const activeSettingNeedsRepair =
    !activeTermSetting ||
    (activeTermSetting.value ?? "") !== resolution.activeTermId;
  if (!resolution.needsRepair) {
    return resolution.activeTermId;
  }

  const now = new Date().toISOString();

  await runTablesTransaction(tables, async (transactionId) => {
    for (const repair of resolution.termRepairs) {
      const term = terms.find((candidate) => candidate.$id === repair.termId);

      if (!term) {
        throw new Error(`IEEE term ${repair.termId} could not be repaired.`);
      }

      await tables.updateRow({
        data: {
          active: repair.active,
          status: repair.status,
          updatedAt: now,
          updatedBy: actorUserId,
        },
        databaseId: env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        rowId: repair.termId,
        tableId: APPWRITE_TABLES.ieeeTerms,
        transactionId,
      });
      await writeAuditLog({
        action: "IEEE_TERM_STATE_REPAIRED",
        actorUserId,
        metadata: {
          after: { active: repair.active, status: repair.status },
          before: { active: term.active, status: term.status },
          reason: repair.reason,
          selectedActiveTermId: resolution.activeTermId,
        },
        targetId: repair.termId,
        targetType: "ieee_term",
        transactionId,
      });
    }

    if (activeSettingNeedsRepair) {
      await upsertSystemSetting({
        actorUserId,
        key: ACTIVE_TERM_SETTING_KEY,
        transactionId,
        value: resolution.activeTermId,
      });
    }
  });

  return resolution.activeTermId;
}

export function getPermissionOverview(adminEmail: string): PermissionOverview {
  return buildPermissionOverview(adminEmail);
}

export async function listAuditLogs({
  action,
  actorUserId,
  cursor,
  dateFrom,
  dateTo,
  limit = 25,
  targetId,
}: {
  action?: string;
  actorUserId?: string;
  cursor?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  targetId?: string;
} = {}): Promise<AuditLogPage> {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), 99);
  const queries = [
    Query.orderDesc("createdAt"),
    Query.limit(pageSize + 1),
  ];

  if (action) {
    queries.push(Query.equal("action", action));
  }

  if (actorUserId) {
    queries.push(Query.equal("actorUserId", actorUserId));
  }

  if (targetId) {
    queries.push(Query.equal("targetId", targetId));
  }

  if (cursor) {
    queries.push(Query.cursorAfter(cursor));
  }

  if (dateFrom) {
    queries.push(Query.greaterThanEqual("createdAt", `${dateFrom}T00:00:00.000Z`));
  }

  if (dateTo) {
    queries.push(Query.lessThanEqual("createdAt", `${dateTo}T23:59:59.999Z`));
  }

  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.auditLogs,
    queries,
    undefined,
    false,
  );

  const hasMore = result.rows.length > pageSize;
  const rows = hasMore ? result.rows.slice(0, pageSize) : result.rows;
  const auditLogs = rows.map((row) => toAuditLog(row as AppRow));

  return {
    auditLogs,
    nextCursor: hasMore ? auditLogs.at(-1)?.$id : undefined,
    total: result.total,
  };
}

export async function getInitialSystemSettingsData() {
  const env = getServerEnv();
  const initialTerms = await listIeeeTerms();
  const activeTermId = await reconcileActiveTermState("system", initialTerms);
  const [terms, auditPage] = await Promise.all([
    listIeeeTerms(),
    listAuditLogs(),
  ]);

  return {
    activeTermId,
    auditPage,
    permissions: getPermissionOverview(env.ADMIN_EMAIL),
    terms,
  };
}
