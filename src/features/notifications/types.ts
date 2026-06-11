import type { SafeJsonObject } from "@/lib/validation/safe-json";

export const NOTIFICATION_TYPES = [
  "verification",
  "role_assignment",
  "event_update",
  "grading_request",
  "report_approval",
  "system",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type Notification = {
  actorUserId?: string;
  createdAt: string;
  entityId?: string;
  entityType?: string;
  id: string;
  linkHref?: string;
  message: string;
  metadata?: SafeJsonObject;
  readAt: string | null;
  recipientUserId: string;
  title: string;
  type: NotificationType;
};

export type NotificationChannelPreference = {
  emailEnabled?: boolean;
  inAppEnabled?: boolean;
};

export type NotificationPreference = {
  createdAt: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  typePreferences: Partial<Record<NotificationType, NotificationChannelPreference>>;
  updatedAt: string;
  userId: string;
};

export type CreateNotificationInput = {
  actorUserId?: string;
  emailIdempotencyKey?: string;
  entityId?: string;
  entityType?: string;
  idempotencyKey?: string;
  linkHref?: string;
  message: string;
  metadata?: SafeJsonObject;
  recipientUserId: string;
  title: string;
  type: NotificationType;
};

export type NotificationListResult = {
  notifications: Notification[];
  unreadCount: number;
};
