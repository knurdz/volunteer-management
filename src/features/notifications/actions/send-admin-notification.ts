"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/access-control/server/current-user";
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
    const enableEmail = formData.get("enableEmail") === "on";
    const service = createAppwriteNotificationService();

    if (enableEmail) {
      await service.upsertPreferences(recipientUserId, {
        emailEnabled: true,
        inAppEnabled: true,
        typePreferences: {
          [type]: {
            emailEnabled: true,
            inAppEnabled: true,
          },
        },
      });
    }

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

    if (enableEmail && result.emailDelivery?.disabled) {
      return {
        message: `Notification saved, but email is disabled: ${result.emailDelivery.reason}`,
        status: "error",
      };
    }

    return {
      message: enableEmail
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
