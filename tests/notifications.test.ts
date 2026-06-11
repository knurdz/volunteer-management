import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDisabledNotificationEmailAdapter,
  sendNotificationEmailWithRetry,
  type NotificationEmailMessage,
} from "../src/features/notifications/server/email-adapter";
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
      idempotencyKey: expect.stringMatching(/^email_/),
      provider: "disabled",
      safeRecipient: "pe***@example.com",
    });
  });

  it("rejects unsafe notification links before creation", async () => {
    const repository = createFakeNotificationRepository([]);
    const service = createNotificationService({
      emailAdapter: createDisabledNotificationEmailAdapter(),
      now: fixedNow,
      repository,
    });

    await expect(
      service.createNotification({
        linkHref: "javascript:alert(1)",
        message: "Unsafe",
        recipientUserId: "user-a",
        title: "Unsafe",
        type: "system",
      }),
    ).rejects.toThrow("Notification links");

    await expect(
      service.createNotification({
        linkHref: "/dashboard?tab=notifications",
        message: "Safe",
        recipientUserId: "user-a",
        title: "Safe",
        type: "system",
      }),
    ).resolves.toMatchObject({
      notification: expect.objectContaining({
        linkHref: "/dashboard?tab=notifications",
      }),
    });
  });

  it("lets users own their preferences without an admin side effect", async () => {
    const repository = createFakeNotificationRepository([]);
    const service = createNotificationService({
      emailAdapter: createDisabledNotificationEmailAdapter(),
      now: fixedNow,
      repository,
    });

    await expect(service.getPreferencesForUser("user-a")).resolves.toMatchObject({
      emailEnabled: false,
      inAppEnabled: true,
      userId: "user-a",
    });

    const preference = await service.upsertPreferences("user-a", {
      emailEnabled: true,
      inAppEnabled: true,
      typePreferences: {
        system: {
          emailEnabled: false,
        },
      },
    });

    expect(preference).toMatchObject({
      emailEnabled: true,
      typePreferences: {
        system: {
          emailEnabled: false,
        },
      },
      userId: "user-a",
    });
  });

  it("builds unread digests from unread pagination, not just the newest page", async () => {
    const messages: NotificationEmailMessage[] = [];
    const repository = createFakeNotificationRepository(
      [
        fakeNotification({
          createdAt: "2026-06-01T10:00:00.000Z",
          id: "read-latest",
          message: "Already read",
          readAt: "2026-06-01T10:01:00.000Z",
          title: "Read",
        }),
        fakeNotification({
          createdAt: "2026-06-01T09:00:00.000Z",
          id: "unread-older",
          message: "Needs attention",
          title: "Older unread",
        }),
      ],
      {
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
      },
    );
    const service = createNotificationService({
      emailAdapter: {
        async sendNotification(message) {
          messages.push(message);
          return {
            idempotencyKey: message.idempotencyKey,
            provider: "smtp",
            safeRecipient: "pe***@example.com",
          };
        },
      },
      now: fixedNow,
      repository,
    });

    await service.sendUnreadDigestForUser("user-a");

    expect(messages[0]?.text).toContain("Older unread: Needs attention");
    expect(messages[0]?.text).not.toContain("Read: Already read");
  });

  it("reuses the same idempotency key across email retry attempts", async () => {
    const keys: Array<string | undefined> = [];
    let attempts = 0;
    const delivery = await sendNotificationEmailWithRetry(
      {
        async sendNotification(message) {
          attempts += 1;
          keys.push(message.idempotencyKey);

          if (attempts === 1) {
            throw new Error("Transient SMTP failure");
          }

          return {
            idempotencyKey: message.idempotencyKey,
            provider: "smtp",
            safeRecipient: "pe***@example.com",
          };
        },
      },
      {
        subject: "Retry",
        text: "Try again",
        to: "person@example.com",
      },
    );

    expect(attempts).toBe(2);
    expect(keys[0]).toMatch(/^email_/);
    expect(keys[0]).toBe(keys[1]);
    expect(delivery.idempotencyKey).toBe(keys[0]);
  });

  it("does not duplicate in-app notifications when a failed email send is retried", async () => {
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
    let attempts = 0;
    const service = createNotificationService({
      emailAdapter: {
        async sendNotification(message) {
          attempts += 1;

          if (attempts <= 2) {
            throw new Error("SMTP failed after notification creation");
          }

          return {
            idempotencyKey: message.idempotencyKey,
            provider: "smtp",
            safeRecipient: "pe***@example.com",
          };
        },
      },
      now: fixedNow,
      repository,
    });
    const input: CreateNotificationInput = {
      idempotencyKey: "role-assignment:user-a:sb-member",
      message: "Please review your role assignment.",
      recipientUserId: "user-a",
      title: "Role assigned",
      type: "role_assignment",
    };

    await expect(service.createNotification(input)).rejects.toThrow("SMTP failed");
    expect(repository.snapshot()).toHaveLength(1);

    const retry = await service.createNotification(input);

    expect(retry.notification?.id).toBe(repository.snapshot()[0]?.id);
    expect(repository.snapshot()).toHaveLength(1);
    expect(attempts).toBe(3);
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
  const notificationsByIdempotencyKey = new Map<string, Notification>();
  const preferences = new Map(
    (options.preferences ?? []).map((preference) => [preference.userId, preference]),
  );
  const recipientEmails = new Map(options.recipientEmails ?? []);

  return {
    async create(input: CreateNotificationInput & { createdAt: string }) {
      if (input.idempotencyKey) {
        const existingNotification = notificationsByIdempotencyKey.get(
          input.idempotencyKey,
        );

        if (existingNotification) {
          return existingNotification;
        }
      }

      const notification: Notification = {
        ...input,
        createdAt: input.createdAt,
        id: `n-${notifications.length + 1}`,
        readAt: null,
      };
      notifications.push(notification);

      if (input.idempotencyKey) {
        notificationsByIdempotencyKey.set(input.idempotencyKey, notification);
      }

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
    async listUnreadForRecipient(userId: string, options = {}) {
      return notifications
        .filter(
          (notification) =>
            notification.recipientUserId === userId && !notification.readAt,
        )
        .slice(0, options.limit ?? 25);
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
