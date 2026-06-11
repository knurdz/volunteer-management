import { z } from "zod";
import { safeJsonObjectSchema } from "@/lib/validation/safe-json";
import { isSafeNotificationLink } from "@/lib/validation/safe-links";
import { NOTIFICATION_TYPES } from "@/features/notifications/types";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export const createNotificationSchema = z
  .object({
    actorUserId: optionalTrimmedString(64),
    entityId: optionalTrimmedString(128),
    entityType: optionalTrimmedString(64),
    emailIdempotencyKey: optionalTrimmedString(160),
    idempotencyKey: optionalTrimmedString(160),
    linkHref: z
      .string()
      .trim()
      .max(512)
      .optional()
      .transform((value) => value || undefined)
      .refine((value) => !value || isSafeNotificationLink(value), {
        message:
          "Notification links must be internal paths or approved HTTPS URLs.",
      }),
    message: z.string().trim().min(1).max(1000),
    metadata: safeJsonObjectSchema.optional(),
    recipientUserId: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(160),
    type: notificationTypeSchema,
  })
  .strict();

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).catch(15),
});

export const markNotificationsReadSchema = z
  .object({
    notificationIds: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
  })
  .strict();

export const notificationPreferencesSchema = z
  .object({
    emailEnabled: z.boolean().default(false),
    inAppEnabled: z.boolean().default(true),
    typePreferences: z
      .partialRecord(
        notificationTypeSchema,
        z
          .object({
            emailEnabled: z.boolean().optional(),
            inAppEnabled: z.boolean().optional(),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();
