import { createHash, randomInt } from "crypto";

import {
  UOM_VERIFICATION_CODE_TTL_MINUTES,
  UOM_VERIFICATION_MAX_ATTEMPTS,
} from "@/lib/appwrite/constants";

export function createVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

export function createCodeHash({
  code,
  pepper,
  uomEmail,
  userId,
}: {
  code: string;
  pepper: string;
  uomEmail: string;
  userId: string;
}) {
  return createHash("sha256")
    .update(`${userId}:${uomEmail}:${code}:${pepper}`)
    .digest("hex");
}

export function createVerificationExpiry(now = new Date()) {
  return new Date(
    now.getTime() + UOM_VERIFICATION_CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();
}

export function isVerificationExpired(expiresAt: string, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function hasAttemptsRemaining(attempts: number) {
  return attempts < UOM_VERIFICATION_MAX_ATTEMPTS;
}
