import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendEventReminderNotificationsJob } from "../src/jobs/send-event-reminder-notifications-job";
import { sendUnreadNotificationDigestJob } from "../src/jobs/send-unread-notification-digest-job";

describe("notification jobs", () => {
  it("validates and deduplicates unread digest recipients", async () => {
    const sent: Array<{ idempotencyKey?: string; userId: string }> = [];
    const result = await sendUnreadNotificationDigestJob(
      {
        dryRun: false,
        userIds: ["user-a", " user-a ", "user-b"],
      },
      {
        notificationService: {
          async getUnreadCount(userId) {
            return userId === "user-a" ? 2 : 1;
          },
          async listUnreadRecipientUserIds() {
            return ["unused"];
          },
          async sendUnreadDigestForUser(userId, options) {
            sent.push({ idempotencyKey: options?.idempotencyKey, userId });
            return {
              sent: true,
              unreadCount: userId === "user-a" ? 2 : 1,
              userId,
            };
          },
        },
      },
    );

    expect(result.processed).toBe(2);
    expect(sent.map((entry) => entry.userId)).toEqual(["user-a", "user-b"]);
    expect(sent[0]?.idempotencyKey).toMatch(/^email_/);
  });

  it("keeps digest jobs moving when one recipient fails", async () => {
    const result = await sendUnreadNotificationDigestJob(
      {
        dryRun: false,
        userIds: ["user-a", "user-b"],
      },
      {
        notificationService: {
          async getUnreadCount(userId) {
            if (userId === "user-a") {
              throw new Error("Profile lookup failed");
            }

            return 1;
          },
          async listUnreadRecipientUserIds() {
            return [];
          },
          async sendUnreadDigestForUser(userId) {
            return {
              sent: true,
              unreadCount: 1,
              userId,
            };
          },
        },
      },
    );

    expect(result.results).toEqual([
      expect.objectContaining({
        error: "Profile lookup failed",
        sent: false,
        userId: "user-a",
      }),
      expect.objectContaining({
        sent: true,
        userId: "user-b",
      }),
    ]);
  });

  it("rejects malformed digest job inputs", async () => {
    await expect(
      sendUnreadNotificationDigestJob({
        recipientScanLimit: 0,
      }),
    ).rejects.toThrow();
  });

  it("validates, deduplicates, and isolates event reminder recipients", async () => {
    const result = await sendEventReminderNotificationsJob(
      {
        dryRun: false,
        eventId: "event-1",
        eventTitle: "MoraForesight",
        linkHref: "/dashboard",
        recipientUserIds: ["user-a", "user-a", "user-b"],
        startsAt: "2026-06-12T10:00:00.000Z",
      },
      {
        notificationService: {
          async createEventUpdateNotification(input) {
            if (input.recipientUserId === "user-b") {
              throw new Error("Notification write failed");
            }

            return {
              notification: {
                createdAt: "2026-06-01T10:00:00.000Z",
                id: "n-1",
                message: input.message ?? "Reminder",
                readAt: null,
                recipientUserId: input.recipientUserId,
                title: "Event update",
                type: "event_update",
              },
            };
          },
        },
      },
    );

    expect(result.planned).toBe(2);
    expect(result.results).toEqual([
      expect.objectContaining({
        recipientUserId: "user-a",
      }),
      expect.objectContaining({
        error: "Notification write failed",
        recipientUserId: "user-b",
      }),
    ]);
  });

  it("rejects unsafe event reminder links", async () => {
    await expect(
      sendEventReminderNotificationsJob({
        eventId: "event-1",
        eventTitle: "MoraForesight",
        linkHref: "https://evil.example/phish",
        recipientUserIds: ["user-a"],
      }),
    ).rejects.toThrow("Notification links");
  });
});
