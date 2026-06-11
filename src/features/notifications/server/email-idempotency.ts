import "server-only";

import { createHash } from "node:crypto";

export function createNotificationIdempotencyKey(parts: readonly unknown[]) {
  return createIdempotencyKey("notification", parts);
}

export function createEmailRetryIdempotencyKey(parts: readonly unknown[]) {
  return createIdempotencyKey("email", parts);
}

function createIdempotencyKey(prefix: string, parts: readonly unknown[]) {
  const digest = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 32);

  return `${prefix}_${digest}`;
}
