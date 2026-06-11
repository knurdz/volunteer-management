import "server-only";

import type { EventRole, RoleAssignment } from "@/features/access-control/types";
import { createNotificationIdempotencyKey } from "@/features/notifications/server/email-idempotency";
import type { CreateNotificationResult } from "@/features/notifications/server/notification-service";
import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";

export const REQUIRED_NOTIFICATION_WORKFLOWS = [
  "verification",
  "role_assignment",
  "event_update",
  "grading_request",
  "report_approval",
] as const;

type WorkflowNotificationService = {
  createEventUpdateNotification(input: {
    actorUserId?: string;
    eventId: string;
    eventTitle: string;
    idempotencyKey?: string;
    linkHref?: string;
    message?: string;
    recipientUserId: string;
  }): Promise<CreateNotificationResult>;
  createGradingRequestNotification(input: {
    actorUserId?: string;
    eventId: string;
    eventTitle: string;
    idempotencyKey?: string;
    linkHref?: string;
    recipientUserId: string;
  }): Promise<CreateNotificationResult>;
  createReportApprovalNotification(input: {
    actorUserId?: string;
    eventId: string;
    eventTitle: string;
    idempotencyKey?: string;
    linkHref?: string;
    recipientUserId: string;
    status?: "approved" | "needs_changes";
  }): Promise<CreateNotificationResult>;
  createRoleAssignmentNotification(input: {
    actorUserId?: string;
    idempotencyKey?: string;
    linkHref?: string;
    recipientUserId: string;
    role: string;
    scope?: string;
  }): Promise<CreateNotificationResult>;
  createVerificationNotification(input: {
    actorUserId?: string;
    idempotencyKey?: string;
    linkHref?: string;
    recipientUserId: string;
    verified?: boolean;
  }): Promise<CreateNotificationResult>;
};

export type WorkflowNotificationRecipientResult = {
  error?: string;
  notification?: CreateNotificationResult;
  recipientUserId: string;
  status: "created" | "failed";
};

export async function notifyRoleAssignmentWorkflow({
  actorUserId,
  assignment,
  linkHref = "/dashboard",
  service = createAppwriteNotificationService(),
}: {
  actorUserId?: string;
  assignment: (Pick<RoleAssignment, "role" | "userId"> & { $id?: string }) | {
    $id?: string;
    eventTitle: string;
    role: EventRole;
    userId: string;
  };
  linkHref?: string;
  service?: WorkflowNotificationService;
}) {
  return service.createRoleAssignmentNotification({
    actorUserId,
    idempotencyKey: createNotificationIdempotencyKey([
      "role_assignment",
      "$id" in assignment ? assignment.$id : undefined,
      assignment.userId,
      assignment.role,
      "eventTitle" in assignment ? assignment.eventTitle : "IEEE SB UoM",
    ]),
    linkHref,
    recipientUserId: assignment.userId,
    role: assignment.role,
    scope: "eventTitle" in assignment ? assignment.eventTitle : "IEEE SB UoM",
  });
}

export async function notifyVerificationWorkflow({
  actorUserId,
  recipientUserId,
  service = createAppwriteNotificationService(),
  verified = true,
}: {
  actorUserId?: string;
  recipientUserId: string;
  service?: WorkflowNotificationService;
  verified?: boolean;
}) {
  return service.createVerificationNotification({
    actorUserId,
    recipientUserId,
    verified,
  });
}

export function notifyEventUpdateWorkflow(input: {
  actorUserId?: string;
  eventId: string;
  eventTitle: string;
  linkHref?: string;
  message?: string;
  recipientUserIds: string[];
  service?: WorkflowNotificationService;
}) {
  return notifyRecipientBatch({
    recipientUserIds: input.recipientUserIds,
    send: (recipientUserId, service) =>
      service.createEventUpdateNotification({
        actorUserId: input.actorUserId,
        eventId: input.eventId,
        eventTitle: input.eventTitle,
        idempotencyKey: createNotificationIdempotencyKey([
          "event_update",
          input.eventId,
          input.message,
          recipientUserId,
        ]),
        linkHref: input.linkHref,
        message: input.message,
        recipientUserId,
      }),
    service: input.service,
  });
}

export function notifyGradingRequestWorkflow(input: {
  actorUserId?: string;
  eventId: string;
  eventTitle: string;
  linkHref?: string;
  recipientUserIds: string[];
  service?: WorkflowNotificationService;
}) {
  return notifyRecipientBatch({
    recipientUserIds: input.recipientUserIds,
    send: (recipientUserId, service) =>
      service.createGradingRequestNotification({
        actorUserId: input.actorUserId,
        eventId: input.eventId,
        eventTitle: input.eventTitle,
        idempotencyKey: createNotificationIdempotencyKey([
          "grading_request",
          input.eventId,
          recipientUserId,
        ]),
        linkHref: input.linkHref,
        recipientUserId,
      }),
    service: input.service,
  });
}

export function notifyReportApprovalWorkflow(input: {
  actorUserId?: string;
  eventId: string;
  eventTitle: string;
  linkHref?: string;
  recipientUserIds: string[];
  service?: WorkflowNotificationService;
  status?: "approved" | "needs_changes";
}) {
  return notifyRecipientBatch({
    recipientUserIds: input.recipientUserIds,
    send: (recipientUserId, service) =>
      service.createReportApprovalNotification({
        actorUserId: input.actorUserId,
        eventId: input.eventId,
        eventTitle: input.eventTitle,
        idempotencyKey: createNotificationIdempotencyKey([
          "report_approval",
          input.eventId,
          input.status ?? "approved",
          recipientUserId,
        ]),
        linkHref: input.linkHref,
        recipientUserId,
        status: input.status,
      }),
    service: input.service,
  });
}

async function notifyRecipientBatch({
  recipientUserIds,
  send,
  service = createAppwriteNotificationService(),
}: {
  recipientUserIds: string[];
  send: (
    recipientUserId: string,
    service: WorkflowNotificationService,
  ) => Promise<CreateNotificationResult>;
  service?: WorkflowNotificationService;
}) {
  const results: WorkflowNotificationRecipientResult[] = [];

  for (const recipientUserId of dedupeRecipientUserIds(recipientUserIds)) {
    try {
      results.push({
        notification: await send(recipientUserId, service),
        recipientUserId,
        status: "created",
      });
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : "Notification failed.",
        recipientUserId,
        status: "failed",
      });
    }
  }

  return results;
}

export function dedupeRecipientUserIds(recipientUserIds: readonly string[]) {
  return [
    ...new Set(
      recipientUserIds
        .map((recipientUserId) => recipientUserId.trim())
        .filter(Boolean),
    ),
  ];
}
