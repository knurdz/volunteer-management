import "server-only";

import { z } from "zod";
import { isSafeNotificationLink } from "@/lib/validation/safe-links";
import { createNotificationIdempotencyKey } from "@/features/notifications/server/email-idempotency";
import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";
import { dedupeRecipientUserIds } from "@/features/notifications/server/workflow-notifications";

export type SendEventReminderNotificationsJobInput = {
  dryRun?: boolean;
  eventId: string;
  eventTitle: string;
  linkHref?: string;
  recipientUserIds: string[];
  startsAt?: string;
};

type EventReminderNotificationService = Pick<
  ReturnType<typeof createAppwriteNotificationService>,
  "createEventUpdateNotification"
>;

const eventReminderJobInputSchema = z
  .object({
    dryRun: z.boolean().default(true),
    eventId: z.string().trim().min(1).max(128),
    eventTitle: z.string().trim().min(1).max(160),
    linkHref: z
      .string()
      .trim()
      .max(512)
      .optional()
      .refine((value) => !value || isSafeNotificationLink(value), {
        message:
          "Notification links must be internal paths or approved HTTPS URLs.",
      }),
    recipientUserIds: z.array(z.string().trim().min(1).max(64)).min(1).max(5000),
    startsAt: z.string().datetime().optional(),
  })
  .strict();

export async function sendEventReminderNotificationsJob(
  input: SendEventReminderNotificationsJobInput,
  deps: { notificationService?: EventReminderNotificationService } = {},
) {
  const {
    dryRun,
    eventId,
    eventTitle,
    linkHref,
    recipientUserIds: rawRecipientUserIds,
    startsAt,
  } = eventReminderJobInputSchema.parse(input);
  const notificationService =
    deps.notificationService ?? createAppwriteNotificationService();
  const recipientUserIds = dedupeRecipientUserIds(rawRecipientUserIds);
  const message = startsAt
    ? `${eventTitle} is scheduled for ${new Date(startsAt).toLocaleString()}.`
    : `${eventTitle} has an upcoming event reminder.`;
  const results = [];

  for (const recipientUserId of recipientUserIds) {
    try {
      if (dryRun) {
        results.push({
          notification: null,
          plannedRecipientUserId: recipientUserId,
          reason:
            "Dry run only. Pass dryRun: false from a trusted runner to create reminders.",
        });
        continue;
      }

      results.push({
        notification: await notificationService.createEventUpdateNotification({
          eventId,
          eventTitle,
          idempotencyKey: createNotificationIdempotencyKey([
            "event_reminder",
            eventId,
            startsAt,
            recipientUserId,
          ]),
          linkHref,
          message,
          recipientUserId,
        }),
        recipientUserId,
      });
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : "Reminder creation failed.",
        notification: null,
        recipientUserId,
      });
    }
  }

  return {
    dryRun,
    planned: recipientUserIds.length,
    results,
  };
}
