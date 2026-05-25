import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APPWRITE_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_APPWRITE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_DATABASE_ID: z.string().min(1),
  NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID: z.string().min(1),
  APPWRITE_API_KEY: z.string().min(1),
  INITIAL_ADMIN_EMAILS: z.string().default(""),
  KNURDZ_EMAIL_API_URL: z.string().url().optional().or(z.literal("")),
  KNURDZ_EMAIL_API_KEY: z.string().optional(),
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
