import { z } from "zod";
import {
  FORM_CONNECTION_PROVIDERS,
  FORM_CONNECTION_PURPOSES,
  FORM_CONNECTION_STATUSES,
} from "@/features/forms/types";
import {
  hasSecretLikeSearchParam,
  safeJsonObjectSchema,
} from "@/lib/validation/safe-json";
import { isProviderApprovedFormUrl } from "@/lib/validation/safe-links";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const formConnectionProviderSchema = z.enum(FORM_CONNECTION_PROVIDERS);
export const formConnectionPurposeSchema = z.enum(FORM_CONNECTION_PURPOSES);
export const formConnectionStatusSchema = z.enum(FORM_CONNECTION_STATUSES);

export const createFormConnectionSchema = z
  .object({
    eventId: z.string().trim().min(1).max(128),
    externalFormId: optionalTrimmedString(256),
    formUrl: z
      .string()
      .trim()
      .url()
      .max(1024)
      .optional()
      .transform((value) => value || undefined)
      .refine((value) => !value || !hasSecretLikeSearchParam(value), {
        message: "Form URLs must not contain secret, token, password, or API key query parameters.",
      }),
    metadata: safeJsonObjectSchema.optional(),
    provider: formConnectionProviderSchema,
    purpose: formConnectionPurposeSchema,
    status: formConnectionStatusSchema.default("active"),
    title: z.string().trim().min(1).max(160),
  })
  .strict()
  .refine((value) => value.externalFormId || value.formUrl, {
    message: "Provide an external form ID or form URL.",
    path: ["formUrl"],
  })
  .superRefine((value, ctx) => {
    if (!value.formUrl) {
      return;
    }

    if (!isProviderApprovedFormUrl(value.formUrl, value.provider)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Form URLs must be HTTPS URLs approved for the selected provider.",
        path: ["formUrl"],
      });
    }
  });

export const listFormConnectionsQuerySchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();
