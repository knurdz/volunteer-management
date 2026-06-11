import "server-only";

import { z } from "zod";
import { createEmailRetryIdempotencyKey } from "@/features/notifications/server/email-idempotency";
import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";
import { dedupeRecipientUserIds } from "@/features/notifications/server/workflow-notifications";

export type SendUnreadNotificationDigestJobInput = {
  dryRun?: boolean;
  recipientScanLimit?: number;
  userIds?: string[];
};

type DigestNotificationService = Pick<
  ReturnType<typeof createAppwriteNotificationService>,
  "getUnreadCount" | "listUnreadRecipientUserIds" | "sendUnreadDigestForUser"
>;

const digestJobInputSchema = z
  .object({
    dryRun: z.boolean().default(true),
    recipientScanLimit: z.number().int().min(1).max(5000).default(500),
    userIds: z.array(z.string().trim().min(1).max(64)).max(5000).optional(),
  })
  .strict();

export async function sendUnreadNotificationDigestJob(
  input: SendUnreadNotificationDigestJobInput = {},
  deps: { notificationService?: DigestNotificationService } = {},
) {
  const { dryRun, recipientScanLimit, userIds } = digestJobInputSchema.parse(input);
  const notificationService =
    deps.notificationService ?? createAppwriteNotificationService();
  const recipientUserIds =
    userIds?.length
      ? dedupeRecipientUserIds(userIds)
      : await notificationService.listUnreadRecipientUserIds({
          limit: recipientScanLimit,
        });
  const results = [];

  for (const userId of recipientUserIds) {
    try {
      const unreadCount = await notificationService.getUnreadCount(userId);

      if (dryRun) {
        results.push({
          reason: "Dry run only. Pass dryRun: false from a trusted runner to send.",
          sent: false,
          unreadCount,
          userId,
        });
        continue;
      }

      results.push(
        await notificationService.sendUnreadDigestForUser(userId, {
          idempotencyKey: createEmailRetryIdempotencyKey([
            "unread-digest-job",
            userId,
            unreadCount,
          ]),
        }),
      );
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : "Digest send failed.",
        sent: false,
        unreadCount: 0,
        userId,
      });
    }
  }

  return {
    dryRun,
    processed: results.length,
    results,
  };
}
