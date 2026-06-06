import "server-only";

import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";

export type SendUnreadNotificationDigestJobInput = {
  dryRun?: boolean;
  recipientScanLimit?: number;
  userIds?: string[];
};

export async function sendUnreadNotificationDigestJob({
  dryRun = true,
  recipientScanLimit = 500,
  userIds,
}: SendUnreadNotificationDigestJobInput = {}) {
  const notificationService = createAppwriteNotificationService();
  const recipientUserIds =
    userIds ??
    (await notificationService.listUnreadRecipientUserIds({
      limit: recipientScanLimit,
    }));
  const results = [];

  for (const userId of recipientUserIds) {
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

    results.push(await notificationService.sendUnreadDigestForUser(userId));
  }

  return {
    dryRun,
    processed: results.length,
    results,
  };
}
