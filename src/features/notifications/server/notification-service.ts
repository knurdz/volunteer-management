import "server-only";

import { requireAuth } from "@/features/access-control/server/current-user";
import { createNotificationSchema, notificationPreferencesSchema } from "@/features/notifications/validation";
import {
  createAppwriteNotificationRepository,
  type NotificationRepository,
} from "@/features/notifications/server/notification-repository";
import {
  createNotificationEmailAdapter,
  sendNotificationEmailWithRetry,
  type NotificationEmailAdapter,
  type NotificationEmailDelivery,
} from "@/features/notifications/server/email-adapter";
import {
  createEmailRetryIdempotencyKey,
  createNotificationIdempotencyKey,
} from "@/features/notifications/server/email-idempotency";
import type {
  CreateNotificationInput,
  Notification,
  NotificationListResult,
  NotificationPreference,
} from "@/features/notifications/types";

export type CreateNotificationResult = {
  emailDelivery?: NotificationEmailDelivery;
  notification: Notification | null;
};

export type NotificationDigestResult = {
  emailDelivery?: NotificationEmailDelivery;
  reason?: string;
  sent: boolean;
  unreadCount: number;
  userId: string;
};

type NotificationServiceDeps = {
  emailAdapter: NotificationEmailAdapter;
  now?: () => Date;
  repository: NotificationRepository;
};

