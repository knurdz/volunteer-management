import { z } from "zod";

export type SafeJson =
  | null
  | boolean
  | number
  | string
  | SafeJson[]
  | { [key: string]: SafeJson };

export type SafeJsonObject = Record<string, SafeJson>;

const SECRET_KEY_PATTERN =
  /(?:api[_-]?key|auth[_-]?token|credential|password|private[_-]?key|secret|token)/i;

export const safeJsonValueSchema: z.ZodType<SafeJson> = z.lazy(() =>
  z.union([
    z.string().max(1000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(safeJsonValueSchema).max(50),
    z.record(z.string().min(1).max(80), safeJsonValueSchema),
  ]),
);

export const safeJsonObjectSchema = z
  .record(z.string().min(1).max(80), safeJsonValueSchema)
  .refine((value) => JSON.stringify(value).length <= 4000, {
    message: "Metadata must be 4,000 characters or less.",
  })
  .refine((value) => !containsSecretLikeKey(value), {
    message: "Metadata must not contain secrets, tokens, passwords, or API keys.",
  });

export function containsSecretLikeKey(value: SafeJson): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsSecretLikeKey(item));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(
    ([key, nested]) => SECRET_KEY_PATTERN.test(key) || containsSecretLikeKey(nested),
  );
}

export function hasSecretLikeSearchParam(url: string) {
  try {
    const parsedUrl = new URL(url);
    return Array.from(parsedUrl.searchParams.keys()).some((key) =>
      SECRET_KEY_PATTERN.test(key),
    );
  } catch {
    return false;
  }
}

export function serializeSafeJson(value?: SafeJsonObject) {
  return value ? JSON.stringify(value) : "";
}

export function parseSafeJsonObject(value: unknown): SafeJsonObject | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(value);
  return safeJsonObjectSchema.parse(parsed);
}
