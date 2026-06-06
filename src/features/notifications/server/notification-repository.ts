import "server-only";

import type { Models } from "node-appwrite";
import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { getServerEnv } from "@/lib/env";
import { parseSafeJsonObject, serializeSafeJson } from "@/lib/validation/safe-json";
import { notificationPreferencesSchema } from "@/features/notifications/validation";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import type {
  CreateNotificationInput,
  Notification,
  NotificationPreference,
} from "@/features/notifications/types";

type AppRow = Models.Row & Record<string, unknown>;

export type NotificationRepository = {
  create(input: CreateNotificationInput & { createdAt: string }): Promise<Notification>;
  getPreferences(userId: string): Promise<NotificationPreference | null>;
  getRecipientEmail(userId: string): Promise<string | null>;
  getUnreadCount(userId: string): Promise<number>;
  listForRecipient(
    userId: string,
    options?: { limit?: number },
  ): Promise<Notification[]>;
  listUnreadRecipientUserIds(options?: { limit?: number }): Promise<string[]>;
  markReadForRecipient(input: {
    notificationIds: string[];
    readAt: string;
    userId: string;
  }): Promise<Notification[]>;
  upsertPreferences(
    input: Omit<NotificationPreference, "createdAt" | "updatedAt">,
  ): Promise<NotificationPreference>;
};

export function toNotification(row: AppRow): Notification {
  return {
    actorUserId:
      typeof row.actorUserId === "string" && row.actorUserId
        ? row.actorUserId
        : undefined,
    createdAt: String(row.createdAt),
    entityId:
      typeof row.entityId === "string" && row.entityId ? row.entityId : undefined,
    entityType:
      typeof row.entityType === "string" && row.entityType
        ? row.entityType
        : undefined,
    id: row.$id,
    linkHref:
      typeof row.linkHref === "string" && row.linkHref ? row.linkHref : undefined,
    message: String(row.message),
    metadata: parseSafeJsonObject(row.metadata),
    readAt: typeof row.readAt === "string" && row.readAt ? row.readAt : null,
    recipientUserId: String(row.recipientUserId),
    title: String(row.title),
    type: String(row.type) as Notification["type"],
  };
}

export function toNotificationPreference(row: AppRow): NotificationPreference {
  const parsed = notificationPreferencesSchema.parse({
    emailEnabled: Boolean(row.emailEnabled),
    inAppEnabled: row.inAppEnabled !== false,
    typePreferences: parseSafeJsonObject(row.typePreferences) ?? {},
  });

  return {
    createdAt: String(row.createdAt),
    emailEnabled: parsed.emailEnabled,
    inAppEnabled: parsed.inAppEnabled,
    typePreferences: parsed.typePreferences,
    updatedAt: String(row.updatedAt),
    userId: String(row.userId),
  };
}

export function createAppwriteNotificationRepository(): NotificationRepository {
  async function listForRecipient(userId: string, options: { limit?: number } = {}) {
    const env = getServerEnv();
    const { tables } = getAppwriteAdminServices();
    const result = await tables.listRows(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.notifications,
      [
        Query.equal("recipientUserId", userId),
        Query.orderDesc("createdAt"),
        Query.limit(options.limit ?? 25),
      ],
      undefined,
      false,
    );

    return result.rows.map((row) => toNotification(row as AppRow));
  }

  return {
    async create(input) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const row = await tables.createRow<AppRow>(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.notifications,
        ID.unique(),
        {
          actorUserId: input.actorUserId ?? "",
          createdAt: input.createdAt,
          entityId: input.entityId ?? "",
          entityType: input.entityType ?? "",
          linkHref: input.linkHref ?? "",
          message: input.message,
          metadata: serializeSafeJson(input.metadata),
          recipientUserId: input.recipientUserId,
          title: input.title,
          type: input.type,
        },
      );

      return toNotification(row);
    },

    async getPreferences(userId) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();

      try {
        const row = await tables.getRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.notificationPreferences,
          userId,
        );

        return toNotificationPreference(row);
      } catch (error) {
        if (isAppwriteNotFound(error)) {
          return null;
        }

        throw error;
      }
    },

    async getRecipientEmail(userId) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();

      try {
        const row = await tables.getRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.profiles,
          userId,
        );
        const uomEmail = typeof row.uomEmail === "string" ? row.uomEmail : "";
        const googleEmail =
          typeof row.googleEmail === "string" ? row.googleEmail : "";

        return uomEmail || googleEmail || null;
      } catch (error) {
        if (isAppwriteNotFound(error)) {
          return null;
        }

        throw error;
      }
    },

    async getUnreadCount(userId) {
      const notifications = await listForRecipient(userId, { limit: 500 });
      return notifications.filter((notification) => !notification.readAt).length;
    },

    listForRecipient,

    async listUnreadRecipientUserIds(options = {}) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const result = await tables.listRows(
        env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
        APPWRITE_TABLES.notifications,
        [Query.orderDesc("createdAt"), Query.limit(options.limit ?? 500)],
        undefined,
        false,
      );
      const recipients = result.rows
        .map((row) => toNotification(row as AppRow))
        .filter((notification) => !notification.readAt)
        .map((notification) => notification.recipientUserId);

      return [...new Set(recipients)];
    },

    async markReadForRecipient({ notificationIds, readAt, userId }) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const marked: Notification[] = [];

      for (const notificationId of notificationIds) {
        let existing: AppRow;

        try {
          existing = await tables.getRow<AppRow>(
            env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
            APPWRITE_TABLES.notifications,
            notificationId,
          );
        } catch (error) {
          if (isAppwriteNotFound(error)) {
            continue;
          }

          throw error;
        }

        if (String(existing.recipientUserId) !== userId) {
          continue;
        }

        if (typeof existing.readAt === "string" && existing.readAt) {
          marked.push(toNotification(existing));
          continue;
        }

        const row = await tables.updateRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.notifications,
          notificationId,
          { readAt },
        );

        marked.push(toNotification(row));
      }

      return marked;
    },

    async upsertPreferences(input) {
      const env = getServerEnv();
      const { tables } = getAppwriteAdminServices();
      const now = new Date().toISOString();
      const payload = {
        emailEnabled: input.emailEnabled,
        inAppEnabled: input.inAppEnabled,
        typePreferences: JSON.stringify(input.typePreferences),
        updatedAt: now,
        userId: input.userId,
      };

      try {
        const row = await tables.updateRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.notificationPreferences,
          input.userId,
          payload,
        );

        return toNotificationPreference(row);
      } catch (error) {
        if (!isAppwriteNotFound(error)) {
          throw error;
        }

        const row = await tables.createRow<AppRow>(
          env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
          APPWRITE_TABLES.notificationPreferences,
          input.userId,
          {
            ...payload,
            createdAt: now,
          },
        );

        return toNotificationPreference(row);
      }
    },
  };
}
