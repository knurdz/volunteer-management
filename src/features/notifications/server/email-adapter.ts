import "server-only";

import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { createEmailRetryIdempotencyKey } from "@/features/notifications/server/email-idempotency";

export type NotificationEmailMessage = {
  html?: string;
  idempotencyKey?: string;
  subject: string;
  text: string;
  to: string;
};

export type NotificationEmailDelivery = {
  disabled?: boolean;
  idempotencyKey?: string;
  messageId?: string;
  provider: "disabled" | "smtp";
  reason?: string;
  safeRecipient?: string;
};

export type NotificationEmailAdapter = {
  sendNotification(message: NotificationEmailMessage): Promise<NotificationEmailDelivery>;
};

export function createDisabledNotificationEmailAdapter(
  reason = "Notification email delivery is disabled.",
): NotificationEmailAdapter {
  return {
    async sendNotification(message) {
      return {
        disabled: true,
        idempotencyKey: message.idempotencyKey,
        provider: "disabled",
        reason,
        safeRecipient: maskEmail(message.to),
      };
    },
  };
}

export function createNotificationEmailAdapter(): NotificationEmailAdapter {
  const env = getServerEnv();

  if (!env.NOTIFICATION_EMAILS_ENABLED) {
    return createDisabledNotificationEmailAdapter(
      "Set NOTIFICATION_EMAILS_ENABLED=true and SMTP settings to send notification email.",
    );
  }

  const host = env.SMTP_HOST;
  const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;

  if (!host || !fromEmail) {
    return createDisabledNotificationEmailAdapter(
      "Notification email is enabled but SMTP host/from settings are missing.",
    );
  }

  const transporter = nodemailer.createTransport({
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? {
            pass: env.SMTP_PASSWORD,
            user: env.SMTP_USER,
          }
        : undefined,
    host,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
  });

  return {
    async sendNotification(message) {
      const result = await transporter.sendMail({
        from: {
          address: fromEmail,
          name: env.SMTP_FROM_NAME || "IEEE SB UoM Volunteer Management",
        },
        headers: message.idempotencyKey
          ? { "X-Notification-Idempotency-Key": message.idempotencyKey }
          : undefined,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: message.to,
      });

      return {
        idempotencyKey: message.idempotencyKey,
        messageId: result.messageId,
        provider: "smtp",
        safeRecipient: maskEmail(message.to),
      };
    },
  };
}

export async function sendNotificationEmailWithRetry(
  adapter: NotificationEmailAdapter,
  message: NotificationEmailMessage,
  options: { maxAttempts?: number } = {},
) {
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 2, 1), 5);
  const idempotencyKey =
    message.idempotencyKey ??
    createEmailRetryIdempotencyKey([
      "notification-email",
      message.to,
      message.subject,
      message.text,
    ]);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await adapter.sendNotification({
        ...message,
        idempotencyKey,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");

  if (!local || !domain) {
    return "unknown";
  }

  return `${local.slice(0, 2)}***@${domain}`;
}
