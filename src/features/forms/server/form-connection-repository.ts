import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { parseSafeJsonObject, serializeSafeJson } from "@/lib/validation/safe-json";
import { getAppwriteAdminServices } from "@/server/appwrite";
import type {
  CreateFormConnectionInput,
  FormConnection,
} from "@/features/forms/types";

type AppRow = Models.Row & Record<string, unknown>;

export type FormConnectionRepository = {
  create(
    input: CreateFormConnectionInput & {
      createdAt: string;
      createdBy: string;
      updatedAt: string;
    },
  ): Promise<FormConnection>;
  list(options?: { eventId?: string; limit?: number }): Promise<FormConnection[]>;
};

export function toFormConnection(row: AppRow): FormConnection {
  return {
    createdAt: String(row.createdAt),
    createdBy: String(row.createdBy),
    eventId: String(row.eventId),
    externalFormId:
      typeof row.externalFormId === "string" && row.externalFormId
        ? row.externalFormId
        : undefined,
    formUrl: typeof row.formUrl === "string" && row.formUrl ? row.formUrl : undefined,
    id: row.$id,
    metadata: parseSafeJsonObject(row.metadata),
    provider: String(row.provider) as FormConnection["provider"],
    purpose: String(row.purpose) as FormConnection["purpose"],
    status: String(row.status) as FormConnection["status"],
    title: String(row.title),
    updatedAt: String(row.updatedAt),
  };
}

export function createAppwriteFormConnectionRepository(): FormConnectionRepository {
  return {
    async create(input) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const row = await tables.createRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.formConnections,
        ID.unique(),
        {
          createdAt: input.createdAt,
          createdBy: input.createdBy,
          eventId: input.eventId,
          externalFormId: input.externalFormId ?? "",
          formUrl: input.formUrl ?? "",
          metadata: serializeSafeJson(input.metadata),
          provider: input.provider,
          purpose: input.purpose,
          status: input.status ?? "active",
          title: input.title,
          updatedAt: input.updatedAt,
        },
      );

      return toFormConnection(row);
    },

    async list(options = {}) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const queries = [
        Query.orderDesc("updatedAt"),
        Query.limit(options.limit ?? 100),
      ];

      if (options.eventId) {
        queries.unshift(Query.equal("eventId", options.eventId));
      }

      const result = await tables.listRows(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.formConnections,
        queries,
        undefined,
        false,
      );

      return result.rows.map((row) => toFormConnection(row as AppRow));
    },
  };
}
