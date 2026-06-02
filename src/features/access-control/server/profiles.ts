import "server-only";

import type { Models } from "node-appwrite";
import { APPWRITE_TABLES } from "@/lib/appwrite/constants";
import { buildInitialProfilePayload } from "@/features/access-control/lib/profile-payload";
import { normalizeEmail } from "@/features/access-control/lib/rules";
import { getServerEnv } from "@/lib/env";
import { getAppwriteAdminServices } from "@/server/appwrite";
import { isAppwriteNotFound } from "@/server/errors";
import type { AuthUser, Profile } from "@/features/access-control/types";

type AppwriteUser = Models.User<Models.Preferences>;
type AppRow = Models.Row & Record<string, unknown>;

function toAuthUser(user: AppwriteUser): AuthUser {
  return {
    email: normalizeEmail(user.email),
    id: user.$id,
    name: user.name ?? "",
  };
}

export function toProfile(row: AppRow): Profile {
  return {
    $id: row.$id,
    authUserId: String(row.authUserId),
    googleEmail: String(row.googleEmail),
    lastLoginAt: typeof row.lastLoginAt === "string" ? row.lastLoginAt : undefined,
    name: typeof row.name === "string" ? row.name : undefined,
    status: row.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    uomEmail: typeof row.uomEmail === "string" && row.uomEmail ? row.uomEmail : undefined,
    uomVerified: Boolean(row.uomVerified),
    uomVerifiedAt:
      typeof row.uomVerifiedAt === "string" && row.uomVerifiedAt
        ? row.uomVerifiedAt
        : undefined,
  };
}

export async function getProfile(userId: string) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();

  try {
    const row = await tables.getRow(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      userId,
    );

    return toProfile(row as AppRow);
  } catch (error) {
    if (isAppwriteNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function bootstrapProfile(user: AppwriteUser) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const authUser = toAuthUser(user);
  const now = new Date().toISOString();
  const existingProfile = await getProfile(authUser.id);

  if (!existingProfile) {
    const row = await tables.createRow<AppRow>(
      env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
      APPWRITE_TABLES.profiles,
      authUser.id,
      buildInitialProfilePayload(authUser, now),
    );

    return toProfile(row);
  }

  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    authUser.id,
    {
      googleEmail: authUser.email,
      lastLoginAt: now,
      name: authUser.name,
    },
  );

  return toProfile(row);
}

export async function markProfileUomVerified({
  uomEmail,
  userId,
}: {
  uomEmail: string;
  userId: string;
}) {
  const env = getServerEnv();
  const { tables } = getAppwriteAdminServices();
  const now = new Date().toISOString();
  const row = await tables.updateRow<AppRow>(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    userId,
    {
      uomEmail,
      uomVerified: true,
      uomVerifiedAt: now,
    },
  );

  return toProfile(row);
}

export async function listProfiles() {
  const env = getServerEnv();
  const { Query } = await import("node-appwrite");
  const { tables } = getAppwriteAdminServices();
  const result = await tables.listRows(
    env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
    APPWRITE_TABLES.profiles,
    [Query.limit(500), Query.orderDesc("lastLoginAt")],
    undefined,
    false,
  );

  return result.rows.map((row) => toProfile(row as AppRow));
}