export function createNotificationService({
  emailAdapter,
  now = () => new Date(),
  repository,
}: NotificationServiceDeps) {
  async function getPreferences(userId: string) {
    return (await repository.getPreferences(userId)) ?? getDefaultPreferences(userId, now());
  }

  async function createNotification(
    input: CreateNotificationInput,
  ): Promise<CreateNotificationResult> {
    const body = createNotificationSchema.parse(input);
    const preferences = await getPreferences(body.recipientUserId);
    const createdAt = now().toISOString();
    const notificationIdempotencyKey =
      body.idempotencyKey ?? body.emailIdempotencyKey;
    const notification = isInAppEnabled(preferences, body.type)
      ? await repository.create({
          ...body,
          createdAt,
          idempotencyKey: notificationIdempotencyKey,
        })
      : null;
    let emailDelivery: NotificationEmailDelivery | undefined;

    if (isEmailEnabled(preferences, body.type)) {
      const recipientEmail = await repository.getRecipientEmail(body.recipientUserId);

      if (recipientEmail) {
        emailDelivery = await sendNotificationEmailWithRetry(
          emailAdapter,
          buildNotificationEmailMessage({
            idempotencyKey:
              body.emailIdempotencyKey ??
              body.idempotencyKey ??
              createEmailRetryIdempotencyKey([
                "notification",
                notification?.id,
                body.recipientUserId,
                body.type,
                body.entityType,
                body.entityId,
                body.title,
                body.message,
              ]),
            input: body,
            to: recipientEmail,
          }),
        );
      }
    }

    return {
      emailDelivery,
      notification,
    };
  }

  async function listNotificationsForUser(
    userId: string,
    options?: { limit?: number },
  ): Promise<NotificationListResult> {
    const [notifications, unreadCount] = await Promise.all([
      repository.listForRecipient(userId, options),
      repository.getUnreadCount(userId),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  return {
    createEventUpdateNotification(input: {
      actorUserId?: string;
      eventId: string;
      eventTitle: string;
      idempotencyKey?: string;
      linkHref?: string;
      message?: string;
      recipientUserId: string;
    }) {
      return createNotification({
        actorUserId: input.actorUserId,
        entityId: input.eventId,
        entityType: "event",
        idempotencyKey:
          input.idempotencyKey ??
          createNotificationIdempotencyKey([
            "event_update",
            input.eventId,
            input.recipientUserId,
            input.message ?? input.eventTitle,
          ]),
        linkHref: input.linkHref,
        message: input.message ?? `${input.eventTitle} has an event update.`,
        recipientUserId: input.recipientUserId,
        title: "Event update",
        type: "event_update",
      });
    },

    createGradingRequestNotification(input: {
      actorUserId?: string;
      eventId: string;
      eventTitle: string;
      idempotencyKey?: string;
      linkHref?: string;
      recipientUserId: string;
    }) {
      return createNotification({
        actorUserId: input.actorUserId,
        entityId: input.eventId,
        entityType: "grading_request",
        idempotencyKey:
          input.idempotencyKey ??
          createNotificationIdempotencyKey([
            "grading_request",
            input.eventId,
            input.recipientUserId,
          ]),
        linkHref: input.linkHref,
        message: `Volunteer grading is requested for ${input.eventTitle}.`,
        recipientUserId: input.recipientUserId,
        title: "Grading request",
        type: "grading_request",
      });
    },

    createNotification,

    createReportApprovalNotification(input: {
      actorUserId?: string;
      eventId: string;
      eventTitle: string;
      idempotencyKey?: string;
      linkHref?: string;
      recipientUserId: string;
      status?: "approved" | "needs_changes";
    }) {
      const status = input.status ?? "approved";

      return createNotification({
        actorUserId: input.actorUserId,
        entityId: input.eventId,
        entityType: "report",
        idempotencyKey:
          input.idempotencyKey ??
          createNotificationIdempotencyKey([
            "report_approval",
            input.eventId,
            input.recipientUserId,
            status,
          ]),
        linkHref: input.linkHref,
        message:
          status === "approved"
            ? `${input.eventTitle} report has been approved.`
            : `${input.eventTitle} report needs changes before approval.`,
        recipientUserId: input.recipientUserId,
        title: status === "approved" ? "Report approved" : "Report needs changes",
        type: "report_approval",
      });
    },

    createRoleAssignmentNotification(input: {
      actorUserId?: string;
      idempotencyKey?: string;
      linkHref?: string;
      recipientUserId: string;
      role: string;
      scope?: string;
    }) {
      const scope = input.scope ?? "IEEE SB UoM";

      return createNotification({
        actorUserId: input.actorUserId,
        entityType: "role_assignment",
        idempotencyKey:
          input.idempotencyKey ??
          createNotificationIdempotencyKey([
            "role_assignment",
            input.recipientUserId,
            input.role,
            scope,
          ]),
        linkHref: input.linkHref,
        message: `You were assigned ${input.role} in ${scope}.`,
        metadata: {
          role: input.role,
          scope,
        },
        recipientUserId: input.recipientUserId,
        title: "Role assigned",
        type: "role_assignment",
      });
    },

    createVerificationNotification(input: {
      actorUserId?: string;
      idempotencyKey?: string;
      linkHref?: string;
      recipientUserId: string;
      verified?: boolean;
    }) {
      const verified = input.verified ?? true;

      return createNotification({
        actorUserId: input.actorUserId,
        entityType: "verification",
        idempotencyKey:
          input.idempotencyKey ??
          createNotificationIdempotencyKey([
            "verification",
            input.recipientUserId,
            verified,
          ]),
        linkHref: input.linkHref ?? "/verify-uom",
        message: verified
          ? "Your UoM email verification is complete."
          : "Your UoM email verification needs attention.",
        recipientUserId: input.recipientUserId,
        title: verified ? "Verification complete" : "Verification update",
        type: "verification",
      });
    },

    getUnreadCount(userId: string) {
      return repository.getUnreadCount(userId);
    },

    getPreferencesForUser(userId: string) {
      return getPreferences(userId);
    },

    listNotificationsForUser,

    listUnreadRecipientUserIds(options?: { limit?: number }) {
      return repository.listUnreadRecipientUserIds(options);
    },

    markNotificationsRead(userId: string, notificationIds: string[]) {
      return repository.markReadForRecipient({
        notificationIds,
        readAt: now().toISOString(),
        userId,
      });
    },

    async sendUnreadDigestForUser(
      userId: string,
      options: { idempotencyKey?: string } = {},
    ): Promise<NotificationDigestResult> {
      const preferences = await getPreferences(userId);
      const unreadCount = await repository.getUnreadCount(userId);

      if (unreadCount === 0) {
        return {
          reason: "No unread notifications.",
          sent: false,
          unreadCount,
          userId,
        };
      }

      if (!preferences.emailEnabled) {
        return {
          reason: "Email notifications are disabled by preference.",
          sent: false,
          unreadCount,
          userId,
        };
      }

      const recipientEmail = await repository.getRecipientEmail(userId);

      if (!recipientEmail) {
        return {
          reason: "Recipient email was not found.",
          sent: false,
          unreadCount,
          userId,
        };
      }

      const unreadNotifications = await repository.listUnreadForRecipient(userId, {
        limit: 5,
      });
      const emailDelivery = await sendNotificationEmailWithRetry(emailAdapter, {
        idempotencyKey:
          options.idempotencyKey ??
          createEmailRetryIdempotencyKey([
            "unread-digest",
            userId,
            unreadCount,
            unreadNotifications.map((notification) => notification.id),
          ]),
        subject: `You have ${unreadCount} unread IEEE SB UoM notification${
          unreadCount === 1 ? "" : "s"
        }`,
        text: [
          `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`,
          ...unreadNotifications.map(
            (notification) => `- ${notification.title}: ${notification.message}`,
          ),
        ].join("\n"),
        to: recipientEmail,
      });

      return {
        emailDelivery,
        sent: !emailDelivery.disabled,
        unreadCount,
        userId,
      };
    },

    upsertPreferences(userId: string, input: unknown) {
      const parsed = notificationPreferencesSchema.parse(input);

      return repository.upsertPreferences({
        ...parsed,
        userId,
      });
    },
  };
}

export function createAppwriteNotificationService() {
  return createNotificationService({
    emailAdapter: createNotificationEmailAdapter(),
    repository: createAppwriteNotificationRepository(),
  });
}

export async function createNotification(input: CreateNotificationInput) {
  return createAppwriteNotificationService().createNotification(input);
}

export async function getNotificationSummaryForUser(
  userId: string,
  options?: { limit?: number },
) {
  return createAppwriteNotificationService().listNotificationsForUser(userId, options);
}

export async function listNotificationsForCurrentUser(options?: { limit?: number }) {
  const user = await requireAuth();
  return getNotificationSummaryForUser(user.authUser.id, options);
}

export async function getNotificationPreferencesForUser(userId: string) {
  return createAppwriteNotificationService().getPreferencesForUser(userId);
}

export async function getNotificationPreferencesForCurrentUser() {
  const user = await requireAuth();
  return getNotificationPreferencesForUser(user.authUser.id);
}

export async function markNotificationsReadForCurrentUser(notificationIds: string[]) {
  const user = await requireAuth();
  return createAppwriteNotificationService().markNotificationsRead(
    user.authUser.id,
    notificationIds,
  );
}

export async function upsertNotificationPreferencesForCurrentUser(input: unknown) {
  const user = await requireAuth();

  return createAppwriteNotificationService().upsertPreferences(user.authUser.id, input);
}

function getDefaultPreferences(userId: string, date: Date): NotificationPreference {
  const now = date.toISOString();

  return {
    createdAt: now,
    emailEnabled: false,
    inAppEnabled: true,
    typePreferences: {},
    updatedAt: now,
    userId,
  };
}

function isInAppEnabled(
  preferences: NotificationPreference,
  type: CreateNotificationInput["type"],
) {
  return preferences.typePreferences[type]?.inAppEnabled ?? preferences.inAppEnabled;
}

function isEmailEnabled(
  preferences: NotificationPreference,
  type: CreateNotificationInput["type"],
) {
  return preferences.typePreferences[type]?.emailEnabled ?? preferences.emailEnabled;
}

function buildNotificationEmailMessage({
  idempotencyKey,
  input,
  to,
}: {
  idempotencyKey: string;
  input: CreateNotificationInput;
  to: string;
}) {
  const linkLine = input.linkHref ? `\n\nOpen: ${input.linkHref}` : "";

  return {
    idempotencyKey,
    subject: input.title,
    text: `${input.message}${linkLine}`,
    to,
  };
}
