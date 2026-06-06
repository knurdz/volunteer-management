import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createDisabledNotificationEmailAdapter } from "../src/features/notifications/server/email-adapter";
import { createNotificationService } from "../src/features/notifications/server/notification-service";
import { checkTrustedNotificationToken } from "../src/features/notifications/server/trusted-creation";
import type { NotificationRepository } from "../src/features/notifications/server/notification-repository";
import type {
  CreateNotificationInput,
  Notification,
  NotificationPreference,
} from "../src/features/notifications/types";

describe("notifications", () => {
  it("lists only the current user's notifications", async () => {
    const repository = createFakeNotificationRepository([
      fakeNotification({ id: "n-1", recipientUserId: "user-a" }),
      fakeNotification({ id: "n-2", recipientUserId: "user-b" }),
    ]);
    const service = createNotificationService({
      emailAdapter: createDisabledNotificationEmailAdapter(),
      now: fixedNow,
      repository,
    });

    const result = await service.listNotificationsForUser("user-a");

    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.id).toBe("n-1");
    expect(result.unreadCount).toBe(1);
  });

  it("marks read only for the current user's notification IDs", async () => {
    const otherUserNotification = fakeNotification({
      id: "n-other",
      recipientUserId: "user-b",
    });
    const repository = createFakeNotificationRepository([
      fakeNotification({ id: "n-own", recipientUserId: "user-a" }),
      otherUserNotification,
    ]);
    const service = createNotificationService({
      emailAdapter: createDisabledNotificationEmailAdapter(),
      now: fixedNow,
      repository,
    });

    const marked = await service.markNotificationsRead("user-a", [
      "n-own",
      "n-other",
    ]);

    expect(marked.map((notification) => notification.id)).toEqual(["n-own"]);
    expect(repository.snapshot().find((notification) => notification.id === "n-own")?.readAt)
      .toBe("2026-06-01T10:00:00.000Z");
    expect(repository.snapshot().find((notification) => notification.id === "n-other")?.readAt)
      .toBeNull();
  });

  it("keeps browser creation disabled unless a trusted token is configured and supplied", () => {
    expect(
      checkTrustedNotificationToken({
        configuredToken: undefined,
        providedToken: "browser-token",
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      checkTrustedNotificationToken({
        configuredToken: "server-secret",
        providedToken: "browser-token",
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      checkTrustedNotificationToken({
        configuredToken: "server-secret",
        providedToken: "server-secret",
      }),
    ).toEqual({ ok: true });
  });

  it("can disable email delivery while still recording the intent safely", async () => {
    const repository = createFakeNotificationRepository([], {
      preferences: [
        {
          createdAt: "2026-06-01T00:00:00.000Z",
          emailEnabled: true,
          inAppEnabled: true,
          typePreferences: {},
          updatedAt: "2026-06-01T00:00:00.000Z",
          userId: "user-a",
        },
      ],
      recipientEmails: [["user-a", "person@example.com"]],
    });
    const service = createNotificationService({
      emailAdapter: createDisabledNotificationEmailAdapter("development"),
      now: fixedNow,
      repository,
    });

    const result = await service.createNotification({
      message: "Please review your role assignment.",
      recipientUserId: "user-a",
      title: "Role assigned",
      type: "role_assignment",
    });

    expect(result.notification?.recipientUserId).toBe("user-a");
    expect(result.emailDelivery).toMatchObject({
      disabled: true,
      provider: "disabled",
      safeRecipient: "pe***@example.com",
    });
  });
});

function createFakeNotificationRepository(
  initialNotifications: Notification[],
  options: {
    preferences?: NotificationPreference[];
    recipientEmails?: Array<[string, string]>;
  } = {},
): NotificationRepository & { snapshot: () => Notification[] } {
  const notifications = [...initialNotifications];
  const preferences = new Map(
    (options.preferences ?? []).map((preference) => [preference.userId, preference]),
  );
  const recipientEmails = new Map(options.recipientEmails ?? []);

  return {
    async create(input: CreateNotificationInput & { createdAt: string }) {
      const notification: Notification = {
        ...input,
        createdAt: input.createdAt,
        id: `n-${notifications.length + 1}`,
        readAt: null,
      };
      notifications.push(notification);
      return notification;
    },
    async getPreferences(userId: string) {
      return preferences.get(userId) ?? null;
    },
    async getRecipientEmail(userId: string) {
      return recipientEmails.get(userId) ?? null;
    },
    async getUnreadCount(userId: string) {
      return notifications.filter(
        (notification) =>
          notification.recipientUserId === userId && !notification.readAt,
      ).length;
    },
    async listForRecipient(userId: string) {
      return notifications.filter(
        (notification) => notification.recipientUserId === userId,
      );
    },
    async listUnreadRecipientUserIds() {
      return [
        ...new Set(
          notifications
            .filter((notification) => !notification.readAt)
            .map((notification) => notification.recipientUserId),
        ),
      ];
    },
    async markReadForRecipient({ notificationIds, readAt, userId }) {
      const marked: Notification[] = [];

      for (const notification of notifications) {
        if (
          notification.recipientUserId !== userId ||
          !notificationIds.includes(notification.id)
        ) {
          continue;
        }

        notification.readAt = notification.readAt ?? readAt;
        marked.push(notification);
      }

      return marked;
    },
    snapshot() {
      return notifications;
    },
    async upsertPreferences(input) {
      const preference: NotificationPreference = {
        ...input,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      };
      preferences.set(input.userId, preference);
      return preference;
    },
  };
}

function fakeNotification(input: Partial<Notification>): Notification {
  return {
    createdAt: "2026-06-01T09:00:00.000Z",
    id: "n-1",
    message: "Message",
    readAt: null,
    recipientUserId: "user-a",
    title: "Title",
    type: "system",
    ...input,
  };
}

function fixedNow() {
  return new Date("2026-06-01T10:00:00.000Z");
}
