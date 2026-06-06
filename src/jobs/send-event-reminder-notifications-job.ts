import "server-only";

import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";

export type SendEventReminderNotificationsJobInput = {
  dryRun?: boolean;
  eventId: string;
  eventTitle: string;
  linkHref?: string;
  recipientUserIds: string[];
  startsAt?: string;
};

export async function sendEventReminderNotificationsJob({
  dryRun = true,
  eventId,
  eventTitle,
  linkHref,
  recipientUserIds,
  startsAt,
}: SendEventReminderNotificationsJobInput) {
  if (!eventId.trim() || !eventTitle.trim()) {
    throw new Error("Event ID and title are required for reminder notifications.");
  }

  const notificationService = createAppwriteNotificationService();
  const message = startsAt
    ? `${eventTitle} is scheduled for ${new Date(startsAt).toLocaleString()}.`
    : `${eventTitle} has an upcoming event reminder.`;
  const results = [];

  for (const recipientUserId of recipientUserIds) {
    if (dryRun) {
      results.push({
        notification: null,
        plannedRecipientUserId: recipientUserId,
        reason: "Dry run only. Pass dryRun: false from a trusted runner to create reminders.",
      });
      continue;
    }

    results.push(
      await notificationService.createEventUpdateNotification({
        eventId,
        eventTitle,
        linkHref,
        message,
        recipientUserId,
      }),
    );
  }

  return {
    dryRun,
    planned: recipientUserIds.length,
    results,
  };
}
