import { z } from "zod";

const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional(),
);

const optionalNumber = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalBooleanString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .enum(["true", "false"])
    .optional()
    .transform((option) => option === "true"),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_DATABASE_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalNumber,
  SMTP_SECURE: optionalBooleanString,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM_EMAIL: optionalEmail,
  SMTP_FROM_NAME: optionalString,
  INTERNAL_JOB_TOKEN: optionalString,
  NOTIFICATION_EMAILS_ENABLED: optionalBooleanString,
  OPTIONAL_AI_API_KEY: z.string().optional(),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_DATABASE_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID: z.string().min(1),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID:
      process.env.NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID,
  });
}
