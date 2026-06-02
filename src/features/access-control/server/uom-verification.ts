import "server-only";

import { ID, Query } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import {
  createCodeHash,
  createVerificationCode,
  createVerificationExpiry,
  hasAttemptsRemaining,
  isVerificationExpired,
} from "@/features/access-control/lib/verification";
import { normalizeUomEmail } from "@/features/access-control/lib/rules";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { writeAuditLog } from "@/server/audit";
import { sendUomVerificationCode } from "@/server/email/adapter";
import { getProfile, markProfileUomVerified } from "@/features/access-control/server/profiles";
import type { UomVerificationStatus } from "@/features/access-control/types";

type VerificationRow = {
  $id: string;
  attempts: number;
  codeHash: string;
  expiresAt: string;
  status: UomVerificationStatus;
  uomEmail: string;
  userId: string;
  verifiedAt?: string;
};

function toVerificationRow(row: Record<string, unknown>): VerificationRow {
  return {
    $id: String(row.$id),
    attempts: Number(row.attempts ?? 0),
    codeHash: String(row.codeHash),
    expiresAt: String(row.expiresAt),
    status: String(row.status) as UomVerificationStatus,
    uomEmail: String(row.uomEmail),
    userId: String(row.userId),
    verifiedAt:
      typeof row.verifiedAt === "string" && row.verifiedAt
        ? row.verifiedAt
        : undefined,
  };
}

export async function requestUomVerification({
  uomEmail,
  userId,
}: {
  uomEmail: string;
  userId: string;
}) {
  const env = getServerEnv();
  const profile = await getProfile(userId);

  if (profile?.uomVerified) {
    throw new Error("UoM email is already verified.");
  }

  const normalizedUomEmail = normalizeUomEmail(uomEmail);
  const code = createVerificationCode();
  const codeHash = createCodeHash({
    code,
    pepper: env.APPWRITE_API_KEY,
    uomEmail: normalizedUomEmail,
    userId,
  });
  const { tables } = getAppwriteAdminServices();
  const expiresAt = createVerificationExpiry();
  const row = await tables.createRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    ID.unique(),
    {
      attempts: 0,
      codeHash,
      expiresAt,
      status: "PENDING",
      uomEmail: normalizedUomEmail,
      userId,
    },
  );

  let delivery;

  try {
    delivery = await sendUomVerificationCode({
      code,
      to: normalizedUomEmail,
    });
  } catch (error) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      row.$id,
      { status: "CANCELLED" },
    );

    throw error;
  }

  await writeAuditLog({
    action: "UOM_VERIFICATION_REQUESTED",
    actorUserId: userId,
    metadata: {
      messageId: delivery.messageId,
      provider: delivery.provider,
      uomEmail: normalizedUomEmail,
    },
    targetId: row.$id,
    targetType: "uom_verification_request",
  });

  return {
    deliveredTo: normalizedUomEmail,
    expiresAt,
    requestId: row.$id,
  };
}

export async function confirmUomVerification({
  code,
  requestId,
  userId,
}: {
  code: string;
  requestId: string;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const row = toVerificationRow(
    await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
    ),
  );

  if (row.userId !== userId) {
    throw new Error("Verification request does not belong to this user.");
  }

  const existingProfile = await getProfile(userId);

  if (existingProfile?.uomVerified) {
    throw new Error("UoM email is already verified.");
  }

  if (row.status !== "PENDING") {
    throw new Error("Verification request is not pending.");
  }

  if (isVerificationExpired(row.expiresAt)) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
      { status: "EXPIRED" },
    );
    throw new Error("Verification code has expired.");
  }

  if (!hasAttemptsRemaining(row.attempts)) {
    throw new Error("Verification attempt limit reached.");
  }

  const codeHash = createCodeHash({
    code,
    pepper: env.APPWRITE_API_KEY,
    uomEmail: row.uomEmail,
    userId,
  });

  if (codeHash !== row.codeHash) {
    await tables.updateRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.uomVerificationRequests,
      requestId,
      { attempts: row.attempts + 1 },
    );
    throw new Error("Invalid verification code.");
  }

  const verifiedAt = new Date().toISOString();
  await tables.updateRow(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    requestId,
    {
      status: "VERIFIED",
      verifiedAt,
    },
  );

  const profile = await markProfileUomVerified({
    uomEmail: row.uomEmail,
    userId,
  });

  await writeAuditLog({
    action: "UOM_VERIFICATION_CONFIRMED",
    actorUserId: userId,
    metadata: { uomEmail: row.uomEmail },
    targetId: requestId,
    targetType: "uom_verification_request",
  });

  return profile;
}

export async function getLatestPendingVerification(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.uomVerificationRequests,
    [
      Query.equal("userId", userId),
      Query.equal("status", "PENDING"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ],
    undefined,
    false,
  );

  return result.rows[0] ? toVerificationRow(result.rows[0]) : null;
}
