import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { isAppwriteNotFound } from "@/server/errors";
import {
  assertNoOverlappingTerms,
  assertValidTermDates,
  buildPermissionOverview,
} from "@/features/system-settings/lib/rules";
import type {
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
  value,
}: {
  actorUserId: string;
  key: string;
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
    row = await tables.updateRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      key,
      payload,
    );
  } catch (error) {
    if (!isAppwriteNotFound(error)) {
      throw error;
    }

    row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.systemSettings,
      key,
      payload,
    );
  }

  await writeAuditLog({
    action: "SYSTEM_SETTING_UPDATED",
    actorUserId,
    metadata: { key, value },
    targetId: key,
    targetType: "system_setting",
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
  assertNoOverlappingTerms({ endDate, startDate, status: "DRAFT" }, existingTerms);

  const now = new Date().toISOString();
  const row = await tables.createRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.ieeeTerms,
    ID.unique(),
    {
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
  );
  const term = toIeeeTerm(row);

  await writeAuditLog({
    action: "IEEE_TERM_CREATED",
    actorUserId,
    metadata: { endDate, label, startDate },
    targetId: term.$id,
    targetType: "ieee_term",
  });

  return term;
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
  const nextStatus: IeeeTermStatus =
    currentTerm.active && status !== "CLOSED" ? "ACTIVE" : status;

  assertValidTermDates({ endDate, startDate });
  assertNoOverlappingTerms({ $id: termId, endDate, startDate, status: nextStatus }, existingTerms);

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.ieeeTerms,
    termId,
    {
      active: nextStatus === "ACTIVE",
      endDate,
      label,
      notes: notes ?? "",
      startDate,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUserId,
    },
  );
  const term = toIeeeTerm(row);

  if (nextStatus === "CLOSED") {
    const activeTermSetting = await getActiveTermSetting();

    if (activeTermSetting?.value === termId) {
      await upsertSystemSetting({
        actorUserId,
        key: ACTIVE_TERM_SETTING_KEY,
        value: "",
      });
    }
  }

  await writeAuditLog({
    action: "IEEE_TERM_UPDATED",
    actorUserId,
    metadata: { endDate, label, startDate, status: nextStatus },
    targetId: term.$id,
    targetType: "ieee_term",
  });

  return term;
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

  assertValidTermDates(selectedTerm);
  assertNoOverlappingTerms(
    {
      $id: termId,
      endDate: selectedTerm.endDate,
      startDate: selectedTerm.startDate,
      status: "ACTIVE",
    },
    terms,
  );

  const now = new Date().toISOString();

  await Promise.all(
    terms
      .filter((term) => term.active && term.$id !== termId)
      .map((term) =>
        tables.updateRow(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.ieeeTerms,
          term.$id,
          {
            active: false,
            status: "CLOSED",
            updatedAt: now,
            updatedBy: actorUserId,
          },
        ),
      ),
  );

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.ieeeTerms,
    termId,
    {
      active: true,
      status: "ACTIVE",
      updatedAt: now,
      updatedBy: actorUserId,
    },
  );
  const term = toIeeeTerm(row);

  await upsertSystemSetting({
    actorUserId,
    key: ACTIVE_TERM_SETTING_KEY,
    value: term.$id,
  });

  await writeAuditLog({
    action: "IEEE_TERM_ACTIVATED",
    actorUserId,
    metadata: { label: term.label },
    targetId: term.$id,
    targetType: "ieee_term",
  });

  return term;
}

export function getPermissionOverview(adminEmail: string): PermissionOverview {
  return buildPermissionOverview(adminEmail);
}

export async function listAuditLogs({
  action,
  actorUserId,
  dateFrom,
  dateTo,
  targetId,
}: {
  action?: string;
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  targetId?: string;
} = {}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const queries = [Query.orderDesc("createdAt"), Query.limit(100)];

  if (action) {
    queries.push(Query.equal("action", action));
  }

  if (actorUserId) {
    queries.push(Query.equal("actorUserId", actorUserId));
  }

  if (targetId) {
    queries.push(Query.equal("targetId", targetId));
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

  return result.rows.map((row) => toAuditLog(row as AppRow));
}

export async function getInitialSystemSettingsData() {
  const env = getServerEnv();
  const [terms, activeTermSetting, auditLogs] = await Promise.all([
    listIeeeTerms(),
    getActiveTermSetting(),
    listAuditLogs(),
  ]);

  return {
    activeTermId: activeTermSetting?.value ?? terms.find((term) => term.active)?.$id ?? "",
    auditLogs,
    permissions: getPermissionOverview(env.ADMIN_EMAIL),
    terms,
  };
}
