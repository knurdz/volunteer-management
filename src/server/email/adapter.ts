import "server-only";

import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";

export type EmailDeliveryResult = {
  messageId?: string;
  provider: "smtp";
};

type SmtpConfig = {
  fromEmail: string;
  fromName: string;
  host: string;
  password?: string;
  port: number;
  secure: boolean;
  user?: string;
};

export async function sendUomVerificationCode({
  code,
  to,
}: {
  code: string;
  to: string;
}): Promise<EmailDeliveryResult> {
  const smtp = getSmtpConfig();

  const subject = "Verify your UoM email";
  const text = [
    `Your IEEE SB UoM Volunteer Management verification code is ${code}.`,
    "This code expires in 15 minutes.",
    "If you did not request this code, ignore this email.",
  ].join("\n\n");
  const html = [
    "<p>Your IEEE SB UoM Volunteer Management verification code is:</p>",
    `<p><strong style="font-size:20px;letter-spacing:2px">${code}</strong></p>`,
    "<p>This code expires in 15 minutes.</p>",
    "<p>If you did not request this code, ignore this email.</p>",
  ].join("");

  const transporter = nodemailer.createTransport({
    auth:
      smtp.user && smtp.password
        ? {
            pass: smtp.password,
            user: smtp.user,
          }
        : undefined,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
  });

  const result = await transporter.sendMail({
    from: {
      address: smtp.fromEmail,
      name: smtp.fromName,
    },
    html,
    subject,
    text,
    to,
  });

  return { messageId: result.messageId, provider: "smtp" };
}

function getSmtpConfig(): SmtpConfig {
  const env = getServerEnv();
  const host = env.SMTP_HOST;
  const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;

  if (!host || !fromEmail) {
    throw new Error(
      "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL.",
    );
  }

  return {
    fromEmail,
    fromName: env.SMTP_FROM_NAME || "IEEE SB UoM Volunteer Management",
    host,
    password: env.SMTP_PASSWORD,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE ?? false,
    user: env.SMTP_USER,
  };
}
