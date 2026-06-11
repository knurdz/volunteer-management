"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/access-control/server/current-user";
import { listProfiles } from "@/features/access-control/server/profiles";
import { listActiveEventRoleAssignments } from "@/features/access-control/server/roles";
import { createAppwriteNotificationService } from "@/features/notifications/server/notification-service";
import { createNotificationSchema, notificationTypeSchema } from "@/features/notifications/validation";

export type AdminNotificationFormState = {
  message: string;
  status: "error" | "idle" | "success";
};

export async function sendAdminNotification(
  _state: AdminNotificationFormState,
  formData: FormData,
): Promise<AdminNotificationFormState> {
  try {
    const admin = await requireAdmin();
    const recipientUserId = String(formData.get("recipientUserId") ?? "").trim();
    const type = notificationTypeSchema.parse(
      String(formData.get("type") ?? "system"),
    );
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const linkHref = String(formData.get("linkHref") ?? "").trim() || undefined;
    const service = createAppwriteNotificationService();

    const parsed = createNotificationSchema.parse({
      actorUserId: admin.authUser.id,
      linkHref,
      message,
      metadata: {
        createdFrom: "admin_notification_ui",
      },
      recipientUserId,
      title,
      type,
    });
    const result = await service.createNotification(parsed);

    if (result.emailDelivery?.disabled) {
      return {
        message: `Notification saved, but email is disabled: ${result.emailDelivery.reason}`,
        status: "error",
      };
    }

    return {
      message: result.emailDelivery
        ? "Notification saved and email delivery was requested."
        : "Notification saved in-app.",
      status: "success",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification send failed.";

    if (message === "Authentication required.") {
      redirect("/login");
    }

    return {
      message,
      status: "error",
    };
  }
}

export async function sendAdminBulkNotification(
  _state: AdminNotificationFormState,
  formData: FormData,
): Promise<AdminNotificationFormState> {
  try {
    const admin = await requireAdmin();
    const scope = String(formData.get("recipientScope") ?? "");
    const eventId = String(formData.get("eventId") ?? "").trim();
    const type = notificationTypeSchema.parse(
      String(formData.get("type") ?? "system"),
    );
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const linkHref = String(formData.get("linkHref") ?? "").trim() || undefined;
    const recipientUserIds =
      scope === "uom_verified"
        ? await getUomVerifiedRecipientIds()
        : await getEventRecipientIds(eventId);

    if (recipientUserIds.length === 0) {
      return {
        message:
          scope === "uom_verified"
            ? "No active UoM verified recipients were found."
            : "No active recipients were found for the selected event.",
        status: "error",
      };
    }

    const service = createAppwriteNotificationService();
    let disabledEmailCount = 0;
    let requestedEmailCount = 0;

    for (const recipientUserId of recipientUserIds) {
      const parsed = createNotificationSchema.parse({
        actorUserId: admin.authUser.id,
        entityId: scope === "event" ? eventId : undefined,
        entityType: scope === "event" ? "event" : "profile_group",
        linkHref,
        message,
        metadata: {
          createdFrom: "admin_bulk_notification_ui",
          recipientScope: scope,
        },
        recipientUserId,
        title,
        type,
      });
      const result = await service.createNotification(parsed);

      if (result.emailDelivery?.disabled) {
        disabledEmailCount += 1;
      }

      if (result.emailDelivery) {
        requestedEmailCount += 1;
      }
    }

    if (disabledEmailCount > 0) {
      return {
        message: `${recipientUserIds.length} notification${
          recipientUserIds.length === 1 ? "" : "s"
        } saved, but email delivery is disabled by configuration.`,
        status: "error",
      };
    }

    return {
      message: `${recipientUserIds.length} notification${
        recipientUserIds.length === 1 ? "" : "s"
      } saved. Email delivery requested for ${requestedEmailCount} recipient${
        requestedEmailCount === 1 ? "" : "s"
      } based on user preferences.`,
      status: "success",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bulk notification send failed.";

    if (message === "Authentication required.") {
      redirect("/login");
    }

    return {
      message,
      status: "error",
    };
  }
}

async function getUomVerifiedRecipientIds() {
  const profiles = await listProfiles();

  return profiles
    .filter((profile) => profile.status === "ACTIVE" && profile.uomVerified)
    .map((profile) => profile.authUserId);
}

async function getEventRecipientIds(eventId: string) {
  if (!eventId) {
    throw new Error("Select an event before sending event email.");
  }

  const assignments = await listActiveEventRoleAssignments();
  const recipientUserIds = assignments
    .filter((assignment) => assignment.eventId === eventId)
    .map((assignment) => assignment.userId);

  return [...new Set(recipientUserIds)];
}
